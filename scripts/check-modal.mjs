// dsh-prompt modal remount regression harness (v2)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); // 仅用于加载生成的 .cjs 临时产物与 CJS 包（react/helper），源码一律 import
import fs from 'node:fs';
import path from 'node:path';
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }
const DIR = path.join(import.meta.dirname, '.rt-tmp');
fs.mkdirSync(DIR, { recursive: true });
const PANEL_TS = path.resolve(process.argv[2] || path.join(import.meta.dirname, '..', 'src', 'client', 'template-browser.ts'));
const REMOTE_TS = path.join(import.meta.dirname, '..', 'src', 'client', 'remote-mode.ts');
const REMOTEVIEW_TS = path.join(import.meta.dirname, '..', 'src', 'client', 'remote-grid.ts');
// P1：只声明根；闭包与 require 改写由共享件顺着源码 import 推导（不再是手抄表）。
const { buildFlat } = require('./lib/transpile-client.cjs');
buildFlat(DIR, [
  path.join(import.meta.dirname, '..', 'src', 'client', 'templates.ts'),
  path.join(import.meta.dirname, '..', 'src', 'client', 'template-library.ts'),
  path.join(import.meta.dirname, '..', 'src', 'client', 'panel-visibility.ts'),
  path.join(import.meta.dirname, '..', 'src', 'client', 'strings.ts'),
  path.join(import.meta.dirname, '..', 'src', 'client', 'smart-draft.ts'),
  REMOTE_TS,
  REMOTEVIEW_TS,
  PANEL_TS,
]);
try {
  // 语言钉死成 zh：本脚本断言的是中文界面（占位符、按钮文案走 zh 词表）。
  // Node ≥21 自带 `navigator`，其 language 来自 ICU 默认区域 —— 开发机（zh-CN）与 CI（en-US）
  // 因此渲染出两套文案：CI 上「＋ 新增」变成「+ Add」，按字形找按钮就会误红
  // （2026-10-31 CI 首次跑就踩到）。共享件里钉一次，同一份提交在两种机器上断言同一个界面。
  require('./lib/pin-locale.cjs').pinLocaleZh();
  const React = require('react');
  const TR = require('react-test-renderer');
  const { TemplateBrowser } = require(path.join(DIR, 'template-browser.cjs'));
  const { tr, STR } = require(path.join(DIR, 'strings.cjs'));
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
  const byHook = (name) => root.findAll((x) => x.type === 'button' && x.props && x.props['data-dsh-prompt-chrome'] === name)[0];
  const byPlaceholder = (ph) => root.findAll((x) => (x.type === 'input' || x.type === 'textarea') && x.props && x.props.placeholder === ph)[0];

  // 认 `data-dsh-prompt-chrome="plusGlyph"` 契约钩子（#190），不再靠字形：
  // 「＋/＋ 新增」的字符随语言变，按字形找按钮等于把语言也钉进断言里。
  const addBtn = byHook('plusGlyph') || byText('＋') || byText('+');
  if (!addBtn) { console.log('FAIL: add button not found (hook=plusGlyph)'); process.exit(1) }
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