#!/usr/bin/env node
/**
 * 探针（#39 交付 7）：本插件宿主里 `ctx.get(...)` 能取到哪些服务
 *
 * 为什么要探这一下：更新包 `dsh-plugin-update` 的自动安装有两条路由 ——
 * `ctx.get('desktopProfiles')` 取到值走桌面服务，取不到走子进程（cli）路由。
 * 取不到还会牵动包 README 第 9 / 12 节的手工兜底命令。本仓的 `inject` 只有
 * `["storageDomain","webServer"]`，所以「更新包能不能拿到 desktopProfiles / subprocess」
 * 必须实测，不能照 wf 的例子推断（研究稿 findings.md 第 3 节把它列为未坐实项）。
 *
 * 做法：不碰真机宿主。往一个**临时 profile**（`--from-default-profile web` 现造，无任何第三方插件）
 * 里挂一个只做 ctx.get 的探针插件，用它的 Web profile 组合启动一次（`--no-open`，
 * 端口 0 由系统分配），把结果写进 ctx-services.json 后退出；收尾时删掉临时 profile。
 * 探针插件本体住 <workdir>/probe-pkg/，临时 profile 的 node_modules 里用 junction 指过去。
 *
 * 用法：
 *   node scripts/update/probe-ctx-services.mjs [--profile probe39] [--workdir <dir>] [--keep]
 *
 * 注意：这条探针验的是「web profile 组合」（本插件当前唯一的运行环境），不是真机 DSH Desktop。
 * 桌面宿主（dsh-plugin-desktop 提供的 desktopProfiles）在 web profile 里本来就不存在 ——
 * 这正是本探针要坐实的那一点。**结论的适用范围只有 web profile**：真机 DSH Desktop 的
 * `resources/app.asar` 里有两处 `ctx.inject(['desktopProfiles','desktopPnpm'], …)`，即 Desktop
 * 确实提供 desktopProfiles；那边 detectEnvironmentKind() 会判 desktop、走桌面服务路由，
 * Desktop 侧本探针没实测（见 map #38 的 Not yet specified），不许把这里的读数外推过去。
 */
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

function argOf(name, fallback) {
  const i = process.argv.indexOf(name)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const profileName = argOf('--profile', 'probe39')
const workdir = resolve(argOf('--workdir', join(process.cwd(), '.tmp-verify', 'probe-39')))
const keep = process.argv.includes('--keep')
const dshHome = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')
const profileDir = join(dshHome, 'profiles', profileName)
const pkgDir = join(workdir, 'probe-pkg')
const outFile = join(workdir, 'ctx-services.json')

mkdirSync(pkgDir, { recursive: true })
writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({
  name: 'dsh-probe-39',
  version: '0.0.0',
  private: true,
  type: 'module',
  main: 'index.js',
  dsh: { bundle: { patch: './cordis.patch.yml' } },
}, null, 2) + '\n', 'utf8')
writeFileSync(join(pkgDir, 'cordis.patch.yml'),
  '# 探针 bundle 层：把探针插件挂进宿主（照 dsh-prompt 的 cordis.patch.yml 形状）\n' +
  '- insert:\n' +
  '    - id: dsh-probe-39\n' +
  "      name: 'dsh-probe-39'\n" +
  '      config: {}\n', 'utf8')
writeFileSync(join(pkgDir, 'index.js'), `
import { writeFileSync } from 'node:fs'
export const name = 'dsh-probe-39'
export const inject = ['webServer']
export function apply(ctx) {
  const probe = (phase) => {
    const names = ['desktopProfiles', 'desktopPnpm', 'subprocess', 'timer', 'fs', 'webServer', 'connection', 'storageDomain']
    const get = {}
    for (const n of names) {
      let v
      try { v = ctx.get(n) } catch (e) { v = 'THROW:' + (e && e.message) }
      get[n] = v === undefined ? 'undefined' : (v === null ? 'null' : 'present(' + typeof v + ')')
    }
    return { phase, at: new Date().toISOString(), get, inject: ctx.inject ? 'has-inject' : 'no-inject' }
  }
  const rows = [probe('apply')]
  const finish = () => { try { writeFileSync(process.env.PROBE_OUT, JSON.stringify(rows, null, 2) + '\\n', 'utf8') } catch (e) {} }
  const timer = ctx.get('timer')
  if (timer && typeof timer.timeout === 'function') timer.timeout(() => { rows.push(probe('after-1s')); finish() }, 1000)
  else setTimeout(() => { rows.push(probe('after-1s')); finish() }, 1000)
}
`.trimStart(), 'utf8')

/** 后台起一个 dsh 进程；返回句柄（`dsh web` 是常驻服务，不会自己退，靠调用方 kill）。 */
function spawnDsh(argv, env = {}) {
  const child = spawn('dsh', argv, {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    env: { ...process.env, ...env },
  })
  const state = { log: '', exited: false }
  child.stdout.on('data', (b) => { state.log += b })
  child.stderr.on('data', (b) => { state.log += b })
  child.on('close', () => { state.exited = true })
  return { child, state }
}

/** 等一个条件成立，超时返回 false。 */
async function waitFor(check, timeoutMs, everyMs = 500) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, everyMs))
    if (check()) return true
  }
  return false
}

console.log('[probe] 临时 profile：' + profileDir)
console.log('[probe] 探针插件：' + pkgDir)
// 上一次跑剩的现场先清掉：`--from-default-profile` 见到同名 profile 会直接拒绝，不是我们的目标。
rmSync(profileDir, { recursive: true, force: true })

// 第 1 步：现造一个空的 web profile（`--from-default-profile web` 建完即启动，起来了就杀掉）。
// 组合只有 @deepseek-ai/dsh-base + @deepseek-ai/dsh-web-app（见清单），不含任何第三方插件。
const created = spawnDsh(['--profile', profileName, '--from-default-profile', 'web', '--port', '0', '--no-open'])
const booted = await waitFor(() => /dsh web: http/.test(created.state.log) || created.state.exited, 60_000)
if (!booted || !/dsh web: http/.test(created.state.log)) {
  created.child.kill()
  console.error('[probe] 临时 profile 没起来：\n' + created.state.log.split('\n').slice(0, 20).join('\n'))
  process.exit(1)
}
created.child.kill()
console.log('[probe] 临时 profile 已建（组合 = @deepseek-ai/dsh-base + @deepseek-ai/dsh-web-app + 探针）')

// 第 2 步：把探针 bundle 挂进去：node_modules 里放 junction + 清单 bundles 里加名字。
const manifestPath = join(profileDir, 'package.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
manifest.dsh = manifest.dsh || {}
manifest.dsh.profile = manifest.dsh.profile || {}
const bundles = manifest.dsh.profile.bundles || []
if (!bundles.includes('dsh-probe-39')) bundles.push('dsh-probe-39')
manifest.dsh.profile.bundles = bundles
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
mkdirSync(join(profileDir, 'node_modules'), { recursive: true })
symlinkSync(pkgDir, join(profileDir, 'node_modules', 'dsh-probe-39'), 'junction')

// 第 3 步：带着探针启动，等它把 ctx.get 结果写出来，然后收工。
const run = spawnDsh(['--profile', profileName, '--port', '0', '--no-open'], { PROBE_OUT: outFile })
const done = await waitFor(() => {
  try { return JSON.parse(readFileSync(outFile, 'utf8')).length >= 2 } catch (e) { return false }
}, 60_000)
run.child.kill()

let rows = null
try { rows = JSON.parse(readFileSync(outFile, 'utf8')) } catch (e) { /* 见下 */ }
if (!keep) {
  rmSync(profileDir, { recursive: true, force: true })
  console.log('[probe] 临时 profile 已删除（--keep 可保留现场）')
}
if (!rows || !done) {
  console.error('[probe] 没拿到结果，宿主日志前 20 行：\n' + run.state.log.split('\n').slice(0, 20).join('\n'))
  process.exit(1)
}
console.log('[probe] 上下文实测结果：')
console.log(JSON.stringify(rows, null, 2))
/**
 * 结论（**只对本次探针验过的 web profile 组合成立，不可外推**）：web profile 组合里
 * desktopProfiles / desktopPnpm 取不到 → 更新包的环境判定为 cli → 自动安装走子进程（cli）路由，
 * 因此依赖 ctx.get('subprocess') 有值（本机成立）。
 * 真机 DSH Desktop 不适用这一句：Desktop 提供 desktopProfiles（app.asar 里两处 inject），
 * 那条 desktop-service 路由本探针没验（map #38 的 Not yet specified 记着这一条）。
 */
const apply = rows[0].get
console.log('[probe] 结论（仅 web profile 组合）：desktopProfiles = ' + apply.desktopProfiles +
  ' → 环境判定 ' + (apply.desktopProfiles === 'undefined' ? 'cli' : 'desktop') +
  '；自动安装走 ' + (apply.desktopProfiles === 'undefined' ? '子进程（cli）' : '桌面服务') + ' 路由')
console.log('[probe] 不可外推到真机 DSH Desktop：Desktop 确实提供 desktopProfiles，' +
  '那边走 desktop-service 路由，本探针未实测、禁止据此下通用结论')
if (apply.desktopProfiles === 'undefined' && apply.subprocess === 'undefined') {
  console.log('[probe] 警告：两条安装路由都取不到服务，自动安装一定走手工兜底命令（见包 README 第 9 节）')
}
// dsh 是常驻服务，Windows 上 kill 只杀得掉中间的 shell，子进程还挂着管道：
// 显式退出，免得父进程的事件循环一直被那两根管道吊着。
process.exit(0)
