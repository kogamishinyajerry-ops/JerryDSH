'use strict';
// Seed data: FDE team workspace ("动力智能设计平台 · 内网协作中枢").
// Credentials: sha256(salt + password) hex. Default password for all seeded
// users is "dsh123456" (deployment must rotate; see README).

const crypto = require('crypto');
const SALT = 'jerrydsh-hub-v1';

function pw(p) {
  return crypto.createHash('sha256').update(SALT + p).digest('hex');
}

function id(prefix) {
  return prefix + '-' + crypto.randomBytes(6).toString('hex');
}

// Fixed demo-era timestamp so seeded threads read naturally.
const T0 = Date.now() - 1000 * 60 * 60 * 26;

function build() {
  const users = [
    { id: 'u-jerry',   name: '严冬杰', handle: 'jerry',  title: 'FDE 团队负责人 · 平台创始人', role: 'admin',    color: '#C8552D' },
    { id: 'u-jiaxing', name: '杨家兴', handle: 'jiaxing', title: 'FDE · 嘉欣',               role: 'member',   color: '#3B6D8C' },
    { id: 'u-haoyu',   name: '石浩裕', handle: 'haoyu',   title: 'FDE · 浩昱',               role: 'member',   color: '#5B7B3F' },
    { id: 'u-huayuan', name: '刘华源', handle: 'huayuan', title: 'FDE · 华源哥',             role: 'member',   color: '#8C6A2F' },
    { id: 'u-douxin',  name: '窦欣',   handle: 'douxin',  title: 'FDE · 窦哥',               role: 'member',   color: '#7B5AA6' },
    { id: 'u-xin',     name: '苏薪',   handle: 'suxin',   title: 'FDE · 苏薪',               role: 'member',   color: '#B04A6E' }
  ];
  for (const u of users) { u.pass = pw('dsh123456'); u.created = T0; }

  const agents = [
    {
      id: 'a-apt', name: 'APTDyna', handle: 'aptdyna', model: 'glm-4.7', avatar: 'A',
      role: 'APU 动力与适航知识伙伴：条款检索、故障模式分析、周报汇总、会议纪要提炼。',
      status: 'active', tools: ['weekly_digest', 'minutes_outline', 'kb_search'],
      sys: '你是 APTDyna，APU 动力与适航团队的智能体伙伴。回答要工程化、直接、给依据；涉及适航条款时标注条款号；不确定就说不确定，绝不编造。中文回答。',
      memory: [
        { id: 'm1', text: '团队正在推进 FDE 智能设计平台，主要语言 Python，核心模块 CFD/FEA/优化/RAG。', tags: ['平台'], by: 'a-apt', t: T0 + 3600e3 },
        { id: 'm2', text: '适航口径：正文用 CF34 系列名，表格用子型号 CF34-10A。', tags: ['适航'], by: 'a-apt', t: T0 + 3700e3 },
        { id: 'm3', text: '本周演示重点：APU 故障预测项目（杨海乐 + 史政政组队）。', tags: ['演示'], by: 'a-apt', t: T0 + 3800e3 }
      ]
    },
    {
      id: 'a-doc', name: 'DocSmith', handle: 'docsmith', model: 'glm-4.7', avatar: 'D',
      role: '文档与纪要专家：起草/改写文档、整理会议纪要、输出周报模板。',
      status: 'active', tools: ['create_doc', 'minutes_outline', 'weekly_digest'],
      sys: '你是 DocSmith，文档专家。输出结构清晰、国企语境、拒绝 AI 套话和翻译腔，全中文精炼大白话。',
      memory: [
        { id: 'm4', text: '纪要体例：结论前置，分【议题】【结论】【行动项】，行动项必须带责任人和期限。', tags: ['纪要'], by: 'a-doc', t: T0 + 3900e3 }
      ]
    },
    {
      id: 'a-ops', name: 'OpsWarden', handle: 'opswarden', model: 'glm-4.7', avatar: 'O',
      role: '流程管家：审批流转、多维表格建模、任务卡沉淀、风险提醒。',
      status: 'active', tools: ['create_approval', 'create_table', 'risk_scan'],
      sys: '你是 OpsWarden，流程管家。风格干脆，给出明确判断和下一步动作；发现跨天无人认领的事项要主动提醒。',
      memory: []
    }
  ];

  const channels = [
    { id: 'c-general', name: '综合', topic: 'FDE 团队日常', kind: 'channel', members: users.map(u => u.id), agents: ['a-apt'], created: T0 },
    { id: 'c-platform', name: '智能设计平台', topic: 'COMAC AgentPlatform 开发', kind: 'channel', members: ['u-jerry', 'u-jiaxing', 'u-haoyu', 'u-huayuan'], agents: ['a-doc'], created: T0 },
    { id: 'c-airworth', name: '适航与故障情报', topic: 'P-ACE / AirworthinessKB', kind: 'channel', members: ['u-jerry', 'u-douxin', 'u-xin'], agents: ['a-apt', 'a-ops'], created: T0 },
    { id: 'c-demo', name: '月中演示', topic: '创新实践月准备', kind: 'channel', members: ['u-jerry', 'u-jiaxing', 'u-douxin'], agents: ['a-ops'], created: T0 }
  ];

  const messages = [];
  function msg(ch, from, text, t, kind, meta) {
    const m = { id: id('m'), ch, from, text, t, kind: kind || 'text', reactions: {} };
    if (meta) m.meta = meta;
    messages.push(m);
    return m;
  }

  msg('c-general', 'u-jerry', '各位，今天飞书发布了 8.0，核心就是让 Agent 像同事一样进群干活。我们的内网版从今晚开始搭，@APTDyna 你先挂进来。', T0 + 100e3);
  msg('c-general', 'a-apt', '收到。我已就位：条款检索、故障模式分析、周报汇总随时可做。@我 即可。', T0 + 140e3, 'agent');
  msg('c-general', 'u-jiaxing', '期待，平时最烦的就是跨系统来回倒腾文件。', T0 + 200e3);
  msg('c-general', 'u-huayuan', 'CFD 作业排队那事能不能也让它管起来？', T0 + 240e3);
  msg('c-platform', 'u-jerry', '平台这周把 RAG 检索的引用透明度做上，回答必须带出处。@DocSmith 起个说明文档框架。', T0 + 300e3);
  msg('c-platform', 'a-doc', '框架已建好：《检索引用透明度说明》，在云文档「共享」目录，四个部分：出处粒度 / 展示规范 / 校验规则 / 验收标准。', T0 + 340e3, 'agent');
  msg('c-airworth', 'u-douxin', 'CF34-10A 的 APU 引气管路适航条款找不到了，之前在哪个规章里来着？', T0 + 400e3);
  msg('c-airworth', 'a-apt', '在 25 部 E 分部与 APU 专用条件里都有关联，建议按「引气」和「APU 装置」两个线索检索 AirworthinessKB，我整理一份对照表放到云文档。', T0 + 440e3, 'agent');
  msg('c-demo', 'u-jerry', '月中演示的验收场景定了：群里 @智能体，一句话汇总本周故障情报并生成纪要框架。', T0 + 500e3);
  msg('c-demo', 'a-ops', '已建演示任务表《月中演示准备》，六项任务已排，风险项我盯着，超时自动提醒。', T0 + 540e3, 'agent');

  for (const m of messages) {
    if (m.from === 'u-jerry' && m.kind === 'text') m.reactions['👍'] = ['u-jiaxing', 'u-haoyu'];
    if (m.from.startsWith('a-')) m.reactions['🛠️'] = ['u-jerry'];
  }

  const docs = [
    {
      id: 'd-quote', title: '检索引用透明度说明', folder: '共享',
      by: 'a-doc', updated: T0 + 340e3,
      body: '# 检索引用透明度说明\n\n## 1 出处粒度\n- RAG 回答必须标注：知识库名 / 文档名 / 条款号（如有）。\n- 多来源融合时逐条列出，不合并引用。\n\n## 2 展示规范\n- 正文用【出处：AirworthinessKB · 25部 · §25.-layout】格式内联标注。\n- 群聊卡片在文末统一列「参考来源」。\n\n## 3 校验规则\n- 引用不存在的条款号视为编造，一票否决。\n- 每周抽查 10 条回答核验出处。\n\n## 4 验收标准\n- 出处覆盖率 100%，抽查准确率 ≥ 95% 方可上线。'
    },
    {
      id: 'd-apt', title: 'CF34-10A APU 引气条款对照表', folder: '适航',
      by: 'a-apt', updated: T0 + 440e3,
      body: '# CF34-10A APU 引气条款对照表\n\n| 线索 | 规章 | 条款域 | 关联要点 |\n|---|---|---|---|\n| 引气 | CCAR-25 | E 分部 | 发动机/APU 引气供给与失效 |\n| APU 装置 | 专用条件 | APU 安装 | 舱段环境与火警 |\n\n> 结论：先按引气线索走 E 分部，再回 APU 安装专用条件复核。'
    },
    {
      id: 'd-minutes', title: '纪要体例 v2', folder: '模板',
      by: 'a-doc', updated: T0 + 3900e3,
      body: '# 纪要体例 v2\n\n【议题】\n【结论】结论前置，一条一行。\n【行动项】责任人 + 期限，缺一不立。\n【风险】跨天无人认领的自动升级提醒。'
    }
  ];

  const tables = [
    {
      id: 't-demo', name: '月中演示准备', by: 'a-ops', updated: T0 + 540e3,
      columns: [
        { key: 'task', label: '任务', type: 'text' },
        { key: 'owner', label: '责任人', type: 'text' },
        { key: 'due', label: '期限', type: 'text' },
        { key: 'status', label: '状态', type: 'select', options: ['未开始', '进行中', '已完成', '有风险'] },
        { key: 'note', label: '备注', type: 'text' }
      ],
      rows: [
        { id: 'r1', cells: { task: '验收场景脚本定稿', owner: '严冬杰', due: '9/18', status: '进行中', note: '@智能体一句话出周报' } },
        { id: 'r2', cells: { task: '故障情报数据接入', owner: '窦欣', due: '9/20', status: '进行中', note: 'P-ACE 周更文件' } },
        { id: 'r3', cells: { task: '纪要模板联调', owner: '杨家兴', due: '9/22', status: '未开始', note: '' } },
        { id: 'r4', cells: { task: '演示环境离线镜像', owner: '石浩裕', due: '9/21', status: '有风险', note: '模型权重 40G 待搬' } },
        { id: 'r5', cells: { task: '汇报材料', owner: '刘华源', due: '9/24', status: '未开始', note: '' } },
        { id: 'r6', cells: { task: '内网穿透预案', owner: '严冬杰', due: '9/25', status: '已完成', note: '不动，纯内网' } }
      ]
    }
  ];

  const approvals = [
    {
      id: 'ap-1', title: 'APU 故障预测演示数据外借申请', by: 'u-douxin', t: T0 + 600e3,
      status: 'pending', assignee: 'u-jerry', steps: ['提交', '负责人审批', '归档'],
      detail: '借东侧数据一份用于月中演示，承诺不落盘个人目录。', logs: [
        { t: T0 + 600e3, actor: 'u-douxin', act: '提交申请' }
      ]
    }
  ];

  const usage = [
    { day: '2026-09-12', tokens: 482000, calls: 96 },
    { day: '2026-09-13', tokens: 391000, calls: 74 },
    { day: '2026-09-14', tokens: 604000, calls: 121 }
  ];

  const settings = {
    hubName: '动力智能设计平台 · 内网协作中枢',
    org: '中国商飞二所 辅助动力系统部',
    dshCmd: process.env.DSH_CMD || '',
    model: process.env.HUB_MODEL || 'mock:demo',
    quotaTokens: 2000000
  };

  return { users, agents, channels, messages, docs, tables, approvals, usage, settings, sessionSalt: crypto.randomBytes(8).toString('hex') };
}

module.exports = { build, pw, SALT, id };
