/**
 * dsh-prompt — client 入口（v1 常规模式 + v1.1 智能模式）
 * 装配：input.left 入口按钮 / input.overlay 面板浮层 / settings.section 配置页（直属设置面板）/ inputTriggers /prompt 触发源（#9）/ shell.overlay 智能悬浮卡（#10）
 */
import { getReact, TemplateBrowser, PanelPortal, setGoSettingsHandler, armInputFocusTrack } from './panel'
import { EntryButton } from './button'
import { SettingsPage } from './settings'
import { UpdateEntry } from './update'
import { buildPromptSource } from './trigger'
import { SmartCardHost } from './smart'
import { setSmartInput } from './smartstore'
import { ensureLoaded } from './store'
import { ensureRemoteLoaded, subscribeRemote, getRemotePrefs } from './remote'
import { syncHostFont, syncRemoteRows, syncAssistantZoom } from './hostfont'
import { getLang, tr, STR } from './i18n'
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

/**
 * 更新自动检查宿主（#41 建、#89 改周期）：全局单点（shell.overlay）、启动即挂 —— 挂载后先延迟一把再查，
 * 之后按固定周期复查，有新版本才弹 #40 那只弹窗（`auto` 模式只出弹窗、不出设置页那一行）。
 *
 * 为什么放在 shell.overlay 而不是 conversation.input.overlay：会话说白了可以有多个，
 * 而「后台按周期查」这件事每台机器只该有一摊调度（电话与弹窗都不该按会话翻倍；见 updauto.ts 的模块级调度）。
 */
function UpdateAutoHost(): any {
  const react = getReact()
  if (!react) return null
  return react.createElement(UpdateEntry, { auto: true })
}

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

export function apply(ctx: ClientContext): void {
  // 日志能力（#49）：先建日志器（本地开关秒显），再向宿主对账（以宿主为准），最后才写第一条事件。
  const log = startLog()
  log.reconcile().catch(() => undefined)
  // entryCount = 下面 `ctx.effect` 无条件注册数（#41 5→6 后 smart/update-auto/字桥陆续加入未补数；
  // #92 补齐为 8：store/remote/字桥/entry/panel/settings/smart/update-auto；/prompt 源按宿主能力条件注册，不计）
  log.log('app.boot', { hasReact: !!getReact(), lang: getLang(), entryCount: 8 })
  // #20：client 启动即拉 host 快照（失败 warn + 内存默认，不阻塞装配）
  ctx.effect(() => { ensureLoaded().catch(() => undefined) }, 'dsh-prompt: store load')
  // #82：远程偏好同理（总闸默认关，host 不可达时当次默认、下次恢复默认并明示）
  ctx.effect(() => { ensureRemoteLoaded().catch(() => undefined) }, 'dsh-prompt: remote load')
  // #92：宿主内容字跟随（野路子）：开则双写变量、关则两边 removeProperty 恢复原样；
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
    try { return subscribeRemote(sync) } catch (e) { return undefined }
  }, 'dsh-prompt: host font sync')
  // #76：启动即挂落点采样（selectionchange / focusin）。必须早于用户打字 ——
  // 只在点击时才挂监听的话，"用户编辑期的最后落点"根本没人记，失焦后的漂移就无从纠正。
  // 不走 ctx.effect：这两个监听是页面生命周期级的、只挂一次（内部有幂等闩），没有按会话
  // 拆装语义，包一层 effect 只会得到一个假的 teardown。
  armInputFocusTrack()
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

  // 面板「设置 → 模板管理」：当前 v1 关闭面板即可（设置页经 ⚙ → 插件 → dsh-prompt 到达）
  // 面板「设置 → 模板管理」：打开设置面板并选中本插件配置页（宿主无全局 open API → DOM 触发侧栏设置按钮 + 导航项）
  // #82：同一份 DOM 触发另挂 globalThis.__dshPromptGoSettings，供 remote.openRemoteSettings 兜底复用；
  // 稳定直达（#87 H2）落地前一律走此兜底并由调用方明示。
  // 2026-09-29 加固（真机反馈齿轮点不开）：旧实现只点一次+150ms 硬等，宿主弹窗稍慢即静默失败。
  // 新实现：已开设置页则直点本插件名；否则点设置触发后轮询等导航项出现再点，命中远程段后滚入视野。
  const goSettings = (): void => {
    try {
      if (typeof document === 'undefined') return
      const label = tr(getLang(), STR.sectionName)
      const clickCell = (): boolean => {
        try {
          const cells = Array.prototype.slice.call(document.querySelectorAll('button')) as HTMLElement[]
          const cell = cells.find((b) => (b.textContent || '').trim() === label)
          if (cell) {
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
          }
        } catch (e) { /* ignore */ }
        return false
      }
      // 设置页已开（本插件名可见）→ 直达，不碰触发按钮。
      if (clickCell()) return
      const btns = Array.prototype.slice.call(document.querySelectorAll('button[aria-haspopup="dialog"]')) as HTMLElement[]
      const trig = btns.find((b) => /设置|Settings/.test((b.textContent || '').trim()))
        || (Array.prototype.slice.call(document.querySelectorAll('button')) as HTMLElement[])
          .find((b) => /设置|Settings/.test((b.textContent || '').trim()))
      if (trig) trig.click()
      // 轮询等导航项挂载（宿主弹窗动画慢也不丢），最多约 2 秒。
      let n = 0
      const tid = setInterval(() => {
        try {
          if (clickCell() || ++n > 10) clearInterval(tid)
        } catch (e) { try { clearInterval(tid) } catch (err) { /* ignore */ } }
      }, 200)
    } catch (e) { /* ignore */ }
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

  // 更新自动检查（#41 建、#89 改周期）：同一个 shell.overlay 槽的第二个注册点，启动延迟首次＋固定周期（见 UpdateAutoHost）
  ctx.effect(() => ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register({ name: 'shell.overlay', id: 'dsh-prompt-update-auto', order: 210, label: () => 'dsh-prompt update auto' }, UpdateAutoHost),
  ), 'dsh-prompt: update auto')
}
