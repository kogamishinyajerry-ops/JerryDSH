# dsh-turn-rewind（对话+工作区状态回退）

**分类** sessions · **评分** ★★★★☆ · **实测** 2026-08-23 · dsh 0.1.1-rc.2

持久化 Change Ledger：每 turn 首步前自动 checkpoint 工程文件，支持带 confirmation 门禁的精确恢复计划、恢复前自动建 rescue 点（恢复本身可再撤销）。以 `changeLedger` cordis 服务暴露给其他插件复用。repo：Anionex/dsh-turn-rewind（**99★，本分类头部**）。

## 安装

```sh
dsh plugin --profile <name> add @anionex/dsh-turn-rewind   # npm 0.1.1（repo 已 0.1.2，轻微滞后）
# 新建 profile 记得补终端 bundle（FIELD-NOTES F1）
# storageDir 默认 ~/.dsh/change-ledger/v1（全局）；隔离/定制用 profile patch：
#   - id: turn-rewind
#     config: { storageDir: /your/path }
```

双路径注入：核心 `agents`（headless 即生效，自动捕获）+ 增强 `webServer/sessions/sessionQuery/apiProxy/agents`（web UI 的 HTTP 恢复接口）。

## 实测结论

- ✅ **dsh 集成层**：headless 会话（write+edit 双操作）→ storage 自动落盘 turn checkpoint（manifest 记录 pre-turn 树：文件清单/blob/mode/git HEAD/turn/seq，与事实逐一吻合）
- ✅ **引擎层全闭环**（driver 直调 ChangeLedgerEngine）：`list` → `planRestore`（产出精确 diff：base.txt modified + new-file.txt added，配 8 位 confirmation 码与过期时间）→ `applyRestore`（confirmation+sessionId 双门禁）→ **文件状态精确回退**（base.txt 复原、new-file.txt 消失、git status 干净）
- ✅ **恢复可再撤销**：applyRestore 前自动创建 rescue 点（含"被回退的未来"），实测可从 rescue 再计划恢复
- ✅ **防呆守卫**：错误 confirmation → `CONFIRMATION_MISMATCH` 拒绝（实测）
- ⚠ web UI 回退面板未实测（client.js 为 web 端注入；HTTP handler 源码已读）
- ✅ 安全：git 调用全走 `execFile` 参数数组（无 shell）；唯一 URL `http://dsh.local` 仅作 URL 解析基；零依赖零外联

## 坑与修复

- npm 版本滞后（0.1.1 vs repo 0.1.2），未见行为差异
- headless 形态只捕获不恢复（设计使然：恢复入口在 web UI / 服务 API）——headless 用户的价值是账本数据+服务复用
- storageDir 与工作区重叠会被 `STATE_WORKSPACE_OVERLAP` 拒绝（好设计，防自毁）

## 适用

补齐 dsh-undo 缺的**文件快照**半边：会话消息回滚（dsh-undo）+ 工作区状态回退（本件）= 完整后悔药。生产 web profile 值得常驻。

## 来源

- npm `@anionex/dsh-turn-rewind` 0.1.1 · GitHub Anionex/dsh-turn-rewind · 实测证据：/tmp/gr-e2e/rw-e2e.log、rw-driver.mjs 输出、storage manifest（/tmp/gr-e2e/change-ledger）
