# dsh-change-review（会话级行级 diff 审查）

**分类** git-review · **评分** ★★★★ · **实测** 2026-08-22 · dsh 0.1.1-rc.2 · **web-only**

追踪会话内的 write/edit 工具调用，按会话聚合、行级 diff 对比展示、一键 revert/编辑器跳转，SSE 实时推送，子代理改动聚合到根会话。repo：cirelir/dsh-change-review（9★）。

## 安装

```sh
dsh plugin --profile <name> add github:cirelir/dsh-change-review   # npm 404
# web-only：bundles 必须含 "@deepseek-ai/dsh-web-app"（headless 组合 boot 必挂，机制见 research/05 §7）
# 宿主 inject: ['webServer', 'agents']；客户端 inject 4 个 dsh-client-ui-* 模块 + platform: web
```

## 实测结论

- ✅ **捕获链实测闭环**（headless + webServer stub 方案，见 FIELD-NOTES）：会话内 write（`before:null → after:"hello-diff"`）与 edit（`before/after + oldString/newString` 全记录）双路捕获，按 session 隔离，turn/cwd 齐全，state 持久化 `profile 目录/diff-review-state.json`
- ✅ web E2E（独立端口 3191）：boot 激活；client.js 44KB 正常下发（05 §8 探测法）；宿主 9 路由注册——`/diff-review/editors` 200（真实编辑器探测）、`/diff-review/summary` 200、`/diff-review/events` SSE 心跳接通
- ⚠ **GUI 面板交互未实测**（需浏览器操作/逆向 web RPC，本轮边界外）；上游有 open issue #1「审查界面样式有问题」——首次 GUI 使用时留意
- ✅ 会话被 429 打断时捕获与落盘不受影响（state 完整）

## 坑与修复

- **execSync+shell 面**（源码审查重点）：open-with-editor / reveal 路由的 filePath 走标准 POSIX 单引号转义（`escapeShellArg`，`'\''` 写法正确）；命令主体来自硬编码编辑器候选表；editor-icon 的弱转义（`\"`）但输入源是本地 app bundle 路径非请求参数——整体安全通过，零外联（localhost 仅用于 URL 解析）零 eval
- 状态在内存 + state.json，boot 时载入；改 state 文件要重启
- revert 路由有写文件能力（设计使然），web 端口暴露时注意访问面

## 适用

日常 web profile 的"这轮会话改了什么"总账本；与 gavel-review 互补（一个审 diff 质量、一个管会话改动清单）。

## 来源

- GitHub cirelir/dsh-change-review 0.3.0 · 实测证据：~/.dsh/profiles/gr-review-h/diff-review-state.json（捕获实证）、/tmp/gr-e2e/review-web.log（web 启动）
