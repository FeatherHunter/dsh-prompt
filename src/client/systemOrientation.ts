/**
 * dsh-prompt — 整机方向真切 thin wrapper（去宿主化自实现 consumption 侧）
 *
 * 对端是本插件 host 半自实现的 `GET/POST /_dsh/dsh-prompt/system/orientation`
 *（`lib/index.js`，spawn powershell 调 Win32，只动主屏；不动官方）。
 * 本模块是 deep module 的小接口：纯校验 + 纯归一 + 两个 thin fetch。
 * - `auto` 永不进 OS（它是视口推导，见 remoteView.resolveRemoteOrientation）。
 * - fetch 经参数注入（默认全局 fetch），方便转译后单测；无 fetch → unsupported。
 * - 日志走槽（`globalThis.__dshPromptLog`），缺席空操作；事件名写字面量。
 */

export type SystemOrientation = 'landscape' | 'portrait'
export type SystemOrientCode = 'unsupported' | 'busy' | 'denied' | 'unknown'

export interface SystemOrientOk {
  ok: true
  orientation: SystemOrientation
  /** 查询来源：live=当场读 OS，cached=上次成功值；切换成功不带 source */
  source?: 'live' | 'cached'
  /** 切换是否真的改了 OS（幂等命中为 false）；查询不带 */
  changed?: boolean
}

export interface SystemOrientFail {
  ok: false
  error: { code: SystemOrientCode; message: string }
}

export type SystemOrientResult = SystemOrientOk | SystemOrientFail

const ORIENT_URL = '/_dsh/dsh-prompt/system/orientation'

/** OS 方向校验（纯函数；`auto` 不合法——它不进 OS） */
export function isSystemOrientation(v: unknown): v is SystemOrientation {
  return v === 'landscape' || v === 'portrait'
}

/** 错误码归一化（纯函数；码表封闭四码，外来码一律落 unknown） */
export function normalizeOrientCode(v: unknown): SystemOrientCode {
  return v === 'unsupported' || v === 'busy' || v === 'denied' || v === 'unknown' ? v : 'unknown'
}

/**
 * 退出恢复判定（#110，纯函数）：
 * 仅当会话内动过整机（touched）、entry 与现值皆为合法横/竖、且两者不一致时恢复；
 * 未动过、entry 未知、现值非法、已一致 → 一律不动（零调用）。
 */
export function shouldRestoreSystemOrientation(entry: unknown, touched: unknown, current: unknown): boolean {
  if (touched !== true) return false
  if (!isSystemOrientation(entry)) return false
  if (!isSystemOrientation(current)) return false
  return entry !== current
}

/** 归一化对端回包（纯函数；宿主旧版本/手造坏包走此，不抛） */
export function normalizeSystemOrientResponse(data: unknown): SystemOrientResult {
  try {
    const o = (data || {}) as any
    if (o && o.ok === true && isSystemOrientation(o.orientation)) {
      const out: SystemOrientOk = { ok: true, orientation: o.orientation }
      if (o.source === 'live' || o.source === 'cached') out.source = o.source
      if (typeof o.changed === 'boolean') out.changed = o.changed
      return out
    }
    const err = (o && o.error) || {}
    return {
      ok: false,
      error: { code: normalizeOrientCode(err.code), message: typeof err.message === 'string' && err.message ? err.message : 'orientation-unknown' },
    }
  } catch (e) {
    return { ok: false, error: { code: 'unknown', message: 'orientation-normalize-failed' } }
  }
}

type FetchImpl = (url: string, init?: any) => Promise<any>

function defaultFetch(): FetchImpl | null {
  try {
    if (typeof fetch === 'undefined') return null
    return fetch.bind(globalThis)
  } catch (e) {
    return null
  }
}

async function callOrient(
  method: 'GET' | 'POST',
  body: unknown,
  fetchImpl: FetchImpl | null | undefined,
  timeoutMs: number,
): Promise<SystemOrientResult> {
  const f = fetchImpl === undefined ? defaultFetch() : fetchImpl
  if (!f) {
    return { ok: false, error: { code: 'unsupported', message: 'orientation-no-bridge' } }
  }
  let timer: any = null
  try {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
    if (ctrl) timer = setTimeout(() => { try { ctrl.abort() } catch (e) { /* ignore */ } }, timeoutMs)
    const res = await f(ORIENT_URL, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined,
    })
    if (!res || res.ok !== true) {
      return { ok: false, error: { code: 'unknown', message: 'orientation-http-' + (res && res.status ? res.status : 'unreachable') } }
    }
    const data = await res.json().catch(() => null)
    return normalizeSystemOrientResponse(data)
  } catch (e) {
    return { ok: false, error: { code: 'unknown', message: 'orientation-' + String((e && (e as Error).name) || 'failed') } }
  } finally {
    try { if (timer) clearTimeout(timer) } catch (e) { /* ignore */ }
  }
}

/** 查询 OS 真值（主屏；失败由调用方回落，不抛） */
export function getSystemOrientation(fetchImpl?: FetchImpl | null, timeoutMs = 12000): Promise<SystemOrientResult> {
  // 注意：事件名必须写字面量（日志回归扫描只认 logEvent('字面量', {...}) 调用点）。
  return callOrient('GET', undefined, fetchImpl, timeoutMs).then((r) => {
    if (r.ok) logEvent('system.orientation.get', { ok: true, orientation: r.orientation })
    else logEvent('system.orientation.get', { ok: false, code: r.error.code })
    return r
  })
}

/**
 * 真切 OS（只接受 landscape/portrait；非法输入不出网，直接回 unknown，
 * 与 host 码表封闭约定一致）。
 */
export function setSystemOrientation(
  target: unknown,
  fetchImpl?: FetchImpl | null,
  timeoutMs = 12000,
): Promise<SystemOrientResult> {
  if (!isSystemOrientation(target)) {
    const r: SystemOrientFail = { ok: false, error: { code: 'unknown', message: 'orientation-invalid-target' } }
    logEvent('system.orientation.set', { ok: false, code: r.error.code })
    return Promise.resolve(r)
  }
  // 注意：事件名必须写字面量（日志回归扫描只认 logEvent('字面量', {...}) 调用点）。
  return callOrient('POST', { orientation: target }, fetchImpl, timeoutMs).then((r) => {
    if (r.ok) logEvent('system.orientation.set', { ok: true, orientation: r.orientation })
    else logEvent('system.orientation.set', { ok: false, code: r.error.code })
    return r
  })
}

/** 记一条日志事件（槽机制与 remote.ts 同构；能力缺席时空操作） */
function logEvent(event: string, fields?: Record<string, unknown>): void {
  try {
    const log = (globalThis as any).__dshPromptLog
    if (log && typeof log.log === 'function') log.log(event, fields)
  } catch (e) { /* ignore */ }
}
