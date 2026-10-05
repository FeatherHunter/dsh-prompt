/**
 * dsh-prompt — 设置页（模板管理 + 智能开关 + 日志三入口）
 *
 * 版式规则（#51 落地、#52 按"一致性优先"重修）：这一页寄居在 DSH 的设置对话框里，
 * 只继承宿主的设计语言（--dsw-* 变量），不发明第二套视觉。页面由两个原语搭出来，
 * 避免"每块各写各的 div"导致多条左边缘与散装间距：
 *   SettingRow   一行：标签 + 右侧控件，说明文字缩进到标签列
 *   SettingGroup 一组：有边框的卡片 + 组标题，组内间距统一（4/8/12/16/24 这个比例）
 * 不可逆操作（清空日志）不与常规操作平权：单独一行、默认低调、hover 才显示危险色，并两步确认。
 */
import { getReact, TemplateBrowser } from './panel'
import { SettingsHeaderLinks, AuthorPlugins } from './about'
import { UpdateEntryButton, UpdatePanelEmbedded } from './update-http'

import { isSmartEnabled, setSmartEnabled } from './smartstore'
import {
  getRemotePrefs, subscribeRemote, ensureRemoteLoaded,
  setRemoteEnabled, setRemoteSize, setRemoteOrientation, setRemoteDensity,
  getRemotePersistState,
  getEnvOrientation, setEnvOrientation, warmEnvOrientation,
  type RemoteOrientationPref, type RemoteDensity,
} from './remote'
import { remoteSizeScale, resolveEffectiveOrientation, deriveRemoteOrientation, scaledBaseFontSize } from './remoteView'
import { setSystemOrientation, getSystemOrientation, isSystemOrientation } from './systemOrientation'
import { getLang, tr, STR } from './i18n'

/** 取日志能力（装在槽里的那个实例）；能力缺席时返回 null，界面据此走「不可用」分支，不静默。 */
function logCap(): any {
  try {
    const log = (globalThis as any).__dshPromptLog
    return log && typeof log.log === 'function' ? log : null
  } catch (e) {
    return null
  }
}

const TOK = {
  labelPrimary: 'var(--dsw-alias-label-primary)',
  labelSecondary: 'var(--dsw-alias-label-secondary)',
  labelTertiary: 'var(--dsw-alias-label-tertiary)',
  bgLayer: 'var(--dsw-alias-bg-layer-3)',
  bgHover: 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.06))',
  border: 'var(--dsw-alias-border-l1)',
  accent: 'var(--dsw-specific-accent,#f0a45c)',
  danger: 'var(--dsw-specific-danger,#e06c75)',
  font: 'var(--dsw-font-family)',
}

/** 一行：标签在左、控件在右，说明占满行宽正常流排（此前 maxWidth:520 在宽弹窗里半屏换行）。 */
function SettingRow(props: any): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  const kids: any[] = [
    h('div', { key: 'head', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } }, [
      h('span', { key: 'label', style: { fontFamily: TOK.font, fontSize: '0.93em', color: TOK.labelPrimary } }, props.label),
      props.control ? h('span', { key: 'control', style: { display: 'inline-flex', alignItems: 'center' } }, props.control) : null,
    ]),
  ]
  if (props.description) {
    kids.push(h('div', { key: 'desc', style: { fontFamily: TOK.font, fontSize: '0.86em', lineHeight: 1.65, color: TOK.labelTertiary } }, props.description))
  }
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0' } }, kids)
}

/**
 * 组卡片外壳：边框 + 圆角 + 组外边距。**一处定义**，SettingGroup 与「模板列表」那张卡共用
 * （#77 收尾：模板区此前是一条裸行，夹在两张有壳的卡片之间显得格格不入 —— 现在它也是卡片）。
 * `pad` 可覆盖内边距：内嵌自带 padding 的组件时用更小的值把内容左轨配平到 14px。
 */
const cardStyle = (pad: string): any => ({
  border: '1px solid ' + TOK.border, borderRadius: 12, padding: pad, margin: '14px 0 4px',
  display: 'flex', flexDirection: 'column', fontFamily: TOK.font,
})

/** 一组：卡片 + 组标题，组内元素由调用方给，间距由这里统一。 */
function SettingGroup(props: any): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  return h('section', {
    style: cardStyle(props.pad || '2px 14px 12px'),
  }, [
    props.title ? h('div', {
      key: 'title',
      style: { fontSize: '0.86em', fontWeight: 600, color: TOK.labelSecondary, padding: '12px 0 0', letterSpacing: 0.2 },
    }, props.title) : null,
    ...(props.children || []),
  ])
}

/** 按钮：三种权重（常规 / 次级 / 危险）。内联样式没有 hover，用一个极小的悬停态实现。 */
function Btn(props: any): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  const tone = props.tone || 'normal'
  const hoverState = react.useState(false)
  const hover = hoverState[0]
  const base: any = {
    fontFamily: TOK.font, fontSize: '0.89em', padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
    transition: 'background-color .12s ease, color .12s ease, border-color .12s ease',
  }
  const style = tone === 'ghost'
    ? { ...base, border: '1px solid transparent', background: hover ? TOK.bgLayer : 'transparent', color: hover ? TOK.labelPrimary : TOK.labelSecondary }
    : tone === 'danger'
      ? { ...base, border: '1px solid ' + (hover ? TOK.danger : TOK.border), background: 'transparent', color: hover ? TOK.danger : TOK.labelSecondary }
      : { ...base, border: '1px solid ' + TOK.border, background: hover ? TOK.bgHover : TOK.bgLayer, color: TOK.labelPrimary }
  // #110 收尾：透传 title/disabled/data-*/aria-*（设为默认按钮要挂钩子与说明；既有用法定制不改）。
  const extra: any = {}
  try {
    if (props.title !== undefined) extra.title = props.title
    if (props.disabled !== undefined) extra.disabled = props.disabled
    for (const k of Object.keys(props || {})) {
      if (k.indexOf('data-') === 0 || k.indexOf('aria-') === 0) extra[k] = (props as any)[k]
    }
  } catch (e) { /* ignore */ }
  return h('button', {
    type: 'button',
    style: props.disabled ? { ...style, cursor: 'not-allowed', opacity: 0.6 } : style,
    onMouseEnter: () => hoverState[1](true),
    onMouseLeave: () => hoverState[1](false),
    onClick: props.onClick,
    ...extra,
  }, props.children)
}

/** 复选框：宿主风格的圆角小方框（accent-color 跟随主题），不再是自己画一个控件。
 * 尺寸走 em 吃设置页根 scale（远程开大档一起变大）；flex:none 保命中区不小于框体。
 * 原生 input 不继承 font-size（UA 样式自带字号），em 会锚死在默认字号上跟档无感，
 * 故显式 fontSize:inherit 把父级（已随档缩放的根）字号接进来；关=根回基准，原样。 */
function Check(props: any): any {
  const react = getReact()
  if (!react) return null
  return react.createElement('input', {
    type: 'checkbox',
    checked: props.checked,
    disabled: props.disabled,
    style: { width: '1.15em', height: '1.15em', flex: 'none', fontSize: 'inherit', accentColor: TOK.accent, cursor: props.disabled ? 'not-allowed' : 'pointer', margin: 0 },
    onChange: props.onChange,
  })
}

/** 下载文本为文件。返回是否成功（失败时调用方改走复制路径）。 */
function downloadText(text: string, fileName: string): boolean {
  try {
    if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') return false
    if (typeof URL.createObjectURL !== 'function') return false
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => { try { URL.revokeObjectURL(url) } catch (e) { /* ignore */ } }, 1000)
    return true
  } catch (e) {
    return false
  }
}

/** 复制到剪贴板（异步 API 不可用时退回临时 textarea）。返回是否成功。 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch (e) { /* 落到下面的兜底 */ }
  try {
    if (typeof document === 'undefined') return false
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const done = typeof document.execCommand === 'function' ? document.execCommand('copy') : false
    ta.remove()
    return !!done
  } catch (e) {
    return false
  }
}

export function SettingsPage(props: any): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  // 智能开关 state 随配置区暂藏而停用（persist 与 smart.ts 逻辑保留，接回即恢复）。
  // #82 远程偏好（总闸 + 字号/控件三档）：内存真相来源，host 快照到达后更新。
  const remoteState = react.useState(getRemotePrefs())
  const remote = remoteState[0]
  const persistState = react.useState(getRemotePersistState())
  const remotePersist = persistState[0]
  const log = logCap()
  const logOnState = react.useState(log ? !!log.getSwitch().enabled : false)
  const logOn = logOnState[0]
  const noteState = react.useState('')
  const note = noteState[0]
  const confirmState = react.useState(false)
  const confirming = confirmState[0]
  const lang = getLang()
  const t = (k: keyof typeof STR) => tr(lang, STR[k])

  const reasonText = (code?: string): string => {
    const key = code === 'host-unavailable' || code === 'host-unreachable' ? 'logReasonHost'
      : code === 'host-rejected' ? 'logReasonRejected'
        : code === 'switch-timeout' ? 'logReasonTimeout'
          : code === 'stale' ? 'logReasonStale'
            : 'logReasonOther'
    return t(key as keyof typeof STR)
  }

  // 开关状态变化（启动对账、写入成功、跨标签页广播）时刷新界面。
  react.useEffect(() => {
    const cap = logCap()
    if (!cap || typeof cap.subscribe !== 'function') return undefined
    return cap.subscribe(() => {
      try { logOnState[1](!!cap.getSwitch().enabled) } catch (e) { /* ignore */ }
    })
  }, [])
  // #82 远程偏好：启动拉 host 快照；变更经订阅刷新（含持久化失败明示位）。
  react.useEffect(() => {
    try { ensureRemoteLoaded().catch(() => undefined) } catch (e) { /* ignore */ }
    return subscribeRemote(() => {
      try {
        remoteState[1](getRemotePrefs())
        persistState[1](getRemotePersistState())
      } catch (e) { /* ignore */ }
    })
  }, [])
  // #110 检测统一 + 陈旧值修复：挂载预热环境方向缓存（缺席记负缓存，本会话不再问；
  // 用户显式锁定不受影响）。解析后刷一次界面，让有效值 caption 落到现值。
  react.useEffect(() => {
    try {
      warmEnvOrientation(() => getSystemOrientation() as unknown as Promise<any>).then(() => {
        try { remoteState[1](getRemotePrefs()) } catch (e) { /* ignore */ }
      })
    } catch (e) { /* ignore */ }
    return undefined
  }, [])
  // #82 配置键直达的落点：打开设置页后滚动到远程段（globalThis 钩子供 remote.openRemoteSettings 调用）。
  // 2026-09-29：自家设置弹窗同样挂载本组件；卸载时只清自己注册的钩子，不清别人的（多实例共存）。
  react.useEffect(() => {
    let mine: (() => void) | null = null
    try {
      const g = globalThis as any
      mine = () => {
        try {
          const go = g.__dshPromptGoSettings
          if (typeof go === 'function') go()
        } catch (e) { /* ignore */ }
        setTimeout(() => {
          try {
            if (typeof document === 'undefined') return
            const el = document.querySelector('[data-dsh-prompt-remote-section]')
            if (el && typeof (el as any).scrollIntoView === 'function') (el as any).scrollIntoView({ block: 'start' })
          } catch (e) { /* ignore */ }
        }, 300)
      }
      g.__dshPromptGoRemoteSettings = mine
    } catch (e) { /* ignore */ }
    return () => {
      try {
        const g = globalThis as any
        if (mine && g.__dshPromptGoRemoteSettings === mine) delete g.__dshPromptGoRemoteSettings
      } catch (e) { /* ignore */ }
    }
  }, [])

  const onToggleLog = async (next: boolean): Promise<void> => {
    const cap = logCap()
    if (!cap) { noteState[1](t('logUnavailable')); return }
    const res = await cap.setSwitch(next)
    logEvent('settings.log.switch', { on: !!res.enabled, ok: !!res.ok, reason: res.error ?? '' })
    if (!res.ok) {
      // 写失败保持旧值（不回退为开启）：界面显示的仍是宿主那份值。
      noteState[1](t('logSwitchFail') + reasonText(res.error))
      try { logOnState[1](!!cap.getSwitch().enabled) } catch (e) { /* ignore */ }
      return
    }
    logOnState[1](!!res.enabled)
    noteState[1](res.enabled ? t('logSwitchOn') : t('logSwitchOff'))
  }

  const onExport = async (): Promise<void> => {
    const cap = logCap()
    if (!cap) { noteState[1](t('logUnavailable')); return }
    noteState[1](t('logWorking'))
    const res = await cap.exportLog()
    if (!res.ok) { noteState[1](t('logExportFail') + reasonText(res.reason)); return }
    const text: string = res.text ?? ''
    if (!text) { noteState[1](t('logExportEmpty')); return }
    const name: string = res.fileName || 'dsh-prompt.log'
    const saved = downloadText(text, name)
    const where = res.path || res.dir || ''
    noteState[1](
      (saved ? t('logExportSaved') : t('logExportDownloadBlocked')) +
        ' ' + name + '（' + (res.bytes ?? text.length) + ' ' + t('logBytes') + '）' + (where ? ' · ' + where : ''),
    )
  }

  const onCopyPath = async (): Promise<void> => {
    const cap = logCap()
    if (!cap) { noteState[1](t('logUnavailable')); return }
    noteState[1](t('logWorking'))
    // 路径只能问宿主：只有宿主知道 $DSH_HOME / ~ / 降级后的临时目录。
    // 回参里的 path 是宿主用 node:path 拼出来的绝对路径——Windows 反斜杠、macOS 与 Linux 正斜杠，
    // 各平台拿到的就是本机原生写法（本仓不在浏览器里拼路径，也不假定分隔符）。
    const res = await cap.exportLog()
    if (!res.ok) { noteState[1](t('logExportFail') + reasonText(res.reason)); return }
    let target = String(res.path || '').trim()
    if (!target && res.dir) {
      const sep = String(res.dir).indexOf('\\') >= 0 ? '\\' : '/'
      target = String(res.dir).replace(/[\\/]+$/, '') + sep + String(res.fileName || '')
    }
    if (!target) { noteState[1](t('logPathFail')); return }
    const ok = await copyText(target)
    noteState[1](ok ? t('logPathCopied') + ' ' + target : t('logPathFail'))
  }

  const onClear = async (): Promise<void> => {
    const cap = logCap()
    if (!cap) { noteState[1](t('logUnavailable')); return }
    if (!confirming) { confirmState[1](true); noteState[1](t('logClearAsk')); return }
    confirmState[1](false)
    const res = await cap.clearLog('all')
    noteState[1](res.ok ? t('logClearOk') + ' ' + res.removed + ' ' + t('logFiles') : t('logClearFail'))
  }

  const dropped = (() => {
    try {
      const st = log && typeof log.status === 'function' ? log.status() : null
      return st ? st.dropped : 0
    } catch (e) {
      return 0
    }
  })()

  const noteStyle: any = { fontFamily: TOK.font, fontSize: '0.86em', lineHeight: 1.65, color: TOK.labelTertiary, paddingTop: 8 }

  // 去宿主化方向偏好控件：自动/横屏锁定/竖屏锁定三档单选（纯插件，持久化）
  // 锁定档背后先调 OS 真切（本插件 host 半自实现），busy 期禁用防连点。
  // #110 禁用态去强调色：禁用即无 accent、无半透明冒充（opacity 回 1），附需先开远程说明。
  const orientationControl = (
    current: RemoteOrientationPref,
    onPick: (v: RemoteOrientationPref) => void,
    busy: boolean,
    remoteOff: boolean,
  ): any => {
    const opts: RemoteOrientationPref[] = ['auto', 'landscape', 'portrait']
    const labelOf = (v: RemoteOrientationPref): string =>
      v === 'auto' ? t('remoteOrientationAuto') : v === 'landscape' ? t('remoteOrientationLandscape') : t('remoteOrientationPortrait')
    const dis = !!busy || !!remoteOff
    return h('div', { style: { display: 'flex', gap: 6 }, 'data-dsh-prompt-remote-orientation': '1' }, opts.map((v) =>
      h('button', {
        key: v,
        type: 'button',
        disabled: dis,
        'data-dsh-prompt-orientation': v,
        'aria-pressed': current === v ? 'true' : 'false',
        'aria-disabled': dis ? 'true' : 'false',
        title: dis ? t('remoteNeedOn') : undefined,
        style: dis
          ? {
            flex: 1, textAlign: 'center',
            fontFamily: TOK.font, fontSize: '0.86em', padding: '5px 12px', borderRadius: 8, cursor: 'not-allowed',
            border: '1px solid ' + TOK.border,
            background: 'transparent',
            color: TOK.labelTertiary,
            opacity: 1,
          }
          : {
            flex: 1, textAlign: 'center',
            fontFamily: TOK.font, fontSize: '0.86em', padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
            border: '1px solid ' + TOK.border,
            background: current === v ? TOK.accent : 'transparent',
            color: current === v ? '#fff' : TOK.labelPrimary,
            opacity: 1,
          },
        onClick: () => { if (!dis) onPick(v) },
      }, labelOf(v)),
    ))
  }

  // 密度档两段（#90，用户拍板）：12宫/8宫大卡，与方向偏好并列；默认 A；纯手动，禁任何自动切档逻辑。
  // #110 禁用态与方向偏好同规（去强调色 + 说明）。
  const densityControl = (
    current: RemoteDensity,
    onPick: (v: RemoteDensity) => void,
    remoteOff: boolean,
  ): any => {
    const opts: RemoteDensity[] = ['a', 'b']
    const labelOf = (v: RemoteDensity): string =>
      v === 'a' ? t('remoteDensityA') : t('remoteDensityB')
    return h('div', { style: { display: 'flex', gap: 6 }, 'data-dsh-prompt-remote-density': '1' }, opts.map((v) =>
      h('button', {
        key: v,
        type: 'button',
        disabled: !!remoteOff,
        'data-dsh-prompt-density': v,
        'aria-pressed': current === v ? 'true' : 'false',
        'aria-disabled': remoteOff ? 'true' : 'false',
        title: remoteOff ? t('remoteNeedOn') : undefined,
        style: remoteOff
          ? {
            flex: 1, textAlign: 'center', whiteSpace: 'nowrap',
            fontFamily: TOK.font, fontSize: '0.86em', padding: '5px 12px', borderRadius: 8, cursor: 'not-allowed',
            border: '1px solid ' + TOK.border,
            background: 'transparent',
            color: TOK.labelTertiary,
            opacity: 1,
          }
          : {
            flex: 1, textAlign: 'center', whiteSpace: 'nowrap',
            fontFamily: TOK.font, fontSize: '0.86em', padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
            border: '1px solid ' + TOK.border,
            background: current === v ? TOK.accent : 'transparent',
            color: current === v ? '#fff' : TOK.labelPrimary,
            opacity: 1,
          },
        onClick: () => { if (!remoteOff) onPick(v) },
      }, labelOf(v)),
    ))
  }

  // 方向偏好 OS 真切态：busy 防连点，note 记失败回落（成功静默，偏好高亮即是）。
  // fail-soft 内聚一处：自家锁定恒落地（当次有效 + 持久化），OS 成败只决定 note 文案。
  const orientBusyState = react.useState(false)
  const orientBusy = orientBusyState[0]
  const orientNoteState = react.useState('')
  const orientNote = orientNoteState[0]
  const landOrientation = (v: RemoteOrientationPref, note: string): void => {
    const next = setRemoteOrientation(v)
    remoteState[1]({ ...next })
    persistState[1](getRemotePersistState())
    orientNoteState[1](note)
    orientBusyState[1](false)
  }
  const onPickOrientation = (v: RemoteOrientationPref): void => {
    if (v === 'auto' || orientBusy) {
      if (v === 'auto' && !orientBusy) landOrientation('auto', '')
      return
    }
    if (!isSystemOrientation(v)) return
    orientBusyState[1](true)
    orientNoteState[1](t('remoteOrientationBusy'))
    // #110 改判：锁定即刻生效且**常驻**——退出远程不还原，用户最后锁的方向就是最终方向。
    // 整机成功即已知现值，复用为环境缓存（零新增调用），供 auto 与 caption 显示。
    const run = (async (): Promise<void> => {
      let r: any
      try {
        r = await setSystemOrientation(v)
      } catch (e) {
        r = { ok: false, error: { code: 'unknown', message: 'orientation-failed' } }
      }
      if (r && r.ok) {
        try { setEnvOrientation({ orientation: v }) } catch (e) { /* ignore */ }
        landOrientation(v, '')
      } else {
        const code = (r && r.error && r.error.code) || 'unknown'
        landOrientation(v, t('remoteOrientationOsFail').replace('{code}', code))
      }
    })()
    run.catch(() => undefined)
  }

  // 卡片内 hairline 分隔（苹果改版）：行与行之间一线，纯装饰无钩子；颜色走统一 token。
  const hairline = (key: string): any =>
    h('div', { key, style: { borderTop: '1px solid ' + TOK.border } })

  // #110 检测统一：有效方向（显式偏好赢；auto 取环境缓存，缺席回落视口）。
  // 开关态同规显示，附来源角标，让 auto 的行为可见。
  const orientPref: RemoteOrientationPref = (remote as any).orientation || 'auto'
  let viewportOrient: unknown = null
  try {
    if (typeof window !== 'undefined'
      && typeof (window as any).innerWidth === 'number'
      && typeof (window as any).innerHeight === 'number') {
      viewportOrient = deriveRemoteOrientation((window as any).innerWidth, (window as any).innerHeight)
    }
  } catch (e) { viewportOrient = null }
  let envOrient: unknown = null
  try {
    const e = getEnvOrientation()
    envOrient = e ? e.orientation : null
  } catch (err) { envOrient = null }
  const effectiveOrient = resolveEffectiveOrientation(orientPref, envOrient, viewportOrient)
  const orientLabel = effectiveOrient === 'landscape' ? t('remoteOrientationLandscape') : t('remoteOrientationPortrait')
  // 来源角标只属于 auto：显式锁定的有效值即锁定值，若缀整机会把偏好的选择算到整机头上。
  const effectiveCaption = (orientPref === 'landscape' || orientPref === 'portrait')
    ? t('remoteLockedOrientation').replace('{orient}', orientLabel)
    : t('remoteEffectiveNow')
      .replace('{orient}', orientLabel)
      .replace('{source}', t(envOrient ? 'remoteSourceSystem' : 'remoteSourceViewport'))
  // #110 收尾：设为默认入口可见性——仅会话中、快照与当前不一致时出现（需要才打扰）。
  // #110 改判：方向无「临时覆盖」，故无「设为默认」入口——会话内选的就是默认，退出后原样保持。

  const remoteGroup = h('section', {
    key: 'remote',
    style: cardStyle('2px 14px 12px'),
    'data-dsh-prompt-remote-section': '1',
  }, [
    // 总闸去重行：卡片标题与开关行同名（均为“远程模式”），标题行退役，开关行即首行。
    // 总闸：默认关；开=大、关=小；去宿主化后恒可用，不因任何外部能力 disabled。
    h(SettingRow, {
      key: 'remote-switch',
      label: t('remoteToggle'),
      control: h(Check, {
        checked: !!remote.enabled,
        'data-dsh-prompt-remote-toggle': '1',
        onChange: (e: any) => {
          // #110 改判：进出总闸只翻一个键，方向既不快照也不还原——会话内选的方向常驻。
          // 退出时对整机零调用：屏幕保持用户最后锁定的样子，不闪屏、不夺回控制权。
          const on = !!e.target.checked
          const entering = on === true && remote.enabled !== true
          const next = setRemoteEnabled(on)
          remoteState[1]({ ...next })
          persistState[1](getRemotePersistState())
          // #110 陈旧值修复：开启远程时刷新一次整机方向（只读、零 OS 副作用、不闪屏）。
          // 这是面板侧「自动」档唯一的真值来源——面板按设计永不碰桥，不在这里问就只剩视口回落
          //（桌面恒定一个形状）或沿用上一次缓存下来的旧值。
          if (entering) {
            try {
              warmEnvOrientation(() => getSystemOrientation() as unknown as Promise<any>).catch(() => undefined)
            } catch (e) { /* ignore */ }
          }
        },
      }),
    }),
    hairline('sep-switch-size'),
    // 统一大小（苹果改版·无预览）：上下结构——上行标签+值 pill，下行整行滑块配两端小字。
    h('div', {
      key: 'remote-size',
      style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0' },
    }, [
      h('div', { key: 'head', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } }, [
        h('span', { key: 'label', style: { fontFamily: TOK.font, fontSize: '0.93em', color: TOK.labelPrimary } }, t('remoteSize')),
        h('span', {
          key: 'val',
          style: {
            fontFamily: TOK.font, fontSize: '0.86em', color: TOK.labelPrimary,
            padding: '2px 10px', border: '1px solid ' + TOK.border, borderRadius: 999,
            fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flex: 'none',
          },
          'data-dsh-prompt-size-value': '1',
        }, remote.size + '档·' + Math.round(remoteSizeScale(remote.size) * 100) + '%'),
      ]),
      h('div', { key: 'slider-row', style: { display: 'flex', alignItems: 'center', gap: 8 } }, [
        h('span', { key: 'min', style: { fontFamily: TOK.font, fontSize: '0.82em', color: TOK.labelTertiary, flex: 'none' } }, t('remoteSizeMin')),
        h('input', {
          key: 'slider',
          type: 'range', min: 1, max: 10, step: 1, value: remote.size,
          disabled: !remote.enabled,
          'data-dsh-prompt-size-slider': '1',
          'aria-label': t('remoteSize'),
          style: {
            flex: 1, minWidth: 0, accentColor: TOK.accent, cursor: !remote.enabled ? 'not-allowed' : 'pointer', margin: 0,
            transform: remote.enabled ? 'scale(1, ' + remoteSizeScale(remote.size) + ')' : 'none',
            transformOrigin: 'left center', opacity: !remote.enabled ? 0.6 : 1,
          },
          onChange: (e: any) => {
            // 浏览器 range 的 value 恒为字符串，不转 Number 则 setRemoteSize 直接拒收、滑块成摆设。
            const next = setRemoteSize(Number((e.target as any).value))
            remoteState[1]({ ...next })
            persistState[1](getRemotePersistState())
          },
        }),
        h('span', { key: 'max', style: { fontFamily: TOK.font, fontSize: '0.82em', color: TOK.labelTertiary, flex: 'none' } }, t('remoteSizeMax')),
      ]),
    ]),
    hairline('sep-size-orient'),
    // 方向偏好（#110 检测统一）：自动跟整机方向（环境缓存命中即用，缺席回落视口）；
    // 锁定先调 OS，真切失败回落自家锁定并明示。有效值见下一行 caption（开关态同规）。
    h(SettingRow, {
      key: 'remote-orientation',
      label: t('remoteOrientation'),
      description: t('remoteOrientationHint'),
      control: orientationControl(orientPref, onPickOrientation, orientBusy, !remote.enabled),
    }),
    h('div', {
      key: 'remote-orientation-effective',
      style: { ...noteStyle, paddingTop: 0, paddingBottom: 8 },
      'data-dsh-prompt-orientation-effective': '1',
    }, effectiveCaption),
    hairline('sep-orient-density'),
    // 密度档（#90）：方向偏好行之后，两段手动切换；切档页码归零由面板侧执行。
    h(SettingRow, {
      key: 'remote-density',
      label: t('remoteDensity'),
      control: densityControl((remote as any).density || 'a', (v) => {
        const next = setRemoteDensity(v)
        remoteState[1]({ ...next })
        persistState[1](getRemotePersistState())
      }, !remote.enabled),
    }),
    orientNote
      ? h('div', { key: 'remote-orientation-note', style: noteStyle, 'data-dsh-prompt-orientation-note': '1' }, orientNote)
      : null,
    remotePersist.failed
      ? h('div', { key: 'remote-persist-note', style: noteStyle }, t('remotePersistFail'))
      : null,
  ])

  const logGroup = h(SettingGroup, { key: 'log', title: t('logGroup') }, [
    h(SettingRow, {
      key: 'log-switch',
      label: t('logToggle'),
      description: t('logToggleHint'),
      control: h(Check, { checked: logOn, disabled: !log, onChange: (e: any) => { onToggleLog(!!e.target.checked).catch(() => undefined) } }),
    }),
    h('div', {
      key: 'log-where',
      style: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '0.82em',
        color: TOK.labelTertiary, padding: '0 0 10px', wordBreak: 'break-all', userSelect: 'text',
      },
    }, t('logWhere')),
    h('div', { key: 'log-actions', style: { display: 'flex', gap: 8, paddingBottom: 2 } }, [
      h(Btn, { key: 'export', onClick: () => { onExport().catch(() => undefined) } }, t('logExport')),
      h(Btn, { key: 'copy', tone: 'ghost', onClick: () => { onCopyPath().catch(() => undefined) } }, t('logCopyPath')),
    ]),
    h('div', {
      key: 'log-danger',
      style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px solid ' + TOK.border },
    }, [
      h(Btn, { key: 'clear', tone: 'danger', onClick: () => { onClear().catch(() => undefined) } }, confirming ? t('logClearConfirm') : t('logClear')),
      dropped > 0
        ? h('span', { key: 'dropped', style: { fontFamily: TOK.font, fontSize: '0.82em', color: TOK.labelTertiary } }, t('logDropped') + ' ' + dropped)
        : null,
    ]),
  ])
  if (note) logGroup.props.children.push(h('div', { key: 'log-note', style: noteStyle }, note))

  // 单滑块跟随（用户拍板，封顶时代“设置页自身不跟”已废）：开吃全额，与 compact 小列表
  // uiFontScale 同构；子项全 em 化，故根在关时也锚到宿主基准 var（=14px，em 按 px/14 换算后与旧 px 视觉一致）。
  // #116：缩放根走收敛点（开吃全额、关回基准；与折叠小列表根同构，防漂移）。子项全 em 化，关时锚到宿主基准 var。
  // #128 新整组件面板：0.5.0 起 dialog + archive 主题（Esc 可关，关闭落地撤 DOM），落设置页模板卡之后（只查，安装走用户点击；更新日志自动展示）。
  const updateGroup = h(SettingGroup, { key: 'update', title: '更新' }, [
    h(UpdatePanelEmbedded, { key: 'panel' }),
  ])
  const settingsRootStyle: any = {
    padding: 4, display: 'flex', flexDirection: 'column',
    fontSize: scaledBaseFontSize(remote.enabled, remote.size),
  }
  // #37：旧的一行文字链接（⛭ GitHub 仓库 / ⚠ 反馈故障）已由顶部右上角两个图标按钮取代，不再保留第二处入口。
  return h('div', { style: settingsRootStyle }, [
    // 标题栏置顶（身份行：提示词模板 + 更新入口 + 版本 + 🌟💬）。
    // #128 新整组件接回：入口按钮落位与 #60 旧位一致（🌟/💬 之前）。
    h(SettingsHeaderLinks, { key: 'links', lang, entry: h(UpdateEntryButton, { key: 'update' }) }),
    // 模板管理栏紧随标题栏（主体功能优先）：预制·自定义模板区为第 1 块，其余段顺序不变相对后移。
    // #77：模板区是一张**与下面几张卡同款的卡片**（此前它是一条裸行，没有壳）。折叠态只露出卡片头行，点开才是完整列表。
    // pad 取 4px 6px 8px：内嵌浏览器自带 8px 内边距，6 + 8 = 14px，与其它卡的内容左轨对齐。
    h(SettingGroup, { key: 'list', pad: '4px 6px 8px' }, [
      h(TemplateBrowser, { key: 'browser', compact: false, collapsible: true }),
    ]),
    updateGroup,
    // 智能推荐配置区暂不放开：整组不渲染（逻辑 smart.ts、i18n 键、persist 全保留，接回即恢复）。
    remoteGroup,
    logGroup,
    // 存储说明那句（原「自定义模板与使用次数保存在 DSH 缓存目录…」）已按作者决定删除：
    // 它孤零零悬在两张卡之间，说的是上面那张模板卡的事，却谁也不属于。
    h(AuthorPlugins, { key: 'more', lang }),
  ])
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
