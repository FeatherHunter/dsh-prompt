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
 * 不引入第二套级别语义。字段按清单里声明的名字逐个取出来交给日志能力 —— 闸门仍是白名单的权威，
 * 这里不绕过它，只是把包真正发的字段摆到它面前。清单没声明的事件（包升版新加）不静默丢：
 * 落一条 `update.route.fail`（reason = unknown-event）。
 *
 * 能力是异步建起来的，这里用一个可变槽兜住；闭包在能力就绪前被调用时直接丢掉那一批
 * （只可能丢启动瞬间的一两条，日志能力缺席时的语义本来就是「不落盘」）。
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
    fire(level: string, event: string, fields?: Record<string, unknown>): void {
      try {
        if (!cap) return
        const f = (fields ?? {}) as Record<string, unknown>
        switch (String(event ?? '')) {
          case 'host.call':
            cap.log('host.call', {
              method: f.method, latencyMs: f.latencyMs, ok: f.ok, kind: f.kind, pluginId: f.pluginId,
            })
            return
          case 'host.call.fail':
            cap.log('host.call.fail', {
              method: f.method, kind: f.kind, errorHash: f.errorHash, pluginId: f.pluginId,
            })
            return
          case 'update.install.exec':
            cap.log('update.install.exec', {
              route: f.route, ok: f.ok, exitCode: f.exitCode, durationMs: f.durationMs, pluginId: f.pluginId,
            })
            return
          default:
            // 包升版新加的事件：清单里没有，落盘会被闸门按「未声明事件」丢掉 —— 那就留一条可见的
            // 自报，别让「包的日志契约变了」这件事无声通过（事件名本身不落盘，只落稳定指纹）。
            cap.log('update.route.fail', {
              route: UPDATE_ROUTE_FAMILY, reason: 'unknown-event', errorHash: hash8(String(event ?? '')),
            })
        }
      } catch (e) { /* 记日志失败不许影响安装 */ }
    },
  }
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
