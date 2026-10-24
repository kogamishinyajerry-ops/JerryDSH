# dsh-medini-plugin

把 **MediniAgent**（Ansys medini Analyze 2023 R2 的故障树分析 MCP 服务器）作为
DeepSeek Harness (DSH) 的 **MCP 桥接插件资产** 安装，让 DSH 会话里的模型直接拿到
`mcp__medini__*` 系列工具。

## 安装后模型能干什么

| 工具 | 能力 |
|---|---|
| `mcp__medini__medini_analyze_pdf` | **一键入口**：CAFTA text PDF → 解析 → 独立解算 → FaultTreePlus 导出 → medini headless 实跑 → 三方校验 |
| `mcp__medini__medini_doctor` | 环境自检（medini 路径 / license 端口 / venv 依赖 / workspace） |
| `mcp__medini__medini_batch_analyze` | 批量异步分析（目录下全部 PDF），返回 job_id |
| `mcp__medini__medini_job_status` / `medini_list_jobs` | 后台作业状态 |
| `mcp__medini__medini_list_cases` / `medini_get_case` | 案例清单 / 结果读取 |
| `mcp__medini__medini_parse_pdf` / `medini_solve_tree` / `medini_export_faulttreeplus` / `medini_run_headless` | 分步细粒度控制 |
| `mcp__medini__medini_render_tree` | medini 风格故障树 PDF/PNG 渲染 |
| `mcp__medini__medini_verify_case` | 与密封真值三方对照 |
| `mcp__medini__medini_capture_gui` | medini GUI 窗口跨 Session 抓图 |
| `mcp__medini__medini_fta_workflow` | 完整 FTA 工作流引导提示 |

实测性能（2026-09-01，T1-001 案例）：PDF→Q_top+MCS 端到端 ~11.5s，其中 medini
headless 实跑 9.4s；自研解算与 medini 引擎相对误差 0，MCS 集合一致。

## 架构

```
DSH (node) ──stdio──► python server.py (FastMCP, 15 tools)
                          └─ medini_mcp/ (parse / solve / export / medini_cli / render / verify / capture)
                                └─ mediniAnalyze.exe headless (E:\ANSYS Inc\...)
```

DSH 侧**零 Node 依赖**：只使用官方自带的 `@deepseek-ai/dsh-mcp-client` 桥，
通过每个 profile 的 `cordis.patch.yml` 的 `insert` 行注册。medini 侧由
workbuddy 托管 venv（`C:\Users\Kogami\.workbuddy\binaries\python\envs\default`）
承载全部 Python 依赖（mcp 1.28.1 / pymupdf / matplotlib / psutil / Pillow，已装）。

## 安装（全新机器）

前置：medini 2023 R2 在 `E:\ANSYS Inc\Medini Analyze 2023 R2`、license server
监听 1055、workbuddy python venv 有 `mcp` 包。缺一样就先跑
`mcp__medini__medini_doctor`（装好后）或在 `D:\MediniAgent\mcp` 里
`python -m medini_mcp.deps` 排查。

```powershell
cd D:\MediniAgent\dsh-plugin
.\install.ps1          # 建 junction + 写两个 profile 的 cordis.patch.yml
```

然后**重启 DSH**（TUI 或 web）。模型在任意会话里即可调用 `mcp__medini__*`。

## 安装（本机，已执行）

2026-09-01 已在 `D:\dsh` 完成等效安装：

- `D:\dsh\home\profiles\web\cordis.patch.yml` — `insert` 行 `mcp-medini`
- `D:\dsh\home\profiles\tui\cordis.patch.yml` — 同一行
- 无 junction 需求（MCP server 是 stdio 子进程，不进 node_modules）

`install.ps1` 幂等：重复执行只更新 patch 行，不会重复插入。

## 卸载

```powershell
cd D:\MediniAgent\dsh-plugin
.\uninstall.ps1        # 从两个 profile 的 cordis.patch.yml 移除 mcp-medini 行
```

## 验证

```powershell
cd D:\MediniAgent\dsh-plugin
.\verify.ps1           # 直接走 MCP stdio 协议：tools/list + medini_doctor 实调
```

预期输出：`15 tools` + `doctor ok=true`。这是 DSH 桥接前最底层的连通性证据。

## 故障排查

| 症状 | 处置 |
|---|---|
| 模型看不到 `mcp__medini__*` | DSH 没重启；或 `cordis.patch.yml` 的 `insert` 行缩进被改坏（必须是顶层 `- insert:`） |
| 工具在但调用挂 300s 超时 | medini license server 停了 → `netstat -ano \| findstr :1055`；或上次 headless 崩溃留了 `.lock` → 删 `D:\MediniAgent\mcp\workspace\.metadata\.lock` |
| `medini_doctor` 报 venv 缺依赖 | `C:\Users\Kogami\.workbuddy\binaries\python\envs\default\Scripts\python.exe -m pip install -r D:\MediniAgent\mcp\requirements.txt` |
| server.log 有 `write() 阻塞` | 不要把 `MEDINI_MCP_LOG_STDERR=1` 打开（stdio 下 stderr 无人消费会撑爆缓冲） |
| GUI 抓图全黑 | medini GUI 必须在用户桌面跑着（Session 1）；沙箱/服务进程里抓不到 |

## 文件清单

```
dsh-plugin/
├── README.md          ← 本文件
├── install.ps1        ← 幂等安装（写 patch 行）
├── uninstall.ps1      ← 移除 patch 行
├── verify.ps1         ← MCP stdio 协议直连自检
└── dsh-medini.mcp.json ← WorkBuddy/通用 MCP 客户端等价配置（参考）
```

真实服务器代码在 `D:\MediniAgent\mcp\`（`server.py` + `medini_mcp/`），本包
**只装配置不拷代码**——升级 medini pipeline 后无需重装插件。
