const PKG = '/Users/Zhuanz/.dsh/profiles/web/node_modules/dsh-routing-suite/lib/index.js';
const mod = await import(PKG);
console.log('exports:', Object.keys(mod).join(', '));

let assembleHandler = null, registered = [];
const ctx = {
  on: (ev, h) => { if (ev === 'system-prompt/assemble') assembleHandler = h; },
  effect: (fn) => { try { fn(); } catch {} },
  webServer: { register: (r) => registered.push(r) },
};
mod.apply(ctx, { enabled: true, strategy: 'auto' });
console.log('handler captured:', typeof assembleHandler === 'function', '| web registered:', registered.map(r => r.path).join(','));

const session = {
  events: [
    { type: 'agent-preset/selected', data: { agentPreset: 'routing-suite' } },
    { type: 'user/message', data: { message: { role: 'user', content: [{ type: 'text', text: '修复登录页白屏' }] }, source: { kind: 'user' } } },
  ],
  header: {},
};
const base = { sections: [{ name: 'identity', text: 'You are...', order: 0 }] };
const out = await assembleHandler(null, { agent: { session } }, async () => base);
console.log('injected sections:', out.sections.map(s => `${s.name}(${s.order})`).join(' | '));
console.log('guidance text:', out.sections.find(s => s.name === 'routing-suite-guidance')?.text?.slice(0, 60));
