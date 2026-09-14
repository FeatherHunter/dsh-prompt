/**
 * dsh-prompt — 入口按钮（conversation.input.left）
 */
import { getReact, keepComposerFocus } from './panel'
import { isPanelOpen, setPanelOpen, cancelPanelClose, schedulePanelClose } from './state'
import { getLang, tr, STR } from './i18n'

/**
 * #66 窄屏优化：对话框底部输入区变窄时，按钮收起文字、只剩图标。
 *
 * 为什么用容器查询而不是 ResizeObserver：宿主输入条那一行（InputBar 的 .row）自带
 * `container-type: inline-size`，插槽 wrapper 是 `display:contents`（不产生盒子、不遮挡），
 * 所以 `@container` 命中的正是那一行本身 —— 纯 CSS 就够，无 JS、无挂载闪烁。宿主自己的
 * 模型选择器用的就是同一套做法（360px 处把自己那一行文字换成图标）。
 *
 * 断点标定（#65 原型实测，真 Chrome 布局）：现状要 ≥530.4px 才不换行
 * （tools 254.7 + 间隙 12 + trailing 263.7）；本规则取 560px = 标定值 + 约 30px 余量
 * （相邻按钮宽度会随宿主与其它插件变化）。比的是「那一行的内容盒宽度」，不是视口宽度；
 * 收起「Prompt」文字省 46.7px，等于把「开始换行」的宽度往下推 46.7px。
 *
 * 兜底：若将来宿主去掉 container-type，规则静默不匹配 ⇒ 行为退回今天的宽屏样式，不产生回归。
 */
const NARROW_STYLE_ID = 'dsh-prompt-entry-narrow'
const NARROW_CSS = [
  '@container (max-width: 560px) {',
  '  [data-dsh-prompt-entry] [data-dsh-prompt-label] { display: none; }',
  '}',
].join('\n')

let narrowStyleReady = false

/** 注入窄屏样式（幂等；任何失败都不影响按钮本身可用） */
function ensureNarrowStyle(): void {
  if (narrowStyleReady) return
  try {
    const doc: any = (globalThis as any).document
    if (!doc || !doc.head || typeof doc.createElement !== 'function') return
    const sel = 'style[data-dsh-prompt-style="' + NARROW_STYLE_ID + '"]'
    if (typeof doc.querySelector === 'function' && doc.querySelector(sel)) {
      narrowStyleReady = true
      return
    }
    const tag = doc.createElement('style')
    tag.setAttribute('data-dsh-prompt-style', NARROW_STYLE_ID)
    tag.textContent = NARROW_CSS
    doc.head.appendChild(tag)
    narrowStyleReady = true
  } catch (e) { /* 注入失败时保持今天的样子 */ }
}

/** 仅供测试：重置注入缓存 */
export function __resetNarrowStyle(): void {
  narrowStyleReady = false
}

export function EntryButton(props: any): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  const open = props.open ?? false
  const lang = getLang()
  const label = tr(lang, STR.entryBtn)

  ensureNarrowStyle()

  const style: any = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '5px 10px', borderRadius: 8,
    background: 'var(--dsw-alias-bg-layer-3)',
    border: '1px solid var(--dsw-alias-border-l1)',
    color: open ? 'var(--dsw-specific-accent,#f0a45c)' : 'var(--dsw-alias-label-primary)',
    cursor: 'pointer', fontSize: 12, fontWeight: 500,
    fontFamily: 'var(--dsw-font-family)', whiteSpace: 'nowrap',
    flex: 'none',
  }
  return h('button', {
    style, title: label,
    // #66 图标化后可见文字为空，可访问名必须由 aria-label 顶上，否则读屏念不出这个按钮。
    // 与可见文字同名（WCAG 2.5.3 名称与可见标签一致）；宽屏下与文字重复也无害。
    'aria-label': label,
    'data-dsh-prompt-entry': '1',
    // #61 保焦（宿主 input.left 自家按钮同款 keepFocus）：click 开面板时不把焦点从作曲家抢走，
    // 面板内搜索框聚焦时不抢（见 keepComposerFocus）；键盘 Tab+Enter 无 mousedown，不受影响。
    onMouseDown: keepComposerFocus,
    // hover 触发：进入即开；离开延迟 150ms 关（列表接管时取消）
    onMouseEnter: () => { cancelPanelClose(); setPanelOpen(true) },
    onMouseLeave: () => { schedulePanelClose(150) },
    // click 保留：触屏 tap / 键盘 focus+Enter 的 fallback + 手动开关
    onClick: () => { cancelPanelClose(); setPanelOpen(!isPanelOpen()) },
  }, [
    // 图标：灯泡（提醒/点子语义）+ 小星芒（智能建议）—— 方案 C
    h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--dsw-specific-accent,#f0a45c)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', style: { flex: 'none' } }, [
      h('path', { d: 'M15 14c.2-1 .7-1.7 1.5-2.5C17.5 10.6 18 9.3 18 8a6 6 0 1 0-12 0c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5' }),
      h('path', { d: 'M9 18h6' }),
      h('path', { d: 'M10 22h4' }),
      h('path', { d: 'M18.5 2.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z' }),
    ]),
    // 文案：加钩子供窄屏规则收起（宽屏一个字不变）
    h('span', { 'data-dsh-prompt-label': '1' }, label),
  ])
}
