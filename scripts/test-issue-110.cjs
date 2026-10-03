// 回归测试 #110：远程关闭时去强调色置灰 + 方向进出不还原
// 改判（2026-10-03，用户拍板）：退出远程**不还原**方向——用户最后锁定的方向优先级最高。
// 覆盖：
//  A) 插件偏好：进出只翻总闸，方向原样保持；崩溃重启不回退；旧版遗留快照键被清
//  B) 整机：退出零调用（不闪屏、不夺回控制权）；锁定那次仍是唯一 OS 写
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
// ── A) 插件偏好：进出不还原（#110 改判） ──
const remote = transpile(REMOTE_TS, 'remote110.cjs');

// A1：横进竖切，退出后仍是竖屏（issue 原话用例的反转）
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
  if (p.orientation !== 'portrait') fail('退出后应保持会话内最后选择竖屏，实际 ' + p.orientation);
}
ok('A1 横进竖切退出保持竖屏（不还原）');

// A2：反向亦然
remote.__resetRemoteForTests();
globalThis.localStorage._map && Object.keys(globalThis.localStorage._map).forEach((k) => globalThis.localStorage.removeItem(k));
remote.setRemoteOrientation('portrait');
remote.setRemoteEnabled(true);
remote.setRemoteOrientation('landscape');
remote.setRemoteEnabled(false);
if (remote.getRemotePrefs().orientation !== 'landscape') fail('退出后应保持会话内最后选择横屏，实际 ' + remote.getRemotePrefs().orientation);
ok('A2 竖进横切退出保持横屏（不还原）');

// A3：进出只落盘总闸，方向原样带过，且不再产生任何快照键
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
  if (bodies[1].orientation !== 'landscape') fail('关的落盘方向应原样保持，实际 ' + bodies[1].orientation);
  if (globalThis.localStorage.getItem('__dshPromptPreRemote') !== null) fail('改判后不得再写进入快照键');
}
ok('A3 进出只翻总闸、方向原样、零快照');

// A4：重复开不产生任何方向副作用
remote.__resetRemoteForTests();
Object.keys(globalThis.localStorage._map).forEach((k) => globalThis.localStorage.removeItem(k));
posts.length = 0;
remote.setRemoteOrientation('landscape');
remote.setRemoteEnabled(true);
remote.setRemoteEnabled(true); // 重复开：幂等，不碰方向
remote.setRemoteOrientation('portrait');
remote.setRemoteEnabled(false);
if (remote.getRemotePrefs().orientation !== 'portrait') fail('重复开后仍应保持最后选择竖屏，实际 ' + remote.getRemotePrefs().orientation);
ok('A4 重复开不碰方向');

// A5：页内 setter 同语义（跨插件关同样不还原）
remote.__resetRemoteForTests();
Object.keys(globalThis.localStorage._map).forEach((k) => globalThis.localStorage.removeItem(k));
remote.setRemoteOrientation('landscape');
remote.setRemoteFromExternal(true);
remote.setRemoteOrientation('portrait');
remote.setRemoteFromExternal({ enabled: false });
if (remote.getRemotePrefs().orientation !== 'portrait') fail('页内关应同样保持竖屏，实际 ' + remote.getRemotePrefs().orientation);
ok('A5 页内 setter 同语义');

// A6：崩溃重启不回退（host 快照是最后选择），且旧版遗留的进入快照键被一次性清掉
remote.__resetRemoteForTests();
Object.keys(globalThis.localStorage._map).forEach((k) => globalThis.localStorage.removeItem(k));
// 模拟旧版遗留：盘上躺着「进入前横屏」的快照，host 那边存的是用户最后选的竖屏
globalThis.localStorage.setItem('__dshPromptPreRemote', JSON.stringify({ orientation: 'landscape' }));
globalThis.fetch = async (url) => {
  if (String(url).endsWith('/store')) return { ok: true, status: 200, json: async () => ({ ok: true, value: { remote: { enabled: true, size: 5, orientation: 'portrait', density: 'a' } } }) };
  return { ok: true, status: 200, json: async () => ({ ok: true }) };
};
await remote.ensureRemoteLoaded();
await sleep(20);
if (remote.getRemotePrefs().orientation !== 'portrait') fail('崩溃重启后应保持最后选择竖屏，实际 ' + remote.getRemotePrefs().orientation);
if (globalThis.localStorage.getItem('__dshPromptPreRemote') !== null) fail('遗留进入快照键应被清理，否则日后会把选择翻回去');
ok('A6 崩溃重启保持最后选择 + 清遗留快照键');
delete globalThis.fetch;
remote.__resetRemoteForTests();
unstubLocalStorage();

// ── B) 整机恢复判定已退役 ──
const sys = transpile(SYS_TS, 'sys110.cjs');
if (typeof sys.shouldRestoreSystemOrientation === 'function') fail('shouldRestoreSystemOrientation 应已删除（退出不再还原）');
for (const fn of ['isSystemOrientation', 'normalizeOrientCode', 'getSystemOrientation', 'setSystemOrientation']) {
  if (typeof sys[fn] !== 'function') fail('systemOrientation.ts 缺 ' + fn + ' 导出');
}
ok('B 恢复判定已删除，真切/查询契约仍在');

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
  ['workspace.cjs', path.join(ROOT, 'src', 'client', 'workspace.ts'), []],
  ['picker.cjs', path.join(ROOT, 'src', 'client', 'picker.ts'), ['./panel', './remoteView', './i18n', './workspace']],
  ['panel.cjs', path.join(ROOT, 'src', 'client', 'panel.ts'), ['./templates', './store', './state', './i18n', './smartstore', './remote', './remoteView']],
  ['settings.cjs', path.join(ROOT, 'src', 'client', 'settings.ts'), ['./panel', './about', './update', './smartstore', './remote', './remoteView', './systemOrientation', './i18n']],
  ['button.cjs', path.join(ROOT, 'src', 'client', 'button.ts'), ['./panel', './state', './settings', './remote', './i18n', './workspace', './picker', './smartstore', './remoteView']],
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

// C2：开→切竖屏→关：插件与整机都保持竖屏，OS 只被写过一次（锁定那次）
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
  const getsAfterMount = sysGets;
  const toggle = created.root.find((x) => x.props && x.props['data-dsh-prompt-remote-toggle']);
  await TR.act(async () => { toggle.props.onChange({ target: { checked: true } }); await sleep(30); });
  if (sysGets !== getsAfterMount + 1) fail('开启远程应刷新一次整机方向，实际 GET ' + sysGets);
  const getsAfterEnter = sysGets;
  const portrait = created.root.findAll((x) => x.props && x.props['data-dsh-prompt-orientation'] === 'portrait')[0];
  await TR.act(async () => { portrait.props.onClick(); await sleep(30); });
  if (remote2.getRemotePrefs().orientation !== 'portrait') fail('会话中切竖屏应落地');
  if (sysPosts.length !== 1 || sysPosts[0] !== 'portrait') fail('锁定应调 OS 一次竖屏，实际 ' + JSON.stringify(sysPosts));
  const toggle2 = created.root.find((x) => x.props && x.props['data-dsh-prompt-remote-toggle']);
  await TR.act(async () => { toggle2.props.onChange({ target: { checked: false } }); await sleep(50); });
  if (remote2.getRemotePrefs().orientation !== 'portrait') fail('退出后插件应保持竖屏，实际 ' + remote2.getRemotePrefs().orientation);
  if (fakeOs !== 'portrait') fail('退出后整机应保持竖屏（不转回），实际 ' + fakeOs);
  if (sysPosts.length !== 1) fail('退出不得再调 OS，实际 POST ' + sysPosts.length + ' 次：' + JSON.stringify(sysPosts));
  if (sysGets !== getsAfterEnter) fail('退出不应查询整机（不还原、不预热），实际多 ' + (sysGets - getsAfterEnter));
  const notes = created.root.findAll((x) => x.props && x.props['data-dsh-prompt-orientation-note'] === '1');
  if (notes.length !== 0) fail('退出不还原，成功应静默无 note');
  created.unmount();
}
ok('C2 开切关全链路（插件+整机都保持竖屏，OS 只写一次）');

// C3：进出总闸对整机零写入（进入只读一次、退出零调用）
remote2.__resetRemoteForTests();
Object.keys(globalThis.localStorage._map).forEach((k) => globalThis.localStorage.removeItem(k));
{
  let sysPosts = 0;
  let sysGets = 0;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (/\/store$/.test(u)) return { ok: true, status: 200, json: async () => ({ ok: true, value: { remote: { enabled: false, size: 5, orientation: 'auto', density: 'a' } } }) };
    if (/system\/orientation$/.test(u) && init && init.method === 'POST') { sysPosts += 1; return { ok: true, status: 200, json: async () => ({ ok: true, orientation: 'portrait', changed: true }) }; }
    if (/system\/orientation$/.test(u)) { sysGets += 1; return { ok: true, status: 200, json: async () => ({ ok: true, orientation: 'landscape' }) }; }
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  let created;
  await TR.act(async () => { created = TR.create(React.createElement(settingsMod.SettingsPage, {})); });
  await sleep(20);
  const getsAfterMount = sysGets;
  const toggle = created.root.find((x) => x.props && x.props['data-dsh-prompt-remote-toggle']);
  await TR.act(async () => { toggle.props.onChange({ target: { checked: true } }); await sleep(30); });
  const getsAfterEnter = sysGets;
  const toggle2 = created.root.find((x) => x.props && x.props['data-dsh-prompt-remote-toggle']);
  await TR.act(async () => { toggle2.props.onChange({ target: { checked: false } }); await sleep(50); });
  if (sysPosts !== 0) fail('进出总闸不应写整机，实际 ' + sysPosts);
  if (getsAfterEnter !== getsAfterMount + 1) fail('进入应恰读一次整机方向，实际多 ' + (getsAfterEnter - getsAfterMount));
  if (sysGets !== getsAfterEnter) fail('退出不应查询整机，实际多 ' + (sysGets - getsAfterEnter));
  created.unmount();
}
ok('C3 进出总闸：进入只读一次、退出零读写');

// C4：整机查询失败（bridge denied）不影响锁定与退出后的保持
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
  if (remote2.getRemotePrefs().orientation !== 'portrait') fail('查询失败时锁定仍应落地并保持，实际 ' + remote2.getRemotePrefs().orientation);
  if (sysPosts !== 1) fail('查询失败时退出不应再 POST 整机（仅锁定那一次），实际 ' + sysPosts);
  created.unmount();
}
ok('C4 查询失败不影响锁定与保持');

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

// D4：锁定成功发布 env 且零新增 GET；退出对整机零调用、env 保持锁定值
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
  if (remote2.getEnvOrientation().orientation !== 'portrait') fail('退出后 env 应仍是锁定值竖屏，实际 ' + JSON.stringify(remote2.getEnvOrientation()));
  if (JSON.stringify(posts) !== JSON.stringify(['portrait'])) fail('POST 应只有锁定那一次，实际 ' + JSON.stringify(posts));
  if (gets !== getsAfterEnter) fail('退出不应查询整机（锁定与退出都复用已知），实际多 ' + (gets - getsAfterEnter));
  created.unmount();
}
ok('D4 锁定复用已知、退出对整机零调用');

// D7：陈旧 env 修复——进入远程必须把整机方向读回来（用户症状的最小复现）
{
  // D7a 纯函数契约：warmEnvOrientation 覆盖旧值、单飞去重、缺席记负缓存、失败不动原值
  remote.__resetRemoteForTests();
  if (typeof remote.warmEnvOrientation !== 'function') fail('remote.ts 缺 warmEnvOrientation 导出');
  remote.setEnvOrientation({ orientation: 'portrait' });          // 上一轮遗留下来的旧值
  let calls = 0;
  await remote.warmEnvOrientation(async () => { calls += 1; return { ok: true, orientation: 'landscape' } });
  if (calls !== 1) fail('预热应恰打一次桥，实际 ' + calls);
  if (remote.getEnvOrientation().orientation !== 'landscape') fail('预热应以整机真值覆盖旧缓存，实际 ' + JSON.stringify(remote.getEnvOrientation()));
  // 单飞：同刻并发只发一次
  calls = 0;
  const slow = async () => { calls += 1; await sleep(20); return { ok: true, orientation: 'portrait' } };
  await Promise.all([remote.warmEnvOrientation(slow), remote.warmEnvOrientation(slow), remote.warmEnvOrientation(slow)]);
  if (calls !== 1) fail('同刻并发预热应去重，实际 ' + calls);
  // 失败保持原值，不写脏
  remote.setEnvOrientation({ orientation: 'landscape' });
  await remote.warmEnvOrientation(async () => ({ ok: false, error: { code: 'denied', message: 'd' } }));
  if (remote.getEnvOrientation().orientation !== 'landscape') fail('查询失败应保持原值，不写脏');
  // unsupported 记负缓存且本会话不再问
  calls = 0;
  await remote.warmEnvOrientation(async () => { calls += 1; return { ok: false, error: { code: 'unsupported', message: 'x' } } });
  if (calls !== 1 || remote.isEnvUnsupported() !== true) fail('unsupported 应记负缓存');
  await remote.warmEnvOrientation(async () => { calls += 1; return { ok: true, orientation: 'portrait' } });
  if (calls !== 1) fail('负缓存后本会话不应再问，实际 ' + calls);
  if (typeof remote.warmEnvOrientation('not a function') === 'undefined') fail('非函数 query 应安全返回');
  remote.__resetRemoteForTests();
}
ok('D7a 预热契约（覆盖旧值/单飞/失败不动/负缓存）');

  // D7b 用户症状的最小复现：旧缓存=竖屏、整机早已转回横屏 → 开远程必须纠正为横屏
  remote2.__resetRemoteForTests();
  {
    remote2.setEnvOrientation({ orientation: 'portrait' });   // 上一轮锁竖屏时缓存下来的
    let gets = 0;
    globalThis.fetch = async (url, init) => {
      const u = String(url);
      if (/\/store$/.test(u)) return { ok: true, status: 200, json: async () => ({ ok: true, value: { remote: { enabled: false, size: 5, orientation: 'auto', density: 'a' } } }) };
      if (/system\/orientation$/.test(u) && init && init.method === 'POST') return { ok: true, status: 200, json: async () => ({ ok: true, orientation: 'portrait', changed: true }) };
      if (/system\/orientation$/.test(u)) { gets += 1; return { ok: true, status: 200, json: async () => ({ ok: true, orientation: 'landscape' }) }; }  // 系统现在是横屏
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    };
    // 开远程前：旧缓存会让面板算出竖屏（这就是用户看到的「进入就选竖屏」）
    const before = remoteView110.resolveEffectiveOrientation('auto', remote2.getEnvOrientation() && remote2.getEnvOrientation().orientation, 'landscape');
    if (before !== 'portrait') fail('复现前提：开远程前旧缓存应让面板算出竖屏，实际 ' + before);
    let created;
    await TR.act(async () => { created = TR.create(React.createElement(settingsMod.SettingsPage, {})); });
    await sleep(20);
    const toggle = created.root.find((x) => x.props && x.props['data-dsh-prompt-remote-toggle']);
    await TR.act(async () => { toggle.props.onChange({ target: { checked: true } }); await sleep(40); });
    if (gets < 1) fail('开启远程应至少读一次整机方向');
    const after = remote2.getEnvOrientation() && remote2.getEnvOrientation().orientation;
    if (after !== 'landscape') fail('开远程后应以整机真值横屏覆盖旧缓存竖屏，实际 ' + after);
    const shown = remoteView110.resolveEffectiveOrientation('auto', after, 'landscape');
    if (shown !== 'landscape') fail('面板应算出横屏，实际 ' + shown);
    created.unmount();
    remote2.__resetRemoteForTests();
  }
  ok('D7b 旧缓存竖屏 → 开远程纠正为横屏（用户症状最小复现）');

  // D7c 启动即开着（刷新/崩溃恢复后重进）也必须刷新一次——源码级
  const indexSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'index.ts'), 'utf8');
  if (!/warmEnvOrientation/.test(indexSrc)) fail('启动路径应预热 env（刷新后远程仍开着时）');
  if (!/enabled !== true/.test(indexSrc)) fail('启动预热应只在远程已开时进行');
}
ok('D7c 启动且远程已开也刷新');

// D5：面板层永不直调整机桥（源码级）
{
  const panelSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'panel.ts'), 'utf8');
  if (/system\/orientation/.test(panelSrc)) fail('面板不得直调整机桥 URL');
  if (/getSystemOrientation|setSystemOrientation/.test(panelSrc)) fail('面板不得直调整机桥函数（只读 remote env 缓存）');
  if (!/getEnvOrientation/.test(panelSrc) || !/resolveEffectiveOrientation/.test(panelSrc)) fail('面板应经 env 缓存 + 有效值裁决');
}
ok('D5 面板只读缓存不碰桥');

// D6：恢复机制整体退役——「设为默认」入口与相关导出/文案不得复活
{
  // D6a 纯语义：会话快照相关导出已不存在，退出后方向即最终方向
  remote.__resetRemoteForTests();
  Object.keys(globalThis.localStorage._map).forEach((k) => globalThis.localStorage.removeItem(k));
  for (const fn of ['getSessionSnapshotOrientation', 'commitSessionOrientationAsDefault']) {
    if (typeof remote[fn] === 'function') fail(fn + ' 应已删除（无临时覆盖即无快照可提交）');
  }
  remote.setRemoteOrientation('landscape');
  remote.setRemoteEnabled(true);
  remote.setRemoteOrientation('portrait');
  remote.setRemoteEnabled(false);
  if (remote.getRemotePrefs().orientation !== 'portrait') fail('退出应保持最后选择，实际 ' + remote.getRemotePrefs().orientation);
  remote.__resetRemoteForTests();
  Object.keys(globalThis.localStorage._map).forEach((k) => globalThis.localStorage.removeItem(k));
}
ok('D6a 快照导出已删除、退出即最终方向');

// D6b 渲染器：界面不再有「设为默认」，且源码级无恢复残留
{
  remote2.__resetRemoteForTests();
  Object.keys(globalThis.localStorage._map).forEach((k) => globalThis.localStorage.removeItem(k));
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (/\/store$/.test(u)) return { ok: true, status: 200, json: async () => ({ ok: true, value: { remote: { enabled: false, size: 5, orientation: 'landscape', density: 'a' } } }) };
    if (/system\/orientation$/.test(u) && init && init.method === 'POST') return { ok: true, status: 200, json: async () => ({ ok: true, orientation: JSON.parse(init.body).orientation, changed: true }) };
    if (/system\/orientation$/.test(u)) return { ok: true, status: 200, json: async () => ({ ok: true, orientation: 'landscape' }) };
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  let created;
  await TR.act(async () => { created = TR.create(React.createElement(settingsMod.SettingsPage, {})); });
  await sleep(20);
  const bySetDefault = () => created.root.findAll((x) => x.type === 'button' && x.props && x.props['data-dsh-prompt-orientation-set-default'] === '1');
  if (bySetDefault().length !== 0) fail('不应再有设为默认按钮');
  const toggle = created.root.find((x) => x.props && x.props['data-dsh-prompt-remote-toggle']);
  await TR.act(async () => { toggle.props.onChange({ target: { checked: true } }); await sleep(30); });
  const autoBtn = created.root.findAll((x) => x.props && x.props['data-dsh-prompt-orientation'] === 'auto')[0];
  await TR.act(async () => { autoBtn.props.onClick(); await sleep(20); });
  if (bySetDefault().length !== 0) fail('改了方向也不应再出现设为默认（退出不还原，本就已生效）');
  const toggle2 = created.root.find((x) => x.props && x.props['data-dsh-prompt-remote-toggle']);
  await TR.act(async () => { toggle2.props.onChange({ target: { checked: false } }); await sleep(50); });
  if (remote2.getRemotePrefs().orientation !== 'auto') fail('退出应保持自动，实际 ' + remote2.getRemotePrefs().orientation);
  created.unmount();
  remote2.__resetRemoteForTests();
  Object.keys(globalThis.localStorage._map).forEach((k) => globalThis.localStorage.removeItem(k));

  // 源码级：恢复机制的任何残迹都不许回来
  const remoteSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'remote.ts'), 'utf8');
  const setSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'settings.ts'), 'utf8');
  const sysSrc = fs.readFileSync(SYS_TS, 'utf8');
  const i18nSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'i18n.ts'), 'utf8');
  if (/setItem\(\s*['"]__dshPromptPreRemote/.test(remoteSrc)) fail('remote.ts 不得再写进入快照键');
  if (/sessionSnapshot|writeStoredSnapshot|readStoredSnapshot/.test(remoteSrc)) fail('remote.ts 残留会话快照代码');
  if (/shouldRestoreSystemOrientation|remoteOrientationRestoreFail|remoteSetAsDefault/.test(setSrc + sysSrc + i18nSrc)) fail('恢复判定/文案有残留');
  if (/data-dsh-prompt-orientation-set-default/.test(setSrc)) fail('设置页不得再有设为默认入口');
  if (!/__dshPromptPreRemote/.test(remoteSrc)) fail('remote.ts 应保留遗留键的清理常量');
}
ok('D6b 设为默认入口与恢复残留全退役');

delete globalThis.fetch;
remote2.__resetRemoteForTests();
unstubLocalStorage();

console.log('=== Test #110 PASS ===');
process.exit(0);
})().catch((e) => { console.log('FAIL: ' + (e && e.stack || e)); process.exit(1); });
