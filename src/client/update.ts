/**
 * dsh-prompt — 更新入口 + 更新弹窗（#40）：设置面板里一枚「检查更新」，点开做全四件事
 * （#60 追加交付 A 起这枚按钮坐在插件身份行里 —— 与 🌟 / 💬 同一行、排在两个图标之前，见 row 上的注释）
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
 * 4. 手工兜底命令按回包现刷、**不缓存**；为空时只讲原因、不展示命令。**它不再是常驻块**（#60 追加交付 B
 *    第 4 条）：只在「这台机器自动装不了」（宿主给了 `blockedReason` 且 `canInstall` 为假）或「这次失败」
 *    （电话级失败 / 安装任务终态失败）时才出现，命令下面只留**一句**说清它能做什么 —— 上一版那段
 *    四行免责声明与底部那句缓存机制说明都删了（把作者的不确定感摊给用户，主次颠倒）。
 *
 * 本文件不记客户端日志事件：宿主半已经把三条更新事件写进诊断日志（#39），客户端再加事件要同时改
 * 事件清单与 `test:log` 的计数，超出本票范围（要加就单独开票）。
 *
 * #41 起本组件有**两种模式**（同一个组件，不是第二只弹窗）：
 *   设置页那一份（默认，`auto` 不传）：一行入口 + 弹窗，行为与 #40 一字不差；
 *   全局那一份（`auto: true`，`index.ts` 挂在 shell.overlay）：不渲染入口行，改为「延迟一次 check →
 *   有新版本才开同一只弹窗」。判据与跳过记录的落点都在 `updauto.ts`，本文件只做接线。
 *
 * #41 收口（R1/R2）起本组件还持两份**闸**（都是模块级、都跨重挂载）：
 *   一次启动只自动查一次 —— `updauto.ts` 的 `claimAutoCheck` / `deliverAutoCheck`，闸只有在**回包真的
 *   交到活着的挂载手里**之后才算花掉（第一条 check 还在飞时重挂载，那次机会不会被白花掉）；
 *   同一时刻只有一只弹窗可操作 —— `upddialog.ts` 的归属名额（用户那只压掉自动那只，自动那只不接手
 *   已经打开的那只），否则两只同屏、被拒的那只会对用户显示「安装失败」（真包的两道闸只保证不装两次）。
 */
import { getReact, MODAL_Z, ModalPortal } from './panel'
import { getLang, tr, STR } from './i18n'
import { createUpdateBridge, updatePhoneNames, type UpdateCallResult } from '../update/bridge'
import { UPD_POLL } from '../update/gen/updateClient.derived.js'
// #41 的两块判据（跳过记在哪 / 这次该不该弹）与「一次启动只查一次」的闸在 updauto.ts；那边不 import 本文件，两文件不成环。
import {
  AUTO_CHECK_DELAY_MS, claimAutoCheck, decideAutoOpen, deliverAutoCheck, loadSkippedVersion,
  saveSkippedVersion, setAutoCheckHandler,
} from './updauto'
// #41 收口 R2 的弹窗归属闸（同屏不许叠两只可各自点安装的窗）；只认识 token，不认识版本号与电话。
import {
  askPort, newPortToken, portAutoShouldClose, releasePort, subscribePort, takeAutoPort,
} from './upddialog'

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
 * 「电话级失败」分三类，**文案必须分开**（红队 L2 打出来的撒谎；L2 第二轮的 N1/N4 又修了两处边角）：
 *
 * 1. `BRIDGE_DOWN_CODES`：**桥本身没回答** —— 没 catch 到 HTTP、回的不是信封、body 不是 JSON、环境没有
 *    fetch。只有这一类的成就是「宿主这次一个字都没回」，`updateHostFailTitle` + `updateHostFailHint`
 *    是给它的。
 * 2. `CAP_DOWN_CODES`：宿主**回了话**，但回的是「更新能力本身没接通」——
 *    `update-capability-unavailable` 是宿主半 `src/update/host/index.ts:52` 的实产码（degraded 实例：
 *    依赖装载失败 / 能力建不起来，两条路都回它，宿主半还专门为它们落了 `dep-load-fail` /
 *    `capability-degraded` / `capability-build-fail` 事件）；`phone-failed` / `unknown-phone` 是同一个
 *    文件里电话路由那一层的实产码（电话抛错 / 路由没有对应电话）。判据是**码的语义，不是它从哪条路
 *    返回**：把它们划进「宿主是通的」那一侧就是撒谎 —— 上一版那句「更新能力可能没接通」对它们本来
 *    是对的，划错类之后反而告诉用户「不用报宿主没接通」、且一个动作都不给（#43 真机验收最容易撞的
 *    失败态正是宿主半没加载）。这一支给 `updateCapDownTitle` + `updateHostFailHint`（同一句
 *    「更新能力可能没接通」）+ 一条动作行。
 * 3. 其余码：宿主回答了「这次操作没成」，给了精确的错误码（`check-expired` / `invalid-release` /
 *    `check-failed` / `install-failed` / `update-busy`…）。对这一类说「宿主没有回答更新状态」才是撒谎
 *    （用户会去报一个不存在的「宿主没接通」故障）⇒ 标题 `updateFailAnsweredTitle` + 按码动作。
 *
 * 第 3 类里**不认识的码**一律落 `updateFailUnknown` 的动作行：说了「往下看这个码与对应做法」就必须给
 * 得出来（N4 —— 曾经 `phone-failed` 与表外的新码拿到的是「承诺了做法却不给做法」）。
 */
const BRIDGE_DOWN_CODES = ['bridge-unreachable', 'bridge-bad-shape', 'bridge-bad-json', 'no-fetch']
/** 宿主回了话、但回的是「更新能力/电话通道本身没接通」（见上面第 2 类）。 */
const CAP_DOWN_CODES = ['update-capability-unavailable', 'phone-failed', 'unknown-phone']

/**
 * 实产失败码 → 「下一步动作」文案键。码从两处抄来，都不是猜的（表里不许有凭空编的码）：
 * - 更新包 `dist/service.js` / `host.js` 里 `updateError(...)` 的实参（`check-expired` / `check-failed` /
 *   `invalid-release` / `install-failed` / `update-busy` / `installation-changed` / `registry-conflict` /
 *   `recovery-required`）；
 * - 宿主半 `src/update/host/index.ts` 的路由层（`update-capability-unavailable` / `phone-failed` /
 *   `unknown-phone`）与桥自己的兜底形状码（`bridge-error`）。
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
  // 能力没接通那一类（CAP_DOWN_CODES）：动作是「重启宿主让能力重建」，不是「宿主是通的，不用刷新页面」。
  'update-capability-unavailable': 'updateCapDownAction',
  'phone-failed': 'updateCapDownAction',
  'unknown-phone': 'updateCapDownAction',
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
 * 入口按钮的样式（#60 追加交付 A）：它现在是**插件身份行里的一枚按钮** —— 与右上角 🌟 / 💬
 * 同一行、同一父节点，排在这两个图标之前。因此它不再有任何自己的容器：`SettingGroup` 那张卡片
 * 与那条整宽 `borderBottom` 都删掉了（上一版把入口做成卡片行，这次连卡片也不要了）。
 *
 * 仍是按钮、不是纯文字，三条可点线索保留：
 *   · 整枚 `cursor: 'pointer'`；
 *   · 悬停铺 `TOK.bgHover`（内联样式没有 `:hover`，沿用既有 `Btn` 的 `useState` + 进入/离开写法）；
 *   · 版本号是一枚**徽标**（等宽 11.5 / `labelSecondary` / 底 `bgLayer` / 圆角 6 / 内距 `1px 6px`）。
 * 数值全部是这一页既有的：字号 12.5（= `Btn`）、11.5（= 徽标 / 日志落点行），圆角 8（= `Btn`）、6（= 徽标），
 * 内距 `4px 6px`、间距 6 —— 没有新造颜色 / 字号 / 圆角。
 *
 * 窄容器（票面追加交付 A 的硬要求）：这一枚可收缩（`minWidth: 0` + 文案省略号），徽标 `flex: 'none'`、
 * 两个图标各自 `flex: 'none'` —— 挤的时候先牺牲文案，**徽标与图标必须留着**。
 */
const entryRowStyle: any = {
  display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, maxWidth: '100%',
  padding: '4px 6px', border: 0, borderRadius: 8, cursor: 'pointer', textAlign: 'left',
  fontFamily: TOK.font, color: TOK.labelPrimary, transition: 'background-color .12s ease',
}
/** 入口文案：可以被挤掉（省略号），与身份行的插件名字同一个处理方式。 */
const entryLabelStyle: any = { fontSize: 12.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
/** 版本徽标：恒定不收缩、不换行（挤的时候它是必须留着的那两样之一）。 */
const entryBadgeStyle: any = {
  flex: 'none', whiteSpace: 'nowrap', fontFamily: TOK.mono, fontSize: 11.5, color: TOK.labelSecondary,
  background: TOK.bgLayer, borderRadius: 6, padding: '1px 6px',
}

/**
 * 设置面板顶部那一行入口 +（点开后）更新弹窗。自带状态：打开设置页时读一次 `status`（只读本机、不联网）。
 *
 * 行与弹窗放同一个组件里是刻意的：版本号来自同一次回包，拆成两处会各自持有一份可能不同步的状态。
 */
export function UpdateEntry(props?: any): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  const lang = getLang()
  const t: T = (k) => tr(lang, STR[k])
  /** 自动模式（#41）：全局宿主渲染的那一份 —— 只出弹窗，不出设置页那一行（见文件头）。 */
  const auto = !!(props && props.auto)
  /**
   * 本实例的弹窗归属名额（#41 收口 R2，见 upddialog.ts）。token 每个挂载一份，跨重挂载不复用：
   * `shell.overlay` 那一份与设置页那一份是两个实例，只有一只能在同一时刻处于可操作态。
   */
  const portRef = react.useRef('')
  if (!portRef.current) portRef.current = newPortToken()
  const port = portRef.current

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
   * 用户点过「跳过此版本」的版本号（#41，只落 localStorage；见 updauto.ts）。
   * 初始值从存储里读一次，写成功后就地更新 —— 按钮随即消失，界面不必等下一次启动才对上。
   */
  const skipState = react.useState(loadSkippedVersion)
  const skipped: string = skipState[0]
  const setSkipped = skipState[1]
  /**
   * 入口那一行的悬停态（#60）：内联样式没有 `:hover`，所以沿用既有 `Btn` 的写法（useState + 进入/离开）。
   * 可点线索一共三条：整行 `cursor: pointer`、整行底色变 `bgHover`、右侧 chevron。
   */
  const rowHoverState = react.useState(false)
  const rowHover: boolean = rowHoverState[0]
  const setRowHover = rowHoverState[1]
  /**
   * 「详情」的展开状态（#60 追加交付 B 第 5 条）：当前 / 已装 / 最新三个版本号是**排查用的实现细节**，
   * 默认收起 —— 用户来这一页问的不是它们，而是「我是不是最新版」。
   */
  const detailState = react.useState(false)
  const detailOpen: boolean = detailState[0]
  const setDetailOpen = detailState[1]

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
  // 失败回包的码：桥没回答 / 宿主回了但说「能力没接通」/ 宿主回了但这次操作没成 —— 三类文案不同
  // （见 BRIDGE_DOWN_CODES / CAP_DOWN_CODES 上面的注释）。
  const failCode = failed ? asText(res && res.error && res.error.code) : ''
  const code = failCode
  // 桥没回答 / 宿主回了但说「能力没接通」/ 宿主回了但这次操作没成 —— 三类文案互不串（见上面三条的注释）。
  const bridgeDown = failed && BRIDGE_DOWN_CODES.indexOf(failCode) >= 0
  const capDown = failed && !bridgeDown && CAP_DOWN_CODES.indexOf(failCode) >= 0
  // 「认识就给按码动作、不认识就给 updateFailUnknown 的兜底动作」：绝不出现「说了看做法、做法却是空的」
  // （N4 的死端）。桥没回答那一类靠 `updateHostFailHint` 自带做法，不给动作行。
  const failAction = failed && !bridgeDown ? t(UPDATE_FAIL_KEYS[failCode] || 'updateFailUnknown') : ''
  const failTitle = bridgeDown ? 'updateHostFailTitle' : capDown ? 'updateCapDownTitle' : 'updateFailAnsweredTitle'
  const failHint = bridgeDown || capDown ? 'updateHostFailHint' : 'updateFailAnsweredHint'
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
  /**
   * 结论判据（#60 追加交付 B 第 1 条）：这个弹窗只回答一个问题 ——「我是不是最新版？不是的话怎么装上？」
   * 所以先算出这次该说的是哪一句，后面每一块的取舍都挂在它上面：
   *   `newer`    最新版比正在跑的新 ⇒「有新版本 x（当前 y）」；
   *   `uptodate` 两边都读得出来、且最新版不比正在跑的新 ⇒「已是最新版本（x）」；
   *   `unknown`  其余（还没查过 / 版本读不出来 / 电话级失败）⇒「这次没查到」+ 一句下一步；
   *   `restart`  待重启：主角是上面那条横幅，结论行不出现（同一时刻只许有一个主角）。
   * 「有没有新版」不另立第二套口径：与自动弹窗共用 `decideAutoOpen`（它内部就是 `compareVersionsText`）。
   */
  const hasNewer = decideAutoOpen({ latest, running, skipped: '' }).open
  const verdict = pendingRestart ? 'restart' : hasNewer ? 'newer' : latest && running ? 'uptodate' : 'unknown'

  // 打开设置页就读一次状态（只读本机）：入口那行要显示的「当前版本」就是从这里来的。
  // 自动模式（#41）不读这一次：check 的回包本来就带 running / installed / latest 三个版本号，
  // 而挂载那次 status 还在飞的时候，`run` 的单飞锁会把延迟到点的那条 check **原地吞掉** —— 自动模式
  // 只发一条电话，也就不存在这个竞争。
  react.useEffect(() => {
    if (auto) return undefined
    run(updatePhoneNames.updateStatus, 'status').catch(() => undefined)
  }, [auto])

  /**
   * 打开设置页读一次状态不够：install 的回包只是「安装中…」（真装在宿主后台跑），
   * 没有轮询面板就**永远停在「安装中…」**，直到用户自己再点一次「检查更新」——同一件事也是
   * 「安装失败了没有任何触发点」的根因（包 README 第 3 节客户端三件事之一就是「按间隔轮询查状态」，
   * 示例正是 `setInterval(readStatus, UPD_POLL)`）。
   *
   * 三条纪律：
   * 1. 间隔取派生文件的 `UPD_POLL`（不写字面量；换前缀或升级包时重跑 derive 即可）；
   * 2. **只在弹窗打开期间**跑，关闭 / 卸载时 `clearInterval`（`open` 为假就一条不发：启动自动检查走
   *    下面的 auto 分支，不在这里）；
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
   * 启动自动检查（#41，只在 `auto` 模式跑）：延迟到点领闸，领到才发**一条** check；回包落地交给
   * **当前活着的挂载**处理（`applyAutoResult`），有新版本、且不是用户点过「跳过此版本」的那一个，
   * 才把同一只弹窗开出来。
   *
   * 五条纪律：
   * 1. **延迟常量只在 updauto.ts 定义一次**（这里引用，不写第二个数字）；
   * 2. 一个页面会话至多一次自动开窗：名额是 #41 收口 R1 的三态闸，只在**回包真的交到活着的挂载手里**之后
   *    才算花掉（`deliverAutoCheck` 看 handler 的返回值）—— 第一条 check 还在飞、或回包读不出来时
   *    重挂载，名额不会被白花掉（见 updauto.ts 的注释）；
   * 3. 判据是纯函数 `decideAutoOpen` —— 比不出大小就不弹；这一支的失败**不上面**（后台动作不该把设置页
   *    炸掉，也不该在界面上多一块用户没点过的失败），用户手动点「检查更新」仍有 #40 的全套说明；
   * 4. **开窗先领弹窗名额**（R2）：名额被占（多半是设置页那只已经打开）就不接手，`setOpen` 一次都不调 ——
   *    同一时刻只许一只可操作态的弹窗（见 upddialog.ts）；
   * 5. 卸载即清定时器：关掉弹窗 / 卸载宿主后不留任何常驻定时器（票面验收第 3 条）。
   */

  /**
   * 回包交接的接收端（R1 的关键一条）：一条自动 check 的在飞时间（8 秒延迟 + 通话）足够宿主重挂载，
   * 发起那次挂载的闭包会随卸载作废 —— 所以回包不写进「发起者的状态」，而是回到**当前挂载**这里：
   * 落状态、判据、开窗都由还活着的那一份做。返回值 = 这次是不是可判读的回包（闸据此结算）。
   *
   * `res` 与手动路径落到同一个 `res` / `lastGoodRes`：版本行读的就是它 —— 只把快照拿来判据、
   * 不落状态，弹出来的窗上会是「版本未知」（红队 R1 场景实测）。
   */
  const applyAutoResult = (resRaw: unknown): boolean => {
    const out = (resRaw && typeof resRaw === 'object' ? resRaw : null) as UpdateCallResult | null
    if (out) {
      setRes(out)
      if (out.ok) setLastGood(out)
      else setNote('')
    }
    const s = snapOf(out)
    const verdict = decideAutoOpen({
      latest: asText(s && s.latestVersion),
      running: asText(s && s.runningVersion),
      skipped: loadSkippedVersion(),
    })
    if (verdict.open && takeAutoPort(port)) {
      setNote(t('updateAutoNote'))
      setOpen(true)
    }
    return !!s
  }
  /**
   * 挂载时登记接收端（依赖是 `[auto]` 常量：登记一次不再重建，回包落到最新挂载的实例上）。
   * 只有 auto 那一份登记：设置页那份一挂上就会抢在自动检查前面占掉弹窗名额，但它绝不代为开窗。
   */
  react.useEffect(() => {
    if (!auto) return undefined
    return setAutoCheckHandler(applyAutoResult)
  }, [auto])

  react.useEffect(() => {
    if (!auto) return undefined
    // 定时器到点先**领闸**再发：名额空着（没人发过 / 上一次回包读不出来）才发这一条电话。
    const timer = setTimeout(() => {
      if (!claimAutoCheck()) return
      run(updatePhoneNames.updateCheck, 'check')
        .then((out) => { deliverAutoCheck(out) })
        .catch(() => { deliverAutoCheck(null) })
    }, AUTO_CHECK_DELAY_MS)
    return () => clearTimeout(timer)
  }, [auto])

  /**
   * 弹窗归属的订阅（R2）：名额被别人（用户那只）接管时，自动那一只自己关掉，不留一只**可被点安装的**
   * 背景弹窗；用户那只则什么都不做（它是被用户亲手开出来的，见 upddialog.ts 的口径 2）。
   * 依赖是 `[auto, port]` 两个常量，订阅一次不再重建：回调里读的是 `portRef.current` 的现值。
   */
  react.useEffect(() => {
    const onPort = (): void => {
      if (portAutoShouldClose(port)) setOpen(false)
    }
    onPort()
    const off = subscribePort(onPort)
    return () => {
      off()
      // 只有「还占着」才归还：名额被晚挂载的实例接手时，本实例的清理不许把它抢回去。
      releasePort(port)
    }
  }, [auto, port])

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
   *
   * `force` 给重试那一轮用（N3）：收到 `check-expired` 时，宿主眼里的凭证已经死了，而面板自己那份
   * `expiresAt` 可能还说它新鲜（两边时钟差、或另一端把唯一的 `checked` 槽抢走了）。这时 `held` 与这里
   * 读的 `res` 是**同一次渲染的闭包**，失败回包还没落地 ⇒ 不强制就只会把同一张死凭证原样再交一遍
   * （红队实测：`status,check,install[rid-1],install[rid-1]`，中间零 check ⇒ 重试是空转）。
   *
   * 返回值三态：凭证字符串 / `''`（这次真没拿到凭证）/ `null`（单飞锁挡着：上一次通话还在飞）。
   */
  const ensureCheckId = async (force = false): Promise<string | null> => {
    const held = checkIdOf(res)
    // 只认「把 check 回包放进界面状态」的那张（见 receiptFresh）：它一定来自 check。
    if (!force && held && receiptFresh(res)) return held
    const out = await run(updatePhoneNames.updateCheck, 'check')
    if (!out) return null
    if (!out.ok) return ''
    return checkIdOf(out)
  }

  /**
   * 点「安装新版本」。凭证在**提交那一刻已经过期**是实产路径（用户查完新版去干别的、回来再点安装），
   * 这不是程序缺陷也不是「宿主没接通」：重取一次凭证再提交一次，最多两轮（`check-expired` 后重试一次
   * 就地收敛，不给无限循环留口子）。第二轮**强制重查**（N3）：手里那张在宿主眼里已经死了，不重查就是
   * 拿同一张再撞一次。两轮都过期才把码摆到界面上让用户看见。
   * 同一个 `requestId` 贯穿两轮（包里对同 requestId 是幂等重放 ⇒ 不是「装两次」）。
   */
  const onInstall = async (): Promise<void> => {
    const requestId = 'upd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
    for (let attempt = 0; attempt < 2; attempt++) {
      const checkId = await ensureCheckId(attempt > 0)
      if (checkId === null) {
        // 单飞锁挡着（多半是轮询那一发还在飞）：真实原因是「面板正忙」，**不是**宿主没给凭证。
        // 照后者说（N5）会把用户支去重新查新版，而这里该做的是等一拍再点。
        setNote(t('updateBusyRetry'))
        return
      }
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

  /**
   * 关窗：**只关窗，不释放弹窗名额** —— 名额要一直占到实例卸载（`releasePort` 在那条 effect 的清理里）。
   * 这样自动那只才不会「用户刚关掉又弹回来」，而设置页这一份重开也不受影响（它本来就占着名额）。
   */
  const close = (): void => { setOpen(false); setNote('') }
  /**
   * 设置页那一枚入口按钮（#60 追加交付 A，用户原话「检查更新和版本号和 star 的按钮在一起」）：
   * 它由 `settings.ts` 交给身份行渲染 —— 与 🌟 / 💬 同一行、同一父节点、顺序在两个图标之前。
   *
   * 所以这里**只出这一枚按钮**（外加弹窗，见函数尾）：没有卡片、没有 `borderBottom`、没有整行布局。
   * 三条可点线索与窄容器口径见 `entryRowStyle` 上面那段注释。
   * 行为一字不动（#40/#41 已验收）：点它仍是 askPort + setOpen，`data-dsh-prompt-update` 仍在**可点的
   * 那一个**元素上（回归脚本点它、并在 auto 模式数它为 0）。
   */
  const row = h('button', {
    key: 'update-row',
    type: 'button',
    'data-dsh-prompt-update': '',
    // 用户亲手开：先领名额（若自动那一只正占着就压掉它，见 upddialog.ts 的口径 2），再开窗。
    onClick: () => { askPort(port); setOpen(true) },
    onMouseEnter: () => setRowHover(true),
    onMouseLeave: () => setRowHover(false),
    style: { ...entryRowStyle, background: rowHover ? TOK.bgHover : 'transparent' },
  }, [
    h('span', { key: 'label', style: entryLabelStyle }, t('updateEntry')),
    h('span', { key: 'ver', 'data-dsh-prompt-update-version': '', style: entryBadgeStyle }, versionLine),
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

  // ①b 结论行（#60 追加交付 B 第 1 条）：**这一页唯一的视觉主角** —— 三选一，一眼回答
  //     「我是不是最新版」。它是整只弹窗里唯一铺了底色的块（其余块只有描边），13/600/labelPrimary。
  //     `pending-restart` 时不出现：那种状态的主角是上面那条横幅，绝不并排两个主角。
  if (verdict !== 'restart') {
    const line = verdict === 'newer'
      ? fill(t('updateVerdictNewer'), { latest, running })
      : verdict === 'uptodate'
        ? fill(t('updateVerdictUpToDate'), { version: latest || running })
        : t('updateVerdictUnknown')
    const parts: any[] = [
      h('span', {
        key: 'v', 'data-dsh-prompt-update-verdict': verdict,
        style: { fontSize: 13, fontWeight: 600, lineHeight: 1.6, color: TOK.labelPrimary },
      }, line),
    ]
    // 「这次没查到」还得给一句下一步。电话级失败 / 装不了这两类原因与下一步由下面那些块原样负责
    // （既有形态一个字不改），所以这里只在**没有**那些块的时候补一句，绝不把同一件事说两遍。
    if (verdict === 'unknown' && !failed && !reason) {
      parts.push(h('span', {
        key: 'next', style: { fontSize: 12, lineHeight: 1.65, color: TOK.labelSecondary },
      }, t('updateVerdictUnknownHint')))
    }
    children.push(h('div', {
      key: 'verdict', 'data-dsh-prompt-update-verdict-box': '',
      style: { ...blockStyle, background: TOK.bgLayer },
    }, parts))
  }

  // ② 电话级失败：`snapshot` 为 null 也要说清楚（票面验收：不能空白）。
  //    三类文案分开：`bridgeDown` 才是「宿主一个字都没回」；`capDown` 是「宿主回了、但更新能力没接通」
  //    （对这两类说「宿主是通的、不用刷新页面」都是撒谎，见 BRIDGE_DOWN_CODES 上的注释）；
  //    其余码是宿主**回答了**、给了精确码。失败块一定带原始码 —— 用户报 Issue 时靠它。
  if (failed) {
    const why = UPDATE_REASON_KEYS[code]
    const parts: any[] = [
      h('span', { key: 't', style: { fontSize: 13, fontWeight: 600 } }, t(failTitle)),
      h('span', { key: 'code', 'data-dsh-prompt-update-code': '', style: codeStyle }, code || 'unknown'),
      h('span', { key: 'hint', style: { fontSize: 12, color: TOK.labelSecondary, lineHeight: 1.6 } }, t(failHint)),
    ]
    // 宿主回了话但没成（含「能力没接通」与不认识的码）：按码给「下一步动作」——
    // 动作行**恒非空**（不认识的码落兜底），不做「承诺了做法却不给做法」的死端。
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

  // ③ 三个版本号搬到结尾的「详情」里（#60 追加交付 B 第 5 条）：它们默认收起 —— 排查用的实现细节，
  //    不是用户来这一页的主问题。这里只留一句「安装中…」（真装在宿主后台跑，面板停在那一刻）。
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

  // ④ 装不了的原因：给「用户该做什么」，不给英文原因码了事。它排在按钮**之前** ——
  //    先看清「为什么装不了 / 还要做什么」，再决定按哪一个按钮。
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

  /**
   * ⑤ 按钮行（#60 追加交付 B 第 2 条）：**同一时刻只有一个主（accent）按钮**，随结论变 ——
   *   结论是「有新版本」且宿主说能装时，主按钮是「安装新版本」，「检查更新」降为次级（随时能重查）；
   *   其余结论（已是最新 / 这次没查到 / 待重启）主按钮就是「检查更新」，**不给安装按钮**
   *   （没有已知的新版本时摆一个安装按钮，正是用户说的「主次颠倒」）。
   * 「跳过此版本」（#41 交付 3）是次级按钮，仍在最左：
   *   只在新版本确实比正在跑的新、且还没跳过**这一个**版本号时给？—— 是，判据与自动弹窗共用同一条
   *   （`hasNewer` 就是 `decideAutoOpen` 的结果），不另立第二套口径；点下去只写 localStorage
   *   （`storages/dsh_prompt.json` 的 schema 已冻结，不许动，见 map #38 定案）。
   *   已经跳过这一个版本时按钮不再给（没什么可跳的了）：跳过**只挡自动弹窗**，手动点「检查更新」
   *   照旧看得到这个版本与安装按钮（票面交付 3 的后半句）。
   */
  const canSkip = hasNewer && skipped !== latest
  const onSkip = (): void => {
    const written = saveSkippedVersion(latest)
    if (written) {
      setSkipped(latest)
      setNote(fill(t('updateSkipDone'), { version: latest }))
    } else {
      // 写失败必须说出来：不说就等于让用户以为「下次不会弹了」。
      setNote(t('updateSkipFail'))
    }
  }
  const primaryIsInstall = verdict === 'newer' && canInstallSafe && !pendingRestart
  children.push(h('div', { key: 'actions', style: { display: 'flex', justifyContent: 'flex-end', gap: 8 } }, [
    canSkip
      ? h('button', {
        key: 'skip', type: 'button', 'data-dsh-prompt-update-action': 'skip', disabled: busy !== '',
        onClick: () => { onSkip() }, style: btn(false),
      }, t('updateSkipVersion'))
      : null,
    // 「检查更新」永远在：主按钮不是它的时候降为次级（这样改口径之后用户仍能随时重查一次）。
    h('button', {
      key: 'check', type: 'button', 'data-dsh-prompt-update-action': 'check', disabled: busy !== '',
      onClick: () => { run(updatePhoneNames.updateCheck, 'check').catch(() => undefined) },
      style: btn(!primaryIsInstall),
    }, busy === 'check' ? t('updateBtnChecking') : t('updateBtnCheck')),
    primaryIsInstall
      ? h('button', {
        key: 'install', type: 'button', 'data-dsh-prompt-update-action': 'install', disabled: busy !== '',
        onClick: () => { onInstall().catch(() => undefined) },
        style: btn(true),
      }, busy === 'install' ? t('updateBtnInstalling') : t('updateBtnInstall'))
      : null,
  ]))

  /**
   * ⑥ 手工兜底命令（#60 追加交付 B 第 4 条）：**只在「自动安装不可用」或「这次失败」时才出现**，
   *    不再常驻 ——
   *      · 宿主说这台机器装不了：`blockedReason` 非空且 `canInstall` 为假（八条原因里的每一条都算，含待重启）；
   *      · 这次通话失败：电话级失败（`failed`）或安装任务的终态失败（`jobFailed`）。
   *    一切正常时（刚打开 / 已是最新 / 查到新版且可装）一个字都不出现。
   *
   *    命令值仍是宿主每次回包里的那个，现刷、不缓存；一次失败的 check 不该把手上那条还能用的命令
   *    整块藏掉（L2：成功过就有命令，失败后命令块消失），但必须标清它来自上一份回包。
   */
  const manualNeeded = failed || jobFailed || (!!reason && !canInstallSafe)
  if (manualNeeded && manual) {
    children.push(h('div', { key: 'manual', 'data-dsh-prompt-update-manual': '', style: blockStyle }, [
      h('div', { key: 'h', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 } }, [
        h('span', { key: 't', style: { fontSize: 12.5, fontWeight: 600 } }, t('updateManualTitle')),
        h('button', {
          key: 'copy', type: 'button', 'data-dsh-prompt-update-action': 'copy',
          onClick: () => { onCopy().catch(() => undefined) }, style: { ...btn(false), padding: '4px 10px' },
        }, t('updateBtnCopy')),
      ]),
      h('code', { key: 'cmd', 'data-dsh-prompt-update-command': '', style: codeStyle }, manual),
      // 命令下面**只留一句**说清它能做什么（上一版那段四行免责声明已删，见票面追加交付 B 第 6 条）。
      h('span', { key: 'hint', style: { fontSize: 11.5, lineHeight: 1.65, color: TOK.labelTertiary } }, t('updateManualHint')),
      // 命令是**上一次成功回包**给的：说清它是旧的那一份，别让用户以为这是这次电话的答复。
      failed
        ? h('span', {
          key: 'stale', 'data-dsh-prompt-update-manual-stale': '',
          style: { fontSize: 11.5, lineHeight: 1.65, color: TOK.labelTertiary },
        }, t('updateManualStale'))
        : null,
    ].filter(Boolean)))
  } else if (manualNeeded) {
    // 需要兜底、宿主却没给命令（包 README 第 9 节：源码安装与认不出使用范围这两种情形本来就不给）：
    // 那就只讲这一句，不摆一个空命令块。
    children.push(h('div', {
      key: 'manual-none',
      'data-dsh-prompt-update-manual-empty': '',
      style: { fontSize: 11.5, lineHeight: 1.65, color: TOK.labelTertiary },
    }, t('updateManualNone')))
  }
  if (note) children.push(h('div', { key: 'note', style: { fontSize: 11.5, color: TOK.labelTertiary } }, note))

  /**
   * ⑦ 详情（#60 追加交付 B 第 5 条）：当前 / 已装 / 最新三个版本号**默认收起**。
   *    它们是排查用的实现细节（报 Issue 时才要），不是用户的主问题；展开按钮是一枚纯文本切换，
   *    不带 `data-dsh-prompt-update-action`（它不是动作，别混进「这只窗有几个动作」的账里）。
   *    三个字段的挂点（`data-dsh-prompt-update-field`）顺序与名字一字不动，只是搬进了这一层。
   */
  children.push(h('div', {
    key: 'details',
    style: { display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid ' + TOK.border, marginTop: 2, paddingTop: 10 },
  }, [
    h('button', {
      key: 'toggle', type: 'button', 'data-dsh-prompt-update-details-toggle': '',
      onClick: () => { setDetailOpen(!detailOpen) },
      style: {
        display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', padding: 0, border: 0,
        background: 'transparent', cursor: 'pointer', fontFamily: TOK.font, fontSize: 12, color: TOK.labelTertiary,
      },
    }, [
      t('updateDetails'),
      h('span', {
        key: 'c', 'aria-hidden': 'true',
        style: { display: 'inline-block', fontSize: 12, transform: detailOpen ? 'rotate(90deg)' : 'none' },
      }, '›'),
    ]),
    detailOpen
      ? h('div', {
        key: 'fields', 'data-dsh-prompt-update-details': '',
        style: { display: 'flex', flexDirection: 'column', gap: 6 },
      }, [
        versionRow('running', t('updateRowRunning'), running || t('updateNotAvailable')),
        versionRow('installed', t('updateRowInstalled'), installed || t('updateNotAvailable')),
        versionRow('latest', t('updateRowLatest'), latest || t('updateLatestNone')),
      ])
      : null,
  ]))

  const modal = !open ? null : h(ModalPortal, { key: 'update-modal' }, h('div', {
    'data-dsh-prompt-update-modal': '',
    style: maskStyle,
    onClick: close,
  }, h('div', { style: cardStyle, onClick: (e: any) => { if (e && typeof e.stopPropagation === 'function') e.stopPropagation() } }, children)))

  // 自动模式（#41）：全局那一份只出弹窗，不出设置页那一枚入口按钮；关着的时候整棵子树回 null ——
  // 宿主浮层里不留一个空壳节点（`modal` 自己经 ModalPortal 挂 body，与设置页那一份同一套顶层机制）。
  if (auto) return modal

  // 设置页那一份（#60 追加交付 A）：入口按钮与弹窗仍是同一个组件（版本号来自同一次回包，拆成两处
  // 会各自持有一份可能不同步的状态），但**按钮本身由 settings.ts 交给插件身份行去渲染** ——
  // 它就坐在 🌟 / 💬 那一行里。所以这里交出去的是「按钮 + 弹窗」（Fragment 不做任何布局：
  // 弹窗经 ModalPortal 挂 body，与身份行没有父子关系）。
  return h(react.Fragment, null, [row, modal])
}
