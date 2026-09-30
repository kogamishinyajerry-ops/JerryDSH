# dsh-cron（host 侧无人值守调度器）

**分类** automation · **评分** ★★★★ · **实测** 2026-08-28 · dsh 0.1.1-rc.2 · **headless 需补 storageDomain 服务链（F14）**

**模型自治**的调度器：7 个模型工具（cron_create/delete/enable/disable/list/run_now/runs）让 agent 在对话里自己安排定时工作；两类任务——agent（**进程内**完整 agent loop）与 command（spawn 参数数组）。repo：squirrel20/dsh-cron。

## 安装

```sh
# ⚠ npm 0.1.0 严重滞后（repo 已 0.9.8）——必须 GitHub 源：
dsh plugin --profile <name> add github:squirrel20/dsh-cron
# headless 需 F14 补链（storage → storage-json → storage-domain 三行 patch，见 FIELD-NOTES）
```

宿主 `inject: ['storage','storageDomain','agents','agentDefaultModel','sessions','tools']`。

## 实测结论

- ✅ **command 任务**：create → run_now → 30ms exit 0，副作用文件真实写入（/tmp 验证）
- ✅ **agent 任务（进程内）**：轻任务 11s 返回全文；**工具栈完整实证**——agent 直接用 bash 工具执行命令并回传输出（9.7s，无需任何自救）
- ✅ 运行记录带 sessionId（可溯源持久化会话）、状态/exitCode/耗时齐全；模型还能主动提醒"常驻任务需清理"
- ✅ 安全：spawn 参数数组（无 shell 拼接）、零外联零 eval；agent 走 dsh-headless 官方配方（直接 import @deepseek-ai/dsh-agent 等宿主包）
- ⚠ F14 命中（本批第二次复现，泛化验证）：headless 直装挂 `waiting for services: storage, storageDomain`，三行 patch 补链即活

## 与 chicheng-cron 横向对比（晨报管线选型依据）

| 维度 | chicheng-cron | dsh-cron |
|---|---|---|
| 任务类型 | 5 种（shell/python/node/skill/agent） | 2 种（agent/command） |
| agent 实现 | 内部起 agent，**工具未直接注册**（combo3 实测：被迫自救换 CLI，544s） | **进程内完整工具栈**（bash 直调，9.7s） |
| 管理面 | web 侧边栏 UI + HTTP API | 7 个模型工具（对话内自治） |
| 宿主 | web-only（webServer/webRuntime） | headless 可用（F14 补链后） |
| 推送 | pushEnabled 直连 chicheng-push ✅ | 无内建推送（可用 agent prompt 里 curl ntfy 替代） |

**选型结论**：管线含工具型步骤（gavel 审查等）→ **dsh-cron**（agent 工具栈完整、快 50 倍）；管线重点是"结果推手机"+ 人工 UI 配置 → **chicheng-cron**。两者可共存互补。

## 坑与修复

- npm 版本滞后陷阱（0.1.0 vs 0.9.8，F4 变体）——只认 GitHub 源
- headless 必须 F14 补链；直接装进 web profile 则天然满足
- 无内建推送出口（对比 chicheng-cron 的短板）

## 来源

- GitHub squirrel20/dsh-cron 0.9.8 · 实测证据：/tmp/gr-e2e/dcron-e2e.log（双类型）、dcron-tool.log（工具栈对比）
