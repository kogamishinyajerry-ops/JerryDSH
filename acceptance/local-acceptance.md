# 本地实机验收报告（local-acceptance）· 2026-10-01

- 执行者：本地集成 Agent（DSH 0.2.0-rc.2 隔离恢复实例 + linux/amd64 容器工程环境）
- 人工确认：准备产物/执行预算授权（对话内确认 + 执行台"仅授权"按钮）、取消请求（执行台按钮）
- 机器可读版本：[local-acceptance.json](local-acceptance.json)；可打开视图：[local-acceptance.html](local-acceptance.html)

## 0. 结论摘要

| 验收项 | 结果 | 证据 |
| --- | --- | --- |
| 版本核对 | PASS | 双仓 PR 均未合并 Draft，head SHA 与交接一致；从 PR head 建隔离工作树 |
| 隔离 DSH 恢复 | PASS | `dsh --version` 精确 `0.2.0-rc.2`；web/headless probe ok；doctor `already-patched`；双禁生效 |
| 真实模型连通 | PASS | headless 最小真实调用（GLM Coding Plan）回复"模型就绪"；本轮 20 会话全部真实 LLM 步骤 |
| 四处断点修复 | PASS | 面板角色/目标一致、仅授权分离、常驻 worker、DRAFT 受限发现；回归 386 passed（容器）/ 381 passed+5 skip（Mac） |
| 第一阶段 真实求解环境 | PASS | Ubuntu noble amd64 容器 + OpenCFD v1912；五场景全过；`real_solver` 5 passed；五套证据迁移后 VERIFIED |
| 第二阶段 API/MCP/人工界面 | PASS | 12 MCP 工具实握手；DRAFT 发现可见、RELEASED 默认目录保持为空；真实资源查询贯通；执行台"仅授权"真实浏览器验证（服务端 runs=0） |
| 第三阶段 自然语言四阶段 | PASS | plan→prepare→（人工授权门）→execute→review 全链真实模型；run SUCCEEDED/INSUFFICIENT/UNCONFIRMED；bundle 冻结 65 项 |
| 第四阶段 未见输入与故障反馈 | PASS | 盲测（独立 Agent 供参）Δp 相对差 0.617%；真实 FAILED 任务模型解释与实际 stderr 一致；面板取消→CANCELLED + 进程组退出证明 remaining_pids=[] |
| 工程接受/方法发布 | 未宣称 | 方法包保持 DRAFT；数值 INSUFFICIENT、适用性 UNCONFIRMED 是诚实结果，不构成工程 ACCEPT |

## 1. 实际版本与运行布局

| 组件 | 版本 / 位置 |
| --- | --- |
| 宿主 | macOS 26.5.2，Apple Silicon（arm64），Node v22.22.2，Python 3.13.12（宿主侧仅 DSH/MCP venv） |
| 工程环境 | Docker Desktop 容器 `jerrydsh-sim-env`，`linux/amd64`（Rosetta 模拟，新环境实测），Ubuntu noble |
| OpenFOAM | OpenCFD v1912，Ubuntu 包 `1912.200626-2build3`（amd64），deb SHA-256 `356f9a583fcb6c57c9972e835f2167b489ea2b6a974644947296049f20db78a6`；bashrc 位于 `/usr/share/openfoam/etc/bashrc`（Ubuntu 布局差异，已记录） |
| dsh-sim | 分支 `codex/p0-openfoam-evidence`（PR #4 head `5b3ef00`）+ 修复分支 `codex/p0-local-acceptance-fixes`（`71c5bdb`、`42029ff`）；adapter 源码 SHA-256 `e0ccde08…39dc`（与上轮记录一致，本轮未改求解实现） |
| JerryDSH-Assets | 分支 `codex/p0-reproducible-sim`（PR #1 head `2ddb273`）+ 修复分支 `codex/p0-local-acceptance-fixes`（`b0e3c94`） |
| DSH 恢复实例 | `recovery/jerrydsh-acc-0.2.0-rc.2/`（独立 DSH_HOME，web :3081，原 :3080 实例全程未动）；runtime/web/headless/zai-websearch 组件安装；web+headless probe ok；doctor `already-patched` |
| 模型路由 | zai-coding-cn（GLM Coding Plan coding 端点）；headless 链路 glm-4.7；web 默认 glm-5.3-flash；凭证走 DSH 本地凭证库（未打印、未入仓） |
| 端口 | 8600（工程 API，容器内 0.0.0.0 → 宿主 127.0.0.1）；3081（隔离 DSH web，token 登录）；3080（用户原实例，未动） |
| 项目/数据 | 专用测试项目 `proj_a`（面板/MCP/worker 一致）；容器卷 `/opt/data`：`dsh_sim.db`、`artifacts/`、`worker/`、`openfoam-templates/` |

启动/停止命令（本机可直接执行）：[runbooks/local-runtime.sh](runbooks/local-runtime.sh)

## 2. 修复内容与回归

| 断点 | 修复 | 回归 |
| --- | --- | --- |
| A 执行台与授权 API 不一致 | `roles:'ENGINEER'→'EXECUTOR'`；confirmation `target_id` 由 preparation_id 改为 task_id；面板身份补 `projects:'proj_a'`（reviewer 同步） | `test_local_acceptance_fixes.py::test_executor_panel_*`（静态合同检查） |
| B 人工授权与提交混合 | "确认并运行"三连按钮改为**"确认并授权（不提交）"**：授权产出 authorization_id+prepared_digest 后停止；面板源码不再含 `/submissions` 调用 | `test_executor_panel_authorizes_without_submitting` + 实机 UI 验证（§4） |
| C 无常驻 worker | 新增 `python -m dsh_sim.worker.service`：空队列释放事务后继续领取、SIGTERM/SIGINT 优雅停止、结构化日志、显式 adapter/模板/同库配置；**不宣称崩溃自动接管** | `test_persistent_worker_claims_job_after_empty_queue` + 实机验证（§3） |
| D DRAFT 无法发现 | MCP `list_capabilities` 增加 `status` 参数（默认 RELEASED 不变；DRAFT/ANY 受控可见；非法值桥层拒绝）；planner 指令更新为"两种查询都为空才阻塞"；**批准语义不变** | `test_mcp_tools.py::test_list_capabilities_draft_discovery`、`…rejects_unknown_status` |

冻结合同兼容性记录：`list_capabilities` 新增可选参数为向后兼容增量（缺省行为不变），12 个工具名与 CONVENTIONS §3.5 一字未改；无 approval.json 编造、无工程阈值代填、无 RELEASED 直改。待审项：正式方法发布、生产 IdP、面板"仅授权"按钮的 UI 视觉验收记录仍按原台账流程处理。

测试：容器内 `pytest -q -m ''` **392 passed**（首轮 386 + 返修新增 6 项；0 skip）；宿主 Mac 同套件大部分通过（平台差异项 skip，非求解器项）。`pytest -m real_solver` 显式启用后 **5 passed**。返修后明细见文末「返修轮」。

## 3. 第一阶段：真实求解环境（容器）

五场景全部一次通过（每场景新输出目录，全部保留；断言 `scenario_assertions_passed=true` 表示执行行为符合预期，不代表数值 PASS/工程 ACCEPT）：

| 场景 | 执行 | 数值 | 适用性 | 冻结文件 | 迁移后校验 |
| --- | --- | --- | --- | ---: | --- |
| baseline | SUCCEEDED | INSUFFICIENT | UNCONFIRMED | 65 | VERIFIED |
| transfer | SUCCEEDED | INSUFFICIENT | UNCONFIRMED | 65 | VERIFIED |
| solver-failure | FAILED（预期） | NOT_CHECKED | UNCONFIRMED | 48 | VERIFIED |
| cancel | CANCELLED | NOT_CHECKED | UNCONFIRMED | 50 | VERIFIED |
| timeout | FAILED（墙钟预算，预期） | NOT_CHECKED | UNCONFIRMED | 40 | VERIFIED |

物理观察（诊断量，非阈值）：baseline 静压差 11.9086 Pa vs 解析 12.0000（相对差 0.7615%）；transfer 31.8572 vs 32.0625（0.6404%）——与上轮记录一致，说明新环境复现性成立。cancel/timeout 场景中 simpleFoam 均已输出 `Time =` 后受控停止，退出证明剩余 PID 为空；本轮 slow-mesh 风险未出现（网格阶段耗时远低于预算），未发生预算口径调整。

环境取证：`environment.txt`（包版本+deb SHA-256）、`pip freeze` 快照、adapter SHA-256 均入 [container-setup/](container-setup/) 与 [evidence/](evidence/)。本阶段的 Rosetta 模拟为新增平台组合，已按"新环境实测"记录，未沿用上轮结论。

## 4. 第二阶段：API、MCP 与人工界面

- **12 个 MCP 工具实握手**（fastmcp stdio Client ↔ `dsh_sim.mcp.server` ↔ 运行中的工程 API）：工具名与期望清单完全一致；DRAFT 发现（`status="DRAFT"` 返回 `openfoam_channel`，默认 RELEASED 目录保持为空）；非法 status 桥层拒绝。
- **真实资源查询贯通**：同一工程数据库上 `get_task` / `get_preparation` 读取 worker 真实准备的 READY 任务（smoke：`task_89a623fce3c2426ead12e103`），返回真实 prepared_digest、artifacts 与 software_build=OpenFOAM 1912。
- **常驻 worker 实机验证**：worker 先在空队列启动（日志 `queue idle`），随后经 API 创建任务/发起准备，worker 2 秒内领取（`processed 1 job(s)`），3 秒完成准备 READY。
- **执行台"仅授权"真实界面验证**（Playwright/Chromium，截图 [ui/](ui/)）：加载 READY 任务 → 按钮"确认并授权（不提交）" → 模态展示 task/revision/preparation_id/prepared_digest/执行预算 → 确认后任务 AUTHORIZED 且**服务端 runs=0**（面板没有代提交）。断点 A 的两个 403 根因（角色、target_id）在真实界面操作中不再出现。
- 期间真实修复一处小缺陷：授权模态执行预算 JSON 双重转义（`42029ff`）。

## 5. 第三阶段：全新自然语言任务（四阶段）

真实模型（GLM，经 sim_orchestrate 原生子 Agent + 12 个受限 MCP 工具）完成全链；无脚本回放、无复用旧 Run、无手工填写子 Agent 输出。

| 阶段 | 会话/证据 | 结果 |
| --- | --- | --- |
| plan | [logs-stage3-run1.log](logs-stage3-run1.log)（首次 180s 超时后以 600s 配置重跑；此为委派时限参数调优，已记录） | `list_capabilities(status="DRAFT")` 确认 openfoam_channel 可见；缺口如实列出 |
| prepare | [logs-stage3-run2.log](logs-stage3-run2.log) | `task_0dd8d88c5f804ebeacdb2242` R1；`prep_45eae71a5e8740d888928add`；prepared_digest `9fbd4084…e918`；REAL 回读一致、无阻塞；模型还诚实报告了 create_task 首次因多余字段被 422 拒绝并纠正 |
| **人工授权门** | 对话内向你展示摘要与预算（截图 [ui/04](ui/04-stage3-preparation-ready.png)） | 你确认后，执行台生成 `authz_c924d3b1272247148b61eec9`（仅授权不提交，服务端 runs=0） |
| execute（runner 首次提交） | [logs-stage3-run3.log](logs-stage3-run3.log) | AGENT runner 经 MCP `submit_runs` → `run_763d86b0a05c42e8b59a0e79` **SUCCEEDED / INSUFFICIENT / UNCONFIRMED**，exit_proof 完整、52 artifacts |
| review | 同上 | bundle 冻结（65 项，digest `6152ead6…`，CURRENT）；reviewer 主动纠偏"52 vs 53"计数；`draft_review_issue` 因无 review 实体被 VALIDATION 拒绝——**如实阻塞，未伪造** |

过程可查看：执行台运行区展示 STARTING→RUNNING→HEARTBEAT→COMPLETED 事件与日志路径（截图 [ui/05](ui/05-stage3-run-result.png)）；容器内 `worker/run_*/attempt-1/` 保留全部原始日志/命令/退出记录。

## 6. 第四阶段：未见输入与故障反馈

- **盲测（同配方未见参数验证）**：参数由**独立测试 Agent** 提供（v=0.045 m/s，L=0.7 m，H=0.13 m，W=0.018 m，ν=6.5e-4 m²/s，ρ=960，56×26×1 网格，450 迭代；Re≈9）。代码冻结后未做任何实现修改。全链走同一四阶段流程（[logs-stage4-blind-prepare.log](logs-stage4-blind-prepare.log) / [logs-stage4-blind-exec.log](logs-stage4-blind-exec.log)）。人工授权 `authz_71186865840b445484b4812f`，runner MCP 提交 `run_5224378fc02f400ea6a6c7ff` SUCCEEDED。观测：Δp=13.8709 Pa vs 解析参考 13.957 Pa，相对差 **0.617%**；进出口质量流量 ±0.101088 kg/s 守恒（由执行者经受权 artifact 接口从冻结 metrics 读取；reviewer 工具面按设计不含 artifact 内容读取，其限制已被如实报告）。结论标记为**同配方未见参数验证**，不宣称跨几何/跨求解器泛化。
- **真实失败任务解释**：`task_dbfe3d56ba594c1b98050731`（模板含注入的非法离散格式）→ `run_1461d0ae05d547fca9612771` **FAILED**（预期）。模型解释（[logs-stage4-fault-exec.log](logs-stage4-fault-exec.log)）：失败定位于求解器启动期（1.1 s，exit 1）、环境五信号干净（probe/REAL/supervisor 零字节/干净退出码）、指向输入配方；并**如实声明工具面读不到 stderr 原文**、给出 artifact 引用留人工核对。执行者事后读取真实 stderr：`FOAM FATAL IO ERROR: Unknown convection type notAnOpenFOAMScheme`（fvSchemes line 10）——与模型推断一致。
- **用户请求取消**：`task_deb83d6db9f442078280dea4`（200×80×1，3000 迭代）MCP 提交后 simpleFoam 已运行 559 迭代，经**执行台"请求取消该 Run"**（人工路径，截图 [ui/06](ui/06-cancel-requested.png)）→ `run_6201e11d86d1432fa135dff6` **CANCELLED**；exit_proof：`process_exited=true, process_group_exited=true, returncode=130`，进程身份（boot_id+PID namespace+start_ticks）一致，`remaining_pids=[]`。

## 7. 会话与证据清单（只含本轮）

- DSH 会话：20 个（父 headless 会话 + plan/prepare/execute/review 子会话），全部真实 LLM 步骤（输入 393,094 / 输出 132,134 tokens，glm-4.7，GLM Coding Plan 端点）；manifest 与 zstd 转录：[sessions/](sessions/)。
- 工程证据：五套验证导出（迁移后逐套 VERIFIED）、共享工程库 `engineering-api-dsh_sim.db`、worker/api 日志、三个验收 run 的 attempt 现场：[evidence/](evidence/)。
- 截图：任务加载/授权模态/授权结果/准备就绪/运行结果/取消请求（[ui/](ui/)）。

## 8. 未完成与诚实边界

1. 自然语言会话以 headless 一次性会话 + 执行台人工门组合完成（每阶段真实模型子会话、资源引用连续）；未做"单一连续 web 对话"形态——web 实例已就绪（:3081，Simulation preset 可选），但本轮验收以可审计的会话转录为准。
2. `draft_review_issue` 依赖受信界面先创建 review 实体（既有合同），reviewer 侧只能如实阻塞；ACCEPT/审查闭环未走（DRAFT 方法下 ACCEPT 必然被拒，这是设计性不可达成）。
3. 生产 IdP/正式方法发布/sim-live-hub/STAR/MPI/其他 OpenFOAM 版本：本轮不涉及，未验证。
4. `real_solver` 5 项测试与五场景均在 Rosetta amd64 容器完成；原生 arm64 OpenFOAM 与其他虚拟化组合未测。
5. 上轮遗留的"Worker 崩溃后自动接管"仍未实现（常驻 worker 不改变这一边界）。

## 9. 复核入口

- 修复分支：dsh-sim `codex/p0-local-acceptance-fixes`（2 commits）、JerryDSH-Assets `codex/p0-local-acceptance-fixes`（1 commit）；Draft PR 见仓库（不自动合并）。
- 一键复核：`runbooks/local-runtime.sh` 中的命令启动 API/worker/隔离 DSH；`python -m dsh_sim.validation.openfoam --local-validation --case baseline --output <新目录>` 复跑公开实验。

---

# 返修轮（同日，云端审查基线后）

云端审查基线：JerryDSH-Assets `469d7e6`、dsh-sim `42029ff`。返修沿用分支
`codex/p0-local-acceptance-fixes`，保持 Draft PR。

## R1 · worker 停止语义（PASS）

- `run_until_idle` 新增 `should_stop` 领取边界检查：停止请求**不打断当前作业**（完整
  完成并落证据），队列剩余作业保持未领取；常驻服务把 stop 标志接入该边界。
- 真实队列测试（`tests/test_worker_stop_semantics.py`，staged MOCK 明确标注）：两项
  EXECUTE 排队，第一项执行中向**真实子进程**分别发送 SIGTERM / SIGINT（参数化两例）：
  当前项 COMPLETED 后优雅退出（退出码 0），第二项无租约、无事件（保持未领取），之后
  仍可被新 worker 正常领取；另有领取边界直接验证（should_stop=True 时零领取）。

## R2 · 仅授权流程交接恢复（PASS）

- 新增只读投影 `GET /tasks/{id}/authorizations`（项目权限内；响应不含 confirmation
  一次性凭据；非 12 个 MCP 工具之一，模型侧仍无授权能力）。
- 执行台新增"当前有效授权（交接恢复）"块：授权后关闭弹窗或刷新，可读回当前修订的
  authorization_id + prepared_digest；已有有效授权时授权按钮禁用（不重复授权）。
- 实机验证（截图 [ui/08](ui/08-authorization-recovery.png)）：刷新后恢复块读回
  `authz_fe67796790584221b287a214` → AGENT runner 经 MCP `submit_runs` 首次提交
  `run_805ddf71c25a42f4aacb87bc`（SUCCEEDED）→ 该任务有效授权仍为 **1 条**。
- 人工 confirmation 凭据仍在人工流程（投影与面板均不暴露）。

## R3 · 项目配置（PASS）

- 面板身份不再硬编码项目；`shared/api.js` 默认 `dshsim.projects=proj_a`（与 MCP
  `DSH_SIM_AGENT_PROJECTS` 默认一致），显式配置（调用方 > localStorage）覆盖默认。
- 同项目跨角色验证：执行者/审查者/AGENT 三种身份在同一 `proj_a` 任务上的读取与
  提交路径均有 API 测试；跨项目身份被 403 拒绝。

## R4 · 可运行交付（PASS）

- 修正 `DSH_SIM_OPENFOAM_TEMPLATE_REGISTRY` 文档：它是模板注册表 **JSON 文件路径**
  （`{"引用名": "/abs/path.tar"}`），不是 capability ID；并补 Ubuntu bashrc 路径说明。
- 新增 `deployment/local-acceptance/`：`launch-worker.sh`（容器实际部署版）、
  `make-template-registry.py`（注册表生成方法）、`run-local.sh`（启动/停止/状态）、
  README（两仓配套提交与新旧记录区分）。
- Assets 侧 `overlays/`：脱敏 headless 直挂 overlay（标准 + 600s 版）与使用说明。
- 两仓配套提交：dsh-sim `7260236` + `12d1dd8`；Assets `637a894`。均保持 Draft。

## R5/R6 · 打包与基线区分

- 打包新增：`sessions/resource-index.json`（case/stage/parent/child/resource ID 索引，
  从转录 tool/call 参数自动抽取）、`events/auth-submit-cancel-events.json`（5 条人工
  授权、5 条确认凭据元数据、5 个关键 run 的完整事件，含取消 exit_proof
  remaining_pids=[]）、`blind-input-record.md`（盲测供参与事前冻结记录，按实际证据
  范围如实标注：供参独立、实现冻结，但无独立签名冻结文件）。
- **修复前基线（旧云端记录，保留不改写）**：PR head `5b3ef00`/`2ddb273` 时代——
  378 passed（含 5 项真实 OpenFOAM）、五场景在 Ubuntu noble amd64 虚拟环境完成、
  证据包 `JerryDSH-P0-Evidence-2026-10-01.zip`（SHA-256
  `85e3a78dc0534f5e2de842467b27d98f775835742f67f5540e2e956db02de9bc`）。
  原始记录：[dsh-sim docs/p0-validation-2026-10-01.md/json](../repos/dsh-sim/docs/)。
- **修复后回归（新本地记录）**：返修后容器全量 `pytest -q -m ''` **392 passed**；
  本报告正文第 3–6 节的实机结果。求解路径代码三轮零改动（`adapters/`、`validation/`、
  `verify/`、`evidence/` 在 `5b3ef00..12d1dd8` 无 diff；`worker/loop.py` 仅新增
  should_stop 参数），五场景数值可直接对照。
- 重新打包：`acceptance-handoff-2026-10-01-r2.zip`（SHA-256 见压缩包同名 .sha256 文件
  与交付消息），仅含本轮验收记录，凭证不入包。

---

# P0 有限封板（第二轮返修，同日）

四项收尾全部 PASS，记录见 [p0-closing.md](p0-closing.md)；回归日志
[p0-closing/test-run-local.log](p0-closing/test-run-local.log)（8/8）。
提交：dsh-sim `ba72bac`+`e266423`；Assets `e3c4804`。实测发现并修复两个环境级缺陷：
容器 PID1 不收尸导致 zombie 误判存活（kill -0 对僵尸返回成功）；Ubuntu OpenFOAM
bashrc 在 `set -u` 下 source 失败（rc=127）导致 worker 静默死亡。上轮已关闭三项仅
回归确认未破坏（容器全量 392 passed），未重写。
