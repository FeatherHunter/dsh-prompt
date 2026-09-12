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
import { createEventGate, hash8 } from '../../../lib/log/gate.js'

/** 事件名联合类型：直接来自清单，写错事件名在编译期就报错。 */
export type LogEvent = keyof typeof manifest.events

/** 清单里的事件名列表（回归脚本用来与代码里的调用点对账）。 */
export const LOG_EVENTS: readonly string[] = Object.keys(manifest.events)

const ENDPOINT_DEFAULT = '/_dsh/dsh-prompt/log'

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
  const gate = createEventGate(manifest)

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
      if (gate.manifestOk && !gate.isDeclared(String(event))) return false
      try {
        return clientLog.isEnabled(gate.levelOf(String(event)) ?? 'info')
      } catch (e) {
        return false
      }
    },
    status: () => ({
      dropped: clientLog.getDroppedCount(),
      undeclared: gate.stats.undeclared,
      droppedFields: gate.stats.droppedFields,
      oversize: gate.stats.oversize,
      scrubbed: gate.stats.scrubbed,
      manifestOk: gate.manifestOk,
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
  // 装进槽：调用点（store / panel / smart / settings）从 globalThis 读它，而不是各自 import 本模块。
  // 为什么走槽：本仓既有回归脚本把客户端模块逐个转译后单独 require，单文件 bundle 里也没有模块内 require，
  // 槽是两边都能用的唯一机制；出口仍然只有 facade.log 一个。热重载重跑 startLog 时以后一个为准。
  try {
    ;(globalThis as any).__dshPromptLog = facade
  } catch (e) { /* ignore */ }
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
