// 风神 routing-suite 对比评测 harness
// 黑盒驱动真实安装的插件代码（~/.dsh/profiles/web/node_modules/dsh-routing-suite）
import { CASES } from './cases.mjs';

const PKG = '/Users/Zhuanz/.dsh/profiles/web/node_modules/dsh-routing-suite/lib/index.js';
const mod = await import(PKG);

// ── mock ctx：捕获 system-prompt/assemble 中间件与 webServer 注册 ──
function setup(config) {
  let handler = null;
  const registered = [];
  const ctx = {
    on: (ev, h) => { if (ev === 'system-prompt/assemble') handler = h; },
    effect: (fn) => { try { fn(); } catch {} },
    webServer: { register: (r) => registered.push(r) },
  };
  mod.apply(ctx, config);
  return { handler, registered };
}

function userMsg(text, sourceKind = 'user') {
  return { type: 'user/message', data: { message: { role: 'user', content: [{ type: 'text', text }] }, source: { kind: sourceKind } } };
}
function session({ preset = 'routing-suite', events = [], headerPreset } = {}) {
  const evs = [];
  if (preset) evs.push({ type: 'agent-preset/selected', data: { agentPreset: preset } });
  evs.push(...events);
  return { events: evs, header: headerPreset ? { agentPreset: headerPreset } : {} };
}
const BASE = () => ({ sections: [{ name: 'identity', text: 'You are...', order: 0 }, { name: 'safety', text: 'Be safe.', order: 5 }] });

async function decide(handler, text, sess) {
  const out = await handler(null, { agent: { session: sess ?? session({ events: [userMsg(text)] }) } }, async () => BASE());
  const sec = out.sections.find((s) => s.name === 'routing-suite-guidance');
  if (!sec) return 'neutral';
  return sec.text.includes('maintenance or investigation') ? 'inspect' : 'direct';
}

// ═══ 第 1 部分：路由准确率 vs 基线 ═══
const { handler: autoHandler } = setup({ enabled: true, strategy: 'auto' });
const results = [];
for (const c of CASES) {
  const predicted = await decide(autoHandler, c.text);
  results.push({ ...c, predicted, correct: predicted === c.label });
}

const nonNeutral = results.filter((r) => r.label !== 'neutral');
const neutrals = results.filter((r) => r.label === 'neutral');
const acc = (rs) => rs.filter((r) => r.correct).length;

// 基线（同一非中性集上）
const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rng = mulberry32(42);
const baselines = {
  'plugin-auto（插件本体）': nonNeutral.map((r) => r.correct),
  'always-inspect-first（无脑检查）': nonNeutral.map((r) => r.label === 'inspect'),
  'always-direct（无脑直接）': nonNeutral.map((r) => r.label === 'direct'),
  'coin-flip（随机 50/50）': nonNeutral.map((r) => (rng() < 0.5 ? r.label === 'inspect' : r.label === 'direct')),
};

// 混淆矩阵（inspect/direct 二类 + 中性沉默单列）
const confusion = { 'inspect→inspect': 0, 'inspect→direct': 0, 'inspect→neutral': 0, 'direct→direct': 0, 'direct→inspect': 0, 'direct→neutral': 0 };
for (const r of nonNeutral) confusion[`${r.label}→${r.predicted}`]++;
const silentOnNeutral = neutrals.filter((r) => r.predicted === 'neutral').length;

// 分组细分
const groups = {};
for (const r of results) {
  groups[r.group] ??= { n: 0, ok: 0 };
  groups[r.group].n++;
  if (r.correct) groups[r.group].ok++;
}

// ═══ 第 2 部分：机制鲁棒性套件 ═══
const robust = [];
const check = async (id, desc, fn) => {
  try { const got = await fn(); robust.push({ id, desc, pass: got === true, got }); }
  catch (e) { robust.push({ id, desc, pass: false, got: `THREW: ${e.message}` }); }
};

await check('R1', '门控：preset=standard 时不注入', async () =>
  (await decide(autoHandler, '修复登录页白屏', session({ preset: 'standard', events: [userMsg('修复登录页白屏')] }))) === 'neutral');
await check('R2', '门控：无 preset 时不注入', async () =>
  (await decide(autoHandler, '修复登录页白屏', session({ preset: null, events: [userMsg('修复登录页白屏')] }))) === 'neutral');
await check('R3', '门控：header.agentPreset 回退生效', async () =>
  (await decide(autoHandler, '修复登录页白屏', session({ preset: null, headerPreset: 'routing-suite', events: [userMsg('修复登录页白屏')] }))) === 'inspect');
await check('R3b', '门控：最后一个 preset 事件生效（standard→routing-suite）', async () =>
  (await decide(autoHandler, 'x', session({ preset: null, events: [
    { type: 'agent-preset/selected', data: { agentPreset: 'standard' } },
    { type: 'agent-preset/selected', data: { agentPreset: 'routing-suite' } },
    userMsg('修复登录页白屏'),
  ] }))) === 'inspect');
await check('R4', '空事件会话 → 沉默', async () =>
  (await decide(autoHandler, '', session({ events: [] }))) === 'neutral');
await check('R5', '来源过滤：跳过 tool 来源首消息，采用真正的用户消息', async () =>
  (await decide(autoHandler, 'x', session({ events: [userMsg('修复一个 bug', 'tool'), userMsg('新建一个页面')] }))) === 'direct');
await check('R6', '字符串消息形态兼容（data 直接是字符串）', async () =>
  (await decide(autoHandler, 'x', session({ events: [{ type: 'user/message', data: '修复登录页白屏' }] }))) === 'inspect');
await check('R7', '幂等：重复组装不叠加 section', async () => {
  const sess = session({ events: [userMsg('修复登录页白屏')] });
  const once = await autoHandler(null, { agent: { session: sess } }, async () => BASE());
  const twice = await autoHandler(null, { agent: { session: sess } }, async () => once);
  return twice.sections.filter((s) => s.name === 'routing-suite-guidance').length === 1;
});
await check('R8', '强制 strategy=direct 覆盖分类器', async () => {
  const { handler } = setup({ enabled: true, strategy: 'direct' });
  return (await decide(handler, '修复登录页白屏')) === 'direct';
});
await check('R9', '强制 strategy=inspect-first 覆盖分类器', async () => {
  const { handler } = setup({ enabled: true, strategy: 'inspect-first' });
  return (await decide(handler, '新建一个页面')) === 'inspect';
});
await check('R10', 'enabled=false 完全旁路', async () => {
  const { handler } = setup({ enabled: false, strategy: 'inspect-first' });
  return (await decide(handler, '修复登录页白屏')) === 'neutral';
});
await check('R11', '非破坏：原 sections 保留、注入项 order=10', async () => {
  const out = await autoHandler(null, { agent: { session: session({ events: [userMsg('修复登录页白屏')] }) } }, async () => BASE());
  const names = out.sections.map((s) => s.name);
  return names.includes('identity') && names.includes('safety') && out.sections.find((s) => s.name === 'routing-suite-guidance')?.order === 10;
});
await check('R12', '强制策略 + 空任务仍然注入（策略无条件生效）', async () => {
  const { handler } = setup({ enabled: true, strategy: 'direct' });
  return (await decide(handler, '')) === 'direct';
});
await check('R13', 'Config schema：默认值与非法值拒绝', () => {
  const d = mod.Config({});
  const okDefaults = d.enabled === true && d.strategy === 'auto';
  let rejects = false;
  try { mod.Config({ strategy: 'bogus' }); } catch { rejects = true; }
  return okDefaults && rejects;
});
await check('R14', 'webServer 注册只读状态端点 /routing-suite/api', () => {
  const { registered } = setup({ enabled: true, strategy: 'auto' });
  return registered.length === 1 && registered[0].path === '/routing-suite/api' && registered[0].kind === 'prefix';
});

// ═══ 第 3 部分：成本微基准 ═══
const sess = session({ events: [userMsg('新建一个报表页面，但现在运行报错，顺便审查一下权限模块')] });
const N = 2000;
let t0 = performance.now();
for (let i = 0; i < N; i++) await autoHandler(null, { agent: { session: sess } }, async () => BASE());
const perCallUs = ((performance.now() - t0) / N) * 1000;
const GUIDANCE = {
  inspect: 'Routing guidance: this is a maintenance or investigation task. Inspect the relevant facts first, identify the root cause, then make the smallest justified change and verify it.',
  direct: 'Routing guidance: this is a creation or implementation task. Move directly toward a usable result, keep the design proportional, and verify the finished behavior.',
};

// ═══ 输出 ═══
console.log('===== 1. 路由准确率（非中性 37 例） =====');
console.log('arm\tcorrect/total\taccuracy');
for (const [name, arr] of Object.entries(baselines)) console.log(`${name}\t${arr.filter(Boolean).length}/${arr.length}\t${(arr.filter(Boolean).length / arr.length * 100).toFixed(1)}%`);
console.log('\n混淆矩阵:', JSON.stringify(confusion));
console.log(`中性沉默率: ${silentOnNeutral}/${neutrals.length}`);
console.log('\n分组细分:');
for (const [g, v] of Object.entries(groups)) console.log(`  ${g}: ${v.ok}/${v.n} (${(v.ok / v.n * 100).toFixed(0)}%)`);
console.log('\n错判明细:');
for (const r of results.filter((r) => !r.correct)) console.log(`  [${r.id}/${r.group}] ${r.label} → ${r.predicted} | ${r.text}`);
console.log('\n===== 2. 鲁棒性 =====');
for (const r of robust) console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.id} ${r.desc}${r.pass ? '' : `  got=${JSON.stringify(r.got)}`}`);
console.log(`  小计: ${robust.filter((r) => r.pass).length}/${robust.length}`);
console.log('\n===== 3. 成本 =====');
console.log(`  判定+注入端到端: ${perCallUs.toFixed(1)} µs/次 (${N} 次均值)`);
for (const [k, v] of Object.entries(GUIDANCE)) console.log(`  ${k} 载荷: ${v.length} chars ≈ ${Buffer.byteLength(v)} B ≈ ${Math.round(v.length / 4)} tokens`);

// 落盘 JSON 供报告引用
import { writeFileSync } from 'node:fs';
writeFileSync(new URL('./results.json', import.meta.url), JSON.stringify({
  accuracy: Object.fromEntries(Object.entries(baselines).map(([k, v]) => [k, { correct: v.filter(Boolean).length, total: v.length }])),
  confusion, silentOnNeutral, groups,
  errors: results.filter((r) => !r.correct),
  robust, cost: { perCallUs, payload: GUIDANCE },
}, null, 2));
console.log('\nresults.json 已写出');
