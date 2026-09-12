#!/usr/bin/env node
/**
 * scripts/wayfinder-chart.mjs —— wayfinder 建图与连边（可重入、自校验）
 *
 * 做什么：按 .wayfinder/logmap-manifest.json 建 map 与子票，挂原生 sub-issue 边，
 * 连原生 blocked_by 依赖边，然后**自己校验数量**。
 *
 * 自校验（任何一项对不上就非零退出，不当成成功）：
 *   - sub-issue 实测条数 == 清单声明的子票数
 *   - 每张子票的 blocked_by 实测数 == 清单声明的阻塞数
 *   - map 的 closed/total 面板计数不为 0/0
 *
 * 可重入：进度落在 .wayfinder/logmap-state.json，重跑不会重复建票。
 * 正文一律以文件提交（--body-file），文件内为真实换行，禁字面反斜杠 n 转义。
 *
 * 用法：node scripts/wayfinder-chart.mjs [--check-only]
 *   --check-only  只校验不建票（建票之后复跑用）
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST_PATH = resolve(ROOT, '.wayfinder/logmap-manifest.json')
const STATE_PATH = resolve(ROOT, '.wayfinder/logmap-state.json')
const TMP_DIR = resolve(ROOT, '.wayfinder/.chart-tmp')
const CHECK_ONLY = process.argv.includes('--check-only')

const problems = []
const report = []

function gh(args, { allowFailure = false } = {}) {
  try {
    return execFileSync('gh', args, { encoding: 'utf8', cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch (err) {
    if (allowFailure) return null
    const detail = [err.stdout, err.stderr].filter(Boolean).join('\n').trim()
    throw new Error(`gh ${args.join(' ')} 失败：${detail || err.message}`)
  }
}

function expect(label, expected, actual) {
  const ok = String(expected) === String(actual)
  report.push({ ok, label, expected: String(expected), actual: String(actual) })
  if (!ok) problems.push(`${label}：expected=${expected} actual=${actual}`)
  return ok
}

/** 同步 sleep（脚本是同步流程，不能 await）。 */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * 边写完立刻读会读到旧值：GitHub 的 issue_dependencies_summary 与 sub_issues
 * 都是最终一致，写后即读会拿到写前的数（实测过：刚连完两条边读回 1，几秒后才是 2）。
 * 所以校验必须轮询到达标，而不是读一次就断言——否则会把连好的边误判成失败。
 */
function expectEventually(label, expected, readFn, { tries = 10, delayMs = 1500 } = {}) {
  let actual = readFn()
  for (let i = 0; i < tries && String(actual) !== String(expected); i++) {
    sleepSync(delayMs)
    actual = readFn()
  }
  return expect(label, expected, actual)
}

function issueNumberFromCreateOutput(out) {
  const matches = [...out.matchAll(/\/issues\/(\d+)/g)]
  if (matches.length === 0) throw new Error(`建票输出里读不出 issue 号：${JSON.stringify(out)}`)
  return Number(matches[matches.length - 1][1])
}

function createIssue({ title, labels, bodyFile }) {
  const args = ['issue', 'create', '--title', title, '--body-file', resolve(ROOT, bodyFile)]
  for (const label of labels) args.push('--label', label)
  return issueNumberFromCreateOutput(gh(args))
}

function dbId(number) {
  return Number(gh(['api', `repos/${REPO}/issues/${number}`, '--jq', '.id']))
}

function subIssueCount(mapNumber) {
  return Number(gh(['api', `repos/${REPO}/issues/${mapNumber}/sub_issues`, '--jq', 'length']))
}

function blockedByTotal(childNumber) {
  const raw = gh(['api', `repos/${REPO}/issues/${childNumber}`, '--jq', '.issue_dependencies_summary.total_blocked_by'])
  return Number(raw)
}

/** 未关闭的阻塞者条数（GitHub 叫 blocked_by，只数开着的）—— 决定这张票是否在 frontier 上。 */
function openBlockers(childNumber) {
  const raw = gh(['api', `repos/${REPO}/issues/${childNumber}`, '--jq', '.issue_dependencies_summary.blocked_by'])
  return Number(raw)
}

/** 子票正文首行写 Blocked by 兜底行（原生边不可用时的降级路径）。 */
function patchFallbackLine(number, bodyFile, blockerNumbers) {
  const original = readFileSync(resolve(ROOT, bodyFile), 'utf8')
  if (/^Blocked by:/.test(original)) return
  const line = `Blocked by: ${blockerNumbers.map((n) => `#${n}`).join(', ')}`
  mkdirSync(TMP_DIR, { recursive: true })
  const tmp = resolve(TMP_DIR, `t${number}.md`)
  writeFileSync(tmp, `${line}\n\n${original}`, 'utf8')
  gh(['issue', 'edit', String(number), '--body-file', tmp])
}

// ── 主流程 ────────────────────────────────────────────────────────────────────

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
const REPO = manifest.repo
const state = existsSync(STATE_PATH) ? JSON.parse(readFileSync(STATE_PATH, 'utf8')) : {}
state.issues = state.issues || {}

function save() {
  mkdirSync(dirname(STATE_PATH), { recursive: true })
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

console.log(`仓库：${REPO}${CHECK_ONLY ? '（只校验）' : ''}`)

// 1. map
if (!state.issues[manifest.map.key]) {
  if (CHECK_ONLY) throw new Error('只校验模式，但 state 里没有 map 号')
  const n = createIssue(manifest.map)
  state.issues[manifest.map.key] = n
  save()
  console.log(`建 map：#${n} ${manifest.map.title}`)
}
const MAP_NUMBER = state.issues[manifest.map.key]

// 2. 子票
for (const t of manifest.tickets) {
  if (state.issues[t.key]) continue
  if (CHECK_ONLY) throw new Error(`只校验模式，但 state 里没有 ${t.key} 号`)
  const n = createIssue(t)
  state.issues[t.key] = n
  save()
  console.log(`建子票：#${n} [${t.labels.join(',')}] ${t.title}`)
}

// 3. 原生 sub-issue 边
console.log('\n—— 挂 sub-issue 边 ——')
for (const t of manifest.tickets) {
  const child = state.issues[t.key]
  gh(
    ['api', `repos/${REPO}/issues/${MAP_NUMBER}/sub_issues`, '--method', 'POST', '--field', `sub_issue_id=${dbId(child)}`],
    { allowFailure: true },
  )
}
expectEventually('sub-issue 条数', manifest.tickets.length, () => subIssueCount(MAP_NUMBER))

// 4. 原生 blocked_by 依赖边 + 正文兜底行
console.log('—— 连 blocked_by 依赖边 ——')
for (const t of manifest.tickets) {
  const child = state.issues[t.key]
  const blockerNumbers = t.blockedBy.map((k) => state.issues[k])
  if (blockerNumbers.length > 0) {
    patchFallbackLine(child, t.bodyFile, blockerNumbers)
    for (const blocker of blockerNumbers) {
      gh(
        ['api', `repos/${REPO}/issues/${child}/dependencies/blocked_by`, '--method', 'POST', '--field', `issue_id=${dbId(blocker)}`],
        { allowFailure: true },
      )
    }
  }
  expectEventually(`#${child} blocked_by 条数`, blockerNumbers.length, () => blockedByTotal(child))
}

// 5. 面板计数：closed/total 不得为 0/0
function panelCounts() {
  const rows = JSON.parse(gh(['api', `repos/${REPO}/issues/${MAP_NUMBER}/sub_issues`, '--jq', '[.[] | {n: .number, s: .state}]']))
  return { total: rows.length, closed: rows.filter((r) => r.s === 'closed').length, rows }
}
let panel = panelCounts()
for (let i = 0; i < 10 && panel.total === 0; i++) {
  sleepSync(1500)
  panel = panelCounts()
}
expect('面板 closed/total 的总数不为 0', true, panel.total > 0)
console.log(`\n面板计数：closed/total = ${panel.closed}/${panel.total}`)

// 6. frontier：未关闭的阻塞者应为 0。这条比「边数」更贴近「能不能开工」——
//    边数管关系建没建对，这条管现在有没有人挡在前面（阻塞票关掉后边仍在，但票已可开工）。
const stateOf = new Map(panel.rows.map((r) => [r.n, r.s]))
console.log('—— frontier ——')
for (const t of manifest.tickets) {
  const child = state.issues[t.key]
  if (stateOf.get(child) === 'closed') continue
  const expectedOpen = t.blockedBy.filter((k) => stateOf.get(state.issues[k]) !== 'closed').length
  expectEventually(`#${child} 未关闭的阻塞者数`, expectedOpen, () => openBlockers(child))
}

// ── 报告 ──────────────────────────────────────────────────────────────────────

console.log('\n—— expected / actual ——')
for (const r of report) {
  console.log(`${r.ok ? 'OK  ' : 'FAIL'}  ${r.label}\t expected=${r.expected} actual=${r.actual}`)
}

state.mapNumber = MAP_NUMBER
state.lastCheckedItems = panel.closed
state.lastCheckedTotal = panel.total
save()

console.log('\n—— 建图结果 ——')
console.log(`map  #${MAP_NUMBER}  ${manifest.map.title}`)
for (const t of manifest.tickets) {
  const child = state.issues[t.key]
  const st = stateOf.get(child)
  const blocked = t.blockedBy.map((k) => `#${state.issues[k]}`)
  const openOnes = t.blockedBy.filter((k) => stateOf.get(state.issues[k]) !== 'closed')
  let mark
  if (st === 'closed') mark = '已关票'
  else if (openOnes.length === 0) mark = blocked.length ? '无未关闭阻塞，frontier（阻塞边已随关票解除）' : '无阻塞，frontier'
  else mark = `blocked by ${openOnes.map((k) => `#${state.issues[k]}`).join(' ')}`
  console.log(`  #${child}  [${st}]  ${t.title}  ${mark}`)
}

if (problems.length > 0) {
  console.error(`\n[exit 1] ${problems.length} 项对不上：`)
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
console.log('\n自校验通过：边数与清单声明逐项一致。')
