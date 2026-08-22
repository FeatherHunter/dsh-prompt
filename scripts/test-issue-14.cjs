// 回归测试 #14: compact 浮层新增弹窗输入时意外关闭
// 覆盖验收标准：
//  1) 连续输入 ≥20 字符不消失
//  2) 父级重渲染（tick / tab / domain / 搜索）后输入不丢失
//  3) hover 离开在弹窗打开时不关窗，关闭后恢复
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }
const DIR = path.join(__dirname, '.rt-tmp');
fs.mkdirSync(DIR, { recursive: true });
const PANEL_TS = path.resolve(path.join(__dirname, '..', 'src', 'client', 'panel.ts'));
const MODULES = [
  ['templates.ts', path.join(__dirname, '..', 'src', 'client', 'templates.ts'), []],
  ['store.ts', path.join(__dirname, '..', 'src', 'client', 'store.ts'), ['./templates']],
  ['state.ts', path.join(__dirname, '..', 'src', 'client', 'state.ts'), []],
  ['i18n.ts', path.join(__dirname, '..', 'src', 'client', 'i18n.ts'), []],
  ['smartstore.ts', path.join(__dirname, '..', 'src', 'client', 'smartstore.ts'), []],
  ['panel.cjs', PANEL_TS, ['./templates', './store', './state', './i18n', './smartstore']],
];
for (const [outName, srcPath, deps] of MODULES) {
  let src = fs.readFileSync(srcPath, 'utf8');
  let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true } }).outputText;
  for (const d of deps) js = js.split('require("' + d + '")').join('require("' + d + '.cjs")');
  fs.writeFileSync(path.join(DIR, outName.replace(/\.ts$/, '.cjs')), js);
}
const React = require('react');
const TR = require('react-test-renderer');
const { TemplateBrowser } = require(path.join(DIR, 'panel.cjs'));
const { tr, STR } = require(path.join(DIR, 'i18n.cjs'));
const state = require(path.join(DIR, 'state.cjs'));
const zh = (k) => tr('zh', STR[k]);

async function testCompactHover() {
  console.log('=== Test A: compact hover suppression ===');
  function Host() {
    const [open, setOpen] = React.useState(state.isPanelOpen());
    const [tick, setTick] = React.useState(0);
    React.useEffect(() => state.onPanelOpen((v) => setOpen(v)), []);
    // expose tick setter via global for test
    (globalThis).__setTick = setTick;
    if (!open) return React.createElement('div', { 'data-host': 'closed' }, 'closed');
    return React.createElement('div', { 'data-host': 'open', 'data-tick': tick },
      React.createElement(TemplateBrowser, { compact: true }),
      React.createElement('button', { id: 'bump', onClick: () => setTick(n => n + 1) }, 'bump')
    );
  }
  state.setPanelOpen(true);
  if (state.setHoverCloseSuppressed) state.setHoverCloseSuppressed(false);
  let created;
  TR.act(() => { created = TR.create(React.createElement(Host)); });
  const root = created.root;
  const PLUS = '\uFF0B';
  const CANCEL = '\u53D6\u6D88';
  const byText = (txt) => root.findAll((x) => x.type === 'button' && Array.isArray(x.children) && x.children.some((c) => typeof c === 'string' && c.includes(txt)))[0];
  const byPlaceholder = (ph) => root.findAll((x) => (x.type === 'input' || x.type === 'textarea') && x.props && x.props.placeholder === ph)[0];
  const addBtn = byText(PLUS);
  if (!addBtn) throw new Error('add button not found');
  // A1: 打开弹窗
  TR.act(() => { addBtn.props.onClick(); });
  let name = byPlaceholder(zh('namePh'));
  let body = byPlaceholder(zh('bodyPh'));
  if (!name || !body) throw new Error('modal not open');
  console.log(' A1 modal open ok');
  // A2: 连续输入 ≥20 字符（名称+正文）
  const longName = 'a'.repeat(25);
  const longBody = 'b'.repeat(30);
  TR.act(() => { name.props.onChange({ target: { value: longName } }); });
  TR.act(() => { body.props.onChange({ target: { value: longBody } }); });
  name = byPlaceholder(zh('namePh'));
  body = byPlaceholder(zh('bodyPh'));
  if (name.props.value !== longName || body.props.value !== longBody) throw new Error('typing failed');
  console.log(' A2 typed 20+ chars ok');
  // A3: hover 离开不应关窗（多次）
  const panelRoot = root.findAll(x => x.props && typeof x.props.onMouseLeave === 'function' && typeof x.props.onMouseEnter === 'function')[0];
  if (!panelRoot) throw new Error('panel hover not found');
  for (let i = 0; i < 3; i++) {
    TR.act(() => { panelRoot.props.onMouseLeave(); });
    await new Promise(r => setTimeout(r, 220));
    TR.act(() => {});
    const openNodes = root.findAll(x => x.props && x.props['data-host'] === 'open');
    const modalStill = !!byPlaceholder(zh('namePh'));
    if (openNodes.length === 0 || !modalStill) throw new Error('hover leave closed modal at iteration ' + i);
    // ensure text still there
    name = byPlaceholder(zh('namePh'));
    if (name.props.value !== longName) throw new Error('text lost after hover at iteration ' + i);
  }
  console.log(' A3 hover leaves suppressed ok');
  // A4: 父级重渲染（外部 tick）
  const bump = root.findAll(x => x.type === 'button' && x.props && x.props.id === 'bump')[0];
  for (let i = 0; i < 3; i++) {
    TR.act(() => { bump.props.onClick(); });
    await new Promise(r => setTimeout(r, 10));
    TR.act(() => {});
    name = byPlaceholder(zh('namePh'));
    body = byPlaceholder(zh('bodyPh'));
    if (!name || name.props.value !== longName) throw new Error('name lost after tick ' + i + ': ' + (name && name.props.value));
    if (!body || body.props.value !== longBody) throw new Error('body lost after tick ' + i);
  }
  console.log(' A4 external tick survives ok');
  // A5: 内部状态切换（tab / domain / 搜索）不应丢输入
  // 触发方式：直接找到 tab 按钮并点击（会触发 tabState + refresh）
  const tabBtn = byText('\u6267\u884C\u524D'); // 执行前
  if (tabBtn) {
    TR.act(() => { tabBtn.props.onClick(); });
    TR.act(() => {});
    name = byPlaceholder(zh('namePh'));
    if (!name || name.props.value !== longName) throw new Error('name lost after tab switch');
    console.log(' A5a tab switch survives ok');
  }
  const domainBtn = byText('\u5B66\u4E60'); // 学习
  if (domainBtn) {
    TR.act(() => { domainBtn.props.onClick(); });
    TR.act(() => {});
    name = byPlaceholder(zh('namePh'));
    if (!name || name.props.value !== longName) throw new Error('name lost after domain switch');
    console.log(' A5b domain switch survives ok');
  }
  // 搜索框输入
  const searchInput = root.findAll(x => x.type === 'input' && x.props && x.props.placeholder === zh('searchPh'))[0];
  if (searchInput) {
    TR.act(() => { searchInput.props.onChange({ target: { value: 'test' } }); });
    TR.act(() => {});
    name = byPlaceholder(zh('namePh'));
    if (!name || name.props.value !== longName) throw new Error('name lost after search');
    console.log(' A5c search change survives ok');
  }
  // A6: 取消后 hover 应恢复关闭
  const cancelBtn = byText(CANCEL);
  if (!cancelBtn) throw new Error('cancel not found');
  TR.act(() => { cancelBtn.props.onClick(); });
  if (byPlaceholder(zh('namePh'))) throw new Error('modal should be closed after cancel');
  console.log(' A6 cancel closes modal ok');
  // A7: 关闭后 hover 离开应关面板
  const panelAfter = root.findAll(x => x.props && typeof x.props.onMouseLeave === 'function')[0];
  if (panelAfter) {
    TR.act(() => { panelAfter.props.onMouseLeave(); });
    await new Promise(r => setTimeout(r, 220));
    TR.act(() => {});
    const openNodes = root.findAll(x => x.props && x.props['data-host'] === 'open');
    if (openNodes.length !== 0) throw new Error('panel should close after modal closed + hover leave');
    console.log(' A7 hover resumes after modal closed ok');
  }
  // cleanup
  try { created.unmount(); } catch (e) {}
  state.setPanelOpen(false);
  if (state.setHoverCloseSuppressed) state.setHoverCloseSuppressed(false);
  console.log('=== Test A PASS ===');
}

async function testNonCompactRemount() {
  console.log('=== Test B: non-compact remount (original regression) ===');
  function Wrapper() {
    const [n, setN] = React.useState(0);
    return React.createElement('div', null,
      React.createElement(TemplateBrowser, { compact: false }),
      React.createElement('button', { id: 'bump', onClick: () => setN(n + 1) }, 'bump'));
  }
  let created;
  TR.act(() => { created = TR.create(React.createElement(Wrapper)); });
  const root = created.root;
  const PLUS = '\uFF0B';
  const byText = (txt) => root.findAll((x) => x.type === 'button' && Array.isArray(x.children) && x.children.some((c) => typeof c === 'string' && c.includes(txt)))[0];
  const byPlaceholder = (ph) => root.findAll((x) => (x.type === 'input' || x.type === 'textarea') && x.props && x.props.placeholder === ph)[0];
  const addBtn = byText(PLUS);
  if (!addBtn) throw new Error('B: add button not found');
  TR.act(() => { addBtn.props.onClick(); });
  let name = byPlaceholder(zh('namePh'));
  if (!name) throw new Error('B: modal not open');
  TR.act(() => { name.props.onChange({ target: { value: 'my tmpl' } }); });
  const body = byPlaceholder(zh('bodyPh'));
  TR.act(() => { body.props.onChange({ target: { value: 'body here' } }); });
  const bump = root.findAll((x) => x.type === 'button' && x.props && x.props.id === 'bump')[0];
  TR.act(() => { bump.props.onClick(); });
  name = byPlaceholder(zh('namePh'));
  const body2 = byPlaceholder(zh('bodyPh'));
  if (!name || name.props.value !== 'my tmpl') throw new Error('B: name reset after parent re-render');
  if (!body2 || body2.props.value !== 'body here') throw new Error('B: body reset');
  console.log('=== Test B PASS ===');
  try { created.unmount(); } catch (e) {}
}

async function testEntryButtonSuppression() {
  console.log('=== Test C: EntryButton schedule suppressed while modal open ===');
  // 直接测试 state 层：当 suppressed=true 时 schedulePanelClose 不生效
  state.setPanelOpen(true);
  if (state.setHoverCloseSuppressed) state.setHoverCloseSuppressed(true);
  state.schedulePanelClose(50);
  await new Promise(r => setTimeout(r, 80));
  if (!state.isPanelOpen()) throw new Error('C: panel closed despite suppression');
  console.log(' C1 suppressed blocks schedule ok');
  if (state.setHoverCloseSuppressed) state.setHoverCloseSuppressed(false);
  state.schedulePanelClose(50);
  await new Promise(r => setTimeout(r, 80));
  if (state.isPanelOpen()) throw new Error('C: panel should close after suppression lifted');
  console.log(' C2 after suppression lifted, close works ok');
  console.log('=== Test C PASS ===');
  state.setPanelOpen(false);
}

async function main() {
  try {
    await testCompactHover();
    await testNonCompactRemount();
    await testEntryButtonSuppression();
    console.log('ALL PASS: #14 regression suite');
    process.exit(0);
  } catch (e) {
    console.log('FAIL: ' + (e && e.stack ? e.stack : String(e)));
    process.exit(1);
  }
}
main();
