# chicheng-cron（会话外定时自动化）

**分类** automation · **评分** ★★★★ · **实测** 2026-08-22 · dsh 0.1.1-rc.2

cron 调度器：5 种任务类型（shell/python/node/**skill**/**agent**——后两种直接跑 DSH 自己的 skill 和 headless agent），运行历史独立落盘，侧边栏「定时任务」UI。零依赖。

## 安装

```sh
dsh plugin --profile web add github:534119219/chicheng-cron   # 未发 npm，走 github spec
```

## 实测结论

- ✅ 建任务（`* * * * *` shell）→ `runNow` 手动触发 → exit 0，产物文件正确写入
- ✅ 运行历史完整：`$DSH_HOME/cron/runs/<runId>/output.txt`，含 exitCode/duration/outputLength
- ✅ API 面：`/cron/api/{list,status,preview,save,remove,toggle,runNow,runs,runOutput,pushChannels,skills}`
- ✅ 与 chicheng-push 闭环：`pushEnabled`+`pushChannel` 任务完成自动推送

## 坑与修复

- ⚠ **web-only**（同 chicheng-push 的 inject 声明）
- cron 表达式最小**分钟粒度**，无秒级；要更密用 `everySeconds`
- `save` 全量字段更新——改一个字段也要带全量（见 research/04 的 payload 实证）

## 适用

定时巡检/定时跑 skill（如定时知识库快照、定时编译检查）/ 定时 agent 任务（新 headless 会话）。

## 来源

- [GitHub 534119219/chicheng-cron](https://github.com/534119219/chicheng-cron) 0.1.1 · 实测细节 [research/04](../../research/04-ecosystem-survey.md)
