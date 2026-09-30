# dshmarket（Settings 内置插件市场）

**分类** ecosystem · **评分** ★★★★ · **实测** 2026-08-22 · dsh 0.1.1-rc.2

awesome 官方推荐的市场：Settings → Plugin Market 浏览/搜索/一键安装 1550+ 社区插件 + 一键主题切换（热切换免重启）。客户端注入型插件。

## 安装

```sh
dsh plugin --profile web add dshmarket
dsh web   # 重启后 Settings → Plugin Market
```

## 实测结论

- ✅ 组合 + 宿主 boot + HTTP 200
- ✅ 客户端下发实证：`/plugins/dshmarket/client.js` 返回 373KB 模块（`__ModuleLoader__` 桥、20 处市场标识）
- ⚠ UI 点击流未实测（需真人浏览器）；要求 dsh ≥ 0.1.0-rc.6（旧宿主自禁用并在 console 说明）

## 坑与修复

- 市场行为（浏览 awesome-dsh-plugin.com 目录、按 npm spec 装包）会跑 pnpm + 访问外网——预期行为，源码审查未见越界
- 主题互斥切换，卸载即还原

## 适用

不想记 npm 包名的图形化装机入口；和 dsh-find-plugin 互补（一个 GUI 浏览、一个 agent 内搜索）。

## 来源

- npm `dshmarket` 1.18.0 · [GitHub dsh-market/dsh-market](https://github.com/dsh-market/dsh-market) · 实测细节 [research/01](../../research/01-updates-and-top-plugins.md)
