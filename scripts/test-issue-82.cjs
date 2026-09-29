// 回归测试 #82：常驻开关+持久化+远程下配置键直达（TS）
// 覆盖 #82 验收自查（规格以 #85 为准）：
//  1) 关=小/开=大零中间态、栏头不设切换（源码级）
//  2) 设置页远程段：总闸默认关 + 字号/控件三档 + 宿主缺席只灰对应行（渲染器）
//  3) 持久化：host 桥 remote/set + 失败当次有效下次默认并明示（纯函数 + 源码级）
//  4) 配置键：仅远程下出现，点开自家设置弹窗放完整配置面板（2026-09-29 用户拍板替代 DOM 兜底）
// 口径：纯函数走转译断言，装配与直达走渲染器（#85 §Testing Decisions）。
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }
const DIR = path.join(__dirname, '.rt-tmp-82');
fs.mkdirSync(DIR, { recursive: true });

function fail(msg) { console.log('FAIL: ' + msg); process.exit(1) }
function ok(msg) { console.log(' ok: ' + msg) }

const ROOT = path.join(__dirname, '..');
const REMOTE_TS = path.join(ROOT, 'src', 'client', 'remote.ts');

// ── 1) 纯函数（转译后断言） ──
let remoteJs = ts.transpileModule(fs.readFileSync(REMOTE_TS, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true },
}).outputText;
fs.writeFileSync(path.join(DIR, 'remote.cjs'), remoteJs);
const remote = require(path.join(DIR, 'remote.cjs'));

// 默认关（含方向偏好自动；字号/控件默认大，2026-09-29 用户拍板初始即大）
if (JSON.stringify(remote.REMOTE_DEFAULTS) !== JSON.stringify({ enabled: false, font: 'large', control: 'large', orientation: 'auto' }))
  fail('REMOTE_DEFAULTS 应为 {enabled:false,font:large,control:large,orientation:auto}，实际 ' + JSON.stringify(remote.REMOTE_DEFAULTS));
ok('总闸默认关、档位默认大、方向默认自动');

// 开=大、关=小、零中间态
if (remote.isBigList({ enabled: true, font: 'small', control: 'small', orientation: 'auto' }) !== true) fail('开应为大');
if (remote.isBigList({ enabled: false, font: 'large', control: 'large', orientation: 'landscape' }) !== false) fail('关应为小');
ok('开必大、关必小、零中间态');

// 档位校验与归一化（含方向偏好）
if (!remote.isRemoteTier('small') || !remote.isRemoteTier('medium') || !remote.isRemoteTier('large')) fail('三档校验失败');
if (remote.isRemoteTier('xlarge')) fail('非法档应拒绝');
if (!remote.isRemoteOrientationPref('auto') || !remote.isRemoteOrientationPref('landscape') || !remote.isRemoteOrientationPref('portrait')) fail('方向三档校验失败');
if (remote.isRemoteOrientationPref('up')) fail('非法方向应拒绝');
const n1 = remote.normalizeRemotePrefs({ enabled: 1, font: 'x', control: null, orientation: 'up' });
if (n1.enabled !== false || n1.font !== 'large' || n1.control !== 'large' || n1.orientation !== 'auto') fail('归一化应回默认: ' + JSON.stringify(n1));
const n2 = remote.normalizeRemotePrefs({ enabled: true, font: 'large', control: 'small', orientation: 'portrait' });
if (n2.enabled !== true || n2.font !== 'large' || n2.control !== 'small' || n2.orientation !== 'portrait') fail('合法值应保留');
ok('三档校验与归一化（坏值回默认，含方向偏好）');

// 宿主能力位已废弃：恒缺席，仅兼容保留
remote.__setRemoteHostCapsForTests(null);
const caps = remote.getRemoteHostCaps();
if (caps.hasSystemOrientation !== false || caps.hasSystemFont !== false || caps.hasStableOpen !== false)
  fail('宿主能力默认应全缺席（废弃兼容）: ' + JSON.stringify(caps));
ok('宿主能力位废弃兼容（恒缺席，不再门控）');

// 直达：去宿主化后以本插件 DOM 链为官方路径
let domCalled = false;
globalThis.__dshPromptGoRemoteSettings = () => { domCalled = true };
delete globalThis.__dshPromptStableOpen;
const r1 = remote.openRemoteSettings();
if (r1.method !== 'dom' || r1.ok !== true || !domCalled) fail('应走本插件 DOM 官方路径: ' + JSON.stringify(r1));
ok('配置键直达走本插件官方路径');
delete globalThis.__dshPromptGoRemoteSettings;

// setRemoteEnabled/Font/Control/Orientation 当次有效（无 fetch 环境 → persist 置失败位但内存生效）
remote.__resetRemoteForTests();
const afterOn = remote.setRemoteEnabled(true);
if (afterOn.enabled !== true || remote.getRemotePrefs().enabled !== true) fail('总闸当次应有效');
const afterFont = remote.setRemoteFont('large');
if (afterFont.font !== 'large') fail('字号档当次应有效');
const badFont = remote.setRemoteFont('xlarge');
if (badFont.font !== 'large') fail('非法档不应生效');
const afterOrient = remote.setRemoteOrientation('landscape');
if (afterOrient.orientation !== 'landscape' || remote.getRemotePrefs().orientation !== 'landscape') fail('方向偏好当次应有效');
const badOrient = remote.setRemoteOrientation('up');
if (badOrient.orientation !== 'landscape') fail('非法方向不应生效');
ok('总闸/档位/方向当次有效、非法拒绝');
remote.__resetRemoteForTests();
remote.__setRemoteHostCapsForTests(null);

// ── 2) 源码级：栏头不设切换、设置页与 /prompt 保持原样（#85 US27） ──
const panelSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'panel.ts'), 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '')).join('\n');
const panelCode = stripComments(panelSrc);
// 栏头（compact 头行）不得出现大/小切换：断言头行附近无 remote toggle/档位字样
const headSlice = panelCode.slice(panelCode.indexOf('compact ? h('), panelCode.indexOf('compact ? h(') + 3000);
if (/remote|远程|大列表|小列表/.test(headSlice)) fail('栏头不得设大/小切换（compact 头行混入远程字样）');
ok('栏头不设切换');

const settingsSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'settings.ts'), 'utf8');
for (const marker of ['data-dsh-prompt-remote-section', 'data-dsh-prompt-remote-toggle', 'data-dsh-prompt-remote-orientation', 'data-dsh-prompt-orientation', 'remote-persist-note']) {
  if (!settingsSrc.includes(marker)) fail('settings.ts 缺少远程段标记: ' + marker);
}
if (settingsSrc.includes('整机待宿主') || settingsSrc.includes('remote-sys-orientation') || settingsSrc.includes('remote-sys-font')) fail('去宿主化后不应残留灰行/待宿主文案');
ok('设置页远程段（总闸+三档+方向偏好+失败明示，去宿主化）源码齐');

const buttonSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'button.ts'), 'utf8');
for (const marker of ['data-dsh-prompt-remote-gear', 'data-dsh-prompt-settings-modal', 'SettingsPage']) {
  if (!buttonSrc.includes(marker)) fail('button.ts 缺少配置键标记: ' + marker);
}
// 配置键仅远程下出现：!remote.enabled 早退分支必须存在（齿轮与弹窗都不应对老用法露面）
if (!buttonSrc.includes('if (!remote.enabled) return gearModalNode')) fail('配置键应仅远程下出现（早退分支缺失）');
ok('对话框配置键仅远程下出现、缺席明示源码齐');

const remoteSrc = fs.readFileSync(REMOTE_TS, 'utf8');
for (const marker of ['/_dsh/dsh-prompt/remote/set', '/_dsh/dsh-prompt/store', 'store.persist.fail', 'settings.remote.toggle']) {
  if (!remoteSrc.includes(marker)) fail('remote.ts 缺少持久化桥标记: ' + marker);
}
ok('持久化桥（DSH 缓存目录语义 + 失败明示）源码齐');

const triggerSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'trigger.ts'), 'utf8');
if (/remote/i.test(stripComments(triggerSrc))) fail('/prompt 触发源不应被远程改动（US27 管理面保持原样）');
ok('设置页与 /prompt 管理面保持原样（trigger 未动远程）');

// ── 3) 渲染器：设置页装配 + 配置键直达 ──
// settings 的 about/update 依赖重（含 bridge/derived），此处用桩替换——本票只断远程段装配，不测头部链接与更新入口。
const MODULES = [
  ['templates.ts', path.join(ROOT, 'src', 'client', 'templates.ts'), []],
  ['store.ts', path.join(ROOT, 'src', 'client', 'store.ts'), ['./templates']],
  ['state.ts', path.join(ROOT, 'src', 'client', 'state.ts'), []],
  ['i18n.ts', path.join(ROOT, 'src', 'client', 'i18n.ts'), []],
  ['smartstore.ts', path.join(ROOT, 'src', 'client', 'smartstore.ts'), []],
  ['remote2.cjs', REMOTE_TS, []],
  ['remoteView.cjs', path.join(ROOT, 'src', 'client', 'remoteView.ts'), []],
  ['systemOrientation.cjs', path.join(ROOT, 'src', 'client', 'systemOrientation.ts'), []],
  ['panel.cjs', path.join(ROOT, 'src', 'client', 'panel.ts'), ['./templates', './store', './state', './i18n', './smartstore', './remote', './remoteView']],
  ['settings.cjs', path.join(ROOT, 'src', 'client', 'settings.ts'), ['./panel', './about', './update', './smartstore', './remote', './remoteView', './systemOrientation', './i18n']],
  ['button.cjs', path.join(ROOT, 'src', 'client', 'button.ts'), ['./panel', './state', './settings', './remote', './remoteView', './i18n']],
];
fs.writeFileSync(path.join(DIR, 'about.cjs'), 'module.exports.SettingsHeaderLinks=()=>null;module.exports.AuthorPlugins=()=>null;');
fs.writeFileSync(path.join(DIR, 'update.cjs'), 'module.exports.UpdateEntry=()=>null;');
for (const [outName, srcPath, deps] of MODULES) {
  let src = fs.readFileSync(srcPath, 'utf8');
  let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true } }).outputText;
  for (const d of deps) js = js.split('require("' + d + '")').join('require("' + d + '.cjs")');
  // settings 引 './remote' → remote2.cjs；button 同理；panel 引 './remote' + './remoteView'
  js = js.split('require("./remote.cjs")').join('require("./remote2.cjs")');
  js = js.split('require("./remoteView.cjs")').join('require("./remoteView.cjs")');
  js = js.split('require("./systemOrientation.cjs")').join('require("./systemOrientation.cjs")');
  const outFile = outName.endsWith('.cjs') ? outName : outName.replace(/\.ts$/, '.cjs');
  fs.writeFileSync(path.join(DIR, outFile), js);
}
const React = require('react');
const TR = require('react-test-renderer');
const settingsMod = require(path.join(DIR, 'settings.cjs'));
const buttonMod = require(path.join(DIR, 'button.cjs'));
const remote2 = require(path.join(DIR, 'remote2.cjs'));

// SettingsPage：远程段存在、总闸默认关、方向偏好默认自动（去宿主化，无灰行）
remote2.__resetRemoteForTests();
remote2.__setRemoteHostCapsForTests(null);
let created;
TR.act(() => { created = TR.create(React.createElement(settingsMod.SettingsPage, {})); });
let root = created.root;
const byAttr = (k, v) => root.findAll((x) => x.props && x.props[k] === v)[0];
const section = byAttr('data-dsh-prompt-remote-section', '1');
if (!section) fail('设置页缺远程段 [data-dsh-prompt-remote-section]');
const toggle = byAttr('data-dsh-prompt-remote-toggle', '1');
if (!toggle) fail('设置页缺总闸 [data-dsh-prompt-remote-toggle]');
if (toggle.props.checked !== false) fail('总闸默认应关');
ok('渲染器：设置页远程段装配、总闸默认关');
// 去宿主化：无整机灰行、无待宿主文案；方向偏好三档可点
const allText = JSON.stringify(created.toJSON());
if (/整机待宿主/.test(allText)) fail('去宿主化后不应残留「整机待宿主」');
const orientBtns = root.findAll((x) => x.props && x.props['data-dsh-prompt-orientation']);
if (orientBtns.length !== 3) fail('方向偏好应有自动/横竖三档，实际 ' + orientBtns.length);
ok('渲染器：方向偏好三档装配、无宿主灰行');
// 三档按钮存在
const tiers = root.findAll((x) => x.props && x.props['data-dsh-prompt-tier']);
if (tiers.length < 6) fail('字号/控件三档按钮应各 3 个，实际 ' + tiers.length);
ok('渲染器：字号/控件三档装配');

// EntryButton：关时无齿轮、开时有齿轮；齿轮点开自家设置弹窗放完整配置面板（2026-09-29 用户拍板，
// 不再走宿主设置页 DOM 兜底），弹窗内含远程段，零宿主依赖。
remote2.__resetRemoteForTests();
let ebOff;
TR.act(() => { ebOff = TR.create(React.createElement(buttonMod.EntryButton, { open: false })); });
let gearsOff = ebOff.root.findAll((x) => x.props && x.props['data-dsh-prompt-remote-gear'] === '1');
if (gearsOff.length !== 0) fail('关时配置键不应出现（老用法零打扰）');
ok('渲染器：关=小列表不变、配置键缺席（零打扰）');
remote2.setRemoteEnabled(true);
let ebOn;
TR.act(() => { ebOn = TR.create(React.createElement(buttonMod.EntryButton, { open: false })); });
let gearsOn = ebOn.root.findAll((x) => x.props && x.props['data-dsh-prompt-remote-gear'] === '1');
if (gearsOn.length !== 1) fail('开时配置键应出现 1 枚，实际 ' + gearsOn.length);
if (!/远程设置/.test(String(gearsOn[0].props.title))) fail('配置键 title 应为远程设置，实际 ' + gearsOn[0].props.title);
ok('渲染器：开=大（配置键出现）');
// 齿轮点击开自家设置弹窗，弹窗内含远程段（总闸+三档可直接调）
TR.act(() => { gearsOn[0].props.onClick(); });
const modals = ebOn.root.findAll((x) => x.props && x.props['data-dsh-prompt-settings-modal'] === '1');
if (modals.length !== 1) fail('齿轮点击应弹出自家设置弹窗，实际 ' + modals.length);
const modalRemote = ebOn.root.findAll((x) => x.props && x.props['data-dsh-prompt-remote-section'] === '1');
if (modalRemote.length < 1) fail('设置弹窗内应含远程段');
const modalToggle = ebOn.root.findAll((x) => x.props && x.props['data-dsh-prompt-remote-toggle'] === '1');
if (modalToggle.length < 1) fail('设置弹窗内应含总闸可直接调');
ok('渲染器：配置键点击开自家设置弹窗（含远程段）');
// 三档全局跟随：设置页根带 zoom（字号档缩放配置面所有文字）；齿轮尺寸随控件档变
const settingsJson = JSON.stringify(created.toJSON());
if (!/zoom/.test(settingsJson)) fail('设置页根应带 zoom 跟随字号档');
remote2.setRemoteEnabled(true);
remote2.setRemoteControl('small');
let ebSmall;
TR.act(() => { ebSmall = TR.create(React.createElement(buttonMod.EntryButton, { open: false })); });
const gearSmallW = ebSmall.root.findAll((x) => x.props && x.props['data-dsh-prompt-remote-gear'] === '1')[0].props.style.width;
ebSmall.unmount();
remote2.setRemoteControl('large');
let ebLarge;
TR.act(() => { ebLarge = TR.create(React.createElement(buttonMod.EntryButton, { open: false })); });
const gearLargeW = ebLarge.root.findAll((x) => x.props && x.props['data-dsh-prompt-remote-gear'] === '1')[0].props.style.width;
if (!(gearLargeW > gearSmallW)) fail('齿轮尺寸应随控件档变大，实际小 ' + gearSmallW + ' 大 ' + gearLargeW);
ok('渲染器：三档全局跟随（设置页 zoom + 入口/齿轮缩放）');
remote2.__resetRemoteForTests();
remote2.__setRemoteHostCapsForTests(null);

console.log('=== Test #82 PASS ===');
process.exit(0);
