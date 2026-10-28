#!/usr/bin/env node
'use strict'
/**
 * dsh-prompt issue #181「插入后第二次撤销会吞掉插入前草稿」回归脚本 —— 契约版本 1（#181 撤销分组）
 *
 * 根因（票面正文 / research/issue-181-undo-grouping/findings.md）：宿主公开的写草稿原语只有两条，
 * undo 分组语义完全不同 —— setDraft 是「整框 seed」，宿主用 history-merge 把它并无条件并进 current
 * （不产生撤销记录）；insertText 是 paste 记录，每次独立成一条 undo。旧实现第一笔用 setDraft 写正文，
 * 于是「插入」与插入前的输入焊成同一条记录：undo1 露标记、undo2 直接跳过插入前草稿。
 *
 * 修法（ADR-0010 增补 Decision）：用户意图写入一律走 insertText；setDraft 只保留给 seed 与降级。
 *   · 无标记：captureInsertion() → insertText(正文, 折叠光标) 一笔可撤销编辑，undo1 回插入前草稿；
 *     光标落插入文本之后（#181 显式接受的契约变更）。
 *   · 有 {{cursor}}：captureInsertion() → insertText(正文段+一个标记) → captureInsertion() →
 *     insertText('', 标记区间) 两笔纯 paste；undo1 先露标记（#178 已文档化代价）、undo2 回插入前草稿。
 *   · 降级（旧宿主缺 action / chip / 坐标不一致 / 非折叠 / false / 抛错）：整框 setDraft、mode=degraded，
 *     文本永远逐字符正确、无标记残留、不抛错。
 *
 * 本脚本钉住（独立于 check:issue-178 的宿主 mock，自带 Lexical history 分组状态机）：
 *   A. marker 路径 undo/redo 全序列：undo1 = 露标记态、undo2 = 插入前草稿、undo3 = 更早、redo 重建。
 *   B. 无标记路径 undo/redo：undo1 = 插入前草稿（空草稿时 = 空草稿）、redo 重建。
 *   C. 降级阶梯矩阵：mode=degraded、恰好一次 setDraft(最终全文)、文本正确、无标记、不抛。
 *   D. 不变量：成功路径（span / plain）setDraft 调用次数 = 0；降级路径不尝试半成品两编辑。
 *   E. insertBody 集成：仍返回插入前草稿长度（pick.insert 契约），且走同一套原语。
 *   F. 源码不变量：applyInsert 不再出现「setDraft 写正文」的旧路径。
 *
 * 跑法：node scripts/check-issue-181.mjs   或   npm run check:issue-181
 * 契约版本：
 *   applyInsert(inputActions, draft, caret, body) -> { draftChars, mode: 'plain'|'span'|'degraded', marker, text }
 *   CURSOR_MARKER = '{{cursor}}'（10 字符）
 * 失败时打印「实际 / 期望」对照，任一断言失败则进程退出码 1。
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const SRC = (f) => path.join(ROOT, 'src', 'client', f)
const DIR = path.join(__dirname, '.rt-tmp181')
const MARK = '{{cursor}}'
const { buildFlat, stripComments } = require(path.join(__dirname, 'lib', 'transpile-client.cjs'))

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
function noMarker(s, msg) { return ok(String(s).indexOf(MARK) < 0, msg) }
function countMarker(s) { return String(s).split(MARK).length - 1 }
function readSrc(f) { return stripComments(fs.readFileSync(SRC(f), 'utf8')) }
function sliceFn(src, name) {
  const i = src.indexOf('export function ' + name + '(')
  if (i < 0) return ''
  // 签名行可能带对象字面量返回类型（applyInsert 就是），函数体大括号取该行最后一个 '{'。
  const lineEnd = src.indexOf('\n', i)
  const bodyStart = src.lastIndexOf('{', lineEnd < 0 ? src.length : lineEnd)
  if (bodyStart < 0) return src.slice(i)
  let depth = 0
  for (let j = bodyStart; j < src.length; j++) {
    const c = src[j]
    if (c === '{') depth += 1
    else if (c === '}') { depth -= 1; if (depth === 0) return src.slice(i, j + 1) }
  }
  return src.slice(i)
}

/* ── 装载：只需要纯函数层（applyInsert / insertBody / resolveDraft），不需要 React / 渲染 DOM ── */
globalThis.window = globalThis
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, length: 0, key: () => null }
globalThis.document = {
  activeElement: null,
  addEventListener: () => {},
  querySelector: () => null,
  querySelectorAll: () => [],
}

buildFlat(DIR, [SRC('template-browser.ts')], { suffix: '181' })
const panel = require(path.join(DIR, 'template-browser181.cjs'))

/* ── 宿主 mock：Lexical history 分组状态机（本脚本独立实现，不复用 #178 的 mock） ──
 * 状态：draft（整篇草稿）+ caret（折叠光标，detect 坐标）+ rev（草稿修订号）+ undo/redo 栈。
 * 分组规则（宿主 bundle 内联 @lexical/history 行为）：
 *   setDraft  => history-merge：并入 current，不压栈、不产生撤销记录；
 *   insertText => paste：先把 current 压进 undoStack，再成为新 current；
 *   相邻输入字符合并（本脚本模拟"插入前已输入"用一条起始记录代替逐字符合并）。
 * 插入前草稿非空时，undoStack = [{draft:'',caret:0}]，current = {draft:typed, caret:pos}
 * （真机轨迹：输入首字符压一条记录，后续字符合并进 current）。空草稿时 undoStack = []。
 */
function makeHost(typed, caret) {
  const t = typed == null ? '' : String(typed)
  const at = Number.isFinite(caret) ? Math.max(0, Math.min(caret, t.length)) : t.length
  const h = {
    draft: t,
    caret: at,
    rev: 1,
    undo: t ? [{ draft: '', caret: 0 }] : [],
    redo: [],
    records: [],
  }
  h.state = () => ({ draft: h.draft, caret: h.caret })
  h.undoStep = () => {
    if (!h.undo.length) return false
    h.redo.push(h.state())
    const s = h.undo.pop()
    h.draft = s.draft
    h.caret = s.caret
    return true
  }
  h.redoStep = () => {
    if (!h.redo.length) return false
    h.undo.push(h.state())
    const s = h.redo.pop()
    h.draft = s.draft
    h.caret = s.caret
    return true
  }
  return h
}

/** 按宿主语义提交一次 insertText（paste 记录）。返回 false = 宿主拒绝（rev 守卫）。 */
function commitInsert(h, text, span) {
  if (!span || span.draftRev !== h.rev) return false
  if (typeof span.start !== 'number' || typeof span.end !== 'number') return false
  const prev = { draft: h.draft, caret: h.caret }
  h.draft = prev.draft.slice(0, span.start) + text + prev.draft.slice(span.end)
  h.caret = span.start + text.length
  h.rev += 1
  h.undo.push(prev)
  h.redo = []
  return true
}

function makeActions(h, opts) {
  const o = opts || {}
  const a = {}
  if (o.noSetDraft !== true) {
    a.setDraft = (text) => {
      h.records.push({ type: 'setDraft', text: text })
      const v = String(text)
      if (v === h.draft) return // 宿主：文本未变不产生历史（history-merge 也只在真变化时记）
      h.draft = v
      h.caret = v.length
      h.redo = []
    }
  }
  if (o.noCapture !== true) {
    a.captureInsertion = () => {
      h.records.push({ type: 'captureInsertion' })
      if (o.captureThrows) throw new Error('captureInsertion boom')
      if (o.captureNoRev) return { start: h.caret, end: h.caret }
      const start = o.captureStart !== undefined ? o.captureStart : h.caret
      const end = o.captureEnd !== undefined ? o.captureEnd : start
      return { start: start, end: end, draftRev: h.rev }
    }
  }
  if (o.noInsertText !== true) {
    a.insertText = (text, span) => {
      h.records.push({ type: 'insertText', text: text, range: span })
      if (o.insertTextThrows) throw new Error('insertText boom')
      if (o.insertTextFalseAt !== undefined) {
        const n = h.records.filter((r) => r.type === 'insertText').length
        if (n === o.insertTextFalseAt) return false
      }
      return commitInsert(h, text, span)
    }
  }
  return a
}

/** 解析一次插入的期望（与 applyInsert 契约同义）：剥全部标记、caret = 第一个标记在剥后文本中的偏移。 */
function planInsert(draft, caret, body) {
  const raw = draft == null ? '' : String(draft)
  const pos = Math.max(0, Math.min(Number.isFinite(caret) ? caret : raw.length, raw.length))
  const firstAt = String(body).indexOf(MARK)
  const text = String(body).split(MARK).join('')
  return {
    pos: pos,
    text: text,
    caret: firstAt < 0 ? null : firstAt,
    finalText: raw.slice(0, pos) + text + raw.slice(pos),
    markerAt: firstAt < 0 ? null : pos + firstAt,
    markerBody: firstAt < 0 ? null : text.slice(0, firstAt) + MARK + text.slice(firstAt),
  }
}

function countType(records, type) { return records.filter((r) => r.type === type).length }

/* ── A. marker 路径 undo/redo 全序列 ── */

function groupA() {
  section('A. applyInsert 有标记：两笔 paste，undo1 露标记 → undo2 回插入前草稿 → redo 重建')
  const cases = [
    ['abc', 3, 'SMART{{cursor}}END', '末尾光标'],
    ['abc', 1, 'SMART{{cursor}}END', '中间光标'],
    ['', 0, 'SMART{{cursor}}END', '空草稿'],
    ['a\nb', 2, 'x{{cursor}}y', '软换行草稿'],
    ['', 0, 'L1\n\n{{cursor}}\nL3', '空草稿 + 多行正文'],
  ]
  for (let i = 0; i < cases.length; i++) {
    const draft = cases[i][0]
    const caret = cases[i][1]
    const body = cases[i][2]
    const tag = 'A' + (i + 1) + ' [' + cases[i][3] + '] '
    const p = planInsert(draft, caret, body)
    const h = makeHost(draft, p.pos)
    const a = makeActions(h)
    let res = null
    let threw = null
    try { res = panel.applyInsert(a, draft, caret, body) } catch (e) { threw = e }
    ok(!threw, tag + '不抛错')
    if (threw || !res) continue

    // 插入后：文本/光标/交互序列
    eq(res.mode, 'span', tag + 'mode=span')
    eq(res.marker, true, tag + 'marker=true')
    eq(res.draftChars, String(draft).length, tag + 'draftChars = 插入前草稿长度')
    eq(res.text, p.finalText, tag + 'text = 剥标记后的整篇草稿')
    noMarker(res.text, tag + 'text 不含标记')
    eq(h.draft, p.finalText, tag + '宿主草稿逐字符正确')
    eq(h.caret, p.markerAt, tag + '光标精确落标记位')
    eq(h.records.length, 4, tag + '恰好四次宿主交互（两笔编辑 + 两次 captureInsertion）')
    eq(h.records.map((r) => r.type), ['captureInsertion', 'insertText', 'captureInsertion', 'insertText'], tag + '交互序列 = captureInsertion → insertText → captureInsertion → insertText')
    eq(countType(h.records, 'setDraft'), 0, tag + '成功路径不调用 setDraft（不变量）')
    if (h.records[1]) {
      eq(h.records[1].text, p.markerBody, tag + '第一笔只插「正文段 + 一个标记」（不含草稿前后缀）')
      eq(countMarker(h.records[1].text), 1, tag + '第一笔插入文本里只有一个标记')
      eq(h.records[1].range, { draftRev: 1, start: p.pos, end: p.pos }, tag + '第一笔区间 = 折叠光标 {draftRev:1, start:pos, end:pos}')
    }
    if (h.records[3]) {
      eq(h.records[3].text, '', tag + '第二笔第一个参数为空串（只删标记）')
      eq(h.records[3].range, { draftRev: 2, start: p.markerAt, end: p.markerAt + MARK.length }, tag + '第二笔区间 = 标记区间 {draftRev:2, start:markerAt, end:markerAt+10}')
    }

    // undo 全序列：undo1 露标记、undo2 回插入前、undo3 更早（有输入时）
    const typed = String(draft)
    const afterFirst = { draft: typed.slice(0, p.pos) + p.markerBody + typed.slice(p.pos), caret: p.pos + p.markerBody.length }
    const beforeInsert = { draft: typed, caret: p.pos }
    const initial = { draft: '', caret: 0 }

    ok(h.undoStep(), tag + 'undo1 有记录可撤')
    eq(h.state(), afterFirst, tag + 'undo1 = 插入后但删标记前（标记重新可见）')
    eq(countMarker(h.draft), 1, tag + 'undo1 草稿里恰好一个标记')
    ok(h.undoStep(), tag + 'undo2 有记录可撤')
    eq(h.state(), beforeInsert, tag + 'undo2 = 插入前草稿（#181 主修：不再吞掉插入前输入）')
    noMarker(h.draft, tag + 'undo2 草稿无标记')
    if (typed) {
      ok(h.undoStep(), tag + 'undo3 有记录可撤（更早的历史）')
      eq(h.state(), initial, tag + 'undo3 = 更早（空草稿）')
    }

    // redo 重建：先把 undo 走到底，再逐步重做（顺序 = 插入前 → 露标记态 → 最终态）
    while (h.undoStep()) { /* 撤到栈底 */ }
    const redos = []
    while (h.redoStep()) redos.push(h.state())
    const wantRedos = typed
      ? [beforeInsert, afterFirst, { draft: p.finalText, caret: p.markerAt }]
      : [afterFirst, { draft: p.finalText, caret: p.markerAt }]
    eq(redos.length, wantRedos.length, tag + 'redo 记录条数 = undo 条数（' + wantRedos.length + '）')
    for (let k = 0; k < wantRedos.length; k++) eq(redos[k], wantRedos[k], tag + 'redo' + (k + 1) + ' 重建第 ' + (k + 1) + ' 步状态')
    eq(h.state(), wantRedos[wantRedos.length - 1], tag + 'redo 到底 = 重建插入后最终态（无标记、光标在标记位）')
  }
}

/* ── B. 无标记路径 undo/redo ── */

function groupB() {
  section('B. applyInsert 无标记：单笔 insertText，undo1 回插入前草稿、redo 重建')
  const cases = [
    ['abc', 1, 'TAIL', '中间光标'],
    ['abc', 3, 'TAIL', '末尾光标'],
    ['', 0, 'TAIL', '空草稿'],
    ['a\nb', 2, 'X', '软换行草稿'],
    ['head', 4, '\nA\n\n', '正文含首尾换行'],
  ]
  for (let i = 0; i < cases.length; i++) {
    const draft = cases[i][0]
    const caret = cases[i][1]
    const body = cases[i][2]
    const tag = 'B' + (i + 1) + ' [' + cases[i][3] + '] '
    const p = planInsert(draft, caret, body)
    const h = makeHost(draft, p.pos)
    const a = makeActions(h)
    let res = null
    let threw = null
    try { res = panel.applyInsert(a, draft, caret, body) } catch (e) { threw = e }
    ok(!threw, tag + '不抛错')
    if (threw || !res) continue

    eq(res.mode, 'plain', tag + 'mode=plain（正常路径不记成降级）')
    eq(res.marker, false, tag + 'marker=false')
    eq(res.draftChars, String(draft).length, tag + 'draftChars = 插入前草稿长度')
    eq(res.text, p.finalText, tag + 'text 逐字符正确')
    eq(h.draft, p.finalText, tag + '宿主草稿逐字符正确')
    eq(h.caret, p.pos + body.length, tag + '光标落插入文本之后（#181 显式契约变更）')
    eq(h.records.length, 2, tag + '两次宿主交互（captureInsertion + insertText）')
    eq(h.records.map((r) => r.type), ['captureInsertion', 'insertText'], tag + '交互序列 = captureInsertion → insertText')
    eq(countType(h.records, 'setDraft'), 0, tag + '成功路径不调用 setDraft（不变量）')
    if (h.records[1]) eq(h.records[1].range, { draftRev: 1, start: p.pos, end: p.pos }, tag + 'insertText 区间 = 折叠光标 {draftRev:1, start:pos, end:pos}')

    const typed = String(draft)
    ok(h.undoStep(), tag + 'undo1 有记录可撤')
    eq(h.state(), { draft: typed, caret: p.pos }, tag + 'undo1 = 插入前草稿（不再连插入前输入一起撤）')
    if (typed) {
      ok(h.undoStep(), tag + 'undo2 有记录可撤（更早的历史）')
      eq(h.state(), { draft: '', caret: 0 }, tag + 'undo2 = 更早（空草稿）')
    } else {
      eq(h.undoStep(), false, tag + '空草稿 undo1 后已到栈底（undo2 无效）')
      eq(h.state(), { draft: '', caret: 0 }, tag + '空草稿 undo1 = 空草稿（旧版为不可撤销）')
    }
    const redos = []
    while (h.redoStep()) redos.push(h.state())
    const wantRedos = typed
      ? [{ draft: typed, caret: p.pos }, { draft: p.finalText, caret: p.pos + body.length }]
      : [{ draft: p.finalText, caret: p.pos + body.length }]
    eq(redos.length, wantRedos.length, tag + 'redo 记录条数 = undo 条数（' + wantRedos.length + '）')
    for (let k = 0; k < wantRedos.length; k++) eq(redos[k], wantRedos[k], tag + 'redo' + (k + 1) + ' 重建第 ' + (k + 1) + ' 步状态')
    eq(h.state(), { draft: p.finalText, caret: p.pos + body.length }, tag + 'redo 到底 = 重建插入后最终态')
  }
}

/* ── C. 降级阶梯矩阵 ── */

const MARKER_BODY = '前{{cursor}}后'
const PLAIN_BODY = '前X后'

function degradedCheck(label, body, opts) {
  const draft = opts.draft !== undefined ? opts.draft : 'head'
  const caret = opts.caret !== undefined ? opts.caret : String(draft).length
  const p = planInsert(draft, caret, body)
  const h = makeHost(draft, caret)
  const a = makeActions(h, opts)
  let res = null
  let threw = null
  try { res = panel.applyInsert(a, draft, caret, body) } catch (e) { threw = e }
  ok(!threw, label + '：不抛错')
  if (threw || !res) return
  eq(res.mode, 'degraded', label + '：mode=degraded')
  eq(res.text, p.finalText, label + '：text 逐字符正确（整篇拼接）')
  noMarker(res.text, label + '：text 无标记残留')
  eq(res.draftChars, String(draft).length, label + '：draftChars = 插入前草稿长度')
  const drafts = h.records.filter((r) => r.type === 'setDraft')
  ok(drafts.length >= 1, label + '：至少一次 setDraft 兜底')
  if (drafts.length > 0) eq(drafts[drafts.length - 1].text, p.finalText, label + '：最后一次 setDraft = 最终全文')
  eq(h.draft, p.finalText, label + '：宿主草稿逐字符正确')
  if (opts.expectCounts) {
    eq(countType(h.records, 'captureInsertion'), opts.expectCounts.capture, label + '：captureInsertion 调用次数')
    eq(countType(h.records, 'insertText'), opts.expectCounts.insert, label + '：insertText 调用次数')
  }
  if (opts.expectNoEditPrimitive) {
    eq(countType(h.records, 'captureInsertion'), 0, label + '：不尝试编辑原语（captureInsertion=0）')
    eq(countType(h.records, 'insertText'), 0, label + '：不尝试编辑原语（insertText=0）')
    eq(drafts.length, 1, label + '：恰好一次 setDraft')
  }
}

function groupC() {
  section('C. 降级阶梯：旧宿主 / 缺 action / 坐标不一致 / 非折叠 / false / 抛错 / chip ⇒ setDraft、mode=degraded')
  const triggers = [
    ['C1 marker 旧宿主只有 setDraft', MARKER_BODY, { noCapture: true, noInsertText: true, expectNoEditPrimitive: true }],
    ['C2 marker 缺 insertText', MARKER_BODY, { noInsertText: true, expectNoEditPrimitive: true }],
    ['C3 marker 缺 captureInsertion', MARKER_BODY, { noCapture: true, expectNoEditPrimitive: true }],
    ['C4 marker captureInsertion 抛错', MARKER_BODY, { captureThrows: true, expectCounts: { capture: 1, insert: 0 } }],
    ['C5 marker captureInsertion 无 draftRev', MARKER_BODY, { captureNoRev: true, expectCounts: { capture: 1, insert: 0 } }],
    ['C6 marker 坐标不一致（start != pos）', MARKER_BODY, { captureStart: 0, expectCounts: { capture: 1, insert: 0 } }],
    ['C7 marker 非折叠（start != end）', MARKER_BODY, { captureEnd: 2, expectCounts: { capture: 1, insert: 0 } }],
    ['C8 marker 第一笔 insertText 返回 false', MARKER_BODY, { insertTextFalseAt: 1, expectCounts: { capture: 1, insert: 1 } }],
    ['C9 marker 第二笔 insertText 返回 false', MARKER_BODY, { insertTextFalseAt: 2, expectCounts: { capture: 2, insert: 2 } }],
    ['C10 marker insertText 抛错', MARKER_BODY, { insertTextThrows: true, expectCounts: { capture: 1, insert: 1 } }],
    ['C11 marker 草稿含 U+FFFC 引用 chip', MARKER_BODY, { draft: 'head\uFFFC', expectNoEditPrimitive: true }],
    ['C12 marker 草稿含 U+E100 引用 chip', MARKER_BODY, { draft: 'a\uE100b', caret: 1, expectNoEditPrimitive: true }],
    ['C13 plain 旧宿主只有 setDraft', PLAIN_BODY, { noCapture: true, noInsertText: true, expectNoEditPrimitive: true }],
    ['C14 plain 缺 insertText', PLAIN_BODY, { noInsertText: true, expectNoEditPrimitive: true }],
    ['C15 plain 坐标不一致', PLAIN_BODY, { captureStart: 0, expectCounts: { capture: 1, insert: 0 } }],
    ['C16 plain 非折叠', PLAIN_BODY, { captureEnd: 2, expectCounts: { capture: 1, insert: 0 } }],
    ['C17 plain captureInsertion 抛错', PLAIN_BODY, { captureThrows: true, expectCounts: { capture: 1, insert: 0 } }],
    ['C18 plain insertText 返回 false', PLAIN_BODY, { insertTextFalseAt: 1, expectCounts: { capture: 1, insert: 1 } }],
    ['C19 plain insertText 抛错', PLAIN_BODY, { insertTextThrows: true, expectCounts: { capture: 1, insert: 1 } }],
    ['C20 plain 草稿含 U+FFFC 引用 chip', PLAIN_BODY, { draft: 'head\uFFFC', expectNoEditPrimitive: true }],
  ]
  for (let i = 0; i < triggers.length; i++) degradedCheck(triggers[i][0], triggers[i][1], triggers[i][2])
}

/* ── D. 无写入能力 / 调用约定 ── */

function groupD() {
  section('D. 无写入能力：不抛、text 正确、mode 保持 plain（不是降级，因为根本没写）')
  const noActions = panel.applyInsert(null, 'abc', 1, 'X')
  eq(noActions.text, 'aXbc', 'D1 无 actions：text 仍正确')
  eq(noActions.mode, 'plain', 'D2 无 actions：mode=plain')
  eq(noActions.marker, false, 'D3 无 actions：marker=false')

  const noSet = panel.applyInsert({}, 'abc', 1, 'X')
  eq(noSet.text, 'aXbc', 'D4 actions 无 setDraft：text 仍正确')
  eq(noSet.mode, 'plain', 'D5 actions 无 setDraft：mode=plain')

  const markerNoActions = panel.applyInsert(null, 'abc', 1, MARKER_BODY)
  eq(markerNoActions.text, 'a前后bc', 'D6 无 actions + 有标记：text 剥标记后正确（插在光标 1 处）')
  eq(markerNoActions.marker, true, 'D7 无 actions + 有标记：marker=true')
  eq(markerNoActions.mode, 'plain', 'D8 无 actions + 有标记：mode=plain（未写）')

  const clamp = panel.applyInsert(null, 'a', 99, 'Z')
  eq(clamp.text, 'aZ', 'D9 caret 越界 → clamp 到末尾')
  const neg = panel.applyInsert(null, 'abc', -5, 'Z')
  eq(neg.text, 'Zabc', 'D10 caret 负数 → clamp 到 0')

  const multi = panel.applyInsert(makeActions(makeHost('abc', 1)), 'abc', 1, 'A{{cursor}}B{{cursor}}C')
  eq(multi.text, 'aABCbc', 'D11 多个标记：只留第一个落点、其余从插入文本删除')
  eq(multi.mode, 'span', 'D12 多个标记：mode=span')
  noMarker(multi.text, 'D13 多个标记：text 无标记')
}

/* ── E. insertBody 集成：返回值 = 插入前草稿长度（pick.insert 契约） ── */

function groupE() {
  section('E. insertBody 集成：返回插入前草稿长度，且走同一套 applyInsert 契约')
  const savedDoc = globalThis.document
  const ta = {
    value: 'abc',
    selectionStart: 1,
    selectionEnd: 1,
    closest: () => null,
  }
  globalThis.document = {
    activeElement: null,
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: (sel) => (String(sel) === 'textarea' ? [ta] : []),
  }
  try {
    // 无标记：单笔可撤销编辑
    const h1 = makeHost('abc', 1)
    const ret1 = panel.insertBody(null, makeActions(h1), 'TAIL')
    eq(ret1, 3, 'E1 无标记：返回值 = 插入前草稿长度（legacy textarea 读法）')
    eq(h1.draft, 'aTAILbc', 'E2 无标记：草稿逐字符正确')
    eq(h1.caret, 5, 'E3 无标记：光标落插入文本之后')
    eq(countType(h1.records, 'setDraft'), 0, 'E4 无标记：成功路径不调用 setDraft')
    eq(countType(h1.records, 'insertText'), 1, 'E5 无标记：单笔 insertText')

    // 有标记：两笔可撤销编辑
    const h2 = makeHost('abc', 1)
    const ret2 = panel.insertBody(null, makeActions(h2), MARKER_BODY)
    eq(ret2, 3, 'E6 有标记：返回值 = 插入前草稿长度')
    eq(h2.draft, 'a前后bc', 'E7 有标记：草稿逐字符正确、无标记')
    eq(h2.caret, 2, 'E8 有标记：光标精确落标记位（pos 1 + 「前」1 字符）')
    eq(countType(h2.records, 'setDraft'), 0, 'E9 有标记：成功路径不调用 setDraft')
    eq(countType(h2.records, 'insertText'), 2, 'E10 有标记：两笔 insertText')

    // 无写入能力：不写、仍返回插入前长度、不抛
    const savedActions = null
    let ret3 = null
    let threw3 = null
    try { ret3 = panel.insertBody(null, savedActions, 'X') } catch (e) { threw3 = e }
    ok(!threw3, 'E11 无 actions：不抛错')
    eq(ret3, 3, 'E12 无 actions：仍返回插入前草稿长度')
  } finally {
    globalThis.document = savedDoc
  }
}

/* ── G. 失焦兜底（#180 × #181）：模型选择丢失时整框落位，但历史边界独立 ── */

function groupG() {
  section('G. 失焦且模型选择丢失：瞬时 paste 编辑顶开历史边界 → 整框落位 → 删标记，undo 仍分两步')
  const savedDoc = globalThis.document
  let root = null
  const focusRoot = { focus() { /* 模拟焦点回到作曲家根 */ } }
  root = focusRoot
  globalThis.document = {
    activeElement: null,
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
  }
  try {
    // 真机 #180 场景：焦点在别处、模型选择已丢（detect 坐标 0），但编辑期采样给出落点 2。
    const h = makeHost('abc', 0)
    const a = makeActions(h)
    let res = null
    let threw = null
    try { res = panel.applyInsert(a, 'abc', 2, 'X{{cursor}}Y', focusRoot) } catch (e) { threw = e }
    ok(!threw, 'G1 失焦兜底不抛错')
    if (res) {
      eq(res.mode, 'span', 'G2 失焦兜底成功时 mode=span')
      eq(h.draft, 'abXYc', 'G3 最终草稿 = 采样位置插入后的文本（无标记、无临时字符）')
      eq(h.caret, 3, 'G4 光标精确落标记位 3（#180 验收保持）')
      eq(h.records.map((r) => r.type), ['captureInsertion', 'captureInsertion', 'insertText', 'setDraft', 'captureInsertion', 'insertText'], 'G5 调用序列 = 读落点失败 → 再读修订号 → 瞬时编辑 → 整框写入 → 取新修订号 → 删标记')
      eq(countType(h.records, 'setDraft'), 1, 'G6 兜底恰好一次 setDraft（只在失焦且选择丢失这一支）')
      eq(h.records[2].text, 'x', 'G7 瞬时编辑是一笔独立的 paste 记录（非空文本，避免 setDraft 文本未变短路）')
      eq(h.records[2].range, { draftRev: 1, start: 0, end: 0 }, 'G8 瞬时编辑区间 {draftRev:1, start:0, end:0}')
      eq(h.records[3].text, 'abX{{cursor}}Yc', 'G9 整框写入的文本 = 插入后仍带标记的全文')
      eq(countMarker(h.records[3].text), 1, 'G10 整框写入文本恰好一个标记')
      eq(h.records[5].text, '', 'G11 最后一笔为空串（只删标记）')

      // undo 分组：临时边界独立成记录 ⇒ undo1 露标记、undo2 回插入前草稿（#181 主修）、undo3 更早。
      ok(h.undoStep(), 'G12 undo1 有记录可撤')
      eq(h.draft, 'abX{{cursor}}Yc', 'G13 undo1 = 露标记态（撤的是删标记那一步）')
      ok(h.undoStep(), 'G14 undo2 有记录可撤')
      eq(h.draft, 'abc', 'G15 undo2 = 插入前草稿（不再吞掉插入前输入）')
      noMarker(h.draft, 'G16 undo2 草稿无标记')
      ok(h.undoStep(), 'G17 undo3 有记录可撤（更早的历史）')
      eq(h.draft, '', 'G18 undo3 = 空草稿')
    }

    // 对照：作曲家本来就有焦点（wasFocused=true）且落点对不上 ⇒ 不走兜底，直接整框降级（只写一次、无瞬时编辑）。
    const hf = makeHost('abc', 0)
    const af = makeActions(hf)
    globalThis.document.activeElement = focusRoot
    let resf = null
    try { resf = panel.applyInsert(af, 'abc', 2, 'X{{cursor}}Y', focusRoot) } catch (e) { /* ignore */ }
    if (resf) {
      eq(resf.mode, 'degraded', 'G19 已聚焦但落点对不上：降级 mode=degraded（不猜位置）')
      eq(hf.draft, 'abXYc', 'G20 已聚焦降级：文本仍逐字符正确')
      eq(countType(hf.records, 'insertText'), 0, 'G21 已聚焦降级：不尝试半成品编辑原语')
      eq(countType(hf.records, 'setDraft'), 1, 'G22 已聚焦降级：恰好一次整框写入')
    }
  } finally {
    globalThis.document = savedDoc
  }
}

/* ── F. 源码不变量：applyInsert 不得再用 setDraft 写正文主路径 ── */

function groupF() {
  section('F. 源码不变量：applyInsert 用户意图写入只走 insertText，setDraft 只在降级分支')
  const src = readSrc('template-browser.ts')
  const fn = sliceFn(src, 'applyInsert')
  ok(fn.length > 0, 'F1 找到 export function applyInsert')
  ok(fn.indexOf("insertText(parsed.text") >= 0, 'F2 无标记路径调用 insertText 写正文')
  ok(fn.indexOf('insertText(markerBody') >= 0, 'F3 有标记路径第一笔调用 insertText(markerBody)')
  ok(fn.indexOf("insertText('', { draftRev: rev2") >= 0, 'F4 有标记路径第二笔调用 insertText 空串删标记')
  ok(fn.indexOf('cap1 === null && canEdit && focusRoot && !wasFocused') >= 0, 'F5 整框落位兜底只用于「失焦且模型选择丢失」这一支')
  const raw = fs.readFileSync(SRC('template-browser.ts'), 'utf8')
  const rawAt = raw.indexOf('export function applyInsert(')
  const rawHead = rawAt > 0 ? raw.slice(Math.max(0, rawAt - 4000), rawAt) : ''
  ok(rawHead.indexOf('history-merge') >= 0, 'F6 函数头注释记录宿主 history-merge 分组语义（可维护性）')
  const setDraftCalls = (fn.match(/inputActions\.setDraft\(/g) || []).length
  eq(setDraftCalls, 3, 'F7 applyInsert 里只有三处 setDraft（无标记降级 + 有标记降级 + 失焦兜底）')
}

/* ── 主流程 ── */

function main() {
  groupA()
  groupB()
  groupC()
  groupD()
  groupE()
  groupF()
  groupG()
  console.log('\n' + (failures === 0 ? 'ALL PASS: #181 (' + passCount + ' assertions)' : failures + ' FAILED / ' + passCount + ' passed'))
  process.exitCode = failures === 0 ? 0 : 1
}

main()
