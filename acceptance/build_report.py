#!/usr/bin/env python3
"""从 local-acceptance.json 生成单文件 HTML 验收报告（现场可打开）。"""
import json, html, base64, pathlib

ACC = pathlib.Path("/Users/Zhuanz/projects/jerry-personal/JerryDSH/acceptance")
d = json.loads((ACC / "local-acceptance.json").read_text())

def esc(x): return html.escape(str(x))

def badge(text, color):
    return f'<span class="badge" style="background:{color}">{esc(text)}</span>'

OK, WARN, INFO = "#0a7d43", "#b5730a", "#3658c7"

st1 = d["stage1_real_solver_env"]["cases"]
st1_rows = "".join(
    f"<tr><td>{esc(k)}</td><td>{badge(v['execution'], OK if v['execution']=='SUCCEEDED' else WARN)}</td>"
    f"<td>{esc(v['numerical'])}</td><td>{esc(v['applicability'])}</td><td>{v['frozen_files']}</td>"
    f"<td>{badge('VERIFIED', OK) if v['transfer_verified'] else '—'}</td>"
    f"<td>{esc(str(v.get('dp_pa','')) + ('（相对差 ' + v['rel_diff'] + '）' if v.get('rel_diff') else ''))}</td></tr>"
    for k, v in st1.items())

fixes_rows = "".join(
    f"<tr><td><b>{esc(k)}</b></td><td>{badge('PASS', OK)}</td><td>{esc(v['details'])}</td>"
    f"<td><code>{esc(v['regression'])}</code></td></tr>"
    for k, v in d["fixes"].items())

st3 = d["stage3_natural_language_task"]
st4 = d["stage4_blind_and_fault"]

html_text = f"""<!DOCTYPE html>
<html lang="zh"><head><meta charset="utf-8">
<title>本地实机验收报告 · 2026-10-01</title>
<style>
body{{font-family:'Songti SC',Georgia,serif;max-width:1080px;margin:24px auto;padding:0 20px;color:#172238;background:#f4f1e9;line-height:1.55}}
h1{{border-bottom:3px solid #3658c7;padding-bottom:8px}} h2{{color:#3658c7;margin-top:32px}}
table{{border-collapse:collapse;width:100%;background:#fff;font-size:13.5px}}
th,td{{border:1px solid #c9c2b4;padding:6px 9px;text-align:left;vertical-align:top}}
th{{background:#eae5d8}}
.badge{{color:#fff;border-radius:10px;padding:2px 10px;font-size:12px;font-family:Menlo,monospace}}
code{{background:#e8e3d5;padding:1px 5px;border-radius:4px;font-size:12px}}
.stamp{{float:right;border:2px solid #3658c7;color:#3658c7;border-radius:8px;padding:6px 14px;font-weight:bold}}
ul{{padding-left:20px}} .small{{font-size:12px;color:#666}}
img{{max-width:100%;border:1px solid #c9c2b4}}
</style></head><body>
<div class="stamp">实机验收 · PASS<br><small style="font-weight:normal">DRAFT 方法 · 不构成工程 ACCEPT</small></div>
<h1>本地实机验收报告</h1>
<p><b>日期</b>：2026-10-01　<b>执行</b>：本地集成 Agent（隔离 DSH {esc(d['versions']['dsh'])} + linux/amd64 容器）　<b>人工门</b>：{len(d['human_confirmations'])} 次（授权×4、取消×1，对话确认+执行台操作）</p>

<h2>1 · 版本与布局</h2>
<table>
<tr><th>组件</th><th>值</th></tr>
<tr><td>DSH 恢复实例</td><td>{esc(d['versions']['dsh'])}（精确），隔离 DSH_HOME，web :3081；原 :3080 实例未动；doctor already-patched；隐私双禁生效</td></tr>
<tr><td>dsh-sim</td><td>{esc(d['versions']['dsh_sim_branch'])}</td></tr>
<tr><td>JerryDSH-Assets</td><td>{esc(d['versions']['assets_branch'])}</td></tr>
<tr><td>OpenFOAM</td><td>{esc(d['versions']['openfoam'])}</td></tr>
<tr><td>模型路由</td><td>{esc(d['versions']['model_route'])}（凭证不入仓/不显示）</td></tr>
<tr><td>adapter SHA-256</td><td><code>{esc(d['versions']['openfoam_adapter_sha256'][:24])}…</code>（与上轮一致，求解实现零改动）</td></tr>
</table>

<h2>2 · 四处断点修复（全部 PASS）</h2>
<table><tr><th>断点</th><th>结果</th><th>内容</th><th>回归</th></tr>{fixes_rows}</table>
<p class="small">测试：容器 386 passed（-m ''）· real_solver 显式 5 passed · Mac 381 passed+5 skip（平台差异）· orchestrator Node 16 passed · 恢复工具 12 passed（macOS 需真实路径 TMPDIR，已记录差异）</p>

<h2>3 · 第一阶段：真实求解环境（五场景全过）</h2>
<table><tr><th>场景</th><th>执行</th><th>数值</th><th>适用性</th><th>冻结文件</th><th>迁移校验</th><th>静压差观察</th></tr>{st1_rows}</table>
<p class="small">运行环境：Ubuntu noble amd64 容器 + OpenCFD v1912（Rosetta 模拟为新增组合，本轮实测）。cancel/timeout 均发生在 simpleFoam 已输出 Time= 之后，进程组退出证明 remaining_pids=[]。</p>

<h2>4 · 第二阶段：API / MCP / 人工界面</h2>
<ul>
<li>12 个 MCP 工具实握手（fastmcp stdio）；DRAFT 发现可见（status=DRAFT 返回 openfoam_channel），默认 RELEASED 目录保持为空；非法 status 桥层拒绝。</li>
<li>真实资源查询贯通同一工程库（get_task / get_preparation 返回真实 digest 与 software_build=OpenFOAM 1912）。</li>
<li>常驻 worker 实机验证：空队列启动 → API 建任务 → 2 秒接单 → 3 秒准备 READY。</li>
<li>执行台「确认并授权（不提交）」真实浏览器验证：模态含 task/revision/preparation_id/prepared_digest/预算；服务端任务 AUTHORIZED 且 runs=0（面板不代提交）。</li>
</ul>

<h2>5 · 第三阶段：自然语言四阶段（真实模型全链）</h2>
<table>
<tr><th>项</th><th>值</th></tr>
<tr><td>任务</td><td><code>{esc(st3['task_id'])}</code>（{esc(st3['project'])}，R{st3['revision']}）</td></tr>
<tr><td>准备</td><td><code>{esc(st3['preparation_id'])}</code> · digest <code>{esc(st3['prepared_digest'][:20])}…</code></td></tr>
<tr><td>人工授权</td><td><code>{esc(st3['authorization_id'])}</code>（对话确认 + 执行台仅授权）</td></tr>
<tr><td>首次提交</td><td>AGENT runner 经 MCP submit_runs → <code>{esc(st3['run_ids'][0])}</code></td></tr>
<tr><td>结果</td><td>{badge(st3['execution'], OK)} {badge(st3['numerical'], WARN)} {badge(st3['applicability'], WARN)} · {st3['artifacts']} artifacts · bundle {st3['bundle_entries']} 项（digest {esc(st3['bundle_digest_prefix'])}…，CURRENT）</td></tr>
<tr><td>诚实行为</td><td>reviewer 主动纠偏 artifact 计数（52 vs 53）；draft_review_issue 因无 review 实体被拒——如实阻塞，未伪造</td></tr>
</table>

<h2>6 · 第四阶段：未见输入与故障反馈</h2>
<table>
<tr><th>项</th><th>值</th></tr>
<tr><td>盲测（同配方未见参数）</td><td>独立测试 Agent 供参（v=0.045 m/s，L=0.7，H=0.13，ν=6.5e-4，ρ=960，56×26×1，450 迭代）；<code>{esc(st4['blind']['run_id'])}</code> {badge('SUCCEEDED', OK)}；观测 Δp={st4['blind']['observed_dp_pa']:.4f} Pa vs 解析 {st4['blind']['analytical_reference_pa']} Pa → 相对差 <b>{esc(st4['blind']['rel_diff'])}</b>；质量流量 ±0.101088 kg/s 守恒。仅声明同配方未见参数验证。</td></tr>
<tr><td>真实失败解释</td><td><code>{esc(st4['fault_explanation']['run_id'])}</code> {badge('FAILED（预期）', WARN)}；模型定位求解器启动期失败（1.1s，exit 1）、五项环境信号干净、指向输入配方；如实声明 stderr 原文超出工具面。事后人工核对：<code>{esc(st4['fault_explanation']['verified_stderr'])}</code>——与推断一致。</td></tr>
<tr><td>取消验证</td><td><code>{esc(st4['cancel']['run_id'])}</code> {badge('CANCELLED', INFO)}（simpleFoam 运行 559 迭代后经执行台人工取消）；exit_proof returncode 130、身份一致、<code>remaining_pids=[]</code></td></tr>
</table>

<h2>7 · 会话与证据</h2>
<ul>
<li>DSH 会话 {d['sessions']['count']} 个（全部真实 LLM 步骤，输入 {d['sessions']['input_tokens']:,} / 输出 {d['sessions']['output_tokens']:,} tokens）：<a href="sessions/session-manifest.json">session-manifest.json</a> · transcripts/</li>
<li>工程证据：evidence/（五套验证导出均 VERIFIED、共享工程库、worker/api 日志、三个验收 run 现场）</li>
<li>截图：ui/01–06（任务加载、授权模态、授权结果、准备就绪、运行结果、取消请求）</li>
<li>Draft PR：<a href="https://github.com/kogamishinyajerry-ops/dsh-sim/pull/5">dsh-sim#5</a> · <a href="https://github.com/kogamishinyajerry-ops/JerryDSH-Assets/pull/2">Assets#2</a>（不自动合并）</li>
</ul>

<h2>7b · 返修轮（同日，云端审查基线 469d7e6 / 42029ff）</h2>
<table>
<tr><th>项</th><th>结果</th><th>要点</th></tr>
<tr><td>R1 worker 停止语义</td><td><span class="badge" style="background:#0a7d43">PASS</span></td><td>should_stop 领取边界：当前作业完成后优雅退出，第二项保持未领取；真实子进程 SIGTERM/SIGINT × staged MOCK 队列测试（tests/test_worker_stop_semantics.py）</td></tr>
<tr><td>R2 仅授权交接恢复</td><td><span class="badge" style="background:#0a7d43">PASS</span></td><td>GET authorizations 只读投影（项目权限、无凭据字段、非 MCP 工具）+ 面板恢复块；实机：恢复 authz_fe677967… → AGENT 首提 run_805ddf71（SUCCEEDED）→ 授权仍 1 条（ui/08）</td></tr>
<tr><td>R3 项目配置</td><td><span class="badge" style="background:#0a7d43">PASS</span></td><td>面板不硬编码；shared 默认 proj_a，显式配置覆盖；同项目三角色访问测试、跨项目 403</td></tr>
<tr><td>R4 可运行交付</td><td><span class="badge" style="background:#0a7d43">PASS</span></td><td>TEMPLATE_REGISTRY 文档修正（JSON 路径非 capability ID）；deployment/local-acceptance/；Assets overlays/（脱敏+600s）；两仓配套提交 7260236/12d1dd8 ↔ 637a894</td></tr>
</table>
<p class="small">基线区分：修复前云端记录（378 passed、PR head 5b3ef00/2ddb273 时代、证据 zip SHA 85e3a78d…）保留于 docs/p0-validation-2026-10-01 不改写；修复后回归=容器 392 passed + 本节。求解路径三轮零改动（adapter SHA e0ccde08… 一致；worker/loop.py 仅加可选 should_stop）。盲测供参记录见 blind-input-record.md（无独立签名冻结文件，按实际证据范围标注）。</p>
<h2>8 · 诚实边界</h2>
<ul>{''.join(f'<li>{esc(x)}</li>' for x in d['honest_boundaries'])}</ul>
<p class="small">机器可读：local-acceptance.json · 复核入口：runbooks/local-runtime.sh。执行成功 ≠ 数值 PASS ≠ 工程 ACCEPT；数值 INSUFFICIENT 与适用性 UNCONFIRMED 是 DRAFT 方法下的诚实结论。</p>
</body></html>"""

out = ACC / "local-acceptance.html"
out.write_text(html_text)
print(f"written {out} ({len(html_text)} bytes)")
