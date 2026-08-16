/**
 * dsh-prompt — 入口按钮（conversation.input.left）
 */
import { getReact } from './panel'
import { isPanelOpen, setPanelOpen } from './state'
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
    onClick: () => setPanelOpen(!isPanelOpen()),
  }, [
    h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--dsw-specific-accent,#f0a45c)', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', style: { flex: 'none' } }, [
      h('path', { d: 'M13 2 L3 14 h7 l-1 8 10-12 h-7 l1-8 z' }),
    ]),
    h('span', null, tr(lang, STR.entryBtn)),
  ])
}
