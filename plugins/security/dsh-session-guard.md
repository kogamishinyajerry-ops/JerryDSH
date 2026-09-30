# dsh-session-guard（高峰自动会话闸门）

**分类** security/治理 · **评分** ★★★☆ · **实测** 2026-08-28 · dsh 0.1.1-rc.2 · **web-only**

峰谷治理：高峰时段（默认 09-12/14-18 Asia/Shanghai）自动暂停会话、低谷自动恢复、**周末模式无视峰谷畅跑**；`taskControl.pause/resume` 缺失时回退锁等待队列；状态徽标 + Settings 简单开关。repo：drscrewdriver/dsh-session-guard。

## 安装

```sh
dsh plugin --profile web add dsh-session-guard   # npm 0.1.1 = repo 版
```

宿主 `inject: ['agents','webServer','settings','timer','commands','goals']`（webServer 必须 → web-only）。

## 实测结论

- ✅ **判定核心全路径矩阵 7/7**（driver 直打纯函数 `shouldPause(settings, date)`）：早峰 pause / 午谷放行 / 早谷放行 / **周末畅跑** / enabled:false 短路 / **关周末模式后周六恢复暂停**（开关交互正确）/ 晚高峰 pause——含 UTC→上海时区换算
- ✅ **web 激活与实时计算**：`/session-guard/status` 返回当前真实相位（上海周五凌晨 → `off-peak`/`NORMAL`/weekend:false，与墙钟一致）；client.js 12.2KB 下发
- ✅ 安全：零 child_process/网络/eval（http://dsh.local 仅 URL 解析基）；设置解析 **fail-open**（任何失败静默降级默认配置，绝不崩）
- ○ 交互环（高峰期 GUI 会话真被暂停/恢复、状态徽标）未实测——需在峰时窗口内跑长会话观察

## 坑与修复

- 峰值判定是**墙钟驱动**的静态窗口（非真实 API 限流信号）——窗口配置要贴合自己 provider 的实际限流规律
- fail-open 设计：设置坏了静默用默认——排查行为异常时先查 settings 文件
- pauseMode: 'safe' 透传 taskControl——具体暂停语义取决于宿主 taskControl 服务

## 适用

GLM/DeepSeek 等**峰时限流明显**的 provider 用户：高峰自动挂起、低谷自动续跑、周末畅跑，配合 dsh-usage-plugin（用量观测）构成"观测+闸门"成本治理对。夜跑批任务用户也受益（默认窗口不动夜间）。

## 来源

- npm `dsh-session-guard` 0.1.1 · 实测证据：driver 判定矩阵（7 case）、/tmp/gr-e2e/guard-web.log、/session-guard/status 实时相位
