/**
 * dsh-prompt — client 入口（v1 常规模式 + v1.1 智能模式）
 * 装配：input.left 入口按钮 / input.overlay 面板浮层 / settings.section 配置页（直属设置面板）/ inputTriggers /prompt 触发源（#9）/ shell.overlay 智能悬浮卡（#10）
 */
import { getReact, TemplateBrowser, PanelPortal, setGoSettingsHandler, armInputFocusTrack, INK_TINT_CSS, INK_UI_CSS } from './panel'
import { EntryButton } from './button'
import { SettingsPage } from './settings'
import { buildPromptSource } from './trigger'
import { SmartCardHost } from './smart'
import { setSmartInput } from './smartstore'
import { ensureLoaded } from './store'
import { ensureRemoteLoaded, subscribeRemote, getRemotePrefs, warmEnvOrientation } from './remote'
import { getSystemOrientation } from './systemOrientation'
import { syncHostFont, syncRemoteRows, syncAssistantZoom, clearHostBridges } from './hostfont'
import { applyOwnedStyle, styleDocument } from './styleOwnership'
import { getLang, tr, STR } from './i18n'
import { installLocaleService } from './locale'
import { isPanelOpen, onPanelOpen } from './state'
import { startLog, getLog } from './log'

/** 记一条调试级事件（先问开关再组装字段：关着开关时连字符串都不拼，包内兜底拦不住调用前的求值）。 */
function logDebug(event: string, fields?: Record<string, unknown>): void {
  try {
    const log = getLog()
    if (!log.isEnabled(event)) return
    log.log(event, fields)
  } catch (e) { /* 日志失败不许影响装配 */ }
}

type ClientContext = {
  slots: any
  inputTriggers: any
  effect: (fn: () => unknown, key?: string) => unknown
}

export const inject = ['slots', 'inputTriggers']


/** 面板浮层（conversation.input.overlay，session 作用域 → 有 useInput/inputActions） */
function PanelHost(props: any): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  const openState = react.useState(isPanelOpen())
  const open = openState[0]
  react.useEffect(() => {
    onPanelOpen((v) => openState[1](v))
    // 面板宿主挂载现场（#49 起走日志能力，debug 级）：只记 props 数量与能力有无，不记 props 内容。
    logDebug('panel.host.mount', {
      propCount: Object.keys(props || {}).length,
      hasUseInput: !!(props as any).useInput,
      hasInputActions: !!(props as any).inputActions,
    })
  }, [])
  // 智能模式桥接：把当前会话输入发布给 shell.overlay 悬浮卡。
  // 注意：useInput 是 hook，只能在组件 render 内调用，不能在 effect/事件回调里以
  // props.useInput(selector) 形式调用（会抛 Invalid hook call → 草稿读空）。
  // 这里只用 getState + subscribe 做同步，全程不调用 hook。
  react.useEffect(() => {
    const readDraft = (): string => {
      try {
        const u: any = (props as any).useInput
        if (u && typeof u.getState === 'function') return (u.getState()?.draft) || ''
      } catch (e) { /* ignore */ }
      try {
        if (typeof document !== 'undefined') {
          const ae = document.activeElement as HTMLTextAreaElement | null
          if (ae && ae.tagName === 'TEXTAREA') {
            try { if (ae.closest && ae.closest('[data-dsh-prompt-modal]')) return '' } catch (e) { /* ignore */ }
            return ae.value || ''
          }
        }
      } catch (e) { /* ignore */ }
      return ''
    }
    const push = () => {
      try { setSmartInput({ sessionId: (props as any).sessionId, draft: readDraft(), useInput: (props as any).useInput, actions: (props as any).inputActions }) } catch (e) { /* ignore */ }
    }
    push()
    let unsub: any = null
    try {
      const u: any = (props as any).useInput
      if (u && typeof u.subscribe === 'function') unsub = u.subscribe(push)
    } catch (e) { /* ignore */ }
    // 轮询兜底：宿主未提供 subscribe（或 subscribe 不覆盖草稿变更）时，桥也必须保持新鲜——
    // 悬浮卡在 DOM 读不到草稿时正是靠这份桥草稿出卡（见 smart.ts currentDraftInfo）。
    // setSmartInput 对同值载荷去重，轮询不会引发额外重渲染。
    const timer = setInterval(push, 300)
    return () => {
      try { if (typeof unsub === 'function') unsub() } catch (e) { /* ignore */ }
      try { clearInterval(timer) } catch (e) { /* ignore */ }
    }
  }, [(props as any).sessionId, (props as any).useInput, (props as any).inputActions])
  // 会话卸载 → 清空输入桥（悬浮卡回到纯点状态）
  react.useEffect(() => {
    const sid = props.sessionId
    return () => { if (sid !== undefined) setSmartInput({ draft: '' }) }
  }, [props.sessionId])
  if (!open) return null
  // #21 R2：浮层经 PanelPortal 挂到 body，逃离 input.overlay slot 祖先层叠上下文（真机 R1 定位）
  return h(PanelPortal, null, h(TemplateBrowser, { compact: true, useInput: props.useInput, inputActions: props.inputActions }))
}

// ── #158 名字染色描边（地图 #151）：八向 1px text-shadow + 宿主正文令牌 ──────────────
/**
 * 注入染色描边样式段（CSS 本体在 `panel.ts` 的 `INK_TINT_CSS`，与钩子属性同一处；这里只做注入机制）。
 * 三条「不这么写」的原因：① 内联 textShadow 优先级高于注入规则，会把方案焊死；② `@media
 * (prefers-color-scheme)` 在纯浏览器里反映的是 OS 而不是手动选的主题（桌面端被 nativeTheme 同步、
 * 浏览器端不会）⇒ 一律用令牌；③ 不用 `-webkit-text-stroke`：外露环只有半像素、DPR 1.25 时实心环
 * 掉 77%，且不带 `paint-order` 会把字心填色吃光（研究 152 §1/§3/§4）。
 * 为什么注入点在这里而不是 panel.ts：`panel.ts:47-52` 记着「往该文件加 import 边会让既有回归脚本
 * 全部找不到模块」的代价（`./styleOwnership` 是 10+ 张手抄表的共同依赖）；index.ts 没有回归脚本把它
 * 当手抄根，这条边零外溢。归属走 styleOwnership 的共用注入缝（`data-plugin='dsh-prompt'` + 私有标记，
 * 幂等、同值不重写）；页面级只注一次，回收交给宿主样式账本，不随会话拆装。
 */
const INK_STYLE_MARKER = 'ink-tint'
function applyInkTintStyle(): void {
  try {
    const doc = styleDocument()
    if (!doc) return
    applyOwnedStyle(doc, INK_STYLE_MARKER, INK_TINT_CSS)
  } catch (e) { /* fail-soft：样式注入永不影响装配 */ }
}
/**
 * 取色浮层的交互反馈样式段（CSS 本体在 `panel.ts` 的 `INK_UI_CSS`）：可点控件的 hover / active /
 * focus 反馈，同样走归属缝注入（另一条私有标记，互不覆盖），页面级只注一次。
 */
const INK_UI_STYLE_MARKER = 'ink-ui'
function applyInkUiStyle(): void {
  try {
    const doc = styleDocument()
    if (!doc) return
    applyOwnedStyle(doc, INK_UI_STYLE_MARKER, INK_UI_CSS)
  } catch (e) { /* fail-soft：样式注入永不影响装配 */ }
}

export function apply(ctx: ClientContext): void {
  // 日志能力（#49）：先建日志器（本地开关秒显），再向宿主对账（以宿主为准），最后才写第一条事件。
  const log = startLog()
  log.reconcile().catch(() => undefined)
  // entryCount = 下面 `ctx.effect` 无条件注册数（#127 删自研更新后 update-auto 退出，8→7；
  // 现为：store/remote/字桥/entry/panel/settings/smart；/prompt 源按宿主能力条件注册，不计）
  log.log('app.boot', { hasReact: !!getReact(), lang: getLang(), entryCount: 7 })
  // #137：语言面装配 —— 宿主语言中枢（ctx.locale）经 ctx.get 免声明读取（**不加 inject**），
  // 包成 { getActive, subscribe } 适配器装进 locale.ts 的共享单例订阅器；html[lang] 兜底观察者
  // 由订阅器自己挂。插件侧只读 + 订阅，**绝不写回** html[lang]（宿主 syncDocumentLanguage 是它
  // 唯一主人，见 docs/adr/0006）。宿主面缺席（旧宿主/无 DOM）也不影响：回落 html[lang] → navigator。
  ctx.effect(() => {
    let localeSvc: any = undefined
    try { localeSvc = (ctx as any).get ? (ctx as any).get('locale') : undefined } catch (e) { localeSvc = undefined }
    let adapter: any = undefined
    if (localeSvc && typeof localeSvc.getSnapshot === 'function') {
      adapter = {
        getActive: (): string => {
          try { return (localeSvc.getSnapshot() || {}).active || '' } catch (e) { return '' }
        },
        subscribe: (fn: () => void): any => {
          try { return typeof localeSvc.subscribe === 'function' ? localeSvc.subscribe(fn) : undefined } catch (e) { return undefined }
        },
      }
    }
    const uninstall = installLocaleService(adapter)
    return () => { uninstall() }
  }, 'dsh-prompt: locale')
  // #20：client 启动即拉 host 快照（失败 warn + 内存默认，不阻塞装配）
  ctx.effect(() => { ensureLoaded().catch(() => undefined) }, 'dsh-prompt: store load')
  // #82：远程偏好同理（总闸默认关，host 不可达时当次默认、下次恢复默认并明示）
  ctx.effect(() => {
    ensureRemoteLoaded()
      // #110 陈旧值修复：刷新后远程仍开着的话，把整机方向读回来一次——否则本会话的「自动」档
      // 只会拿到面板永不询问的缓存（空 → 视口回落；旧值 → 系统早转过了还在说谎）。
      .then(() => {
        try {
          if (getRemotePrefs().enabled !== true) return
          warmEnvOrientation(() => getSystemOrientation() as unknown as Promise<any>).catch(() => undefined)
        } catch (e) { /* ignore */ }
      })
      .catch(() => undefined)
  }, 'dsh-prompt: remote load')
  // #92/#148：宿主内容字跟随（野路子）：开则注入自家覆盖段（body 变量 !important）、关则摘段，
  // 零宿主行内写入（写它就是删宿主的真相，见 #148）；
  // 工作区列表跟随（D-targeted 二期）：同订阅同路，开注 zoom 关摘，无新设置 UI；
  // 主会话 AI 跟随（#103 野路子三期）：同订阅同路，开注 zoom 关摘，无新设置 UI；
  // 三条桥都无新日志事件名（沿用 setRemoteEnabled/Size 已有事件）。
  ctx.effect(() => {
    const sync = (): void => {
      try {
        const p = getRemotePrefs()
        syncHostFont(p.enabled, p.size)
        syncRemoteRows(p.enabled, p.size)
        syncAssistantZoom(p.enabled, p.size)
      } catch (e) { /* fail-soft：宿主字桥永不影响装配 */ }
    }
    try { sync() } catch (e) { /* ignore */ }
    let off: undefined | (() => void)
    try { off = subscribeRemote(sync) } catch (e) { off = undefined }
    // 清场（#148 审查补）：先退订再摘自家覆盖段——!important 段不能只靠宿主账本兜底，
    // 归属一旦失配就没有第二条摘除路径（见 hostfont.ts clearHostBridges）。
    return () => {
      try { if (typeof off === 'function') off() } catch (e) { /* ignore */ }
      clearHostBridges()
    }
  }, 'dsh-prompt: host font sync')
  // #76：启动即挂落点采样（selectionchange / focusin）。必须早于用户打字 ——
  // 只在点击时才挂监听的话，"用户编辑期的最后落点"根本没人记，失焦后的漂移就无从纠正。
  // 不走 ctx.effect：这两个监听是页面生命周期级的、只挂一次（内部有幂等闩），没有按会话
  // 拆装语义，包一层 effect 只会得到一个假的 teardown。
  armInputFocusTrack()
  // #158：染色描边样式段（幂等、页面级）。不走 ctx.effect：与上面两个监听同理 —— 它是页面生命周期级的
  // 一次性注入，没有按会话拆装语义，包一层 effect 只会得到一个假的 teardown；回收由宿主样式账本负责。
  applyInkTintStyle()
  // 取色浮层的交互反馈样式段（同归属缝、另一条标记；同样页面级一次）。
  applyInkUiStyle()
  // 入口按钮（input.left；开合状态跟随面板）
  ctx.effect(() => ctx.slots.inject('conversation.input.left', () =>
    ctx.slots.register({ name: 'conversation.input.left', id: 'dsh-prompt-entry', order: 10, label: () => 'dsh-prompt' },
      (props: any) => {
        const react = getReact()
        if (!react) return null
        const h = react.createElement
        const openState = react.useState(isPanelOpen())
        react.useEffect(() => onPanelOpen((v) => openState[1](v)), [])
        // #94：宿主右侧边栏面（ctx.sidebarRight，可晚到/缺席 → 缺席时键隐藏，fail-soft）；
        // #104：左面（ctx.sidebarLeft，休眠契约：无面隐藏）+ 工作区/会话机会面
        // （ctx.sessions / ctx.workspaces / ctx.uiWorkspace，双满足才出现挑选器入口）；
        // 每次 render 重探，晚到服务在下一次重渲染时自然接上。
        let sidebarCtl: any = undefined
        let sidebarLeftCtl: any = undefined
        let workspaceSessions: any = undefined
        let workspaceList: any = undefined
        let workspaceUI: any = undefined
        try { sidebarCtl = (ctx as any).get ? (ctx as any).get('sidebarRight') : undefined } catch (e) { sidebarCtl = undefined }
        try { sidebarLeftCtl = (ctx as any).get ? (ctx as any).get('sidebarLeft') : undefined } catch (e) { sidebarLeftCtl = undefined }
        try { workspaceSessions = (ctx as any).get ? (ctx as any).get('sessions') : undefined } catch (e) { workspaceSessions = undefined }
        try { workspaceList = (ctx as any).get ? (ctx as any).get('workspaces') : undefined } catch (e) { workspaceList = undefined }
        try { workspaceUI = (ctx as any).get ? (ctx as any).get('uiWorkspace') : undefined } catch (e) { workspaceUI = undefined }
        return h(EntryButton, {
          open: openState[0],
          sidebarCtl,
          sidebarLeftCtl,
          workspaceSessions,
          workspaceList,
          workspaceUI,
          sessionId: (props as any).sessionId,
        })
      }),
  ), 'dsh-prompt: entry')

  // 面板浮层
  ctx.effect(() => ctx.slots.inject('conversation.input.overlay', () =>
    ctx.slots.register({ name: 'conversation.input.overlay', id: 'dsh-prompt-panel', order: 2, label: () => 'dsh-prompt panel' }, PanelHost),
  ), 'dsh-prompt: panel')

  // 设置页（直属设置面板的配置页，非插件子类）：智能开关 + 模板管理
  ctx.effect(() => ctx.slots.inject('settings.section', () =>
    ctx.slots.register({ name: 'settings.section', id: 'dsh-prompt-toolbox', priority: 10, order: 50, label: () => tr(getLang(), STR.sectionName) }, SettingsPage),
  ), 'dsh-prompt: settings')

  // 面板「设置 → 模板管理」：打开宿主设置面板并选中本插件配置页（宿主无插件级 open API）。
  // #82：同一份 DOM 触发另挂 globalThis.__dshPromptGoSettings，供 remote.openRemoteSettings 兜底复用；
  // 稳定直达（#87 H2）落地前一律走此兜底并由调用方明示。
  // 2026-09-29 加固（真机反馈齿轮点不开）：旧实现只点一次+150ms 硬等，宿主弹窗稍慢即静默失败。
  // #149 与宿主侧对账后的二次加固（真机反馈「点开没反应」）：
  //   宿主 SettingsRoot 渲染的是壳层按钮 chrome —— `<button aria-haspopup="dialog" aria-expanded
  //   onClick={actions.open}>`，内容为 renderSlot("settings.trigger", { wide })；该槽位契约
  //   （packages/client/ui-settings/src/client/contract/slots.ts）写明内容是"icon + label，
  //   窄栏（rail）时 label 视觉隐藏"——即按钮的可访问名来自槽内容而非固定文案，贡献缺席时更会
  //   退化成"没有可访问名的图标钮"。旧实现只拿 textContent 认「设置/Settings」：窄栏、文案变动、
  //   贡献缺席任一情形都会让 trig 落空 → 一次都没点，而面板已经先关了，于是"点开没反应"。
  //   现在按 aria-label / title / 可见文本三处认，再退到类名含 trigger / 带 aria-keyshortcuts 的那枚；
  //   设置页已开则免触发直达本插件页；结果经 done(ok) 回给调用方（失败由面板原位提示 + 日志，绝不静默）。
  const SETTINGS_TRIGGER_LABEL_RE = /设置|Settings/i
  const goSettings = (done?: (ok: boolean) => void): void => {
    const finish = (ok: boolean): void => {
      // 事件沿用 remote.direct.open（同一条 DOM 兜底路径上 remote.ts 已在用，字段就 method/ok 两个，清单声明内）
      if (!ok) logEvent('remote.direct.open', { method: 'dom', ok: false })
      if (done) { try { done(ok) } catch (e) { /* ignore */ } }
    }
    try {
      if (typeof document === 'undefined') { finish(false); return }
      const label = tr(getLang(), STR.sectionName)
      // #150：候选先排除本插件自己的铬。面板里那枚设置入口的 title/aria 就是全称（含「设置/Settings」），
      // 不排掉它，「找不到宿主触发器」时最后的 allButtons().find(named) 会命中它自己 → 自点自 → 同步递归到栈溢出。
      const isOwnChrome = (b: HTMLElement): boolean => {
        try {
          if (b.hasAttribute && b.hasAttribute('data-dsh-prompt-chrome')) return true
          return !!(b.closest && b.closest('[data-dsh-prompt-bar]'))
        } catch (e) { return false }
      }
      const allButtons = (): HTMLElement[] => {
        try { return (Array.prototype.slice.call(document.querySelectorAll('button')) as HTMLElement[]).filter((b) => !isOwnChrome(b)) } catch (e) { return [] }
      }
      const clickCell = (): boolean => {
        try {
          const cell = allButtons().find((b) => (b.textContent || '').trim() === label)
          if (!cell) return false
          cell.click()
          let tries = 0
          const scroller = setInterval(() => {
            try {
              const el = document.querySelector('[data-dsh-prompt-remote-section]')
              if (el && typeof (el as any).scrollIntoView === 'function') {
                (el as any).scrollIntoView({ block: 'start' })
                clearInterval(scroller)
              } else if (++tries > 10) clearInterval(scroller)
            } catch (e) { clearInterval(scroller) }
          }, 200)
          return true
        } catch (e) { /* ignore */ }
        return false
      }
      // 设置页已开（本插件名可见）→ 直达，不碰入口。
      if (clickCell()) { finish(true); return }
      // ① 宿主自己的 settings.open 命令（dsh-client-ui-settings-general 注册，run() = 设置壳 actions.open()）。
      //    **不能写成 ctx.shortcuts.invoke**：shortcuts 这个 Service 对外只有 dispatch（键盘适配），
      //    invoke 在它内部持有的 ShortcutRegistry 上（dsh-client-shortcuts/lib/client.js:644，
      //    服务在 :1867 `this.registry = new ShortcutRegistry(...)`），服务本身没有这个成员。
      //    另外它**没有返回值**（命令不存在就地 return）⇒ 只当"点火"，成功与否一律交给后面的轮询判定，
      //    绝不拿它短路 DOM 兜底 —— 否则命令改名/静默无效时就成了"一次都没点"的老毛病。
      const hostOpenSettings = (): boolean => {
        try {
          const sc = (ctx as any).shortcuts
          const reg = sc && sc.registry
          if (!reg || typeof reg.invoke !== 'function') return false
          reg.invoke('settings.open', { modal: null })
          return true
        } catch (e) { return false }
      }
      // ② 侧栏 launcher 锚点 → 菜单项两步。2026-10-15 真机复现的根因：宿主壳层把 sidebar.settings 的
      //    settings.launcher 声明成**单槽**（settings-general 的 children 表），而本构建里它被
      //    dsh-client-ui-settings-account 的 AccountMenu 占着（button[aria-haspopup="menu"] /
      //    aria-label=「账号菜单（Account menu）」）——settings-general 里那枚 aria-haspopup="dialog" 的
      //    兜底按钮**根本不会渲染**，于是旧的 dialog 三条候选全落空 ⇒ 一次都没点，面板原位提示失败。
      //    菜单项由 primitives Menu 渲染成 button[role="menuitem"]，宿主给「设置」项挂了 settingsShortcut
      //    ⇒ aria-keyshortcuts，文案走它自己的词表（设置/Settings），两条都认。
      const launcherAnchor = (): HTMLElement | null => {
        try {
          const row = document.querySelector('[class*="triggerRow"]')
          const btn = row ? (row.querySelector('button[aria-haspopup]') || row.querySelector('button')) : null
          return btn && !isOwnChrome(btn as HTMLElement) ? (btn as HTMLElement) : null
        } catch (e) { return null }
      }
      const settingsMenuItem = (): HTMLElement | null => {
        try {
          const items = (Array.prototype.slice.call(document.querySelectorAll('button[role="menuitem"]')) as HTMLElement[])
            .filter((b) => !isOwnChrome(b))
          return items.find((b) => SETTINGS_TRIGGER_LABEL_RE.test((b.textContent || '').trim()))
            || items.find((b) => !!b.getAttribute('aria-keyshortcuts'))
            || null
        } catch (e) { return null }
      }
      // 认触发器：aria-label / title / 可见文本任一处命中「设置/Settings」（图标钮只在前两处有字）。
      const named = (b: HTMLElement): boolean => {
        const hay = [b.getAttribute('aria-label'), b.getAttribute('title'), (b.textContent || '').trim()]
          .filter((s) => !!s).join(' ')
        return SETTINGS_TRIGGER_LABEL_RE.test(hay)
      }
      const dialogTriggers = (): HTMLElement[] => {
        try { return (Array.prototype.slice.call(document.querySelectorAll('button[aria-haspopup="dialog"]')) as HTMLElement[]).filter((b) => !isOwnChrome(b)) } catch (e) { return [] }
      }
      const trig = dialogTriggers().find(named)
        || dialogTriggers().find((b) => /trigger/i.test(String((b as any).className || '')))
        || dialogTriggers().find((b) => !!b.getAttribute('aria-keyshortcuts'))
        || allButtons().find(named)
      // 开设置：宿主命令 → launcher 两步 → 旧 dialog 触发器，三条互补，任一走通即可（都不在则立即失败留痕）。
      // 点火顺序：① 宿主命令（不碰 DOM、无声、无返回）→ ② 侧栏 launcher 锚点（账号菜单里那项「设置」）
      // → ③ 旧 dialog 触发器。① 点着了就**先别点 DOM**（设置已经开了，再点锚点只会弹出一层菜单）；
      // 轮询到 ~1.2 秒还没开，才把 ②③ 补上 —— 既不牺牲快路径，也不放过静默失效。
      const commandSent = hostOpenSettings()
      const anchor = launcherAnchor()
      if (!commandSent && !anchor && !trig) { finish(false); return }
      const clickDomEntries = (): void => {
        if (anchor) { try { anchor.click() } catch (e) { /* ignore */ } }
        if (trig) { try { trig.click() } catch (e) { /* ignore */ } }
      }
      if (!commandSent) clickDomEntries()
      // 轮询等导航项挂载（宿主弹窗动画/本插件页注册都可能慢），最多约 3.6 秒。
      let n = 0
      const tid = setInterval(() => {
        try {
          if (clickCell()) { clearInterval(tid); finish(true); return }
          n += 1
          // 菜单形态：锚点点开的是账号菜单，里面那项「设置」才是真入口（取到就点；菜单收起后自然取不到）。
          const item = settingsMenuItem()
          if (item) { try { item.click() } catch (e) { /* ignore */ } }
          // ~1.2 秒还没开：把没走通的入口补一遍（宿主命令静默无效 / 首次点空 / 焦点被抢）。
          // 重发宿主命令是安全的：这里传的是 { modal: null }，而宿主 resolve 只在 modal === 'settings'
          // 时才走 closeTopModal 分支、否则一律 shellInstance.actions.open()（已开＝无操作）
          // （宿主 settings-general/lib/client.js:1097-1107）⇒ 不会把用户自己开的设置反关。
          // 菜单已弹开时不再补点锚点，免得把菜单又收回去。
          if (n === 6) {
            hostOpenSettings()
            if (!item) clickDomEntries()
          }
          if (n > 18) { clearInterval(tid); finish(false) }
        } catch (e) { try { clearInterval(tid) } catch (err) { /* ignore */ } finish(false) }
      }, 200)
    } catch (e) { finish(false) }
  }
  setGoSettingsHandler(goSettings)
  try { (globalThis as any).__dshPromptGoSettings = goSettings } catch (e) { /* ignore */ }

  // /prompt 触发源（#9）：列出预制+自定义模板，支持过滤（标签/搜索），选中即插入
  if (ctx.inputTriggers && typeof ctx.inputTriggers.registerSource === 'function') {
    ctx.effect(() => ctx.inputTriggers.registerSource(buildPromptSource()), 'dsh-prompt: /prompt source')
  }

  // 智能模式悬浮卡（#10）：shell.overlay root 作用域 — 全局单点/自由拖动/仅命中出现
  ctx.effect(() => ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register({ name: 'shell.overlay', id: 'dsh-prompt-smart', order: 200, label: () => 'dsh-prompt smart' }, SmartCardHost),
  ), 'dsh-prompt: smart card')

}

/** 记一条日志事件（槽机制与 panel.ts/remote.ts 同构：#149 起「设置→模板管理」失败不再静默）。 */
function logEvent(event: string, fields?: Record<string, unknown>): void {
  try {
    const log = (globalThis as any).__dshPromptLog
    if (log && typeof log.log === 'function') log.log(event, fields)
  } catch (e) { /* ignore */ }
}
