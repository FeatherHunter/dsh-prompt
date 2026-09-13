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
 *
 * ## 为什么拆成三个文件（#39 收口轮，地图 #38 的「超 400 行当场报警」纪律）
 *
 * 这个目录原来是一个 500 多行的 `index.ts`，跨过了 400 行告警线。四轮整改往它里面加了
 * 三件**互不相干**的事（值域安全网 / 失败落盘节流的账本 / 事件转交），于是按这三件事拆开：
 * - `hash.ts`：8 位指纹。两条链都要用，单独一处是唯一来源。
 * - `safe-values.ts`：**值**能不能落盘（K1 的语义白名单）。
 * - `bridge-log.ts`：更新包报的事件怎么转交 + 失败落盘节流（H2/K3 的账本）。
 * 本文件只剩「装配」：读配置、建能力、把三条路由分派到电话。
 *
 * 拆的是**文件**、不是**导出面**：`lib/update.js` 对外仍只出五个名字（本仓结构规则 ≤ 5），
 * 由 `createUpdateCapability` / `SNAPSHOT_FIELDS` 与配置三要素构成 —— 回归脚本会断言这条上限。
 * esbuild 的入口仍是本文件，产物 `lib/update.js` 依旧是一个自包含文件。
 */

import type {
  CreateHostUpdateDeps,
  HostUpdate,
  UpdatePhoneResult,
} from 'dsh-plugin-update'
import {
  UPDATE_CHECK_PATH,
  UPDATE_INSTALL_PATH,
  UPDATE_STATUS_PATH,
} from '../bridge.js'
import { createBridgeLog, type LogCapability } from './bridge-log.js'
import { hash8 } from './hash.js'

/** 宿主半在日志能力面前的身份（与 lib/index.js 的 PLUGIN_ID、cordis.patch.yml 的 id 同值）。 */
export const PLUGIN_ID = 'dsh-prompt'
/** 电话名前缀：与客户端半派生文件 `gen/updateClient.derived.js` 的 --prefix 必须同值。 */
export const PHONE_PREFIX = 'prompt'
/** 要检查更新的包是谁 —— 就是本插件自己。 */
export const TARGET_PACKAGE_NAME = 'dsh-prompt'

/** 能力缺席时三条路由统一回的错误码。 */
const UNAVAILABLE = 'update-capability-unavailable'

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
  /**
   * 失败落盘节流的注入点（#39 四轮整改 K3）：时间源与「同一状态两次落盘的最小间隔」。
   * 生产不传（用真时钟 + `DEFAULT_RELOG_FLOOR_MS`）；`test:issue-39` 与洪水台子用它把
   * 「首条必落 / 成因变化 / 交替 / 每请求新原因」四种形态在可控时间轴上量出来。
   */
  now?: () => number
  relogFloorMs?: number
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
  const bridgeLog = createBridgeLog(options.logReady, { now: options.now, relogFloorMs: options.relogFloorMs })
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
