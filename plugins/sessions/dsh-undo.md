# dsh-undo（会话消息回滚）

**分类** sessions · **评分** ★★★☆ · **实测** 2026-08-22 · dsh 0.1.1-rc.2

`/undo` / `/redo` 会话消息回滚：append-only marker 遮蔽机制，不动文件系统、不删事件（可 redo 恢复）。

## 安装

```sh
dsh plugin --profile web add dsh-undo
```

## 实测结论

- ✅ 加载 + `/undo`、`/redo` 命令注册（源码实证 `ctx.commands.register`）
- ✅ 设计质量：undo 范围语义对齐 opencode（尾随用户消息只遮蔽自己；助手回复整轮遮蔽）；**持久化不确定时有诚实文案**；redo 是 LIFO 栈
- △ 交互 E2E 未做：斜杠命令需真实会话交互（headless 一次性任务不便注入）

## 坑与修复

- ⚠ **README 货不对板**：宣传的 "shadow-Git 文件快照恢复" 是 `packages/bundle-rollback` 分支形态；npm 版 0.2.0 只做消息回滚，**不回滚文件**
- redo 栈进程内不持久（浏览器 undo 语义，重启即空）——日志本身跨重启一致

## 适用

日常后悔药：发错 prompt / 模型跑偏一轮，/undo 回到上一条消息之前（会话记录完整保留）。

## 来源

- npm `dsh-undo` 0.2.0 · [GitHub 23swccp/dsh-undo](https://github.com/23swccp/dsh-undo) · 评测细节 [research/04](../../research/04-ecosystem-survey.md)
