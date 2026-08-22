/**
 * dsh-prompt — 模板浏览组件（面板 popover 与设置页共用）
 * #4 交互定稿：tabs（阶段）+ 领域筛选 + 搜索；排序=置顶≤5 → 用量；单击插入（光标处/末尾、不覆盖、自动聚焦）；
 * 插入后自动关闭；编辑/删除/新增时保持打开；hover 快捷操作；＋弹窗新增；删除二次确认；预制可复制为自定义。
 * #13 bottom-up：compact 浮层（⚡Prompt 悬浮列表）改 bottom-up——最常用在底部，未使用在顶部；置顶簇在底部；打开自动滚到底部。
 * 设置页（compact=false）保持原 Top-down。
 */
import type { PromptTemplate } from './templates'
import { PRESET_TEMPLATES, getPresetById } from './templates'
import {
  allTemplates, sortedTemplates, sortedTemplatesBottomUp, displayTag, isPinned, togglePin, canPinMore,
  addCustom, updateCustom, removeCustom, copyPresetToCustom, bumpUsage, templateHaystack, MAX_BODY,
} from './store'
import { setPanelOpen, schedulePanelClose, cancelPanelClose, setHoverCloseSuppressed } from './state'
import { getLang, tr, STR, type Lang } from './i18n'
import { setSmartInput } from './smartstore'

export function getReact(): any {
  if (typeof require === 'function') { try { return require('react') } catch (e) { /* ignore */ } }
  if (typeof globalThis !== 'undefined' && (globalThis as any).React) return (globalThis as any).React
  return null
}

const STAGE_TABS = ['all', '执行前', '执行中', '执行后'] as const
const DOMAIN_FILTERS = ['all', '思考框架', '学习', '工程', '执行'] as const
const CUSTOM_TAG = '自定义'

export interface BrowserProps {
  compact: boolean
  inputActions?: any
  useInput?: any
}

interface ModalState {
  kind: 'add' | 'edit' | 'del'
  t?: PromptTemplate
}

/** 插入正文到当前草稿（光标处优先，否则末尾；不覆盖；自动聚焦） */
export function insertBody(useInput: any, inputActions: any, body: string): void {
  let draft = ''
  try { const st = useInput ? useInput((s: any) => s) : null; draft = (st && st.draft) || '' } catch (e) { /* ignore */ }
  let pos = draft.length
  try {
    if (typeof document !== 'undefined') {
      const tas = document.querySelectorAll('textarea')
      for (let i = 0; i < tas.length; i++) {
        const ta = tas[i] as HTMLTextAreaElement
        if (ta.value === draft) { pos = typeof ta.selectionStart === 'number' ? ta.selectionStart : draft.length; break }
      }
    }
  } catch (e) { /* ignore */ }
  const newDraft = draft.slice(0, pos) + body + draft.slice(pos)
  if (inputActions && typeof inputActions.setDraft === 'function') inputActions.setDraft(newDraft)
  setTimeout(() => {
    try {
      if (typeof document !== 'undefined') {
        const tas = document.querySelectorAll('textarea')
        for (let i = 0; i < tas.length; i++) {
          const ta = tas[i] as HTMLTextAreaElement
          if (ta.value === newDraft) { ta.focus(); ta.setSelectionRange(pos + body.length, pos + body.length); break }
        }
      }
    } catch (e) { /* ignore */ }
  }, 0)
}

/** 点击模板：插入 + 用量 +1 + 面板关闭 */
export function onPick(t: PromptTemplate, useInput: any, inputActions: any): void {
  insertBody(useInput, inputActions, t.body)
  bumpUsage(t.id)
  setPanelOpen(false)
}

/** 模板浏览（面板 / 设置页共用） */
// ── 弹窗组件（模块级稳定类型：内联函数组件会在父组件每次重渲染时被整体卸载重建 → 输入内容丢失）──
const modalMaskStyle: any = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }
const modalCardStyle: any = { width: 460, background: 'var(--dsw-specific-menu)', border: '1px solid var(--dsw-alias-border-inverted)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'var(--dsw-font-family)', color: 'var(--dsw-alias-label-primary)' }
const modalFieldStyle: any = { width: '100%', background: 'var(--dsw-alias-bg-layer-3)', border: '1px solid var(--dsw-alias-border-l1)', color: 'var(--dsw-alias-label-primary)', borderRadius: 8, padding: '8px 10px', fontFamily: 'var(--dsw-font-family)', fontSize: '0.96em', outline: 'none', boxSizing: 'border-box' }
const modalBtnsStyle: any = { display: 'flex', justifyContent: 'flex-end', gap: 8 }
const modalBtn = (primary?: boolean, danger?: boolean): any => ({ padding: '6px 14px', borderRadius: 8, border: primary ? 0 : '1px solid var(--dsw-alias-border-l1)', background: primary ? 'var(--dsw-specific-accent,#f0a45c)' : 'var(--dsw-alias-bg-layer-3)', color: primary ? '#1a1a1e' : (danger ? 'var(--dsw-specific-danger,#e06c75)' : 'var(--dsw-alias-label-primary)'), cursor: 'pointer', fontFamily: 'var(--dsw-font-family)', fontSize: '0.96em' })

/** 新建/编辑弹窗（模块级稳定组件，避免父级重渲染时被卸载重置） */
function TemplateModal(props: any): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  const editing = props.kind === 'edit' && !!props.tpl
  const s1 = react.useState(editing ? props.tpl.name : '')
  const name = s1[0]; const setName = s1[1]
  const s2 = react.useState(editing ? (props.tpl as any).tag || CUSTOM_TAG : CUSTOM_TAG)
  const tag = s2[0]; const setTag = s2[1]
  const s3 = react.useState(editing ? props.tpl.body : '')
  const body = s3[0]; const setBody = s3[1]
  const errState = react.useState<string | null>(null)
  const err = errState[0]; const setErr = errState[1]
  const doOk = () => {
    const nm = name.trim(), bd = body.trim()
    if (!nm) { setErr('nameRequired'); return }
    if (bd.length > MAX_BODY) { setErr('bodyTooLong'); return }
    props.onOk && props.onOk({ name: nm, tag: tag || CUSTOM_TAG, body: bd })
  }
  return h('div', { style: modalMaskStyle, 'data-dsh-prompt-modal': '', onClick: (e: any) => { if (e.target === e.currentTarget) props.onCancel() } }, [
    h('div', { style: modalCardStyle }, [
      h('h3', { style: { fontSize: '1.08em', margin: 0 } }, editing ? props.t('editTitle') : props.t('addTitle')),
      h('input', { style: modalFieldStyle, placeholder: props.t('namePh'), value: name, onChange: (e: any) => setName(e.target.value) }),
      h('input', { style: modalFieldStyle, placeholder: props.t('tagPh'), value: tag, onChange: (e: any) => setTag(e.target.value) }),
      h('textarea', { style: { ...modalFieldStyle, height: 110, resize: 'vertical' }, placeholder: props.t('bodyPh'), value: body, onChange: (e: any) => setBody(e.target.value) }),
      err ? h('div', { style: { fontSize: '0.92em', color: 'var(--dsw-specific-danger,#e06c75)' } }, props.t(err as keyof typeof STR)) : null,
      h('div', { style: modalBtnsStyle }, [
        h('button', { style: modalBtn(), onClick: props.onCancel }, props.t('cancel')),
        h('button', { style: modalBtn(true), onClick: doOk }, editing ? props.t('save') : props.t('addOk')),
      ]),
    ]),
  ])
}

/** 删除确认弹窗（同样模块级稳定组件） */
function ConfirmDelete(props: any): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  return h('div', { style: modalMaskStyle, 'data-dsh-prompt-modal': '', onClick: (e: any) => { if (e.target === e.currentTarget) props.onCancel() } }, [
    h('div', { style: modalCardStyle }, [
      h('h3', { style: { fontSize: '1.08em', margin: 0 } }, props.t('delTitle')),
      h('div', { style: { fontSize: '0.96em', color: 'var(--dsw-alias-label-tertiary)' } }, props.t('delMsg') + '「' + props.tpl.name + '」' + props.t('delUnrecover')),
      h('div', { style: modalBtnsStyle }, [
        h('button', { style: modalBtn(), onClick: props.onCancel }, props.t('cancel')),
        h('button', { style: modalBtn(false, true), onClick: props.onOk }, props.t('delOk')),
      ]),
    ]),
  ])
}

export function TemplateBrowser(props: BrowserProps): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  const { compact, inputActions, useInput } = props

  const langState = react.useState<Lang>(getLang())
  const lang = langState[0]
  const tickState = react.useState(0)
  const setTick = tickState[1]
  const tabState = react.useState<string>('all')
  const tab = tabState[0]
  const domainState = react.useState<string>('all')
  const domain = domainState[0]
  const qState = react.useState('')
  const q = qState[0]
  const modalState = react.useState<ModalState | null>(null)
  const modal = modalState[0]
  const posState = react.useState<{ left: number; bottom: number } | null>(null)
  const pos = posState[0]
  const rootRef = react.useRef<any>(null)
  const listRef = react.useRef<any>(null)
  const highlightState = react.useState<string | null>(null)
  const highlightId = highlightState[0]

  // 正上方对齐 ⚡Prompt 按钮（仅紧凑面板/popover）：fixed + 按钮视口 rect
  // 列表左缘与按钮左缘垂直对齐（left = btn.left）；列表底边在按钮顶边之上 → 整体位于按钮正上方
  react.useEffect(() => {
    if (!compact) return
    const compute = () => {
      try {
        const btn = typeof document !== 'undefined' ? document.querySelector('[data-dsh-prompt-entry]') : null
        if (!btn) return
        const br = (btn as HTMLElement).getBoundingClientRect()
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800
        const width = 560
        let left = br.left
        if (left < 8) left = 8 // 左越界贴左
        if (left + width > vw - 8) left = Math.max(8, vw - width - 8) // 右越界回挤
        posState[1]({ left, bottom: vh - br.top + 8 }) // 面板底边 = 按钮顶边上方 8px
      } catch (e) { /* ignore */ }
    }
    compute()
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', compute)
      return () => window.removeEventListener('resize', compute)
    }
  }, [])

  // 语言跟随 html[lang]
  react.useEffect(() => {
    if (typeof document === 'undefined') return
    const onLang = () => { langState[1](getLang()) }
    const obs = new MutationObserver(onLang)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
    return () => { obs.disconnect() }
  }, [])

  // #14 回归：紧凑浮层弹窗打开期间抑制 hover 自动关窗（含入口按钮的 schedulePanelClose）
  // - 本地根节点 hover 同步抑制（防御式） + 全局 gate（覆盖入口按钮）
  // deps 用 !!modal 避免对象身份抖动；onCancel/onOk 中同步清门控以消除 effect 下一帧前的竞态窗口
  react.useEffect(() => {
    if (!compact) return
    if (modal) setHoverCloseSuppressed(true)
    else setHoverCloseSuppressed(false)
    return () => { setHoverCloseSuppressed(false) }
  }, [compact, !!modal])

  const refresh = () => setTick((n) => n + 1)
  const t = (k: keyof typeof STR) => tr(lang, STR[k])

  // 列表组装：tab=自定义 → 仅自定义；否则 预制+自定义，按 阶段 → 领域 → 搜索过滤，排序
  const customs = allTemplates().filter((x) => !x.builtin)
  const list = allTemplates().filter((x) => {
    if (tab === CUSTOM_TAG) return !x.builtin
    if (tab !== 'all' && x.stage !== tab) return false
    if (domain !== 'all' && displayTag(x) !== domain) return false
    return true
  })
  const ql = q.trim().toLowerCase()
  // 搜索与 /prompt 触发源共用检索底座（名称/正文/领域/阶段/动作/标签）
  const filtered = ql
    ? list.filter((x) => templateHaystack(x).indexOf(ql) >= 0)
    : list
  // 悬浮列表 bottom-up：compact 浮层按用量升序（最常用在底部），设置页保持原置顶→用量降序
  const sorted = compact ? sortedTemplatesBottomUp(filtered) : sortedTemplates(filtered)

  // bottom-up 浮层：打开 / 过滤变化后自动滚到底部，首屏即见最常用
  // 使用双 rAF + setTimeout 兜底，确保在 fixed 定位与 flex 布局完成后再滚动；对短列表（无滚动）也保持在底部
  react.useEffect(() => {
    if (!compact) return
    const el = listRef.current as any
    if (!el) return
    let raf1: any, raf2: any, tid: any
    const scroll = () => { try { el.scrollTop = el.scrollHeight } catch (e) { /* ignore */ } }
    if (typeof requestAnimationFrame !== 'undefined') {
      raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(scroll); tid = setTimeout(scroll, 50) })
    } else {
      tid = setTimeout(scroll, 30)
    }
    return () => { try { if (raf1) cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2); clearTimeout(tid) } catch (e) { /* ignore */ } }
  }, [compact, tab, domain, q, filtered.length, sorted.length])

  const presetCount = PRESET_TEMPLATES.length
  const customCount = customs.length

  // ── 样式（DSH 主题变量）──
  const base = 'var(--dsw-alias-label-primary)'
  const muted = 'var(--dsw-alias-label-secondary)'
  const dim = 'var(--dsw-alias-label-tertiary)'
  const line = '1px solid var(--dsw-alias-border-l1)'
  const panelStyle: any = compact
    ? {
        position: 'fixed', left: (pos && pos.left) || 0, bottom: (pos && pos.bottom) || 0,
        zIndex: 500, width: 560,
        display: 'flex', flexDirection: 'column',
        background: 'var(--dsw-specific-menu)', border: '1px solid var(--dsw-alias-border-inverted)',
        borderRadius: 12, boxShadow: 'var(--dsw-shadow-lv3)', overflow: 'hidden',
        fontFamily: 'var(--dsw-font-family)', fontSize: 'var(--dsw-font-markdown-base-font-size)', color: base,
      }
    : {
        display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 8px',
        fontFamily: 'var(--dsw-font-family)', fontSize: 'var(--dsw-font-markdown-base-font-size)', color: base,
      }
  const headStyle: any = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderBottom: line }
  const titleStyle: any = { fontWeight: 700, fontSize: '1em' }
  const addBtn: any = { width: 26, height: 26, borderRadius: 7, border: line, background: 'var(--dsw-alias-bg-layer-3)', color: 'var(--dsw-specific-accent,#f0a45c)', fontSize: '1.2em', lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }
  const closeBtn: any = { width: 26, height: 26, borderRadius: 7, border: 0, background: 'transparent', color: dim, fontSize: '1.2em', lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }
  const headBtns: any = { display: 'flex', gap: 4, alignItems: 'center' }
  const tabsStyle: any = { display: 'flex', gap: 4, padding: '4px 8px 0', flexWrap: 'wrap' }
  const tabBtn = (on: boolean): any => ({
    padding: '2px 8px', borderRadius: 999, border: line, background: on ? 'var(--dsw-alias-bg-layer-3)' : 'transparent',
    color: on ? base : muted, cursor: 'pointer', fontFamily: 'var(--dsw-font-family)', fontSize: '0.85em',
  })
  const domainRowStyle: any = { display: 'flex', gap: 4, padding: '3px 8px 0', flexWrap: 'wrap' }
  const searchStyle: any = { margin: '5px 8px 4px', padding: '5px 9px', borderRadius: 8, border: line, background: 'var(--dsw-alias-bg-layer-3)', color: base, fontFamily: 'var(--dsw-font-family)', fontSize: '0.96em', outline: 'none' }
  // 固定 360 高度：过滤/搜索时不收缩，鼠标不因高度变化而移出面板而误关；约 10 个单行 item 可见，内部滚动
  // 少量时（≤10）用 flex-end 把内容推到底部，使“最常用在底部”在视觉上贴底
  const listStyle: any = compact
    ? { overflow: 'auto', padding: '2px 2px 8px', height: 360, display: 'flex', flexDirection: 'column', justifyContent: sorted.length <= 10 ? 'flex-end' : 'flex-start' }
    : { padding: '2px 2px 8px' } // 设置页：自然高度，由宿主设置面板整页滚动
  const itemStyle: any = { display: 'flex', gap: 6, borderRadius: 8, cursor: 'pointer', alignItems: compact ? 'center' : 'flex-start', padding: compact ? '3px 6px' : '4px 2px' }
  const pinStyle = (on: boolean): any => ({ flex: 'none', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 0, background: 'transparent', borderRadius: 6 })
  const nmStyle: any = { flex: 'none', minWidth: 0, fontSize: '0.98em', color: base, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  const subStyle: any = { display: 'block', fontSize: '0.85em', color: dim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  // 勋章式标签：填充底色 + 精致胶囊
  const tagStyle: any = { flex: 'none', fontSize: '0.7em', fontWeight: 500, color: muted, background: 'var(--dsw-alias-bg-layer-3)', border: '1px solid var(--dsw-alias-border-l2)', padding: '0 7px', borderRadius: 999, lineHeight: '15px', letterSpacing: '0.02em', whiteSpace: 'nowrap' }
  const actStyle: any = { display: 'flex', gap: 4, flex: 'none' }
  const actBtn = (danger?: boolean): any => ({ border: line, background: 'transparent', color: danger ? 'var(--dsw-specific-danger,#e06c75)' : dim, cursor: 'pointer', fontSize: '0.85em', padding: '1px 8px', borderRadius: 999, fontFamily: 'var(--dsw-font-family)', whiteSpace: 'nowrap' })
  const footStyle: any = { padding: '8px 12px', borderTop: line, display: 'flex', justifyContent: 'space-between', fontSize: '0.85em', color: dim }
  const footLink: any = { color: 'var(--dsw-specific-accent,#f0a45c)', cursor: 'pointer', textDecoration: 'none', background: 'transparent', border: 0, fontFamily: 'var(--dsw-font-family)', fontSize: '0.85em' }

  // ── 操作 ──
  const handlePick = (x: PromptTemplate) => { onPick(x, useInput, inputActions) }

  const handlePin = (e: any, x: PromptTemplate) => {
    e.stopPropagation()
    const r = togglePin(x.id)
    if (!r.ok) { alert(t('pinFull')) }
    refresh()
  }

  const handleCopy = (e: any, id: string) => {
    e.stopPropagation()
    const c = copyPresetToCustom(id)
    if (!c) return
    // 创建反馈：自动置顶（容量允许）→ 切「自定义」tab → 高亮新项 → 滚入视野
    const r = togglePin(c.id)
    tabState[1](CUSTOM_TAG)
    highlightState[1](c.id)
    refresh()
    setTimeout(() => {
      highlightState[1](null)
      try {
        const el = typeof document !== 'undefined' ? document.querySelector('[data-dsh-prompt-id="' + c.id + '"]') : null
        if (el) (el as HTMLElement).scrollIntoView({ block: 'nearest' })
      } catch (err) { /* ignore */ }
    }, 1600)
  }

  const handleDel = (e: any, x: PromptTemplate) => {
    e.stopPropagation()
    modalState[1]({ kind: 'del', t: x })
  }

  const handleEdit = (e: any, x: PromptTemplate) => {
    e.stopPropagation()
    modalState[1]({ kind: 'edit', t: x })
  }

  // ── 弹窗（新增/编辑/删除确认）── 模块级稳定组件：内联函数组件会在父级每次重渲染时被卸载重建 → 输入内容丢失
  let modalNode: any = null
  if (modal) {
    if (modal.kind === 'add' || modal.kind === 'edit') {
      modalNode = h('div', { key: 'tplmodal-' + modal.kind + (modal.t ? '-' + modal.t.id : '') }, [
        h(TemplateModal, {
          kind: modal.kind, tpl: modal.t, t,
          onCancel: () => { setHoverCloseSuppressed(false); modalState[1](null) },
          onOk: (f: { name: string; tag: string; body: string }) => {
            if (modal.kind === 'edit' && modal.t) { updateCustom(modal.t.id, f) }
            else { addCustom(f.name, f.tag, f.body) }
            setHoverCloseSuppressed(false); modalState[1](null)
            refresh()
          },
        }),
      ])
    } else if (modal.kind === 'del' && modal.t) {
      modalNode = h('div', { key: 'del-' + modal.t.id }, [
        h(ConfirmDelete, {
          tpl: modal.t, t,
          onCancel: () => { setHoverCloseSuppressed(false); modalState[1](null) },
          onOk: () => { removeCustom(modal.t!.id); setHoverCloseSuppressed(false); modalState[1](null); refresh() },
        }),
      ])
    }
  }

  // ── 组装 ──
  const tabs = [
    { id: 'all', label: t('tabAll') },
    { id: '执行前', label: t('tabBefore') },
    { id: '执行中', label: t('tabDuring') },
    { id: '执行后', label: t('tabAfter') },
    { id: CUSTOM_TAG, label: t('tabCustom') },
  ]
  const tabNodes = h('div', { style: tabsStyle }, tabs.map((tb) =>
    h('button', { key: tb.id, style: tabBtn(tab === tb.id), onClick: () => { tabState[1](tb.id); refresh() } }, tb.label),
  ))
  const domainNodes = h('div', { style: domainRowStyle }, DOMAIN_FILTERS.map((d) =>
    h('button', { key: d, style: tabBtn(domain === d), onClick: () => { domainState[1](d); refresh() } }, d === 'all' ? t('domainAll') : d),
  ))
  const rows = sorted.map((x) => {
    const pinned = isPinned(x.id)
    const custom = !x.builtin
    const acts = custom
      ? h('span', { style: actStyle }, [
          h('button', { style: actBtn(), onClick: (e: any) => handleEdit(e, x) }, t('edit')),
          h('button', { style: actBtn(true), onClick: (e: any) => handleDel(e, x) }, t('del')),
        ])
      : h('span', { style: actStyle }, [
          h('button', { style: actBtn(), onClick: (e: any) => handleCopy(e, x.id) }, t('copy')),
        ])
    const itemBg = highlightId === x.id ? 'var(--dsw-alias-interactive-bg-hover)' : undefined
    // 简介 = body 首行（一句话），标题之后跟随 —— 单行显示
    const intro = (x.body || '').split('\n')[0].trim()
    // 紧凑（⚡Prompt 浮层）：单行 —— 图钉 + 标题 + 简介 + 操作横排，不再占两行
    if (compact) {
      return h('div', { key: x.id, style: { ...itemStyle, background: itemBg, minWidth: 0 }, 'data-dsh-prompt-id': x.id, onClick: () => handlePick(x), title: t('insertHint') }, [
        h('button', { style: pinStyle(pinned), title: t('pin'), onClick: (e: any) => handlePin(e, x) }, [
          h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: pinned ? 'var(--dsw-specific-accent,#f0a45c)' : 'none', stroke: pinned ? 'var(--dsw-specific-accent,#f0a45c)' : dim, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', style: { display: 'block' } }, [
            h('path', { d: 'M12 17v5' }),
            h('path', { d: 'M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z' }),
          ]),
        ]),
        h('span', { style: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 6, overflow: 'hidden' } }, [
          h('span', { style: { flex: 'none', fontSize: '0.95em', color: base, fontWeight: 600, whiteSpace: 'nowrap' } }, x.name),
          h('span', { style: { flex: '1 1 auto', minWidth: 0, fontSize: '0.85em', color: muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, intro),
        ]),
        h('span', { style: actStyle }, acts),
      ])
    }
    return h('div', { key: x.id, style: { ...itemStyle, background: itemBg }, 'data-dsh-prompt-id': x.id, onClick: () => handlePick(x), title: t('insertHint') }, [
      h('div', { style: { flex: 'none', paddingTop: 2 } }, [
        h('button', { style: pinStyle(pinned), title: t('pin'), onClick: (e: any) => handlePin(e, x) }, [
          // 图钉（置顶语义）：置顶=橙色实心，未置顶=描边
          h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: pinned ? 'var(--dsw-specific-accent,#f0a45c)' : 'none', stroke: pinned ? 'var(--dsw-specific-accent,#f0a45c)' : dim, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', style: { display: 'block' } }, [
            h('path', { d: 'M12 17v5' }),
            h('path', { d: 'M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z' }),
          ]),
        ]),
      ]),
      h('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 } }, [
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 } }, [
          h('span', { style: nmStyle }, x.name),
          h('span', { style: tagStyle }, displayTag(x)),
        ]),
        h('span', { style: subStyle }, (x.body || '').slice(0, 44) + '…'),
      ]),
      h('div', { style: { flex: 'none', display: 'flex', alignItems: 'center', gap: 4, paddingTop: 2 } }, [acts]),
    ])
  })
  const listNode = rows.length > 0
    ? h('div', { ref: compact ? listRef : null, style: listStyle }, rows)
    : h('div', { style: { padding: 14, color: dim, fontSize: '0.92em' } }, t('noMatch'))

  const footer = null

  // 浮层根节点 hover 接管：鼠标进列表 → 取消关窗；离开列表 → 延迟关窗（仅紧凑浮层有 hover 开合语义）
  // #14：弹窗打开时禁止触发关窗（本地防御 + 全局 gate 双保险，输入时微移动/焦点变化不丢弹窗）
  const rootHover = compact ? { onMouseEnter: () => cancelPanelClose(), onMouseLeave: () => { if (modal) return; schedulePanelClose(150) } } : null
  return h('div', { ref: rootRef, style: panelStyle, ...rootHover }, [
    compact ? h('div', { style: headStyle }, [
      h('svg', { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--dsw-specific-accent,#f0a45c)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', style: { flex: 'none' } }, [
        h('path', { d: 'M15 14c.2-1 .7-1.7 1.5-2.5C17.5 10.6 18 9.3 18 8a6 6 0 1 0-12 0c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5' }),
        h('path', { d: 'M9 18h6' }),
        h('path', { d: 'M10 22h4' }),
        h('path', { d: 'M18.5 2.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z' }),
      ]),
      h('span', { style: titleStyle }, t('panelTitle')),
      h('span', { style: { fontSize: '0.85em', color: dim, marginLeft: 6 } }, t('presetCount') + ' ' + presetCount + ' · ' + t('customCount') + ' ' + customCount),
      h('div', { style: { flex: 1 } }),
      h('button', { style: footLink, onClick: () => { setPanelOpen(false); emitGoSettings() } }, t('goSettings')),
      h('div', { style: headBtns }, [
        h('button', { style: addBtn, title: t('add'), onClick: () => modalState[1]({ kind: 'add' }) }, '＋'),
        h('button', { style: closeBtn, title: t('close'), onClick: () => setPanelOpen(false) }, '×'),
      ]),
    ]) : h('div', { style: headStyle }, [
      h('svg', { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--dsw-specific-accent,#f0a45c)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', style: { flex: 'none' } }, [
        h('path', { d: 'M15 14c.2-1 .7-1.7 1.5-2.5C17.5 10.6 18 9.3 18 8a6 6 0 1 0-12 0c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5' }),
        h('path', { d: 'M9 18h6' }),
        h('path', { d: 'M10 22h4' }),
        h('path', { d: 'M18.5 2.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z' }),
      ]),
      h('span', { style: titleStyle }, t('panelTitle')),
      h('div', { style: { flex: 1 } }),
      h('button', { style: { ...addBtn, width: 'auto', padding: '0 12px', fontSize: '0.92em' }, title: t('add'), onClick: () => modalState[1]({ kind: 'add' }) }, '＋ ' + t('addShort')),
    ]),
    tabNodes,
    domainNodes,
    h('input', { style: searchStyle, placeholder: t('searchPh'), value: q, onChange: (e: any) => qState[1](e.target.value) }),
    listNode,
    footer,
    modalNode,
  ])
}

/** 面板 → 设置页跳转（宿主 settings 路由：由 index.ts 注册） */
let goSettingsHandler: (() => void) | null = null
export function setGoSettingsHandler(fn: (() => void) | null): void { goSettingsHandler = fn }
function emitGoSettings(): void { if (goSettingsHandler) goSettingsHandler() }

export function getPresetList(): PromptTemplate[] { return PRESET_TEMPLATES }
export function getPreset(id: string): PromptTemplate | undefined { return getPresetById(id) }
