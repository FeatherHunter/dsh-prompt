#!/usr/bin/env node
'use strict'
/**
 * dsh-prompt issue #178「对转义符的支持」回归脚本 —— 契约版本 2（R1 + R2，ADR-0010 accepted）
 *
 * 覆盖：
 *   [R1 保存] 正文只削开头/结尾的空格(0x20)与 tab，保留所有换行（含首尾空行）；
 *              保存 → 重开 → 再存 幂等；MAX_BODY 校验对象 = 保存后字符串；旧普通正文保存结果与旧 body.trim() 一致。
 *   [R1 展示/检索] firstLineIntro / oneLinePreview / templateHaystack / 搜索 / 评分 / /prompt 候选描述：
 *              正文以换行开头时简介取第一个非空行（不出空首行），任何读取面都不出现 {{cursor}}。
 *   [R2 插入] 无标记 = 单次 setDraft、行为与旧版逐字符一致（不碰 captureInsertion/insertText）；
 *              有 {{cursor}} = setDraft(含标记全文) → captureInsertion() → insertText('', {draftRev,start,end}) 返回 true
 *              ⇒ mode=span，光标落标记位、标记全删；任何一环不可用 ⇒ mode=degraded，最后整框 setDraft(剥标记后正确全文)，
 *              文本永远逐字符正确、无标记残留、不抛用户可见错误。
 *   [R2 其它入口] /prompt onPick 返回剥标记正文且候选描述无标记；smart-card.smartInsert 走 applyInsert（静态 + 行为）。
 *   [集成] insertBody 仍返回插入前草稿长度；pick.insert 日志字段不变。
 *
 * 跑法：node scripts/repro/test-issue-178.cjs   或   npm run check:issue-178
 * 契约版本：
 *   applyInsert(inputActions, draft, caret, body) -> { draftChars, mode: 'plain'|'span'|'degraded', marker, text }
 *   stripCursorMarkers(body) -> { text, caret }；CURSOR_MARKER = '{{cursor}}'（10 字符）
 *   trimBodyEdges(body) / firstLineIntro(body) / oneLinePreview(body)
 * 失败时打印 JSON.stringify 后的「实际 / 期望」对照，便于读 diff；任一组失败则进程退出码 1。
 */

const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..', '..')
const SRC = (f) => path.join(ROOT, 'src', 'client', f)
const DIR = path.join(__dirname, '.rt-tmp178')
const { buildFlat, stripComments } = require(path.join(__dirname, '..', 'lib', 'transpile-client.cjs'))

const MODULE_FILES = [
  'template-browser.ts',
  'template-library.ts',
  'prompt-trigger.ts',
  'smart-score.ts',
  'smart-card.ts',
  'strings.ts',
  'smart-draft.ts',
  'remote-mode.ts',
]

let passCount = 0
let failures = 0

function section(name) { console.log('\n== ' + name + ' ==') }

function ok(cond, msg) {
  if (cond) { passCount += 1; console.log('  PASS ' + msg) } else { failures += 1; console.log('  FAIL ' + msg) }
  return !!cond
}

function fail(msg) { failures += 1; console.log('  FAIL ' + msg) }

function show(v) {
  if (v === undefined) return 'undefined'
  try { return JSON.stringify(v) } catch (e) { return String(v) }
}

function eq(actual, want, msg) {
  if (show(actual) === show(want)) { passCount += 1; console.log('  PASS ' + msg); return true }
  failures += 1
  console.log('  FAIL ' + msg)
  console.log('         实际: ' + show(actual))
  console.log('         期望: ' + show(want))
  return false
}

function noMarker(s, msg) { return ok(String(s).indexOf(CURSOR_MARKER) < 0, msg) }

function readSrc(f) { return stripComments(fs.readFileSync(SRC(f), 'utf8')) }

/* ── 渲染/组件用 DOM 桩（照 scripts/repro/test-issue-176.cjs；本仓无 react-dom，ModalPortal 走内联渲染） ── */

const STYLE_SEL_RE = /^style\[data-dsh-prompt-style="([^"]+)"\]$/

function styleNodeIn(root, name) {
  const walk = (node) => {
    const kids = node && node.children
    if (!kids) return null
    for (let i = 0; i < kids.length; i++) {
      const c = kids[i]
      if (!c) continue
      const attr = c.getAttribute ? c.getAttribute('data-dsh-prompt-style') : null
      if (String(c.tagName || '').toUpperCase() === 'STYLE' && attr === name) return c
      const hit = walk(c)
      if (hit) return hit
    }
    return null
  }
  return walk(root)
}

function mkEl(tag) {
  return {
    tagName: String(tag || 'div').toUpperCase(),
    style: {}, children: [], dataset: {}, attributes: {}, parentNode: null, textContent: '',
    setAttribute(k, v) { this.attributes[k] = String(v) },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null },
    removeAttribute(k) { delete this.attributes[k] },
    appendChild(c) { this.children.push(c); if (c) c.parentNode = this; return c },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c },
    remove() {},
    addEventListener() {}, removeEventListener() {},
    focus() {}, select() {}, setSelectionRange() {},
    querySelector(sel) {
      const m = STYLE_SEL_RE.exec(String(sel))
      return m ? styleNodeIn(this, m[1]) : null
    },
    querySelectorAll() { return [] },
    getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 } },
    matches() { return false },
  }
}

const domTextareas = []

function installDom(lang) {
  const head = mkEl('head')
  const body = mkEl('body')
  const doc = {
    documentElement: Object.assign(mkEl('html'), { lang: lang || 'zh-CN' }),
    head: head,
    body: body,
    activeElement: null,
    createElement: mkEl,
    createTextNode(t) { return { text: String(t) } },
    querySelector(sel) {
      const m = STYLE_SEL_RE.exec(String(sel))
      return m ? styleNodeIn(head, m[1]) : null
    },
    querySelectorAll(sel) { return sel === 'textarea' ? domTextareas.slice() : [] },
    getElementById() { return null },
    addEventListener() {}, removeEventListener() {},
  }
  const ls = new Map()
  const localStorage = {
    getItem(k) {
      const key = String(k)
      if (ls.has(key)) return ls.get(key)
      return /^dsh\.prompt\.smart/.test(key) ? '1' : null
    },
    setItem(k, v) { ls.set(String(k), String(v)) },
    removeItem(k) { ls.delete(String(k)) },
  }
  globalThis.document = doc
  globalThis.localStorage = localStorage
  globalThis.window = {
    innerWidth: 1280,
    innerHeight: 800,
    document: doc,
    localStorage: localStorage,
    addEventListener() {}, removeEventListener() {},
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    matchMedia() { return { matches: false, addEventListener() {}, removeEventListener() {} } },
  }
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() { return [] }
  }
}

/* ── 转译 + 装载（buildFlat 自动补齐 import 闭包） ── */

buildFlat(DIR, MODULE_FILES.map(SRC), { suffix: '178' })
installDom('zh-CN')

const React = require('react')
const TR = require('react-test-renderer')
const panel = require(path.join(DIR, 'template-browser178.cjs'))
const store = require(path.join(DIR, 'template-library178.cjs'))
const strings = require(path.join(DIR, 'strings178.cjs'))
const promptTrigger = require(path.join(DIR, 'prompt-trigger178.cjs'))
const smartScore = require(path.join(DIR, 'smart-score178.cjs'))
const smartCard = require(path.join(DIR, 'smart-card178.cjs'))
const smartDraft = require(path.join(DIR, 'smart-draft178.cjs'))
const remoteMod = require(path.join(DIR, 'remote-mode178.cjs'))
const STR = strings.STR

const CURSOR_MARKER = '{{cursor}}'

/* 宿主 store 快照：3 条自定义模板，覆盖「普通正文 / 首行空行 / 正文带光标标记」三类读取面。 */
const SEED = [
  { id: 'x-plain', name: 'PlainFixture', nameEn: '', labels: ['alpha'], body: 'PlainFixture body', builtin: false, createdAt: 1 },
  { id: 'x-lines', name: 'LinesFixture', nameEn: '', labels: ['beta'], body: '\n\n 真首行 \n第二行', builtin: false, createdAt: 2 },
  { id: 'x-marker', name: 'MarkerFixture', nameEn: '', labels: ['gamma'], body: '前{{cursor}}后', builtin: false, createdAt: 3 },
]

function installFetch() {
  globalThis.fetch = async (url) => {
    const u = String(url)
    const payload = /\/store$/.test(u)
      ? { ok: true, value: { customs: SEED, usage: {}, pinned: [], lastUsed: null, hidePreset: true, remote: Object.assign({}, remoteMod.getRemotePrefs()) } }
      : { ok: true }
    return { ok: true, status: 200, json: async () => payload }
  }
}

installFetch()

/* ── react-test-renderer 辅助 ── */

async function flush() {
  await TR.act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

async function mountBrowser(props) {
  let inst = null
  await TR.act(async () => { inst = TR.create(React.createElement(panel.TemplateBrowser, props)) })
  await flush()
  return inst
}

function unmountBrowser(inst) {
  if (!inst) return
  try { TR.act(() => inst.unmount()) } catch (e) { /* ignore */ }
}

function textOf(node) {
  if (node === null || node === undefined) return ''
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (node.children) return node.children.map(textOf).join('')
  return ''
}

function buttonsIn(scope) {
  return scope.findAll((n) => n.type === 'button')
}

function findButtonByText(scope, label) {
  return buttonsIn(scope).filter((b) => textOf(b) === label)[0]
}

function clickButton(scope, label) {
  const b = findButtonByText(scope, label)
  if (!b) throw new Error('找不到按钮文本: ' + label)
  TR.act(() => { b.props.onClick({ stopPropagation() {}, preventDefault() {} }) })
  return b
}

function addButton(inst) {
  return inst.root.findAll((n) => n.type === 'button' && n.props && n.props['data-dsh-prompt-chrome'] === 'plusGlyph' && n.props.title === STR.add.zh)[0]
}

function modalMask(inst) {
  return inst.root.findAll((n) => n.props && n.props['data-dsh-prompt-modal'] !== undefined)[0]
}

function rowById(inst, id) {
  return inst.root.findAll((n) => n.props && n.props['data-dsh-prompt-id'] === id)[0]
}

function hasChildString(scope, s) {
  const root = scope && scope.root ? scope.root : scope
  return root.findAll((n) => Array.isArray(n.children) && n.children.indexOf(s) >= 0).length > 0
}

function customsNamed(name) {
  return store.allTemplates().filter((t) => !t.builtin && t.name === name)
}

function openAddModal(inst) {
  const b = addButton(inst)
  if (!b) throw new Error('找不到新增按钮（data-dsh-prompt-chrome=plusGlyph）')
  TR.act(() => { b.props.onClick({ stopPropagation() {}, preventDefault() {} }) })
  const mask = modalMask(inst)
  if (!mask) throw new Error('新增弹窗未出现')
  return mask
}

function nameInput(mask) {
  return mask.findAll((n) => n.type === 'input' && n.props && n.props.placeholder === STR.namePh.zh)[0]
}

function bodyTextarea(mask) {
  return mask.findAll((n) => n.type === 'textarea')[0]
}

function typeInto(node, value) {
  if (!node) throw new Error('输入框不存在')
  TR.act(() => { node.props.onChange({ target: { value: value } }) })
}

function saveNew(inst, name, body) {
  const mask = openAddModal(inst)
  typeInto(nameInput(mask), name)
  typeInto(bodyTextarea(mask), body)
  clickButton(mask, STR.addOk.zh)
}

function openEditModal(inst, id) {
  const row = rowById(inst, id)
  if (!row) throw new Error('找不到行: ' + id)
  const editBtn = findButtonByText(row, STR.edit.zh)
  if (!editBtn) throw new Error('找不到编辑按钮: ' + id)
  TR.act(() => { editBtn.props.onClick({ stopPropagation() {}, preventDefault() {} }) })
  const mask = modalMask(inst)
  if (!mask) throw new Error('编辑弹窗未出现: ' + id)
  return mask
}

/* ── A. package.json 接线 ── */

function groupA() {
  section('A. package.json 接线（test:issue-178 / check:issue-178 / check 链）')
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  const s = pkg.scripts || {}
  eq(s['test:issue-178'], 'node scripts/repro/test-issue-178.cjs', 'A1 test:issue-178 指向本脚本')
  eq(s['check:issue-178'], 'node scripts/repro/test-issue-178.cjs', 'A2 check:issue-178 指向本脚本')
  const chain = String(s.check || '')
  ok(chain.indexOf('check:issue-178') >= 0, 'A3 check 链包含 check:issue-178')
  const after177 = chain.indexOf('check:issue-177')
  ok(after177 >= 0 && chain.indexOf('check:issue-178') === chain.indexOf('check:issue-177') + 'check:issue-177 && npm run '.length, 'A4 check:issue-178 紧接在 check:issue-177 之后')
}

/* ── B. trimBodyEdges（R1 保存收敛） ── */

function groupB() {
  section('B. trimBodyEdges：只削首尾空格与 tab，保留所有换行')
  const cases = [
    ['', '', '空串'],
    ['abc', 'abc', '无首尾空白不动'],
    [' abc ', 'abc', '首尾各一个空格'],
    ['   abc   ', 'abc', '首尾多个空格'],
    ['	abc	', 'abc', '首尾各一个 tab'],
    ['  	 abc 	   ', 'abc', '首尾空格与 tab 混合'],
    ['\n开头', '\n开头', '开头一个换行保留'],
    ['\n\n开头', '\n\n开头', '开头两个换行保留'],
    ['结尾\n', '结尾\n', '结尾一个换行保留'],
    ['结尾\n\n', '结尾\n\n', '结尾两个换行保留'],
    ['\n两端\n', '\n两端\n', '两端换行都保留'],
    ['  \n开头', '\n开头', '开头空格 + 换行：只削空格'],
    ['结尾\n \t', '结尾\n', '结尾换行后的空格/tab 削掉、换行保留'],
    [' \t\n两侧\n\t ', '\n两侧\n', '两端混合空白（空格/tab 在换行外侧）'],
    ['a\nb', 'a\nb', '中间换行不动'],
    ['a\n\nb', 'a\n\nb', '中间空行不动'],
    ['\n', '\n', '只有一个换行'],
    ['  \n  ', '\n', '空白夹一个换行'],
    ['\n\n\n', '\n\n\n', '纯换行全保留'],
  ]
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]
    eq(store.trimBodyEdges(c[0]), c[1], 'B' + (i + 1) + ' ' + c[2])
  }
  let idemOk = true
  for (let i = 0; i < cases.length; i++) {
    const once = store.trimBodyEdges(cases[i][0])
    if (store.trimBodyEdges(once) !== once) idemOk = false
  }
  ok(idemOk, 'B20 trimBodyEdges 幂等（对自身输出再调用不变）')
  eq(store.trimBodyEdges('\u3000全角空格\u3000'), '\u3000全角空格\u3000', 'B21 只认 0x20 与 tab，全角空格不动')
}

/* ── C. stripCursorMarkers（R2 标记剥离） ── */

function groupC() {
  section('C. stripCursorMarkers：删全部标记，caret=首个标记剥后偏移')
  eq(CURSOR_MARKER, '{{cursor}}', 'C1 CURSOR_MARKER 字面量')
  eq(CURSOR_MARKER.length, 10, 'C2 CURSOR_MARKER 长度 10')
  const cases = [
    ['', '', null, '空串'],
    ['abc', 'abc', null, '无标记'],
    ['{{cursor}}', '', 0, '只有标记'],
    ['{{cursor}}后', '后', 0, '标记在开头'],
    ['前{{cursor}}', '前', 1, '标记在结尾'],
    ['前{{cursor}}后', '前后', 1, '标记在中间'],
    ['a{{cursor}}b{{cursor}}c', 'abc', 1, '两个标记分散'],
    ['{{cursor}}{{cursor}}', '', 0, '两个标记连续'],
    ['{{cursor}}abc{{cursor}}', 'abc', 0, '首尾各一个标记'],
    ['前\n\n{{cursor}}\n后', '前\n\n\n后', 3, '标记紧邻空行'],
    ['a{{cursor}}b{{cursor}}c{{cursor}}d', 'abcd', 1, '三个标记只认第一个'],
    ['{{cursor}}\n{{cursor}}', '\n', 0, '标记夹换行'],
  ]
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]
    const r = store.stripCursorMarkers(c[0])
    eq(r.text, c[1], 'C' + (i + 3) + ' text：' + c[3])
    eq(r.caret, c[2], 'C' + (i + 3) + 'b caret：' + c[3])
    ok(String(r.text).indexOf('{{cursor}}') < 0, 'C' + (i + 3) + 'c 输出不含标记：' + c[3])
  }
}

/* ── E. 展示 / 检索收敛（R1 读取面） ── */

function groupEUnits() {
  section('E1. firstLineIntro / oneLinePreview：空首行与标记收敛')
  const introCases = [
    ['', '', '空串'],
    ['\n\n', '', '纯空行'],
    ['\n开头', '开头', '正文以换行开头 → 取第一个非空行'],
    [' 首行 ', '首行', '首行两端空白 trim'],
    ['\n\n 第二 \n第三', '第二', '两个空首行后取第二行'],
    ['a\nb', 'a', '普通两行取首行'],
    ['\t \n\tx\t', 'x', '空白行跳过、行首尾 trim'],
    ['\n{{cursor}}\n首', '首', '纯标记行视为空行'],
    ['{{cursor}}首', '首', '剥标记后取首行'],
    ['前{{cursor}}后', '前后', '标记在中间被删'],
    ['{{cursor}}', '', '只有标记 → 空串'],
  ]
  for (let i = 0; i < introCases.length; i++) {
    const c = introCases[i]
    const got = store.firstLineIntro(c[0])
    eq(got, c[1], 'E1.' + (i + 1) + ' firstLineIntro ' + c[2])
    ok(got.indexOf('{{cursor}}') < 0, 'E1.' + (i + 1) + 'b 简介不含标记 ' + c[2])
  }
  const previewCases = [
    ['', '', '空串'],
    ['\n\n', '', '纯空白'],
    [' a \n b ', 'a b', '换行压成空格并 trim'],
    ['a\t\tb\n\nc', 'a b c', 'tab 与空行压成单空格'],
    ['{{cursor}}', '', '只有标记'],
    ['前{{cursor}}后', '前后', '标记删除'],
    ['\n首{{cursor}}行\n尾\n', '首行 尾', '剥标记 + 空白归一'],
    ['  \t  ', '', '纯空白 → 空串'],
    ['第一行\n第二行', '第一行 第二行', '普通两行'],
  ]
  for (let i = 0; i < previewCases.length; i++) {
    const c = previewCases[i]
    const got = store.oneLinePreview(c[0])
    eq(got, c[1], 'E1.' + (introCases.length + i + 1) + ' oneLinePreview ' + c[2])
    ok(got.indexOf('{{cursor}}') < 0, 'E1.' + (introCases.length + i + 1) + 'b 预览不含标记 ' + c[2])
  }
}

function groupEWiring() {
  section('E2. 读取面接线：haystack / 搜索 / 评分 / 源码接线')
  const tpl = store.getTemplate('x-marker')
  ok(!!tpl, 'E2.1 store 里有 x-marker 模板')
  const hay = store.templateHaystack(tpl)
  ok(hay.indexOf('{{cursor}}') < 0, 'E2.2 templateHaystack 不含标记')
  ok(hay.indexOf('前后') >= 0, 'E2.3 templateHaystack 含剥标记后的正文')

  const none = promptTrigger.filterPromptTemplates('{{cursor}}')
  ok(none.every((x) => x.id !== 'x-marker'), 'E2.4 搜 {{cursor}} 搜不到「前{{cursor}}后」')
  const hits = promptTrigger.filterPromptTemplates('前后')
  ok(hits.some((x) => x.id === 'x-marker'), 'E2.5 搜剥标记后的正文「前后」能命中')

  const sc = smartScore.scoreCustomLabels('我前后说', tpl)
  eq(sc.score, 1, 'E2.6 评分弱匹配命中剥标记正文（1 分）')
  ok(sc.weak.some((w) => w.indexOf('前后') === 0), 'E2.7 weak 命中片段来自剥标记正文')
  ok(sc.weak.every((w) => w.indexOf('{{cursor}}') < 0), 'E2.8 weak 命中片段不含标记')

  const lib = readSrc('template-library.ts')
  ok(lib.indexOf('stripCursorMarkers(t.body') >= 0, 'E2.9 template-library 源码：haystack 正文剥标记')
  const ss = readSrc('smart-score.ts')
  ok(ss.indexOf('stripCursorMarkers(tpl.body') >= 0, 'E2.10 smart-score 源码：评分正文剥标记')
  const pt = readSrc('prompt-trigger.ts')
  ok(pt.indexOf('stripCursorMarkers(tpl.body)') >= 0, 'E2.11 prompt-trigger 源码：onPick 剥标记')
  ok(pt.indexOf('oneLinePreview(t.body)') >= 0, 'E2.12 prompt-trigger 源码：候选 description 用 oneLinePreview')
  const tb = readSrc('template-browser.ts')
  ok(tb.indexOf('firstLineIntro(x.body)') >= 0, 'E2.13 紧凑列表简介用 firstLineIntro')
  ok(tb.indexOf('oneLinePreview(x.body)') >= 0, 'E2.14 设置页展开预览用 oneLinePreview')
  ok(tb.indexOf('oneLinePreview(tpl.body)') >= 0, 'E2.15 远程卡简介用 oneLinePreview')
  ok(tb.indexOf('trimBodyEdges(body)') >= 0, 'E2.16 保存路径调用 trimBodyEdges')
  ok(tb.indexOf("t('bodyHint')") >= 0, 'E2.17 模板弹窗渲染 bodyHint 提示行')
  ok(!!STR.bodyHint && typeof STR.bodyHint.zh === 'string' && STR.bodyHint.zh.indexOf('{{cursor}}') >= 0, 'E2.18 bodyHint 中文提示提到 {{cursor}}')
  ok(!!STR.bodyHint && typeof STR.bodyHint.en === 'string' && STR.bodyHint.en.indexOf('{{cursor}}') >= 0, 'E2.19 bodyHint 英文提示提到 {{cursor}}')
}

/* ── F. applyInsert：无标记（与旧行为逐字符一致） ── */

function plainActions() {
  const calls = []
  const actions = {
    setDraft(v) { calls.push({ type: 'setDraft', text: v }) },
    captureInsertion() { calls.push({ type: 'captureInsertion' }); throw new Error('无标记路径不得调用 captureInsertion') },
    insertText() { calls.push({ type: 'insertText' }); throw new Error('无标记路径不得调用 insertText') },
  }
  return { actions: actions, calls: calls }
}

function groupF() {
  section('F. applyInsert 无标记：单次 setDraft、逐字符 = 前段 + 正文 + 后段')
  const cases = [
    ['', 0, '模板正文', '空草稿'],
    ['abc', 0, '前', '光标 0'],
    ['abc', 1, '中', '光标 1'],
    ['abc', 3, '后', '光标 3（末尾）'],
    ['a\nb', 2, 'X', '软换行中间'],
    ['head', 4, '\n开头\n\n尾\n\n', '含内部/尾部空行的正文逐字符保真'],
    ['a', 99, 'Z', 'caret 越界 → clamp 到末尾'],
    ['abc', -5, 'Z', 'caret 负数 → clamp 到 0'],
  ]
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]
    const draft = c[0]
    const rawCaret = c[1]
    const body = c[2]
    const pos = Math.max(0, Math.min(Number.isFinite(rawCaret) ? rawCaret : draft.length, draft.length))
    const want = draft.slice(0, pos) + body + draft.slice(pos)
    const rec = plainActions()
    let res = null
    let threw = null
    try { res = panel.applyInsert(rec.actions, draft, rawCaret, body) } catch (e) { threw = e }
    const tag = 'F' + (i + 1) + ' [' + c[3] + '] '
    ok(!threw, tag + '不抛错')
    if (threw || !res) continue
    eq(res.text, want, tag + 'text 逐字符等于拼接结果')
    eq(res.draftChars, draft.length, tag + 'draftChars = 插入前草稿长度（pick.insert 契约）')
    eq(res.mode, 'plain', tag + 'mode=plain')
    eq(res.marker, false, tag + 'marker=false')
    eq(rec.calls.length, 1, tag + '只调用一次宿主方法')
    eq(rec.calls[0] && rec.calls[0].type, 'setDraft', tag + '唯一一次调用是 setDraft')
    eq(rec.calls[0] && rec.calls[0].text, want, tag + 'setDraft 收到最终全文')
  }

  const noActions = panel.applyInsert(null, 'abc', 1, 'X')
  eq(noActions.text, 'aXbc', 'F10 无 actions：text 仍正确')
  eq(noActions.mode, 'plain', 'F11 无 actions：mode 保持 plain')
  eq(noActions.marker, false, 'F12 无 actions：marker=false')

  const noSet = panel.applyInsert({}, 'abc', 1, 'X')
  eq(noSet.text, 'aXbc', 'F13 actions 无 setDraft：text 仍正确')
  eq(noSet.mode, 'plain', 'F14 actions 无 setDraft：mode 保持 plain')
}

/* ── G. applyInsert：{{cursor}} 两编辑 span 成功路径 ── */

function spanActions() {
  const calls = []
  let draftNow = ''
  const actions = {
    setDraft(v) { calls.push({ type: 'setDraft', text: v }); draftNow = v },
    captureInsertion() { calls.push({ type: 'captureInsertion' }); return { draftRev: 7 } },
    insertText(text, range) {
      calls.push({ type: 'insertText', text: text, range: range })
      if (text === '' && range) draftNow = draftNow.slice(0, range.start) + draftNow.slice(range.end)
      return true
    },
  }
  return { actions: actions, calls: calls, current: () => draftNow }
}

function countMarker(s) {
  return String(s).split(CURSOR_MARKER).length - 1
}

function groupG() {
  section('G. applyInsert 有标记：setDraft(含标记) → captureInsertion → insertText 两编辑')
  const cases = [
    ['head', 4, '前{{cursor}}后', '标记在正文中'],
    ['', 0, '{{cursor}}首', '标记在正文首、空草稿'],
    ['abc', 1, '前{{cursor}}尾', '标记在正文中、草稿中间'],
    ['a\nb', 2, 'x{{cursor}}y', '标记 + 软换行草稿'],
    ['head', 4, '前\n\n{{cursor}}\n后', '标记紧邻空行'],
    ['尾', 1, '{{cursor}}', '正文只有标记'],
  ]
  for (let i = 0; i < cases.length; i++) {
    const draft = cases[i][0]
    const caret = cases[i][1]
    const body = cases[i][2]
    const parsed = body.split(CURSOR_MARKER).join('')
    const parsedCaret = body.indexOf(CURSOR_MARKER)
    const pos = Math.max(0, Math.min(caret, draft.length))
    const markerAt = pos + parsedCaret
    const finalText = draft.slice(0, pos) + parsed + draft.slice(pos)
    const withMarker = draft.slice(0, pos) + parsed.slice(0, parsedCaret) + CURSOR_MARKER + parsed.slice(parsedCaret) + draft.slice(pos)
    const rec = spanActions()
    let res = null
    let threw = null
    try { res = panel.applyInsert(rec.actions, draft, caret, body) } catch (e) { threw = e }
    const tag = 'G' + (i + 1) + ' [' + cases[i][3] + '] '
    ok(!threw, tag + '不抛错')
    if (threw || !res) continue
    eq(res.mode, 'span', tag + 'mode=span')
    eq(res.marker, true, tag + 'marker=true（正文含标记）')
    eq(res.draftChars, draft.length, tag + 'draftChars = 插入前草稿长度')
    eq(res.text, finalText, tag + 'text = 剥标记后的整篇草稿')
    ok(res.text.indexOf('{{cursor}}') < 0, tag + 'text 不含标记')

    eq(rec.calls.length, 3, tag + '三次宿主交互')
    eq(rec.calls[0] && rec.calls[0].type, 'setDraft', tag + '第 1 步 setDraft(含标记全文)')
    eq(rec.calls[1] && rec.calls[1].type, 'captureInsertion', tag + '第 2 步 captureInsertion()')
    eq(rec.calls[2] && rec.calls[2].type, 'insertText', tag + '第 3 步 insertText')
    if (rec.calls[0]) {
      eq(rec.calls[0].text, withMarker, tag + '第一次 setDraft 文本 = 含且仅含一个标记的全文')
      eq(countMarker(rec.calls[0].text), 1, tag + '第一次 setDraft 里只有一个标记')
      eq(rec.calls[0].text.indexOf(CURSOR_MARKER), markerAt, tag + '标记位置 = caret + 剥标记前缀长度')
    }
    if (rec.calls[2]) {
      eq(rec.calls[2].text, '', tag + 'insertText 第一个参数为空串（只删标记）')
      eq(rec.calls[2].range, { draftRev: 7, start: markerAt, end: markerAt + CURSOR_MARKER.length }, tag + 'insertText 区间 = {draftRev:7, start:markerAt, end:markerAt+10}')
    }
    eq(rec.current(), finalText, tag + '模拟宿主删标记后草稿 = text（无标记、字符正确）')
    eq(rec.current().indexOf('{{cursor}}'), -1, tag + '模拟宿主草稿无标记残留')
  }
}

/* ── H. 降级阶梯（任何一环不可用 → 文本正确、无标记、不抛） ── */

function degradedCase(label, methods, expectMarkerCalls, draftContainsChip) {
  const calls = []
  const actions = {}
  if (methods.setDraft !== false) actions.setDraft = (v) => { calls.push({ type: 'setDraft', text: v }) }
  if (methods.captureInsertion === 'ok') actions.captureInsertion = () => { calls.push({ type: 'captureInsertion' }); return { draftRev: 7 } }
  if (methods.captureInsertion === 'throw') actions.captureInsertion = () => { calls.push({ type: 'captureInsertion' }); throw new Error('captureInsertion boom') }
  if (methods.captureInsertion === 'noRev') actions.captureInsertion = () => { calls.push({ type: 'captureInsertion' }); return {} }
  if (methods.insertText === 'true') actions.insertText = () => { calls.push({ type: 'insertText' }); return true }
  if (methods.insertText === 'false') actions.insertText = () => { calls.push({ type: 'insertText' }); return false }
  if (methods.insertText === 'throw') actions.insertText = () => { calls.push({ type: 'insertText' }); throw new Error('insertText boom') }

  const draft = draftContainsChip ? 'head\uFFFC' : 'head'
  const body = '前{{cursor}}后'
  const pos = draft.length
  const finalText = draft + '前后'
  let res = null
  let threw = null
  try { res = panel.applyInsert(actions, draft, pos, body) } catch (e) { threw = e }
  ok(!threw, label + '：不抛错')
  if (threw || !res) return
  eq(res.mode, 'degraded', label + '：mode=degraded')
  eq(res.marker, true, label + '：marker=true（正文含标记）')
  eq(res.text, finalText, label + '：text 逐字符正确（剥标记全文）')
  ok(res.text.indexOf('{{cursor}}') < 0, label + '：text 无标记')
  ok(Object.prototype.hasOwnProperty.call(res, 'error') === false, label + '：不产生 error 字段（无用户可见错误契约）')
  const drafts = calls.filter((c) => c.type === 'setDraft')
  ok(drafts.length >= 1, label + '：至少一次 setDraft')
  if (drafts.length > 0) {
    eq(drafts[drafts.length - 1].text, finalText, label + '：最后一次 setDraft = 剥标记后正确全文')
    ok(drafts[drafts.length - 1].text.indexOf('{{cursor}}') < 0, label + '：最后一次 setDraft 无标记')
  }
  eq(calls.filter((c) => c.type === 'captureInsertion').length, expectMarkerCalls.captureInsertion, label + '：captureInsertion 调用次数')
  eq(calls.filter((c) => c.type === 'insertText').length, expectMarkerCalls.insertText, label + '：insertText 调用次数')
}

function groupH() {
  section('H. 降级阶梯矩阵：缺 action / insertText false / 抛错 / 草稿含引用 chip')
  degradedCase('H1 只有 setDraft（旧宿主缺 captureInsertion+insertText）', { setDraft: true }, { captureInsertion: 0, insertText: 0 }, false)
  degradedCase('H2 缺 insertText（只有 setDraft+captureInsertion）', { setDraft: true, captureInsertion: 'ok' }, { captureInsertion: 0, insertText: 0 }, false)
  degradedCase('H3 insertText 返回 false', { setDraft: true, captureInsertion: 'ok', insertText: 'false' }, { captureInsertion: 1, insertText: 1 }, false)
  degradedCase('H4 insertText 抛错', { setDraft: true, captureInsertion: 'ok', insertText: 'throw' }, { captureInsertion: 1, insertText: 1 }, false)
  degradedCase('H5 captureInsertion 抛错', { setDraft: true, captureInsertion: 'throw', insertText: 'true' }, { captureInsertion: 1, insertText: 0 }, false)
  degradedCase('H6 captureInsertion 返回无 draftRev', { setDraft: true, captureInsertion: 'noRev', insertText: 'true' }, { captureInsertion: 1, insertText: 0 }, false)
  degradedCase('H7 草稿含 U+FFFC 引用 chip（直接降级，不尝试两编辑）', { setDraft: true, captureInsertion: 'ok', insertText: 'true' }, { captureInsertion: 0, insertText: 0 }, true)

  const chipDraft = 'a\uE100b'
  const calls = []
  const res = panel.applyInsert({ setDraft: (v) => calls.push(v), captureInsertion: () => ({ draftRev: 1 }), insertText: () => true }, chipDraft, 1, '{{cursor}}')
  eq(res.mode, 'degraded', 'H8 草稿含 \\uE100（引用 chip）→ degraded')
  eq(res.text, 'a\uE100b', 'H9 草稿含 chip + 正文只有标记 → text 逐字符保真（标记删除）')
  eq(calls.length, 1, 'H10 草稿含 chip → 只调用一次 setDraft')
}

/* ── I. 多标记：只认第一个，其余全删 ── */

function groupI() {
  section('I. 多个 {{cursor}}：只认第一个，其余在插入文本里全删')
  const cases = [
    ['start', 0, 'a{{cursor}}b{{cursor}}c', 1, 'a', 'abcstart'],
    ['start', 0, '{{cursor}}x{{cursor}}y{{cursor}}', 0, '', 'xystart'],
    ['ab', 1, '{{cursor}}{{cursor}}', 0, '', 'ab'],
    ['head', 4, '前{{cursor}}{{cursor}}后', 1, '前', 'head前后'],
  ]
  for (let i = 0; i < cases.length; i++) {
    const draft = cases[i][0]
    const caret = cases[i][1]
    const body = cases[i][2]
    const parsedCaret = cases[i][3]
    const prefix = cases[i][4]
    const finalText = cases[i][5]
    const rec = spanActions()
    const res = panel.applyInsert(rec.actions, draft, caret, body)
    const tag = 'I' + (i + 1) + ' '
    eq(res.mode, 'span', tag + 'mode=span')
    eq(res.text, finalText, tag + 'text 中其余标记全部删除')
    ok(res.text.indexOf('{{cursor}}') < 0, tag + 'text 无标记')
    const markerAt = (typeof caret === 'number' && caret <= draft.length ? Math.max(0, caret) : draft.length) + parsedCaret
    eq(rec.calls[0] && rec.calls[0].text.indexOf(CURSOR_MARKER), markerAt, tag + '只保留第一个标记（位置=第一个标记处）')
    eq(countMarker(rec.calls[0] && rec.calls[0].text), 1, tag + '插入文本里只含一个标记')
    eq(rec.calls[2] && rec.calls[2].range, { draftRev: 7, start: markerAt, end: markerAt + CURSOR_MARKER.length }, tag + 'insertText 只删第一个标记')
    eq(rec.current(), finalText, tag + '最终草稿无标记且逐字符正确')
    void prefix
  }
}

/* ── J. /prompt 候选与 onPick ── */

async function groupJ() {
  section('J. /prompt：候选描述无标记、onPick 返回剥标记文本')
  const src = promptTrigger.buildPromptSource()
  eq(src.trigger, '/', 'J1 trigger = /')
  const cands = await src.candidates({}, { query: '' })
  ok(Array.isArray(cands) && cands.length > 0, 'J2 候选人非空')
  const markerCand = cands.filter((c) => c.templateId === 'x-marker')[0]
  ok(!!markerCand, 'J3 候选人含 x-marker')
  if (markerCand) {
    ok(markerCand.description.indexOf('{{cursor}}') < 0, 'J4 候选 description 不含标记')
    ok(markerCand.description.indexOf('前后') >= 0, 'J5 候选 description 用剥标记正文')
  }
  const lineCand = cands.filter((c) => c.templateId === 'x-lines')[0]
  ok(!!lineCand, 'J6 候选人含 x-lines')
  if (lineCand) {
    ok(lineCand.description.indexOf('真首行') >= 0, 'J7 以空行开头的正文：描述含第一个非空行')
    ok(lineCand.description.indexOf('\n') < 0, 'J8 描述是单行（不出空首行/多行）')
    ok(lineCand.description.indexOf('{{cursor}}') < 0, 'J9 描述无标记')
  }
  const out = src.onPick({ candidate: { templateId: 'x-marker' } })
  eq(out && out.text, '前后', 'J10 onPick 返回剥标记正文')
  eq(out && typeof out.text === 'string' && out.text.indexOf('{{cursor}}') < 0, true, 'J11 onPick 文本无标记')
  ok(out && Object.keys(out).length === 1 && Object.prototype.hasOwnProperty.call(out, 'text'), 'J12 onPick 只返回 { text }（不携带光标定位）')
}

/* ── K. smart-card.smartInsert 走 applyInsert ── */

async function groupK() {
  section('K. 智能卡 smartInsert：走 applyInsert（静态 + 行为）')
  const sc = readSrc('smart-card.ts')
  ok(sc.indexOf('applyInsert(actions') >= 0, 'K1 smart-card 源码调用 applyInsert(actions, ...)')
  ok(sc.indexOf('stripCursorMarkers(body)') >= 0, 'K2 smart-card 源码用 stripCursorMarkers')
  ok(readSrc('template-browser.ts').indexOf('export function applyInsert') >= 0, 'K3 applyInsert 从 template-browser 导出')

  const original = panel.applyInsert
  const recorded = []
  panel.applyInsert = function () {
    const args = Array.prototype.slice.call(arguments)
    recorded.push(args)
    return original.apply(panel, args)
  }
  try {
    const calls = []
    let draftNow = ''
    const actions = {
      setDraft(v) { calls.push({ type: 'setDraft', text: v }); draftNow = v },
      captureInsertion() { calls.push({ type: 'captureInsertion' }); return { draftRev: 9 } },
      insertText(text, range) {
        calls.push({ type: 'insertText', text: text, range: range })
        if (text === '' && range) draftNow = draftNow.slice(0, range.start) + draftNow.slice(range.end)
        return true
      },
    }
    smartDraft.setSmartInput({ draft: 'head', actions: actions })
    smartCard.smartInsert('前{{cursor}}后', 'x-marker')
    eq(recorded.length, 1, 'K4 标记路径调用一次 applyInsert')
    ok(recorded[0] && recorded[0][0] === actions, 'K5 applyInsert 收到智能卡输入桥 actions')
    eq(recorded[0] && recorded[0][1], 'head', 'K6 applyInsert 收到当前草稿')
    eq(recorded[0] && recorded[0][2], 4, 'K7 applyInsert 收到 caret（无 textarea 时 = 草稿末尾）')
    eq(recorded[0] && recorded[0][3], '前{{cursor}}后', 'K8 applyInsert 收到原始正文（标记交给 applyInsert 处理）')
    eq(calls.length, 3, 'K9 标记路径 = setDraft + captureInsertion + insertText 三次交互')
    eq(calls[0] && calls[0].type, 'setDraft', 'K10 第 1 步 setDraft(含标记全文)')
    eq(calls[0] && countMarker(calls[0].text), 1, 'K11 第一次 setDraft 只含一个标记')
    eq(calls[1] && calls[1].type, 'captureInsertion', 'K12 第 2 步 captureInsertion')
    eq(calls[2] && calls[2].type, 'insertText', 'K13 第 3 步 insertText')
    eq(draftNow, 'head前后', 'K14 标记路径最终草稿无标记且逐字符正确')
    ok(draftNow.indexOf('{{cursor}}') < 0, 'K15 标记路径无标记残留')

    recorded.length = 0
    const plainCalls = []
    const actions2 = { setDraft(v) { plainCalls.push(v) } }
    smartDraft.setSmartInput({ draft: 'abc', actions: actions2 })
    smartCard.smartInsert('\n正文\n', 'x-plain')
    eq(recorded.length, 1, 'K16 无标记路径同样走 applyInsert')
    eq(plainCalls, ['abc\n正文\n'], 'K17 无标记路径单次 setDraft 且逐字符正确')
    await new Promise((r) => setTimeout(r, 5))
  } finally {
    panel.applyInsert = original
  }
}


/* ── D. 保存路径（渲染级）：首尾换行保留、幂等、MAX_BODY ── */

async function groupD() {
  section('D. 保存路径（渲染级 TemplateBrowser compact）：只削首尾空格/tab、保留换行、幂等、MAX_BODY')
  const actions = { setDraft() {} }
  const inst = await mountBrowser({ compact: true, inputActions: actions })
  try {
    saveNew(inst, 'LineLeadFixture', '\n开头')
    const t1 = customsNamed('LineLeadFixture')[0]
    ok(!!t1, 'D1 新增「开头换行」模板成功')
    if (t1) eq(t1.body, '\n开头', 'D2 正文以换行开头：保存后仍以换行开头')

    saveNew(inst, 'LineTailFixture', '结尾\n\n')
    const t2 = customsNamed('LineTailFixture')[0]
    ok(!!t2, 'D3 新增「结尾换行」模板成功')
    if (t2) eq(t2.body, '结尾\n\n', 'D4 正文结尾两个换行：保存后保留')

    saveNew(inst, 'SpaceNewlineFixture', '  \n开头 \t')
    const t3 = customsNamed('SpaceNewlineFixture')[0]
    if (t3) eq(t3.body, '\n开头', 'D5 首尾空格/tab 削掉、换行保留（空格+换行组合）')
    else fail('D5 未保存出 SpaceNewlineFixture')

    saveNew(inst, 'PlainTrimFixture', '  普通正文  ')
    const t4 = customsNamed('PlainTrimFixture')[0]
    if (t4) {
      eq(t4.body, '普通正文', 'D6 无首尾换行的普通正文：保存值 = 旧 body.trim() 结果')
      eq(t4.body, '  普通正文  '.trim(), 'D7 普通正文保存结果与旧 trim() 逐字符一致')
    } else fail('D7 未保存出 PlainTrimFixture')

    if (t1) {
      const beforeCount = store.allTemplates().length
      const mask = openEditModal(inst, t1.id)
      eq(bodyTextarea(mask) && bodyTextarea(mask).props.value, '\n开头', 'D8 重开编辑：正文框初值仍以换行开头')
      clickButton(mask, STR.save.zh)
      eq(store.getTemplate(t1.id) && store.getTemplate(t1.id).body, '\n开头', 'D9 保存→重开→再存：开头换行值不变（幂等）')
      eq(store.allTemplates().length, beforeCount, 'D10 编辑保存不新增模板')
    }

    if (t2) {
      const mask = openEditModal(inst, t2.id)
      eq(bodyTextarea(mask) && bodyTextarea(mask).props.value, '结尾\n\n', 'D11 重开编辑：结尾换行初值保留')
      clickButton(mask, STR.save.zh)
      eq(store.getTemplate(t2.id) && store.getTemplate(t2.id).body, '结尾\n\n', 'D12 结尾换行保存→重开→再存幂等')
    }

    const countBefore = store.allTemplates().length
    const maskBig = openAddModal(inst)
    typeInto(nameInput(maskBig), 'TooLongFixture')
    typeInto(bodyTextarea(maskBig), 'a'.repeat(10001))
    clickButton(modalMask(inst), STR.addOk.zh)
    const maskErr = modalMask(inst)
    ok(!!maskErr, 'D13 超过 MAX_BODY 时弹窗保持打开（报错可见，不静默）')
    if (maskErr) ok(textOf(maskErr).indexOf(STR.bodyTooLong.zh) >= 0, 'D14 报错文案 = bodyTooLong')
    eq(store.allTemplates().length, countBefore, 'D15 超上限不落库')
    eq(customsNamed('TooLongFixture').length, 0, 'D16 超上限不产生模板')
    if (maskErr) clickButton(modalMask(inst), STR.cancel.zh)

    saveNew(inst, 'MaxBodyFixture', 'a'.repeat(10000))
    const t5 = customsNamed('MaxBodyFixture')[0]
    ok(!!t5, 'D17 MAX_BODY=10000 边界可保存')
    if (t5) eq(t5.body.length, 10000, 'D18 边界正文长度 10000 原样保留')

    const maskHint = openAddModal(inst)
    ok(textOf(maskHint).indexOf(STR.bodyHint.zh) >= 0, 'D19 弹窗正文框下有 bodyHint 提示行')
    clickButton(modalMask(inst), STR.cancel.zh)
  } finally {
    unmountBrowser(inst)
  }
}

/* ── E. 渲染级：紧凑列表首行简介 / 设置页展开预览 ── */

async function groupERender() {
  section('E3. 渲染级：紧凑列表首行简介 / 设置页展开预览（不出空首行、不出现标记）')
  const actions = { setDraft() {} }
  const compact = await mountBrowser({ compact: true, inputActions: actions })
  try {
    const rowLines = rowById(compact, 'x-lines')
    ok(!!rowLines, 'E3.1 渲染出 x-lines 行')
    if (rowLines) {
      const intro = store.firstLineIntro(store.getTemplate('x-lines').body)
      eq(intro, '真首行', 'E3.2 firstLineIntro(x-lines) = 真首行（跳过空首行）')
      ok(hasChildString(rowLines, '真首行'), 'E3.3 紧凑行简介节点文本 = 真首行')
      ok(textOf(rowLines).indexOf('{{cursor}}') < 0, 'E3.4 紧凑行无标记')
    }
    const rowMarker = rowById(compact, 'x-marker')
    ok(!!rowMarker, 'E3.5 渲染出 x-marker 行')
    if (rowMarker) {
      ok(hasChildString(rowMarker, '前后'), 'E3.6 标记正文的简介 = 前后（标记已剥）')
      ok(textOf(rowMarker).indexOf('{{cursor}}') < 0, 'E3.7 紧凑行不显示标记')
    }
  } finally {
    unmountBrowser(compact)
  }

  const settings = await mountBrowser({ compact: false })
  try {
    const row = rowById(settings, 'x-lines')
    ok(!!row, 'E3.8 渲染出设置页 x-lines 行')
    if (row) {
      TR.act(() => { row.props.onClick({ stopPropagation() {}, preventDefault() {} }) })
      const preview = store.oneLinePreview(store.getTemplate('x-lines').body).slice(0, 44) + '…'
      eq(preview, '真首行 第二行…', 'E3.9 设置页展开预览期望值')
      ok(hasChildString(settings, preview), 'E3.10 设置页展开后预览节点 = oneLinePreview(...)')
      ok(textOf(settings.root).indexOf('{{cursor}}') < 0, 'E3.11 设置页展开无标记')
    }
    const rowM = rowById(settings, 'x-marker')
    if (rowM) {
      TR.act(() => { rowM.props.onClick({ stopPropagation() {}, preventDefault() {} }) })
      const previewM = store.oneLinePreview(store.getTemplate('x-marker').body).slice(0, 44) + '…'
      eq(previewM, '前后…', 'E3.12 标记正文单行预览期望值')
      ok(hasChildString(settings, previewM), 'E3.13 设置页展开标记正文预览 = 前后…')
    }
  } finally {
    unmountBrowser(settings)
  }
}

/* ── M. 集成：#61 风格 DOM + insertBody 返回值 / pick.insert 日志字段 ── */

function tnode(text) {
  return { nodeType: 3, nodeValue: text, textContent: text }
}

function domNode(tag, kids, extra) {
  const list = kids || []
  const text = list.map((k) => (k && (k.textContent || k.nodeValue)) || '').join('')
  const node = {
    nodeType: 1,
    tagName: tag,
    childNodes: list,
    textContent: text,
    contains(n) {
      if (n === node) return true
      return list.some((k) => k === n || (k && k.contains && k.contains(n)))
    },
    closest() { return null },
  }
  return Object.assign(node, extra || {})
}

function domBodyEl() {
  return { tagName: 'BODY', closest() { return null }, getAttribute() { return null } }
}

function makeComposerDocument(areas, active) {
  return {
    activeElement: active || null,
    documentElement: { lang: 'zh-CN' },
    querySelectorAll(sel) {
      const s = String(sel)
      if (s.indexOf('contenteditable') >= 0) return areas.slice()
      if (s === 'textarea') return []
      return []
    },
    querySelector() { return null },
    addEventListener() {}, removeEventListener() {}, dispatch() {},
  }
}

function installSelectionNode(tn, offset) {
  const sel = { rangeCount: tn ? 1 : 0, anchorNode: tn, anchorOffset: offset || 0 }
  globalThis.getSelection = () => sel
  if (!globalThis.window) globalThis.window = {}
  globalThis.window.getSelection = () => sel
}

function bareHook(draft) {
  return (sel) => sel({ draft: draft })
}

function tapDraft(draft) {
  let r = null
  TR.act(() => { r = TR.create(React.createElement(panel.DraftTap, { useInput: bareHook(draft) })) })
  return r
}

const NOP_BRIDGE = () => { throw new Error('must not be called outside render') }

function composerRoot(kids) {
  return domNode('DIV', kids, {
    getAttribute(k) { return k === 'contenteditable' ? 'true' : null },
    closest(sel) { return sel === '[data-composer-card]' ? {} : null },
  })
}

function spanActionsForDom() {
  const calls = []
  let draftNow = ''
  const actions = {
    setDraft(v) { calls.push({ type: 'setDraft', text: v }); draftNow = v },
    captureInsertion() { calls.push({ type: 'captureInsertion' }); return { draftRev: 7 } },
    insertText(text, range) {
      calls.push({ type: 'insertText', text: text, range: range })
      if (text === '' && range) draftNow = draftNow.slice(0, range.start) + draftNow.slice(range.end)
      return true
    },
  }
  return { actions: actions, calls: calls, current: () => draftNow }
}

async function groupM() {
  section('M. 集成：insertBody 返回值 / pick.insert 日志字段不变（#61/#76 口径）')
  const savedDocument = globalThis.document
  const savedWindow = globalThis.window
  try {
    {
      const anchorText = tnode('abcd')
      const root = composerRoot([domNode('P', [anchorText])])
      globalThis.document = makeComposerDocument([root], root)
      installSelectionNode(anchorText, 2)
      tapDraft('abcd')
      let got = null
      const calls = []
      const actions = {
        setDraft(v) { calls.push(v); got = v },
        captureInsertion() { throw new Error('无标记路径不得调用 captureInsertion') },
        insertText() { throw new Error('无标记路径不得调用 insertText') },
      }
      const ret = panel.insertBody(NOP_BRIDGE, actions, 'X\nY')
      eq(ret, 4, 'M1 insertBody 返回插入前草稿长度')
      eq(got, 'abX\nYcd', 'M2 无标记插入逐字符 = 前段 + 正文 + 后段（旧行为）')
      eq(calls.length, 1, 'M3 无标记只调用一次 setDraft')
    }
    {
      globalThis.document = makeComposerDocument([], domBodyEl())
      installSelectionNode(null, 0)
      tapDraft('')
      let got = null
      const ret = panel.insertBody(NOP_BRIDGE, { setDraft(v) { got = v } }, '\n开头\n\n尾\n\n')
      eq(ret, 0, 'M4 真空草稿：insertBody 返回 0')
      eq(got, '\n开头\n\n尾\n\n', 'M5 真空草稿：正文含首尾空行逐字符保真（#76 口径）')
    }
    {
      const anchorText = tnode('b')
      const root = composerRoot([domNode('P', [tnode('a')]), domNode('P', [anchorText])])
      globalThis.document = makeComposerDocument([root], root)
      installSelectionNode(anchorText, 1)
      tapDraft('a\nb')
      let got = null
      const ret = panel.insertBody(NOP_BRIDGE, { setDraft(v) { got = v } }, 'Z')
      eq(ret, 3, 'M6 多段落草稿：insertBody 返回插入前长度 3')
      eq(got, 'a\nbZ', 'M7 多段落草稿末尾插入逐字符正确')
    }
    {
      globalThis.document = makeComposerDocument([], domBodyEl())
      installSelectionNode(null, 0)
      tapDraft('')
      const rec = spanActionsForDom()
      const ret = panel.insertBody(NOP_BRIDGE, rec.actions, '前{{cursor}}后')
      eq(ret, 0, 'M8 有标记：insertBody 仍返回插入前长度')
      eq(rec.calls.length, 3, 'M9 有标记：insertBody 走 applyInsert 两编辑（3 次交互）')
      eq(rec.calls[2] && rec.calls[2].range, { draftRev: 7, start: 1, end: 11 }, 'M10 有标记：insertText 区间正确')
      eq(rec.current(), '前后', 'M11 有标记：模拟宿主最终草稿无标记且正确')
    }
    {
      globalThis.document = makeComposerDocument([], domBodyEl())
      installSelectionNode(null, 0)
      tapDraft('')
      const logCaptures = []
      globalThis.__dshPromptLog = { log(event, fields) { logCaptures.push({ event: event, fields: fields }) } }
      try {
        let got = null
        panel.onPick(store.getTemplate('x-plain'), NOP_BRIDGE, { setDraft(v) { got = v } })
        eq(got, 'PlainFixture body', 'M12 onPick 插入模板正文')
        const ins = logCaptures.filter((c) => c.event === 'pick.insert')[0]
        ok(!!ins, 'M13 产生 pick.insert 日志')
        if (ins) {
          eq(ins.fields, { source: 'panel', templateKind: 'custom', idHash: 'x-plain', draftChars: 0, caret: 0, caretSrc: 'none', draftLines: 0 }, 'M14 pick.insert 字段与旧契约逐键一致')
        }
        ok(logCaptures.some((c) => c.event === 'pick.probe'), 'M15 仍产生 pick.probe 探针事件')
      } finally {
        delete globalThis.__dshPromptLog
      }
    }
  } finally {
    globalThis.document = savedDocument
    globalThis.window = savedWindow
    try { delete globalThis.getSelection } catch (e) { /* ignore */ }
  }
}

/* ── 主流程 ── */

;(async () => {
  await store.ensureLoaded()
  try { await remoteMod.ensureRemoteLoaded() } catch (e) { /* ignore */ }

  groupA()
  groupB()
  groupC()
  groupEUnits()
  groupEWiring()
  groupF()
  groupG()
  groupH()
  groupI()
  await groupJ()
  await groupK()
  await groupD()
  await groupERender()
  await groupM()

  if (failures > 0) {
    console.log('\nRESULT: FAIL (' + failures + ' failures, ' + passCount + ' passed)')
    process.exit(1)
  }
  console.log('\nALL PASS: #178 (' + passCount + ' assertions)')
})().catch((e) => {
  console.log('\nFAIL: 未捕获异常 ' + ((e && e.stack) || e))
  process.exit(1)
})

