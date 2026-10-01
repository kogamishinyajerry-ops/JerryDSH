#!/usr/bin/env python3
"""Evaluate normalized retrieval records, NOT an implementation of a KB API.

The local adapter must measure /query + transport + result rendering. Do not
feed fabricated timings or treat these records as proof of live server identity.
Only standard library; no network or credentials are used here.
"""
from __future__ import annotations
import argparse
import json
import math
from pathlib import Path
import statistics
from typing import Any


def jsonl(path: Path) -> list[dict]:
    rows = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            row = json.loads(line, parse_constant=lambda _: (_ for _ in ()).throw(ValueError("non-finite JSON")))
        except (ValueError, TypeError) as exc:
            raise ValueError(f"{path.name}:{number}: invalid JSON") from exc
        if not isinstance(row, dict):
            raise ValueError(f"{path.name}:{number}: expected an object")
        rows.append(row)
    return rows


def text(value: Any, name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{name} must be a nonempty string")
    return value


def string_list(value: Any, name: str) -> list[str]:
    if not isinstance(value, list) or any(not isinstance(v, str) or not v.strip() for v in value):
        raise ValueError(f"{name} must be a list of nonempty strings")
    if len(value) != len(set(value)):
        raise ValueError(f"{name} has duplicate values")
    return value


def sha(value: Any, name: str) -> str:
    value = text(value, name)
    if len(value) != 64 or any(c not in "0123456789abcdef" for c in value):
        raise ValueError(f"{name} must be a lowercase SHA-256 hex string")
    return value


def percentile95(values: list[float]) -> float | None:
    return sorted(values)[math.ceil(0.95 * len(values)) - 1] if values else None


def evaluate(queries: list[dict], records: list[dict], *, k: int = 5,
             latency_ms: float = 3000, min_trials: int = 3,
             minimum_hit_rate: float = 0.8, source_mode: str = "real-local") -> dict:
    if k < 1 or min_trials < 1 or not math.isfinite(latency_ms) or latency_ms <= 0:
        raise ValueError("invalid evaluation limits")
    if not 0 <= minimum_hit_rate <= 1 or not math.isfinite(minimum_hit_rate):
        raise ValueError("minimum_hit_rate must be within [0,1]")
    if source_mode not in {"real-local", "public", "synthetic"}:
        raise ValueError("invalid source_mode")
    if not queries:
        raise ValueError("query set is empty")
    by_query = {}
    for q in queries:
        qid = text(q.get("query_id"), "query_id")
        if qid in by_query:
            raise ValueError("duplicate query_id")
        text(q.get("query"), "query")
        expected = string_list(q.get("expected_doc_ids"), "expected_doc_ids")
        forbidden = string_list(q.get("forbidden_doc_ids", []), "forbidden_doc_ids")
        must_empty = q.get("must_be_empty", False)
        if not isinstance(must_empty, bool):
            raise ValueError("must_be_empty must be boolean")
        if set(expected) & set(forbidden):
            raise ValueError("expected and forbidden IDs overlap")
        if must_empty and expected:
            raise ValueError("empty-result test may not have expected IDs")
        if not expected and not must_empty:
            raise ValueError("every query needs relevance labels or an explicit empty-result expectation")
        text(q.get("label_source"), "label_source")
        by_query[qid] = q
    grouped: dict[str, list[dict]] = {qid: [] for qid in by_query}
    seen_trials, issues, elapsed_by_phase, run_ids, snapshots, backend_ids = set(), [], {"warm": [], "cold": []}, set(), set(), set()
    for row in records:
        qid = text(row.get("query_id"), "query_id")
        if qid not in by_query:
            raise ValueError("unknown query_id in result records")
        trial = text(row.get("trial_id"), "trial_id")
        identity = (qid, trial)
        if identity in seen_trials:
            raise ValueError("duplicate query/trial record")
        seen_trials.add(identity)
        if row.get("source_mode") != source_mode:
            raise ValueError("mixed or unexpected source_mode")
        run_ids.add(text(row.get("run_id"), "run_id"))
        snapshots.add(text(row.get("snapshot_id"), "snapshot_id"))
        backend_ids.add(text(row.get("backend_build"), "backend_build"))
        sha(row.get("raw_response_sha256"), "raw_response_sha256")
        phase = row.get("phase")
        if phase not in elapsed_by_phase:
            raise ValueError("phase must be cold or warm")
        elapsed = row.get("elapsed_ms")
        if isinstance(elapsed, bool) or not isinstance(elapsed, (int, float)) or not math.isfinite(elapsed) or elapsed < 0:
            raise ValueError("every trial, including errors/timeouts, needs a finite measured elapsed_ms")
        elapsed_by_phase[phase].append(elapsed)
        status = row.get("status")
        if status not in {"ok", "error", "timeout"}:
            raise ValueError("invalid trial status")
        hits = row.get("hits")
        if not isinstance(hits, list):
            raise ValueError("hits must be a list")
        ids = []
        for hit in hits:
            if not isinstance(hit, dict):
                raise ValueError("each hit must be an object")
            doc_id = text(hit.get("doc_id"), "hit doc_id")
            text(hit.get("source_locator"), "hit source_locator")
            sha(hit.get("source_sha256"), "hit source_sha256")
            ids.append(doc_id)
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate document IDs: normalize passage hits to unique ranked documents")
        q = by_query[qid]
        trial_issues = []
        if status != "ok":
            trial_issues.append("REQUEST_" + status.upper())
        if elapsed > latency_ms:
            trial_issues.append("OVER_LATENCY_BUDGET")
        if set(ids) & set(q.get("forbidden_doc_ids", [])):
            trial_issues.append("FORBIDDEN_DOCUMENT_RETURNED")
        if q.get("must_be_empty") and ids:
            trial_issues.append("EXPECTED_EMPTY_RESULT")
        expected_ids = set(q["expected_doc_ids"])
        retrieved_ids = set(ids[:k]) if status == "ok" else set()
        hit_score = bool(expected_ids & retrieved_ids)
        recall = len(expected_ids & retrieved_ids) / len(expected_ids) if expected_ids else None
        measured = {"trial_id": trial, "phase": phase, "status": status,
                    "hit_at_k": hit_score if expected_ids else None,
                    "judged_recall_at_k": recall, "elapsed_ms": elapsed, "issues": trial_issues}
        grouped[qid].append(measured)
        for issue in trial_issues:
            issues.append({"query_id": qid, "trial_id": trial, "issue": issue})
    if len(run_ids) > 1 or len(snapshots) > 1 or len(backend_ids) > 1:
        raise ValueError("one evaluation must reference one run, one immutable snapshot, one backend build")
    query_scores, positive_hit_rates, positive_recalls = {}, [], []
    for qid, q in by_query.items():
        trials = grouped[qid]
        warm = [r for r in trials if r["phase"] == "warm"]
        if len(warm) < min_trials:
            issues.append({"query_id": qid, "issue": "MISSING_WARM_TRIALS", "expected": min_trials, "actual": len(warm)})
        if q["expected_doc_ids"]:
            # Zero scores on completely missing warm trials, not silent omission.
            hit_rate = statistics.mean(float(r["hit_at_k"]) for r in warm) if warm else 0.0
            recall = statistics.mean(r["judged_recall_at_k"] for r in warm) if warm else 0.0
            positive_hit_rates.append(hit_rate)
            positive_recalls.append(recall)
        else:
            hit_rate = recall = None
        query_scores[qid] = {"warm_trials": len(warm), "hit_rate_at_k": hit_rate,
                             "judged_recall_at_k": recall, "trials": trials}
    macro_hit = statistics.mean(positive_hit_rates) if positive_hit_rates else None
    if macro_hit is not None and macro_hit < minimum_hit_rate:
        issues.append({"issue": "BELOW_PROPOSED_HIT_RATE", "threshold": minimum_hit_rate, "actual": macro_hit})
    summaries = {phase: {"samples": len(times), "p50_ms": statistics.median(times) if times else None, "p95_ms": percentile95(times), "max_ms": max(times) if times else None}
                 for phase, times in elapsed_by_phase.items()}
    qualified = not issues
    label = ("RECORDED_CHECKS_PASS" if qualified else "RECORDED_CHECKS_FAIL") if source_mode != "synthetic" else (
        "SYNTHETIC_CHECKS_PASS" if qualified else "SYNTHETIC_CHECKS_FAIL")
    return {
        "schema": "dsh-kb-retrieval-evaluation/1", "result": label,
        "source_mode": source_mode, "run_id": next(iter(run_ids), None),
        "snapshot_id": next(iter(snapshots), None), "backend_build": next(iter(backend_ids), None),
        "query_count": len(queries), "positive_queries": len(positive_hit_rates), "record_count": len(records),
        "k": k, "macro_hit_rate_at_k": macro_hit,
        "macro_judged_recall_at_k": statistics.mean(positive_recalls) if positive_recalls else None,
        "latency": summaries, "latency_budget_ms": latency_ms,
        "min_warm_trials_per_query": min_trials,
        "proposed_hit_rate_threshold": minimum_hit_rate,
        "issues": issues, "queries": query_scores,
        "limits": [
            "This evaluates supplied records; it does not attest to the live backend or timing authenticity.",
            "Citations are structurally checked; raw bytes/locators must be independently resolved locally.",
            "Relevance is measured only against the supplied judged set; this is not exhaustive corpus recall.",
            "Forbidden IDs catch listed leaks only; passing is not proof of full authorization isolation.",
            "Synthetic results never count as real document, model, latency, or DSH acceptance.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--queries", type=Path, required=True)
    parser.add_argument("--results", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--source-mode", choices=["real-local", "public", "synthetic"], default="real-local")
    parser.add_argument("--k", type=int, default=5)
    parser.add_argument("--latency-ms", type=float, default=3000)
    parser.add_argument("--min-trials", type=int, default=3)
    parser.add_argument("--min-hit-rate", type=float, default=0.8)
    args = parser.parse_args()
    try:
        report = evaluate(jsonl(args.queries), jsonl(args.results), k=args.k,
                          latency_ms=args.latency_ms, min_trials=args.min_trials,
                          minimum_hit_rate=args.min_hit_rate, source_mode=args.source_mode)
        with args.output.open("x", encoding="utf-8") as stream:
            stream.write(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n")
    except (OSError, ValueError) as exc:
        print(json.dumps({"ok": False, "error_type": type(exc).__name__, "error": str(exc)}, ensure_ascii=False))
        return 2
    print(json.dumps({key: report[key] for key in ("result", "query_count", "record_count", "macro_hit_rate_at_k", "latency")}, ensure_ascii=False))
    return 0 if not report["issues"] else 1

if __name__ == "__main__":
    raise SystemExit(main())
