# JerryDSH — DSH 研究与插件精选工作区

两个核心目录：

## 📦 [plugins/](plugins/) — 实测高价值插件精选

31 件本机实测通过的插件卡片（评分 / 安装命令 / 实测证据 / 坑与修复），按分类组织：
`vision/` `capability/` `sessions/` `automation/` `agent/` `ecosystem/` `routing/` `devtools/` `git-review/` `presentation/`
→ 入口：[plugins/README.md](plugins/README.md)（速查总表 + 一键装机命令 + 兼容性矩阵）
→ 机制新发现：[plugins/FIELD-NOTES.md](plugins/FIELD-NOTES.md)（05 之后的累积台账）
→ 组合最佳实践：[plugins/COMBOS.md](plugins/COMBOS.md)（实测管线 + 设计模式）

## 🔬 [research/](research/) — DSH 技术研究分析

- [01](research/01-updates-and-top-plugins.md) 更新时间线 + 头部插件 + rc.5 冷启动崩溃根因
- [02](research/02-vision-deep-dive.md) 视觉插件双路线深测
- [03](research/03-capability-plugins.md) 能力四件套（MCP/记忆/浏览器/VFS）
- [04](research/04-ecosystem-survey.md) 生态 20 分类全景评测
- [05](research/05-mechanics-notes.md) **机制研究**（patch 层/凭证格式/dist-tag/pnpm 构建/web-only 模式——装写调插件前必读）
- [06](research/06-update-tracker.md) **版本追踪**（常驻：三步核查法 + rc.5→rc.2 基线）
- [07](research/07-session-foundation.md) **会话底座**（持久化/投影缓存/compaction/session-query）
- [08](research/08-security-model.md) **安全模型**（沙箱/审批/MCP/插件权限 + 生产配置矩阵）
- [09](research/09-agent-loop-core.md) **Agent 循环核心**（轮次/步骤/inbox/工具流水线/取消拦截）
- [10](research/10-llm-assembly-streaming.md) **LLM 装配与流式**（提示词组装/KV cache 纪律/chunk 流/重试/计量）
- [11](research/11-subagent-system.md) **Subagent 体系**（委派/提供方族/可继续子代理/Agent Teams）
- [科普版](research/dsh-explained.html) 全景 HTML 报告（中学生可读，浏览器直接打开）
- [routing-suite-eval/](research/routing-suite-eval/) dsh-routing-suite 43 例对比评测（可复跑）
→ 索引：[research/README.md](research/README.md)（含 8 个测试 profile 的处置建议）

---

**环境基线**：dsh 0.2.0-rc.2（npm `latest`，09-30 升级，隐私上报已全 profile 禁用）· 5 profile（web/headless/fr-guard/comac-demo×2）· 桌面版 Kun 0.3.10（第三方，与 dsh 无关）· 主路由 zai GLM Coding Plan（coding 端点，glm-5.3 主力 + glm-4.7 自动化档，见 research/06 §3.13）
**评测方法**：隔离 profile（~/.dsh/profiles/）→ 源码安全审查 → dump-config 组合验证 → headless/web E2E → 证据落盘。活 web profile、活 settings、活凭证全程零改动。
**数据日期**：2026-09-18（生态榜单为 08-22 快照，会过期）
