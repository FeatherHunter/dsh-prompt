/**
 * dsh-prompt — 事件闸门（日志能力的内部模块，两端共用同一份实现）
 *
 * 为什么单独一个文件：这道闸门是"prompt 正文与模板名称绝不进日志"的**唯一机械保证**，
 * 客户端（构建期内联）与宿主（运行期同目录 import）必须跑同一套规则。分成两份实现会漂移，
 * 而漂移是这类"靠人自觉"的老路——本票要的正是机械保证。
 *
 * 闸门规则（与 #48 定稿一致）：
 * - 事件未声明：清单可用时整条丢弃；清单不可用时失败关闭，只放行事件名与级别（字段全丢）。
 * - 字段未声明：丢弃该字段并计数，不静默改写。
 * - 字段值：`*Hash` 必须是 8 位十六进制（不是就用 hash8 就地散列）；布尔与数字照记；
 *   字符串先过具名规则网（命中就换成规则名），再截到 32 字符。
 * - 单条序列化后超过 1KB：整条丢弃并计数（满批 50 条 × 1KB = 50KB，落在桥的 64KB 收包上限内）。
 *
 * 这个文件不许 import 任何 node 内置模块：它要能被浏览器侧的客户端 bundle 内联。
 */

export const MAX_EVENT_BYTES = 1024
export const MAX_FIELD_CHARS = 32
export const HASH_RE = /^[0-9a-f]{8}$/
/** 清单不可用时仍然放行的唯一事件（自报故障，字段硬编码），否则失败关闭会把告警本身吞掉。 */
export const MANIFEST_FAIL_EVENT = 'host.log.manifest.fail'
const MANIFEST_FAIL_FIELDS = ['reason', 'errorHash']

/** 第二道网：具名规则命中就把该字段值换成规则名，不记原文。白名单是主防线，这里只兜已知高危形状。 */
export const RULE_TABLE = [
  ['R_TOKEN', /(ghp_|gho_|github_pat_|bearer\s|sk-)[A-Za-z0-9_-]{8,}/i],
  ['R_WIN_ABS', /(^|[^A-Za-z0-9])[A-Za-z]:[\\/]/],
  ['R_HOME_PATH', /(users|home)[\\/][^\\/\s]+/i],
  ['R_URL', /https?:\/\//i],
  ['R_EMAIL', /[\w.+-]+@[\w-]+\.[A-Za-z]{2,}/],
]

/** 与包内 `hash8` 同形（把没散列、或形状不对的值就地散列，只用来判断同一性）。 */
export function hash8(value) {
  try {
    const text = String(value ?? '')
    let h = 5381
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
    return ('0000000' + h.toString(16)).slice(-8)
  } catch (e) {
    return '00000000'
  }
}

/** 清单最小形状自检：version 1、pluginId 是 dsh-prompt、events 里每条都有 fields 数组。 */
export function summarizeManifest(raw, pluginId = 'dsh-prompt') {
  try {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'shape-fail', table: null }
    if (raw.version !== 1 || raw.pluginId !== pluginId) return { ok: false, reason: 'shape-fail', table: null }
    if (!raw.events || typeof raw.events !== 'object' || Array.isArray(raw.events)) {
      return { ok: false, reason: 'shape-fail', table: null }
    }
    const table = new Map()
    for (const [name, entry] of Object.entries(raw.events)) {
      if (!entry || typeof entry !== 'object' || !Array.isArray(entry.fields)) {
        return { ok: false, reason: 'shape-fail', table: null }
      }
      table.set(name, { level: entry.level, kind: entry.kind, fields: entry.fields })
    }
    return { ok: true, reason: 'ok', table }
  } catch (e) {
    return { ok: false, reason: 'shape-fail', table: null }
  }
}

/**
 * 建闸门。`raw` 是清单原对象（不合规即失败关闭）；返回的 `filter` 是唯一写入前关口。
 * `onWarn` 可选，用于把"清单不可用"这件事通知给调用方（宿主往 stderr 说一次，客户端不吭声）。
 */
export function createEventGate(raw, options = {}) {
  const summary = summarizeManifest(raw, options.pluginId ?? 'dsh-prompt')
  const table = summary.table ?? new Map()
  const stats = { undeclared: 0, droppedFields: 0, oversize: 0, scrubbed: 0 }
  let warned = false

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
      if (table.size > 0) {
        // 清单可用：没声明过的事件整条丢弃（宁可不记，也不放出计划外的事件名）。
        stats.undeclared += 1
        return { ok: false, reason: 'undeclared-event', level: 'info', fields: {} }
      }
      // 清单不可用：失败关闭——只留事件名与级别（无据可依，一律按 info 走开关闸门），字段全丢。
      if (!warned) {
        warned = true
        try {
          options.onWarn?.('事件清单不可用，日志字段已按失败关闭处理（只记事件名与级别）。')
        } catch (e) { /* 告警失败不影响闸门 */ }
      }
      stats.undeclared += 1
      return { ok: true, reason: 'no-manifest', level: 'info', fields: {} }
    }
    const declared = entry ? entry.fields : MANIFEST_FAIL_FIELDS
    const level = entry ? entry.level : 'warn'
    const input = fields && typeof fields === 'object' ? fields : {}
    const safe = {}
    for (const [key, value] of Object.entries(input)) {
      if (declared.indexOf(key) < 0) {
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
