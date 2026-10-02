/**
 * dsh-prompt — 全屏挑选器本体（#104 MAP，视觉以 #108 v7 定稿为准，语义以 #111 为准）
 *
 * 定稿 v7 = C 手风琴 + 标题全显换行第一优先 + 时间尾随 + 徽标行内 + 一级卡只留名与计数
 * + 自适应抽屉（内容定高、上限 88% 内滚、禁大片空白）。
 * 状态机（#107 Q1/#111）：关闭→探测→加载→就绪/空/失败→切换中→关闭或留屏；
 * 成功才关，其余留屏；失败不自动关；取消只取消等待。
 * 约束：不进持久化、不记新日志、不读写草稿（沿 #111）。
 */
import { getReact, keepComposerFocus } from './panel'
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
  type WorkspaceFaces,
  type WorkspaceGroup,
  type WorkspaceSession,
} from './workspace'

export interface PickerProps {
  faces: WorkspaceFaces
  /** 当前会话 id（已在行点了直接关，不重切） */
  currentId?: string
  /** 远程大小档 1–10（只做 em 相对缩放，不写 px 常量） */
  remoteSize?: number
  /** 关闭（switchedId 有值 = 切换成功并切到该会话；无值 = 原地关闭/取消） */
  onClose: (switchedId?: string) => void
}

type Phase = 'probing' | 'loading' | 'ready' | 'empty' | 'failed' | 'switching'

/** 会话卡片（v7 行内徽标 + 标题全显 + 时间尾随 + 元信息行按需渲染） */
function SessionCard(props: {
  h: any
  s: WorkspaceSession
  current: boolean
  failed: boolean
  withShort: boolean
  onPick: (id: string) => void
}): any {
  const { h, s, current, failed, withShort, onPick } = props
  const lang = getLang()
  const trail = relativeWorkspaceTime(s.updatedAt)
  const abs = absoluteWorkspaceTime(s.updatedAt)
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
  // 元信息行：短码（展平态）+ 冲突尾段芯片；无则整行不渲染（v7 省空间）
  const meta: any[] = []
  if (withShort) {
    const short = (s.workspaceName || '').slice(0, 4) || '散'
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
    title: s.title + '\n' + abs + '\n' + (s.workspaceName || '') + (s.cwd ? ' · ' + s.cwd : ''),
    'data-dsh-prompt-picker-row': s.id,
    'aria-current': current ? 'true' : undefined,
    onMouseDown: keepComposerFocus,
    onClick: () => onPick(s.id),
    style: {
      display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
      background: current
        ? 'color-mix(in srgb, #7fd08a 12%, var(--dsw-alias-bg-layer-3))'
        : 'var(--dsw-alias-bg-layer-3)',
      border: current
        ? '1px solid #7fd08a'
        : '1px solid var(--dsw-alias-border-l1)',
      color: 'var(--dsw-alias-label-primary)', borderRadius: 12,
      padding: '10px 12px', fontSize: '0.92em', minWidth: 0,
      fontFamily: 'var(--dsw-font-family)',
    },
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
  const faces = props.faces
  const currentId = typeof props.currentId === 'string' ? props.currentId : ''
  const size = typeof props.remoteSize === 'number' ? props.remoteSize : 5

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
  void namesState[0]
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
          const gs = groupWorkspaceSessions(snap.sessions, snap.names)
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

  const filtered = filterWorkspaceSessions(sessions, query)
  const hasQuery = query.trim() !== ''
  let groups: WorkspaceGroup[] = []
  try {
    const names = namesState[0] as Map<string, string>
    groups = groupWorkspaceSessions(filtered, names)
  } catch (e) { groups = [] }
  const single = isSingleWorkspace(groupWorkspaceSessions(sessions, namesState[0] as Map<string, string>))

  // 搜索无结果进空态（不回退全量，#111 US14）
  const showEmptySearch = (phase === 'ready' || phase === 'switching') && hasQuery && filtered.length === 0
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
            const gs = groupWorkspaceSessions(snap.sessions, snap.names)
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
  const maskStyle: any = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 10,
  }
  const sheetStyle: any = {
    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 11,
    background: 'var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))',
    backgroundColor: 'var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))',
    borderRadius: '18px 18px 0 0', borderTop: '1px solid var(--dsw-alias-border-l1)',
    display: 'flex', flexDirection: 'column', maxHeight: '88%',
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
  const groupHeadStyle: any = {
    display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0 6px',
    fontSize: '0.88em', fontWeight: 700,
  }

  let bodyNode: any = null
  if (phase === 'probing' || phase === 'loading') {
    bodyNode = h('div', { key: 'loading', 'data-dsh-prompt-picker-loading': '1' }, [
      h('div', {
        key: 'bar',
        style: { height: 4, borderRadius: 99, background: 'var(--dsw-alias-bg-layer-3)', overflow: 'hidden', margin: '10px 12px 0', flex: 'none' },
      }, [
        h('div', { key: 'i', style: { height: '100%', width: '40%', borderRadius: 99, background: 'var(--dsw-specific-accent,#f0a45c)' } }),
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
  } else if (phase === 'failed') {
    const msg = failKind === 'probe' ? tr(lang, STR.pickerProbeFail) : tr(lang, STR.pickerSwitchFail)
    const failBadge = failRowId
      ? h('div', { key: 'rowfail', style: { margin: '0 0 8px', fontSize: '0.82em', color: 'var(--dsw-specific-danger,#e06c75)' } },
        tr(lang, STR.pickerSwitchFailBadge) + ' · ' + failRowId)
      : null
    bodyNode = h('div', { key: 'failed', 'data-dsh-prompt-picker-failed': failKind || 'switch' }, [
      failBadge,
      h('div', {
        key: 'box',
        style: {
          margin: '6px 0 12px', padding: '8px 12px', border: '1px solid var(--dsw-specific-danger,#e06c75)',
          borderRadius: 10, fontSize: '0.85em', color: 'var(--dsw-alias-label-primary)',
          display: 'flex', gap: 10, alignItems: 'center', lineHeight: 1.5,
        },
      }, [
        h('span', { key: 'm' }, msg),
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
  } else if (showTrueEmpty || showEmptySearch) {
    const msg = showEmptySearch ? tr(lang, STR.pickerEmptySearch) : tr(lang, STR.pickerEmpty)
    bodyNode = h('div', {
      key: 'empty',
      'data-dsh-prompt-picker-empty': showEmptySearch ? 'search' : 'true-none',
      style: {
        margin: '6px 0 12px', padding: '8px 12px', border: '1px dashed var(--dsw-alias-border-l1)',
        borderRadius: 10, fontSize: '0.85em', color: 'var(--dsw-alias-label-tertiary)',
        display: 'flex', gap: 10, alignItems: 'center', lineHeight: 1.5,
      },
    }, msg)
  } else {
    // 就绪 / 切换中：C 手风琴（有查询自动展平 + 短码，单工作区隐藏组头退化平铺）
    const switchingNote = phase === 'switching' && switchingId
      ? h('div', {
        key: 'switching',
        'data-dsh-prompt-picker-switching': switchingId,
        style: { fontSize: '0.78em', color: 'var(--dsw-alias-label-tertiary)', padding: '6px 0 0', flex: 'none' },
      }, tr(lang, STR.pickerSwitching) + '…')
      : null
    if (single || hasQuery) {
      const flat = filtered.slice().sort((a, b) => b.updatedAt - a.updatedAt)
      bodyNode = h('div', { key: 'flat', 'data-dsh-prompt-picker-flat': hasQuery ? 'query' : 'single' }, [
        switchingNote,
        h('div', { key: 'list', style: { display: 'flex', flexDirection: 'column', gap: 8 } },
          flat.map((s) => h(SessionCard, {
            key: s.id, h, s,
            current: s.id === currentId,
            failed: s.id === failRowId,
            withShort: hasQuery,
            onPick: doPick,
          }))),
      ])
    } else {
      bodyNode = h('div', { key: 'acc' }, [
        switchingNote,
        ...groups.map((g) => {
          const isOpen = (openGroup || groups[0].key) === g.key
          const head = h('button', {
            key: 'head:' + g.key,
            type: 'button',
            'data-dsh-prompt-picker-group': g.key,
            'aria-pressed': isOpen ? 'true' : 'false',
            onMouseDown: keepComposerFocus,
            onClick: () => {
              try { setOpenGroup(isOpen ? '__none' : g.key) } catch (e) { /* ignore */ }
            },
            style: {
              display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
              background: 'var(--dsw-alias-bg-layer-3)', border: '1px solid var(--dsw-alias-border-l1)',
              color: 'var(--dsw-alias-label-primary)', borderRadius: 12,
              padding: '10px 12px', fontSize: '0.92em', marginBottom: 8,
              fontFamily: 'var(--dsw-font-family)',
            },
          }, [
            h('span', {
              key: 'wnm',
              style: { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 },
            }, [
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
          // 一级卡只留名与计数（v7：删掉“最新”整行，防杂乱）
          const list = !isOpen ? null : h('div', {
            key: 'items:' + g.key,
            style: { display: 'flex', flexDirection: 'column', gap: 8, margin: '0 0 8px' },
          }, g.items.map((s) => h(SessionCard, {
            key: s.id, h, s,
            current: s.id === currentId,
            failed: s.id === failRowId,
            withShort: false,
            onPick: doPick,
          })))
          return h('div', { key: 'g:' + g.key }, [head, list])
        }),
      ])
    }
    void groupHeadStyle
  }

  return h('div', { 'data-dsh-prompt-picker-root': '1' }, [
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
