/**
 * dsh-prompt — 智能模式悬浮卡（v1.1，shell.overlay root 作用域）
 * #5 定稿：全局单手柄点（点=缩小的卡，卡显示时点消失，互斥）/ 卡从点向右展开 /
 * 自由拖动 + 位置记忆（localStorage）+ 视口 clamp / 仅命中出现 / ≤3 候选（top-2 评分 + 最近使用，不足不凑）/
 * 评分=专属词×2+通用词×1（≥2 出卡）/ 排序=评分→用量 / 点击即填入 + 光标定位首字段冒号后（DEC11 修订）/
 * 默认开可配置关闭 / 与面板各管各的；键盘可达（↑↓/Enter/Esc）。
 */
import { getReact } from './panel'
import { smartCandidates, firstFieldCaret, type ScoredTemplate } from './match'
import { bumpUsage } from './store'
import {
  getSmartInput, onSmartInput, isSmartEnabled, setSmartEnabled,
  loadSmartPos, saveSmartPos, suppressCard, isSuppressed, clearSuppression,
  type SmartPos,
} from './smartstore'
import { getLang, tr, STR } from './i18n'

const DOT_SIZE = 18
const CARD_W = 360
const CARD_H = 300

function clampPos(p: SmartPos, w: number, h: number): SmartPos {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  return {
    x: Math.max(8, Math.min(p.x, vw - w - 8)),
    y: Math.max(8, Math.min(p.y, vh - h - 8)),
  }
}

/** 光标位置：焦点 textarea（value===draft）的 selectionStart，找不到 → 末尾 */
function caretInDraft(draft: string): number {
  try {
    if (typeof document === 'undefined') return draft.length
    const tas = document.querySelectorAll('textarea')
    for (let i = 0; i < tas.length; i++) {
      const ta = tas[i] as HTMLTextAreaElement
      if (ta.value === draft && typeof ta.selectionStart === 'number') return ta.selectionStart
    }
  } catch (e) { /* ignore */ }
  return draft.length
}

/** 智能插入：光标处插入模板正文（不覆盖），光标定位到首字段冒号后；用量+1；抑制卡片重现 */
export function smartInsert(body: string, id: string): void {
  const { actions, draft } = getSmartInput()
  if (!actions || typeof actions.setDraft !== 'function') return
  const caret = caretInDraft(draft)
  const newDraft = draft.slice(0, caret) + body + draft.slice(caret)
  actions.setDraft(newDraft)
  const fieldCaret = caret + firstFieldCaret(body)
  setTimeout(() => {
    try {
      if (typeof document === 'undefined') return
      const tas = document.querySelectorAll('textarea')
      for (let i = 0; i < tas.length; i++) {
        const ta = tas[i] as HTMLTextAreaElement
        if (ta.value === newDraft) { ta.focus(); ta.setSelectionRange(fieldCaret, fieldCaret); break }
      }
    } catch (e) { /* ignore */ }
  }, 0)
  bumpUsage(id)
  suppressCard(newDraft)
}

export function SmartCardHost(props: any): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement

  const [enabled, setEnabled] = react.useState(isSmartEnabled())
  const [input, setInput] = react.useState(getSmartInput())
  const [pos, setPos] = react.useState<SmartPos | null>(null)
  const [highlight, setHighlight] = react.useState(0)
  const [dismissed, setDismissed] = react.useState(false)
  const posRef = react.useRef<SmartPos | null>(null)
  const candidatesRef = react.useRef<ScoredTemplate[]>([])
  const draft = (input && input.draft) || ''

  // 订阅输入桥（overlay 发布）
  react.useEffect(() => onSmartInput(() => setInput(getSmartInput())), [])

  // 位置：载入记忆（无 → 右下角默认），视口 clamp
  react.useEffect(() => {
    const saved = loadSmartPos() || { x: (typeof window !== 'undefined' ? window.innerWidth : 1280) - 64, y: (typeof window !== 'undefined' ? window.innerHeight : 800) - 96 }
    const p = clampPos(saved, CARD_W, CARD_H)
    posRef.current = p
    setPos(p)
  }, [])
  const applyPos = (p: SmartPos) => { const c = clampPos(p, CARD_W, CARD_H); posRef.current = c; setPos(c) }

  // 用户改动草稿 → 解除「插入后抑制」与「Esc 收起」
  react.useEffect(() => { clearSuppression(draft); if (dismissed) setDismissed(false) }, [draft])

  const lang = getLang()
  const t = (k: keyof typeof STR) => tr(lang, STR[k])

  const suppressed = isSuppressed(draft)
  const candidates: ScoredTemplate[] = !enabled || suppressed ? [] : smartCandidates(draft)
  candidatesRef.current = candidates
  const showCard = candidates.length > 0 && !dismissed

  // 键盘可达：卡片打开且焦点在 composer 时 ↑↓ 移动 / Enter 填入 / Esc 收起
  react.useEffect(() => {
    if (!showCard || candidates.length === 0) return
    const onKey = (e: KeyboardEvent) => {
      try {
        const ae = document.activeElement as HTMLElement | null
        if (!ae || ae.tagName !== 'TEXTAREA') return
        if ((ae as HTMLTextAreaElement).value !== draft) return
        const list = candidatesRef.current
        if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); setHighlight((n) => (n + 1) % list.length) }
        else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); setHighlight((n) => (n - 1 + list.length) % list.length) }
        else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); const c = list[highlight]; if (c) doPick(c) }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setDismissed(true) }
      } catch (err) { /* ignore */ }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [showCard, draft, highlight, candidates.length])

  const doPick = (c: ScoredTemplate) => {
    smartInsert(c.tpl.body, c.tpl.id)
    setDismissed(true)
  }

  // 拖动（点/卡头均可）：pointer 事件 + 位置记忆
  const startDrag = (e: any) => {
    e.preventDefault(); e.stopPropagation()
    const base = posRef.current || { x: 0, y: 0 }
    const sx = e.clientX, sy = e.clientY
    const move = (ev: PointerEvent) => { applyPos({ x: base.x + (ev.clientX - sx), y: base.y + (ev.clientY - sy) }) }
    const up = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      const p = clampPos({ x: base.x + (ev.clientX - sx), y: base.y + (ev.clientY - sy) }, CARD_W, CARD_H)
      posRef.current = p; setPos(p); saveSmartPos(p)
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
  }

  if (!enabled || pos === null) return null

  const base = 'var(--dsw-alias-label-primary)'
  const muted = 'var(--dsw-alias-label-secondary)'
  const dim = 'var(--dsw-alias-label-tertiary)'
  const accent = 'var(--dsw-specific-accent,#f0a45c)'
  const line = '1px solid var(--dsw-alias-border-l1)'

  // ── 点（idle 手柄；卡显示时互斥消失）──
  const dot = h('div', {
    key: 'dot',
    style: {
      position: 'fixed', left: pos.x, top: pos.y,
      width: DOT_SIZE, height: DOT_SIZE, borderRadius: '50%',
      background: accent, boxShadow: 'var(--dsw-shadow-lv2)',
      cursor: 'grab', zIndex: 400, pointerEvents: 'auto',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, color: '#1a1a1e', fontWeight: 700, userSelect: 'none',
    },
    title: t('smartDot'),
    onPointerDown: startDrag,
  }, '⚡')

  // ── 卡（从点向右展开）──
  const cardStyle: any = {
    position: 'fixed', left: pos.x, top: pos.y,
    width: CARD_W, zIndex: 400, pointerEvents: 'auto',
    background: 'var(--dsw-specific-menu)', border: '1px solid var(--dsw-alias-border-inverted)',
    borderRadius: 12, boxShadow: 'var(--dsw-shadow-lv3)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    fontFamily: 'var(--dsw-font-family)', fontSize: 12.5, color: base,
  }
  const headStyle: any = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderBottom: line, cursor: 'grab' }
  const rowStyle = (on: boolean): any => ({
    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
    background: on ? 'var(--dsw-alias-interactive-bg-hover)' : 'transparent',
    borderBottom: line, cursor: 'pointer',
  })
  const fillBtn: any = {
    flex: 'none', border: 0, borderRadius: 7, padding: '4px 10px',
    background: accent, color: '#1a1a1e', fontWeight: 600, cursor: 'pointer',
    fontFamily: 'var(--dsw-font-family)', fontSize: 11.5, whiteSpace: 'nowrap',
  }
  const rows = candidates.map((c, i) => {
    const hits = c.score > 0 ? (c.strongHits.join(' / ') + (c.weakHits.length ? ' · ' + c.weakHits.join(' / ') : '')) : t('smartRecent')
    return h('div', { key: c.tpl.id, style: rowStyle(i === highlight), onClick: () => doPick(c) }, [
      h('span', { style: { flex: 'none', fontWeight: 600, fontSize: 12.8, color: base } }, c.tpl.name),
      h('span', { style: { flex: '1 1 auto', minWidth: 0, color: dim, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, hits),
      h('button', { style: fillBtn, title: t('smartFill'), onClick: (e: any) => { e.stopPropagation(); doPick(c) } }, t('smartFill')),
    ])
  })
  const card = h('div', { key: 'card', style: cardStyle }, [
    h('div', { style: headStyle, onPointerDown: startDrag }, [
      h('span', { style: { fontWeight: 700, fontSize: 12.5 } }, '⚡ ' + t('smartTitle')),
      h('span', { style: { color: dim, fontSize: 11 } }, t('smartHint')),
      h('div', { style: { flex: 1 } }),
      h('button', {
        style: { border: 0, background: 'transparent', color: dim, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 4px' },
        title: t('smartDismiss'), onClick: (e: any) => { e.stopPropagation(); setDismissed(true) },
      }, '×'),
    ]),
    h('div', { style: { maxHeight: 220, overflow: 'auto' } }, rows),
  ])

  return showCard ? card : dot
}
