#!/usr/bin/env node
/**
 * 坏样本 R3：没有 finally 兜底，也没有任何清理调用 —— 失败路径会漏进程 / 端口 / 临时目录。
 * 其余规则保持合规，好让 --selftest 只能归因到 R3。
 */
import { resolveBindings } from '../../../harness/bindings.mjs'
import { writeReport } from '../../../harness/evidence.mjs'

const bindings = resolveBindings(process.argv.slice(2))
let report = null
try {
  report = { verdict: 'PASS', target: bindings.serverUrl }
} catch (error) {
  report = { verdict: 'BLOCKED', reason: String(error) }
}
writeReport({ finish: () => report }, bindings.evidenceRoot)
process.exit(report.verdict === 'PASS' ? 0 : 2)
