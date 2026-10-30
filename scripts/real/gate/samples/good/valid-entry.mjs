#!/usr/bin/env node
/**
 * 合法样本：真机入口脚本的最低合规形状 —— 应通过全部五类规则。
 *
 * 只给 `node scripts/check-real-gate.mjs --selftest` 做静态扫描，不真跑。
 * 合规点（与门禁规则一一对应）：
 *   R1 目标入口/端口来自 resolveBindings（运行期输入），脚本里没有主机/端口/token 字面量；
 *   R2 报告走 harness 的 writeReport（JSON 落盘），退出码 0 与非 0 可区分；
 *   R3 finally 兜底收掉浏览器与服务，进程/端口/临时目录有回收入口；
 *   R4 没有任何用户主目录、宿主安装位置、浏览器路径、locale 字面量；
 *   R5 不自造 CDP 客户端，连接与操作都来自 vendored harness。
 */
import path from 'node:path'

import { resolveBindings } from '../../../harness/bindings.mjs'
import { writeReport } from '../../../harness/evidence.mjs'

const bindings = resolveBindings(process.argv.slice(2))
const client = { async close() {} }
const server = { async stop() {} }
let report = null
try {
  const screenshot = path.join(bindings.evidenceRoot, 'boot.png')
  report = { verdict: 'PASS', target: bindings.serverUrl, screenshot }
} catch (error) {
  report = { verdict: 'BLOCKED', reason: String(error) }
} finally {
  await server.stop()
  await client.close()
}
writeReport({ finish: () => report }, bindings.evidenceRoot)
process.exit(report.verdict === 'PASS' ? 0 : 2)
