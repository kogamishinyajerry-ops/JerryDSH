# dsh-thread（会话记忆 + 谱系）

**分类** sessions · **评分** ★★★★（修复构建后）· **实测** 2026-08-22 · dsh 0.1.1-rc.2

会话事件的 lossless 捕获到 SQLite 双库 + 结构化投递（首轮锚点 / 压缩后重锚 / 跨 agent 状态增量）+ `query_session_memory` 工具（ls/cd/cat/grep 式导航）+ 行为契约 skill。

## 安装

```sh
dsh plugin --profile web add dsh-thread
# ★ 必做（pnpm 10 构建脚本拦截坑，见 research/05 §5）：
cd ~/.dsh/profiles/web
# package.json 加 "pnpm": { "onlyBuiltDependencies": ["better-sqlite3"] }
pnpm rebuild better-sqlite3
```

## 实测结论

- ✅ `query_session_memory` 注册进模型工具列表，调用返回正确（新记忆返回空列表=正确行为）
- ✅ 状态卡注入生效（模型主动确认"Thread 状态卡已收到"）
- ✅ 双库落盘：`~/.thread/structured.db` + `~/.thread/projects/<hash>/events.db`（root 可用 `THREAD_ROOT` 改）
- ✅ 决策/偏好显式通道：`/thread-reg dec`、`record_decision` 工具

## 坑与修复

- ⚠ **默认安装存储层是坏的**：better-sqlite3 无 native binding → 每次事件捕获 stderr 报 `capture failed`（响亮报错不装死，好评）但记忆不落盘。修复见安装节
- 事件捕获失败不打断会话（降级透明）

## 适用

跨会话/跨 agent 的长期记忆与决策谱系——比 honcho 轻（自带 SQLite，无外部后端）。

## 来源

- npm `dsh-thread` 1.0.2 · [GitHub zhaoyuntao-wl/dsh-plugin-thread](https://github.com/zhaoyuntao-wl/dsh-plugin-thread) · 实测细节 [research/01](../../research/01-updates-and-top-plugins.md)
