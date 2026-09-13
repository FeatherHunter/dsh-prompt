/**
 * dsh-prompt — 启动自动检查的两块判据与一道闸（#41）：跳过记录存哪、这次该不该弹、能不能发
 *
 * 本文件的性格与 `src/client/state.ts` 一样：不渲染、不认识 RPC、也不 import update.ts
 * （免得和它绕成一个环）。#41 新增的能力里，凡是**不需要 React 与电话**的部分都落在这里：
 *   1. 「跳过此版本」的存取 —— 只落 localStorage 一个键；
 *   2. 「这次该不该自动弹」的纯判据 `decideAutoOpen`；
 *   3. 「一次启动只自动查一次」的闸 `claimAutoCheck` / `deliverAutoCheck`（三态 + 回包交接，见注释）。
 * 另一道闸（弹窗归属：同屏不许叠两只可各自点安装的窗）在 `upddialog.ts`：那边要订阅 React 重渲染，
 * 与这里的纯判据分开，两边都不认识对方。
 * 调用点在 update.ts 的 auto 模式：延迟到点 → 领闸 → 发一条 check → 回包落地交给**当前挂载**的
 * `applyAutoResult`（落状态 + 把快照喂给 `decideAutoOpen`）→ 为真才开弹窗（弹窗本身仍是 #40 那一只，
 * 没有第二只）；结算由 `deliverAutoCheck` 做，交接不到活着的挂载就把名额放回去。
 *
 * 三条边界（map #38 的 grilling 定案）：
 * 1. 「跳过此版本」**只落 localStorage**，不进 `storages/dsh_prompt.json`（那个 schema 已冻结），
 *    也不另造第二套存储：它与 smartstore.ts 的 `dsh.prompt.smart.v2` / `dsh.prompt.smartPos`
 *    是同一层东西 —— 纯本机 UI 偏好，不跨端、不进 domain、不需要宿主参与。所以本文件不认识
 *    store.ts，也不写任何端点路径。
 * 2. 判据只在客户端做：宿主回包里的快照本来就有 `runningVersion` / `latestVersion` 两个字段，
 *    比一比就够，不为「有没有新版」新增电话（#41 一个字节都不改宿主半）。
 * 3. 比不出大小就不弹：版本字段是坏形状 / 认不出时，宁可这次不打扰用户，也不凭猜测弹窗。
 *    代价是「宿主读不出当前版本 ⇒ 这次不弹」，这正是要的保守侧。
 */

/**
 * localStorage 键：记下「用户点过跳过此版本」的那个版本号（与 smartstore 的键同一个命名空间）。
 * 值是 `{"version":"x.y.z"}` 的 JSON 文本；读不出来的历史值一律按「没跳过任何版本」处理。
 * 本机偏好键不写日志（与 smartstore 同一取舍），所以本文件不引日志能力。
 */
export const UPD_SKIP_KEY = 'dsh.prompt.upd.skip'

/**
 * 用户在这一台机器上点过「跳过此版本」的版本号；没有记录 / 坏形状 / 存储不可用一律回空串。
 * 读失败绝不上抛：存储坏了最多是「下次启动再弹一次」，不能因此影响界面。
 */
export function loadSkippedVersion(): string {
  try {
    const store = globalThis.localStorage
    if (!store) return ''
    const raw = store.getItem(UPD_SKIP_KEY)
    if (!raw) return ''
    const parsed = JSON.parse(raw) as { version?: unknown } | null
    if (!parsed || typeof parsed !== 'object') return ''
    return typeof parsed.version === 'string' ? parsed.version : ''
  } catch (e) {
    return ''
  }
}

/**
 * 记下要跳过的版本号；写失败（隐私模式 / 配额满 / 没有存储）只回 false，不抛 ——
 * 调用方拿到 false 就必须把「这次没记成」说清楚，别让用户以为下次不弹了。
 */
export function saveSkippedVersion(version: string): boolean {
  if (!version) return false
  try {
    const store = globalThis.localStorage
    if (!store) return false
    store.setItem(UPD_SKIP_KEY, JSON.stringify({ version }))
    return true
  } catch (e) {
    return false
  }
}

/** 三段式版本号（`[major, minor, patch]`）。 */
export type VersionTriple = [number, number, number]

/**
 * 从更新包抄来的口径：`dist/commands.js` 的 `validVersion` 与客户端派生的东西一样，
 * 要求**正好三段十进制数字**（包自己的 `parseTriple` 其实会把 `x.y` 补成 `x.y.0`，但那只用于
 * 手工命令的版本排序；这里判的是「要不要自动弹窗」，取更严的那一条：认不出就不弹）。
 * 于是 `0.1.2-beta.1` / `0.1` / `v0.1.2` 都落进「认不出」这一侧。
 */
const TRIPLE = /^\d+\.\d+\.\d+$/

/** 把版本号读成三段；非字符串 / 段数不对 / 含非数字段 → null（不抛）。 */
export function parseTriple(v: unknown): VersionTriple | null {
  if (typeof v !== 'string' || !TRIPLE.test(v)) return null
  const parts = v.split('.')
  const nums: number[] = []
  for (const p of parts) {
    const n = Number(p)
    if (!Number.isSafeInteger(n) || n < 0) return null
    nums.push(n)
  }
  return [nums[0], nums[1], nums[2]]
}

/**
 * `a` 比 `b` 新回 1、一样回 0、旧回 -1；任一边读不出来回 `null`（调用方据此别当「有新版本」）。
 * 只比数字，不处理预发布后缀 —— 本仓与更新包的版本号都是三段式。
 */
export function compareVersionsText(a: unknown, b: unknown): number | null {
  const pa = parseTriple(a)
  const pb = parseTriple(b)
  if (!pa || !pb) return null
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1
    if (pa[i] > pb[i]) return 1
  }
  return 0
}

/** `decideAutoOpen` 的入参：三个版本号原样来自宿主回包与 localStorage，坏形状也不怕。 */
export interface AutoOpenInput {
  /** 回包里的 `latestVersion`（官方源问到的最新版本）。 */
  latest: string
  /** 回包里的 `runningVersion`（这台机器正在跑的版本）。 */
  running: string
  /** localStorage 里记下的「跳过此版本」。 */
  skipped: string
}

/** `decideAutoOpen` 的判据结果：`why` 只给测试与人看，不上面。 */
export interface AutoOpenVerdict {
  open: boolean
  why: string
}

/**
 * 这次该不该自动弹更新弹窗。五条判据，按顺序早退（`why` 就是先撞上的那一条）：
 *   `bad-version`  版本号读不出来（含 latest / running 任一边）⇒ 不弹（见文件头第 3 条）；
 *   `not-newer`    latest 不比 running 新（相等或更旧）⇒ 不弹；
 *   `skipped`      latest 正好是用户点过「跳过此版本」的那一个 ⇒ 不弹；
 *   `newer`        其余 ⇒ 弹。
 *
 * 两句必须记住的话：
 * 1. **「跳过」只挡自动弹**，不挡手动检查 —— 手动路径根本不走这个函数，用户在面板里点
 *    「检查更新」仍然看得到这个版本（票面交付 3 的后半句）。
 * 2. 判据里没有「跳过多久 / 跳过哪些版本」这类策略：只认**一个**版本号，换个新版本号就会再弹一次
 *    （票面「不做」那一节把「忽略 N 天」明确留给了将来的票）。
 */
export function decideAutoOpen(input: AutoOpenInput): AutoOpenVerdict {
  const latest = input ? input.latest : ''
  const running = input ? input.running : ''
  const skipped = input ? input.skipped : ''
  if (compareVersionsText(latest, running) !== 1) {
    // 读不出来（null）与「不比 running 新」在这里合并成一类：两种都不该弹。
    const readable = parseTriple(latest) !== null && parseTriple(running) !== null
    return { open: false, why: readable ? 'not-newer' : 'bad-version' }
  }
  if (latest === skipped) return { open: false, why: 'skipped' }
  return { open: true, why: 'newer' }
}

/**
 * 启动后等多久才发那条自动检查的电话（毫秒）。
 *
 * 为什么是 8 秒：宿主半的更新能力是在 boot 之后才装载的（装载失败会回 `update-capability-unavailable`，
 * 见 update.ts 的 CAP_DOWN_CODES），桥路由也要等本地 web 服务起来 —— 早于这个窗口发出去只是白费
 * 这一次机会（本票一个页面会话只自动查一次）。8 秒既避开启动竞争，又不至于让用户以为「它根本没查」。
 *
 * **这个数字在本仓的代码里只出现这一处**（票面交付 1）：调用点引用常量，回归脚本把同一个期望写死。
 */
export const AUTO_CHECK_DELAY_MS = 8000

/**
 * 「一次启动只自动查一次」的闸（#41 收口 R1，三态 + 回包交接）。
 *
 * 宿主把浮层槽重建、会话切换都可能让宿主组件重挂载，那不该变成第二条电话、第二只弹窗 —— 票面的
 * 「有新版本弹一次」说的是**每次启动至多一次**（页面重载 = 新的一次启动，闸跟着模块重建）。
 *
 * 三态而不是「领了就花掉」（红队 N §4 实测的洞）：第一条 check 还在飞的时候宿主重挂载，旧写法里
 * 名额已经被前一次挂载花掉，新挂载的延迟到点后什么也不做 ⇒ **这一整个会话再也不自动弹窗**
 * （实测通话只有 `check×1`、没有窗口）。所以分成三件事：
 *   - 还没发出去：`autoInFlight` / `autoSpent` 都是假 ⇒ 可以领；
 *   - 已经有一条在飞：`autoInFlight` ⇒ 不重发（不变成两条电话），回包**交给还活着的那个挂载**收
 *     （见 `setAutoCheckHandler`）—— 发出去的那次挂载会卸载，不交接就等于把结果扔掉；
 *   - 拿到了**可判读的回包**：`autoSpent` ⇒ 从此不再发（一次启动就一次）；
 *   - 回包不可判读（桥没答 / 能力没接通 / 连快照都没有）：`deliverAutoCheck` 放闸 ——
 *     「花掉名额」这件事只在真的换来一次判断之后才算数，而不是把「这一整个会话」赔进去。
 *
 * 用户手动点「检查更新」不走这里：想查几次查几次（交付 3 的后半句就靠这条分界）。
 */
let autoInFlight = false
let autoSpent = false

/**
 * 回包交接的落点：当前挂载的 handler（每次挂载登记一次，卸载时注销）。
 * 只在「有一条在飞」的时候可能有值 —— 这份闸就是它的生命周期。
 * 参数是**整条通话结果**（`UpdateCallResult`）：本模块不认识它的形状，只当交接物。
 */
type AutoCheckHandler = (result: unknown) => boolean
const autoHandlers: AutoCheckHandler[] = []

/**
 * 领这一次启动的自动检查名额：名额空着就发（`true`），已经有一条在飞或已经拿到过可判读的回包就
 * 不发（`false`）。拿到 `true` 的调用方**必须**在回包落地时叫一次 `deliverAutoCheck(result)`。
 */
export function claimAutoCheck(): boolean {
  if (autoInFlight || autoSpent) return false
  autoInFlight = true
  return true
}

/**
 * 登记「回包交给谁」：当前挂载的实例在挂载时登记、卸载时注销（拿返回值当注销函数）。
 * 挂载顺序保证新挂载一登记就能接住在飞的那一条（登记只用 `useState`，比 8 秒的延迟早得多）。
 */
export function setAutoCheckHandler(fn: AutoCheckHandler): () => void {
  autoHandlers.push(fn)
  return () => {
    const i = autoHandlers.indexOf(fn)
    if (i >= 0) autoHandlers.splice(i, 1)
  }
}

/**
 * 一条自动 check 的回包落地：交给**当前还活着**的挂载处理（它负责落状态、判据、开窗、把话说清楚），
 * 并据此结算闸 —— handler 回 `true` 表示这次拿到的是可判读的回包（名额落定），回 `false`
 * （或压根没人接：卸载后再也没有挂载）就把名额放回去。
 *
 * `result` 用 `unknown`：本模块不认识通话结果的形状，只当交接物。
 */
export function deliverAutoCheck(result: unknown): void {
  autoInFlight = false
  let readable = false
  for (const fn of autoHandlers.slice()) {
    try { if (fn(result)) readable = true } catch (e) { /* 一个 handler 抛不许影响闸的结算 */ }
  }
  if (readable) autoSpent = true
}
