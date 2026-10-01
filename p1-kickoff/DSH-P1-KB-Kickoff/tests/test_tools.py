from __future__ import annotations
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'tools' / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
inv, ev = load('inventory'), load('evaluate')

class InventoryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name).resolve()
        self.source = self.base / 'source'
        self.source.mkdir()
        self.output = self.base / 'output'
    def write(self, name, data='公开合成样例，非工程结论。'):
        p = self.source / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(data, encoding='utf-8')
        return p
    def scan(self, **kwargs):
        result = inv.inventory(self.source, self.output, **kwargs)
        rows = [json.loads(line) for line in (self.output / 'inventory.jsonl').read_text().splitlines()]
        return result, rows
    def test_hash_and_no_content_changes(self):
        p = self.write('通道/说明.md')
        before, mtime = p.read_bytes(), p.stat().st_mtime_ns
        summary, rows = self.scan()
        self.assertEqual(rows[0]['sha256'], hashlib.sha256(before).hexdigest())
        self.assertEqual((p.read_bytes(), p.stat().st_mtime_ns), (before, mtime))
        self.assertEqual(rows[0]['extraction_status'], 'NOT_CHECKED')
        self.assertEqual(summary['file_count'], 1)
    def test_duplicates_never_deleted(self):
        self.write('one/a.txt', 'same'); self.write('two/b.txt', 'same')
        summary, rows = self.scan()
        self.assertEqual(summary['exact_duplicate_groups'], 1)
        self.assertEqual(summary['sample_count'], 1)
        self.assertEqual(len(list(self.source.rglob('*.txt'))), 2)
        self.assertNotEqual(rows[0]['inventory_id'], rows[1]['inventory_id'])
    def test_sensitive_names_skipped(self):
        self.write('.credentials.yaml', 'SYNTHETIC_SECRET')
        self.write('.env', 'FAKE')
        self.write('private.pem', 'FAKE')
        summary, rows = self.scan()
        self.assertTrue(all(r['status'] == 'SKIPPED_SENSITIVE_NAME' and r['sha256'] is None for r in rows))
        self.assertNotIn('SYNTHETIC_SECRET', (self.output / 'inventory.jsonl').read_text())
    def test_policy_directory_skipped(self):
        self.write('.git/config', 'not a document'); self.write('ok.txt')
        summary, rows = self.scan()
        self.assertEqual(len(rows), 1)
        self.assertEqual(json.loads((self.output / 'traversal-issues.json').read_text())[0]['status'], 'SKIPPED_DIRECTORY_POLICY')
    def test_size_limit(self):
        self.write('large.pdf', 'not a PDF parser' * 100)
        _, rows = self.scan(max_bytes=20)
        self.assertEqual(rows[0]['status'], 'SKIPPED_SIZE_LIMIT')
        self.assertIsNone(rows[0]['sha256'])
    def test_metadata_only(self):
        self.write('a.docx')
        _, rows = self.scan(hash_files=False)
        self.assertEqual(rows[0]['status'], 'METADATA_ONLY')
    def test_empty_inventory(self):
        summary, rows = self.scan()
        self.assertEqual(summary['sample_count'], 0)
        self.assertEqual(rows, [])
    def test_output_inside_source_rejected(self):
        with self.assertRaises(ValueError):
            inv.inventory(self.source, self.source / 'out')
        self.assertFalse((self.source / 'out').exists())
    def test_existing_output_never_overwritten(self):
        self.output.mkdir(); sentinel = self.output / 'sentinel'
        sentinel.write_text('keep')
        with self.assertRaises(FileExistsError):
            inv.inventory(self.source, self.output)
        self.assertEqual(sentinel.read_text(), 'keep')
    def test_symlink_escape_and_cycle(self):
        external = self.base / 'outside.txt'; external.write_text('EXTERNAL_PRIVATE')
        (self.source / 'escape.txt').symlink_to(external)
        (self.source / 'loop').symlink_to(self.source, target_is_directory=True)
        summary, rows = self.scan()
        self.assertEqual(rows[0]['status'], 'SKIPPED_SYMLINK')
        self.assertIsNone(rows[0]['sha256'])
        self.assertEqual(summary['file_count'], 1)
    def test_symlink_root_rejected(self):
        alias = self.base / 'alias'; alias.symlink_to(self.source, target_is_directory=True)
        with self.assertRaises(ValueError):
            inv.inventory(alias, self.output)
    def test_changed_read_no_digest(self):
        self.write('unstable.txt')
        with patch.object(inv, 'unchanged', return_value=False):
            summary, rows = self.scan()
        self.assertEqual(rows[0]['status'], 'CHANGED_DURING_READ')
        self.assertIsNone(rows[0]['sha256'])
        self.assertTrue(summary['attention_required'])
    def test_error_is_reported(self):
        p = self.write('denied.txt')
        with patch.object(inv.os, 'open', side_effect=PermissionError(13, 'denied')):
            row = inv.inspect_file(p, 'denied.txt', hash_files=True, max_bytes=1000)
        self.assertEqual(row['status'], 'READ_ERROR')
        self.assertEqual(row['error_errno'], 13)
    def test_selection_is_repeatable(self):
        for i in range(12): self.write(f'{i % 3}/文档{i}.md', f'synthetic-{i}')
        self.scan(sample_size=5)
        selected = json.loads((self.output / 'pilot-selection.json').read_text())
        inv.inventory(self.source, self.base / 'output2', sample_size=5)
        self.assertEqual(selected, json.loads((self.base / 'output2/pilot-selection.json').read_text()))
    def test_inventory_id_not_business_id(self):
        self.write('report.txt')
        _, rows = self.scan()
        self.assertNotIn('doc_id', rows[0])
        self.assertEqual(rows[0]['authorization_status'], 'NOT_CHECKED')
    def test_unknown_extension_is_inventory_only(self):
        self.write('script.py', 'print("example")')
        summary, rows = self.scan()
        self.assertFalse(rows[0]['candidate_for_parser_check'])
        self.assertEqual(summary['sample_count'], 0)

class EvaluationTests(unittest.TestCase):
    def setUp(self):
        self.queries = [dict(query_id='q1', query='合成样例', expected_doc_ids=['d1'],
                             forbidden_doc_ids=['secret'], must_be_empty=False, label_source='SYNTHETIC_FIXTURE')]
        self.rows = [dict(query_id='q1', trial_id=f't{i}', run_id='synthetic-run', snapshot_id='synthetic-snapshot',
                         backend_build='SYNTHETIC_NOT_BACKEND', phase='warm', source_mode='synthetic', status='ok',
                         elapsed_ms=10+i, raw_response_sha256='a'*64,
                         hits=[dict(doc_id='d1', source_locator='synthetic.md#L1', source_sha256='b'*64)]) for i in range(3)]
    def call(self, **kwargs):
        return ev.evaluate(self.queries, self.rows, source_mode='synthetic', **kwargs)
    def test_good_synthetic_never_production_pass(self):
        out = self.call()
        self.assertEqual(out['result'], 'SYNTHETIC_CHECKS_PASS')
        self.assertEqual(out['macro_hit_rate_at_k'], 1)
    def test_missing_query_trials_fail(self):
        self.rows = []
        out = self.call()
        self.assertEqual(out['macro_hit_rate_at_k'], 0)
        self.assertTrue(out['issues'])
    def test_missing_one_trial_fails(self):
        self.rows.pop()
        self.assertIn('MISSING_WARM_TRIALS', str(self.call()['issues']))
    def test_timeout_in_latency_and_score(self):
        self.rows[1].update(status='timeout', elapsed_ms=3500, hits=[])
        out = self.call()
        self.assertEqual(out['latency']['warm']['max_ms'], 3500)
        self.assertAlmostEqual(out['macro_hit_rate_at_k'], 2/3)
        self.assertIn('REQUEST_TIMEOUT', str(out['issues']))
    def test_forbidden_hit_below_k_also_fails(self):
        self.rows[0]['hits'] += [dict(doc_id='secret', source_locator='restricted#L1', source_sha256='c'*64)]
        self.assertIn('FORBIDDEN_DOCUMENT_RETURNED', str(self.call(k=1)['issues']))
    def test_no_answer_query_cannot_inflate_positive_hit_rate(self):
        self.queries.append(dict(query_id='q2', query='无结果样例', expected_doc_ids=[], must_be_empty=True, label_source='SYNTHETIC_FIXTURE'))
        for i in range(3):
            row = copy.deepcopy(self.rows[i]); row.update(query_id='q2', hits=[]); self.rows.append(row)
        out = self.call()
        self.assertEqual(out['positive_queries'], 1)
        self.assertEqual(out['macro_hit_rate_at_k'], 1)
    def test_expected_empty_with_hit_fails(self):
        self.queries[0].update(expected_doc_ids=[], must_be_empty=True)
        self.assertIn('EXPECTED_EMPTY_RESULT', str(self.call()['issues']))
    def test_unlabelled_query_rejected(self):
        self.queries[0]['expected_doc_ids'] = []
        with self.assertRaises(ValueError): self.call()
    def test_unknown_query_rejected(self):
        self.rows[0]['query_id'] = 'unknown'
        with self.assertRaises(ValueError): self.call()
    def test_duplicate_trials_rejected(self):
        self.rows.append(copy.deepcopy(self.rows[0]))
        with self.assertRaises(ValueError): self.call()
    def test_duplicate_query_rejected(self):
        self.queries.append(copy.deepcopy(self.queries[0]))
        with self.assertRaises(ValueError): self.call()
    def test_duplicate_hit_rejected(self):
        self.rows[0]['hits'] *= 2
        with self.assertRaises(ValueError): self.call()
    def test_invalid_citation_rejected(self):
        del self.rows[0]['hits'][0]['source_locator']
        with self.assertRaises(ValueError): self.call()
    def test_nonfinite_and_bool_latency_rejected(self):
        for value in (float('nan'), float('inf'), -1, True):
            with self.subTest(value=value):
                self.rows[0]['elapsed_ms'] = value
                with self.assertRaises(ValueError): self.call()
    def test_mixed_snapshot_rejected(self):
        self.rows[0]['snapshot_id'] = 'other'
        with self.assertRaises(ValueError): self.call()
    def test_synthetic_cannot_masquerade_as_local(self):
        with self.assertRaises(ValueError): ev.evaluate(self.queries, self.rows, source_mode='real-local')
    def test_nearest_rank_p95(self):
        self.assertEqual(ev.percentile95(list(range(1, 101))), 95)
        self.assertIsNone(ev.percentile95([]))
    def test_cold_latency_separate_and_budget_enforced(self):
        row = copy.deepcopy(self.rows[0]); row.update(trial_id='cold-1', phase='cold', elapsed_ms=3100)
        self.rows.append(row)
        out = self.call()
        self.assertEqual(out['latency']['warm']['samples'], 3)
        self.assertEqual(out['latency']['cold']['samples'], 1)
        self.assertIn('OVER_LATENCY_BUDGET', str(out['issues']))
    def test_both_expected_and_forbidden_rejected(self):
        self.queries[0]['forbidden_doc_ids'] = ['d1']
        with self.assertRaises(ValueError): self.call()
    def test_invalid_raw_digest_rejected(self):
        self.rows[0]['raw_response_sha256'] = 'not a digest'
        with self.assertRaises(ValueError): self.call()

if __name__ == '__main__':
    unittest.main()
