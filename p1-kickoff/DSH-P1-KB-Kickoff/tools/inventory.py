#!/usr/bin/env python3
"""Read-only content inventory. Not a parser, search index, or access-control system.

Writes a new local-only output directory outside the source tree. Source contents
are never changed; normal filesystem access-time updates may still occur.
Use a quiescent, trusted input tree (ideally a read-only snapshot).
"""
from __future__ import annotations
import argparse
import collections
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import tempfile
import time
from typing import Any

SCHEMA = "dsh-kb-inventory/1"
CANDIDATES = {".pdf", ".docx", ".doc", ".pptx", ".ppt", ".xlsx", ".xls", ".txt", ".md", ".csv", ".json", ".jsonl", ".html", ".htm"}
SKIP_DIRS = {".git", ".dsh", ".ssh", ".aws", ".azure", "node_modules", "__pycache__", ".venv", "venv"}
SECRET_SUFFIXES = {".pem", ".key", ".p12", ".pfx", ".keystore"}

def dump(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=True, indent=2, allow_nan=False) + "\n", encoding="utf-8")

def excluded(name: str) -> bool:
    lowered = name.lower()
    return (lowered == ".env" or lowered.startswith(".env.") or
            lowered.startswith("id_rsa") or lowered.startswith("id_ed25519") or
            "credential" in lowered or Path(lowered).suffix in SECRET_SUFFIXES)

def unchanged(before: os.stat_result, after: os.stat_result) -> bool:
    return all(getattr(before, k) == getattr(after, k) for k in
               ("st_dev", "st_ino", "st_size", "st_mtime_ns", "st_ctime_ns"))

def inspect_file(path: Path, relative: str, *, hash_files: bool, max_bytes: int) -> dict:
    row: dict[str, Any] = {
        "inventory_id": hashlib.sha256(relative.encode("utf-8", "surrogateescape")).hexdigest(),
        "relative_path": relative, "extension": path.suffix.lower(),
        "status": "METADATA_ONLY", "sha256": None,
        "candidate_for_parser_check": path.suffix.lower() in CANDIDATES,
        "extraction_status": "NOT_CHECKED", "authorization_status": "NOT_CHECKED",
    }
    try:
        before = path.lstat()
        row.update(size_bytes=before.st_size, mtime_ns=before.st_mtime_ns)
        if stat.S_ISLNK(before.st_mode):
            row["status"] = "SKIPPED_SYMLINK"
            return row
        if not stat.S_ISREG(before.st_mode):
            row["status"] = "SKIPPED_SPECIAL"
            return row
        if excluded(path.name):
            row["status"] = "SKIPPED_SENSITIVE_NAME"
            return row
        if not hash_files:
            return row
        if before.st_size > max_bytes:
            row["status"] = "SKIPPED_SIZE_LIMIT"
            return row
        fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0))
        with os.fdopen(fd, "rb") as stream:
            opened = os.fstat(stream.fileno())
            if not stat.S_ISREG(opened.st_mode) or not unchanged(before, opened):
                row["status"] = "CHANGED_DURING_READ"
                return row
            digest = hashlib.sha256()
            total = 0
            while chunk := stream.read(min(1024 * 1024, max_bytes + 1 - total)):
                digest.update(chunk)
                total += len(chunk)
                if total > max_bytes:
                    row["status"] = "CHANGED_DURING_READ"
                    return row
            after_fd = os.fstat(stream.fileno())
        after_path = path.lstat()
        if total != before.st_size or not unchanged(before, after_fd) or not unchanged(before, after_path):
            row["status"] = "CHANGED_DURING_READ"
            return row
        row.update(status="HASHED", sha256=digest.hexdigest())
    except OSError as exc:
        # Do not copy an OS error string, which may disclose an absolute path.
        row.update(status="READ_ERROR", error_type=type(exc).__name__, error_errno=exc.errno)
    return row

def choose_sample(rows: list[dict], count: int, seed: str) -> list[dict]:
    """Deterministic round-robin across extensions and first-level folders.
    This is a format-diversity sample, not a semantic or random population sample.
    Exact-byte duplicates stay in inventory, but appear at most once in sample.
    """
    buckets: dict[tuple[str, str], list[dict]] = collections.defaultdict(list)
    for row in rows:
        if row["status"] not in {"HASHED", "METADATA_ONLY"} or not row["candidate_for_parser_check"]:
            continue
        folder = row["relative_path"].split("/")[0] if "/" in row["relative_path"] else "."
        buckets[(row["extension"], folder)].append(row)
    for bucket in buckets.values():
        bucket.sort(key=lambda r: hashlib.sha256((seed + r["inventory_id"]).encode()).hexdigest())
    selected, seen = [], set()
    keys = sorted(buckets)
    while keys and len(selected) < count:
        next_keys = []
        for key in keys:
            bucket = buckets[key]
            while bucket:
                row = bucket.pop()
                identity = row["sha256"] or row["inventory_id"]
                if identity not in seen:
                    seen.add(identity)
                    selected.append(row)
                    break
            if bucket:
                next_keys.append(key)
            if len(selected) == count:
                break
        keys = next_keys
    return selected

def inventory(root: Path, output: Path, *, hash_files: bool = True,
              max_bytes: int = 128 * 1024 * 1024, sample_size: int = 200,
              seed: str = "dsh-p1-pilot-v1") -> dict:
    if max_bytes < 1 or sample_size < 0:
        raise ValueError("max_bytes must be positive and sample_size non-negative")
    if root.is_symlink():
        raise ValueError("source root may not be a symlink; use an explicit resolved path")
    source = root.resolve(strict=True)
    if not source.is_dir():
        raise ValueError("source root must be a directory")
    target = output.absolute()
    parent = target.parent.resolve(strict=True)
    target = parent / target.name
    if target.exists() or target.is_symlink():
        raise FileExistsError("output must not already exist")
    if parent == source or source in parent.parents:
        raise ValueError("output must be outside the source tree")
    # Reserve a new destination without overwriting an existing path.
    target.mkdir(mode=0o700)
    staging = Path(tempfile.mkdtemp(prefix=".kb-inventory-", dir=parent))
    start = time.monotonic()
    rows: list[dict] = []
    traversal_issues: list[dict] = []
    def walk_error(exc: OSError) -> None:
        traversal_issues.append({"status": "TRAVERSAL_ERROR", "error_type": type(exc).__name__, "errno": exc.errno})
    try:
        for current, dirs, files in os.walk(source, topdown=True, followlinks=False, onerror=walk_error):
            directory = Path(current)
            retained = []
            for name in sorted(dirs):
                subdir = directory / name
                relative = subdir.relative_to(source).as_posix()
                if name in SKIP_DIRS or excluded(name):
                    traversal_issues.append({"relative_path": relative, "status": "SKIPPED_DIRECTORY_POLICY"})
                elif subdir.is_symlink():
                    traversal_issues.append({"relative_path": relative, "status": "SKIPPED_DIRECTORY_SYMLINK"})
                else:
                    retained.append(name)
            dirs[:] = retained
            for name in sorted(files):
                path = directory / name
                rows.append(inspect_file(path, path.relative_to(source).as_posix(),
                                         hash_files=hash_files, max_bytes=max_bytes))
        rows.sort(key=lambda row: row["relative_path"])
        groups: dict[str, list[str]] = collections.defaultdict(list)
        for row in rows:
            if row["status"] == "HASHED":
                groups[row["sha256"]].append(row["inventory_id"])
        duplicates = [{"sha256": sha, "inventory_ids": ids} for sha, ids in sorted(groups.items()) if len(ids) > 1]
        sample = choose_sample(rows, sample_size, seed)
        states = dict(collections.Counter(row["status"] for row in rows))
        summary = {
            "schema": SCHEMA, "mode": "READ_ONLY_CONTENT_INVENTORY",
            "scope": "LOCAL_ONLY; metadata may be sensitive; no network",
            "file_count": len(rows), "total_bytes": sum(r.get("size_bytes", 0) for r in rows),
            "statuses": states, "extensions": dict(collections.Counter(r["extension"] for r in rows)),
            "exact_duplicate_groups": len(duplicates),
            "extra_duplicate_copies": sum(len(g["inventory_ids"]) - 1 for g in duplicates),
            "sample_count": len(sample), "sample_seed": seed,
            "sample_method": "extension/folder round-robin, exact-byte dedup; not semantic sampling",
            "max_hash_bytes": max_bytes, "hash_files": hash_files,
            "elapsed_seconds": round(time.monotonic() - start, 6),
            "attention_required": bool(states.get("READ_ERROR") or states.get("CHANGED_DURING_READ") or
                                       any(i["status"] == "TRAVERSAL_ERROR" for i in traversal_issues)),
            "not_done": ["document parsing", "OCR", "classification", "embedding", "authorization verification", "business document ID/version mapping"],
        }
        with (staging / "inventory.jsonl").open("x", encoding="utf-8") as stream:
            for row in rows:
                stream.write(json.dumps(row, ensure_ascii=True, allow_nan=False) + "\n")
        dump(staging / "summary.json", summary)
        dump(staging / "duplicates.json", duplicates)
        dump(staging / "pilot-selection.json", sample)
        dump(staging / "traversal-issues.json", traversal_issues)
        (staging / "LOCAL_ONLY.txt").write_text(
            "Keep this directory on the authorized machine. Filenames, hashes and metadata may be sensitive.\n"
            "inventory_id is a path-local inventory identifier, NOT an OA business document ID.\n"
            "Duplicates are reported, never deleted. PDF scan/text status and parsing quality are NOT checked.\n"
            "The scanner skips obvious credential-like names; this is not a data-loss-prevention classifier.\n",
            encoding="utf-8")
        for item in staging.iterdir():
            os.replace(item, target / item.name)
        staging.rmdir()
        return summary
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        # Keep an incomplete run visible rather than treating it as a completed inventory.
        (target / "INCOMPLETE.txt").write_text("Inventory interrupted or failed. Rerun to a new output directory.\n", encoding="utf-8")
        raise

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--metadata-only", action="store_true")
    parser.add_argument("--max-file-mib", type=int, default=128)
    parser.add_argument("--sample-size", type=int, default=200)
    parser.add_argument("--seed", default="dsh-p1-pilot-v1")
    args = parser.parse_args()
    try:
        summary = inventory(args.root, args.output, hash_files=not args.metadata_only,
                            max_bytes=args.max_file_mib * 1024 * 1024, sample_size=args.sample_size, seed=args.seed)
    except (OSError, ValueError) as exc:
        print(json.dumps({"ok": False, "error_type": type(exc).__name__, "error": str(exc)}))
        return 2
    print(json.dumps(summary, ensure_ascii=True, allow_nan=False))
    return 3 if summary["attention_required"] else 0

if __name__ == "__main__":
    raise SystemExit(main())
