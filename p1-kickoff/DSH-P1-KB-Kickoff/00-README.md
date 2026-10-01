# DSH P1 · 内网知识库 v1 开工包

**日期：2026-10-01｜本轮交付：实施规格、可执行盘点/验收辅助工具、本地 Agent 开工提示词。**

本包没有实现或替代 `civair_kb` 后端，没有导入真实 OA 文档，没有调用 embedding/生成模型，也没有改动 GitHub 远端。两个辅助工具使用 Python 标准库，已经在本轮 Linux / Python 3.13.5 中通过 36 项自动测试。

## 下一步做什么

将 `02-LOCAL-AGENT-PROMPT.md` 全文交给现有本地 Agent；将本目录作为附件或放进它可读的项目目录。它先封闭上一轮 P0 的四项部署问题，再复用本机 `civair-kb` 推进 P1。真实文件留在允许处理它们的内网环境，Mac 只用公开/合成样本演练。

用户指定的 P1 目标：约一万份 OA 技术文档，清洗、分类、embedding、检索；复用 kb-civair 的管线模式；返回有使用价值的相关文档清单，目标三秒内。`01-P1-SPEC.md` 的 200 份试点、30 道标注查询和 80% Hit@5 是本包提出的可调整试点门槛，不是已发生的结果或原始交接的额外要求。

## 文件

| 文件 | 用途 |
|---|---|
| `01-P1-SPEC.md` | 复用边界、阶段、验收与交付范围 |
| `02-LOCAL-AGENT-PROMPT.md` | 可直接发送给本地 Agent 的完整执行提示词 |
| `tools/inventory.py` | 只读内容盘点、流式 SHA-256、重复组、格式/目录分层样本清单 |
| `tools/evaluate.py` | 对规范化检索记录计算 Hit@5、标注集 Recall@5、时延和错误/泄漏检查 |
| `docs/RECORD-FORMAT.md` | 本包的验收记录格式，不是已有后端 API 的声明 |
| `docs/SOURCES-AND-STATUS.md` | 本轮实际来源、复用判断、未取得条件 |
| `examples/` | 明确标记的合成示例，不能算真实检索验收 |
| `tests/test_tools.py` | 36 项测试 |
| `TEST-REPORT.json` / `TEST-LOG.txt` | 本轮实际测试摘要/日志 |

## 直接运行

在本目录执行：

```bash
python3 -m unittest discover -s tests -v

# 盘点的是本包合成文件；输出必须新建且位于输入树之外。
python3 tools/inventory.py \
  --root examples/corpus \
  --output demo-inventory \
  --sample-size 4

# 只验证评测工具计算和失败规则。时延记录是合成值，不是测量值。
python3 tools/evaluate.py \
  --queries examples/queries.synthetic.jsonl \
  --results examples/results.synthetic.jsonl \
  --source-mode synthetic \
  --output demo-evaluation.json
```

重复执行时使用新的输出目录/文件；工具不覆盖旧结果。运行真实目录时，由本地 Agent 替换 `--root` 和 `--output`，不要把真实文件、文件名清单或内容摘要上传公开仓库。

## 盘点工具的边界

它不执行文档中的代码，不跟随符号链接目录，不删改重复文件，默认跳过常见凭证名称和超过 128 MiB 的文件内容哈希。它不解析 PDF/Office、不识别扫描件、不判断密级、不确认授权、不推导文档版本。文件读取可能触发操作系统 atime 更新。请使用静止的受信源目录或只读快照；本工具不声称抵御不受信用户实时更换上级目录的竞争攻击。

`inventory_id` 只是相对路径派生的盘点标识，不可替代 OA 业务文档 ID。相同字节不代表相同业务身份或访问权限。样本清单提供格式/目录覆盖，尚不能提供专业语义代表性。

## 验收工具的边界

它不联网、不调用 KB，也不宣称真实 API 的返回格式已经核验。实际后端返回必须由本地适配器映射为 `docs/RECORD-FORMAT.md` 格式。计时必须在调用方用单调时钟测量，包含查询 embedding、检索、传输与结果呈现，不能只填数据库耗时。

退出码：`0` 为所提供记录的检查通过（合成记录永远标记 SYNTHETIC），`1` 为记录显示检查不通过，`2` 为输入或文件错误。盘点额外用 `3` 表示已产生报告，但有读取失败或检测到源变更需处理。

P0 的缺陷复验、真实模型会话和 r2 证据审查不包含在本包的“36 项通过”中。
