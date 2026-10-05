/**
 * dsh-prompt — 入口按钮（conversation.input.left）
 */
import { getReact, keepComposerFocus, ModalPortal, PanelPortal, MODAL_Z } from './panel'
import { SettingsPage } from './settings'
import { remoteChromeScale, remoteSizeScale } from './remoteView'
import { isPanelOpen, setPanelOpen, cancelPanelClose, schedulePanelClose, noteHoverOpen, takeHoverOpen } from './state'
import {
  getRemotePrefs, subscribeRemote, ensureRemoteLoaded,
} from './remote'
import { getLang, tr, STR } from './i18n'
import {
  canShowWorkspaceLeft, canShowWorkspacePicker, probeWorkspaceGates,
  readWorkspaceLeftExpanded, toggleWorkspaceLeft,
} from './workspace'
import { WorkspacePicker } from './picker'
import { getSmartInput } from './smartstore'
import { canShowRemoteModel } from './remoteInput'
import { RemoteInputSheet } from './remoteInputSheet'

/**
 * #66 窄屏优化：对话框底部输入区变窄时，按钮收起文字、只剩图标。
 *
 * 为什么用容器查询而不是 ResizeObserver：宿主输入条那一行（InputBar 的 .row）自带
 * `container-type: inline-size`，插槽 wrapper 是 `display:contents`（不产生盒子、不遮挡），
 * 所以 `@container` 命中的正是那一行本身 —— 纯 CSS 就够，无 JS、无挂载闪烁。宿主自己的
 * 模型选择器用的就是同一套做法（360px 处把自己那一行文字换成图标）。
 *
 * 断点标定（#65 原型实测，真 Chrome 布局）：现状要 ≥530.4px 才不换行
 * （tools 254.7 + 间隙 12 + trailing 263.7）；本规则取 560px = 标定值 + 约 30px 余量
 * （相邻按钮宽度会随宿主与其它插件变化）。比的是「那一行的内容盒宽度」，不是视口宽度；
 * 收起「Prompt」文字省 46.7px，等于把「开始换行」的宽度往下推 46.7px。
 *
 * 兜底：若将来宿主去掉 container-type，规则静默不匹配 ⇒ 行为退回今天的宽屏样式，不产生回归。
 */
const NARROW_STYLE_ID = 'dsh-prompt-entry-narrow'
const NARROW_CSS = [
  '@container (max-width: 560px) {',
  '  [data-dsh-prompt-entry] [data-dsh-prompt-label] { display: none; }',
  '}',
].join('\n')

let narrowStyleReady = false

/** 注入窄屏样式（幂等；任何失败都不影响按钮本身可用） */
function ensureNarrowStyle(): void {
  if (narrowStyleReady) return
  try {
    const doc: any = (globalThis as any).document
    if (!doc || !doc.head || typeof doc.createElement !== 'function') return
    const sel = 'style[data-dsh-prompt-style="' + NARROW_STYLE_ID + '"]'
    if (typeof doc.querySelector === 'function' && doc.querySelector(sel)) {
      narrowStyleReady = true
      return
    }
    const tag = doc.createElement('style')
    tag.setAttribute('data-dsh-prompt-style', NARROW_STYLE_ID)
    tag.textContent = NARROW_CSS
    doc.head.appendChild(tag)
    narrowStyleReady = true
  } catch (e) { /* 注入失败时保持今天的样子 */ }
}

/**
 * 远程按钮按压反馈样式（2026-09-29 用户拍板：任何可点都要有视觉反馈）。
 * 纯 CSS :hover/:active——鼠标悬停提亮、按下/触屏长按压暗+微缩（长按即保持 :active，无需计时器）；
 * 只用 filter/transform，不碰主题色，与 palette 共存；disabled 排除。
 * 挂在入口按钮处注入（入口常驻，即使面板关闭齿轮也在，保证齿轮一定有反馈）。
 * #104 改域选择器：从逐键枚举改为触控栏域选择器，新键自动继承悬停/按下反馈。
 */
const REMOTE_FB_STYLE_ID = 'dsh-prompt-remote-feedback'
const REMOTE_FB_CSS = [
  '[data-dsh-prompt-dock] button:hover, [data-dsh-prompt-dock-pill]:hover, [data-dsh-prompt-remote-panel] button:hover, [data-dsh-prompt-settings-modal] button:hover, [data-dsh-prompt-picker-sheet] button:hover, [data-dsh-prompt-remote-input-sheet] button:hover { filter: brightness(1.1); }',
  '[data-dsh-prompt-dock] button:active, [data-dsh-prompt-dock-pill]:active, [data-dsh-prompt-remote-panel] button:active, [data-dsh-prompt-settings-modal] button:active, [data-dsh-prompt-picker-sheet] button:active, [data-dsh-prompt-remote-input-sheet] button:active { filter: brightness(.9); transform: scale(.97); }',
  '[data-dsh-prompt-remote-panel] button:disabled:hover, [data-dsh-prompt-remote-panel] button:disabled:active, [data-dsh-prompt-picker-sheet] button:disabled:hover, [data-dsh-prompt-picker-sheet] button:disabled:active, [data-dsh-prompt-remote-input-sheet] button:disabled:hover, [data-dsh-prompt-remote-input-sheet] button:disabled:active { filter: none; transform: none; }',
  '[data-dsh-prompt-remote-panel] button, [data-dsh-prompt-settings-modal] button, [data-dsh-prompt-dock] button, [data-dsh-prompt-picker-sheet] button, [data-dsh-prompt-remote-input-sheet] button { transition: filter .08s ease, transform .08s ease; }',
].join('\n')
let remoteFbReady = false
function ensureRemoteFeedbackStyle(): void {
  if (remoteFbReady) return
  try {
    const doc: any = (globalThis as any).document
    if (!doc || !doc.head || typeof doc.createElement !== 'function') return
    const sel = 'style[data-dsh-prompt-style="' + REMOTE_FB_STYLE_ID + '"]'
    if (typeof doc.querySelector === 'function' && doc.querySelector(sel)) {
      remoteFbReady = true
      return
    }
    const tag = doc.createElement('style')
    tag.setAttribute('data-dsh-prompt-style', REMOTE_FB_STYLE_ID)
    tag.textContent = REMOTE_FB_CSS
    doc.head.appendChild(tag)
    remoteFbReady = true
  } catch (e) { /* ignore */ }
}

/** 仅供测试：重置注入缓存 */
export function __resetNarrowStyle(): void {
  narrowStyleReady = false
}

/**
 * #94 右侧边栏折叠面（宿主正道：ctx.sidebarRight 的 isExpanded/toggleExpanded）。
 *
 * 正道来源（只读实证，2026-09-29）：dsh-better-sidebar@0.24.1 发布包内 TS 源码
 * `src/client/sidebar/use-host-feeds.ts:38-41`（NativeColumnFace：`isExpanded?/toggleExpanded?`，
 * 经 `ctx.get('sidebarRight')` 取得，optional-call 探测）与 `:68,:80,:82`（调用位）；
 * 同包 `src/client/native/surface.ts:43-54`（NativeController 结构片）；第二独立佐证
 * dsh-mattpocock-skills-deck 已装包 `lib/client.js:8059`（`ctx.get('sidebarRight')` +
 * openTab/openTabIn 守卫式调用）与 `:19944-19978`（sidebarRightTabs + sidebar.right.pane.tab 注册）。
 * 官方 ctx 服务族（与 slots/inputTriggers 同族），无哈希类名、无 globalThis 野路子；
 * 宿主可晚到/缺席，故此处一律探测式调用、失败静默（fail-soft），存在性由调用方按位门控。
 */
export interface SidebarCtl {
  isExpanded?: () => boolean
  toggleExpanded?: () => void
}

/** 安全读展开态：true=展开、false=折叠、null=未知（宿主缺席/未实现/异常，不抛） */
export function readSidebarExpanded(ctl: unknown): boolean | null {
  try {
    const f = (ctl as any) && (ctl as any).isExpanded
    if (typeof f !== 'function') return null
    const v = f.call(ctl)
    return v === true ? true : v === false ? false : null
  } catch (e) { return null }
}

/**
 * 只切侧栏：调宿主 toggleExpanded，不碰本插件任何 state、不记日志事件。
 * 返回是否真调到宿主面（调用层断言只断到这里，不刺探宿主内部）。
 */
export function toggleSidebar(ctl: unknown): boolean {
  try {
    const f = (ctl as any) && (ctl as any).toggleExpanded
    if (typeof f !== 'function') return false
    f.call(ctl)
    return true
  } catch (e) { return false }
}

/**
 * #95 远程 Dock：远程下入口三键（入口/齿轮/折栏）离对话框，聚为一体钉 DSH 窗口底部。
 * - 横向容器：fixed 底、左右下留边（DOCK_MARGIN）、DOCK_Z=8000 低于远程面板 PANEL_Z=9999
 *   （panel.ts:551），高于页面内容与智能卡（400）；经 PanelPortal 挂 body 逃离 slot 层叠上下文。
 * - 高随档：Dock 自身不定高，内边距走 em（以 fontSize 12*entryFontScale 为锚），内键 px/em 体系不动，
 *   档位放大时内容撑高即自动跟，无需第二套尺寸 math。
 * - 内容 actions 注册式：dockActions 数组 append 续加，后续新键只管 push。
 * - 收展内存态（useState，默认展）：收起键在行内末尾，收起后折成底部中间小 pill（与 Dock 同底边距），点展；
 *   不进 remote 持久化、不记日志。
 */
export const DOCK_Z = 8000
const DOCK_MARGIN = 12

// 自家设置弹窗样式（与 panel 弹窗同标尺：遮罩 MODAL_Z，卡片宽至多 600、内容区滚动）。
const settingsMaskStyle: any = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: MODAL_Z }
const settingsModalCardStyle: any = {
  // 用户拍板：齿轮弹窗要宽阔（此前 min(600px,94vw) 太窄，现 2 倍宽，上限 96vw 防小屏溢出）。
  width: 'min(1200px, 96vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column',
  background: 'var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))',
  backgroundColor: 'var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))',
  border: '1px solid var(--dsw-alias-border-inverted)', borderRadius: 12, overflow: 'hidden',
  fontFamily: 'var(--dsw-font-family)', color: 'var(--dsw-alias-label-primary)',
}
const settingsModalHeadStyle: any = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--dsw-alias-border-l1)', flex: 'none' }
const settingsModalTitleStyle: any = { fontSize: '1em', fontWeight: 700 }
const settingsModalCloseStyle: any = {
  width: '2em', height: '2em', borderRadius: '50%', border: '1px solid var(--dsw-alias-border-l1)',
  background: 'transparent', color: 'var(--dsw-alias-label-tertiary)', fontSize: '1em', lineHeight: 1, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
}
const settingsModalBodyStyle: any = { overflowY: 'auto', padding: '0 14px 14px', minHeight: 0 }

/**
 * #112 同手势宽限：hover 开窗后多久内的跟进单击仍算“同一手势”（保持开）。
 * 鼠标 hover→click 同手势通常 <500ms，取 1000ms 宽容；超窗的单击视为稳态意图（取反，可手动关）。
 */
const HOVER_CLICK_GRACE_MS = 1000

export function EntryButton(props: any): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  const open = props.open ?? false
  const lang = getLang()
  const label = tr(lang, STR.entryBtn)
  // #82 远程总闸：订阅偏好，仅远程下在 Prompt 右侧出现配置键（栏头不设大/小切换）。
  const remoteState = react.useState(getRemotePrefs())
  const remote = remoteState[0]
  react.useEffect(() => {
    try { ensureRemoteLoaded().catch(() => undefined) } catch (e) { /* ignore */ }
    return subscribeRemote(() => {
      try { remoteState[1](getRemotePrefs()) } catch (e) { /* ignore */ }
    })
  }, [])

  ensureNarrowStyle()
  ensureRemoteFeedbackStyle()

  // 单滑块跟随开关（2026-09-29 用户拍板大小跟随开关）：关=入口正常尺寸；
  // 开时控制面吃全额（10 档 5.5x 撑爆宿主布局的风险由用户认，2026-09-29 去封顶）；关=入口正常尺寸。
  const entryFontScale = remoteChromeScale(remote.enabled ? remote.size : 1)
  const entryControlScale = remoteChromeScale(remote.enabled ? remote.size : 1)

  // 自家设置弹窗（2026-09-29 用户拍板：齿轮不再走宿主设置页 DOM 兜底——真机上打不开；
  // 点齿轮即在自家 Modal 里放完整配置面板，零宿主依赖；优先展示顶部区域，不自动滚动）。
  const gearModalState = react.useState(false)
  const gearModalOpen = gearModalState[0]
  const closeGearModal = (): void => { try { gearModalState[1](false) } catch (e) { /* ignore */ } }
  // #94 侧栏键态感（纯局部视觉态，不进本插件 store/remote state；未知态按折叠画，点后重读、无值则乐观翻转）
  const sbState = react.useState(readSidebarExpanded((props as any).sidebarCtl))
  // #95 Dock 收展（内存态，默认展；不进持久化）
  const dockState = react.useState(true)
  // #104 左工作区折叠（休眠契约）+ 全屏挑选器（异步双门控）：局部态，不进 store/remote state、不持久化、不记日志
  const leftState = react.useState(readWorkspaceLeftExpanded((props as any).sidebarLeftCtl))
  const pickerGateState = react.useState('pending' as 'pending' | 'ready' | 'absent')
  const pickerOpenState = react.useState(false)
  const pickerOpen = pickerOpenState[0]
  const pickerOpenerRef: any = react.useRef ? react.useRef(null) : { current: null }
  // #123 遥控输入镜（单模态一员）：内存态，默认关；开关不动 dockState；关后焦点回 opener
  const inputOpenState = react.useState(false)
  const inputOpen = inputOpenState[0]
  const inputOpenerRef: any = react.useRef ? react.useRef(null) : { current: null }
  const inputSessionState = react.useState(undefined as string | undefined)
  const openPicker = (): void => {
    try { gearModalState[1](false) } catch (e) { /* ignore */ }
    try { inputOpenState[1](false) } catch (e) { /* ignore */ }
    try { pickerOpenState[1](true) } catch (err) { /* ignore */ }
  }
  const closePicker = (): void => {
    try { pickerOpenState[1](false) } catch (e) { /* ignore */ }
    try {
      const el = pickerOpenerRef && pickerOpenerRef.current
      if (el && typeof el.focus === 'function') el.focus()
    } catch (err) { /* ignore */ }
  }
  const openGearModal = (): void => {
    try { pickerOpenState[1](false) } catch (e) { /* ignore */ }
    try { inputOpenState[1](false) } catch (e) { /* ignore */ }
    try { gearModalState[1](true) } catch (err) { /* ignore */ }
  }
  const openRemoteInput = (): void => {
    try { gearModalState[1](false) } catch (e) { /* ignore */ }
    try { pickerOpenState[1](false) } catch (e) { /* ignore */ }
    try {
      let sid: string | undefined = undefined
      try {
        const a = (props as any).sessionId
        if (typeof a === 'string' && a !== '') sid = a
        else {
          const b = getSmartInput().sessionId
          if (typeof b === 'string' && b !== '') sid = b
        }
      } catch (e) { sid = undefined }
      try { inputSessionState[1](sid) } catch (e) { /* ignore */ }
    } catch (e) { /* ignore */ }
    try { inputOpenState[1](true) } catch (err) { /* ignore */ }
  }
  const closeRemoteInput = (): void => {
    try { inputOpenState[1](false) } catch (e) { /* ignore */ }
    try {
      const el = inputOpenerRef && inputOpenerRef.current
      if (el && typeof el.focus === 'function') el.focus()
    } catch (err) { /* ignore */ }
  }
  // #104 Esc 只关顶层 + #123 输入镜同栈：输入开着先关输入，否则按挑选器→齿轮序；焦点回 opener；与收展正交（不动 dockState）
  react.useEffect(() => {
    if (!pickerOpen && !gearModalOpen && !inputOpen) return undefined
    const onKey = (e: any): void => {
      try {
        if (!e || e.key !== 'Escape') return
        if (inputOpenState[0] === true || inputOpen) {
          e.stopPropagation()
          closeRemoteInput()
        } else if (pickerOpenState[0] === true || pickerOpen) {
          e.stopPropagation()
          closePicker()
        } else {
          closeGearModal()
        }
      } catch (err) { /* ignore */ }
    }
    try {
      const doc: any = (globalThis as any).document
      if (doc && typeof doc.addEventListener === 'function') {
        doc.addEventListener('keydown', onKey, true)
        return () => { try { doc.removeEventListener('keydown', onKey, true) } catch (err) { /* ignore */ } }
      }
    } catch (err) { /* ignore */ }
    return undefined
  }, [pickerOpen, gearModalOpen, inputOpen])
  // #104 挑选器双门控探测（hooks 铁律：一切 useEffect 必须在早退分支之前调用；
  // 晚到面在下一次重渲染时自然接上，抄 #94 sidebarCtl 模式）。
  const wsFaces = {
    sessions: (props as any).workspaceSessions,
    workspaces: (props as any).workspaceList,
    uiWorkspace: (props as any).workspaceUI,
  }
  const pickerGate = pickerGateState[0]
  react.useEffect(() => {
    let alive = true
    try {
      const g = probeWorkspaceGates({
        sessions: (props as any).workspaceSessions,
        workspaces: (props as any).workspaceList,
        uiWorkspace: (props as any).workspaceUI,
      })
      if (!alive) return
      pickerGateState[1](g.enumerable && g.switchable ? 'ready' : 'absent')
    } catch (e) {
      try { if (alive) pickerGateState[1]('absent') } catch (err) { /* ignore */ }
    }
    return () => { alive = false }
  }, [
    (props as any).workspaceSessions,
    (props as any).workspaceList,
    (props as any).workspaceUI,
  ])
  // 返修（关闭键不可见）：远程开时四边留边（不再 100vw×100vh 铺满，圆角回来）；
  // 底边避开入口行——pos/entry 语义（面板底坐入口顶边上方 8px，同 panel.ts:894），reserve 用 rem/百分比；
  // 关闭行 sticky 钉住（82 只断存在性）。非远程原样不动。
  const gearMaskStyle = remote.enabled
    ? { ...settingsMaskStyle, alignItems: 'flex-start', padding: '2vh 2vw 0' }
    : settingsMaskStyle
  const gearCardStyle = remote.enabled
    // 宽随字自适应（仅远程）：fit-content 吃内容——字小时窄版，字大换行后渐宽；
    // min 保可用（窄到 480 即停，小屏按 94vw 收），max 取现状上限（96vw，与全屏档同值）；非远程原尺寸不动。
    // #92 补齐：卡片根吃与 SettingsPage 根同构的全额 fontSize（标题 1em/关闭 1em·2em 锚到它才跟档；
    // 此前只体跟、头不跟，10 档下标题/关闭显小且命中区不放大，与大触控目标相悖；关=不设回原样）。
    ? {
      ...settingsModalCardStyle, width: 'fit-content', minWidth: 'min(480px, 94vw)', maxWidth: '96vw',
      height: 'calc(96vh - 3.5rem)', maxHeight: 'calc(96vh - 3.5rem)', margin: 0, borderRadius: 12,
      fontSize: 'calc(var(--dsw-font-markdown-base-font-size) * ' + remoteSizeScale(remote.size) + ')',
    }
    : settingsModalCardStyle
  const gearHeadStyle = remote.enabled
    ? {
      ...settingsModalHeadStyle, position: 'sticky', top: 0, zIndex: 1,
      background: 'var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))',
      backgroundColor: 'var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))',
    }
    : settingsModalHeadStyle
  const gearModalNode = !gearModalOpen ? null : h(ModalPortal, { key: 'dsh-prompt-settings-modal' },
    h('div', {
      style: gearMaskStyle, 'data-dsh-prompt-settings-modal': '1',
      onClick: (e: any) => { if (e.target === e.currentTarget) closeGearModal() },
    }, [
      h('div', { style: gearCardStyle }, [
        h('div', { style: gearHeadStyle }, [
          h('span', { style: settingsModalTitleStyle }, tr(lang, STR.remoteConfigKey)),
          h('button', {
            type: 'button', style: settingsModalCloseStyle, title: tr(lang, STR.close),
            'data-dsh-prompt-settings-modal-close': '1',
            onClick: closeGearModal,
          }, '×'),
        ]),
        h('div', { style: settingsModalBodyStyle }, [
          h(SettingsPage, { key: 'gear-settings-page' }),
        ]),
      ]),
    ]),
  )

  const style: any = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: (5 * entryControlScale) + 'px ' + (10 * entryControlScale) + 'px', borderRadius: 8,
    background: 'var(--dsw-alias-bg-layer-3)',
    border: '1px solid var(--dsw-alias-border-l1)',
    color: open ? 'var(--dsw-specific-accent,#f0a45c)' : 'var(--dsw-alias-label-primary)',
    cursor: 'pointer', fontSize: 12 * entryFontScale, fontWeight: 500,
    fontFamily: 'var(--dsw-font-family)', whiteSpace: 'nowrap',
    flex: 'none',
  }
  const entryBtn = h('button', {
    key: 'entry',
    style, title: label,
    // #66 图标化后可见文字为空，可访问名必须由 aria-label 顶上，否则读屏念不出这个按钮。
    // 与可见文字同名（WCAG 2.5.3 名称与可见标签一致）；宽屏下与文字重复也无害。
    'aria-label': label,
    'data-dsh-prompt-entry': '1',
    // #61 保焦（宿主 input.left 自家按钮同款 keepFocus）：click 开面板时不把焦点从作曲家抢走，
    // 面板内搜索框聚焦时不抢（见 keepComposerFocus）；键盘 Tab+Enter 无 mousedown，不受影响。
    onMouseDown: keepComposerFocus,
    // hover 触发：进入即开；离开延迟 150ms 关（列表接管时取消）
    // #112 去闪关：只有闭→开这一跳才打同手势点——稳态已开时移入不重新武装，
    // 否则逛过面板回来点按钮就永远关不掉了。
    onMouseEnter: () => { cancelPanelClose(); if (!isPanelOpen()) { setPanelOpen(true); noteHoverOpen() } },
    onMouseLeave: () => { schedulePanelClose(150) },
    // click 保留：触屏 tap / 键盘 focus+Enter 的 fallback + 手动开关
    // #112 去闪关：hover 已开窗的同手势跟进单击是“确认/保持”，不是“取反关”——
    // mouseEnter 先开了窗，click 再按旧状态取反就会闪关；标记消费一次，
    // 原位第二次单击即走取反（可手动关，不粘住）。超窗视为稳态，同样取反。
    onClick: () => {
      cancelPanelClose()
      if (isPanelOpen() && takeHoverOpen(HOVER_CLICK_GRACE_MS)) return
      setPanelOpen(!isPanelOpen())
    },
  }, [
    // 图标：灯泡（提醒/点子语义）+ 小星芒（智能建议）—— 方案 C
    h('svg', { width: 14 * entryFontScale, height: 14 * entryFontScale, viewBox: '0 0 24 24', fill: 'none', stroke: 'var(--dsw-specific-accent,#f0a45c)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', style: { flex: 'none' } }, [
      h('path', { d: 'M15 14c.2-1 .7-1.7 1.5-2.5C17.5 10.6 18 9.3 18 8a6 6 0 1 0-12 0c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5' }),
      h('path', { d: 'M9 18h6' }),
      h('path', { d: 'M10 22h4' }),
      h('path', { d: 'M18.5 2.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z' }),
    ]),
    // 文案：加钩子供窄屏规则收起（宽屏一个字不变）
    h('span', { 'data-dsh-prompt-label': '1' }, label),
  ])
  // #82 对话框底部 Prompt 右侧配置键：仅远程下出现；
  // 2026-09-29 改自家弹窗（用户拍板）：不再走宿主设置页 DOM 兜底（真机打不开），
  // 点齿轮即开自家 Modal 放完整配置面板，零宿主依赖（#87 稳定直达未动）。
  if (!remote.enabled) return gearModalNode ? h('span', { style: { display: 'inline-flex', alignItems: 'center' } }, [entryBtn, gearModalNode]) : entryBtn
  const gearTitle = tr(lang, STR.remoteConfigKey)
  const gearBox = 26 * entryControlScale
  const gear = h('button', {
    key: 'gear',
    type: 'button',
    style: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: gearBox, height: gearBox, borderRadius: 8, marginLeft: 6,
      background: 'var(--dsw-alias-bg-layer-3)',
      border: '1px solid var(--dsw-alias-border-l1)',
      color: 'var(--dsw-alias-label-primary)', cursor: 'pointer', fontSize: 14 * entryFontScale, flex: 'none',
    },
    title: gearTitle,
    'aria-label': gearTitle,
    'data-dsh-prompt-remote-gear': '1',
    onMouseDown: keepComposerFocus,
    onClick: openGearModal,
  }, '⚙')
  // #104 左工作区折叠键（休眠契约）：仅远程 + 左面在场时出现（今天恒隐藏，宿主补 sidebarLeft 后自动出现）；
  // 语义镜像右键（面板侧对称：分栏居左为左，非像素翻转）；aria-pressed + 两态图标/明暗；每次渲染重探（抄晚到模式）。
  const sidebarLeftCtl = (props as any).sidebarLeftCtl
  const canLeft = canShowWorkspaceLeft(sidebarLeftCtl)
  const leftExpanded = leftState[0] === true
  const leftTitle = tr(lang, leftExpanded ? STR.workspaceLeftCollapse : STR.workspaceLeftExpand)
  const leftKey = !canLeft ? null : h('button', {
    key: 'workspace-left',
    type: 'button',
    style: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: gearBox, height: gearBox, borderRadius: 8, marginLeft: 6,
      background: 'var(--dsw-alias-bg-layer-3)',
      border: '1px solid var(--dsw-alias-border-l1)',
      color: 'var(--dsw-alias-label-primary)', cursor: 'pointer', fontSize: 14 * entryFontScale, flex: 'none',
      opacity: leftExpanded ? 1 : 0.75,
    },
    title: leftTitle,
    'aria-label': leftTitle,
    'aria-pressed': leftExpanded,
    'data-dsh-prompt-workspace-left': '1',
    onMouseDown: keepComposerFocus,
    onClick: () => {
      toggleWorkspaceLeft(sidebarLeftCtl)
      try {
        const v = readWorkspaceLeftExpanded(sidebarLeftCtl)
        leftState[1](v === null ? !leftExpanded : v)
      } catch (e) { /* ignore */ }
    },
  }, [
    // 语义镜像（面板侧对称）：左开=分栏居左+向左折，左闭=分栏居右+向右开；与右键并排可辨左右。
    h('svg', { width: '1.2em', height: '1.2em', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', style: { flex: 'none' } }, leftExpanded ? [
      h('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }),
      h('path', { d: 'M9 4v16' }),
      h('path', { d: 'M13.5 9l-3 3 3 3' }),
    ] : [
      h('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }),
      h('path', { d: 'M15 4v16' }),
      h('path', { d: 'M10.5 9l3 3-3 3' }),
    ]),
  ])
  // #94 齿轮右侧侧栏折叠键：仅远程 + 宿主面在场（toggleExpanded 为函数）时出现；
  // 同 entryBtn 行内、gearBox 同体系（26*chromeScale 随档跟缩）；SVG 自设计两态
  // （currentColor、1.2em 系、strokeWidth 2 与入口灯泡同重）；aria-pressed + 两态图标/明暗给态感；
  // onMouseDown 保焦（与齿轮同理：同行按钮 mousedown 会抢作曲家焦点）；点击只调宿主面。
  const sidebarCtl = (props as any).sidebarCtl
  const canSidebar = !!sidebarCtl && typeof (sidebarCtl as any).toggleExpanded === 'function'
  const sbExpanded = sbState[0] === true
  const sbTitle = tr(lang, sbExpanded ? STR.sidebarCollapse : STR.sidebarExpand)
  const sidebarKey = !canSidebar ? null : h('button', {
    key: 'sidebar',
    type: 'button',
    style: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: gearBox, height: gearBox, borderRadius: 8, marginLeft: 6,
      background: 'var(--dsw-alias-bg-layer-3)',
      border: '1px solid var(--dsw-alias-border-l1)',
      color: 'var(--dsw-alias-label-primary)', cursor: 'pointer', fontSize: 14 * entryFontScale, flex: 'none',
      opacity: sbExpanded ? 1 : 0.75,
    },
    title: sbTitle,
    'aria-label': sbTitle,
    'aria-pressed': sbExpanded,
    'data-dsh-prompt-sidebar-toggle': '1',
    onMouseDown: keepComposerFocus,
    onClick: () => {
      toggleSidebar(sidebarCtl)
      try {
        const v = readSidebarExpanded(sidebarCtl)
        sbState[1](v === null ? !sbExpanded : v)
      } catch (e) { /* ignore */ }
    },
  }, [
    // 自设计：右侧栏面板 + 分栏线 + 折向箭头；展开态示“向左折”（分栏居右）、折叠态示“向右开”（分栏居左）。
    h('svg', { width: '1.2em', height: '1.2em', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', style: { flex: 'none' } }, sbExpanded ? [
      h('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }),
      h('path', { d: 'M15 4v16' }),
      h('path', { d: 'M10.5 9l-3 3 3 3' }),
    ] : [
      h('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }),
      h('path', { d: 'M9 4v16' }),
      h('path', { d: 'M13.5 9l3 3-3 3' }),
    ]),
  ])
  // #104 挑选器入口键（异步双门控）：可枚举且可切换双满足才渲染；探测中/缺席不渲染、无禁用中间态；
  // 图标框+一行+右›；aria-expanded + haspopup=dialog；title=aria-label 同串双语；与收展正交（开关不动 dockState）。
  // 注：wsFaces 与 pickerGate 在早退分支前已定义并探测（hooks 铁律），此处只消费。
  const canPicker = pickerGate === 'ready' && canShowWorkspacePicker(wsFaces)
  const pickerTitle = tr(lang, STR.workspacePicker)
  const pickerKey = !canPicker ? null : h('button', {
    key: 'workspace-picker',
    type: 'button',
    ref: (el: any) => { try { if (pickerOpenerRef) pickerOpenerRef.current = el } catch (e) { /* ignore */ } },
    style: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: gearBox, height: gearBox, borderRadius: 8, marginLeft: 6,
      // 开启态只换边框色（原型 dock 键 accent 边框口径；实心填充系 creep，已按审查 #18 回退）。
      background: 'var(--dsw-alias-bg-layer-3)',
      border: '1px solid ' + (pickerOpen ? 'var(--dsw-specific-accent,#f0a45c)' : 'var(--dsw-alias-border-l1)'),
      color: 'var(--dsw-alias-label-primary)',
      cursor: 'pointer', fontSize: 14 * entryFontScale, flex: 'none',
    },
    title: pickerTitle,
    'aria-label': pickerTitle,
    'aria-expanded': pickerOpen ? 'true' : 'false',
    'aria-haspopup': 'dialog',
    'data-dsh-prompt-workspace-picker': '1',
    onMouseDown: keepComposerFocus,
    onClick: () => {
      if (pickerOpen) closePicker()
      else openPicker()
    },
  }, [
    // 自设计：框+一行+右›（全屏+当前项+切换），与右折叠同笔重同尺寸体系。
    h('svg', { width: '1.2em', height: '1.2em', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', style: { flex: 'none' } }, [
      h('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }),
      h('path', { d: 'M7 10h9' }),
      h('path', { d: 'M14.5 13.5l3 3-3 3' }),
    ]),
  ])
  // #104 挑选器面：与齿轮弹窗同层（MODAL_Z，经 ModalPortal 挂 body 逃离层叠）、高于 Dock（DOCK_Z）；
  // 单模态（开挑选器关齿轮，反之亦然）；关闭后面板焦点回 opener；开关不改收展内存态。
  // #104 当前会话 id（#111 US23 已在直关就靠它）：优先用槽 props（若宿主给），
  // 缺席回退 smartstore（由会话 overlay 经已证实 sessionId 喂养，index.ts 的 setSmartInput）。
  // 审查结论 #6：input.left 槽 props 带不带 sessionId 无仓内证据，不做单押。
  let pickerSessionId: string | undefined = undefined
  try {
    const a = (props as any).sessionId
    if (typeof a === 'string' && a !== '') pickerSessionId = a
    else {
      const b = getSmartInput().sessionId
      if (typeof b === 'string' && b !== '') pickerSessionId = b
    }
  } catch (e) { pickerSessionId = undefined }
  // #115 dockReservePx 已退役（用户 2026-10-05 拍板近全屏内缩面板）：面板恒盖住触控栏，
  // 底边让位无意义（且旧值收起 Dock 不收缩，134px 起步纯属浪费）。尺寸真值仍只 button.ts 算。
  const pickerModalNode = !pickerOpen ? null : h(ModalPortal, { key: 'dsh-prompt-workspace-picker' },
    h(WorkspacePicker, {
      faces: wsFaces,
      currentId: pickerSessionId,
      remoteSize: remote.size,
      onClose: () => { closePicker() },
    }),
  )
  // #123 遥控输入键（注册式续加，插挑选器后、收起前）＋模型键休眠（120 ABSENT：零占位不渲染）
  // 输入键仅远程 Dock 内出现（Dock 本身仅远程渲染）；模型键今日恒隐藏，有面后自动插输入框后、收起前。
  const showModel = canShowRemoteModel(wsFaces)
  const inputTitle = tr(lang, STR.remoteInputKey)
  const inputKey = h('button', {
    key: 'remote-input',
    type: 'button',
    ref: (el: any) => { try { if (inputOpenerRef) inputOpenerRef.current = el } catch (e) { /* ignore */ } },
    style: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: gearBox, height: gearBox, borderRadius: 8, marginLeft: 6,
      background: 'var(--dsw-alias-bg-layer-3)',
      border: '1px solid ' + (inputOpen ? 'var(--dsw-specific-accent,#f0a45c)' : 'var(--dsw-alias-border-l1)'),
      color: 'var(--dsw-alias-label-primary)',
      cursor: 'pointer', fontSize: 14 * entryFontScale, flex: 'none',
    },
    title: inputTitle,
    'aria-label': inputTitle,
    'aria-expanded': inputOpen ? 'true' : 'false',
    'aria-haspopup': 'dialog',
    'data-dsh-prompt-remote-input': '1',
    onMouseDown: keepComposerFocus,
    onClick: () => {
      if (inputOpen) closeRemoteInput()
      else openRemoteInput()
    },
  }, [
    h('span', { style: { fontSize: '1.2em', lineHeight: 1, flex: 'none' } }, '✎'),
  ])
  // 模型键今日休眠：showModel 为 false 即 null（零占位，不渲染不断言占位；有面后另起键插此处）。
  const modelKey = null
  void showModel
  void modelKey
  const inputModalNode = !inputOpen ? null : h(ModalPortal, { key: 'dsh-prompt-remote-input' },
    h(RemoteInputSheet, {
      capturedSessionId: inputSessionState[0],
      remoteSize: remote.size,
      onClose: () => { closeRemoteInput() },
    }),
  )
  // #95 远程 Dock + #123 续加：顺序冻结入口→齿轮→左→右→挑选器→输入框→收起（收起永末，续加只插收起前）；
  // 左缺席不占位；挑选器 pending/缺席不渲染；输入框恒渲染（远程镜，无宿主门控）；
  // 模型键今日休眠零占位（有面后插输入框后、收起前）；Dock 容器低于输入/挑选器（被盖住是对的）。
  // 高随档（容器不定高+em 内边距）；窄屏内行横滚、键体不压缩。
  const dockActions: any[] = []
  dockActions.push(entryBtn)
  dockActions.push(gear)
  if (leftKey) dockActions.push(leftKey)
  if (sidebarKey) dockActions.push(sidebarKey)
  if (pickerKey) dockActions.push(pickerKey)
  dockActions.push(inputKey)
  const dockCollapseTitle = tr(lang, STR.dockCollapse)
  dockActions.push(h('button', {
    key: 'dock-collapse',
    type: 'button',
    style: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: gearBox, height: gearBox, borderRadius: 8, marginLeft: 6,
      background: 'transparent',
      border: '1px solid var(--dsw-alias-border-l1)',
      color: 'var(--dsw-alias-label-tertiary)', cursor: 'pointer', fontSize: 14 * entryFontScale, flex: 'none',
    },
    title: dockCollapseTitle,
    'aria-label': dockCollapseTitle,
    'data-dsh-prompt-dock-collapse': '1',
    onMouseDown: keepComposerFocus,
    onClick: () => { dockState[1](false) },
  }, '▾'))
  const dockBarStyle: any = {
    position: 'fixed', left: DOCK_MARGIN, right: DOCK_MARGIN, bottom: DOCK_MARGIN,
    display: 'flex', justifyContent: 'center', zIndex: DOCK_Z, pointerEvents: 'none',
    fontSize: 12 * entryFontScale,
  }
  const dockPillStyle: any = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '0.5em 0.75em', borderRadius: 12,
    background: 'var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))',
    border: '1px solid var(--dsw-alias-border-l1)',
    color: 'var(--dsw-alias-label-primary)',
    fontFamily: 'var(--dsw-font-family)', pointerEvents: 'auto',
    // #104 溢出横滚：容器限视口宽、内行横向滚动、键体不压缩（键已有 flex:none）。
    maxWidth: '96vw', overflowX: 'auto', whiteSpace: 'nowrap',
  }
  if (!dockState[0]) {
    // 收起态：底部中间小 pill（与 Dock 本体同底边距），点展；设置弹窗照常可挂。
    const dockExpandTitle = tr(lang, STR.dockExpand)
    const pillNode = h(PanelPortal, { key: 'dsh-prompt-dock-pill' },
      h('div', {
        style: { position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: DOCK_MARGIN, zIndex: DOCK_Z, pointerEvents: 'none' },
      }, [
        h('button', {
          type: 'button',
          style: {
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: '0.4em 0.7em', borderRadius: 999,
            background: 'var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))',
            border: '1px solid var(--dsw-alias-border-l1)',
            color: 'var(--dsw-alias-label-primary)', cursor: 'pointer',
            fontSize: 12 * entryFontScale, fontFamily: 'var(--dsw-font-family)', pointerEvents: 'auto',
          },
          title: dockExpandTitle,
          'aria-label': dockExpandTitle,
          'data-dsh-prompt-dock-pill': '1',
          onMouseDown: keepComposerFocus,
          onClick: () => { dockState[1](true) },
        }, '▴'),
      ]),
    )
    return h('span', { style: { display: 'inline-flex', alignItems: 'center' } }, [pillNode, gearModalNode, pickerModalNode, inputModalNode])
  }
  const dockNode = h(PanelPortal, { key: 'dsh-prompt-dock' },
    h('div', { style: dockBarStyle, 'data-dsh-prompt-dock': '1' }, [
      h('div', { style: dockPillStyle }, dockActions),
    ]),
  )
  return h('span', { style: { display: 'inline-flex', alignItems: 'center' } }, [dockNode, gearModalNode, pickerModalNode, inputModalNode])
}
