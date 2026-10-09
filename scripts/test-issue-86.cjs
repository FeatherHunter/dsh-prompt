// 回归测试 #86：整机方向真切 client wrapper + 设置页接线（去宿主化自实现消费侧）
// 覆盖：systemOrientation 纯校验/归一 + GET/POST thin wrapper（含非法不出网、无桥、
// HTTP 失败映射）+ 设置页方向行（锁定先调 OS、失败回落自家并明示、busy 禁用）。
// 口径：纯函数走转译断言，接线走渲染器（NODE_ENV=development，否则 act 不可用）。
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }
const DIR = path.join(__dirname, '.rt-tmp-86');
fs.mkdirSync(DIR, { recursive: true });

function fail(msg) { console.log('FAIL: ' + msg); process.exit(1) }
function ok(msg) { console.log(' ok: ' + msg) }

const ROOT = path.join(__dirname, '..');
const SYS_TS = path.join(ROOT, 'src', 'client', 'systemOrientation.ts');

(async () => {
// ── 1) 纯函数（转译后断言） ──
let sysJs = ts.transpileModule(fs.readFileSync(SYS_TS, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true },
}).outputText;
fs.writeFileSync(path.join(DIR, 'systemOrientation.cjs'), sysJs);
const sys = require(path.join(DIR, 'systemOrientation.cjs'));

if (!sys.isSystemOrientation('landscape') || !sys.isSystemOrientation('portrait')) fail('横竖应合法');
if (sys.isSystemOrientation('auto') || sys.isSystemOrientation('up')) fail('auto/非法不应进 OS');
ok('方向校验（仅横竖进 OS）');

for (const [v, want] of [['unsupported', 'unsupported'], ['busy', 'busy'], ['denied', 'denied'], ['unknown', 'unknown'], ['bogus', 'unknown'], [null, 'unknown']]) {
  if (sys.normalizeOrientCode(v) !== want) fail('错误码归一错误: ' + v);
}
ok('错误码封闭四码（外来落 unknown）');

let r = sys.normalizeSystemOrientResponse({ ok: true, orientation: 'portrait', source: 'live', changed: true });
if (!r.ok || r.orientation !== 'portrait' || r.source !== 'live' || r.changed !== true) fail('合法成功回包应原样: ' + JSON.stringify(r));
r = sys.normalizeSystemOrientResponse({ ok: false, error: { code: 'denied', message: 'x' } });
if (r.ok || r.error.code !== 'denied') fail('失败回包应保码');
r = sys.normalizeSystemOrientResponse({ ok: true, orientation: 'auto' });
if (r.ok) fail('auto 成功应判失败');
r = sys.normalizeSystemOrientResponse(null);
if (r.ok || r.error.code !== 'unknown') fail('坏包应落 unknown');
ok('回包归一（成功保值/失败保码/坏包兜底）');

// 非法输入不出网
let called = 0;
const spy = async () => { called += 1; return { ok: true, status: 200, json: async () => ({}) } };
r = await sys.setSystemOrientation('auto', spy);
if (r.ok || called !== 0) fail('非法输入不应出网');
ok('非法输入不出网');

// 无桥 → unsupported
r = await sys.setSystemOrientation('landscape', null);
if (r.ok || r.error.code !== 'unsupported') fail('无桥应 unsupported: ' + JSON.stringify(r));
ok('无桥 unsupported');

// POST 成功 / 失败保码
const okFetch = async (url, init) => {
  if (init.method !== 'POST' || !/system\/orientation$/.test(url)) throw new Error('bad request');
  const body = JSON.parse(init.body);
  if (body.orientation !== 'portrait') throw new Error('bad body');
  // 总闸要从 host 快照里来：mount 的 effect 会拉一次 store 并把缓存重置为快照值，
  // 所以「开着」这件事必须由快照表达（#82 起总闸默认关，关时方向/密度控件被禁用）。
  return { ok: true, status: 200, json: async () => (/\/store$/.test(String(url)) ? { ok: true, value: { remote: { enabled: true, size: 5, orientation: 'auto', density: 'a' } } } : { ok: true, orientation: 'portrait' }) };
};
r = await sys.setSystemOrientation('portrait', okFetch);
if (!r.ok || r.orientation !== 'portrait') fail('POST 成功应回真值');
const deniedFetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: false, error: { code: 'denied', message: 'd' } }) });
r = await sys.setSystemOrientation('landscape', deniedFetch);
if (r.ok || r.error.code !== 'denied') fail('失败应保码 denied');
const httpFail = async () => ({ ok: false, status: 503, json: async () => ({}) });
r = await sys.getSystemOrientation(httpFail);
if (r.ok || r.error.code !== 'unknown') fail('HTTP 失败应 unknown');
const throwFetch = async () => { throw new Error('boom'); };
r = await sys.getSystemOrientation(throwFetch);
if (r.ok || r.error.code !== 'unknown') fail('抛错应 unknown');
ok('GET/POST 映射（成功保值/失败保码/异常兜底）');

// ── 2) 源码级：设置页接线 ──
const settingsSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'settings.ts'), 'utf8');
for (const marker of ['setSystemOrientation', 'isSystemOrientation', 'data-dsh-prompt-orientation-note', 'remoteOrientationOsFail', 'remoteOrientationBusy', 'orientBusy']) {
  if (!settingsSrc.includes(marker)) fail('settings.ts 缺真切接线标记: ' + marker);
}
if (/remote-sys-orientation/.test(settingsSrc)) fail('不应残留宿主灰行');
ok('设置页接线源码齐（先真切/回落明示/busy禁用）');

// ── 3) 渲染器：锁定走 OS、失败回落自家、auto 不出网 ──
const MODULES = [
  ['templates.ts', path.join(ROOT, 'src', 'client', 'templates.ts'), []],
  ['store.ts', path.join(ROOT, 'src', 'client', 'store.ts'), ['./templates']],
  ['state.ts', path.join(ROOT, 'src', 'client', 'state.ts'), []],
  ['i18n.ts', path.join(ROOT, 'src', 'client', 'i18n.ts'), ['./locale']],
  ['locale.ts', path.join(ROOT, 'src', 'client', 'locale.ts'), []],
  ['smartstore.ts', path.join(ROOT, 'src', 'client', 'smartstore.ts'), []],
  ['remote2.cjs', path.join(ROOT, 'src', 'client', 'remote.ts'), []],
  ['remoteView.cjs', path.join(ROOT, 'src', 'client', 'remoteView.ts'), []],
  ['systemOrientation.cjs', SYS_TS, []],
  ['workspace.cjs', path.join(ROOT, 'src', 'client', 'workspace.ts'), []],
  ['picker.cjs', path.join(ROOT, 'src', 'client', 'picker.ts'), ['./panel', './remoteView', './i18n', './workspace', './locale']],
  ['keys.cjs', path.join(ROOT, 'src', 'client', 'keys.ts'), ['./store', './i18n']], // #142 起 keys 引 ./store(展示映射)+./i18n(词表)，手抄表跟上
  ['panel.cjs', path.join(ROOT, 'src', 'client', 'panel.ts'), ['./templates', './store', './state', './i18n', './smartstore', './remote', './remoteView', './locale', './keys']],
  ['settings.cjs', path.join(ROOT, 'src', 'client', 'settings.ts'), ['./panel', './about', './update', './smartstore', './remote', './remoteView', './systemOrientation', './i18n', './locale']],
  ['button.cjs', path.join(ROOT, 'src', 'client', 'button.ts'), ['./panel', './state', './settings', './remote', './remoteView', './i18n', './workspace', './picker', './smartstore', './locale']],
];
fs.writeFileSync(path.join(DIR, 'about.cjs'), 'module.exports.SettingsHeaderLinks=()=>null;module.exports.AuthorPlugins=()=>null;');
fs.writeFileSync(path.join(DIR, 'update.cjs'), 'module.exports.UpdateEntry=()=>null;');
for (const [outName, srcPath, deps] of MODULES) {
  let src = fs.readFileSync(srcPath, 'utf8');
  let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true } }).outputText;
  for (const d of deps) js = js.split('require("' + d + '")').join('require("' + d + '.cjs")');
  js = js.split('require("./remote.cjs")').join('require("./remote2.cjs")');
  js = js.split('require("./remoteView.cjs")').join('require("./remoteView.cjs")');
  js = js.split('require("./systemOrientation.cjs")').join('require("./systemOrientation.cjs")');
  const outFile = outName.endsWith('.cjs') ? outName : outName.replace(/\.ts$/, '.cjs');
  fs.writeFileSync(path.join(DIR, outFile), js);
}
const React = require('react');
const TR = require('react-test-renderer');
const settingsMod = require(path.join(DIR, 'settings.cjs'));
const remote2 = require(path.join(DIR, 'remote2.cjs'));

// 成功路径：点竖屏锁定 → OS ok → 偏好落地、无 note
remote2.__resetRemoteForTests();
let fetchCalls = [];
globalThis.fetch = async (url, init) => {
  fetchCalls.push({ url, method: init && init.method });
  // 总闸要从 host 快照里来：mount 的 effect 会拉一次 store 并把缓存重置为快照值，
  // 所以「开着」这件事必须由快照表达（#82 起总闸默认关，关时方向/密度控件被禁用）。
  return { ok: true, status: 200, json: async () => (/\/store$/.test(String(url)) ? { ok: true, value: { remote: { enabled: true, size: 5, orientation: 'auto', density: 'a' } } } : { ok: true, orientation: 'portrait' }) };
};
let created;
await TR.act(async () => { created = TR.create(React.createElement(settingsMod.SettingsPage, {})); });
let root = created.root;
const btns = root.findAll((x) => x.props && x.props['data-dsh-prompt-orientation']);
if (btns.length !== 3) fail('方向三档应 3 按钮，实际 ' + btns.length);
const portrait = btns.find((b) => b.props['data-dsh-prompt-orientation'] === 'portrait');
await TR.act(async () => { portrait.props.onClick(); await new Promise((r) => setTimeout(r, 20)); });
if (remote2.getRemotePrefs().orientation !== 'portrait') fail('成功后偏好应落地竖屏');
if (fetchCalls.filter((c) => /system\/orientation$/.test(c.url) && c.method === 'POST').length !== 1) fail('锁定应调 OS 端点一次');
let notes = created.root.findAll((x) => x.props && x.props['data-dsh-prompt-orientation-note'] === '1');
if (notes.length !== 0) fail('成功应静默无 note');
ok('渲染器：锁定走 OS、成功偏好落地无 note');

// 失败路径：denied → 自家锁定照常 + note 明示原因码
remote2.__resetRemoteForTests();
fetchCalls = [];
globalThis.fetch = async (url) => ({ ok: true, status: 200, json: async () => (/\/store$/.test(String(url)) ? { ok: true, value: { remote: { enabled: true, size: 5, orientation: 'auto', density: 'a' } } } : { ok: false, error: { code: 'denied', message: 'd' } }) });
let created2;
await TR.act(async () => { created2 = TR.create(React.createElement(settingsMod.SettingsPage, {})); });
const btns2 = created2.root.findAll((x) => x.props && x.props['data-dsh-prompt-orientation'] === 'landscape');
await TR.act(async () => { btns2[0].props.onClick(); await new Promise((r) => setTimeout(r, 20)); });
if (remote2.getRemotePrefs().orientation !== 'landscape') fail('失败后自家锁定照常落地');
notes = created2.root.findAll((x) => x.props && x.props['data-dsh-prompt-orientation-note'] === '1');
if (notes.length !== 1 || !/denied/.test(String((notes[0].children || []).join('')))) fail('失败应明示原因码 denied');
ok('渲染器：失败回落自家并明示原因码');

// auto 不出网
remote2.__resetRemoteForTests();
fetchCalls = [];
globalThis.fetch = async (url) => { fetchCalls.push({ url }); return { ok: true, status: 200, json: async () => (/\/store$/.test(String(url)) ? { ok: true, value: { remote: { enabled: true, size: 5, orientation: 'auto', density: 'a' } } } : {}) } };
await remote2.setRemoteOrientation('portrait');
let created3;
await TR.act(async () => { created3 = TR.create(React.createElement(settingsMod.SettingsPage, {})); });
const autoBtn = created3.root.findAll((x) => x.props && x.props['data-dsh-prompt-orientation'] === 'auto')[0];
fetchCalls = [];
await TR.act(async () => { autoBtn.props.onClick(); await new Promise((r) => setTimeout(r, 20)); });
if (remote2.getRemotePrefs().orientation !== 'auto') fail('auto 偏好应落地');
if (fetchCalls.filter((c) => /system\/orientation$/.test(c.url)).length !== 0) fail('auto 不应调 OS 端点');
ok('渲染器：auto 只写偏好不出网');

delete globalThis.fetch;
remote2.__resetRemoteForTests();

console.log('=== Test #86 PASS ===');
process.exit(0);
})().catch((e) => { console.log('FAIL: ' + (e && e.stack || e)); process.exit(1) });
