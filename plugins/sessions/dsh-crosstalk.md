# dsh-crosstalk（跨会话消息）

**分类** sessions · **评分** ★★★☆ · **实测** 2026-08-23 · dsh 0.1.1-rc.2 · **须手动构建（当前无官方可用安装路径）**

机器上任意 dsh 会话互相发现与通信：文件心跳注册表（无 daemon）+ 每会话收件箱 + InboxWatcher 把消息 relay 注入对方下一 turn；以可逆 shadow 装饰原生 `list_agents`/`send_message`（新增 peers/all 作用域与 peer 寻址，卸载即还原）。repo：Jesse-njx/dsh-crosstalk。

## 安装（当前必须手动构建）

```sh
# ⚠ GitHub 源直装即坏：package.json files 列了 lib/ 但 repo 从未提交构建产物，
#   npm 又从未发布（@dsh-crosstalk/bundle 404）→ 无任何官方安装路径（FIELD-NOTES F10）
git clone https://github.com/Jesse-njx/dsh-crosstalk /tmp/ct && cd /tmp/ct
npm i -D typescript && npx tsc -p tsconfig.json   # 在仓外构建！
dsh plugin --profile <name> add github:Jesse-njx/dsh-crosstalk
cp -R /tmp/ct/lib ~/.dsh/profiles/<name>/node_modules/@dsh-crosstalk/bundle/lib
# 注册表默认 ~/.dsh/crosstalk；隔离用 patch：- id: crosstalk config: { homeDir: /your/path }
```

## 实测结论（真实双并发会话）

- ✅ 会话 A 存活期心跳落盘（自动命名 `talk-demo-beige`：cwd 派生+颜色词，含 status/pid/uid/heartbeatAt）
- ✅ 会话 B `list_agents(scope=peers)` 精确发现 A（名字/状态/cwd 全对）
- ✅ B `send_message` 返回 queued → **A 的 transcript 出现 `agent/inbox/spliced` relay 事件**（含发送方身份、摘要、原文"hello from B"，source.kind=crosstalk）——收件箱文件被 watcher 即时消费（查目录为空是消费后的正常态）
- ✅ 装饰可逆 + stock 缺失时清晰报错（不静默）；stale/dead 判定在 send 路径（源码）
- ✅ 安全：零 child_process、零网络、零 eval；defineTool 正确使用（无 F2/F3 坑）
- ✅ config：homeDir 可重定向（实测隔离）、open/allowlist 模式、same-user 接受策略

## 坑与修复

- **安装路径全断**（见上）——本质是作者发布流程 bug：`prepublishOnly` 构建 lib 但没发过 npm；GitHub 打包又按 files 字段裁掉 src
- 我第一轮在 profile 包目录里跑 `npm install typescript`（ERESOLVE 失败）**毒化了整个 profile**：npm 沿目录树向上把 registry 版 @deepseek-ai/* 副本写进 profile node_modules → shadow 掉 dsh 安装内解析 → dsh-tools 的调度器 Symbol 双实例不相认 → 一切工具调用崩 `reading 'prepare'`（FIELD-NOTES F11，机制级教训：构建修复永远在仓外做）

## 适用

长任务跨会话协作（"让另一个会话的 agent 接手/传话"）；上游修好安装路径后可上调评分。

## 来源

- GitHub Jesse-njx/dsh-crosstalk（repo HEAD）· 实测证据：/tmp/gr-e2e/talk2-{A,B}.log、/tmp/gr-e2e/ct-home/registry/、A 会话 transcript 的 crosstalk relay 事件
