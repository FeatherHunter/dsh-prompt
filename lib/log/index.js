/**
 * dsh-prompt — 日志能力（宿主半，地图 #45 子票 #49）
 *
 * 这个文件是**日志能力的唯一入口**：宿主侧所有日志都从这里出去，别的文件不许再开第二个出口
 * （`console.*` 与 `ctx.logger.*` 一律收敛到这里，事件清单见仓库根 `event-list.dsh-prompt.json`）。
 *
 * 四件事，按依赖顺序：
 * 1) 落盘适配器 `createLogSink`：用 `node:fs/promises` 自建 dsh-log 要的文件服务，落 `~/.dsh/logs`。
 *    为什么不走 `ctx.fs`：它的围栏只挂 `writeText`/`editText`，workspace-write 的可写集不含 `~/.dsh`，
 *    而且它连 `mkdir`/`unlink` 都没有（建目录与清空都做不到）。依据：ADR 0001 与 #46 调研。
 *    主目录写不进去就降级到 `os.tmpdir()/dsh-prompt`，再失败就彻底不落盘、只往 stderr 告警一次。
 * 2) 事件闸门 `createEventGate`：字段白名单硬拦。清单没声明的字段丢弃，没声明的事件整条丢弃，
 *    单条序列化超过 1KB 整条丢弃。清单不可用时**失败关闭**（只放行事件名与级别，字段全丢）。
 * 3) 日志库与电话：`dsh-log/host` 建库（`pluginId = dsh-prompt`，显式覆盖 `logDirName = dsh-prompt`），
 *    注册五个电话，再在注册表上包一层，把日志电话的调用记成宿主侧事件。
 * 4) 电话调用口 `runPhone`：给 HTTP 桥用，客户端经 `POST /_dsh/dsh-prompt/log` 进来。
 *
 * 对外只导出五个名字（结构规则：对外导出不超过五个）：`createLogCapability`、`installLogCapability`、
 * `createLogSink`、`loadEventList`、`LOG_ROUTE_PATH`。
 *
 * 失败语义：日志能力**不许拖垮插件**。dsh-log 装不上、清单读不出、目录写不进，都只降级或往 stderr 告警一次；
 * 调用方拿到的实例永远可用（最差是空操作），HTTP 路由据此回一个明确的失败结构，不静默。
 */

import { readFileSync as readFileSyncNode } from 'node:fs'
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** 客户端把日志电话打进来的路由（复用现有 HTTP 桥前缀 `/_dsh/dsh-prompt`，不新开通道）。 */
export const LOG_ROUTE_PATH = '/_dsh/dsh-prompt/log'

const PLUGIN_ID = 'dsh-prompt'
/** 显式覆盖：默认派生是 `logs-dsh-prompt`，本插件要的是 `<home>/logs/dsh-prompt`。 */
const LOG_DIR_NAME = 'dsh-prompt'
const SINGLETON_KEY = '__dshPromptLogCapability'
const MAX_EVENT_BYTES = 1024
const MAX_FIELD_CHARS = 32
const HASH_RE = /^[0-9a-f]{8}$/
/** 清单不可用时仍然放行的唯一事件（自报故障，字段硬编码），否则失败关闭会把它自己的告警也吞掉。 */
const MANIFEST_FAIL_EVENT = 'host.log.manifest.fail'
const MANIFEST_FAIL_FIELDS = ['reason', 'errorHash']

/** 第二道网：具名规则命中就把该字段值换成规则名，不记原文。白名单是主防线，这里只兜已知高危形状。 */
const RULE_TABLE = [
  ['R_TOKEN', /(ghp_|gho_|github_pat_|bearer\s|sk-)[A-Za-z0-9_-]{8,}/i],
  ['R_WIN_ABS', /(^|[^A-Za-z0-9])[A-Za-z]:[\\/]/],
  ['R_HOME_PATH', /(users|home)[\\/][^\\/\s]+/i],
  ['R_URL', /https?:\/\//i],
  ['R_EMAIL', /[\w.+-]+@[\w-]+\.[A-Za-z]{2,}/],
]

/** 与包内 `hash8` 同形的散列（把调用方没散列、或形状不对的值就地散列）。 */
function hash8(value) {
  try {
    const text = String(value ?? '')
    let h = 5381
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
    return ('0000000' + h.toString(16)).slice(-8)
  } catch (e) {
    return '00000000'
  }
}

const stderrWarned = new Set()
/** 降级告警只往 stderr 打一次（同一条原因不重复刷屏）。 */
function warnOnce(key, message) {
  if (stderrWarned.has(key)) return
  stderrWarned.add(key)
  try {
    process.stderr.write(`[dsh-prompt] ${message}\n`)
  } catch (e) { /* stderr 都写不了就彻底放弃告警 */ }
}

/** `$DSH_HOME`（空白视为未设置）→ `~/.dsh`；与平台 home-paths 库同一套优先级，本仓不依赖那个库。 */
function resolveDshHome(env) {
  const raw = typeof env?.DSH_HOME === 'string' ? env.DSH_HOME.trim() : ''
  if (raw) return path.resolve(raw)
  return path.join(homedir(), '.dsh')
}

/* ── 1) 落盘适配器 ───────────────────────────────────────────────────── */

/**
 * 建 dsh-log 要的文件服务与目录取值器。
 * 形状按 dsh-log `INTEGRATION.md` 步骤 2 的形状表：`resolve` 回目标对象，`readText`/`writeText` 读写原文，
 * `mkdir`/`unlink`/`listDir` 管目录与删除；`getPlatform()` 回 `{ os, path, fs }`。
 */
export function createLogSink(options = {}) {
  const env = options.env ?? process.env
  const home = options.home ?? resolveDshHome(env)
  const primaryDir = path.join(home, 'logs')
  const fallbackDir = options.fallbackDir ?? path.join(tmpdir(), PLUGIN_ID)
  const fsImpl = options.fsImpl ?? { mkdir, readFile, readdir, unlink, writeFile }
  let degraded = false
  let probeDone = false

  /** 降级后，凡落在主目录下的路径一律改写到降级目录（日志文件与开关文件一起搬）。 */
  function mapPath(target) {
    const text = typeof target === 'string' ? target : (target?.path ?? '')
    if (!degraded || !text) return text
    if (text === primaryDir) return fallbackDir
    if (text.startsWith(primaryDir + path.sep)) return fallbackDir + text.slice(primaryDir.length)
    return text
  }

  function degrade(reason, error) {
    if (degraded) return
    degraded = true
    warnOnce(
      'degrade',
      `日志落盘降级到 ${fallbackDir}（原因：${reason}；${error?.message || error || '写入被拒'}）。` +
        `主目录 ${primaryDir} 写不进去时不再重试，重启后重新探测。`,
    )
  }

  /** 主目录可写探测：建目录 + 写探针文件再删掉。探测不过就降级，免得第一次写盘白丢一批。 */
  async function probePrimary() {
    if (probeDone) return
    probeDone = true
    try {
      await fsImpl.mkdir(path.join(primaryDir, LOG_DIR_NAME), { recursive: true })
      const probe = path.join(primaryDir, LOG_DIR_NAME, '.write-probe')
      await fsImpl.writeFile(probe, '')
      await fsImpl.unlink(probe).catch(() => undefined)
    } catch (e) {
      degrade('probe-fail', e)
    }
  }

  function isPrimary(target) {
    const text = typeof target === 'string' ? target : (target?.path ?? '')
    return text === primaryDir || text.startsWith(primaryDir + path.sep)
  }

  /** 主目录下的写操作失败 → 切降级 → 就地重试一次；降级后仍失败就原样抛（包侧只计数不抛）。 */
  async function writeThrough(target, run) {
    await probePrimary()
    const mapped = mapPath(target)
    try {
      return await run(mapped)
    } catch (e) {
      if (!degraded && isPrimary(mapped)) {
        degrade('write-fail', e)
        return await run(mapPath(target))
      }
      throw e
    }
  }

  const fs = {
    async resolve(target) {
      const mapped = mapPath(target)
      return { path: mapped, displayPath: mapped }
    },
    async readText(target) {
      return await fsImpl.readFile(mapPath(target), 'utf8')
    },
    async writeText(target, text) {
      return await writeThrough(target, async (mapped) => {
        await fsImpl.mkdir(path.dirname(mapped), { recursive: true })
        await fsImpl.writeFile(mapped, String(text ?? ''), 'utf8')
      })
    },
    async mkdir(target) {
      return await writeThrough(target, async (mapped) => {
        await fsImpl.mkdir(mapped, { recursive: true })
      })
    },
    async unlink(target) {
      return await writeThrough(target, async (mapped) => {
        await fsImpl.unlink(mapped)
      })
    },
    async listDir(target) {
      try {
        const entries = await fsImpl.readdir(mapPath(target))
        return entries.map((name) => String(name))
      } catch (e) {
        return []
      }
    },
  }

  return {
    fs,
    getPlatform: () => ({ os: process.platform, path, fs }),
    getCacheDir: async () => {
      await probePrimary()
      return primaryDir
    },
    paths: { home, primaryDir, fallbackDir, logDirName: LOG_DIR_NAME },
    isDegraded: () => degraded,
  }
}

/* ── 2) 事件清单与字段闸门 ───────────────────────────────────────────── */

/**
 * 读清单并做最小自检（完整形状规则由 dsh-log 的三个检查器界定，回归脚本负责跑那三个）。
 * 返回 `{ ok, reason, errorHash, raw }`；`raw` 是给 dsh-log 建库用的原对象（它自己还会再验一遍形状）。
 */
export function loadEventList(source) {
  try {
    let raw
    if (typeof source === 'string' || source instanceof URL) {
      const target = source instanceof URL ? fileURLToPath(source) : source
      raw = JSON.parse(readFileSyncNode(target, 'utf8'))
    } else {
      raw = source
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, reason: 'shape-fail', errorHash: hash8('not-object'), raw: null }
    }
    if (raw.version !== 1 || raw.pluginId !== PLUGIN_ID) {
      return { ok: false, reason: 'shape-fail', errorHash: hash8('version-or-plugin'), raw: null }
    }
    if (!raw.events || typeof raw.events !== 'object' || Array.isArray(raw.events)) {
      return { ok: false, reason: 'shape-fail', errorHash: hash8('no-events'), raw: null }
    }
    for (const [name, entry] of Object.entries(raw.events)) {
      if (!entry || typeof entry !== 'object' || !Array.isArray(entry.fields)) {
        return { ok: false, reason: 'shape-fail', errorHash: hash8('bad-entry:' + name), raw: null }
      }
    }
    return { ok: true, reason: 'ok', errorHash: '', raw }
  } catch (e) {
    return { ok: false, reason: 'read-fail', errorHash: hash8(e?.message || e), raw: null }
  }
}

/**
 * 字段闸门：唯一写入前的关口。
 * - 未声明事件 → 整条丢弃；未声明字段 → 丢弃该字段并计数。
 * - 清单不可用 → 失败关闭（只放行事件名与级别，字段全丢），唯一例外是清单故障事件本身。
 * - 单条序列化 > 1KB → 整条丢弃（满批 50 条 × 1KB = 50KB，落在桥的 64KB 收包上限内）。
 */
function createEventGate(loaded) {
  const stats = { undeclared: 0, droppedFields: 0, oversize: 0, scrubbed: 0 }
  const table = new Map()
  if (loaded.ok) {
    for (const [name, entry] of Object.entries(loaded.raw.events)) {
      table.set(name, {
        level: entry.level,
        kind: entry.kind,
        fields: new Set(entry.fields),
        rules: new Set(Array.isArray(entry.rules) ? entry.rules : []),
      })
    }
  }

  function coerce(field, value) {
    if (value === undefined || value === null) return { skip: true }
    if (/Hash$/.test(field)) {
      const text = String(value)
      return { value: HASH_RE.test(text) ? text : hash8(text) }
    }
    if (typeof value === 'boolean') return { value }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return { skip: true }
      return { value: Number.isInteger(value) ? value : Math.round(value) }
    }
    let text = String(value)
    // 规则网无条件生效（清单里的 rules 是书面声明，不当作开关）：第二道网一旦要逐条声明就会烂掉。
    for (const [ruleName, re] of RULE_TABLE) {
      if (re.test(text)) {
        text = ruleName
        stats.scrubbed += 1
        break
      }
    }
    return { value: text.length > MAX_FIELD_CHARS ? text.slice(0, MAX_FIELD_CHARS) : text }
  }

  function filter(event, fields) {
    const name = String(event || '')
    const entry = table.get(name)
    const isManifestFail = name === MANIFEST_FAIL_EVENT
    if (!entry && !isManifestFail) {
      // 清单可用：未声明事件整条丢弃。
      if (table.size > 0) {
        stats.undeclared += 1
        return { ok: false, reason: 'undeclared-event', level: 'info', fields: {} }
      }
      // 清单不可用：失败关闭只丢字段，事件名与级别保留（级别无据可依，一律按 info 走开关闸门）。
      warnOnce('no-manifest', '事件清单不可用，日志字段已按失败关闭处理（只记事件名与级别）。')
      stats.undeclared += 1
      return { ok: true, reason: 'no-manifest', level: 'info', fields: {} }
    }
    const declared = entry ? entry.fields : new Set(MANIFEST_FAIL_FIELDS)
    const level = entry ? entry.level : 'warn'
    const input = fields && typeof fields === 'object' ? fields : {}
    const safe = {}
    for (const [key, value] of Object.entries(input)) {
      if (!declared.has(key)) {
        stats.droppedFields += 1
        continue
      }
      const out = coerce(key, value)
      if (!out.skip) safe[key] = out.value
    }
    let line = ''
    try {
      line = JSON.stringify({ ts: 0, level, event: name, fields: safe })
    } catch (e) {
      return { ok: false, reason: 'unserializable', level, fields: {} }
    }
    if (line.length > MAX_EVENT_BYTES) {
      stats.oversize += 1
      return { ok: false, reason: 'oversize', level, fields: {} }
    }
    return { ok: true, reason: 'ok', level, fields: safe }
  }

  return {
    filter,
    stats,
    manifestOk: table.size > 0,
    isDeclared: (event) => table.has(String(event)),
    levelOf: (event) => (table.get(String(event))?.level ?? null),
    eventNames: () => [...table.keys()],
  }
}

/* ── 3) + 4) 日志库、电话与调用口 ─────────────────────────────────────── */

/**
 * 建日志能力实例。依赖全部可注入，回归脚本用假文件系统、假清单、假 dsh-log 跑。
 * options: { sink, manifestUrl, manifest（直接给对象）, dshLogHost（假的包入口）, env }
 */
export async function createLogCapability(options = {}) {
  const sink = options.sink ?? createLogSink({ env: options.env })
  const manifestUrl = options.manifestUrl ?? new URL('../../event-list.dsh-prompt.json', import.meta.url)
  const loaded = loadEventList(options.manifest !== undefined ? options.manifest : manifestUrl)
  const gate = createEventGate(loaded)

  let mod = options.dshLogHost ?? null
  if (!mod) {
    try {
      mod = await import('dsh-log/host')
    } catch (e) {
      warnOnce('dep-missing', `dsh-log 装不上（${e?.message || e}），本次不落盘。`)
      return degradedCapability(sink, gate, 'dep-load-fail')
    }
  }

  let hostLog
  try {
    hostLog = mod.createHostLog(
      {
        fs: sink.fs,
        getCacheDir: sink.getCacheDir,
        getPlatform: sink.getPlatform,
        DEFAULT_CWD: typeof process !== 'undefined' && process.cwd ? process.cwd() : '',
      },
      {
        pluginId: PLUGIN_ID,
        logDirName: LOG_DIR_NAME,
        eventList: loaded.ok ? loaded.raw : undefined,
      },
    )
  } catch (e) {
    warnOnce('store-fail', `日志库建不上（${e?.message || e}），本次不落盘。`)
    return degradedCapability(sink, gate, 'store-build-fail')
  }

  const registry = new Map()
  const phoneNames = mod.registerHostLogPhones(registry, hostLog)
  const store = hostLog.store

  const instance = {
    ok: true,
    store,
    registry,
    phoneNames,
    gate,
    sink,
    manifestOk: gate.manifestOk,
    log(event, fields) {
      const res = gate.filter(event, fields)
      if (!res.ok) return false
      try {
        store.log(res.level, event, res.fields)
        return true
      } catch (e) {
        return false
      }
    },
    isEnabled(event) {
      const level = gate.levelOf(event)
      if (!level) return false
      try {
        return store.isEnabled(level)
      } catch (e) {
        return false
      }
    },
    async runPhone(name, args) {
      const key = String(name || '')
      const handler = registry.get(key)
      if (typeof handler !== 'function') {
        return { ok: false, error: { code: 'unknown-phone', message: `unknown log phone: ${key}` } }
      }
      try {
        const value = await handler(args && typeof args === 'object' ? args : {})
        return { ok: true, value }
      } catch (e) {
        return { ok: false, error: { code: 'phone-failed', message: String(e?.message || e) } }
      }
    },
    stats: () => ({ ...gate.stats, degraded: sink.isDegraded() }),
    paths: () => sink.paths,
  }

  // 电话包一层：把日志电话的调用记成宿主侧事件（事件清单 18、19、20、29、30）。
  const raw = {}
  for (const action of ['logBatch', 'logExport', 'logClear', 'logGetSwitch', 'logSetSwitch']) {
    raw[action] = registry.get(phoneNames[action])
  }
  let batchCount = 0
  registry.set(phoneNames.logBatch, async (args) => {
    const res = await raw.logBatch(args)
    batchCount += 1
    if (batchCount % 20 === 1) {
      instance.log('host.log.batch', {
        entries: Array.isArray(args?.entries) ? args.entries.length : 0,
        accepted: res?.accepted,
        dropped: res?.dropped,
      })
    }
    return res
  })
  registry.set(phoneNames.logExport, async (args) => {
    const res = await raw.logExport(args)
    instance.log('host.log.export', {
      ok: !!res?.ok,
      bytes: res?.bytes,
      fallback: !!res?.fallback,
      date: typeof args?.date === 'string' ? args.date : '',
    })
    return res
  })
  registry.set(phoneNames.logClear, async (args) => {
    const res = await raw.logClear(args)
    instance.log('host.log.clear', {
      ok: !!res?.ok,
      removed: res?.removed,
      scope: args?.date === 'all' ? 'all' : 'day',
    })
    return res
  })
  registry.set(phoneNames.logGetSwitch, async () => {
    const res = await raw.logGetSwitch()
    instance.log('host.log.switch.get', { enabled: !!res?.enabled })
    return res
  })
  registry.set(phoneNames.logSetSwitch, async (args) => {
    const res = await raw.logSetSwitch(args)
    instance.log('host.log.switch.set', { enabled: res?.enabled ?? !!args?.enabled })
    return res
  })

  if (!loaded.ok) {
    instance.log(MANIFEST_FAIL_EVENT, { reason: loaded.reason, errorHash: loaded.errorHash })
  }
  try {
    // 先按需补一份默认开关文件再读回：包在开关文件不存在时会把「读不到」记成一条 log.persist.fail 告警，
    // 而首次安装本来就没有这个文件——那条告警是假警报，会把日志顶部搅浑。补一份即消除。
    const switchTarget = await sink.fs.resolve(path.join(sink.paths.primaryDir, store.config.switchFileName))
    let exists = true
    try {
      await sink.fs.readText(switchTarget)
    } catch (e) {
      exists = false
    }
    if (!exists) await store.setSwitch(false, 1)
    await store.loadSwitch()
    await store.writeStartupHeader()
  } catch (e) { /* 启动头与开关读失败不影响可用性，包侧会记 log.persist.fail */ }

  return instance
}

/** 能力彻底起不来时的空实例：调用方不必判空，最差是不落盘。 */
function degradedCapability(sink, gate, reason) {
  return {
    ok: false,
    reason,
    sink,
    gate,
    manifestOk: gate.manifestOk,
    log: () => false,
    isEnabled: () => false,
    async runPhone() {
      return { ok: false, error: { code: 'log-capability-unavailable', message: reason } }
    },
    stats: () => ({ ...gate.stats, degraded: true }),
    paths: () => sink.paths,
  }
}

/**
 * 进程级单例：热重载会重跑 `apply()`，但同一个日志目录不能有两个日志库实例
 * （dsh-log 明确警告多实例同写会写坏文件；本仓既有做法见 lib/index.js 的 STORE_KEY）。
 */
export async function installLogCapability(options = {}) {
  const g = globalThis
  if (g[SINGLETON_KEY]) return g[SINGLETON_KEY]
  const created = await createLogCapability(options)
  g[SINGLETON_KEY] = created
  return created
}
