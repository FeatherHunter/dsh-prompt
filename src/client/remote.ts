/**
 * dsh-prompt — 远程模式总闸与持久化（#82，按 #85 规格；2026-09-29 去宿主化修订）
 *
 * 职责：
 * - 常驻开关：默认关；开=大、关=小，不许大/小直接互切（映射由调用方执行，本模块只给 isBigList）。
 * - 持久化：总闸与字号/控件/方向偏好档位按 DSH 缓存目录语义落盘（本插件 host 域 global，经 HTTP 桥）；
 *   持久化失败当次有效、下次恢复默认并明示（fail-soft）。
 * - 门槛：去宿主化——总闸恒以自家面能否真变大为准，无宿主门控、无灰行、无待宿主文案。
 * - 配置键直达：以本插件 DOM 链/自家弹窗为官方路径（宿主若提供稳定打开则顺手用之，不门控）。
 * - 会话快照（#110）：进入（关→开）记住方向偏好，退出（开→关）恢复进入值；
 *   快照内存 + 落盘双份（reload/崩溃后恢复一次即清）；会话中改的方向视为临时覆盖。
 *
 * 新模块用 TS（map 约束）；纯函数走转译断言（见 scripts/test-issue-82.cjs）。
 */

/** 旧三档（2026-09-29 前）：仅做遗留数据迁移（large→2，其余→1），新代码不得再读写档位 */
export type RemoteFontTier = 'small' | 'medium' | 'large'
export type RemoteControlTier = 'small' | 'medium' | 'large'

/**
 * 方向偏好（去宿主化后替代「整机真切」的本插件内闭环配置，2026-09-29 用户拍板「禁止依赖官方」）：
 * - auto：跟视口比例走（即自适应布局，零宿主依赖）；
 * - landscape / portrait：强制锁定对应布局，覆盖视口推导。
 * 纯插件 + 持久化，与总闸同桥落盘；整机 OS 方向不在本模块射程内（见 research/host-vs-plugin-h1-orientation.md）。
 */
export type RemoteOrientationPref = 'auto' | 'landscape' | 'portrait'

/**
 * 密度档（#90，用户拍板）：
 * - 'a'（默认）= 12 宫（竖 3×4 / 横 4×3，现状零改动）；
 * - 'b' = 8 宫大卡（竖 2×4 / 横 4×2，不满补空位恒 8）。
 * 字面量 'a'/'b'；纯手动，禁任何自动切档逻辑；仅切密度页码归零（方向切换不动）。
 */
export type RemoteDensity = 'a' | 'b'

export interface RemotePrefs {
  enabled: boolean
  /** 统一大小 1–10 档（2026-09-29 用户拍板：单滑块字号控件联动，倍数表见 remoteView.REMOTE_SIZE_SCALES，1 档=100%） */
  size: number
  orientation: RemoteOrientationPref
  /** 密度档（#90）：默认 'a'；旧数据无键回 'a' */
  density: RemoteDensity
}

/** 默认值：总闸默认关（#85 US8）；大小默认 5 档（2x，用户拍板起步即大）；方向偏好默认自动；密度默认 A */
export const REMOTE_DEFAULTS: RemotePrefs = { enabled: false, size: 5, orientation: 'auto', density: 'a' }

/** 大小校验：1–10 整数（纯函数） */
export function isRemoteSize(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && (v as number) >= 1 && (v as number) <= 10
}

export const REMOTE_TIERS: RemoteFontTier[] = ['small', 'medium', 'large']

/** 档位校验（纯函数） */
export function isRemoteTier(v: unknown): v is RemoteFontTier {
  return v === 'small' || v === 'medium' || v === 'large'
}

/** 方向偏好校验（纯函数） */
export function isRemoteOrientationPref(v: unknown): v is RemoteOrientationPref {
  return v === 'auto' || v === 'landscape' || v === 'portrait'
}

/** 密度档校验（纯函数，#90） */
export function isRemoteDensity(v: unknown): v is RemoteDensity {
  return v === 'a' || v === 'b'
}

/** 密度归一化：非法/缺键回默认 A（纯函数，不抛） */
export function normalizeRemoteDensity(v: unknown): RemoteDensity {
  return v === 'b' ? 'b' : 'a'
}

/** 归一化：未知形状一律回默认（纯函数；宿主旧数据/手改坏文件走此；旧三档按 large→2、其余→1 迁入） */
export function normalizeRemotePrefs(input: unknown): RemotePrefs {
  try {
    const o = (input || {}) as any
    let size: number = REMOTE_DEFAULTS.size
    if (isRemoteSize(o.size)) size = o.size
    else if (o.font === 'large' || o.control === 'large') size = 2
    else if (isRemoteTier(o.font) || isRemoteTier(o.control)) size = 1
    return {
      enabled: o.enabled === true,
      size,
      orientation: isRemoteOrientationPref(o.orientation) ? o.orientation : REMOTE_DEFAULTS.orientation,
      density: isRemoteDensity(o.density) ? o.density : REMOTE_DEFAULTS.density,
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

/* ── 会话快照（#110）：进入记住方向偏好，退出恢复 ── */

/** 快照落盘键（独立于主偏好键；只存进入前方向，恢复一次即清） */
const PRE_REMOTE_KEY = '__dshPromptPreRemote'

/** 会话内存快照：进入远程那一刻的方向偏好（null = 非会话中） */
let sessionSnapshot: RemoteOrientationPref | null = null

type SnapshotStorage = {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
}

/** 取快照存储（浏览器 localStorage；缺席回 null，调用方走纯内存路径，不抛） */
function snapshotStorage(): SnapshotStorage | null {
  try {
    const g = globalThis as any
    const s = g && g.localStorage
    if (s && typeof s.getItem === 'function' && typeof s.setItem === 'function' && typeof s.removeItem === 'function') {
      return s as SnapshotStorage
    }
    return null
  } catch (e) { return null }
}

/** 读盘上快照（无键/坏包回 null，不抛） */
function readStoredSnapshot(): RemoteOrientationPref | null {
  try {
    const s = snapshotStorage()
    if (!s) return null
    const raw = s.getItem(PRE_REMOTE_KEY)
    if (!raw) return null
    const v = (JSON.parse(raw) as any).orientation
    return isRemoteOrientationPref(v) ? v : null
  } catch (e) { return null }
}

/** 写盘上快照（失败静默，内存快照为准，不抛） */
function writeStoredSnapshot(v: RemoteOrientationPref): void {
  try {
    const s = snapshotStorage()
    if (!s) return
    s.setItem(PRE_REMOTE_KEY, JSON.stringify({ orientation: v }))
  } catch (e) { /* ignore */ }
}

/** 清盘上快照（失败静默，不抛） */
function clearStoredSnapshot(): void {
  try {
    const s = snapshotStorage()
    if (!s) return
    s.removeItem(PRE_REMOTE_KEY)
  } catch (e) { /* ignore */ }
}

/* ── 环境方向缓存（#110 检测统一）：整机方向的只读缓存 ──
 *
 * 职责：给“自动”档与设置页提供整机方向读数。只读不写——写整机永远走整机桥。
 * 新鲜度由用户动作事件界定（设置页挂载预热、开远程进入查询、锁定/恢复成功复用已知结果），
 * 不做轮询；hover/面板只读缓存，永不触发网络。内存态，reload 即失（视口回落接管）。
 */

export interface EnvOrientation {
  orientation: 'landscape' | 'portrait'
  /** 来源（现仅整机桥；视口回落由调用方现算，不进缓存） */
  source: 'system'
  updatedAt: number
}

/** 缓存的整机方向（null = 未知，走视口回落） */
let envOrientation: EnvOrientation | null = null
/** 桥永久缺席（本会话内不再做推测性查询；用户显式锁定不受影响，照调照报） */
let envUnsupported = false

/** 读环境方向缓存（返回拷贝；null 即未知） */
export function getEnvOrientation(): EnvOrientation | null {
  return envOrientation ? { ...envOrientation } : null
}

/** 写环境方向缓存（非法输入忽略，不抛；成功写入同时解除缺席标记） */
export function setEnvOrientation(v: unknown): void {
  try {
    const o = (v as any) && (v as any).orientation
    if (o !== 'landscape' && o !== 'portrait') return
    envOrientation = { orientation: o, source: 'system', updatedAt: Date.now() }
    envUnsupported = false
  } catch (e) { /* ignore */ }
}

/** 记桥缺席（本会话跳过推测性查询；已缓存的值一并作废，避免拿 stale 冒充现值） */
export function markEnvUnsupported(): void {
  envUnsupported = true
  envOrientation = null
}

/** 桥是否已确认缺席 */
export function isEnvUnsupported(): boolean {
  return envUnsupported === true
}

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
          density: raw.remoteDensity !== undefined ? raw.remoteDensity : (raw as any).density,
        })
        persistFailed = false
        persistMessage = ''
        // #110 崩溃恢复：盘上有进入快照且 host 仍开着（上次会话没正常退出，
        // reload 同理）→ 方向回进入值一次并清快照；关着只清 stale 键不动偏好。
        const stored = readStoredSnapshot()
        if (stored !== null) {
          if (cache.enabled === true && stored !== cache.orientation) {
            cache = normalizeRemotePrefs({ ...cache, orientation: stored })
            persistRemote()
          }
          clearStoredSnapshot()
          notifyRemote()
        }
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
      body: JSON.stringify({ enabled: cache.enabled, size: cache.size, orientation: cache.orientation, density: cache.density }),
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

/** 总闸：开/关（开=大、关=小；不许大/小直接互切由调用方保证——本函数只做二值切换）
 * #110 会话语义：关→开快照进入前方向（内存 + 落盘，重复开不覆盖）；
 * 开→关恢复进入值（与当前一致则单写开关，不多写；快照一次性，用后即清）。 */
export function setRemoteEnabled(on: boolean): RemotePrefs {
  const want = !!on
  if (want === true && cache.enabled === false) {
    sessionSnapshot = cache.orientation
    writeStoredSnapshot(cache.orientation)
    const next = applyPatch({ enabled: true })
    // 注意：事件名必须写字面量（日志回归扫描只认 logEvent('字面量', {...}) 调用点，变量转交会被判“声明了却没人打”）。
    logEvent('settings.remote.toggle', { on: next.enabled, size: next.size })
    return { ...next }
  }
  if (want === false && cache.enabled === true) {
    const snap = sessionSnapshot !== null ? sessionSnapshot : readStoredSnapshot()
    let next: RemotePrefs
    if (snap !== null && snap !== cache.orientation) {
      next = applyPatch({ enabled: false, orientation: snap })
    } else {
      next = applyPatch({ enabled: false })
    }
    sessionSnapshot = null
    clearStoredSnapshot()
    logEvent('settings.remote.toggle', { on: next.enabled, size: next.size })
    return { ...next }
  }
  const next = applyPatch({ enabled: want })
  // 注意：事件名必须写字面量（日志回归扫描只认 logEvent('字面量', {...}) 调用点，变量转交会被判“声明了却没人打”）。
  logEvent('settings.remote.toggle', { on: next.enabled, size: next.size })
  return { ...next }
}

/** 读会话快照（进入前方向；null = 非会话中或无快照） */
export function getSessionSnapshotOrientation(): RemoteOrientationPref | null {
  return sessionSnapshot
}

/**
 * 设为默认（#110 收尾）：把会话内当前方向记为以后进出的默认值。
 * 只在会话中有效（enabled 且有快照）；非会话直接返回现状。
 * 实现 = 快照跟进当前值（内存 + 落盘双份），偏好本身已由会话内切换持久化，无需再写。
 * 退出时即按新默认恢复（等于无操作），崩溃恢复同样跟进。
 */
export function commitSessionOrientationAsDefault(): RemotePrefs {
  try {
    if (cache.enabled !== true || sessionSnapshot === null) return { ...cache }
    if (sessionSnapshot === cache.orientation) return { ...cache }
    sessionSnapshot = cache.orientation
    writeStoredSnapshot(cache.orientation)
    notifyRemote()
  } catch (e) { /* ignore */ }
  return { ...cache }
}

/**
 * 跨插件页内 API（#93）：globalThis.__dshPromptSetRemote 的实现本体。
 *
 * - 入参：boolean 或 { enabled: boolean }；其余键一律忽略（只动总闸；
 *   size / orientation / density 请走跨插件 HTTP API：POST /_dsh/dsh-prompt/remote/set）。
 * - 路径：复用 setRemoteEnabled（内为 normalizeRemotePrefs→applyPatch→既有订阅通知），
 *   事件沿用既有 settings.remote.toggle，无新事件名。
 * - 并发：多写 last-write-wins（后写覆盖先写，无锁；与 host 侧 storage-json 双写语义一致）。
 * - 无鉴权立场：UI 偏好低风险，仅靠页内同源 + host 侧同源围栏，不另加 token（见 lib/index.js）。
 */
export function setRemoteFromExternal(input: unknown): RemotePrefs {
  let on: boolean | undefined
  if (typeof input === 'boolean') on = input
  else if (input && typeof input === 'object' && typeof (input as any).enabled === 'boolean') on = (input as any).enabled as boolean
  else return { ...cache }
  if (on === undefined) return { ...cache }
  return setRemoteEnabled(on)
}

try { (globalThis as any).__dshPromptSetRemote = setRemoteFromExternal } catch (e) { /* ignore */ }

/** 统一大小 1–10 档（越界钳制取整；非法输入拒绝） */
export function setRemoteSize(n: unknown): RemotePrefs {
  const v = typeof n === 'number' && isFinite(n) ? Math.min(10, Math.max(1, Math.round(n))) : NaN
  if (!isRemoteSize(v)) return { ...cache }
  const next = applyPatch({ size: v })
  logEvent('settings.remote.size', { on: next.enabled, size: next.size })
  return { ...next }
}

/** 方向偏好（自动/横屏锁定/竖屏锁定三档，纯插件，持久化；覆盖视口推导） */
export function setRemoteOrientation(pref: RemoteOrientationPref): RemotePrefs {
  if (!isRemoteOrientationPref(pref)) return { ...cache }
  const next = applyPatch({ orientation: pref } as Partial<RemotePrefs>)
  logEvent('settings.remote.orientation', { on: next.enabled, orientation: next.orientation })
  return { ...next }
}

/** 密度档（#90）：两段手动切换，默认 A；非法拒绝（原值不动，不落盘不记事件）；切档页码归零由调用方执行 */
export function setRemoteDensity(d: RemoteDensity): RemotePrefs {
  if (!isRemoteDensity(d)) return { ...cache }
  const next = applyPatch({ density: d } as Partial<RemotePrefs>)
  // 注意：事件名必须写字面量（日志回归扫描只认 logEvent('字面量', {...}) 调用点，变量转交会被判“声明了却没人打”）。
  logEvent('settings.remote.density', { on: next.enabled, density: next.density })
  return { ...next }
}

/** 仅供测试：重置内存态（会话快照与环境缓存一并清；落盘键由用例自管，不碰） */
export function __resetRemoteForTests(): void {
  cache = { ...REMOTE_DEFAULTS }
  sessionSnapshot = null
  envOrientation = null
  envUnsupported = false
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
