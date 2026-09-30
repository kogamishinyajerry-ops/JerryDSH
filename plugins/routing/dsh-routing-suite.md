# dsh-routing-suite（inspect-first 路由中间件）

**分类** routing · **评分** ★★★★ · **评测** 2026-08-20 · 已在你的 web profile 日常服役

会话消息进模型前的"先检查还是先动手"路由：通过 `system-prompt/assemble` 中间件注入检查优先/直接执行的引导。43 例标注数据集对比评测：plugin-auto **78.4%** vs always-inspect 59.5% / 随机 45.9% / always-direct 40.5%。

## 安装

```sh
dsh plugin --profile web add dsh-routing-suite   # 你已装（web profile bundles 在列）
```

## 评测结论（research/routing-suite-eval 全量证据）

- ✅ 插件本体显著优于三个基线臂；对抗否定组（"不要修复，直接重写"）和混合任务组有专门标注覆盖
- 评测资产可复跑：`research/routing-suite-eval/{cases,eval,probe,smoke}.mjs` + `results.json`
- 评测方式：mock ctx 捕获中间件，走**真实安装产物**的完整代码路径（事件解析→门控→分类→注入）

## 坑与修复

- 混淆矩阵残差：inspect→direct 误判 4 例、direct→inspect 3 例（详见评测报告混淆矩阵与分组分析）
- 与其他 system-prompt 中间件共存时注意注入顺序（patch 层序决定）

## 来源

- npm `dsh-routing-suite` 0.1.2（周下载 4.2k）· 完整评测 [research/routing-suite-eval/REPORT.md](../../research/routing-suite-eval/REPORT.md)
