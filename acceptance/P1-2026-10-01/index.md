# P1 开工验收索引 · 2026-10-02

本轮 = P0 有限封板（第二轮返修）+ P1 kickoff。总入口：
- P0：[../p0-closing.md](../p0-closing.md)（四项 PASS；回归 8/8）
- P1：本目录 + [civair-kb p1/README-P1.md](../../../repos/civair-kb/p1/README-P1.md)

## 结果总表（对应代码 SHA）

| # | 结果 | 代码 SHA | 输入范围 | 原始证据 |
|---|---|---|---|---|
| P0-1 run-local 退出码/三态停止 | PASS | dsh-sim `ba72bac` | 验收容器 jerrydsh-sim-env | [p0-closing/test-run-local.log](p0-closing/test-run-local.log)（8/8） |
| P0-2 宿主容器命令分离/launch-worker 安装/全新数据目录 | PASS | dsh-sim `ba72bac` | 全新 `/opt/data-fresh-*` 目录 | 同上 T5 系列 |
| P0-3 headless 生成器 | PASS | Assets `e3c4804` | 恢复实例 + 真实模型调用 | 生成 overlay → dump-config exit 0 → 模型回复"生成器就绪" |
| P0-4 模板生成器加固 | PASS | dsh-sim `ba72bac` | 负例 ../../evil、/etc/passwd；正例 t5-ok | 负例拒绝且无越界文件（见 p0-closing.md §项4） |
| P1-reuse 后端复用盘点 | PASS（盘点） | civair-kb `993b597`（基线快照） | /Users/Zhuanz/projects/aircraft-comac/civair-kb 全码通读 + 冒烟实跑 | civair-kb p1/README-P1.md §1 |
| P1-OA 接入管线（提取/定位/分区/OCR/去重） | PASS（合成 fixture） | civair-kb `5546a83` | 7 份合成文档（含隔离/扫描/重复负例） | p1/smoke_p1.py 步骤记录 + ingest-report |
| P1-发布/查询/回滚全链 | PASS（隔离 store，SYNTHETIC） | civair-kb `5546a83` | 合成 6 文档 | p1/results.synthetic-smoke.jsonl + raw-responses + evaluation-synthetic-smoke.json（SYNTHETIC_CHECKS_PASS，宏 Hit@5=1.0，冷启动 NOT_RUN） |
| P1-embedding 探针 | **NOT_RUN**（无获准内网端点；接入缝已备） | civair-kb `5546a83` | — | embedding.py probe 返回 NOT_RUN 即正确行为 |
| P1-真实语料盘点/提取质量/30 题标注/摘要/一万份 | **NOT_RUN** | — | 需内网 | 见 README-P1 §4 逐项解锁条件 |

## 用户验收目标口径

"APU 启动机过热的历史处理"：**隔离合成冒烟**中返回 OA-2021-0137/2020-0031/2022-0099/2023-0042
相关文档清单（含版本/分区/出处/片段），亚毫秒级（本机合成规模）。
**这不是真实语料验收**——真实清单与 3 秒时延门槛待内网试点（NOT_RUN 已列）。

## 交接包

`acceptance-handoff-2026-10-01-r3.zip`（P0 收尾 + 全部既有材料），
SHA-256 见同名 .sha256 文件；P1 增量以本 civair-kb 仓库分支为准
（`repos/civair-kb`，分支 `p1/oa-documents-v1`，头 `5546a83`；基线 `993b597`）。
