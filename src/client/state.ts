/**
 * dsh-prompt — 面板开合状态（入口按钮 ↔ 面板共享，模块级 + 订阅）
 */
let panelOpen = false
const listeners = new Set<(v: boolean) => void>()
let closeTimer: ReturnType<typeof setTimeout> | null = null

export function isPanelOpen(): boolean { return panelOpen }
export function setPanelOpen(v: boolean): void {
  if (panelOpen !== v) {
    panelOpen = v
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
