# plugins/ — DSH 实测高价值插件精选

> **🆕 [TOP10-2026-09-16.md](TOP10-2026-09-16.md)** — 社区热门 TOP 10 · **内网离线部署版**（v2：剔除运行时触网件，打包 SOP + 5 坑；附 v1 外网版留档）

收录标准：**本机实测通过**（dsh 0.1.1-rc.2），源码审查无恶意模式，有明确生产价值。每张卡带安装命令、实测证据、坑与修复。
插件代码本体在 npm / `~/.dsh/profiles/*/node_modules`——这里存的是**经过验证的选用决策**，不是 vendored 副本。

## 速查总表（31 件）

| 插件 | 分类 | 评分 | 一句话 | profile |
|---|---|---|---|---|
| [dsh-find-plugin](ecosystem/dsh-find-plugin.md) | ecosystem | ★★★★★ | agent 内搜插件，生态入口第一件 | 任意 |
| [modlens](vision/modlens.md) | vision | ★★★★★ | 文本模型的最强外挂视觉（10 引擎 failover） | 任意 |
| [free-vision-skill](vision/free-vision-skill.md) | vision | ★★★★ | 全本地 OCR/识图，图片不出本机 | 任意 |
| [dsh-pdf-reader](vision/dsh-pdf-reader.md) | vision | ★★★★☆ | 纯文本模型读 PDF（逐页画像+定向渲染） | 任意 |
| [chicheng-push](automation/chicheng-push.md) | automation | ★★★★☆ | 15 通道推送统一出口 | **web-only** |
| [chicheng-cron](automation/chicheng-cron.md) | automation | ★★★★ | 定时跑 shell/skill/agent 任务（推送闭环） | **web-only** |
| [dsh-cron](automation/dsh-cron.md) | automation | ★★★★ | 模型自治调度器，进程内 agent 工具栈完整 | 任意（F14 补链） |
| [dsh-mcp-sync](capability/dsh-mcp-sync.md) | capability | ★★★★ | 散落各处的 MCP 配置统一收编直注 | **web-only** |
| [dsh-browser-control](capability/dsh-browser-control.md) | capability | ★★★★ | CDP 浏览器控制（注意登录态拷贝权衡） | 任意 |
| [dsh-thread](sessions/dsh-thread.md) | sessions | ★★★★ | 会话记忆+决策谱系（须修 pnpm 构建） | 任意 |
| [dsh-turn-rewind](sessions/dsh-turn-rewind.md) | sessions | ★★★★☆ | 对话+工作区状态回退（Change Ledger，99★） | 任意（web 面板见卡） |
| [dsh-file-claim](sessions/dsh-file-claim.md) | sessions | ★★★★☆ | 并行会话文件占用保护（写前认领+拦截） | 任意 |
| [dsh-crosstalk](sessions/dsh-crosstalk.md) | sessions | ★★★☆ | 跨会话消息（心跳注册表+收件箱） | 任意（**须手动构建**） |
| [dsh-session-recovery](sessions/dsh-session-recovery.md) | sessions | ★★ | 会话灾难恢复（**与当前格式不兼容**） | 任意（暂不装机） |
| [dsh-advisor](agent/dsh-advisor.md) | agent | ★★★★ | 旁挂 reviewer 模型，guard 边界实证 | 任意 |
| [dsh-subagent-registry](agent/dsh-subagent-registry.md) | agent | ★★★★ | ~/.dsh/agents/*.md → 可调 subagent | 任意 |
| [dshmarket](ecosystem/dshmarket.md) | ecosystem | ★★★★ | Settings 内置市场+主题 | **web-only** |
| [dsh-undo](sessions/dsh-undo.md) | sessions | ★★★☆ | /undo /redo 消息回滚（不含文件快照） | 任意 |
| [dsh-routing-suite](routing/dsh-routing-suite.md) | routing | ★★★★ | inspect-first 路由，78.4% 有评测 | 任意（已在 web） |
| [mirage-dsh](capability/mirage-dsh.md) | capability | ★★★☆ | Slack/Redis/S3 挂成 agent 文件世界 | 独立 profile |
| [dsh-ssh-ops](capability/dsh-ssh-ops.md) | capability | ★★★★ | SSH+六库运维面板（headless 须补服务链） | 任意（见 F14） |
| [dsh-genui](presentation/dsh-genui.md) | presentation | ★★★★★ | 聊天内交互组件/图表（303★） | 任意（渲染在 web） |
| [DSH-Office](presentation/dsh-zagens-office.md) | presentation | ★★★ | PPTX/DOCX/XLSX/PDF 直出（**Windows 引擎限定**） | macOS 只透明失败 |
| [dsh-paperlab](presentation/dsh-paperlab.md) | presentation | ★★★☆ | LaTeX 论文修订工作台（需 latexmk） | 任意 |
| [create-dsh-plugin](devtools/create-dsh-plugin.md) | devtools | ★★★☆ | 脚手架：模板避坑密度最高，CLI 怕非 TTY | npx 直用 |
| [gavel-review](git-review/gavel-review.md) | git-review | ★★★★★ | 多镜头对抗评审，跨视角去重+ship/no-ship | 任意（llm 继承宿主） |
| [dsh-change-review](git-review/dsh-change-review.md) | git-review | ★★★★ | 会话级 write/edit 行级 diff+revert | **web-only** |
| [repogate](git-review/repogate.md) | git-review | ★★★★ | 23 工具 GitHub MCP bundle（须 GitHub 源） | 任意 |
| [worktree-mgr](git-review/worktree-mgr.md) | git-review | ★★★ | 任务级 worktree 生命周期（须本地修复） | 任意 |
| [dsh-llm-approve-for-me](security/dsh-llm-approve-for-me.md) | security | ★★★★☆ | 隔离 LLM 自动审批沙箱提权（**装=接管审批**） | **web-only** |
| [dsh-session-guard](security/dsh-session-guard.md) | security | ★★★☆ | 高峰自动会话闸门（周末畅跑） | **web-only** |

## 一键装机建议（日常 web profile）

```sh
# 能力层（全绿、无互斥）
dsh plugin --profile web add dsh-find-plugin @liustack/modlens @niyongsheng/free-vision-skill \
  @aiwayds/dsh-subagent-registry dsh-advisor dsh-thread dsh-undo dsh-browser-control dsh-mcp-sync
# 自动化层（web-only）
dsh plugin --profile web add github:534119219/chicheng-push github:534119219/chicheng-cron
# 市场（可选，与 find-plugin 互补）
dsh plugin --profile web add dshmarket
# Git & Code Review 层（2026-08-22 实测批）
dsh plugin --profile web add gavel-review github:JohnXu22786/github-mcp
dsh plugin --profile web add github:cirelir/dsh-change-review
# Sessions 工程层（2026-08-23 实测批）
dsh plugin --profile web add @anionex/dsh-turn-rewind dsh-file-claim
# 展示材料层（2026-08-23 深夜批）：genui 是对话内图表/面板主战力
dsh plugin --profile web add github:omdsh-dev/dsh-genui
# 组合层（2026-08-24 实测三管线，见 COMBOS.md）：
#   晨报管线 = push + cron + gavel；PR 评审 = repogate + gavel + 本地 checkout；分工 = file-claim + gavel
# shortlist 批（2026-08-28，见 SURVEY-2026-08-27.md）：PDF 读入 + 治理双件
dsh plugin --profile web add dsh-pdf-reader dsh-session-guard github:alaxrpg/dsh-llm-approve-for-me
# ✅ 已落地 web profile（2026-08-28：143→146 行 diff 全量核验；approve 接管行为显式确认）
# 装完重启 dsh web；dsh-thread 记得补 pnpm 构建修复（见其卡片）
# ⚠ repogate 只认 GitHub 源（npm 0.1.0 无 dsh.bundle 不激活）；worktree-mgr 暂缓（两个上游 bug，见其卡片）
# ⚠ dsh-crosstalk 当前无官方安装路径、dsh-session-recovery 与会话格式不兼容——都暂缓（见各自卡片）
# ⚠ DSH-Office 需 Windows 引擎（macOS 免装）；dsh-ssh-ops/dsh-paperlab 有前置修复见各自卡片
# ⚠ dsh-cron 也只认 GitHub 源（npm 0.1.0 严重滞后 repo 0.9.8）；llm-approve-for-me 装=接管审批默认（F17）
# ⚠ dsh plugin add 新建的 profile 缺终端 bundle，boot 会无声挂起——先看 FIELD-NOTES F1
```

## 兼容性矩阵

- **web-only**（headless 装会拖死 boot）：chicheng-push、chicheng-cron、dsh-mcp-sync、dshmarket、dsh-change-review、dsh-llm-approve-for-me、dsh-session-guard —— 机制见 [research/05 §7](../research/05-mechanics-notes.md)
- **需修复才能用**：dsh-thread（pnpm `onlyBuiltDependencies` + rebuild better-sqlite3）、worktree-mgr（schema 修复 + defineTool 包装，见其卡片）、dsh-crosstalk（须仓外构建后拷 lib）、dsh-cron（headless 补 storageDomain 链 F14）
- **接管型（装=改全局默认）**：dsh-llm-approve-for-me（审批默认从问人变 LLM 裁决，见 F17——装前 dump-config diff 确认）
- **与当前 dsh 不兼容**：dsh-session-recovery（会话流式帧格式，见 F12；一行补丁可救）
- **需配置才活**：modlens（pin 引擎 provider）、dsh-advisor（settings.yaml 的 advisor 段）
- **需独立 profile**：mirage-dsh（接管 fs/bash 缝，会禁用 host 沙箱行）
- **平台限定**：DSH-Office（Windows x64 引擎；macOS 只做到加载+透明失败）
- **需前置修复/依赖**：dsh-ssh-ops（pnpm rebuild ssh2 + headless 补 storageDomain 链 F14；连接失败有崩溃 bug）、dsh-paperlab（本机 latexmk）、dsh-genui（GitHub 源）
- **只认 GitHub 源**：repogate、worktree-mgr、dsh-change-review、dsh-crosstalk、dsh-genui、DSH-Office、dsh-paperlab（npm 版缺失/滞后，见 FIELD-NOTES F4/F10）

## 待评 / 未收录

- **dsh-honcho-memory**：需自备 Honcho v3 后端（官方托管或自部署），有后端后再评
- **纯 UI 皮肤类**（任务板/折叠/侧栏大量同质）：不收录，需要时现查 [research/04](../research/04-ecosystem-survey.md) 全景
- **dsh-plugin-ima-sync**（周下载 6.0k）：需腾讯 IMA 账号，有需求再测
- **dsh-gitflow**（Git & Code Review 分类候选）：git 直通工具与 bash 原生能力重叠度高，价值密度不足未入选

## 机制新发现台账

四批累计 17 条机制级发现（profile 缺终端 bundle 无声挂起 / defineTool 编译职责 / schema 严格校验硬崩 / npm-GitHub 版本分裂 / ctx.provide API / transcript zstd 审计 / github 安装 files 陷阱 / profile 毒化 Symbol 双实例 / 会话流式帧格式 / 隐性服务依赖与补链法 / 网络库 error 事件崩溃 / agent 任务两种姿势对比 / 接管型插件改写全局默认…）→ [FIELD-NOTES.md](FIELD-NOTES.md)

## 组合最佳实践

单件是零件，组合才是生产力：**3 条实测闭环管线**（PR 评审流水线 / 写作者-评审员分工 / 晨报定时巡检+推送）+ 5 个设计模式 + 待验证清单 → [COMBOS.md](COMBOS.md)

## 生态近况调研

最近几天（08-22~08-27）高价值开源插件扫描：桌面化爆发 / awesome 迁 org / PDF 阅读·调度·审批自动化等新原生插件 + 下一轮实测 shortlist → [SURVEY-2026-08-27.md](SURVEY-2026-08-27.md)

## 安全红线

装插件 = 以你的权限跑第三方代码，工具审批不沙箱插件。本目录 31 件全部做过源码审查（child_process/eval/外联端点），0 恶意命中——但这个结论**不外推到没看过的插件**；四批的 spawn/execFile 用法（repogate 子进程 / change-review 编辑器跳转 / office 引擎调用 / paperlab 编译 / pdf-reader 的 Python 子进程服务）与网络库封装均已逐点核验，详见各卡片与 FIELD-NOTES F15。
