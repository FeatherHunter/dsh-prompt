/**
 * dsh-prompt — 面板开合状态（入口按钮 ↔ 面板共享，模块级 + 订阅）
 */
let panelOpen = false
const listeners = new Set<(v: boolean) => void>()
let closeTimer: ReturnType<typeof setTimeout> | null = null

export function isPanelOpen(): boolean { return panelOpen }
/**
 * #112 hover-click 同手势标记：入口按钮 hover 开窗时打点，click 凭它区分
 * “同手势跟进单击（保持开，防闪关）”与“稳态明确单击（取反，可手动关）”。
 * 读一次消费一次——第二次 click 即走取反；超窗视为稳态（过期不算同手势）；
 * 关窗即手势结束——任何关窗都清点，不留给下一次开窗（code-review Spec c1）。
 */
let hoverOpenedAt = 0
export function noteHoverOpen(): void { hoverOpenedAt = Date.now() }
export function takeHoverOpen(graceMs: number): boolean {
  if (hoverOpenedAt === 0) return false
  const age = Date.now() - hoverOpenedAt
  hoverOpenedAt = 0
  return age <= graceMs
}
/** 仅供测试：重置同手势标记 */
export function __resetHoverOpen(): void { hoverOpenedAt = 0 }
export function setPanelOpen(v: boolean): void {
  if (panelOpen !== v) {
    panelOpen = v
    if (!v) hoverOpenedAt = 0
    listeners.forEach((fn) => { try { fn(v) } catch (e) { /* ignore */ } })
  }
}
/** 面板 hover 自动关窗在弹窗打开期间应抑制（#14 回归） */
let hoverCloseSuppressed = false
export function setHoverCloseSuppressed(v: boolean): void {
  hoverCloseSuppressed = v
  if (v && closeTimer !== null) { clearTimeout(closeTimer); closeTimer = null }
}
export function isHoverCloseSuppressed(): boolean { return hoverCloseSuppressed }

/** hover 离开后延迟关窗（短暂计时，防止从按钮移动到列表之间的误关） */
export function schedulePanelClose(ms: number): void {
  if (hoverCloseSuppressed) return
  if (closeTimer !== null) clearTimeout(closeTimer)
  closeTimer = setTimeout(() => setPanelOpen(false), ms)
}
/** 取消待执行的延迟关窗（鼠标进入列表/按钮时调用） */
export function cancelPanelClose(): void {
  if (closeTimer !== null) { clearTimeout(closeTimer); closeTimer = null }
}
export function onPanelOpen(fn: (v: boolean) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
