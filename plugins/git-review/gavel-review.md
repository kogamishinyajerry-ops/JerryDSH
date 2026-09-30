# gavel-review（多镜头对抗评审）

**分类** git-review · **评分** ★★★★★ · **实测** 2026-08-22 · dsh 0.1.1-rc.2

对抗式多视角代码审查：correctness / security / maintainability 三透镜并行扇出、确定性静态哨兵（tripwire）、跨视角合并去重、严重度定级（blocker→informational）、抑制规则与审查案卷；dsh 工具 + 独立 CLI 双模式。repo：JohnXu22786/adversarial-review。

## 安装

```sh
dsh plugin --profile <name> add gavel-review
# ⚠ dsh plugin add 新建的 profile 只有 base——必须手动在 package.json 的
#   dsh.profile.bundles 里补 "@deepseek-ai/dsh-headless"（或 web-app），否则 boot 无声挂起
```

宿主 `inject: ['tools', 'llm']`——llm 走宿主 `ctx.llm.stream`，**provider 默认继承当前 agent 的 provider**（config.provider 留空即可），凭证零暴露、零额外配置。

## 实测结论

- ✅ headless E2E（种子 repo：SQL 注入 + off-by-one + 深嵌套魔法数字）：3 透镜全跑，8 问题分级 **BLOCKER 1 / REQUIRED 3 / RECOMMENDED 2 / OPTIONAL 2**，种子全覆盖零漏报零误报，结论"未修 SQL 注入不建议合并"
- ✅ **跨视角合并去重实证**：SQL 注入被 security+correctness 双透镜独立命中 → 合并 1 条 blocker（transcript 双指纹）
- ✅ **429 限流自动重试**：两个透镜各重试一次仍完成（engine 韧性）
- ✅ 案卷落盘 `.gavel/docket.jsonl`：逐透镜记录 + fingerprint（供历史对照/抑制）
- ✅ dump-config 组合正确（lenses/deep/history/maxChars 等全量默认值）

## 坑与修复

- **npm 版本滞后**：npm `gavel-review` 0.1.0 可用，但 repo main 已迭代（npm 未同步）——装完比对 repo 版本
- **撞名包陷阱**：npm `adversarial-review` 是 voodootikigod 的同名无关 CLI，别装错；真包名 `gavel-review`
- 独立 CLI 模式自带 `execFileSync`（跑 `git diff`）+ 自行外联 api.deepseek.com（自配 key）；**dsh 插件路径零 child_process 零外联**（源码级确认）

## 适用

合并/提交前的 ship/no-ship 把关；"谁写另一方审"的自动化评审位。本分类工程完成度最高的一件。

## 来源

- npm `gavel-review` 0.1.0 · GitHub JohnXu22786/adversarial-review · 实测证据：/tmp/gr-e2e/gavel-e2e.log（会话 transcript：~/.dsh/sessions/--private-tmp-gr-e2e-gavel-demo--）
