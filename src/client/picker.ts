/**
 * dsh-prompt — 全屏挑选器本体（#104 MAP，视觉以 #108 v7 定稿为准，语义以 #111 为准）
 *
 * 定稿 v7 = C 手风琴 + 标题全显换行第一优先 + 时间尾随 + 徽标行内 + 一级卡只留名与计数
 * + 自适应抽屉（内容定高、上限 88% 内滚、禁大片空白）。
 * #115（用户 2026-10-05 拍板，architect 版）：近全屏内缩面板（内容定高、天花板近满屏）
 * + 竖屏会话在上、tab 条中、底部操作栏［工‹｜会‹｜会›｜工›］…［×］（层色边框＋点击脉冲）
 * + 真分页纯模型（pager.ts）+ × 跟字号放大；#124 横竖统一（rail 退役）；整体压紧多装。
 * 状态机（#107 Q1/#111）：关闭→探测→加载→就绪/空/失败→切换中→关闭或留屏；
 * 成功才关，其余留屏；失败不自动关；取消只取消等待。
 * 约束：不进持久化、不记新日志、不读写草稿（沿 #111）。
 */
import { getReact, keepComposerFocus, MODAL_Z } from './panel'
import { remoteSizeScale } from './remoteView'
import { pageCount, clampPage, pageOf, perPageFromMeasure, PAGER_DEFAULT_PER_PAGE } from './pager'
import { getLang, tr, STR } from './i18n'
import {
  enumerateWorkspaceSessions,
  filterWorkspaceSessions,
  groupWorkspaceSessions,
  relativeWorkspaceTime,
  absoluteWorkspaceTime,
  switchWorkspaceSession,
  tailSegment,
  workspaceColor,
  workspaceShortCode,
  type WorkspaceFaces,
  type WorkspaceGroup,
  type WorkspaceSession,
} from './workspace'

/** 加载条动画（v7 loadbar 有 1s 无限 slide；inline style 写不出 keyframes，走自家 style 注入惯例） */
const PICKER_ANIM_STYLE_ID = 'dsh-prompt-picker-anim'
const PICKER_ANIM_CSS = [
  '@keyframes dsh-prompt-picker-slide { from { margin-left: -40%; } to { margin-left: 100%; } }',
  '.dsh-prompt-picker-load-i { height: 100%; width: 40%; border-radius: 99px; background: var(--dsw-specific-accent,#f0a45c); animation: dsh-prompt-picker-slide 1s infinite linear; }',
  // #115 操作栏层暗示：点哪层、哪层脉冲（字形 span 重挂载触发一次，无定时器、不丢焦点）。
  '@keyframes dsh-prompt-pager-pulse { 0% { transform: scale(1); } 35% { transform: scale(1.25); } 100% { transform: scale(1); } }',
].join('\n')
let pickerAnimReady = false
function ensurePickerAnimStyle(): void {
  if (pickerAnimReady) return
  try {
    const doc: any = (globalThis as any).document
    if (!doc || !doc.head || typeof doc.createElement !== 'function') return
    const sel = 'style[data-dsh-prompt-style="' + PICKER_ANIM_STYLE_ID + '"]'
    if (typeof doc.querySelector === 'function' && doc.querySelector(sel)) {
      pickerAnimReady = true
      return
    }
    const tag = doc.createElement('style')
    tag.setAttribute('data-dsh-prompt-style', PICKER_ANIM_STYLE_ID)
    tag.textContent = PICKER_ANIM_CSS
    doc.head.appendChild(tag)
    pickerAnimReady = true
  } catch (e) { /* ignore */ }
}

export interface PickerProps {
  faces: WorkspaceFaces
  /** 当前会话 id（已在行点了直接关，不重切） */
  currentId?: string
  /** 远程大小档 1–10（只做 em 相对缩放，不写 px 常量） */
  remoteSize?: number
  /**
   * 宽布局（#124 起仅决定会话网格 3 列还是 2 列，布局横竖同一套）。
   * 缺席时按打开瞬间视口宽高比自判（宽>高即宽），测试可显式钉死。
   */
  wide?: boolean
  /** 关闭（switchedId 有值 = 切换成功并切到该会话；无值 = 原地关闭/取消） */
  onClose: (switchedId?: string) => void
}

type Phase = 'probing' | 'loading' | 'ready' | 'empty' | 'failed' | 'switching'

/** 会话卡片（v7 行内徽标 + 标题全显 + 时间尾随 + 元信息行按需渲染） */
function SessionCard(props: {
  h: any
  s: WorkspaceSession
  lang: 'zh' | 'en'
  ungroupedName: string
  fallbackShort: string
  current: boolean
  failed: boolean
  withShort: boolean
  onPick: (id: string) => void
}): any {
  const { h, s, lang, ungroupedName, fallbackShort, current, failed, withShort, onPick } = props
  const trail = relativeWorkspaceTime(s.updatedAt, undefined, lang)
  const abs = absoluteWorkspaceTime(s.updatedAt)
  // 展示名：登记缺席的未归属行用双语展示名回填（搜“未归属”可达、tooltip 不悬空，审查 #10）。
  const displayName = (s.workspaceName || '') !== '' ? s.workspaceName : ungroupedName
  const badges: any[] = []
  if (s.blank) {
    badges.push(h('span', {
      key: 'blank',
      style: {
        display: 'inline-block', verticalAlign: 'middle', margin: '0 0.55em 0 0',
        fontSize: '0.72em', fontWeight: 700, borderRadius: 999, padding: '1px 8px', lineHeight: 1.6,
        border: '1px solid var(--dsw-specific-accent,#f0a45c)',
        color: 'var(--dsw-specific-accent,#f0a45c)', whiteSpace: 'nowrap',
      },
      'data-dsh-prompt-picker-badge-blank': '1',
    }, tr(lang, STR.pickerBlank)))
  }
  if (current) {
    badges.push(h('span', {
      key: 'cur',
      style: {
        display: 'inline-block', verticalAlign: 'middle', margin: '0 0.55em 0 0',
        fontSize: '0.72em', fontWeight: 700, borderRadius: 999, padding: '1px 8px', lineHeight: 1.6,
        background: '#7fd08a', border: '1px solid #7fd08a', color: '#0e1016', whiteSpace: 'nowrap',
      },
      'data-dsh-prompt-picker-badge-cur': '1',
    }, tr(lang, STR.pickerCurrent)))
  }
  if (failed) {
    badges.push(h('span', {
      key: 'fail',
      style: {
        display: 'inline-block', verticalAlign: 'middle', margin: '0 0.55em 0 0',
        fontSize: '0.72em', fontWeight: 700, borderRadius: 999, padding: '1px 8px', lineHeight: 1.6,
        border: '1px solid var(--dsw-specific-danger,#e06c75)',
        color: 'var(--dsw-specific-danger,#e06c75)', whiteSpace: 'nowrap',
      },
      'data-dsh-prompt-picker-badge-fail': '1',
    }, tr(lang, STR.pickerSwitchFailBadge)))
  }
  // 元信息行：色点 + 短码（展平态）+ 冲突尾段芯片；无则整行不渲染（v7 省空间）。
  // 色点是 v7 第一寻路通道（审查 #3 补回）；短码取归属末段前 4 字（审查 #8 数据驱动版）。
  const meta: any[] = []
  if (withShort) {
    meta.push(h('span', {
      key: 'dot',
      'data-dsh-prompt-picker-dot': '1',
      style: {
        flex: 'none', width: 10, height: 10, borderRadius: '50%',
        background: workspaceColor(s.workspaceId),
      },
    }))
    const short = s.workspaceId
      ? (workspaceShortCode(s.workspaceName, s.workspaceId) || fallbackShort)
      : fallbackShort
    meta.push(h('span', {
      key: 'short',
      style: {
        flex: 'none', fontSize: '0.75em', color: 'var(--dsw-alias-label-tertiary)',
        background: 'var(--dsw-alias-bg-layer-3)', border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 6, padding: '1px 6px', whiteSpace: 'nowrap',
      },
    }, short))
  }
  if (s.collision && s.cwd) {
    meta.push(h('span', {
      key: 'tail',
      title: s.cwd,
      style: {
        flex: 'none', fontSize: '0.72em', color: 'var(--dsw-alias-label-tertiary)',
        background: 'var(--dsw-alias-bg-layer-3)', border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 6, padding: '1px 6px', maxWidth: 130,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      },
      'data-dsh-prompt-picker-tail': '1',
    }, '…' + tailSegment(s.cwd)))
  }
  return h('button', {
    type: 'button',
    title: s.title + '\n' + abs + '\n' + displayName + (s.cwd ? ' · ' + s.cwd : ''),
    'data-dsh-prompt-picker-row': s.id,
    'aria-current': current ? 'true' : undefined,
    onMouseDown: keepComposerFocus,
    onClick: () => onPick(s.id),
    style: {
      // 卡片形（用户 2026-10-03 拍板：偏长方形/正方形、方便点）：块级卡 + 最小高 + 纵向排布，
      // 网格里同行等高（grid 默认 stretch），点面从单行条变成整块卡。
      display: 'flex', flexDirection: 'column', alignItems: 'stretch',
      width: '100%', minHeight: '4.5em', textAlign: 'left', cursor: 'pointer',
      // 当前行信号只用边框 + 内圈（原型口径；实心 tint 底系 creep，已按审查 #17 回退）。
      background: 'var(--dsw-alias-bg-layer-3)',
      border: '1px solid ' + (current ? '#7fd08a' : 'var(--dsw-alias-border-l1)'),
      boxShadow: current ? 'inset 0 0 0 1px #7fd08a' : 'none',
      color: 'var(--dsw-alias-label-primary)', borderRadius: 12,
      padding: '0.6em 0.75em', fontSize: '0.92em', minWidth: 0,
      fontFamily: 'var(--dsw-font-family)',
    },
    'data-dsh-prompt-picker-card': '1',
  }, [
    h('div', { key: 'ct', style: { fontWeight: 700, lineHeight: 1.45, wordBreak: 'break-word' } }, [
      ...badges,
      h('span', { key: 't' }, s.title === '' ? tr(lang, STR.pickerUntitled) : s.title),
      trail === '' ? null : h('span', {
        key: 'trail',
        title: abs,
        style: {
          float: 'right', fontSize: '0.82em', color: 'var(--dsw-alias-label-tertiary)',
          whiteSpace: 'nowrap', margin: '0.22em 0 0.1em 0.7em', fontVariantNumeric: 'tabular-nums',
          fontWeight: 400,
        },
        'data-dsh-prompt-picker-time': '1',
      }, [trail + ' ', h('span', { key: 'go', 'aria-hidden': 'true' }, '›')]),
      // 浮动时间尾随的 clearfix（原型 .ct::after 口径；无它换行标题会吞尾行高度）。
      h('div', { key: 'clear', style: { clear: 'both' } }),
    ]),
    meta.length === 0 ? null : h('div', {
      key: 'cm',
      style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 },
    }, meta),
  ])
}

export function WorkspacePicker(props: PickerProps): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  const lang = getLang()
  // 未归属展示名走双语表（审查 #10：搜“未归属/Ungrouped”可达、tooltip 不悬空）。
  const ungroupedName = tr(lang, STR.pickerUngrouped)
  const fallbackShort = tr(lang, STR.pickerUnassignedShort)
  const faces = props.faces
  const currentId = typeof props.currentId === 'string' ? props.currentId : ''
  const size = typeof props.remoteSize === 'number' ? props.remoteSize : 5
  // 宽布局：显式 prop 优先，否则按打开瞬间视口宽高比自判；#124 起仅决定会话网格列数
  // （横竖同一套布局，rail 已退役）。
  let wideAuto = false
  try {
    if (typeof window !== 'undefined' && window.innerWidth > window.innerHeight) wideAuto = true
  } catch (e) { wideAuto = false }
  const wide = typeof props.wide === 'boolean' ? props.wide : wideAuto
  // 会话卡片网格列数（用户 2026-10-03 拍板：竖屏 2 列、横屏 3 列；#124 横竖同一套，仅列数不同）
  const gridCols = wide ? 3 : 2
  const gridStyle: any = {
    display: 'grid',
    gridTemplateColumns: 'repeat(' + gridCols + ', minmax(0, 1fr))',
    gap: '0.4em', alignItems: 'stretch',
  }
  // #115 tab 条（architect 版 Q3b）：tab 定宽是均匀页的前提（与 pager 联动）；后人改回内容宽须重做页边界。
  const TAB_W = '9em'
  // 翻页键体：2.5em 正方形，主次小于 × 3em；常量 token 化（勿散写魔法数）。
  const PAGER_BOX = '2.5em'
  // tab 行：横向 flex，横滑；横竖同一套（#124 rail 退役）。
  const tabRowStyle: any = {
    display: 'flex', flexDirection: 'row', gap: '0.4em', alignItems: 'stretch',
  }

  ensurePickerAnimStyle()

  const phaseState = react.useState('probing' as Phase)
  const phase = phaseState[0] as Phase
  const setPhase = phaseState[1]
  const queryState = react.useState('')
  const query = queryState[0] as string
  const setQuery = queryState[1]
  const sessionsState = react.useState([] as WorkspaceSession[])
  const sessions = sessionsState[0] as WorkspaceSession[]
  const setSessions = sessionsState[1]
  const namesState = react.useState(new Map<string, string>())
  const names = namesState[0] as Map<string, string>
  const setNames = namesState[1]
  const switchingState = react.useState(null as string | null)
  const switchingId = switchingState[0] as string | null
  const setSwitchingId = switchingState[1]
  const failRowState = react.useState(null as string | null)
  const failRowId = failRowState[0] as string | null
  const setFailRowId = failRowState[1]
  const failKindState = react.useState(null as 'probe' | 'switch' | null)
  const failKind = failKindState[0] as 'probe' | 'switch' | null
  const setFailKind = failKindState[1]
  const emptyKindState = react.useState(null as 'true-none' | 'search' | null)
  const emptyKind = emptyKindState[0] as 'true-none' | 'search' | null
  const setEmptyKind = emptyKindState[1]
  const openGroupState = react.useState(null as string | null)
  const openGroup = openGroupState[0] as string | null
  const setOpenGroup = openGroupState[1]
  // #115 页态（architect 版）：页模型是纯函数（pager.ts），组件只存页号＋每页项数；
  // 量尺寸在 effect＋ResizeObserver，无 DOM（测试渲染器）时全走 fallback 默认。
  const tabPageState = react.useState(0)
  const tabPage = tabPageState[0] as number
  const setTabPage = tabPageState[1]
  const tabPerPageState = react.useState(PAGER_DEFAULT_PER_PAGE)
  const tabPerPage = tabPerPageState[0] as number
  const setTabPerPage = tabPerPageState[1]
  const ssPageState = react.useState(0)
  const ssPage = ssPageState[0] as number
  const setSsPage = ssPageState[1]
  const ssPerPageState = react.useState(PAGER_DEFAULT_PER_PAGE)
  const ssPerPage = ssPerPageState[0] as number
  const setSsPerPage = ssPerPageState[1]
  // #115 层脉冲计数：点哪层、哪层字形重挂脉冲一次（无定时器、不丢焦点）。
  const wsFlashState = react.useState(0)
  const wsFlash = wsFlashState[0] as number
  const setWsFlash = wsFlashState[1]
  const ssFlashState = react.useState(0)
  const ssFlash = ssFlashState[0] as number
  const setSsFlash = ssFlashState[1]
  const pagerRefs = react.useRef({} as any)

  // 打开即重探 + 重置搜索（#111 US13；抄 sidebarCtl 晚到模式，每次打开重探）
  react.useEffect(() => {
    let alive = true
    let loadingTimer: any = null
    setQuery('')
    setSwitchingId(null)
    setFailRowId(null)
    setFailKind(null)
    setEmptyKind(null)
    setPhase('probing')
    ;(async () => {
      try {
        const snap = await enumerateWorkspaceSessions(faces)
        if (!alive) return
        if (snap.sessions.length === 0) {
          setSessions([])
          setNames(snap.names)
          setEmptyKind('true-none')
          setPhase('empty')
          return
        }
        setSessions(snap.sessions)
        setNames(snap.names)
        try {
          // 默认展开组内最新的那一组（“最近的在手边”即分组排序规则本身；
          // 原型默认首组是演示数据巧合，此处故意不抄，见审查 #21）。
          const gs = groupWorkspaceSessions(snap.sessions, snap.names, ungroupedName)
          if (!alive) return
          if (gs.length > 0) setOpenGroup(gs[0].key)
        } catch (e) { /* ignore */ }
        // 150ms 防闪：先给 loading，可取消；到点仍在等才转就绪
        setPhase('loading')
        loadingTimer = setTimeout(() => {
          if (!alive) return
          setPhase('ready')
        }, 150)
      } catch (e) {
        if (!alive) return
        setFailKind('probe')
        setPhase('failed')
      }
    })().catch(() => {
      try { if (alive) { setFailKind('probe'); setPhase('failed') } } catch (err) { /* ignore */ }
    })
    return () => {
      alive = false
      try { if (loadingTimer !== null) clearTimeout(loadingTimer) } catch (e) { /* ignore */ }
    }
    // faces 是宿主机会面引用，打开时由 button 层重建对象 identity 变化即重探
  }, [])

  const filtered = filterWorkspaceSessions(sessions, query, ungroupedName)
  const hasQuery = query.trim() !== ''
  let groups: WorkspaceGroup[] = []
  try {
    groups = groupWorkspaceSessions(filtered, names, ungroupedName)
  } catch (e) { groups = [] }
  // #115 量尺寸＋页重算（architect 版）：ResizeObserver 守卫；无 RO/无 DOM（测试渲染器）
  // 全走 fallback 默认。页钳制防每页项数变化后的越界。放 groups 之后（deps 读 groups.length，避 TDZ）。
  react.useEffect(() => {
    let alive = true
    const fontPxOf = (el: any): number => {
      try {
        const g = (globalThis as any).getComputedStyle
        if (typeof g !== 'function' || !el) return NaN
        const v = parseFloat(g(el).fontSize)
        return isFinite(v) && v > 0 ? v : NaN
      } catch (e) { return NaN }
    }
    const recompute = (): void => {
      if (!alive) return
      try {
        const R = pagerRefs.current || {}
        const ws = R.ws
        if (ws && typeof ws.clientWidth === 'number' && ws.clientWidth > 0) {
          let tabW = NaN
          try {
            const first = ws.querySelector ? ws.querySelector('[data-dsh-prompt-picker-groupcard]') : null
            if (first && typeof first.offsetWidth === 'number' && first.offsetWidth > 0) tabW = first.offsetWidth
          } catch (e) { /* ignore */ }
          const fp = fontPxOf(ws)
          const gap = isFinite(fp) ? fp * 0.5 : 8
          const pitch = isFinite(tabW) && (tabW as number) > 0 ? (tabW as number) + gap : NaN
          if (isFinite(pitch) && (pitch as number) > 0) R.wsPitch = pitch
          const per = perPageFromMeasure(ws.clientWidth, isFinite(pitch) ? pitch : NaN, PAGER_DEFAULT_PER_PAGE)
          try { setTabPerPage(per) } catch (e) { /* ignore */ }
          try { setTabPage((p: number) => clampPage(p, groups.length, per)) } catch (e) { /* ignore */ }
        }
        const ss = R.ss
        if (ss && typeof ss.clientHeight === 'number' && ss.clientHeight > 0) {
          let cardH = NaN
          try {
            const first = ss.querySelector ? ss.querySelector('[data-dsh-prompt-picker-card]') : null
            if (first && typeof first.offsetHeight === 'number' && first.offsetHeight > 0) cardH = first.offsetHeight
          } catch (e) { /* ignore */ }
          const fp = fontPxOf(ss)
          const gap = isFinite(fp) ? fp * 0.5 : 8
          const rows = isFinite(cardH) && (cardH as number) > 0
            ? Math.max(1, Math.floor((ss.clientHeight + gap) / ((cardH as number) + gap)))
            : 2
          const per = Math.max(1, gridCols * rows)
          try { setSsPerPage(per) } catch (e) { /* ignore */ }
          const key = openGroup || (groups.length > 0 ? groups[0].key : '__none')
          const og = groups.find((g) => g.key === key) || null
          const total = hasQuery ? filtered.length : (og ? og.items.length : 0)
          try { setSsPage((p: number) => clampPage(p, total, per)) } catch (e) { /* ignore */ }
        }
      } catch (e) { /* ignore */ }
    }
    recompute()
    let ro: any = null
    try {
      const RO = (globalThis as any).ResizeObserver
      const R = pagerRefs.current || {}
      if (typeof RO === 'function' && (R.ws || R.ss)) {
        ro = new RO(() => { try { recompute() } catch (e) { /* ignore */ } })
        try { if (R.ws && typeof R.ws.clientWidth === 'number') ro.observe(R.ws) } catch (e) { /* ignore */ }
        try { if (R.ss && typeof R.ss.clientHeight === 'number') ro.observe(R.ss) } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }
    return () => {
      alive = false
      try { if (ro && typeof ro.disconnect === 'function') ro.disconnect() } catch (e) { /* ignore */ }
    }
  }, [groups.length, filtered.length, gridCols])

  // 搜索框常驻（审查 #5 的故意 diverged：原型 C 无查询时藏搜索框，但那是个演示洞——
  // 藏了就没法发起搜索，直接违反 #111 US12 文字；此处规格优先，几何仍沿原型 .search slim 形）。
  const showTrueEmpty = phase === 'empty' && emptyKind === 'true-none'

  const doPick = (id: string): void => {
    // 已在行 no-op 直接关（#111 US23）
    if (id === currentId) {
      try { props.onClose(currentId) } catch (e) { /* ignore */ }
      return
    }
    // 行内重试：失败行再点即重试同一切换
    setFailRowId(null)
    setPhase('switching')
    setSwitchingId(id)
    ;(async () => {
      try {
        await switchWorkspaceSession(faces, id)
        try { props.onClose(id) } catch (e) { /* ignore */ }
      } catch (e) {
        // 失败留屏重试，不注入错误会话（沿 #739，#111 US25–US26）
        setSwitchingId(null)
        setFailRowId(id)
        setFailKind('switch')
        setPhase('failed')
      }
    })().catch(() => {
      try {
        setSwitchingId(null)
        setFailRowId(id)
        setFailKind('switch')
        setPhase('failed')
      } catch (err) { /* ignore */ }
    })
  }

  const retryAll = (): void => {
    if (failKind === 'probe') {
      // 探测缺席整面重试：重走枚举
      setPhase('probing')
      setFailKind(null)
      setFailRowId(null)
      ;(async () => {
        try {
          const snap = await enumerateWorkspaceSessions(faces)
          setSessions(snap.sessions)
          setNames(snap.names)
          if (snap.sessions.length === 0) {
            setEmptyKind('true-none')
            setPhase('empty')
            return
          }
          try {
            const gs = groupWorkspaceSessions(snap.sessions, snap.names, ungroupedName)
            if (gs.length > 0) setOpenGroup(gs[0].key)
          } catch (e) { /* ignore */ }
          setPhase('ready')
        } catch (e) {
          setFailKind('probe')
          setPhase('failed')
        }
      })().catch(() => {
        try { setFailKind('probe'); setPhase('failed') } catch (err) { /* ignore */ }
      })
      return
    }
    // 切换失败整面重试：重试同一行
    const id = failRowId
    if (id) doPick(id)
  }

  const cancelWait = (): void => {
    // 只取消等待（loading 的 150ms 窗），不取消已发出的切换：直接关面
    try { props.onClose() } catch (e) { /* ignore */ }
  }

  const uiScale = remoteSizeScale(size)
  // 根容器定层级（审查 #1 Blocking 修复）：整块包进 MODAL_Z stacking root，
  // 与齿轮设置弹窗同层、高于 Dock（DOCK_Z），打开即盖住触控栏（#111 US3 / #113 US15）。
  // 之前 mask z10 / sheet z11 是抄原型的框内层级，在真机全局比拼中必输给 Dock——注释写同层而代码没做到。
  // #115：em 缩放锚上移到根，遮罩留边（0.5em）与面板内容同比缩放（有意偏离齿轮 vh/vw，见 #115 Q7）。
  const rootStyle: any = { position: 'fixed', inset: 0, zIndex: MODAL_Z, fontSize: 'calc(1em * ' + uiScale + ')' }
  const maskStyle: any = {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0.5em', boxSizing: 'border-box',
  }
  const sheetStyle: any = {
    // #115 近全屏内缩面板（用户 2026-10-05 拍板）：内容定高、天花板为遮罩内容区 100%
    // （≈ 视口 − 1em）；小内容矮板、大内容顶满后内栏滚动，v7「禁大片空白」保留。
    // dockReservePx 已退役：近全屏后面板恒盖住触控栏，让位无意义（且旧值收起 Dock 不收缩）。
    position: 'relative', width: '100%', height: 'auto', maxHeight: '100%',
    margin: 0,
    background: 'var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))',
    backgroundColor: 'var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))',
    borderRadius: 14, border: '1px solid var(--dsw-alias-border-l1)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    fontSize: '1em',
    fontFamily: 'var(--dsw-font-family)', color: 'var(--dsw-alias-label-primary)',
  }
  const headStyle: any = { display: 'flex', alignItems: 'center', gap: 8, padding: '0.3em 0.5em 0.05em', flex: 'none' }
  // #115 × 跟字号：3em 圆盒（1 档约 45px，比旧 40px 大一圈；10 档 5.5 倍），字形另包 1.4em。
  const xStyle: any = {
    marginLeft: 'auto', flex: 'none', width: '3em', height: '3em', minWidth: '3em', borderRadius: '50%', cursor: 'pointer',
    border: '1px solid var(--dsw-alias-border-l1)',
    background: 'var(--dsw-alias-bg-layer-3)', color: 'var(--dsw-alias-label-primary)',
    fontSize: '1em', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
  const xGlyphStyle: any = { fontSize: '1.4em', lineHeight: 1 }
  const searchStyle: any = {
    margin: '0.2em 0.4em 0', padding: '0.5em 0.75em', borderRadius: 9, minHeight: '2.5em',
    border: '1px solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-bg-layer-3)',
    color: 'var(--dsw-alias-label-primary)', fontSize: '0.9em', width: 'calc(100% - 1em)',
    flex: 'none', boxSizing: 'border-box', fontFamily: 'var(--dsw-font-family)', outline: 'none',
  }
  // #115 tab 条体（architect 版）：会话栏在上占剩余区域，会话滚区＋右下悬浮翻页；
  // 底部 tab 条（工作区横滑＋右侧方形翻页键）。悬浮无布局代价，显隐零抖动。
  const bodyStyle: any = {
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    padding: '0.25em 0.4em 0.4em', minHeight: 0, minWidth: 0, flex: '1 1 auto',
  }
  // 会话栏：相对定位祖先（悬浮翻页键锚它；overflow hidden 裁剪不出逃）。
  const ssPaneStyle: any = {
    flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column',
    overflow: 'hidden', position: 'relative',
  }
  const ssScrollStyle: any = { flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '0.1em 0.1em 0.4em' }
  // 底部 tab 条：定高行，不伸缩；标题已删（条自明，省一行高）。
  const wsPaneStyle: any = {
    flex: 'none', display: 'flex', flexDirection: 'row', alignItems: 'center',
    gap: '0.4em', marginTop: '0.35em', minHeight: 0,
  }
  const wsScrollStyle: any = {
    flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'row',
    gap: '0.4em', overflowX: 'auto', overflowY: 'hidden', padding: '0.1em',
  }
  // #115 内外层色（静态暗示）：外层工作区＝accent 橙，内层会话＝当前绿；边框即身份。
  const LAYER_WS = 'var(--dsw-specific-accent,#f0a45c)'
  const LAYER_SS = '#7fd08a'
  // 底部操作栏：整栏靠右（用户 2026-10-05 拍板），细线与内容分隔；定高行。
  const opBarStyle: any = {
    flex: 'none', display: 'flex', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '0.5em', marginTop: '0.35em', paddingTop: '0.35em',
    borderTop: '1px solid var(--dsw-alias-border-l1)',
  }
  // 翻页键：PAGER_BOX 盒＋层色边框＋层形状（工作区圆呼应色点、会话方呼应卡片；
  // 形状是主通道——压缩串流下颜色不可靠。禁用三件套（disabled＋aria＋半透明）。
  const pagerBtnStyle = (disabled: boolean, accent: string, radius: number | string): any => ({
    flex: 'none', width: PAGER_BOX, height: PAGER_BOX, minWidth: PAGER_BOX,
    borderRadius: radius, cursor: disabled ? 'not-allowed' : 'pointer',
    border: '1px solid ' + accent,
    background: 'var(--dsw-alias-bg-layer-3)', color: 'var(--dsw-alias-label-primary)',
    fontSize: '1em', display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: disabled ? 0.38 : 1,
  })
  // 脉冲字形：flash>0 才挂动画；key 带计数重挂触发一次（键本体不动，不丢焦点）。
  const pagerGlyphStyle = (flash: number): any => ({
    fontSize: '1.2em', lineHeight: 1, display: 'inline-block',
    animation: flash > 0 ? 'dsh-prompt-pager-pulse 0.35s ease-out' : undefined,
  })
  const sectionTitleStyle: any = {
    flex: 'none', fontSize: '0.78em', fontWeight: 700,
    color: 'var(--dsw-alias-label-tertiary)', letterSpacing: '0.02em',
    padding: '0.2em 0.2em 0.2em',
  }

  const renderCard = (s: WorkspaceSession, withShort: boolean): any =>
    h(SessionCard, {
      key: s.id, h, s, lang,
      ungroupedName, fallbackShort,
      current: s.id === currentId,
      failed: s.id === failRowId,
      withShort,
      onPick: doPick,
    })
  // 工作区行（#115：名 + 计数 + 色点并一行，单列；选中态 accent 边框给态感，沿审查 #3/#4）。
  // 2026-10-03「工作区列表也做成卡片式」已被 #115 取代：双网格把会话顶出可视区，
  // 单列行才是「两个列表」的形状；色条等多余形状不加（抗 creep）。
  // asTab=true 时为底部 tab 条形态：定宽 TAB_W（均匀页前提，与 pager 联动）＋ tab 语义。
  const renderWcard = (g: WorkspaceGroup, isOpen: boolean, allowCollapse: boolean, asTab?: boolean, tabIdx?: number): any =>
    h('button', {
      key: (asTab ? 'tab:' : 'head:') + g.key,
      type: 'button',
      'data-dsh-prompt-picker-group': g.key,
      role: asTab ? 'tab' : undefined,
      'aria-selected': asTab ? (isOpen ? 'true' : 'false') : undefined,
      'aria-pressed': asTab ? undefined : (isOpen ? 'true' : 'false'),
      onMouseDown: keepComposerFocus,
      onClick: () => {
        // 收起规则（v7 bind 口径，审查 #12）：竖屏允许收到全空，横屏重 sockaddr 点保持展开。
        try { setOpenGroup(allowCollapse && isOpen ? '__none' : g.key) } catch (e) { /* ignore */ }
        // 页驱动选中：tab 点后所在页滚入可见（确定性偏移，不用 scrollIntoView）。
        if (asTab && typeof tabIdx === 'number') ensureTabPage(tabIdx)
      },
      title: g.name,
      style: {
        display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8,
        width: asTab ? TAB_W : '100%', flex: asTab ? 'none' : undefined,
        minHeight: '2.6em', minWidth: 0, textAlign: 'left', cursor: 'pointer',
        background: 'var(--dsw-alias-bg-layer-3)',
        border: '1px solid ' + (isOpen ? 'var(--dsw-specific-accent,#f0a45c)' : 'var(--dsw-alias-border-l1)'),
        boxShadow: isOpen ? 'inset 0 0 0 1px var(--dsw-specific-accent,#f0a45c)' : 'none',
        color: 'var(--dsw-alias-label-primary)', borderRadius: 12,
        padding: '0.5em 0.75em', fontSize: '0.92em',
        fontFamily: 'var(--dsw-font-family)',
      },
      'data-dsh-prompt-picker-groupcard': '1',
    }, [
      // 单行：色点靠左、名占中（超长省略，title 给全名）、计数靠右胶囊。
      h('span', {
        key: 'dot',
        'data-dsh-prompt-picker-dot': '1',
        style: {
          flex: 'none', width: 10, height: 10, borderRadius: '50%',
          background: workspaceColor(g.workspaceId),
        },
      }),
      h('span', {
        key: 'nm',
        style: {
          flex: '1 1 auto', minWidth: 0, fontWeight: 700, lineHeight: 1.4,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        },
      }, g.name),
      h('span', {
        key: 'cnt',
        'data-dsh-prompt-picker-count': String(g.items.length),
        style: {
          flex: 'none', fontSize: '0.75em', color: 'var(--dsw-alias-label-tertiary)',
          background: 'var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))',
          border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 999,
          padding: '0 9px', fontWeight: 400,
        },
      }, String(g.items.length)),
    ])
  const openKey = openGroup || (groups.length > 0 ? groups[0].key : '__none')
  // #115 翻页 helpers（architect 版）：tab 项等宽→按节距精确定位；会话卡高不定→按视口翻。
  //  asymmetry 是诚实的：均匀内容用项模型，不均匀内容用视口模型（见票）。
  const wsScrollToPage = (n: number, per: number): void => {
    try {
      const R = pagerRefs.current || {}
      const el = R.ws
      if (!el || typeof el.scrollTo !== 'function') return
      const pitch = R.wsPitch
      const x = (typeof pitch === 'number' && pitch > 0)
        ? n * per * pitch
        : n * (typeof el.clientWidth === 'number' && el.clientWidth > 0 ? el.clientWidth : 0)
      try { el.scrollTo({ left: x, behavior: 'smooth' }) }
      catch (e2) { try { el.scrollTo(x, 0) } catch (e3) { try { el.scrollLeft = x } catch (e4) { /* ignore */ } } }
    } catch (e) { /* ignore */ }
  }
  const ssScrollToPage = (n: number): void => {
    try {
      const el = (pagerRefs.current || {}).ss
      if (!el || typeof el.scrollTo !== 'function') return
      const h = typeof el.clientHeight === 'number' && el.clientHeight > 0 ? el.clientHeight : 0
      const y = n * h
      try { el.scrollTo({ top: y, behavior: 'smooth' }) }
      catch (e2) { try { el.scrollTo(0, y) } catch (e3) { try { el.scrollTop = y } catch (e4) { /* ignore */ } } }
    } catch (e) { /* ignore */ }
  }
  const ssTotalOf = (): number => {
    try {
      const key = openGroup || (groups.length > 0 ? groups[0].key : '__none')
      const og = groups.find((g) => g.key === key) || null
      return og ? og.items.length : 0
    } catch (e) { return 0 }
  }
  const tabGo = (dir: 1 | -1): void => {
    const n = clampPage(tabPage + dir, groups.length, tabPerPage)
    setTabPage(n)
    try { setWsFlash((f: number) => f + 1) } catch (e) { /* ignore */ }
    wsScrollToPage(n, tabPerPage)
  }
  const ssGo = (dir: 1 | -1): void => {
    const total = ssTotalOf()
    const n = clampPage(ssPage + dir, total, ssPerPage)
    setSsPage(n)
    try { setSsFlash((f: number) => f + 1) } catch (e) { /* ignore */ }
    ssScrollToPage(n)
  }
  // 页驱动选中（不用 scrollIntoView：页号确定、偏移确定，可断言；浏览器启发式不可）。
  const ensureTabPage = (idx: number): void => {
    try {
      const n = clampPage(pageOf(idx, tabPerPage), groups.length, tabPerPage)
      setTabPage(n)
      wsScrollToPage(n, tabPerPage)
    } catch (e) { /* ignore */ }
  }
  const onWsScroll = (e: any): void => {
    try {
      const el = (e && e.target) || null
      if (!el || typeof el.scrollLeft !== 'number') return
      const cw = typeof el.clientWidth === 'number' && el.clientWidth > 0 ? el.clientWidth : 1
      const pitch = (pagerRefs.current || {}).wsPitch
      const pageW = (typeof pitch === 'number' && pitch > 0 ? tabPerPage * pitch : cw)
      const w = pageW > 0 ? pageW : 1
      setTabPage(clampPage(Math.round(el.scrollLeft / w), groups.length, tabPerPage))
    } catch (e) { /* ignore */ }
  }
  const onSsScroll = (e: any): void => {
    try {
      const el = (e && e.target) || null
      if (!el || typeof el.scrollTop !== 'number') return
      const h = typeof el.clientHeight === 'number' && el.clientHeight > 0 ? el.clientHeight : 1
      setSsPage(clampPage(Math.round(el.scrollTop / h), ssTotalOf(), ssPerPage))
    } catch (e) { /* ignore */ }
  }
  // 操作栏翻页键：kind 即内外层身份（ws 外层 / ss 内层），层形状＋层色边框＋脉冲字形三暗示。
  const pagerBtn = (kind: 'ws-prev' | 'ss-prev' | 'ss-next' | 'ws-next', layerLabel: any, dirLabel: any, disabled: boolean, accent: string, flash: number, go: () => void): any =>
    h('button', {
      key: kind, type: 'button',
      'data-dsh-prompt-picker-pager': kind,
      disabled: disabled ? true : undefined,
      'aria-disabled': disabled ? 'true' : 'false',
      'aria-label': tr(lang, layerLabel) + tr(lang, dirLabel),
      title: tr(lang, layerLabel) + tr(lang, dirLabel),
      onMouseDown: keepComposerFocus,
      onClick: () => { if (!disabled) { try { go() } catch (e) { /* ignore */ } } },
      style: pagerBtnStyle(disabled, accent, (kind === 'ws-prev' || kind === 'ws-next') ? '50%' : 9),
    }, h('span', { key: 'g' + flash, style: pagerGlyphStyle(flash), 'aria-hidden': 'true' }, (kind === 'ws-prev' || kind === 'ss-prev') ? '‹' : '›'))
  const switchingNote = phase === 'switching' && switchingId
    ? h('div', {
      key: 'switching',
      'data-dsh-prompt-picker-switching': switchingId,
      style: { fontSize: '0.78em', color: 'var(--dsw-alias-label-tertiary)', padding: '6px 0 0', flex: 'none' },
    }, tr(lang, STR.pickerSwitching) + '…')
    : null
  // 列表区（#124 横竖统一：无查询 → 会话栏在上、tab 条中、底部操作栏，两方向同一套，
  // 仅会话网格列数随宽窄变（gridCols）；有查询 → 展平成带短码的卡片网格，#111 US12）。
  // rail 左轨＋右展已退役（v7 C 横屏形随之退役，两套列表语义合一）。
  // tab 恒渲染（沿 2026-10-03 撤 US9 的结论：工作区恒显示，单列行改横 tab 后沿用）。
  // 2026-10-03 用户拍板：去掉 #111 US9「单工作区不显示组头」——那条规则把「分组整个没生效」
  // 和「确实只有一个工作区」混成同一种表现，把硬故障藏成了看不见。现在组头恒在。
  let listContent: any = null
  if (hasQuery) {
    const flat = filtered.slice().sort((a, b) => b.updatedAt - a.updatedAt)
    listContent = h('div', {
      key: 'flat', 'data-dsh-prompt-picker-flat': 'query',
      style: { display: 'flex', flexDirection: 'column', minHeight: 0, flex: '1 1 auto', overflow: 'hidden' },
    }, [
      switchingNote,
      h('div', { key: 'ssscroll', 'data-dsh-prompt-picker-ssscroll': '1', style: ssScrollStyle }, [
        h('div', { key: 'list', 'data-dsh-prompt-picker-grid': String(gridCols), style: gridStyle },
          flat.map((s) => renderCard(s, hasQuery))),
      ]),
    ])
  } else {
    // #124 统一分支（横竖同一套）：上 = 会话栏（选中组会话网格占剩余区域）＋
    // 中 = 底部 tab 条（工作区横滑）＋ 下 = 底部操作栏。未归属桶是 tab 普通一项；
    // 重开回到默认组、不记选中（沿现状 openGroup 初始化）。搜索时本分支不走（展平分支）。
    const openG = groups.find((g) => g.key === openKey) || null
    const openItems = openG ? openG.items : []
    const tabPages = pageCount(groups.length, tabPerPage)
    const tabPrevOff = tabPage <= 0
    const tabNextOff = tabPage >= tabPages - 1
    const ssPages = pageCount(openItems.length, ssPerPage)
    const ssPrevOff = ssPage <= 0
    const ssNextOff = ssPage >= ssPages - 1
    listContent = h('div', {
      key: 'acc',
      style: { display: 'flex', flexDirection: 'column', minHeight: 0, flex: '1 1 auto', overflow: 'hidden' },
    }, [
      switchingNote,
      h('div', { key: 'sspane', 'data-dsh-prompt-picker-sspane': '1', style: ssPaneStyle }, [
        h('div', { key: 'sst', 'data-dsh-prompt-picker-sstitle': '1', style: sectionTitleStyle }, tr(lang, STR.pickerSessions)),
        h('div', {
          key: 'ssscroll', 'data-dsh-prompt-picker-ssscroll': '1', style: ssScrollStyle,
          ref: (el: any) => { try { pagerRefs.current.ss = el } catch (e) { /* ignore */ } },
          onScroll: onSsScroll,
        }, [
          openG ? h('div', {
            key: 'gitems',
            'data-dsh-prompt-picker-grid': String(gridCols),
            style: gridStyle,
          }, openG.items.map((s) => renderCard(s, false))) : null,
        ]),
      ]),
      h('div', {
        key: 'wspane', 'data-dsh-prompt-picker-wspane': '1',
        role: 'tablist', 'aria-label': tr(lang, STR.pickerWorkspaces),
        style: wsPaneStyle,
      }, [
        h('div', {
          key: 'wsscroll', 'data-dsh-prompt-picker-wsscroll': '1', style: wsScrollStyle,
          ref: (el: any) => { try { pagerRefs.current.ws = el } catch (e) { /* ignore */ } },
          onScroll: onWsScroll,
        }, [
          h('div', {
            key: 'tabrow',
            'data-dsh-prompt-picker-tabrow': String(tabPerPage),
            style: tabRowStyle,
          }, groups.map((g, idx) => renderWcard(g, openKey === g.key, true, true, idx))),
        ]),
      ]),
      // 底部操作栏（用户 2026-10-05 拍板）：外层工作区 pair 在两侧、内层会话 pair 居中、
      // 关闭居右。层色边框＋点击脉冲双暗示，不用读字也知道管哪层。
      h('div', {
        key: 'opbar', 'data-dsh-prompt-picker-opbar': '1',
        role: 'toolbar', 'aria-label': tr(lang, STR.pickerOpBar),
        style: opBarStyle,
      }, [
        pagerBtn('ws-prev', STR.pickerWorkspaces, STR.pickerPrev, tabPrevOff, LAYER_WS, wsFlash, () => tabGo(-1)),
        pagerBtn('ss-prev', STR.pickerSessions, STR.pickerPrev, ssPrevOff, LAYER_SS, ssFlash, () => ssGo(-1)),
        pagerBtn('ss-next', STR.pickerSessions, STR.pickerNext, ssNextOff, LAYER_SS, ssFlash, () => ssGo(1)),
        pagerBtn('ws-next', STR.pickerWorkspaces, STR.pickerNext, tabNextOff, LAYER_WS, wsFlash, () => tabGo(1)),
        h('button', {
          key: 'opclose', type: 'button',
          'data-dsh-prompt-picker-closebar': '1',
          'aria-label': tr(lang, STR.close),
          title: tr(lang, STR.close),
          onMouseDown: keepComposerFocus,
          onClick: () => { try { props.onClose() } catch (e) { /* ignore */ } },
          style: {
            flex: 'none', width: '3em', height: '3em', minWidth: '3em',
            borderRadius: '50%', cursor: 'pointer',
            border: '1px solid var(--dsw-alias-border-l1)',
            background: 'var(--dsw-alias-bg-layer-3)', color: 'var(--dsw-alias-label-primary)',
            fontSize: '1em', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          },
        }, h('span', { key: 'ocg', style: xGlyphStyle, 'aria-hidden': 'true' }, '×')),
      ]),
    ])
  }

  const loadingBox: any = h('div', { key: 'loading', 'data-dsh-prompt-picker-loading': '1' }, [
    h('div', {
      key: 'bar',
      style: { height: 4, borderRadius: 99, background: 'var(--dsw-alias-bg-layer-3)', overflow: 'hidden', margin: '10px 12px 0', flex: 'none' },
    }, [
      h('div', { key: 'i', className: 'dsh-prompt-picker-load-i' }),
    ]),
    h('div', {
      key: 'row',
      style: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px 12px', fontSize: '0.82em', color: 'var(--dsw-alias-label-tertiary)' },
    }, [
      h('span', { key: 't' }, tr(lang, STR.pickerLoading)),
      h('button', {
        key: 'cancel', type: 'button',
        'data-dsh-prompt-picker-cancel': '1',
        onMouseDown: keepComposerFocus,
        onClick: cancelWait,
        style: {
          border: '1px solid var(--dsw-alias-border-l1)', background: 'transparent',
          color: 'var(--dsw-alias-label-tertiary)', borderRadius: 8, padding: '6px 14px',
          fontSize: '0.9em', cursor: 'pointer', minHeight: 40, fontFamily: 'var(--dsw-font-family)',
        },
      }, tr(lang, STR.pickerCancel)),
    ]),
  ])
  const emptyBox = (kind: 'true-none' | 'search'): any => h('div', {
    key: 'empty:' + kind,
    'data-dsh-prompt-picker-empty': kind,
    style: {
      margin: '6px 0 12px', padding: '8px 12px', border: '1px dashed var(--dsw-alias-border-l1)',
      borderRadius: 10, fontSize: '0.85em', color: 'var(--dsw-alias-label-tertiary)',
      display: 'flex', gap: 10, alignItems: 'center', lineHeight: 1.5,
    },
  }, kind === 'search' ? tr(lang, STR.pickerEmptySearch) : tr(lang, STR.pickerEmpty))
  const retryBox = (kind: 'probe' | 'switch'): any => h('div', {
    key: 'failed:' + kind,
    'data-dsh-prompt-picker-failed': kind,
  }, [
    h('div', {
      key: 'box',
      style: {
        margin: '6px 0 12px', padding: '8px 12px', border: '1px solid var(--dsw-specific-danger,#e06c75)',
        borderRadius: 10, fontSize: '0.85em', color: 'var(--dsw-alias-label-primary)',
        display: 'flex', gap: 10, alignItems: 'center', lineHeight: 1.5,
      },
    }, [
      h('span', { key: 'm' }, kind === 'probe' ? tr(lang, STR.pickerProbeFail) : tr(lang, STR.pickerSwitchFail)),
      h('button', {
        key: 'retry', type: 'button',
        'data-dsh-prompt-picker-retry': '1',
        onMouseDown: keepComposerFocus,
        onClick: retryAll,
        style: {
          flex: 'none', minHeight: 44, padding: '6px 18px', fontSize: '0.95em', borderRadius: 9,
          cursor: 'pointer', border: '1px solid var(--dsw-specific-accent,#f0a45c)',
          background: 'var(--dsw-specific-accent,#f0a45c)', color: '#1a1a1e', fontWeight: 700,
          fontFamily: 'var(--dsw-font-family)',
        },
      }, tr(lang, STR.pickerRetry)),
    ]),
  ])
  // 搜索无结果进空态（不回退全量，#111 US14）；切换失败留屏时列表仍在、失败行可点重试（#111 US25 行内辅重试）。
  const queryEmpty = hasQuery && filtered.length === 0
  let bodyNode: any = null
  if (phase === 'probing' || phase === 'loading') bodyNode = loadingBox
  else if (phase === 'failed' && failKind === 'probe') bodyNode = retryBox('probe')
  else if (showTrueEmpty) bodyNode = emptyBox('true-none')
  else if (queryEmpty) {
    bodyNode = phase === 'failed'
      ? h('div', { key: 'sfr' }, [retryBox('switch'), emptyBox('search')])
      : emptyBox('search')
  } else if (phase === 'failed') bodyNode = h('div', { key: 'sfl' }, [retryBox('switch'), listContent])
  else bodyNode = listContent

  return h('div', { 'data-dsh-prompt-picker-root': '1', style: rootStyle }, [
    h('div', {
      key: 'mask',
      style: maskStyle,
      'data-dsh-prompt-picker-mask': '1',
      onClick: (e: any) => { if (e.target === e.currentTarget) { try { props.onClose() } catch (err) { /* ignore */ } } },
    }),
    h('div', {
      key: 'sheet',
      role: 'dialog', 'aria-modal': 'true', 'aria-label': tr(lang, STR.workspacePicker),
      'data-dsh-prompt-picker-sheet': '1',
      style: sheetStyle,
    }, [
      h('div', { key: 'head', style: headStyle }, [
        h('h2', { key: 't', style: { margin: 0, fontSize: '0.95em', flex: 'none' } }, tr(lang, STR.workspacePicker)),
        h('button', {
          key: 'x', type: 'button',
          style: xStyle, title: tr(lang, STR.close),
          'aria-label': tr(lang, STR.close),
          'data-dsh-prompt-picker-close': '1',
          onMouseDown: keepComposerFocus,
          onClick: () => { try { props.onClose() } catch (e) { /* ignore */ } },
        }, h('span', { key: 'xg', style: xGlyphStyle, 'aria-hidden': 'true' }, '×')),
      ]),
      h('input', {
        key: 'q',
        'data-dsh-prompt-picker-search': '1',
        placeholder: tr(lang, STR.pickerSearch),
        value: query,
        onChange: (e: any) => {
          try { setQuery((e.target.value as string) || '') } catch (err) { /* ignore */ }
        },
        style: searchStyle,
      }),
      h('div', { key: 'body', style: bodyStyle }, [bodyNode]),
    ]),
  ])
}
