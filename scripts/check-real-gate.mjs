#!/usr/bin/env node
/**
 * 真机脚本静态门禁（#186）
 *
 * 为什么有这条：
 *   真机脚本比普通单测更容易把「我机器上能跑」写成事实 —— 目标 URL、端口、浏览器路径、
 *   宿主安装位置、用户主目录一旦硬编码，换机器就静默变成「环境问题」，而真机套件恰恰是
 *   换机器/换宿主版本时唯一的验收手段。自造一份 CDP 客户端则让同一套观测在两处漂移：
 *   harness 修了语义，脚本里那份没修，报告还说自己 PASS。
 *   这条门禁在静态层面拦住五类写法，让「可复跑」变成写脚本时就要满足的约束，而不是跑挂了再猜。
 *
 * 扫什么（只扫约定目录，对仓库外脚本零副作用、不写任何文件）：
 *   - scripts/real/**\/*.mjs       真机 kit（入口 run.mjs、harness/、suites/）
 *   - scripts/repro/real/**\/*.mjs 遗留 pilot（迁移前的历史入口）
 *   gate/ 自身（本扫描器夹具：样本、豁免表）不参与正式扫描，只在 --selftest 里被扫描。
 *
 * 五类规则（规则是数据，见 RULES；扫描器只负责读文件、剥注释、按 scope 跑检测器、应用豁免）：
 *   R1 目标入口必须是运行期输入，不得硬编码主机 / 端口 / token
 *   R2 必须产出机器可读 JSON 报告，并用可区分的退出码表达结论
 *   R3 失败 / 异常路径必须清理进程、端口与临时目录
 *   R4 禁止硬编码机器特定值（用户主目录、宿主安装位置、浏览器路径、locale）
 *   R5 必须使用仓内 vendored harness，不得复制 CDP 客户端等重复实现
 * 规则清单、适用范围、如何新增规则与例外：docs/real/static-gate.md。
 *
 * 用法：
 *   node scripts/check-real-gate.mjs             正式扫描（由 npm run check 调用）
 *   node scripts/check-real-gate.mjs --selftest  自证：坏样本被拒且归因准确、合法样本通过、豁免机制有效
 *
 * 输出：PASS / FAIL / INFO 行，最后一行是 `RESULT: N FAIL`；实现零依赖（只用 Node 内置）。
 * 退出码：0 = 全绿；1 = 有 FAIL；2 = 用法错误。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const GATE_DIR_REL = 'scripts/real/gate'
const SAMPLES_DIR_REL = GATE_DIR_REL + '/samples'
const EXPECTED_REL = SAMPLES_DIR_REL + '/expected.json'
const EXEMPTIONS_REL = GATE_DIR_REL + '/exemptions.json'

/** 正式扫描范围：只认这两个约定目录。 */
const SCAN_TARGETS = ['scripts/real', 'scripts/repro/real']
/** 扫描排除：gate/ 是门禁自己的夹具（样本、豁免表），不参与正式扫描。 */
const SCAN_EXCLUDES = [GATE_DIR_REL + '/']
/**
 * 入口脚本 = 直接 `node <脚本>` 执行、负责「接目标入口 / 出报告 / 定退出码 / 收尾」的那一层。
 * 其余文件（harness/、suites/）是运行库：参数由入口传进来，不自己接 argv，因此不适用 R1–R3。
 */
const ENTRY_PATTERNS = [/^scripts\/real\/[^/]+\.mjs$/, /^scripts\/repro\/real\/[^/]+\.mjs$/]
/** vendored harness 白名单：唯一允许出现 CDP 协议细节与机器探测逻辑的地方。 */
const HARNESS_PREFIX = 'scripts/real/harness/'
/** 遗留 pilot：自证「去掉豁免后会被拒」用；正式扫描里由 exemptions.json 放行。 */
const PILOT_REL = 'scripts/repro/real/issue-181-real.mjs'

/**
 * 规则 = 数据。每条规则：
 *   id/title     报告与文档里用的编号与一句话说明；
 *   scope        'entry' = 只查入口脚本；'nonHarness' = 查除 harness 白名单外的所有文件；
 *   exemptable   是否允许写进 exemptions.json（例外必须有理由 + 关联票）；
 *   checks       检测器列表，扫描器认识三种 kind：
 *                  forbid  { pattern }  在「剥注释、保留字符串」的可见文本里逐行匹配，出现即违规；
 *                  require { pattern }  在「剥注释、抹掉字符串内容」的纯代码文本里找，缺失即违规（记第 1 行）；
 *                  custom  { detect }   复杂判据（如退出码集合），返回 [{ line, message }]。
 * 新增规则：往 RULES 里加一条 → 在 samples/bad/ 放坏样本 → 在 samples/expected.json 登记预期
 * 规则与行号 → `--selftest` 必须转绿。详见 docs/real/static-gate.md。
 */
const RULES = [
  {
    id: 'R1',
    title: '目标入口必须是运行期输入，不得硬编码主机 / 端口 / token',
    scope: 'entry',
    exemptable: true,
    checks: [
      {
        kind: 'forbid',
        pattern: /https?:\/\/(?:127\.0\.0\.1|0\.0\.0\.0|localhost|\[::1\])(?::\d{2,5})?/,
        message: '硬编码主机：目标地址必须来自运行期输入（--url / 参数 / 环境变量）',
      },
      {
        kind: 'forbid',
        pattern: /(?:port\w*|\w*port)\s*[=:][^\n]*['"]\d{2,5}['"]/i,
        message: '硬编码端口：端口必须由运行期绑定给出（缺省 0 交给系统分配）',
      },
      {
        kind: 'forbid',
        pattern: /\btoken\s*[=:]\s*['"][^'"\n]{6,}['"]/,
        message: '硬编码 token：token 必须来自运行期输入',
      },
      {
        kind: 'forbid',
        pattern: /[?&]token=[A-Za-z0-9._-]{6,}/,
        message: '硬编码 token：token 必须来自运行期输入',
      },
      {
        kind: 'require',
        pattern: /process\.argv|process\.env|resolveBindings\s*\(/,
        message: '没有接收任何运行期输入（process.argv / process.env / resolveBindings）—— 目标入口只能硬编码',
      },
    ],
  },
  {
    id: 'R2',
    title: '必须产出机器可读 JSON 报告，并用可区分的退出码表达结论',
    scope: 'entry',
    exemptable: true,
    checks: [
      {
        kind: 'require',
        pattern: /writeReport\s*\(/,
        message: '没有写 JSON 报告：入口脚本必须调用 harness/evidence.mjs 的 writeReport（报告是判定的一部分）',
      },
      { kind: 'custom', detect: detectExitCodes },
    ],
  },
  {
    id: 'R3',
    title: '失败 / 异常路径必须清理进程、端口与临时目录',
    scope: 'entry',
    exemptable: true,
    checks: [
      {
        kind: 'require',
        pattern: /finally\s*\{/,
        message: '没有 finally 兜底块：成功与异常路径都必须走收尾',
      },
      {
        kind: 'require',
        pattern: /\.close\s*\(|\.stop\s*\(|\.kill\s*\(|killTree|rmSync|rmdirSync|unlinkSync|waitForPortFree|isPortFree/,
        message: '没有清理调用（close / stop / kill / rmSync / waitForPortFree…）：进程、端口、临时目录必须回收',
      },
    ],
  },
  {
    id: 'R4',
    title: '禁止硬编码机器特定值（用户主目录、宿主安装位置、浏览器路径、locale）',
    scope: 'nonHarness',
    exemptable: true,
    checks: [
      {
        kind: 'forbid',
        pattern: /(['"`])[A-Za-z]:[\\/][^'"`\n]*\1/,
        message: '绝对 Windows 路径字面量：用户主目录 / 宿主安装位置 / 证据目录都只能是运行期参数',
      },
      {
        kind: 'forbid',
        pattern: /(['"`])(?:~\/|\/home\/[^/'"`\s]+|\/Users\/[^/'"`\s]+)/,
        message: 'POSIX 主目录字面量：改由运行期参数传入',
      },
      {
        kind: 'forbid',
        pattern: /(['"`])[^'"`\n]*(?:DeepseekHarness|AppData[\\/]|Program Files)/i,
        message: '宿主 / 浏览器安装位置字面量：只能通过运行期探测或参数得到',
      },
      {
        kind: 'forbid',
        pattern: /(['"`])[^'"`\n]*(?:msedge\.exe|chrome\.exe|chromium(?:-browser)?)/i,
        message: '浏览器可执行文件字面量：只能通过运行期探测或 --browser 得到',
      },
      {
        kind: 'forbid',
        pattern: /(['"`])(?:zh-CN|zh_CN|en-US|en_US|zh-Hans|zh-Hant)\1/,
        message: '硬编码 locale：locale 必须来自运行期环境',
      },
    ],
  },
  {
    id: 'R5',
    title: '必须使用仓内 vendored harness，不得复制 CDP 客户端等重复实现',
    scope: 'nonHarness',
    exemptable: true,
    checks: [
      {
        kind: 'forbid',
        pattern: /new\s+WebSocket\s*\(/,
        message: '自建 WebSocket：改用 harness/cdp.mjs 的 connect()',
      },
      {
        kind: 'forbid',
        pattern: /webSocketDebuggerUrl/,
        message: '直接消费 CDP target 描述：改用 harness 的连接层',
      },
      {
        kind: 'forbid',
        pattern: /\/json\/(?:list|version|new|activate|close)/,
        message: '直连 DevTools 调试端点：改用 harness/browser.mjs / harness/cdp.mjs',
      },
      {
        kind: 'forbid',
        pattern:
          /\b(?:Page|Runtime|Input|Log|Network)\.(?:evaluate|navigate|captureScreenshot|dispatchMouseEvent|insertText|dispatchKeyEvent|enable|addScriptToEvaluateOnNewDocument)\b/,
        message: '自己拼 CDP 协议方法：改用 harness/cdp.mjs 导出的操作',
      },
    ],
  },
]

const RULE_BY_ID = new Map(RULES.map((rule) => [rule.id, rule]))
const KNOWN_RULE_IDS = [...RULE_BY_ID.keys()]
const USAGE = [
  '用法: node scripts/check-real-gate.mjs [--selftest]',
  '',
  '  缺省        正式扫描 ' + SCAN_TARGETS.join(' 与 ') + ' 下的真机脚本',
  '  --selftest  自证门禁：坏样本必须被拒（并指出规则与行号）、合法样本必须通过、',
  '              遗留 pilot 去掉豁免后必须被拒',
  '  --help      打印本帮助',
].join('\n')

/* ─────────────────────────── 复杂判据（custom 检测器） ─────────────────────────── */

/**
 * R2 的退出码判据：进程退出码要能区分成功与失败/阻塞。
 * 认 process.exit(<n>) 与 process.exitCode = <n>；参数里的整数字面量都算（如三元 ? 0 : 2）。
 */
function detectExitCodes({ visible }) {
  const codes = new Set()
  let firstLine = 0
  visible.split('\n').forEach((line, index) => {
    const exitCall = line.match(/process\.exit\s*\(([^)]*)\)/)
    if (exitCall) {
      if (!firstLine) firstLine = index + 1
      for (const digits of exitCall[1].matchAll(/\b(\d+)\b/g)) codes.add(Number(digits[1]))
    }
    const exitCode = line.match(/process\.exitCode\s*=\s*(\d+)/)
    if (exitCode) {
      if (!firstLine) firstLine = index + 1
      codes.add(Number(exitCode[1]))
    }
  })
  if (codes.size === 0) {
    return [{ line: 1, message: '没有设置退出码（process.exit / process.exitCode）：无法区分 PASS / FAIL / BLOCKED' }]
  }
  const sorted = [...codes].sort((a, b) => a - b)
  const hasZero = codes.has(0)
  const hasNonZero = sorted.some((code) => code !== 0)
  if (hasZero && hasNonZero) return []
  return [
    {
      line: firstLine || 1,
      message: '退出码不可区分：只出现 ' + sorted.join(' / ') + '；需要 0（成功）与非 0（失败/阻塞）至少各一个',
    },
  ]
}

/* ─────────────────────────── 文本预处理：剥注释、抹字符串 ─────────────────────────── */

/**
 * 剥掉注释（换成空格，换行保留），字符串原样保留。
 * 规则只看代码；头注里写「以前硬编码过 C:\...」这种说明不该判红。
 * 字符串保留是因为 R4 要查字符串里的机器路径、R5 的协议名常写成字符串。
 */
function stripComments(source) {
  let out = ''
  let mode = 'code'
  let i = 0
  while (i < source.length) {
    const ch = source[i]
    const next = source[i + 1]
    if (mode === 'code') {
      if (ch === '/' && next === '/') {
        mode = 'line'
        out += '  '
        i += 2
        continue
      }
      if (ch === '/' && next === '*') {
        mode = 'block'
        out += '  '
        i += 2
        continue
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        mode = ch === "'" ? 'single' : ch === '"' ? 'double' : 'template'
        out += ch
        i += 1
        continue
      }
      out += ch
      i += 1
      continue
    }
    if (mode === 'line') {
      if (ch === '\n') {
        mode = 'code'
        out += '\n'
      } else {
        out += ' '
      }
      i += 1
      continue
    }
    if (mode === 'block') {
      if (ch === '*' && next === '/') {
        mode = 'code'
        out += '  '
        i += 2
        continue
      }
      out += ch === '\n' ? '\n' : ' '
      i += 1
      continue
    }
    // 字符串内部：原样保留，转义对一起保留（行号不受影响）
    out += ch
    i += 1
    if (ch === '\\' && i < source.length) {
      out += source[i]
      i += 1
      continue
    }
    const quote = mode === 'single' ? "'" : mode === 'double' ? '"' : '`'
    if (ch === quote) mode = 'code'
  }
  return out
}

/** 把字符串内容抹成空格（引号保留、换行保留）：require 类判据只看代码，避免「字符串里提了一嘴」就算数。 */
function blankStrings(visible) {
  let out = ''
  let mode = 'code'
  for (let i = 0; i < visible.length; i += 1) {
    const ch = visible[i]
    if (mode === 'code') {
      if (ch === "'" || ch === '"' || ch === '`') {
        mode = ch === "'" ? 'single' : ch === '"' ? 'double' : 'template'
        out += ch
        continue
      }
      out += ch
      continue
    }
    if (ch === '\\') {
      const escaped = visible[i + 1]
      out += escaped === '\n' ? ' \n' : '  '
      i += 1
      continue
    }
    const quote = mode === 'single' ? "'" : mode === 'double' ? '"' : '`'
    if (ch === quote) {
      mode = 'code'
      out += ch
      continue
    }
    out += ch === '\n' ? '\n' : ' '
  }
  return out
}

/** 一次预处理出两份对齐的文本（行号都与源文件一致）。 */
function prepareSource(source) {
  const visible = stripComments(source)
  return { visible, codeOnly: blankStrings(visible) }
}

/* ─────────────────────────── 扫描器（与规则无关） ─────────────────────────── */

/** 归一化相对路径：统一正斜杠、去掉 ./ 前缀。 */
function normalizeRel(filePath) {
  return String(filePath).replace(/\\/g, '/').replace(/^\.\//, '')
}

/**
 * 判定文件属于哪一层：
 *   entry   入口脚本（R1–R3 只查这一层）
 *   harness vendored harness 白名单（R4/R5 豁免）
 * selftest 扫样本时用 forceEntry 把样本当入口脚本。
 */
function classify(relPath, { forceEntry = false } = {}) {
  const p = normalizeRel(relPath)
  return {
    entry: forceEntry || ENTRY_PATTERNS.some((pattern) => pattern.test(p)),
    harness: p.startsWith(HARNESS_PREFIX),
  }
}

function ruleApplies(rule, scope) {
  if (rule.scope === 'entry') return scope.entry && !scope.harness
  if (rule.scope === 'nonHarness') return !scope.harness
  return true
}

/** 同规则同一行合并成一条：一行里同时命中「主机」与「token」时报一条，消息拼接，行号不重复刷屏。 */
function mergeViolations(violations) {
  const byKey = new Map()
  for (const violation of violations) {
    const key = violation.rule + ':' + violation.line
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, { ...violation, messages: [...violation.messages] })
      continue
    }
    for (const message of violation.messages) {
      if (!existing.messages.includes(message)) existing.messages.push(message)
    }
  }
  return [...byKey.values()].sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule))
}

/** 跑一条规则的全部检测器。 */
function runRuleChecks(rule, view, sourceLines) {
  const violations = []
  const visibleLines = view.visible.split('\n')
  for (const check of rule.checks) {
    if (check.kind === 'forbid') {
      visibleLines.forEach((line, index) => {
        const match = line.match(check.pattern)
        if (!match) return
        violations.push({
          rule: rule.id,
          line: index + 1,
          messages: [check.message + '（命中：' + match[0].trim().slice(0, 80) + '）'],
          snippet: (sourceLines[index] || '').trim().slice(0, 120),
        })
      })
    } else if (check.kind === 'require') {
      if (!check.pattern.test(view.codeOnly)) {
        violations.push({ rule: rule.id, line: 1, messages: [check.message], snippet: '' })
      }
    } else if (check.kind === 'custom') {
      for (const hit of check.detect(view) || []) {
        violations.push({
          rule: rule.id,
          line: hit.line,
          messages: [hit.message],
          snippet: (sourceLines[hit.line - 1] || '').trim().slice(0, 120),
        })
      }
    }
  }
  return violations
}

/** 扫描一个文件，返回违规列表（每条带 file / rule / line / messages / snippet）。 */
function scanFile(absPath, relPath, options = {}) {
  const source = fs.readFileSync(absPath, 'utf8')
  const view = prepareSource(source)
  const scope = classify(relPath, options)
  const sourceLines = source.split('\n')
  const violations = []
  for (const rule of RULES) {
    if (!ruleApplies(rule, scope)) continue
    for (const violation of runRuleChecks(rule, view, sourceLines)) {
      violations.push({ ...violation, file: normalizeRel(relPath) })
    }
  }
  return mergeViolations(violations)
}

/* ─────────────────────────── 文件枚举 ─────────────────────────── */

function walkMjs(absDir, out) {
  for (const dirent of fs.readdirSync(absDir, { withFileTypes: true })) {
    const abs = path.join(absDir, dirent.name)
    if (dirent.isDirectory()) {
      walkMjs(abs, out)
    } else if (dirent.name.endsWith('.mjs')) {
      out.push(normalizeRel(path.relative(ROOT, abs)))
    }
  }
  return out
}

/** 正式扫描的文件清单（只扫约定目录，排除 gate/ 夹具）。 */
function collectFormalFiles() {
  const files = []
  for (const target of SCAN_TARGETS) {
    const abs = path.join(ROOT, target)
    if (fs.existsSync(abs)) walkMjs(abs, files)
  }
  return files
    .filter((rel) => !SCAN_EXCLUDES.some((excluded) => rel.startsWith(excluded)))
    .sort()
}

/** 某路径是否在正式扫描范围内（用于校验豁免条目是否有意义）。 */
function isScanned(relPath) {
  const p = normalizeRel(relPath)
  if (!p.endsWith('.mjs')) return false
  if (SCAN_EXCLUDES.some((excluded) => p.startsWith(excluded))) return false
  return SCAN_TARGETS.some((target) => p === target || p.startsWith(target + '/'))
}

/* ─────────────────────────── 例外机制 ─────────────────────────── */

function readJsonOrNull(absPath) {
  try {
    return JSON.parse(fs.readFileSync(absPath, 'utf8'))
  } catch {
    return null
  }
}

/**
 * 读例外表并校验结构。例外不是隐身衣：每条必须有 path / rules / reason / issue，
 * 规则 id 必须存在、文件必须在扫描范围内且真的存在（文件迁走后要同步删条目，否则判红）。
 */
function loadExemptions() {
  const absPath = path.join(ROOT, EXEMPTIONS_REL)
  if (!fs.existsSync(absPath)) return { entries: [], errors: [] }
  const raw = readJsonOrNull(absPath)
  if (raw === null) {
    return { entries: [], errors: [EXEMPTIONS_REL + ' 不是合法 JSON —— 例外表必须能被机器读取'] }
  }
  const list = Array.isArray(raw) ? raw : Array.isArray(raw.exemptions) ? raw.exemptions : null
  if (!list) return { entries: [], errors: [EXEMPTIONS_REL + ' 结构不对：应为数组，或 { "exemptions": [...] }'] }
  const errors = []
  const entries = []
  list.forEach((item, index) => {
    const where = EXEMPTIONS_REL + ' 第 ' + (index + 1) + ' 条'
    const relPath = normalizeRel(item && item.path ? item.path : '')
    const rules = Array.isArray(item && item.rules) ? item.rules.map(String) : item && item.rule ? [String(item.rule)] : []
    if (!relPath) errors.push(where + '：缺 path')
    if (rules.length === 0) errors.push(where + '：缺 rule / rules')
    const unknownRules = rules.filter((ruleId) => ruleId !== '*' && !RULE_BY_ID.has(ruleId))
    if (unknownRules.length) {
      errors.push(where + '：未知规则 id ' + unknownRules.join(', ') + '（可用：' + KNOWN_RULE_IDS.join(', ') + '）')
    }
    for (const ruleId of rules) {
      const rule = RULE_BY_ID.get(ruleId)
      if (rule && rule.exemptable === false) errors.push(where + '：' + ruleId + ' 不允许豁免')
    }
    const reason = String((item && item.reason) || '').trim()
    const issue = String((item && item.issue) || '').trim()
    if (!reason) errors.push(where + '：缺 reason（为什么允许这条例外）')
    if (!issue) errors.push(where + '：缺 issue（关联票号或链接）')
    if (relPath && !fs.existsSync(path.join(ROOT, relPath))) {
      errors.push(where + '：文件不存在 ' + relPath + ' —— 文件迁移/删除后请同步删除本条豁免（关联 ' + (issue || '?') + '）')
    }
    if (relPath && fs.existsSync(path.join(ROOT, relPath)) && !isScanned(relPath)) {
      errors.push(where + '：' + relPath + ' 不在扫描范围内，该豁免永远匹配不到')
    }
    entries.push({ path: relPath, rules, reason, issue, index: index + 1 })
  })
  return { entries, errors }
}

/** 某条违规是否被例外表放行。 */
function exemptionFor(violation, entries) {
  const rule = RULE_BY_ID.get(violation.rule)
  if (!rule || rule.exemptable === false) return null
  return (
    entries.find(
      (entry) => entry.path === violation.file && (entry.rules.includes('*') || entry.rules.includes(violation.rule)),
    ) || null
  )
}

/** 应用例外表，返回 remaining 与每条豁免实际挡下的数量。 */
function applyExemptions(violations, entries) {
  const used = new Map()
  const remaining = []
  for (const violation of violations) {
    const entry = exemptionFor(violation, entries)
    if (!entry) {
      remaining.push(violation)
      continue
    }
    used.set(entry, (used.get(entry) || 0) + 1)
  }
  return { remaining, used }
}

/* ─────────────────────────── 报告 ─────────────────────────── */

const REPORTER = (() => {
  let fails = 0
  return {
    pass(name, detail = '') {
      console.log('PASS: ' + name + (detail ? ' — ' + detail : ''))
    },
    info(name, detail = '') {
      console.log('INFO: ' + name + (detail ? ' — ' + detail : ''))
    },
    fail(name, detail = '') {
      fails += 1
      console.log('FAIL: ' + name + (detail ? ' — ' + detail : ''))
    },
    get fails() {
      return fails
    },
  }
})()

/** 把一条违规渲染成 FAIL 行：文件名与行号在最前面，方便直接跳转。 */
function reportViolation(violation) {
  const snippet = violation.snippet ? '（行内容：' + violation.snippet + '）' : ''
  REPORTER.fail(
    violation.rule + ' ' + violation.file + ':' + violation.line,
    violation.messages.join('；') + snippet,
  )
}

function finish() {
  console.log('')
  console.log('RESULT: ' + REPORTER.fails + ' FAIL')
  process.exit(REPORTER.fails === 0 ? 0 : 1)
}

/* ─────────────────────────── 正式扫描 ─────────────────────────── */

function runScan() {
  console.log('=== 真机脚本静态门禁（#186）===')
  console.log('规则：' + RULES.map((rule) => rule.id + ' ' + rule.title).join(' / '))
  console.log('扫描：' + SCAN_TARGETS.join(', ') + '（排除 ' + SCAN_EXCLUDES.join(', ') + '）')

  const exemptions = loadExemptions()
  for (const error of exemptions.errors) REPORTER.fail('例外表', error)
  if (exemptions.errors.length === 0) {
    REPORTER.info(
      '例外表',
      exemptions.entries.length === 0 ? '无例外' : exemptions.entries.length + ' 条（' + EXEMPTIONS_REL + '）',
    )
  }

  const files = collectFormalFiles()
  const scopes = files.map((rel) => ({ rel, scope: classify(rel) }))
  const entryCount = scopes.filter((item) => item.scope.entry).length
  const harnessCount = scopes.filter((item) => item.scope.harness).length
  const otherCount = files.length - entryCount - harnessCount
  if (files.length === 0 || entryCount === 0) {
    REPORTER.fail('扫描范围', '扫到 ' + files.length + ' 个文件、其中入口脚本 ' + entryCount + ' 个 —— 约定目录被移动了？')
  } else {
    REPORTER.pass(
      '扫描范围',
      files.length + ' 个文件（入口 ' + entryCount + ' / harness ' + harnessCount + ' / 套件等其他 ' + otherCount + '）',
    )
  }

  const violations = []
  for (const { rel } of scopes) violations.push(...scanFile(path.join(ROOT, rel), rel))
  const { remaining, used } = applyExemptions(violations, exemptions.entries)

  for (const entry of exemptions.entries) {
    const count = used.get(entry) || 0
    if (count > 0) {
      REPORTER.info(
        '豁免生效',
        entry.path + ' → ' + entry.rules.join(',') + '（挡下 ' + count + ' 处；理由：' + entry.reason + '；关联 ' + entry.issue + '）',
      )
    } else {
      REPORTER.info('豁免未生效', entry.path + ' → ' + entry.rules.join(',') + '（当前无违规；若已修复请删除本条豁免）')
    }
  }

  for (const rule of RULES) {
    const applicable = scopes.filter((item) => ruleApplies(rule, item.scope)).length
    const hits = remaining.filter((violation) => violation.rule === rule.id)
    if (hits.length === 0) {
      REPORTER.pass(rule.id + ' ' + rule.title, '0 违规（检查 ' + applicable + ' 个文件）')
      continue
    }
    for (const hit of hits) reportViolation(hit)
  }

  finish()
}

/* ─────────────────────────── 自证（--selftest） ─────────────────────────── */

/** 自证：坏样本必须被拒且归因到预期规则与行号；合法样本必须通过；豁免机制必须真的有用。 */
function runSelftest() {
  console.log('=== 真机脚本静态门禁自证（#186 --selftest）===')

  const expectedAbs = path.join(ROOT, EXPECTED_REL)
  if (!fs.existsSync(expectedAbs)) {
    REPORTER.fail('样本清单', EXPECTED_REL + ' 不存在 —— 没有坏样本就没有自证')
    return finish()
  }
  const expected = readJsonOrNull(expectedAbs)
  if (!expected || !Array.isArray(expected.bad) || !Array.isArray(expected.good)) {
    REPORTER.fail('样本清单', EXPECTED_REL + ' 结构不对：需要 bad[] 与 good[]')
    return finish()
  }

  const badSamples = expected.bad
  const coveredRules = new Set(badSamples.map((sample) => sample.rule))
  const uncovered = KNOWN_RULE_IDS.filter((ruleId) => !coveredRules.has(ruleId))
  if (uncovered.length === 0) {
    REPORTER.pass('五类规则都有坏样本', KNOWN_RULE_IDS.join(' / ') + ' 全覆盖')
  } else {
    REPORTER.fail('五类规则都有坏样本', '缺坏样本的规则：' + uncovered.join(', '))
  }

  // 1. 每个坏样本：实际命中必须与 expected 完全一致（规则 + 行号），且不串到别的规则。
  for (const sample of badSamples) {
    if (!sample || typeof sample.file !== 'string' || !Array.isArray(sample.expected)) {
      REPORTER.fail('坏样本清单', '条目结构不对：需要 file 与 expected[]')
      continue
    }
    const rel = normalizeRel(SAMPLES_DIR_REL + '/' + sample.file)
    const abs = path.join(ROOT, rel)
    const label = sample.file + '：' + String(sample.case || sample.rule || '')
    if (!fs.existsSync(abs)) {
      REPORTER.fail('坏样本存在 ' + label, '文件缺失：' + rel)
      continue
    }
    const actual = scanFile(abs, rel, { forceEntry: true })
    const pairs = (items) => items.map((item) => item.rule + '@' + item.line)
    const actualPairs = new Set(pairs(actual))
    const expectedPairs = new Set(pairs(sample.expected))
    const missing = [...expectedPairs].filter((pair) => !actualPairs.has(pair))
    const extra = [...actualPairs].filter((pair) => !expectedPairs.has(pair))
    const otherRules = [...new Set(actual.map((item) => item.rule))].filter((ruleId) => ruleId !== sample.rule)
    if (missing.length || extra.length || otherRules.length) {
      const detail =
        '预期 ' + [...expectedPairs].join(', ') +
        '；实际 ' + (actualPairs.size ? [...actualPairs].join(', ') : '无') +
        (missing.length ? '；漏报 ' + missing.join(', ') : '') +
        (extra.length ? '；多报 ' + extra.join(', ') : '') +
        (otherRules.length ? '；串到其他规则 ' + otherRules.join(', ') : '')
      REPORTER.fail('坏样本被拒且归因准确 ' + label, detail)
    } else {
      REPORTER.pass('坏样本被拒且归因准确 ' + label, '命中 ' + [...actualPairs].join(', '))
    }
  }

  // 2. 合法样本：必须零违规（门禁只拦坏写法，不误伤合规入口）。
  for (const sample of expected.good) {
    if (!sample || typeof sample.file !== 'string') {
      REPORTER.fail('合法样本清单', '条目结构不对：需要 file')
      continue
    }
    const rel = normalizeRel(SAMPLES_DIR_REL + '/' + sample.file)
    const abs = path.join(ROOT, rel)
    if (!fs.existsSync(abs)) {
      REPORTER.fail('合法样本存在 ' + sample.file, '文件缺失：' + rel)
      continue
    }
    const actual = scanFile(abs, rel, { forceEntry: true })
    if (actual.length === 0) {
      REPORTER.pass('合法样本通过 ' + sample.file, '0 违规（' + String(sample.note || '') + '）')
    } else {
      REPORTER.fail(
        '合法样本通过 ' + sample.file,
        '不该有违规，实际：' +
          actual
            .map((violation) => violation.rule + '@' + violation.line + ' ' + violation.messages.join('；'))
            .join(' | '),
      )
    }
  }

  // 3. 例外表结构校验（正式扫描同款校验）。
  const exemptions = loadExemptions()
  if (exemptions.errors.length === 0) {
    REPORTER.pass('例外表校验', exemptions.entries.length + ' 条，结构齐全（path / rules / reason / issue）')
  } else {
    for (const error of exemptions.errors) REPORTER.fail('例外表校验', error)
  }

  // 4. vendored harness 白名单：harness 里的 CDP 协议细节不被误判。
  const harnessFile = path.join(ROOT, HARNESS_PREFIX + 'cdp.mjs')
  if (fs.existsSync(harnessFile)) {
    const actual = scanFile(harnessFile, HARNESS_PREFIX + 'cdp.mjs')
    if (actual.length === 0) {
      REPORTER.pass('harness 白名单', 'scripts/real/harness/cdp.mjs 不被 R4/R5 误判（白名单只放行 harness 层）')
    } else {
      REPORTER.fail('harness 白名单', 'harness 文件被误判：' + actual.map((violation) => violation.rule + '@' + violation.line).join(', '))
    }
  }

  // 5. 遗留 pilot：同一份文件，去掉豁免必须被拒、加上豁免必须放行 —— 证明例外机制真的在起作用。
  const pilotAbs = path.join(ROOT, PILOT_REL)
  if (!fs.existsSync(pilotAbs)) {
    REPORTER.info('遗留 pilot', PILOT_REL + ' 不存在（#192 迁移后？）—— 记得同步删除 ' + EXEMPTIONS_REL + ' 里对应豁免')
  } else {
    const withoutExemptions = scanFile(pilotAbs, PILOT_REL)
    const withExemptions = applyExemptions(withoutExemptions, exemptions.entries).remaining
    if (withoutExemptions.length > 0) {
      REPORTER.pass(
        '去掉豁免后 pilot 被拒',
        '命中 ' + withoutExemptions.map((violation) => violation.rule + '@' + violation.line).join(', '),
      )
    } else {
      REPORTER.fail('去掉豁免后 pilot 被拒', 'pilot 没有任何违规 —— 规则或样本退化了？')
    }
    if (withExemptions.length === 0) {
      REPORTER.pass('豁免挡下 pilot 全部违规', '剩余 0 处（豁免理由与关联票在 ' + EXEMPTIONS_REL + '）')
    } else {
      REPORTER.fail(
        '豁免挡下 pilot 全部违规',
        '仍有 ' + withExemptions.length + ' 处未覆盖：' +
          withExemptions.map((violation) => violation.rule + '@' + violation.line).join(', '),
      )
    }
  }

  // 6. 夹具隔离：gate/ 与门禁脚本自己不能出现在正式扫描里（否则坏样本会被当真实脚本扫）。
  const formal = collectFormalFiles()
  const leaked = formal.filter((rel) => rel.startsWith(GATE_DIR_REL + '/') || rel === 'scripts/check-real-gate.mjs')
  if (leaked.length === 0) {
    REPORTER.pass('夹具不参与正式扫描', '正式扫描 ' + formal.length + ' 个文件，不含 ' + GATE_DIR_REL + '/')
  } else {
    REPORTER.fail('夹具不参与正式扫描', '漏进正式扫描：' + leaked.join(', '))
  }

  finish()
}

/* ─────────────────────────── 入口 ─────────────────────────── */

const arg = process.argv[2]
if (arg === undefined) {
  runScan()
} else if (arg === '--selftest') {
  runSelftest()
} else if (arg === '--help' || arg === '-h') {
  console.log(USAGE)
  process.exit(0)
} else {
  console.error('未知参数：' + arg)
  console.error(USAGE)
  process.exit(2)
}
