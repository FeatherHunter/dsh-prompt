// 回归测试 #76: 点击模板插入后输入框原有换行丢失 + 落点错位（真机两轮报障）
// 真机形态（已确认）：Shift+Enter 软换行 × 悬浮列表，严格原样拼接。
// 根因：readEditable 只处理直接子节点的 BR/块边界，嵌套内的换行全丢；resolveDraft 又优先
//   采纳有损的 DOM 活读，经 setDraft 全文替换放大为数据丢失；失焦后活选择被浏览器归一化到
//   上一行末尾，落点又照读照插。
//   A 软换行三行保真（主回归，真机形态）
//   B 软换行段中光标处注入
//   C 嵌套块换行保真（三行）
//   C2 三硬段落保真
//   D 硬段落 caret 映射不受影响（旧 T2 语义）
//   E 换行护栏：DOM 读数漏换行时信桥草稿（同内容仅换行有别）
//   F 末尾换行符不残留（段落末尾 BR 不凭空加空行）
//   G 真空/引用 chip 旧语义不受影响
//   H 纯末尾差异信桥且光标保留
//   I 空段落即空行（换行不折叠）
//   J 元素锚点光标映射（根锚点 / 块元素锚点）
//   K 失焦后仍用编辑期落点（真机第二行错位的对症回归）
//   L 作曲家持焦点时活读优先（采样不抢活落点）
//   M DOM 多出换行（幻影空行）时信宿主模型
//   N 失焦后的选择变化不覆盖编辑期采样
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
  const listeners = {};
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
    addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener: () => {},
    dispatch(t, ev) { (listeners[t] || []).forEach((fn) => fn(ev)); },
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

console.log('=== T-K: 失焦后仍用编辑期落点（真机第二行错位的对症回归） ===');
{
  const t1 = tnode('第一句');
  const t2 = tnode('第二句');
  const p1 = el('P', [t1]);
  const p2 = el('P', [t2]);
  const p3 = el('P', [tnode('第三句')]);
  const root = composerRoot([p1, p2, p3]);
  global.document = makeDocument([root], root);   // 焦点在作曲家
  setAnchor(t2, 1);                               // 用户在第二行打字（落点在第二行内）
  panel.insertBody(NOP_BRIDGE, { setDraft: () => {} }, ''); // 首调：挂监听 + 立刻采样
  global.document.activeElement = bodyEl();       // 面板交互把焦点挪走
  setAnchor(p1, 1);                               // 失焦后选择被浏览器归一化到第一行末尾
  tap('第一句\n第二句\n第三句');
  let got = null;
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === '第一句\n第[TPL]二句\n第三句', '落点仍取编辑期采样（第二行内），实际=' + JSON.stringify(got));
}

console.log('=== T-L: 作曲家持焦点时活读优先（采样不抢活落点） ===');
{
  const t3 = tnode('第三句');
  const p1 = el('P', [tnode('第一句')]);
  const p2 = el('P', [tnode('第二句')]);
  const p3 = el('P', [t3]);
  const root = composerRoot([p1, p2, p3]);
  global.document = makeDocument([root], root);
  setAnchor(t3, 1);                               // 焦点仍在作曲家，落点在第三行
  tap('第一句\n第二句\n第三句');
  let got = null;
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === '第一句\n第二句\n第[TPL]三句', '活了读优先，实际=' + JSON.stringify(got));
}

console.log('=== T-M: DOM 多出换行（幻影空行）时信宿主模型 ===');
{
  // D 读到 4 段（多一个空块 → 多一个 \\n），H 是宿主的 3 行真值 → 取 H
  const t = tnode('第二句');
  const root = composerRoot([el('P', [tnode('第一句')]), el('P', []), el('P', [t])]);
  global.document = makeDocument([root], root);
  setAnchor(t, 0);
  tap('第一句\n第二句');      // 宿主模型：两行，没有幻影空行
  let got = null;
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === '第一句\n[TPL]第二句', '幻影空行不入结果，实际=' + JSON.stringify(got));
}

console.log('=== T-N: 失焦后的选择变化不覆盖编辑期采样 ===');
{
  const t2 = tnode('第二句');
  const p1 = el('P', [tnode('第一句')]);
  const p2 = el('P', [t2]);
  const root = composerRoot([p1, p2]);
  global.document = makeDocument([root], root);
  setAnchor(t2, 0);                                // 编辑期落点：第二行行首
  panel.insertBody(NOP_BRIDGE, { setDraft: () => {} }, ''); // 挂监听 + 立刻采样（第二行行首）
  global.document.activeElement = bodyEl();        // 失焦
  setAnchor(p1, 1);                                // 失焦后的漂移
  global.document.dispatch('selectionchange', {}); // 失焦后的 selectionchange 不得改写采样
  tap('第一句\n第二句');
  let got = null;
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === '第一句\n[TPL]第二句', '采样不被失焦后的漂移覆盖，实际=' + JSON.stringify(got));
}

console.log('=== T-P: 幻影空行 + 落点在下一行行首（整段跨换行） ===');
{
  // D（DOM）：三行；H（宿主模型）：中间多一个空行。
  // 落点在第二行行首 —— 目标处要跨过整段换行，模板必须紧贴"第二句"，不能停在空行上。
  const t = tnode('第二句');
  const root = composerRoot([el('P', [tnode('第一句')]), el('P', [t]), el('P', [tnode('第三句')])]);
  global.document = makeDocument([root], root);
  setAnchor(t, 0);
  tap('第一句\n\n第二句\n第三句');
  let got = null;
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === '第一句\n\n[TPL]第二句\n第三句', '落点贴住第二行行首，实际=' + JSON.stringify(got));
}

console.log('=== T-Q: 行尾落点不越过换行（侧向保持） ===');
{
  const t = tnode('11111');
  const root = composerRoot([el('P', [t]), el('P', []), el('P', [tnode('22222')])]);
  global.document = makeDocument([root], root);
  setAnchor(t, 5);                                  // 落在第一行行尾（换行之前）
  tap('11111\n22222');
  let got = null;
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === '11111[TPL]\n22222', '行尾落点保持在换行之前，实际=' + JSON.stringify(got));
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
