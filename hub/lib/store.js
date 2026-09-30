'use strict';
// Zero-dependency JSON store with atomic writes and debounced flush.
// Every mutation rewrites the whole file via tmp+rename (crash-safe).
// In-memory index caches are maintained by callers (see repo.js helpers).

const fs = require('fs');
const path = require('path');

class Store {
  constructor(file, seed) {
    this.file = file;
    this._timer = null;
    if (fs.existsSync(file)) {
      try {
        this.data = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (e) {
        // corrupt file: keep it as backup, rebuild from seed (error-rebuild principle)
        try { fs.copyFileSync(file, file + '.corrupt-' + Date.now()); } catch (_) {}
        this.data = typeof seed === 'function' ? seed() : seed;
        this.flush();
      }
    } else {
      this.data = typeof seed === 'function' ? seed() : seed;
      this.flush();
    }
  }

  touch() {
    if (this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = null;
      this.flush();
    }, 120);
  }

  flush() {
    const dir = path.dirname(this.file);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, '.' + path.basename(this.file) + '.tmp');
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1));
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { Store };
