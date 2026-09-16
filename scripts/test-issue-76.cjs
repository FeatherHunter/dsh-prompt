// 回归测试 #76: 点击模板插入后输入框原有换行丢失，聚成一段
// 真机形态（已确认）：Shift+Enter 软换行 × 悬浮列表，严格原样拼接。
// 根因：readEditable 只处理直接子节点的 BR/块边界，嵌套内的换行全丢；
//   resolveDraft 又优先采纳有损的 DOM 活读，经 setDraft 全文替换放大为数据丢失。
//   A 软换行三行保真（主回归，真机形态）
//   B 软换行段中光标处注入
//   C 嵌套块换行保真
//   D 硬段落 caret 映射不受影响（旧 T2 语义）
//   E 换行护栏：DOM 读数漏换行时信桥草稿（同内容仅换行有别，取换行多的）
//   F 末尾换行符不残留（段落末尾 BR 不凭空加空行）
//   G 真空/引用 chip 旧语义不受影响
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }
const DIR = path.join(__dirname, '.rt-tmp');
fs.mkdirSync(DIR, { recursive: true });
const SRC = (f) => path.join(__dirname, '..', 'src', 'client', f);
const MODULES = [
  ['templates76.cjs', SRC('templates.ts'), []],
  ['store76.cjs', SRC('store.ts'), ['./templates']],
  ['state76.cjs', SRC('state.ts'), []],
  ['i1876.cjs', SRC('i18n.ts'), []],
  ['smartstore76.cjs', SRC('smartstore.ts'), []],
  ['panel76.cjs', SRC('panel.ts'), ['./templates', './store', './state', './i18n', './smartstore']],
];
for (const [outName, srcPath, deps] of MODULES) {
  let src = fs.readFileSync(srcPath, 'utf8');
  let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true } }).outputText;
  for (const d of deps) {
    const base = d.replace(/^\.\//, '');
    const outBase = base === 'i18n' ? 'i1876.cjs' : base + '76.cjs';
    js = js.split('require("' + d + '")').join('require("./' + outBase + '")');
    js = js.split("require('" + d + "')").join('require("./' + outBase + '")');
  }
  fs.writeFileSync(path.join(DIR, outName), js);
}
if (typeof global.MutationObserver === 'undefined') {
  global.MutationObserver = class { constructor() {} observe() {} disconnect() {} };
}
const panel = require(path.join(DIR, 'panel76.cjs'));
const React = require('react');
const TR = require('react-test-renderer');

let failures = 0;
function ok(cond, msg) {
  if (cond) { console.log('  PASS ' + msg); return; }
  failures++;
  console.log('  FAIL ' + msg);
}

function tnode(text) {
  return { nodeType: 3, nodeValue: text, textContent: text };
}
function el(tag, kids, extra) {
  const e = Object.assign({
    nodeType: 1, tagName: tag, childNodes: kids || [],
    textContent: (kids || []).map((k) => k.textContent || k.nodeValue || '').join(''),
    contains(n) { return n === e || (kids || []).some((k) => k === n || (k.contains && k.contains(n))); },
    closest: () => null,
  }, extra || {});
  return e;
}
function bodyEl() {
  return { tagName: 'BODY', closest: () => null, getAttribute: () => null };
}
function makeDocument(areas, active) {
  return {
    activeElement: active || bodyEl(),
    documentElement: { lang: 'zh-CN' },
    querySelectorAll(sel) {
      if (String(sel).indexOf('contenteditable') >= 0) return areas.slice();
      if (sel === 'textarea') return [];
      return [];
    },
    querySelector(sel) {
      if (String(sel).indexOf('contenteditable') >= 0) return areas[0] || null;
      return null;
    },
    addEventListener() {},
    removeEventListener: () => {},
  };
}
function setSelection(tn, offset) {
  const sel = tn ? { rangeCount: 1, anchorNode: tn, anchorOffset: offset } : { rangeCount: 0, anchorNode: null, anchorOffset: 0 };
  global.getSelection = () => sel;
  global.window = { getSelection: () => sel, addEventListener: () => {}, removeEventListener: () => {} };
}
function setAnchor(node, offset) {
  const sel = { rangeCount: 1, anchorNode: node, anchorOffset: offset };
  global.getSelection = () => sel;
  global.window = { getSelection: () => sel, addEventListener: () => {}, removeEventListener: () => {} };
}
function bareHook(draft) {
  const fn = (sel) => sel({ draft });
  return fn;
}
function tap(draft) {
  let r = null;
  TR.act(() => { r = TR.create(React.createElement(panel.DraftTap, { useInput: bareHook(draft) })); });
  return r;
}
const NOP_BRIDGE = () => { throw new Error('must not be called outside render'); };
function composerRoot(kids) {
  return el('DIV', kids, {
    getAttribute(k) { return k === 'contenteditable' ? 'true' : null; },
    closest(sel) { if (sel === '[data-composer-card]') return {}; return null; },
  });
}
// 真机形态：同一段落内 <span>行</span><br>…（Shift+Enter 软换行）
function softPara(lines) {
  const kids = [];
  lines.forEach((ln, i) => {
    if (i > 0) kids.push(el('BR', []));
    kids.push(el('SPAN', [tnode(ln)]));
  });
  return el('P', kids);
}

console.log('=== T-A: 软换行三行保真（真机形态，行首注入） ===');
{
  const t1 = tnode('第一句');
  const p = el('P', [el('SPAN', [t1]), el('BR', []), el('SPAN', [tnode('第二句')]), el('BR', []), el('SPAN', [tnode('第三句')])]);
  const root = composerRoot([p]);
  global.document = makeDocument([root], root);
  setSelection(t1, 0);
  tap('第一句\n第二句\n第三句');
  let got = null;
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === '[TPL]第一句\n第二句\n第三句', '软换行保留且行首注入，实际=' + JSON.stringify(got));
}

console.log('=== T-B: 软换行段中光标处注入 ===');
{
  const t2 = tnode('第二句');
  const p = el('P', [el('SPAN', [tnode('第一句')]), el('BR', []), el('SPAN', [t2]), el('BR', []), el('SPAN', [tnode('第三句')])]);
  const root = composerRoot([p]);
  global.document = makeDocument([root], root);
  setSelection(t2, 1);
  tap('第一句\n第二句\n第三句');
  let got = null;
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === '第一句\n第[TPL]二句\n第三句', '段中光标处注入且换行保留，实际=' + JSON.stringify(got));
}

console.log('=== T-C: 嵌套块换行保真（三行） ===');
{
  const t1 = tnode('第一句');
  const inner1 = el('DIV', [t1]);
  const inner2 = el('DIV', [tnode('第二句')]);
  const inner3 = el('DIV', [tnode('第三句')]);
  const outer = el('DIV', [inner1, inner2, inner3]);
  const root = composerRoot([outer]);
  global.document = makeDocument([root], root);
  setSelection(t1, 0);
  tap('第一句\n第二句\n第三句');
  let got = null;
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === '[TPL]第一句\n第二句\n第三句', '嵌套块边界换行保留，实际=' + JSON.stringify(got));
}

console.log('=== T-C2: 三硬段落保真 ===');
{
  const t3 = tnode('第三句');
  const root = composerRoot([el('P', [tnode('第一句')]), el('P', [tnode('第二句')]), el('P', [t3])]);
  global.document = makeDocument([root], root);
  setSelection(t3, 0);
  tap('第一句\n第二句\n第三句');
  let got = null;
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === '第一句\n第二句\n[TPL]第三句', '三段落行首注入，实际=' + JSON.stringify(got));
}

console.log('=== T-D: 硬段落 caret 映射不受影响 ===');
{
  const t2 = tnode('CD');
  const p1 = el('P', [tnode('AB')]);
  const p2 = el('P', [t2]);
  const root = composerRoot([p1, p2]);
  global.document = makeDocument([root], root);
  setSelection(t2, 1);
  tap('AB\nCD');
  let got = null;
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === 'AB\nC[TPL]D', '第二段内光标处注入，实际=' + JSON.stringify(got));
}

console.log('=== T-E: 换行护栏（DOM 漏换行时信桥草稿） ===');
{
  // DOM 真实值被读成无换行的Collapsed形（旧读数行为），桥草稿正确 → 取换行多的桥
  const t = tnode('第一句第二句第三句');
  const p = el('P', [el('SPAN', [t])]);
  const root = composerRoot([p]);
  global.document = makeDocument([root], root);
  setSelection(t, 0);
  tap('第一句\n第二句\n第三句');
  let got = null;
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === '[TPL]第一句\n第二句\n第三句', '护栏兜底不断换行，实际=' + JSON.stringify(got));
}

console.log('=== T-F: 段落末尾换行符不残留 ===');
{
  const t = tnode('单行');
  const p = el('P', [el('SPAN', [t]), el('BR', [])]);
  const root = composerRoot([p]);
  global.document = makeDocument([root], root);
  setSelection(t, 2);
  tap('单行');
  let got = null;
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === '单行[TPL]', '末尾 BR 不凭空加空行，实际=' + JSON.stringify(got));
}

console.log('=== T-G: 真空与引用 chip 旧语义不受影响 ===');
{
  global.document = makeDocument([], bodyEl());
  setSelection(null);
  tap('');
  let got = 'unset';
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === '[TPL]', '真空即创建，实际=' + JSON.stringify(got));
}
{
  const t = tnode('A@fileB');
  const p = el('P', [el('SPAN', [t])]);
  const root = composerRoot([p]);
  global.document = makeDocument([root], root);
  setSelection(t, 6);
  tap('A\uFFFCB');
  let got = null;
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === 'A\uFFFCB[TPL]', 'chip 编码不被显示形破坏，实际=' + JSON.stringify(got));
}

console.log('=== T-H: 纯末尾差异信桥且光标保留 ===');
{
  const t = tnode('AB');
  const p = el('P', [el('SPAN', [t])]);
  const root = composerRoot([p]);
  global.document = makeDocument([root], root);
  setSelection(t, 1);
  tap('AB\n');
  let got = null;
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === 'A[TPL]B\n', '桥末尾换行保留且段中光标不丢，实际=' + JSON.stringify(got));
}

console.log('=== T-I: 空段落即空行（换行不折叠） ===');
{
  const t = tnode('第二句');
  const root = composerRoot([el('P', [tnode('第一句')]), el('P', []), el('P', [t])]);
  global.document = makeDocument([root], root);
  setSelection(t, 0);
  tap('第一句\n\n第二句');
  let got = null;
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === '第一句\n\n[TPL]第二句', '空行保留，实际=' + JSON.stringify(got));
}

console.log('=== T-J: 元素锚点光标映射 ===');
{
  const p1 = el('P', [tnode('AB')]);
  const p2 = el('P', [tnode('CD')]);
  const root = composerRoot([p1, p2]);
  global.document = makeDocument([root], root);
  setAnchor(root, 1);
  tap('AB\nCD');
  let got = null;
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === 'AB\n[TPL]CD', '根锚点落到第二块行首，实际=' + JSON.stringify(got));
}
{
  const p1 = el('P', [tnode('AB')]);
  const p2 = el('P', [tnode('CD')]);
  const root = composerRoot([p1, p2]);
  global.document = makeDocument([root], root);
  setAnchor(p2, 0);
  tap('AB\nCD');
  let got = null;
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === 'AB\n[TPL]CD', '块元素锚点落到块首，实际=' + JSON.stringify(got));
}

delete global.document;
delete global.window;
delete global.getSelection;
if (failures > 0) { console.log('FAILURES: ' + failures); process.exit(1); }
console.log('ALL PASS: #76');
