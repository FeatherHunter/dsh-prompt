/**
 * dsh-prompt — 更新能力宿主半的**值域安全网**（#39 四轮整改 K1，一票否决项）
 *
 * 这一层只回答一个问题：「这个**值**能不能安全落盘」。字段**名**的权威在真闸门
 * （`lib/log/gate.js` + `event-list.dsh-prompt.json`），本文件一个字段名都不改、不裁 ——
 * 清单外的漂移字段照旧走到闸门口被裁 + 计数（G4 的可观测性）。
 *
 * 为什么必须有这一层：白名单只回答「这个字段能不能进」，闸门对 ENUM 事件另有形状基线
 * （#57：清单顶层 valueDomain，标识符形状 + 32 字符，不匹配即丢弃该字段并计数），但形状
 * 挡不住纯 ASCII 标识符形状的用户数据 —— 模板名完全可能长成 my-template-v3 这种形状。
 * 于是「提示词正文与模板名绝不进日志」不能只靠闸门形状，复审 D 把 47 字符正文与模板名
 * 逐字写进了真日志文件（当时闸门连形状都没有，codes:["ENUM"] 只是文档）。
 *
 * 三轮整改只按**字符形状**兜底（`/^[A-Za-z0-9._:\/-]{0,64}$/`），而那个字符集**恰好等于本插件
 * 模板 id 的字母表** —— `codereview`（内置模板 id）、`cmoq2k1a3f`（自定义模板 id 形状）、
 * `my-template-v3`、`TEMPLATE_SECRET_internal_v9` 全部逐字落盘（复审 F 实测：18 样本里 9 条中招）。
 * 所以四轮整改把这一层从形状升级成**语义**：只认下面这几张已知取值表，**不在表里的一律换 8 位指纹**。
 *
 * 验收口径两句话：模板名与提示词正文**一个都不许**出现在真日志文件里；
 * `prompt.updateStatus` / `update-status` / `cli-process` / `none` / `dsh-prompt` / 8 位指纹
 * 这类真实取值**逐字不受影响**。
 *
 * 代价（如实记进 resolution）：包升版加新码 / 本仓加新路由时会先变成指纹，需要一条自报兜住
 * —— 形态与既有的 `unknown-event` 自报同一路：先有指纹可查，再把新取值补进表里。
 */

import { UPDATE_CHECK_PATH, UPDATE_INSTALL_PATH, UPDATE_STATUS_PATH } from '../bridge.js'
import { hash8 } from './hash.js'

/** 宿主半在日志能力面前的身份（与 `lib/index.js` 的 PLUGIN_ID、cordis.patch.yml 的 id 同值）。 */
const PLUGIN_ID = 'dsh-prompt'
/** 电话名前缀：与客户端半派生文件 `gen/updateClient.derived.js` 的 --prefix 必须同值。 */
const PHONE_PREFIX = 'prompt'

/**
 * 三条更新路由共同的路径前缀（`/_dsh/dsh-prompt/update`）。从 `../bridge.js` 的常量派生，
 * 不写路径字面量 —— 宿主半的路径只有 bridge 一处来源（回归脚本会拦字面量）。
 * 用途仅一个：日志里标「这条失败属于更新路由这一族」（见 bridge-log.ts 的 default 分支与
 * index.ts 里那条 capability-degraded 自报）。
 */
export const UPDATE_ROUTE_FAMILY = UPDATE_STATUS_PATH.slice(0, UPDATE_STATUS_PATH.lastIndexOf('/'))

const SAFE_METHODS: readonly string[] = [
  PHONE_PREFIX + '.updateStatus', PHONE_PREFIX + '.updateCheck', PHONE_PREFIX + '.updateInstall',
]
const SAFE_KINDS: readonly string[] = ['update-status', 'update-check', 'update-install', 'phone-failed', 'unknown-phone']
/** `update.install.exec` 的两条真路由 + `"none"`（没有安装配方）；后三条是 `update.route.fail` 的 route。 */
const SAFE_EXEC_ROUTES: readonly string[] = ['cli-process', 'desktop-service', 'none']
const SAFE_UPDATE_ROUTES: readonly string[] = [
  UPDATE_STATUS_PATH, UPDATE_CHECK_PATH, UPDATE_INSTALL_PATH, UPDATE_ROUTE_FAMILY,
]
/** 请求级 `update.route.fail` 的 reason：包 `toUpdateErrorPayload` 的已知码 + 本仓的四个自报码。 */
const SAFE_REASONS: readonly string[] = [
  'check-failed', 'invalid-release', 'check-expired', 'update-busy', 'install-failed', 'unknown-profile',
  'source-install', 'invalid-installation', 'installation-changed', 'pending-restart', 'incompatible-node',
  'registry-conflict', 'recovery-required', 'unknown-event', 'unknown-phone', 'phone-failed',
  'dep-load-fail', 'capability-degraded', 'capability-build-fail',
]

/**
 * 每个值过安全网，按「事件 + 字段名」挑一条判据（K1 的语义层）。数值 / 布尔原样；
 * `undefined` / `null` 原样（闸门对这两者本来就是跳过）；其余字符串（含数组/对象 JSON 化之后的）：
 * 在已知取值表里 → 逐字放行；否则 → 8 位指纹。表里没写的字段退回字符形状网 `SAFE_VALUE_RE`。
 */
const SAFE_FIELD_ENUM: Record<string, Readonly<Record<string, readonly string[] | 'hash8'>>> = {
  'host.call': { method: SAFE_METHODS, kind: SAFE_KINDS, pluginId: [PLUGIN_ID], errorHash: 'hash8' },
  'host.call.fail': { method: SAFE_METHODS, kind: SAFE_KINDS, pluginId: [PLUGIN_ID], errorHash: 'hash8' },
  'update.install.exec': { route: SAFE_EXEC_ROUTES, pluginId: [PLUGIN_ID] },
  'update.route.fail': { route: SAFE_UPDATE_ROUTES, reason: SAFE_REASONS, errorHash: 'hash8' },
}

/**
 * 字符形状网：**只**兜「语义表里没写的字段」（清单外的漂移字段、以后新加的字段）。三轮那版是唯一防线，
 * 于是它放行的 ASCII 标识符形状全落盘；现在它退成第二道，判据不变（形状 + 长度上限 64）。
 * 长度口径说明（#57）：权威是闸门清单顶层 valueDomain 的 32（与 MAX_FIELD_CHARS 对齐），
 * 本文件 64 仅为发射点兜底历史值；本层换出的 8 位指纹仍符合闸门形状，故两层不漂移。
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

/** 判据是 `'hash8'` 字段（错误指纹）还是取值表：前者必须真的是 8 位十六进制，否则指纹化。 */
function allowedBy(enumSpec: readonly string[] | 'hash8', text: string): boolean {
  if (enumSpec === 'hash8') return /^[0-9a-f]{8}$/.test(text)
  return enumSpec.indexOf(text) >= 0
}

/** 单值过安全网：已知取值原样，否则指纹。`event` 缺省时只走字符形状网（调用点只有一个来源，见下）。 */
function safeValue(event: string, key: string, value: unknown): unknown {
  if (value === undefined || value === null) return value
  if (typeof value === 'number' || typeof value === 'boolean') return value
  const text = typeof value === 'string' ? value : toText(value)
  const enumSpec = SAFE_FIELD_ENUM[event]?.[key]
  if (enumSpec !== undefined) return allowedBy(enumSpec, text) ? text : hash8(text)
  return SAFE_VALUE_RE.test(text) ? text : hash8(text)
}

/**
 * 整张字段表过安全网：**键一个不动** —— 清单外的字段照旧走到闸门口被裁 + 计数（G4 的可观测性不许丢）。
 * `event` 是**桥自己判定的**那三个事件名之一（不是上游传进来的原文），所以不可能被值影响。
 */
export function safeFields(event: string, fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...fields }
  for (const key of Object.keys(out)) out[key] = safeValue(event, key, out[key])
  return out
}
