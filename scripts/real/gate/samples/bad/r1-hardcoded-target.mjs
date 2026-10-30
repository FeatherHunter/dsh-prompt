#!/usr/bin/env node
/**
 * 坏样本 R1：目标入口硬编码（主机 / 端口 / token），目标 URL 没有走运行期输入。
 * 其余规则保持合规，好让 --selftest 只能归因到 R1。
 */
import os from 'node:os'

import { resolveBindings } from '../../../harness/bindings.mjs'
import { writeReport } from '../../../harness/evidence.mjs'

const bindings = resolveBindings(process.argv.slice(2))
const TARGET = 'http://127.0.0.1:9333/?token=deadbeefcafe'
const CDP_PORT = process.env.CDP_PORT || '9231'
const client = { async close() {} }
let report = null
try {
  report = { verdict: 'PASS', target: TARGET, cdpPort: CDP_PORT, host: os.hostname() }
} catch (error) {
  report = { verdict: 'BLOCKED', reason: String(error) }
} finally {
  await client.close()
}
writeReport({ finish: () => report }, bindings.evidenceRoot)
process.exit(report.verdict === 'PASS' ? 0 : 2)
