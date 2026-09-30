// 回归 #89：后台周期检查（启动首次＋4h±5min 周期、每周期单飞、失败不顺延、跳过只挡弹不挡查）
//
// 契约（issue #89 Brief＋Q1/Q2 拍板）：
//  1) 启动后短延迟首次（沿用 8s），之后按固定周期复查，无需进入设置页；
//  2) 每周期单飞（多挂载也只一条 check），失败不顺延、下周期照常；
//  3) 有新版且未跳过 ⇒ 自动弹同一只窗；已是最新/已跳过/不可判读 ⇒ 不弹且不影响下周期；
//  4) 关窗不撤周期（#41 R2 口径 3：自动窗关了不再弹回来），卸光订阅才清表；
//  5) 手动「检查更新」随时可用，不受周期影响；跳过只挡自动弹窗，不挡检查本身。
//
// 断言纪律（沿 #41）：行为断言＋有界等待；生产真值写死（8s / 4h / 5min）；不碰真机。
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }

const ROOT = path.join(__dirname, '..');
const DIR = path.join(__dirname, '.rt-tmp-89');
const SRC = (f) => path.join(ROOT, 'src', 'client', f);
const TMP = (f) => path.join(DIR, f);

let failures = 0;
function ok(msg) { console.log('  ok: ' + msg) }
function bad(msg) { failures++; console.log('  FAIL: ' + msg) }
function eq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) bad(msg + ' got=' + JSON.stringify(a) + ' want=' + JSON.stringify(b));
  else ok(msg);
}

/* ── 生产真值（写死；区间断言另有行为锚） ── */
const EXPECT_DELAY_MS = 8000;
const EXPECT_INTERVAL_MS = 4 * 3600 * 1000;
const EXPECT_JITTER_MS = 5 * 60 * 1000;

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
// P1：只声明根；闭包与 require 改写由共享件顺着源码 import 推导（不再是手抄表）。
const { buildFlat } = require('./lib/transpile-client.cjs');
buildFlat(DIR, [
  SRC('templates.ts'),
  SRC('store.ts'),
  SRC('state.ts'),
  SRC('i18n.ts'),
  SRC('smartstore.ts'),
  SRC('updauto.ts'),
  SRC('upddialog.ts'),
  SRC('remote.ts'),
  SRC('remoteView.ts'),
  SRC('panel.ts'),
  SRC('about.ts'),
  SRC('update.ts'),
  path.join(ROOT, 'src', 'update', 'bridge.ts'),
  path.join(ROOT, 'src', 'update', 'gen', 'updateClient.derived.js'),
]);
const React = require('react');
const TR = require('react-test-renderer');

function stripComments(src) {
  // 实现集中在 scripts/lib/transpile-client.cjs 一份（旧写法的 split('\n') 在 CRLF 下静默失效）。
  return require('./lib/transpile-client.cjs').stripComments(src);
}
function purge() {
  for (const k of Object.keys(require.cache)) if (k.indexOf(DIR) === 0) delete require.cache[k];
}
function reload() {
  purge();
  return { auto: require(TMP('updauto.cjs')), update: require(TMP('update.cjs')) };
}

/* ── localStorage 桩 ── */
function setLS(api) {
  Object.defineProperty(globalThis, 'localStorage', { value: api, configurable: true, writable: true });
}
function clearLS() {
  Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true, writable: true });
}
function memStore() {
  const map = new Map();
  return {
    map,
    api: {
      getItem: (k) => (map.has(String(k)) ? map.get(String(k)) : null),
      setItem: (k, v) => { map.set(String(k), String(v)) },
      removeItem: (k) => { map.delete(String(k)) },
      clear: () => map.clear(),
    },
  };
}

/* ── 渲染小工具（同 test-issue-41 的做法） ── */
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
const waitFor = async (pred, budgetMs = 5000, stepMs = 5) => {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    if (pred()) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, stepMs));
  }
};
const waitShown = async (pred, budgetMs = 5000, stepMs = 10) => {
  const deadline = Date.now() + budgetMs;
  for (;;) {
    if (pred()) return true;
    if (Date.now() >= deadline) return false;
    await TR.act(async () => { await new Promise((r) => setTimeout(r, stepMs)) });
  }
};

/* ── 定时器账本（同 test-issue-41） ── */
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
const liveTimers = (kind) => Array.from(clock.timers.values()).filter((v) => !kind || v.kind === kind);
const pendingDelay = () => liveTimers('timeout').filter((v) => v.ms >= 1000);
const liveIntervals = () => liveTimers('interval').filter((v) => v.ms >= 250);
const clearClock = () => {
  for (const v of clock.timers.values()) { try { if (v.kind === 'timeout') realClearTimeout(v.id); else realClearInterval(v.id) } catch (e) { /* ignore */ } }
  clock.timers.clear();
};
const fireTimeout = async (t) => {
  if (!t) { bad('账本上没有待触发的首次延迟'); return }
  realClearTimeout(t.id);
  clock.timers.delete(t.id);
  await act(() => { t.fn() });
};
const fireInterval = async (t) => {
  if (!t) { bad('账本上没有后台周期 interval'); return }
  await act(() => { t.fn() });
};

/* ── 假宿主 ── */
const STATUS_PATH = '/_dsh/dsh-prompt/update/status';
const CHECK_PATH = '/_dsh/dsh-prompt/update/check';
const INSTALL_PATH = '/_dsh/dsh-prompt/update/install';
let requests = [];
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
  if (!which) return { status: 200, json: async () => ({ ok: false, error: { code: 'test-other-endpoint' } }) };
  requests.push({ which, url: u, method: init && init.method, body: JSON.parse((init && init.body) || '{}') });
  const body = typeof script[which] === 'function' ? script[which]() : script[which];
  if (!body) throw new Error('测试没给 ' + which + ' 的回包');
  return { status: 200, json: async () => body };
};
const resetScript = () => { requests = []; script.status = null; script.check = null; script.install = null };
const calls = (which) => requests.filter((r) => !which || r.which === which).length;

(async () => {
  console.log('=== U1: 排期常量单点＋抖动纯函数＋单飞闸（无 React） ===');
  {
    const auto = reload().auto;
    eq(auto.AUTO_CHECK_DELAY_MS, EXPECT_DELAY_MS, '首次延迟仍是 8000');
    eq(auto.AUTO_CHECK_INTERVAL_MS, EXPECT_INTERVAL_MS, '周期基线是 4h（拍板值）');
    eq(auto.AUTO_CHECK_INTERVAL_JITTER_MS, EXPECT_JITTER_MS, '抖动半带是 5min（拍板值）');
    // 字面量单点：8000 只在 updauto；14400000 / 300000 不以字面量出现（只认表达式）。
    const srcless = [];
    const walkSrc = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walkSrc(p);
        else if (e.name.endsWith('.ts')) srcless.push(p);
      }
    };
    walkSrc(path.join(ROOT, 'src'));
    const rel = (f) => path.relative(ROOT, f).replace(/\\/g, '/');
    // 按**意图**判（同 test-issue-41）：延迟常量的定义唯一 + 排期调用里没有写死的 8000。
    // 旧写法扫全树字面量 8000，会被无关的 z-index 常量（button.ts 的 DOCK_Z = 8000）误伤。
    eq(srcless.filter((f) => /export const AUTO_CHECK_DELAY_MS\s*=\s*8000\b/.test(stripComments(fs.readFileSync(f, 'utf8')))).map(rel), ['src/client/updauto.ts'], 'AUTO_CHECK_DELAY_MS = 8000 只在 updauto.ts 定义一处');
    eq(srcless.filter((f) => /(?:setTimeout|setInterval)\s*\([^;]{0,200}?\b8000\b/.test(stripComments(fs.readFileSync(f, 'utf8')))).map(rel), [], '排期调用里没有写死的 8000（排期只走 AUTO_CHECK_DELAY_MS）');
    eq(srcless.filter((f) => /\b14400000\b/.test(stripComments(fs.readFileSync(f, 'utf8')))).map(rel), [], '14400000 不以字面量出现');
    eq(srcless.filter((f) => /\b300000\b/.test(stripComments(fs.readFileSync(f, 'utf8')))).map(rel), [], '300000 不以字面量出现');
    // 抖动：端点与非法输入。
    eq(auto.jitteredAutoIntervalMs(() => 0), EXPECT_INTERVAL_MS - EXPECT_JITTER_MS, 'rand=0 ⇒ 基线-抖动');
    eq(auto.jitteredAutoIntervalMs(() => 1), EXPECT_INTERVAL_MS + EXPECT_JITTER_MS, 'rand=1 ⇒ 基线+抖动');
    eq(auto.jitteredAutoIntervalMs(() => 0.5), EXPECT_INTERVAL_MS, 'rand=0.5 ⇒ 基线');
    eq(auto.jitteredAutoIntervalMs(() => { throw new Error('x') }), EXPECT_INTERVAL_MS, 'rand 抛 ⇒ 回基线，不抛');
    eq(auto.jitteredAutoIntervalMs(() => NaN), EXPECT_INTERVAL_MS, 'rand=NaN ⇒ 回基线');
    eq(auto.jitteredAutoIntervalMs(() => 2), EXPECT_INTERVAL_MS + EXPECT_JITTER_MS, 'rand 越界 ⇒ 钳住');
    const d0 = auto.jitteredAutoIntervalMs();
    eq(d0 >= EXPECT_INTERVAL_MS - EXPECT_JITTER_MS && d0 <= EXPECT_INTERVAL_MS + EXPECT_JITTER_MS, true, '默认随机落在区间内，实际=' + d0);
    // 单飞闸：领到→再领不到→结算后又能领；无订阅结算不抛。
    eq(auto.claimAutoCheck(), true, '空闲可领');
    eq(auto.claimAutoCheck(), false, '在飞不可重领');
    auto.deliverAutoCheck(null);
    eq(auto.claimAutoCheck(), true, '结算后下周期可领（autoSpent 已删，无常驻拦截）');
    auto.deliverAutoCheck(null);
    // 订阅生命周期：首订阅排首次、复订阅不重排、卸光即清。
    clearClock();
    const off1 = auto.subscribeAutoTick(() => {});
    eq(pendingDelay().length, 1, '首订阅排一次首次延迟');
    const off2 = auto.subscribeAutoTick(() => {});
    eq(pendingDelay().length, 1, '第二订阅不重排（复用同一拍）');
    off1();
    eq(pendingDelay().length, 1, '还剩订阅者：表不撤');
    off2();
    eq(pendingDelay().length, 0, '卸光：首次表清掉');
    eq(liveIntervals().length, 0, '卸光：周期表也没有');
  }

  console.log('=== U2: 周期集成——首次＋第二拍＋关窗不撤周期 ===');
  {
    resetScript(); clearLS(); clearClock();
    setLS(memStore().api);
    script.check = okEnv(snap({ latestVersion: '0.1.9', canInstall: true }), 'CMD');
    const { update } = reload();
    const c = await mount(React.createElement(update.UpdateEntry, { auto: true }));
    eq(calls('status'), 0, '挂载不打 status');
    await fireTimeout(pendingDelay()[0]);
    if (!await waitFor(() => calls('check') === 1, 4000)) bad('首次没发 check');
    else ok('首次发出一条 check');
    if (!await waitShown(() => !!one(c, 'data-dsh-prompt-update-modal'), 4000)) bad('有新版没弹窗');
    else ok('有新版 ⇒ 弹窗');
    await fireInterval(liveIntervals()[0]);
    if (!await waitFor(() => calls('check') === 2, 4000)) bad('第二拍没发 check（后台没在查）');
    else ok('第二拍发出第二条 check');
    const modals = nodes(c, 'data-dsh-prompt-update-modal').length;
    eq(modals, 1, '第二轮不叠窗（仍一只），实际=' + modals);
    // 关窗：检查继续，窗不再回来（R2 口径 3：用户已表态）。
    const close = nodes(c, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === 'close')[0];
    await act(() => { close.props.onClick() });
    eq(!!one(c, 'data-dsh-prompt-update-modal'), false, '关窗');
    await fireInterval(liveIntervals()[0]);
    if (!await waitFor(() => calls('check') === 3, 4000)) bad('关窗后周期停了（不该停）');
    else ok('关窗后周期照常检查');
    eq(!!one(c, 'data-dsh-prompt-update-modal'), false, '关过一次不再弹回来');
    c.unmount();
    await flush();
    eq(liveIntervals().length, 0, '卸光即清表');
    clearLS();
  }

  console.log('=== U3: 跳过只挡弹不挡查；失败不顺延；手动不受影响 ===');
  {
    // 跳过：同版本周期只查不弹，新版本一到即弹。
    resetScript(); clearClock();
    const store = memStore();
    setLS(store.api);
    store.api.setItem('dsh.prompt.upd.skip', JSON.stringify({ version: '0.1.9' }));
    script.check = okEnv(snap({ latestVersion: '0.1.9', canInstall: true }), 'CMD');
    const m = reload();
    const c = await mount(React.createElement(m.update.UpdateEntry, { auto: true }));
    await fireTimeout(pendingDelay()[0]);
    if (!await waitFor(() => calls('check') === 1, 4000)) bad('跳过后首次没查（跳过不该挡检查）');
    else ok('跳过后照常检查');
    await TR.act(async () => { await new Promise((r) => setTimeout(r, 60)) });
    eq(!!one(c, 'data-dsh-prompt-update-modal'), false, '跳过的版本不弹');
    script.check = okEnv(snap({ latestVersion: '0.1.10', canInstall: true }), 'CMD');
    await fireInterval(liveIntervals()[0]);
    if (!await waitFor(() => calls('check') === 2, 4000)) bad('新版本那拍没查');
    if (!await waitShown(() => !!one(c, 'data-dsh-prompt-update-modal'), 4000)) bad('新版本没弹（只认一个版本号：0.1.10≠0.1.9）');
    else ok('换新版本即弹');
    c.unmount();
    await flush();
    // 失败：本轮不弹，下轮照常。
    resetScript(); clearClock();
    setLS(memStore().api);
    script.check = failEnv('bridge-unreachable');
    const m2 = reload();
    const c2 = await mount(React.createElement(m2.update.UpdateEntry, { auto: true }));
    await fireTimeout(pendingDelay()[0]);
    if (!await waitFor(() => calls('check') === 1, 4000)) bad('失败那轮没发 check');
    await TR.act(async () => { await new Promise((r) => setTimeout(r, 60)) });
    eq(!!one(c2, 'data-dsh-prompt-update-modal'), false, '失败不弹');
    script.check = okEnv(snap({ latestVersion: '0.1.9', canInstall: true }), 'CMD');
    await fireInterval(liveIntervals()[0]);
    if (!await waitFor(() => calls('check') === 2, 4000)) bad('失败后下周期没查');
    else ok('失败后下周期照常');
    c2.unmount();
    await flush();
    // 手动：非 auto 实例随时可查（周期不干扰）。
    resetScript(); clearClock();
    clearLS();
    script.status = okEnv(snap({ canInstall: false }), 'CMD');
    script.check = okEnv(snap({ latestVersion: '0.1.9', canInstall: true }), 'CMD');
    const m3 = reload();
    const c3 = await mount(React.createElement(m3.update.UpdateEntry, {}));
    const btn = (a) => nodes(c3, 'data-dsh-prompt-update-action').filter((n) => n.props['data-dsh-prompt-update-action'] === a)[0];
    await act(() => { nodes(c3, 'data-dsh-prompt-update')[0].props.onClick() });
    const idle = async () => {
      for (const t0 = Date.now();;) {
        const b = btn('check');
        if (b && b.props.disabled === false) return true;
        if (Date.now() - t0 > 4000) return false;
        await TR.act(async () => { await new Promise((r) => setTimeout(r, 10)) });
      }
    };
    if (!await idle()) bad('手动路径按钮不可点');
    else {
      await act(() => { btn('check').props.onClick() });
      if (!await waitFor(() => calls('check') === 1, 4000)) bad('手动没发 check');
      else ok('手动检查不受周期影响');
    }
    c3.unmount();
    clearLS();
    await flush();
  }

  globalThis.fetch = realFetch;
  console.log(failures === 0 ? '\n全部通过：后台周期检查（#89）' : '\n失败 ' + failures + ' 条。');
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.log('FAIL: 脚本自己抛了 ' + (e && e.stack || e)); process.exit(1) });
