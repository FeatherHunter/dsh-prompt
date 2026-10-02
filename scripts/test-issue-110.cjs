// 回归测试 #110：远程会话方向快照恢复 + 远程关时去强调色置灰
// 覆盖 Agent Brief 验收：
//  A) 插件偏好：横进竖切退回横（反向亦然）；无变进出不产生多余写入；崩溃重启恢复一次；页内 setter 同语义
//  B) 整机：仅会话内动过且退出不一致才恢复；未动过零 POST；entry 未知不恢复；失败只锁自家
//  C) 样式：远程关时方向/密度选中项无 accent、不可触发、有说明
// 口径：纯函数走转译断言，接线走渲染器（沿用 test-86 harness 形态）。
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }
const DIR = path.join(__dirname, '.rt-tmp-110');
fs.mkdirSync(DIR, { recursive: true });

function fail(msg) { console.log('FAIL: ' + msg); process.exit(1) }
function ok(msg) { console.log(' ok: ' + msg) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ROOT = path.join(__dirname, '..');
const REMOTE_TS = path.join(ROOT, 'src', 'client', 'remote.ts');
const SYS_TS = path.join(ROOT, 'src', 'client', 'systemOrientation.ts');

function transpile(srcPath, outName) {
  const js = ts.transpileModule(fs.readFileSync(srcPath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true },
  }).outputText;
  fs.writeFileSync(path.join(DIR, outName), js);
  return require(path.join(DIR, outName));
}

function stubLocalStorage() {
  const m = {};
  globalThis.localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: (k) => { delete m[k]; },
    _map: m,
  };
}
function unstubLocalStorage() { try { delete globalThis.localStorage; } catch (e) { /* ignore */ } }

(async () => {
// ── A) 插件偏好会话快照（remote.ts 独立转译，零 import 不变） ──
const remote = transpile(REMOTE_TS, 'remote110.cjs');

// A1：横进竖切退回横（issue 原话用例）
remote.__resetRemoteForTests();
stubLocalStorage();
remote.setRemoteOrientation('landscape');
remote.setRemoteEnabled(true);
remote.setRemoteOrientation('portrait');
if (remote.getRemotePrefs().orientation !== 'portrait') fail('会话中切竖屏应落地');
remote.setRemoteEnabled(false);
{
  const p = remote.getRemotePrefs();
  if (p.enabled !== false) fail('退出后总闸应关');
  if (p.orientation !== 'landscape') fail('退出后应恢复进入前横屏，实际 ' + p.orientation);
}
ok('A1 横进竖切退回横');

// A2：反向亦然
remote.__resetRemoteForTests();
globalThis.localStorage._map && Object.keys(globalThis.localStorage._map).forEach((k) => globalThis.localStorage.removeItem(k));
remote.setRemoteOrientation('portrait');
remote.setRemoteEnabled(true);
remote.setRemoteOrientation('landscape');
remote.setRemoteEnabled(false);
if (remote.getRemotePrefs().orientation !== 'portrait') fail('退出后应恢复进入前竖屏，实际 ' + remote.getRemotePrefs().orientation);
ok('A2 竖进横切退回竖');

// A3：无变进出不产生多余 orientation 写入（单次落盘即开关本身）
remote.__resetRemoteForTests();
Object.keys(globalThis.localStorage._map).forEach((k) => globalThis.localStorage.removeItem(k));
const posts = [];
globalThis.fetch = async (url, init) => {
  if (String(url).endsWith('/remote/set')) posts.push(JSON.parse(init.body));
  return { ok: true, status: 200, json: async () => ({ ok: true }) };
};
remote.setRemoteOrientation('landscape');
posts.length = 0;
remote.setRemoteEnabled(true);
remote.setRemoteEnabled(false);
await sleep(30);
{
  const bodies = posts.filter((b) => typeof b.enabled === 'boolean');
  if (bodies.length !== 2) fail('无变进出应恰两次落盘（开与关），实际 ' + bodies.length);
  if (bodies[0].enabled !== true || bodies[1].enabled !== false) fail('落盘应为开后关');
  if (bodies[1].orientation !== 'landscape') fail('关的落盘方向应保持进入值');
}
ok('A3 无变进出无多余写入');

// A4：非过渡调用不建快照（重复开不覆盖进入值）
remote.__resetRemoteForTests();
Object.keys(globalThis.localStorage._map).forEach((k) => globalThis.localStorage.removeItem(k));
posts.length = 0;
remote.setRemoteOrientation('landscape');
remote.setRemoteEnabled(true);
remote.setRemoteEnabled(true); // 重复开：不应重建快照
remote.setRemoteOrientation('portrait');
remote.setRemoteEnabled(false);
if (remote.getRemotePrefs().orientation !== 'landscape') fail('重复开不应丢进入快照，实际 ' + remote.getRemotePrefs().orientation);
ok('A4 重复开不覆盖快照');

// A5：页内 setter 同语义（跨插件关同样恢复）
remote.__resetRemoteForTests();
Object.keys(globalThis.localStorage._map).forEach((k) => globalThis.localStorage.removeItem(k));
remote.setRemoteOrientation('landscape');
remote.setRemoteFromExternal(true);
remote.setRemoteOrientation('portrait');
remote.setRemoteFromExternal({ enabled: false });
if (remote.getRemotePrefs().orientation !== 'landscape') fail('页内关应同样恢复横屏');
ok('A5 页内 setter 同语义');

// A6：崩溃重启恢复一次（内存丢、localStorage 留、host 仍开着 P1）
remote.__resetRemoteForTests();
Object.keys(globalThis.localStorage._map).forEach((k) => globalThis.localStorage.removeItem(k));
remote.setRemoteOrientation('landscape');
remote.setRemoteEnabled(true);
remote.setRemoteOrientation('portrait');
// 模拟崩溃：只清内存，快照留盘
remote.__resetRemoteForTests();
globalThis.fetch = async (url) => {
  if (String(url).endsWith('/store')) return { ok: true, status: 200, json: async () => ({ ok: true, value: { remote: { enabled: true, size: 5, orientation: 'portrait', density: 'a' } } }) };
  return { ok: true, status: 200, json: async () => ({ ok: true }) };
};
await remote.ensureRemoteLoaded();
await sleep(20);
if (remote.getRemotePrefs().orientation !== 'landscape') fail('崩溃重启后应恢复进入前横屏，实际 ' + remote.getRemotePrefs().orientation);
if (globalThis.localStorage.getItem('__dshPromptPreRemote') !== null) fail('恢复后快照应清理（仅一次）');
ok('A6 崩溃重启恢复一次');
delete globalThis.fetch;
remote.__resetRemoteForTests();
unstubLocalStorage();

// ── B) 整机恢复判定纯函数（systemOrientation.ts 独立转译） ──
const sys = transpile(SYS_TS, 'sys110.cjs');
if (typeof sys.shouldRestoreSystemOrientation !== 'function') fail('systemOrientation.ts 缺 shouldRestoreSystemOrientation 导出');
{
  const t = sys.shouldRestoreSystemOrientation;
  if (t('landscape', false, 'portrait') !== false) fail('未动过不应恢复');
  if (t(null, true, 'portrait') !== false) fail('entry 未知不应恢复');
  if (t('unknown', true, 'portrait') !== false) fail('entry 非法不应恢复');
  if (t('landscape', true, 'landscape') !== false) fail('已一致不应恢复');
  if (t('landscape', true, 'bogus') !== false) fail('现值非法不应恢复');
  const r = t('landscape', true, 'portrait');
  if (r !== true) fail('动过且不一致应恢复，实际 ' + r);
  if (t('portrait', true, 'landscape') !== true) fail('反向亦应恢复');
}
ok('B 整机恢复判定（未动/未知/一致不恢，不一致必恢）');

// ── C) 设置页接线 + 去强调色（渲染器） ──
const MODULES = [
  ['templates.ts', path.join(ROOT, 'src', 'client', 'templates.ts'), []],
  ['store.ts', path.join(ROOT, 'src', 'client', 'store.ts'), ['./templates']],
  ['state.ts', path.join(ROOT, 'src', 'client', 'state.ts'), []],
  ['i18n.ts', path.join(ROOT, 'src', 'client', 'i18n.ts'), []],
  ['smartstore.ts', path.join(ROOT, 'src', 'client', 'smartstore.ts'), []],
  ['remote2.cjs', path.join(ROOT, 'src', 'client', 'remote.ts'), []],
  ['remoteView.cjs', path.join(ROOT, 'src', 'client', 'remoteView.ts'), []],
  ['systemOrientation.cjs', SYS_TS, []],
  ['panel.cjs', path.join(ROOT, 'src', 'client', 'panel.ts'), ['./templates', './store', './state', './i18n', './smartstore', './remote', './remoteView']],
  ['settings.cjs', path.join(ROOT, 'src', 'client', 'settings.ts'), ['./panel', './about', './update', './smartstore', './remote', './remoteView', './systemOrientation', './i18n']],
  ['button.cjs', path.join(ROOT, 'src', 'client', 'button.ts'), ['./panel', './state', './settings', './remote', './i18n']],
];
fs.writeFileSync(path.join(DIR, 'about.cjs'), 'module.exports.SettingsHeaderLinks=()=>null;module.exports.AuthorPlugins=()=>null;');
fs.writeFileSync(path.join(DIR, 'update.cjs'), 'module.exports.UpdateEntry=()=>null;');
for (const [outName, srcPath, deps] of MODULES) {
  let js = ts.transpileModule(fs.readFileSync(srcPath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true } }).outputText;
  for (const d of deps) js = js.split('require("' + d + '")').join('require("' + d + '.cjs")');
  js = js.split('require("./remote.cjs")').join('require("./remote2.cjs")');
  const outFile = outName.endsWith('.cjs') ? outName : outName.replace(/\.ts$/, '.cjs');
  fs.writeFileSync(path.join(DIR, outFile), js);
}
const React = require('react');
const TR = require('react-test-renderer');
const settingsMod = require(path.join(DIR, 'settings.cjs'));
const remote2 = require(path.join(DIR, 'remote2.cjs'));
const ACCENT = '#f0a45c';

// C1：远程关时方向/密度选中项无 accent、不可触发、有说明
remote2.__resetRemoteForTests();
stubLocalStorage();
{
  let storeSnap = { enabled: false, size: 5, orientation: 'landscape', density: 'b' };
  globalThis.fetch = async (url) => ({ ok: true, status: 200, json: async () => ({ ok: true, value: { remote: storeSnap } }) });
  let created;
  await TR.act(async () => { created = TR.create(React.createElement(settingsMod.SettingsPage, {})); });
  await sleep(20);
  const oBtns = created.root.findAll((x) => x.props && x.props['data-dsh-prompt-orientation']);
  if (oBtns.length !== 3) fail('方向三档应 3 按钮');
  for (const b of oBtns) {
    if (b.props.disabled !== true) fail('远程关时方向按钮应 disabled');
    const st = b.props.style || {};
    if (String(st.background || '').indexOf(ACCENT) >= 0) fail('禁用态不许残留 accent 背景');
    if (st.opacity !== 1) fail('禁用态不许用半透明冒充，opacity 应为 1');
    if (!b.props.title) fail('禁用按钮应有说明 title');
  }
  const land = oBtns.find((b) => b.props['data-dsh-prompt-orientation'] === 'landscape');
  if (String((land.props.style || {}).background || '').indexOf(ACCENT) >= 0) fail('选中项禁用后 accent 必须清零');
  const dBtns = created.root.findAll((x) => x.props && x.props['data-dsh-prompt-density']);
  if (dBtns.length !== 2) fail('密度应 2 按钮');
  for (const b of dBtns) {
    if (b.props.disabled !== true) fail('远程关时密度按钮应 disabled');
    if (String((b.props.style || {}).background || '').indexOf(ACCENT) >= 0) fail('密度禁用态不许残留 accent');
  }
  created.unmount();
}
ok('C1 远程关时去强调色置灰（无accent/不可点/有说明）');

// C2：开→切竖屏→关：插件恢复 + 整机恢复各一次，成功静默
remote2.__resetRemoteForTests();
Object.keys(globalThis.localStorage._map).forEach((k) => globalThis.localStorage.removeItem(k));
{
  let fakeOs = 'landscape';
  let sysPosts = [];
  let sysGets = 0;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (/\/store$/.test(u)) return { ok: true, status: 200, json: async () => ({ ok: true, value: { remote: { enabled: false, size: 5, orientation: 'landscape', density: 'a' } } }) };
    if (/system\/orientation$/.test(u) && (!init || init.method === undefined || init.method === 'GET')) { sysGets += 1; return { ok: true, status: 200, json: async () => ({ ok: true, orientation: fakeOs }) }; }
    if (/system\/orientation$/.test(u)) {
      const body = JSON.parse(init.body);
      sysPosts.push(body.orientation);
      fakeOs = body.orientation;
      return { ok: true, status: 200, json: async () => ({ ok: true, orientation: fakeOs, changed: true }) };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  let created;
  await TR.act(async () => { created = TR.create(React.createElement(settingsMod.SettingsPage, {})); });
  await sleep(20);
  const toggle = created.root.find((x) => x.props && x.props['data-dsh-prompt-remote-toggle']);
  await TR.act(async () => { toggle.props.onChange({ target: { checked: true } }); await sleep(30); });
  if (sysGets < 1) fail('开远程应查询整机 entry');
  const portrait = created.root.findAll((x) => x.props && x.props['data-dsh-prompt-orientation'] === 'portrait')[0];
  await TR.act(async () => { portrait.props.onClick(); await sleep(30); });
  if (remote2.getRemotePrefs().orientation !== 'portrait') fail('会话中切竖屏应落地');
  if (sysPosts.length !== 1 || sysPosts[0] !== 'portrait') fail('锁定应调 OS 一次竖屏，实际 ' + JSON.stringify(sysPosts));
  const toggle2 = created.root.find((x) => x.props && x.props['data-dsh-prompt-remote-toggle']);
  await TR.act(async () => { toggle2.props.onChange({ target: { checked: false } }); await sleep(50); });
  if (remote2.getRemotePrefs().orientation !== 'landscape') fail('退出后插件应恢复横屏，实际 ' + remote2.getRemotePrefs().orientation);
  if (fakeOs !== 'landscape') fail('退出后整机应恢复横屏，实际 ' + fakeOs);
  if (sysPosts.length !== 2 || sysPosts[1] !== 'landscape') fail('退出恢复应调 OS 一次横屏，实际 ' + JSON.stringify(sysPosts));
  const notes = created.root.findAll((x) => x.props && x.props['data-dsh-prompt-orientation-note'] === '1');
  if (notes.length !== 0) fail('成功恢复应静默无 note');
  created.unmount();
}
ok('C2 开切关全链路（插件+整机各恢复一次，成功静默）');

// C3：未动过整机 → 退出零 OS POST
remote2.__resetRemoteForTests();
Object.keys(globalThis.localStorage._map).forEach((k) => globalThis.localStorage.removeItem(k));
{
  let sysPosts = 0;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (/\/store$/.test(u)) return { ok: true, status: 200, json: async () => ({ ok: true, value: { remote: { enabled: false, size: 5, orientation: 'auto', density: 'a' } } }) };
    if (/system\/orientation$/.test(u) && init && init.method === 'POST') { sysPosts += 1; return { ok: true, status: 200, json: async () => ({ ok: true, orientation: 'portrait', changed: true }) }; }
    if (/system\/orientation$/.test(u)) return { ok: true, status: 200, json: async () => ({ ok: true, orientation: 'landscape' }) };
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  let created;
  await TR.act(async () => { created = TR.create(React.createElement(settingsMod.SettingsPage, {})); });
  await sleep(20);
  const toggle = created.root.find((x) => x.props && x.props['data-dsh-prompt-remote-toggle']);
  await TR.act(async () => { toggle.props.onChange({ target: { checked: true } }); await sleep(30); });
  const toggle2 = created.root.find((x) => x.props && x.props['data-dsh-prompt-remote-toggle']);
  await TR.act(async () => { toggle2.props.onChange({ target: { checked: false } }); await sleep(50); });
  if (sysPosts !== 0) fail('未动过整机退出时应零 OS POST，实际 ' + sysPosts);
  created.unmount();
}
ok('C3 未动整机退出零 POST');

// C4：entry 未知（GET 失败）→ 不恢复整机但插件照回
remote2.__resetRemoteForTests();
Object.keys(globalThis.localStorage._map).forEach((k) => globalThis.localStorage.removeItem(k));
{
  let sysPosts = 0;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (/\/store$/.test(u)) return { ok: true, status: 200, json: async () => ({ ok: true, value: { remote: { enabled: false, size: 5, orientation: 'landscape', density: 'a' } } }) };
    if (/system\/orientation$/.test(u) && (!init || init.method === undefined || init.method === 'GET')) return { ok: true, status: 200, json: async () => ({ ok: false, error: { code: 'denied', message: 'd' } }) };
    if (/system\/orientation$/.test(u)) { sysPosts += 1; return { ok: true, status: 200, json: async () => ({ ok: true, orientation: 'portrait', changed: true }) }; }
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  let created;
  await TR.act(async () => { created = TR.create(React.createElement(settingsMod.SettingsPage, {})); });
  await sleep(20);
  const toggle = created.root.find((x) => x.props && x.props['data-dsh-prompt-remote-toggle']);
  await TR.act(async () => { toggle.props.onChange({ target: { checked: true } }); await sleep(30); });
  const portrait = created.root.findAll((x) => x.props && x.props['data-dsh-prompt-orientation'] === 'portrait')[0];
  await TR.act(async () => { portrait.props.onClick(); await sleep(30); });
  const toggle2 = created.root.find((x) => x.props && x.props['data-dsh-prompt-remote-toggle']);
  await TR.act(async () => { toggle2.props.onChange({ target: { checked: false } }); await sleep(50); });
  if (remote2.getRemotePrefs().orientation !== 'landscape') fail('entry 未知时插件仍应恢复横屏');
  if (sysPosts !== 1) fail('entry 未知时退出不应再 POST 整机（仅锁定那一次），实际 ' + sysPosts);
  created.unmount();
}
ok('C4 entry未知不恢复整机、插件照回');

// ── D) 检测统一：resolver + env缓存 + 双态caption + 发布链路 ──
const remoteView110 = transpile(path.join(ROOT, 'src', 'client', 'remoteView.ts'), 'remoteView110.cjs');

// D0：有效值裁决矩阵（显式赢；auto取env；缺席回落视口；垃圾回横屏）
{
  const t = remoteView110.resolveEffectiveOrientation;
  if (typeof t !== 'function') fail('remoteView.ts 缺 resolveEffectiveOrientation 导出');
  const cases = [
    [['landscape', 'portrait', 'portrait'], 'landscape'],
    [['portrait', 'landscape', 'landscape'], 'portrait'],
    [['auto', 'portrait', 'landscape'], 'portrait'],
    [['auto', 'landscape', 'portrait'], 'landscape'],
    [['auto', null, 'portrait'], 'portrait'],
    [['auto', undefined, 'landscape'], 'landscape'],
    [['auto', 'bogus', 'bogus'], 'landscape'],
    [['bogus', null, null], 'landscape'],
    [['auto', 'portrait', 'bogus'], 'portrait'],
  ];
  for (const [args, want] of cases) {
    if (t(args[0], args[1], args[2]) !== want) fail('裁决错误 ' + JSON.stringify(args) + ' 应 ' + want);
  }
}
ok('D0 有效值裁决（显式赢/auto取env/缺席回落视口）');

// D1：env缓存读写与缺席标记（复用 Part A 的 remote 实例）
{
  remote.__resetRemoteForTests();
  if (remote.getEnvOrientation() !== null) fail('初始 env 应 null');
  if (remote.isEnvUnsupported() !== false) fail('初始不应缺席');
  remote.setEnvOrientation({ orientation: 'portrait' });
  const e = remote.getEnvOrientation();
  if (!e || e.orientation !== 'portrait' || e.source !== 'system' || typeof e.updatedAt !== 'number') fail('env 应存住整机值 ' + JSON.stringify(e));
  remote.setEnvOrientation({ orientation: 'bogus' });
  if (remote.getEnvOrientation().orientation !== 'portrait') fail('非法写入应忽略');
  remote.markEnvUnsupported();
  if (remote.getEnvOrientation() !== null || remote.isEnvUnsupported() !== true) fail('缺席应清空并标记');
  remote.setEnvOrientation({ orientation: 'landscape' });
  if (remote.isEnvUnsupported() !== false || remote.getEnvOrientation().orientation !== 'landscape') fail('成功写入应解除缺席');
  remote.__resetRemoteForTests();
  if (remote.getEnvOrientation() !== null || remote.isEnvUnsupported() !== false) fail('reset 应清 env 与标记');
}
ok('D1 env缓存读写与缺席标记');

// D2：双态caption（有env示整机，无env示视口；node无window回横屏）
{
  const capText = (root) => {
    const n = root.findAll((x) => x.props && x.props['data-dsh-prompt-orientation-effective'] === '1')[0];
    if (!n) fail('缺有效值 caption 行');
    return String((n.children || []).join(''));
  };
  remote2.__resetRemoteForTests();
  remote2.setEnvOrientation({ orientation: 'landscape' });
  globalThis.fetch = async (url) => ({ ok: true, status: 200, json: async () => ({ ok: true, value: { remote: { enabled: false, size: 5, orientation: 'auto', density: 'a' } } }) });
  let c1;
  await TR.act(async () => { c1 = TR.create(React.createElement(settingsMod.SettingsPage, {})); });
  await sleep(20);
  const t1 = capText(c1.root);
  // 挂载预热 GET 回 store 形状 → 整机未知 → 但预置了 env landscape
  if (t1.indexOf('横屏') < 0) fail('caption 应示横屏，实际 ' + t1);
  c1.unmount();
  // 无 env：回落视口（node 无 window → 横屏兜底），来源视口
  remote2.__resetRemoteForTests();
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (/\/store$/.test(u)) return { ok: true, status: 200, json: async () => ({ ok: true, value: { remote: { enabled: false, size: 5, orientation: 'auto', density: 'a' } } }) };
    return { ok: true, status: 200, json: async () => ({ ok: false, error: { code: 'unsupported', message: 'no bridge' } }) };
  };
  let c2;
  await TR.act(async () => { c2 = TR.create(React.createElement(settingsMod.SettingsPage, {})); });
  await sleep(20);
  const t2 = capText(c2.root);
  if (t2.indexOf('横屏') < 0 || t2.indexOf('视口') < 0) fail('无env应回落视口示横屏，实际 ' + t2);
  c2.unmount();
}
ok('D2 双态caption（整机/视口来源可见）');

// D2c：显式锁定 caption 不带来源（偏好的选择不算到整机头上）
{
  remote2.__resetRemoteForTests();
  remote2.setEnvOrientation({ orientation: 'landscape' });
  globalThis.fetch = async (url) => ({ ok: true, status: 200, json: async () => ({ ok: true, value: { remote: { enabled: false, size: 5, orientation: 'portrait', density: 'a' } } }) });
  let c;
  await TR.act(async () => { c = TR.create(React.createElement(settingsMod.SettingsPage, {})); });
  await sleep(20);
  const n = c.root.findAll((x) => x.props && x.props['data-dsh-prompt-orientation-effective'] === '1')[0];
  const t = String((n.children || []).join(''));
  if (t.indexOf('锁定') < 0 || t.indexOf('竖屏') < 0) fail('显式锁定应示锁定为竖屏，实际 ' + t);
  if (t.indexOf('整机') >= 0 || t.indexOf('视口') >= 0) fail('显式锁定不得带来源角标，实际 ' + t);
  c.unmount();
  remote2.__resetRemoteForTests();
}
ok('D2c 显式锁定caption无来源误标');

// D3：挂载恰预热一次；缺席后不再问
{
  remote2.__resetRemoteForTests();
  let gets = 0;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (/\/store$/.test(u)) return { ok: true, status: 200, json: async () => ({ ok: true, value: { remote: { enabled: false, size: 5, orientation: 'auto', density: 'a' } } }) };
    if (/system\/orientation$/.test(u) && (!init || !init.method || init.method === 'GET')) {
      gets += 1;
      return { ok: true, status: 200, json: async () => ({ ok: false, error: { code: 'unsupported', message: 'x' } }) };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  let c1;
  await TR.act(async () => { c1 = TR.create(React.createElement(settingsMod.SettingsPage, {})); });
  await sleep(20);
  if (gets !== 1) fail('挂载应预热恰一次，实际 ' + gets);
  if (remote2.isEnvUnsupported() !== true) fail('unsupported 应记负缓存');
  c1.unmount();
  let c2;
  await TR.act(async () => { c2 = TR.create(React.createElement(settingsMod.SettingsPage, {})); });
  await sleep(20);
  if (gets !== 1) fail('缺席后挂载不应再问，实际 ' + gets);
  c2.unmount();
}
ok('D3 挂载预热一次+负缓存');

// D4：锁定成功发布env且零新增GET；退出恢复成功同步env
{
  remote2.__resetRemoteForTests();
  let fakeOs = 'landscape';
  let gets = 0;
  const posts = [];
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (/\/store$/.test(u)) return { ok: true, status: 200, json: async () => ({ ok: true, value: { remote: { enabled: false, size: 5, orientation: 'auto', density: 'a' } } }) };
    if (/system\/orientation$/.test(u) && init && init.method === 'POST') {
      posts.push(JSON.parse(init.body).orientation);
      fakeOs = JSON.parse(init.body).orientation;
      return { ok: true, status: 200, json: async () => ({ ok: true, orientation: fakeOs, changed: true }) };
    }
    if (/system\/orientation$/.test(u)) { gets += 1; return { ok: true, status: 200, json: async () => ({ ok: true, orientation: fakeOs }) }; }
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  let created;
  await TR.act(async () => { created = TR.create(React.createElement(settingsMod.SettingsPage, {})); });
  await sleep(20);
  const getsAfterMount = gets;
  const toggle = created.root.find((x) => x.props && x.props['data-dsh-prompt-remote-toggle']);
  await TR.act(async () => { toggle.props.onChange({ target: { checked: true } }); await sleep(30); });
  const getsAfterEnter = gets;
  const portrait = created.root.findAll((x) => x.props && x.props['data-dsh-prompt-orientation'] === 'portrait')[0];
  await TR.act(async () => { portrait.props.onClick(); await sleep(30); });
  if (remote2.getEnvOrientation().orientation !== 'portrait') fail('锁定成功应发布env竖屏');
  if (gets !== getsAfterEnter) fail('锁定不应新增GET（复用已知），实际多 ' + (gets - getsAfterEnter));
  const toggle2 = created.root.find((x) => x.props && x.props['data-dsh-prompt-remote-toggle']);
  await TR.act(async () => { toggle2.props.onChange({ target: { checked: false } }); await sleep(50); });
  if (remote2.getEnvOrientation().orientation !== 'landscape') fail('退出恢复成功应同步env横屏');
  if (JSON.stringify(posts) !== JSON.stringify(['portrait', 'landscape'])) fail('POST 应为锁定+恢复各一次，实际 ' + JSON.stringify(posts));
  created.unmount();
}
ok('D4 发布链路零新增调用（锁定/恢复复用已知）');

// D5：面板层永不直调整机桥（源码级）
{
  const panelSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'panel.ts'), 'utf8');
  if (/system\/orientation/.test(panelSrc)) fail('面板不得直调整机桥 URL');
  if (/getSystemOrientation|setSystemOrientation/.test(panelSrc)) fail('面板不得直调整机桥函数（只读 remote env 缓存）');
  if (!/getEnvOrientation/.test(panelSrc) || !/resolveEffectiveOrientation/.test(panelSrc)) fail('面板应经 env 缓存 + 有效值裁决');
}
ok('D5 面板只读缓存不碰桥');

delete globalThis.fetch;
remote2.__resetRemoteForTests();
unstubLocalStorage();

console.log('=== Test #110 PASS ===');
process.exit(0);
})().catch((e) => { console.log('FAIL: ' + (e && e.stack || e)); process.exit(1); });
