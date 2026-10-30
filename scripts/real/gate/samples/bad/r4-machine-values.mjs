#!/usr/bin/env node
/**
 * 坏样本 R4：硬编码机器特定值（用户主目录 / 宿主安装位置 / 浏览器路径 / 证据目录 / locale）。
 * 其余规则保持合规，好让 --selftest 只能归因到 R4。
 */
import path from 'node:path'

import { resolveBindings } from '../../../harness/bindings.mjs'
import { writeReport } from '../../../harness/evidence.mjs'

const bindings = resolveBindings(process.argv.slice(2))
const HOME_DIR = 'C:\\Users\\alice'
const BROWSER = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const SHOT_DIR = 'D:/Temp/gate-186'
const LOCALE = 'zh-CN'
const client = { async close() {} }
let report = null
try {
  report = { verdict: 'PASS', home: HOME_DIR, browser: BROWSER, shots: path.join(SHOT_DIR, 'a.png'), locale: LOCALE }
} catch (error) {
  report = { verdict: 'BLOCKED', reason: String(error) }
} finally {
  await client.close()
}
writeReport({ finish: () => report }, bindings.evidenceRoot)
process.exit(report.verdict === 'PASS' ? 0 : 2)
