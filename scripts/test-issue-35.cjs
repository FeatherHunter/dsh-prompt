// 回归测试 #35: 点击 prompt 按钮打开的悬浮列表偶发定位到屏幕左下角
// 根因指向：pos 初始 null → 样式 fallback left:0/bottom:0（即屏幕左下角）；
// compute() 在 useEffect 首帧之后才跑，失败（按钮查不到/rect 全零）即永久卡死。
// 修复方向：绘制前定位（layout effect）+ 未定位前隐藏 + 失败重试 + 零 rect 视为未找到。
// 验收：
//  T1) 无 DOM（定位永不可能成功）时面板不得以可见态画在 0,0（红：可见 0,0；绿：隐藏）
//  T2) 有按钮 rect 时定位到按钮正上方并可见
//  T3) rect 全零（按钮不可见）时不提交垃圾位置（保持隐藏，而非可见的错位）
//  T4) 设置页（compact=false）不受影响（永不隐藏）
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
];
for (const [outName, srcPath, deps] of MODULES) {
  let src = fs.readFileSync(srcPath, 'utf8');
  let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true } }).outputText;
  for (const d of deps) js = js.split('require("' + d + '")').join('require("' + d + '.cjs")');
  fs.writeFileSync(path.join(DIR, outName.replace(/\.ts$/, '.cjs')), js);
}
const React = require('react');
const TR = require('react-test-renderer');

function loadFresh() {
  for (const f of ['templates.cjs', 'store.cjs', 'state.cjs', 'i18n.cjs', 'smartstore.cjs', 'panel.cjs'])
    delete require.cache[require.resolve(path.join(DIR, f))];
  return {
    panel: require(path.join(DIR, 'panel.cjs')),
    state: require(path.join(DIR, 'state.cjs')),
  };
}
// 面板根节点：fixed 定位的 compact 容器
function panelRoot(created) {
  const nodes = created.root.findAll((x) => x.props && x.props.style
    && x.props.style.position === 'fixed' && typeof x.props.style.left !== 'undefined');
  if (nodes.length === 0) throw new Error('compact panel root not found');
  return nodes[0];
}
function mountCompact(deps) {
  const { panel, state } = deps;
  state.setPanelOpen(true);
  if (state.setHoverCloseSuppressed) state.setHoverCloseSuppressed(false);
  state.cancelPanelClose();
  let created;
  TR.act(() => { created = TR.create(React.createElement(panel.TemplateBrowser, { compact: true })); });
  return { created, state };
}
function saveGlobals() {
  return { doc: globalThis.document, win: globalThis.window, mo: globalThis.MutationObserver, raf: globalThis.requestAnimationFrame };
}
function restoreGlobals(g) {
  if (g.doc === undefined) delete globalThis.document; else globalThis.document = g.doc;
  if (g.win === undefined) delete globalThis.window; else globalThis.window = g.win;
  if (g.mo === undefined) delete globalThis.MutationObserver; else globalThis.MutationObserver = g.mo;
  if (g.raf === undefined) delete globalThis.requestAnimationFrame; else globalThis.requestAnimationFrame = g.raf;
}
function stubBrowser(rect) {
  globalThis.document = {
    querySelector: (sel) => (sel === '[data-dsh-prompt-entry]' ? { getBoundingClientRect: () => ({ ...rect }) } : null),
    documentElement: {},
  };
  globalThis.window = {
    innerWidth: 1280, innerHeight: 800,
    addEventListener() {}, removeEventListener() {},
  };
  globalThis.MutationObserver = class { constructor() {} observe() {} disconnect() {} };
}

async function main() {
  const G = saveGlobals();

  // T1: 无 DOM 时不得可见地画在 0,0
  console.log('=== T1: unpositioned panel must not paint visible at 0,0 ===');
  try {
    delete globalThis.document; delete globalThis.window;
    const { created, state } = mountCompact(loadFresh());
    const st = panelRoot(created).props.style;
    const atOrigin = (st.left === 0) && (st.bottom === 0);
    const visible = st.visibility !== 'hidden';
    if (atOrigin && visible) throw new Error('T1 FAIL: panel paints VISIBLE at bottom-left 0,0 when unpositioned (issue #35)');
    console.log(' T1 ok: hidden until positioned (visibility=' + st.visibility + ')');
    try { created.unmount(); } catch (e) {}
    state.setPanelOpen(false);
  } finally { restoreGlobals(G); }

  // T2: 有按钮 rect → 按钮正上方并可见
  console.log('=== T2: positions above entry button when rect available ===');
  const G2 = saveGlobals();
  try {
    stubBrowser({ left: 100, top: 500, width: 90, height: 28 });
    const { created, state } = mountCompact(loadFresh());
    await new Promise((r) => setTimeout(r, 120));
    TR.act(() => {});
    const st = panelRoot(created).props.style;
    if (st.left !== 100) throw new Error('T2 FAIL: left=' + st.left + ' want 100');
    if (st.bottom !== 800 - 500 + 8) throw new Error('T2 FAIL: bottom=' + st.bottom + ' want 308');
    if (st.visibility === 'hidden') throw new Error('T2 FAIL: panel stays hidden after positioned');
    console.log(' T2 ok: left=100 bottom=308 visible');
    try { created.unmount(); } catch (e) {}
    state.setPanelOpen(false);
  } finally { restoreGlobals(G2); }

  // T3: rect 全零 → 不提交垃圾位置
  console.log('=== T3: zero rect is treated as not-found ===');
  const G3 = saveGlobals();
  try {
    stubBrowser({ left: 0, top: 0, width: 0, height: 0 });
    const { created, state } = mountCompact(loadFresh());
    await new Promise((r) => setTimeout(r, 200));
    TR.act(() => {});
    const st = panelRoot(created).props.style;
    const visible = st.visibility !== 'hidden';
    if (visible) throw new Error('T3 FAIL: panel visible at garbage pos left=' + st.left + ' bottom=' + st.bottom + ' for zero rect');
    console.log(' T3 ok: stays hidden on zero rect');
    try { created.unmount(); } catch (e) {}
    state.setPanelOpen(false);
  } finally { restoreGlobals(G3); }

  // T4: 设置页永不隐藏
  console.log('=== T4: settings page never hidden ===');
  const G4 = saveGlobals();
  try {
    delete globalThis.document; delete globalThis.window;
    const { panel, state } = loadFresh();
    let created;
    TR.act(() => { created = TR.create(React.createElement(panel.TemplateBrowser, { compact: false })); });
    const vis = [];
    created.root.findAll((x) => x.props && x.props.style && typeof x.props.style === 'object')
      .forEach((x) => { if (x.props.style.visibility === 'hidden') vis.push(1); });
    if (vis.length > 0) throw new Error('T4 FAIL: settings page hides content');
    console.log(' T4 ok');
    try { created.unmount(); } catch (e) {}
  } finally { restoreGlobals(G4); }

  console.log('ALL PASS: #35 positioning');
  process.exit(0);
}

main().catch((e) => { console.log('FAIL: ' + (e && e.stack ? e.stack : String(e))); process.exit(1); });
