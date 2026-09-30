# @struktoai/mirage-dsh（统一虚拟文件系统）

**分类** capability · **评分** ★★★☆（早期但方向独特）· **实测** 2026-08-22 · dsh 0.1.1-rc.2

接管 dsh 的 fs/shell 两条能力缝：把 S3 / Slack / Redis / Gmail / Notion / Postgres / RAM 挂载成 agent 的文件世界。母项目 strukto-ai/mirage 3.5k★。

## 安装

```sh
dsh plugin --profile <独立profile> add @struktoai/mirage-dsh
# 注意：patch 会禁用 host 的 fs-sandbox/bash-sandbox/pwsh/tool-fs-search 行——
# 别混装进日常 profile，单独建一个
```

## 实测结论（RAM 挂载 /tmp, mode:exec）

- ✅ bash 工具在 VFS 里 `echo mirage-ok > /tmp/m.txt && cat /tmp/m.txt` → 正确输出
- ✅ 文件读取工具读 VFS 的 /tmp/m.txt → 内容一致
- ✅ 细节：read-only 权限模式下挂载 grant 自动收窄只读；宿主 cwd 在 VFS 不存在时正确忽略

## 坑与修复

- 0.0.1 早期；peer 依赖 pin 旧版 dsh-fs/dsh-shell（0.0.1-rc.x），实测与 0.1.1-rc.2 组合无碍
- 真实资源挂载（Slack/Redis/…）需各自凭证，未测
- 配置写在 profile patch：`{ id: mirage, config: { mounts: { "/tmp": { resource: ram, mode: exec } } } }`

## 适用

"agent 的世界不止本地磁盘"的场景探索——比如把团队 Slack 频道、Redis 队列直接挂成 agent 可读写的目录树。生产采用等版本成熟。

## 来源

- npm `@struktoai/mirage-dsh` 0.0.1 · [GitHub strukto-ai/mirage](https://github.com/strukto-ai/mirage) · 实测细节 [research/03](../../research/03-capability-plugins.md)
