// 回归 #41：启动后延迟自动检查 + 有新版本弹一次 + 跳过此版本
//
// 契约（票面「交付」1–4 与「验收」逐条；map #38 的 grilling 定案）：
//  1) 启动后延迟若干秒自动查一次新版：延迟时长在本票里定死，代码里只出现一处（updauto.ts 的
//     AUTO_CHECK_DELAY_MS），update.ts 只引用它、不写第二个数字；
//  2) 有新版本时自动弹**同一只**更新弹窗（update.ts 的 UpdateEntry 在 `auto` 模式下只渲染那只弹窗，
//     不另写第二只），且只弹一次（一个页面会话里至多一次自动检查，至多一次自动开窗）；
//  3) 「跳过此版本」只落 localStorage 一个键（`storages/dsh_prompt.json` 的 schema 冻结，不进它）；
//     同版本不再自动弹，**手动**点「检查更新」仍能看到那个版本；
//  4) 只在弹窗打开 / 安装进行中时轮询状态（间隔取派生文件的 UPD_POLL），关掉弹窗不留常驻定时器。
//
// 断言纪律（本图用血换来的）：
//  · 「点一下再立刻读」一律换成**有界等待**，超时判红（waitFor / waitShown 返回 false 就 bad）；
//  · 生产的延迟值是**测试里写死的期望**（不是拿常量自己比自己），改小/改大都会被这条钉住；
//  · 「只弹一次」「关掉不留表」「跳过之后不弹」都是**行为断言**（看发了哪几条电话、窗口在不在、
//    活着的定时器有几个），不是源码字符串断言；
//  · 本脚本不碰真机：假 fetch 只应答桥的三条端点，不联网、不装包、不动 profile、不写 storages。
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }

const ROOT = path.join(__dirname, '..');
const DIR = path.join(__dirname, '.rt-tmp-41');
const SRC = (f) => path.join(ROOT, 'src', 'client', f);
const TMP = (f) => path.join(DIR, f);

let failures = 0;
function ok(msg) { console.log('  ok: ' + msg) }
function bad(msg) { failures++; console.log('  FAIL: ' + msg) }
function eq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) bad(msg + ' got=' + JSON.stringify(a) + ' want=' + JSON.stringify(b));
  else ok(msg);
}

/* ── 转译客户端模块到 .rt-tmp-41（沿用仓内既有先例：ts.transpileModule → CJS + 改 require 后缀） ── */
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
const MODULES = [
  ['templates.ts', SRC('templates.ts'), []],
  ['store.ts', SRC('store.ts'), ['./templates']],
  ['state.ts', SRC('state.ts'), []],
  ['i18n.ts', SRC('i18n.ts'), []],
  ['smartstore.ts', SRC('smartstore.ts'), []],
  ['updauto.ts', SRC('updauto.ts'), []],
  ['panel.ts', SRC('panel.ts'), ['./templates', './store', './state', './i18n', './smartstore']],
  ['about.ts', SRC('about.ts'), ['./panel', './i18n']],
  ['update.ts', SRC('update.ts'), ['./panel', './i18n', './updauto', '../update/bridge', '../update/gen/updateClient.derived.js']],
  ['bridge.ts', path.join(ROOT, 'src', 'update', 'bridge.ts'), ['./gen/updateClient.derived.js']],
  ['updateClient.derived.js', path.join(ROOT, 'src', 'update', 'gen', 'updateClient.derived.js'), []],
];
for (const [outName, srcPath, deps] of MODULES) {
  const src = fs.readFileSync(srcPath, 'utf8');
  let js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true },
  }).outputText;
  for (const d of deps) {
    // '../update/bridge' 这类跨目录依赖要落到本临时目录里的同名产物上（bridge 的派生文件同理）
    const target = d === '../update/bridge' ? './bridge.cjs'
      : (d === './gen/updateClient.derived.js' || d === '../update/gen/updateClient.derived.js') ? './updateClient.derived.cjs'
        : d + '.cjs';
    js = js.split('require("' + d + '")').join('require("' + target + '")');
  }
  fs.writeFileSync(TMP(outName.replace(/\.ts$/, '.cjs').replace(/\.js$/, '.cjs')), js);
}
const React = require('react');
const TR = require('react-test-renderer');

/**
 * 把注释从源码里剥掉再看代码：有几条纪律是**代码**纪律（不认识宿主存储、不发请求），
 * 而同一个文件的头部注释恰恰要把「跳过记录不进 storages/dsh_prompt.json」这句话写出来 ——
 * 不剥注释就会把说明当违规。剥法够用就好：先删块注释，再删行注释（本仓这几个文件里
 * 字符串里没有 `//`；真出现了也是测试自己的事，不影响被测代码的行为断言）。
 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
}

/** 清掉临时目录里的模块缓存再 require：updauto.ts 有一个「一个会话只自动查一次」的闩，
 *  要用它的模块级状态把「重挂载不重弹」测出来，就必须让每个用例拿一份干净的模块实例。 */
function purge() {
  for (const k of Object.keys(require.cache)) if (k.indexOf(DIR) === 0) delete require.cache[k];
}
function reload() {
  purge();
  return { auto: require(TMP('updauto.cjs')), update: require(TMP('update.cjs')), i18n: require(TMP('i18n.cjs')) };
}

/* ── 假宿主：只应答桥的三条端点，形状与 lib/index.js 的 writeJson 一致 ── */
const STATUS_PATH = '/_dsh/dsh-prompt/update/status';
const CHECK_PATH = '/_dsh/dsh-prompt/update/check';
const INSTALL_PATH = '/_dsh/dsh-prompt/update/install';
let requests = [];
let others = [];
const script = { status: null, check: null, install: null };
const okEnv = (snapshot, manual, receipt) => ({
  ok: true, value: { ok: true, snapshot, manual: manual === undefined ? null : manual, receipt: receipt === undefined ? null : receipt },
});
const failEnv = (code) => ({ ok: false, value: { ok: false, error: code, errorKind: code }, error: { code, message: code } });
const snap = (over) => Object.assign({
  runningVersion: '0.1.7', installedVersion: '0.1.7', latestVersion: null, canInstall: false, blockedReason: null, job: null,
}, over);
globalThis.fetch = async (url, init) => {
  const u = String(url);
  const which = u === STATUS_PATH ? 'status' : u === CHECK_PATH ? 'check' : u === INSTALL_PATH ? 'install' : '';
  if (!which) {
    others.push(u);
    return { status: 200, json: async () => ({ ok: false, error: { code: 'test-other-endpoint' } }) };
  }
  requests.push({ which, url: u, method: init && init.method, body: JSON.parse((init && init.body) || '{}') });
  const body = typeof script[which] === 'function' ? script[which]() : script[which];
  if (!body) throw new Error('测试没给 ' + which + ' 的回包');
  return { status: 200, json: async () => body };
};
const resetScript = () => { requests = []; others = []; script.status = null; script.check = null; script.install = null };
const calls = (which) => requests.filter((r) => !which || r.which === which).length;

/* ── localStorage 桩（Node 里 globalThis.localStorage 默认是 undefined，可以按需装/卸） ── */
function setLS(api) {
  Object.defineProperty(globalThis, 'localStorage', { value: api, configurable: true, writable: true });
}
function clearLS() {
  Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true, writable: true });
}
function memStore(hooks) {
  const map = new Map();
  const h = hooks || {};
  return {
    map,
    api: {
      getItem: (k) => { if (h.throwOnRead) throw new Error('read blocked'); return map.has(String(k)) ? map.get(String(k)) : null },
      setItem: (k, v) => { if (h.throwOnWrite) throw new Error('quota exceeded'); map.set(String(k), String(v)) },
      removeItem: (k) => { map.delete(String(k)) },
      clear: () => map.clear(),
    },
  };
}

/* ── 渲染小工具 ── */
const txt = (n) => {
  if (n && typeof n.toJSON === 'function') n = n.toJSON();
  const parts = [];
  const walk = (c) => {
    if (c === null || c === undefined || c === false || c === true) return;
    if (typeof c === 'string' || typeof c === 'number') { parts.push(String(c)); return }
    if (Array.isArray(c)) { c.forEach(walk); return }
    if (c.children) c.children.forEach(walk);
  };
  walk(n);
  return parts.join('');
};
const flush = async () => {
  await TR.act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  });
};
const mount = async (el) => {
  let c;
  await TR.act(async () => { c = TR.create(el) });
  await flush();
  return c;
};
const nodes = (c, attr) => c.root.findAll((x) => !!x.props && x.props[attr] !== undefined);
const one = (c, attr) => nodes(c, attr)[0];
const act = async (fn) => { await TR.act(async () => { fn() }); await flush() };
/**
 * 有界等待：条件成立返回 true；超过 `budgetMs` 仍不成立返回 **false**（= 调用方必须判红，并把当时的
 * 真实状态打进 FAIL 里）。不是「等不到就跳过 / 把断言放宽成也算过」。
 * 假 fetch 的每一次应答都要过 `res.json()`（Promise）与一次宏任务，`flush()` 那两次 setTimeout(0)
 * 不构成「通话已完成 + 渲染已跟上」的屏障 —— 等它落地为止才是确定的。
 */
const waitFor = async (pred, budgetMs = 5000, stepMs = 5) => {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    if (pred()) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, stepMs));
  }
};
/** 同上，但条件看的是**渲染结果**：等的时候要 pump React。 */
const waitShown = async (pred, budgetMs = 5000, stepMs = 10) => {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    if (pred()) return true;
    if (Date.now() >= deadline) return false;
    await TR.act(async () => { await new Promise((r) => setTimeout(r, stepMs)) });
  }
};

/* ── 定时器账本：把 setTimeout / setInterval 记成「谁在活着」，用来做行为断言 ──
   包一层 globalThis 上的真函数（透传调用），只记 id、延迟与类型；clear* 把账划掉。
   「关掉弹窗不留常驻定时器」这条断言看的就是这份账，不是源码。 */
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
const realSetInterval = globalThis.setInterval;
const realClearInterval = globalThis.clearInterval;
const clock = { timers: new Map(), seq: 0 };
globalThis.setTimeout = function (fn, ms) {
  const id = realSetTimeout(fn, ms);
  clock.timers.set(id, { kind: 'timeout', ms, fn });
  return id;
};
globalThis.clearTimeout = function (id) { clock.timers.delete(id); return realClearTimeout(id) };
globalThis.setInterval = function (fn, ms) {
  const id = realSetInterval(fn, ms);
  clock.timers.set(id, { kind: 'interval', ms, fn });
  return id;
};
globalThis.clearInterval = function (id) { clock.timers.delete(id); return realClearInterval(id) };
/** 活着的定时器（可按类型过滤）：interval 用「交出去的 id 还在账上」判。 */
const liveTimers = (kind) => Array.from(clock.timers.entries()).filter(([, v]) => !kind || v.kind === kind);
/** 把账上最近一个未触发的 `timeout` 记下来（不触发），交给调用方决定何时点火。 */
const lastTimeout = () => {
  let out = null;
  for (const [id, v] of clock.timers) if (v.kind === 'timeout') out = { id, ...v };
  return out;
};
const clearClock = () => {
  for (const [id, v] of clock.timers) { try { if (v.kind === 'timeout') realClearTimeout(id); else realClearInterval(id) } catch (e) { /* ignore */ } }
  clock.timers.clear();
};

/* ── 生产真值（测试里写死，不许拿常量自己比自己） ── */
/** 票面定死的延迟：启动后 8 秒。本行是**期望**，不是从源码读出来的值。 */
const EXPECT_DELAY_MS = 8000;
/** localStorage 键写死一次：改键名 = 老用户的跳过记录失效，这条是刻意的红。 */
const EXPECT_SKIP_KEY = 'dsh.prompt.upd.skip';
/** 真实 profile 的存储文件（票面硬规矩：一个字节都不许动）。 */
const PROFILE_STORE = path.join(process.env.USERPROFILE || '', '.dsh', 'storages', 'dsh_prompt.json');

(async () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const autoSrc = fs.readFileSync(SRC('updauto.ts'), 'utf8');
  const updateSrc = fs.readFileSync(SRC('update.ts'), 'utf8');
  const indexSrc = fs.readFileSync(SRC('index.ts'), 'utf8');
  const allClientSrc = fs.readdirSync(path.join(ROOT, 'src', 'client')).filter((f) => f.endsWith('.ts')).map((f) => fs.readFileSync(SRC(f), 'utf8')).join('\n');

  console.log('=== T1: 接线纪律与「只出现一处」的真值 ===');
  eq(typeof pkg.scripts['test:issue-41'], 'string', 'package.json 有 test:issue-41 入口');
  const auto = reload().auto;
  eq(typeof auto.decideAutoOpen, 'function', 'updauto.ts 导出 decideAutoOpen（纯函数）');
  eq(typeof auto.loadSkippedVersion, 'function', 'updauto.ts 导出 loadSkippedVersion');
  eq(typeof auto.saveSkippedVersion, 'function', 'updauto.ts 导出 saveSkippedVersion');
  eq(auto.UPD_SKIP_KEY, EXPECT_SKIP_KEY, '跳过键就是 dsh.prompt.upd.skip');
  eq(allClientSrc.split("'" + EXPECT_SKIP_KEY + "'").length - 1, 1, '键名在 src/client 下只出现一处（没有第二处写死）');
  // 存储 schema 冻结：跳过记录不进宿主存储，源码里连那个文件名都不该出现
  const autoCode = stripComments(autoSrc);
  eq(/dsh_prompt\.json|storages[/\\]/.test(autoCode), false, 'updauto.ts 的代码里没有宿主存储文件 / storages 路径（跳过只落 localStorage）');
  eq(/fetch\(|createUpdateBridge|_dsh\//.test(autoCode), false, 'updauto.ts 的代码不发请求（判据与存储都不认识桥）');
  eq(/from '\.\/update'|from '\.\.\/update/.test(autoSrc), false, 'updauto.ts 不 import update.ts（两文件不成环）');

  console.log('=== T2: decideAutoOpen 的判据（纯函数，逐条对着票面） ===');
  const d = (latest, running, skipped) => auto.decideAutoOpen({ latest, running, skipped });
  eq(d('0.1.9', '0.1.7', ''), { open: true, why: 'newer' }, 'latest 比 running 新 ⇒ 弹');
  eq(d('0.2.0', '0.1.7', ''), { open: true, why: 'newer' }, '次版本更新也弹');
  eq(d('0.1.7', '0.1.7', ''), { open: false, why: 'not-newer' }, '一样新 ⇒ 不弹');
  eq(d('0.1.6', '0.1.7', ''), { open: false, why: 'not-newer' }, '比 running 旧 ⇒ 不弹');
  eq(d('0.1.9', '0.1.7', '0.1.9'), { open: false, why: 'skipped' }, 'latest 正是跳过的那一个 ⇒ 不弹');
  eq(d('0.1.10', '0.1.7', '0.1.9'), { open: true, why: 'newer' }, '跳过 0.1.9 之后来了 0.1.10 ⇒ 照弹（只认一个版本号）');
  eq(d('0.1.9', '0.1.9', '0.1.9'), { open: false, why: 'not-newer' }, '已装到跳过的那个版本 ⇒ 不弹');
  eq(d('', '0.1.7', ''), { open: false, why: 'bad-version' }, 'latest 为空（宿主没给）⇒ 不弹，不猜');
  eq(d(null, '0.1.7', ''), { open: false, why: 'bad-version' }, 'latest 是 null ⇒ 不弹');
  eq(d('v0.1.9', '0.1.7', ''), { open: false, why: 'bad-version' }, 'latest 带 v 前缀 ⇒ 认不出就不弹');
  eq(d('0.1', '0.1.7', ''), { open: false, why: 'bad-version' }, '两段式 latest ⇒ 认不出就不弹（与包的 validVersion 同口径）');
  eq(d('0.1.9-beta.1', '0.1.7', ''), { open: false, why: 'bad-version' }, '预发布后缀 ⇒ 认不出就不弹');
  eq(d('0.1.9', '', ''), { open: false, why: 'bad-version' }, 'running 读不出来 ⇒ 不弹（保守侧）');
  eq(d('0.1.9', 17, ''), { open: false, why: 'bad-version' }, 'running 是数字 ⇒ 不弹');
  eq(d('1.0.0', '0.99.99', ''), { open: true, why: 'newer' }, '三段数字逐段比（不是字符串比）');
  eq(d('0.1.7', '0.1.7', '0.1.6'), { open: false, why: 'not-newer' }, '记的是一个更旧的跳过版本 ⇒ 也不误弹');

  console.log('=== T3: 「跳过此版本」只落 localStorage（存取行为 + 坏形状 + 写失败） ===');
  {
    const { api, map } = memStore();
    setLS(api);
    const fresh = reload().auto;
    eq(fresh.saveSkippedVersion('0.1.9'), true, '写成功回 true');
    eq(Array.from(map.keys()), [EXPECT_SKIP_KEY], '只写了这一个键（没有第二个存储键）');
    eq(JSON.parse(map.get(EXPECT_SKIP_KEY)), { version: '0.1.9' }, '值是 {"version":"0.1.9"}');
    eq(fresh.loadSkippedVersion(), '0.1.9', '读回来就是刚写的那一个');
    eq(fresh.saveSkippedVersion(''), false, '空版本号不写（回 false）');
    api.setItem(EXPECT_SKIP_KEY, 'not json');
    eq(fresh.loadSkippedVersion(), '', '坏 JSON ⇒ 回空串（不抛）');
    api.setItem(EXPECT_SKIP_KEY, JSON.stringify({ version: 123 }));
    eq(fresh.loadSkippedVersion(), '', 'version 不是字符串 ⇒ 回空串');
    api.setItem(EXPECT_SKIP_KEY, JSON.stringify('0.1.9'));
    eq(fresh.loadSkippedVersion(), '', '值是字符串不是对象 ⇒ 回空串');
    api.removeItem(EXPECT_SKIP_KEY);
    eq(fresh.loadSkippedVersion(), '', '没记录 ⇒ 回空串');

    const boomWrite = memStore({ throwOnWrite: true });
    setLS(boomWrite.api);
    eq(reload().auto.saveSkippedVersion('0.1.9'), false, '写抛（配额满 / 隐私模式）⇒ 回 false，不上抛');
    const boomRead = memStore({ throwOnRead: true });
    setLS(boomRead.api);
    eq(reload().auto.loadSkippedVersion(), '', '读抛 ⇒ 回空串，不上抛');

    clearLS();
    const noStore = reload().auto;
    eq(noStore.loadSkippedVersion(), '', '没有 localStorage ⇒ 回空串');
    eq(noStore.saveSkippedVersion('0.1.9'), false, '没有 localStorage ⇒ 回 false');

    // 存取全程不许发电话：跳过是本机偏好，与宿主、与官方源都无关
    const before = requests.length;
    const spy = reload().auto;
    setLS(memStore().api);
    spy.saveSkippedVersion('0.1.9'); spy.loadSkippedVersion();
    eq(requests.length - before, 0, '存取跳过不产生任何电话（一字节都不问宿主）');
    clearLS();
  }

  console.log(failures === 0 ? '\n全部通过。' : '\n失败 ' + failures + ' 条。');
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.log('FAIL: 脚本自己抛了 ' + (e && e.stack || e)); process.exit(1) });
