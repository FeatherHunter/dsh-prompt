/**
 * dsh-prompt — 设置页模板管理（settings.plugins.tab）+ 智能模式开关 + 日志（开关 / 导出 / 清空）
 *
 * 日志三入口（地图 #45 子票 #51）的口径：
 * - 开关：读本地秒显（键 dsws.debug）+ 写宿主（setLogSwitch）+ 启动对账（能力里已做）。写失败**保持旧值**并提示，
 *   不回退为开启；界面文案写明「错误与告警始终记录」，因为关开关只停 info 与 debug 两级。
 * - 导出：调 logExport 拿当天日志原文，优先存成文件（Blob 下载），另给一个「复制正文」按钮供直接粘贴反馈。
 *   成功与失败都给明确反馈；失败按返回的原因码给中英双语文案。
 * - 清空：调 logClear 删掉既有日志文件并回报删掉几个；两步确认，避免误删掉正在排查的证据。
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
  const row: any = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 4px',
    fontFamily: 'var(--dsw-font-family)', fontSize: 12.5, color: 'var(--dsw-alias-label-primary)',
  }
  const hint: any = {
    padding: '0 4px 8px', fontSize: '0.85em', color: 'var(--dsw-alias-label-tertiary)', fontFamily: 'var(--dsw-font-family)',
  }
  const btn: any = {
    padding: '5px 12px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l1)', cursor: 'pointer',
    background: 'var(--dsw-alias-bg-layer-3)', color: 'var(--dsw-alias-label-primary)',
    fontFamily: 'var(--dsw-font-family)', fontSize: 12.5,
  }
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
    if (!cap) {
      noteState[1](t('logUnavailable'))
      return
    }
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
    if (!cap) {
      noteState[1](t('logUnavailable'))
      return
    }
    noteState[1](t('logWorking'))
    const res = await cap.exportLog()
    if (!res.ok) {
      noteState[1](t('logExportFail') + reasonText(res.reason))
      return
    }
    const text: string = res.text ?? ''
    if (!text) {
      noteState[1](t('logExportEmpty'))
      return
    }
    const name: string = res.fileName || 'dsh-prompt.log'
    const saved = downloadText(text, name)
    const where = res.path || res.dir || ''
    noteState[1](
      (saved ? t('logExportSaved') : t('logExportDownloadBlocked')) +
        ' ' + name + '（' + (res.bytes ?? text.length) + ' ' + t('logBytes') + '）' + (where ? ' · ' + where : ''),
    )
  }

  const onCopy = async (): Promise<void> => {
    const cap = logCap()
    if (!cap) {
      noteState[1](t('logUnavailable'))
      return
    }
    noteState[1](t('logWorking'))
    const res = await cap.exportLog()
    if (!res.ok) {
      noteState[1](t('logExportFail') + reasonText(res.reason))
      return
    }
    const ok = await copyText(res.text ?? '')
    noteState[1](ok ? t('logCopied') + '（' + (res.bytes ?? 0) + ' ' + t('logBytes') + '）' : t('logCopyFail'))
  }

  const onClear = async (): Promise<void> => {
    const cap = logCap()
    if (!cap) {
      noteState[1](t('logUnavailable'))
      return
    }
    if (!confirming) {
      confirmState[1](true)
      noteState[1](t('logClearAsk'))
      return
    }
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

  const logRows: any[] = [
    h('label', { key: 'log-toggle', style: row, title: t('logToggleHint') }, [
      h('input', {
        type: 'checkbox',
        checked: logOn,
        disabled: !log,
        onChange: (e: any) => { onToggleLog(!!e.target.checked).catch(() => undefined) },
      }),
      h('span', null, t('logToggle')),
    ]),
    h('div', { key: 'log-hint', style: hint }, t('logToggleHint')),
    h('div', { key: 'log-actions', style: { ...row, gap: 8 } }, [
      h('button', { type: 'button', style: btn, onClick: () => { onExport().catch(() => undefined) } }, t('logExport')),
      h('button', { type: 'button', style: btn, onClick: () => { onCopy().catch(() => undefined) } }, t('logCopy')),
      h('button', { type: 'button', style: btn, onClick: () => { onClear().catch(() => undefined) } }, confirming ? t('logClearConfirm') : t('logClear')),
    ]),
  ]
  if (note) logRows.push(h('div', { key: 'log-note', style: hint }, note))
  if (dropped > 0) logRows.push(h('div', { key: 'log-dropped', style: hint }, t('logDropped') + ' ' + dropped))

  // #37：旧的一行文字链接（⛭ GitHub 仓库 / ⚠ 反馈故障）已由顶部右上角两个图标按钮取代，不再保留第二处入口。
  return h('div', { style: { padding: 4, display: 'flex', flexDirection: 'column' } }, [
    h(SettingsHeaderLinks, { key: 'links', lang }),
    h('label', { style: row, title: t('smartToggleHint') }, [
      h('input', {
        type: 'checkbox', checked: smartOn,
        onChange: (e: any) => { const on = e.target.checked; smartState[1](on); setSmartEnabled(on); logEvent('settings.smart.toggle', { on }) },
      }),
      h('span', null, t('smartToggle')),
    ]),
    ...logRows,
    h('div', { key: 'storage', style: hint }, t('storageNote')),
    h(TemplateBrowser, { compact: false }),
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
