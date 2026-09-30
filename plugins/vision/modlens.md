# modlens（外挂 VLM 视觉引擎）

**分类** vision · **评分** ★★★★★ · **实测** 2026-08-22 · dsh 0.1.1-rc.2 + glm-5.3

给文本-only 模型（DeepSeek-V4 / GLM 旗舰）外挂视觉引擎的最强方案：粘贴图直读、结构化证据（布局/阅读顺序/OCR/不确定性标注）、10 路引擎 failover。GitHub 3.5k★。

## 安装

```sh
dsh plugin --profile web add @liustack/modlens
# 引擎 pin（本机实测最优）：
~/.dsh/profiles/visiontest/node_modules/.bin/modlens config set provider kimi-cli
```

## 实测结论

- ✅ 会话内 `modlens_read_image`：测试卡 3 行转写全对，带不确定性标注
- ✅ CLI 直读（`modlens analyze -i card.png -p kimi-cli`）：结构化 JSON——OCR 全对 + 布局区域 + 阅读顺序 + 摘要（连"底行贴边被裁切"都读出来了）
- ✅ `modlens doctor`：纯离线诊断，自动发现本机可骑乘引擎（实测发现 kimi-cli / claude-cli）
- ✅ WebUI 集成：自动给文本-only 路由加 `(modlens vision)` 选择器入口（运行时特性，浏览器内生效）

## 坑与修复

- ⚠ **claude-cli 引擎路径本机挂起**（180s 无输出；claude CLI 已登录）。对策：`modlens config set provider kimi-cli`（写入 `~/.modlens/config.json`）
- 想要 5-10s/读：免费 Gemini key（aistudio.google.com）→ `modlens config set gemini-api.apiKey`（隐藏输入）
- 引擎顺序：fast API 先行、agent CLI 兜底，`meta.attempts` 记录每次尝试不静默

## 适用

通用图像理解/复杂图/UI 截图分析。隐私图走 free-vision-skill。

## 来源

- npm `@liustack/modlens` 3.24.0 · [GitHub liustack/modlens](https://github.com/liustack/modlens)（3.5k★）· 实测细节 [research/02](../../research/02-vision-deep-dive.md)
