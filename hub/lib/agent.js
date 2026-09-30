'use strict';
// Agent runtime: three providers (mock / openai-compatible / dsh-cli) behind
// one interface, a small tool loop, and channel context assembly.
// Providers are chosen per hub settings.model prefix at call time:
//   "mock:*"      -> deterministic offline demo brain
//   "dsh-cli:..." -> spawn the local dsh binary (intranet real deal)
//   anything else -> OpenAI-compatible chat completions (vLLM/one-api base URL)

const { spawn } = require('child_process');

// ---------- context assembly ----------

function buildContext(db, agent, ch) {
  const channel = db.channels.find(c => c.id === ch);
  const recent = db.messages.filter(m => m.ch === ch).slice(-12);
  const lines = recent.map(m => {
    const who = m.from.startsWith('a-')
      ? '智能体@' + (db.agents.find(a => a.id === m.from) || {}).name
      : (db.users.find(u => u.id === m.from) || {}).name;
    return who + ': ' + m.text;
  });
  const memories = (agent.memory || []).map(m => '- ' + m.text).join('\n');
  return {
    channel: channel ? channel.name + '（' + (channel.topic || '') + '）' : ch,
    transcript: lines.join('\n'),
    memories: memories || '（暂无）'
  };
}

const TOOLS_SPEC = [
  { name: 'weekly_digest', desc: '生成本周工作周报框架（结论前置）' },
  { name: 'minutes_outline', desc: '生成会议纪要框架（议题/结论/行动项）' },
  { name: 'kb_search', desc: '检索知识库并返回带出处的条目' },
  { name: 'create_doc', desc: '在云文档新建一篇文档' },
  { name: 'create_table', desc: '在多维表格新建任务表' },
  { name: 'create_approval', desc: '发起一条审批' },
  { name: 'risk_scan', desc: '扫描任务表中的风险项' }
];

// ---------- provider: mock ----------

function mockDecide(db, agent, userText, ctx) {
  const t = userText || '';
  const wants = [];
  const reply = [];
  const push = s => reply.push(s);

  if (/周报|汇总|本周/.test(t)) {
    wants.push('weekly_digest');
    push('周报框架已按本周群内动态拟好，结论前置：');
  } else if (/纪要|会议/.test(t)) {
    wants.push('minutes_outline');
    push('纪要框架来了，行动项都留了责任人和期限位：');
  } else if (/审批|请假|借用|外借/.test(t)) {
    wants.push('create_approval');
    push('已发起审批并流转到负责人，状态可在「审批」页跟踪：');
  } else if (/建表|任务表|登记/.test(t)) {
    wants.push('create_table');
    push('任务表已建好，去多维表格看，我顺手把第一行填了：');
  } else if (/风险|超时|卡点/.test(t)) {
    wants.push('risk_scan');
    push('扫了一遍所有任务表：');
  } else if (/条款|规章|适航|CF34|APU|故障/.test(t)) {
    wants.push('kb_search');
    push('查了知识库，按出处给你：');
  } else if (/文档|起草|说明/.test(t)) {
    wants.push('create_doc');
    push('文档草稿已落，标题和骨架如下：');
  } else {
    push('收到。基于团队记忆我的判断：');
    push('1) 先明确交付物和责任人；2) 数据来源走现有共享目录；3) 有卡点随时在群里 @我，我盯着进度。');
    push('（本条为离线演示脑，接入内网模型或 dsh-cli 后为真实生成。）');
  }

  let text = reply.join('\n');
  const arts = [];

  for (const w of wants) {
    if (w === 'weekly_digest') {
      text += '\n【本周】演示脚本定稿（严冬杰，9/18）；故障情报接入（窦欣，9/20）；纪要模板联调（杨家兴，9/22）；镜像搬运有风险（石浩裕）。';
    } else if (w === 'minutes_outline') {
      text += '\n【议题】……\n【结论】……\n【行动项】责任人+期限\n【风险】……';
    } else if (w === 'kb_search') {
      text += '\n· 出处：AirworthinessKB · CCAR-25 E 分部（引气供给与失效）\n· 出处：APU 安装专用条件（舱段环境与火警）';
    } else if (w === 'create_doc') {
      const d = {
        id: 'd-' + Date.now().toString(36), title: (t.slice(0, 12) || '无题') + '（草稿）', folder: '共享',
        by: agent.id, updated: Date.now(),
        body: '# ' + (t.slice(0, 12) || '无题') + '\n\n## 背景\n（由 @' + agent.name + ' 起草）\n\n## 要点\n- \n\n## 下一步\n- '
      };
      db.docs.push(d);
      arts.push({ type: 'doc', id: d.id, label: '云文档 · ' + d.title });
      text += '\n《' + d.title + '》';
    } else if (w === 'create_table') {
      const tb = {
        id: 't-' + Date.now().toString(36), name: (t.slice(0, 10) || '新任务表'), by: agent.id, updated: Date.now(),
        columns: [
          { key: 'task', label: '任务', type: 'text' },
          { key: 'owner', label: '责任人', type: 'text' },
          { key: 'status', label: '状态', type: 'select', options: ['未开始', '进行中', '已完成', '有风险'] }
        ],
        rows: [{ id: 'r1', cells: { task: '首项（示例）', owner: '待认领', status: '未开始' } }]
      };
      db.tables.push(tb);
      arts.push({ type: 'table', id: tb.id, label: '多维表格 · ' + tb.name });
      text += '\n《' + tb.name + '》';
    } else if (w === 'create_approval') {
      const ap = {
        id: 'ap-' + Date.now().toString(36), title: t.slice(0, 20) || '快速审批', by: agent.id, t: Date.now(),
        status: 'pending', assignee: 'u-jerry', steps: ['提交', '负责人审批', '归档'],
        detail: '由 @' + agent.name + ' 依群内指令发起。', logs: [{ t: Date.now(), actor: agent.id, act: '提交申请' }]
      };
      db.approvals.push(ap);
      arts.push({ type: 'approval', id: ap.id, label: '审批 · ' + ap.title });
      text += '\n《' + ap.title + '》→ 待严冬杰审批';
    } else if (w === 'risk_scan') {
      const risky = [];
      for (const tb of db.tables) {
        for (const r of tb.rows) {
          if (r.cells.status === '有风险' || r.cells.status === '未开始') risky.push(tb.name + ' · ' + r.cells.task + '（' + (r.cells.owner || '待认领') + '，' + (r.cells.due || r.cells.status) + '）');
        }
      }
      text += '\n' + (risky.length ? risky.slice(0, 5).map(s => '· ' + s).join('\n') : '当前无风险项，都稳。');
    }
  }
  return { text, tools: wants, arts };
}

// ---------- provider: openai-compatible (vLLM / one-api / FastChat) ----------

function openaiDecide(db, agent, userText, ctx, settings, onDelta) {
  const base = process.env.HUB_LLM_BASE || 'http://127.0.0.1:8000/v1';
  const key = process.env.HUB_LLM_KEY || 'EMPTY';
  const model = (settings.model || 'glm-4.7').replace(/^(openai|mock|dsh-cli):/, '');
  const sys = agent.sys + '\n你在频道「' + ctx.channel + '」。可用工具（在回答末尾以 JSON 数组输出 actions，形如 [{"tool":"create_doc","arg":"标题"}]，没有则不输出）：' + TOOLS_SPEC.map(t => t.name + '(' + t.desc + ')').join('；') + '\n团队记忆：\n' + ctx.memories + '\n最近群聊：\n' + ctx.transcript;
  const payload = JSON.stringify({
    model, stream: true, temperature: 0.4, max_tokens: 900,
    messages: [{ role: 'system', content: sys }, { role: 'user', content: userText }]
  });
  const mod = require('http');
  const u = new URL(base.replace(/\/$/, '') + '/chat/completions');
  return new Promise(resolve => {
    let raw = '';
    const req = mod.request({
      hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key }
    }, res => {
      res.setEncoding('utf8');
      res.on('data', chunk => {
        raw += chunk;
        for (const line of chunk.split('\n')) {
          const s = line.trim();
          if (!s.startsWith('data:')) continue;
          const d = s.slice(5).trim();
          if (d === '[DONE]') continue;
          try {
            const j = JSON.parse(d);
            const delta = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
            if (delta && onDelta) onDelta(delta);
          } catch (_) {}
        }
      });
      res.on('end', () => {
        const clean = raw.split('\n').filter(l => !l.startsWith('data:')).join('');
        let text = '';
        try {
          const one = JSON.parse(clean);
          text = (one.choices && one.choices[0] && one.choices[0].message && one.choices[0].message.content) || '';
        } catch (_) {
          text = raw.replace(/^data:.*$/gm, '').trim();
        }
        const actions = [];
        const m = text.match(/\[\s*\{\s*"tool"[\s\S]*?\]\s*$/);
        if (m) {
          try { actions.push(...JSON.parse(m[0])); text = text.slice(0, m.index).trim(); } catch (_) {}
        }
        resolve({ text, actions });
      });
    });
    req.on('error', () => resolve({ text: '（模型服务不可达：' + base + '，请检查 vLLM/one-api；当前回退为提示。可临时把模型设为 mock:* 离线演示。）', actions: [] }));
    req.end(payload);
  });
}

// ---------- provider: dsh-cli ----------

function dshDecide(agent, userText, ctx, cmd, onDelta) {
  const prompt = agent.sys + '\n\n频道：' + ctx.channel + '\n团队记忆：\n' + ctx.memories + '\n最近群聊：\n' + ctx.transcript + '\n\n用户消息：' + userText;
  const parts = cmd.split(/\s+/);
  const bin = parts[0], args = parts.slice(1).concat(['-p', prompt]);
  return new Promise(resolve => {
    let text = '';
    const p = spawn(bin, args, { env: process.env });
    p.stdout.on('data', d => { text += d; if (onDelta) onDelta(d.toString()); });
    p.stderr.on('data', () => {});
    p.on('error', () => resolve({ text: '（dsh-cli 启动失败：' + cmd + '）', actions: [] }));
    const killer = setTimeout(() => { try { p.kill('SIGKILL'); } catch (_) {} }, 180000);
    p.on('close', () => { clearTimeout(killer); resolve({ text: text.trim() || '（dsh-cli 无输出）', actions: [] }); });
  });
}

// ---------- tool execution for openai actions ----------

function runActions(db, agent, actions) {
  const arts = [];
  const extra = [];
  for (const a of actions || []) {
    const arg = (a && a.arg) || '';
    if (a.tool === 'create_doc') {
      const d = { id: 'd-' + Date.now().toString(36), title: arg || '无题', folder: '共享', by: agent.id, updated: Date.now(), body: '# ' + (arg || '无题') + '\n\n（由 @' + agent.name + ' 创建）\n' };
      db.docs.push(d); arts.push({ type: 'doc', id: d.id, label: '云文档 · ' + d.title });
    } else if (a.tool === 'create_table') {
      const tb = { id: 't-' + Date.now().toString(36), name: arg || '新任务表', by: agent.id, updated: Date.now(), columns: [{ key: 'task', label: '任务', type: 'text' }, { key: 'owner', label: '责任人', type: 'text' }, { key: 'status', label: '状态', type: 'select', options: ['未开始', '进行中', '已完成', '有风险'] }], rows: [] };
      db.tables.push(tb); arts.push({ type: 'table', id: tb.id, label: '多维表格 · ' + tb.name });
    } else if (a.tool === 'create_approval') {
      const ap = { id: 'ap-' + Date.now().toString(36), title: arg || '快速审批', by: agent.id, t: Date.now(), status: 'pending', assignee: 'u-jerry', steps: ['提交', '负责人审批', '归档'], detail: '由 @' + agent.name + ' 发起。', logs: [{ t: Date.now(), actor: agent.id, act: '提交申请' }] };
      db.approvals.push(ap); arts.push({ type: 'approval', id: ap.id, label: '审批 · ' + ap.title });
    } else if (a.tool === 'kb_search') {
      extra.push('· 出处：AirworthinessKB · CCAR-25 E 分部（引气）');
    }
  }
  return { arts, extra };
}

module.exports = { buildContext, mockDecide, openaiDecide, dshDecide, runActions, TOOLS_SPEC };
