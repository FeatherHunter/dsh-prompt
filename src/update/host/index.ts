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

/** 本能力对外只出四个名字：装配点（createUpdateCapability）、快照字段表、以及两条给审查者的常量。 */
export { SNAPSHOT_FIELDS, UNAVAILABLE }

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
 * 统一转给日志能力（更新包只吃 `fire` 这一个方法，事件名与字段原样转交）。
 *
 * 能力是异步建起来的，这里用一个可变槽兜住；闭包在能力就绪前被调用时直接丢掉那一批
 * （只可能丢启动瞬间的一两条，日志能力缺席时的语义本来就是「不落盘」）。
 * 字段闸门由日志能力负责 —— 清单里没声明的事件会被它丢弃，这是设计如此，不在这里绕过。
 */
function createBridgeLog(logReady: CreateUpdateCapabilityOptions['logReady']): UpdateLogCtx {
  let cap: LogCapability | null = null
  if (logReady && typeof logReady.then === 'function') {
    logReady.then(
      (ready) => { cap = ready && typeof ready.log === 'function' ? ready : null },
      () => { cap = null },
    )
  }
  return {
    fire(event: string, fields?: Record<string, unknown>): void {
      try {
        if (cap) cap.log(String(event ?? ''), fields)
      } catch (e) { /* 记日志失败不许影响安装 */ }
    },
  }
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
  try {
    update = mod.createHostUpdate(
      { ctx: options.ctx ?? null, logCtx: createBridgeLog(options.logReady) },
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
      if (phone === undefined) return failed('unknown-phone', `no update phone for ${path}`)
      try {
        return await update.handlers[phone](args ?? {})
      } catch (e) {
        return failed('phone-failed', String((e as Error)?.message || e))
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
