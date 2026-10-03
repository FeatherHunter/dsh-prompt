/**
 * dsh-prompt — 全屏挑选器本体（#104 MAP，视觉以 #108 v7 定稿为准，语义以 #111 为准）
 *
 * 定稿 v7 = C 手风琴 + 标题全显换行第一优先 + 时间尾随 + 徽标行内 + 一级卡只留名与计数
 * + 自适应抽屉（内容定高、上限 88% 内滚、禁大片空白）。
 * 状态机（#107 Q1/#111）：关闭→探测→加载→就绪/空/失败→切换中→关闭或留屏；
 * 成功才关，其余留屏；失败不自动关；取消只取消等待。
 * 约束：不进持久化、不记新日志、不读写草稿（沿 #111）。
 */
import { getReact, keepComposerFocus, MODAL_Z } from './panel'
import { remoteSizeScale } from './remoteView'
import { getLang, tr, STR } from './i18n'
import {
  enumerateWorkspaceSessions,
  filterWorkspaceSessions,
  groupWorkspaceSessions,
  isSingleWorkspace,
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
   * 宽布局（横屏 rail + 右展）。缺席时按打开瞬间视口宽高比自判（宽>高即宽），
   * 测试可显式钉死。v7 C 横屏即此形（左轨 hugging + 右展）。
   */
  wide?: boolean
  /**
   * 底部让位（px）：触控栏占位，由 button.ts 按 Dock 真实尺寸算好后传入（尺寸真值只留一处，
   * 这里不重算 Dock math）。抽屉底边抬到这条线之上，触控栏仍可见；0 = 贴底（无 Dock 场景）。
   */
  dockReservePx?: number
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
      padding: '10px 12px', fontSize: '0.92em', minWidth: 0,
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
  // 宽布局：显式 prop 优先，否则按打开瞬间视口宽高比自判（横屏 rail + 右展，v7 C 横屏形）。
  let wideAuto = false
  try {
    if (typeof window !== 'undefined' && window.innerWidth > window.innerHeight) wideAuto = true
  } catch (e) { wideAuto = false }
  const wide = typeof props.wide === 'boolean' ? props.wide : wideAuto
  // 卡片网格列数（用户 2026-10-03 拍板：竖屏 2 列、横屏 3 列）
  const gridCols = wide ? 3 : 2
  // 底部让位：Dock 占位（button.ts 传入的真值），抽屉底边抬到触控栏之上。
  const dockReserve = typeof props.dockReservePx === 'number' && isFinite(props.dockReservePx) && props.dockReservePx > 0
    ? Math.round(props.dockReservePx)
    : 0
  const gridStyle: any = {
    display: 'grid',
    gridTemplateColumns: 'repeat(' + gridCols + ', minmax(0, 1fr))',
    gap: 8, alignItems: 'stretch',
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
  const single = isSingleWorkspace(groupWorkspaceSessions(sessions, names, ungroupedName))

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
  const rootStyle: any = { position: 'fixed', inset: 0, zIndex: MODAL_Z }
  const maskStyle: any = {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
  }
  const sheetStyle: any = {
    // 底边抬到触控栏之上（用户 2026-10-03 拍板）：dockReserve=0 时与今天等价（贴底）。
    position: 'absolute', left: 0, right: 0, bottom: dockReserve > 0 ? dockReserve + 'px' : 0,
    background: 'var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))',
    backgroundColor: 'var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))',
    // 抬起来之后四边都有外露，圆角补齐（贴底时只留上圆角）。
    borderRadius: 18, border: '1px solid var(--dsw-alias-border-l1)',
    display: 'flex', flexDirection: 'column',
    // 上限仍是「内容定高、88% 内滚」口径（v7），只是要从 88% 里扣掉让位高度，否则会顶出视口。
    maxHeight: dockReserve > 0 ? 'calc(88% - ' + dockReserve + 'px)' : '88%',
    fontSize: 'calc(1em * ' + uiScale + ')',
    fontFamily: 'var(--dsw-font-family)', color: 'var(--dsw-alias-label-primary)',
  }
  const headStyle: any = { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 2px', flex: 'none' }
  const xStyle: any = {
    marginLeft: 'auto', flex: 'none', width: 40, height: 40, borderRadius: 9, cursor: 'pointer',
    border: '1px solid var(--dsw-alias-border-l1)',
    background: 'var(--dsw-alias-bg-layer-3)', color: 'var(--dsw-alias-label-primary)',
    fontSize: '1.2em', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
  const searchStyle: any = {
    margin: '4px 12px 0', padding: '8px 12px', borderRadius: 9, minHeight: 46,
    border: '1px solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-bg-layer-3)',
    color: 'var(--dsw-alias-label-primary)', fontSize: '0.9em', width: 'calc(100% - 24px)',
    flex: 'none', boxSizing: 'border-box', fontFamily: 'var(--dsw-font-family)', outline: 'none',
  }
  const bodyStyle: any = { overflowY: 'auto', padding: '8px 12px 14px', minHeight: 0, minWidth: 0 }

  const renderCard = (s: WorkspaceSession, withShort: boolean): any =>
    h(SessionCard, {
      key: s.id, h, s, lang,
      ungroupedName, fallbackShort,
      current: s.id === currentId,
      failed: s.id === failRowId,
      withShort,
      onPick: doPick,
    })
  // 一级卡（v7：名 + 计数 + 色点，无“最新”整行；展开态 accent 边框给态感，审查 #3/#4）。
  const renderWcard = (g: WorkspaceGroup, isOpen: boolean, allowCollapse: boolean): any =>
    h('button', {
      key: 'head:' + g.key,
      type: 'button',
      'data-dsh-prompt-picker-group': g.key,
      'aria-pressed': isOpen ? 'true' : 'false',
      onMouseDown: keepComposerFocus,
      onClick: () => {
        // 收起规则（v7 bind 口径，审查 #12）：竖屏允许收到全空，横屏重 sockaddr 点保持展开。
        try { setOpenGroup(allowCollapse && isOpen ? '__none' : g.key) } catch (e) { /* ignore */ }
      },
      style: {
        display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
        background: 'var(--dsw-alias-bg-layer-3)',
        border: '1px solid ' + (isOpen ? 'var(--dsw-specific-accent,#f0a45c)' : 'var(--dsw-alias-border-l1)'),
        color: 'var(--dsw-alias-label-primary)', borderRadius: 12,
        padding: '10px 12px', fontSize: '0.92em', marginBottom: 8,
        fontFamily: 'var(--dsw-font-family)',
      },
    }, [
      h('span', {
        key: 'wnm',
        style: { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 },
      }, [
        h('span', {
          key: 'dot',
          'data-dsh-prompt-picker-dot': '1',
          style: {
            flex: 'none', width: 10, height: 10, borderRadius: '50%',
            background: workspaceColor(g.workspaceId),
          },
        }),
        h('span', { key: 'nm' }, g.name),
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
      ]),
    ])
  const openKey = openGroup || (groups.length > 0 ? groups[0].key : '__none')
  const switchingNote = phase === 'switching' && switchingId
    ? h('div', {
      key: 'switching',
      'data-dsh-prompt-picker-switching': switchingId,
      style: { fontSize: '0.78em', color: 'var(--dsw-alias-label-tertiary)', padding: '6px 0 0', flex: 'none' },
    }, tr(lang, STR.pickerSwitching) + '…')
    : null
  // 列表区（C 手风琴：无查询多组 → 手风琴；有查询/单组 → 自动展平 + 短码，#111 US9/US12）。
  let listContent: any = null
  if (single || hasQuery) {
    const flat = filtered.slice().sort((a, b) => b.updatedAt - a.updatedAt)
    listContent = h('div', { key: 'flat', 'data-dsh-prompt-picker-flat': hasQuery ? 'query' : 'single' }, [
      switchingNote,
      h('div', { key: 'list', 'data-dsh-prompt-picker-grid': String(gridCols), style: gridStyle },
        flat.map((s) => renderCard(s, hasQuery))),
    ])
  } else if (wide) {
    // 横屏 rail + 右展（v7 C 横屏形，审查 #2）：左轨 hugging 宽只列一级卡，右侧展开放组卡片。
    const openG = groups.find((g) => g.key === openKey) || groups[0] || null
    listContent = h('div', { key: 'widewrap' }, [
      switchingNote,
      h('div', {
        key: 'rail',
        'data-dsh-prompt-picker-rail': '1',
        style: { display: 'flex', gap: 10, alignItems: 'flex-start' },
      }, [
        h('div', {
          key: 'crail',
          style: { flex: '0 0 auto', maxWidth: '38%', minWidth: 0, display: 'flex', flexDirection: 'column' },
        }, groups.map((g) => renderWcard(g, !!openG && openG.key === g.key, false))),
        openG ? h('div', {
          key: 'clist',
          'data-dsh-prompt-picker-grid': String(gridCols),
          style: { ...gridStyle, flex: '1 1 auto', minWidth: 0 },
        }, openG.items.map((s) => renderCard(s, false))) : null,
      ]),
    ])
  } else {
    listContent = h('div', { key: 'acc' }, [
      switchingNote,
      ...groups.map((g) => {
        const isOpen = openKey === g.key
        // 一级卡只留名与计数（v7：删掉“最新”整行，防杂乱）；组内会话走卡片网格
        const list = !isOpen ? null : h('div', {
          key: 'items:' + g.key,
          'data-dsh-prompt-picker-grid': String(gridCols),
          style: { ...gridStyle, margin: '0 0 8px' },
        }, g.items.map((s) => renderCard(s, false)))
        return h('div', { key: 'g:' + g.key }, [renderWcard(g, isOpen, true), list])
      }),
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
      h('div', { key: 'grab', style: { width: 44, height: 4, borderRadius: 99, background: 'var(--dsw-alias-border-l1)', margin: '8px auto 0', flex: 'none' } }),
      h('div', { key: 'head', style: headStyle }, [
        h('h2', { key: 't', style: { margin: 0, fontSize: '0.95em', flex: 'none' } }, tr(lang, STR.workspacePicker)),
        h('button', {
          key: 'x', type: 'button',
          style: xStyle, title: tr(lang, STR.close),
          'aria-label': tr(lang, STR.close),
          'data-dsh-prompt-picker-close': '1',
          onMouseDown: keepComposerFocus,
          onClick: () => { try { props.onClose() } catch (e) { /* ignore */ } },
        }, '×'),
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
