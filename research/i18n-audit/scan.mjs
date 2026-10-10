#!/usr/bin/env node
/**
 * dsh-prompt — 审计分类 #135：CJK 字面量扫描器
 *
 * 用途：遍历 src 下全部 .ts，用 TypeScript 编译器 API 取出**所有含 CJK 的
 *      字符串字面量 / 模板字面量**（注释与标识符天然不在 AST 字面量里，故不算），
 *      再套用本文件底部的归类规则表（RULES），产出 research/i18n-audit/cjk-literals.csv。
 *
 * 用法：
 *   node research/i18n-audit/scan.mjs           # 写 CSV（有条目未归类则 exit 1）
 *   node research/i18n-audit/scan.mjs --dump    # 只打印检出结果，不归类、不写文件
 *
 * CJK 判定范围：
 *   U+3000–303F CJK 标点、U+3400–4DBF 扩展 A、U+4E00–9FFF 基本区、
 *   U+F900–FAFF 兼容汉字、U+FF00–FFEF 全角/半角 CJK 形式。
 *   注：'·'(U+00B7)、'…'(U+2026)、'→'(U+2192) 等非 CJK 符号本身不触发，
 *   但同串内的汉字会触发，故不会漏。
 *
 * 归类口径见同目录 classification.md（C1 铬 / C2 身份键 / C3 内容资产 / C4 非界面）。
 * 规则按顺序匹配，先命中者胜；任何一行没命中规则 → 打印出来并 exit 1（不许漏）。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve, sep } from 'node:path'
import ts from 'typescript'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')
const SRC = join(REPO, 'src')
const OUT = join(HERE, 'cjk-literals.csv')

const CJK_RE = /[\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/

/** 字面量原文（模板串用 ${…} 还原占位） */
function literalText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isTemplateExpression(node)) {
    let s = node.head.text
    for (const span of node.templateSpans) {
      s += '${' + span.expression.getText() + '}' + span.literal.text
    }
    return s
  }
  return node.getText()
}

/** 属性/变量路径：把字面量所在的属性名与变量名串成 a.b.c（定位 STR 的 key.zh / key.en 等） */
function propPath(node) {
  const parts = []
  let cur = node
  while (cur) {
    const p = cur.parent
    if (!p) break
    if (ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) {
      parts.unshift(p.name.text)
    } else if (ts.isArrayLiteralExpression(p)) {
      parts.unshift('[' + p.elements.indexOf(cur) + ']')
    } else if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) {
      parts.unshift(p.name.text)
    } else if (ts.isObjectLiteralExpression(p) || ts.isParenthesizedExpression(p)) {
      // 继续上溯
    } else {
      break
    }
    cur = p
  }
  return parts.join('.').replace(/\.\[/g, '[')
}

/** 所在函数名 / 最近导出名 */
function containerOf(node) {
  let fn = ''
  let exp = ''
  let cur = node
  while (cur) {
    const p = cur.parent
    if (!p) break
    if (!fn) {
      if (ts.isFunctionDeclaration(p) && p.name) fn = p.name.text
      else if (ts.isMethodDeclaration(p) && p.name) fn = p.name.getText()
      else if (ts.isArrowFunction(p) || ts.isFunctionExpression(p)) {
        const gp = p.parent
        if (gp && ts.isVariableDeclaration(gp) && ts.isIdentifier(gp.name)) fn = gp.name.text + '()'
        else if (gp && ts.isPropertyAssignment(gp)) fn = gp.name.getText() + '()'
        else fn = '<anon>()'
      } else if (ts.isClassDeclaration(p) && p.name) fn = p.name.text + '#' + (fn || '<field>')
    }
    if (!exp) {
      if (ts.isVariableStatement(p) && p.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        const d = p.declarationList.declarations[0]
        if (d && ts.isIdentifier(d.name)) exp = 'export const ' + d.name.text
      } else if (ts.isFunctionDeclaration(p) && p.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) && p.name) {
        exp = 'export function ' + p.name.text
      } else if (ts.isClassDeclaration(p) && p.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) && p.name) {
        exp = 'export class ' + p.name.text
      }
    }
    cur = p
  }
  return { fn, exp }
}

function scan() {
  const rows = []
  for (const file of ts.sys.readDirectory(SRC, ['.ts'], undefined, undefined).sort()) {
    const text = readFileSync(file, 'utf8')
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const visit = (node) => {
      let hit = null
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
        const raw = literalText(node)
        if (CJK_RE.test(raw)) hit = raw
      }
      if (hit !== null) {
        const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf))
        const { fn, exp } = containerOf(node)
        const path = propPath(node)
        rows.push({
          file: relative(REPO, file).split(sep).join('/'),
          line: pos.line + 1,
          col: pos.character + 1,
          text: hit,
          container: [exp, path, fn].filter(Boolean).join(' :: ') || '-',
        })
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }
  return rows.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line || a.col - b.col))
}

// ───────────────────────── 归类规则表（#135 审计结论） ─────────────────────────
// 字段：file 精确匹配；path 为 container 子串；text 为字面量精确匹配；三者都可省略（省略=通配）。
// 顺序敏感：先命中者胜。改动 src 后若出现未命中行，脚本会 exit 1 逼你补规则。
const RULES = [
  // —— i18n.ts：字典本身（唯一 seam），zh 值即 C1 目的地；en 值必须零 CJK ——
  // #141 收口：铬字面量已全数迁入本字典（panel/settings/smart/remoteInputSheet 的散落串清零），
  // 字典里那条唯一含 CJK 的 en 值（labelReserved）已随「砍保留词拒绝」删除。
  { file: 'src/client/i18n.ts', pathEnd: '.zh', cls: 'C1', action: '已在STR', consumer: '-' },

  // —— 内容资产（本图 Out of scope） ——
  { file: 'src/client/templates.ts', cls: 'C3', action: '不动(内容资产)', consumer: '-' },
  { file: 'src/client/words.ts', cls: 'C3', action: '不动(内容资产)', consumer: '-' },
  // #145：预制词英译表的**键**就是预制标签词（内容资产原文；身份与过滤继续用中文原文，只有显示位走英译）。
  // 归类按内容资产记，动作注明"显示映射"——免得后人以为这些词也被搬进了铬字典。
  { file: 'src/client/keys.ts', path: 'PRESET_WORD_EN', cls: 'C3', action: '显示映射(en 词表)', consumer: '145' },

  // —— 身份 / 存储值（C2：身份与显示分离，用户数据永不改写） ——
  // #141 收口：去留表与范围别名单点移到 keys.ts（panel 的 CLOUD_EXCLUDE、remoteView 的重复表与
  // 返回显示串的 remoteTagOptions 死码已删）；store 的 LABEL_RESERVED 拒绝分支已砍。
  { file: 'src/client/keys.ts', path: 'SCOPE_ALIASES', cls: 'C2', action: '不动(身份别名)', consumer: '-' },
  { file: 'src/client/keys.ts', path: 'EXCLUDED_LABEL_WORDS', cls: 'C2', action: '不动(存量拼写/身份值)', consumer: '-' },
  { file: 'src/client/store.ts', path: 'LABEL_FALLBACK', cls: 'C2', action: '不动(身份值)', consumer: '-' },
  { file: 'src/client/store.ts', text: '（副本）', cls: 'C2', action: '不动(写入用户数据)', consumer: '141' },

  // —— 铬（C1）：必须随 UI 语言切换 —— #141 已把下列面板侧字面量全数迁进 i18n.ts，
  //    规则留作「同字面量若再出现，仍按铬对待」的哨兵（不是放行条）。
  { file: 'src/client/panel.ts', text: '上一页', cls: 'C1', action: '迁STR(P1)', consumer: '141' },
  { file: 'src/client/panel.ts', text: '下一页', cls: 'C1', action: '迁STR(P1)', consumer: '141' },
  { file: 'src/client/panel.ts', text: '已使用 ', cls: 'C1', action: '迁STR(P1)', consumer: '141' },
  { file: 'src/client/panel.ts', text: ' 次', cls: 'C1', action: '迁STR(P1)', consumer: '141' },
  { file: 'src/client/panel.ts', text: ' · 点击展开/收起简介', cls: 'C1', action: '迁STR(P1)', consumer: '141' },
  { file: 'src/client/panel.ts', text: '「', cls: 'C1', action: '迁STR(P2标点)', consumer: '141' },
  { file: 'src/client/panel.ts', text: '」', cls: 'C1', action: '迁STR(P2标点)', consumer: '141' },
  { file: 'src/client/panel.ts', text: '＋ ', cls: 'C1', action: '迁STR(P2符号)', consumer: '141' },
  { file: 'src/client/panel.ts', text: '＋', cls: 'C1', action: '迁STR(P2符号)', consumer: '141' },
  { file: 'src/client/settings.ts', text: '档·', cls: 'C1', action: '迁STR(P1)', consumer: '141' },
  { file: 'src/client/settings.ts', text: '（', cls: 'C1', action: '迁STR(P2标点)', consumer: '141' },
  { file: 'src/client/settings.ts', text: '）', cls: 'C1', action: '迁STR(P2标点)', consumer: '141' },
  { file: 'src/client/smart.ts', text: '·常用', cls: 'C1', action: '迁STR(P1)', consumer: '141' },
  { file: 'src/client/smart.ts', text: '·分', cls: 'C1', action: '迁STR(P1)', consumer: '141' },
  { file: 'src/client/remoteInputSheet.ts', text: '字', cls: 'C1', action: '迁STR(P2)', consumer: '141' },
  { file: 'src/client/workspace.ts', text: '未归属', cls: 'C1', action: '保持(调用方已本地化)', consumer: '-' },
  { file: 'src/client/workspace.ts', text: '刚刚', cls: 'C1', action: '保持(函数内双语)', consumer: '-' },
  { file: 'src/client/workspace.ts', text: '分', cls: 'C1', action: '保持(函数内双语)', consumer: '-' },
  { file: 'src/client/workspace.ts', text: '时', cls: 'C1', action: '保持(函数内双语)', consumer: '-' },
  { file: 'src/client/workspace.ts', text: '天', cls: 'C1', action: '保持(函数内双语)', consumer: '-' },

  // —— 非界面（C4）：诊断行 / 内部匹配字符 ——
  { file: 'src/client/smart.ts', text: '输入框DOM', cls: 'C4', action: '不动(诊断)', consumer: '-' },
  { file: 'src/client/smart.ts', text: '输入桥', cls: 'C4', action: '不动(诊断)', consumer: '-' },
  { file: 'src/client/smart.ts', text: '读不到', cls: 'C4', action: '不动(诊断)', consumer: '-' },
  { file: 'src/client/smart.ts', text: '诊断(临时) 草稿=', cls: 'C4', action: '不动(诊断)', consumer: '-' },
  { file: 'src/client/smart.ts', text: ' 来源=', cls: 'C4', action: '不动(诊断)', consumer: '-' },
  { file: 'src/client/smart.ts', text: ' 自定义=', cls: 'C4', action: '不动(诊断)', consumer: '-' },
  { file: 'src/client/smart.ts', text: '条 候选=', cls: 'C4', action: '不动(诊断)', consumer: '-' },
  { file: 'src/client/match.ts', text: '：', cls: 'C4', action: '不动(内部匹配字符)', consumer: '-' },
]

function classify(row) {
  for (const r of RULES) {
    if (r.file && r.file !== row.file) continue
    if (r.text !== undefined && r.text !== row.text) continue
    if (r.path !== undefined && row.container.indexOf(r.path) < 0) continue
    if (r.pathEnd !== undefined && !row.container.endsWith(r.pathEnd)) continue
    r.hits = (r.hits || 0) + 1
    return r
  }
  return null
}

function csvCell(v) {
  const s = String(v).replace(/\r?\n/g, '\\n')
  return /[",]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

/** 供 ticket 138 门禁复用的出口：CJK 判定式、归类规则表、扫描与归类函数 */
export { CJK_RE, RULES, scan, classify, csvCell }

const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false

function main() {
const rows = scan()
const unclassified = []
for (const row of rows) {
  const r = classify(row)
  row.cls = r ? r.cls : ''
  row.action = r ? r.action : ''
  row.consumer = r ? r.consumer : ''
  if (!r) unclassified.push(row)
}

// --check：只判「每条检出都有归类」，不写 CSV —— 供 ticket 138 门禁与 CI 复跑，
// 免得每次跑扫描都把快照 CSV 的行号刷成当前树（工作树恒脏）。
if (process.argv.includes('--check')) {
  const counts = {}
  for (const r of rows) { const k = r.cls || 'UNCLASSIFIED'; counts[k] = (counts[k] || 0) + 1 }
  console.log('detected ' + rows.length + ' CJK literals; by class: ' + Object.keys(counts).sort().map(k => k + '=' + counts[k]).join(' '))
  if (unclassified.length) {
    for (const r of unclassified) console.error('  UNCLASSIFIED ' + r.file + ':' + r.line + ':' + r.col + '  ' + JSON.stringify(r.text))
    process.exit(1)
  }
  console.log('check OK: 全部检出条目均有归类（未写 CSV）')
  process.exit(0)
}

if (process.argv.includes('--dump')) {
  for (const r of rows) console.log([r.file, r.line + ':' + r.col, r.container, JSON.stringify(r.text)].join('\t'))
  console.error('TOTAL ' + rows.length)
  process.exit(0)
}

const HEAD = ['file', 'line', 'col', 'text', 'class', 'action', 'consumer_ticket', 'container']
const lines = [HEAD.join(',')]
for (const r of rows) {
  lines.push([r.file, r.line, r.col, r.text, r.cls, r.action, r.consumer, r.container].map(csvCell).join(','))
}
// 行尾必须 LF：本仓 .gitattributes 钉了 `* text=auto eol=lf`，写 CRLF 会让复跑后的 CSV 在 git 里恒显脏
// （工作副本 CRLF / 索引 LF），于是「复跑不改工作树」这条可复现性就没了。BOM 保留（Excel 友好）。
writeFileSync(OUT, '\uFEFF' + lines.join('\n') + '\n', 'utf8')

const byClass = {}
for (const r of rows) byClass[r.cls] = (byClass[r.cls] || 0) + 1
console.log('detected ' + rows.length + ' CJK literals → ' + relative(REPO, OUT).split(sep).join('/'))
console.log('by class: ' + Object.keys(byClass).sort().map(k => k + '=' + byClass[k]).join(' '))
const dead = RULES.filter(r => !r.hits)
if (dead.length) console.error('WARN 未被任何行命中的规则 ' + dead.length + ' 条：' + JSON.stringify(dead.map(r => r.file + '/' + (r.path || r.text || '*'))))
if (unclassified.length) {
  console.error('UNCLASSIFIED ' + unclassified.length + ' 行：')
  for (const r of unclassified) console.error('  ' + r.file + ':' + r.line + ':' + r.col + '  ' + JSON.stringify(r.text) + '  [' + r.container + ']')
  process.exit(1)
}
process.exit(0)
}

if (isMain) main()
