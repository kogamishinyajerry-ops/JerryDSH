// dsh-usage-insights — DSH 使用洞察
// 宿主侧：监听会话事件流做聚合统计，按需回填历史会话，经 webServer 提供仪表盘。
// 事件形状按公开契约做防御式读取（duck-typing），零 npm 依赖（源码目录直装也可解析）。
import { mkdirSync, writeFileSync, renameSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

export const name = 'dsh-usage-insights'

// 不导出 Config schema（零依赖）：在 apply 里做配置归一化 + 容错。
function normalizeConfig(raw) {
  const c = raw && typeof raw === 'object' ? raw : {}
  const num = (v, dflt) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : dflt)
  const str = (v, dflt) => (typeof v === 'string' && v ? v : dflt)
  return {
    dataDir: str(c.dataDir, ''),
    writeIntervalMs: num(c.writeIntervalMs, 30_000),
    flushEveryEvents: num(c.flushEveryEvents, 200),
    skillToolName: str(c.skillToolName, 'skill'),
    snapshotTtlMs: num(c.snapshotTtlMs, 60_000),
  }
}

// ---------------------------------------------------------------- state

const dayKey = (t) => new Date(t).toISOString().slice(0, 10)

const STATS_SCHEMA = 2 // 2: timeline 计数排除 assistant/chunk 流式碎片

function emptyStats() {
  return {
    schema: STATS_SCHEMA,
    since: Date.now(),
    updatedAt: 0,
    eventCount: 0,
    eventTypes: {},          // 事件类型直方图
    turnEnds: {},            // turn/end 原因直方图
    sources: {},             // user/message 注入来源 kind 直方图
    tools: {},               // name -> {calls, errors, lastAt, firstAt, totalMs, samples}
    skills: {},              // 技能名 -> {calls, lastAt}
    mcp: {},                 // mcp server -> 调用数
    roster: {},              // 模型可见工具名册（来自 request/header 信封）：name -> {firstAt, lastAt}
    models: {},              // 'provider/model' -> {calls, tokens}
    sessions: {},            // sessionId -> {countedSeq, events, turns, toolCalls, errors, tokens, firstAt, lastAt, cwd}
    timeline: {},            // 'YYYY-MM-DD' -> {events, toolCalls, turns, tokensOut}
  }
}

function emptyTool() {
  return { calls: 0, errors: 0, totalMs: 0, firstAt: 0, lastAt: 0 }
}

export function apply(ctx, rawConfig) {
  const config = normalizeConfig(rawConfig)
  const root = config.dataDir || process.env.DSH_HOME || path.join(homedir(), '.dsh')
  const dir = path.join(root, 'usage-insights')
  const statsPath = path.join(dir, 'stats.json')
  const importPath = path.join(dir, 'imported.json')

  let stats = emptyStats()
  try {
    const raw = JSON.parse(readFileSync(statsPath, 'utf8'))
    if (raw && raw.schema === STATS_SCHEMA) stats = raw
  } catch { /* 首次运行或损坏：从零开始，绝不因坏文件崩 */ }

  let imported = {}
  if (stats.schema === STATS_SCHEMA) {
    // 统计口径升级时两者一起作废：强制全量重导，避免新旧口径混算
    try { imported = JSON.parse(readFileSync(importPath, 'utf8')) || {} } catch { /* 同上 */ }
  }

  // 可选服务捕获：属性访问需 inject 声明（ctx.get 仅做存在性探测）
  let toolsSvc = null
  let skillsSvc = null
  ctx.inject(['tools', 'skills'], (sctx) => {
    toolsSvc = sctx.tools
    skillsSvc = sctx.skills
    sctx.effect(() => () => { toolsSvc = null; skillsSvc = null })
  })

  let dirtySinceFlush = 0
  let pendingCall = new Map() // callId -> {name, at}（tool/call 与 tool/result 配对，容量有界）
  const backfill = { running: false, done: 0, total: 0, lastError: '', startedAt: 0, finishedAt: 0 }
  let snapshotCache = { at: 0, value: null }

  const atomicWrite = (file, obj) => {
    const tmp = file + '.tmp'
    writeFileSync(tmp, JSON.stringify(obj), 'utf8')
    renameSync(tmp, file)
  }
  const flush = () => {
    try {
      mkdirSync(dir, { recursive: true })
      stats.updatedAt = Date.now()
      atomicWrite(statsPath, stats)
      atomicWrite(importPath, imported)
      dirtySinceFlush = 0
    } catch (e) { ctx.logger?.warn?.(`usage-insights: 落盘失败（保持内存态，稍后自愈）：${e?.message ?? e}`) }
  }

  // ------------------------------------------------ 事件折叠（live 与回填共用一条路径）

  function applyEvent(session, ev) {
    const d = ev?.data ?? {}
    const sid = String(session?.id ?? ev?.sessionId ?? '_unknown')
    const s = (stats.sessions[sid] ??= { countedSeq: -1, events: 0, turns: 0, toolCalls: 0, errors: 0, tokens: { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 }, firstAt: ev.time, lastAt: ev.time, cwd: '' })
    if (ev.seq <= s.countedSeq) return // 单调 seq 去重：live 与回填、重复回填互不双计
    s.countedSeq = ev.seq
    s.events++
    s.lastAt = ev.time
    if (session?.header?.cwd) s.cwd = session.header.cwd
    stats.eventCount++
    stats.eventTypes[ev.type] = (stats.eventTypes[ev.type] ?? 0) + 1
    const day = dayKey(ev.time)
    const tl = (stats.timeline[day] ??= { events: 0, toolCalls: 0, turns: 0, tokensOut: 0 })
    if (ev.type !== 'assistant/chunk') tl.events++

    switch (ev.type) {
      case 'tool/call': {
        const name = String(d.name ?? '?')
        const t = (stats.tools[name] ??= emptyTool())
        t.calls++
        if (!t.firstAt) t.firstAt = ev.time
        t.lastAt = ev.time
        s.toolCalls++
        tl.toolCalls++
        if (pendingCall.size > 2048) pendingCall.clear() // 有界：防失控流撑爆内存
        pendingCall.set(String(d.callId ?? ''), { name, at: ev.time })
        if (name.startsWith('mcp__')) {
          const server = name.split('__')[1] ?? '?'
          stats.mcp[server] = (stats.mcp[server] ?? 0) + 1
        }
        // 技能工具：解析参数里的技能名（尽力而为，失败不计数）
        if (name === config.skillToolName) {
          try {
            const args = JSON.parse(d.arguments ?? '{}')
            if (args?.name) {
              const sk = (stats.skills[args.name] ??= { calls: 0, lastAt: 0 })
              sk.calls++
              sk.lastAt = ev.time
            }
          } catch { /* 参数不是合法 JSON：忽略 */ }
        }
        break
      }
      case 'tool/result': {
        const callId = String(d?.message?.callId ?? '')
        const rec = pendingCall.get(callId)
        if (d.error) {
          const name = rec?.name ?? '(unknown)'
          const t = (stats.tools[name] ??= emptyTool())
          t.errors++
          s.errors++
        }
        if (rec) {
          const t = stats.tools[rec.name]
          if (t) t.totalMs += Math.max(0, ev.time - rec.at)
          pendingCall.delete(callId)
        }
        break
      }
      case 'assistant/message': {
        const u = d.usage
        if (u) {
          s.tokens.in += u.inputTokens ?? 0
          s.tokens.out += u.outputTokens ?? 0
          s.tokens.cacheRead += u.cacheReadTokens ?? 0
          s.tokens.cacheWrite += u.cacheWriteTokens ?? 0
          tl.tokensOut += u.outputTokens ?? 0
        }
        const src = d?.message?.source ?? {}
        const prov = src.provider ?? '?'
        const model = src.model ?? '?'
        const key = `${prov}/${model}`
        const m = (stats.models[key] ??= { calls: 0, tokens: { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 } })
        m.calls++
        if (u) {
          m.tokens.in += u.inputTokens ?? 0
          m.tokens.out += u.outputTokens ?? 0
          m.tokens.cacheRead += u.cacheReadTokens ?? 0
          m.tokens.cacheWrite += u.cacheWriteTokens ?? 0
        }
        break
      }
      case 'turn/end': {
        const kind = d?.reason?.kind ?? '?'
        stats.turnEnds[kind] = (stats.turnEnds[kind] ?? 0) + 1
        s.turns++
        tl.turns++
        break
      }
      case 'request/header': {
        const tools = Array.isArray(d?.header?.tools) ? d.header.tools : []
        for (const t of tools) {
          if (!t?.name) continue
          const r = (stats.roster[t.name] ??= { firstAt: ev.time, lastAt: ev.time })
          r.lastAt = ev.time
        }
        break
      }
      case 'user/message': {
        const kind = d?.source?.kind ?? 'user'
        stats.sources[kind] = (stats.sources[kind] ?? 0) + 1
        break
      }
      default:
        break
    }
  }

  ctx.on('session/event', (session, event) => {
    try {
      applyEvent(session, event)
      if (++dirtySinceFlush >= config.flushEveryEvents) flush()
    } catch (e) { ctx.logger?.warn?.(`usage-insights: 事件折叠异常（跳过该事件）：${e?.message ?? e}`) }
  })

  // ------------------------------------------------ “当前激活”探测

  const PROBE_SERVICES = [
    'tools', 'llm', 'sessions', 'sessionPersistence', 'sessionQuery', 'skills',
    'webServer', 'compaction', 'toolResultPruner', 'tokenMeter', 'sandboxPolicy',
    'sandbox', 'approval', 'permissionPresets', 'commands', 'jobs', 'terminals',
    'lsp', 'fs', 'shell', 'attachments', 'agents', 'subagents', 'agentTeams',
    'sessionProjections', 'sessionProjectionCache', 'interaction', 'credentials',
    'storageDomain', 'dshHomePath',
  ]

  function probeServices() {
    const active = []
    for (const n of PROBE_SERVICES) {
      try {
        const v = typeof ctx.get === 'function' ? ctx.get(n) : ctx[n]
        if (v !== undefined && v !== null) active.push(n)
      } catch { /* 探测失败视为未激活 */ }
    }
    return active
  }

  async function buildSnapshot() {
    const now = Date.now()
    if (snapshotCache.value && now - snapshotCache.at < config.snapshotTtlMs) return snapshotCache.value
    const snap = { activeServices: probeServices(), tools: [], skills: [] }
    if (toolsSvc && typeof toolsSvc.schemas === 'function') {
      try {
        snap.tools = (toolsSvc.schemas() ?? []).map((s) => ({ name: s?.name ?? '?', description: (s?.description ?? '').slice(0, 160) }))
      } catch (e) { ctx.logger?.warn?.(`usage-insights: 工具清单读取失败：${e?.message ?? e}`) }
    }
    if (skillsSvc && typeof skillsSvc.list === 'function') {
      try {
        snap.skills = (await skillsSvc.list() ?? []).map((k) => ({ name: k?.name ?? '?', description: (k?.description ?? '').slice(0, 160) }))
      } catch (e) { ctx.logger?.warn?.(`usage-insights: 技能目录读取失败：${e?.message ?? e}`) }
    }
    snapshotCache = { at: now, value: snap }
    return snap
  }

  // ------------------------------------------------ 历史回填（可选能力：sessionPersistence 在场才启用）

  let persistence = null
  ctx.inject(['sessionPersistence'], (pctx) => {
    persistence = pctx.sessionPersistence
    pctx.effect(() => () => { persistence = null })
  })

  async function runBackfill() {
    if (backfill.running || !persistence) return
    backfill.running = true
    backfill.done = 0
    backfill.lastError = ''
    backfill.startedAt = Date.now()
    try {
      const snaps = await persistence.listSnapshots()
      backfill.total = snaps.length
      for (const snap of snaps) {
        const id = String(snap?.header?.id ?? '')
        if (!id) { backfill.done++; continue }
        if (imported[id] === snap.revision) { backfill.done++; continue } // revision 未变：增量跳过
        try {
          const insp = await persistence.inspect(id)
          for (const ev of insp?.events ?? []) applyEvent({ id, header: insp?.meta }, ev)
          imported[id] = snap.revision
        } catch (e) {
          backfill.lastError = `会话 ${id.slice(0, 18)}… 导入失败：${e?.message ?? e}`
        }
        backfill.done++
        if (backfill.done % 10 === 0) flush()
      }
      backfill.finishedAt = Date.now()
    } catch (e) {
      backfill.lastError = String(e?.message ?? e)
    } finally {
      backfill.running = false
      flush()
    }
  }

  // ------------------------------------------------ 统计视图（给仪表盘的 JSON）

  function toolRows() {
    const now = Date.now()
    const all = Object.entries(stats.tools).map(([name, t]) => {
      const idleDays = t.lastAt ? Math.floor((now - t.lastAt) / 86_400_000) : Infinity
      const group = name.startsWith('mcp__') ? `mcp:${name.split('__')[1] ?? '?'}` : 'builtin'
      let tier = '闲置'
      if (t.calls === 0) tier = '未用'
      else if (idleDays <= 7 && t.calls >= 20) tier = '核心'
      else if (idleDays <= 14) tier = '常用'
      else if (idleDays <= 30) tier = '低频'
      return { name, group, ...t, avgMs: t.calls ? Math.round(t.totalMs / t.calls) : 0, errRate: t.calls ? +(t.errors / t.calls * 100).toFixed(1) : 0, idleDays, tier }
    })
    return all.sort((a, b) => b.calls - a.calls)
  }

  async function statsView() {
    const snap = await buildSnapshot()
    const sessions = Object.entries(stats.sessions)
      .map(([id, s]) => ({ id, ...s }))
      .sort((a, b) => b.lastAt - a.lastAt)
    const totals = sessions.reduce((acc, s) => {
      acc.toolCalls += s.toolCalls; acc.turns += s.turns; acc.errors += s.errors
      acc.tokens.in += s.tokens.in; acc.tokens.out += s.tokens.out
      acc.tokens.cacheRead += s.tokens.cacheRead; acc.tokens.cacheWrite += s.tokens.cacheWrite
      return acc
    }, { sessions: 0, toolCalls: 0, turns: 0, errors: 0, tokens: { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 } })
    totals.sessions = sessions.length
    return {
      plugin: { name, version: '0.1.0', since: stats.since, updatedAt: stats.updatedAt, eventCount: stats.eventCount },
      totals,
      backfill: { ...backfill, available: !!persistence },
      composition: { ...snap, roster: Object.entries(stats.roster)
        .map(([name, r]) => ({ name, ...r, used: (stats.tools[name]?.calls ?? 0) > 0 }))
        .sort((a, b) => a.name.localeCompare(b.name)) },
      tools: toolRows(),
      skills: Object.entries(stats.skills).map(([n, s]) => ({ name: n, ...s })).sort((a, b) => b.calls - a.calls),
      mcp: Object.entries(stats.mcp).map(([server, calls]) => ({ server, calls })).sort((a, b) => b.calls - a.calls),
      models: Object.entries(stats.models).map(([route, m]) => ({ route, ...m })).sort((a, b) => b.calls - a.calls),
      eventTypes: Object.entries(stats.eventTypes).map(([t, n]) => ({ type: t, count: n })).sort((a, b) => b.count - a.count),
      turnEnds: Object.entries(stats.turnEnds).map(([t, n]) => ({ kind: t, count: n })).sort((a, b) => b.count - a.count),
      sources: Object.entries(stats.sources).map(([k, n]) => ({ kind: k, count: n })).sort((a, b) => b.count - a.count),
      timeline: Object.entries(stats.timeline).map(([day, v]) => ({ day, ...v })).sort((a, b) => a.day.localeCompare(b.day)),
      sessions: sessions.slice(0, 50).map((s) => ({ ...s, tokens: undefined, tokenSummary: s.tokens })),
    }
  }

  // ------------------------------------------------ web 仪表盘（可选能力：webServer 在场才挂路由）
  ctx.inject(['webServer'], (wctx) => {
    const send = (res, code, type, body) => {
      res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' })
      res.end(body)
    }
    const sendJson = (res, code, obj) => send(res, code, 'application/json; charset=utf-8', JSON.stringify(obj))

    const disposers = []
    try {
    disposers.push(wctx.webServer.register({
      kind: 'exact', path: '/usage-insights',
      handler: async (_req, res) => send(res, 200, 'text/html; charset=utf-8', (await import('./dashboard.js')).DASHBOARD_HTML()),
    }))
    disposers.push(wctx.webServer.register({
      kind: 'exact', path: '/usage-insights/api/stats',
      handler: async (_req, res) => {
        try { sendJson(res, 200, await statsView()) }
        catch (e) { sendJson(res, 500, { error: String(e?.message ?? e) }) }
      },
    }))
    disposers.push(wctx.webServer.register({
      kind: 'exact', path: '/usage-insights/api/backfill',
      handler: async (req, res) => {
        if (req.method !== 'POST') { sendJson(res, 405, { error: 'POST only' }); return }
        if (!persistence) { sendJson(res, 409, { error: 'sessionPersistence 服务不可用：当前组合没有可回填的持久化后端' }); return }
        if (backfill.running) { sendJson(res, 202, { started: false, running: true }); return }
        void runBackfill()
        sendJson(res, 200, { started: true })
      },
    }))
    } catch (e) { ctx.logger?.warn?.(`usage-insights: 路由注册失败：${e?.message ?? e}`) }
    wctx.effect(() => () => { disposers.forEach((d) => d()) })
  })

  // ------------------------------------------------ 生命周期（原生定时器：不依赖 timer 服务）

  const flushTimer = setInterval(() => flush(), config.writeIntervalMs)
  ctx.effect(() => () => { clearInterval(flushTimer); flush() })
}
