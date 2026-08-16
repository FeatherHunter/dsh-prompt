/**
 * dsh-prompt — 面板开合状态（入口按钮 ↔ 面板共享，模块级 + 订阅）
 */
let panelOpen = false
const listeners = new Set<(v: boolean) => void>()

export function isPanelOpen(): boolean { return panelOpen }
export function setPanelOpen(v: boolean): void {
  if (panelOpen !== v) {
    panelOpen = v
    listeners.forEach((fn) => { try { fn(v) } catch (e) { /* ignore */ } })
  }
}
export function onPanelOpen(fn: (v: boolean) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
