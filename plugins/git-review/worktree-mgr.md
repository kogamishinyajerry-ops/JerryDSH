# worktree-mgr（任务级 worktree 生命周期）

**分类** git-review · **评分** ★★★ · **实测** 2026-08-22 · dsh 0.1.1-rc.2 · **需修复才能用**

为任务自动创建隔离 git worktree（分支 `wtm/<task>`），管理 begin/merge/finish/status/purge 全生命周期；支持 `.wtm.json` 仓库级配置与 on_begin/on_finish 触发器；自带等价 CLI（bin/wtm.js）。repo：JohnXu22786/worktree-mgr。

## 安装

```sh
dsh plugin --profile <name> add github:JohnXu22786/worktree-mgr   # npm 404，仅 GitHub 源
# bundles 补 "@deepseek-ai/dsh-headless"
# 然后必须做两个本地修复（见坑），修复后工具层可用
```

## 实测结论

- ✅ **核心逻辑与 CLI 全生命周期绿**：begin（wtm/demo-task + 分支派生）→ worktree 内 commit → status（ahead/behind 与 git rev-list 核对一致）→ merge（合并提交）→ finish（worktree 移除+分支删除），主分支终态内容完整
- ❌ **dsh 工具层出厂即坏**（两个上游 bug，见坑），修复前带参工具全部不可用
- ✅ 修复后 `wtm_begin` 工具带参调用成功（probe3-task 创建成功）
- ✅ dump-config：`root: !!js process.cwd()` 动态默认正常

## 坑与修复（两个上游 bug，本地修复法）

1. **boot 硬崩**：output schema 的 boolean 属性写了 `required: true`（JSON Schema 非法——required 是父级数组）→ dsh 严格校验 `UNSUPPORTED_SCHEMA` 直接 boot 失败。修复：`sed -i '' "s/{ type: 'boolean', required: true }/{ type: 'boolean' }/g" src/tools.js`（5 处；string 参数上的 `required: true` 是 dsh 扁平表合法约定，别删）
2. **带参工具全废**：裸对象 `ctx.tools.register()` 没过 `defineTool` 编译 → 模型收到原始扁平 parameters（无 type:'object'/properties 包装）→ 模型侧工具变无参 → tool-call arguments 恒空 `{}`，工具报"缺少 task 参数"，模型反复重试全空（transcript 实证）。修复：src/tools.js 顶部加 `import { defineTool } from '@deepseek-ai/dsh-tools'`，末尾 `return tools.map((t) => defineTool(t))`
3. **vault 默认路径越沙箱**：默认 `~/.local/share/wtm` 在 headless 文件沙箱下 EPERM → `WTM_VAULT=<可写路径>` 或插件 config `vault` 重定向
4. **触发器 = 任意命令执行**：`.wtm.json` 的 on_begin 等走 `sh -c`——**不受信 repo 里跑 wtm_begin 等于执行其任意命令**（类 git hooks 信任模型），只在自己/受信仓库启用

## 适用

并行任务隔离开发的自动化 worktree 管家；上游修复 schema 与 defineTool 后可直接上调评分（核心 ops/git 层质量好）。

## 来源

- GitHub JohnXu22786/worktree-mgr 0.1.0 · 实测证据：/tmp/gr-e2e/wtm-e2e2.log（CLI 全周期）、wtm-begin2.log（丢参实证）、wtm-begin3.log（修复后）
