/**
 * 构建期跟最新（#98）：打包前把 `dsh-plugin-update` 装到 registry 上的 latest 再内联。
 *
 * 【为什么有这一步】
 * 用户两次明确拍板（地图 #96 R2Q1）：每次打包自动跟上游最新，覆盖 ADR-0003 的精确冻结。
 * 产物仍内联进 `lib/update.js`（#58 的 hoisted 教训不变），变的是「钉版由人工改」变成
 * 「构建脚本自动改」—— `devDependencies` 里记录的永远是一个精确版本号（可复现**记录**），
 * 只是这个数字由本脚本在构建起点自动写成 latest，而不是人手写。
 *
 * 【流程】
 *   钉版 == 上游 latest == 实装 → 同版，直通构建。
 *   上游 latest 比钉版新 → `npm install --save-exact -D dsh-plugin-update@<latest>` 后再构建
 *   （package.json + lock + node_modules 三处由 npm 一起写对，banner 随后取新钉版）。
 *   钉版反而比上游新（本地路径安装等怪态）→ exit 1，让人看一眼（不静默降级）。
 *   上游不可达（离线）→ **警告后用本地钉版继续**（开发态不断构建）；发版安全由
 *   `npm run check:update-pkg` 把门（exit 2 = 不算通过，必须人工确认，见 #101）。
 *
 * 跑法：`npm run ensure:update-pkg`（`build:update-host` 会先调它，不用手跑）。
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PKG_NAME = 'dsh-plugin-update'
const EXACT_RE = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/

const readPkg = () => JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const readInstalled = () => {
  try {
    return JSON.parse(readFileSync(join(ROOT, 'node_modules', PKG_NAME, 'package.json'), 'utf8')).version
  } catch {
    return null
  }
}
/** 纯数字三段比大小；带后缀的一律按“相等”处理（走不到自动升降级分支，由人工看）。 */
const cmpTriple = (a, b) => {
  const pa = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(a || ''))
  const pb = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(b || ''))
  if (!pa || !pb) return 0
  for (let i = 1; i <= 3; i++) {
    if (Number(pa[i]) !== Number(pb[i])) return Number(pa[i]) < Number(pb[i]) ? -1 : 1
  }
  return 0
}

const pinned0 = readPkg().devDependencies?.[PKG_NAME]
if (typeof pinned0 !== 'string' || !EXACT_RE.test(pinned0)) {
  console.error('ensure:update-pkg: devDependencies 里 ' + PKG_NAME + ' 必须是精确版本，实为 ' + JSON.stringify(pinned0))
  process.exit(1)
}
console.log('=== 构建期跟最新（' + PKG_NAME + '）===')
console.log('  本仓钉版: ' + pinned0 + ' / 实装: ' + (readInstalled() ?? '（缺席）'))

const r = spawnSync('npm', ['view', PKG_NAME, 'version'], {
  cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32', timeout: 60000,
})
if (r.error || r.status !== 0) {
  console.error('')
  console.error('⚠ 查不到上游版本（' + (r.error ? r.error.message : 'npm view 退出码 ' + r.status) + '）——'
    + '用本地钉版 ' + pinned0 + ' 继续构建。本次产物**不保证最新**，发版前必须跑 npm run check:update-pkg。')
  process.exit(0)
}
const latest = String(r.stdout || '').trim().split('\n').pop().trim()
console.log('  上游 latest: ' + latest)

if (readInstalled() === latest && pinned0 === latest) {
  console.log('=== 同版：直通构建 ===')
  process.exit(0)
}
if (cmpTriple(pinned0, latest) > 0) {
  console.error('钉版 ' + pinned0 + ' 比上游 latest ' + latest + ' 还新（本地路径安装等怪态）——不静默降级，请人工看一眼。')
  process.exit(1)
}
console.log('--- 上游有新版，跟进：npm install --save-exact -D ' + PKG_NAME + '@' + latest + ' ---')
const inst = spawnSync('npm', ['install', '--save-exact', '-D', PKG_NAME + '@' + latest], {
  cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32', timeout: 300000,
})
if (inst.error || inst.status !== 0) {
  console.error('ensure:update-pkg: 自动跟进失败（' + (inst.error ? inst.error.message : '退出码 ' + inst.status) + '）——'
    + '不用旧版硬建，请联网后重跑。')
  process.exit(1)
}
const pinned1 = readPkg().devDependencies?.[PKG_NAME]
const installed1 = readInstalled()
console.log('  跟进后：钉版 ' + pinned1 + ' / 实装 ' + installed1)
if (pinned1 !== latest || installed1 !== latest) {
  console.error('ensure:update-pkg: 跟进后三处仍对不上（钉版/实装 vs 上游），请人工看一眼。')
  process.exit(1)
}
console.log('=== 已跟到 ' + latest + '，继续构建 ===')
