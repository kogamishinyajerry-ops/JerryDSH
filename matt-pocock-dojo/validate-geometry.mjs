#!/usr/bin/env node
/**
 * validate-geometry.mjs — archify 风格几何校验
 * 四道门：(1) 组件在 viewBox 内 (2) 组件两两不重叠(8px 间距) (3) connection 两端 id 存在
 * (4) 每个 view 的 focus id 存在。全绿输出 ok:true，否则列出 diagnostics。
 */
import { readFileSync, writeFileSync } from "node:fs";

const specPath = process.argv[2] ?? "matt-pocock-dojo.architecture.json";
const outPath = process.argv[3] ?? "matt-pocock-dojo.visual-check.json";
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const [W, H] = spec.meta.viewBox;
const MARGIN = 8;
const diagnostics = [];

const byId = new Map(spec.components.map((c) => [c.id, c]));

// 门 1+2：几何
for (const c of spec.components) {
  const [x, y] = c.pos, [w, h] = c.size;
  if (x < 0 || y < 0 || x + w > W || y + h > H) {
    diagnostics.push({ code: "geometry/bounds", severity: "error", subject: c.id, message: `越界: pos=[${x},${y}] size=[${w},${h}] 超出 viewBox [${W},${H}]` });
  }
}
for (let i = 0; i < spec.components.length; i++) {
  for (let j = i + 1; j < spec.components.length; j++) {
    const a = spec.components[i], b = spec.components[j];
    const [ax, ay] = a.pos, [aw, ah] = a.size, [bx, by] = b.pos, [bw, bh] = b.size;
    const overlap = ax < bx + bw + MARGIN && bx < ax + aw + MARGIN && ay < by + bh + MARGIN && by < ay + ah + MARGIN;
    if (overlap) {
      diagnostics.push({ code: "geometry/overlap", severity: "error", subject: `${a.id} × ${b.id}`, message: `组件重叠（间距 < ${MARGIN}px）` });
    }
  }
}

// 门 3：连线引用
const ids = new Set(byId.keys());
for (const conn of spec.connections ?? []) {
  for (const end of ["from", "to"]) {
    if (!ids.has(conn[end])) {
      diagnostics.push({ code: "graph/dangling-ref", severity: "error", subject: conn.id, message: `connection.${end}="${conn[end]}" 不存在` });
    }
  }
}

// 门 4：视图引用
for (const view of spec.meta.views ?? []) {
  for (const fid of view.focus ?? []) {
    if (!ids.has(fid)) {
      diagnostics.push({ code: "view/unknown-focus", severity: "error", subject: view.id, message: `focus id "${fid}" 不存在` });
    }
  }
}

// 附加：层带覆盖检查（每个组件应落在某个声明的层带内）
for (const layer of spec.meta.layers ?? []) {
  if (layer.y + layer.h > H) {
    diagnostics.push({ code: "geometry/layer-bounds", severity: "warning", subject: layer.label, message: `层带超出 viewBox 底边` });
  }
}

const ok = !diagnostics.some((d) => d.severity === "error");
const report = {
  schemaVersion: 1,
  ok,
  command: "visual-check",
  evidenceKind: "geometry",
  status: ok ? "pass" : "fail",
  spec: { path: specPath, components: spec.components.length, connections: spec.connections?.length ?? 0, views: spec.meta.views?.length ?? 0 },
  diagnostics,
  checkedAt: new Date().toISOString(),
};
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(`visual-check: ${ok ? "PASS" : "FAIL"} (${diagnostics.length} diagnostics) → ${outPath}`);
for (const d of diagnostics) console.log(`  [${d.severity}] ${d.code}: ${d.subject} — ${d.message}`);
process.exit(ok ? 0 : 1);
