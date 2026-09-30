# dsh-genui（聊天内交互组件/图表引擎）

**分类** presentation · **评分** ★★★★★ · **实测** 2026-08-23 · dsh 0.1.1-rc.2

让回复携带真正的 UI：`​```dsh-ui` fence 与 `render_ui` 工具输出白名单组件树（stat/progress/row/图表/表单/tab/3D），web 端内联渲染并支持交互回传（[genui-action] 事件环）；资产（echarts/mermaid/three 共 5MB）按需懒加载。repo：omdsh-dev/dsh-genui（**303★，本轮最高星**）。

## 安装

```sh
# ⚠ npm 无 @omdsh-dev/dsh-genui（404）——GitHub 源：
dsh plugin --profile web add github:omdsh-dev/dsh-genui
```

宿主 `inject: ["systemPrompt"]`（纯提示词注入+工具），headless/web 皆可装；渲染发生在 web 端。react 为依赖但宿主侧零原生构建。

## 实测结论

- ✅ **fence 路线**：headless 会话产出合法 dsh-ui fence（stat×3+progress 的构建健康度卡，JSON 一次成型）；systemPrompt 注入了完整 dsh-ui 词汇表教程（transcript 实证）
- ✅ **工具路线**：`render_ui` 调用成功——渲染器深度校验与修复 spec，返回"已渲染 UI「验收门」+ action 回传约定"；参数是标准 JSON Schema（无 F2 坑）
- ✅ **web 资产路由**（3192 端口实测）：client.js 153KB、echarts 1.0MB/mermaid 3.4MB/three 0.7MB 全部 200 懒加载
- ✅ 安全：宿主侧零 child_process/eval；源码有主动防线思维（CSS url() 外链追踪的消毒注释、fence 深度校验修复而非直接执行）

## 坑与修复

- npm 无包（GitHub-only，F4 又一例）；files 字段含已提交 lib，直装可用（无 F10 问题）
- 交互组件的 [genui-action] 回传环需真实浏览器点击，本轮未实测（headless 无 UI 面）
- fence/工具双入口语义分工：fence 进回复正文、render_ui 进工具行面板——卡片场景选后者

## 适用

**展示材料的主战力**：汇报卡、验收面板、数据仪表盘直接长在对话里；配合 chicheng-push 可推送结论卡。日常工程（构建报告/测试汇总）与展示两开花。

## 来源

- GitHub omdsh-dev/dsh-genui（repo HEAD 0.9.1）· 实测证据：/tmp/gr-e2e/genui-e2e.log、genui-render.log、3192 端口资产探测
