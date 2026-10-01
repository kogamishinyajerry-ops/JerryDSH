# 检索验收记录格式 v1

这是**本包新定义的离线验收交换格式**，不声称现有 `/query` 或 `/get` 已返回这些字段。读取真实后端合同后，由本地采集适配器做一次映射；不要为了评测工具而重建后端任务/文档模型。

## 问题 JSONL

每行：

```json
{"query_id":"q-001","query":"APU 启动机过热的历史处理","expected_doc_ids":["<实际相关文档ID>"],"forbidden_doc_ids":[],"must_be_empty":false,"label_source":"<人工标注记录引用>"}
```

不得把示例占位 ID 当业务文档。每题必须有非空 expected_doc_ids，或显式 `must_be_empty:true`。无标签题可以另存探索记录，不进入这组评测。`forbidden_doc_ids` 是已知禁止返回的负例集合，不代表完整授权系统。标注集不是全库全部相关文档的穷举。

## 结果 JSONL

```json
{
  "query_id":"q-001",
  "trial_id":"warm-1",
  "run_id":"p1-real-local-2026-10-01-run1",
  "snapshot_id":"<真实不可变快照ID>",
  "backend_build":"<真实后端构建SHA>",
  "source_mode":"real-local",
  "phase":"warm",
  "status":"ok",
  "elapsed_ms":245.3,
  "raw_response_sha256":"<真实原始响应文件的64位小写SHA-256>",
  "hits":[
    {"doc_id":"<真实文档ID>","source_locator":"<真实页/段落/表格位置>","source_sha256":"<真实原文文件的64位小写SHA-256>"}
  ]
}
```

计时和 ID 不能从示例生成。对同一文档命中的多个片段，由适配器在保持最先出现排名的前提下归并成一条文档结果；保留完整原始响应，避免重复片段占满前五名。规范化的 hits 应保留此次返回的全部唯一文档，以检查排在第 k 名后的显式越权负例。

status 仅为 `ok/error/timeout`。错误和超时也要记录实际耗时并保留一行，不能丢掉慢请求后重新算 p95。hits 可以为空。phase 为 `warm/cold`，必须在本地记录对冷/热的实际定义。

source_mode 为 `real-local/public/synthetic`，同一评测不得混合；每次评测也必须绑定单一 run、snapshot 和 backend build。变更了索引/实现/模型，另开一轮记录。

实际运行：

```bash
python3 tools/evaluate.py \
  --queries /本地授权目录/queries.jsonl \
  --results /本地授权目录/results.jsonl \
  --source-mode real-local \
  --output /本地授权目录/evaluation-new.json
```

路径由本地确定；记录禁止自动向云端传输。

## 计算和门槛

- Hit@k：前 k 条唯一文档是否命中该题任意人工标注文档。
- judged Recall@k：前 k 条命中的标注文档数 / 该题标注数，仅对提供的标注集合成立。
- 先对每题热查询求均值，再对正例问题做宏平均，避免对某一题重复测试来提高权重。
- 预期无结果题不计入正例 Hit@k 均值，单独检查。
- p95 使用最近秩 `ceil(0.95*n)`，冷/热分别统计，包含失败和超时。
- 默认每题至少三次热查询；默认任一已记录请求超过 3000 ms 即触发时延失败，p95 达标不能掩盖尾部超时。
- 默认建议宏平均 Hit@5 ≥ 0.8。30 题和真实语料规模由本地验收方案检查，脚本不自动判定完整生产验收。
- 默认未强制每题一个冷启动试次；缺失冷启动数据应在独立实机报告写 NOT_RUN，不能据记录 PASS 说冷启动通过。
- 输出有源文件摘要/定位字段，不代表已验证摘要的文件实体存在或定位正确，必须在本地独立打开核验。

## 合成示例

`examples/results.synthetic.jsonl` 的结果与耗时均是测试夹具，专门用于演示评测工具，不来自检索后端。运行必须指定 `--source-mode synthetic`，输出前缀始终为 `SYNTHETIC_`，不能成为真实模型、业务召回或性能结论。
