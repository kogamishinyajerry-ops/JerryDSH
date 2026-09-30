'use strict';
// hub server: static SPA + REST + SSE. Zero npm deps, Node >= 22.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { Store } = require('./lib/store');
const seed = require('./lib/seed');
const rt = require('./lib/agent');
const active = require('./lib/active');

const PORT = process.env.HUB_PORT || 3210;
const ROOT = path.join(__dirname, 'public');
const DATA = path.join(__dirname, 'data');

fs.mkdirSync(DATA, { recursive: true });
const db = new Store(path.join(DATA, 'hub.json'), seed.build);

const tokens = new Map(); // token -> user id
const bus = {
  clients: new Set(),
  publish(ch, event) {
    const payload = 'data: ' + JSON.stringify(Object.assign({ ch }, event)) + '\n\n';
    for (const res of this.clients) {
      try { res.write(payload); } catch (_) { this.clients.delete(res); }
    }
  }
};

// ---------- helpers ----------

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 2e6) req.destroy(); });
    req.on('end', () => {
      if (!b) return resolve({});
      try { resolve(JSON.parse(b)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function auth(req) {
  const h = req.headers['authorization'] || '';
  const m = /^Bearer (.+)$/.exec(h);
  if (!m) return null;
  return tokens.get(m[1]) || null;
}

function publicUser(u) {
  return u ? { id: u.id, name: u.name, handle: u.handle, title: u.title, role: u.role, color: u.color } : null;
}

function publicAgent(a) {
  return { id: a.id, name: a.name, handle: a.handle, model: a.model, role: a.role, status: a.status, tools: a.tools, avatar: a.avatar };
}

function snapshot() {
  return {
    me: null,
    users: db.data.users.map(publicUser),
    agents: db.data.agents.map(publicAgent),
    channels: db.data.channels,
    docs: db.data.docs.map(d => ({ id: d.id, title: d.title, folder: d.folder, by: d.by, updated: d.updated })),
    tables: db.data.tables,
    approvals: db.data.approvals,
    usage: db.data.usage,
    settings: { hubName: db.data.settings.hubName, org: db.data.settings.org, model: db.data.settings.model, quotaTokens: db.data.settings.quotaTokens }
  };
}

// ---------- agent trigger ----------

const mentionsRe = /@([\w\u4e00-\u9fa5-]+)/g;

async function runAgent(agent, ch, userText, actingUserId) {
  const ctx = rt.buildContext(db.data, agent, ch);
  const raw = db.data.settings.model || 'mock:*';
  // live settings are cached in the Store; always read fresh from disk to survive manual edits
  let provider = raw;
  try {
    const fresh = JSON.parse(require('fs').readFileSync(db.file, 'utf8'));
    if (fresh.settings && fresh.settings.model) provider = fresh.settings.model;
  } catch (_) {}
  const onDelta = delta => bus.publish(ch, { type: 'agent_delta', agent: agent.id, delta });

  let out;
  if (/^mock:/.test(provider)) {
    out = rt.mockDecide(db.data, agent, userText, ctx);
  } else if (/^dsh-cli:/.test(provider)) {
    out = await rt.dshDecide(agent, userText, ctx, provider.slice(8), onDelta);
  } else {
    const r = await rt.openaiDecide(db.data, agent, userText, ctx, db.data.settings, onDelta);
    const { arts, extra } = rt.runActions(db.data, agent, r.actions || []);
    r.arts = arts;
    if (extra.length) r.text = (r.text || '') + '\n' + extra.join('\n');
    out = r;
  }

  const msg = {
    id: 'm-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e4),
    ch, from: agent.id, text: out.text, t: Date.now(), kind: 'agent',
    reactions: {}, tools: out.tools || [], arts: out.arts || [], mention: actingUserId || null
  };
  db.data.messages.push(msg);
  db.data.usage.push({ day: new Date().toISOString().slice(0, 10), tokens: Math.max(200, (out.text || '').length * 2), calls: 1 });
  db.touch();
  bus.publish(ch, { type: 'message', message: msg });
}

function extractMentions(text) {
  const set = new Set();
  let m;
  const re = new RegExp(mentionsRe.source, 'g');
  while ((m = re.exec(text))) set.add(m[1]);
  return [...set];
}

// ---------- static ----------

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.json': 'application/json'
};

function serveStatic(res, rel) {
  const p = path.join(ROOT, rel === '/' ? 'index.html' : rel);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || !fs.statSync(p).isFile()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(p).pipe(res);
}

// ---------- routes ----------

async function route(req, res) {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;

  if (req.method === 'GET' && p === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store',
      'Connection': 'keep-alive', 'X-Accel-Buffering': 'no'
    });
    res.write('retry: 3000\n\n');
    bus.clients.add(res);
    req.on('close', () => bus.clients.delete(res));
    return;
  }

  if (req.method === 'GET' && p === '/api/directory') {
    json(res, 200, { users: db.data.users.map(u => ({ name: u.name, handle: u.handle, color: u.color })), org: db.data.settings.org });
    return;
  }

  if (req.method === 'POST' && p === '/api/login') {
    const { handle, pass } = await readBody(req);
    const user = db.data.users.find(x => x.handle === handle);
    if (!user || user.pass !== seed.pw(pass || '')) return json(res, 401, { error: '账号或密码不对' });
    const token = crypto.randomBytes(24).toString('hex');
    tokens.set(token, user.id);
    json(res, 200, { token, user: publicUser(user) });
    return;
  }

  if (req.method === 'GET' && p === '/api/bootstrap') {
    const uid = auth(req);
    if (!uid) return json(res, 401, { error: 'unauthorized' });
    const s = snapshot();
    s.me = publicUser(db.data.users.find(x => x.id === uid));
    json(res, 200, s);
    return;
  }

  if (req.method === 'GET' && p === '/api/messages') {
    const uid = auth(req);
    if (!uid) return json(res, 401, { error: 'unauthorized' });
    const ch = u.searchParams.get('ch') || 'c-general';
    json(res, 200, db.data.messages.filter(m => m.ch === ch));
    return;
  }

  if (req.method === 'POST' && p === '/api/messages') {
    const uid = auth(req);
    if (!uid) return json(res, 401, { error: 'unauthorized' });
    const { ch, text } = await readBody(req);
    if (!text || !String(text).trim()) return json(res, 400, { error: 'empty' });
    const m = { id: 'm-' + Date.now().toString(36), ch, from: uid, text: String(text), t: Date.now(), kind: 'text', reactions: {} };
    db.data.messages.push(m);
    db.touch();
    bus.publish(ch, { type: 'message', message: m });

    // mention -> agent trigger
    const handles = extractMentions(text);
    for (const h of handles) {
      const agent = db.data.agents.find(a => a.handle === h);
      if (agent && agent.status === 'active') {
        const clean = text.replace(new RegExp('@' + h, 'g'), '').trim() || '（看群上下文）';
        runAgent(agent, ch, clean, uid); // async, streams deltas + final message
      }
    }
    json(res, 200, m);
    return;
  }

  if (req.method === 'POST' && p === '/api/react') {
    const uid = auth(req);
    if (!uid) return json(res, 401, { error: 'unauthorized' });
    const { id, emoji } = await readBody(req);
    const m = db.data.messages.find(x => x.id === id);
    if (m) {
      m.reactions = m.reactions || {};
      const list = new Set(m.reactions[emoji] || []);
      if (list.has(uid)) { list.delete(uid); } else { list.add(uid); }
      if (list.size) m.reactions[emoji] = [...list]; else delete m.reactions[emoji];
      db.touch();
      bus.publish(m.ch, { type: 'react', id, reactions: m.reactions });
    }
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && p.startsWith('/api/docs/')) {
    const uid = auth(req);
    if (!uid) return json(res, 401, { error: 'unauthorized' });
    const d = db.data.docs.find(x => x.id === p.slice('/api/docs/'.length));
    if (!d) return json(res, 404, { error: 'not found' });
    json(res, 200, d);
    return;
  }

  if (req.method === 'POST' && p === '/api/docs') {
    const uid = auth(req);
    if (!uid) return json(res, 401, { error: 'unauthorized' });
    const { title, folder } = await readBody(req);
    const d = { id: 'd-' + Date.now().toString(36), title: title || '无题文档', folder: folder || '共享', by: uid, updated: Date.now(), body: '# ' + (title || '无题文档') + '\n\n' };
    db.data.docs.push(d);
    db.touch();
    bus.publish(null, { type: 'docs' });
    json(res, 200, d);
    return;
  }

  if (req.method === 'PUT' && p.startsWith('/api/docs/')) {
    const uid = auth(req);
    if (!uid) return json(res, 401, { error: 'unauthorized' });
    const id = p.slice('/api/docs/'.length);
    const d = db.data.docs.find(x => x.id === id);
    if (!d) return json(res, 404, { error: 'not found' });
    const { body } = await readBody(req);
    d.body = String(body); d.updated = Date.now(); d.by = uid;
    db.touch();
    json(res, 200, d);
    return;
  }

  if (req.method === 'POST' && p === '/api/tables') {
    const uid = auth(req);
    if (!uid) return json(res, 401, { error: 'unauthorized' });
    const { name } = await readBody(req);
    const t = { id: 't-' + Date.now().toString(36), name: name || '新表', by: uid, updated: Date.now(), columns: [{ key: 'task', label: '任务', type: 'text' }, { key: 'owner', label: '责任人', type: 'text' }, { key: 'status', label: '状态', type: 'select', options: ['未开始', '进行中', '已完成', '有风险'] }], rows: [] };
    db.data.tables.push(t);
    db.touch();
    bus.publish(null, { type: 'tables' });
    json(res, 200, t);
    return;
  }

  if (req.method === 'PUT' && p.startsWith('/api/tables/')) {
    const uid = auth(req);
    if (!uid) return json(res, 401, { error: 'unauthorized' });
    const rest = p.slice('/api/tables/'.length).split('/');
    const t = db.data.tables.find(x => x.id === rest[0]);
    if (!t) return json(res, 404, { error: 'not found' });
    const { rowId, cellKey, value } = await readBody(req);
    let row = t.rows.find(r => r.id === rowId);
    if (!row) {
      row = { id: 'r-' + Date.now().toString(36), cells: {} };
      t.rows.push(row);
    }
    row.cells[cellKey] = value;
    t.updated = Date.now();
    db.touch();
    bus.publish(null, { type: 'tables' });
    json(res, 200, row);
    return;
  }

  if (req.method === 'POST' && p === '/api/approvals') {
    const uid = auth(req);
    if (!uid) return json(res, 401, { error: 'unauthorized' });
    const { title, detail } = await readBody(req);
    const ap = { id: 'ap-' + Date.now().toString(36), title: title || '审批', by: uid, t: Date.now(), status: 'pending', assignee: 'u-jerry', steps: ['提交', '负责人审批', '归档'], detail: detail || '', logs: [{ t: Date.now(), actor: uid, act: '提交申请' }] };
    db.data.approvals.push(ap);
    db.touch();
    bus.publish(null, { type: 'approvals' });
    json(res, 200, ap);
    return;
  }

  if (req.method === 'PUT' && p.startsWith('/api/approvals/')) {
    const uid = auth(req);
    if (!uid) return json(res, 401, { error: 'unauthorized' });
    const ap = db.data.approvals.find(x => x.id === p.slice('/api/approvals/'.length));
    if (!ap) return json(res, 404, { error: 'not found' });
    const { action } = await readBody(req);
    if (action === 'approve' || action === 'reject') {
      ap.status = action === 'approve' ? 'approved' : 'rejected';
      ap.logs.push({ t: Date.now(), actor: uid, act: action === 'approve' ? '同意' : '驳回' });
      db.touch();
      bus.publish(null, { type: 'approvals' });
    }
    json(res, 200, ap);
    return;
  }

  if (req.method === 'GET' && p === '/api/memories') {
    const uid = auth(req);
    if (!uid) return json(res, 401, { error: 'unauthorized' });
    const out = [];
    for (const a of db.data.agents) for (const m of a.memory || []) out.push(Object.assign({ agent: a.id, agentName: a.name }, m));
    out.sort((x, y) => y.t - x.t);
    json(res, 200, out);
    return;
  }

  if (req.method === 'POST' && p === '/api/memories') {
    const uid = auth(req);
    if (!uid) return json(res, 401, { error: 'unauthorized' });
    const { agentId, text } = await readBody(req);
    const a = db.data.agents.find(x => x.id === agentId);
    if (!a || !text) return json(res, 400, { error: 'bad request' });
    a.memory = a.memory || [];
    a.memory.push({ id: 'm-' + Date.now().toString(36), text: String(text), tags: ['手动'], by: a.id, t: Date.now() });
    db.touch();
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === 'GET' && p === '/api/usage') {
    const uid = auth(req);
    if (!uid) return json(res, 401, { error: 'unauthorized' });
    const byDay = new Map();
    for (const r of db.data.usage) {
      const cur = byDay.get(r.day) || { day: r.day, tokens: 0, calls: 0 };
      cur.tokens += r.tokens; cur.calls += r.calls;
      byDay.set(r.day, cur);
    }
    const rows = [...byDay.values()].sort((a, b) => a.day < b.day ? -1 : 1).slice(-14);
    const quota = db.data.settings.quotaTokens || 1;
    const todayRow = byDay.get(new Date().toISOString().slice(0, 10)) || { tokens: 0, calls: 0 };
    json(res, 200, {
      rows,
      today: todayRow,
      quotaPct: Math.min(100, Math.round(todayRow.tokens / quota * 100)),
      model: db.data.settings.model,
      agents: db.data.agents.map(a => ({ id: a.id, name: a.name, status: a.status, calls: (db.data.messages.filter(m => m.from === a.id) || []).length }))
    });
    return;
  }

  if (req.method === 'GET' && p === '/api/system') {
    const uid = auth(req);
    if (!uid) return json(res, 401, { error: 'unauthorized' });
    json(res, 200, {
      node: process.version, uptime: Math.round(process.uptime()), clients: bus.clients.size,
      mem: Math.round(process.memoryUsage().rss / 1e6), provider: db.data.settings.model,
      dataFile: path.join(DATA, 'hub.json'), time: new Date().toISOString()
    });
    return;
  }

  // fallback static
  if (req.method === 'GET') return serveStatic(res, p);
  json(res, 404, { error: 'not found' });
}

const server = http.createServer((req, res) => {
  route(req, res).catch(e => {
    try { json(res, 500, { error: String(e && e.message || e) }); } catch (_) {}
  });
});

setInterval(() => { try { db.flush(); } catch (_) {} }, 30 * 1000);
active.startActiveLoop({ db }, bus);

server.listen(PORT, () => {
  console.log('[hub] listening on http://127.0.0.1:' + PORT + '  provider=' + db.data.settings.model);
  console.log('[hub] data file: ' + path.join(DATA, 'hub.json'));
});
