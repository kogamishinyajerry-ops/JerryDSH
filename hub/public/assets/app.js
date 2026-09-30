'use strict';
// hub web app - vanilla JS SPA, no build step, offline-safe.

const S = {
  token: localStorage.getItem('hub_token') || '',
  me: null, boot: null,
  view: 'messages', ch: localStorage.getItem('hub_ch') || 'c-general',
  docId: null, docBody: '', docDirty: false, docSaveTimer: null,
  tableId: null, memAgent: null,
  msgs: [], unread: {}, typing: null, es: null
};

const $ = s => document.querySelector(s);
const viewEl = $('#view');
const loginWrap = document.getElementById('login');
const app = document.getElementById('app');

// ---------- utilities ----------

async function api(path, opts = {}) {
  const res = await fetch(path, Object.assign({
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (S.token || '') }
  }, opts));
  if (res.status === 401) { showLogin(); throw new Error('unauthorized'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
  return data;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtTime(t) {
  const d = new Date(t);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function dayKey(t) { const d = new Date(t); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }

function fmtDay(t) {
  const d = new Date(t), now = new Date();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (dayKey(t) === dayKey(now)) return '今天';
  if (dayKey(t) === dayKey(yest)) return '昨天';
  return (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
}

function fmtAgo(t) {
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 60) return s + ' 秒前';
  if (s < 3600) return Math.round(s / 60) + ' 分钟前';
  if (s < 86400) return Math.round(s / 3600) + ' 小时前';
  return fmtDay(t) + ' ' + fmtTime(t);
}

function fmtDur(sec) {
  if (sec < 60) return sec + ' 秒';
  if (sec < 3600) return Math.round(sec / 60) + ' 分钟';
  return Math.round(sec / 3600) + ' 小时';
}

function fmtTok(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'k';
  return String(n);
}

function userById(id) { return (S.boot.users.find(u => u.id === id)) || null; }
function agentById(id) { return (S.boot.agents.find(a => a.id === id)) || null; }
function chById(id) { return (S.boot.channels.find(c => c.id === id)) || null; }

function avaHtml(entity, isAgent) {
  const color = isAgent ? '#1A56A8' : (entity.color || '#64748B');
  const label = isAgent ? (entity.avatar || entity.name[0]) : entity.name[0];
  const cls = 'ava' + (isAgent ? '' : '');
  return '<span class="' + cls + '" style="background:' + color + '">' + esc(label) + '</span>';
}

function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

// ---------- shell ----------

function showLogin() {
  localStorage.removeItem('hub_token');
  S.token = '';
  app.classList.add('hidden');
  loginWrap.classList.remove('hidden');
  loadDirectory();
}

async function loadDirectory() {
  try {
    const dir = await (await fetch('/api/directory')).json();
    const box = $('#loginUsers');
    box.innerHTML = dir.users.map((u, i) =>
      '<button type="button" class="login-user' + (i === 0 ? ' sel' : '') + '" data-handle="' + esc(u.handle) + '">' +
      '<span class="ava" style="background:' + u.color + '">' + esc(u.name[0]) + '</span><span>' + esc(u.name) + '</span></button>'
    ).join('');
    box.querySelectorAll('.login-user').forEach(b => b.addEventListener('click', () => {
      box.querySelectorAll('.login-user').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
    }));
  } catch (_) { /* login still usable by typing handle */ }
}

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const sel = $('#loginUsers .login-user.sel');
  const handle = sel ? sel.dataset.handle : $('#loginHandle') ? $('#loginHandle').value : 'jerry';
  const pass = $('#loginPass').value;
  $('#loginError').textContent = '';
  try {
    const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handle, pass }) });
    const data = await r.json();
    if (!r.ok) { $('#loginError').textContent = data.error || '登录失败'; return; }
    S.token = data.token;
    localStorage.setItem('hub_token', data.token);
    boot();
  } catch (err) {
    $('#loginError').textContent = '网络异常：' + err.message;
  }
});

async function boot() {
  try {
    S.boot = await api('/api/bootstrap');
  } catch (e) { return; }
  S.me = S.boot.me;
  if (!chById(S.ch)) S.ch = S.boot.channels[0].id;
  loginWrap.classList.add('hidden');
  app.classList.remove('hidden');
  $('#providerChip').textContent = S.boot.settings.model;
  $('#providerChip').title = 'Agent 推理通道';
  renderShell();
  connectSSE();
  setView(S.view, null, true);
}

function renderShell() {
  $('#meChip').innerHTML =
    avaHtml(S.me, false) +
    '<div class="who"><div class="nm">' + esc(S.me.name) + '</div><div class="tt">' + esc(S.me.title) + '</div></div>';
  renderNav();
}

function pendingApprovals() { return S.boot.approvals.filter(a => a.status === 'pending').length; }

function renderNav() {
  const cur = S.view + ':' + (S.view === 'messages' ? S.ch : S.view === 'docs' ? S.docId : S.view === 'tables' ? S.tableId : '');
  const item = (view, param, icon, nm, extra, key) => {
    const on = (S.view === view && (param === null || param === key)) ? ' on' : '';
    const badge = extra || '';
    return '<button class="nav-item' + on + '" data-view="' + view + '" data-param="' + esc(key) + '">' +
      '<span class="hash">' + icon + '</span><span class="nm">' + esc(nm) + '</span>' + badge + '</button>';
  };
  let h = '<div class="nav-sec">频道</div>';
  for (const c of S.boot.channels) {
    const un = S.unread[c.id];
    h += item('messages', c.id, '#', c.name, un ? '<span class="bdg">' + un + '</span>' : '', c.id);
  }
  h += '<div class="nav-sec">协作</div>';
  h += item('docs', null, '¶', '云文档', '', 'docs');
  h += item('tables', null, '▦', '多维表格', '', 'tables');
  const pend = pendingApprovals();
  h += item('approvals', null, '✓', '审批', pend ? '<span class="bdg">' + pend + '</span>' : '', 'approvals');
  h += '<div class="nav-sec">智能</div>';
  h += item('agents', null, '@', '智能体', '', 'agents');
  h += item('memory', null, '◉', '团队记忆', '', 'memory');
  h += '<div class="nav-sec">管理</div>';
  h += item('usage', null, '↗', '用量看板', '', 'usage');
  h += item('system', null, '⌂', '系统', '', 'system');
  $('#nav').innerHTML = h;
  $('#nav').querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => {
    const v = b.dataset.view, p = b.dataset.param;
    if (v === 'messages') { S.ch = p; setView('messages'); }
    else setView(v);
  }));
}

function setView(v, param, skipPush) {
  S.view = v;
  if (S.unread[S.ch] && v === 'messages') { /* cleared below on messages render */ }
  if (v === 'messages') { S.ch = param || S.ch; localStorage.setItem('hub_ch', S.ch); S.unread[S.ch] = 0; }
  if (v === 'docs' && param) S.docId = param;
  if (v === 'tables' && param) S.tableId = param;
  renderNav();
  updateCrumb();
  if (v === 'messages') viewMessages();
  else if (v === 'docs') viewDocs();
  else if (v === 'tables') viewTables();
  else if (v === 'approvals') viewApprovals();
  else if (v === 'agents') viewAgents();
  else if (v === 'memory') viewMemory();
  else if (v === 'usage') viewUsage();
  else if (v === 'system') viewSystem();
}

function updateCrumb() {
  let t = '';
  if (S.view === 'messages') { const c = chById(S.ch); t = '# ' + c.name + '<small>' + esc(c.topic || '') + '</small>'; }
  else if (S.view === 'docs') t = '云文档';
  else if (S.view === 'tables') t = '多维表格';
  else if (S.view === 'approvals') t = '审批';
  else if (S.view === 'agents') t = '智能体';
  else if (S.view === 'memory') t = '团队记忆';
  else if (S.view === 'usage') t = '用量看板';
  else if (S.view === 'system') t = '系统';
  $('#crumb').innerHTML = t;
}

// ---------- SSE ----------

function connectSSE() {
  if (S.es) S.es.close();
  const es = new EventSource('/events');
  S.es = es;
  es.onmessage = e => {
    try {
      const d = JSON.parse(e.data);
      handleEvent(d);
    } catch (_) {}
  };
}

function handleEvent(d) {
  if (d.type === 'message') {
    const m = d.message;
    if (m.ch === S.ch && S.view === 'messages') {
      if (!S.msgs.some(x => x.id === m.id)) {
        S.msgs.push(m);
        appendMsg(m);
      }
      if (S.typing && m.from === S.typing.agentId) S.typing = null;
      renderTyping();
    } else {
      S.unread[m.ch] = (S.unread[m.ch] || 0) + 1;
      renderNav();
    }
    S.boot.approvals = S.boot.approvals; // no-op
  } else if (d.type === 'agent_delta') {
    if (d.ch === S.ch && S.view === 'messages') {
      if (!S.typing || S.typing.agentId !== d.agent) {
        const a = agentById(d.agent);
        S.typing = { agentId: d.agent, name: a ? a.name : '智能体', text: '' };
      }
      S.typing.text += d.delta;
      if (S.typing.text.length > 400) S.typing.text = S.typing.text.slice(-400);
      renderTyping();
    }
  } else if (d.type === 'react') {
    const m = S.msgs.find(x => x.id === d.id);
    if (m) { m.reactions = d.reactions; refreshReactions(m); }
  } else if (d.type === 'docs' || d.type === 'tables' || d.type === 'approvals') {
    refreshBoot().then(() => {
      if (d.type === 'approvals') renderNav();
      if ((d.type === 'docs' && S.view === 'docs' && !S.docDirty) ||
          (d.type === 'tables' && S.view === 'tables') ||
          (d.type === 'approvals' && S.view === 'approvals')) setView(S.view);
    });
  }
}

async function refreshBoot() {
  try { S.boot = await api('/api/bootstrap'); } catch (_) {}
}

// ---------- messages view ----------

async function viewMessages() {
  updateCrumb(); renderNav();
  viewEl.innerHTML =
    '<div class="msgs-col">' +
    '<div class="msgs" id="msgs"><div class="msgs-inner" id="msgsInner"><div class="loading-skel">' +
    '<div class="skel-row" style="width:40%"></div><div class="skel-row" style="width:70%"></div><div class="skel-row" style="width:55%"></div><div class="skel-row" style="width:65%"></div>' +
    '</div></div></div>' +
    '<div class="composer"><div class="composer-inner" id="composerInner"></div></div>' +
    '</div>' +
    '<aside class="chat-detail" id="chatDetail"></aside>';
  renderComposer();
  renderChatDetail();
  try {
    S.msgs = await api('/api/messages?ch=' + encodeURIComponent(S.ch));
  } catch (e) { S.msgs = []; }
  const inner = $('#msgsInner');
  if (!inner) return;
  inner.innerHTML = S.msgs.length ? S.msgs.map(msgRow).join('') :
    '<div class="empty"><div class="glyph">#</div><div class="et">频道里还没有消息</div><div class="es">说点什么，或者 @ 一位智能体开工</div></div>';
  scrollBottom(true);
}

function renderChatDetail() {
  const box = $('#chatDetail');
  if (!box) return;
  const ch = chById(S.ch);
  const here = S.boot.agents.filter(a => (ch.agents || []).includes(a.id));
  const team = S.boot.agents.filter(a => !(ch.agents || []).includes(a.id));
  const card = a =>
    '<div class="agent-card">' + avaHtml(a, true) +
    '<div><div class="nm">' + esc(a.name) + ' <span class="agent-tag">AGENT</span></div>' +
    '<div class="rl">' + esc(a.role) + '</div>' +
    '<div class="tools">' + (a.tools || []).map(t => '<span class="tool-mini">' + esc(t) + '</span>').join('') + '</div></div></div>';
  box.innerHTML = '<div class="cd-title">本频道智能体</div>' +
    (here.map(card).join('') || '<div class="cd-title">无，@名字 即可唤起</div>') +
    '<div class="cd-title" style="margin-top:14px">其他智能体</div>' +
    (team.map(card).join('') || '<div class="cd-title">无</div>');
}

function renderText(t) {
  let html = esc(t);
  html = html.replace(/@([\w\u4e00-\u9fa5-]+)/g, (m0, h) => {
    const known = S.boot.agents.some(a => a.handle === h) || S.boot.users.some(u => u.handle === h);
    return known ? '<span class="mention">@' + esc(h) + '</span>' : m0;
  });
  return html;
}

function msgRow(m) {
  const isA = m.from.startsWith('a-');
  const who = isA ? agentById(m.from) : userById(m.from);
  const name = who ? who.name : '已退出成员';
  const reactions = m.reactions && Object.keys(m.reactions).length ?
    '<div class="reactions" data-rid="' + m.id + '">' + reactionBtns(m) + '</div>' : '';
  const chips = (m.tools && m.tools.length) ?
    '<div class="tool-chips">' + m.tools.map(t => '<span class="tool-chip">' + esc(t) + '</span>').join('') + '</div>' : '';
  const arts = (m.arts && m.arts.length) ?
    '<div>' + m.arts.map(a =>
      '<button class="art-link" data-art="' + a.type + '" data-id="' + esc(a.id) + '">↗ ' + esc(a.label) + '</button>').join('') + '</div>' : '';
  const proactive = m.proactive ? '<div class="msg-proactive">主动补位提醒</div>' : '';
  return '<div class="msg hoverable" data-mid="' + m.id + '">' +
    avaHtml(who || { name }, isA) +
    '<div class="msg-body">' +
    '<div class="msg-head"><span class="msg-author' + (isA ? ' is-agent' : '') + '">' + esc(name) +
    (isA ? '<span class="agent-tag">AGENT</span>' : '') + '</span>' +
    '<span class="msg-time">' + fmtTime(m.t) + '</span></div>' +
    '<div class="msg-text">' + renderText(m.text) + '</div>' + proactive + chips + arts + reactions +
    '<div class="msg-quick" data-qid="' + m.id + '"><button data-react="👍">👍</button><button data-react="✅">✅</button></div>' +
    '</div></div>';
}

function reactionBtns(m) {
  return Object.entries(m.reactions).map(([emo, uids]) =>
    '<button class="reaction' + (uids.includes(S.me.id) ? ' mine' : '') + '" data-react="' + esc(emo) + '" data-rid2="' + m.id + '">' +
    esc(emo) + ' ' + uids.length + '</button>').join('');
}

function appendMsg(m) {
  const inner = $('#msgsInner');
  if (!inner) return;
  if (!S.msgs.length || inner.querySelector('.empty')) inner.innerHTML = '';
  const last = S.msgs[S.msgs.length - 2];
  let html = '';
  if (!last || dayKey(last.t) !== dayKey(m.t)) html += '<div class="day-sep">' + fmtDay(m.t) + '</div>';
  html += msgRow(m);
  inner.insertAdjacentHTML('beforeend', html);
  scrollBottom();
  bindMsgEvents();
}

function scrollBottom(force) {
  const box = $('#msgs');
  if (!box) return;
  const near = box.scrollHeight - box.scrollTop - box.clientHeight < 160;
  if (near || force) box.scrollTop = box.scrollHeight;
}

function bindMsgEvents() {
  const inner = $('#msgsInner');
  if (!inner) return;
  inner.querySelectorAll('[data-react]').forEach(b => b.addEventListener('click', async e => {
    e.stopPropagation();
    const emoji = b.dataset.react;
    await api('/api/react', { method: 'POST', body: JSON.stringify({ id: b.dataset.rid2 || b.closest('.msg').dataset.mid, emoji }) });
  }));
  inner.querySelectorAll('.art-link').forEach(b => b.addEventListener('click', () => {
    const t = b.dataset.art, id = b.dataset.id;
    if (t === 'doc') setView('docs', id);
    else if (t === 'table') setView('tables', id);
    else if (t === 'approval') setView('approvals');
  }));
}

function refreshReactions(m) {
  const box = document.querySelector('[data-rid="' + m.id + '"]');
  const mid = m.id;
  if (m.reactions && Object.keys(m.reactions).length) {
    const html = '<div class="reactions" data-rid="' + mid + '">' + reactionBtns(m) + '</div>';
    if (box) box.outerHTML = html;
    else {
      const row = document.querySelector('[data-mid="' + mid + '"] .msg-body');
      if (row) row.insertAdjacentHTML('beforeend', html);
    }
  } else if (box) box.remove();
  bindMsgEvents();
}

// ---------- composer ----------

let mentionState = null;

function renderComposer() {
  $('#composerInner').innerHTML =
    '<div class="mention-pop hidden" id="mentionPop"></div>' +
    '<div class="typing hidden" id="typing"></div>' +
    '<div class="composer-box"><textarea id="composeTa" rows="1" placeholder="发消息… @ 唤起智能体"></textarea>' +
    '<div class="composer-bar"><span class="composer-hint">Enter 发送 · Shift+Enter 换行 · @ 唤起智能体</span>' +
    '<button class="send-btn" id="sendBtn">发送</button></div></div>';
  const ta = $('#composeTa');
  ta.addEventListener('input', () => { autoGrow(ta); updateMentionPop(); });
  ta.addEventListener('keyup', () => updateMentionPop());
  ta.addEventListener('click', () => updateMentionPop());
  ta.addEventListener('keydown', e => {
    if (mentionState) {
      if (e.key === 'ArrowDown') { e.preventDefault(); moveMentionSel(1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); moveMentionSel(-1); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applyMention(mentionState.items[mentionState.sel]); return; }
      if (e.key === 'Escape') { hideMention(); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendCurrent(); }
  });
  $('#sendBtn').addEventListener('click', sendCurrent);
}

function autoGrow(ta) {
  ta.style.height = 'auto';
  ta.style.height = Math.min(160, ta.scrollHeight) + 'px';
}

async function sendCurrent() {
  const ta = $('#composeTa');
  const text = ta.value.trim();
  if (!text) return;
  ta.value = ''; autoGrow(ta); hideMention();
  try {
    await api('/api/messages', { method: 'POST', body: JSON.stringify({ ch: S.ch, text }) });
  } catch (e) { toast('发送失败：' + e.message); }
}

function updateMentionPop() {
  const ta = $('#composeTa');
  if (!ta) return hideMention();
  const pos = ta.selectionStart;
  const before = ta.value.slice(0, pos);
  const m = /@([\w\u4e00-\u9fa5-]*)$/.exec(before);
  if (!m) return hideMention();
  const q = m[1].toLowerCase();
  const cands = []
    .concat(S.boot.agents.map(a => ({ handle: a.handle, name: a.name, sub: '智能体 · ' + a.role, color: '#1A56A8', av: a.avatar || a.name[0] })))
    .concat(S.boot.users.map(u => ({ handle: u.handle, name: u.name, sub: u.title, color: u.color, av: u.name[0] })))
    .filter(i => !q || i.handle.toLowerCase().includes(q) || i.name.includes(q));
  if (!cands.length) return hideMention();
  mentionState = { items: cands, sel: 0, start: pos - m[0].length };
  const pop = $('#mentionPop');
  pop.classList.remove('hidden');
  pop.innerHTML = cands.map((i, idx) =>
    '<button class="mention-item' + (idx === 0 ? ' sel' : '') + '" data-mi="' + idx + '">' +
    '<span class="ava" style="background:' + i.color + ';width:24px;height:24px;font-size:11px">' + esc(i.av) + '</span>' +
    '<span><span>' + esc(i.name) + ' @' + esc(i.handle) + '</span><div class="sub">' + esc(i.sub) + '</div></span></button>'
  ).join('');
  pop.querySelectorAll('.mention-item').forEach(b =>
    b.addEventListener('click', () => applyMention(mentionState.items[+b.dataset.mi])));
}

function moveMentionSel(d) {
  mentionState.sel = (mentionState.sel + d + mentionState.items.length) % mentionState.items.length;
  const pop = $('#mentionPop');
  pop.querySelectorAll('.mention-item').forEach((b, i) => b.classList.toggle('sel', i === mentionState.sel));
}

function applyMention(item) {
  const ta = $('#composeTa');
  const pos = ta.selectionStart;
  ta.value = ta.value.slice(0, mentionState.start) + '@' + item.handle + ' ' + ta.value.slice(pos);
  hideMention();
  ta.focus();
  const p = mentionState.start + item.handle.length + 2;
  ta.setSelectionRange(p, p);
  autoGrow(ta);
}

function hideMention() {
  mentionState = null;
  const pop = $('#mentionPop');
  if (pop) pop.classList.add('hidden');
}

function renderTyping() {
  const el = $('#typing');
  if (!el) return;
  if (!S.typing) { el.classList.add('hidden'); el.innerHTML = ''; return; }
  el.classList.remove('hidden');
  el.innerHTML = '<span class="agent-name">' + esc(S.typing.name) + '</span> 正在处理' +
    '<span class="typing-dots"><i></i><i></i><i></i></span>' +
    (S.typing.text ? '<div style="margin-top:3px;color:var(--ink-2);white-space:pre-wrap">' + esc(S.typing.text) + '</div>' : '');
}

// ---------- agents view ----------

function viewAgents() {
  updateCrumb(); renderNav();
  const card = a =>
    '<div class="panel panel-pad">' +
    '<div style="display:flex;gap:14px;align-items:flex-start">' +
    avaHtml(a, true) +
    '<div style="flex:1;min-width:0">' +
    '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-weight:600;font-size:15px">' + esc(a.name) + '</span>' +
    '<span class="agent-tag">AGENT</span>' +
    '<span class="pill ' + (a.status === 'active' ? 'ok' : 'idle') + '">' + (a.status === 'active' ? '在线' : '停用') + '</span>' +
    '<span class="pill run">@' + esc(a.handle) + '</span></div>' +
    '<div style="font-size:13px;color:var(--ink-2);margin-top:6px">' + esc(a.role) + '</div>' +
    '<div class="tools" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:10px">' +
    (a.tools || []).map(t => '<span class="tool-mini">' + esc(t) + '</span>').join('') + '</div>' +
    '<div style="font-size:12px;color:var(--ink-3);margin-top:10px">模型 ' + esc(a.model) + ' · 记忆 ' + ((a.memory || []).length) + ' 条 · 在 ' +
    S.boot.channels.filter(c => (c.agents || []).includes(a.id)).map(c => '# ' + esc(c.name)).join('、') + ' 值守</div>' +
    '</div></div></div>';
  viewEl.innerHTML = '<div class="page"><div class="page-inner">' +
    '<div class="page-head"><div><div class="page-title">智能体</div><div class="page-sub">像同事一样进群干活的团队成员，@名字 即可唤起</div></div></div>' +
    S.boot.agents.map(card).join('') +
    '</div></div>';
}

// ---------- docs view ----------

async function viewDocs() {
  updateCrumb(); renderNav();
  if (!S.docId && S.boot.docs.length) S.docId = S.boot.docs[0].id;
  const folders = [...new Set(S.boot.docs.map(d => d.folder))];
  viewEl.innerHTML = '<div class="page" style="display:flex"><div class="docs-layout" style="flex:1">' +
    '<div class="docs-list" id="docsList"></div>' +
    '<div class="doc-editor" id="docEditor"><div class="empty" style="margin:auto"><div class="glyph">¶</div><div class="et">选择或新建一篇文档</div><div class="es">智能体产物也会自动落到这里</div></div></div>' +
    '</div></div>';
  renderDocsList();
  if (S.docId) await openDoc(S.docId);
}

function renderDocsList() {
  const box = $('#docsList');
  if (!box) return;
  const folders = [...new Set(S.boot.docs.map(d => d.folder))];
  box.innerHTML =
    '<button class="btn btn-ghost btn-sm" id="newDocBtn" style="width:100%;margin-bottom:8px">+ 新建文档</button>' +
    folders.map(f =>
      '<div class="nav-sec">' + esc(f) + '</div>' +
      S.boot.docs.filter(d => d.folder === f).map(d => {
        const by = d.by.startsWith('a-') ? agentById(d.by) : userById(d.by);
        return '<button class="doc-item' + (d.id === S.docId ? ' on' : '') + '" data-doc="' + d.id + '">' +
          '<div class="t">' + esc(d.title) + '</div>' +
          '<div class="m">' + esc(by ? by.name : '') + ' · ' + fmtAgo(d.updated) + '</div></button>';
      }).join('')
    ).join('');
  box.querySelectorAll('[data-doc]').forEach(b => b.addEventListener('click', () => openDoc(b.dataset.doc)));
  $('#newDocBtn').addEventListener('click', async () => {
    const d = await api('/api/docs', { method: 'POST', body: JSON.stringify({ title: '无题文档' }) });
    await refreshBoot();
    S.docId = d.id;
    renderDocsList();
    openDoc(d.id);
  });
}

async function openDoc(id) {
  S.docId = id;
  const d = await api('/api/docs/' + id);
  S.docBody = d.body;
  const by = d.by.startsWith('a-') ? agentById(d.by) : userById(d.by);
  const box = $('#docEditor');
  box.innerHTML =
    '<div class="doc-editor-head"><div><input class="input" id="docTitle" value="' + esc(d.title) + '" style="font-weight:600;font-size:15px;border:0;padding:2px 0;box-shadow:none">' +
    '<div class="m"><span class="folder-tag">' + esc(d.folder) + '</span>由 ' + esc(by ? by.name : '') + ' 最后编辑 · <span class="doc-status" id="docStatus">已加载</span></div></div>' +
    '<button class="btn btn-primary btn-sm" id="docSave">保存</button></div>' +
    '<textarea id="docBody" spellcheck="false">' + esc(d.body) + '</textarea>';
  const ta = $('#docBody');
  const save = async () => {
    $('#docStatus').textContent = '保存中…';
    await api('/api/docs/' + id, { method: 'PUT', body: JSON.stringify({ body: ta.value, title: $('#docTitle').value }) });
    S.docDirty = false;
    $('#docStatus').textContent = '已保存 ' + fmtTime(Date.now());
    const meta = S.boot.docs.find(x => x.id === id);
    if (meta) { meta.title = $('#docTitle').value; meta.updated = Date.now(); }
    renderDocsList();
  };
  ta.addEventListener('input', () => {
    S.docDirty = true;
    $('#docStatus').textContent = '编辑中…';
    clearTimeout(S.docSaveTimer);
    S.docSaveTimer = setTimeout(save, 1400);
  });
  ta.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); clearTimeout(S.docSaveTimer); save(); }
  });
  $('#docSave').addEventListener('click', () => { clearTimeout(S.docSaveTimer); save(); });
}

// ---------- tables view ----------

async function viewTables() {
  updateCrumb(); renderNav();
  if (!S.tableId && S.boot.tables.length) S.tableId = S.boot.tables[0].id;
  const t = S.boot.tables.find(x => x.id === S.tableId);
  viewEl.innerHTML = '<div class="page"><div class="page-inner" style="max-width:1100px">' +
    '<div class="page-head"><div><div class="page-title">多维表格</div><div class="page-sub">点击单元格直接编辑，智能体也会建表写行</div></div>' +
    '<button class="btn btn-ghost btn-sm" id="newTableBtn">+ 新建表</button></div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px" id="tableTabs"></div>' +
    '<div class="panel" id="tableBox"></div>' +
    '</div></div>';
  $('#newTableBtn').addEventListener('click', async () => {
    const tb = await api('/api/tables', { method: 'POST', body: JSON.stringify({ name: '新任务表' }) });
    await refreshBoot();
    S.tableId = tb.id;
    viewTables();
  });
  $('#tableTabs').innerHTML = S.boot.tables.map(tb =>
    '<button class="pill ' + (tb.id === S.tableId ? 'run' : 'idle') + '" data-tb="' + tb.id + '" style="border:0;cursor:pointer">' + esc(tb.name) + '</button>').join('');
  $('#tableTabs').querySelectorAll('[data-tb]').forEach(b => b.addEventListener('click', () => { S.tableId = b.dataset.tb; viewTables(); }));
  if (!t) { $('#tableBox').innerHTML = '<div class="empty"><div class="glyph">▦</div><div class="et">还没有表格</div><div class="es">右上角新建，或让智能体帮你建</div></div>'; return; }
  renderSheet(t);
}

function pillFor(v) {
  if (v === '已完成') return 'ok';
  if (v === '进行中') return 'run';
  if (v === '有风险') return 'bad';
  if (v === '未开始') return 'idle';
  return 'idle';
}

function renderSheet(t) {
  const box = $('#tableBox');
  box.innerHTML =
    '<div class="panel-pad" style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line)">' +
    '<div><span style="font-weight:600">' + esc(t.name) + '</span> <span style="font-size:12px;color:var(--ink-3);margin-left:8px">' + t.rows.length + ' 行 · 更新于 ' + fmtAgo(t.updated) + '</span></div>' +
    '<button class="btn btn-ghost btn-sm" id="addRow">+ 加一行</button></div>' +
    '<div class="sheet-wrap"><table class="sheet"><thead><tr>' +
    t.columns.map(c => '<th>' + esc(c.label) + '</th>').join('') + '</tr></thead><tbody>' +
    t.rows.map(r => '<tr data-row="' + r.id + '">' +
      t.columns.map(c => {
        const v = r.cells[c.key] || '';
        if (c.type === 'select') {
          return '<td><select class="cell-select pill-' + pillFor(v) + '" data-cell="' + c.key + '" data-row="' + r.id + '" style="color:inherit">' +
            '<option value=""' + (v ? '' : ' selected') + '></option>' +
            c.options.map(o => '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>').join('') +
            '</select></td>';
        }
        return '<td><input class="cell-input" value="' + esc(v) + '" data-cell="' + c.key + '" data-row="' + r.id + '"></td>';
      }).join('') + '</tr>').join('') +
    '</tbody></table></div>';
  $('#addRow').addEventListener('click', async () => {
    const row = await api('/api/tables/' + t.id, { method: 'PUT', body: JSON.stringify({ cellKey: 'task', value: '' }) });
    t.rows.push(row);
    renderSheet(t);
  });
  box.querySelectorAll('.cell-input').forEach(inp => inp.addEventListener('change', saveCell));
  box.querySelectorAll('.cell-select').forEach(sel => sel.addEventListener('change', saveCell));

  async function saveCell(e) {
    const el = e.target;
    const rowId = el.dataset.row, key = el.dataset.cell, value = el.value;
    const existing = t.rows.find(r => r.id === rowId);
    if (!existing) {
      const row = await api('/api/tables/' + t.id, { method: 'PUT', body: JSON.stringify({ cellKey: key, value }) });
      t.rows.push(row);
    } else {
      existing.cells[key] = value;
      await api('/api/tables/' + t.id, { method: 'PUT', body: JSON.stringify({ rowId, cellKey: key, value }) });
    }
    t.updated = Date.now();
    if (key === 'status') renderSheet(t);
  }
}

// ---------- approvals view ----------

async function viewApprovals() {
  updateCrumb(); renderNav();
  const card = a => {
    const by = a.by.startsWith('a-') ? agentById(a.by) : userById(a.by);
    const stepIdx = a.status === 'pending' ? 1 : 2;
    const stPill = a.status === 'pending' ? '<span class="pill warn">待审批</span>' :
      a.status === 'approved' ? '<span class="pill ok">已通过</span>' : '<span class="pill bad">已驳回</span>';
    const canAct = a.status === 'pending' && (S.me.role === 'admin' || a.assignee === S.me.id);
    return '<div class="panel ap-card">' +
      '<div class="ap-head"><div><div class="ap-title">' + esc(a.title) + '</div>' +
      '<div class="ap-meta">由 ' + esc(by ? by.name : '') + ' 提交 · ' + fmtAgo(a.t) + '</div></div>' + stPill + '</div>' +
      (a.detail ? '<div class="ap-detail">' + esc(a.detail) + '</div>' : '') +
      '<div class="ap-steps">' + a.steps.map((s, i) =>
        '<span class="ap-step ' + (i < stepIdx ? 'done' : i === stepIdx ? 'cur' : '') + '">' + esc(s) + '</span>').join('<span>→</span>') + '</div>' +
      (canAct ? '<div class="ap-acts"><button class="btn btn-primary btn-sm" data-ap="approve" data-id="' + a.id + '">同意</button>' +
        '<button class="btn btn-ghost btn-sm" data-ap="reject" data-id="' + a.id + '">驳回</button></div>' : '') +
      '<div class="ap-log">' + a.logs.slice(-3).map(l => {
        const actor = l.actor.startsWith('a-') ? agentById(l.actor) : userById(l.actor);
        return esc((actor ? actor.name : '') + ' · ' + l.act + ' · ' + fmtAgo(l.t));
      }).join('<br>') + '</div>' +
      '</div>';
  };
  viewEl.innerHTML = '<div class="page"><div class="page-inner" style="max-width:860px">' +
    '<div class="page-head"><div><div class="page-title">审批</div><div class="page-sub">流程流转与留痕，智能体也能发起</div></div></div>' +
    '<div class="panel panel-pad" style="margin-bottom:14px"><div class="panel-title">发起审批</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><input class="input" id="apTitle" placeholder="标题" style="flex:2;min-width:180px">' +
    '<input class="input" id="apDetail" placeholder="事由说明" style="flex:3;min-width:220px">' +
    '<button class="btn btn-primary" id="apSubmit">提交</button></div></div>' +
    '<div id="apList">' +
    (S.boot.approvals.length ? S.boot.approvals.slice().reverse().map(card).join('') :
      '<div class="panel"><div class="empty"><div class="glyph">✓</div><div class="et">暂无审批</div><div class="es">上面的表单提交一条试试</div></div></div>') +
    '</div></div></div>';
  $('#apSubmit').addEventListener('click', async () => {
    const title = $('#apTitle').value.trim();
    if (!title) return toast('先写个标题');
    await api('/api/approvals', { method: 'POST', body: JSON.stringify({ title, detail: $('#apDetail').value.trim() }) });
    await refreshBoot();
    viewApprovals();
    toast('已提交，等待负责人审批');
  });
  viewEl.querySelectorAll('[data-ap]').forEach(b => b.addEventListener('click', async () => {
    await api('/api/approvals/' + b.dataset.id, { method: 'PUT', body: JSON.stringify({ action: b.dataset.ap }) });
    await refreshBoot();
    viewApprovals();
  }));
}

// ---------- memory view ----------

async function viewMemory() {
  updateCrumb(); renderNav();
  if (!S.memAgent && S.boot.agents.length) S.memAgent = S.boot.agents[0].id;
  const all = await api('/api/memories');
  const agent = agentById(S.memAgent);
  const items = all.filter(m => m.agent === S.memAgent);
  viewEl.innerHTML = '<div class="page" style="display:flex"><div class="mem-layout" style="flex:1">' +
    '<div class="mem-agents">' + S.boot.agents.map(a =>
      '<button class="mem-agent' + (a.id === S.memAgent ? ' on' : '') + '" data-ma="' + a.id + '">' +
      avaHtml(a, true) + '<div><div class="nm">' + esc(a.name) + '</div>' +
      '<div class="ct">' + ((a.memory || []).length) + ' 条记忆 · ' + esc(a.model) + '</div></div></button>').join('') +
    '<div class="panel panel-pad" style="font-size:12.5px;color:var(--ink-2);line-height:1.7">团队记忆是智能体的长期上下文：群聊要点、口径约定、项目背景。写入后智能体在每次回答时都会参考。</div>' +
    '</div>' +
    '<div class="panel mem-panel">' +
    '<div class="panel-pad" style="border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center">' +
    '<span class="panel-title" style="margin:0">' + esc(agent ? agent.name : '') + ' 的记忆</span>' +
    '<span style="font-size:12px;color:var(--ink-3)">' + items.length + ' 条</span></div>' +
    '<div class="mem-list" id="memList">' +
    (items.length ? items.map(m =>
      '<div class="mem-item"><div class="txt">' + esc(m.text) + '</div>' +
      '<div class="meta">' + (m.tags || []).map(t => '<span class="mem-tag">' + esc(t) + '</span>').join('') +
      '<span>' + fmtAgo(m.t) + '</span></div></div>').join('') :
      '<div class="empty"><div class="glyph">◉</div><div class="et">还没有记忆</div><div class="es">在下方写入第一条，或让它在群聊里自己积累</div></div>') +
    '</div>' +
    '<div class="mem-add"><input class="input" id="memInput" placeholder="教它一条经验，例如：适航口径正文用系列名…">' +
    '<button class="btn btn-primary" id="memAdd">写入</button></div>' +
    '</div></div></div>';
  viewEl.querySelectorAll('[data-ma]').forEach(b => b.addEventListener('click', () => { S.memAgent = b.dataset.ma; viewMemory(); }));
  const add = async () => {
    const inp = $('#memInput');
    const text = inp.value.trim();
    if (!text) return;
    await api('/api/memories', { method: 'POST', body: JSON.stringify({ agentId: S.memAgent, text }) });
    inp.value = '';
    viewMemory();
    toast('已写入 ' + (agent ? agent.name : '') + ' 的记忆');
  };
  $('#memAdd').addEventListener('click', add);
  $('#memInput').addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
}

// ---------- usage view ----------

async function viewUsage() {
  updateCrumb(); renderNav();
  viewEl.innerHTML = '<div class="page"><div class="page-inner" style="max-width:1100px"><div class="loading-skel">' +
    '<div class="skel-row" style="width:30%"></div><div class="skel-row" style="width:60%"></div><div class="skel-row" style="width:45%"></div></div></div></div>';
  const u = await api('/api/usage');
  const total14 = u.rows.reduce((s, r) => s + r.tokens, 0);
  const calls14 = u.rows.reduce((s, r) => s + r.calls, 0);
  const max = Math.max(1, ...u.rows.map(r => r.tokens));
  const lastDay = u.rows.length ? u.rows[u.rows.length - 1].day : '';
  const kpi = (k, v, d) => '<div class="panel kpi"><div class="k">' + k + '</div><div class="v">' + v + '</div><div class="d">' + d + '</div></div>';
  viewEl.innerHTML = '<div class="page"><div class="page-inner" style="max-width:1100px">' +
    '<div class="page-head"><div><div class="page-title">用量看板</div><div class="page-sub">Token 消耗与调用统计，网关数据每 5 分钟归档</div></div>' +
    '<span class="provider-chip">' + esc(u.model) + '</span></div>' +
    '<div class="kpi-grid">' +
    kpi('今日 Token', fmtTok(u.today.tokens), '配额 ' + Math.round(u.quotaPct) + '%') +
    kpi('今日调用', u.today.calls, '次模型调用') +
    kpi('近 14 天 Token', fmtTok(total14), '滚动窗口') +
    kpi('近 14 天调用', calls14, '滚动窗口') +
    '</div>' +
    '<div class="panel panel-pad"><div class="panel-title">每日 Token</div>' +
    '<div class="bars">' + u.rows.map(r =>
      '<div class="bar-col"><span class="bar-val">' + fmtTok(r.tokens) + '</span>' +
      '<div class="bar' + (r.day === lastDay ? ' today' : '') + '" style="height:' + Math.max(3, Math.round(r.tokens / max * 100)) + 'px"></div>' +
      '<span class="bar-lab">' + r.day.slice(5) + '</span></div>').join('') + '</div>' +
    '<div style="margin-top:14px"><div style="font-size:12px;color:var(--ink-2)">本月配额（' + esc(S.boot.settings.quotaTokens.toLocaleString()) + ' token / 日上限口径）</div>' +
    '<div class="quota-track"><div class="quota-fill" style="width:' + u.quotaPct + '%"></div></div></div>' +
    '</div>' +
    '<div class="panel panel-pad"><div class="panel-title">智能体调用排行</div>' +
    u.agents.map(a => '<div class="agent-usage-row"><span class="nm">' + esc(a.name) + '</span>' +
      '<span class="pill ' + (a.status === 'active' ? 'ok' : 'idle') + '">' + (a.status === 'active' ? '在线' : '停用') + '</span>' +
      '<span class="calls">' + a.calls + ' 条消息</span></div>').join('') +
    '</div>' +
    '</div></div>';
}

// ---------- system view ----------

async function viewSystem() {
  updateCrumb(); renderNav();
  viewEl.innerHTML = '<div class="page"><div class="page-inner"><div class="loading-skel">' +
    '<div class="skel-row" style="width:35%"></div><div class="skel-row" style="width:55%"></div></div></div></div>';
  const sys = await api('/api/system');
  const kv = (k, v) => '<div class="kv"><span class="k">' + k + '</span><span class="v">' + esc(v) + '</span></div>';
  viewEl.innerHTML = '<div class="page"><div class="page-inner" style="max-width:900px">' +
    '<div class="page-head"><div><div class="page-title">系统</div><div class="page-sub">纯内网离线运行，零外联依赖</div></div></div>' +
    '<div class="sys-grid">' +
    '<div class="panel"><div class="panel-pad" style="border-bottom:1px solid var(--line)"><div class="panel-title" style="margin:0">运行时</div></div>' +
    kv('Node', sys.node) + kv('内存占用', sys.mem + ' MB') + kv('已运行', fmtDur(sys.uptime)) + '</div>' +
    '<div class="panel"><div class="panel-pad" style="border-bottom:1px solid var(--line)"><div class="panel-title" style="margin:0">协作面</div></div>' +
    kv('在线连接', sys.clients + ' 个') + kv('数据文件', 'data/hub.json') + kv('频道', S.boot.channels.length + ' 个') + '</div>' +
    '<div class="panel"><div class="panel-pad" style="border-bottom:1px solid var(--line)"><div class="panel-title" style="margin:0">智能通道</div></div>' +
    kv('当前 provider', sys.provider) + kv('内网模式', '离线可用') + kv('外联请求', '0') + '</div>' +
    '</div>' +
    '<div class="panel panel-pad" style="margin-top:14px;font-size:13px;color:var(--ink-2);line-height:1.8">' +
    '<div class="panel-title">部署口径</div>' +
    '推理通道三选一：mock（离线演示脑，零依赖）· openai 兼容（HUB_LLM_BASE 指向内网 vLLM / one-api 网关）· dsh-cli（DSH_CMD 指向本机 dsh 命令）。<br>' +
    '全部数据落在本机 data/hub.json，定时原子刷盘；无任何外部网络调用，断网不影响使用。</div>' +
    '</div></div>';
}

// ---------- cmdk ----------

let cmdkSel = 0;

function cmdkOpen() {
  $('#cmdk').classList.remove('hidden');
  const inp = $('#cmdkInput');
  inp.value = '';
  cmdkSel = 0;
  renderCmdk('');
  inp.focus();
}

function cmdkClose() { $('#cmdk').classList.add('hidden'); }

function cmdkEntries() {
  const e = [];
  for (const c of S.boot.channels) e.push({ ico: '#', label: c.name, hint: '频道', go: () => setView('messages', c.id) });
  e.push(
    { ico: '@', label: '智能体', hint: '模块', go: () => setView('agents') },
    { ico: '¶', label: '云文档', hint: '模块', go: () => setView('docs') },
    { ico: '▦', label: '多维表格', hint: '模块', go: () => setView('tables') },
    { ico: '✓', label: '审批', hint: '模块', go: () => setView('approvals') },
    { ico: '◉', label: '团队记忆', hint: '模块', go: () => setView('memory') },
    { ico: '↗', label: '用量看板', hint: '模块', go: () => setView('usage') },
    { ico: '⌂', label: '系统', hint: '模块', go: () => setView('system') }
  );
  for (const a of S.boot.agents) {
    e.push({
      ico: '@', label: a.name, hint: '智能体 · 去值守频道',
      go: () => {
        const c = S.boot.channels.find(x => (x.agents || []).includes(a.id));
        setView('messages', c ? c.id : S.boot.channels[0].id);
      }
    });
  }
  for (const d of S.boot.docs) e.push({ ico: '¶', label: d.title, hint: '文档', go: () => setView('docs', d.id) });
  for (const t of S.boot.tables) e.push({ ico: '▦', label: t.name, hint: '表格', go: () => setView('tables', t.id) });
  return e;
}

function renderCmdk(q) {
  const all = cmdkEntries();
  const items = q ? all.filter(i => i.label.toLowerCase().includes(q.toLowerCase()) || i.hint.includes(q)) : all;
  cmdkSel = Math.min(cmdkSel, Math.max(0, items.length - 1));
  const list = $('#cmdkList');
  list.innerHTML = items.length ? items.map((i, idx) =>
    '<button class="cmdk-item' + (idx === cmdkSel ? ' sel' : '') + '" data-ci="' + idx + '">' +
    '<span class="ico">' + i.ico + '</span><span>' + esc(i.label) + '</span><span class="hint">' + esc(i.hint) + '</span></button>').join('') :
    '<div class="empty" style="padding:24px"><div class="et">没有匹配项</div></div>';
  list.querySelectorAll('.cmdk-item').forEach(b => {
    b.addEventListener('click', () => { items[+b.dataset.ci].go(); cmdkClose(); });
    b.addEventListener('mousemove', () => { cmdkSel = +b.dataset.ci; });
  });
  list._items = items;
}

$('#cmdkInput').addEventListener('input', e => { cmdkSel = 0; renderCmdk(e.target.value); });
$('#cmdkInput').addEventListener('keydown', e => {
  const items = $('#cmdkList')._items || [];
  if (e.key === 'ArrowDown') { e.preventDefault(); cmdkSel = Math.min(cmdkSel + 1, items.length - 1); renderCmdk($('#cmdkInput').value); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); cmdkSel = Math.max(cmdkSel - 1, 0); renderCmdk($('#cmdkInput').value); }
  else if (e.key === 'Enter') { if (items[cmdkSel]) { items[cmdkSel].go(); cmdkClose(); } }
  else if (e.key === 'Escape') cmdkClose();
});
$('#cmdk').addEventListener('click', e => { if (e.target === $('#cmdk')) cmdkClose(); });
$('#cmdkBtn').addEventListener('click', cmdkOpen);
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); cmdkOpen(); }
});

$('#logoutBtn').addEventListener('click', () => showLogin());

// ---------- go ----------

if (S.token) boot(); else showLogin();
