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
import { UPD_POLL } from '../update/gen/updateClient.derived.js'

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

/**
 * 「电话级失败」分两类，**文案必须分开**（红队 L2 打出来的撒谎）：
 *
 * 1. `BRIDGE_DOWN_CODES`：**桥本身没回答** —— 没 catch 到 HTTP、回的不是信封、body 不是 JSON、环境没有
 *    fetch。只有这一类的成就是「宿主没接通 / 宿主半未加载」，`updateHostFailTitle` + `updateHostFailHint`
 *    是给它的。
 * 2. 其余码：宿主**回答了**，并且给了精确的错误码（`check-expired` / `invalid-release` / `check-failed` /
 *    `install-failed` / `update-busy` / `update-params` / `recovery-required`…）。对这些码说「宿主没有回答
 *    更新状态」是**对用户撒谎**：用户会去报一个不存在的「宿主没接通」故障。这一支的标题换成
 *    `updateFailAnsweredTitle`，并按码给「下一步动作」（`UPDATE_FAIL_KEYS`）。
 *
 * `UPDATE_FAIL_KEYS` 只覆盖已知码，渲染时按「认识就给动作、不认识就给原始码 + 一句通用说明」降级 —— 绝不空白。
 */
const BRIDGE_DOWN_CODES = ['bridge-unreachable', 'bridge-bad-shape', 'bridge-bad-json', 'no-fetch']

/**
 * 实产失败码 → 「下一步动作」文案键。码从两处抄来，都不是猜的：
 * - 宿主半 `dist/service.js` / `host.js` 里 `updateError(...)` 的实参（`check-expired` / `check-failed` /
 *   `invalid-release` / `install-failed` / `update-busy` / `update-params` / `installation-changed` /
 *   `registry-conflict` / `recovery-required`）；
 * - 桥自己的兜底形状码（`bridge-error`）。
 * 包 README 第 11 节点名 `check-expired` 是「正常错误码，不是程序缺陷」⇒ 它的动作就是「重取凭证再提交」，
 * 而且这一句同时由 `ensureCheckId` 在**源头**上自动做掉（见 onInstall 的重试）。
 */
const UPDATE_FAIL_KEYS: Record<string, keyof typeof STR> = {
  'update-busy': 'updateFailBusy',
  'check-failed': 'updateFailCheckFailed',
  'invalid-release': 'updateFailInvalidRelease',
  'install-failed': 'updateFailInstallFailed',
  'check-expired': 'updateFailCheckExpired',
  'installation-changed': 'updateFailInstallationChanged',
  'registry-conflict': 'updateFailRegistryConflict',
  'recovery-required': 'updateFailRecoveryRequired',
  'update-params': 'updateFailParams',
  'bridge-error': 'updateFailUnknown',
}

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
  /**
   * 上一份**成功**的回包。一次失败的 check / install 不该把已知版本整块抹成「版本未知」——
   * 失败时下面前提是「多一块失败说明」，不是「把已知的事忘掉」（L2 实测：成功过 `v0.1.7 / 0.1.7 /
   * 0.1.9 + 命令块`，再失败一次全被抹成 `版本未知 / 未知 / 未知 / 还没查过`，命令块消失）。
   */
  const lastGood = react.useState(null as UpdateCallResult | null)
  const lastGoodRes: UpdateCallResult | null = lastGood[0]
  const setLastGood = lastGood[1]
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
    if (out.ok) setLastGood(out)
    return out
  }

  const snap = snapOf(res) ?? snapOf(lastGoodRes)
  const failed = res !== null && !res.ok
  // 失败回包的码：分「桥没回答」与「宿主回答了但这次操作没成」两类，文案不同（见 BRIDGE_DOWN_CODES）。
  const failCode = failed ? asText(res && res.error && res.error.code) : ''
  const code = failCode
  const bridgeDown = failed && BRIDGE_DOWN_CODES.indexOf(failCode) >= 0
  const failAction = failed && !bridgeDown && UPDATE_FAIL_KEYS[failCode] ? t(UPDATE_FAIL_KEYS[failCode]) : ''
  const reason = asText(snap && snap.blockedReason)
  const running = asText(snap && snap.runningVersion)
  const installed = asText(snap && snap.installedVersion)
  const latest = asText(snap && snap.latestVersion)
  const canInstall = !!(snap && snap.canInstall === true)
  /**
   * 恶意形状的降级口（L5 边角）：版本字段不是字符串（数字 / 数组 / 对象）时 `asText` 会把它读成空串，
   * 界面只剩「未知」，安装按钮却照给。这里认一次「快照里确实给了版本字段但不是字符串」，把那个按钮收掉 ——
   * 类型不对时不给安装按钮，宁可让用户重查一次。真宿主 `readRunningVersion` 恒为字符串，这条只挡坏形状。
   */
  const malformedVersions = !!snap && [snap.runningVersion, snap.installedVersion, snap.latestVersion]
    .some((v) => v !== null && v !== undefined && typeof v !== 'string')
  const canInstallSafe = canInstall && !malformedVersions
  const jobState = asText(snap && (snap.job as { state?: unknown } | null | undefined)?.state)
  const jobMessage = asText(snap && (snap.job as { message?: unknown } | null | undefined)?.message)
  const installing = jobState === 'installing' || jobState === 'verifying'
  /**
   * 安装任务的终态失败（L1 打出来的静默失败）：`job.state` 为 `failed`，`job.message` 是包写的精确码
   * （`install-failed` / `installation-changed` / `registry-conflict`，见包 `dist/service.js` 的
   * `runBackground` catch）。宿主**不会**把这种情况翻成 `blockedReason` —— 包只在「已装版本 != 正在跑的
   * 版本」时才翻 `recovery-required`，所以「安装失败、磁盘上的版本没变」这条路在面板上曾经一个字都没有：
   * 用户点安装 →「安装中…」→ 一切恢复正常、按钮还回来，没人告诉他失败。这里把它当成与 `blockedReason`
   * 同级的一条**失败原因**呈现，码取任务自己的 `message`。
   * `interrupted` 同理（同一个 heal 逻辑的另一半：半截任务）。
   */
  const jobFailed = jobState === 'failed' || jobState === 'interrupted'
  const jobCode = jobFailed ? (jobMessage || 'install-failed') : ''
  const pendingRestart = reason === 'pending-restart'
  const manual = res && res.ok ? asText(res.manual) : asText(lastGoodRes && lastGoodRes.manual)
  const versionLine = running ? 'v' + running : t('updateVersionUnknown')

  // 打开设置页就读一次状态（只读本机）：入口那行要显示的「当前版本」就是从这里来的。
  react.useEffect(() => { run(updatePhoneNames.updateStatus, 'status').catch(() => undefined) }, [])

  /**
   * 打开设置页读一次状态不够：install 的回包只是「安装中…」（真装在宿主后台跑），
   * 没有轮询面板就**永远停在「安装中…」**，直到用户自己再点一次「检查更新」——同一件事也是
   * 「安装失败了没有任何触发点」的根因（包 README 第 3 节客户端三件事之一就是「按间隔轮询查状态」，
   * 示例正是 `setInterval(readStatus, UPD_POLL)`）。
   *
   * 三条纪律：
   * 1. 间隔取派生文件的 `UPD_POLL`（不写字面量；换前缀或升级包时重跑 derive 即可）；
   * 2. **只在弹窗打开期间**跑，关闭 / 卸载时 `clearInterval`（启动自动检查是另一张票的事，本票不擅自联网）；
   * 3. 不重入：轮询只发**上一次还没回来**就不发下一次（`run` 里的 `lock` 挡掉，并且这里再判一次）。
   *    另外只在「安装任务还没到终态」时轮询：空闲面板不需要每秒问一次宿主。
   */
  const lastRun = react.useRef(run)
  lastRun.current = run
  react.useEffect(() => {
    if (!open) return undefined
    if (!installing) return undefined
    const timer = setInterval(() => { lastRun.current(updatePhoneNames.updateStatus, 'status').catch(() => undefined) }, UPD_POLL)
    return () => clearInterval(timer)
  }, [open, installing])

  /**
   * 手里那张凭证还能不能用。包 README 第 11 节的表：凭证（`confirmationTtlMs`）默认 10 分钟，
   * 「用户查完新版隔很久才点安装，凭证过期要重查」；同一节还点名 `check-expired` 是**正常错误码**，
   * 指令是「面板此时重新调一次查新版、拿新凭证再提交即可」。
   * 主路径上 install 只接受 `check` 回的凭证，所以判 `expiresAt` 就够。
   */
  const receiptFresh = (r: UpdateCallResult | null): boolean => {
    const receipt = r && r.receipt
    if (!receipt || typeof receipt !== 'object') return false
    const exp = (receipt as { expiresAt?: unknown }).expiresAt
    return typeof exp === 'number' && Number.isFinite(exp) && exp > Date.now()
  }

  /**
   * 安装前先确保手里有凭证。裸调 install 必回 `check-expired`（包的功能守卫），
   * 所以这里不赌：没有 checkId（或那张凭证已经过期）就先补一次 check —— 用户点的是「安装」，
   * 跑两步是本面板的事，不该让用户自己去理解「先查再装」。
   */
  const ensureCheckId = async (): Promise<string> => {
    const held = checkIdOf(res)
    // 只认「把 check 回包放进界面状态」的那张（见 receiptFresh）：它一定来自 check。
    if (held && receiptFresh(res)) return held
    const out = await run(updatePhoneNames.updateCheck, 'check')
    if (!out || !out.ok) return ''
    return checkIdOf(out)
  }

  /**
   * 点「安装新版本」。凭证在**提交那一刻已经过期**是实产路径（用户查完新版去干别的、回来再点安装），
   * 这不是程序缺陷也不是「宿主没接通」：重取一次凭证再提交一次，最多两轮（`check-expired` 后重试一次
   * 就地收敛，不给无限循环留口子）。两轮都过期才把码摆到界面上让用户看见。
   */
  const onInstall = async (): Promise<void> => {
    const requestId = 'upd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
    for (let attempt = 0; attempt < 2; attempt++) {
      const checkId = await ensureCheckId()
      if (!checkId) {
        // 无凭证时**不能静默 return**（L5）：说一句「没拿到凭证」总比界面一动不动强。
        setNote(t('updateNoCredential'))
        return
      }
      const out = await run(updatePhoneNames.updateInstall, 'install', { checkId, requestId })
      if (!out || out.ok || asText(out.error && out.error.code) !== 'check-expired') return
    }
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
  //    两类文案分开：`bridgeDown` 才是「宿主没回答」；其余码是宿主**回答了**、给了精确码，
  //    照前者说就是撒谎（L2）。失败块一定带原始码 —— 用户报 Issue 时靠它。
  if (failed) {
    const why = UPDATE_REASON_KEYS[code]
    const parts: any[] = [
      h('span', { key: 't', style: { fontSize: 13, fontWeight: 600 } },
        t(bridgeDown ? 'updateHostFailTitle' : 'updateFailAnsweredTitle')),
      h('span', { key: 'code', 'data-dsh-prompt-update-code': '', style: codeStyle }, code || 'unknown'),
      h('span', { key: 'hint', style: { fontSize: 12, color: TOK.labelSecondary, lineHeight: 1.6 } },
        t(bridgeDown ? 'updateHostFailHint' : 'updateFailAnsweredHint')),
    ]
    // 宿主回答了但没成：按码给「下一步动作」（`check-expired` 这类码的动作是明确的一句话）。
    if (failAction) {
      parts.push(h('span', {
        key: 'action', 'data-dsh-prompt-update-fail-action': '', style: { fontSize: 12.5, lineHeight: 1.65 },
      }, failAction))
    }
    // `check-expired` 是包 README 第 11 节点名的「正常错误码，不是程序缺陷」：不点明会有用户把它当故障报。
    if (code === 'check-expired') {
      parts.push(h('span', {
        key: 'nofault', 'data-dsh-prompt-update-fail-nofault': '', style: { fontSize: 11.5, lineHeight: 1.65, color: TOK.labelTertiary },
      }, t('updateFailNoFault')))
    }
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
  // ③b 安装任务的终态失败：与 ④「装不了的原因」同级的一条失败说明（不是灰字，也不是只在日志里）。
  // 这一块是 L1 那个「点安装 → 一切恢复正常、没人告诉他失败」的唯一出口。
  if (jobFailed) {
    children.push(h('div', {
      key: 'job-failed',
      'data-dsh-prompt-update-job-failed': '',
      'data-dsh-prompt-update-job-state': jobState,
      style: { ...blockStyle, borderColor: TOK.accent },
    }, [
      h('div', { key: 'h', style: { display: 'flex', alignItems: 'center', gap: 8 } }, [
        h('span', { key: 't', style: { fontSize: 12.5, fontWeight: 600 } }, t('updateJobFailTitle')),
        h('span', { key: 'code', style: { fontFamily: TOK.mono, fontSize: 11.5, color: TOK.labelTertiary } }, jobCode),
      ]),
      h('span', { key: 'why', style: { fontSize: 12.5, lineHeight: 1.65, color: TOK.labelPrimary } },
        UPDATE_FAIL_KEYS[jobCode] ? t(UPDATE_FAIL_KEYS[jobCode]) : t('updateJobFailHint')),
    ]))
  }
  children.push(h('div', { key: 'actions', style: { display: 'flex', justifyContent: 'flex-end', gap: 8 } }, [
    h('button', {
      key: 'check', type: 'button', 'data-dsh-prompt-update-action': 'check', disabled: busy !== '',
      onClick: () => { run(updatePhoneNames.updateCheck, 'check').catch(() => undefined) },
      style: btn(true),
    }, busy === 'check' ? t('updateBtnChecking') : t('updateBtnCheck')),
    canInstallSafe && !pendingRestart
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
  //    注意这里是**有命令就展示**（不是「这次回包 ok 才展示」）：一次失败的 check 不该把手上那条
  //    还能用的命令整块藏掉（L2：成功过就有命令，失败后命令块消失），但必须标清它来自上一份回包。
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
      // 命令是**上一次成功回包**给的：说清它是旧的那一份，别让用户以为这是这次电话的答复。
      failed
        ? h('span', {
          key: 'stale', 'data-dsh-prompt-update-manual-stale': '',
          style: { fontSize: 11.5, lineHeight: 1.65, color: TOK.labelTertiary },
        }, t('updateManualStale'))
        : null,
    ].filter(Boolean)))
  } else if (res && res.ok) {
    children.push(h('div', {
      key: 'manual-none',
      'data-dsh-prompt-update-manual-empty': '',
      style: { fontSize: 11.5, lineHeight: 1.65, color: TOK.labelTertiary },
    }, t('updateManualNone')))
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
