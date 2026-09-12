/**
 * dsh-prompt 构建编排（#39 整改）：唯一一处流水线编排，由 node 直接跑，跨平台。
 *
 * 为什么收成一个 node 脚本：原来 `npm run build` 走 `bash scripts/build.sh`，而 Windows 上 PATH 里的
 * bash 往往是 `C:\Windows\system32\bash.exe`（WSL 启动器）。WSL 里跑的是 Linux 版 node，
 * node_modules 里的 esbuild 却是 win32 二进制 → 宿主半打包必报
 * 「You installed esbuild for another platform」，于是 `npm run build` 恒红（#39 审查 C2）；
 * 而且 build.sh 与 build.ps1 把同一步骤各写了一遍，会各自漂移。现在只有这一处。
 *
 * 步骤与产物：
 *   1) build:client（tsdown → lib/client.js，客户端 bundle，同时把事件清单内联进去）
 *   2) build:update-host（esbuild 打包 src/update/host/index.ts → lib/update.js）
 *   3) verify：三个产物都要在（lib/index.js 是检入的源码，不构建，只验存在）
 * 退出码：0 = 全部产物齐；非 0 = 有一步失败（失败时给出可读成因与修法，不吐原生堆栈了事）。
 *
 * 用 `process.execPath` 跑宿主半、不用 `npm run`：这一步必须与 node_modules 里的 esbuild 同平台，
 * 直接用当前 node 才把「哪个 node」这件事钉死。stdio 一律 inherit（不 piped）：输出实时可见，
 * 也不依赖管道。
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const ARTIFACTS = ['lib/index.js', 'lib/client.js', 'lib/update.js']

/** 跑一步；返回是否成功。npm 在 Windows 上是 npm.cmd，必须过 shell（参数全是字面量，无注入面）。 */
function run(label, command, args, shell = false) {
  console.log('=== ' + label + ' ===')
  const r = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', shell })
  if (r.error) {
    console.error(label + ' 起不来：' + r.error.message)
    return false
  }
  if (r.status !== 0) {
    console.error(label + ' 失败（退出码 ' + r.status + '）')
    return false
  }
  return true
}

const npm = (script) => run(script, 'npm', ['run', script], process.platform === 'win32')

/**
 * 跑宿主半打包并**收下 stderr**：失败提示要按成因分支（复审 V6①）。
 * 上一版不管什么原因都打印「别在 WSL 的 bash 里跑」，而 step2 完全可能因为跟平台无关的原因失败
 * （比如 build-host.mjs 被删、源码语法错）—— 那时这条修法是误导。stderr 仍原样转发，不吞原生报错。
 */
function runHostPack() {
  console.log('=== build:update-host (esbuild) ===')
  const r = spawnSync(process.execPath, ['scripts/update/build-host.mjs'], {
    cwd: ROOT, stdio: ['inherit', 'inherit', 'pipe'], encoding: 'utf8',
  })
  if (r.stderr) process.stderr.write(r.stderr)
  if (r.error) return { ok: false, err: r.error.message }
  return { ok: r.status === 0, err: String(r.stderr ?? '') }
}

if (!npm('build:client')) process.exit(1)
const hostStep = runHostPack()
if (!hostStep.ok) {
  if (/another platform/i.test(hostStep.err)) {
    console.error('当前 node：' + process.platform + '/' + process.arch + '（' + process.execPath + '）')
    console.error('修法：用与本机 esbuild 同平台的 node 跑同一条命令 —— 在 Windows 的 PowerShell / cmd 里')
    console.error('跑 npm run build，不要在 WSL 的 bash 里跑（WSL 的 node 用不了 win32 的 esbuild）。')
  } else if (/Cannot find module|MODULE_NOT_FOUND/.test(hostStep.err) && /build-host\.mjs/.test(hostStep.err)) {
    console.error('修法：scripts/update/build-host.mjs 不在了（被删或改名）—— 它是宿主半的打包入口，先把它找回来。')
  } else {
    console.error('修法：看上面 build:update-host 的报错原文 —— 这一步是 `node scripts/update/build-host.mjs`')
    console.error('（esbuild 打包 src/update/host/index.ts → lib/update.js）。这不是「node 平台选错」，别去换 bash/WSL。')
  }
  process.exit(1)
}

console.log('=== verify ===')
let missing = 0
for (const file of ARTIFACTS) {
  if (existsSync(join(ROOT, file))) console.log(file + ' OK')
  else { console.error('缺产物：' + file); missing += 1 }
}
process.exit(missing === 0 ? 0 : 1)
