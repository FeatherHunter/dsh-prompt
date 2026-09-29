/**
 * dsh-prompt — 入口按钮（conversation.input.left）
 */
import { getReact, keepComposerFocus, ModalPortal, MODAL_Z } from './panel'
import { SettingsPage } from './settings'
import { remoteFontScale, remoteControlScale } from './remoteView'
import { isPanelOpen, setPanelOpen, cancelPanelClose, schedulePanelClose } from './state'
import {
  getRemotePrefs, subscribeRemote, ensureRemoteLoaded,
} from './remote'
import { getLang, tr, STR } from './i18n'

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
 */
const REMOTE_FB_STYLE_ID = 'dsh-prompt-remote-feedback'
const REMOTE_FB_CSS = [
  '[data-dsh-prompt-remote-gear]:hover, [data-dsh-prompt-remote-panel] button:hover, [data-dsh-prompt-settings-modal] button:hover { filter: brightness(1.1); }',
  '[data-dsh-prompt-remote-gear]:active, [data-dsh-prompt-remote-panel] button:active, [data-dsh-prompt-settings-modal] button:active { filter: brightness(.9); transform: scale(.97); }',
  '[data-dsh-prompt-remote-panel] button:disabled:hover, [data-dsh-prompt-remote-panel] button:disabled:active { filter: none; transform: none; }',
  '[data-dsh-prompt-remote-panel] button, [data-dsh-prompt-settings-modal] button { transition: filter .08s ease, transform .08s ease; }',
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

  // 三档全局跟随（2026-09-29 用户拍板）：字号档管入口文字与图标、控件档管入口热区与齿轮尺寸；
  // 与 palette 无关（inline 样式本就最高），只用乘数，不碰主题变量。
  const entryFontScale = remoteFontScale(remote.font)
  const entryControlScale = remoteControlScale(remote.control)

  // 自家设置弹窗（2026-09-29 用户拍板：齿轮不再走宿主设置页 DOM 兜底——真机上打不开；
  // 点齿轮即在自家 Modal 里放完整配置面板，零宿主依赖；优先展示顶部区域，不自动滚动）。
  const gearModalState = react.useState(false)
  const gearModalOpen = gearModalState[0]
  const closeGearModal = (): void => { try { gearModalState[1](false) } catch (e) { /* ignore */ } }
  const gearModalNode = !gearModalOpen ? null : h(ModalPortal, { key: 'dsh-prompt-settings-modal' },
    h('div', {
      style: settingsMaskStyle, 'data-dsh-prompt-settings-modal': '1',
      onClick: (e: any) => { if (e.target === e.currentTarget) closeGearModal() },
    }, [
      h('div', { style: settingsModalCardStyle }, [
        h('div', { style: settingsModalHeadStyle }, [
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
    style, title: label,
    // #66 图标化后可见文字为空，可访问名必须由 aria-label 顶上，否则读屏念不出这个按钮。
    // 与可见文字同名（WCAG 2.5.3 名称与可见标签一致）；宽屏下与文字重复也无害。
    'aria-label': label,
    'data-dsh-prompt-entry': '1',
    // #61 保焦（宿主 input.left 自家按钮同款 keepFocus）：click 开面板时不把焦点从作曲家抢走，
    // 面板内搜索框聚焦时不抢（见 keepComposerFocus）；键盘 Tab+Enter 无 mousedown，不受影响。
    onMouseDown: keepComposerFocus,
    // hover 触发：进入即开；离开延迟 150ms 关（列表接管时取消）
    onMouseEnter: () => { cancelPanelClose(); setPanelOpen(true) },
    onMouseLeave: () => { schedulePanelClose(150) },
    // click 保留：触屏 tap / 键盘 focus+Enter 的 fallback + 手动开关
    onClick: () => { cancelPanelClose(); setPanelOpen(!isPanelOpen()) },
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
    onClick: () => { gearModalState[1](true) },
  }, '⚙')
  return h('span', { style: { display: 'inline-flex', alignItems: 'center' } }, [entryBtn, gear, gearModalNode])
}
