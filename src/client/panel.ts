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
 * #70 P6a（2026-09-15）：云整行单选互斥——[全部][预制][自定义]+行动词同行单选，所有 pill 同时只能选中一个；
 * 全部/无选择=不过滤；预制=仅内置（t.builtin）；自定义=仅自建（!t.builtin）；行动词=matchLabel 单选包含（跨内置自建）；
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
import { getRemotePrefs, getEnvOrientation, subscribeRemote, ensureRemoteLoaded } from './remote'
import {
  deriveRemoteOrientation, resolveEffectiveOrientation, computeRemoteView, remoteSizeScale,
  normalizeRemoteDensity, scaledBaseFontSize,
  type RemoteOrientation,
} from './remoteView'
import { tr, STR, type Lang } from './i18n'
// #141 身份-显示分离（承 #137 ADR-0006 §1）：范围身份/用户词身份/存量读侧适配都在 keys.ts 一处。
import {
  SCOPE_ALL, SCOPE_PRESET, SCOPE_CUSTOM, isExcludedLabel,
  scopeSelection, selectionActive, toggleScope, toggleWord, wordActive, isNoFilter, type Selection,
} from './keys'
import { resolveLocale, subscribeLocale } from './locale'
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
// #141（地图 #134 + ADR-0006 §1）：范围钮是**铬**，必须可翻 —— #70 那句「Literal 中文不走 i18n（禁区）」
// 由本票推翻：范围钮文案走词表（tabAll / scopePreset / tabCustom），选中态走具名 CanonicalKey
// （keys.ts 的 Selection）；被排除在翻译之外的只有**用户词**与预制正文。
// 顶部唯一行：[全部][预制][自定义]+行动词云，所有 pill 同属一个选中态，互斥单选（不存在自定义和其他 label 同时选中）。
// 选中态 Selection|null（null=无选择=不过滤，'all' 归一为 null 不保留显式值——见 TemplateBrowser 内注释）；
// 行动词是**用户词身份**（原文即身份，永不翻译）——两条轴带 kind 区分，别名归一不会误伤用户词。
// 词源方案 A（调查报告 §5 步骤 1）：
// allKnownLabels()（预制 23 词 + 在用自定义词，去重保序）去掉非行动词，剩下即云。
// 去留表（以预制 23 词为基准，去 7 留 16；自定义在用词全部“留”，追加排在预制行动词之后）：
//   去（7）：思考框架/学习/工程/执行（4 领域）+ 执行前/执行中/执行后（3 阶段）；
//            另去哨兵 '自定义'（空标签回落词；旧自定义页签 id 已删，语义由范围钮继承）与 'all'（非标签）；
//   留（16，按预制首次出现序）：拆解/检验/归因/决策/理解/路线/概念/考验/审查/测试/重构/解读/启动/固化/记录/复盘；
//   自定义新词：只要不在“去”集合即留（allKnownLabels 已含在用自定义词，开箱即用；
//            若自定义词恰与领域/阶段同名则仍被去——此时该词走搜索可达，云不收录，维度纯净优先）。
// 排序：预制行动词固定首现序（不随用量抖动）+ 自定义词追加；换行 flexWrap（见 cloudRowStyle）。
// 去留表本体收敛到 keys.ts（EXCLUDED_LABEL_WORDS + 身份视图 EXCLUDED_LABEL_KEYS），与远程标签域同一份，
// 不再两处各抄一遍；比对用**存量拼写**——'全部'/'预制' 是合法用户词，归一即连坐出局（#141：过滤语义逐字不动）。
function actionCloudLabels(): string[] {
  return allKnownLabels().filter((l) => !isExcludedLabel(l))
}
// #70 P6a 选中态：null=无选择（不过滤）/ scope 'preset'=仅内置 / scope 'custom'=仅自建 /
// 用户词=matchLabel 单选包含（跨内置自建）。按 builtin 布尔过滤（不是标签），继承旧 tab=自定义短路语义
// （旧：tab===CUSTOM_TAG → !x.builtin）；三态身份（SCOPE_ALL/PRESET/CUSTOM）具名于 keys.ts。

export interface BrowserProps {
  compact: boolean
  inputActions?: any
  useInput?: any
  /**
   * #77：可折叠（只对 `compact: false` 生效，且必须显式传 true）。
   * 收起态只渲染头行 —— chips 过滤行 / 搜索框 / 模板行**整个不渲染**，设置页高度不再被
   * 24 条预制 + 自定义行撑开；点头行展开。不传 = 今天的行为一字不动（既有挂载点与回归脚本都是这样）。
   */
  collapsible?: boolean
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
/** #76：挂输入区事件监听（focusin 记最后摸过的框、selectionchange 采落点）。
 *  插件启动即调用一次 —— 采样必须早于用户打字。 */
export function armInputFocusTrack(): void {
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
          sampleCaret() // 焦点刚回到作曲家（键盘操作、点回输入框）也补一次采样，别只等 selectionchange
        } catch (err) { /* ignore */ }
      }, true)
      // #76：作曲家持有焦点时，用户每一次移动光标（打字、方向键、鼠标点）都会触发
      // selectionchange —— 在那里留下"编辑时的最后落点"。点击面板行时作曲家多半已失焦，
      // 失焦后的活选择可能被浏览器归一化到块边界（真机实证：落点跑到上一行末尾）。
      doc.addEventListener('selectionchange', () => { sampleCaret() })
    }
    sampleCaret() // 挂上就先采一次：面板悬停时用户早已打完字，别等下一次 selectionchange
  } catch (err) { /* ignore */ }
}

/** 编辑期落点采样：#76 的落点权威之一（另一个是"作曲家持焦点时的活读"）。 */
interface CaretSample { root: any; text: string; caret: number }
let caretSample: CaretSample | null = null

/** 作曲家是否持有焦点（根自身或根内元素是 activeElement）。 */
function composerFocused(root: any): boolean {
  try {
    if (typeof document === 'undefined' || !root) return false
    const ae: any = (document as any).activeElement
    if (!ae) return false
    if (ae === root) return true
    try { return !!(root.contains && root.contains(ae)) } catch (e) { return false }
  } catch (e) { return false }
}

/** 采样一次落点。只在作曲家持有焦点时写 —— 失焦后选择可能已被归一化，
 *  那种值不是"用户意图"，不能覆盖编辑期的采样。
 *  先做 O(1) 预检再查 DOM：selectionchange 是全页级的，页面里任何输入框动光标都会触发，
 *  热点路径上不能每次都去 querySelectorAll。 */
function sampleCaret(): void {
  try {
    if (typeof document === 'undefined') return
    const ae: any = (document as any).activeElement
    if (!ae) return
    let editable = false
    try { editable = ae.isContentEditable === true } catch (e) { editable = false }
    if (!editable) {
      try { editable = !!(ae.getAttribute && ae.getAttribute('contenteditable') === 'true') } catch (e) { editable = false }
    }
    if (!editable) return
    for (const r of composerRoots()) {
      if (!composerFocused(r)) continue // 同一套"根自身或根内元素持有焦点"判定，不另写一遍
      const read = readEditable(r)
      caretSample = { root: r, text: read.text, caret: read.caret }
      return
    }
  } catch (e) { /* ignore */ }
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

/** 把 caret（from 里的下标）映射到 to 里的同义位置。
 *  两份草稿的可见字符完全一致（调用方已保证），差异只在换行 —— 落点靠两件事定位：
 *  1) 光标前有多少个可见字符（唯一的锚点）；
 *  2) 光标相对换行的侧向：紧跟着一个可见字符 ⇒ 落点属于"那一行"，目标处整段跨过换行，
 *     别停在空行上；否则（光标后面是换行/文末）⇒ 只按左侧已有的换行数跨，保住"行尾"语义。
 *  from === to 时是恒等映射。 */
function mapCaret(from: string, caret: number, to: string): number {
  const end = Math.max(0, Math.min(caret, from.length))
  let visible = 0
  let newlinesBefore = 0
  for (let i = 0; i < end; i++) {
    if (from.charCodeAt(i) === 10) newlinesBefore++
    else { visible++; newlinesBefore = 0 }
  }
  const beforeVisible = end < from.length && from.charCodeAt(end) !== 10
  let j = 0
  let seen = 0
  while (j < to.length && seen < visible) {
    if (to.charCodeAt(j) === 10) j++
    else { seen++; j++ }
  }
  let run = 0
  while (j + run < to.length && to.charCodeAt(j + run) === 10) run++
  const cross = beforeVisible ? run : Math.min(newlinesBefore, run)
  return Math.max(0, Math.min(j + cross, to.length))
}

/** 读一个可编辑根的纯文本与活光标（同一套块映射，文本与光标同源，绝不错位）。
 * 文本≈宿主 clipboardText（段落↔\n，空段落即空行）；光标=当前 selection 锚点，无选择即末尾。
 * 元素锚点按宿主自己的规则解：offset 是该元素子节点下标 —— 越过末子节点 → 元素末尾，
 * 否则 → 该子节点的起点（#76；旧实现"取首个 run 的起或末"会把块边界的落点翻到上一行）。 */
function readEditable(root: any): { text: string; caret: number } {
  let text = ''
  try {
    const runs: Array<{ node: any; start: number; len: number }> = []
    const bounds = new Map<any, { start: number; end: number }>()   // 元素节点 → 其内容区间
    const childStart = new Map<any, number>()                       // 元素节点 → 内容起点（含分隔后）
    const kids: any[] = (root && root.childNodes) ? Array.prototype.slice.call(root.childNodes) : []
    const pushRun = (s: string, node: any) => {
      if (!s) return
      runs.push({ node, start: text.length, len: s.length })
      text += s
    }
    const elementKids = (el: any): any[] => {
      try { return el && el.childNodes ? Array.prototype.slice.call(el.childNodes) : [] } catch (e) { return [] }
    }
    const hasEl = kids.some((k: any) => k && k.nodeType === 1)
    if (!hasEl) {
      pushRun(root.textContent || '', null)
    } else {
      // #76：递归走完整棵子树 —— 旧代码只看直接子节点的 BR/块边界，
      // 段落内的软换行（BR）与嵌套块的边界全被吞，读数直接聚成一段。
      // 规则：块前分隔；BR 与空块强制占一行（空段落即空行，连续换行不折叠）；
      // 文本与光标仍同源（runs 记文本节点、bounds 记元素区间、childStart 记子节点起点，
      // 全部在同一次遍历里落账），末尾残留的分隔截掉。
      const sep = () => {
        if (text.length === 0) return
        if (text.charCodeAt(text.length - 1) !== 10) text += '\n'
      }
      const forceBreak = () => {
        if (text.length === 0) return
        text += '\n'
      }
      /** 走一个元素节点：记 bounds 与 childStart，再递归其子节点。 */
      const walkElement = (el: any) => {
        const tag = String((el && el.tagName) || '').toUpperCase()
        const ch = elementKids(el)
        if (BLOCK_TAGS[tag] === 1) {
          sep()
          const start = text.length
          childStart.set(el, start)
          for (const c of ch) walkNode(c)
          bounds.set(el, { start, end: text.length })
          if (text.length === start) forceBreak() // 空块仍占一行（空行保留）
        } else {
          if (ch.length === 0) {
            try { pushRun(el.textContent || '', el) } catch (e) { /* ignore */ }
          } else {
            childStart.set(el, text.length)
            for (const c of ch) walkNode(c)
          }
        }
      }
      const walkNode = (k: any) => {
        if (!k) return
        if (k.nodeType === 3) { childStart.set(k, text.length); pushRun(k.nodeValue || '', k); return }
        if (k.nodeType !== 1) return
        if (String(k.tagName || '').toUpperCase() === 'BR') { childStart.set(k, text.length); forceBreak(); return }
        walkElement(k)
      }
      for (const c of kids) walkNode(c)
      bounds.set(root, { start: 0, end: text.length })
      text = text.replace(/\n+$/, '')
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
          const hit = anchorToOffset(an, ao)
          if (typeof hit === 'number' && hit >= 0) caret = hit
        }
      }
      // 锚点 → 文本偏移：文本节点直接查 run；元素节点按子节点下标（宿主同款规则）
      function anchorToOffset(an: any, ao: number): number {
        if (an && an.nodeType === 3) {
          for (const r of runs) if (r.node === an) return r.start + Math.max(0, Math.min(ao, r.len))
          return -1
        }
        const b = bounds.get(an)
        if (b) {
          const ch = elementKids(an)
          if (ao >= ch.length) return b.end
          const cs = childStart.get(ch[ao])
          if (typeof cs === 'number' && cs >= 0) return cs
          return b.end
        }
        // 兜底（非本次遍历命中的元素）：包住的首个 run
        for (const r of runs) {
          if (r.node === an) return ao > 0 ? r.start + r.len : r.start
        }
        for (const r of runs) {
          try { if (an && an.contains && an.contains(r.node)) return ao > 0 ? r.start + r.len : r.start } catch (e) { /* ignore */ }
        }
        return -1
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
  // #76：mousedown 是"用户落点"的最后一个可信时刻（还没失焦）——先采一次再谈保焦
  sampleCaret()
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

/** 决议当前草稿与插入点（#61 真修复 + #76 落点与换行保真）。
 *  H=宿主模型草稿（render 内订阅，宿主自己的 clipboard 投影），D=点击瞬间的 DOM 活读。
 *  文本：#76 —— 可见字符一致、只有换行形态有别时，信 H。理由在宿主源码里：setDraft 按 \n
 *  切段、段间补一个 \n，模型才是行结构的真值；DOM 只是渲染表象（空块、装饰器、末尾 BR
 *  都可能凭空多出或吞掉换行）。真机日志实证过 H 与 D 长度分歧（D 少 1–9 字符）。
 *  落点：作曲家持焦点 → 活读（看得见的）；已失焦 → 编辑期采样（selectionchange 留下）；
 *  都没有 → 活读兜底。真机实证失焦后选择会被归一化到上一行末尾，字就插错了行。 */
function resolveDraft(): { text: string; caret: number; caretSrc: string } {
  const norm = (s: string) => (s || '').replace(/\r\n?/g, '\n')
  const H = norm(tapDraft)
  const root = pickEditable()
  if (root) {
    let d = ''
    let live = -1
    try {
      const r = readEditable(root)
      d = norm(r.text)
      live = Math.max(0, Math.min(r.caret, d.length))
    } catch (e) { /* ignore */ }
    let caret = live
    // 作曲家持焦点 → 活读可信（用户看得见光标在那）；已失焦 → 活读只算"未经确认"（浏览器
    // 可能已把选择归一化到块边界），诊断上单独记 live-blur，好让真机日志能一眼分开。
    let caretSrc = composerFocused(root) ? 'live' : 'live-blur'
    if (live < 0) { caret = d.length; caretSrc = 'end' }
    // 采样只对"同一个作曲家根"有意义：换了会话/换了输入根，旧采样就是别人的落点。
    if (!composerFocused(root) && caretSample && caretSample.root === root) {
      caret = mapCaret(norm(caretSample.text), caretSample.caret, d || norm(caretSample.text))
      caretSrc = 'sample'
    }
    if (!d) {
      // DOM 读空：编辑器空着（或未渲染）—— H 有就信 H，没有就是真空
      // 落点被顶到 H 末尾，来源如实记 'end'（别让诊断字段说谎）
      if (H) return { text: H, caret: H.length, caretSrc: 'end' }
      return { text: '', caret: 0, caretSrc }
    }
    if (!H) return { text: d, caret, caretSrc }
    if (H === d) return { text: H, caret, caretSrc }
    // 引用 chip：DOM 显示形≠存储形，信桥保编码（光标只能回末尾，无 chip 读写 API）。
    if (CHIP_RE.test(H)) return { text: H, caret: H.length, caretSrc: 'end' }
    // #76 换行权威：可见字符一模一样、只有换行形态不同 → 信宿主模型 H，
    // 落点按"换行前/换行后"逐位对齐映射过去（见 mapCaret），不乱改行号。
    if (H.replace(/\n/g, '') === d.replace(/\n/g, '')) {
      return { text: H, caret: mapCaret(d, caret, H), caretSrc }
    }
    // 其余一切分歧（组词中/桥滞后/跨会话残留）：信看得见的，绝不丢字。
    return { text: d, caret, caretSrc }
  }
  if (H) return { text: H, caret: H.length, caretSrc: 'end' }
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
          return { text: v, caret: p, caretSrc: 'legacy' }
        }
      }
    }
  } catch (e) { /* ignore */ }
  return { text: '', caret: 0, caretSrc: 'none' }
}

/** 上一次决议的落点诊断（只记数字与来源枚举，不记正文）：供 pick.insert 落盘。
 *  模块级暂存是刻意的诊断槽（同文件 tapDraft / lastFocusEl 同款）—— insertBody 的返回值
 *  被既有调用点与回归当作"插入前草稿长度"用，不能改签名去顺带回传这份诊断。 */
let lastInsertProbe: { caret: number; caretSrc: string; draftLines: number } = { caret: 0, caretSrc: 'none', draftLines: 0 }

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
  lastInsertProbe = { caret: pos, caretSrc: r.caretSrc, draftLines: draft.length === 0 ? 0 : draft.split('\n').length }
  const newDraft = draft.slice(0, pos) + body + draft.slice(pos)
  if (inputActions && typeof inputActions.setDraft === 'function') inputActions.setDraft(newDraft)
  setTimeout(() => {
    try { focusComposer() } catch (e) { /* ignore */ }
  }, 0)
  return draft.length
}

/** 点击模板：插入 + 用量 +1 + 面板关闭（并记一条插入事件：只记种类与散列，不记模板名与正文）。
 * #61：无写入能力（设置页纯管理面不传输入桥）时直接返回 —— 不插入、不涨用量、不记事件。
 * #76：多记落点与落点来源（纯数字与枚举），真机再报错位时能一眼看出是活读、采样还是兜底。 */
export function onPick(t: PromptTemplate, useInput: any, inputActions: any): void {
  if (!inputActions || typeof inputActions.setDraft !== 'function') return
  pickProbe(useInput, inputActions)
  const draftChars = insertBody(useInput, inputActions, t.body)
  logEvent('pick.insert', {
    source: 'panel',
    templateKind: t.builtin ? 'preset' : 'custom',
    idHash: t.id,
    draftChars,
    caret: lastInsertProbe.caret,
    caretSrc: lastInsertProbe.caretSrc,
    draftLines: lastInsertProbe.draftLines,
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
const modalCardStyle: any = { width: 460, background: 'var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))', backgroundColor: 'var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))', border: '1px solid var(--dsw-alias-border-inverted)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, fontFamily: 'var(--dsw-font-family)', color: 'var(--dsw-alias-label-primary)' }
const modalFieldStyle: any = { width: '100%', background: 'var(--dsw-alias-bg-layer-3)', border: '1px solid var(--dsw-alias-border-l1)', color: 'var(--dsw-alias-label-primary)', borderRadius: 8, padding: '8px 10px', fontFamily: 'var(--dsw-font-family)', fontSize: '0.96em', outline: 'none', boxSizing: 'border-box' }
const modalBtnsStyle: any = { display: 'flex', justifyContent: 'flex-end', gap: 8 }
const modalBtn = (primary?: boolean, danger?: boolean): any => ({ padding: '6px 14px', borderRadius: 8, border: primary ? 0 : '1px solid var(--dsw-alias-border-l1)', background: primary ? 'var(--dsw-specific-accent,#f0a45c)' : 'var(--dsw-alias-bg-layer-3)', color: primary ? '#1a1a1e' : (danger ? 'var(--dsw-specific-danger,#e06c75)' : 'var(--dsw-alias-label-primary)'), cursor: 'pointer', fontFamily: 'var(--dsw-font-family)', fontSize: '0.96em' })

/** 新建/编辑弹窗（模块级稳定组件，避免父级重渲染时被卸载重置） */
function TemplateModal(props: any): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  // 新增弹窗跟大小（仅远程开时；父级重渲染即刷新，无需订阅）。
  const uiScale = remoteSizeScale(getRemotePrefs().enabled ? getRemotePrefs().size : 1)
  const cardStyleScaled: any = { ...modalCardStyle, fontSize: 'calc(1em * ' + uiScale + ')' }
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
  // 远程模式标签悬浮网格（2026-09-29 用户拍板）：常态只留一个触发键，点后浮出网格 overlay 选；
  // 不常驻占位。原生 datalist 远程下不用，非远程原样（零打扰）。
  const labelGridOn = getRemotePrefs().enabled
  const labelPickerState = react.useState(false)
  const labelPickerOpen = labelPickerState[0]
  const labelGridStyle: any = {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(4.5em, 1fr))',
    gap: '0.5em', marginTop: '0.75em',
  }
  const labelCellStyle = (on: boolean): any => ({
    aspectRatio: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', padding: '0.25em', borderRadius: '0.6em', cursor: 'pointer',
    border: 'thin solid var(--dsw-alias-border-l1)', overflow: 'hidden',
    background: on ? 'var(--dsw-specific-accent,#f0a45c)' : 'transparent',
    color: on ? '#1a1a1e' : 'var(--dsw-alias-label-primary)',
    fontFamily: 'var(--dsw-font-family)', fontSize: '0.85em', fontWeight: on ? 700 : 500,
    lineHeight: 1.25, overflowWrap: 'break-word',
  })
  const toggleGridLabel = (w: string): void => {
    if (labels.indexOf(w) >= 0) setLabels(labels.filter((x: string) => x !== w))
    else setLabels(normalizeLabels([...labels, w]))
  }
  const chipStyle: any = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.85em', color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-layer-3)', border: '1px solid var(--dsw-alias-border-l2)', padding: '1px 4px 1px 9px', borderRadius: 999, whiteSpace: 'nowrap' }
  const chipXStyle: any = { border: 0, background: 'transparent', color: 'var(--dsw-alias-label-tertiary)', cursor: 'pointer', fontSize: '1em', lineHeight: 1, padding: '0 2px', fontFamily: 'var(--dsw-font-family)' }
  return h('div', { style: modalMaskStyle, 'data-dsh-prompt-modal': '', onClick: (e: any) => { if (e.target === e.currentTarget) props.onCancel() } }, [
    h('div', { style: { ...cardStyleScaled, width: labelGridOn ? 'min(1440px, 96vw)' : 'min(640px, 94vw)', maxHeight: labelGridOn ? '90vh' : '92vh', overflowY: 'auto' } }, [
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
        list: labelGridOn ? undefined : 'dsh-prompt-labels',
      }),
      labelGridOn ? null : h('datalist', { id: 'dsh-prompt-labels' }, known.map((w: string) => h('option', { key: w, value: w }))),
      // 悬浮式标签网格触发键：常态只占一行，点后浮出 overlay 网格多选（×/点外/完成关闭）。
      labelGridOn ? h('button', {
        key: 'label-picker', type: 'button',
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          marginTop: '0.5em', padding: '0.6em 0.75em', borderRadius: '0.6em',
          border: 'thin solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-bg-layer-3)',
          color: 'var(--dsw-alias-label-primary)', cursor: 'pointer',
          fontFamily: 'var(--dsw-font-family)', fontSize: '1em',
        },
        'data-dsh-prompt-label-picker': '1',
        'aria-haspopup': 'true', 'aria-expanded': labelPickerOpen ? 'true' : 'false',
        onClick: () => labelPickerState[1](true),
      }, [
        h('span', { key: 't' }, '🏷 ' + props.t('labelPicker') + (labels.length > 0 ? ' · ' + labels.length : '')),
        h('span', { key: 'c', style: { color: 'var(--dsw-alias-label-tertiary)' } }, '▾'),
      ]) : null,
      labelGridOn && labelPickerOpen ? h(ModalPortal, { key: 'label-grid-overlay' }, [
        h('div', {
          key: 'label-grid-mask',
          style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: MODAL_Z },
          'data-dsh-prompt-label-grid-mask': '1',
          onClick: (e: any) => { if (e.target === e.currentTarget) labelPickerState[1](false) },
        }, [
          h('div', {
            key: 'label-grid-card',
            style: {
              width: 'min(520px, 92vw)', maxHeight: '80vh', overflowY: 'auto',
              background: 'var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))',
              backgroundColor: 'var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))',
              border: '1px solid var(--dsw-alias-border-inverted)', borderRadius: 12, padding: '0.9em',
              fontFamily: 'var(--dsw-font-family)', color: 'var(--dsw-alias-label-primary)',
            },
          }, [
            h('div', { key: 'head', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5em' } }, [
              h('span', { key: 't', style: { fontSize: '1em', fontWeight: 700 } }, '🏷 ' + props.t('labelPicker')),
              h('span', { key: 'btns', style: { display: 'flex', gap: '0.5em' } }, [
                h('button', { key: 'done', type: 'button', style: modalBtn(true), onClick: () => labelPickerState[1](false) }, props.t('labelDone')),
                h('button', { key: 'x', type: 'button', style: modalBtn(), onClick: () => labelPickerState[1](false) }, '×'),
              ]),
            ]),
            h('div', { key: 'grid', style: labelGridStyle, 'data-dsh-prompt-label-grid': '1' }, known.map((w: string) => {
              const on = labels.indexOf(w) >= 0
              return h('button', {
                key: w, type: 'button', style: labelCellStyle(on),
                'data-dsh-prompt-label-cell': '1', 'aria-pressed': on ? 'true' : 'false', title: w,
                onClick: () => toggleGridLabel(w),
              }, w)
            })),
          ]),
        ]),
      ]) : null,
      h('div', { style: { fontSize: '0.85em', color: 'var(--dsw-alias-label-tertiary)' } }, props.t('labelsHint')),
      h('textarea', { style: { ...modalFieldStyle, height: labelGridOn ? 400 : 200, resize: 'vertical' }, placeholder: props.t('bodyPh'), value: body, onChange: (e: any) => setBody(e.target.value) }),
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
  // 删除确认跟大小（仅远程开时；关=正常尺寸）。
  const uiScale = remoteSizeScale(getRemotePrefs().enabled ? getRemotePrefs().size : 1)
  const cardStyleScaled: any = { ...modalCardStyle, fontSize: 'calc(1em * ' + uiScale + ')' }
  return h('div', { style: modalMaskStyle, 'data-dsh-prompt-modal': '', onClick: (e: any) => { if (e.target === e.currentTarget) props.onCancel() } }, [
    h('div', { style: cardStyleScaled }, [
      h('h3', { style: { fontSize: '1.08em', margin: 0 } }, props.t('delTitle')),
      h('div', { style: { fontSize: '0.96em', color: 'var(--dsw-alias-label-tertiary)' }, 'data-dsh-prompt-chrome': 'nameQuote' }, props.t('delMsg') + props.t('nameQuote').replace('{name}', props.tpl.name) + props.t('delUnrecover')),
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

  const langState = react.useState(resolveLocale())
  const lang = langState[0]
  const tickState = react.useState(0)
  const setTick = tickState[1]
  // #70 P6a：云整行单选互斥（悬浮 compact 与设置页共用同一顶部，见 cloudNodes）。
  // #141：单一选中态 Selection|null——null=无选择=不过滤（'全部' 归一到 null，不保留显式值）；
  // scope 'preset'=仅内置 / scope 'custom'=仅自建 / word=用户词原文，matchLabel 单选包含；
  // 点已选项回 null（toggle），天然互斥。带 kind 的取值让「范围身份」与「用户词身份」结构性不可混。
  const selectedState = react.useState(null as Selection | null)
  const selected = selectedState[0]
  const qState = react.useState('')
  const q = qState[0]
  const modalState = react.useState(null as ModalState | null)
  const modal = modalState[0]
  /**
   * #77 设置页折叠（默认收起）：只渲染头行，列表整块不挂载。
   * 只认「compact 为假 + 调用方显式给了 collapsible」——悬浮面板永远是展开的，
   * 不传这个 prop 的挂载（含全部既有回归脚本）行为一字不动。
   */
  const collapsible = !compact && !!props.collapsible
  const listOpenState = react.useState(false)
  const listOpen = listOpenState[0]
  const showList = !collapsible || listOpen
  const posState = react.useState(null as { left: number; bottom: number } | null)
  const pos = posState[0]
  const rootRef = react.useRef(null as any)
  const listRef = react.useRef(null as any)
  const highlightState = react.useState(null as string | null)
  const highlightId = highlightState[0]
  // #88 行强调态（父级持 id，避免 hooks 进 map）：hover=鼠标悬停/键盘进焦，pressed=鼠标按下/触屏按住统一态（Pointer+Mouse 双轨，不做独立 long-press 计时）。
  const hoverState = react.useState(null as string | null)
  const hoverId = hoverState[0]
  const pressedState = react.useState(null as string | null)
  const pressedId = pressedState[0]
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
  // #83 远程大列表本体（只动 TemplateBrowser 分支）：总闸开=大、关=小，零中间态。
  // #132 标签区已移除：不再持有远程选中态；过滤只走搜索框全文（含标签可达），域 matchLabel/haystack 不动。
  const remoteQState = react.useState('')
  const remoteQ = remoteQState[0]
  const remotePageState = react.useState(0)
  const remotePage = remotePageState[0]
  const remoteSearchState = react.useState(false)
  const remoteSearchOpen = remoteSearchState[0]
  const remoteFocusState = react.useState(false)
  const remoteSearchFocused = remoteFocusState[0]
  const remoteCompState = react.useState(false)
  const remoteComposing = remoteCompState[0]
  const orientState = react.useState('landscape' as RemoteOrientation)
  const remoteOrient = orientState[0]
  const remoteTickState = react.useState(0)
  void remoteTickState[0]

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

  // 语言跟随：共享单例订阅器（html[lang] 兜底 + 宿主 locale 服务快照），
  // 不再各面自挂 MutationObserver（#137；观察者与去重都在 locale.ts 一处）
  react.useEffect(() => subscribeLocale((l) => { langState[1](l) }), [])

  // #14 回归：紧凑浮层弹窗打开期间抑制 hover 自动关窗（含入口按钮的 schedulePanelClose）
  // - 本地根节点 hover 同步抑制（防御式） + 全局 gate（覆盖入口按钮）
  // - #34 扩展：搜索框聚焦/组词期同样抑制——用户正在输入时杂散 leave 不关窗；
  //   显式关闭（×/插入/toggle 调 setPanelOpen(false)）不受抑制影响，不会粘住。
  // deps 用 !!modal 避免对象身份抖动；onCancel/onOk/输入框处理器中同步清门控以消除 effect 下一帧前的竞态窗口
  react.useEffect(() => {
    if (!compact) return
    if (modal || searchFocused || composing || remoteSearchFocused || remoteComposing) setHoverCloseSuppressed(true)
    else setHoverCloseSuppressed(false)
    return () => { setHoverCloseSuppressed(false) }
  }, [compact, !!modal, searchFocused, composing, remoteSearchFocused, remoteComposing])

  const refresh = () => setTick((n: number) => n + 1)
  const t = (k: keyof typeof STR) => tr(lang, STR[k])

  // #20 直接切换：挂载即拉 host 快照，host 变更经订阅刷新（内存缓存同步写后已 refresh，此处补异步到达）
  react.useEffect(() => {
    let on = true
    ensureLoaded().then(() => { if (on) refresh() }, () => undefined)
    const off = subscribeStore(() => { if (on) refresh() })
    return () => { on = false; off() }
  }, [])

  // #83 远程偏好订阅 + 方向偏好（去宿主化：视口推导为 auto 档的输入，锁定档直接覆盖，不读宿主）。
  react.useEffect(() => {
    let on = true
    try { ensureRemoteLoaded().then(() => { if (on) remoteTickState[1]((n: number) => n + 1) }, () => undefined) } catch (e) { /* ignore */ }
    let off: (() => void) | null = null
    try { off = subscribeRemote(() => { if (on) remoteTickState[1]((n: number) => n + 1) }) } catch (e) { /* ignore */ }
    return () => { on = false; try { if (off) off() } catch (e) { /* ignore */ } }
  }, [])
  // 视口方向（auto 档的输入）：只存视口推导值，最终方向由方向偏好解析（锁定覆盖）。
  react.useEffect(() => {
    if (!compact) return
    const update = (): void => {
      try {
        const w = (globalThis as any).window
        const iw = w && typeof w.innerWidth === 'number' ? w.innerWidth : (typeof window !== 'undefined' ? (window as any).innerWidth : undefined)
        const ih = w && typeof w.innerHeight === 'number' ? w.innerHeight : (typeof window !== 'undefined' ? (window as any).innerHeight : undefined)
        if (typeof iw === 'number' && typeof ih === 'number') orientState[1](deriveRemoteOrientation(iw, ih))
      } catch (e) { /* ignore */ }
    }
    update()
    try {
      const w = (globalThis as any).window
      if (w && typeof w.addEventListener === 'function') {
        w.addEventListener('resize', update)
        return () => { try { w.removeEventListener('resize', update) } catch (e) { /* ignore */ } }
      }
      if (typeof window !== 'undefined' && typeof (window as any).addEventListener === 'function') {
        (window as any).addEventListener('resize', update)
        return () => { try { (window as any).removeEventListener('resize', update) } catch (e) { /* ignore */ } }
      }
    } catch (e) { /* ignore */ }
    return () => undefined
  }, [compact])

  // 列表组装（#23 + #70 P6a）：整行单选互斥，无短路，无双维 AND；
  // null=无选择=不过滤；预制/自定义按 builtin 布尔（继承旧 tab=自定义语义：旧短路 if (tab===CUSTOM_TAG) return !x.builtin）；
  // 行动词按统一标签包含（matchLabel 单选，跨内置自建）；旧阶段页签（执行前/中/后）无等价 UI，走搜索可达。
  // #141：分支按 Selection 的 kind 收敛 —— 用户词走原文比对，绝不经过别名归一（见 selected 分支与云行注释）。
  // 搜索框保留全文检索（haystack）兼容。排序（#68）：悬浮置顶簇聚底，设置页忽略置顶只留用量降序。
  const customs = allTemplates().filter((x) => !x.builtin)
  const list = allTemplates().filter((x) => {
    // #70 P6a 单选互斥：selected 唯一分支（#141 起按身份 kind 分支）；
    // 云只是面板本地 useState 过滤，/prompt（trigger.ts）与智能卡（smart.ts）走 store 独立检索，不受影响，无需同步。
    if (isNoFilter(selected)) return true
    const sel = selected as Selection
    if (sel.kind === 'word') return matchLabel(x, sel.word)
    return sel.key === SCOPE_PRESET ? x.builtin : !x.builtin
  })
  const ql = q.trim().toLowerCase()
  // 搜索与 /prompt 触发源共用检索底座（名称/正文/领域/阶段/动作/标签）
  const filtered = ql
    ? list.filter((x) => templateHaystack(x).indexOf(ql) >= 0)
    : list
  // 悬浮列表 bottom-up（#68）：compact 浮层置顶簇聚底；设置页忽略置顶、只留用量降序
  const sorted = compact ? sortedTemplatesBottomUp(filtered) : sortedTemplates(filtered)

  // #83 远程大列表数据（纯视图模型输入输出；排序与匹配复用既有收敛点，不另起第二套）。
  // 标签域收敛为全部加在用动态词单选（预制与自定义平权，走 matchLabel 单选包含）。
  const remotePrefs = getRemotePrefs()
  const isRemoteBig = compact && !!remotePrefs.enabled
  // #132 标签区移除：远程不再按标签收敛，全量直通搜索（搜标签词仍经 haystack 可达）
  const remoteListBase = allTemplates()
  const remoteQl = remoteQ.trim().toLowerCase()
  const remoteFiltered = remoteQl
    ? remoteListBase.filter((x) => templateHaystack(x).indexOf(remoteQl) >= 0)
    : remoteListBase
  const remoteSorted = sortedTemplatesBottomUp(remoteFiltered)
  // 最终方向（#110 检测统一）：显式偏好赢；auto 取环境方向缓存（整机桥已知值），缺席回落视口推导。
  // 只读缓存，永不触发网络（新鲜度由设置页/开关流负责）。
  const remotePref = (remotePrefs as any).orientation || 'auto'
  let remoteEnv: unknown = null
  try {
    const e = getEnvOrientation()
    remoteEnv = e ? e.orientation : null
  } catch (err) { remoteEnv = null }
  const remoteFinalOrient: RemoteOrientation = resolveEffectiveOrientation(remotePref, remoteEnv, remoteOrient)
  const remoteView = computeRemoteView({
    ids: remoteSorted.map((x) => x.id),
    page: remotePage,
    orientation: remoteFinalOrient,
    enabled: !!remotePrefs.enabled,
    size: (remotePrefs as any).size,
    hostCaps: { hasSystemOrientation: false, hasSystemFont: false, hasStableOpen: false },
    searchOpen: remoteSearchOpen,
    density: (remotePrefs as any).density,
  })
  // #90 仅切密度页码归零（方向切换不动页码；纯手动，无自动切档逻辑）。
  const remoteDensity = normalizeRemoteDensity((remotePrefs as any).density)
  react.useEffect(() => {
    remotePageState[1](0)
  }, [remoteDensity])
  const remoteById = new Map(remoteSorted.map((x) => [x.id, x]))
  const remoteUsage = loadUsage()

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

  // 大小跟随开关（2026-09-29 用户拍板）：仅远程开时缩放，关=一切正常尺寸。
  const uiFontScale = remoteSizeScale(remotePrefs.enabled ? remotePrefs.size : 1)

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
        display: 'flex', flexDirection: 'column',        // #88 不透明兜底：宿主 --dsw-specific-menu 为玻璃半透明时面板跟着透，行文字被底层盖住。
        // 可读性必须建在不透明层上，故优先别名层实色（宿主保证不透明），menu 只作回退；backgroundColor 同链确保 shorthand 被覆盖后仍 opaque。
        background: 'var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))',
        backgroundColor: 'var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))',
        border: '1px solid var(--dsw-alias-border-inverted)',
        borderRadius: 12, boxShadow: 'var(--dsw-shadow-lv3)', overflow: 'hidden',
        // 常规小列表同样跟字号档（calc 相对缩放，子项 em 全跟；宽 560/高 360 布局量不动）。
        fontFamily: 'var(--dsw-font-family)', fontSize: 'calc(var(--dsw-font-markdown-base-font-size) * ' + uiFontScale + ')', color: base,
      }
    : {
        display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 8px',
        // #116：设置页折叠小列表跟远程档（var 基重算，与设置页根/悬浮小列表同构；禁用 1em 基，防复乘）。
        fontFamily: 'var(--dsw-font-family)', fontSize: scaledBaseFontSize(remotePrefs.enabled, remotePrefs.size), color: base,
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
  const itemStyle: any = { display: 'flex', gap: 6, borderRadius: 8, cursor: 'pointer', alignItems: compact ? 'center' : 'flex-start', padding: compact ? '3px 6px' : '4px 2px', transition: 'background-color .12s ease' }
  // #88 行强调 token（沿用仓内既有语义，不新造色）：hover=交互 hover，pressed=交互 active 回退层 3（比 hover 深一档）。
  const ROW_HOVER_BG = 'var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2, rgba(255,255,255,.06)))'
  const ROW_PRESSED_BG = 'var(--dsw-alias-interactive-bg-active, var(--dsw-alias-bg-layer-3))'
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
    selectedState[1](scopeSelection(SCOPE_CUSTOM))
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

  // REMOTE-BIG-LIST-START (#83 大列表十二槽本体：只动 TemplateBrowser 分支)
  // 远程开=大列表分支：固定十二槽、虚线空位、搜索收起行内顶起、#132 标签区已移除、
  // 置顶聚底复用既有排序、卡面标题加简介各一行、底栏新增+搜索+大翻页同栏、字号控件三档乘数。
  // 定位取锚点上方全部可用高度、宽度近全宽；内部以相对单位随面板缩放。
  if (isRemoteBig) {
    const remoteCols = remoteView.cols
    const remoteRows = remoteView.rows
    const remoteFontScale = remoteView.fontScale
    const remoteControlScale = remoteView.controlScale
    const remoteThin = 'thin solid var(--dsw-alias-border-l1)'
    const remotePanelStyle: any = {
      position: 'fixed',
      left: '1%', right: '1%', top: '1%',
      bottom: (pos && typeof pos.bottom === 'number') ? pos.bottom : '1%',
      zIndex: PANEL_Z,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      background: 'var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))',
      backgroundColor: 'var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))',
      border: remoteThin,
      borderRadius: '0.75em',
      fontFamily: 'var(--dsw-font-family)',
      fontSize: 'calc(1em * ' + remoteFontScale + ')',
      color: base,
    }
    const remoteMetaStyle: any = { fontSize: '0.85em', color: dim, whiteSpace: 'nowrap' }
    const remoteCloseStyle: any = {
      marginLeft: 'auto', flex: 'none',
      width: '2.5em', height: '2.5em', borderRadius: '50%',
      border: remoteThin, background: 'transparent', color: dim,
      fontSize: '1em', lineHeight: 1, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }
    const remoteGridStyle: any = {
      flex: '1 1 auto', minHeight: '0', minWidth: '0',
      display: 'grid',
      gridTemplateColumns: 'repeat(' + remoteCols + ', minmax(0, 1fr))',
      gridTemplateRows: 'repeat(' + remoteRows + ', minmax(0, 1fr))',
      // 空白不跟字号等比：gap/padding 用 rem 固定，字大只长字不长空白（0.75em 标记留给圆角以保回归）。
      gap: '0.5rem', padding: '0.5rem', overflow: 'hidden', alignContent: 'stretch',
    }
    const remoteCardStyle = (custom: boolean, pinned: boolean, hover: boolean, pressed: boolean): any => ({
      minWidth: '0', minHeight: '0', overflow: 'hidden',
      // 卡片是悬浮页脚的定位锚（页脚 absolute 右下压简介，position 不可删）。
      position: 'relative',
      // 自上而下=标题 → 简介（独享剩余、底边硬裁），页脚悬浮不占行。
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: '0.25rem',
      padding: '0.5rem', borderRadius: '0.75em',
      // 预制 / 自建只看边框颜色（远程用户拍板）：自建=accent 边，预制=默认细边；
      // 置顶=accent 粗边（覆盖），按压/悬停复用 #88 行语义。
      border: pinned
        ? '0.14em solid var(--dsw-specific-accent,#f0a45c)'
        : (custom ? '0.07em solid var(--dsw-specific-accent,#f0a45c)' : remoteThin),
      background: pressed
        ? ROW_PRESSED_BG
        : hover
          ? ROW_HOVER_BG
          : (custom ? 'var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-layer-3))' : 'var(--dsw-alias-bg-layer-3)'),
      outline: pressed ? '0.07em solid var(--dsw-alias-border-l1)' : undefined,
      color: base,
      cursor: 'pointer', fontFamily: 'var(--dsw-font-family)', textAlign: 'left',
      fontSize: '1em', lineHeight: 1.3,
      transition: 'background-color .12s ease, transform .08s ease, filter .08s ease',
      transform: pressed ? 'scale(.98)' : undefined,
    })
    const remoteCardTitle: any = {
      fontSize: '1.02em', fontWeight: 700, color: base,
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 'none',
    }
    // 简介全文展示（2026-09-29 用户拍板：2 行 clamp 取消，卡内能放多少放多少；
    // 超长由卡片底边硬裁，不跳高——面板高度本就由锚点固定，页内卡等高由 grid 保证）。
    const remoteCardIntro: any = {
      fontSize: '0.85em', color: muted,
      whiteSpace: 'normal', overflow: 'hidden', overflowWrap: 'break-word',
      flex: '1 1 auto', minHeight: 0, lineHeight: 1.4,
    }
    // 种类徽标已删（远程用户拍板：预制/自建改看卡片边框颜色，页脚只剩红色用量数字+复制/编辑键）。
    // 用量只剩红色数字（远程用户拍板）；置顶加 ★（边框粗细已让给预制/自建+置顶，此 ★ 为置顶唯一文字信号）。
    const remoteCardUse = (pinnedCard: boolean): any => ({
      fontSize: '0.8em', color: 'var(--dsw-specific-danger,#e06c75)', flex: 'none',
      fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: 700,
    })
    // 苹果式三段（标题独占一行，简介独享剩余，页脚沉底）：
    // 徽标已删（预制/自建改看边框颜色），标题再也不跟任何人抢宽。
    // meta 必须 flex:1 撑满卡高（卡高由网格定死）：简介 flex:1+minHeight:0 在内收缩、
    // 超长由底边硬裁；页脚 flex:none 永远有位。之前 meta 是 flex:none（内容多高撑多高），
    // 简介根本不收缩、卡 overflow:hidden 从底边裁，页脚排最后被第一个裁掉——复制键+红数字消失。
    const remoteCardMeta: any = {
      display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '0.25rem',
      flex: '1 1 auto', minHeight: 0, minWidth: '0',
    }
    // 悬浮页脚（用户拍板：用量数字紧贴复制键，两者合一压简介右下，内容允许重叠——
    // 简介多看几行；胶囊自带实色底，被压住的字只亏右下一小块，键永远可点）。
    const remoteCardFoot: any = {
      position: 'absolute', right: '0.5rem', bottom: '0.5rem', zIndex: 1,
      display: 'flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.2rem 0.2rem 0.2rem 0.5rem', borderRadius: 999, border: remoteThin,
      background: 'var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-layer-3))',
      whiteSpace: 'nowrap',
    }
    // 卡片动作键（2026-09-29 用户拍板：图标换成文字键——“编辑/复制”明示比✎好认；
    // 细边框胶囊 + 次级灰字，不抢戏；字形跟字号档，空白用 rem 固定不跟比放大）。
    // 自建=编辑进编辑页，预制只读故=复制为自建；点动作只办事不插入（handleEdit/handleCopy 内已 stopPropagation）。
    const remoteCardAct: any = {
      flex: 'none', alignSelf: 'center', padding: '0.15rem 0.5rem',
      minHeight: '1.6rem',
      borderRadius: 999, border: '0.07em solid var(--dsw-alias-border-l2)',
      background: 'transparent',
      color: muted, cursor: 'pointer', fontSize: '0.78em', fontWeight: 600, lineHeight: 1.4,
      whiteSpace: 'nowrap',
    }
    const remoteEmptyStyle: any = {
      minWidth: '0', minHeight: '0',
      border: 'thin dashed var(--dsw-alias-border-l2)', borderRadius: '0.75em',
      background: 'transparent',
    }
    const remoteSearchRowStyle: any = {
      display: 'flex', gap: '0.5rem', padding: '0 0.5rem 0.5rem', flex: 'none',
    }
    const remoteSearchInputStyle: any = {
      flex: '1 1 auto', minWidth: '0',
      padding: '0.5rem 0.6rem', borderRadius: '0.6em', border: remoteThin,
      background: 'var(--dsw-alias-bg-layer-3)', color: base,
      fontFamily: 'var(--dsw-font-family)', fontSize: '1em', outline: 'none',
    }
    const remoteBarStyle: any = {
      display: 'flex', flexDirection: 'row', gap: '0.5rem', alignItems: 'stretch',
      padding: '0.5rem', borderTop: remoteThin,
      flex: 'none', flexWrap: 'nowrap', overflowX: 'auto', minWidth: '0',
    }
    // 底栏必须单行：#132 去标签后动作组直接左起单行不换行；
    // 动作键高度靠 stretch 齐平，宽度 em 适中、随档位放大缩小。
    const remoteActionsStyle: any = {
      display: 'flex', gap: '0.5rem', alignItems: 'stretch',
      flex: 'none', alignSelf: 'stretch',
    }
    const remoteBtnStyle = (enabledBtn: boolean): any => ({
      flex: 'none', alignSelf: 'stretch', minWidth: '2.8em',
      // 图标键：宽高全走 em，随档位放大缩小；高度靠 stretch 与底栏齐平。
      padding: '0 0.6em', borderRadius: '0.6em', border: remoteThin,
      background: enabledBtn ? 'var(--dsw-alias-bg-layer-3)' : 'transparent',
      color: enabledBtn ? base : dim,
      cursor: enabledBtn ? 'pointer' : 'default',
      opacity: enabledBtn ? 1 : 0.45,
      fontFamily: 'var(--dsw-font-family)', fontSize: '1em', fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      whiteSpace: 'nowrap', overflow: 'hidden',
    })
    // #132 标签区已删：底栏不再有弹性标签区，动作组直接左起单行；新增键防裁字单独覆写宽度。
    const remoteAddStyle: any = {
      ...remoteBtnStyle(true),
      minWidth: '4.2em', padding: '0 0.8em',
      border: '0.07em solid var(--dsw-specific-accent,#f0a45c)',
      color: 'var(--dsw-specific-accent,#f0a45c)', fontWeight: 800,
    }
    const remoteNoteStyle: any = {
      flex: 'none', padding: '0 0.75em 0.6em',
      fontSize: '0.85em', color: dim, whiteSpace: 'nowrap',
      overflow: 'hidden', textOverflow: 'ellipsis',
    }
    const remoteHover = compact
      ? { onMouseEnter: () => cancelPanelClose(), onMouseLeave: () => { if (modal || remoteSearchFocused || remoteComposing) return; schedulePanelClose(150) } }
      : null
    const remoteSlots = remoteView.slots.map((s) => {
      if (s.kind === 'empty') {
        return h('div', { key: 'empty-' + s.order, style: remoteEmptyStyle, 'data-dsh-prompt-remote-empty': '1', 'aria-hidden': 'true' })
      }
      const tpl = remoteById.get(s.id)
      if (!tpl) return h('div', { key: 'empty-' + s.order, style: remoteEmptyStyle, 'data-dsh-prompt-remote-empty': '1', 'aria-hidden': 'true' })
      // 简介取正文全文（空白压成单空格），卡内自然流排、底边硬裁——全面展示，高度不跳。
      const intro = (tpl.body || '').split(/\s+/).filter((x) => !!x).join(' ')
      const usageN = remoteUsage[tpl.id] || 0
      const pinned = isPinned(tpl.id)
      const custom = !tpl.builtin
      // 悬停/按压视觉反馈（复用 #88 行语义：hover 高亮、pressed 加深+微缩；触屏长按即保持 pressed）。
      const cardHover = hoverId === tpl.id
      const cardPressed = pressedId === tpl.id
      const cardInteract = {
        onMouseEnter: () => hoverState[1](tpl.id),
        onMouseLeave: () => { hoverState[1](null); pressedState[1]((cur: string | null) => (cur === tpl.id ? null : cur)) },
        onMouseDown: (e: any) => { keepComposerFocus(e); pressedState[1](tpl.id) },
        onMouseUp: () => pressedState[1](null),
        onPointerDown: () => pressedState[1](tpl.id),
        onPointerUp: () => pressedState[1](null),
        onPointerCancel: () => pressedState[1](null),
        onFocus: () => hoverState[1](tpl.id),
        onBlur: () => hoverState[1](null),
      }
      // 外层用 div[role=button] 而不用 button：复制/编辑是真 button，button 套 button 非法，
      // 且部分宿主 webview 对 button 做 flex  computed 会吞掉页脚（复制键+用量数字凭空消失）。
      return h('div', {
        key: tpl.id, style: remoteCardStyle(custom, pinned, cardHover, cardPressed),
        role: 'button', tabIndex: 0,
        'data-dsh-prompt-remote-card': '1', 'data-dsh-prompt-id': tpl.id,
        title: labelString(tpl),
        onClick: () => { pressedState[1](null); handlePick(tpl) },
        onKeyDown: (e: any) => {
          try {
            if (e && (e.key === 'Enter' || e.key === ' ')) {
              if (typeof e.preventDefault === 'function') e.preventDefault()
              pressedState[1](null); handlePick(tpl)
            }
          } catch (err) { /* ignore */ }
        },
        ...cardInteract,
      }, [
        h('span', { style: remoteCardMeta }, [
          h('span', { style: { ...remoteCardTitle, flex: 'none', minWidth: 0 } }, tpl.name),
          h('span', { style: remoteCardIntro }, intro),
        ]),
        h('span', { style: remoteCardFoot }, [
          h('span', { style: remoteCardUse(pinned), 'data-dsh-prompt-remote-use': '1' }, String(usageN) + (pinned ? ' ★' : '')),
          h('button', {
            type: 'button', style: { ...remoteCardAct, border: '0', background: 'transparent' },
            title: custom ? t('edit') : t('copy'),
            'aria-label': custom ? t('edit') : t('copy'),
            'data-dsh-prompt-remote-act': custom ? 'edit' : 'copy',
            onMouseDown: keepComposerFocus,
            onClick: (e: any) => { if (custom) handleEdit(e, tpl); else handleCopy(e, tpl.id) },
          }, custom ? t('edit') : t('copy')),
        ]),
      ])
    })
    // #132 标签节点已删（过滤只走搜索框）。
    const remoteSearchToggle = (): void => {
      const next = !remoteSearchOpen
      remoteSearchState[1](next)
      if (!next) {
        remoteQState[1]('')
        remotePageState[1](0)
      }
      refresh()
    }
    return h('div', {
      ref: rootRef, style: remotePanelStyle, ...remoteHover,
      'data-dsh-prompt-remote-panel': '1',
      'data-dsh-prompt-remote-orient': remoteView.orientation,
      'data-dsh-prompt-remote-size': String((remotePrefs as any).size),
      'data-dsh-prompt-remote-orientation-pref': String(remotePref),
    }, [
      useInput ? h(DraftTap, { key: 'dsh-prompt-draft-tap', useInput }) : null,
      // 头栏已删（2026-09-29 用户拍板：不要标题栏），面板顶边即网格。
      h('div', { style: remoteGridStyle, 'data-dsh-prompt-remote-grid': '1' }, remoteSlots),
      remoteSearchOpen ? h('div', { style: remoteSearchRowStyle }, [
        h('input', {
          style: remoteSearchInputStyle, placeholder: t('searchPh'), value: remoteQ,
          'data-dsh-prompt-remote-search-input': '1',
          onChange: (e: any) => { remoteQState[1](e.target.value); remotePageState[1](0); refresh() },
          onFocus: () => { remoteFocusState[1](true); if (compact) setHoverCloseSuppressed(true) },
          onBlur: () => { remoteFocusState[1](false); if (compact && !remoteComposing && !modal) setHoverCloseSuppressed(false) },
          onCompositionStart: () => { remoteCompState[1](true); if (compact) setHoverCloseSuppressed(true) },
          onCompositionEnd: (e: any) => {
            remoteCompState[1](false)
            try { const v = e && e.target && typeof e.target.value === 'string' ? e.target.value : null; if (v !== null) { remoteQState[1](v); remotePageState[1](0) } } catch (err) { /* ignore */ }
            if (compact && !modal && !remoteSearchFocused) setHoverCloseSuppressed(false)
          },
        }),
      ]) : null,
      h('div', { style: remoteBarStyle }, [
        h('div', { style: remoteActionsStyle }, [
          h('button', {
            key: 'remote-add', style: remoteAddStyle,
            'data-dsh-prompt-remote-add': '1',
            // #141：文本位铬（＋ 走词表；en 下是半角 '+'）；title/aria 是 add（已本地化）
            'data-dsh-prompt-chrome': 'plusGlyph',
            title: t('add'),
            'aria-label': t('add'),
            onMouseDown: keepComposerFocus,
            onClick: () => { modalState[1]({ kind: 'add' }) },
          }, t('plusGlyph') + ' ' + t('addShort')),
          h('button', {
            key: 'remote-search', style: remoteBtnStyle(true),
            'data-dsh-prompt-remote-search': '1',
            'aria-pressed': remoteSearchOpen ? 'true' : 'false',
            title: t('searchPh'),
            'aria-label': t('searchPh'),
            onMouseDown: keepComposerFocus,
            onClick: remoteSearchToggle,
          }, h('svg', {
            width: '1.25em', height: '1.25em', viewBox: '0 0 24 24', fill: 'none',
            stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round',
            'aria-hidden': 'true', style: { flex: 'none', display: 'block' },
          }, [
            h('circle', { key: 'c', cx: 11, cy: 11, r: 6 }),
            h('line', { key: 'l', x1: 15.5, y1: 15.5, x2: 20, y2: 20 }),
          ])),
          // 翻页一对相邻（2026-09-29 用户拍板：上一页紧贴下一页左侧），纯图标键、单行不换行。
          h('button', {
            key: 'remote-prev', style: remoteBtnStyle(remoteView.bottomBar.hasPrev),
            disabled: !remoteView.bottomBar.hasPrev,
            'data-dsh-prompt-remote-prev': '1',
            // #141：铬钩子（键名与值先定死，138 门禁扫这一面）；翻页文案与全屏挑选器同键 pickerPrev
            'data-dsh-prompt-chrome': 'pickerPrev',
            'data-dsh-prompt-chrome-kind': 'title aria-label',
            title: t('pickerPrev'),
            'aria-label': t('pickerPrev'),
            onMouseDown: keepComposerFocus,
            onClick: () => { if (remoteView.bottomBar.hasPrev) { remotePageState[1](remoteView.page - 1); refresh() } },
          }, h('svg', {
            width: '1.25em', height: '1.25em', viewBox: '0 0 24 24', fill: 'currentColor',
            'aria-hidden': 'true', style: { flex: 'none', display: 'block' },
          }, [
            h('polygon', { key: 'p', points: '16,4 6,12 16,20' }),
          ])),
          h('button', {
            key: 'remote-next', style: remoteBtnStyle(remoteView.bottomBar.hasNext),
            disabled: !remoteView.bottomBar.hasNext,
            'data-dsh-prompt-remote-next': '1',
            'data-dsh-prompt-chrome': 'pickerNext',
            'data-dsh-prompt-chrome-kind': 'title aria-label',
            title: t('pickerNext'),
            'aria-label': t('pickerNext'),
            onMouseDown: keepComposerFocus,
            onClick: () => { if (remoteView.bottomBar.hasNext) { remotePageState[1](remoteView.page + 1); refresh() } },
          }, h('svg', {
            width: '1.25em', height: '1.25em', viewBox: '0 0 24 24', fill: 'currentColor',
            'aria-hidden': 'true', style: { flex: 'none', display: 'block' },
          }, [
            h('polygon', { key: 'p', points: '8,4 18,12 8,20' }),
          ])),
          h('span', { key: 'remote-page', style: { ...remoteMetaStyle, alignSelf: 'center', flex: 'none' }, 'data-dsh-prompt-remote-page': '1' }, remoteView.bottomBar.pageText),
          h('button', {
            key: 'remote-close', style: { ...remoteCloseStyle, alignSelf: 'center' }, title: t('close'),
            'data-dsh-prompt-remote-close': '1',
            onMouseDown: keepComposerFocus,
            onClick: () => setPanelOpen(false),
          }, '×'),
        ]),
      ]),
      modalNode,
    ])
  }
  // REMOTE-BIG-LIST-END

  // ── 组装 ──
  // #70 P6a 整行单选互斥（悬浮/设置共用同一顶部）：[全部][预制][自定义]+行动词同行，所有 pill 同属 selected 单选互斥；
  // 点已选项回 null（toggle）；点他项直接切换（天然清他维，不存在叠加）。
  // #141：范围三钮走词表（tabAll/scopePreset/tabCustom）+ 铬钩子，另带 data-dsh-prompt-scope 报出口径身份；
  // 行动词为**用户词原文**（沿用 #70 维度纯净约定）——它不经过任何别名归一，'全部'/'预制' 这类词
  // 点了就是 matchLabel('全部')，不会变成「不过滤/仅内置」（#141 硬约束：过滤语义逐字不动）。
  const cloudNodes = h('div', { style: cloudRowStyle }, [
    h('button', {
      key: 'scope-all', style: cloudBtn(isNoFilter(selected)),
      'data-dsh-prompt-scope': SCOPE_ALL, 'data-dsh-prompt-chrome': 'tabAll',
      onClick: () => { selectedState[1](toggleScope(selected, SCOPE_ALL)); refresh() },
    }, t('tabAll')),
    h('button', {
      key: 'scope-preset', style: cloudBtn(selectionActive(selected, SCOPE_PRESET)),
      'data-dsh-prompt-scope': SCOPE_PRESET, 'data-dsh-prompt-chrome': 'scopePreset',
      onClick: () => { selectedState[1](toggleScope(selected, SCOPE_PRESET)); refresh() },
    }, t('scopePreset')),
    h('button', {
      key: 'scope-custom', style: cloudBtn(selectionActive(selected, SCOPE_CUSTOM)),
      'data-dsh-prompt-scope': SCOPE_CUSTOM, 'data-dsh-prompt-chrome': 'tabCustom',
      onClick: () => { selectedState[1](toggleScope(selected, SCOPE_CUSTOM)); refresh() },
    }, t('tabCustom')),
    ...actionCloudLabels().map((c) =>
      h('button', { key: c, style: cloudBtn(wordActive(selected, c)), onClick: () => { selectedState[1](toggleWord(selected, c)); refresh() } }, c),
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
    // #88 三态优先级：pressed（按下/长按统一）> hover（含键盘进焦）> 复制高亮；常态 transparent。
    const isPressed = pressedId === x.id
    const isHover = hoverId === x.id
    const itemBg = isPressed ? ROW_PRESSED_BG : isHover ? ROW_HOVER_BG : highlightId === x.id ? ROW_HOVER_BG : undefined
    const itemOutline = isPressed ? '1px solid var(--dsw-alias-border-l1)' : undefined
    // 简介 = body 首行（一句话），标题之后跟随 —— 单行显示
    const intro = (x.body || '').split('\n')[0].trim()
    // #71 行内用量徽标：读 store 现有缓存（排序语义不动，只读展示）
    const usageN = (loadUsage()[x.id] || 0)
    // #141：用量 title 走词表（{n} 占位；与 remoteEffectiveNow 同法）
    const usageTitle = t('usageTitle').replace('{n}', String(usageN))
    const usageStyle: any = { flex: 'none', fontSize: '0.75em', color: 'var(--dsw-alias-label-tertiary)', minWidth: '4ch', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"', whiteSpace: 'nowrap' }
    // 紧凑（⚡Prompt 浮层）：单行 —— 图钉 + 标题 + 简介 + 操作横排，不再占两行
    if (compact) {
      // #61 保焦（宿主 input.left 自家按钮同款 keepFocus）：mousedown 默认行为会把焦点从
      // 作曲家抢走；preventDefault 只拦焦点转移，click 照常触发；焦点已在面板搜索框/编辑器内
      // 时不抢（见 keepComposerFocus）；键盘操作无 mousedown，不受影响。
      // #88：保焦与 pressed 合一（先保焦再置 pressed）；hover/pressed 经 Pointer+Mouse 双轨统一，长按即保持 pressed，不另起计时器。
      const rowInteract = {
        onMouseEnter: () => hoverState[1](x.id),
        onMouseLeave: () => { hoverState[1](null); pressedState[1]((cur: string | null) => (cur === x.id ? null : cur)) },
        onMouseDown: (e: any) => { keepComposerFocus(e); pressedState[1](x.id) },
        onMouseUp: () => pressedState[1](null),
        onPointerDown: () => pressedState[1](x.id),
        onPointerUp: () => pressedState[1](null),
        onPointerCancel: () => pressedState[1](null),
        onFocus: () => hoverState[1](x.id),
        onBlur: () => hoverState[1](null),
      }
      return h('div', { key: x.id, style: { ...itemStyle, background: itemBg, outline: itemOutline, minWidth: 0 }, 'data-dsh-prompt-id': x.id, 'data-dsh-prompt-chrome': 'insertHint', 'data-dsh-prompt-chrome-kind': 'title', ...rowInteract, onClick: () => handlePick(x), title: labelString(x) + ' · ' + t('insertHint') }, [
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
        h('span', { style: usageStyle, 'data-dsh-prompt-chrome': 'usageTitle', 'data-dsh-prompt-chrome-kind': 'title', title: usageTitle }, String(usageN)),
      ])
    }
    // 设置页（纯管理面，#61）：行点击不做任何插入动作 —— #74 折叠除外：
    // 点击行只切换同一行简介显隐，不涨用量、不触发插入、不关窗；
    // 管理仍只走行内图钉/编辑/删除/复制按钮（其 onClick 已 stopPropagation，故不触发折叠）。
    // #74 行默认折叠：简介节点不渲染，单行只显示图钉 + 用量徽标 + 名称 + 标签 + 操作。
    // #141：折叠提示走词表；' · ' 分隔符留在调用方（数据词在前、铬在后，title 是二者拼接的属性位）
    return h('div', { key: x.id, style: { ...itemStyle, cursor: 'pointer', background: itemBg }, 'data-dsh-prompt-id': x.id, 'data-dsh-prompt-chrome': 'rowExpandHint', 'data-dsh-prompt-chrome-kind': 'title', title: labelString(x) + ' · ' + t('rowExpandHint'), 'aria-expanded': expanded.has(x.id) ? 'true' : 'false', onClick: () => toggleExpanded(x.id) }, [
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
          h('span', { style: { flex: 'none', fontSize: '0.75em', color: dim, width: '1.2em', textAlign: 'center', lineHeight: 1 }, 'aria-hidden': 'true' }, expanded.has(x.id) ? '▾' : '▸'),
          h('span', { style: nmStyle }, x.name),
          h('span', { style: tagStyle }, labelString(x)),
        ]),
        expanded.has(x.id) ? h('span', { style: subStyle }, (x.body || '').slice(0, 44) + '…') : null,
      ]),
      h('div', { style: { flex: 'none', display: 'flex', alignItems: 'center', gap: 4, paddingTop: 2 } }, [acts]),
      // #71 用量徽标（设置页）：行最右（操作按钮之后、最末尾）；paddingTop 与图钉一致，与标题首行对齐，样式不变
      h('span', { style: { ...usageStyle, paddingTop: 2 }, 'data-dsh-prompt-chrome': 'usageTitle', 'data-dsh-prompt-chrome-kind': 'title', title: usageTitle }, String(usageN)),
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
        h('button', { style: addBtn, 'data-dsh-prompt-chrome': 'plusGlyph', title: t('add'), onClick: () => modalState[1]({ kind: 'add' }) }, t('plusGlyph')),
        h('button', { style: closeBtn, title: t('close'), onClick: () => setPanelOpen(false) }, '×'),
      ]),
    ]) : h('div', {
      // #77：可折叠时整行就是开关（cursor / aria-expanded / title / role 四条可点线索齐）；
      // 折叠状态只在组件局部 useState 里，不进 store、不落 localStorage。
      // 收起态**不留底部分隔线**：下面什么都没有，一条孤线会让这一行看着像被截断的卡片。
      style: collapsible
        ? { ...headStyle, cursor: 'pointer', borderBottom: showList ? line : 'none' }
        : headStyle,
      ...(collapsible ? {
        role: 'button',
        tabIndex: 0,
        'aria-expanded': showList ? 'true' : 'false',
        title: t('templatesToggleHint'),
        'data-dsh-prompt-templates-toggle': '',
        onClick: () => listOpenState[1](!listOpen),
        onKeyDown: (e: any) => {
          if (!e) return
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            if (typeof e.preventDefault === 'function') e.preventDefault()
            listOpenState[1](!listOpen)
          }
        },
      } : null),
    }, [
      h(PromptMark, { size: 15 }),
      h('span', { style: titleStyle }, t('panelTitle')),
      // 收起态这一行就是全部信息：预制 / 自定义条数（与悬浮面板头行同式同键）。
      h('span', { style: { fontSize: '0.85em', color: dim, marginLeft: 6 } }, t('presetCount') + ' ' + presetCount + ' · ' + t('customCount') + ' ' + customCount),
      h('div', { style: { flex: 1 } }),
      h('button', {
        // #116跟进：背景跟着字走——padding/圆角全 em 化（1x 下与旧 12px/7px 视觉一致：0.93em≈12px、0.54em≈7px，均按按钮自身 0.92em 锚算）。
        // 高档挤压防换行：nowrap 锁单行（'＋ 新增'中间空格可断行是祸根）＋flex:none 不参与头行收缩（内容多宽就多宽，绝不被压窄）。
        style: { ...addBtn, width: 'auto', padding: '0 0.93em', borderRadius: '0.54em', fontSize: '0.92em', whiteSpace: 'nowrap', flex: 'none' },
        // #141：文本位铬（＋ 走词表）；title 是 add（已本地化）
        'data-dsh-prompt-chrome': 'plusGlyph', title: t('add'),
        // 收起态也留着「新增」：点它只开新增弹窗，**不**顺手把列表展开（stopPropagation）。
        onClick: (e: any) => {
          if (e && typeof e.stopPropagation === 'function') e.stopPropagation()
          modalState[1]({ kind: 'add' })
        },
      }, t('plusGlyph') + ' ' + t('addShort')),
      // 展开箭头放在**整行最右**（卡片级 disclosure 的常规位置）：它不再夹在摘要与按钮之间，
      // 而是与右上角那枚 ✕ / 图标同一列逻辑 —— 一眼看出「这张卡可以展开」。
      collapsible
        ? h('span', {
          key: 'caret', 'aria-hidden': 'true',
          style: {
            fontSize: '1em', color: dim, marginLeft: 8, flex: 'none', display: 'inline-block',
            transform: showList ? 'rotate(90deg)' : 'none',
          },
        }, '›')
        : null,
    ]),
    showList ? cloudNodes : null,
    showList ? h('input', {
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
    }) : null,
    showList ? listNode : null,
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
