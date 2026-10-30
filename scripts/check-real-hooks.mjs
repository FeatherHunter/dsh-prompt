#!/usr/bin/env node
/**
 * 插件测试钩子契约门禁（#190）
 *
 * 为什么有这条：
 *   真机用例靠 `data-dsh-prompt-*` 在真实 DOM 里找元素。钩子一旦在改版中被改名、删掉，
 *   真机套件并不是「红」，而是找不到元素后跑出误导性的结果（超时、空断言、或干脆空转通过）。
 *   契约只有写在文档里不算数 —— 必须在构建产物上验证，才能保证「文档承诺的钩子确实还能查到」。
 *   同时把「诊断开关」（`window.__dshPromptDiag`）的代码标记也钉住：排障入口被摇掉时，
 *   真机 diganose 流程会静默缺一块。
 *
 * 查什么：
 *   1) 构建产物 lib/client.js 里必须包含 REQUIRED_HOOKS 里的每个 `data-dsh-prompt-*` 字面量
 *      （打包后仍是字符串，缺一个即红并指出是哪个）；
 *   2) lib/client.js 里必须包含诊断开关的代码标记（DIAG_MARKERS）；
 *   3) 契约文档 docs/real/hooks.md 与 REQUIRED_HOOKS 双向交叉校验：
 *      文档标「可依赖」的钩子必须全在门禁清单里，门禁要求的钩子也必须在文档里标「可依赖」
 *      （防文档与门禁各自漂移：文档吹了门禁没查、门禁查了文档没写，都算红）。
 *
 * 用法：
 *   node scripts/check-real-hooks.mjs             正式检查（由 npm run check 调用）
 *   node scripts/check-real-hooks.mjs --selftest  自证：完整副本绿 / 删掉一个必需钩子必红 / 文档漂移必红
 *   node scripts/check-real-hooks.mjs --help      打印本说明
 *
 * 输出：PASS / FAIL / INFO 行，最后一行是 `RESULT: N FAIL`；实现零依赖（只用 Node 内置）。
 * 退出码：0 = 全绿；1 = 有 FAIL；2 = 用法错误。
 *
 * 新增 / 修改钩子的流程（改完必须三处同步，否则本条门禁红）：
 *   1) 产品侧：在既有模块里加 `data-dsh-prompt-*`（不新增 src/*.ts，命名规范冻结）；
 *   2) 契约：docs/real/hooks.md 对应区域表格里登记（属性名 / 所在元素与区域 / 语义 / 稳定性 / 首次引入版本）；
 *   3) 门禁：标「可依赖」的钩子必须加入本文件的 REQUIRED_HOOKS（含 area，报错时指明区域）。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ARTIFACT_REL = 'lib/client.js'
const CONTRACT_DOC_REL = 'docs/real/hooks.md'

/**
 * 诊断开关的代码标记：真机排障时用 `?dsh-prompt-diag=1` 或 localStorage 打开，
 * 产物里必须还能查到这几个字面量（改名 = 文档与证据链失效）。
 */
const DIAG_MARKERS = [
  { s: '__dshPromptDiag', why: '诊断快照的全局挂载点' },
  { s: 'dsh-prompt-diag', why: 'URL 参数 / localStorage 的开关键名' },
  { s: '[dsh-prompt:diag]', why: 'console.debug 的固定前缀' },
]

/**
 * 必需钩子 = 契约里标「可依赖」的全部钩子。分组只为报错定位，不参与匹配。
 * ⚠️ 与 docs/real/hooks.md 双向一致：增删这里必须同步增删文档表格（反之亦然）。
 */
const REQUIRED_HOOKS = [
  // 入口与底栏
  { hook: 'data-dsh-prompt-entry', area: '入口与底栏' },
  { hook: 'data-dsh-prompt-label', area: '入口与底栏' },
  { hook: 'data-dsh-prompt-settings-modal', area: '入口与底栏' },
  { hook: 'data-dsh-prompt-settings-modal-close', area: '入口与底栏' },
  { hook: 'data-dsh-prompt-remote-gear', area: '入口与底栏' },
  { hook: 'data-dsh-prompt-workspace-picker', area: '入口与底栏' },
  { hook: 'data-dsh-prompt-sidebar-toggle', area: '入口与底栏' },
  { hook: 'data-dsh-prompt-workspace-left', area: '入口与底栏' },
  { hook: 'data-dsh-prompt-remote-input', area: '入口与底栏' },
  { hook: 'data-dsh-prompt-remote-input-root', area: '入口与底栏' },
  { hook: 'data-dsh-prompt-remote-input-sheet', area: '入口与底栏' },
  { hook: 'data-dsh-prompt-remote-input-ta', area: '入口与底栏' },
  // 面板框架
  { hook: 'data-dsh-prompt-panel-root', area: '面板框架' },
  { hook: 'data-dsh-prompt-panel-state', area: '面板框架' },
  { hook: 'data-dsh-prompt-panel-surface', area: '面板框架' },
  { hook: 'data-dsh-prompt-bar', area: '面板框架' },
  { hook: 'data-dsh-prompt-close', area: '面板框架' },
  { hook: 'data-dsh-prompt-list', area: '面板框架' },
  { hook: 'data-dsh-prompt-counts', area: '面板框架' },
  { hook: 'data-dsh-prompt-search', area: '面板框架' },
  { hook: 'data-dsh-prompt-row', area: '面板框架' },
  { hook: 'data-dsh-prompt-cloud', area: '面板框架' },
  { hook: 'data-dsh-prompt-scope', area: '面板框架' },
  { hook: 'data-dsh-prompt-templates-toggle', area: '面板框架' },
  // 模板行
  { hook: 'data-dsh-prompt-id', area: '模板行' },
  { hook: 'data-dsh-prompt-row-role', area: '模板行' },
  { hook: 'data-dsh-prompt-row-name', area: '模板行' },
  { hook: 'data-dsh-prompt-row-labels', area: '模板行' },
  { hook: 'data-dsh-prompt-row-preview', area: '模板行' },
  { hook: 'data-dsh-prompt-pin', area: '模板行' },
  { hook: 'data-dsh-prompt-act', area: '模板行' },
  { hook: 'data-dsh-prompt-hide', area: '模板行' },
  // 触发方式与设置跳转
  { hook: 'data-dsh-prompt-trigger', area: '触发方式与设置跳转' },
  { hook: 'data-dsh-prompt-trigger-mode', area: '触发方式与设置跳转' },
  { hook: 'data-dsh-prompt-chrome', area: '触发方式与设置跳转' },
  { hook: 'data-dsh-prompt-go-settings-state', area: '触发方式与设置跳转' },
  { hook: 'data-dsh-prompt-go-settings-error', area: '触发方式与设置跳转' },
  // 设置页
  { hook: 'data-dsh-prompt-settings-root', area: '设置页' },
  { hook: 'data-dsh-prompt-setting', area: '设置页' },
  { hook: 'data-dsh-prompt-hide-toggle', area: '设置页' },
  { hook: 'data-dsh-prompt-remote-toggle', area: '设置页' },
  { hook: 'data-dsh-prompt-remote-section', area: '设置页' },
  { hook: 'data-dsh-prompt-size-value', area: '设置页' },
  { hook: 'data-dsh-prompt-size-slider', area: '设置页' },
  { hook: 'data-dsh-prompt-remote-orientation', area: '设置页' },
  { hook: 'data-dsh-prompt-orientation', area: '设置页' },
  { hook: 'data-dsh-prompt-orientation-effective', area: '设置页' },
  { hook: 'data-dsh-prompt-orientation-note', area: '设置页' },
  { hook: 'data-dsh-prompt-remote-density', area: '设置页' },
  { hook: 'data-dsh-prompt-density', area: '设置页' },
  // 弹层与标签
  { hook: 'data-dsh-prompt-modal', area: '弹层与标签' },
  { hook: 'data-dsh-prompt-modal-root', area: '弹层与标签' },
  { hook: 'data-dsh-prompt-modal-kind', area: '弹层与标签' },
  { hook: 'data-dsh-prompt-label-picker', area: '弹层与标签' },
  { hook: 'data-dsh-prompt-label-grid', area: '弹层与标签' },
  { hook: 'data-dsh-prompt-label-cell', area: '弹层与标签' },
  // 远程大列表
  { hook: 'data-dsh-prompt-remote-panel', area: '远程大列表' },
  { hook: 'data-dsh-prompt-remote-state', area: '远程大列表' },
  { hook: 'data-dsh-prompt-remote-enabled', area: '远程大列表' },
  { hook: 'data-dsh-prompt-remote-orient', area: '远程大列表' },
  { hook: 'data-dsh-prompt-remote-size', area: '远程大列表' },
  { hook: 'data-dsh-prompt-remote-orientation-pref', area: '远程大列表' },
  { hook: 'data-dsh-prompt-remote-grid', area: '远程大列表' },
  { hook: 'data-dsh-prompt-remote-card', area: '远程大列表' },
  { hook: 'data-dsh-prompt-remote-use', area: '远程大列表' },
  { hook: 'data-dsh-prompt-remote-act', area: '远程大列表' },
  { hook: 'data-dsh-prompt-remote-empty', area: '远程大列表' },
  { hook: 'data-dsh-prompt-remote-search-input', area: '远程大列表' },
  { hook: 'data-dsh-prompt-remote-add', area: '远程大列表' },
  { hook: 'data-dsh-prompt-remote-search', area: '远程大列表' },
  { hook: 'data-dsh-prompt-remote-prev', area: '远程大列表' },
  { hook: 'data-dsh-prompt-remote-next', area: '远程大列表' },
  { hook: 'data-dsh-prompt-remote-page', area: '远程大列表' },
  { hook: 'data-dsh-prompt-remote-close', area: '远程大列表' },
  // 取色
  { hook: 'data-dsh-prompt-ink-field', area: '取色' },
  { hook: 'data-dsh-prompt-ink-field-btn', area: '取色' },
  { hook: 'data-dsh-prompt-ink-swatch', area: '取色' },
  { hook: 'data-dsh-prompt-ink-pop', area: '取色' },
  { hook: 'data-dsh-prompt-ink-cell', area: '取色' },
  { hook: 'data-dsh-prompt-ink-hex', area: '取色' },
  { hook: 'data-dsh-prompt-ink-default', area: '取色' },
  { hook: 'data-dsh-prompt-ink-outline', area: '取色' },
  { hook: 'data-dsh-prompt-ink-close', area: '取色' },
  { hook: 'data-dsh-prompt-ink-done', area: '取色' },
  { hook: 'data-dsh-prompt-ink-preview', area: '取色' },
  { hook: 'data-dsh-prompt-tint', area: '取色' },
  // 工作区挑选器（只承诺核心定位面，内部装饰钩子见文档「仅调试用」）
  { hook: 'data-dsh-prompt-picker-root', area: '工作区挑选器' },
  { hook: 'data-dsh-prompt-picker-sheet', area: '工作区挑选器' },
  { hook: 'data-dsh-prompt-picker-mask', area: '工作区挑选器' },
  { hook: 'data-dsh-prompt-picker-close', area: '工作区挑选器' },
  { hook: 'data-dsh-prompt-picker-search', area: '工作区挑选器' },
  { hook: 'data-dsh-prompt-picker-grid', area: '工作区挑选器' },
  { hook: 'data-dsh-prompt-picker-row', area: '工作区挑选器' },
  { hook: 'data-dsh-prompt-picker-card', area: '工作区挑选器' },
  { hook: 'data-dsh-prompt-picker-loading', area: '工作区挑选器' },
  { hook: 'data-dsh-prompt-picker-empty', area: '工作区挑选器' },
]

const REQUIRED_SET = new Set(REQUIRED_HOOKS.map((x) => x.hook))
/** 契约文档里稳定性列的两种取值（表格五列：钩子 / 元素与区域 / 语义 / 稳定性 / 首次引入版本）。 */
const STABILITY_STABLE = '可依赖'
const STABILITY_DEBUG = '仅调试用'
const HOOK_NAME_RE = /data-dsh-prompt-[a-z0-9-]+/g

const USAGE = [
  '插件测试钩子契约门禁（#190）',
  '',
  '用法：',
  '  node scripts/check-real-hooks.mjs             正式检查（构建产物 + 契约文档交叉校验）',
  '  node scripts/check-real-hooks.mjs --selftest  自证（完整副本绿 / 删一个必需钩子必红 / 文档漂移必红）',
  '  node scripts/check-real-hooks.mjs --help      打印本说明',
  '',
  '退出码：0 = 全绿；1 = 有 FAIL；2 = 用法错误。',
].join('\n')

/** 极简报告器：与仓内其它门禁同一行格式，便于 CI 日志 grep。 */
const REPORTER = (() => {
  let fails = 0
  return {
    pass(name, detail) { console.log('PASS: ' + name + (detail ? ' — ' + detail : '')) },
    info(name, detail) { console.log('INFO: ' + name + (detail ? ' — ' + detail : '')) },
    fail(name, detail) { fails += 1; console.log('FAIL: ' + name + (detail ? ' — ' + detail : '')) },
    get fails() { return fails },
    finish() {
      console.log('')
      console.log('RESULT: ' + fails + ' FAIL')
      process.exit(fails === 0 ? 0 : 1)
    },
  }
})()

function readText(relOrAbs) {
  const p = path.isAbsolute(relOrAbs) ? relOrAbs : path.join(ROOT, relOrAbs)
  try { return fs.readFileSync(p, 'utf8') } catch (e) { return null }
}

/**
 * 在产物文本里找一个钩子字面量；右侧加边界断言，避免短名被长名「遮挡」：
 * `data-dsh-prompt-row` 是 `data-dsh-prompt-row-role` 的前缀，直接用 indexOf 的话，
 * 即使前者被删掉，后者仍会让门禁误判为「还在」。右侧排除 [a-z0-9-] 即可精确判定
 * （打包后属性名后面跟的是引号 / 冒号，不会是这些字符）。
 */
function hookPresent(text, hook) {
  const safe = hook.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  try { return new RegExp(safe + '(?![a-z0-9-])').test(text) } catch (e) { return text.indexOf(hook) >= 0 }
}

/** 扫描构建产物文本：返回缺失的必需钩子与缺失的诊断标记（纯函数，selftest 直接复用）。 */
function scanArtifact(text) {
  const missingHooks = REQUIRED_HOOKS.filter((x) => !hookPresent(text, x.hook))
  const missingMarkers = DIAG_MARKERS.filter((m) => text.indexOf(m.s) < 0)
  return { missingHooks, missingMarkers }
}

/** 解析契约文档：只认五列表行（首列含反引号钩子名、第四列是稳定性）。 */
function parseContractDoc(text) {
  const stable = new Set()
  const debug = new Set()
  const problems = []
  const areas = new Set()
  let rowCount = 0
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim()
    if (!line.startsWith('|')) continue
    if (/^\|\s*:?-{2,}/.test(line)) continue // 分隔行
    const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((s) => s.trim())
    if (cells.length < 5) continue
    const hookCell = cells[0]
    const names = hookCell.match(HOOK_NAME_RE) || []
    if (names.length === 0) continue // 表头或非钩子行
    rowCount += 1
    const stability = cells[3]
    const isStable = stability.indexOf(STABILITY_STABLE) >= 0
    if (stability.indexOf(STABILITY_DEBUG) >= 0) { for (const n of names) debug.add(n); continue }
    if (!isStable) {
      problems.push('第 ' + rowCount + ' 个钩子表的稳定性列无法识别（应是「' + STABILITY_STABLE + '」或「' + STABILITY_DEBUG + '」）：' + line)
      continue
    }
    for (const n of names) {
      stable.add(n)
      if (cells[1]) areas.add(cells[1])
    }
  }
  if (rowCount === 0) problems.push('没有解析到任何五列钩子表行（文档格式漂移？）')
  const both = [...stable].filter((h) => debug.has(h))
  for (const h of both) problems.push('同一个钩子既标「可依赖」又标「仅调试用」：' + h)
  return { stable, debug, problems, rowCount }
}

/** 文档 ↔ 门禁双向交叉校验（纯函数）。 */
function crossCheck(docStable, required) {
  const issues = []
  const requiredSet = required instanceof Set ? required : new Set(required)
  for (const h of [...docStable].sort()) {
    if (!requiredSet.has(h)) issues.push('文档标「可依赖」但门禁清单没有：' + h)
  }
  for (const h of [...requiredSet].sort()) {
    if (!docStable.has(h)) issues.push('门禁要求但文档未标「可依赖」：' + h)
  }
  return issues
}

/** 正式检查：构建产物 + 契约文档。返回是否全绿（报告由调用方打）。 */
function runCheck() {
  const artifact = readText(ARTIFACT_REL)
  if (artifact === null) {
    REPORTER.fail('构建产物存在', ARTIFACT_REL + ' 不存在；先 npm run build（lib 是入库产物，见 docs/real/static-gate.md）')
    return false
  }
  REPORTER.pass('构建产物存在', ARTIFACT_REL + '（' + artifact.length + ' 字节）')
  const { missingHooks, missingMarkers } = scanArtifact(artifact)
  if (missingHooks.length === 0) {
    REPORTER.pass('必需钩子齐全', REQUIRED_HOOKS.length + ' 个全部出现在构建产物里')
  } else {
    REPORTER.fail('必需钩子齐全', '缺 ' + missingHooks.length + ' 个：' + missingHooks.map((x) => x.hook + '（' + x.area + '）').join('、'))
  }
  if (missingMarkers.length === 0) {
    REPORTER.pass('诊断开关标记齐全', DIAG_MARKERS.map((m) => m.s).join('、'))
  } else {
    REPORTER.fail('诊断开关标记齐全', '缺 ' + missingMarkers.length + ' 个：' + missingMarkers.map((m) => m.s + '（' + m.why + '）').join('、'))
  }

  const doc = readText(CONTRACT_DOC_REL)
  if (doc === null) {
    REPORTER.fail('契约文档存在', CONTRACT_DOC_REL + ' 不存在（钩子契约必须随代码一起改）')
    return false
  }
  REPORTER.pass('契约文档存在', CONTRACT_DOC_REL)
  const parsed = parseContractDoc(doc)
  if (parsed.problems.length === 0) {
    REPORTER.pass('契约文档可解析', parsed.rowCount + ' 行钩子登记，可依赖 ' + parsed.stable.size + ' / 仅调试用 ' + parsed.debug.size)
  } else {
    REPORTER.fail('契约文档可解析', parsed.problems.slice(0, 5).join('；') + (parsed.problems.length > 5 ? '（另有 ' + (parsed.problems.length - 5) + ' 条）' : ''))
  }
  if (parsed.stable.size > 0 && parsed.debug.size > 0) {
    REPORTER.info('稳定性分布', '可依赖 ' + parsed.stable.size + ' 个（门禁钉住）；仅调试用 ' + parsed.debug.size + ' 个（可改可删）')
  }
  const issues = crossCheck(parsed.stable, REQUIRED_SET)
  if (issues.length === 0) {
    REPORTER.pass('文档与门禁一致', '双向交叉校验：0 处漂移')
  } else {
    REPORTER.fail('文档与门禁一致', issues.slice(0, 8).join('；') + (issues.length > 8 ? '（另有 ' + (issues.length - 8) + ' 条）' : ''))
  }
  return REPORTER.fails === 0
}

/** 合成一份合法契约文档（selftest 用）：每个必需钩子一行「可依赖」。 */
function syntheticDoc(required, opts) {
  const o = opts || {}
  const lines = [
    '# 合成契约（selftest）',
    '',
    '契约版本：v1',
    '',
    '| 钩子属性 | 所在元素与区域 | 语义 | 稳定性 | 首次引入版本 |',
    '| --- | --- | --- | --- | --- |',
  ]
  for (const x of required) {
    lines.push('| `' + x.hook + '` | ' + (o.area || x.area || '合成') + ' | 合成语义 | ' + STABILITY_STABLE + ' | v1 |')
  }
  if (o.extraStable) lines.push('| `' + o.extraStable + '` | 合成 | 合成语义 | ' + STABILITY_STABLE + ' | v1 |')
  if (o.markDebugHook) lines.push('| `' + o.markDebugHook + '` | 合成 | 合成语义 | ' + STABILITY_DEBUG + ' | v1 |')
  if (o.unknownStabilityHook) lines.push('| `' + o.unknownStabilityHook + '` | 合成 | 合成语义 | 稳定 | v1 |')
  return lines.join('\n')
}

/** 生成一份「完整」的合成构建产物文本。 */
function syntheticArtifact(required, markers) {
  return required.map((x) => x.hook + ': "1"').join('\n') + '\n' + markers.map((m) => m.s).join('\n')
}

/** --selftest：证明门禁「能红」且归因准确；好样本必须全绿。 */
function runSelftest() {
  console.log('=== 插件测试钩子契约门禁自证（#190 --selftest）===')
  const markers = DIAG_MARKERS
  const goodArtifact = syntheticArtifact(REQUIRED_HOOKS, markers)

  // 1) 完整合成产物：全绿
  const goodScan = scanArtifact(goodArtifact)
  if (goodScan.missingHooks.length === 0 && goodScan.missingMarkers.length === 0) {
    REPORTER.pass('完整副本通过', '合成产物含 ' + REQUIRED_HOOKS.length + ' 个必需钩子 + ' + markers.length + ' 个诊断标记，0 缺失')
  } else {
    REPORTER.fail('完整副本通过', '合成产物出现意外缺失：' + JSON.stringify({ hooks: goodScan.missingHooks.map((x) => x.hook), markers: goodScan.missingMarkers.map((m) => m.s) }))
  }

  // 2) 删掉一个必需钩子 → 必须红，且只报这一个
  const victim = REQUIRED_HOOKS.find((x) => x.hook === 'data-dsh-prompt-row-preview') || REQUIRED_HOOKS[0]
  const badArtifact = goodArtifact.replace(victim.hook, 'data-dsh-prompt-wrong-name')
  const badScan = scanArtifact(badArtifact)
  const badNames = badScan.missingHooks.map((x) => x.hook)
  if (badNames.length === 1 && badNames[0] === victim.hook) {
    REPORTER.pass('删一个必需钩子必红且归因准确', '坏样本缺 ' + victim.hook + '（' + victim.area + '），其余 0 误报')
  } else {
    REPORTER.fail('删一个必需钩子必红且归因准确', '期望恰好缺 ' + victim.hook + '，实际缺：' + (badNames.join('、') || '无'))
  }

  // 3) 诊断标记缺失 → 必须红
  const noMarkerArtifact = syntheticArtifact(REQUIRED_HOOKS, [])
  const noMarkerScan = scanArtifact(noMarkerArtifact)
  if (noMarkerScan.missingMarkers.length === markers.length && noMarkerScan.missingHooks.length === 0) {
    REPORTER.pass('诊断标记缺失必红', '缺 ' + markers.map((m) => m.s).join('、'))
  } else {
    REPORTER.fail('诊断标记缺失必红', '期望 ' + markers.length + ' 个标记缺失，实际：' + JSON.stringify(noMarkerScan.missingMarkers.map((m) => m.s)))
  }

  // 4) 合法合成文档：解析无问题、与门禁一致
  const goodDocText = syntheticDoc(REQUIRED_HOOKS)
  const goodDoc = parseContractDoc(goodDocText)
  const goodCross = crossCheck(goodDoc.stable, REQUIRED_SET)
  if (goodDoc.problems.length === 0 && goodCross.length === 0) {
    REPORTER.pass('合法契约文档通过', goodDoc.rowCount + ' 行全部「可依赖」，与门禁双向一致')
  } else {
    REPORTER.fail('合法契约文档通过', JSON.stringify({ problems: goodDoc.problems.slice(0, 3), cross: goodCross.slice(0, 3) }))
  }

  // 5) 删掉多行，会显示在解析结果里
  const docRows = goodDocText.split('\n')
  const dropIdx = docRows.findIndex((ln) => ln.indexOf('`' + REQUIRED_HOOKS[0].hook + '`') >= 0)
  if (dropIdx >= 0) docRows.splice(dropIdx, 1)
  const droppedDoc = parseContractDoc(docRows.join('\n'))
  const droppedCross = crossCheck(droppedDoc.stable, REQUIRED_SET)
  if (droppedCross.some((s) => s.indexOf(REQUIRED_HOOKS[0].hook) >= 0)) {
    REPORTER.pass('文档缺一行必红', '删除 ' + REQUIRED_HOOKS[0].hook + ' 后交叉校验命中该钩子')
  } else {
    REPORTER.fail('文档缺一行必红', '删除 ' + REQUIRED_HOOKS[0].hook + ' 后交叉校验未命中：' + JSON.stringify(droppedCross.slice(0, 3)))
  }

  // 6) 文档多标一个「可依赖」而门禁没有 → 必须红
  const extraDoc = parseContractDoc(syntheticDoc(REQUIRED_HOOKS, { extraStable: 'data-dsh-prompt-selftest-extra' }))
  const extraCross = crossCheck(extraDoc.stable, REQUIRED_SET)
  if (extraCross.some((s) => s.indexOf('data-dsh-prompt-selftest-extra') >= 0)) {
    REPORTER.pass('文档多标可依赖必红', '文档吹了门禁没查的钩子会被点名')
  } else {
    REPORTER.fail('文档多标可依赖必红', '未命中多余钩子：' + JSON.stringify(extraCross.slice(0, 3)))
  }

  // 7) 稳定性列写错 → 解析必红
  const unknownDoc = parseContractDoc(syntheticDoc(REQUIRED_HOOKS, { unknownStabilityHook: 'data-dsh-prompt-selftest-unknown' }))
  if (unknownDoc.problems.length > 0) {
    REPORTER.pass('稳定性列非法必红', '出现非「可依赖 / 仅调试用」取值时解析报错')
  } else {
    REPORTER.fail('稳定性列非法必红', '未知稳定性取值未被拦截')
  }

  // 8) 真实产物临时副本：完整绿、删一个红；坏样本落在系统临时目录，不进仓内扫描路径
  const realArtifact = readText(ARTIFACT_REL)
  if (realArtifact === null) {
    REPORTER.info('真实产物临时副本', '跳过：' + ARTIFACT_REL + ' 不存在（完整副本用例由合成样本覆盖）')
  } else {
    let tmpDir = null
    try {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-prompt-hooks-selftest-'))
      const rel = path.relative(ROOT, tmpDir)
      if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
        throw new Error('临时目录落在仓库内：' + tmpDir)
      }
      const goodCopy = path.join(tmpDir, 'client.good.js')
      const badCopy = path.join(tmpDir, 'client.bad.js')
      fs.writeFileSync(goodCopy, realArtifact, 'utf8')
      fs.writeFileSync(badCopy, realArtifact.split(victim.hook).join('data-dsh-prompt-wrong-name'), 'utf8')
      const goodReal = scanArtifact(fs.readFileSync(goodCopy, 'utf8'))
      const badReal = scanArtifact(fs.readFileSync(badCopy, 'utf8'))
      const badRealNames = badReal.missingHooks.map((x) => x.hook)
      if (goodReal.missingHooks.length === 0 && goodReal.missingMarkers.length === 0) {
        REPORTER.pass('真实产物临时副本通过', '临时目录 ' + path.basename(tmpDir) + '（不在仓库内），0 缺失')
      } else {
        REPORTER.fail('真实产物临时副本通过', '真实产物缺：' + JSON.stringify({ hooks: goodReal.missingHooks.map((x) => x.hook), markers: goodReal.missingMarkers.map((m) => m.s) }))
      }
      if (badRealNames.length === 1 && badRealNames[0] === victim.hook) {
        REPORTER.pass('真实产物删一个必红', '临时副本删 ' + victim.hook + ' 后恰好报这一条')
      } else {
        REPORTER.fail('真实产物删一个必红', '期望恰好缺 ' + victim.hook + '，实际缺：' + (badRealNames.join('、') || '无'))
      }
    } catch (e) {
      REPORTER.fail('真实产物临时副本通过', '自证失败：' + (e && e.message ? e.message : String(e)))
    } finally {
      if (tmpDir) { try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch (e) { /* ignore */ } }
    }
  }

  // 9) 诊断产物标记目录自检：REQUIRED_HOOKS 无重复、无调试用混入
  const dup = REQUIRED_HOOKS.map((x) => x.hook).filter((h, i, arr) => arr.indexOf(h) !== i)
  if (dup.length === 0) {
    REPORTER.pass('必需清单自检', '无重复钩子、共 ' + REQUIRED_HOOKS.length + ' 个')
  } else {
    REPORTER.fail('必需清单自检', '重复：' + dup.join('、'))
  }

  REPORTER.finish()
}

const arg = process.argv[2]
if (arg === undefined) {
  runCheck()
  REPORTER.finish()
} else if (arg === '--selftest') {
  runSelftest()
} else if (arg === '--help' || arg === '-h') {
  console.log(USAGE)
  process.exit(0)
} else {
  console.error('未知参数：' + arg)
  console.error('')
  console.error(USAGE)
  process.exit(2)
}
