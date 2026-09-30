// 回归测试 #82：常驻开关+持久化+远程下配置键直达（TS）
// 覆盖 #82 验收自查（规格以 #85 为准）：
//  1) 关=小/开=大零中间态、栏头不设切换（源码级）
//  2) 设置页远程段：总闸默认关 + 统一大小滑块 + 无宿主灰行（渲染器）
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

// 默认关（统一大小默认 5，方向偏好自动，密度默认 A；2026-09-29 单滑块 1–10，用户拍板默认 5 档=2x 起步即大）
if (JSON.stringify(remote.REMOTE_DEFAULTS) !== JSON.stringify({ enabled: false, size: 5, orientation: 'auto', density: 'a' }))
  fail('REMOTE_DEFAULTS 应为 {enabled:false,size:5,orientation:auto,density:a}，实际 ' + JSON.stringify(remote.REMOTE_DEFAULTS));
ok('总闸默认关、大小默认 5、方向默认自动、密度默认 A');

// 开=大、关=小、零中间态
if (remote.isBigList({ enabled: true, size: 1, orientation: 'auto' }) !== true) fail('开应为大');
if (remote.isBigList({ enabled: false, size: 10, orientation: 'landscape' }) !== false) fail('关应为小');
ok('开必大、关必小、零中间态');

// 大小校验与归一化（含方向偏好；旧三档 large→2、其余→1 迁入）
if (!remote.isRemoteSize(1) || !remote.isRemoteSize(10)) fail('边界档应合法');
if (remote.isRemoteSize(0) || remote.isRemoteSize(11) || remote.isRemoteSize('x')) fail('越界/非法应拒绝');
if (!remote.isRemoteOrientationPref('auto') || !remote.isRemoteOrientationPref('landscape') || !remote.isRemoteOrientationPref('portrait')) fail('方向三档校验失败');
if (remote.isRemoteOrientationPref('up')) fail('非法方向应拒绝');
const n1 = remote.normalizeRemotePrefs({ enabled: 1, size: 99, orientation: 'up' });
if (n1.enabled !== false || n1.size !== 5 || n1.orientation !== 'auto') fail('归一化应回默认: ' + JSON.stringify(n1));
const nLegacy = remote.normalizeRemotePrefs({ enabled: true, font: 'large', control: 'small', orientation: 'portrait' });
if (nLegacy.enabled !== true || nLegacy.size !== 2 || nLegacy.orientation !== 'portrait') fail('旧大档应迁入 2: ' + JSON.stringify(nLegacy));
const nLegacySmall = remote.normalizeRemotePrefs({ enabled: false, font: 'small', control: 'medium' });
if (nLegacySmall.size !== 1) fail('旧中小档应迁入 1: ' + JSON.stringify(nLegacySmall));
const n2 = remote.normalizeRemotePrefs({ enabled: true, size: 10, orientation: 'portrait' });
if (n2.enabled !== true || n2.size !== 10 || n2.orientation !== 'portrait') fail('合法值应保留');
if (n2.density !== 'a') fail('旧数据无密度键应回 a，实际 ' + n2.density);
const n3 = remote.normalizeRemotePrefs({ enabled: true, size: 2, orientation: 'auto', density: 'b' });
if (n3.density !== 'b') fail('合法密度 b 应保留');
const n4 = remote.normalizeRemotePrefs({ enabled: true, density: 'c' });
if (n4.density !== 'a') fail('非法密度应回 a');
if (!remote.isRemoteDensity('a') || !remote.isRemoteDensity('b') || remote.isRemoteDensity('x')) fail('密度校验错误');
ok('大小校验与归一化（坏值回默认，旧档迁移，含方向偏好与密度）');

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

// setRemoteEnabled/Size/Orientation 当次有效（无 fetch 环境 → persist 置失败位但内存生效）
remote.__resetRemoteForTests();
const afterOn = remote.setRemoteEnabled(true);
if (afterOn.enabled !== true || remote.getRemotePrefs().enabled !== true) fail('总闸当次应有效');
const afterSize = remote.setRemoteSize(10);
if (afterSize.size !== 10) fail('大小档当次应有效');
const badSize = remote.setRemoteSize('large');
if (badSize.size !== 10) fail('非法档不应生效');
const afterOrient = remote.setRemoteOrientation('landscape');
if (afterOrient.orientation !== 'landscape' || remote.getRemotePrefs().orientation !== 'landscape') fail('方向偏好当次应有效');
const badOrient = remote.setRemoteOrientation('up');
if (badOrient.orientation !== 'landscape') fail('非法方向不应生效');
ok('总闸/档位/方向当次有效、非法拒绝');
// #90 密度档：set 切档当次有效、非法拒绝（原值不动）
const afterDensity = remote.setRemoteDensity('b');
if (afterDensity.density !== 'b' || remote.getRemotePrefs().density !== 'b') fail('密度切 b 当次应有效');
const badDensity = remote.setRemoteDensity('x');
if (badDensity.density !== 'b') fail('非法密度不应生效');
ok('密度切档当次有效、非法拒绝');
// #93 跨插件面（页内 setter 落地 + 通知；既有 harness 形态）：
// 导出 + 页内 global 双形，收 boolean 或 { enabled }，经既有订阅通知 + 既有 settings.remote.toggle 事件，无新事件名。
remote.__resetRemoteForTests();
if (typeof remote.setRemoteFromExternal !== 'function') fail('remote.ts 缺 setRemoteFromExternal 导出（#93 页内 setter）');
if (typeof globalThis.__dshPromptSetRemote !== 'function') fail('页内 globalThis.__dshPromptSetRemote 未装配（#93）');
let notified = 0;
const unsub = remote.subscribeRemote(() => { notified += 1 });
let rExt = remote.setRemoteFromExternal(true);
if (rExt.enabled !== true || remote.getRemotePrefs().enabled !== true) fail('页内 setter(true) 应落地');
if (notified < 1) fail('页内 setter 应走既有订阅通知');
rExt = globalThis.__dshPromptSetRemote({ enabled: false });
if (rExt.enabled !== false || remote.getRemotePrefs().enabled !== false) fail('页内 global({enabled:false}) 应落地');
if (notified < 2) fail('页内 global 应走既有订阅通知');
rExt = remote.setRemoteFromExternal({ enabled: true });
if (remote.getRemotePrefs().enabled !== true) fail('页内 setter({enabled:true}) 应落地');
const beforeBad = remote.getRemotePrefs().enabled;
remote.setRemoteFromExternal({ enabled: 'x' });
if (remote.getRemotePrefs().enabled !== beforeBad) fail('非法页内输入不应生效（原值不动）');
remote.setRemoteFromExternal(undefined);
if (remote.getRemotePrefs().enabled !== beforeBad) fail('undefined 输入不应生效');
try { unsub(); } catch (e) { /* ignore */ }
// 事件复用：沿用既有 settings.remote.toggle，不新增事件名
const remoteSrc93 = fs.readFileSync(REMOTE_TS, 'utf8');
if (!remoteSrc93.includes('settings.remote.toggle')) fail('页内 setter 应复用 settings.remote.toggle 事件');
if (/settings\.remote\.(external|cross|api)/.test(remoteSrc93)) fail('页内 setter 不得新增事件名');
for (const marker of ['__dshPromptSetRemote', 'setRemoteFromExternal', 'last-write-wins', '无鉴权']) {
  if (!remoteSrc93.includes(marker)) fail('remote.ts 缺跨插件面标记: ' + marker);
}
ok('跨插件页内 setter 落地 + 既有通知 + 事件复用（#93）');
// #93 跨插件面（POST 形状，源码级）：官方化既有路由，不改路由，只断形状与注释
{
  const hostSrc = fs.readFileSync(path.join(ROOT, 'lib', 'index.js'), 'utf8');
  for (const marker of ['/_dsh/dsh-prompt/remote/set', 'store.setRemote', '跨插件', 'last-write-wins']) {
    if (!hostSrc.includes(marker)) fail('lib/index.js 缺跨插件 POST 标记: ' + marker);
  }
}
ok('跨插件 POST 形状官方化（#93，不改路由）');
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
for (const marker of ['data-dsh-prompt-remote-section', 'data-dsh-prompt-remote-toggle', 'data-dsh-prompt-size-slider', 'data-dsh-prompt-size-value', 'data-dsh-prompt-remote-orientation', 'data-dsh-prompt-orientation', 'data-dsh-prompt-remote-density', 'data-dsh-prompt-density', 'remote-persist-note']) {
  if (!settingsSrc.includes(marker)) fail('settings.ts 缺少远程段标记: ' + marker);
}
if (settingsSrc.includes('整机待宿主') || settingsSrc.includes('remote-sys-orientation') || settingsSrc.includes('remote-sys-font')) fail('去宿主化后不应残留灰行/待宿主文案');
ok('设置页远程段（总闸+单滑块+方向偏好+失败明示，去宿主化）源码齐');

const buttonSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'button.ts'), 'utf8');
for (const marker of ['data-dsh-prompt-remote-gear', 'data-dsh-prompt-settings-modal', 'SettingsPage']) {
  if (!buttonSrc.includes(marker)) fail('button.ts 缺少配置键标记: ' + marker);
}
// 配置键仅远程下出现：!remote.enabled 早退分支必须存在（齿轮与弹窗都不应对老用法露面）
if (!buttonSrc.includes('if (!remote.enabled) return gearModalNode')) fail('配置键应仅远程下出现（早退分支缺失）');
ok('对话框配置键仅远程下出现、缺席明示源码齐');

const remoteSrc = fs.readFileSync(REMOTE_TS, 'utf8');
for (const marker of ['/_dsh/dsh-prompt/remote/set', '/_dsh/dsh-prompt/store', 'store.persist.fail', 'settings.remote.toggle', 'settings.remote.size', 'settings.remote.density']) {
  if (!remoteSrc.includes(marker)) fail('remote.ts 缺少持久化桥标记: ' + marker);
}
ok('持久化桥（DSH 缓存目录语义 + 失败明示）源码齐');

const triggerSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'trigger.ts'), 'utf8');
if (/remote/i.test(stripComments(triggerSrc))) fail('/prompt 触发源不应被远程改动（US27 管理面保持原样）');
ok('设置页与 /prompt 管理面保持原样（trigger 未动远程）');

// 新定稿3（放行仅 TemplateModal 两行纯样式）：远程编辑/新增弹窗宽+50%、正文框高2倍，非远程不动
{
  const panelSrc82 = fs.readFileSync(path.join(ROOT, 'src', 'client', 'panel.ts'), 'utf8');
  if (!panelSrc82.includes("labelGridOn ? 'min(1440px, 96vw)' : 'min(640px, 94vw)'")) fail('远程弹窗宽应为 min(1440px,96vw)，非远程 min(640px,94vw) 不动');
  if (!panelSrc82.includes('height: labelGridOn ? 400 : 200')) fail('远程正文框高应 400，非远程 200 不动');
  ok('远程编辑/新增弹窗宽高（1440/96vw + 正文400，非远程不动）源码齐');
}

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
// 智能推荐配置区暂藏：设置页不渲染该组（逻辑/i18n/persist 保留）
{
  const smartText = JSON.stringify(created.toJSON());
  for (const s of ['智能推荐', '智能模式悬浮卡']) {
    if (smartText.includes(s)) fail('设置页不应再渲染智能推荐配置区: ' + s);
  }
  if (settingsSrc.includes("key: 'smart'") || settingsSrc.includes('smartToggle')) fail('settings 不应再渲染智能行（键与调用保留在 i18n/smart.ts）');
  ok('渲染器：智能推荐配置区已隐藏（功能暂不放开）');
}
// 去宿主化：无整机灰行、无待宿主文案；方向偏好三档可点
const allText = JSON.stringify(created.toJSON());
if (/整机待宿主/.test(allText)) fail('去宿主化后不应残留「整机待宿主」');
const orientBtns = root.findAll((x) => x.props && x.props['data-dsh-prompt-orientation']);
if (orientBtns.length !== 3) fail('方向偏好应有自动/横竖三档，实际 ' + orientBtns.length);
ok('渲染器：方向偏好三档装配、无宿主灰行');
// #90 密度两段：设置页远程段与方向偏好并列，默认 A 高亮（hint 行已按定稿删除）
const densityWrap = root.findAll((x) => x.props && x.props['data-dsh-prompt-remote-density'] === '1')[0];
if (!densityWrap) fail('设置页缺密度两段 [data-dsh-prompt-remote-density]');
const densityBtns = root.findAll((x) => x.props && x.props['data-dsh-prompt-density']);
if (densityBtns.length !== 2) fail('密度应有 12宫/8宫大卡两段，实际 ' + densityBtns.length);
const i18nSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'i18n.ts'), 'utf8');
for (const marker of ['remoteDensity', 'remoteDensityA', 'remoteDensityB']) {
  if (!i18nSrc.includes(marker)) fail('i18n 缺密度文案: ' + marker);
}
// 定稿1/2：两 hint 行整行删除，i18n 键无他用一并删除
for (const dead of ['remoteSizeHint', 'remoteDensityHint', '1档100%，10档325%；开远程生效。', '12宫格标准 / 8宫格；切档页码归零。']) {
  if (i18nSrc.includes(dead)) fail('i18n 不应残留已删 hint: ' + dead);
  if (settingsSrc.includes(dead)) fail('settings 不应残留已删 hint: ' + dead);
}
if (/1档100%|切档页码归零/.test(allText)) fail('设置页不应再渲染已删 hint 行');
// 定稿3语义：关时置灰不可切，开时才可手动切换
TR.act(() => { remote2.setRemoteEnabled(true); });
const densityBtnsOn = root.findAll((x) => x.props && x.props['data-dsh-prompt-density']);
TR.act(() => { densityBtnsOn[1].props.onClick(); });
if (remote2.getRemotePrefs().density !== 'b') fail('点 8宫大卡应切 b，实际 ' + remote2.getRemotePrefs().density);
TR.act(() => { densityBtnsOn[0].props.onClick(); });
if (remote2.getRemotePrefs().density !== 'a') fail('点 12宫应切回 a');
ok('渲染器：密度两段装配、手动切换、文案齐');
TR.act(() => { remote2.setRemoteEnabled(false); });
// 统一大小滑块存在（单滑块 1–10，字号控件联动）
const slider = root.findAll((x) => x.props && x.props['data-dsh-prompt-size-slider'] === '1')[0];
if (!slider) fail('设置页缺统一大小滑块');
if (slider.props.min !== 1 || slider.props.max !== 10) fail('滑块应为 1–10 档');
ok('渲染器：统一大小滑块装配');
// 滑块拖动用浏览器真值（字符串）必须生效：此前字符串直传被拒收、滑块成摆设
TR.act(() => { slider.props.onChange({ target: { value: '8' } }); });
if (remote2.getRemotePrefs().size !== 8) fail('字符串档位 8 应落地，实际 ' + remote2.getRemotePrefs().size);
ok('渲染器：滑块字符串值可落地（浏览器真值）');
// 定稿3：远程关时滑块/宫格两段/方向三段置灰，总闸不受影响
{
  remote2.__resetRemoteForTests();
  TR.act(() => { remote2.setRemoteEnabled(false); });
  const sliderOff = root.findAll((x) => x.props && x.props['data-dsh-prompt-size-slider'] === '1')[0];
  if (!sliderOff || sliderOff.props.disabled !== true) fail('关时大小滑块应 disabled');
  // 滑块 transform 关=原样（定稿4半项）
  if (sliderOff.props.style.transform !== 'none') fail('关时滑块 transform 应为 none，实际 ' + sliderOff.props.style.transform);
  const densOff = root.findAll((x) => x.props && x.props['data-dsh-prompt-density']);
  if (densOff.length !== 2 || densOff.some((b) => b.props.disabled !== true)) fail('关时宫格两段应 disabled');
  const orientOff = root.findAll((x) => x.props && x.props['data-dsh-prompt-orientation']);
  if (orientOff.length !== 3 || orientOff.some((b) => b.props.disabled !== true)) fail('关时方向三段应 disabled');
  const toggleOff = root.findAll((x) => x.props && x.props['data-dsh-prompt-remote-toggle'] === '1')[0];
  if (!toggleOff || toggleOff.props.disabled === true) fail('总闸开关不应受影响（不得 disabled）');
  ok('渲染器：关时滑块/宫格/方向置灰、总闸不受影响');
  // 定稿5：“12宫格”按钮禁换行，等宽体系保持（flex:1）
  for (const b of densOff) {
    if (b.props.style.whiteSpace !== 'nowrap') fail('密度按钮应 whiteSpace:nowrap');
    if (b.props.style.flex !== 1) fail('密度按钮应保持 flex:1 等宽');
  }
  ok('渲染器：密度按钮禁换行、等宽体系保持');
  // 新定稿1+2：滑块只纵向跟档 scale(1,s)；开关 1.15em + inherit 吃根
  if (!settingsSrc.includes('1.15em')) fail('总闸开关应保持 1.15em');
  if (!settingsSrc.includes('inherit')) fail('开关 em 应接 inherit 吃根 scale（原生 input 不继承字号）');
  if (!settingsSrc.includes('transform') || !settingsSrc.includes('remoteSizeScale(remote.size)')) fail('滑块应走 transform 跟档');
  if (!settingsSrc.includes('scale(1,')) fail('滑块应只纵向跟档 scale(1,s)，宽固定');
  TR.act(() => { remote2.setRemoteEnabled(true); remote2.setRemoteSize(10); });
  const sliderOn = root.findAll((x) => x.props && x.props['data-dsh-prompt-size-slider'] === '1')[0];
  if (!sliderOn || sliderOn.props.disabled === true) fail('开时滑块应可用');
  if (sliderOn.props.style.transform !== 'scale(1, 3.25)') fail('开10档滑块应 scale(1, 3.25)，实际 ' + sliderOn.props.style.transform);
  const toggleOn = root.findAll((x) => x.props && x.props['data-dsh-prompt-remote-toggle'] === '1')[0];
  if (!toggleOn) fail('开时总闸开关应存在');
  const toggleInput = toggleOn.findAll((x) => x.type === 'input' && x.props && x.props.type === 'checkbox')[0];
  if (!toggleInput || !toggleInput.props.style || toggleInput.props.style.fontSize !== 'inherit') fail('总闸开关 input 应 fontSize:inherit 吃根 scale');
  if (toggleInput.props.style.width !== '1.15em' || toggleInput.props.style.height !== '1.15em') fail('总闸开关应保持 1.15em');
  const densOn = root.findAll((x) => x.props && x.props['data-dsh-prompt-density']);
  if (densOn.some((b) => b.props.disabled === true)) fail('开时宫格两段应可用');
  const orientOn = root.findAll((x) => x.props && x.props['data-dsh-prompt-orientation']);
  if (orientOn.some((b) => b.props.disabled === true)) fail('开时方向三段应可用（非 busy）');
  ok('渲染器：开时滑块 transform 跟档、宫格/方向可用');
  remote2.__resetRemoteForTests();
}
// 定稿6：日志 hint 定稿字串
{
  if (!i18nSrc.includes('关闭只停信息与调试两级，错误与告警始终记录。')) fail('i18n 日志 hint 应为定稿字串');
  if (/默认关。关只停信息/.test(i18nSrc)) fail('i18n 不应残留旧日志 hint');
  ok('i18n：日志 hint 定稿字串');
}

// EntryButton：关时无齿轮、开时有齿轮；齿轮点开自家设置弹窗放完整配置面板（2026-09-29 用户拍板，
// 不再走宿主设置页 DOM 兜底），弹窗内含远程段，零宿主依赖。
remote2.__resetRemoteForTests();
remote2.setRemoteSize(10);
let ebOff;
TR.act(() => { ebOff = TR.create(React.createElement(buttonMod.EntryButton, { open: false })); });
let gearsOff = ebOff.root.findAll((x) => x.props && x.props['data-dsh-prompt-remote-gear'] === '1');
if (gearsOff.length !== 0) fail('关时配置键不应出现（老用法零打扰）');
// 大小跟随开关：关时入口正常尺寸（档位 10 也不放大）
const entryBtn = ebOff.root.findAll((x) => x.props && x.props['data-dsh-prompt-entry'] === '1')[0];
if (!entryBtn || entryBtn.props.style.fontSize !== 12) fail('关时入口应为正常尺寸，实际 ' + JSON.stringify(entryBtn && entryBtn.props.style.fontSize));
ebOff.unmount();
remote2.__resetRemoteForTests();
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
// 齿轮弹窗宽随字自适应（仅远程）：fit-content 吃内容 + min 保可用 + max 取现状 96vw；非远程原尺寸
{
  if (!buttonSrc.includes("width: 'fit-content'") || !buttonSrc.includes("minWidth: 'min(480px, 94vw)'")) fail('齿轮弹窗远程卡应 fit-content + min 钳制');
  if (!buttonSrc.includes("width: 'min(1200px, 96vw)'")) fail('非远程卡原尺寸 min(1200px,96vw) 应保留');
  const modalCard = modals[0].findAll((x) => x.type === 'div' && x.props && x.props.style && x.props.style.maxWidth === '96vw')[0];
  if (!modalCard) fail('远程设置弹窗卡片应有 maxWidth:96vw 上限');
  if (modalCard.props.style.width !== 'fit-content') fail('远程卡宽应 fit-content 随字，实际 ' + modalCard.props.style.width);
  if (modalCard.props.style.minWidth !== 'min(480px, 94vw)') fail('远程卡应有 min 保可用，实际 ' + modalCard.props.style.minWidth);
  ok('渲染器：齿轮弹窗宽随字自适应（fit-content + min/max 钳制）');
}
// 单滑块全局跟随（无预览版）：大小预览块已删（钩子一并退役），滑块/size 值行为保留；
// 设置页根跟档位（用户拍板：开吃全额、与 compact 小列表 uiFontScale 同构，关=原样零打扰）
if (root.findAll((x) => x.props && (x.props['data-dsh-prompt-size-preview'] === '1' || x.props['data-dsh-prompt-size-sample'] === '1')).length !== 0) fail('大小预览块应已删除');
// 滑块与档位值行为保留：10 档可落，值行随档变
TR.act(() => { remote2.setRemoteSize(10); });
if (remote2.getRemotePrefs().size !== 10) fail('10 档应落地，实际 ' + remote2.getRemotePrefs().size);
const sizeVal = root.findAll((x) => x.props && x.props['data-dsh-prompt-size-value'] === '1')[0];
if (!sizeVal) fail('设置页缺档位值行 [data-dsh-prompt-size-value]');
// 开 10 档时设置页根吃全额（calc 相对缩放，与 compact 同构）
const settingsRootOn = created.toJSON().props.style;
if (settingsRootOn.fontSize !== 'calc(var(--dsw-font-markdown-base-font-size) * 3.25)') fail('开10档设置页根应跟全额，实际 ' + settingsRootOn.fontSize);
// 关时根落宿主基准（em 子项锚点，与旧 px 视觉一致）
TR.act(() => { remote2.setRemoteEnabled(false); });
const settingsRootOff = created.toJSON().props.style;
if (settingsRootOff.fontSize !== 'var(--dsw-font-markdown-base-font-size)') fail('关时设置页根应落基准 var，实际 ' + settingsRootOff.fontSize);
TR.act(() => { remote2.setRemoteEnabled(true); });
remote2.setRemoteEnabled(true);
remote2.setRemoteSize(1);
let ebSmall;
TR.act(() => { ebSmall = TR.create(React.createElement(buttonMod.EntryButton, { open: false })); });
const gearSmallW = ebSmall.root.findAll((x) => x.props && x.props['data-dsh-prompt-remote-gear'] === '1')[0].props.style.width;
ebSmall.unmount();
remote2.setRemoteSize(10);
let ebLarge;
TR.act(() => { ebLarge = TR.create(React.createElement(buttonMod.EntryButton, { open: false })); });
const gearLargeW = ebLarge.root.findAll((x) => x.props && x.props['data-dsh-prompt-remote-gear'] === '1')[0].props.style.width;
if (!(gearLargeW > gearSmallW)) fail('齿轮尺寸应随大小档变大，实际小 ' + gearSmallW + ' 大 ' + gearLargeW);
ok('渲染器：单滑块全局跟随（设置页根跟全额 + 入口/齿轮自由缩放）');
remote2.__resetRemoteForTests();
remote2.__setRemoteHostCapsForTests(null);

// ── 4) #94 齿轮右侧侧栏折叠键（存在性 + 切换调用断言，断到 surface 调用层，不刺探宿主内部） ──
{
  const buttonSrc94 = fs.readFileSync(path.join(ROOT, 'src', 'client', 'button.ts'), 'utf8');
  for (const marker of ['data-dsh-prompt-sidebar-toggle', 'toggleSidebar', 'readSidebarExpanded', 'toggleExpanded', 'isExpanded', 'aria-pressed', 'sidebarExpand', 'sidebarCollapse']) {
    if (!buttonSrc94.includes(marker)) fail('#94 button.ts 缺标记: ' + marker);
  }
  // 只走 surface 面：不得刺探宿主内部（tab 注册/slot 名/哈希类/globalThis 野路子一律禁写；注释里的来源引用除外）
  const buttonCode94 = buttonSrc94.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  for (const bad of ['sidebar.right.pane', 'openTab(', 'data-dsh-sidebar-', '__dshSidebar', 'dshSidebarModule']) {
    if (buttonCode94.includes(bad)) fail('#94 button.ts 刺探宿主内部: ' + bad);
  }
  // 无新日志事件：本文件不得出现 logEvent 调用（复用都不需要，直接不记）
  if (/logEvent\s*\(/.test(buttonSrc94)) fail('#94 侧栏键不得新增日志事件');
  // onMouseDown 保焦：侧栏键与齿轮同行，必须绑 keepComposerFocus
  const sbAt = buttonSrc94.indexOf("'data-dsh-prompt-sidebar-toggle': '1'");
  if (sbAt < 0) fail('#94 侧栏键 data 钩子缺失');
  const sbSlice = buttonSrc94.slice(sbAt, sbAt + 1500);
  if (!/onMouseDown:\s*keepComposerFocus/.test(sbSlice)) fail('#94 侧栏键应绑 keepComposerFocus 保焦');
  // SVG 两态自设计：currentColor + 1.2em 系
  if (!buttonSrc94.includes("stroke: 'currentColor'") || !buttonSrc94.includes("'1.2em'")) fail('#94 侧栏 SVG 应用 currentColor/1.2em 系');
  ok('#94 源码面齐（surface 调用层、无宿主内部刺探、无新日志、保焦）');

  const stateMod = require(path.join(DIR, 'state.cjs'));
  const bySb = (r) => r.findAll((x) => x.props && x.props['data-dsh-prompt-sidebar-toggle'] === '1');
  // 非远程：即使给了 ctl 也不出现（与齿轮同门）
  remote2.__resetRemoteForTests();
  let eb94off;
  TR.act(() => { eb94off = TR.create(React.createElement(buttonMod.EntryButton, { open: false, sidebarCtl: { isExpanded: () => false, toggleExpanded: () => {} } })); });
  if (bySb(eb94off.root).length !== 0) fail('#94 非远程下侧栏键不应出现');
  eb94off.unmount();
  // 远程但宿主面缺席：隐藏（fail-soft，无死键）
  remote2.setRemoteEnabled(true);
  let eb94no;
  TR.act(() => { eb94no = TR.create(React.createElement(buttonMod.EntryButton, { open: false })); });
  if (bySb(eb94no.root).length !== 0) fail('#94 宿主面缺席时侧栏键应隐藏');
  eb94no.unmount();
  // 远程 + 宿主面在场：出现 1 枚；折叠态 aria-pressed=false、title=展开
  let calls = 0; let expanded = false;
  const fake = { isExpanded: () => expanded, toggleExpanded: () => { calls += 1; expanded = !expanded; } };
  let eb94;
  TR.act(() => { eb94 = TR.create(React.createElement(buttonMod.EntryButton, { open: false, sidebarCtl: fake })); });
  const keys = bySb(eb94.root);
  if (keys.length !== 1) fail('#94 远程+宿主面在场时侧栏键应出现 1 枚，实际 ' + keys.length);
  if (keys[0].props['aria-pressed'] !== false) fail('#94 折叠态 aria-pressed 应为 false');
  if (!/展开/.test(String(keys[0].props.title))) fail('#94 折叠态 title 应为展开，实际 ' + keys[0].props.title);
  // 尺寸走 gearBox 同体系：与齿轮同宽；位置齿轮右侧（同行 JSON 先后序）
  const gearW94 = eb94.root.findAll((x) => x.props && x.props['data-dsh-prompt-remote-gear'] === '1')[0].props.style.width;
  if (keys[0].props.style.width !== gearW94) fail('#94 侧栏键应与齿轮同尺寸体系，实际 ' + keys[0].props.style.width + ' vs ' + gearW94);
  const flat94 = JSON.stringify(eb94.toJSON());
  if (!(flat94.indexOf('data-dsh-prompt-remote-gear') < flat94.indexOf('data-dsh-prompt-sidebar-toggle'))) fail('#94 侧栏键应在齿轮右侧');
  // 点击只切侧栏：surface 调用恰 1 次，本插件 state（远程偏好/面板开关）不动
  const prefsBefore = JSON.stringify(remote2.getRemotePrefs());
  const panelBefore = stateMod.isPanelOpen();
  TR.act(() => { keys[0].props.onClick(); });
  if (calls !== 1) fail('#94 点击应调宿主 toggleExpanded 恰 1 次，实际 ' + calls);
  if (JSON.stringify(remote2.getRemotePrefs()) !== prefsBefore) fail('#94 点击不得碰远程偏好');
  if (stateMod.isPanelOpen() !== panelBefore) fail('#94 点击不得碰面板开关');
  // 态感翻转：展开后 aria-pressed=true、title=折叠
  const keys2 = bySb(eb94.root);
  if (keys2[0].props['aria-pressed'] !== true) fail('#94 展开后 aria-pressed 应为 true');
  if (!/折叠/.test(String(keys2[0].props.title))) fail('#94 展开后 title 应为折叠，实际 ' + keys2[0].props.title);
  ok('渲染器：#94 存在性+切换调用（surface 层）+态感+不碰本插件 state');
  eb94.unmount();
  // surface 纯面 fail-soft（空面/残面/抛错面）
  if (buttonMod.readSidebarExpanded(null) !== null) fail('#94 空面应读出 null');
  if (buttonMod.readSidebarExpanded({}) !== null) fail('#94 无 isExpanded 面应读出 null');
  if (buttonMod.toggleSidebar({}) !== false) fail('#94 无 toggle 面应返回 false');
  if (buttonMod.toggleSidebar(null) !== false) fail('#94 空面 toggle 应返回 false');
  if (buttonMod.readSidebarExpanded({ isExpanded: () => { throw new Error('x'); } }) !== null) fail('#94 抛错面应吞为 null');
  ok('#94 surface 函数 fail-soft');
  remote2.__resetRemoteForTests();
  remote2.__setRemoteHostCapsForTests(null);
}

// ── 5) #95 远程 Dock（存在性 + 收展 + 三键齐；只渲染 EntryButton 层，不断宿主） ──
{
  const buttonSrc95 = fs.readFileSync(path.join(ROOT, 'src', 'client', 'button.ts'), 'utf8');
  for (const marker of ['data-dsh-prompt-dock', 'data-dsh-prompt-dock-collapse', 'data-dsh-prompt-dock-pill', 'dockActions', 'DOCK_Z', 'dockCollapse', 'dockExpand', 'PanelPortal']) {
    if (!buttonSrc95.includes(marker)) fail('#95 button.ts 缺标记: ' + marker);
  }
  // 层级低于远程面板 PANEL_Z=9999（panel.ts:551）；收展内存态不得进持久化桥
  if (!(buttonMod.DOCK_Z < 9999)) fail('#95 DOCK_Z 应低于远程面板 9999，实际 ' + buttonMod.DOCK_Z);
  const buttonCode95 = buttonSrc95.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  for (const bad of ['/_dsh/dsh-prompt/store', '/_dsh/dsh-prompt/remote/set', 'persistRemote', 'setRemoteEnabled', 'setRemoteSize', "logEvent('"]) {
    if (buttonCode95.includes(bad)) fail('#95 Dock 不得碰持久化/日志: ' + bad);
  }
  ok('#95 源码面齐（Dock 容器 + 收展 + 注册式 actions + 层级）');

  const byDock = (r) => r.findAll((x) => x.props && x.props['data-dsh-prompt-dock'] === '1');
  const byPill = (r) => r.findAll((x) => x.props && x.props['data-dsh-prompt-dock-pill'] === '1');
  const byCollapse = (r) => r.findAll((x) => x.props && x.props['data-dsh-prompt-dock-collapse'] === '1');
  const fake95 = { isExpanded: () => false, toggleExpanded: () => {} };
  // 非远程：无 Dock 无 pill，入口照常（挂载与行为一字不动）
  remote2.__resetRemoteForTests();
  let eb95off;
  TR.act(() => { eb95off = TR.create(React.createElement(buttonMod.EntryButton, { open: false, sidebarCtl: fake95 })); });
  if (byDock(eb95off.root).length !== 0) fail('#95 非远程不应有 Dock');
  if (byPill(eb95off.root).length !== 0) fail('#95 非远程不应有 pill');
  if (eb95off.root.findAll((x) => x.props && x.props['data-dsh-prompt-entry'] === '1').length !== 1) fail('#95 非远程入口应照常 1 枚');
  eb95off.unmount();
  // 远程：Dock 出现 1 个、三键齐（入口+齿轮+折叠键）、收起键在、无 pill
  remote2.setRemoteEnabled(true);
  let eb95;
  TR.act(() => { eb95 = TR.create(React.createElement(buttonMod.EntryButton, { open: false, sidebarCtl: fake95 })); });
  if (byDock(eb95.root).length !== 1) fail('#95 远程应有 Dock 1 个');
  if (byPill(eb95.root).length !== 0) fail('#95 默认展开时不应有 pill');
  const dockNode = byDock(eb95.root)[0];
  const inDock = (k, v) => dockNode.findAll((x) => x.props && x.props[k] === v).length;
  if (inDock('data-dsh-prompt-entry', '1') !== 1) fail('#95 Dock 内应有入口 1 枚');
  if (inDock('data-dsh-prompt-remote-gear', '1') !== 1) fail('#95 Dock 内应有齿轮 1 枚');
  if (inDock('data-dsh-prompt-sidebar-toggle', '1') !== 1) fail('#95 Dock 内应有折叠键 1 枚');
  if (byCollapse(eb95.root).length !== 1) fail('#95 Dock 内应有收起键 1 枚');
  // Dock 容器：fixed 底、左右下留边
  const ds = dockNode.props.style;
  if (ds.position !== 'fixed' || ds.bottom !== 12 || ds.left !== 12 || ds.right !== 12) fail('#95 Dock 应 fixed 底且左右下留边: ' + JSON.stringify({ position: ds.position, left: ds.left, right: ds.right, bottom: ds.bottom }));
  ok('渲染器：#95 Dock 存在性 + 三键齐 + 容器定位');
  // 收展：点收起 → Dock 没了、底部中间 pill 出现；点 pill → Dock 回来；往返不碰远程偏好（内存态）
  const prefsBefore95 = JSON.stringify(remote2.getRemotePrefs());
  TR.act(() => { byCollapse(eb95.root)[0].props.onClick(); });
  if (byDock(eb95.root).length !== 0) fail('#95 收起后 Dock 应消失');
  if (byPill(eb95.root).length !== 1) fail('#95 收起后底部中间 pill 应出现 1 枚');
  const pillWrap = eb95.root.findAll((x) => x.props && x.props.style && x.props.style.transform === 'translateX(-50%)')[0];
  if (!pillWrap) fail('#95 pill 应用底部居中（translateX(-50%)）');
  const ps = pillWrap.props.style;
  if (ps.position !== 'fixed' || ps.left !== '50%' || ps.bottom !== 12 || ps.zIndex !== buttonMod.DOCK_Z) fail('#95 pill 应 fixed 底中间、同底边距同层级: ' + JSON.stringify({ position: ps.position, left: ps.left, bottom: ps.bottom, zIndex: ps.zIndex }));
  TR.act(() => { byPill(eb95.root)[0].props.onClick(); });
  if (byDock(eb95.root).length !== 1) fail('#95 点 pill 后 Dock 应回来');
  if (byPill(eb95.root).length !== 0) fail('#95 展开后 pill 应消失');
  if (JSON.stringify(remote2.getRemotePrefs()) !== prefsBefore95) fail('#95 收展不得碰远程偏好（内存态）');
  ok('渲染器：#95 收展往返 + 内存态不持久化');
  eb95.unmount();
  remote2.__resetRemoteForTests();
  remote2.__setRemoteHostCapsForTests(null);
}

console.log('=== Test #82 PASS ===');
process.exit(0);
