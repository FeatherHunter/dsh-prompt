// 回归测试 #116：远程放大档位应影响配置面板折叠小列表字号（Prompt 预制 24）
// 根因（R1）：设置页内层浏览器根（TemplateBrowser compact=false 分支）把字号钉死在宿主基准，
// 覆盖了设置页根已算好的放大字号，导致全部 em 子项锚死。修法：内层根跟随开关吃同一全额倍率
// （var 基重算，与悬浮小列表/设置页根同构；禁用 1em 基，防复乘）。
// 验收映射（#116 票面 Agent Brief + 架构复审）：
//  A) helper 纯断言：关回基准 var；开吃全额；非法 size 回默认 5 档（3x）；enabled 非 true 回 var
//  B) 开 10 档渲染设置页：折叠列表根字号 == 设置页根字号 == calc(var * 5.5)
//  C) 关时渲染：折叠列表根落基准 var（零打扰，#77 F 类回归）
//  D) 展开态：行全出来且根仍跟档；行标题走 em（0.98em），证明 em 链完好
//  E) compact 悬浮分支行为不变（开 5.5x / 关 calc(var * 1) 原样）
//  F) 源码级：panel/settings 缩放根走 helper；helper 实现走 var 基（返回值断言已结构锁定）
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }
const DIR = path.join(__dirname, '.rt-tmp-116');
fs.mkdirSync(DIR, { recursive: true });
const ROOT = path.join(__dirname, '..');
const BASE_VAR = 'var(--dsw-font-markdown-base-font-size)';

let failures = 0;
function fail(msg) { failures++; console.log('FAIL: ' + msg); }
function ok(msg) { console.log(' ok: ' + msg); }

const MODULES = [
  ['templates.ts', path.join(ROOT, 'src', 'client', 'templates.ts'), []],
  ['store.ts', path.join(ROOT, 'src', 'client', 'store.ts'), ['./templates']],
  ['state.ts', path.join(ROOT, 'src', 'client', 'state.ts'), []],
  ['i18n.ts', path.join(ROOT, 'src', 'client', 'i18n.ts'), ['./locale']],
  ['locale.ts', path.join(ROOT, 'src', 'client', 'locale.ts'), []],
  ['smartstore.ts', path.join(ROOT, 'src', 'client', 'smartstore.ts'), []],
  ['remote2.cjs', path.join(ROOT, 'src', 'client', 'remote.ts'), []],
  ['remoteView.cjs', path.join(ROOT, 'src', 'client', 'remoteView.ts'), []],
  ['systemOrientation.cjs', path.join(ROOT, 'src', 'client', 'systemOrientation.ts'), []],
  ['panel.cjs', path.join(ROOT, 'src', 'client', 'panel.ts'), ['./templates', './store', './state', './i18n', './smartstore', './remote', './remoteView', './locale']],
  ['settings.cjs', path.join(ROOT, 'src', 'client', 'settings.ts'), ['./panel', './about', './update', './update-http', './smartstore', './remote', './remoteView', './systemOrientation', './i18n', './locale']],
];
fs.writeFileSync(path.join(DIR, 'about.cjs'), 'module.exports.SettingsHeaderLinks=()=>null;module.exports.AuthorPlugins=()=>null;');
fs.writeFileSync(path.join(DIR, 'update.cjs'), 'module.exports.UpdateEntry=()=>null;');
// #127 后 settings 改引 ./update-http（本票只断模板列表缩放，更新入口桩掉）
fs.writeFileSync(path.join(DIR, 'update-http.cjs'), 'module.exports.UpdateEntryButton=()=>null;module.exports.UpdatePanelEmbedded=()=>null;');
for (const [outName, srcPath, deps] of MODULES) {
  const src = fs.readFileSync(srcPath, 'utf8');
  let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true } }).outputText;
  for (const d of deps) js = js.split('require("' + d + '")').join('require("' + d + '.cjs")');
  js = js.split('require("./remote.cjs")').join('require("./remote2.cjs")');
  const outFile = outName.endsWith('.cjs') ? outName : outName.replace(/\.ts$/, '.cjs');
  fs.writeFileSync(path.join(DIR, outFile), js);
}
const React = require('react');
const TR = require('react-test-renderer');
const req = (n) => require(path.join(DIR, n));
const view = req('remoteView.cjs');
const remote2 = req('remote2.cjs');
const settingsMod = req('settings.cjs');
const panelMod = req('panel.cjs');

// 非 compact 浏览器根：设置页内唯一 padding 6px 8px + gap 6 的 div（模板卡内层根）
const browserRootOf = (root) => root.findAll((n) => n.type === 'div' && n.props && n.props.style && n.props.style.padding === '6px 8px' && n.props.style.gap === 6)[0];

// ── B) 开 10 档：折叠列表根 == 设置页根 == 全额（先跑=复现，未修时此处红） ──
remote2.__resetRemoteForTests();
TR.act(() => { remote2.setRemoteEnabled(true); remote2.setRemoteSize(10); });
let pageOn;
TR.act(() => { pageOn = TR.create(React.createElement(settingsMod.SettingsPage, {})); });
const settingsRootOn = pageOn.toJSON().props.style.fontSize;
if (settingsRootOn !== 'calc(' + BASE_VAR + ' * 5.5)') fail('开10档设置页根应跟全额，实际 ' + settingsRootOn);
const browserOn = browserRootOf(pageOn.root);
if (!browserOn) fail('设置页内应找到折叠小列表根（padding 6px 8px + gap 6）');
else {
  if (browserOn.props.style.fontSize !== 'calc(' + BASE_VAR + ' * 5.5)') fail('开10档折叠小列表根应跟全额，实际 ' + browserOn.props.style.fontSize);
  if (browserOn.props.style.fontSize !== settingsRootOn) fail('折叠列表根应与设置页根同值，实际列表 ' + browserOn.props.style.fontSize + ' vs 页根 ' + settingsRootOn);
}
if (failures === 0) ok('开10档：折叠列表根 == 设置页根 == 全额 5.5x');

// ── C) 关时：折叠列表根落基准（零打扰） ──
remote2.__resetRemoteForTests();
let pageOff;
TR.act(() => { pageOff = TR.create(React.createElement(settingsMod.SettingsPage, {})); });
const browserOff = browserRootOf(pageOff.root);
if (!browserOff) fail('关时应找到折叠小列表根');
else if (browserOff.props.style.fontSize !== BASE_VAR) fail('关时折叠小列表根应落基准 var，实际 ' + browserOff.props.style.fontSize);
if (failures === 0) ok('关时：折叠列表根落基准（零打扰）');

// ── D) 展开态：行出来 + 根仍跟档 + 行标题走 em ──
TR.act(() => { remote2.setRemoteEnabled(true); remote2.setRemoteSize(10); });
let pageExp;
TR.act(() => { pageExp = TR.create(React.createElement(settingsMod.SettingsPage, {})); });
const toggle = pageExp.root.findAll((n) => n.props && n.props['data-dsh-prompt-templates-toggle'] !== undefined)[0];
if (!toggle) fail('展开态应找到折叠开关头行');
else TR.act(() => { toggle.props.onClick(); });
const rowsExp = pageExp.root.findAll((n) => n.props && n.props['data-dsh-prompt-id']);
if (rowsExp.length === 0) fail('点开展开后模板行应渲染');
const browserExp = browserRootOf(pageExp.root);
if (browserExp && browserExp.props.style.fontSize !== 'calc(' + BASE_VAR + ' * 5.5)') fail('展开态根应仍跟全额，实际 ' + browserExp.props.style.fontSize);
const emTitles = pageExp.root.findAll((n) => n.type === 'span' && n.props && n.props.style && n.props.style.fontSize === '0.98em');
if (emTitles.length === 0) fail('行标题应走 em（0.98em）锚到缩放根');
if (failures === 0) ok('展开态：行渲染 + 根跟档 + 行标题 em 链完好');

// ── G) 「＋ 新增」按钮：背景跟字走＋高档不换行（#116 跟进） ──
{
  const cands = pageExp.root.findAll((n) => n.type === 'button' && n.props && n.props.style && n.props.style.width === 'auto');
  const plusAdd = cands.filter((n) => {
    try { return String((n.children || []).join('')).indexOf('＋') === 0; } catch (e) { return false; }
  })[0];
  if (!plusAdd) fail('头行应找到「＋ 新增」按钮（width auto）');
  else {
    if (plusAdd.props.style.fontSize !== '0.92em') fail('新增按钮字号应保持 0.92em，实际 ' + plusAdd.props.style.fontSize);
    if (!/em/.test(String(plusAdd.props.style.padding || ''))) fail('新增按钮背景横向 padding 应 em 化（跟档），实际 ' + plusAdd.props.style.padding);
    if (!/em/.test(String(plusAdd.props.style.borderRadius == null ? '' : plusAdd.props.style.borderRadius))) fail('新增按钮背景圆角应 em 化（跟档），实际 ' + plusAdd.props.style.borderRadius);
    if (plusAdd.props.style.whiteSpace !== 'nowrap') fail('新增按钮应 nowrap 锁单行（防高档挤压换行），实际 ' + plusAdd.props.style.whiteSpace);
    if (plusAdd.props.style.flex !== 'none') fail('新增按钮应 flex:none 不参与头行收缩，实际 ' + plusAdd.props.style.flex);
  }
}
if (failures === 0) ok('新增按钮：背景跟档＋单行锁定');

// ── E) compact 悬浮分支行为不变（关=小列表 calc(var * 1)；开=远程大面板 calc(1em * 5.5)，既有行为） ──
remote2.__resetRemoteForTests();
let compactOff;
TR.act(() => { compactOff = TR.create(React.createElement(panelMod.TemplateBrowser, { compact: true })); });
if (compactOff.toJSON().props.style.fontSize !== 'calc(' + BASE_VAR + ' * 1)') fail('compact 关时应保持原样 calc(var * 1)，实际 ' + compactOff.toJSON().props.style.fontSize);
if (compactOff.root.findAll((n) => n.props && n.props['data-dsh-prompt-remote-panel'] === '1').length !== 0) fail('compact 关时不应渲染远程大面板分支');
TR.act(() => { remote2.setRemoteEnabled(true); remote2.setRemoteSize(10); });
let compactOn;
TR.act(() => { compactOn = TR.create(React.createElement(panelMod.TemplateBrowser, { compact: true })); });
const bigOn = compactOn.root.findAll((n) => n.props && n.props['data-dsh-prompt-remote-panel'] === '1')[0];
if (!bigOn) fail('compact 开时应渲染远程大面板分支（既有行为）');
else if (bigOn.props.style.fontSize !== 'calc(1em * 5.5)') fail('远程大面板根应跟全额 calc(1em * 5.5)，实际 ' + bigOn.props.style.fontSize);
if (failures === 0) ok('compact 悬浮分支行为不变（无回归）');
remote2.__resetRemoteForTests();

// ── A) helper 纯断言（收敛点结构锁定：开 calc(var 基)、关 var） ──
if (typeof view.scaledBaseFontSize !== 'function') fail('remoteView 应导出 scaledBaseFontSize（缩放根收敛点）');
else {
  if (view.scaledBaseFontSize(false, 10) !== BASE_VAR) fail('关应回基准 var');
  if (view.scaledBaseFontSize(true, 10) !== 'calc(' + BASE_VAR + ' * 5.5)') fail('开10档应全额 5.5');
  if (view.scaledBaseFontSize(true, 1) !== 'calc(' + BASE_VAR + ' * 1)') fail('开1档应 1x');
  if (view.scaledBaseFontSize(true, 99) !== 'calc(' + BASE_VAR + ' * 5.5)') fail('越界档应钳制到边缘');
  if (view.scaledBaseFontSize(true, 'x') !== 'calc(' + BASE_VAR + ' * 3)') fail('非法档应回默认 5 档（3x）');
  if (view.scaledBaseFontSize('yes', 10) !== BASE_VAR) fail('enabled 非 true 应回基准');
  if (view.scaledBaseFontSize(true, NaN) !== 'calc(' + BASE_VAR + ' * 3)') fail('NaN 档应回默认 5 档（3x）');
}
if (failures === 0) ok('helper 纯断言（开关/档位/非法输入）');

// ── F) 源码级：缩放根走 helper（防手写表达式漂移） ──
const panelSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'panel.ts'), 'utf8');
const settingsSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'settings.ts'), 'utf8');
if (!panelSrc.includes('scaledBaseFontSize')) fail('panel.ts 缩放根应走 scaledBaseFontSize');
if (!settingsSrc.includes('scaledBaseFontSize')) fail('settings.ts 缩放根应走 scaledBaseFontSize');
if (failures === 0) ok('源码级：双缩放根收敛到 helper');

// 收尾：回归 #77 折叠语义不受影响（默认收起零行）由 test-issue-77 覆盖，此处只确认默认收起仍成立
remote2.__resetRemoteForTests();
let pageFinal;
TR.act(() => { pageFinal = TR.create(React.createElement(settingsMod.SettingsPage, {})); });
const rowsFinal = pageFinal.root.findAll((n) => n.props && n.props['data-dsh-prompt-id']);
if (rowsFinal.length !== 0) fail('默认收起模板行应为 0（#77 语义），实际 ' + rowsFinal.length);
if (failures === 0) ok('默认收起语义不变');

if (failures > 0) { console.log('\nRESULT: FAIL (' + failures + ')'); process.exit(1); }
console.log('\nRESULT: PASS');
