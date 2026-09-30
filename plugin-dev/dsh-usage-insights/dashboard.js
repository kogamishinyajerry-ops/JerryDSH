// 仪表盘页面（自包含 HTML，浏览器直接渲染；数据来自 /usage-insights/api/stats）
const CSS = `
  :root{--paper:#faf6ec;--card:#fffdf7;--ink:#2a2620;--muted:#8a8072;--blue:#2b4c9b;--blue-soft:#e7edfb;
  --red:#d9483b;--green:#2f8a5d;--hi:#ffe58a;--line:#e6ddc9}
  *{box-sizing:border-box}
  body{margin:0;font-family:"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif;
    background:var(--paper);color:var(--ink);font-size:14.5px;line-height:1.7}
  .wrap{max-width:1240px;margin:0 auto;padding:20px 22px 60px}
  header{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:6px}
  h1{font-size:24px;margin:14px 0 2px}
  h1 small{font-size:13px;color:var(--muted);font-weight:400;margin-left:10px}
  .sub{color:var(--muted);font-size:13px;margin-bottom:14px}
  button{background:var(--blue);color:#fff;border:none;border-radius:9px;padding:6px 16px;font-size:13.5px;cursor:pointer}
  button:disabled{background:#b9c4dd;cursor:default}
  button.ghost{background:var(--card);color:var(--blue);border:1.5px solid var(--blue)}
  label.chk{font-size:12.5px;color:var(--muted);display:inline-flex;gap:5px;align-items:center}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:9px;margin:14px 0}
  .stat{background:var(--card);border:1.5px solid var(--line);border-radius:11px;padding:10px;text-align:center;box-shadow:0 2px 8px rgba(90,70,30,.06)}
  .stat .n{font-size:21px;font-weight:800;color:var(--blue)}
  .stat .d{font-size:11.5px;color:var(--muted)}
  .cols{display:grid;grid-template-columns:1.35fr 1fr;gap:14px}
  @media(max-width:900px){.cols{grid-template-columns:1fr}}
  .card{background:var(--card);border:1px solid var(--line);border-radius:13px;padding:15px 17px;box-shadow:0 2px 10px rgba(90,70,30,.06);margin-bottom:14px}
  .card h3{margin:0 0 8px;font-size:15.5px}
  .card h3 small{color:var(--muted);font-weight:400;font-size:12px;margin-left:8px}
  table{width:100%;border-collapse:collapse;font-size:12.5px}
  th{background:#f0e9d8;text-align:left;padding:5px 8px;border:1px solid var(--line);font-size:11.5px}
  td{padding:5px 8px;border:1px solid var(--line);vertical-align:top}
  tr:nth-child(even) td{background:#faf6ec}
  .tc{text-align:center}
  .bar{height:9px;background:var(--blue-soft);border-radius:4px;position:relative;min-width:60px}
  .bar i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#7a9bf0,#2b4c9b);border-radius:4px}
  .tier{font-size:10.5px;font-weight:700;border-radius:5px;padding:0 6px}
  .t-core{background:#fdeaea;color:var(--red)} .t-common{background:var(--blue-soft);color:var(--blue)}
  .t-low{background:#f3f0e6;color:#8a8072} .t-idle{background:#eee;color:#aaa} .t-zero{background:#eee;color:#bbb}
  .chips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0}
  .chip{background:var(--blue-soft);color:var(--blue);border-radius:999px;padding:2px 11px;font-size:12px;font-weight:600}
  .chip.off{background:#f0ece0;color:#b5ac9a}
  .tl{display:flex;align-items:flex-end;gap:3px;height:70px;margin-top:8px}
  .tl .d{flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%;position:relative}
  .tl .d i{background:linear-gradient(180deg,#7a9bf0,#2b4c9b);border-radius:3px 3px 0 0;min-height:2px}
  .tl .d span{position:absolute;bottom:-17px;left:50%;transform:translateX(-50%);font-size:9px;color:var(--muted);white-space:nowrap}
  .tl-wrap{padding-bottom:20px}
  .prog{height:12px;background:var(--blue-soft);border-radius:6px;overflow:hidden;margin:8px 0}
  .prog i{display:block;height:100%;background:linear-gradient(90deg,#7a9bf0,#2b4c9b);width:0;transition:width .5s}
  .err{color:var(--red);font-size:12px}
  .muted{color:var(--muted);font-size:12px}
  .bf{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  footer{margin-top:22px;color:var(--muted);font-size:11.5px;text-align:center}
  .legend{font-size:11.5px;color:var(--muted);margin-top:6px}
  .legend b{color:var(--ink)}
`

export function DASHBOARD_HTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DSH 使用洞察</title>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>📊 DSH 使用洞察<small id="since"></small></h1>
    <span style="margin-left:auto"></span>
    <label class="chk"><input type="checkbox" id="auto" checked> 5 秒自动刷新</label>
    <button class="ghost" onclick="load()">立即刷新</button>
  </header>
  <div class="sub" id="sub">加载中…</div>

  <div class="cards" id="cards"></div>

  <div class="card">
    <h3>🧰 工具与功能排行<small>价值分层：核心（7 天内 ≥20 次）· 常用（14 天内）· 低频（30 天内）· 闲置（>30 天）· 未用（装了从没用）</small></h3>
    <div style="max-height:420px;overflow:auto">
      <table id="tools"><thead><tr>
        <th>工具</th><th class="tc">分层</th><th class="tc">调用</th><th style="width:22%">频次</th>
        <th class="tc">错误</th><th class="tc">错误率</th><th class="tc">均耗时</th><th class="tc">最近使用</th>
      </tr></thead><tbody></tbody></table>
    </div>
    <div class="legend" id="toolsLegend"></div>
  </div>

  <div class="cols">
    <div>
      <div class="card">
        <h3>🧩 当前组合激活状态<small>服务探测 + 能力清单</small></h3>
        <div class="chips" id="services"></div>
        <div class="legend" id="capCounts"></div>
        <h3 style="margin-top:14px">🛠 可见工具清单<small id="toolCount"></small></h3>
        <div class="chips" id="toolList"></div>
      </div>
      <div class="card">
        <h3>📅 每日活动<small>事件量 / 工具调用</small></h3>
        <div class="tl-wrap"><div class="tl" id="tl"></div></div>
      </div>
      <div class="card">
        <h3>💬 最近会话<small>前 50，按最近活动</small></h3>
        <div style="max-height:300px;overflow:auto">
        <table id="sessions"><thead><tr><th>会话</th><th>目录</th><th class="tc">轮次</th><th class="tc">工具调用</th><th class="tc">事件</th><th class="tc">输出 token</th><th>最近活动</th></tr></thead><tbody></tbody></table>
        </div>
      </div>
    </div>
    <div>
      <div class="card">
        <h3>📥 历史导入<small>把插件启用前的旧会话统计进来</small></h3>
        <div class="bf">
          <button id="bfBtn" onclick="doBackfill()">导入历史会话</button>
          <span class="muted" id="bfState">未开始</span>
        </div>
        <div class="prog" id="bfProg" style="display:none"><i></i></div>
        <div class="err" id="bfErr"></div>
        <div class="legend">增量导入：按存储修订号跳过未变化的会话；重复导入不会双计（按事件序号去重）。大会话较多时首次导入需要一点时间。</div>
      </div>
      <div class="card"><h3>🎯 技能触发</h3><div id="skills"></div></div>
      <div class="card"><h3>🔌 MCP 服务器调用</h3><div id="mcp"></div></div>
      <div class="card"><h3>🧠 模型用量</h3><div id="models"></div></div>
      <div class="card"><h3>🧾 轮次终态 · 注入来源 · 事件类型</h3><div id="misc"></div></div>
    </div>
  </div>

  <footer>dsh-usage-insights v0.1.0 · 只读聚合，不修改任何会话数据 · 统计自 <span id="since2"></span> 起 · 数据落盘于 DSH_HOME/usage-insights/</footer>
</div>
<script>
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const fmt = (n) => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'k' : String(n ?? 0)
const ago = (t) => !t ? '—' : t > Date.now()-90e3 ? '刚刚' : t > Date.now()-864e5 ? Math.round((Date.now()-t)/36e5)+' 小时前' : Math.round((Date.now()-t)/864e5)+' 天前'
const tierCls = { '核心':'t-core','常用':'t-common','低频':'t-low','闲置':'t-idle','未用':'t-zero' }

function render(d) {
  document.getElementById('since').textContent = d.plugin.since ? '统计自 ' + new Date(d.plugin.since).toLocaleString() : ''
  document.getElementById('since2').textContent = d.plugin.since ? new Date(d.plugin.since).toLocaleString() : ''
  document.getElementById('sub').textContent = '已捕获 ' + fmt(d.plugin.eventCount) + ' 个事件 · 数据更新于 ' + (d.plugin.updatedAt ? new Date(d.plugin.updatedAt).toLocaleTimeString() : '—')

  const t = d.totals
  document.getElementById('cards').innerHTML = [
    ['会话数', fmt(t.sessions ?? 0)], ['轮次', fmt(t.turns)], ['工具调用', fmt(t.toolCalls)],
    ['调用错误', fmt(t.errors)], ['输入 token', fmt(t.tokens.in + t.tokens.cacheRead)], ['输出 token', fmt(t.tokens.out)],
    ['缓存读 token', fmt(t.tokens.cacheRead)],
  ].map(([d_, n]) => '<div class="stat"><div class="n">' + n + '</div><div class="d">' + esc(d_) + '</div></div>').join('')

  const maxCalls = Math.max(1, ...d.tools.map((x) => x.calls))
  document.querySelector('#tools tbody').innerHTML = d.tools.map((x) =>
    '<tr><td><b>' + esc(x.name) + '</b><br><span class="muted">' + esc(x.group) + '</span></td>' +
    '<td class="tc"><span class="tier ' + (tierCls[x.tier] || '') + '">' + x.tier + '</span></td>' +
    '<td class="tc">' + fmt(x.calls) + '</td>' +
    '<td><div class="bar"><i style="width:' + (x.calls / maxCalls * 100).toFixed(1) + '%"></i></div></td>' +
    '<td class="tc">' + x.errors + '</td><td class="tc">' + x.errRate + '%</td><td class="tc">' + (x.avgMs ? x.avgMs + 'ms' : '—') + '</td>' +
    '<td class="tc">' + ago(x.lastAt) + '</td></tr>').join('') ||
    '<tr><td colspan="8" class="muted tc">暂无数据——先去用一会儿 DSH，或点右侧「导入历史会话」。</td></tr>'

  const svc = d.composition.activeServices || []
  document.getElementById('services').innerHTML = svc.map((s) => '<span class="chip">' + esc(s) + '</span>').join('') || '<span class="chip off">无</span>'
  document.getElementById('capCounts').innerHTML = '模型可见工具 <b>' + (d.composition.tools?.length ?? 0) + '</b> 个 · 可用技能 <b>' + (d.composition.skills?.length ?? 0) + '</b> 个 · 激活服务 <b>' + svc.length + '</b> 个'
  document.getElementById('toolCount').textContent = '（前 60）'
  document.getElementById('toolList').innerHTML = (d.composition.tools || []).slice(0, 60)
    .map((x) => '<span class="chip" title="' + esc(x.description) + '">' + esc(x.name) + '</span>').join('') || '<span class="chip off">无</span>'

  const tl = d.timeline || []
  const maxTl = Math.max(1, ...tl.map((x) => x.events))
  document.getElementById('tl').innerHTML = tl.slice(-45).map((x) =>
    '<div class="d" title="' + x.day + '：' + x.events + ' 事件 / ' + x.toolCalls + ' 工具调用"><i style="height:' + (x.events / maxTl * 100).toFixed(1) + '%"></i><span>' + x.day.slice(5) + '</span></div>').join('') || '<span class="muted">暂无</span>'

  document.querySelector('#sessions tbody').innerHTML = (d.sessions || []).slice(0, 50).map((s) =>
    '<tr><td class="muted">' + esc(String(s.id).slice(0, 22)) + '…</td><td class="muted">' + esc((s.cwd || '').split('/').slice(-2).join('/')) + '</td>' +
    '<td class="tc">' + s.turns + '</td><td class="tc">' + s.toolCalls + '</td><td class="tc">' + fmt(s.events) + '</td>' +
    '<td class="tc">' + fmt(s.tokenSummary?.out ?? 0) + '</td><td class="tc">' + ago(s.lastAt) + '</td></tr>').join('') || '<tr><td colspan="7" class="muted tc">暂无</td></tr>'

  const skillRows = (d.skills || []).map((k) => '<div>🎯 <b>' + esc(k.name) + '</b> · ' + k.calls + ' 次 · ' + ago(k.lastAt) + '</div>').join('') || '<span class="muted">暂无技能工具调用记录</span>'
  const avail = (d.composition.skills || []).map((k) => esc(k.name)).join(' · ')
  document.getElementById('skills').innerHTML = skillRows + (avail ? '<div class="legend">可用技能目录：' + avail.slice(0, 400) + (avail.length > 400 ? '…' : '') + '</div>' : '')

  document.getElementById('mcp').innerHTML = (d.mcp || []).map((m) => '<div>🔌 <b>' + esc(m.server) + '</b> · ' + m.calls + ' 次调用</div>').join('') || '<span class="muted">暂无 MCP 工具调用</span>'

  document.getElementById('models').innerHTML = (d.models || []).map((m) =>
    '<div>🧠 <b>' + esc(m.route) + '</b> · ' + m.calls + ' 次 · 输入 ' + fmt(m.tokens.in + m.tokens.cacheRead) + '（缓存读 ' + fmt(m.tokens.cacheRead) + '）· 输出 ' + fmt(m.tokens.out) + '</div>').join('') || '<span class="muted">暂无</span>'

  const te = (d.turnEnds || []).map((x) => esc(x.kind) + ' ' + x.count).join(' · ')
  const sr = (d.sources || []).map((x) => esc(x.kind) + ' ' + x.count).join(' · ')
  const ev = (d.eventTypes || []).slice(0, 14).map((x) => esc(x.type) + ' ' + fmt(x.count)).join(' · ')
  document.getElementById('misc').innerHTML =
    '<div class="legend"><b>轮次终态：</b>' + (te || '暂无') + '</div>' +
    '<div class="legend" style="margin-top:6px"><b>注入来源：</b>' + (sr || '暂无') + '</div>' +
    '<div class="legend" style="margin-top:6px"><b>事件类型：</b>' + (ev || '暂无') + '</div>'

  const bf = d.backfill || {}
  const btn = document.getElementById('bfBtn')
  btn.disabled = bf.running || !bf.available
  btn.textContent = bf.running ? '导入中…' : '导入历史会话'
  document.getElementById('bfState').textContent = !bf.available ? '当前组合无持久化后端，不可回填'
    : bf.running ? bf.done + ' / ' + bf.total
    : bf.finishedAt ? '上次完成：' + new Date(bf.finishedAt).toLocaleTimeString()
    : bf.total ? '上次进度：' + bf.done + ' / ' + bf.total : '未开始'
  const prog = document.getElementById('bfProg')
  prog.style.display = bf.total ? 'block' : 'none'
  prog.firstElementChild.style.width = bf.total ? (bf.done / bf.total * 100).toFixed(1) + '%' : '0'
  document.getElementById('bfErr').textContent = bf.lastError || ''
}

async function load() {
  try {
    const r = await fetch('/usage-insights/api/stats')
    if (!r.ok) throw new Error('HTTP ' + r.status)
    render(await r.json())
  } catch (e) {
    document.getElementById('sub').textContent = '加载失败：' + e.message + '（宿主还在运行吗？）'
  }
}
async function doBackfill() {
  try {
    const r = await fetch('/usage-insights/api/backfill', { method: 'POST' })
    const j = await r.json().catch(() => ({}))
    if (j.error) document.getElementById('bfErr').textContent = j.error
  } catch (e) { document.getElementById('bfErr').textContent = String(e) }
  setTimeout(load, 300)
}
setInterval(() => { if (document.getElementById('auto').checked && !document.hidden) load() }, 5000)
load()
</script>
</body>
</html>`
}
