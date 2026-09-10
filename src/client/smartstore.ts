/**
 * dsh-prompt — 智能模式桥接存储
 * 会话作用域 overlay 把当前输入（draft/useInput/actions）发布到这里；root 悬浮卡订阅。
 * 开关（默认开）、位置持久化、插入抑制（防「插入后卡片重现」）也在此。
 */
export interface SmartInput {
  sessionId?: string
  draft: string
  useInput?: any
  actions?: any
}

let current: SmartInput = { draft: '' }
const listeners = new Set<() => void>()

export function setSmartInput(next: SmartInput): void {
  if (next.draft === current.draft && next.sessionId === current.sessionId && next.actions === current.actions && next.useInput === current.useInput) return
  current = next
  listeners.forEach((fn) => { try { fn() } catch (e) { /* ignore */ } })
}
export function getSmartInput(): SmartInput { return current }
export function onSmartInput(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

/**
 * 智能模式开关键。v2：用户 2026-09-10 裁定——智能卡暂按 BUG 处理（输入匹配不自动出卡，见 issue），
 * 开关**默认关**，且关时连悬浮小点都不出现。旧键 'dsh.prompt.smart' 曾为"历史默认开"的老用户保留
 * '1'（#23 兼容决定），本票撤销该兼容：只认 v2，老键一律不继承，保证所有人首次启动都是关。
 */
const SMART_KEY = 'dsh.prompt.smart.v2'
const POS_KEY = 'dsh.prompt.smartPos'

/** 开关：true 仅当用户显式置 '1'；缺键（首次/升键）与 '0' 都是关。关 → 组件不渲染（无小点、无卡片）。 */
const enabledListeners = new Set<(on: boolean) => void>()
export function isSmartEnabled(): boolean {
  try {
    const s = globalThis.localStorage
    if (!s) return false
    const v = s.getItem(SMART_KEY)
    return v === null ? false : v !== '0'
  } catch (e) { return false }
}
export function setSmartEnabled(on: boolean): void {
  try { globalThis.localStorage?.setItem(SMART_KEY, on ? '1' : '0') } catch (e) { /* ignore */ }
  enabledListeners.forEach((fn) => { try { fn(on) } catch (e) { /* ignore */ } })
}
export function onSmartEnabled(fn: (on: boolean) => void): () => void {
  enabledListeners.add(fn)
  return () => { enabledListeners.delete(fn) }
}

export interface SmartPos { x: number; y: number }

export function loadSmartPos(): SmartPos | null {
  try {
    const s = globalThis.localStorage
    if (!s) return null
    const raw = s.getItem(POS_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as SmartPos
    return typeof p.x === 'number' && typeof p.y === 'number' ? p : null
  } catch (e) { return null }
}
export function saveSmartPos(p: SmartPos): void {
  try { globalThis.localStorage?.setItem(POS_KEY, JSON.stringify(p)) } catch (e) { /* ignore */ }
}

/** 插入抑制：插入后 draft 变为新值 → 卡片不重现；用户改动草稿后自动解除 */
let suppressDraft: string | null = null
export function suppressCard(draft: string): void { suppressDraft = draft }
export function isSuppressed(draft: string): boolean { return suppressDraft !== null && suppressDraft === draft }
export function clearSuppression(draft: string): void { if (suppressDraft !== null && suppressDraft !== draft) suppressDraft = null }
