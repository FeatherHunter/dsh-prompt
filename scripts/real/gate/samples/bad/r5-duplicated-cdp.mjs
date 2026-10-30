#!/usr/bin/env node
/**
 * 坏样本 R5：在脚本里复制 CDP 客户端（new WebSocket / 直连 /json/list / 自拼 Runtime.evaluate）。
 * 其余规则保持合规，好让 --selftest 只能归因到 R5。
 */
import { resolveBindings } from '../../../harness/bindings.mjs'
import { writeReport } from '../../../harness/evidence.mjs'

const bindings = resolveBindings(process.argv.slice(2))
const client = { async close() {} }
let report = null
try {
  const targetUrl = bindings.cdpBaseUrl + '/json/list'
  const socket = new WebSocket(targetUrl)
  const evaluate = (expression) => socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression } }))
  report = { verdict: 'PASS', targetUrl, evaluate: typeof evaluate }
} catch (error) {
  report = { verdict: 'BLOCKED', reason: String(error) }
} finally {
  await client.close()
}
writeReport({ finish: () => report }, bindings.evidenceRoot)
process.exit(report.verdict === 'PASS' ? 0 : 2)
