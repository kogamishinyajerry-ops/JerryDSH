# dsh-advisor（旁挂 reviewer）

**分类** agent · **评分** ★★★★ · **实测** 2026-08-22 · dsh 0.1.1-rc.2

每会话一个独立 reviewer 模型：观察主 transcript、逐 turn 评审、按严重度（nit/concern/blocker）注入建议——自我边界完整（emission guard / immuneTurns 冷却 / 失败策略），绝不污染主循环。npm 周下载 2.1k。

## 安装

```sh
dsh plugin --profile web add dsh-advisor
# ~/.dsh/settings.yaml 加（provider+model 必填）：
# advisor:
#   enabled: true
#   provider: zai-coding-cn
#   model: glm-5.3        # 或更便宜的 flash 档
#   immuneTurns: 3
```

## 实测结论

- ✅ 加载 → 观察回合 → reviewer 运行 → 判定 "Nothing to add (nit)" → **emission guard 压制**（README 承诺的边界行为实证）
- ✅ Web 端有 Settings → 插件配置 → Advisor 卡；TUI 端有 /advisor 命令
- ⚠ 对 glm-5.3 打 `thinking-off unavailable` 诊断噪音（该模型不宣传 thinking-off）——仅日志，不影响功能

## 坑与修复

- 配置走**共享 settings.yaml**（所有 profile 生效）；advisor 的 reviewer 调用消耗所选 provider 的额度
- `immuneTurns` 默认 3——短会话可能看不到任何建议输出（这是特性不是 bug）

## 适用

长任务/高风险任务的第二双眼睛——"谁写另一方审"工作流的自动化版本。

## 来源

- npm `dsh-advisor` 0.2.4 · 实测细节 [research/01](../../research/01-updates-and-top-plugins.md)
