// dsh-prompt modal remount regression harness (v2)
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }
const DIR = path.join(__dirname, '.rt-tmp');
fs.mkdirSync(DIR, { recursive: true });
const PANEL_TS = path.resolve(process.argv[2] || path.join(__dirname, '..', 'src', 'client', 'panel.ts'));
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
try {
  const React = require('react');
  const TR = require('react-test-renderer');
  const { TemplateBrowser } = require(path.join(DIR, 'panel.cjs'));
  const { tr, STR } = require(path.join(DIR, 'i18n.cjs'));
  const zh = (k) => tr('zh', STR[k]);
  console.log('step1: modules loaded, react', React.version);

  function Wrapper() {
    const [n, setN] = React.useState(0);
    return React.createElement('div', null,
      React.createElement(TemplateBrowser, { compact: false }),
      React.createElement('button', { id: 'bump', onClick: () => setN(n + 1) }, 'bump'));
  }
  let created;
  TR.act(() => { created = TR.create(React.createElement(Wrapper)); });
  const root = created.root;
  console.log('step2: rendered');

  const byText = (txt) => root.findAll((x) => x.type === 'button' && Array.isArray(x.children) && x.children.some((c) => typeof c === 'string' && c.includes(txt)))[0];
  const byPlaceholder = (ph) => root.findAll((x) => (x.type === 'input' || x.type === 'textarea') && x.props && x.props.placeholder === ph)[0];

  const addBtn = byText('＋');
  if (!addBtn) { console.log('FAIL: add button not found'); process.exit(1) }
  TR.act(() => { addBtn.props.onClick() });
  console.log('step3: modal open');

  let name = byPlaceholder(zh('namePh'));
  if (!name) { console.log('FAIL: name input not found'); process.exit(1) }
  TR.act(() => { name.props.onChange({ target: { value: '我的模板' } }) });
  const body = byPlaceholder(zh('bodyPh'));
  TR.act(() => { body.props.onChange({ target: { value: '请用第一性原理分析' } }) });
  console.log('step4: typed name+body');

  const bump = root.findAll((x) => x.type === 'button' && x.props && x.props.id === 'bump')[0];
  TR.act(() => { bump.props.onClick() });
  console.log('step5: parent re-rendered');

  name = byPlaceholder(zh('namePh'));
  const body2 = byPlaceholder(zh('bodyPh'));
  if (!name || name.props.value !== '我的模板') { console.log('FAIL(reproduced): name reset -> ' + JSON.stringify(name && name.props.value)); process.exit(1) }
  if (!body2 || body2.props.value !== '请用第一性原理分析') { console.log('FAIL(reproduced): body reset -> ' + JSON.stringify(body2 && body2.props.value)); process.exit(1) }

  TR.act(() => { name.props.onChange({ target: { value: '我的模板2' } }) });
  TR.act(() => { bump.props.onClick() });
  TR.act(() => { bump.props.onClick() });
  name = byPlaceholder(zh('namePh'));
  if (!name || name.props.value !== '我的模板2') { console.log('FAIL: text lost across repeated re-renders -> ' + JSON.stringify(name && name.props.value)); process.exit(1) }

  console.log('PASS: modal text survives parent re-renders');
  process.exit(0);
} catch (e) {
  console.log('HARNESS-ERROR: ' + (e && e.stack ? e.stack.split('\n').slice(0, 8).join(' | ') : String(e)));
  process.exit(3);
}