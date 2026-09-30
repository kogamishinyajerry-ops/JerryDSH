# dsh-paperlab（LaTeX 论文修订工作台）

**分类** presentation · **评分** ★★★☆ · **实测** 2026-08-23 · dsh 0.1.1-rc.2 · **需本机 LaTeX 工具链**

Overleaf 式论文修订闭环：读项目状态 → 按批注对源文件做逐字唯一匹配编辑 → 编译检查（latexmk，xelatex 自适应）→ 编译通过才 finish_revision（git 提交门禁）。repo：maple-pwn/paperlab。

## 安装

```sh
dsh plugin --profile <name> add github:maple-pwn/paperlab   # 包名 dsh-paperlab，npm 无此包
# 前置：latexmk + TeX 发行版（本机无 → 编译环节透明失败）
# 项目侧：git 仓 + paperlab.yaml（compileCommand: latexmk -pdf main.tex）
```

宿主 `inject: ["tools","systemPrompt","agents","agentDefaultModel","llm"]`，headless 可测。

## 实测结论

- ✅ `paperlab_read_state`：读出项目源文件/批注/编译状态（compileOk:false 初始）
- ✅ `paperlab_apply_edits`：逐字唯一匹配替换成功（appliedCount:1，磁盘验证 main.tex 已改），编辑失败模式为拒绝而非猜（找不到/不唯一即拒）
- ✅ `paperlab_compile_check` **透明失败**：`ok:false, tool:"latexmk-pdf", logTail:"spawn latexmk ENOENT"`——结构化回传缺引擎，不误报源码错误
- ✅ **门禁语义**：编译未过 → 模型正确地**不调用** finish_revision（改动留工作区未提交，git status 验证）——"编译不过不落账"的闭环设计成立
- ✅ 安全：execFile 参数数组（无 shell）；文件白名单后缀（.tex/.bib/.sty/.cls/.bst）+ 体积上限（单文件 400KB/总量 1.5MB）

## 坑与修复

- 本机无 LaTeX（pdflatex/tectonic 均无）→ 编译环未跑通；装 `brew install latexmk`（或 tectonic + 自定义 compileCommand）后可补全绿
- npm 无包（GitHub-only）；首装卡过一次（pnpm 拉取慢），重试即过
- 依赖较重（schemastery + agents/llm 服务面），与 gavel-review 类似走宿主 llm

## 适用

科研/技术报告的批注驱动修订自动化；有 LaTeX 环境的机器上是真生产线。日常工程文档（非 LaTeX）用 genui/office 路线。

## 来源

- GitHub maple-pwn/paperlab（v0.1.2）· 实测证据：/tmp/gr-e2e/paper-e2e.log、/tmp/gr-e2e/paper-demo/
