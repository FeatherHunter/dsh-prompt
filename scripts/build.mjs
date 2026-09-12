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

if (!npm('build:client')) process.exit(1)
if (!run('build:update-host (esbuild)', process.execPath, ['scripts/update/build-host.mjs'])) {
  console.error('当前 node：' + process.platform + '/' + process.arch + '（' + process.execPath + '）')
  console.error('修法：用与本机 esbuild 同平台的 node 跑同一条命令 —— 在 Windows 的 PowerShell / cmd 里')
  console.error('跑 npm run build，不要在 WSL 的 bash 里跑（WSL 的 node 用不了 win32 的 esbuild）。')
  process.exit(1)
}

console.log('=== verify ===')
let missing = 0
for (const file of ARTIFACTS) {
  if (existsSync(join(ROOT, file))) console.log(file + ' OK')
  else { console.error('缺产物：' + file); missing += 1 }
}
process.exit(missing === 0 ? 0 : 1)
