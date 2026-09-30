# chicheng-push（多渠道推送网关）

**分类** automation · **评分** ★★★★☆ · **实测** 2026-08-22 · dsh 0.1.1-rc.2

15 通道统一推送出口（Server酱/PushPlus/Bark/钉钉/企业微信/Telegram/飞书/ntfy/PushDeer/Gotify/webhook/邮件…），HTTP API + `pushNotifier` cordis 服务供其他插件复用。零依赖。

## 安装

```sh
dsh plugin --profile web add github:534119219/chicheng-push   # 未发 npm，走 github spec
```

## 实测结论

- ✅ **公网真实送达**：配 ntfy 沙盒通道 → `POST /push/api/send` → 订阅流收到完整消息（title+content+priority 全对）
- ✅ API 面：`/push/api/{list,types,save,remove,toggle,test,send}`
- ✅ 服务复用：chicheng-cron 的 `pushEnabled` 直接走它（同作者生态闭环）

## 坑与修复

- ⚠ **web-only**（`inject=["webServer","webRuntime"]`）——别装 headless
- ⚠ 渠道持久化在 `$DSH_HOME/push/channels.json`，**boot 时加载一次**——外部改文件要重启；正确路径是走 `/push/api/save` 或 Settings UI
- 各通道字段看源码 CHANNEL_TYPES 目录（Server酱需要 SendKey 等）

## 适用

所有自动化的"出口"：任务完成/审批请求/定时报告推手机。配合 chicheng-cron 是完整闭环。

## 来源

- [GitHub 534119219/chicheng-push](https://github.com/534119219/chicheng-push) 0.1.0 · 实测细节 [research/04](../../research/04-ecosystem-survey.md)
