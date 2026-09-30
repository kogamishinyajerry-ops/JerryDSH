# dsh-session-recovery（会话灾难恢复工具集）

**分类** sessions · **评分** ★★ · **实测** 2026-08-23 · dsh 0.1.1-rc.2 · **与当前会话格式不兼容（一行补丁可救）**

从原始磁盘恢复被删/损坏的会话与记忆库（zstd 帧魔数扫描 + SQLite .recover），重建官方格式 session.jsonl.zstd 并修复 resume 校验（seq 重排/孤儿 tool 结果/无效 splice）。CLI 工具集 + web 的 /session-repair 命令。repo：Coprexist/dsh-session-recovery（作者自述实战验证）。

## 安装

```sh
dsh plugin --profile <name> add github:Coprexist/dsh-session-recovery   # npm 404，仅 GitHub 源
# 新建 profile 补终端 bundle（F1）；CLI 直接 node scripts/<tool>.js 使用
```

## 实测结论

- ✅ boot/激活正常（inject `['commands']`，headless 无从触发斜杠命令，web 命令未测）
- ❌ **CLI 对当前 rc.2 会话格式解析 0 事件**（核心失效）：repair-session.js 假设"一帧=一行+校验和"的旧格式；当前格式是**流式多帧 zstd、帧界与行界无关**（43KB 会话 70 帧交叉验证，整流解压才是合法 JSONL）——逐帧当行必然全解析失败，"修复"产物为空文件（有 .bak 备份，安全设计成立）
- ✅ **一行补丁可救**（实测验证）：decodeFrames 改为"拼接全部帧输出再按 \n 切行"后，干净会话正确解析（4 消息/4 surface 节点/0 折叠问题）；截断会话修复管线全通——从撕裂文件恢复出 7 事件合法前缀（seq 连续 0-5、re-decode OK）
- ○ raw-disk 路径（scan-zstd/recover-memory）需 root+块设备，macOS/APFS 未测
- ✅ 安全：只读源+显式输出目录，绝不写原盘（设计层面）；代码零网络零 exec

## 坑与修复

- 格式不兼容根因与 05 §6 凭证格式换代同类：**dsh 会话格式演进把工具甩下**（作者 8-18 验证过，大概率针对更早格式）
- 补丁已验证（/tmp/gr-e2e/rec-patch/lib/repair.js），上游 PR 材料：decodeFrames 逐帧 join + split
- 另注意：Node `zlib.zstdDecompressSync` 对多帧文件**只解首帧**——校验会话文件要用 `zstd -dc` CLI 或逐帧循环（FIELD-NOTES F12）

## 适用

误删会话/记忆库的最后手段；等上游（或自行打补丁）适配当前格式后才有实效。判定"格式换代受害者"，暂不装机。

## 来源

- GitHub Coprexist/dsh-session-recovery 0.1.2 · 实测证据：/tmp/gr-e2e/rec-demo/（good/torn/repaired 三代文件 + 补丁版输出）
