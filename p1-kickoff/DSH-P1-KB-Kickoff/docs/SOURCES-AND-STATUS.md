# 来源、实际核对与执行边界

## 用户指定的依据

`AGENT-HANDOFF-PROMPT.md`：P1 是约一万份 OA 文档的清洗、分类、embedding、检索；复用 kb-civair 模式；DeepSeek/GLM Flash 生成摘要/标签；三秒内返回相关文档清单。P2 是声明式 preset 产品壳。本包不以其他项目记忆覆盖这个范围。

## 本轮实时读取的仓库

- dsh-sim PR #5：`cdaf57c3ef4f062f83093753fdce7ca922bdd9c3`，open / Draft / 未合并。
  https://github.com/kogamishinyajerry-ops/dsh-sim/pull/5
- JerryDSH-Assets PR #2：`7dfb6afe6c8a77e790c62997d4c85a37cbabb1cc`，open / Draft / 未合并。
  https://github.com/kogamishinyajerry-ops/JerryDSH-Assets/pull/2
- Assets README，读取于上述固定提交。
- `self-built/jerry-aero/modules/kb-civair.js`：已取得代理源码；读取了 HTTP 请求路径、配置变量、工具注册与请求参数。
  https://github.com/kogamishinyajerry-ops/JerryDSH-Assets/blob/7dfb6afe6c8a77e790c62997d4c85a37cbabb1cc/self-built/jerry-aero/modules/kb-civair.js
- `research/12-feishu8-intranet-playbook.md`：读取已有研究框架。历史第三方产品宣传数据未在本轮外部重核，本包不把它们当成当前事实。

## 尚未取得的条件

`civair_kb` 后端完整源码、实际响应实例和内网 OA 文件均未取得。通过已连接 GitHub 的 civair 仓库名搜索和 civair_kb 代码搜索未定位到后端；这不能证明后端不存在，本机配置是后续定位入口。

代理注释提到 BM25、域隔离、stage/validate/publish/rollback 和 confirm。它们证明的是代理的设计/调用意图；本轮没有验证服务端实现、向量数据库能力、业务 ACL 或真正人工来源。

P0 的 r2 实机证据包仍未在本轮取得。本包不会更新 P0 的实际验收结论。

## 本轮已执行与未执行

已执行：仓库读取、需求映射、编写两个辅助工具、36 项 Linux/Python 3.13.5 测试、合成示例命令。

未执行：远端仓库修改或 PR 创建；P0 修复；原 DSH/模型/KB sidecar 实装；真实 OA 解析、embedding、生成摘要；Mac/内网性能验收。

## 访问失败记录

1. 运行容器直接 git clone 两仓：DNS 无法解析 github.com；改用已连接 GitHub 读取需要的源码和状态。没有声称完成整仓克隆或全仓测试。
2. 初次按交接简略目录读取 `self-built/jerry-aero/kb-civair.js`：404；读取固定提交树后确认真实路径在 `modules/` 内，再成功取得文件。
3. civair 后端搜索：未得到匹配仓库/代码；不以推测填充其 API 响应合同。

原交接要求 A/B/C/D 四类碰壁标注，但提供内容没有定义四类含义。因此本包保留具体错误与替代动作，没有重新发明四类定义。
