/**
 * 悬停提示 portal（hover-tip）（可 import 者 —— index）。
 * 跑浏览器 bundle 线；禁被 src/update/host 进口（DO-NOT-IMPORT），禁跨运行时进口。
 */
/**
 * dsh-prompt — 悬停提示 portal：整面 title 原生提示 → 按钮上方单行 popover。
 *
 * 动机：原生 `title` 气泡跟随鼠标、出现位置/延迟不可控、不可换肤；
 * 本模块把「当前悬停元素的 title 文案」接管为一只固定在按钮**上方**的单行 popover
 * （空间不够时翻到下方），样式走宿主令牌，深浅主题自动跟随。
 *
 * 实现要点（刻意只做加法，不动既有 title/aria 文案）：
 * 1) 文案零新键：读的就是元素上已有的 `title`（= STR 词表本地化串），多语言
 *    自动跟随 lang 订阅；悬停瞬间重读，语言切换后下一次悬停即新文案。
 * 2) 零回归外溢：React 树里的 `title` prop 原样保留（门禁 chrome 钩子与
 *    repro 脚本照旧认 `title`），只在悬停期间临时摘掉 DOM 属性以压住原生
 *    气泡（原生约 1s 延迟，摘除发生在 mouseover 当下），离开即写回。
 * 3) 作用域收敛：只接管插件自家面（bar / list / cloud / 行），宿主其它
 *    `title` 一律不碰。
 * 4) portal 挂 body（position:fixed，按视口 rect 定位）：行在滚动容器内，
 *    CSS ::after 方案会被裁切，portal 不受祖先 overflow 影响。
 */
export const HOVER_TIP_SHOW_DELAY = 280
export const HOVER_TIP_FOCUS_DELAY = 80

const SCOPE_SEL = '[data-dsh-prompt-bar],[data-dsh-prompt-list],[data-dsh-prompt-cloud],[data-dsh-prompt-id]'
const TIP_CLASS = 'dsh-prompt-hover-tip'
const TIP_TEXT_CLASS = 'dsh-prompt-hover-tip-text'
const INSTALLED_FLAG = '__dshPromptHoverTipInstalled'

export const HOVER_TIP_CSS = (function (): string {
  const base = '.' + TIP_CLASS
  const text = '.' + TIP_TEXT_CLASS
  return [
    base + '{position:fixed;left:0;top:0;z-index:10000;pointer-events:none;max-width:min(420px,92vw);'
      + 'background:var(--dsw-alias-bg-layer-1,var(--dsw-specific-menu));color:var(--dsw-alias-label-primary);'
      + 'border:1px solid var(--dsw-alias-border-l1);border-radius:8px;box-shadow:var(--dsw-shadow-lv3);'
      + 'font-family:var(--dsw-font-family);font-size:12px;line-height:1.5;padding:5px 10px;'
      + 'opacity:0;transition:opacity .15s ease;overflow:visible;white-space:nowrap;}',
    base + '.show{opacity:1;}',
    base + ' ' + text + '{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:min(400px,90vw);}',
    // 小箭头：跟随 --ax（气泡内相对横坐标），上方/下方两种朝向。
    base + '::after{content:"";position:absolute;left:var(--ax,50%);width:8px;height:8px;'
      + 'transform:translateX(-50%) rotate(45deg);background:inherit;}',
    base + '[data-pos="above"]::after{bottom:-5px;border-right:1px solid var(--dsw-alias-border-l1);border-bottom:1px solid var(--dsw-alias-border-l1);}',
    base + '[data-pos="below"]::after{top:-5px;border-left:1px solid var(--dsw-alias-border-l1);border-top:1px solid var(--dsw-alias-border-l1);}',
  ].join('')
})()

interface HoverTipState {
  el: any
  saved: string
  timer: any
  visible: boolean
}

/** 在该文档上装一次悬停接管（幂等，页面级；回收由页面生命周期负责）。 */
export function installHoverTip(doc?: any): void {
  let d: any = doc
  if (!d) {
    try { d = (globalThis as any).document } catch (e) { d = null }
  }
  if (!d || typeof d.addEventListener !== 'function' || typeof d.createElement !== 'function') return
  try {
    if ((d as any)[INSTALLED_FLAG]) return
    ;(d as any)[INSTALLED_FLAG] = true
  } catch (e) { /* flag 写不进也继续：多装一次只是多套监听，语义不变 */ }

  let bubble: any = null
  let label: any = null
  const cur: HoverTipState = { el: null, saved: '', timer: null, visible: false }

  function ensureBubble(): any {
    if (bubble && bubble.isConnected) return bubble
    try {
      bubble = d.createElement('div')
      bubble.className = TIP_CLASS
      try { bubble.setAttribute('aria-hidden', 'true') } catch (e) { /* ignore */ }
      label = d.createElement('span')
      label.className = TIP_TEXT_CLASS
      bubble.appendChild(label)
      const body = d.body || d.documentElement
      if (body && typeof body.appendChild === 'function') body.appendChild(bubble)
      return bubble
    } catch (e) { return null }
  }

  function clearTimer(): void {
    if (cur.timer !== null) {
      try { clearTimeout(cur.timer) } catch (e) { /* ignore */ }
      cur.timer = null
    }
  }

  function restore(): void {
    clearTimer()
    const el = cur.el
    cur.el = null
    cur.visible = false
    try {
      if (bubble) bubble.className = TIP_CLASS
    } catch (e) { /* ignore */ }
    if (el) {
      try {
        // 元素仍在且 title 正被我们摘着 → 写回；已被他人改动则不动。
        if (el.isConnected !== false && !el.getAttribute('title') && cur.saved) el.setAttribute('title', cur.saved)
      } catch (e) { /* ignore */ }
    }
    cur.saved = ''
  }

  function inScope(el: any): boolean {
    try {
      if (!el || typeof el.closest !== 'function') return false
      return !!el.closest(SCOPE_SEL)
    } catch (e) { return false }
  }

  function pickCandidate(t: any): any {
    // 注意：已接管的元素 title 已被临时摘除 —— 先认身份（cur.el 血缘），再认属性。
    // 否则在带图标/子节点的按钮内移动时，closest('[title]') 恒为 null，
    // 会把自己刚 arm 的元素当成「作用域外」收起（timer 被清，tip 永不出现）。
    try {
      if (cur.el && typeof (cur.el as any).contains === 'function') {
        try { if (cur.el === t || (cur.el as any).contains(t)) return cur.el } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }
    try {
      const el = (t && t.nodeType === 1) ? t : (t && t.parentElement) || null
      if (!el || typeof el.closest !== 'function') return null
      const cand = el.closest('[title]')
      if (!cand) return null
      if (!inScope(cand)) return null
      const s = cand.getAttribute('title')
      if (typeof s !== 'string' || !s.trim()) return null
      return cand
    } catch (e) { return null }
  }

  function showNow(): void {
    const el = cur.el
    if (!el) return
    let rect: any = null
    try { rect = el.getBoundingClientRect() } catch (e) { rect = null }
    if (!rect || (rect.width <= 0 && rect.height <= 0)) { restore(); return }
    const b = ensureBubble()
    if (!b || !label) { restore(); return }
    try {
      label.textContent = cur.saved
      // 先定位、后显形：opacity 过渡开始前 left/top 已就位，不在 (0,0) 闪一帧。
      const w = b.offsetWidth || 0
      const h = b.offsetHeight || 0
      let vw = 800
      let vh = 600
      try {
        vw = (d.documentElement && d.documentElement.clientWidth) || vw
        vh = (d.documentElement && d.documentElement.clientHeight) || vh
      } catch (e) { /* ignore */ }
      const cx = rect.left + rect.width / 2
      const above = rect.top >= h + 14
      const top = above ? rect.top - h - 8 : rect.bottom + 8
      let left = cx - w / 2
      if (left < 8) left = 8
      if (left + w > vw - 8) left = Math.max(8, vw - w - 8)
      // 箭头横坐标：钳制在气泡内（半个箭头 + 圆角富余）。
      let ax = cx - left
      if (ax < 14) ax = 14
      if (w > 0 && ax > w - 14) ax = w - 14
      b.style.left = left + 'px'
      b.style.top = Math.max(4, Math.min(top, vh - h - 4)) + 'px'
      try { b.style.setProperty('--ax', ax + 'px') } catch (e) { /* ignore */ }
      try { b.setAttribute('data-pos', above ? 'above' : 'below') } catch (e) { /* ignore */ }
      try { b.classList.add('show') } catch (e) { /* ignore */ }
      cur.visible = true
    } catch (e) { restore() }
  }

  function arm(el: any, delay: number): void {
    if (cur.el === el) return
    restore()
    let s = ''
    try { s = el.getAttribute('title') || '' } catch (e) { s = '' }
    if (!s.trim()) return
    cur.el = el
    cur.saved = s
    // 先摘 title 压住原生气泡（离开/隐藏时写回；读屏走 aria-label，不受影响）。
    try { el.removeAttribute('title') } catch (e) { /* ignore */ }
    clearTimer()
    try {
      cur.timer = setTimeout(() => { cur.timer = null; showNow() }, delay)
    } catch (e) { cur.timer = null }
  }

  function onOver(e: any): void {
    try {
      const cand = pickCandidate(e && e.target)
      // pickCandidate 已优先认 cur.el 血缘：走到这里为 null 即真正离开（作用域外/无 title）。
      if (!cand) { restore(); return }
      arm(cand, HOVER_TIP_SHOW_DELAY)
    } catch (err) { /* 悬停接管永不抛 */ }
  }

  function onOut(e: any): void {
    try {
      if (!cur.el) return
      const to = (e && e.relatedTarget) || null
      try {
        if (to && typeof (to as any).closest === 'function' && (cur.el as any).contains(to)) return
      } catch (err) { /* ignore */ }
      restore()
    } catch (err) { /* ignore */ }
  }

  function onFocusIn(e: any): void {
    try {
      const cand = pickCandidate(e && e.target)
      if (!cand) return
      arm(cand, HOVER_TIP_FOCUS_DELAY)
    } catch (err) { /* ignore */ }
  }

  function onFocusOut(): void {
    try { restore() } catch (e) { /* ignore */ }
  }

  function onHide(): void {
    try { restore() } catch (e) { /* ignore */ }
  }

  try { d.addEventListener('mouseover', onOver) } catch (e) { /* ignore */ }
  try { d.addEventListener('mouseout', onOut) } catch (e) { /* ignore */ }
  try { d.addEventListener('focusin', onFocusIn) } catch (e) { /* ignore */ }
  try { d.addEventListener('focusout', onFocusOut) } catch (e) { /* ignore */ }
  try { d.addEventListener('click', onHide) } catch (e) { /* ignore */ }
  try { d.addEventListener('keydown', (e: any) => { if (e && e.key === 'Escape') onHide() }) } catch (e) { /* ignore */ }
  // 滚动/缩放时锚点已动：直接收起（下一次悬停重算），不追踪。
  try { d.addEventListener('scroll', onHide, true) } catch (e) { /* ignore */ }
  try {
    const win = (d as any).defaultView
    if (win && typeof win.addEventListener === 'function') win.addEventListener('resize', onHide)
  } catch (e) { /* ignore */ }
}
