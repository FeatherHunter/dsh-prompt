/**
 * dsh-prompt — 入口按钮（conversation.input.left）
 */
import { getReact } from './panel'
import { isPanelOpen, setPanelOpen, cancelPanelClose, schedulePanelClose } from './state'
import { getLang, tr, STR } from './i18n'

export function EntryButton(props: any): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  const open = props.open ?? false
  const lang = getLang()

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
    style, title: tr(lang, STR.entryBtn),
    'data-dsh-prompt-entry': '1',
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
    h('span', null, tr(lang, STR.entryBtn)),
  ])
}
