/**
 * 生成 / 刷新更新包事件目录快照（#177 的构建期输入）。
 *
 * 产物：`src/update/host/update-event-catalog.json`（**检入仓库**）
 *   { generatedBy, updatePackage, updateVersion, events: [...] }
 *
 * 为什么要冻结成快照：更新包在构建期被整包内联（ADR-0003，pin 在 package.json
 * devDependencies 的精确版本），所以「这次运行时可能出现的更新包事件名」在构建期就完全确定。
 * 桥据此区分「目录内但未镜像 → 静默」与「目录外 → 每进程一次 info 自报」，
 * 不再把正常事件误报成 update.route.fail（#177）。
 *
 * 谁来跑：构建起点由 `scripts/update/ensure-latest.mjs` 在「同版直通 / 跟到新版」两条成功路径上
 *   自动先跑一遍（`npm run build` → build:update-host → ensure:update-pkg → 本脚本），
 *   所以自动跟最新（ADR-0003 修订 / #98）不需要任何额外人工步骤；快照与 `lib/` 一样检入、
 *   由 `check-lib-sync` 保证「提交的快照 == 用当前输入重建的结果」。
 *   手跑：npm run gen:update-catalog（排查 / 离线时用）。
 * 前置：node_modules 里的 dsh-plugin-update 版本必须 == package.json 的钉版（先 npm ci /
 *   npm run ensure:update-pkg）；对不上就 exit 1，不猜。
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CATALOG_REL,
  UPDATE_PACKAGE,
  deriveKnownEvents,
  readJsonOrNull,
} from './event-catalog-gate.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const EXACT_RE = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/

function die(message) {
  console.error('gen-event-catalog: ' + message)
  process.exit(1)
}

const pkg = readJsonOrNull(join(ROOT, 'package.json'))
const pin = pkg && pkg.devDependencies ? pkg.devDependencies[UPDATE_PACKAGE] : undefined
if (typeof pin !== 'string' || !EXACT_RE.test(pin)) {
  die('package.json devDependencies.' + UPDATE_PACKAGE + ' 必须是精确版本钉（实际 ' + JSON.stringify(pin) + '）')
}

const installedPath = join(ROOT, 'node_modules', UPDATE_PACKAGE, 'package.json')
const installed = readJsonOrNull(installedPath)
if (!installed || typeof installed.version !== 'string') {
  die('读不到 ' + installedPath + '（先 npm ci / npm run ensure:update-pkg）')
}
if (installed.version !== pin) {
  die('node_modules 里的更新包是 ' + installed.version + '，package.json 钉的是 ' + pin
    + ' —— 先 npm run ensure:update-pkg（或 npm ci）把两者对齐再生成快照')
}

const manifestPath = join(ROOT, 'node_modules', UPDATE_PACKAGE, 'event-list.update.json')
const updateManifest = readJsonOrNull(manifestPath)
const events = deriveKnownEvents(updateManifest)
if (events === null || events.length === 0) {
  die('读不出 ' + manifestPath + ' 的 events 表 —— 更新包没装好？')
}

const catalog = {
  generatedBy: 'node scripts/update/gen-event-catalog.mjs',
  updatePackage: UPDATE_PACKAGE,
  updateVersion: pin,
  events,
}
const outPath = join(ROOT, CATALOG_REL)
const previous = readJsonOrNull(outPath)
writeFileSync(outPath, JSON.stringify(catalog, null, 2) + '\n', 'utf8')

const before = previous && Array.isArray(previous.events) ? previous.events : []
const added = events.filter((name) => !before.includes(name))
const removed = before.filter((name) => !events.includes(name))
const versionNote = previous && previous.updateVersion !== pin
  ? '，版本 ' + JSON.stringify(previous.updateVersion) + ' → ' + JSON.stringify(pin)
  : ''
console.log('ok: 已写 ' + CATALOG_REL + '（更新包 ' + pin + '，事件 ' + events.length + ' 条' + versionNote + '）')
if (added.length > 0) console.log('  新增事件：' + added.join(', '))
if (removed.length > 0) console.log('  移除事件：' + removed.join(', '))
if (added.length === 0 && removed.length === 0 && versionNote === '') {
  console.log('  （内容无变化）')
}
