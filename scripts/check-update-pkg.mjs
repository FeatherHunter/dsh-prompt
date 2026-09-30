/**
 * 上游更新包体检：`dsh-plugin-update` 有没有比我们钉的更新？
 *
 * 【为什么需要这一条】
 * 更新包是**构建期输入**：它被 esbuild 内联进 `lib/update.js`，版本冻结在构建那一刻
 * （#58 拍板，理由见 docs/adr/0003 与 scripts/update/build-host.mjs 的头注）。这是**有意**的
 * —— 留 externals 会让它的 `containingPackage(import.meta.url, 'dsh-prompt')` 从 profile 的
 * node_modules 上溯，而真机是 DSH 写死的 hoisted 布局，命不中本插件包 ⇒ 三条更新路由只会回
 * `unknown-profile`。
 *
 * 代价是：**上游发了新版，本插件不会自己知道**。已有三道门禁都只在「动了之后」才拦得住
 * （build-host 的拒收门、test:issue-39 的钉版断言、test:lib-sync 的产物同步），
 * 没有人提醒「该动了」。本脚本补的就是这一环。
 *
 * 【退出码】发布前检查请按这个表读：
 *   0 = 与上游 latest 同版（或上游没有更新的版本）
 *   1 = 上游版本与钉版**不同** —— 打印升级清单，需要人工确认
 *   2 = 查不到（离线 / registry 不可达）—— **不能当作通过**，请人工确认后再发
 *
 * 跑法：npm run check:update-pkg
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const PKG_NAME = 'dsh-plugin-update'
const PIN_KEY = 'devDependencies'

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const pinned = pkg[PIN_KEY]?.[PKG_NAME]

console.log('=== 更新包体检（' + PKG_NAME + '）===')

if (typeof pinned !== 'string' || pinned === '') {
  console.error('package.json 的 ' + PIN_KEY + ' 里没有 ' + PKG_NAME + '（#58 起它是构建期输入，必须精确钉版）。')
  process.exit(1)
}
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(pinned)) {
  console.error('钉的不是精确版本，实为 ' + JSON.stringify(pinned) + '：产物冻结在具体某一版上，不许用 ^ / ~ / latest。')
  process.exit(1)
}
console.log('  本仓钉版（' + PIN_KEY + '）: ' + pinned)

// 产物 banner 里的内联版本：钉版与产物不一致时，这里就能看出来（更权威的那道门在 test:lib-sync）
try {
  const built = readFileSync(join(ROOT, 'lib', 'update.js'), 'utf8')
  const m = built.match(/INLINED_UPDATE_PKG_VERSION\s*=\s*['"]([^'"]+)['"]/)
  console.log('  产物内联版本（lib/update.js banner）: ' + (m ? m[1] : '（找不到标记！）'))
} catch {
  console.log('  产物内联版本: （lib/update.js 读不到，先跑 npm run build）')
}

// 问 registry（走用户自己的 npm 配置，兼容镜像源）
const r = spawnSync('npm', ['view', PKG_NAME, 'version'], {
  cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32', timeout: 60000,
})
if (r.error || r.status !== 0) {
  console.error('')
  console.error('⚠ 未能查证上游版本 —— 这**不算通过**。')
  console.error('  成因：' + (r.error ? r.error.message : (r.stderr || '').trim().split('\n')[0] || 'npm view 退出码 ' + r.status))
  console.error('  请联网后重跑，或人工去 registry 核对 ' + PKG_NAME + ' 的 latest。')
  process.exit(2)
}
const latest = String(r.stdout || '').trim().split('\n').pop().trim()
console.log('  上游 latest: ' + latest)

if (latest === pinned) {
  console.log('\n=== 同版：无需动作（上游没有比钉版更新的版本）===')
  process.exit(0)
}

console.log('\n=== 上游版本与钉版不同 —— 需要人工确认并按清单走一遍 ===')
console.log('  钉版 ' + pinned + '  →  上游 latest ' + latest)
console.log('')
console.log('  1) npm i -D ' + PKG_NAME + '@' + latest + '        # 精确版本，不要 ^ / ~')
console.log('  2) npm run derive:update-values                  # 上游改了客户端派生值才需要')
console.log('  3) 上游改了宿主 API/类型：同步 src/update/dsh-plugin-update.d.ts 与 src/update/host/index.ts')
console.log('  4) 改冻结点 scripts/test-issue-39.cjs 的钉版断言（有意为之：逼一次人工确认）')
console.log('  5) npm run build                                 # 重建 lib/update.js，banner 版本跟着变')
console.log('  6) npm run test:lib-sync && npm run test:issue-39 && npm test，再升插件版本号、提交（含 lib/）、发布')
console.log('')
console.log('  详细理由与三道护栏见 docs/adr/0003-update-package-inlined-at-build.md')
process.exit(1)
