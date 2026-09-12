/**
 * dsh-prompt — 更新能力的客户端半（#39）：把「电话名」落到既有 HTTP 桥的三条端点上
 *
 * 客户端不能读盘、不能起子进程，只能发 HTTP 请求；宿主半在本地 web 服务上开了
 * `/_dsh/dsh-prompt/*` 这条桥（见 lib/index.js 的 buildPromptRoute）。更新包文档里说的
 * 「电话表」是使用方自建的一张「名字 → 函数」表 —— 本插件不另造一张：三个电话直接挂到
 * 这条既有桥上。这个文件就是那张表在本插件里的唯一形态，住在更新能力自己的目录里，
 * 不外泄给别的模块（别的模块要用更新，只走 host()）。
 *
 * 两条纪律：
 * - 电话名只从派生文件读（`gen/updateClient.derived.js`，官方 derive 工具生成、入库），
 *   不许在别处写 `'prompt.updateStatus'` 这种字面量，也不许写死轮询数字。
 * - 三条路由路径只在本文件写一次，宿主半 `src/update/host/index.ts` 从同一处导入；
 *   构建产物 `lib/update.js` 侧由 `scripts/test-issue-39.cjs` 做源码级漂移告警。
 */

import { UPD_CHECK, UPD_INSTALL, UPD_STATUS } from './gen/updateClient.derived.js'

/** 更新状态快照端点（宿主半 `createUpdateCapability` 注册）。 */
export const UPDATE_STATUS_PATH = '/_dsh/dsh-prompt/update/status'
/** 查新版本端点（会联网问官方源）。 */
export const UPDATE_CHECK_PATH = '/_dsh/dsh-prompt/update/check'
/** 装更新端点（真装，耗时最长）。 */
export const UPDATE_INSTALL_PATH = '/_dsh/dsh-prompt/update/install'

/** 电话名（从派生文件读；更新包生成的常量本来就叫这个名字，此处只做一次改名收敛）。 */
export const updatePhoneNames = {
  updateStatus: UPD_STATUS,
  updateCheck: UPD_CHECK,
  updateInstall: UPD_INSTALL,
}

/** 桥的回包信封（宿主半 writeJson 的两种形状）。 */
export interface BridgeEnvelope {
  ok: boolean
  value?: unknown
  error?: { code?: string; message?: string }
}

/** 客户端每次调用桥拿到的东西：快照（六字段）+ 手工兜底命令 + 装更新的凭证。 */
export interface UpdateCallResult {
  ok: boolean
  snapshot: Record<string, unknown> | null
  manual: string | null
  receipt: unknown
  error: { code?: string; message?: string } | null
}

/**
 * 当前浏览器原点的桥地址；没有 location 时回相对路径（`fetch` 自己会补原点）。
 * 宿主半没有 location，所以这里不直接写 `globalThis.location` —— 同一份源码要同时过
 * 「浏览器 lib」与「Node lib」两套类型检查（见 tsconfig.json 与 tsconfig.host.json）。
 */
function pathOf(route: string): string {
  const withLocation: unknown = globalThis
  try {
    const origin = (withLocation as { location?: { origin?: string } }).location?.origin
    if (typeof origin === 'string' && origin) return new URL(route, origin).toString()
  } catch (e) { /* location 不可用就走相对路径 */ }
  return route
}

/** 把「不认识的 JSON」收成信封：只认 ok 是布尔的那种，别的一律当坏回包。 */
function asEnvelope(raw: unknown): BridgeEnvelope {
  if (raw !== null && typeof raw === 'object' && typeof (raw as { ok?: unknown }).ok === 'boolean') {
    return raw as BridgeEnvelope
  }
  return { ok: false, error: { code: 'bridge-bad-shape', message: 'bridge returned a non-envelope body' } }
}

async function readEnvelope(res: Response): Promise<BridgeEnvelope> {
  try {
    return asEnvelope(await res.json())
  } catch (e) {
    return { ok: false, error: { code: 'bridge-bad-json', message: `HTTP ${res.status}` } }
  }
}

function shape(env: BridgeEnvelope): UpdateCallResult {
  if (!env.ok) {
    return { ok: false, snapshot: null, manual: null, receipt: null, error: env.error ?? { code: 'bridge-error', message: 'unknown bridge error' } }
  }
  const value = env.value !== null && typeof env.value === 'object'
    ? (env.value as { snapshot?: unknown; manual?: unknown; receipt?: unknown })
    : {}
  const snapshot = value.snapshot !== null && typeof value.snapshot === 'object'
    ? (value.snapshot as Record<string, unknown>)
    : null
  return {
    ok: true,
    snapshot,
    manual: typeof value.manual === 'string' ? value.manual : null,
    receipt: value.receipt ?? null,
    error: null,
  }
}

/**
 * 建更新电话客户端。电话一律走 POST：三条路的入参都过 JSON 请求体，
 * 宿主半按路由分流（`runRoute`），不按请求体分流。
 */
export function createUpdateBridge(): UpdatePhoneTable {
  const call = async (route: string, args: Record<string, unknown>): Promise<UpdateCallResult> => {
    if (typeof fetch === 'undefined') {
      return { ok: false, snapshot: null, manual: null, receipt: null, error: { code: 'no-fetch', message: 'fetch is unavailable in this environment' } }
    }
    try {
      const res = await fetch(pathOf(route), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(args ?? {}),
      })
      return shape(await readEnvelope(res))
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { ok: false, snapshot: null, manual: null, receipt: null, error: { code: 'bridge-unreachable', message } }
    }
  }
  return {
    [UPD_STATUS]: (args = {}) => call(UPDATE_STATUS_PATH, args),
    [UPD_CHECK]: (args = {}) => call(UPDATE_CHECK_PATH, args),
    [UPD_INSTALL]: (args = {}) => call(UPDATE_INSTALL_PATH, args),
  }
}

/** 一条更新电话（入参形状随电话而定，都是普通对象）。 */
export type UpdatePhone = (args?: Record<string, unknown>) => Promise<UpdateCallResult>

/** 电话表（名字 → 电话）。取一条电话就是查这张表，不再包一层。 */
export type UpdatePhoneTable = Record<string, UpdatePhone>
