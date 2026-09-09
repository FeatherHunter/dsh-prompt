// 回归测试 #34: 悬浮列表搜索框拼音组词瞬间浮层消失
// 根因指向：150ms hover 计时 + 悬浮专属（设置页正常）+ 仅组词触发。
// 面板侧确定缺口：搜索框无 composition/focus 处理，打字期任何杂散 mouseleave
// 都会 schedulePanelClose(150) 关窗。修复：聚焦/组词期抑制 hover 关窗（#14 家族延续）。
// 验收：
//  1) 搜索聚焦后杂散 leave → 220ms 后仍开（红：修前关，绿：修后开）
//  2) compositionstart 后 leave → 仍开；compositionend + blur 后 leave → 关（不粘住）
//  3) blur 后 leave → 关（抑制已释放）
//  4) 聚焦期点 × 直接关（抑制只拦 schedule，不拦显式关闭，不粘住）
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
const panel = require(path.join(DIR, 'panel.cjs'));
const state = require(path.join(DIR, 'state.cjs'));
const { tr, STR } = require(path.join(DIR, 'i18n.cjs'));
const zh = (k) => tr('zh', STR[k]);

function mountHost() {
  function Host() {
    const [open, setOpen] = React.useState(state.isPanelOpen());
    React.useEffect(() => state.onPanelOpen((v) => setOpen(v)), []);
    if (!open) return React.createElement('div', { 'data-host': 'closed' }, 'closed');
    return React.createElement('div', { 'data-host': 'open' },
      React.createElement(panel.TemplateBrowser, { compact: true }));
  }
  state.setPanelOpen(true);
  if (state.setHoverCloseSuppressed) state.setHoverCloseSuppressed(false);
  state.cancelPanelClose();
  let created;
  TR.act(() => { created = TR.create(React.createElement(Host)); });
  return created;
}
const isOpen = (created) =>
  created.root.findAll((x) => x.props && x.props['data-host'] === 'open').length > 0;
const hoverRoot = (created) =>
  created.root.findAll((x) => x.props && typeof x.props.onMouseLeave === 'function' && typeof x.props.onMouseEnter === 'function')[0];
const searchInput = (created) =>
  created.root.findAll((x) => x.type === 'input' && x.props && x.props.placeholder === zh('searchPh'))[0];
const closeBtn = (created) =>
  created.root.findAll((x) => x.type === 'button' && Array.isArray(x.children) && x.children.some((c) => typeof c === 'string' && c.includes('×')))[0];
async function strayLeave(created) {
  const root = hoverRoot(created);
  if (!root) throw new Error('panel hover root not found');
  TR.act(() => { root.props.onMouseLeave(); });
  await new Promise((r) => setTimeout(r, 220));
  TR.act(() => {});
}
function fire(node, name, ev) {
  if (!node) throw new Error('missing node for ' + name);
  if (typeof node.props[name] !== 'function') throw new Error('handler missing: ' + name);
  TR.act(() => { node.props[name](ev || {}); });
  TR.act(() => {});
}

async function main() {
  // T1: 聚焦后杂散 leave 不关窗
  console.log('=== T1: focused search survives stray leave ===');
  let c1 = mountHost();
  let s1 = searchInput(c1);
  if (!s1) throw new Error('T1: search input not found');
  if (typeof s1.props.onFocus === 'function') fire(s1, 'onFocus');
  else throw new Error('T1 RED-CAUSE: search input has no onFocus suppression (issue #34)');
  await strayLeave(c1);
  if (!isOpen(c1)) throw new Error('T1 FAIL: panel closed while search focused (issue #34 repro)');
  console.log(' T1 ok: stays open while focused');
  try { c1.unmount(); } catch (e) {}
  state.setPanelOpen(false);
  if (state.setHoverCloseSuppressed) state.setHoverCloseSuppressed(false);
  state.cancelPanelClose();

  // T2: 组词期 leave 不关；组词结束+blur 后 leave 关
  console.log('=== T2: composing suppresses, release after end+blur ===');
  let c2 = mountHost();
  let s2 = searchInput(c2);
  if (typeof s2.props.onCompositionStart !== 'function') throw new Error('T2 RED-CAUSE: no onCompositionStart (issue #34)');
  if (typeof s2.props.onCompositionEnd !== 'function') throw new Error('T2 RED-CAUSE: no onCompositionEnd (issue #34)');
  fire(s2, 'onCompositionStart');
  // 组词中模拟 IME 等价 onChange（isComposing）
  TR.act(() => { s2.props.onChange({ target: { value: 'a' }, nativeEvent: { isComposing: true } }); });
  TR.act(() => {});
  await strayLeave(c2);
  if (!isOpen(c2)) throw new Error('T2 FAIL: panel closed mid-composition');
  console.log(' T2a ok: stays open mid-composition');
  fire(searchInput(c2), 'onCompositionEnd', { target: { value: 'a' } });
  if (typeof searchInput(c2).props.onBlur === 'function') fire(searchInput(c2), 'onBlur');
  await strayLeave(c2);
  if (isOpen(c2)) throw new Error('T2 FAIL: panel stuck open after composition end + blur');
  console.log(' T2b ok: closes after end+blur (not stuck)');
  try { c2.unmount(); } catch (e) {}
  state.setPanelOpen(false);
  if (state.setHoverCloseSuppressed) state.setHoverCloseSuppressed(false);
  state.cancelPanelClose();

  // T3: blur 后抑制释放
  console.log('=== T3: blur releases suppression ===');
  let c3 = mountHost();
  fire(searchInput(c3), 'onFocus');
  fire(searchInput(c3), 'onBlur');
  await strayLeave(c3);
  if (isOpen(c3)) throw new Error('T3 FAIL: suppression not released after blur');
  console.log(' T3 ok');
  try { c3.unmount(); } catch (e) {}
  state.setPanelOpen(false);
  if (state.setHoverCloseSuppressed) state.setHoverCloseSuppressed(false);
  state.cancelPanelClose();

  // T4: 聚焦期显式 × 仍可关（不粘住）
  console.log('=== T4: explicit close still works while focused ===');
  let c4 = mountHost();
  fire(searchInput(c4), 'onFocus');
  const x = closeBtn(c4);
  if (!x) throw new Error('T4: close button not found');
  TR.act(() => { x.props.onClick(); });
  TR.act(() => {});
  if (isOpen(c4)) throw new Error('T4 FAIL: explicit close blocked while focused');
  console.log(' T4 ok');
  try { c4.unmount(); } catch (e) {}
  state.setPanelOpen(false);
  if (state.setHoverCloseSuppressed) state.setHoverCloseSuppressed(false);
  state.cancelPanelClose();

  console.log('ALL PASS: #34 IME-safe hover suppression');
  process.exit(0);
}

main().catch((e) => { console.log('FAIL: ' + (e && e.stack ? e.stack : String(e))); process.exit(1); });
