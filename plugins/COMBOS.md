# COMBOS · 插件组合最佳实践

> 单件是零件，组合才是生产力。本文档记录**实测闭环**的组合配方（证据级：实测）与设计合理但未整链实测的（证据级：推断）。
> 首批三条实测管线：2026-08-23/24 · dsh 0.1.1-rc.2 · 隔离 profiles（cz-*）。底层机制坑见 [FIELD-NOTES.md](FIELD-NOTES.md)。

---

## 一、实测闭环的配方

### 配方 1 · PR 评审流水线【实测】

**组合**：repogate（GitHub API 面）+ gavel-review（对抗评审）+ 本地 git checkout
**场景**：对任意 open PR 做"能不能合"的把关，产出可直接贴回 PR 的审查报告。

```
repogate gh_pr_fetch（元数据/mergeable 状态）
   → gh pr checkout 到本地（diff 获取走 git，见坑1）
   → gavel_review paths 模式审改动文件
   → 汇总：发现分级 + mergeable + 合并建议
```

**实测**：对 Anionex/dsh-turn-rewind PR#4（6 文件 +145/−30）产出 17 项分级发现（4 必须修复，含 AbortController 竞态真 bug）、`merge-tree` 实证合并冲突、识别出 lib/ 是编译产物应重构建而非手工解冲突、并标注了 gavel 静态哨兵的 2 处疑似误报——结论 NO-SHIP。

**两个坑（都是实测撞的）**：
1. **repogate 23 工具没有"取 PR diff 原文"的工具**（fetch 只回元数据+统计）——diff 获取要么本地 checkout（推荐，顺带获得 paths 模式），要么 shell 拉 `.diff` 端点落盘再 read。模型在缺 diff 时会**拒绝用 PR 描述伪造**（好行为，别硬掰）。
2. 77KB 级 diff 别走"read 工具读全 → 拼 → gavel diff 参数"路线（token 与时间双爆，两次超时实测）；**paths 模式 + 本地 checkout 是正解**。

### 配方 2 · 写作者/评审员分工【实测】

**组合**：dsh-file-claim（写面锁）+ gavel-review（评审）+ git（归因）
**场景**：两个并行会话改同一仓库，强制"一人写、一人只能评审"的角色纪律。

```
会话 A（writer）：claim_files → edit（引入/修改代码）
会话 B（reviewer）：write 尝试 → 被 pre-execute 拦截（角色强制点！）
   → 改用 gavel_review paths 模式 → git diff 对比工作区
   → 归因：哪些是 writer 本次引入、哪些是存量
```

**实测**：A 认领 calc.js 并删防御检查+改边界；B 写入被拦（结构化错误+三条出路）→ gavel 审出 5 项分级 → **用 git diff 精确归因**：R2（删 null 守卫→NaN 静默污染）为本次引入的必须修复回归；公平指出 `>=` 边界改动反而修正了注释矛盾但属"无声金额变更"应配测试。全程 B 零写入——file-claim 把"评审员不该改代码"从约定变成了机制。

**要点**：评审员会话拿不到写权限是特性；归因用 `git diff`（未提交改动）比纯读代码准得多。

### 配方 3 · 晨报管线（定时巡检+推送）【实测】

**组合**：chicheng-cron（agent 任务）+ gavel-review（审查）+ chicheng-push（ntfy 出口）
**场景**：每天 9 点自动体检代码库，结论推到手机——全自动、无人值守。

```
cron 任务 type=agent（prompt: 用 gavel 审查 X）
   → cron 内部 boot agent（复用同 profile 工具栈）
   → 完成 → pushEnabled 任务结果自动推 ntfy 通道
```

**实测**（runNow 触发）：90s 排程+544s 执行 exit 0；**agent 两次自主自救**——发现 cron 内部 agent 未直接注册 gavel_review 工具，换同引擎官方 CLI 等价执行；correctness/maintainability 透镜因 GLM 推理吃满默认 maxTokens=3000 返回空，定位后以 `GAVEL_MAX_TOKENS=16384` 重跑，三透镜全覆盖。推送送达 ntfy（服务端历史验证：标题=任务名+exit 0+耗时+输出摘要）。

**要点**：
- cron 的 agent 任务是**首次实测的类型**（round4 只测过 shell）——跑长任务把 `timeoutMs` 给足（≥600000）
- gavel 透镜在 GLM 上建议 `GAVEL_MAX_TOKENS=16384`（3k 会被推理吃光）
- push save 新建通道**不要带 id**（带 id 走 update 分支 → not-found）；ntfy 字段名是 `ntfyServer`/`ntfyTopic`（不是 server/topic）

---

## 二、设计模式（从配方提炼）

### 模式 A · 安全网（改前快照 / 改中护栏 / 改后回退）
`turn-rewind + file-claim + dsh-undo`：turn-rewind 每 turn 自动 checkpoint 工作区；file-claim 防并行会话踩脚；undo 回滚会话消息。三者正交覆盖"工作区/并发/对话"三个状态面。日常单会话用 turn-rewind+undo 即可；多会话并行加 file-claim。

### 模式 B · 出口统一（一切结论进手机）
`chicheng-push` 是唯一的出口层：cron 晨报（配方 3）、gavel 评审结论、file-claim 的 pending 合并提醒都可走 `pushNotifier` 服务。**新自动化插件的验收项之一**：能不能复用 pushNotifier 而不是自建通知。

### 模式 C · 元数据与内容分轨
GitHub 类工作流中 API 元数据（mergeable/评论/状态）走 repogate，大文本内容（diff/文件）走本地 git——各用最擅长的面。同型适用：文档元数据走 MCP、正文走文件系统。

### 模式 D · 角色由机制强制
约定靠自觉，机制靠拦截：file-claim 拦写让评审员只能是评审员（配方 2）；gavel 的 ship/no-ship 让"过不过"有结构化判据。给 agent 的角色边界尽量落到"工具不给他"而不是"提示词告诉他别用"。

### 模式 E · 长任务三件套
cron（定时/触发）+ agent 自救（工具缺失换等价路径：CLI/环境变量）+ push（结果出口）。配方 3 证明 agent 在工具不可达时的自救行为可靠，但**prompt 里要写清意图与可用替代**，且预算给足。

---

## 三、待验证组合【推断】

- **genui + push**：genui 卡片留在会话内，push 推文本摘要——"汇报卡+手机通知"双出口。未实测（genui 卡片生成已实测，组合是机械拼接，风险低）。
- **crosstalk + file-claim + turn-rewind**：跨会话传话协调 + 写锁 + 快照 = 多会话协作的完整底座。crosstalk 安装路径断裂（F10）修好后值得整链测。
- **subagent-registry + gavel**：把"对抗评审"做成可调 subagent（`~/.dsh/agents/reviewer.md` 里写"用 gavel_review 审"），主会话按需调。未实测。
- **repogate + gavel 回贴**：配方 1 的写回环（gh_review_create 贴审查结论到 PR）。工具存在，未实测写操作（避免污染他人仓库）。
- **cron skill 任务 + civair-kb**：定时知识底座巡检（civair_kb_status 快照+缺口报表→push）。skill 类型任务未实测。

### 配方 3 补记（2026-08-28 选型更新）

shortlist 批实测 dsh-cron 后的晨报管线选型结论：**含工具型步骤（gavel 审查）的晨报建议换 dsh-cron**——其 agent 任务进程内 import 宿主包，工具栈完整（bash 直调 9.7s vs chicheng-cron 的 agent 工具未注册需自救 544s，快约 50 倍）；推送出口两选一：chicheng-cron 的 pushEnabled（web UI 配置友好）或 dsh-cron 的 agent prompt 里 curl ntfy（模型自治）。详见 dsh-cron 卡片的横向对比表。

## 四、组合装机的最小集建议

```sh
# 生产力四件套（日常 web profile，全部实测互不冲突）：
dsh plugin --profile web add @anionex/dsh-turn-rewind dsh-file-claim gavel-review github:omdsh-dev/dsh-genui
# 晨报管线（在四件套之上）：
dsh plugin --profile web add github:534119219/chicheng-push github:534119219/chicheng-cron github:JohnXu22786/github-mcp
```

冲突/兼容核对：以上 7 件两两无已知冲突（web-only 的 push/cron 在 web profile 天然满足；gavel/genui 双注入 systemPrompt 无互补覆盖问题实测）。
