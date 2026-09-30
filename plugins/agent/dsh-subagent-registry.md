# @aiwayds/dsh-subagent-registry（自定义 agent 注册器）

**分类** agent · **评分** ★★★★ · **实测** 2026-08-22 · dsh 0.1.1-rc.2

把 `~/.dsh/agents/*.md` 定义的自定义 agent 注册为可按名调用的 subagent（`use_agent` 工具）：每个 agent 独立 persona，跑在 dsh 原生 spawn provider 上；中断后下次调用**从断点续跑**（resume: auto）。

## 安装

```sh
dsh plugin --profile web add @aiwayds/dsh-subagent-registry
```

## 实测结论

- ✅ `use_agent('echo-poet')` → 真实 subagent 以独立 persona 运行并返回结果（对联测试通过）
- ✅ 错误传播透明：frontmatter 格式错时返回明确错误信息（`missing frontmatter (file must start with ---)`），不吞错
- ✅ 配置：`agentsDir`（默认 ~/.dsh/agents）、`toolName`（默认 use_agent）、`resume: auto|opt-in|off`、frontmatter 可指定 `model`（provider/model 路由）和推理档

## 坑与修复

- ⚠ frontmatter **必须 `---` 围栏**（"loose key: value" 裸写不被接受——实测踩过）
- agent 文件在调用时重读——改 persona 即时生效

## 适用

你的专属 agent 军团入口：把领域专家（如"适航条款审查员"、"CFD 前处理助手"）写成 md 文件即插即用。

## 来源

- npm `@aiwayds/dsh-subagent-registry` 0.3.0 · 实测细节 [research/01](../../research/01-updates-and-top-plugins.md)
