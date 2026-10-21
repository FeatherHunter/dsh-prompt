/**
 * 更新包事件目录 / 镜像事件名构建期门禁（#177）。
 *
 * 背景：#177 的误报是「桥把更新包目录内的正常事件（update.status.changed 等）当成未知事件，
 * 落一条 warn update.route.fail/unknown-event」—— 因为桥运行时没有「哪些事件名属于这次内联的
 * 更新包版本」这份信息。修复把已知事件集变成**构建期冻结的检入快照**
 * （`src/update/host/update-event-catalog.json`，由 `npm run gen:update-catalog` 从
 * `node_modules/dsh-plugin-update/event-list.update.json` 派生），本模块就是它的门禁：
 *
 *  1. 快照版本必须 == 本次内联的更新包版本（package.json devDependencies 的精确钉版）；
 *  2. 快照事件表必须与 node_modules 里的包目录逐项一致（包升版增删事件 → 构建失败，先重生成快照）；
 *  3. 桥源码 switch 里的**镜像事件名**必须都在这份目录里（上游改名/删除 → 构建失败，人工确认）；
 *  4. 从桥源码**提取不到**镜像名同样失败（fail-closed：门禁不许因为实现结构变化而恒绿）。
 *
 * 纯函数与 CLI 两种用法：`build-host.mjs` 在打包前 import 前者；回归脚本
 * （`scripts/repro/test-issue-177.cjs`）既测纯函数，也用 CLI 证明「模拟坏输入 → 非 0 退出」。
 *
 * 跑法（自查 / 门禁）：node scripts/update/event-catalog-gate.mjs [--catalog=路径] [--manifest=路径]
 *   [--bridge=路径] [--version=版本]（= npm run check:update-catalog，挂在 npm run check 链上）。
 *   构建期由 build-host.mjs 调纯函数；目录快照的**刷新**在构建起点做（ensure-latest.mjs 调
 *   scripts/update/gen-event-catalog.mjs，同版直通 / 跟到新版两条成功路径都会先刷），
 *   所以正常构建永远先对齐输入、再验门禁 —— 自动跟最新（ADR-0003 修订 / #98）不需要额外人工步骤。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** 三个构建期输入 + 生成器的仓库相对路径（报错文本里点名，别让读错误的人猜）。 */
export const CATALOG_REL = 'src/update/host/update-event-catalog.json'
export const BRIDGE_REL = 'src/update/host/bridge-log.ts'
export const UPDATE_MANIFEST_REL = 'node_modules/dsh-plugin-update/event-list.update.json'
export const GEN_SCRIPT_REL = 'scripts/update/gen-event-catalog.mjs'
/** 被内联的更新包名（门禁 / 生成器 / 快照里的 updatePackage 只有一个真值，别三处各写一份）。 */
export const UPDATE_PACKAGE = 'dsh-plugin-update'

/**
 * 从内联包的事件清单派生已知事件名（排序去重）。
 * 返回 `null` = 清单读不出（缺 events 表 / 空表）—— 调用方按 fail-closed 处理，不要当「空目录」放行。
 */
export function deriveKnownEvents(manifest) {
  const events = manifest && typeof manifest === 'object' ? manifest.events : null
  if (!events || typeof events !== 'object' || Array.isArray(events)) return null
  const names = Object.keys(events)
  if (names.length === 0) return null
  return [...new Set(names)].sort()
}

/**
 * 从桥源码的 `switch` 分支标签提取镜像事件名。
 * `[]` = 提取不到（桥结构被改 / 源码不可读）—— 调用方必须 fail-closed，不能把它当「没有镜像事件」放行。
 */
export function extractMirrorEvents(source) {
  if (typeof source !== 'string' || source.length === 0) return []
  const out = []
  for (const m of source.matchAll(/\bcase\s+['"]([A-Za-z0-9._-]+)['"]\s*:/g)) out.push(m[1])
  return [...new Set(out)].sort()
}

/**
 * 门禁判决：`null` = 通过；字符串 = 人话成因（调用方据此 exit 非 0）。
 * 只判构建期的**契约一致性**，不判运行时行为 —— 运行时行为由回归脚本走构建产物验。
 */
export function catalogProblem({ catalog, updateManifest, bridgeSource, inlinedVersion }) {
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog) || !Array.isArray(catalog.events)) {
    return '找不到可用的 ' + CATALOG_REL + '（#177 的构建期输入：检入的更新包事件目录快照）'
      + ' —— 先跑 npm run gen:update-catalog 生成它'
  }
  if (typeof inlinedVersion !== 'string' || inlinedVersion === '' || catalog.updateVersion !== inlinedVersion) {
    return CATALOG_REL + ' 的 updateVersion 是 ' + JSON.stringify(catalog.updateVersion)
      + '，而本次内联的更新包版本是 ' + JSON.stringify(inlinedVersion)
      + ' —— 目录快照过期，先跑 npm run gen:update-catalog 再重新构建'
  }
  const known = deriveKnownEvents(updateManifest)
  if (known === null) {
    return '读不出 ' + UPDATE_MANIFEST_REL + ' 的 events 表（更新包没装好？）'
      + ' —— 先 npm ci（或 npm i -D dsh-plugin-update@' + inlinedVersion + '）再重新构建'
  }
  const catalogEvents = [...new Set(catalog.events)].sort()
  const missing = known.filter((name) => !catalogEvents.includes(name))
  const extra = catalogEvents.filter((name) => !known.includes(name))
  if (missing.length > 0 || extra.length > 0) {
    const parts = []
    if (missing.length > 0) parts.push('缺 ' + missing.join(', '))
    if (extra.length > 0) parts.push('多 ' + extra.join(', '))
    return CATALOG_REL + ' 与 ' + UPDATE_MANIFEST_REL + ' 对不上：' + parts.join('；')
      + ' —— 跑 npm run gen:update-catalog 重新生成快照（把包的日志契约变化显式化，不是改桥）'
  }
  const mirror = extractMirrorEvents(bridgeSource)
  if (mirror.length === 0) {
    return '从 ' + BRIDGE_REL + ' 的 switch case 标签提取不到任何镜像事件名 —— 门禁 fail-closed（不许恒绿）：'
      + '桥的实现结构变了？先检查提取规则与 bridge-log.ts 的 switch 分支'
  }
  const notInCatalog = mirror.filter((name) => !catalogEvents.includes(name))
  if (notInCatalog.length > 0) {
    return '桥镜像的更新包事件名不在本次内联版本的事件目录里：' + notInCatalog.join(', ')
      + ' —— 上游改名/删除？对照 ' + UPDATE_MANIFEST_REL
      + ' 人工确认后改桥或调整目录快照（不允许静默通过）'
  }
  return null
}

/* ────────────────────────── CLI（自查 / 回归可用） ────────────────────────── */

/** 读文本文件：缺席 / 读失败都折成 null（调用方按 fail-closed 处理，别把「读不到」当「空」）。 */
export function readTextOrNull(file) {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return null
  }
}
/** 读 JSON 文件：不合法 / 缺席都折成 null（同上，交给门禁报人话成因）。 */
export function readJsonOrNull(file) {
  const text = readTextOrNull(file)
  if (text === null) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
/**
 * 三个构建期输入一起读 —— 门禁的每个调用方（build-host / CLI / 回归）共用这一份，
 * 别各自手搓 try/catch 再拼同一个对象（评审：read→JSON 的三种写法 + 同一个 bag 到处传）。
 */
export function readGateInputs({ root = ROOT, catalogPath, manifestPath, bridgePath } = {}) {
  return {
    catalog: readJsonOrNull(catalogPath ?? join(root, CATALOG_REL)),
    updateManifest: readJsonOrNull(manifestPath ?? join(root, UPDATE_MANIFEST_REL)),
    bridgeSource: readTextOrNull(bridgePath ?? join(root, BRIDGE_REL)),
  }
}
function pinnedVersionOrNull() {
  const pkg = readJsonOrNull(join(ROOT, 'package.json'))
  const pin = pkg && pkg.devDependencies ? pkg.devDependencies[UPDATE_PACKAGE] : undefined
  return typeof pin === 'string' ? pin : null
}

const USAGE = [
  '用法：node scripts/update/event-catalog-gate.mjs [选项]',
  '  --catalog=路径   目录快照（缺省 ' + CATALOG_REL + '）',
  '  --manifest=路径  更新包事件清单（缺省 ' + UPDATE_MANIFEST_REL + '）',
  '  --bridge=路径    桥源码（缺省 ' + BRIDGE_REL + '）',
  '  --version=版本   本次内联的更新包版本（缺省取 package.json devDependencies）',
  '退出码：0 = 门禁通过；1 = 门禁拒绝（成因见输出）。',
].join('\n')

function parseArgs(argv) {
  const out = {}
  for (const arg of argv) {
    const m = /^--(catalog|manifest|bridge|version)=(.*)$/.exec(arg)
    if (m) out[m[1]] = m[2]
    else if (arg === '--help' || arg === '-h') out.help = true
    else {
      console.error('event-catalog-gate: 不认识的参数 ' + JSON.stringify(arg))
      console.error(USAGE)
      process.exit(1)
    }
  }
  return out
}

function main(argv) {
  const args = parseArgs(argv)
  if (args.help) {
    console.log(USAGE)
    return 0
  }
  const catalogPath = args.catalog ? resolve(args.catalog) : join(ROOT, CATALOG_REL)
  const manifestPath = args.manifest ? resolve(args.manifest) : join(ROOT, UPDATE_MANIFEST_REL)
  const bridgePath = args.bridge ? resolve(args.bridge) : join(ROOT, BRIDGE_REL)
  const inlinedVersion = args.version ?? pinnedVersionOrNull()
  const inputs = readGateInputs({ root: ROOT, catalogPath, manifestPath, bridgePath })
  const problem = catalogProblem({ ...inputs, inlinedVersion })
  if (problem !== null) {
    console.error('FAIL: 更新包事件目录 / 镜像名门禁拒绝：' + problem)
    console.error('  输入：catalog=' + catalogPath + ' / manifest=' + manifestPath
      + ' / bridge=' + bridgePath + ' / version=' + JSON.stringify(inlinedVersion))
    return 1
  }
  const mirror = extractMirrorEvents(inputs.bridgeSource)
  const known = deriveKnownEvents(inputs.updateManifest)
  console.log('ok: 门禁通过 —— 目录快照 ' + known.length + ' 条（更新包 ' + inlinedVersion + '），'
    + '镜像事件 ' + mirror.length + ' 条：' + mirror.join(', '))
  return 0
}

const entry = process.argv[1] ? resolve(process.argv[1]) : ''
if (entry !== '' && entry.toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()) {
  process.exitCode = main(process.argv.slice(2))
}
