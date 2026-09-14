// 回归测试 #61: 悬浮列表点击插入直接覆盖输入框草稿
// 根因（第一性原理）：插入时焦点已离开输入框，只能走回退链；而回退链只信 store，
// store 为空/过期即 setDraft(正文) 整框覆盖。修复分三层：
//   L0 行/entry mousedown 保焦（焦点根本不离开，精确路径永远命中）；
//   L1 focusin 缓存最后聚焦框（blur 不改变值与光标，不受 store 影响）；
//   L2/L3 store 只做印证，矛盾时采纳 DOM；Q3 删 render 外 hook 直调；
//   Q2 设置页纯管理：行点击无插入、无用量、无 insertHint。
// 验收（与评论区 Agent Brief 对齐）：
//   T1 stale-store + 失焦 → 草稿保留（H1 主回归）
//   T2 焦点精确路径（含行首 0 光标被尊重）
//   T3 焦点缓存：在多框 + stale-store 下选中用户最后摸过的框
//   T4 store/DOM 矛盾信 DOM；DOM 全空 + store 非空则信 store
//   T5 Q3：DOM 有证据时旧桥函数根本不被调用；全程无 hook 直调抛错
//   T6 设置页 onPick 无桥 → 无写入无抛错；有桥 compact onPick → 保留拼接 + 用量 +1
//   T7 悬浮行带保焦 onMouseDown；设置页行无 onClick、无 insertHint
//   T8 入口按钮 mousedown 保焦
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

let failures = 0;
function ok(cond, msg) {
  if (cond) { console.log('  PASS ' + msg); return; }
  failures++;
  console.log('  FAIL ' + msg);
}

// —— DOM  mock：元素身份稳定（同真实 DOM），供 L0 同一性判断 ——
function makeTextarea(value, caret) {
  return {
    tagName: 'TEXTAREA', value, selectionStart: caret,
    closest: () => null, isConnected: true,
    focus() {}, setSelectionRange(s) { this.selectionStart = s; },
  };
}
function makeDocument() {
  const listeners = {};
  const doc = {
    activeElement: { tagName: 'BODY' },
    documentElement: { lang: 'zh-CN' },
    _areas: [],
    querySelectorAll: (sel) => (sel === 'textarea' ? doc._areas.slice() : []),
    querySelector: () => null,
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    removeEventListener: () => {},
    dispatch: (t, ev) => { (listeners[t] || []).forEach((fn) => fn(ev)); },
  };
  return doc;
}
const staleStore = { getState: () => ({ draft: '' }) };
// 与真实浏览器一致：T1–T6 + T3 共享同一个 document（focusin 监听器只绑一次）。
// T7 渲染隔离用新 doc；其后不再调 insertBody，不影响缓存。
global.document = makeDocument();

console.log('=== T1: stale-store + 失焦 → 草稿保留（H1 主回归） ===');
{
  const ta = makeTextarea('ABCDEF', 2);
  global.document._areas = [ta];
  global.document.activeElement = { tagName: 'BODY' };
  let got = null;
  const r = panel.insertBody(staleStore, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === 'AB[TPL]CDEF', '失焦 + store 为空仍保留并拼接，实际=' + JSON.stringify(got));
  ok(r === 6, '返回插入前草稿长度 6，实际=' + r);
}

console.log('=== T2: 焦点精确路径（含行首 0 光标） ===');
{
  const ta = makeTextarea('ABCDEF', 2);
  global.document._areas = [ta];
  global.document.activeElement = ta; // 同一引用，模拟真实 DOM
  let got = null;
  panel.insertBody(staleStore, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === 'AB[TPL]CDEF', '焦点在框内光标处注入，实际=' + JSON.stringify(got));

  const ta0 = makeTextarea('AB', 0);
  global.document._areas = [ta0];
  global.document.activeElement = ta0;
  got = null;
  panel.insertBody(staleStore, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === '[TPL]AB', '行首 0 光标被尊重（前插非后插），实际=' + JSON.stringify(got));
}

console.log('=== T4: store/DOM 矛盾信 DOM；DOM 全空 + store 非空则信 store ===');
{
  const ta = makeTextarea('DOM真相', 1);
  global.document._areas = [ta];
  global.document.activeElement = { tagName: 'BODY' };
  let got = null;
  panel.insertBody({ getState: () => ({ draft: 'STORE过期' }) }, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === 'D[TPL]OM真相', '矛盾时采纳 DOM 可见值，实际=' + JSON.stringify(got));

  const empty = makeTextarea('', 0);
  global.document._areas = [empty];
  got = null;
  const r = panel.insertBody({ getState: () => ({ draft: '程序化' }) }, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === '程序化[TPL]', 'DOM 全空时采信 store，实际=' + JSON.stringify(got));
  ok(r === 3, '返回 store 草稿长度，实际=' + r);
}

console.log('=== T5: Q3 旧桥函数在 DOM 有证据时根本不被调用 ===');
{
  const ta = makeTextarea('ABCDEF', 2);
  global.document._areas = [ta];
  global.document.activeElement = { tagName: 'BODY' };
  let called = false;
  const legacyHook = (sel) => { called = true; throw new Error('Invalid hook call'); };
  let got = null;
  let threw = false;
  try {
    panel.insertBody(legacyHook, { setDraft: (v) => { got = v; } }, '[TPL]');
  } catch (e) { threw = true; }
  ok(!threw, '全程无抛错（旧hook直调已删）');
  ok(!called, 'DOM 有证据时旧桥函数一次都没调');
  ok(got === 'AB[TPL]CDEF', '草稿保留，实际=' + JSON.stringify(got));
}

console.log('=== T6: onPick 无桥即纯管理；有桥则保留拼接 + 用量 +1 ===');
{
  global.document._areas = [makeTextarea('草稿', 1)];
  let wrote = false;
  try {
    panel.onPick({ id: 't-noop', builtin: true, body: '[TPL]' }, undefined, undefined);
    panel.onPick({ id: 't-noop', builtin: true, body: '[TPL]' }, undefined, {});
    ok(!wrote, '无桥 onPick 无写入、无抛错');
  } catch (e) { ok(false, '无桥 onPick 不应抛错：' + (e && e.message)); }
  const before = store.loadUsage()['t-noop'] || 0;
  ok(before === 0, '无桥 onPick 不涨用量');
}
{
  global.document.activeElement = { tagName: 'BODY' };
  const ta = makeTextarea('AB', 1);
  global.document._areas = [ta];
  global.document.activeElement = { tagName: 'BODY' };
  let got = null;
  const tpl = { id: 't-pick-61', builtin: true, body: '[TPL]' };
  const before = store.loadUsage()[tpl.id] || 0;
  panel.onPick(tpl, staleStore, { setDraft: (v) => { got = v; } });
  ok(got === 'A[TPL]B', '有桥 onPick 保留拼接，实际=' + JSON.stringify(got));
  ok((store.loadUsage()[tpl.id] || 0) === before + 1, '有桥 onPick 用量 +1');
}

console.log('=== T3: 焦点缓存选中最后摸过的框（多框 + stale-store） ===');
{
  const a = makeTextarea('AAA', 1);
  const b = makeTextarea('BBB', 2);
  global.document._areas = [a, b];
  global.document.activeElement = { tagName: 'BODY' };
  global.document.dispatch('focusin', { target: b }); // 用户最后在 B 里打字
  let got = null;
  panel.insertBody(staleStore, { setDraft: (v) => { got = v; } }, '[TPL]');
  ok(got === 'BB[TPL]B', '缓存命中 B（含其光标 2），实际=' + JSON.stringify(got));
}

console.log('=== T7: 悬浮行保焦 / 设置页行去插入 ===');
{
  const React = require('react');
  const TR = require('react-test-renderer');
  global.document = makeDocument();
  let compact = null;
  TR.act(() => { compact = TR.create(React.createElement(panel.TemplateBrowser, { compact: true })); });
  const rows = compact.root.findAll((x) => x.props && x.props['data-dsh-prompt-id']);
  ok(rows.length > 0, '悬浮列表渲染出行，行数=' + rows.length);
  const allGuarded = rows.every((r) => typeof r.props.onMouseDown === 'function');
  ok(allGuarded, '悬浮行全部带保焦 onMouseDown');
  let prevented = false;
  rows[0].props.onMouseDown({ preventDefault: () => { prevented = true; } });
  ok(prevented, 'onMouseDown 确实调 preventDefault（焦点不离开）');

  let full = null;
  TR.act(() => { full = TR.create(React.createElement(panel.TemplateBrowser, { compact: false })); });
  const srows = full.root.findAll((x) => x.props && x.props['data-dsh-prompt-id']);
  ok(srows.length > 0, '设置页渲染出行，行数=' + srows.length);
  ok(srows.every((r) => typeof r.props.onClick !== 'function'), '设置页行无 onClick（不行插入）');
  ok(srows.every((r) => String(r.props.title || '').indexOf(zh('insertHint')) < 0), '设置页行标题不承诺插入');
}

console.log('=== T8: 入口按钮 mousedown 保焦 ===');
{
  const React = require('react');
  const TR = require('react-test-renderer');
  let btn = null;
  TR.act(() => { btn = TR.create(React.createElement(button.EntryButton, { open: false })); });
  const node = btn.root.find((x) => x.props && x.props['data-dsh-prompt-entry']);
  ok(typeof node.props.onMouseDown === 'function', '入口按钮带保焦 onMouseDown');
  let prevented = false;
  node.props.onMouseDown({ preventDefault: () => { prevented = true; } });
  ok(prevented, '入口按钮 mousedown 调 preventDefault');
}

delete global.document;
if (failures > 0) { console.log('FAILURES: ' + failures); process.exit(1); }
console.log('ALL PASS: #61');
