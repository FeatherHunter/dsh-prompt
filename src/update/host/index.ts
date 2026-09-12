/**
 * dsh-prompt — 更新能力的宿主半（#39）：把更新包的电话挂到既有 HTTP 桥上
 *
 * 更新包 `dsh-plugin-update` 对通道完全无感：`createHostUpdate()` 只回一张「电话名 → 普通异步函数」
 * 的表，注册到哪里由调用方定。本插件不另开 RPC 通道、不迁 `ctx.remote`，就挂现有这条
 * `/_dsh/dsh-prompt/*` 桥（同源防护与既有端点同生共死，见 lib/index.js 的 isAllowed）。
 *
 * 三条路由的路径取 `../bridge.js`（客户端半的同一处定义），本文件不写字面量。
 *
 * 本票只做接线与构建准备：不自动检查、不做面板（#40 / #41）。`createUpdateCapability()`
 * 建起来只注册处理器；状态快照要等客户端点「检查更新」（#40）才会被读。
 *
 * 「环境认不出」是诚实失败：`createHostUpdate` 建不出来（例如本插件跑在开发目录里、按包名
 * 找不到当前版本）时返回 degraded 实例，三条路由明确回 `update-capability-unavailable`，
 * 语义对齐 `lib/log/index.js` 的 degradedCapability，而不是让路由 500 或静默。
 */

import type {
  CreateHostUpdateDeps,
  HostUpdate,
  UpdateLogCtx,
  UpdatePhoneResult,
} from 'dsh-plugin-update'
import {
  UPDATE_CHECK_PATH,
  UPDATE_INSTALL_PATH,
  UPDATE_STATUS_PATH,
} from '../bridge.js'

/** 宿主半在日志能力面前的身份（与 lib/index.js 的 PLUGIN_ID、cordis.patch.yml 的 id 同值）。 */
export const PLUGIN_ID = 'dsh-prompt'
/** 电话名前缀：与客户端半派生文件 `gen/updateClient.derived.js` 的 --prefix 必须同值。 */
export const PHONE_PREFIX = 'prompt'
/** 要检查更新的包是谁 —— 就是本插件自己。 */
export const TARGET_PACKAGE_NAME = 'dsh-prompt'

/** 能力缺席时三条路由统一回的错误码。 */
const UNAVAILABLE = 'update-capability-unavailable'

/**
 * 三条更新路由共同的路径前缀（`/_dsh/dsh-prompt/update`）。从 `../bridge.js` 的常量派生，
 * 不写路径字面量 —— 宿主半的路径只有 bridge 一处来源（回归脚本会拦字面量）。
 * 用途仅一个：日志里标「这条失败属于更新路由这一族」（见 createBridgeLog 的 default 分支与
 * createUpdateCapability 里那条 capability-degraded 自报）。
 */
const UPDATE_ROUTE_FAMILY = UPDATE_STATUS_PATH.slice(0, UPDATE_STATUS_PATH.lastIndexOf('/'))

/**
 * 包 README 第 8 节钉死的快照形状（六字段）。这里只用来对账，**不参与装配**：
 * 快照本体一律由更新包给，本插件不重算、不裁剪、不补字段。
 * 逐字段为什么记在备注里，审查者照这张表核 README。
 */
const SNAPSHOT_FIELDS = [
  'runningVersion', // 正在跑的版本
  'installedVersion', // 磁盘上装着的版本（与上一条不同即待重启）
  'latestVersion', // 官方源上的最新版本（没查过就是 null）
  'canInstall', // 现在能不能装
  'blockedReason', // 装不了的原因（八种之一，能装时为 null）
  'job', // 进行中/上次的安装任务
]

/**
 * 本能力对外只出**五个**名字（本仓结构规则：对外导出不超过五个）：
 * `createUpdateCapability`（装配点）、`SNAPSHOT_FIELDS`（快照字段表，回归脚本对账用）、
 * 以及配置三要素 `PLUGIN_ID` / `PHONE_PREFIX` / `TARGET_PACKAGE_NAME`（测试与审查对账用）。
 * `UNAVAILABLE` 只在本文件内部当 degraded 回包的错误码，不导出 —— 需要它的人从回包里读。
 * 回归脚本会把这条上限断言下来（`lib/update.js` 的导出数 ≤ 5）。
 */
export { SNAPSHOT_FIELDS }

/** 日志能力的形状（本能力只用到 `log`；`lib/index.js` 传进来的那个实例满足它）。 */
interface LogCapability {
  log(event: string, fields?: Record<string, unknown>): unknown
}

/** 本能力的对外形状（lib/index.js 与回归脚本按这个用）。 */
export interface UpdateCapability {
  ok: boolean
  reason?: string
  phoneNames: Record<string, string>
  paths: { status: string; check: string; install: string }
  snapshotFields: string[]
  runRoute(path: string, args?: Record<string, unknown>): Promise<UpdatePhoneResult>
}

export interface CreateUpdateCapabilityOptions {
  ctx?: unknown
  /** 日志能力的 Promise（`lib/index.js` 的 logReady）。缺省即不记日志。 */
  logReady?: Promise<LogCapability | null> | null
  /** 假的包入口（回归脚本用）；缺省时按包名 import 真包。 */
  hostUpdate?: { createHostUpdate(deps?: CreateHostUpdateDeps, config?: unknown): HostUpdate }
  /** 能力起不来时的告警口（默认什么都不做）。 */
  onFallback?: (reason: string) => void
}

/**
 * 日志适配器：更新包在宿主侧报三条事件（`host.call` / `host.call.fail` / `update.install.exec`），
 * 统一转给本仓日志能力。
 *
 * **签名按上游 `dist/` 的真实调用点抄，不按 README 的示例文字抄**：`dist/host.js:187,196` 发的是
 * `phoneLogCtx.fire(level, event, fields)`，`dist/store.js:273` 发的是 `log(level, event, fields)`
 * —— 都是三参，事件名在第二个位置。#39 第一版写成两参 `fire(event, fields)`，于是 `"info"` 被当成
 * 事件名、真事件名降级成字段对象、字段对象整条丢掉，再被事件闸门按「未声明事件」静默丢弃 ——
 * 更新能力的诊断轨迹全丢而测试全绿（审查爆点 1）。
 *
 * 级别（第一参）不转交：本仓的级别由清单 `event-list.dsh-prompt.json` 按事件名决定，
 * 不引入第二套级别语义。**字段名也不做第二道白名单**：白名单的权威是日志能力的闸门
 * （`lib/log/gate.js`），这里按名字逐个挑字段等于在闸门前面又立一道白名单 —— 上游字段一改名就在
 * 桥里被无声裁掉，而闸门的 `droppedFields` 恒 0，字段漂移变成零可观测（#39 复审 V3）。桥只判
 * **事件名**：包里那三条走原样转交（字段名一个不动），其余一律走 unknown-event 自报。
 * 清单没声明的事件（包升版新加）不静默丢：落一条 `update.route.fail`（reason = unknown-event）。
 *
 * #39 三轮整改在这条链上加了两层（都在**值**这一侧，不动字段名的权威）：
 * - **值域安全网**（H1，一票否决项）：见 `SAFE_VALUE_RE` / `safeFields` —— 白名单只说「这个字段能进」，
 *   说不了「这个值能进」，于是正文/模板名只要不是闸门那五种具名形状就逐字落盘（复审 D 实测）。
 * - **持续失败按状态落一次**（H2）：见 `noteFail` / `clearFails`。
 *
 * 能力是异步建起来的，这里用一个可变槽兜住；闭包在能力就绪前被调用时直接丢掉那一批
 * （只可能丢启动瞬间的一两条，日志能力缺席时的语义本来就是「不落盘」）。
 */
function createBridgeLog(logReady: CreateUpdateCapabilityOptions['logReady']): UpdateLogCtx {
  let cap: LogCapability | null = null
  /** unknown-event 自报只落一次：事件名漂移是**状态**，不是每次调用都会变的事实（同复审 V1 的处置）。 */
  let unknownReported = false
  /** 已落过盘的电话失败状态（键见 failKeyOf）：持续失败不再每请求刷一行。 */
  const failedStates = new Set<string>()
  if (logReady && typeof logReady.then === 'function') {
    logReady.then(
      (ready) => { cap = ready && typeof ready.log === 'function' ? ready : null },
      () => { cap = null },
    )
  }
  /** true = 这个状态第一次出现，该落盘；false = 同一状态已经落过（抑制，不落）。 */
  function noteFail(method: string, kind: string): boolean {
    const key = failKeyOf(method, kind)
    if (failedStates.has(key)) return false
    failedStates.add(key)
    return true
  }
  /** 这个电话成功了：清掉它的失败账 —— 恢复之后再失败是**新状态**，必须重新落一条（不是只报一次）。 */
  function clearFails(method: string): void {
    const prefix = failKeyOf(method, '')
    for (const key of failedStates) if (key.startsWith(prefix)) failedStates.delete(key)
  }
  return {
    fire(level: string, event: string, fields?: Record<string, unknown>): void {
      try {
        if (!cap) return
        const f = (fields ?? {}) as Record<string, unknown>
        switch (String(event ?? '')) {
          case 'host.call': {
            const safe = safeFields(f)
            // 成功轨迹 = 这个电话已经恢复：清掉它的失败账（下一次失败会重新落一条）。
            if (safe.ok === true) clearFails(String(safe.method ?? ''))
            // 写作 `{ ...safe }` 而不是直接传 `safe`：本仓 `test:log` 的调用点扫描按「事件名后跟一个字面量
            // 对象」认调用点（CALL_RE），少了那对大括号，这个事件会被读成「声明了却没人打」（实测变红）。
            // 展开写法与整改前的 `{ ...f }` 同形，扫描面不变。
            cap.log('host.call', { ...safe })
            return
          }
          case 'host.call.fail': {
            const safe = safeFields(f)
            if (!noteFail(String(safe.method ?? ''), String(safe.kind ?? ''))) return
            cap.log('host.call.fail', { ...safe })
            return
          }
          case 'update.install.exec': {
            // route 是 `cli-process` / `desktop-service`**或 `"none"`**：`"none"` 表示「没有安装配方」
            // （包 `dist/store.js:333` 的 catch 用 `error?.exitCode ?? exitCode`，配方为空时是 undefined）
            // —— 这条路径**没有 `exitCode` 键**，也不是一条真路由，排障时别读成一次真实执行（复审 D A3）。
            const safe = safeFields(f)
            cap.log('update.install.exec', { ...safe })
            return
          }
          default:
            // 包升版新加的事件：清单里没有，落盘会被闸门按「未声明事件」丢掉 —— 那就留一条可见的
            // 自报，别让「包的日志契约变了」这件事无声通过（事件名本身不落盘，只落稳定指纹）。
            if (unknownReported) return
            unknownReported = true
            cap.log('update.route.fail', {
              route: UPDATE_ROUTE_FAMILY, reason: 'unknown-event', errorHash: hash8(String(event ?? '')),
            })
        }
      } catch (e) { /* 记日志失败不许影响安装 */ }
    },
  }
}

/**
 * 值域安全网（#39 三轮整改 H1，一票否决项）：字段**名**的权威在真闸门，这一层只回答
 * 「这个**值**能不能安全落盘」。验收口径就是这两句：正文（含 CJK / 空格 / 标点）必然被挡；
 * `prompt.updateStatus` / `update-status` / `cli-process` / `dsh-prompt` / `/_dsh/dsh-prompt/update` /
 * 八位指纹这类真实取值**逐字不受影响**。
 *
 * 为什么必须有这一层：白名单只回答「这个字段能不能进」，闸门那五条具名规则只管 token / Windows 绝对
 * 路径 / 家目录 / URL / 邮箱这五种形状，`method` / `kind` / `route` / `reason` 在闸门里都是**自由字符串**
 * （清单里的 `codes:["ENUM"]` 只是文档，运行时不执行）—— 于是「提示词正文与模板名绝不进日志」
 * 只剩「调用点恰好都塞字面量」这层人为约定，复审 D 把 47 字符正文与模板名逐字写进了真日志文件。
 *
 * 做法是按**字符形状**统一兜底，不是再抄一份字段名白名单：每个值都过一遍安全字符集，不匹配就换成
 * 8 位指纹。数值 / 布尔原样；`undefined` / `null` 原样（闸门对这两者就是跳过）；数组与对象一律指纹化。
 * 残余（如实写进 resolution §7）：纯英文标识符形状的长串仍会通过 —— 这条网管的是**内容形状**，
 * 不是内容语义；语义那一层仍是「调用点别塞正文」这个约定。
 */
const SAFE_VALUE_RE = /^[A-Za-z0-9._:\/-]{0,64}$/

/** 非字符串值转成可散列的文本（对象/数组不走 `String()`：`[object Object]` 把内容与形状一起丢掉）。 */
function toText(value: unknown): string {
  try {
    const json = JSON.stringify(value)
    return typeof json === 'string' ? json : String(value)
  } catch (e) {
    return String(value)
  }
}

/** 单值过安全网：匹配安全字符集就原样，否则换成 8 位指纹。 */
function safeValue(value: unknown): unknown {
  if (value === undefined || value === null) return value
  if (typeof value === 'number' || typeof value === 'boolean') return value
  const text = typeof value === 'string' ? value : toText(value)
  return SAFE_VALUE_RE.test(text) ? text : hash8(text)
}

/** 整张字段表过安全网：**键一个不动** —— 清单外的字段照旧走到闸门口被裁 + 计数（G4 的可观测性不许丢）。 */
function safeFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...fields }
  for (const key of Object.keys(out)) out[key] = safeValue(out[key])
  return out
}

/**
 * 持续失败的落盘抑制（#39 三轮整改 H2）：同一 `(method, kind)` 只在**状态首次出现**时落一条。
 * 为什么不能每请求落：`warn` 绕过日志开关（`dsh-log` 的 `isEnabled` 对 warn 恒真），真机上「电话持续
 * 失败」（断网 / `check-expired` / registry 抽风）配上面板 `UPD_POLL = 1000ms` 就是每秒 2 行恒写、
 * 用户关不掉 —— 复审 D 实测 62 次请求 **124 行 / 20402 B** ⇒ 54.2 MiB/天，是二轮修掉的「能力缺席」
 * 那支的 3.6 倍。处置与 `unknown-event` 自报一致：状态型事实落一次。两条纪律：
 * ① 首条必须落（真实故障不许因为去重而看不见）；② 该电话成功一次即清账（见 clearFails）。
 * 键里不放 errorHash：错误原文的指纹可能每次都不同（超时里带毫秒、消息里带临时路径），放进去
 * 等于没去重。
 */
function failKeyOf(method: string, kind: string): string {
  return method + '\u0000' + kind
}

/**
 * 8 位错误指纹（djb2，与 `lib/log/gate.js` 的 `hash8`、`lib/index.js` 的 `hashText` 同形）。
 * 这里自备一份：宿主半不反向依赖日志能力的内部模块（那会把闸门代码一并打进 `lib/update.js`）。
 */
function hash8(value: unknown): string {
  const text = String(value ?? '')
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
  return ('0000000' + h.toString(16)).slice(-8)
}

/**
 * 建更新能力。依赖全可注入，回归脚本用假更新包跑，不碰真文件系统与网络。
 */
export async function createUpdateCapability(
  options: CreateUpdateCapabilityOptions = {},
): Promise<UpdateCapability> {
  let mod = options.hostUpdate ??
    (await import('dsh-plugin-update').catch((e: unknown) => e as Error)) as
      | { createHostUpdate(deps?: CreateHostUpdateDeps, config?: unknown): HostUpdate }
      | Error
  if (mod instanceof Error) {
    return degradedCapability(`dep-load-fail: ${mod.message}`, options.onFallback)
  }
  let update: HostUpdate
  /** 更新包的日志口（同一个实例既交给包，也留给本文件自己报故障 —— 见 runRoute 的 catch）。 */
  const bridgeLog = createBridgeLog(options.logReady)
  try {
    update = mod.createHostUpdate(
      { ctx: options.ctx ?? null, logCtx: bridgeLog },
      {
        pluginId: PLUGIN_ID,
        prefix: PHONE_PREFIX,
        targetPackageName: TARGET_PACKAGE_NAME,
        // 其余全走包默认值（官方源、家目录、超时、凭证有效期、轮询间隔），本票一个都不动。
      },
    )
  } catch (e) {
    return degradedCapability(String((e as Error)?.message || e), options.onFallback)
  }

  const phoneNames = update.phoneNames
  /** 本能力的三条电话（更新包给什么就是什么；宿主半不自己拼名字）。 */
  const phones = {
    status: phoneNames.updateStatus,
    check: phoneNames.updateCheck,
    install: phoneNames.updateInstall,
  }
  /** 路由路径 → 电话名（宿主半唯一的分流表）。 */
  const routes: Record<string, string | undefined> = {
    [UPDATE_STATUS_PATH]: phones.status,
    [UPDATE_CHECK_PATH]: phones.check,
    [UPDATE_INSTALL_PATH]: phones.install,
  }

  /**
   * 电话调用失败的落盘口（审查 F9）：形状就是更新包自己那条失败事件
   * （`dist/host.js:207` 的 `{ method, kind, errorHash, pluginId }`），字段都在清单白名单里，
   * 所以按包 README 第 10 节「按 pluginId 过滤 host.call.fail」能查到。
   * 错误原文只以 8 位指纹落盘，不记原文。
   */
  function logPhoneFail(method: string, kind: string, message: string): void {
    bridgeLog.fire('warn', 'host.call.fail', {
      method, kind, errorHash: hash8(message), pluginId: PLUGIN_ID,
    })
  }

  return {
    ok: true,
    phoneNames: { ...phoneNames } as Record<string, string>,
    paths: { status: UPDATE_STATUS_PATH, check: UPDATE_CHECK_PATH, install: UPDATE_INSTALL_PATH },
    /** 快照六字段名（只读常量，给回归脚本与将来的面板对账用）。 */
    snapshotFields: SNAPSHOT_FIELDS,
    /**
     * 电话调用口：路由按 URL 找人，这里按电话名找函数。回包形状 = 更新包 loggedPhone 的形状
     * （`{ ok, snapshot, manual, receipt }`）。
     */
    async runRoute(path: string, args?: Record<string, unknown>): Promise<UpdatePhoneResult> {
      const phone = routes[path]
      if (phone === undefined) {
        logPhoneFail(path, 'unknown-phone', `no update phone for ${path}`)
        return failed('unknown-phone', `no update phone for ${path}`)
      }
      try {
        return await update.handlers[phone](args ?? {})
      } catch (e) {
        const message = String((e as Error)?.message || e)
        // 电话表里没有这个电话，或包的封装在它自己的 try 之外抛了（例如 handlers 的键改名）——
        // 这条以前是静默的：路由只回 phone-failed，日志里什么都没有（审查 F9）。
        logPhoneFail(String(phone), 'phone-failed', message)
        return failed('phone-failed', message)
      }
    },
  }
}

/** 失败回包：形状与更新包 loggedPhone 的失败回包一致（错误码 + 一类人话说明）。 */
function failed(error: string, errorKind: string): UpdatePhoneResult {
  return { ok: false, error, errorKind }
}

/** 能力彻底起不来时的空实例：三条路由不必判空，最差是明确回「装不了」。 */
function degradedCapability(
  reason: string,
  onFallback?: (reason: string) => void,
): UpdateCapability {
  try {
    if (typeof onFallback === 'function') onFallback(reason)
  } catch (e) { /* 告警失败不影响返回值 */ }
  return {
    ok: false,
    reason,
    phoneNames: {},
    paths: { status: UPDATE_STATUS_PATH, check: UPDATE_CHECK_PATH, install: UPDATE_INSTALL_PATH },
    snapshotFields: SNAPSHOT_FIELDS,
    async runRoute(): Promise<UpdatePhoneResult> {
      return failed(UNAVAILABLE, reason)
    },
  }
}
