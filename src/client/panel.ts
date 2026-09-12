/**
 * dsh-prompt — 模板浏览组件（面板 popover 与设置页共用）
 * #4 交互定稿：tabs（阶段）+ 领域筛选 + 搜索；排序=置顶≤5 → 用量；单击插入（光标处/末尾、不覆盖、自动聚焦）；
 * 插入后自动关闭；编辑/删除/新增时保持打开；hover 快捷操作；＋弹窗新增；删除二次确认；预制可复制为自定义。
 * #13 bottom-up：compact 浮层（⚡Prompt 悬浮列表）改 bottom-up——最常用在底部，未使用在顶部；置顶簇在底部；打开自动滚到底部。
 * 设置页（compact=false）保持原 Top-down。
 * #22 决议（用户 2026-09-09 裁定）：悬浮列表公式（用量升序→同分置顶贴底→pin 序→预制顺序/createdAt）
 * 为统一下底座，智能卡以评分为主键套用同一门公式；设置页（Q2=C）与 /prompt（Q6=A）保留降序为例外。
 * #23 统一标签：页签/领域行/搜索框的筛选语义统一为标签包含（matchLabel），
 * 自定义页签仍按 builtin 过滤（不是标签）；行内展示完整标签串（labelString）。
 */
import type { PromptTemplate } from './templates'
import { PRESET_TEMPLATES, getPresetById } from './templates'
import {
  allTemplates, sortedTemplates, sortedTemplatesBottomUp, templateLabels, labelString, matchLabel,
  allKnownLabels, normalizeLabels, validateLabels, isPinned, togglePin, canPinMore,
  addCustom, updateCustom, removeCustom, copyPresetToCustom, bumpUsage, templateHaystack, MAX_BODY,
  ensureLoaded, subscribeStore,
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

/** 插入正文到当前草稿（光标处优先，否则末尾；不覆盖；自动聚焦）。返回插入前的草稿长度，供调用点记日志。 */
export function insertBody(useInput: any, inputActions: any, body: string): number {
  // 草稿以 DOM 真实值为准：事件处理里不能调用 useInput(selector)（hook，只能在 render 内调用，
  // 在这里调会抛 Invalid hook call → 被 catch 吞掉 → draft 变 '' → setDraft(body) 整框覆盖）。
  // 顺序：焦点 textarea 真实值 → store getState → DOM 可见 textarea → 空串。
  let draft = ''
  let pos = -1
  try {
    if (typeof document !== 'undefined') {
      const ae = document.activeElement as HTMLTextAreaElement | null
      if (ae && ae.tagName === 'TEXTAREA' && !(ae.closest && ae.closest('[data-dsh-prompt-modal]'))) {
        draft = ae.value || ''
        pos = typeof ae.selectionStart === 'number' ? ae.selectionStart : draft.length
      }
    }
  } catch (e) { /* ignore */ }
  if (pos < 0) {
    try {
      if (useInput && typeof useInput.getState === 'function') {
        const st = useInput.getState()
        draft = (st && st.draft) || ''
      } else if (useInput) {
        // 兼容无 getState 的旧桥：最后手段才尝试直接读（失败即忽略，绝不抛）。
        const st = useInput((s: any) => s)
        draft = (st && st.draft) || ''
      }
    } catch (e) { /* ignore */ }
    pos = draft.length
    try {
      if (typeof document !== 'undefined') {
        const tas = document.querySelectorAll('textarea')
        for (let i = 0; i < tas.length; i++) {
          const ta = tas[i] as HTMLTextAreaElement
          if (ta.value === draft) { pos = typeof ta.selectionStart === 'number' ? ta.selectionStart : draft.length; break }
        }
      }
    } catch (e) { /* ignore */ }
  }
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
  return draft.length
}

/** 点击模板：插入 + 用量 +1 + 面板关闭（并记一条插入事件：只记种类与散列，不记模板名与正文）。 */
export function onPick(t: PromptTemplate, useInput: any, inputActions: any): void {
  const draftChars = insertBody(useInput, inputActions, t.body)
  logEvent('pick.insert', {
    source: 'panel',
    templateKind: t.builtin ? 'preset' : 'custom',
    idHash: t.id,
    draftChars,
  })
  bumpUsage(t.id)
  setPanelOpen(false)
}

/** 模板浏览（面板 / 设置页共用） */
// ── 顶层 z 标尺（#21 T4 内决）：选择类 UI 高于一切普通 UI ──
// PANEL_Z=9999：compact 选择浮层（沿用 #16 已验证值，高于左右侧面板/设置抽屉/智能卡 400//prompt 菜单）。
// MODAL_Z=11000：新增/编辑/删除确认弹窗遮罩（portaled 到 body，高于 PANEL_Z + 抽屉 + 智能卡）。
// 智能卡 dot/card 保持 400（smart.ts，普通 UI，低于选择类）。宿主关键层（toast/报错）高于此标尺，不覆盖。
export const PANEL_Z = 9999
export const MODAL_Z = 11000
// ── 弹窗组件（模块级稳定类型：内联函数组件会在父组件每次重渲染时被整体卸载重建 → 输入内容丢失）──
const modalMaskStyle: any = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: MODAL_Z }
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
  // #23：标签 chips（编辑时取现有标签串）+ 待添加输入框（回车并入 chips）
  const s2 = react.useState(editing ? templateLabels(props.tpl) : [] as string[])
  const labels = s2[0]; const setLabels = s2[1]
  const s2b = react.useState('')
  const labelInput = s2b[0]; const setLabelInput = s2b[1]
  const s3 = react.useState(editing ? props.tpl.body : '')
  const body = s3[0]; const setBody = s3[1]
  const errState = react.useState(null as string | null)
  const err = errState[0]; const setErr = errState[1]
  const commitInput = () => {
    const fresh = normalizeLabels(labelInput)
    if (fresh.length === 0) { setLabelInput(''); return }
    setLabels(normalizeLabels([...labels, ...fresh]))
    setLabelInput('')
  }
  const doOk = () => {
    const nm = name.trim(), bd = body.trim()
    if (!nm) { setErr('nameRequired'); return }
    if (bd.length > MAX_BODY) { setErr('bodyTooLong'); return }
    // 输入框残留文本一并计入（不静默丢），统一走校验：违规阻断并行内提示
    const checked = validateLabels([...labels, ...normalizeLabels(labelInput)])
    if (!checked.ok) { setErr(checked.error); return }
    props.onOk && props.onOk({ name: nm, labels: checked.labels, body: bd })
  }
  const known = allKnownLabels()
  const chipStyle: any = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.85em', color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-3)', border: '1px solid var(--dsw-alias-border-l2)', padding: '1px 4px 1px 9px', borderRadius: 999, whiteSpace: 'nowrap' }
  const chipXStyle: any = { border: 0, background: 'transparent', color: 'var(--dsw-alias-label-tertiary)', cursor: 'pointer', fontSize: '1em', lineHeight: 1, padding: '0 2px', fontFamily: 'var(--dsw-font-family)' }
  return h('div', { style: modalMaskStyle, 'data-dsh-prompt-modal': '', onClick: (e: any) => { if (e.target === e.currentTarget) props.onCancel() } }, [
    h('div', { style: modalCardStyle }, [
      h('h3', { style: { fontSize: '1.08em', margin: 0 } }, editing ? props.t('editTitle') : props.t('addTitle')),
      h('input', { style: modalFieldStyle, placeholder: props.t('namePh'), value: name, onChange: (e: any) => setName(e.target.value) }),
      h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } }, labels.map((l: string) =>
        h('span', { key: l, style: chipStyle }, [
          l,
          h('button', { style: chipXStyle, title: props.t('removeLabel'), onClick: () => setLabels(labels.filter((x: string) => x !== l)) }, '×'),
        ]),
      )),
      h('input', {
        style: modalFieldStyle, placeholder: props.t('labelsPh'), value: labelInput,
        onChange: (e: any) => setLabelInput(e.target.value),
        onKeyDown: (e: any) => { if (e.key === 'Enter') { e.preventDefault(); commitInput() } },
        list: 'dsh-prompt-labels',
      }),
      h('datalist', { id: 'dsh-prompt-labels' }, known.map((w: string) => h('option', { key: w, value: w }))),
      h('div', { style: { fontSize: '0.85em', color: 'var(--dsw-alias-label-tertiary)' } }, props.t('labelsHint')),
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

export function getReactDom(): any {
  if (typeof require === 'function') { try { return require('react-dom') } catch (e) { /* ignore */ } }
  if (typeof globalThis !== 'undefined' && (globalThis as any).ReactDOM) return (globalThis as any).ReactDOM
  return null
}

/**
 * 顶层 Portal 底座（#21）：把 children 挂到 document.body，逃离宿主 slot 的祖先层叠上下文，
 * 使 z 在全局生效而非相对祖先生效。React 事件仍冒泡给 React 祖先（portal 语义），hover 门控不受影响。
 * 无 DOM（单测）或无 react-dom 时回退为内联渲染，保持 #14 回归覆盖。
 * 模块级稳定组件：与 TemplateModal 同理，避免父级重渲染时卸载重置。
 */
export function TopPortal(props: any): any {
  const react = getReact()
  if (!react) return null
  const reactDom = getReactDom()
  if (typeof document === 'undefined' || !reactDom || typeof reactDom.createPortal !== 'function') {
    return props.children
  }
  const attr = props.rootAttr || 'data-dsh-prompt-top-root'
  const holder = react.useMemo(() => {
    try {
      const el = document.createElement('div')
      el.setAttribute(attr, '')
      return el
    } catch (e) { return null }
  }, [attr])
  react.useEffect(() => {
    if (!holder) return
    try { document.body.appendChild(holder) } catch (e) { /* ignore */ }
    return () => { try { document.body.removeChild(holder) } catch (e) { /* ignore */ } }
  }, [holder])
  if (!holder) return props.children
  return reactDom.createPortal(props.children, holder)
}

/**
 * 弹窗顶层 Portal（#21）：新增/编辑/删除确认弹窗经 TopPortal 挂到 body，
 * 逃离面板层叠上下文（compact 面板 PANEL_Z 上下文 / 设置页 settings.section 上下文）。
 */
function ModalPortal(props: any): any {
  const react = getReact()
  if (!react) return null
  return react.createElement(TopPortal, { rootAttr: 'data-dsh-prompt-modal-root' }, props.children)
}

/**
 * 浮层顶层 Portal（#21 R2）：compact 选择浮层经 TopPortal 挂到 body。
 * 真机 R1 证实：浮层留在 conversation.input.overlay 内时 PANEL_Z=9999 仍被右侧面板盖住——
 * 数值从不是问题（宿主面板 host z=25/面板 z=40/drop 遮罩 z=1000，见 dsh-better-sidebar 实测），
 * 问题是 slot 祖先层叠上下文把整棵子树压平。仅 overlay 实例（PanelHost）用，设置页保持内联。
 */
export function PanelPortal(props: any): any {
  const react = getReact()
  if (!react) return null
  return react.createElement(TopPortal, { rootAttr: 'data-dsh-prompt-panel-root' }, props.children)
}

export function TemplateBrowser(props: BrowserProps): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  const { compact, inputActions, useInput } = props

  const langState = react.useState(getLang())
  const lang = langState[0]
  const tickState = react.useState(0)
  const setTick = tickState[1]
  const tabState = react.useState('all')
  const tab = tabState[0]
  const domainState = react.useState('all')
  const domain = domainState[0]
  const qState = react.useState('')
  const q = qState[0]
  const modalState = react.useState(null as ModalState | null)
  const modal = modalState[0]
  const posState = react.useState(null as { left: number; bottom: number } | null)
  const pos = posState[0]
  const rootRef = react.useRef(null as any)
  const listRef = react.useRef(null as any)
  const highlightState = react.useState(null as string | null)
  const highlightId = highlightState[0]
  // #34：搜索框交互状态——聚焦/拼音组词期抑制 hover 自动关窗（#14 家族延续）。
  // 中文组词语义：compositionstart→end 整段只算一次输入，期间任何杂散 mouseleave
  //（布局抖动/滚动重命中）都不应 schedulePanelClose(150) 关窗；设置页（compact=false）无 hover 语义，不碰全局门控。
  const focusState = react.useState(false)
  const searchFocused = focusState[0]
  const compState = react.useState(false)
  const composing = compState[0]

  // 面板打开事件（#49）：只记形态与条数，不记模板名与搜索词。
  react.useEffect(() => {
    logEvent('panel.open', { mode: compact ? 'compact' : 'full', rows: allTemplates().length })
  }, [])

  // 正上方对齐 ⚡Prompt 按钮（仅紧凑面板/popover）：fixed + 按钮视口 rect
  // 列表左缘与按钮左缘垂直对齐（left = btn.left）；列表底边在按钮顶边之上 → 整体位于按钮正上方
  // #35：绘制前定位 + 未定位前隐藏 + 失败重试。pos 初始 null 时 fallback left:0/bottom:0
  // 就是屏幕左下角——此前 useEffect 首帧后才 compute，失败即永久卡死（点击开偶发，悬停开正常）。
  // layout effect 让首帧即正确；按钮查不到/rect 全零视为未找到等下一帧（至多 10 次），
  // 仍失败则回退到可见的左下附近（保证可用，不静默消失）；设置页无 hover 语义不参与。
  const useIsomorphicLayout = (react as any).useLayoutEffect || react.useEffect
  useIsomorphicLayout(() => {
    if (!compact) return
    let disposed = false
    let raf: any = null
    let timer: any = null
    let tries = 0
    const clearPending = () => {
      try {
        if (raf !== null && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(raf)
        if (timer !== null) clearTimeout(timer)
      } catch (e) { /* ignore */ }
      raf = null; timer = null
    }
    const compute = (): boolean => {
      try {
        const btn = typeof document !== 'undefined' ? document.querySelector('[data-dsh-prompt-entry]') : null
        if (!btn) return false
        const br = (btn as HTMLElement).getBoundingClientRect()
        // 按钮不可见（rect 全零，多为挂载时序/宿主重排中）→ 视为未找到，不提交垃圾位置
        if (br && br.width === 0 && br.height === 0 && br.left === 0 && br.top === 0) return false
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800
        const width = 560
        let left = br.left
        if (left < 8) left = 8 // 左越界贴左
        if (left + width > vw - 8) left = Math.max(8, vw - width - 8) // 右越界回挤
        if (!disposed) posState[1]({ left, bottom: vh - br.top + 8 }) // 面板底边 = 按钮顶边上方 8px
        return true
      } catch (e) { return false }
    }
    const again = () => {
      raf = null; timer = null
      if (disposed) return
      if (compute()) return
      if (++tries < 10) {
        if (typeof requestAnimationFrame !== 'undefined') raf = requestAnimationFrame(again)
        else timer = setTimeout(again, 50)
      } else if (!disposed) {
        // 定位回退（#49 起走统一日志能力）：记事件与重试次数，不记坐标与页面内容。
        logEvent('panel.position.fail', { attempts: tries })
        posState[1]({ left: 8, bottom: 8 }) // 终极回退：可见可点，不静默消失
      }
    }
    again()
    const onResize = () => { compute() }
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', onResize)
    }
    return () => { disposed = true; clearPending(); if (typeof window !== 'undefined') window.removeEventListener('resize', onResize) }
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
  // - #34 扩展：搜索框聚焦/组词期同样抑制——用户正在输入时杂散 leave 不关窗；
  //   显式关闭（×/插入/toggle 调 setPanelOpen(false)）不受抑制影响，不会粘住。
  // deps 用 !!modal 避免对象身份抖动；onCancel/onOk/输入框处理器中同步清门控以消除 effect 下一帧前的竞态窗口
  react.useEffect(() => {
    if (!compact) return
    if (modal || searchFocused || composing) setHoverCloseSuppressed(true)
    else setHoverCloseSuppressed(false)
    return () => { setHoverCloseSuppressed(false) }
  }, [compact, !!modal, searchFocused, composing])

  const refresh = () => setTick((n: number) => n + 1)
  const t = (k: keyof typeof STR) => tr(lang, STR[k])

  // #20 直接切换：挂载即拉 host 快照，host 变更经订阅刷新（内存缓存同步写后已 refresh，此处补异步到达）
  react.useEffect(() => {
    let on = true
    ensureLoaded().then(() => { if (on) refresh() }, () => undefined)
    const off = subscribeStore(() => { if (on) refresh() })
    return () => { on = false; off() }
  }, [])

  // 列表组装（#23）：tab=自定义 → 仅自定义（按 builtin，不过滤标签，见待确认 1）；
  // 否则按统一标签包含过滤——阶段页签与领域行是标签子集的快捷方式，底层同一判断；
  // 搜索框保留全文检索（haystack）兼容。排序不动（#22：悬浮 bottom-up，设置页降序）。
  const customs = allTemplates().filter((x) => !x.builtin)
  const list = allTemplates().filter((x) => {
    if (tab === CUSTOM_TAG) return !x.builtin
    if (tab !== 'all' && !matchLabel(x, tab)) return false
    if (domain !== 'all' && !matchLabel(x, domain)) return false
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
        // #35：未定位前隐藏——宁可晚一帧出现，也不闪现在屏幕左下角
        visibility: pos ? 'visible' : 'hidden',
        zIndex: PANEL_Z, width: 560,
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
  // #21 顶层化：经 ModalPortal 挂到 document.body，逃离面板层叠上下文（无 DOM/无 react-dom 时回退内联，#14 行为不变）
  let modalNode: any = null
  if (modal) {
    if (modal.kind === 'add' || modal.kind === 'edit') {
      modalNode = h(ModalPortal, { key: 'portal-tplmodal-' + modal.kind + (modal.t ? '-' + modal.t.id : '') }, [
        h('div', { key: 'tplmodal-' + modal.kind + (modal.t ? '-' + modal.t.id : '') }, [
          h(TemplateModal, {
            kind: modal.kind, tpl: modal.t, t,
            onCancel: () => { setHoverCloseSuppressed(false); modalState[1](null) },
            onOk: (f: { name: string; labels: string[]; body: string }) => {
              if (modal.kind === 'edit' && modal.t) { updateCustom(modal.t.id, f) }
              else { addCustom(f.name, f.labels, f.body) }
              setHoverCloseSuppressed(false); modalState[1](null)
              refresh()
            },
          }),
        ]),
      ])
    } else if (modal.kind === 'del' && modal.t) {
      modalNode = h(ModalPortal, { key: 'portal-del-' + modal.t.id }, [
        h('div', { key: 'del-' + modal.t.id }, [
          h(ConfirmDelete, {
            tpl: modal.t, t,
            onCancel: () => { setHoverCloseSuppressed(false); modalState[1](null) },
            onOk: () => { removeCustom(modal.t!.id); setHoverCloseSuppressed(false); modalState[1](null); refresh() },
          }),
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
    const itemBg = highlightId === x.id ? 'var(--dsw-alias-interactive-bg-hover)' : undefined
    // 简介 = body 首行（一句话），标题之后跟随 —— 单行显示
    const intro = (x.body || '').split('\n')[0].trim()
    // 紧凑（⚡Prompt 浮层）：单行 —— 图钉 + 标题 + 简介 + 操作横排，不再占两行
    if (compact) {
      return h('div', { key: x.id, style: { ...itemStyle, background: itemBg, minWidth: 0 }, 'data-dsh-prompt-id': x.id, onClick: () => handlePick(x), title: labelString(x) + ' · ' + t('insertHint') }, [
        h('button', { style: pinStyle(pinned), title: t('pin'), onClick: (e: any) => handlePin(e, x) }, [
          h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: pinned ? 'var(--dsw-specific-accent,#f0a45c)' : 'none', stroke: pinned ? 'var(--dsw-specific-accent,#f0a45c)' : dim, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', style: { display: 'block' } }, [
            h('path', { d: 'M12 17v5' }),
            h('path', { d: 'M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z' }),
          ]),
        ]),
        h('span', { style: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 6, overflow: 'hidden' } }, [
          h('span', { style: { flex: 'none', fontSize: '0.95em', color: base, fontWeight: 600, whiteSpace: 'nowrap' } }, x.name),
          h('span', { style: { flex: '0 1 auto', minWidth: 0, fontSize: '0.8em', color: muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, labelString(x)),
          h('span', { style: { flex: '1 1 auto', minWidth: 0, fontSize: '0.85em', color: dim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, intro),
        ]),
        h('span', { style: actStyle }, acts),
      ])
    }
    return h('div', { key: x.id, style: { ...itemStyle, background: itemBg }, 'data-dsh-prompt-id': x.id, onClick: () => handlePick(x), title: labelString(x) + ' · ' + t('insertHint') }, [
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
          h('span', { style: tagStyle }, labelString(x)),
        ]),
        h('span', { style: subStyle }, (x.body || '').slice(0, 44) + '…'),
      ]),
      h('div', { style: { flex: 'none', display: 'flex', alignItems: 'center', gap: 4, paddingTop: 2 } }, [acts]),
    ])
  })
  const listNode = rows.length > 0
    ? h('div', { ref: compact ? listRef : null, style: listStyle }, rows)
    : h('div', { style: { height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', color: dim, fontSize: '0.92em', padding: '2px 2px 8px' } }, t('noMatch'))

  const footer = null

  // 浮层根节点 hover 接管：鼠标进列表 → 取消关窗；离开列表 → 延迟关窗（仅紧凑浮层有 hover 开合语义）
  // #14：弹窗打开时禁止触发关窗（本地防御 + 全局 gate 双保险，输入时微移动/焦点变化不丢弹窗）
  const rootHover = compact ? { onMouseEnter: () => cancelPanelClose(), onMouseLeave: () => { if (modal || searchFocused || composing) return; schedulePanelClose(150) } } : null
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
    h('input', {
      style: searchStyle, placeholder: t('searchPh'), value: q, onChange: (e: any) => qState[1](e.target.value),
      // #34 IME 安全：聚焦即抑制 hover 关窗（含取消已挂起的 150ms 计时，见 setHoverCloseSuppressed），
      // blur/组词结束同步释放（effect 会再对账一遍）；组词结束补提交一次最终值（部分浏览器 end 不带 onChange）。
      onFocus: () => { focusState[1](true); if (compact) setHoverCloseSuppressed(true) },
      onBlur: () => { focusState[1](false); if (compact && !composing && !modal) setHoverCloseSuppressed(false) },
      onCompositionStart: () => { compState[1](true); if (compact) setHoverCloseSuppressed(true) },
      onCompositionEnd: (e: any) => {
        compState[1](false)
        try { const v = e && e.target && typeof e.target.value === 'string' ? e.target.value : null; if (v !== null) qState[1](v) } catch (err) { /* ignore */ }
        if (compact && !modal && !searchFocused) setHoverCloseSuppressed(false)
      },
    }),
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

/** 记一条日志事件。出口只有一个：日志能力装进 globalThis.__dshPromptLog 的那个实例。
 *  走槽而不是 import 的原因：本仓既有回归脚本会把客户端模块逐个转译后单独 require
 *  （scripts/.rt-tmp/*.cjs），而单文件 bundle 里也没有可用的模块内 require——槽是两边都能用的唯一机制。
 *  能力缺席时是空操作，绝不因为记日志失败而影响功能。 */
function logEvent(event: string, fields?: Record<string, unknown>): void {
  try {
    const log = (globalThis as any).__dshPromptLog
    if (log && typeof log.log === 'function') log.log(event, fields)
  } catch (e) { /* ignore */ }
}
