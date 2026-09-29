/**
 * dsh-prompt — 远程模式总闸与持久化（#82，按 #85 规格；2026-09-29 去宿主化修订）
 *
 * 职责：
 * - 常驻开关：默认关；开=大、关=小，不许大/小直接互切（映射由调用方执行，本模块只给 isBigList）。
 * - 持久化：总闸与字号/控件/方向偏好档位按 DSH 缓存目录语义落盘（本插件 host 域 global，经 HTTP 桥）；
 *   持久化失败当次有效、下次恢复默认并明示（fail-soft）。
 * - 门槛：去宿主化——总闸恒以自家面能否真变大为准，无宿主门控、无灰行、无待宿主文案。
 * - 配置键直达：以本插件 DOM 链/自家弹窗为官方路径（宿主若提供稳定打开则顺手用之，不门控）。
 *
 * 新模块用 TS（map 约束）；纯函数走转译断言（见 scripts/test-issue-82.cjs）。
 */

export type RemoteFontTier = 'small' | 'medium' | 'large'
export type RemoteControlTier = 'small' | 'medium' | 'large'

/**
 * 方向偏好（去宿主化后替代「整机真切」的本插件内闭环配置，2026-09-29 用户拍板「禁止依赖官方」）：
 * - auto：跟视口比例走（即自适应布局，零宿主依赖）；
 * - landscape / portrait：强制锁定对应布局，覆盖视口推导。
 * 纯插件 + 持久化，与总闸同桥落盘；整机 OS 方向不在本模块射程内（见 research/host-vs-plugin-h1-orientation.md）。
 */
export type RemoteOrientationPref = 'auto' | 'landscape' | 'portrait'

export interface RemotePrefs {
  enabled: boolean
  font: RemoteFontTier
  control: RemoteControlTier
  orientation: RemoteOrientationPref
}

/** 默认值：总闸默认关（#85 US8）；字号/控件默认大（2026-09-29 用户拍板初始即大）；方向偏好默认自动 */
export const REMOTE_DEFAULTS: RemotePrefs = { enabled: false, font: 'large', control: 'large', orientation: 'auto' }

export const REMOTE_TIERS: RemoteFontTier[] = ['small', 'medium', 'large']

/** 档位校验（纯函数） */
export function isRemoteTier(v: unknown): v is RemoteFontTier {
  return v === 'small' || v === 'medium' || v === 'large'
}

/** 方向偏好校验（纯函数） */
export function isRemoteOrientationPref(v: unknown): v is RemoteOrientationPref {
  return v === 'auto' || v === 'landscape' || v === 'portrait'
}

/** 归一化：未知形状一律回默认（纯函数；宿主旧数据/手改坏文件走此） */
export function normalizeRemotePrefs(input: unknown): RemotePrefs {
  try {
    const o = (input || {}) as Partial<RemotePrefs>
    return {
      enabled: o.enabled === true,
      font: isRemoteTier(o.font) ? o.font : REMOTE_DEFAULTS.font,
      control: isRemoteTier(o.control) ? o.control : REMOTE_DEFAULTS.control,
      orientation: isRemoteOrientationPref((o as any).orientation) ? (o as any).orientation : REMOTE_DEFAULTS.orientation,
    }
  } catch (e) {
    return { ...REMOTE_DEFAULTS }
  }
}

/** 开=大、关=小、零中间态（#85 US6/US7；栏头不设切换，故无第三态） */
export function isBigList(prefs: RemotePrefs): boolean {
  return !!prefs.enabled
}

/** 宿主能力位（去宿主化后已废弃，仅为兼容保留；2026-09-29 起不再用于门控） */
export interface RemoteHostCaps {
  hasSystemOrientation: boolean
  hasSystemFont: boolean
  hasStableOpen: boolean
}

/** 已废弃：恒返回缺席。保留仅供旧回归脚本装配，新代码不得据此门控（去宿主化）。 */
export function getRemoteHostCaps(): RemoteHostCaps {
  try {
    const g = globalThis as any
    const cap = g && g.__dshPromptHostCaps
    if (cap && typeof cap === 'object') {
      return {
        hasSystemOrientation: cap.hasSystemOrientation === true,
        hasSystemFont: cap.hasSystemFont === true,
        hasStableOpen: cap.hasStableOpen === true,
      }
    }
  } catch (e) { /* ignore */ }
  return { hasSystemOrientation: false, hasSystemFont: false, hasStableOpen: false }
}

/** 仅供测试：注入宿主能力 */
export function __setRemoteHostCapsForTests(caps: Partial<RemoteHostCaps> | null): void {
  try {
    const g = globalThis as any
    if (caps === null) { delete g.__dshPromptHostCaps; return }
    g.__dshPromptHostCaps = { ...getRemoteHostCaps(), ...caps }
  } catch (e) { /* ignore */ }
}

/* ── 持久化桥（内存缓存 + host 落盘，与 store.ts 同构） ── */

const STORE_URL = '/_dsh/dsh-prompt/store'
const SET_URL = '/_dsh/dsh-prompt/remote/set'

const ROUTE_NAME = 'remote.set'

let cache: RemotePrefs = { ...REMOTE_DEFAULTS }
let remoteLoaded = false
let loadPromise: Promise<void> | null = null
let loadRetried = false
// 启动竞态兜底（2026-09-29“记不住选择”根因）：宿主 domain 打开是异步的，插件启动即拉快照可能撞上
// 503（store not ready），旧实现直接锁死默认 → 每次刷新都回默认。失败时只补一次延迟重试。
let persistFailed = false
let persistMessage = ''
const listeners = new Set<() => void>()

function notifyRemote(): void {
  listeners.forEach((fn) => { try { fn() } catch (e) { /* ignore */ } })
}

/** 订阅远程偏好变更（React 侧用 effect 订阅；返回取消函数） */
export function subscribeRemote(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/** 同步读（内存真相来源；初始默认 = 直接切换语义） */
export function getRemotePrefs(): RemotePrefs {
  return { ...cache }
}

/** 持久化失败状态（当次有效、下次恢复默认并明示 → UI 据此展示明示行） */
export function getRemotePersistState(): { failed: boolean; message: string } {
  return { failed: persistFailed, message: persistMessage }
}

export function isRemoteLoaded(): boolean {
  return remoteLoaded
}

async function fetchJSON(url: string, init?: RequestInit): Promise<any | null> {
  try {
    if (typeof fetch === 'undefined') return null
    const res = await fetch(url, init)
    if (!res.ok) return null
    return await res.json()
  } catch (e) {
    return null
  }
}

/** 拉取 host 快照并装入缓存（失败 → 恢复默认 + 明示，不读 localStorage，不静默） */
export function ensureRemoteLoaded(): Promise<void> {
  if (remoteLoaded) return Promise.resolve()
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    const startedAt = Date.now()
    const data = await fetchJSON(STORE_URL)
    if (data && data.ok && data.value) {
      const v = data.value as any
      const raw = v.remote !== undefined ? v.remote : v.global
      if (raw !== undefined) {
        cache = normalizeRemotePrefs(raw.enabled !== undefined ? raw : {
          enabled: raw.remoteEnabled,
          font: raw.remoteFont,
          control: raw.remoteControl,
          orientation: raw.remoteOrientation !== undefined ? raw.remoteOrientation : (raw as any).orientation,
        })
        persistFailed = false
        persistMessage = ''
        logEvent('store.snapshot.ok', { customs: 0, pinned: 0, latencyMs: Date.now() - startedAt })
      } else {
        // 旧快照无远程键 → 默认（不算失败，静默用默认；首启即此分支）
        cache = { ...REMOTE_DEFAULTS }
      }
    } else {
      // host 不可达 → 当次默认、下次恢复默认并明示（#82 验收：持久化失败当次有效、下次恢复默认并明示）
      cache = { ...REMOTE_DEFAULTS }
      persistFailed = true
      persistMessage = 'remote-load-fail'
      logEvent('store.snapshot.fail', { reason: 'remote-unreachable', latencyMs: Date.now() - startedAt })
      // 启动竞态（宿主 domain 异步打开中）大概率几秒后就绪：补一次延迟重拉，命中则覆盖默认并清失败位。
      if (!loadRetried) {
        loadRetried = true
        try {
          if (typeof setTimeout === 'function') {
            const tid: any = setTimeout(() => {
              loadPromise = null
              remoteLoaded = false
              ensureRemoteLoaded().catch(() => undefined)
            }, 2500)
            try { if (tid && typeof tid.unref === 'function') tid.unref() } catch (e) { /* ignore */ }
          }
        } catch (e) { /* ignore */ }
      }
    }
    remoteLoaded = true
    notifyRemote()
  })().finally(() => { /* keep for dedupe */ })
  return loadPromise
}

/** fire-and-forget 落盘（失败记事件 + 置明示位，不回滚内存） */
function persistRemote(): void {
  try {
    if (typeof fetch === 'undefined') {
      persistFailed = true
      persistMessage = 'no-fetch'
      notifyRemote()
      return
    }
    fetch(SET_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: cache.enabled, font: cache.font, control: cache.control, orientation: cache.orientation }),
    }).then(
      async (res) => {
        if (!res.ok) {
          persistFailed = true
          persistMessage = 'host-' + res.status
          logEvent('store.persist.fail', { route: ROUTE_NAME, errorHash: 'http-' + res.status })
          notifyRemote()
          return
        }
        try {
          const data = await res.json()
          if (!data || data.ok !== true) {
            persistFailed = true
            persistMessage = 'host-rejected'
            logEvent('store.persist.fail', { route: ROUTE_NAME, errorHash: 'rejected' })
            notifyRemote()
            return
          }
        } catch (e) { /* 空回包视为成功 */ }
        persistFailed = false
        persistMessage = ''
        notifyRemote()
      },
      (e) => {
        persistFailed = true
        persistMessage = 'unreachable'
        logEvent('store.persist.fail', {
          route: ROUTE_NAME,
          errorHash: String((e && (e as Error).message) || e),
        })
        notifyRemote()
      },
    )
  } catch (e) { /* ignore */ }
}

function applyPatch(patch: Partial<RemotePrefs>): RemotePrefs {
  const next: RemotePrefs = normalizeRemotePrefs({ ...cache, ...patch })
  cache = next
  // 当次有效先行；落盘失败下次恢复默认并由明示行告知（不回滚内存）
  persistRemote()
  notifyRemote()
  return { ...next }
}

/** 总闸：开/关（开=大、关=小；不许大/小直接互切由调用方保证——本函数只做二值切换） */
export function setRemoteEnabled(on: boolean): RemotePrefs {
  const next = applyPatch({ enabled: !!on })
  // 注意：事件名必须写字面量（日志回归扫描只认 logEvent('字面量', {...}) 调用点，变量转交会被判“声明了却没人打”）。
  logEvent('settings.remote.toggle', { on: next.enabled, font: next.font, control: next.control })
  return { ...next }
}

/** 字号档（大中小三档，与分辨率解耦） */
export function setRemoteFont(tier: RemoteFontTier): RemotePrefs {
  if (!isRemoteTier(tier)) return { ...cache }
  const next = applyPatch({ font: tier })
  logEvent('settings.remote.font', { on: next.enabled, font: next.font, control: next.control })
  return { ...next }
}

/** 控件档（大中小三档，与分辨率解耦） */
export function setRemoteControl(tier: RemoteControlTier): RemotePrefs {
  if (!isRemoteTier(tier)) return { ...cache }
  const next = applyPatch({ control: tier })
  logEvent('settings.remote.control', { on: next.enabled, font: next.font, control: next.control })
  return { ...next }
}

/** 方向偏好（自动/横屏锁定/竖屏锁定三档，纯插件，持久化；覆盖视口推导） */
export function setRemoteOrientation(pref: RemoteOrientationPref): RemotePrefs {
  if (!isRemoteOrientationPref(pref)) return { ...cache }
  const next = applyPatch({ orientation: pref } as Partial<RemotePrefs>)
  logEvent('settings.remote.orientation', { on: next.enabled, orientation: next.orientation })
  return { ...next }
}

/** 仅供测试：重置内存态 */
export function __resetRemoteForTests(): void {
  cache = { ...REMOTE_DEFAULTS }
  remoteLoaded = false
  loadPromise = null
  loadRetried = false
  persistFailed = false
  persistMessage = ''
}

/* ── 配置键直达（对话框底部 Prompt 右侧，仅远程下出现；去宿主化后以自家设置弹窗/DOM 链为官方路径） ── */

/** 直达结果：stable（宿主若提供则顺手用，不门控）| dom（本插件官方路径） */
export type RemoteOpenMethod = 'stable' | 'dom'

/**
 * 打开配置面板远程段（去宿主化：不再依赖宿主稳定直达）。
 * - 宿主若恰好提供 globalThis.__dshPromptStableOpen → 顺手走 stable（机会主义，不门控、不明示待宿主）。
 * - 否则走本插件 DOM 链（settings.ts 注册的远程段钩子/通用设置钩子），返回 dom 为官方路径。
 * 当前入口按钮（button.ts）已直接开自家设置弹窗，本函数保留供旧调用点与回归。
 */
export function openRemoteSettings(): { method: RemoteOpenMethod; ok: boolean } {
  try {
    const g = globalThis as any
    if (typeof g.__dshPromptStableOpen === 'function') {
      try {
        g.__dshPromptStableOpen('remote')
        logEvent('remote.direct.open', { method: 'stable', ok: true })
        return { method: 'stable', ok: true }
      } catch (e) { /* 落到本插件路径 */ }
    }
  } catch (e) { /* 落到本插件路径 */ }
  try {
    const g = globalThis as any
    // 优先走远程段直达钩子（settings.ts 注册，打开后滚动到远程段）；缺席再走通用设置钩子。
    if (typeof g.__dshPromptGoRemoteSettings === 'function') {
      g.__dshPromptGoRemoteSettings()
      logEvent('remote.direct.open', { method: 'dom', ok: true })
      return { method: 'dom', ok: true }
    }
    if (typeof g.__dshPromptGoSettings === 'function') {
      g.__dshPromptGoSettings()
      logEvent('remote.direct.open', { method: 'dom', ok: true })
      return { method: 'dom', ok: true }
    }
  } catch (e) { /* ignore */ }
  try {
    logEvent('remote.direct.open', { method: 'dom', ok: false })
  } catch (err) { /* ignore */ }
  return { method: 'dom', ok: false }
}

/** 记一条日志事件（槽机制与 store.ts/settings.ts 同构；能力缺席时空操作） */
function logEvent(event: string, fields?: Record<string, unknown>): void {
  try {
    const log = (globalThis as any).__dshPromptLog
    if (log && typeof log.log === 'function') log.log(event, fields)
  } catch (e) { /* ignore */ }
}
