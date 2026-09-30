// 黑盒探针：不改插件代码，用文本变体定位判决依据
const PKG = '/Users/Zhuanz/.dsh/profiles/web/node_modules/dsh-routing-suite/lib/index.js';
const mod = await import(PKG);
let handler;
mod.apply({ on: (e, h) => e === 'system-prompt/assemble' && (handler = h), effect: () => {}, webServer: { register: () => {} } }, { enabled: true, strategy: 'auto' });
const sess = (t) => ({ events: [{ type: 'agent-preset/selected', data: { agentPreset: 'routing-suite' } }, { type: 'user/message', data: { message: { role: 'user', content: [{ type: 'text', text: t }] }, source: { kind: 'user' } } }], header: {} });
const decide = async (t) => { const o = await handler(null, { agent: { session: sess(t) } }, async () => ({ sections: [] })); const s = o.sections.find((x) => x.name === 'routing-suite-guidance'); return s ? (s.text.includes('maintenance') ? 'inspect' : 'direct') : 'neutral'; };

const probes = [
  ['f1 全文', '新建一个报表页面，但现在运行报错'],
  ['f1 去掉报错', '新建一个报表页面，但现在运行'],
  ['f1 去掉新建', '一个报表页面，但现在运行报错'],
  ['只有 报错', '运行报错'],
  ['只有 错误', '运行错误'],
  ['b6 全文', 'The build is broken on macOS, find out why'],
  ['b6 去掉 build', 'It is broken on macOS, find out why'],
  ['b6 why→为什么中文化', '构建在 macOS 上坏了，查查为什么'],
  ['英文 why 单独', 'why is it slow'],
  ['英文 investigate', 'Investigate the latency spike'],
  ['中文 调查', '调查一下线上哪里慢'],
  ['中文 排查', '排查一下线上哪里慢'],
  ['中文 漏洞/审查 recall', '审查这段代码'],
  ['英文 audit', 'Audit the auth flow'],
  ['英文 diagnose 变形', 'Diagnosing this failure'],
  ['英文 broken 单独', 'the app is broken'],
  ['中文 损坏', '文件损坏了'],
];
for (const [name, t] of probes) console.log((await decide(t)).padEnd(8), '|', name.padEnd(22), '|', t);
