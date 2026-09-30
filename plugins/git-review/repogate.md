# repogate（GitHub 工作台 MCP bundle）

**分类** git-review · **评分** ★★★★ · **实测** 2026-08-22 · dsh 0.1.1-rc.2

GitHub 开发者工作台 MCP server 以 dsh bundle 形态接入：宿主桥接插件 spawn 子进程跑 MCP server（stdio JSON-RPC），23 个工具（repo/issue/PR/review/search/account/gh_auth_*）注册为 `mcp__repogate__<name>`。零运行时依赖。repo：JohnXu22786/github-mcp。

## 安装

```sh
# ⚠ npm 的 repogate 0.1.0 没有 dsh.bundle 声明（装上不激活）——必须 GitHub 源：
dsh plugin --profile <name> add github:JohnXu22786/github-mcp
# bundles 补 "@deepseek-ai/dsh-headless"（同 gavel 卡片坑）
# token 三选一：环境变量 GITHUB_TOKEN/REPOGATE_TOKEN（子进程继承宿主 env）·
#   插件行 config.env · OAuth 设备码流（--oauth-client-id 启用）
```

## 实测结论

- ✅ boot：`[repogate] v1.0.1 已启动（23 工具）` + bridge 注册 23 工具；**会话结束子进程干净退出（code=0）**——生命周期管理实证
- ✅ **无 token 透明失败**：工具返回结构化中文错误，列出 3 条解决路径（env / config / OAuth），不挂死不崩
- ✅ **真实 token E2E**（gh auth token 注入 env）：`gh_repo_fetch` + `gh_issue_browse` 联动查 cirelir/dsh-change-review（默认分支/star/push 时间/open issue 全对），只读 2 次 API 调用，诚实标注 `updatedAt`≠`pushed_at`
- ✅ dump-config：`repogate-mcp` 行插入，patch 的 `name: repogate/bridge` 子路径解析正常

## 坑与修复

- **npm/GitHub 版本分裂**：npm 0.1.0 ≠ repo 1.0.1（npm 版无 bundle 声明，dsh plugin add 只装不激活并打警告）——只认 GitHub 源
- 撞名：npm `github-mcp` 是 Seey215 的无关包，真名 `repogate`
- OAuth 设备码端点（github.com/login/device/code）仅在显式 `--oauth-client-id` 时启用，boot 零外联（源码级确认）；api.github.com 为唯一常规端点
- spawn 用法安全：`spawn(process.execPath, [entry, ...args])`，无 shell:true（源码级确认）

## 适用

给 agent 装 GitHub 只读/读写工作台（替代裸 gh CLI 的结构化路线）；token 可控注入，适合 CI/隔离 profile。

## 来源

- GitHub JohnXu22786/github-mcp（v1.0.1）· 实测证据：/tmp/gr-e2e/repo-e2e-notoken.log、repo-e2e-token.log
