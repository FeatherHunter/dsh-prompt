/**
 * dsh-prompt — 日志能力（客户端半，地图 #45 子票 #49）
 *
 * 客户端侧所有日志都从 `getLog()` 出去（六处 `console.*` 已全部收敛到这里，见 #48 的打点清单）。
 * 三件事：
 * 1) 建日志器：`dsh-log/client` 的 `createClientLog`，四个依赖由这里传入；宿主调用器桥接到
 *    `POST /_dsh/dsh-prompt/log`（复用现有 HTTP 桥，不新开通道），宿主那边再转给电话注册表。
 * 2) 事件闸门：与宿主半同一套规则、同一份清单（构建期内联仓库根的 `event-list.dsh-prompt.json`），
 *    在**入队前**就把未声明的字段丢掉——用户内容根本不上桥。清单不可用时失败关闭。
 * 3) 界面要用的开关动作：读当前值、写开关、启动对账、跨标签页广播、导出、清空。
 *
 * 对外只导出四个名字（结构规则：对外导出不超过五个）：`startLog`、`getLog`、`LOG_EVENTS`、`LogEvent`。
 *
 * 失败语义：日志能力不许拖垮界面。宿主不可达时只计数（`status()` 可读），调用方拿到的对象永远可用。
 */

import manifest from '../../../event-list.dsh-prompt.json'
import { createClientLog } from 'dsh-log/client'
import type { ClientLog, ClientLogDeps } from 'dsh-log/client'

/** 事件名联合类型：直接来自清单，写错事件名在编译期就报错。 */
export type LogEvent = keyof typeof manifest.events

/** 清单里的事件名列表（回归脚本用来与代码里的调用点对账）。 */
export const LOG_EVENTS: readonly string[] = Object.keys(manifest.events)

const ENDPOINT_DEFAULT = '/_dsh/dsh-prompt/log'
const MAX_EVENT_BYTES = 1024
const MAX_FIELD_CHARS = 32
const HASH_RE = /^[0-9a-f]{8}$/
const MANIFEST_FAIL_EVENT = 'host.log.manifest.fail'
const MANIFEST_FAIL_FIELDS = ['reason', 'errorHash']

/** 与宿主半同一张具名规则表（命中只记规则名不记原文）；两侧各一份，回归脚本用同一批样本交叉验证。 */
const RULE_TABLE: Array<[string, RegExp]> = [
  ['R_TOKEN', /(ghp_|gho_|github_pat_|bearer\s|sk-)[A-Za-z0-9_-]{8,}/i],
  ['R_WIN_ABS', /(^|[^A-Za-z0-9])[A-Za-z]:[\\/]/],
  ['R_HOME_PATH', /(users|home)[\\/][^\\/\s]+/i],
  ['R_URL', /https?:\/\//i],
  ['R_EMAIL', /[\w.+-]+@[\w-]+\.[A-Za-z]{2,}/],
]

export interface LogStatus {
  dropped: number
  undeclared: number
  droppedFields: number
  oversize: number
  scrubbed: number
  manifestOk: boolean
}

export interface LogExportResult {
  ok: boolean
  fileName?: string
  bytes?: number
  fallback?: boolean
  text?: string
  dir?: string
  path?: string
  reason?: string
}

export interface LogFacade {
  log(event: LogEvent | string, fields?: Record<string, unknown>): boolean
  isEnabled(event: LogEvent | string): boolean
  status(): LogStatus
  getSwitch(): { enabled: boolean; sampleRate: number }
  setSwitch(enabled: boolean): Promise<{ ok: boolean; enabled: boolean; error?: string }>
  reconcile(): Promise<{ ok: boolean; enabled: boolean }>
  exportLog(date?: string): Promise<LogExportResult>
  clearLog(scope?: 'day' | 'all'): Promise<{ ok: boolean; removed: number }>
  flush(): void
  /** 开关状态变化（对账、写入、跨标签页广播）时回调；返回取消订阅函数。 */
  subscribe(fn: () => void): () => void
  /** 仅回归脚本用：拿到底层日志器。 */
  raw(): ClientLog
}

interface ManifestEntry {
  level: string
  kind: string
  fields: string[]
  rules?: string[]
}

interface GateStats {
  undeclared: number
  droppedFields: number
  oversize: number
  scrubbed: number
}

/** 清单自检（形状规则与宿主半一致；构建期内联意味着它通常恒过，留着是为了坏构建能被看见）。 */
function manifestOk(): boolean {
  try {
    const value: any = manifest
    if (!value || value.version !== 1 || value.pluginId !== 'dsh-prompt') return false
    if (!value.events || typeof value.events !== 'object') return false
    return Object.values(value.events).every((entry: any) => entry && Array.isArray(entry.fields))
  } catch (e) {
    return false
  }
}

function hash8(value: unknown): string {
  try {
    const text = String(value ?? '')
    let h = 5381
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
    return ('0000000' + h.toString(16)).slice(-8)
  } catch (e) {
    return '00000000'
  }
}

/** 字段闸门（与宿主半同一套规则）：未声明事件整条丢、未声明字段丢字段、超 1KB 整条丢、清单坏则失败关闭。 */
function createGate(stats: GateStats) {
  const table = new Map<string, ManifestEntry>()
  const usable = manifestOk()
  if (usable) {
    for (const [name, entry] of Object.entries((manifest as any).events as Record<string, ManifestEntry>)) {
      table.set(name, entry)
    }
  }

  function coerce(field: string, value: unknown): { skip?: boolean; value?: unknown } {
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

  return {
    usable,
    levels: (() => {
      const levels: Record<string, string> = {}
      for (const [name, entry] of table) levels[name] = entry.level
      return levels
    })(),
    filter(event: string, fields?: Record<string, unknown>): { ok: boolean; level: string; fields: Record<string, unknown> } {
      const name = String(event || '')
      const entry = table.get(name)
      const isManifestFail = name === MANIFEST_FAIL_EVENT
      if (!entry && !isManifestFail) {
        // 清单可用：未声明事件整条丢弃；清单不可用：失败关闭只丢字段，事件名与级别保留（级别按 info 走开关闸门）。
        if (table.size > 0) {
          stats.undeclared += 1
          return { ok: false, level: 'info', fields: {} }
        }
        stats.undeclared += 1
        return { ok: true, level: 'info', fields: {} }
      }
      const declared = entry ? entry.fields : MANIFEST_FAIL_FIELDS
      const level = entry ? entry.level : 'warn'
      const input = fields && typeof fields === 'object' ? fields : {}
      const safe: Record<string, unknown> = {}
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
        return { ok: false, level, fields: {} }
      }
      if (line.length > MAX_EVENT_BYTES) {
        stats.oversize += 1
        return { ok: false, level, fields: {} }
      }
      return { ok: true, level, fields: safe }
    },
  }
}

export interface StartLogDeps {
  /** 桥的落点，默认 `/_dsh/dsh-prompt/log`。 */
  endpoint?: string
  /** 宿主调用器（有就优先用，回归脚本注入假宿主）。 */
  host?: ClientLogDeps['host']
  storage?: ClientLogDeps['storage']
  timer?: ClientLogDeps['timer']
  /** 跨标签页广播通道名，默认 `dsh-prompt-log`。 */
  channelName?: string
}

let current: LogFacade | null = null
const subscribers = new Set<() => void>()

function notify(): void {
  subscribers.forEach((fn) => {
    try {
      fn()
    } catch (e) { /* 订阅者自己的错不该拖垮日志 */ }
  })
}

/** 建日志能力并登记为当前实例（热重载重跑 apply 时以最后一次为准）。 */
export function startLog(deps: StartLogDeps = {}): LogFacade {
  const endpoint = deps.endpoint ?? ENDPOINT_DEFAULT
  const stats: GateStats = { undeclared: 0, droppedFields: 0, oversize: 0, scrubbed: 0 }
  const gate = createGate(stats)

  // 跨标签页：开关变化广播给同源其它标签页，收到的一方重读本地值并通知订阅者。
  let channel: any = null
  try {
    if (typeof BroadcastChannel !== 'undefined') channel = new BroadcastChannel(deps.channelName ?? 'dsh-prompt-log')
  } catch (e) { /* 无广播能力就退化为单页 */ }

  let clientLog: ClientLog
  const host: ClientLogDeps['host'] =
    deps.host ??
    {
      async call(name: string, args?: unknown) {
        try {
          if (typeof fetch === 'undefined') throw new Error('fetch-unavailable')
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name, args }),
          })
          if (!res.ok) throw new Error('http-' + res.status)
          const data: any = await res.json()
          if (!data || data.ok !== true) return { ok: false, error: data?.error ?? { code: 'bridge-rejected' } }
          return data.value
        } catch (e) {
          // 桥本身不通：这一条走不了桥，但仍要留下痕迹（下一次成功的转发会把它带上）。
          facade.log('bridge.call.fail', { phone: name, kind: typeof e === 'object' && e && 'message' in e ? String((e as Error).message).slice(0, 32) : 'bridge-error' })
          throw e
        }
      },
    }

  clientLog = createClientLog(
    {
      host,
      timer: deps.timer ?? null,
      storage: deps.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null),
      broadcastLogSwitch: channel ? () => { try { channel.postMessage({ on: clientLog.logSwitch.enabled }) } catch (e) { /* ignore */ } } : null,
    },
    { pluginId: 'dsh-prompt', eventList: manifest },
  )

  if (channel) {
    try {
      channel.addEventListener('message', (ev: any) => {
        const on = !!(ev && ev.data && ev.data.on)
        clientLog.logSwitch.enabled = on
        facade.log('settings.log.broadcast', { on })
        notify()
      })
    } catch (e) { /* ignore */ }
  }

  const facade: LogFacade = {
    log(event, fields) {
      const res = gate.filter(String(event), fields)
      if (!res.ok) return false
      try {
        clientLog.log(res.level, String(event), res.fields)
        return true
      } catch (e) {
        return false
      }
    },
    isEnabled(event) {
      if (gate.usable && !gate.levels[String(event)]) return false
      try {
        return clientLog.isEnabled(gate.levels[String(event)] ?? 'info')
      } catch (e) {
        return false
      }
    },
    status: () => ({
      dropped: clientLog.getDroppedCount(),
      undeclared: stats.undeclared,
      droppedFields: stats.droppedFields,
      oversize: stats.oversize,
      scrubbed: stats.scrubbed,
      manifestOk: gate.usable,
    }),
    getSwitch: () => ({ enabled: clientLog.logSwitch.enabled, sampleRate: clientLog.logSwitch.sampleRate }),
    async setSwitch(enabled) {
      const res = await clientLog.setLogSwitch(enabled, 1)
      notify()
      return { ok: !!res?.ok, enabled: !!(res?.enabled ?? clientLog.logSwitch.enabled), error: res?.error }
    },
    async reconcile() {
      const res = await clientLog.reconcileLogSwitch()
      facade.log('settings.log.reconcile', { ok: !!res?.ok, on: !!res?.enabled })
      notify()
      return { ok: !!res?.ok, enabled: !!res?.enabled }
    },
    async exportLog(date) {
      try {
        const res: any = await host!.call(clientLog.phoneNames.logExport, date ? { date } : {})
        const out: LogExportResult = {
          ok: !!res?.ok,
          fileName: res?.fileName,
          bytes: res?.bytes,
          fallback: res?.fallback,
          text: res?.text,
          dir: res?.dir,
          path: res?.path,
        }
        if (out.ok) facade.log('settings.log.export', { ok: true, bytes: out.bytes ?? 0, fallback: !!out.fallback })
        else {
          out.reason = res?.error?.code ?? 'export-failed'
          facade.log('settings.log.export.fail', { reason: out.reason, errorHash: hash8(out.reason) })
        }
        return out
      } catch (e) {
        const reason = 'host-unreachable'
        facade.log('settings.log.export.fail', { reason, errorHash: hash8(String((e as Error)?.message ?? e)) })
        return { ok: false, reason }
      }
    },
    async clearLog(scope = 'all') {
      try {
        const res: any = await host!.call(clientLog.phoneNames.logClear, { date: scope === 'day' ? undefined : 'all' })
        const out = { ok: !!res?.ok, removed: Number(res?.removed ?? 0) }
        facade.log('settings.log.clear', out)
        return out
      } catch (e) {
        facade.log('settings.log.clear', { ok: false, removed: 0 })
        return { ok: false, removed: 0 }
      }
    },
    flush() {
      try {
        clientLog.flush()
      } catch (e) { /* ignore */ }
    },
    subscribe(fn) {
      subscribers.add(fn)
      return () => {
        subscribers.delete(fn)
      }
    },
    raw: () => clientLog,
  }

  current = facade
  return facade
}

/** 取当前实例；没建过就返回空操作实例，调用点不必判空。 */
export function getLog(): LogFacade {
  if (current) return current
  const noop: LogFacade = {
    log: () => false,
    isEnabled: () => false,
    status: () => ({ dropped: 0, undeclared: 0, droppedFields: 0, oversize: 0, scrubbed: 0, manifestOk: false }),
    getSwitch: () => ({ enabled: false, sampleRate: 1 }),
    setSwitch: async (enabled) => ({ ok: false, enabled, error: 'log-not-started' }),
    reconcile: async () => ({ ok: false, enabled: false }),
    exportLog: async () => ({ ok: false, reason: 'log-not-started' }),
    clearLog: async () => ({ ok: false, removed: 0 }),
    flush: () => undefined,
    subscribe: () => () => undefined,
    raw: () => null as unknown as ClientLog,
  }
  return noop
}
