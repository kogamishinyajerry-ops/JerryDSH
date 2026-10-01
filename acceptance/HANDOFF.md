# HANDOFF · 给下一个 Agent（本地或云端）的接手说明

写于 2026-10-01 实机验收轮结束时。先读 [local-acceptance.md](local-acceptance.md)（或 .html/.json），本文件只讲"现状怎么接"。

## 1. 现在还在这台 Mac 上运行的东西

| 服务 | 状态 | 停止方式 |
| --- | --- | --- |
| Docker 容器 `jerrydsh-sim-env`（工程 API :8600 + 常驻 worker + OpenFOAM v1912） | 运行中，API health 200 | `docker stop jerrydsh-sim-env`（数据在容器层 + 卷 `jerrydsh-sim-data`，stop 不丢） |
| 隔离 DSH web（:3081，token 登录） | 运行中 | `lsof -ti :3081 | xargs kill`；启动命令见 `runbooks/local-runtime.sh`（注意 `env -u NODE_OPTIONS`） |
| 用户原 DSH 实例（:3080） | 未动，保持原样 | 不要动 |

完整重启步骤：`runbooks/local-runtime.sh`（worker 必须 source `/usr/share/openfoam/etc/bashrc`——容器内已固化为 `/opt/data/launch-worker.sh`）。

## 2. 关键位置

- 验收报告与证据：本目录（`acceptance/`，约 33MB）：`local-acceptance.{md,json,html}`、`evidence/`（五套验证导出+共享工程库 `engineering-api-dsh_sim.db`+worker/api 日志+三个验收 run 现场）、`ui/`（截图 01–07）、`sessions/`（20 个会话 manifest+转录）、`runbooks/`、`container-setup/`（环境重建脚本与取证）。
- 代码：`repos/dsh-sim`（分支 `codex/p0-local-acceptance-fixes`：`42029ff` → 返修 `7260236`、`12d1dd8`）、`repos/JerryDSH-Assets`（同名词分支：`469d7e6` → `637a894`）。两仓工作树干净，全部已推送。
- 返修轮（同日）已含：worker 领取边界停止语义（真实 SIGTERM/SIGINT 队列测试）、授权读取投影 GET /tasks/{id}/authorizations + 面板交接恢复块（实机恢复→AGENT 首提→不重复授权）、proj_a 默认可覆盖、deployment/local-acceptance/ 与 overlays/ 可运行交付、TEMPLATE_REGISTRY 文档修正。容器全量 392 passed。
- 隔离 DSH 恢复实例：`../recovery/jerrydsh-acc-0.2.0-rc.2/`（含本轮 overlay：`overlays/simulation.local.patch.yml`（web preset 用）、`simulation.headless.patch.yml` / `.600s`（headless 直挂用，600s=stageTimeoutMs 调优值））。

## 3. Draft PR（等人工审查，不要自动合并）

- dsh-sim #5：四断点修复（A 面板角色/target_id/项目、B 仅授权分离、C 常驻 worker、D DRAFT 受限发现）
- JerryDSH-Assets #2：planner DRAFT 发现指令 + 仅授权流程文档
- 基线 PR：dsh-sim #4、Assets #1（仍是未合并 Draft）

## 4. 已知边界（接手前必读，报告 §8 有完整版）

1. DRAFT 方法下数值=INSUFFICIENT、适用性=UNCONFIRMED 是诚实结论；ACCEPT 必然被拒是设计行为，不要"修"它。
2. `draft_review_issue` 需要受信界面先创建 review 实体——reviewer 工具面会如实阻塞，不是 bug。
3. 常驻 worker ≠ 崩溃自动接管（未实现）。
4. 求解环境是 Rosetta amd64 容器；换原生 arm64/其他 OpenFOAM 版本 = 新环境，需重新实测（用 `python -m dsh_sim.validation.openfoam --local-validation --case baseline --output <新目录>` 起步）。
5. MCP 工具面无 artifact 内容读取（by design）；看数值用执行台/审查台或经受权 artifact HTTP 接口。

## 5. 红线（与交接一致，继续有效）

- 凭证不入仓不入报告：隔离实例里的 `.credentials.yaml` 是本机复制件，**不要上传云端**；本目录与 zip 均不含凭证（`logs-dsh-web.log` 含本机 web token，已从分发包排除）。
- 不给模型 EXECUTOR 身份/approve 工具/人工确认凭据；首次 submit_runs 必须是 AGENT runner 经 MCP。
- 工程阈值保持 TBD；不编造 approval.json；不改 RELEASED。
- MOCK 绝不冒充 REAL；没跑的测试记 NOT_RUN。

## 6. 云端接手的最短路径

1. clone 两仓 + 切 `codex/p0-local-acceptance-fixes`（或等 PR 审查合并后用 main）。
2. Linux amd64 环境（物理机/容器均可，需同 PID namespace）装 OpenFOAM v1912 noble 包 + Python 3.12 venv（`requirements/validation-2026-10-01.txt`）。
3. 按 `../recovery` 的 docs/recovery.md 重建隔离 DSH（工具在 Assets 仓 `tools/recovery/`），或直接复用本目录证据做离线审阅。
4. 跑 `validation.openfoam --case baseline` 确认新环境复现（相对差 ~0.7% 量级），再进入下游工作。
