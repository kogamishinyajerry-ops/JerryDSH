# hub — 内网离线自托管团队协作中枢

飞书 8.0 的内网离线对照实现：开源协作面 + DSH Agent 运行时思想，零 npm 依赖，纯 Node >= 22，单 JSON 文件持久化，断网全功能可用。

## 快速启动

```sh
cd hub
node server.js
# 打开 http://127.0.0.1:3210
```

初始账号：严冬杰/jerry、杨家兴/jiaxing、石浩裕/haoyu、刘华源/huayuan、窦欣/douxin、苏薪/suxin
初始密码：`dsh123456`（正式部署务必改 `lib/seed.js` 重新生成，或删 `data/` 重建）

## 功能（对标飞书 8.0 三层）

| 模块 | 对标 | 说明 |
|---|---|---|
| 频道消息 | 飞书群聊 | SSE 实时推送、@补全（人+智能体）、表情回应、未读角标 |
| 智能体 | 豆包工作伙伴 | 独立身份/记忆/工具，@名字唤起，流式输出，主动补位提醒 |
| 团队记忆 | 伙伴的共享记忆 | 按智能体分库，手动写入 + agent 自动积累 |
| 云文档 | 飞书文档 | 目录/编辑/自动保存（1.4s 防抖 + ⌘S），agent 可创建 |
| 多维表格 | 飞书多维表格 | 单元格直编、状态 pill、agent 建表写行 |
| 审批 | 飞书审批 | 提交/同意/驳回全留痕，agent 可发起 |
| 用量看板 | AI 用量管理 | Token 日曲线、配额进度、智能体调用排行 |
| 系统 | 管理面板 | 运行时状态、provider、离线口径 |

## Agent 推理通道（三选一，环境变量或改 data/hub.json 的 settings.model）

| provider | 配置 | 场景 |
|---|---|---|
| `mock:demo` | 默认 | 零依赖离线演示脑：周报/纪要/风险扫描/建表/审批/知识检索规则应答 |
| openai 兼容 | `HUB_LLM_BASE=http://内网vLLM或one-api/v1`（可选 `HUB_LLM_KEY`），model 设成实际模型名 | 内网真模型（vLLM / one-api / FastChat / Ollama 均可） |
| `dsh-cli:` | `DSH_CMD="dsh --profile xxx"`，model 设 `dsh-cli:dsh --profile xxx` | DSH 本体当大脑（飞书 CLI 思路的完全体） |

流式：openai 分支走 SSE 增量；dsh-cli 分支整段返回；mock 即时。

## 内网部署（Windows/Linux 服务器）

1. 目标机装 Node >= 22（复用 U 盘离线包流程）
2. 拷贝整个 `hub/` 目录（无需 npm install）
3. `set HUB_PORT=3210 && node server.js`（Windows）或 systemd/launchd 常驻
4. 局域网同事浏览器访问 `http://服务器IP:3210`

## 数据与运维

- 全部数据：`hub/data/hub.json`（原子写 + 30s 定期刷盘 + 损坏自动备份重建）
- 备份 = 复制这一个文件；迁移 = 拷走它
- 风险巡检：每 5 分钟扫任务表，过期未完成自动在群里发提醒（OpsWarden）
- 端口：`HUB_PORT`（默认 3210）

## 目录

```
hub/
  server.js        HTTP + REST + SSE + 静态托管
  lib/store.js     零依赖 JSON 原子写存储
  lib/seed.js      种子数据（FDE 团队/频道/智能体/文档/表格）
  lib/agent.js     三 provider Agent 运行时 + 工具循环
  lib/active.js    主动补位巡检循环
  public/          前端 SPA（原生 JS，无构建）
  data/hub.json    运行时数据（自动生成）
```

## 设计口径

轻主题单强调色（航空蓝 #1A56A8）、系统字体栈（PingFang SC 优先，离线零 CDN）、零 em-dash、语义化空态/加载态/错误态、reduced-motion 降级、响应式（<900px 折叠侧栏）。
