# free-vision-skill（全本地视觉）

**分类** vision · **评分** ★★★★ · **实测** 2026-08-22 · dsh 0.1.1-rc.2 + glm-5.3

macOS Vision Framework 驱动的全本地图片理解：OCR / 场景描述 / 表格提取。零依赖、零密钥、**图片不出本机**。

## 安装

```sh
dsh plugin --profile web add @niyongsheng/free-vision-skill
```

## 实测结论

- ✅ headless 会话内 glm-5.3 调 `ocr_image`：3 行英文/中英混排文字**逐字全对**（swift 渲染的已知真值测试卡）
- ✅ 工具面：`view_image`（场景/人脸/二维码/构图）+ `ocr_image`（`layout=true` 出表格+坐标）+ WebUI 粘贴转路径路由 `/fvs/images`（magic-byte 校验，loopback-only）
- 前提：macOS 11+ & Xcode CLT；首跑编译 swift ~5-10s（之后缓存）

## 坑与修复

- 无硬坑。`view_image` 场景描述未单独实测（与 OCR 同一 swift 管线，OCR 已证通路）
- 超时默认 120s，可在 profile patch 里按 id 覆盖：`{ id: free-vision-skill, config: { timeout: 120000 } }`

## 适用

隐私敏感图（截图含密钥/内部文档）的 OCR/识图首选——配合 modlens 构成"本地快读 + 云端深读"双轨。

## 来源

- npm `@niyongsheng/free-vision-skill` 0.3.1 · [GitHub 话题证据见 research/02](../../research/02-vision-deep-dive.md)
