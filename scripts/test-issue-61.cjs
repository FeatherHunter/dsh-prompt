// 回归测试 #61: 悬浮列表点击插入直接覆盖输入框草稿
// 真根因（宿主源码实证 dsh-client-ui-conversation）：
//   1) 会话输入框是 Lexical contenteditable div，根本没有 textarea；
//   2) useInput 是裸 selector hook（无 getState/getSnapshot，只能 render 内调用）。
// 旧代码两条路全瞎 → setDraft(模板正文) 整框覆盖。真修复只信两样活物：
//   H=render 内 DraftTap 订阅的已提交草稿，D=点击瞬间 contenteditable 活读（含组词中文字）。
// 本文件所有 mock 都按宿主真形状来：useInput 是裸函数（绝无 getState），输入框是
// contenteditable div（绝无 textarea，末路兼容测试除外）。
//   T1 无桥可读 + 失焦 → DOM 活读保留拼接（H1 主回归的新形态）
//   T2 多段落 caret 映射（段落↔\n，光标落在第二段内）
//   T3 focusin 缓存：多 editable + 失焦命中最后摸过的框
//   T4 分歧：hook 已提交 AB vs DOM 组词中 ABc → 信看得见的
//   T5 引用 chip：hook 含 U+FFFC vs DOM 显示形 → 信桥保编码
//   T6 裸 hook 在事件回调里一次都不调（Q3 真形态）+ 全程无抛错
//   T7 onPick：设置页无桥纯管理；面板有桥保留拼接 + 用量 +1
//   T8 行保焦 keepComposerFocus：BODY 下 preventDefault + 送回作曲家；面板搜索框内不抢
//   T9 入口按钮 mousedown 同款保焦
//   T10 真空：两边全空 → setDraft(正文) 即创建，无内容可丢
//   T11 行首 0 光标被尊重（前插非后插）
//   T12 弹窗内 editable 被排除（不读自家弹窗）
//   T13 末路 textarea 兼容（宿主史前形态）
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }
const DIR = path.join(__dirname, '.rt-tmp');
fs.mkdirSync(DIR, { recursive: true });
const SRC = (f) => path.join(__dirname, '..', 'src', 'client', f);
const MODULES = [
  ['templates.ts', SRC('templates.ts'), []],
  ['store.ts', SRC('store.ts'), ['./templates']],
  ['state.ts', SRC('state.ts'), []],
  ['i18n.ts', SRC('i18n.ts'), []],
  ['smartstore.ts', SRC('smartstore.ts'), []],
  ['panel.ts', SRC('panel.ts'), ['./templates', './store', './state', './i18n', './smartstore']],
  ['button.ts', SRC('button.ts'), ['./panel', './state', './i18n']],
];
for (const [outName, srcPath, deps] of MODULES) {
  const src = fs.readFileSync(srcPath, 'utf8');
  let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true } }).outputText;
  for (const d of deps) js = js.split('require("' + d + '")').join('require("' + d + '.cjs")');
  fs.writeFileSync(path.join(DIR, outName.replace(/\.ts$/, '.cjs')), js);
}
if (typeof global.MutationObserver === 'undefined') {
  global.MutationObserver = class { constructor() {} observe() {} disconnect() {} };
}
const panel = require(path.join(DIR, 'panel.cjs'));
const button = require(path.join(DIR, 'button.cjs'));
const store = require(path.join(DIR, 'store.cjs'));
const { tr, STR } = require(path.join(DIR, 'i18n.cjs'));
const zh = (k) => tr('zh', STR[k]);

const React = require('react');
const TR = require('react-test-renderer');

let failures = 0;
function ok(cond, msg) {
  if (cond) { console.log('  PASS ' + msg); return; }
  failures++;
  console.log('  FAIL ' + msg);
}

// —— DOM mock（宿主真形状：contenteditable div + <p> 段落 + getSelection）——
function tnode(text) {
  return { nodeType: 3, nodeValue: text, textContent: text };
}
function pnode(text) {
  const tn = tnode(text);
  const p = {
    nodeType: 1, tagName: 'P', textContent: text, childNodes: [tn],
    contains(n) { return n === tn || n === p; },
    closest: () => null,
  };
  p._tn = tn;
  return p;
}
function ediv(paras, opts) {
  opts = opts || {};
  const kids = paras.map(pnode);
  const el = {
    nodeType: 1, tagName: 'DIV', childNodes: kids,
    textContent: paras.join('\n'),
    getAttribute(k) { return k === 'contenteditable' ? 'true' : null; },
    contains(n) { return n === el || kids.some((k) => k === n || k._tn === n); },
    closest(sel) {
      if (sel === '[data-composer-card]') return opts.card === false ? null : {};
      if (opts.modal && sel.indexOf('modal') >= 0) return {};
      return null;
    },
    isConnected: true, _focused: false,
    focus() { this._focused = true; },
  };
  return el;
}
function bodyEl() {
  return { tagName: 'BODY', closest: () => null, getAttribute: () => null };
}
function makeDocument(opts) {
  opts = opts || {};
  const listeners = {};
  const doc = {
    activeElement: opts.active || bodyEl(),
    documentElement: { lang: 'zh-CN' },
    _areas: opts.areas || [],
    _tas: opts.textareas || [],
    querySelectorAll(sel) {
      if (String(sel).indexOf('contenteditable') >= 0) return doc._areas.slice();
      if (sel === 'textarea') return doc._tas.slice();
      return [];
    },
    querySelector(sel) {
      if (String(sel).indexOf('contenteditable') >= 0) return doc._areas[0] || null;
      return null;
    },
    addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener: () => {},
    dispatch(t, ev) { (listeners[t] || []).forEach((fn) => fn(ev)); },
  };
  return doc;
}
// selection：锚在某 <p> 文本节点的偏移；null=无选择（回末尾）
function setSelection(tn, offset) {
  const sel = tn ? { rangeCount: 1, anchorNode: tn, anchorOffset: offset } : { rangeCount: 0, anchorNode: null, anchorOffset: 0 };
  global.getSelection = () => sel;
  global.window = { getSelection: () => sel, addEventListener: () => {}, removeEventListener: () => {} };
}
// 裸 hook（宿主真形状：裸函数，无 getState/getSnapshot/subscribe）
function bareHook(draft, counter) {
  const fn = (sel) => { if (counter) counter.n += 1; return sel({ draft }); };
  return fn;
}
// render 内订阅一次（非法 render 外调用；每测必先调，保证 tapDraft 确定）
function tap(draft, counter) {
  let r = null;
  TR.act(() => { r = TR.create(React.createElement(panel.DraftTap, { useInput: bareHook(draft, counter) })); });
  return r;
}
const NOP_BRIDGE = () => { throw new Error('must not be called outside render'); };

console.log('=== T1: 无桥可读 + 失焦 → DOM 活读保留拼接 ===');
{
  const ed = ediv(['ABCDEF']);
  global.document = makeDocument({ areas: [ed], active: bodyEl() });
  setSelection(ed.childNodes[0]._tn, 2);
  tap('');
  let got = null;
  const r = panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === 'AB[TPL]CDEF', '失焦 + 桥空仍保留并拼接，实际=' + JSON.stringify(got));
  ok(r === 6, '返回插入前草稿长度 6，实际=' + r);
}

console.log('=== T2: 多段落 caret 映射 ===');
{
  const ed = ediv(['AB', 'CD']);
  global.document = makeDocument({ areas: [ed], active: ed });
  setSelection(ed.childNodes[1]._tn, 1);
  tap('AB\nCD');
  let got = null;
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === 'AB\nC[TPL]D', '第二段内光标处注入，实际=' + JSON.stringify(got));
}

console.log('=== T3: focusin 缓存命中最后摸过的框 ===');
{
  const a = ediv(['AAA']);
  const b = ediv(['BBB']);
  global.document = makeDocument({ areas: [a, b], active: bodyEl() });
  setSelection(null);
  tap('');
  panel.insertBody(NOP_BRIDGE, { setDraft: () => {} }, '[X]'); // 挂上 focusin 监听
  global.document.dispatch('focusin', { target: b }); // 用户最后在 B 里打字
  setSelection(b.childNodes[0]._tn, 2);
  let got = null;
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === 'BB[TPL]B', '缓存命中 B（含其光标 2），实际=' + JSON.stringify(got));
}

console.log('=== T4: 组词中分歧信看得见的 ===');
{
  const ed = ediv(['ABc']);
  global.document = makeDocument({ areas: [ed], active: ed });
  setSelection(ed.childNodes[0]._tn, 3);
  tap('AB'); // 桥里还是已提交的 AB，c 尚未提交
  let got = null;
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === 'ABc[TPL]', '组词中文字不丢，实际=' + JSON.stringify(got));
}

console.log('=== T5: 引用 chip 信桥保编码 ===');
{
  const ed = ediv(['A@fileB']);
  global.document = makeDocument({ areas: [ed], active: ed });
  setSelection(ed.childNodes[0]._tn, 6);
  tap('A\uFFFCB'); // 存储形带 chip 占位，显示形是对不上的
  let got = null;
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === 'A\uFFFCB[TPL]', 'chip 编码不被显示形破坏，实际=' + JSON.stringify(got));
}

console.log('=== T6: 裸 hook 在事件回调里零调用 ===');
{
  const ed = ediv(['ABCDEF']);
  global.document = makeDocument({ areas: [ed], active: ed });
  setSelection(ed.childNodes[0]._tn, 2);
  const counter = { n: 0 };
  tap('ABCDEF', counter);
  const before = counter.n;
  let got = null;
  let threw = false;
  try {
    panel.insertBody(bareHook('STALE', counter), { setDraft: (v) => { got = v; } }, '[TPL]');
  } catch (e) { threw = true; }
  ok(!threw, '全程无抛错');
  ok(counter.n === before, 'insertBody 内一次都没调 hook（render 外调用即抛，Q3）');
  ok(got === 'AB[TPL]CDEF', '草稿保留，实际=' + JSON.stringify(got));
}

console.log('=== T7: onPick 无桥纯管理；有桥保留拼接 + 用量 +1 ===');
{
  global.document = makeDocument({ areas: [ediv(['草稿'])] });
  setSelection(null);
  tap('');
  try {
    panel.onPick({ id: 't-noop', builtin: true, body: '[TPL]' }, undefined, undefined);
    panel.onPick({ id: 't-noop', builtin: true, body: '[TPL]' }, undefined, {});
    ok(true, '无桥 onPick 无写入、无抛错');
  } catch (e) { ok(false, '无桥 onPick 不应抛错：' + (e && e.message)); }
  const before = store.loadUsage()['t-noop'] || 0;
  ok(before === 0, '无桥 onPick 不涨用量');
}
{
  const ed = ediv(['AB']);
  global.document = makeDocument({ areas: [ed], active: bodyEl() });
  setSelection(ed.childNodes[0]._tn, 1);
  tap('AB');
  let got = null;
  const tpl = { id: 't-pick-61', builtin: true, body: '[TPL]' };
  const before = store.loadUsage()[tpl.id] || 0;
  panel.onPick(tpl, NOP_BRIDGE, { setDraft: (v) => { got = v; } });
  ok(got === 'A[TPL]B', '有桥 onPick 保留拼接，实际=' + JSON.stringify(got));
  ok((store.loadUsage()[tpl.id] || 0) === before + 1, '有桥 onPick 用量 +1');
}

console.log('=== T8: 行保焦 keepComposerFocus（不抢搜索框） ===');
{
  global.document = makeDocument();
  let compact = null;
  TR.act(() => { compact = TR.create(React.createElement(panel.TemplateBrowser, { compact: true })); });
  const rows = compact.root.findAll((x) => x.props && x.props['data-dsh-prompt-id']);
  ok(rows.length > 0, '悬浮列表渲染出行，行数=' + rows.length);
  ok(rows.every((r) => r.props.onMouseDown === panel.keepComposerFocus), '悬浮行全部挂 keepComposerFocus');
}
{
  const ed = ediv(['AB']);
  const aeBody = bodyEl();
  global.document = makeDocument({ areas: [ed], active: aeBody });
  let prevented = false;
  panel.keepComposerFocus({ preventDefault: () => { prevented = true; } });
  ok(prevented, 'mousedown 默认行为被拦（焦点不离开）');
  ok(ed._focused === true, 'BODY 下焦点送回作曲家');
}
{
  const ed = ediv(['AB']);
  const aeSearch = { tagName: 'INPUT', getAttribute: () => null, closest: (sel) => (String(sel).indexOf('panel-root') >= 0 ? {} : null) };
  global.document = makeDocument({ areas: [ed], active: aeSearch });
  let prevented = false;
  panel.keepComposerFocus({ preventDefault: () => { prevented = true; } });
  ok(prevented, '搜索框内同样 preventDefault');
  ok(ed._focused !== true, '搜索框内不抢焦点（面板不误关）');
}

console.log('=== T9: 入口按钮 mousedown 同款保焦 ===');
{
  let btn = null;
  TR.act(() => { btn = TR.create(React.createElement(button.EntryButton, { open: false })); });
  const node = btn.root.find((x) => x.props && x.props['data-dsh-prompt-entry']);
  ok(node.props.onMouseDown === panel.keepComposerFocus, '入口按钮挂 keepComposerFocus');
}

console.log('=== T10: 真空即创建 ===');
{
  global.document = makeDocument({ areas: [], active: bodyEl() });
  setSelection(null);
  tap('');
  let got = 'unset';
  const r = panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === '[TPL]', '两边全空即创建，实际=' + JSON.stringify(got));
  ok(r === 0, '返回 0');
}

console.log('=== T11: 行首 0 光标被尊重 ===');
{
  const ed = ediv(['AB']);
  global.document = makeDocument({ areas: [ed], active: ed });
  setSelection(ed.childNodes[0]._tn, 0);
  tap('AB');
  let got = null;
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === '[TPL]AB', '行首前插非后插，实际=' + JSON.stringify(got));
}

console.log('=== T12: 弹窗内 editable 被排除 ===');
{
  const modalEd = ediv(['弹窗输入'], { modal: true });
  global.document = makeDocument({ areas: [modalEd], active: bodyEl() });
  setSelection(null);
  tap('');
  let got = 'unset';
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === '[TPL]', '自家弹窗不被当草稿读，实际=' + JSON.stringify(got));
}

console.log('=== T13: 末路 textarea 兼容 ===');
{
  const ta = { nodeType: 1, tagName: 'TEXTAREA', value: 'AB', selectionStart: 1, closest: () => null };
  global.document = makeDocument({ areas: [], active: bodyEl(), textareas: [ta] });
  setSelection(null);
  tap('');
  let got = null;
  panel.insertBody(NOP_BRIDGE, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === 'A[TPL]B', '史前形态仍拼接，实际=' + JSON.stringify(got));
}

console.log('=== T14: 设置页行无插入承诺 ===');
{
  global.document = makeDocument();
  let full = null;
  TR.act(() => { full = TR.create(React.createElement(panel.TemplateBrowser, { compact: false })); });
  const srows = full.root.findAll((x) => x.props && x.props['data-dsh-prompt-id']);
  ok(srows.length > 0, '设置页渲染出行，行数=' + srows.length);
  ok(srows.every((r) => typeof r.props.onClick !== 'function'), '设置页行无 onClick（不行插入）');
  ok(srows.every((r) => String(r.props.title || '').indexOf(zh('insertHint')) < 0), '设置页行标题不承诺插入');
}

delete global.document;
delete global.window;
delete global.getSelection;
if (failures > 0) { console.log('FAILURES: ' + failures); process.exit(1); }
console.log('ALL PASS: #61');
