/**
 * 门禁：检入的构建产物必须等于「用当前源码重新构建一遍」的结果。
 *
 * 【为什么有这一条】
 * 本仓测试跑的是**临时转译的 src**（scripts/.rt-tmp-*），而用户装到的是**检入的 lib/**。
 * 两件事之间原来没有任何约束：改完 src 忘了 `npm run build`，所有测试照样全绿，
 * 发出去的 lib/ 是旧的 —— 而发布动作（scripts/publish-window.ps1）打的正是工作目录里的 lib/。
 * scripts/build.mjs 的 verify 只做 `existsSync`（只验存在），拦不住这一类。
 *
 * 【判据】
 *   先把当前 lib/ 快照到临时目录 → 跑一次完整构建 → 逐字节比对（行尾归一后）。
 *   一致 = 绿（构建是确定性的，磁盘上不会有净变化）。
 *   不一致 = 红，逐个点名差在哪个产物的第几行，并给出修法（重新构建并提交产物）。
 *
 * 跑法：npm run test:lib-sync
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SNAP = join(ROOT, 'scripts', '.rt-tmp-libsync')

/** 构建产物（lib/index.js 是检入的源码、不构建，见 scripts/build.mjs 的头注）。 */
const ARTIFACTS = ['lib/client.js', 'lib/update.js']

/** 行尾归一：本仓 `.gitattributes` 钉了 eol=lf，但工具在 Windows 上可能写出 CRLF，比对时不因此判红。 */
const norm = (s) => String(s).replace(/\r\n?/g, '\n')

console.log('=== lib/ 与 src/ 同步门禁 ===')

// 1) 快照
rmSync(SNAP, { recursive: true, force: true })
mkdirSync(SNAP, { recursive: true })
const before = new Map()
for (const rel of ARTIFACTS) {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) {
    console.error('缺产物：' + rel + '（先跑 npm run build）')
    process.exit(1)
  }
  copyFileSync(abs, join(SNAP, rel.replace(/[/\\]/g, '__')))
  before.set(rel, readFileSync(abs, 'utf8'))
}

// 2) 重新构建（stdio 继承：失败原因要原样可见，与 build.mjs 同一套口径）
console.log('--- 重新构建（npm run build）---')
const r = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' })
if (r.error || r.status !== 0) {
  console.error('构建失败，无法判定产物是否同步。')
  process.exit(1)
}

// 3) 比对
const bad = []
for (const rel of ARTIFACTS) {
  const b = norm(before.get(rel))
  const a = norm(readFileSync(join(ROOT, rel), 'utf8'))
  if (a === b) { console.log('  ok: ' + rel + ' 与重新构建结果一致'); continue }
  const bl = b.split('\n'), al = a.split('\n')
  let line = 0
  while (line < Math.max(bl.length, al.length) && bl[line] === al[line]) line++
  bad.push('  ' + rel + ' 不一致（首个差异在第 ' + (line + 1) + ' 行；快照 ' + bl.length + ' 行 → 重建 ' + al.length + ' 行）')
}

rmSync(SNAP, { recursive: true, force: true })

if (bad.length) {
  console.error('\n=== 不合格：检入的 lib/ 与当前 src/ 不同步 ===')
  for (const l of bad) console.error(l)
  console.error('\n修法：跑 `npm run build`，把重新生成的 lib/ 一起提交。')
  console.error('（否则测试全绿、发出去的却是旧的 bundle —— 这正是本门禁要拦的事。）')
  process.exit(1)
}
console.log('\n=== Test lib-sync PASS ===')
