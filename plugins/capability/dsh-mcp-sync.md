# dsh-mcp-sync（MCP 集中管理直注）

**分类** capability · **评分** ★★★★ · **实测** 2026-08-22 · dsh 0.1.1-rc.2

把 MCP 服务器工具直注为 `mcp__<server>__<tool>` 的模型工具：多源扫描（Claude Desktop / Cursor / Codex / DSH 配置）、自动连接、管理面板 + 11 个 HTTP API。npm 周下载 4.3k。

## 安装

```sh
dsh plugin --profile web add dsh-mcp-sync   # 只能 web profile！见坑 A
```

## 实测结论

- ✅ 自动扫到本机 codex 源 4 个 server（trigger/node_repl/codebase-memory/computer-use），3 连接成功、**发现 50 个工具**
- ✅ 自定义 echo server 完整闭环：注册 → connect → 工具发现 → 调用返回 `echo-mcp says: roundtrip-42`
- ✅ 管理 API 全可用：`/api/dsh-mcp-sync/{health,stats,tools,connections,sync,connect,disconnect,call,reconnect,registry,sources}`

## 坑与修复（三个，都已实测）

- ⚠ **headless 必挂**：`inject=["webServer"]` 硬依赖，headless 组合无此服务 → 整个 profile boot 失败。只装 web profile
- ⚠ **配置文件名双轨**：自定义注册表是 `~/.dsh/mcp-registry.json`，"dsh" 扫描源却读 `~/.dsh/mcp.json`。想被扫到写前者/后者要分清
- ⚠ **API 字段不统一**：connect 收 `{"name"}`，call 收 `{"server","tool","args"}`（不是 arguments）
- 其他：npx 型 MCP 定义报 `unsupported transport type: command`（兼容缺口）；call 缺省 args 静默空参

## 适用

你机器上多个 AI CLI 的 MCP 配置散落在各处时的统一收编 + 面板化管理。

## 来源

- npm `dsh-mcp-sync` 0.7.0 · 实测细节 [research/03](../../research/03-capability-plugins.md)
