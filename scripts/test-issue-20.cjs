// 回归测试 #20：自定义模板与使用次数切 DSH 缓存目录（直接切换，不迁移）
// 覆盖验收标准（不依赖 host 进程；host 未部署时 client 应 fail-soft 用内存默认）：
//  1) 旧 localStorage 键不再被读取（源码级断言：store.ts 不含四键字符串）
//  2) 同步 API 语义保持（add/update/remove/copy/bump/pin/sort，内存缓存）
//  3) 设置页行为提示文案存在（i18n storageNote zh/en + settings 引用）
//  4) host 半契约存在（lib/index.js：domain dsh_prompt v0 + 三表 + global lastUsed + 路由前缀 + 热重载单例）
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }
const DIR = path.join(__dirname, '.rt-tmp');
fs.mkdirSync(DIR, { recursive: true });

function fail(msg) { console.log('FAIL: ' + msg); process.exit(1) }
function ok(msg) { console.log(' ok: ' + msg) }

const STORE_TS = path.join(__dirname, '..', 'src', 'client', 'store.ts');
const storeSrc = fs.readFileSync(STORE_TS, 'utf8');

// ── 1) 直接切换：旧键不再被读取 ──
for (const key of ['dsh.prompt.customs', 'dsh.prompt.usage', 'dsh.prompt.pinned', 'dsh.prompt.lastUsed']) {
  if (storeSrc.includes(key)) fail('store.ts 仍引用旧 localStorage 键 ' + key);
}
ok('store.ts 不再引用旧 localStorage 四键');
if (!storeSrc.includes('/_dsh/dsh-prompt/store')) fail('store.ts 缺少 host 快照 URL');
if (!storeSrc.includes('ensureLoaded') || !storeSrc.includes('subscribeStore')) fail('store.ts 缺少 ensureLoaded/subscribeStore');
ok('store.ts 经 HTTP 桥读 host（/_dsh/dsh-prompt/*）');

// ── 2) 同步 API 语义（转译后在 Node 跑；无 fetch → 内存默认，persist 静默跳过） ──
const TPL_TS = path.join(__dirname, '..', 'src', 'client', 'templates.ts');
for (const [out, src, deps] of [
  ['templates.cjs', TPL_TS, []],
  ['store20.cjs', STORE_TS, ['./templates']],
]) {
  let js = ts.transpileModule(fs.readFileSync(src, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true },
  }).outputText;
  for (const d of deps) js = js.split('require("' + d + '")').join('require("' + d + '.cjs")');
  fs.writeFileSync(path.join(DIR, out), js.replace('require("./templates")', 'require("./templates.cjs")'));
}
const store = require(path.join(DIR, 'store20.cjs'));

// add → load 含新增
const t1 = store.addCustom('我的模板', '自定义', '请分析：');
if (!t1 || !t1.id || t1.builtin !== false) fail('addCustom 返回形状不对');
if (!store.loadCustoms().some((x) => x.id === t1.id)) fail('loadCustoms 不含新增');
// update
store.updateCustom(t1.id, { name: '改名后' });
if (store.loadCustoms().find((x) => x.id === t1.id).name !== '改名后') fail('updateCustom 未生效');
ok('add/update/load customs 内存语义保持');
// bump：用量 +1 且 lastUsed 同步
store.bumpUsage(t1.id);
store.bumpUsage(t1.id);
if (store.loadUsage()[t1.id] !== 2) fail('bumpUsage 计数不对: ' + JSON.stringify(store.loadUsage()));
if (store.loadLastUsed() !== t1.id) fail('bumpUsage 未同步 lastUsed');
ok('bumpUsage 用量+lastUsed 原子语义（内存侧）保持');
// pin：上限 5，超限 ok:false
store.savePinned([]);
for (let i = 0; i < 5; i++) {
  const r = store.togglePin('p' + i);
  if (!r.ok) fail('前 5 个 pin 应成功');
}
const over = store.togglePin('p-over');
if (over.ok) fail('第 6 个 pin 应超限失败');
if (!store.isPinned('p0') || store.canPinMore()) fail('isPinned/canPinMore 不对');
ok('pinned 上限 5 语义保持');
// remove：删模板同步清 pinned
const t2 = store.addCustom('待删', '自定义', 'body');
store.savePinned([t2.id]);
if (!store.removeCustom(t2.id)) fail('removeCustom 应返回 true');
if (store.loadCustoms().some((x) => x.id === t2.id)) fail('removeCustom 未删除');
if (store.loadPinned().includes(t2.id)) fail('removeCustom 未同步清 pinned');
ok('removeCustom 同步清 pinned 保持');
// copy 预制
const c = store.copyPresetToCustom('fp');
if (!c || c.builtin !== false) fail('copyPresetToCustom 应返回自定义副本');
ok('copyPresetToCustom 保持');
// 排序：设置页 Top-down（置顶优先→用量降序）与悬浮 bottom-up（用量升序）双标尺
store.savePinned([]);
const a = store.addCustom('A低频', '自定义', 'a');
const b = store.addCustom('B高频', '自定义', 'b');
store.bumpUsage(b.id); store.bumpUsage(b.id); store.bumpUsage(b.id);
const topDown = store.sortedTemplates([a, b]).map((x) => x.id);
if (topDown[0] !== b.id) fail('sortedTemplates 应按用量降序，高频在前');
const bottomUp = store.sortedTemplatesBottomUp([a, b]).map((x) => x.id);
if (bottomUp[bottomUp.length - 1] !== b.id) fail('sortedTemplatesBottomUp 高频应在底部');
ok('双排序标尺保持（Top-down 高频在上 / bottom-up 高频在下）');

// ── 3) 设置页提示文案 ──
const i18nSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'client', 'i18n.ts'), 'utf8');
if (!i18nSrc.includes('storageNote')) fail('i18n 缺少 storageNote');
const settingsSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'client', 'settings.ts'), 'utf8');
if (!settingsSrc.includes('storageNote')) fail('settings 未引用 storageNote');
ok('设置页行为提示文案存在（i18n.storageNote + settings 引用）');

// ── 4) host 半契约（源码级，import 目标只在 DSH host 运行时解析，此处不断言可加载） ──
const hostSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'index.js'), 'utf8');
for (const marker of [
  'dsh_prompt', 'version: 0', 'customs', 'usage', 'pinned', 'lastUsed',
  'storageDomain', 'webServer', '/_dsh/dsh-prompt', '__dshPromptStore',
  'customs/put', 'customs/delete', 'usage/bump', 'pinned/set',
]) {
  if (!hostSrc.includes(marker)) fail('lib/index.js 缺少 host 契约标记: ' + marker);
}
if (/dsh\.prompt\.(customs|usage|pinned|lastUsed)/.test(hostSrc)) fail('host 不应读写旧 localStorage 键');
ok('host 半契约完整（domain dsh_prompt v0 + 三表 + lastUsed + 路由 + 热重载单例）');

console.log('=== Test #20 PASS ===');
process.exit(0);
