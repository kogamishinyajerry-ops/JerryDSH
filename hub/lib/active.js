'use strict';
// Active care: cron-style sweeps that let team agents work like colleagues.
// 1) Risk watch: rows stuck in "有风险"/"未开始" past their due -> agent nudge in channel.
// 2) Usage metering -> daily rollup for the usage board.

const rt = require('./agent');

function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function startActiveLoop(hub, bus) {
  // risk sweep every 5 minutes
  setInterval(() => {
    try {
      const now = new Date();
      const flagged = [];
      for (const tb of hub.db.tables) {
        for (const r of tb.rows) {
          const st = r.cells.status;
          if (st !== '有风险' && st !== '未开始') continue;
          const m = /(\d{1,2})\/(\d{1,2})/.exec(r.cells.due || '');
          if (!m) continue;
          const due = new Date(now.getFullYear(), +m[1] - 1, +m[2], 23, 59);
          if (now > due && !r._nudged) {
            r._nudged = true;
            flagged.push(tb.name + '《' + r.cells.task + '》责任人 ' + (r.cells.owner || '待认领') + '，期限 ' + r.cells.due);
          }
        }
      }
      if (flagged.length) {
        const warden = hub.db.agents.find(a => a.handle === 'opswarden');
        const ch = 'c-demo';
        const m = {
          id: 'm-' + Date.now().toString(36), ch, from: warden.id,
          text: '⏰ 主动补位：以下任务已过期限或挂风险，请认领——\n' + flagged.map(s => '· ' + s).join('\n'),
          t: Date.now(), kind: 'agent', reactions: {}, proactive: true
        };
        hub.db.messages.push(m);
        hub.db.usage.push({ day: today(), tokens: 1200, calls: 1 });
        hub.db.touch();
        bus.publish(ch, { type: 'message', message: m });
      }
    } catch (e) { /* keep loop alive */ }
  }, 5 * 60 * 1000);
}

module.exports = { startActiveLoop };
