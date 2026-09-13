/**
 * dsh-prompt — 更新入口 + 更新弹窗（#40）：设置面板顶部一行「检查更新」，点开做全四件事
 *
 * 数据来源只有一个：更新包的电话 —— 就是 `src/update/bridge.ts` 那张表。本文件**一个电话名与
 * 端点路径都不写**：名字从 `updatePhoneNames` 取、路径由 bridge 决定（派生文件是唯一真值）。
 * 三条电话的分工（包 README 第 3 / 8 / 9 / 10 节）：
 *   status  只读本机、不联网（`dist/service.js` 的 `status()`）：当前版本 / 已装版本 / 能不能装 /
 *           装不了的原因 / 手工兜底命令。**面板打开时拿它填「当前版本」是安全的**。
 *   check   联网问官方源要最新版本，并**发一张安装凭证**（回包 `receipt.checkId`）。
 *   install 入参 `{checkId, requestId}`；**没先 check 的裸调必回 `check-expired`** —— 那是包的
 *           功能守卫，不是降级，所以本面板绝不对它赌运气（见 ensureCheckId）。
 *
 * 四个必须做对的地方（票面交付 3 + 开工前置 5/6）：
 * 1. 状态区宁可说「没查到」，也不许空白：电话级失败时宿主回 `{ok:false, value:{…}, error:{code}}`，
 *    bridge 收成 `snapshot:null` —— 只按 `snapshot.blockedReason` 渲染会是一片空白，那正是 #55
 *    真机踩到的形态。这一支由 `data-dsh-prompt-update-hostfail` 那块独占呈现。
 * 2. 装不了的原因不止给原因码，还要给「用户该做什么」（包 README 第 8 节第三列）。本版本实产 7 条，
 *    第 8 条 `registry-conflict` 在 0.1.1 里零处产出（#55 实测）⇒ 文案预留，但不许为它编情形。
 * 3. `pending-restart` 不是失败：顶部显眼横幅 + 说清新版号与「重启宿主后生效」，且不给安装按钮。
 * 4. 手工兜底命令按回包现刷、**不缓存**；为空时只讲原因、不展示命令。它不是万能药：命令装的是
 *    **已装**那一侧（没先 check 时版本号会退化成已装版本），也清不掉 `installation-changed` ——
 *    这层含义写在命令旁边，不许当救命稻草展示（开工前置 6）。
 *
 * 本文件不记客户端日志事件：宿主半已经把三条更新事件写进诊断日志（#39），客户端再加事件要同时改
 * 事件清单与 `test:log` 的计数，超出本票范围（要加就单独开票）。
 */
import { getReact, MODAL_Z, ModalPortal } from './panel'
import { getLang, tr, STR } from './i18n'
import { createUpdateBridge, updatePhoneNames, type UpdateCallResult } from '../update/bridge'

/** 样式令牌：与 settings.ts 同一套宿主变量，不发明第二套视觉。 */
const TOK = {
  labelPrimary: 'var(--dsw-alias-label-primary)',
  labelSecondary: 'var(--dsw-alias-label-secondary)',
  labelTertiary: 'var(--dsw-alias-label-tertiary)',
  bgLayer: 'var(--dsw-alias-bg-layer-3)',
  bgHover: 'var(--dsw-alias-bg-layer-2,rgba(255,255,255,.06))',
  border: 'var(--dsw-alias-border-l1)',
  accent: 'var(--dsw-specific-accent,#f0a45c)',
  font: 'var(--dsw-font-family)',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
}

/**
 * 八条 `blockedReason` → 文案键（包 README 第 8 节第三列「用户该做什么」）。
 * 本版本实产 7 条（#55 真机实测：unknown-profile / invalid-installation / installation-changed /
 * source-install / pending-restart / incompatible-node / recovery-required）；第 8 条
 * `registry-conflict` 在 0.1.1 的发行物里**零处产出** —— 预留文案，但别为它编情形。
 * `test:issue-40` 会拿包 README 的表逐条对账，并当场量「哪几条是本版本真会产出的」。
 */
export const UPDATE_REASON_KEYS: Record<string, keyof typeof STR> = {
  'unknown-profile': 'updateWhyUnknownProfile',
  'source-install': 'updateWhySourceInstall',
  'invalid-installation': 'updateWhyInvalidInstallation',
  'installation-changed': 'updateWhyInstallationChanged',
  'pending-restart': 'updateWhyPendingRestart',
  'registry-conflict': 'updateWhyRegistryConflict',
  'incompatible-node': 'updateWhyIncompatibleNode',
  'recovery-required': 'updateWhyRecoveryRequired',
}

/** 取 STR 文案。 */
type T = (k: keyof typeof STR) => string

const asText = (v: unknown): string => (typeof v === 'string' ? v : '')

/** 填 STR 里的 `{name}` 占位（只有待重启横幅那一句需要带版本号，为此引模板引擎不值得）。 */
function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m)
}

/** 一次电话回包里的快照（六字段，本面板只用其中五个 + job 的状态）。 */
function snapOf(res: UpdateCallResult | null): Record<string, unknown> | null {
  return res && res.ok && res.snapshot ? res.snapshot : null
}

/** 回包里的安装凭证（只有 `check` 会给；`status` 永远是 null）。 */
function checkIdOf(res: UpdateCallResult | null): string {
  const receipt = res && res.receipt
  if (!receipt || typeof receipt !== 'object') return ''
  return asText((receipt as { checkId?: unknown }).checkId)
}

/** 复制到剪贴板（与 settings.ts 同一个两段式兜底；那边的是模块私有，本票不为它重构 settings.ts）。 */
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

const cardStyle: any = {
  width: 480, maxWidth: '92vw', maxHeight: '82vh', overflowY: 'auto',
  background: 'var(--dsw-specific-menu)', border: '1px solid var(--dsw-alias-border-inverted)',
  borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
  fontFamily: TOK.font, color: TOK.labelPrimary,
}
const maskStyle: any = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', zIndex: MODAL_Z,
}
const btn = (primary?: boolean): any => ({
  padding: '6px 14px', borderRadius: 8, border: primary ? 0 : '1px solid ' + TOK.border,
  background: primary ? TOK.accent : TOK.bgLayer, color: primary ? '#1a1a1e' : TOK.labelPrimary,
  cursor: 'pointer', fontFamily: TOK.font, fontSize: '0.96em',
})
const blockStyle: any = {
  border: '1px solid ' + TOK.border, borderRadius: 8, padding: '10px 12px',
  display: 'flex', flexDirection: 'column', gap: 6,
}
const codeStyle: any = {
  fontFamily: TOK.mono, fontSize: 11.5, color: TOK.labelSecondary, wordBreak: 'break-all',
  background: TOK.bgLayer, border: '1px solid ' + TOK.border, borderRadius: 6,
  padding: '6px 8px', userSelect: 'text',
}

/**
 * 设置面板顶部那一行入口 +（点开后）更新弹窗。自带状态：打开设置页时读一次 `status`（只读本机、不联网）。
 *
 * 行与弹窗放同一个组件里是刻意的：版本号来自同一次回包，拆成两处会各自持有一份可能不同步的状态。
 */
export function UpdateEntry(): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  const lang = getLang()
  const t: T = (k) => tr(lang, STR[k])

  const resState = react.useState(null as UpdateCallResult | null)
  const res: UpdateCallResult | null = resState[0]
  const setRes = resState[1]
  const openState = react.useState(false)
  const open: boolean = openState[0]
  const setOpen = openState[1]
  const busyState = react.useState('')
  const busy: string = busyState[0]
  const setBusy = busyState[1]
  const noteState = react.useState('')
  const note: string = noteState[0]
  const setNote = noteState[1]
  /** 同一时刻只允许一次通话：按钮会被 busy 关掉，但双击 / 回车连发仍可能撞上。 */
  const lock = react.useRef(false)

  /**
   * 一条电话。任何异常都收成回包形状（`ok:false` + 错误码），**绝不向上抛** ——
   * 一次网络抖动不该把设置页炸掉，界面只该多一块「宿主没回答」。
   */
  const call = async (phone: string, args: Record<string, unknown>): Promise<UpdateCallResult> => {
    try {
      const table = createUpdateBridge()
      return await table[phone](args)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { ok: false, snapshot: null, manual: null, receipt: null, error: { code: 'bridge-unreachable', message } }
    }
  }

  /** 跑一次通话并把回包落进状态。`label` 只影响按钮上的字。 */
  const run = async (phone: string, label: string, args: Record<string, unknown> = {}): Promise<UpdateCallResult | null> => {
    if (lock.current) return null
    lock.current = true
    setBusy(label)
    setNote('')
    let out: UpdateCallResult
    try {
      out = await call(phone, args)
    } finally {
      lock.current = false
      setBusy('')
    }
    setRes(out)
    return out
  }

  // 打开设置页就读一次状态（只读本机）：入口那行要显示的「当前版本」就是从这里来的。
  react.useEffect(() => { run(updatePhoneNames.updateStatus, 'status').catch(() => undefined) }, [])

  const snap = snapOf(res)
  const failed = res !== null && !res.ok
  const code = failed ? asText(res && res.error && res.error.code) : ''
  const reason = asText(snap && snap.blockedReason)
  const running = asText(snap && snap.runningVersion)
  const installed = asText(snap && snap.installedVersion)
  const latest = asText(snap && snap.latestVersion)
  const canInstall = !!(snap && snap.canInstall === true)
  const jobState = asText(snap && (snap.job as { state?: unknown } | null | undefined)?.state)
  const installing = jobState === 'installing' || jobState === 'verifying'
  const pendingRestart = reason === 'pending-restart'
  const manual = res && res.ok ? asText(res.manual) : ''
  const versionLine = running ? 'v' + running : t('updateVersionUnknown')

  /**
   * 安装前先确保手里有凭证。裸调 install 必回 `check-expired`（包的功能守卫），
   * 所以这里不赌：没有 checkId 就先补一次 check —— 用户点的是「安装」，跑两步是本面板的事，
   * 不该让用户自己去理解「先查再装」。
   */
  const ensureCheckId = async (): Promise<string> => {
    const held = checkIdOf(res)
    if (held) return held
    const out = await run(updatePhoneNames.updateCheck, 'check')
    if (!out || !out.ok) return ''
    return checkIdOf(out)
  }

  const onInstall = async (): Promise<void> => {
    const checkId = await ensureCheckId()
    if (!checkId) return
    const requestId = 'upd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
    await run(updatePhoneNames.updateInstall, 'install', { checkId, requestId })
  }

  const onCopy = async (): Promise<void> => {
    const ok = await copyText(manual)
    setNote(ok ? t('updateCopied') : t('updateCopyFail'))
  }

  const close = (): void => { setOpen(false); setNote('') }
  const row = h('button', {
    key: 'update-row',
    type: 'button',
    'data-dsh-prompt-update': '',
    onClick: () => setOpen(true),
    style: {
      display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8, width: '100%',
      textAlign: 'left', padding: '10px 4px', background: 'transparent', border: 0,
      borderBottom: '1px solid ' + TOK.border, cursor: 'pointer', fontFamily: TOK.font,
    },
  }, [
    h('span', { key: 'label', style: { fontSize: 13, color: TOK.labelPrimary } }, t('updateEntry')),
    h('span', {
      key: 'ver',
      'data-dsh-prompt-update-version': '',
      style: { fontFamily: TOK.mono, fontSize: 11.5, color: TOK.labelTertiary },
    }, versionLine),
  ])

  const versionRow = (key: string, label: string, value: string): any => h('div', {
    key,
    style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  }, [
    h('span', { key: 'l', style: { fontSize: 12, color: TOK.labelTertiary } }, label),
    h('span', {
      key: 'v',
      'data-dsh-prompt-update-field': key,
      style: { fontFamily: TOK.mono, fontSize: 12.5, color: TOK.labelPrimary, wordBreak: 'break-all' },
    }, value),
  ])

  const children: any[] = [
    h('div', { key: 'head', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 } }, [
      h('span', { key: 'title', style: { fontSize: 14, fontWeight: 600, color: TOK.labelPrimary } }, t('updateEntry')),
      h('button', {
        key: 'close', type: 'button', 'data-dsh-prompt-update-action': 'close', 'aria-label': t('updateClose'),
        onClick: close, style: { ...btn(false), padding: '4px 10px' },
      }, '✕'),
    ]),
  ]

  // ① 待重启横幅：显眼样式单独展示（不是日志、不是悬停提示里的一行小字）。
  if (pendingRestart) {
    children.push(h('div', {
      key: 'banner',
      'data-dsh-prompt-update-banner': '',
      style: {
        border: '1px solid ' + TOK.accent, background: 'rgba(240,164,92,.16)', borderRadius: 8,
        padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4,
      },
    }, [
      h('span', { key: 'line', style: { fontSize: 13, fontWeight: 600, lineHeight: 1.6 } }, fill(t('updatePendingBanner'), {
        new: installed || latest || t('updateNotAvailable'),
        old: running || t('updateNotAvailable'),
      })),
      h('span', { key: 'how', style: { fontSize: 12, color: TOK.labelSecondary, lineHeight: 1.6 } }, t('updatePendingHint')),
    ]))
  }

  // ② 电话级失败：`snapshot` 为 null 也要说清楚（票面验收：不能空白）。
  if (failed) {
    const why = UPDATE_REASON_KEYS[code]
    const parts: any[] = [
      h('span', { key: 't', style: { fontSize: 13, fontWeight: 600 } }, t('updateHostFailTitle')),
      h('span', { key: 'code', 'data-dsh-prompt-update-code': '', style: codeStyle }, code || 'unknown'),
      h('span', { key: 'hint', style: { fontSize: 12, color: TOK.labelSecondary, lineHeight: 1.6 } }, t('updateHostFailHint')),
    ]
    // 电话级失败的码也可能是更新包的原因码（宿主把 `unknown-profile` 这类码直接回在 `error.code` 上），
    // 那就顺带把「该做什么」给出来 —— 原因码表是同一张，不为这条路径另写一套。
    if (why) {
      parts.push(h('span', {
        key: 'why', 'data-dsh-prompt-update-why': '', style: { fontSize: 12.5, lineHeight: 1.65 },
      }, t(why)))
    }
    children.push(h('div', { key: 'hostfail', 'data-dsh-prompt-update-hostfail': '', style: { ...blockStyle, borderColor: TOK.accent } }, parts))
  }

  // ③ 状态区：当前 / 已装 / 最新 + 两个按钮（canInstall 为假时不给安装按钮）。
  children.push(h('div', { key: 'status', style: { display: 'flex', flexDirection: 'column', gap: 6 } }, [
    versionRow('running', t('updateRowRunning'), running || t('updateNotAvailable')),
    versionRow('installed', t('updateRowInstalled'), installed || t('updateNotAvailable')),
    versionRow('latest', t('updateRowLatest'), latest || t('updateLatestNone')),
  ]))
  if (installing) {
    children.push(h('div', { key: 'job', style: { fontSize: 12, color: TOK.labelSecondary } }, t('updateBtnInstalling')))
  }
  children.push(h('div', { key: 'actions', style: { display: 'flex', justifyContent: 'flex-end', gap: 8 } }, [
    h('button', {
      key: 'check', type: 'button', 'data-dsh-prompt-update-action': 'check', disabled: busy !== '',
      onClick: () => { run(updatePhoneNames.updateCheck, 'check').catch(() => undefined) },
      style: btn(true),
    }, busy === 'check' ? t('updateBtnChecking') : t('updateBtnCheck')),
    canInstall && !pendingRestart
      ? h('button', {
        key: 'install', type: 'button', 'data-dsh-prompt-update-action': 'install', disabled: busy !== '',
        onClick: () => { onInstall().catch(() => undefined) },
        style: btn(false),
      }, busy === 'install' ? t('updateBtnInstalling') : t('updateBtnInstall'))
      : null,
  ]))

  // ④ 装不了的原因：给「用户该做什么」，不给英文原因码了事。
  if (reason) {
    const key = UPDATE_REASON_KEYS[reason]
    children.push(h('div', {
      key: 'reason',
      'data-dsh-prompt-update-reason': '',
      style: { ...blockStyle, borderColor: pendingRestart ? TOK.accent : TOK.border },
    }, [
      h('div', { key: 'h', style: { display: 'flex', alignItems: 'center', gap: 8 } }, [
        h('span', { key: 't', style: { fontSize: 12.5, fontWeight: 600 } }, t('updateReasonTitle')),
        h('span', { key: 'code', style: { fontFamily: TOK.mono, fontSize: 11.5, color: TOK.labelTertiary } }, reason),
      ]),
      h('span', { key: 'why', style: { fontSize: 12.5, lineHeight: 1.65, color: TOK.labelPrimary } },
        key ? t(key) : t('updateReasonUnknown')),
    ]))
  }

  // ⑤ 手工兜底命令：宿主每次回包里的值现刷，不缓存；为空时只讲原因、不展示命令。
  if (res && res.ok) {
    if (manual) {
      children.push(h('div', { key: 'manual', 'data-dsh-prompt-update-manual': '', style: blockStyle }, [
        h('div', { key: 'h', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 } }, [
          h('span', { key: 't', style: { fontSize: 12.5, fontWeight: 600 } }, t('updateManualTitle')),
          h('button', {
            key: 'copy', type: 'button', 'data-dsh-prompt-update-action': 'copy',
            onClick: () => { onCopy().catch(() => undefined) }, style: { ...btn(false), padding: '4px 10px' },
          }, t('updateBtnCopy')),
        ]),
        h('code', { key: 'cmd', 'data-dsh-prompt-update-command': '', style: codeStyle }, manual),
        h('span', { key: 'hint', style: { fontSize: 11.5, lineHeight: 1.65, color: TOK.labelTertiary } }, t('updateManualHint')),
      ]))
    } else {
      children.push(h('div', {
        key: 'manual-none',
        'data-dsh-prompt-update-manual-empty': '',
        style: { fontSize: 11.5, lineHeight: 1.65, color: TOK.labelTertiary },
      }, t('updateManualNone')))
    }
  }
  if (note) children.push(h('div', { key: 'note', style: { fontSize: 11.5, color: TOK.labelTertiary } }, note))
  children.push(h('div', { key: 'foot', style: { fontSize: 11.5, lineHeight: 1.65, color: TOK.labelTertiary } }, t('updateStatusNote')))

  const modal = !open ? null : h(ModalPortal, { key: 'update-modal' }, h('div', {
    'data-dsh-prompt-update-modal': '',
    style: maskStyle,
    onClick: close,
  }, h('div', { style: cardStyle, onClick: (e: any) => { if (e && typeof e.stopPropagation === 'function') e.stopPropagation() } }, children)))

  return h('div', { key: 'update-entry', style: { display: 'flex', flexDirection: 'column' } }, [row, modal])
}
