# dsh-find-plugin（agent 内找插件）

**分类** ecosystem · **评分** ★★★★★ · **实测** 2026-08-22 · dsh 0.1.1-rc.2

插件生态的"装机必备第一件"：模型按需调用 `find_dsh_plugin`，实时搜 GitHub `dsh-plugin` topic，按 star 返回结果+一句话描述+安装命令。**npm 周下载第一（10.5k）**。

## 安装

```sh
dsh plugin --profile web add dsh-find-plugin   # 装完重启 dsh web，零配置
```

## 实测结论

- ✅ headless 会话提问 → 模型自主调用工具 → 返回真实 GitHub 结果（pomodoro 搜索 3 条，含星数/描述/链接）
- ✅ 工具输出自带第三方代码风险提示（"review the source and pin a commit before installing"）
- ✅ 零依赖、源码审查干净（无外联除 GitHub API）

## 坑与修复

- 无硬坑。注意它搜的是 GitHub topic——没打 topic 的插件（如部分 npm-only 包）搜不到

## 适用

所有 profile 都值得装：之后"有没有 XX 插件"直接问 agent。

## 来源

- npm `dsh-find-plugin` 0.3.7 · [GitHub awesome-dsh-plugin/dsh-find-plugin](https://github.com/awesome-dsh-plugin/dsh-find-plugin) · 实测细节 [research/01](../../research/01-updates-and-top-plugins.md)
