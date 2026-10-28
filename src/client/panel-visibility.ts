/**
 * 面板显隐布尔 + hover 手势标记（UI 瞬态）（#171 N6：可 import 者 —— entry-button、index、template-browser）。
 * 跑浏览器 bundle 线；禁被 src/update/host 进口（DO-NOT-IMPORT），禁跨运行时进口。
 */
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

/**
 * #179 触发方式（全局设置，缺省=悬浮触发）：true=悬浮开/离开延迟关（#12 既定行为，一字不动）；
 * false=仅点击触发 —— 入口 onMouseEnter 不再开窗，且所有 hover 排关失效
 * （四条排关位：入口 leave / 根节点 leave / 远程根 leave / #14 补关），只保留显式关闭。
 * 本文件仍是纯 UI 瞬态位：值由 index.ts 从 template-library 的 host 快照读入后同步过来，
 * 不在 panel-visibility 里 import store（保住 #171 N6 的 import 边界）。
 */
let hoverTriggerEnabled = true
export function isHoverTriggerEnabled(): boolean { return hoverTriggerEnabled }
export function setHoverTriggerEnabled(on: boolean): void {
  const next = on !== false
  if (hoverTriggerEnabled === next) return
  hoverTriggerEnabled = next
  // 切到仅点击：撤销挂起的 hover 排关，面板保持当前开合 —— 切换是「改触发方式」，不是替用户开/关。
  if (!next) cancelPanelClose()
}

/** hover 离开后延迟关窗（短暂计时，防止从按钮移动到列表之间的误关） */
export function schedulePanelClose(ms: number): void {
  // #179：仅点击模式下一律不排 hover 关（显式关闭走 setPanelOpen(false)，不经过这里）。
  if (!hoverTriggerEnabled) return
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
