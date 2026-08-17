/**
 * dsh-prompt — 模板浏览组件（面板 popover 与设置页共用）
 * #4 交互定稿：tabs（阶段）+ 领域筛选 + 搜索；排序=置顶≤5 → 用量；单击插入（光标处/末尾、不覆盖、自动聚焦）；
 * 插入后自动关闭；编辑/删除/新增时保持打开；hover 快捷操作；＋弹窗新增；删除二次确认；预制可复制为自定义。
 */
import type { PromptTemplate } from './templates'
import { PRESET_TEMPLATES, getPresetById } from './templates'
import {
  allTemplates, sortedTemplates, displayTag, isPinned, togglePin, canPinMore,
  addCustom, updateCustom, removeCustom, copyPresetToCustom, bumpUsage, templateHaystack, MAX_BODY,
} from './store'
import { setPanelOpen } from './state'
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
  const offsetState = react.useState(0)
  const offsetLeft = offsetState[0]
  const rootRef = react.useRef<any>(null)
  const highlightState = react.useState<string | null>(null)
  const highlightId = highlightState[0]

  // 横向对齐 ⚡Prompt 按钮（仅紧凑面板）：测按钮在锚点内的水平偏移
  react.useEffect(() => {
    if (!compact) return
    try {
      const btn = typeof document !== 'undefined' ? document.querySelector('[data-dsh-prompt-entry]') : null
      if (btn && rootRef.current && rootRef.current.offsetParent) {
        const br = (btn as HTMLElement).getBoundingClientRect()
        const ar = (rootRef.current.offsetParent as HTMLElement).getBoundingClientRect()
        offsetState[1](Math.max(0, br.left - ar.left))
      }
    } catch (e) { /* ignore */ }
  }, [])

  // 语言跟随 html[lang]
  react.useEffect(() => {
    if (typeof document === 'undefined') return
    const onLang = () => { langState[1](getLang()) }
    const obs = new MutationObserver(onLang)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
    return () => { obs.disconnect() }
  }, [])

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
  const sorted = sortedTemplates(filtered)

  const presetCount = PRESET_TEMPLATES.length
  const customCount = customs.length

  // ── 样式（DSH 主题变量）──
  const base = 'var(--dsw-alias-label-primary)'
  const muted = 'var(--dsw-alias-label-secondary)'
  const dim = 'var(--dsw-alias-label-tertiary)'
  const line = '1px solid var(--dsw-alias-border-l1)'
  const panelStyle: any = compact
    ? {
        position: 'absolute', left: offsetLeft, bottom: 'calc(100% + 8px)',
        zIndex: 300, width: 430,
        display: 'flex', flexDirection: 'column',
        background: 'var(--dsw-specific-menu)', border: '1px solid var(--dsw-alias-border-inverted)',
        borderRadius: 12, boxShadow: 'var(--dsw-shadow-lv3)', overflow: 'hidden',
        fontFamily: 'var(--dsw-font-family)', fontSize: 12.5, color: base,
      }
    : {
        display: 'flex', flexDirection: 'column', gap: 8, padding: 12,
        fontFamily: 'var(--dsw-font-family)', fontSize: 'var(--dsw-font-markdown-base-font-size)', color: base,
      }
  const headStyle: any = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: line }
  const titleStyle: any = { fontWeight: 700, fontSize: '1em' }
  const addBtn: any = { width: 26, height: 26, borderRadius: 7, border: line, background: 'var(--dsw-alias-bg-layer-3)', color: 'var(--dsw-specific-accent,#f0a45c)', fontSize: 16, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }
  const closeBtn: any = { width: 26, height: 26, borderRadius: 7, border: 0, background: 'transparent', color: dim, fontSize: 16, lineHeight: 1, cursor: 'pointer' }
  const headBtns: any = { display: 'flex', gap: 4, alignItems: 'center' }
  const tabsStyle: any = { display: 'flex', gap: 4, padding: '5px 12px 0', flexWrap: 'wrap' }
  const tabBtn = (on: boolean): any => ({
    padding: '2px 8px', borderRadius: 999, border: line, background: on ? 'var(--dsw-alias-bg-layer-3)' : 'transparent',
    color: on ? base : muted, cursor: 'pointer', fontFamily: 'var(--dsw-font-family)', fontSize: '0.85em',
  })
  const domainRowStyle: any = { display: 'flex', gap: 4, padding: '3px 12px 0', flexWrap: 'wrap' }
  const searchStyle: any = { margin: '8px 12px', padding: '6px 10px', borderRadius: 8, border: line, background: 'var(--dsw-alias-bg-layer-3)', color: base, fontFamily: 'var(--dsw-font-family)', fontSize: '0.96em', outline: 'none' }
  const listStyle: any = compact
    ? { overflow: 'auto', padding: '3px 6px 8px', maxHeight: 170 } // 面板：恒定约 5 行，内部滚动
    : { padding: '3px 6px 8px' } // 设置页：自然高度，由宿主设置面板整页滚动
  const itemStyle: any = { display: 'flex', alignItems: 'center', gap: 8, padding: '3px 6px', borderRadius: 8, cursor: 'pointer' }
  const pinStyle = (on: boolean): any => ({ flex: 'none', width: 18, textAlign: 'center', color: on ? 'var(--dsw-specific-accent,#f0a45c)' : dim, cursor: 'pointer', fontSize: 12, border: 0, background: 'transparent' })
  const nmStyle: any = { flex: 1, minWidth: 0, fontSize: '0.98em', color: base }
  const subStyle: any = { display: 'block', fontSize: '0.85em', color: dim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
  const tagStyle: any = { flex: 'none', fontSize: '0.8em', color: dim, border: line, padding: '1px 6px', borderRadius: 999 }
  const actStyle: any = { display: 'flex', gap: 4, flex: 'none' }
  const actBtn = (danger?: boolean): any => ({ border: line, background: 'transparent', color: danger ? 'var(--dsw-specific-danger,#e06c75)' : dim, cursor: 'pointer', fontSize: '0.85em', padding: '1px 8px', borderRadius: 999, fontFamily: 'var(--dsw-font-family)', whiteSpace: 'nowrap' })
  const footStyle: any = { padding: '8px 12px', borderTop: line, display: 'flex', justifyContent: 'space-between', fontSize: '0.85em', color: dim }
  const footLink: any = { color: 'var(--dsw-specific-accent,#f0a45c)', cursor: 'pointer', textDecoration: 'none', background: 'transparent', border: 0, fontFamily: 'var(--dsw-font-family)', fontSize: '0.85em' }
  const maskStyle: any = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }
  const modalStyle: any = { width: 460, background: 'var(--dsw-specific-menu)', border: '1px solid var(--dsw-alias-border-inverted)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'var(--dsw-font-family)', color: base }
  const fieldStyle: any = { width: '100%', background: 'var(--dsw-alias-bg-layer-3)', border: line, color: base, borderRadius: 8, padding: '8px 10px', fontFamily: 'var(--dsw-font-family)', fontSize: '0.96em', outline: 'none', boxSizing: 'border-box' }
  const mbtnsStyle: any = { display: 'flex', justifyContent: 'flex-end', gap: 8 }
  const mbtn = (primary?: boolean, danger?: boolean): any => ({ padding: '6px 14px', borderRadius: 8, border: primary ? 0 : line, background: primary ? 'var(--dsw-specific-accent,#f0a45c)' : 'var(--dsw-alias-bg-layer-3)', color: primary ? '#1a1a1e' : (danger ? 'var(--dsw-specific-danger,#e06c75)' : base), cursor: 'pointer', fontFamily: 'var(--dsw-font-family)', fontSize: '0.96em' })

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

  // ── 弹窗（新增/编辑/删除确认）──
  let modalNode: any = null
  if (modal) {
    if (modal.kind === 'add' || modal.kind === 'edit') {
      const editing = modal.kind === 'edit' && modal.t
      let name = editing ? modal.t!.name : ''
      let tag = editing ? (modal.t as any).tag || CUSTOM_TAG : CUSTOM_TAG
      let body = editing ? modal.t!.body : ''
      const ModalInner = () => {
        const s1 = react.useState(name); name = s1[0]; const setName = s1[1]
        const s2 = react.useState(tag); tag = s2[0]; const setTag = s2[1]
        const s3 = react.useState(body); body = s3[0]; const setBody = s3[1]
        const err = react.useState<string | null>(null)
        const doOk = () => {
          const nm = name.trim(), bd = body.trim()
          if (!nm) { err[1]('nameRequired'); return }
          if (bd.length > MAX_BODY) { err[1]('bodyTooLong'); return }
          if (editing) { updateCustom(modal.t!.id, { name: nm, tag, body: bd }) }
          else { addCustom(nm, tag || CUSTOM_TAG, bd) }
          modalState[1](null)
          refresh()
        }
        return h('div', { style: maskStyle, onClick: (e: any) => { if (e.target === e.currentTarget) modalState[1](null) } }, [
          h('div', { style: modalStyle }, [
            h('h3', { style: { fontSize: '1.08em', margin: 0 } }, editing ? t('editTitle') : t('addTitle')),
            h('input', { style: fieldStyle, placeholder: t('namePh'), value: name, onChange: (e: any) => setName(e.target.value) }),
            h('input', { style: fieldStyle, placeholder: t('tagPh'), value: tag, onChange: (e: any) => setTag(e.target.value) }),
            h('textarea', { style: { ...fieldStyle, height: 110, resize: 'vertical' }, placeholder: t('bodyPh'), value: body, onChange: (e: any) => setBody(e.target.value) }),
            err[0] ? h('div', { style: { fontSize: 12, color: 'var(--dsw-specific-danger,#e06c75)' } }, t(err[0] as keyof typeof STR)) : null,
            h('div', { style: mbtnsStyle }, [
              h('button', { style: mbtn(), onClick: () => modalState[1](null) }, t('cancel')),
              h('button', { style: mbtn(true), onClick: doOk }, editing ? t('save') : t('addOk')),
            ]),
          ]),
        ])
      }
      modalNode = h(ModalInner)
    } else if (modal.kind === 'del' && modal.t) {
      const doDel = () => { removeCustom(modal.t!.id); modalState[1](null); refresh() }
      modalNode = h('div', { style: maskStyle, onClick: (e: any) => { if (e.target === e.currentTarget) modalState[1](null) } }, [
        h('div', { style: modalStyle }, [
          h('h3', { style: { fontSize: 14, margin: 0 } }, t('delTitle')),
          h('div', { style: { fontSize: 12.5, color: dim } }, t('delMsg') + '「' + modal.t.name + '」' + t('delUnrecover')),
          h('div', { style: mbtnsStyle }, [
            h('button', { style: mbtn(), onClick: () => modalState[1](null) }, t('cancel')),
            h('button', { style: mbtn(false, true), onClick: doDel }, t('delOk')),
          ]),
        ]),
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
    const itemBg = highlightId === x.id ? 'rgba(240,164,92,0.16)' : undefined
    return h('div', { key: x.id, style: { ...itemStyle, background: itemBg }, 'data-dsh-prompt-id': x.id, onClick: () => handlePick(x), title: t('insertHint') }, [
      h('button', { style: pinStyle(pinned), title: t('pin'), onClick: (e: any) => handlePin(e, x) }, pinned ? '★' : '☆'),
      h('span', { style: nmStyle }, [
        x.name,
        h('span', { style: subStyle }, (x.body || '').slice(0, 44) + '…'),
      ]),
      h('span', { style: tagStyle }, displayTag(x)),
      acts,
    ])
  })
  const listNode = rows.length > 0
    ? h('div', { style: listStyle }, rows)
    : h('div', { style: { padding: 14, color: dim, fontSize: 12 } }, t('noMatch'))

  const footer = null

  return h('div', { ref: rootRef, style: panelStyle }, [
    compact ? h('div', { style: headStyle }, [
      h('span', { style: titleStyle }, t('panelTitle')),
      h('span', { style: { fontSize: 11, color: dim, marginLeft: 6 } }, t('presetCount') + ' ' + presetCount + ' · ' + t('customCount') + ' ' + customCount),
      h('div', { style: { flex: 1 } }),
      h('button', { style: footLink, onClick: () => { setPanelOpen(false); emitGoSettings() } }, t('goSettings')),
      h('div', { style: headBtns }, [
        h('button', { style: addBtn, title: t('add'), onClick: () => modalState[1]({ kind: 'add' }) }, '＋'),
        h('button', { style: closeBtn, title: t('close'), onClick: () => setPanelOpen(false) }, '×'),
      ]),
    ]) : h('div', { style: headStyle }, [
      h('span', { style: titleStyle }, t('panelTitle')),
      h('div', { style: { flex: 1 } }),
      h('button', { style: { ...addBtn, width: 'auto', padding: '0 12px', fontSize: 12.5 }, title: t('add'), onClick: () => modalState[1]({ kind: 'add' }) }, '＋ ' + t('addShort')),
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
