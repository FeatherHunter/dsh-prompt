#!/usr/bin/env node
/**
 * 坏样本 R2：没有机器可读的 JSON 报告，退出码只剩一个 0（失败与成功不可区分）。
 * 其余规则保持合规，好让 --selftest 只能归因到 R2。
 */
import { resolveBindings } from '../../../harness/bindings.mjs'

const bindings = resolveBindings(process.argv.slice(2))
const client = { async close() {} }
try {
  console.log('目标入口:', bindings.serverUrl)
} finally {
  await client.close()
}
process.exit(0)
