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
import { isSmartEnabled, setSmartEnabled } from './smartstore'
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

/** 一行：标签在左、控件在右，说明缩进到标签列（整页同一条左轨）。 */
function SettingRow(props: any): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  const kids: any[] = [
    h('div', { key: 'head', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } }, [
      h('span', { key: 'label', style: { fontFamily: TOK.font, fontSize: 13, color: TOK.labelPrimary } }, props.label),
      props.control ? h('span', { key: 'control', style: { display: 'inline-flex', alignItems: 'center' } }, props.control) : null,
    ]),
  ]
  if (props.description) {
    kids.push(h('div', { key: 'desc', style: { fontFamily: TOK.font, fontSize: 12, lineHeight: 1.65, color: TOK.labelTertiary, maxWidth: 520 } }, props.description))
  }
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0' } }, kids)
}

/** 一组：卡片 + 组标题，组内元素由调用方给，间距由这里统一。 */
function SettingGroup(props: any): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  return h('section', {
    style: {
      border: '1px solid ' + TOK.border, borderRadius: 12, padding: '2px 14px 12px', margin: '14px 0 4px',
      display: 'flex', flexDirection: 'column', fontFamily: TOK.font,
    },
  }, [
    props.title ? h('div', {
      key: 'title',
      style: { fontSize: 12, fontWeight: 600, color: TOK.labelSecondary, padding: '12px 0 0', letterSpacing: 0.2 },
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
    fontFamily: TOK.font, fontSize: 12.5, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
    transition: 'background-color .12s ease, color .12s ease, border-color .12s ease',
  }
  const style = tone === 'ghost'
    ? { ...base, border: '1px solid transparent', background: hover ? TOK.bgLayer : 'transparent', color: hover ? TOK.labelPrimary : TOK.labelSecondary }
    : tone === 'danger'
      ? { ...base, border: '1px solid ' + (hover ? TOK.danger : TOK.border), background: 'transparent', color: hover ? TOK.danger : TOK.labelSecondary }
      : { ...base, border: '1px solid ' + TOK.border, background: hover ? TOK.bgHover : TOK.bgLayer, color: TOK.labelPrimary }
  return h('button', {
    type: 'button',
    style,
    onMouseEnter: () => hoverState[1](true),
    onMouseLeave: () => hoverState[1](false),
    onClick: props.onClick,
  }, props.children)
}

/** 复选框：宿主风格的圆角小方框（accent-color 跟随主题），不再是自己画一个控件。 */
function Check(props: any): any {
  const react = getReact()
  if (!react) return null
  return react.createElement('input', {
    type: 'checkbox',
    checked: props.checked,
    disabled: props.disabled,
    style: { width: 16, height: 16, accentColor: TOK.accent, cursor: props.disabled ? 'not-allowed' : 'pointer', margin: 0 },
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
  const smartState = react.useState(isSmartEnabled())
  const smartOn = smartState[0]
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

  const noteStyle: any = { fontFamily: TOK.font, fontSize: 12, lineHeight: 1.65, color: TOK.labelTertiary, paddingTop: 8 }

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
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 11.5,
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
        ? h('span', { key: 'dropped', style: { fontFamily: TOK.font, fontSize: 11.5, color: TOK.labelTertiary } }, t('logDropped') + ' ' + dropped)
        : null,
    ]),
  ])
  if (note) logGroup.props.children.push(h('div', { key: 'log-note', style: noteStyle }, note))

  // #37：旧的一行文字链接（⛭ GitHub 仓库 / ⚠ 反馈故障）已由顶部右上角两个图标按钮取代，不再保留第二处入口。
  return h('div', { style: { padding: 4, display: 'flex', flexDirection: 'column' } }, [
    h(SettingsHeaderLinks, { key: 'links', lang }),
    h(SettingGroup, { key: 'smart', title: t('smartGroup') }, [
      h(SettingRow, {
        key: 'smart-row',
        label: t('smartToggle'),
        description: t('smartToggleHint'),
        control: h(Check, { checked: smartOn, onChange: (e: any) => { const on = e.target.checked; smartState[1](on); setSmartEnabled(on); logEvent('settings.smart.toggle', { on }) } }),
      }),
    ]),
    logGroup,
    h(TemplateBrowser, { key: 'list', compact: false }),
    // 存储说明讲的是"模板存在哪"，所以它跟着模板区走（不再与日志说明贴在一起形成两段灰字连读）。
    h('div', { key: 'storage', style: noteStyle }, t('storageNote')),
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
