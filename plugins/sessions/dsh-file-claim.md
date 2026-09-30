# dsh-file-claim（并行会话文件占用保护）

**分类** sessions · **评分** ★★★★☆ · **实测** 2026-08-23 · dsh 0.1.1-rc.2

同一工作区多会话并行时的文件认领协议：写前 `claim_files` 独占，pre-execute 拦截他人认领路径上的 write/edit/bash 写目标，配心跳过期接管与三路合并待写区（pending_write/pending_apply）。repo：Nwflower/dsh-file-claim。

## 安装

```sh
dsh plugin --profile <name> add dsh-file-claim   # npm 0.1.7，零依赖
# 新建 profile 补终端 bundle（F1）；注册表落 <repoRoot>/.dsh-file-claim/registry.json（工作区本地）
# 可调 config：staleMs（默认2h）/ heartbeatMs（10min）/ guard（写守卫开关）
```

8 个模型工具（claim/release/who_claims/claim_status/pending_write/pending_apply/pending_show/pending_drop）+ 人类命令 /claim /release /claim-status + systemPrompt 协议注入。工具 schema 自建标准 JSON Schema（不走 defineTool 扁平表，避 F2 坑）。

## 实测结论（真实双并发会话）

- ✅ 会话 A `claim_files ["src.txt"]` → registry.json 落盘（session id/pid/note/时间戳齐全）
- ✅ 会话 B `who_claims` 正确报 A 占用；B `write src.txt` → **pre-execute 拦截**，结构化中文错误（占有人 session id + 三条出路：等 release / force 接管 / pending_write 合并），文件内容分毫未动
- ✅ A 进程退出后：registry 原始记录**残留**但 pid 已死 → C 会话 `who_claims` 判"无人占用"、直接接管成功——**惰性清理设计**（判活看 pid/心跳，非主动清档），不是 bug
- ✅ C：force 接管 → write → release 全链路绿，registry 清空
- ⚠ pending_write/pending_apply 三路合并路径未实测（代码已读，base 取 git HEAD）
- ✅ 安全：零 child_process、零网络、零 eval（扫描全空）

## 坑与修复

- bash/pwsh 写目标识别是启发式（重定向/显式写命令；引号字面量 fail-open 不视为写目标）——文档诚实标注，属已知边界
- guardCommit（拦他人认领路径上的 git commit）默认关，opt-in

## 适用

多会话/多 agent 并行改同一仓库的场景刚需；与 turn-rewind 互补（一个防冲突于前、一个能回退于后）。

## 来源

- npm `dsh-file-claim` 0.1.7 · GitHub Nwflower/dsh-file-claim · 实测证据：/tmp/gr-e2e/fc-{A,B,C}.log、fc-demo/.dsh-file-claim/registry.json 快照
