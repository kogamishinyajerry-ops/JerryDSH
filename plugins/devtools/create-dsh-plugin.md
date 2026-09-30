# create-dsh-plugin（插件脚手架）

**分类** devtools · **评分** ★★★☆（模板 ★★★★ / CLI 交互 ★★）· **实测** 2026-08-22

官方生态的插件脚手架：tool / events / webui 三模板，`{{占位符}}` 工程化完整。**模板注释里的避坑密度是全生态最高的入门教材**。

## 使用

```sh
npx -y create-dsh-plugin my-plugin   # 交互式（人工终端）
```

## 实测结论

- ✅ tool 模板埋了 5 条实战坑警示，全部与本工作区实测互证：
  1. `@deepseek-ai/dsh-tools` 的 npm latest tag 过期（钉死 next）——Round1 实测踩中
  2. `ctx.tools.register()` 是 effect、自动挂 fiber、卸载自动反注册
  3. 加载顺序 = 服务依赖（inject），永远不是文件顺序
  4. 纯 ESM，cordis 只作类型源
  5. object output schema 必须显式 `additionalProperties`
- ⚠ **CLI 交互缺陷**：非 TTY 环境（管道/CI/自动化）下 clack 提问循环读不到 stdin，无法无人值守 scaffold——人工终端正常

## 适用

写新插件的起点。非交互场景直接复制模板目录手填占位符（tarball 解包即可，`npm pack create-dsh-plugin`）。

## 来源

- npm `create-dsh-plugin` 0.1.1 · 评测细节 [research/04](../../research/04-ecosystem-survey.md)
