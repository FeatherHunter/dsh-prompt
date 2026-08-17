/**
 * dsh-prompt — 智能模式悬浮卡（v1.1，shell.overlay root 作用域）
 * #5 定稿：全局单手柄点（点=缩小的卡，卡显示时点消失，互斥）/ 卡从点向右展开 /
 * 自由拖动 + 位置记忆（localStorage）+ 视口 clamp / 仅命中出现 / ≤3 候选（top-2 评分 + 最近使用，不足不凑）/
 * 评分=专属词×2+通用词×1（≥2 出卡）/ 排序=评分→用量 / 点击即填入 + 光标定位首字段冒号后（DEC11 修订）/
 * 默认开可配置关闭 / 与面板各管各的；键盘可达（↑↓/Enter/Esc）。
 */
import { getReact } from './panel'
import { smartCandidates, firstFieldCaret, type ScoredTemplate } from './match'
import { allTemplates, bumpUsage } from './store'
import {
  getSmartInput, onSmartInput, isSmartEnabled, setSmartEnabled,
  onSmartEnabled, loadSmartPos, saveSmartPos, suppressCard, isSuppressed, clearSuppression,
  type SmartPos,
} from './smartstore'
import { getLang, tr, STR } from './i18n'

const DOT_SIZE = 12 // 还原原设计：12px 次级色低调圆点（原型 GlobalDot 样式）
const CARD_W = 280 // 内容宽度收窄
const CARD_H_EST = 150 // 卡片高度估算（首次渲染未测量时用；测量后精确锚定）
const CARD_H = 300

function clampPos(p: SmartPos, w: number, h: number): SmartPos {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  return {
    x: Math.max(8, Math.min(p.x, vw - w - 8)),
    y: Math.max(8, Math.min(p.y, vh - h - 8)),
  }
}

/** 读取当前输入框草稿：优先焦点 textarea，其次可见 textarea；无 → 空串 */
function readActiveDraft(): string {
  try {
    if (typeof document === 'undefined') return ''
    const ae = document.activeElement as HTMLTextAreaElement | null
    if (ae && ae.tagName === 'TEXTAREA') {
      // 弹窗/表单输入 ≠ 会话草稿：面板新增/编辑弹窗内打字不应触发智能卡
      try { if (ae.closest && ae.closest('[data-dsh-prompt-modal]')) return '' } catch (e) { /* ignore */ }
      return ae.value || ''
    }
    const tas = document.querySelectorAll('textarea')
    for (let i = 0; i < tas.length; i++) {
      const ta = tas[i] as HTMLTextAreaElement
      if (ta.offsetParent !== null) {
        try { if (ta.closest && ta.closest('[data-dsh-prompt-modal]')) continue } catch (e) { /* ignore */ }
        return ta.value || ''
      }
    }
  } catch (e) { /* ignore */ }
  return ''
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
  const { actions } = getSmartInput()
  if (!actions || typeof actions.setDraft !== 'function') return
  const draft = readActiveDraft()
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
  const [draft, setDraft] = react.useState(readActiveDraft())
  const [pos, setPos] = react.useState<SmartPos | null>(null)
  const [dismissed, setDismissed] = react.useState(false)
  const [manualOpen, setManualOpen] = react.useState(false)
  const [cardH, setCardH] = react.useState(0)
  const posRef = react.useRef<SmartPos | null>(null)
  const cardRef = react.useRef<any>(null)
  const rowsRef = react.useRef<ScoredTemplate[]>([])
  const dragMovedRef = react.useRef(false)

  // 订阅输入桥（仅用于 actions/插入）+ 开关变更（设置页实时同步）
  react.useEffect(() => {
    const off1 = onSmartInput(() => setInput(getSmartInput()))
    const off2 = onSmartEnabled((on) => setEnabled(on))
    return () => { off1(); off2() }
  }, [])

  // 草稿来源 = 输入框 textarea 真实值（轮询 + focus 事件；与面板插入同源，不依赖 overlay 重渲染）
  react.useEffect(() => {
    const timer = setInterval(() => {
      const d = readActiveDraft()
      setDraft((prev) => (prev === d ? prev : d))
    }, 350)
    const onFocus = () => { setDraft(readActiveDraft()) }
    if (typeof document !== 'undefined') document.addEventListener('focusin', onFocus, true)
    return () => { clearInterval(timer); if (typeof document !== 'undefined') document.removeEventListener('focusin', onFocus, true) }
  }, [])

  // 位置：载入记忆（无 → 右下角、输入区上方默认），按圆点尺寸 clamp（圆点可贴近角落）
  react.useEffect(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800
    const saved = loadSmartPos() || { x: 32, y: Math.round(vh * 0.72) }
    const p = clampPos(saved, DOT_SIZE, DOT_SIZE)
    posRef.current = p
    setPos(p)
  }, [])
  const applyPos = (p: SmartPos) => { const c = clampPos(p, DOT_SIZE, DOT_SIZE); posRef.current = c; setPos(c) }

  // 用户改动草稿 → 解除「插入后抑制」「Esc 收起」「手动展开」（回到自动出卡行为）
  react.useEffect(() => { clearSuppression(draft); if (dismissed) setDismissed(false); if (manualOpen) setManualOpen(false) }, [draft])

  const lang = getLang()
  const t = (k: keyof typeof STR) => tr(lang, STR[k])

  const suppressed = isSuppressed(draft)
  const candidates: ScoredTemplate[] = !enabled || suppressed ? [] : smartCandidates(draft)
  // 手动展开且无匹配时：中性常用兜底（预设顺序 ≤3，不按用量——避免"用过一次就一直冒"）
  const fallbackRows: ScoredTemplate[] = allTemplates().slice(0, 3).map((tpl) => ({ tpl, score: 0, strongHits: [], weakHits: [] }))
  const rows: ScoredTemplate[] = candidates.length > 0 ? candidates : (manualOpen ? fallbackRows : [])
  rowsRef.current = rows
  const showCard = rows.length > 0 && !dismissed

  // 测量卡片真实高度（布局后回调）：保证卡与圆点贴合，不因估算偏差悬空（hooks 顺序：在 early return 之前）
  react.useEffect(() => {
    if (!showCard) return
    const el = cardRef.current
    if (!el) return
    const h = (el as HTMLElement).offsetHeight || 0
    if (h > 0 && h !== cardH) setCardH(h)
  }, [showCard, rows.length])

  // 不捕获键盘：Enter/↑↓ 保持输入框原生语义（用户要求），仅手动点击「点击填入」按钮录入

  const doPick = (c: ScoredTemplate) => {
    smartInsert(c.tpl.body, c.tpl.id)
    setDismissed(true); setManualOpen(false)
  }

  // 拖动（点/卡头均可）：pointer 事件 + 位置记忆；移动过则不算点击
  const startDrag = (e: any) => {
    e.preventDefault(); e.stopPropagation()
    dragMovedRef.current = false
    const base = posRef.current || { x: 0, y: 0 }
    const sx = e.clientX, sy = e.clientY
    const move = (ev: PointerEvent) => { dragMovedRef.current = true; applyPos({ x: base.x + (ev.clientX - sx), y: base.y + (ev.clientY - sy) }) }
    const up = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      const p = clampPos({ x: base.x + (ev.clientX - sx), y: base.y + (ev.clientY - sy) }, DOT_SIZE, DOT_SIZE)
      posRef.current = p; setPos(p); saveSmartPos(p)
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
  }

  // 首帧必渲染：pos 尚未从 localStorage 载入时先用默认值（右下角），effect 载入后精确定位
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const effectivePos = pos !== null ? pos : { x: 32, y: Math.round(vh * 0.72) }
  if (!enabled) return null

  const base = 'var(--dsw-alias-label-primary)'
  const muted = 'var(--dsw-alias-label-secondary)'
  const dim = 'var(--dsw-alias-label-tertiary)'
  const accent = 'var(--dsw-specific-accent,#f0a45c)'
  const line = '1px solid var(--dsw-alias-border-l1)'

  // ── 点（idle 手柄；卡显示时互斥消失）── 还原原设计：12px 次级色低调圆点，点击展开
  const dot = h('div', {
    key: 'dot',
    style: {
      position: 'fixed', left: effectivePos.x, top: effectivePos.y,
      width: DOT_SIZE, height: DOT_SIZE, borderRadius: '50%',
      background: 'var(--dsw-alias-label-tertiary)', opacity: 0.45,
      boxShadow: 'var(--dsw-shadow-lv1)', cursor: 'grab', zIndex: 400, pointerEvents: 'auto',
      userSelect: 'none',
    },
    title: t('smartDot'),
    onPointerDown: startDrag,
    onClick: () => { if (dragMovedRef.current) return; setManualOpen(true); setDismissed(false) },
  })

  // ── 卡：从圆点右侧展开（卡左缘 = 圆点右缘，垂直以圆点为中心）；用真实高度锚定，贴边自动折返 ──
  const dotX = effectivePos.x, dotY = effectivePos.y
  const cardHeight = cardH > 0 ? cardH : CARD_H_EST
  // 圆点圆心 = 卡片左下角：卡左缘=圆点中心 x、卡底边=圆点中心 y，向 右上 展开
  const dotCx = dotX + DOT_SIZE / 2, dotCy = dotY + DOT_SIZE / 2
  let cardX = dotCx
  if (cardX + CARD_W > vw - 8) cardX = Math.max(8, dotCx - CARD_W) // 右侧放不下 → 向左展开（卡右缘贴圆点中心）
  cardX = Math.max(8, Math.min(cardX, vw - CARD_W - 8))
  let cardY = dotCy - cardHeight
  if (cardY < 8) cardY = 8 // 顶部放不下 → 贴顶（圆点保持在原位）
  cardY = Math.max(8, Math.min(cardY, vh - cardHeight - 8))
  const cardPos = { x: cardX, y: cardY }
  const cardStyle: any = {
    position: 'fixed', left: cardPos.x, top: cardPos.y,
    width: CARD_W, zIndex: 400, pointerEvents: 'auto',
    background: 'var(--dsw-specific-menu)', border: '1px solid var(--dsw-alias-border-inverted)',
    borderRadius: 12, boxShadow: 'var(--dsw-shadow-lv3)',
    display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px',
    fontFamily: 'var(--dsw-font-family)', fontSize: 'var(--dsw-font-markdown-base-font-size)', color: base,
  }
  const headStyle: any = { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderBottom: line, cursor: 'grab', minWidth: 0 }
  // 行 = 圆角子卡片（原型样式）：编号 + 名称 + 标签(·分N/·最近) + 命中词 + 「点击填入」按钮
  // 行 = 精简：编号 + 名称 + 标签 + 命中词 + 小按钮（点整行即填入，控件小而克制）
  const rowStyle: any = {
    display: 'flex', alignItems: 'center', gap: 6, padding: '3px 7px', minWidth: 0,
    background: 'var(--dsw-alias-bg-layer-2)', border: '1px solid var(--dsw-alias-border-l1)',
    borderRadius: 8, cursor: 'pointer', overflow: 'hidden',
  }
  const rowNum: any = { color: dim, fontSize: '0.77em', flex: 'none' }
  const rowName: any = { fontWeight: 500, fontSize: '0.88em', flex: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 }
  const rowTag: any = { color: muted, flex: 'none', fontSize: '0.77em' }
  const rowHint: any = { color: dim, flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.77em' }
  const fillBtn: any = {
    flex: 'none', border: '1px solid var(--dsw-alias-border-l2)',
    background: 'var(--dsw-alias-bg-layer-3)', color: base,
    borderRadius: 5, padding: '1px 7px', cursor: 'pointer',
    fontFamily: 'var(--dsw-font-family)', fontSize: '0.8em', fontWeight: 500, whiteSpace: 'nowrap',
  }
  const rowNodes = rows.map((c, i) => {
    const common = c.score === 0
    const domain = (c.tpl as any).domain || (c.tpl as any).tag || ''
    const tagText = (domain ? domain + ' ' : '') + (common ? '·常用' : '·分' + c.score)
    const hits = common ? t('smartCommon') : (c.strongHits.join(' / ') + (c.weakHits.length ? ' · ' + c.weakHits.join(' / ') : ''))
    return h('div', { key: c.tpl.id, style: rowStyle, onClick: () => doPick(c), title: t('smartFill') }, [
      h('span', { style: rowNum }, String(i + 1)),
      h('span', { style: rowName }, c.tpl.name),
      h('span', { style: rowTag }, tagText),
      h('span', { style: rowHint }, hits),
      h('button', { style: fillBtn, title: t('smartFill'), onClick: (e: any) => { e.stopPropagation(); doPick(c) } }, t('smartFill')),
    ])
  })
  const card = h('div', { key: 'card', ref: cardRef, style: cardStyle }, [
    h('div', { style: headStyle, onPointerDown: startDrag }, [
      h('span', { style: { fontWeight: 600, fontSize: '0.85em' } }, t('smartTitle')),
      h('span', { style: { color: dim, fontSize: '0.77em' } }, t('smartHint')),
      h('div', { style: { flex: 1 } }),
      h('button', {
        style: { border: 0, background: 'transparent', color: dim, cursor: 'pointer', fontSize: '0.92em', lineHeight: 1, padding: '0 2px', flex: 'none' },
        title: t('smartDismiss'),
        onPointerDown: (e: any) => e.stopPropagation(),
        onClick: (e: any) => { e.stopPropagation(); setDismissed(true); setManualOpen(false) },
      }, '×'),
    ]),
    h('div', { style: { maxHeight: 220, overflowY: 'auto', overflowX: 'hidden' } }, rowNodes),
  ])

  return showCard ? card : dot
}
