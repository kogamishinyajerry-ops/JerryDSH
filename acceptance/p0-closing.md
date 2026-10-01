# P0 有限封板记录 · 2026-10-01（返修第二轮）

审查基线：Assets `469d7e6` → 本轮头 `e3c4804`；dsh-sim `42029ff` → 本轮头（见提交表）。
范围锁定为四项；上轮已关闭的停止检查/授权恢复/项目配置只做必要回归（392 passed 仍绿），
未重写。未扩大到 STAR/HPC/服务管理平台。

## 提交表

| 仓 | 分支 | 提交 | 内容 |
| --- | --- | --- | --- |
| dsh-sim | `codex/p0-local-acceptance-fixes` | `ba72bac` | 项 1+2+4：run-local.sh 重写、launch-worker.sh 参数化与显式安装、test-run-local.sh 8 项回归、模板生成器加固 |
| dsh-sim | 同上 | `e266423` | chore: 移除误入的补丁临时目录 |
| Assets | `codex/p0-local-acceptance-fixes` | `e3c4804` | 项 3：overlays/generate-headless-overlay.py + README 更新 |

## 项 1 · run-local.sh 退出码与停止语义（PASS）

- 启动成功 = 进程存活 + 服务健康**双重确认**；任一失败非零退出并给出日志定位。
  新增防假阳性复核：端口健康但本次启动进程已死（端口被残留进程顶替）→ 报错退出。
- 停止三态：`已请求`（SIGTERM 已发）→ `正在退出`（逐轮报告存活与剩余时间）→
  `已退出`（确认后才报 `stopped`）；超时输出 `NOT stopped` 并非零退出。
- **实测发现并修复**：容器 PID1 是 `sleep infinity`，不收尸——已退出进程永久留为
  zombie，`kill -0` 对僵尸返回成功，任何"等退出"逻辑都会假死等。存活判定改为
  `kill -0 且 /proc/<pid>/State != Z`。
- 残留进程清点：目标集合 = pid 文件存活项 ∪ 锚定 pgrep 扫描项（处理历史无 pid 文件
  的启动），多行 pid 归一为单行。
- 无 `|| true` 吞错；`restart` 在 stop 未达 stopped 时中止。
- 回归（`test-run-local.sh`，8/8 PASS，输出在
  `acceptance/p0-closing/test-run-local.log`）：T1 Docker 返回码 42 负例传播；
  T2 启动失败非零（容器不存在）；T3 延迟退出（3s）worker 三态停止 rc=0；T4 无视
  SIGTERM 的进程 → NOT stopped 非零；T5a0 注册表生成；T5a/b 全新数据目录
  start→健康→stop。

## 项 2 · 宿主/容器命令分离与 launch-worker.sh（PASS）

- run-local.sh 头部与 usage 明确"宿主执行（本脚本）/容器内手工等价命令"两类；
  环境变量均可覆盖（DSH_SIM_CONTAINER/DATA_DIR/REPO_DIR/PORT/超时等）。
- launch-worker.sh 由**仓库交付**，`docker cp` 显式安装进容器（幂等覆盖）——移除了
  对未交付容器内文件的依赖；路径全部从 `DSH_SIM_DATA_DIR` 派生。
- **实测发现并修复**：launch-worker.sh 不得使用 `set -u`——Ubuntu 发行版 OpenFOAM
  bashrc 在 `set -u` 下 source 失败（实测 rc=127），worker 静默死亡且日志为空。
- 全新数据目录验证：`DSH_SIM_DATA_DIR=/opt/data-fresh-<ts>` 生成注册表 → start →
  健康 → stop（T5a0/T5a/T5b）。

## 项 3 · headless 生成器参数化（PASS）

- 新增 `overlays/generate-headless-overlay.py`：接受**实际插件副本绝对路径**
  （校验须含 index.js 与 cordis.patch.yml）、输出绝对路径且不得位于插件目录内、
  `--timeout-ms` 在文档允许区间（1000–1800000）校验；幂等（同内容重复生成 OK）、
  差异拒绝覆盖；成功后打印**分开的两步**：`--dump-config` 验证（不带任务参数）
  与实际运行。
- 端到端实测：生成 → 恢复实例 `--dump-config`（exit 0；三件套齐、双禁 disabled:true）
  → 真实 headless 模型调用经该 overlay 返回正常。

## 项 4 · 模板生成器加固（PASS）

- `make-template-registry.py`：ref 白名单校验（`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`，
  禁 `/` 与 `..`）在**任何写入之前**；解析目标必须 `is_relative_to(root)`；registry
  原子写（tmp + os.replace），损坏的既有 registry 报错不覆盖。
- 实测负例：`--ref "../../evil"`、`--ref "/etc/passwd"` 均被拒且 root 未创建、无越界
  文件；正例生成 + registry 只含合法条目。

## 与上轮的关系

上轮三处已关闭项（worker 领取前停止检查、授权信息恢复、项目配置覆盖）本轮仅随容器
全量回归确认未破坏（392 passed，见 local-acceptance.md 返修轮），未做任何重写。
