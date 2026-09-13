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
const derived = require(TMP('updateClient.derived.cjs'));

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
const realFetch = globalThis.fetch;
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

/* ── 定时器账本：把 setTimeout / setInterval 记成「当下还活着几只在等」，用来做行为断言 ──
   包一层 globalThis 上的真函数（透传调用），只记 id、延迟与回调；一次性定时器**烧掉就自己划账**，
   所以账上剩下的就是「还没烧的」；clear* 也把账划掉。
   「关掉弹窗不留常驻定时器」这条断言看的就是这份账，不是源码。 */
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
const realSetInterval = globalThis.setInterval;
const realClearInterval = globalThis.clearInterval;
const clock = { timers: new Map() };
globalThis.setTimeout = function (fn, ms) {
  const entry = { kind: 'timeout', ms, fn };
  const id = realSetTimeout(function () { clock.timers.delete(id); return fn.apply(this, arguments) }, ms);
  entry.id = id;
  clock.timers.set(id, entry);
  return id;
};
globalThis.clearTimeout = function (id) { clock.timers.delete(id); return realClearTimeout(id) };
globalThis.setInterval = function (fn, ms) {
  const id = realSetInterval(fn, ms);
  clock.timers.set(id, { id, kind: 'interval', ms, fn });
  return id;
};
globalThis.clearInterval = function (id) { clock.timers.delete(id); return realClearInterval(id) };
/** 账上还活着的定时器（按钮可按类型过滤）。 */
const liveTimers = (kind) => Array.from(clock.timers.values()).filter((v) => !kind || v.kind === kind);
/**
 * 账上那个**还没烧、且不是测试自己排的等待**的一次性定时器：测试的 waitFor 用的是 5/10ms、
 * 最长的等待是 1.5s；组件排的启动延迟是 8s —— 用 1000ms 这条线把两者分开（这条线只服务测试的账本）。
 */
const pendingDelay = () => liveTimers('timeout').filter((v) => v.ms >= 1000);
const clearClock = () => {
  for (const v of clock.timers.values()) { try { if (v.kind === 'timeout') realClearTimeout(v.id); else realClearInterval(v.id) } catch (e) { /* ignore */ } }
  clock.timers.clear();
};
/**
 * 手动点一次「账上那个还没烧掉的启动延迟」：先把真表拆掉（不然 8 秒后真定时器会再进同一段逻辑，
 * 而那时测试已经在另一个用例里了），再在 act 里调它的回调 —— 这就是「延迟到点」的确定性等价物。
 */
const fireTimeout = async (t) => {
  if (!t) { bad('账本上没有待触发的启动延迟（组件没排？还是被别的东西顶下去了）'); return }
  realClearTimeout(t.id);
  clock.timers.delete(t.id);
  await act(() => { t.fn() });
};
/** 账上活着的常驻表：≥250ms 的 interval（测试自己不排 interval）。 */
const liveIntervals = () => liveTimers('interval').filter((v) => v.ms >= 250);

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

  console.log('=== T4: 自动模式的接线与「延迟只出现一处」 ===');
  {
    const autoCode = stripComments(autoSrc);
    const updateCode = stripComments(updateSrc);
    const indexCode = stripComments(indexSrc);
    eq(/export const AUTO_CHECK_DELAY_MS = 8000/.test(autoCode), true, 'updauto.ts 定义 AUTO_CHECK_DELAY_MS = 8000（本票定死的延迟）');
    // 「代码里只出现一处」：把 src 下所有 .ts 剥掉注释后数这个数字
    const srcless = [];
    const walkSrc = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walkSrc(p);
        else if (e.name.endsWith('.ts')) srcless.push(p);
      }
    };
    walkSrc(path.join(ROOT, 'src'));
    const hits = srcless.filter((f) => /\b8000\b/.test(stripComments(fs.readFileSync(f, 'utf8'))))
      .map((f) => path.relative(ROOT, f).replace(/\\/g, '/'));
    eq(hits, ['src/client/updauto.ts'], '延迟数字 8000 在 src 的代码里只出现在 updauto.ts 一处');
    eq(updateCode.split('AUTO_CHECK_DELAY_MS').length - 1, 2, 'update.ts 只在 import + setTimeout 两处提到这个常量（自己不写数字）');
    eq(/setTimeout\([\s\S]{0,120}AUTO_CHECK_DELAY_MS/.test(updateCode), true, '延迟到点的定时器用的就是这个常量');
    eq(/clearTimeout\(timer\)/.test(updateCode), true, '卸载 / 关窗时 clearTimeout（不留常驻表）');
    // 全局宿主：shell.overlay 的第二个注册点（与智能卡并列），auto 开关只在这一处传
    eq(indexCode.split("'shell.overlay'").length - 1, 4, 'index.ts 在 shell.overlay 注册两处（inject + register 各一次 × 智能卡与更新自动检查）');
    eq(/id: 'dsh-prompt-update-auto'/.test(indexCode), true, '全局宿主有稳定的 id（dsh-prompt-update-auto）');
    eq(indexCode.split('auto: true').length - 1, 1, 'auto 模式只在 index.ts 那一个宿主里打开（设置页那一份不受影响）');
    eq(/conversation\.input\.overlay[\s\S]{0,200}dsh-prompt-update-auto/.test(indexCode), false, '自动宿主不在会话作用域（会话说白了可以有多个，电话只该发一次）');
    // 自动模式仍是同一只弹窗（不另写一只）：ModalPortal + 同一个 data 属性
    eq(/if \(auto\) return modal/.test(updateCode), true, 'auto 模式直接返回 ModalPortal 包的那只弹窗（不另写第二只）');

    console.log('=== T5: 启动后按生产默认延迟自动查一次；有新版本弹同一只弹窗 ===');
    resetScript(); clearLS(); clearClock();
    script.check = okEnv(snap({ latestVersion: '0.1.9', canInstall: true }), 'CMD');
    const { update } = reload();
    const c = await mount(React.createElement(update.UpdateEntry, { auto: true }));
    eq(calls('status'), 0, '自动模式挂载时不打 status（一个会话就一条电话：延迟到点的 check）');
    eq(nodes(c, 'data-dsh-prompt-update').length, 0, '自动模式不渲染设置页那一行入口');
    eq(!!one(c, 'data-dsh-prompt-update-modal'), false, '延迟没到点：不弹窗');
    const pending = pendingDelay()[0];
    eq(pending && pending.ms, EXPECT_DELAY_MS, '排的是一次 ' + EXPECT_DELAY_MS + 'ms 的延迟（生产默认值，测试写死期望）');
    eq(calls('check'), 0, '到点之前一条 check 都不发（不是「先查再等」）');
    await fireTimeout(pending);
    if (!await waitFor(() => calls('check') === 1, 4000)) bad('延迟到点后等 4s 仍没发出 check；通话序列=' + (requests.map((r) => r.which).join('|') || '(无)'));
    else ok('延迟到点发出且只发一条 check');
    if (!await waitShown(() => !!one(c, 'data-dsh-prompt-update-modal'), 4000)) {
      bad('有新版本却没弹窗；通话序列=' + (requests.map((r) => r.which).join('|') || '(无)'));
    } else {
      ok('有新版本 ⇒ 自动弹出更新弹窗');
      const mt = String(txt(one(c, 'data-dsh-prompt-update-modal')));
      eq(mt.indexOf('0.1.9') >= 0, true, '弹窗里能看到新版本号 0.1.9');
      eq(!!one(c, 'data-dsh-prompt-update-action') && !!nodes(c, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === 'install')[0], true,
        '自动弹出的就是 #40 那只带「安装新版本」的弹窗');
    }
    eq(calls('check'), 1, '整个启动过程只自动查这一次（闸：一个会话一次）');
    eq(pendingDelay().length, 0, '延迟那一刻的一次性定时器已经烧掉，账上没有别的一次性表在等');
    eq(liveIntervals().length, 0, '空闲弹窗（没有安装任务）不开常驻轮询');

    console.log('=== T6: 「只弹一次」——关掉后再重挂载也不发第二条电话、不再弹 ===');
    {
      const close = nodes(c, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === 'close')[0];
      await act(() => { close.props.onClick() });
      eq(!!one(c, 'data-dsh-prompt-update-modal'), false, '点 ✕ 关掉弹窗');
      c.unmount();
      await flush();
      const c2 = await mount(React.createElement(update.UpdateEntry, { auto: true }));
      const pend2 = pendingDelay()[0];
      eq(pend2 && pend2.ms, EXPECT_DELAY_MS, '重挂载后确实又排了一次延迟（不是靠「根本没挂上」蒙过的）');
      await fireTimeout(pend2);
      await TR.act(async () => { await new Promise((r) => setTimeout(r, 60)) });
      eq(calls('check'), 1, '第二次启动阶段一条 check 都不发（闩在模块级，跨重挂载）');
      eq(!!one(c2, 'data-dsh-prompt-update-modal'), false, '也不再弹第二只窗（「有新版本弹一次」）');
      c2.unmount();
    }

    console.log('=== T7: 没有新版本 / 安装中轮询随弹窗生命周期起停 ===');
    {
      resetScript(); clearLS(); clearClock();
      script.check = okEnv(snap({ latestVersion: '0.1.7' }), 'CMD');
      const fresh = reload();
      const c3 = await mount(React.createElement(fresh.update.UpdateEntry, { auto: true }));
      await fireTimeout(pendingDelay()[0]);
      if (!await waitFor(() => calls('check') === 1, 4000)) bad('（第二个模块实例）延迟到点没发 check');
      await TR.act(async () => { await new Promise((r) => setTimeout(r, 50)) });
      eq(!!one(c3, 'data-dsh-prompt-update-modal'), false, 'latest == running（没有新版本）⇒ 不弹窗，不打扰');
      eq(pendingDelay().length, 0, '没弹窗也不留常驻一次性表');
      eq(liveIntervals().length, 0, '没弹窗也不留常驻轮询');
      c3.unmount();

      // 安装中：弹窗打开期间按 UPD_POLL 轮询；关掉弹窗即停表（票面验收第 3 条）。
      resetScript(); clearLS(); clearClock();
      script.check = okEnv(snap({ latestVersion: '0.1.9', canInstall: false, job: { state: 'installing' } }), 'CMD');
      script.status = () => okEnv(snap({ latestVersion: '0.1.9', canInstall: false, job: { state: 'installing' } }), 'CMD');
      const fresh2 = reload();
      const c4 = await mount(React.createElement(fresh2.update.UpdateEntry, { auto: true }));
      await fireTimeout(pendingDelay()[0]);
      if (!await waitShown(() => !!one(c4, 'data-dsh-prompt-update-modal'), 4000)) bad('安装中那一份没有自动弹窗，后面两条轮询断言无从谈起');
      else {
        if (!await waitFor(() => calls('status') >= 1, 4000)) bad('安装中：等 4s 没看到轮询发 status');
        else ok('安装中：弹窗打开期间按 UPD_POLL（' + derived.UPD_POLL + 'ms）轮询 status');
        eq(requests.filter((r) => r.which === 'status').length >= 1 && requests[requests.length - 1].which === 'status', true,
          '轮询发的是 status（只读本机、不联网）');
        const close4 = nodes(c4, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === 'close')[0];
        await act(() => { close4.props.onClick() });
        const at = calls('status');
        await TR.act(async () => { await new Promise((r) => setTimeout(r, derived.UPD_POLL + 500)) });
        eq(calls('status'), at, '关掉弹窗后不再打 status（轮询随弹窗生命周期结束，' + (derived.UPD_POLL + 500) + 'ms 内又打了 ' + (calls('status') - at) + ' 次）');
        eq(liveIntervals().length, 0, '关掉弹窗后账上没有活着的 interval');
        eq(pendingDelay().length, 0, '关掉弹窗后账上也没有别的一次性表');
      }
      c4.unmount();
      await flush();
    }

    console.log('=== T8: 「跳过此版本」只写 localStorage；跳过之后（含重启）不再自动弹；清掉键即恢复 ===');
    {
      const store = memStore();
      setLS(store.api);
      resetScript(); clearClock();
      script.check = okEnv(snap({ latestVersion: '0.1.9', canInstall: true }), 'CMD');
      const m1 = reload();
      const c1 = await mount(React.createElement(m1.update.UpdateEntry, { auto: true }));
      await fireTimeout(pendingDelay()[0]);
      const skipBtn = (cc) => nodes(cc, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === 'skip')[0];
      if (!await waitShown(() => !!one(c1, 'data-dsh-prompt-update-modal'), 4000)) bad('（跳过用例）自动弹窗没出现，后面几条无从谈起');
      else {
        eq(!!skipBtn(c1), true, '自动弹出的弹窗里有「跳过此版本」');
        await act(() => { skipBtn(c1).props.onClick() });
        eq(store.map.has(EXPECT_SKIP_KEY), true, '点一下就把记录写进 localStorage');
        eq(JSON.parse(store.map.get(EXPECT_SKIP_KEY)), { version: '0.1.9' }, '写进去的就是弹窗里那个最新版本号');
        const mt = String(txt(one(c1, 'data-dsh-prompt-update-modal')));
        eq(mt.indexOf('已跳过') >= 0 && mt.indexOf('0.1.9') >= 0, true, '弹窗里说清「已跳过 0.1.9」');
        eq(!!skipBtn(c1), false, '跳过之后按钮不再给（这一个版本没什么可跳的了）');
        eq(others.length, 0, '跳过只写 localStorage：没有任何别的端点被访问');
        c1.unmount();
      }
      // 「重启」：模块状态清空、localStorage 留住 —— 这正是票面「跳过之后重启宿主不再自动弹」那条验收。
      resetScript(); clearClock();
      script.check = okEnv(snap({ latestVersion: '0.1.9', canInstall: true }), 'CMD');
      const m2 = reload();
      const c2 = await mount(React.createElement(m2.update.UpdateEntry, { auto: true }));
      await fireTimeout(pendingDelay()[0]);
      if (!await waitFor(() => calls('check') === 1, 4000)) bad('（跳过之后）重启那次自动检查没发出 check');
      else ok('重启后仍然会查一次（跳过挡的是「弹窗」，不是「不查」）');
      await TR.act(async () => { await new Promise((r) => setTimeout(r, 60)) });
      eq(!!one(c2, 'data-dsh-prompt-update-modal'), false, '重启之后不再自动弹（同版本被跳过）');
      eq(calls('check'), 1, '重启也只查这一条');
      c2.unmount();
      // 清掉那个键 ⇒ 恢复自动弹（票面验收：「清掉该 localStorage 键后恢复」）。
      store.api.removeItem(EXPECT_SKIP_KEY);
      resetScript(); clearClock();
      script.check = okEnv(snap({ latestVersion: '0.1.9', canInstall: true }), 'CMD');
      const m3 = reload();
      const c3 = await mount(React.createElement(m3.update.UpdateEntry, { auto: true }));
      await fireTimeout(pendingDelay()[0]);
      if (!await waitShown(() => !!one(c3, 'data-dsh-prompt-update-modal'), 4000)) bad('清掉跳过键之后没有恢复自动弹窗');
      else ok('清掉 localStorage 那个键 ⇒ 自动弹窗恢复');
      c3.unmount();
      clearLS();
      await flush();
    }

    console.log('=== T9: 跳过只挡自动弹窗 —— 手动点「检查更新」仍能看到那个版本 ===');
    {
      const store = memStore();
      setLS(store.api);
      store.api.setItem(EXPECT_SKIP_KEY, JSON.stringify({ version: '0.1.9' }));
      resetScript(); clearClock();
      script.status = okEnv(snap({ canInstall: false }), 'CMD');
      script.check = okEnv(snap({ latestVersion: '0.1.9', canInstall: true }), 'CMD');
      const m = reload();
      const c = await mount(React.createElement(m.update.UpdateEntry, {}));
      const btn = (a) => nodes(c, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === a)[0];
      const idle = () => { const b = btn('check'); return !!b && b.props.disabled === false };
      // 打开弹窗（点设置页那一行入口），等挂载那次 status 落地（按钮不再是 disabled）再点检查
      await act(() => { nodes(c, 'data-dsh-prompt-update')[0].props.onClick() });
      if (!await waitShown(idle, 4000)) bad('手动路径：等 4s 检查按钮仍不可点（挂载那次 status 没落地）');
      else {
        await act(() => { btn('check').props.onClick() });
        const shown = await waitShown(() => {
          const ib = btn('install');
          const mt = String(txt(one(c, 'data-dsh-prompt-update-modal')));
          return !!ib && mt.indexOf('0.1.9') >= 0;
        }, 4000);
        if (!shown) bad('手动检查看不到被跳过的那个版本（票面交付 3 的后半句被违反）');
        else {
          ok('手动点「检查更新」照样看到 0.1.9 与「安装新版本」（跳过只挡自动弹窗）');
          eq(calls('check'), 1, '手动那条 check 正常发出（跳过没有把电话也挡掉）');
          eq(!!btn('skip'), false, '已经跳过这一个版本：弹窗不再给「跳过此版本」（没什么可跳的了）');
        }
      }
      c.unmount();
      clearLS();
      await flush();
    }
  }

  globalThis.fetch = realFetch;
  console.log(failures === 0 ? '\n全部通过：启动自动检查 + 只弹一次 + 跳过此版本（#41）' : '\n失败 ' + failures + ' 条。');
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.log('FAIL: 脚本自己抛了 ' + (e && e.stack || e)); process.exit(1) });
