# dsh-ssh-ops（SSH 运维 + 数据库工作台）

**分类** capability · **评分** ★★★★ · **实测** 2026-08-23 · dsh 0.1.1-rc.2 · **headless 需补 storageDomain 服务链**

27 工具的运维面板：SSH（connect/exec/read/write/disconnect/cluster）+ SFTP（list/read/mkdir/rename，**delete 永不直执行**）+ 六库数据库（MySQL/PG/Redis/Mongo 等 db_*）+ 右侧 xterm 终端（web 端）。高危命令（mkfs/dd/reboot/shutdown…）进人审确认队列。repo：caoyiwei850/dsh-ssh-ops。

## 安装

```sh
dsh plugin --profile <name> add dsh-ssh-ops          # npm 0.2.13
# ⚠ 两个必做修复：
# 1) pnpm 构建拦截（05 §5）：package.json 加 "pnpm": {"onlyBuiltDependencies": ["ssh2"]} 后 pnpm rebuild ssh2
# 2) headless 需 storageDomain 服务（dsh-base/headless 不带）——profile 用户层 patch 补服务链
#    （storage → storage-json → storage-domain 三行，照抄 dsh-web-app 的挂载，见 FIELD-NOTES F14）
#    或直接装进含 dsh-web-app 的 profile
```

宿主 `inject: ["tools","storageDomain","credentials"]`。

## 实测结论（本地 sshd 真实链路）

- ✅ **SSH 全链路 E2E**（本机 2222 端口用户态 sshd + ed25519 密钥）：connect（key 认证成功，返回连接 id）→ exec（`echo ssh-e2e-ok && uname -s` 输出 `ssh-e2e-ok`/`Darwin`）→ disconnect，三步原文回传
- ✅ ssh2 原生 binding rebuild 后稳定（05 §5 对策复验）
- ✅ 防护面（源码级）：高危命令正则族（格式化磁盘/重启关机等）→ pendingConfirmations 人审队列；sftp_delete 只生成 `rm -rf` 进面板待确认队列/可复制命令
- ❌ **连接失败崩进程**：ssh 到不通的端口 → ssh2 Client 的 error 事件未被捕获 → **整个 dsh 进程崩**（Unhandled 'error' event，双路径复现：坏 sshd + 复位阶段）——健壮性硬伤，生产慎用不稳定目标
- ○ db_* 六库工具未实测（无目标库）；web 右侧终端面板未实测（headless 无 UI）

## 坑与修复

- **storageDomain 依赖是隐性的**（README 未提）——headless 直装 boot 挂 `waiting for service: storageDomain`；且把 `@deepseek-ai/dsh-storage-domain` 塞 bundles 会报 "declares no dsh.bundle"（它是库不是 bundle）——正确解法是用户层 patch 插行（F14 新机制）
- 崩溃 bug 复现路径：connect 超时/拒绝 → 进程死。绕法：先确保目标可达（nc 探测）再 connect；已可向上游报 issue

## 适用

日常运维（多服务器批查/日志拉取/服务重启带确认）+ DB 巡检，一台机器同时管 SSH 与数据库是独特卖点；等上游修 unhandled error 后可上调。

## 来源

- npm `dsh-ssh-ops` 0.2.13 · 实测证据：/tmp/gr-e2e/ssh-e2e3.log（成功链）、ssh-e2e2.log（崩溃现场）、/tmp/gr-e2e/ssh-test/（sshd 环境）
