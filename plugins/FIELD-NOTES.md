# FIELD-NOTES · 插件实测机制级新发现

> 与 research/05-mechanics-notes.md 分离：这里累积后续实测轮次的新机制发现（git-review 轮 2026-08-22 · sessions 轮 2026-08-23 · engineering+presentation 轮 2026-08-23 深夜 起账）。证据等级：实测 = 本机复现取证；源码 = 读安装源码确认；推断 = 合理推理未逐一复现。

## F1. `dsh plugin add` 新建 profile 缺终端 bundle → boot 无声挂起【实测】

`dsh plugin --profile <new> add <pkg>` 初始化的 profile bundles 只有 `@deepseek-ai/dsh-base` + 新插件，**没有任何终端 app bundle**。base 无 prompt 处理入口，`dsh --profile <new> "任务"` 表现为：不报错、不输出、直到 timeout（exit 124）。与 web-only 挂起（05 §7，报 `1 entry did not activate`）症状不同——**这是无报错的静默挂死**。修复：bundles 手动补 `@deepseek-ai/dsh-headless`（headless 用）或 `@deepseek-ai/dsh-web-app`（web 用）；官方 bundle 靠安装内解析（05 §2），无需安装。

## F2. 裸对象 register 不过 defineTool → 带参工具全废【实测 + 源码】

dsh 的扁平 parameters 表 → 标准 JSON Schema（`{type:'object', properties, required[]}`）的**编译发生在 `defineTool` 里**，不在 `ctx.tools.register`。插件裸对象 register 时原始扁平表直接下发给模型 API：
- 零参数工具侥幸正常（空参数合法）
- **带参工具在模型侧变成"无参工具"——tool-call arguments 恒为 `{}`**，模型 reasoning 想传参但无可传字段，反复重试全空（transcript 实证：连续 3+ 次调用 arguments 全 `{}`，与 provider responseId 一一对应）
- 症状易误诊为"模型不听话"或"dsh 丢参"——先查插件的工具是否包了 `defineTool`

对照实验：gavel-review（defineTool 包装，同为零依赖 import `@deepseek-ai/dsh-tools`）参数正常；worktree-mgr（裸对象）丢参；同一 profile 同一模型。worktree-mgr 的修复 = `tools.map((t) => defineTool(t))`，修复后带参调用立即正常。

## F3. 工具 output schema 严格校验：boolean 属性带 required → boot 硬崩【实测】

dsh-tools 的 `assertSupportedJsonSchema` 是白名单式：output schema 的 **boolean 类型属性上出现 `required` 指令直接抛 `UNSUPPORTED_SCHEMA`，boot 失败**（不降级不警告）。合法写法是 required 作为父级数组。注意区分：**parameters 扁平表里 string 属性的 `required: true` 是 dsh 约定、合法**（表示必填输入）——只有 boolean/output 上下文非法。命中实例：worktree-mgr 0.1.0（5 处）。

## F4. npm/GitHub 版本分裂 + 撞名包：安装源必须核对 repo 真名【实测】

本轮 4 件全部中招不同变体：
- `adversarial-review` / `github-mcp` 在 npm 是**别家的同名无关包**（voodootikigod / Seey215）；JohnXu22786 系真名是 `gavel-review` / `repogate`
- `worktree-mgr` / `dsh-change-review` npm 404，仅 GitHub 源
- `repogate` npm 有 0.1.0 但**无 `dsh.bundle` 声明**（装上不激活，dsh 打警告"installed as a plain dependency"）；repo main 的 1.0.1 才是插件形态
- `gavel-review` npm 0.1.0 可用但滞后于 repo

流程结论：**候选池先读 GitHub repo 的 package.json 定真名与 dsh 声明，npm 只当分发渠道核对**。

## F5. cordis 服务发布 API：`ctx.provide('name', impl)`【实测】

这版 cordis（dsh 0.1.1-rc.2 附带）的 ctx **不可调用**（`ctx is not a function`）；插件发布服务用 `ctx.provide('webServer', impl)`。据此可写最小 stub bundle 在 headless 里满足 web-only 插件的 `inject: ['webServer']`——本轮用它实测了 dsh-change-review 的会话捕获链（write/edit 双路 + state 持久化）。stub 的 register 只收集不挂载即可满足激活；仅研究/测试用途，不替代真实 web 宿主的 HTTP 能力。

## F6. 会话 transcript：zstd 压缩 jsonl，可审计 tool-call 参数【实测】

会话存储 `~/.dsh/sessions/<cwd-路径转义>--/session-<uuid>/session.jsonl.zstd`，`zstd -dc` 解压后逐事件含 `tool/call`（callId/name/**arguments 原文**）、assistant reasoning、request/header（**发给模型的完整 tools schema**）。排查"模型为何不传参/工具 schema 长啥样"的终极证据源——F2 的定案证据即来自此处。

## F7. web 宿主起非默认 profile 的正确姿势【实测】

`dsh web` 子命令是 web profile 的**专用别名**，不接受 `--profile`。其它 profile 的 web：`dsh --profile <name> --port <p> --host 127.0.0.1`（app 参数直接跟在 launcher 后，与 headless 传 prompt 同构）。`--no-open` 可禁开浏览器。

## F8. headless 文件沙箱 vs 插件默认路径【实测】

headless 会话内插件子进程的默认数据路径若指向 `~/.local/share/...` 等沙箱外位置会 EPERM（worktree-mgr vault 命中）。对策：插件 config 重定向（如 `vault`）或环境变量（如 `WTM_VAULT`）。测试 profile 的 E2E 里给插件预留 /tmp 可写路径。

## F9. 杂项【源码/推断】

- repogate 的 MCP 桥接：宿主插件 spawn `process.execPath` 跑自家 entry（stdio JSON-RPC），子进程随会话退出干净回收（code=0 实测）；patch 的 `name:` 支持包内子路径（`repogate/bridge`）
- gavel-review 的 llm 客户端：provider 留空时 fallback `exec.agent?.options.provider`（继承当前会话 agent 的 provider）——第三方插件复用宿主 llm 服务的正确姿势
- dsh web 前端为壳（`__ModuleLoader__`），UI 模块按 `/plugins/<pkg>/client.js` 下发（05 §8 机制的又一实证，44KB 模块 200 返回）

## 以下为 Sessions 批（2026-08-23）新增

## F10. pnpm github: 安装按 files 字段打包仓库 → "构建产物未提交"的包直装即空壳【实测】

`dsh plugin add github:<repo>` 走 pnpm git 依赖，pnpm 按 repo package.json 的 `files` 字段打包。若 files 列了 `lib/`（构建产物）而 repo 只提交了 `src/`（源码），装出来就是**没有代码的空壳包**：boot 直接 `ERR_MODULE_NOT_FOUND`（main 指向不存在的 lib/index.js）。命中实例：dsh-crosstalk（files 列 lib、repo 只有 src、`prepublishOnly` 构建又从未发过 npm）→ 该插件当前不存在任何可用安装路径。对照：worktree-mgr/repogate/dsh-change-review 的 files 列的是已提交的 src，GitHub 源正常。**选品时先核对 files 字段与 repo 实际内容物**。

## F11. 在 profile 目录里跑 npm = 毒化整个 profile（Symbol 双实例）【实测】

在 profile 的包目录里执行 `npm install`（哪怕 ERESOLVE 失败），npm 会沿目录树向上找到 **profile 根的 package.json**，把依赖（含 registry 版的 `@deepseek-ai/dsh-tools` 等官方包，多为陈旧 dist-tag 版）写进 profile 根 node_modules。后果链：profile 本地副本 shadow 掉 dsh 安装内的模块解析（05 §2 机制反向踩坑）→ `dsh-tools` 的 `TOOL_RUNTIME_SCHEDULER` 是**普通 Symbol（非 Symbol.for）**，两份模块实例符号不相认 → **该 profile 下一切工具调用崩溃** `Cannot read properties of undefined (reading 'prepare')`，且与哪个插件无关（禁用插件行仍崩）、boot 正常（只有工具执行路径踩 symbol）。诊断要点：干净 profile 同装法对照即分离变量。处置：弃用毒化 profile 重建；**构建修复一律在仓外 clone 做完只拷产物**。

## F12. 会话文件格式：流式多帧 zstd，帧界≠行界【实测】

当前 dsh（0.1.1-rc.2）的 `session.jsonl.zstd` 是**多个 zstd 帧拼接的流，帧边界由写入 flush 时机决定，与 JSONL 行边界无关**（43KB 会话 70 帧；整流解压才是合法 JSONL；帧内容可断在行中间）。两个连带坑：
- 第三方解析器若假设"一帧=一行（带校验和）"（旧格式），会解析出 0 事件——dsh-session-recovery 命中，一行补丁（拼接全帧再按 \n 切）即救活
- **Node `zlib.zstdDecompressSync` 对多帧文件只解首帧**——校验/读取会话文件要用 `zstd -dc` CLI 或自己逐帧循环拼接；单测里"解压出 1 行"多半是这个假象

## F13. headless 无 --resume；commands 服务的斜杠命令 headless 不可达【实测+源码】

`dsh --profile <p> --resume <session>` 报 unknown option——resume 是 TUI/web app 的能力，headless 一次性任务不支持（launcher 示例里的 `--resume` 只对装了对应 app 的 profile 成立）。连带：`inject: ['commands']` 的插件（如 dsh-session-recovery 的 /session-repair）在 headless profile 里能正常激活注册，但**无从触发**（斜杠命令是交互面）——这类插件的有效测试面在 web profile。

## 以下为 engineering+presentation 批（2026-08-23 深夜）新增

## F14. 隐性服务依赖：插件可注入 base/headless 都不提供的服务 → headless boot 挂起，且补法有讲究【实测】

插件 inject 可以引用任意服务名（不止 tools/llm/webServer 这些常见面）。命中实例：dsh-ssh-ops `inject: ["tools","storageDomain","credentials"]`——`storageDomain` 只在 **dsh-web-app 的 cordis.patch** 里挂载（dsh-storage → dsh-storage-json → dsh-storage-domain 三行链），headless/base profile 没有它 → boot 挂起 `pending (waiting for service: storageDomain)`（这是 web-only 的泛化形态：不止 webServer，任何"宿主服务缺口"都这么死）。

补法两条路，**只有一条对**：
- ❌ 把 `@deepseek-ai/dsh-storage-domain` 写进 profile bundles → `declares no dsh.bundle` 硬错——它是**库包不是 bundle**（bundles 列表只认带 dsh.bundle 的包）
- ✅ profile 用户层 cordis.patch.yml `- insert` 三行服务链（name 填包名，模块解析走 dsh 安装内，05 §2），config 照抄 web-app patch（storage-json 的 root 可改指向隔离目录）——实测 boot 通过

判别方法：boot 挂起时看 `pending (waiting for service: X)` 报的服务名，去 `dsh-web-app/cordis.patch.yml` 找提供者包，照抄挂载行。

## F15. 插件未捕获第三方库的 error 事件 → 整个 dsh 进程崩【实测】

dsh-ssh-ops 对 ssh2 Client 的 `'error'` 事件（连接拒绝/握手失败/超时）没有监听 → Node 默认行为=Unhandled 'error' event **直接崩溃宿主进程**（不是工具调用失败，是 dsh 整个退出）。实测双路径复现：连坏 sshd（握手重置）与端口未监听都崩。这是插件健壮性的反面教材：**包装异步网络库时必须先挂 error 监听再暴露给模型**（dsh 工具层只能捕获 execute 里 await 的异常，事件式回调逃逸在外）。选装网络类插件前先看这一点。

## 以下为 shortlist 批（2026-08-28）新增

## F16. 插件跑 agent 任务的两种姿势：进程内 import vs 另起会话【实测对比】

插件要在无人值守时跑 agent 任务，有两条路，实测差异巨大：
- **进程内 import 宿主包**（dsh-cron：直接 `import { installModelSelection } from '@deepseek-ai/dsh-agent'` + dsh-llm/dsh-session，按官方 headless one-shot 配方装配）→ **工具栈完整**（bash 直调，9.7s 轻任务）、速度快、无子进程开销
- **另起 agent/会话**（chicheng-cron 路线）→ 实测（combo3）agent **工具未直接注册**、被迫自救换 CLI，544s——慢约 50 倍且依赖模型自救能力

给插件作者/选型者的结论：定时 agent 任务优先选进程内方案；判断方法 = 源码 grep `@deepseek-ai/dsh-agent` import。连带：dsh-cron 的进程内方案同时暴露了 F14（storageDomain 依赖），两坑常伴生。

## F17. 装"审批接管型"插件 = 全局默认行为被改写【实测】

dsh-llm-approve-for-me 的 patch 直接改写 base 的 permission 行（`defaultPreset: llm-approve-for-me`）——安装即让**所有新会话**的沙箱提权审批从"问人"变为"LLM 裁决"。dump-config 的 diff 能看到这类接管（`# == @deepseek-ai/dsh-base, patched by <插件>` 标记 + config 变更）。推广：**插件可以 patch 掉 base 的任何行**（不只 insert 新行）——装插件前值得对 dump-config 做前后 diff，确认它改写了哪些全局默认。这类"接管型"插件要在卡片里显式标注。
