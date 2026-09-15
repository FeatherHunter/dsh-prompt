/**
 * dsh-prompt — 模板浏览组件（面板 popover 与设置页共用）
 * #4 交互定稿：tabs（阶段）+ 领域筛选 + 搜索；面板单击插入（光标处/末尾、不覆盖、自动聚焦）；
 * 设置页为纯管理面（#61）：行点击不执行插入、不涨用量；管理动作只走图钉/编辑/删除/复制按钮。
 * 插入后自动关闭；编辑/删除/新增时保持打开；hover 快捷操作；＋弹窗新增；删除二次确认；预制可复制为自定义。
 * #13 bottom-up：compact 浮层（⚡Prompt 悬浮列表）改 bottom-up——最常用在底部，未使用在顶部；置顶簇在底部；打开自动滚到底部。
 * 设置页（compact=false）保持原 Top-down。
 * #22 决议（用户 2026-09-09 裁定）：悬浮列表公式（用量升序→同分置顶贴底→pin 序→预制顺序/createdAt）
 * 为统一下底座，智能卡以评分为主键套用同一门公式；设置页（Q2=C）与 /prompt（Q6=A）保留降序为例外。
 * #68 终式（2026-09-15）：悬浮列表改为置顶簇聚底（分区主键→分区内用量升序→同用量 pin 序→末键）；
 * 设置页与 /prompt 忽略置顶、只留用量降序（置顶仅悬浮列表生效）。
 * #23 统一标签：筛选语义统一为标签包含（matchLabel），行内展示完整标签串（labelString）。
 * #70 P6a（2026-09-15）：云整行单选互斥——[全部][预置][自定义]+行动词同行单选，所有 pill 同时只能选中一个；
 * 全部/无选择=不过滤；预置=仅内置（t.builtin）；自定义=仅自建（!t.builtin）；行动词=matchLabel 单选包含（跨内置自建）；
 * 点已选项回无选择（toggle）。P5a 双维 AND 已推翻（负责人 redirect2）。
 */
import type { PromptTemplate } from './templates'
import { PRESET_TEMPLATES, getPresetById } from './templates'
import {
  allTemplates, sortedTemplates, sortedTemplatesBottomUp, templateLabels, labelString, matchLabel,
  allKnownLabels, normalizeLabels, validateLabels, isPinned, togglePin, canPinMore,
  addCustom, updateCustom, removeCustom, copyPresetToCustom, bumpUsage, loadUsage, templateHaystack, MAX_BODY,
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

/**
 * 插件标志（灯泡）单一定义 —— 模板浏览头行（本文件两条分支）与配置页头行（about.ts）共用。
 * 放在 panel.ts 而不是新开模块：本仓每个回归脚本都自己列一遍要转译的客户端模块，
 * 往 panel.ts 这条被普遍加载的路径上新增 import 边会让既有脚本全部找不到模块；
 * 导出比新模块代价小，且保住「标志只有一份定义」。改标志只改这里。
 */
export function PromptMark(props: { size?: number }): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  const s = (props && props.size) || 15
  return h('svg', {
    width: s, height: s, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'var(--dsw-specific-accent,#f0a45c)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': 'true', style: { flex: 'none' },
  }, [
    h('path', { key: 'a', d: 'M15 14c.2-1 .7-1.7 1.5-2.5C17.5 10.6 18 9.3 18 8a6 6 0 1 0-12 0c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5' }),
    h('path', { key: 'b', d: 'M9 18h6' }),
    h('path', { key: 'c', d: 'M10 22h4' }),
    h('path', { key: 'd', d: 'M18.5 2.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z' }),
  ])
}

// #70 P6a（2026-09-15）：云整行单选互斥（推翻 P5a 双维 AND；STAGE_TABS/tabs/tabNodes/tabState/CUSTOM_TAG/scope/cloud 双态全清，无死代码）。
// 顶部唯一行：[全部][预置][自定义]+行动词云，所有 pill 同属一个选中态，互斥单选（不存在自定义和其他 label 同时选中）。
// 选中态 selected: string|null（null=全部/无选择=不过滤，归一到 null，不保留 'all' 显式值——见 TemplateBrowser 内注释）。
// 词源方案 A（调查报告 §5 步骤 1）：
// allKnownLabels()（预置 23 词 + 在用自定义词，去重保序）去掉非行动词，剩下即云。
// 去留表（以预置 23 词为基准，去 7 留 16；自定义在用词全部“留”，追加排在预置行动词之后）：
//   去（7）：思考框架/学习/工程/执行（4 领域）+ 执行前/执行中/执行后（3 阶段）；
//            另去哨兵 '自定义'（空标签回落词；旧自定义页签 id 已删，语义由范围钮继承）与 'all'（非标签）；
//   留（16，按预置首次出现序）：拆解/检验/归因/决策/理解/路线/概念/考验/审查/测试/重构/解读/启动/固化/记录/复盘；
//   自定义新词：只要不在“去”集合即留（allKnownLabels 已含在用自定义词，开箱即用；
//            若自定义词恰与领域/阶段同名则仍被去——此时该词走搜索可达，云不收录，维度纯净优先）。
// 排序：预置行动词固定首现序（不随用量抖动）+ 自定义词追加；换行 flexWrap（见 cloudRowStyle）。
const CLOUD_EXCLUDE = ['all', '思考框架', '学习', '工程', '执行', '执行前', '执行中', '执行后', '自定义']
function actionCloudLabels(): string[] {
  return allKnownLabels().filter((l) => CLOUD_EXCLUDE.indexOf(l) < 0)
}
// #70 P6a 选中态取值：null=全部/无选择（不过滤）/ 'preset'=仅内置 / 'custom'=仅自建 / 行动词=matchLabel 单选包含（跨内置自建）。
// 按 builtin 布尔过滤（不是标签），继承旧 tab=自定义短路语义（旧：tab===CUSTOM_TAG → !x.builtin）。
const SCOPE_PRESET = 'preset'
const SCOPE_CUSTOM = 'custom'
const SCOPE_PRESET_LABEL = '预置'
const SCOPE_CUSTOM_LABEL = '自定义'
const ALL_LABEL = '全部'

export interface BrowserProps {
  compact: boolean
  inputActions?: any
  useInput?: any
}

interface ModalState {
  kind: 'add' | 'edit' | 'del'
  t?: PromptTemplate
}

/** #61 真根因（宿主源码实证：dsh-client-ui-conversation 包）。
 * 1) 会话输入框是 Lexical contenteditable div，根本没有 textarea —— 旧的 textarea 扫描全瞎；
 * 2) useInput 是裸 selector hook（renderer 的 bindSnapshotSelector 产物：裸函数，
 *    无 getState/getSnapshot/subscribe），只能在组件 render 内调用，事件回调里根本读不到 store。
 * 两条路全瞎 ⇒ setDraft(模板正文) 整框覆盖（宿主 setDraft 语义即全文替换、光标置尾）。
 * 真修复只信两样活的东西：
 * - H（hook 草稿）：render 内合法订阅到的已提交草稿，引用 chip 的存储形精确；
 * - D（DOM 活读）：点击瞬间 contenteditable 的 innerText 级文本 + getSelection 活光标，
 *   含 IME 组词中尚未提交的文字。
 * 合并铁律：看得见的不丢 —— D 非空即信 D（唯二例外：读不到 D 信 H；H 含引用 chip 时信 H 保编码）。 */
const CHIP_RE = /[\uE100-\uE11D\uFFFC]/

/** render 内订阅到的已提交草稿（面板打开期间由 DraftTap 保持新鲜；设置页无桥，不写）。 */
let tapDraft = ''
let tapSeen = false

/** render 内订阅输入桥。只能在 render 里调 useInput(selector)：它是裸 hook，
 * 事件回调/ effect 里调即抛（这就是 Q3 删掉的分支死因）。调用点只此一处。 */
export function DraftTap(props: { useInput: any }): any {
  const react = getReact()
  if (!react) return null
  let ok = false
  let d: any = ''
  try {
    d = props.useInput((s: any) => (s && s.draft) || '')
    ok = true
  } catch (e) { /* 桥异常时保留上次好值，绝不因订阅失败丢草稿 */ }
  const useIso = (react as any).useLayoutEffect || react.useEffect
  useIso(() => { if (ok) { tapDraft = typeof d === 'string' ? d : ''; tapSeen = true } })
  return null
}

/** 用户最后摸过的输入元（作曲家 editable 或 textarea，#61 前版只记后者故全瞎）。 */
let lastFocusEl: any = null
let focusTrackArmed = false
let armedDoc: any = null
function armInputFocusTrack(): void {
  try {
    const doc: any = typeof document !== 'undefined' ? document : null
    if (focusTrackArmed && armedDoc === doc) return
    focusTrackArmed = true
    armedDoc = doc
    if (doc && typeof doc.addEventListener === 'function') {
      doc.addEventListener('focusin', (e: any) => {
        try {
          const t = e && e.target
          if (!t || !t.tagName) return
          try {
            if (t.closest && (t.closest('[data-dsh-prompt-modal]') || t.closest('[data-dsh-prompt-modal-root]'))) return
          } catch (err) { /* ignore */ }
          if (t.tagName === 'TEXTAREA') { lastFocusEl = t; return }
          try {
            if (t.getAttribute && t.getAttribute('contenteditable') === 'true' &&
              t.closest && t.closest('[data-composer-card]')) lastFocusEl = t
          } catch (err) { /* ignore */ }
        } catch (err) { /* ignore */ }
      }, true)
    }
  } catch (err) { /* ignore */ }
}

/** 作曲家可编辑根：宿主 Lexical 编辑器绑定的 contenteditable（自家弹窗已排除）。 */
function composerRoots(): any[] {
  try {
    if (typeof document === 'undefined' || !(document as any).querySelectorAll) return []
    const out: any[] = []
    const push = (el: any) => {
      try {
        if (el.closest && (el.closest('[data-dsh-prompt-modal]') || el.closest('[data-dsh-prompt-modal-root]'))) return
      } catch (e) { /* ignore */ }
      if (out.indexOf(el) < 0) out.push(el)
    }
    try {
      const scoped = document.querySelectorAll('[data-composer-card] [contenteditable="true"]')
      for (let i = 0; i < scoped.length; i++) push(scoped[i])
    } catch (e) { /* ignore */ }
    if (out.length === 0) {
      try {
        const all = document.querySelectorAll('[contenteditable="true"]')
        for (let i = 0; i < all.length; i++) push(all[i])
      } catch (e) { /* ignore */ }
    }
    return out
  } catch (e) { return [] }
}

const BLOCK_TAGS: Record<string, 1> = {
  P: 1, DIV: 1, LI: 1, UL: 1, OL: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1,
  BLOCKQUOTE: 1, PRE: 1, SECTION: 1, ARTICLE: 1, HEADER: 1, FOOTER: 1,
}

/** 读一个可编辑根的纯文本与活光标（同一套块映射，文本与光标同源，绝不错位）。
 * 文本≈宿主 clipboardText（段落↔\n）；光标=当前 selection 锚点，无选择即末尾。 */
function readEditable(root: any): { text: string; caret: number } {
  let text = ''
  try {
    const runs: Array<{ node: any; start: number; len: number }> = []
    const kids: any[] = (root && root.childNodes) ? Array.prototype.slice.call(root.childNodes) : []
    const pushRun = (s: string, node: any) => {
      if (!s) return
      runs.push({ node, start: text.length, len: s.length })
      text += s
    }
    let started = false
    const hasEl = kids.some((k: any) => k && k.nodeType === 1)
    if (!hasEl) {
      pushRun(root.textContent || '', null)
    } else {
      for (const k of kids) {
        if (!k) continue
        if (k.nodeType === 3) { started = true; pushRun(k.nodeValue || '', k); continue }
        if (k.nodeType !== 1) continue
        const tag = String(k.tagName || '').toUpperCase()
        if (tag === 'BR') { if (started) text += '\n'; else started = true; continue }
        if (BLOCK_TAGS[tag] === 1) {
          if (!started) started = true
          else text += '\n'
        } else {
          started = true
        }
        // runs 挂到文本节点上（光标锚点 99% 是文本节点）：展开后代文本节点，文本与光标同源
        try {
          const stack: any[] = [k]
          const ordered: any[] = []
          while (stack.length > 0) {
            const n = stack.pop()
            if (!n) continue
            if (n.nodeType === 3) { ordered.push(n); continue }
            if (n.nodeType !== 1) continue
            const ch = n.childNodes ? Array.prototype.slice.call(n.childNodes) : []
            for (let j = ch.length - 1; j >= 0; j--) stack.push(ch[j])
          }
          for (const tn of ordered) pushRun(tn.nodeValue || '', tn)
        } catch (e) { pushRun(k.textContent || '', k) }
      }
    }
    let caret = text.length
    try {
      const g: any = typeof window !== 'undefined' ? window : (globalThis as any)
      const sel = g && typeof g.getSelection === 'function' ? g.getSelection() : null
      const an = sel && sel.rangeCount > 0 ? sel.anchorNode : null
      if (an && root.contains) {
        let inside = false
        try { inside = root.contains(an) } catch (e) { /* ignore */ }
        if (inside) {
          const ao = (sel && typeof sel.anchorOffset === 'number') ? sel.anchorOffset : 0
          if (an.nodeType === 3) {
            for (const r of runs) {
              if (r.node === an) { caret = r.start + Math.max(0, Math.min(ao, r.len)); break }
            }
          } else if (an === root) {
            const idx = Math.max(0, Math.min(ao, kids.length))
            // 根锚点：offset=子节点下标 → 落到第 idx 个孩子起的首个 run 行首，之后没有则末尾
            let hit = -1
            for (const r of runs) {
              const ci = r.node ? kids.indexOf(r.node) : -1
              if (ci >= idx) { hit = r.start; break }
            }
            caret = hit >= 0 ? hit : text.length
          } else {
            for (const r of runs) {
              if (r.node === an) { caret = ao > 0 ? r.start + r.len : r.start; break }
            }
          }
        }
      }
    } catch (e) { /* ignore */ }
    return { text, caret: Math.max(0, Math.min(caret, text.length)) }
  } catch (e) { return { text: '', caret: 0 } }
}

/** 选当前作曲家根：焦点命中的 > 用户最后摸过的 > 首个非空 > 首个。 */
function pickEditable(): any | null {
  const roots = composerRoots()
  if (roots.length === 0) return null
  try {
    if (typeof document !== 'undefined' && document) {
      const ae = (document as any).activeElement as any
      if (ae && roots.indexOf(ae) >= 0) return ae
    }
  } catch (e) { /* ignore */ }
  try {
    if (lastFocusEl && roots.indexOf(lastFocusEl) >= 0) return lastFocusEl
  } catch (e) { /* ignore */ }
  try {
    for (const r of roots) {
      try { if (readEditable(r).text) return r } catch (e) { /* ignore */ }
    }
  } catch (e) { /* ignore */ }
  return roots[0]
}

/** 把焦点送回作曲家（宿主 input.left 自家按钮同款 keepFocus 语义）。 */
function focusComposer(): void {
  try {
    if (typeof document === 'undefined') return
    const el = pickEditable()
    if (el && typeof el.focus === 'function') {
      try { el.focus({ preventScroll: true }) } catch (e2) { try { (el as any).focus() } catch (e3) { /* ignore */ } }
    }
  } catch (e) { /* ignore */ }
}

/** 保焦（行/入口 mousedown）：只拦焦点转移，click 照常；焦点已在面板内（搜索框）
 * 或编辑器内时绝不抢焦点 —— 抢了会 blur 搜索框，#34 的 hover 抑制一松面板就误关。 */
export function keepComposerFocus(e: any): void {
  try { if (e && typeof e.preventDefault === 'function') e.preventDefault() } catch (err) { /* ignore */ }
  try {
    if (typeof document === 'undefined') return
    const ae = (document as any).activeElement as any
    if (ae && ae.closest && typeof ae.closest === 'function') {
      try {
        if (ae.closest('[data-dsh-prompt-panel-root]') || ae.closest('[data-dsh-prompt-modal-root]') ||
          ae.closest('[data-dsh-prompt-modal]')) return
      } catch (err) { /* ignore */ }
    }
    if (ae && ae.getAttribute && typeof ae.getAttribute === 'function') {
      try { if (ae.getAttribute('contenteditable') === 'true') return } catch (err) { /* ignore */ }
    }
    if (ae && ae.tagName === 'TEXTAREA') return
    focusComposer()
  } catch (err) { /* ignore */ }
}

/** 决议当前草稿与插入点（#61 真修复：H=hook 已提交草稿，D=DOM 活读）。 */
function resolveDraft(): { text: string; caret: number } {
  const norm = (s: string) => (s || '').replace(/\r\n?/g, '\n')
  const H = norm(tapDraft)
  const root = pickEditable()
  if (root) {
    let d = ''
    let c = 0
    try {
      const r = readEditable(root)
      d = norm(r.text)
      c = Math.max(0, Math.min(r.caret, d.length))
    } catch (e) { /* ignore */ }
    if (!d) {
      // DOM 读空：编辑器空着（或未渲染）—— H 有就信 H，没有就是真空
      if (H) return { text: H, caret: H.length }
      return { text: '', caret: 0 }
    }
    if (!H) return { text: d, caret: c }
    if (H === d) return { text: H, caret: c }
    // 引用 chip：DOM 显示形≠存储形，信桥保编码（光标只能回末尾，无 chip 读写 API）。
    if (CHIP_RE.test(H)) return { text: H, caret: H.length }
    // 其余一切分歧（组词中/桥滞后/跨会话残留）：信看得见的，绝不丢字。
    return { text: d, caret: c }
  }
  if (H) return { text: H, caret: H.length }
  // 末路：史前 textarea 形态兼容（弹窗输入已排除）。
  try {
    if (typeof document !== 'undefined' && (document as any).querySelectorAll) {
      const tas = (document as any).querySelectorAll('textarea')
      for (let i = 0; i < tas.length; i++) {
        const ta = tas[i] as any
        try {
          if (ta.closest && (ta.closest('[data-dsh-prompt-modal]') || ta.closest('[data-dsh-prompt-modal-root]'))) continue
        } catch (e) { /* ignore */ }
        const v = ta.value || ''
        if (v) {
          let p = v.length
          try { if (typeof ta.selectionStart === 'number' && ta.selectionStart > 0) p = ta.selectionStart } catch (e) { /* ignore */ }
          return { text: v, caret: p }
        }
      }
    }
  } catch (e) { /* ignore */ }
  return { text: '', caret: 0 }
}

/** 插入正文到当前草稿（光标处优先，否则末尾；不覆盖；自动聚焦）。返回插入前的草稿长度，供调用点记日志。
 * 注意：宿主 setDraft 语义是全文替换且光标置尾（无光标级写入 API），中部插入后光标回尾是宿主行为，
 * 不是本函数能定的；验收“光标在插入文本后”在尾插时精确成立。
 * useInput 只为兼容旧签名保留：真正的桥订阅在 render 内的 DraftTap，事件回调里不再碰它（Q3）。 */
export function insertBody(useInput: any, inputActions: any, body: string): number {
  void useInput
  armInputFocusTrack()
  const r = resolveDraft()
  const draft = r.text
  const pos = Math.max(0, Math.min(r.caret, draft.length))
  const newDraft = draft.slice(0, pos) + body + draft.slice(pos)
  if (inputActions && typeof inputActions.setDraft === 'function') inputActions.setDraft(newDraft)
  setTimeout(() => {
    try { focusComposer() } catch (e) { /* ignore */ }
  }, 0)
  return draft.length
}

/** 点击模板：插入 + 用量 +1 + 面板关闭（并记一条插入事件：只记种类与散列，不记模板名与正文）。
 * #61：无写入能力（设置页纯管理面不传输入桥）时直接返回 —— 不插入、不涨用量、不记事件。 */
export function onPick(t: PromptTemplate, useInput: any, inputActions: any): void {
  if (!inputActions || typeof inputActions.setDraft !== 'function') return
  pickProbe(useInput, inputActions)
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
 * #40 起导出：更新弹窗复用同一套顶层机制与同一个 rootAttr（`test:issue-21` 钉着这条）。
 */
export function ModalPortal(props: any): any {
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
  // #70 P6a：云整行单选互斥（悬浮 compact 与设置页共用同一顶部，见 cloudNodes）。
  // 单一选中态 selected: string|null——null=全部/无选择=不过滤（'全部'归一到 null，不保留显式值）；
  // 'preset'=仅内置 / 'custom'=仅自建 / 行动词=matchLabel 单选包含；点已选项回 null（toggle），天然互斥。
  const selectedState = react.useState(null as string | null)
  const selected = selectedState[0]
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
  // #74 设置页行折叠：展开态组件局部 useState（存 id 集合），不进 store；
  // 行此前无 onClick，加点击只做同一行简介显隐（不涨用量、不触发插入、不关窗，#61 管理面语义）。
  const expandedState = react.useState(new Set<string>())
  const expanded = expandedState[0]
  const toggleExpanded = (id: string) => {
    expandedState[1]((prev: Set<string>) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
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

  // 列表组装（#23 + #70 P6a）：整行单选互斥，无短路，无双维 AND；
  // null=全部/无选择=不过滤；预置/自定义按 builtin 布尔（继承旧 tab=自定义语义：旧短路 if (tab===CUSTOM_TAG) return !x.builtin）；
  // 行动词按统一标签包含（matchLabel 单选，跨内置自建）；旧阶段页签（执行前/中/后）无等价 UI，走搜索可达。
  // 搜索框保留全文检索（haystack）兼容。排序（#68）：悬浮置顶簇聚底，设置页忽略置顶只留用量降序。
  const customs = allTemplates().filter((x) => !x.builtin)
  const list = allTemplates().filter((x) => {
    // #70 P6a 单选互斥：selected 唯一分支；
    // 云只是面板本地 useState 过滤，/prompt（trigger.ts）与智能卡（smart.ts）走 store 独立检索，不受影响，无需同步。
    if (selected === null) return true
    if (selected === SCOPE_PRESET) return x.builtin
    if (selected === SCOPE_CUSTOM) return !x.builtin
    return matchLabel(x, selected)
  })
  const ql = q.trim().toLowerCase()
  // 搜索与 /prompt 触发源共用检索底座（名称/正文/领域/阶段/动作/标签）
  const filtered = ql
    ? list.filter((x) => templateHaystack(x).indexOf(ql) >= 0)
    : list
  // 悬浮列表 bottom-up（#68）：compact 浮层置顶簇聚底；设置页忽略置顶、只留用量降序
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
  }, [compact, selected, q, filtered.length, sorted.length])

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
  // #70 P6a 云行布局（顶部唯一行；flexWrap 承接自定义词增多时的换行）。
  const cloudRowStyle: any = { display: 'flex', gap: 4, padding: '3px 8px 0', flexWrap: 'wrap' }
  // #70 P6a 云按钮（全部/范围钮与行动词共用同一手感；首行 tabBtn 已随页签删除）。
  const cloudBtn = (on: boolean): any => ({
    padding: '2px 8px', borderRadius: 999, border: line, background: on ? 'var(--dsw-alias-bg-layer-3)' : 'transparent',
    color: on ? base : muted, cursor: 'pointer', fontFamily: 'var(--dsw-font-family)', fontSize: '0.85em',
  })
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
    // 创建反馈：自动置顶（容量允许）→ 切选中态为「自定义」（单选互斥下天然清行动，无需双维分清；
    // 旧 tab=自定义短路天然可见，新单选表达切到自定义即保可见）→ 高亮新项 → 滚入视野
    const r = togglePin(c.id)
    selectedState[1](SCOPE_CUSTOM)
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
  // #70 P6a 整行单选互斥（悬浮/设置共用同一顶部）：[全部][预置][自定义]+行动词同行，所有 pill 同属 selected 单选互斥；
  // 点已选项回 null（toggle）；点他项直接切换（天然清他维，不存在叠加）。
  // 范围钮为Literal中文（全部/预置/自定义），不走 i18n（禁区）；行动词为数据词原文（沿用 #70 维度纯净约定）。
  const cloudNodes = h('div', { style: cloudRowStyle }, [
    h('button', { key: 'scope-all', style: cloudBtn(selected === null), onClick: () => { selectedState[1](null); refresh() } }, ALL_LABEL),
    h('button', { key: 'scope-preset', style: cloudBtn(selected === SCOPE_PRESET), onClick: () => { selectedState[1](selected === SCOPE_PRESET ? null : SCOPE_PRESET); refresh() } }, SCOPE_PRESET_LABEL),
    h('button', { key: 'scope-custom', style: cloudBtn(selected === SCOPE_CUSTOM), onClick: () => { selectedState[1](selected === SCOPE_CUSTOM ? null : SCOPE_CUSTOM); refresh() } }, SCOPE_CUSTOM_LABEL),
    ...actionCloudLabels().map((c) =>
      h('button', { key: c, style: cloudBtn(selected === c), onClick: () => { selectedState[1](selected === c ? null : c); refresh() } }, c),
    ),
  ])
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
    // #71 行内用量徽标：读 store 现有缓存（排序语义不动，只读展示）
    const usageN = (loadUsage()[x.id] || 0)
    const usageTitle = '已使用 ' + usageN + ' 次'
    const usageStyle: any = { flex: 'none', fontSize: '0.75em', color: 'var(--dsw-alias-label-tertiary)', minWidth: '4ch', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"', whiteSpace: 'nowrap' }
    // 紧凑（⚡Prompt 浮层）：单行 —— 图钉 + 标题 + 简介 + 操作横排，不再占两行
    if (compact) {
      // #61 保焦（宿主 input.left 自家按钮同款 keepFocus）：mousedown 默认行为会把焦点从
      // 作曲家抢走；preventDefault 只拦焦点转移，click 照常触发；焦点已在面板搜索框/编辑器内
      // 时不抢（见 keepComposerFocus）；键盘操作无 mousedown，不受影响。
      const keepFocus = { onMouseDown: keepComposerFocus }
      return h('div', { key: x.id, style: { ...itemStyle, background: itemBg, minWidth: 0 }, 'data-dsh-prompt-id': x.id, ...keepFocus, onClick: () => handlePick(x), title: labelString(x) + ' · ' + t('insertHint') }, [
        h('button', { style: pinStyle(pinned), title: t('pin'), onClick: (e: any) => handlePin(e, x) }, [
          h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: pinned ? 'var(--dsw-specific-accent,#f0a45c)' : 'none', stroke: pinned ? 'var(--dsw-specific-accent,#f0a45c)' : dim, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', style: { display: 'block' } }, [
            h('path', { d: 'M12 17v5' }),
            h('path', { d: 'M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z' }),
          ]),
        ]),
        // #71 用量徽标：行最右（操作按钮之后、最末尾），样式不变
        h('span', { style: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 6, overflow: 'hidden' } }, [
          h('span', { style: { flex: 'none', fontSize: '0.95em', color: base, fontWeight: 600, whiteSpace: 'nowrap' } }, x.name),
          h('span', { style: { flex: '0 1 auto', minWidth: 0, fontSize: '0.8em', color: muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, labelString(x)),
          h('span', { style: { flex: '1 1 auto', minWidth: 0, fontSize: '0.85em', color: dim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, intro),
        ]),
        h('span', { style: actStyle }, acts),
        // #71 用量徽标：行最右（操作按钮之后、最末尾），样式不变
        h('span', { style: usageStyle, title: usageTitle }, String(usageN)),
      ])
    }
    // 设置页（纯管理面，#61）：行点击不做任何插入动作 —— #74 折叠除外：
    // 点击行只切换同一行简介显隐，不涨用量、不触发插入、不关窗；
    // 管理仍只走行内图钉/编辑/删除/复制按钮（其 onClick 已 stopPropagation，故不触发折叠）。
    // #74 行默认折叠：简介节点不渲染，单行只显示图钉 + 用量徽标 + 名称 + 标签 + 操作。
    return h('div', { key: x.id, style: { ...itemStyle, cursor: 'pointer', background: itemBg }, 'data-dsh-prompt-id': x.id, title: labelString(x), onClick: () => toggleExpanded(x.id) }, [
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
        expanded.has(x.id) ? h('span', { style: subStyle }, (x.body || '').slice(0, 44) + '…') : null,
      ]),
      h('div', { style: { flex: 'none', display: 'flex', alignItems: 'center', gap: 4, paddingTop: 2 } }, [acts]),
      // #71 用量徽标（设置页）：行最右（操作按钮之后、最末尾）；paddingTop 与图钉一致，与标题首行对齐，样式不变
      h('span', { style: { ...usageStyle, paddingTop: 2 }, title: usageTitle }, String(usageN)),
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
    // #61 真修复：render 内订阅输入桥（DraftTap，无桥的设置页不挂载）
    useInput ? h(DraftTap, { key: 'dsh-prompt-draft-tap', useInput }) : null,
    compact ? h('div', { style: headStyle }, [
      h(PromptMark, { size: 15 }),
      h('span', { style: titleStyle }, t('panelTitle')),
      h('span', { style: { fontSize: '0.85em', color: dim, marginLeft: 6 } }, t('presetCount') + ' ' + presetCount + ' · ' + t('customCount') + ' ' + customCount),
      h('div', { style: { flex: 1 } }),
      h('button', { style: footLink, onClick: () => { setPanelOpen(false); emitGoSettings() } }, t('goSettings')),
      h('div', { style: headBtns }, [
        h('button', { style: addBtn, title: t('add'), onClick: () => modalState[1]({ kind: 'add' }) }, '＋'),
        h('button', { style: closeBtn, title: t('close'), onClick: () => setPanelOpen(false) }, '×'),
      ]),
    ]) : h('div', { style: headStyle }, [
      h(PromptMark, { size: 15 }),
      h('span', { style: titleStyle }, t('panelTitle')),
      h('div', { style: { flex: 1 } }),
      h('button', { style: { ...addBtn, width: 'auto', padding: '0 12px', fontSize: '0.92em' }, title: t('add'), onClick: () => modalState[1]({ kind: 'add' }) }, '＋ ' + t('addShort')),
    ]),
    cloudNodes,
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

/** 点击瞬间现场探针（#61 真机仍覆盖：draftChars 全 0，字活在 textarea/store 之外）。
 * 只记 DOM 计数与桥形状，不记任何正文；位图顺序冻结（见 pick.probe 的 guard）。 */
const PICK_ACT_NAMES = ['setDraft', 'insert', 'insertText', 'appendText', 'setValue', 'setText', 'focus', 'clear']
function pickProbe(useInput: any, inputActions: any): void {
  try {
    let textareas = -1
    let activeKind = 'none'
    let editables = -1
    try {
      if (typeof document !== 'undefined') {
        if (document.querySelectorAll) {
          textareas = document.querySelectorAll('textarea').length
          editables = document.querySelectorAll('[contenteditable="true"]').length
        }
        const ae = (document as any).activeElement
        activeKind = (ae && ae.tagName) || 'none'
      }
    } catch (e) { /* ignore */ }
    let storeChars = tapSeen ? tapDraft.length : -1
    let hasSub = 0
    try {
      // 真机实证：useInput 是裸 selector hook，无 getState 也无 subscribe（renderer 现場合成，
      // 只能 render 内调用）。这里只做形状记录，不断言。
      if (useInput && typeof useInput.subscribe === 'function') hasSub = 1
    } catch (e) { /* ignore */ }
    let actMask = 0
    try {
      if (inputActions) {
        for (let i = 0; i < PICK_ACT_NAMES.length; i++) {
          try { if (typeof inputActions[PICK_ACT_NAMES[i]] === 'function') actMask |= (1 << i) } catch (e) { /* ignore */ }
        }
      }
    } catch (e) { /* ignore */ }
    logEvent('pick.probe', { textareas, activeKind, editables, storeChars, actMask, hasSub })
  } catch (e) { /* ignore */ }
}

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
