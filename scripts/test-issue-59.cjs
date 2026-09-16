// 回归 #59：客户端壳里裸 `typeof localStorage` —— 存储不可用的环境下整壳起不来
//
// 验收（票面「要解决的问题」1–3）：
//  1) 默认 storage 的求值整个包在 `try` 里，兜住「属性访问本身抛」
//     （不能只 `try` 后面的 getItem/setItem —— 这正是本票的爆点形状）；
//  2) 全仓无第二处裸访问；smartstore / updauto 的降级值不变
//    （`false` / `null` / `''` / `false`）；
//  3) 回归断言「整壳仍起」：模拟「访问 localStorage 就抛」的环境，
//     客户端壳的 `apply` 走完（不只是日志能力降级）。
//
// 约束（分诊口径 + #53）：封装只住 `src/client/log/index.ts` 内部，不新建
// `src/client/storage.ts` —— 本仓每个回归脚本都在各自的 `.rt-tmp` 系列目录里
// 手写要转译的模块清单，往被普遍加载的路径上加一条 import 边会让既有脚本整批红
//（#53 实测 15 条里红 9 条）。`smartstore.ts` / `updauto.ts` 的 4 处本来就在
// `try` 里，刻意不收拢到一处共享封装（取舍见 `resolveDefaultStorage` 头注释）。
//
// 跑法：npm run test:issue-59（或 node scripts/test-issue-59.cjs）
// 口径：断言失败即退出码 1；T2/T3 转译源码直测（不依赖构建），T4 走构建产物
//（沿 test-log.cjs §12 的 ModuleLoader 装载台；bundle 陈旧会明确判红并提示重建）。
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }

const ROOT = path.join(__dirname, '..');
const DIR = path.join(__dirname, '.rt-tmp-59');
const SRC = (f) => path.join(ROOT, 'src', 'client', f);

let failures = 0;
function ok(msg) { console.log('  ok: ' + msg) }
function bad(msg) { failures++; console.log('  FAIL: ' + msg) }
function eq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) bad(msg + ' got=' + JSON.stringify(a) + ' want=' + JSON.stringify(b));
  else ok(msg);
}

/** 剥注释后再看代码：注释里可以谈 localStorage，代码里不行（test-issue-41 同款，另修 CRLF 行尾）。 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '')).join('\n');
}
/** 再剥字符串：界面文案里可以写「localStorage」字样（历史上那句存储说明就是），那不是存取。 */
function stripCode(src) {
  return stripComments(src)
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}
function purgeDir(dir) {
  for (const k of Object.keys(require.cache)) if (k.indexOf(dir) === 0) delete require.cache[k];
}
/** 存取 localStorage 全局描述符：按需装「抛 getter」/ 内存桩，用完原样恢复。 */
function lsDescriptor() { return Object.getOwnPropertyDescriptor(globalThis, 'localStorage') }
function setThrowingLS() {
  Object.defineProperty(globalThis, 'localStorage', {
    get() { throw new Error('access-denied(storage-blocked)'); },
    set(v) { throw new Error('access-denied(storage-blocked)'); },
    configurable: true,
  });
}
function setMemoryLS() {
  const store = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
      setItem: (k, v) => { store.set(String(k), String(v)) },
      removeItem: (k) => { store.delete(String(k)) },
      clear: () => { store.clear() },
      _map: store,
    },
    configurable: true, writable: true,
  });
  return store;
}
function restoreLS(desc) {
  try {
    if (desc) Object.defineProperty(globalThis, 'localStorage', desc);
    else delete globalThis.localStorage;
  } catch (e) { /* 恢复失败不掩盖断言 */ }
}

console.log('=== T1: 爆点形状已死 —— log/index.ts 无裸访问，且对外导出不超五个 ===');
{
  const src = fs.readFileSync(SRC('log/index.ts'), 'utf8');
  const code = stripCode(src);
  eq(code.includes('resolveDefaultStorage'), true, '安全封装住在本文件内部（resolveDefaultStorage）');
  eq(/typeof\s+localStorage/.test(code), false, '代码里没有裸 `typeof localStorage`（注释除外）');
  eq(/typeof\s+sessionStorage/.test(code), false, '代码里没有 `typeof sessionStorage`');
  const bare = code.match(/(^|[^.\w$\]\)])localStorage/g) || [];
  eq(bare.length, 0, '代码里没有裸标识符 localStorage（仅 globalThis.localStorage，实际 ' + bare.length + ' 处）');
  eq(code.includes('globalThis'), true, '经 globalThis 取存储（与 smartstore/updauto 同形）');
  const runtimeExports = [...src.matchAll(/^export (?:function|const) (\w+)/gm)].map((m) => m[1]);
  eq(runtimeExports.length <= 5, true, `对外导出 ${runtimeExports.length} 个 ≤ 5（${runtimeExports.join(', ')}）`);
  eq(runtimeExports.includes('startLog') && runtimeExports.includes('getLog'), true, 'startLog / getLog 仍在出口上');
}

console.log('=== T1b: 全仓同类写法清点 —— 没有第二处裸访问 ===');
{
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.ts')) files.push(p);
    }
  };
  walk(path.join(ROOT, 'src', 'client'));
  let bareFiles = [];
  let noTryFiles = [];
  let sessionFiles = [];
  for (const f of files) {
    const code = stripCode(fs.readFileSync(f, 'utf8'));
    if (/typeof\s+localStorage/.test(code) || /typeof\s+sessionStorage/.test(code)) bareFiles.push(path.relative(ROOT, f));
    const bare = code.match(/(^|[^.\w$\]\)])localStorage/g) || [];
    if (bare.length > 0) bareFiles.push(path.relative(ROOT, f) + `（裸 ${bare.length} 处）`);
    if (/sessionStorage/.test(code)) sessionFiles.push(path.relative(ROOT, f));
    if (/globalThis\.localStorage/.test(code) && !/try/.test(code)) noTryFiles.push(path.relative(ROOT, f));
  }
  bareFiles = [...new Set(bareFiles)];
  eq(bareFiles, [], 'src/client 下代码无裸访问（globalThis 形且在 try 里才算过）');
  eq(sessionFiles, [], 'src/client 下代码无 sessionStorage 存取（本票只涉 localStorage）');
  eq(noTryFiles, [], '凡经 globalThis 取存储的文件都有 try 兜底');
}

/* ── 转译被测模块到 .rt-tmp-59（沿 test-issue-41 先例：transpileModule → CJS + 改 require 后缀） ── */
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
function transpile(srcPath, outName, rewrites) {
  const src = fs.readFileSync(srcPath, 'utf8');
  let js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true },
  }).outputText;
  for (const [from, to] of (rewrites || [])) js = js.split(from).join(to);
  fs.writeFileSync(path.join(DIR, outName), js);
}
transpile(SRC('log/index.ts'), 'log.cjs', [
  ['require("../../../event-list.dsh-prompt.json")', 'require(' + JSON.stringify(path.join(ROOT, 'event-list.dsh-prompt.json')) + ')'],
  ['require("../../../lib/log/gate.js")', 'require(' + JSON.stringify(path.join(ROOT, 'lib', 'log', 'gate.js')) + ')'],
]);
transpile(SRC('smartstore.ts'), 'smartstore.cjs', []);
transpile(SRC('updauto.ts'), 'updauto.cjs', []);

console.log('=== T2: 默认 storage 兜住「属性访问就抛」（源码直测） ===');
{
  const prevBC = Object.getOwnPropertyDescriptor(globalThis, 'BroadcastChannel');
  const prevFetch = globalThis.fetch;
  try { Object.defineProperty(globalThis, 'BroadcastChannel', { value: undefined, configurable: true, writable: true }) } catch (e) { /* 无该全局则跳过 */ }
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse((init && init.body) || '{}');
    const value = /logGetSwitch$/.test(body.name || '') ? { ok: true, enabled: false, sampleRate: 1 } : { ok: true };
    return { ok: true, status: 200, json: async () => ({ ok: true, value }) };
  };
  const prevDesc = lsDescriptor();
  purgeDir(DIR);
  const log = require(path.join(DIR, 'log.cjs'));

  // a) 抛环境下无参 startLog 不抛，facade 可用（降级为无存储）
  setThrowingLS();
  let facade = null; let threw = null;
  try { facade = log.startLog() } catch (e) { threw = e }
  eq(threw, null, '抛环境下 startLog() 不抛（爆点已包住）');
  try {
    eq(typeof facade.log, 'function', 'facade 可用（log 在）');
    let logThrew = null; let r = null;
    try { r = facade.log('app.boot', { hasReact: true, lang: 'zh', entryCount: 6 }) } catch (e) { logThrew = e }
    eq(logThrew, null, '降级后 log(app.boot) 不抛');
    eq(typeof facade.status().dropped, 'number', '降级后 status() 可读');
    eq(typeof facade.getSwitch().enabled, 'boolean', '降级后 getSwitch() 可读');
  } catch (e) { bad('降级 facade 自检抛了：' + (e && e.message)) }

  // b) 显式 storage 优先于默认求值（抛环境下仍用注入的那一份）
  {
    purgeDir(DIR);
    const log2 = require(path.join(DIR, 'log.cjs'));
    setThrowingLS();
    const injected = {
      getItem: (k) => (k === 'dsws.debug' ? JSON.stringify({ enabled: true, sampleRate: 1, rev: 1 }) : null),
      setItem: () => undefined, removeItem: () => undefined,
    };
    let f2 = null; let t2 = null;
    try { f2 = log2.startLog({ storage: injected }) } catch (e) { t2 = e }
    eq(t2, null, '显式 storage 下 startLog 不抛');
    if (f2) eq(f2.getSwitch().enabled, true, '显式 storage 被采用（注入的 enabled=true 透出来了）');
  }

  // c) 根本没有 localStorage（undefined）也不抛
  {
    purgeDir(DIR);
    const log3 = require(path.join(DIR, 'log.cjs'));
    Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true, writable: true });
    let f3 = null; let t3 = null;
    try { f3 = log3.startLog() } catch (e) { t3 = e }
    eq(t3, null, 'localStorage 为 undefined 时 startLog 不抛');
    if (f3) eq(typeof f3.getSwitch().enabled, 'boolean', '无存储时 getSwitch 仍可读');
  }

  // d) 正常存储仍被沿用（行为无回归：有存储就用，不降级）
  {
    purgeDir(DIR);
    const log4 = require(path.join(DIR, 'log.cjs'));
    const mem = setMemoryLS();
    mem.set('dsws.debug', JSON.stringify({ enabled: true, sampleRate: 1, rev: 1 }));
    let f4 = null; let t4 = null;
    try { f4 = log4.startLog() } catch (e) { t4 = e }
    eq(t4, null, '正常存储下 startLog 不抛');
    if (f4) eq(f4.getSwitch().enabled, true, '正常存储被沿用（存的 enabled=true 读回来了）');
  }

  restoreLS(prevDesc);
  globalThis.fetch = prevFetch;
  try {
    if (prevBC) Object.defineProperty(globalThis, 'BroadcastChannel', prevBC);
    else delete globalThis.BroadcastChannel;
  } catch (e) { /* ignore */ }
}

console.log('=== T3: 同类 4 处降级值不变（smartstore / updauto，本票不动它们） ===');
{
  const prevDesc = lsDescriptor();
  purgeDir(DIR);
  const smart = require(path.join(DIR, 'smartstore.cjs'));
  const auto = require(path.join(DIR, 'updauto.cjs'));

  setThrowingLS();
  eq(smart.isSmartEnabled(), false, '抛环境：isSmartEnabled() → false');
  eq(smart.loadSmartPos(), null, '抛环境：loadSmartPos() → null');
  let t1 = null; try { smart.setSmartEnabled(true) } catch (e) { t1 = e }
  eq(t1, null, '抛环境：setSmartEnabled 不抛');
  let t2 = null; try { smart.saveSmartPos({ x: 1, y: 2 }) } catch (e) { t2 = e }
  eq(t2, null, '抛环境：saveSmartPos 不抛');
  eq(auto.loadSkippedVersion(), '', '抛环境：loadSkippedVersion() → 空串');
  eq(auto.saveSkippedVersion('0.1.9'), false, '抛环境：saveSkippedVersion() → false');

  // 正常存储下行为仍对（证明「不动它们」没有误伤正常路）
  const mem = setMemoryLS();
  purgeDir(DIR);
  const smart2 = require(path.join(DIR, 'smartstore.cjs'));
  const auto2 = require(path.join(DIR, 'updauto.cjs'));
  smart2.setSmartEnabled(true);
  eq(smart2.isSmartEnabled(), true, '正常存储：开关置 1 后读回 true');
  smart2.saveSmartPos({ x: 3, y: 4 });
  eq(smart2.loadSmartPos(), { x: 3, y: 4 }, '正常存储：位置存取往返');
  eq(auto2.saveSkippedVersion('0.1.9'), true, '正常存储：跳过写成功回 true');
  eq(auto2.loadSkippedVersion(), '0.1.9', '正常存储：跳过读回刚写的版本');
  void mem;

  restoreLS(prevDesc);
}

console.log('=== T4: 整壳仍起 —— 抛环境下 apply 走完（构建产物 + ModuleLoader 台） ===');
{
  const bundle = fs.readFileSync(path.join(ROOT, 'lib', 'client.js'), 'utf8');
  const code = stripCode(bundle);
  if (!code.includes('resolveDefaultStorage') || /typeof\s+localStorage/.test(code)) {
    bad('构建产物陈旧（lib/client.js 里没有修复形状）：先跑 npm run build:client 再重跑本脚本');
  } else {
    ok('构建产物新鲜（含 resolveDefaultStorage 且无裸 typeof localStorage）');
    const prevWindow = globalThis.window;
    const prevDesc = lsDescriptor();
    const prevFetch = globalThis.fetch;
    const prevBC = Object.getOwnPropertyDescriptor(globalThis, 'BroadcastChannel');
    const prevSlot = Object.getOwnPropertyDescriptor(globalThis, '__dshPromptLog');
    let captured = null;
    const calls = [];
    globalThis.window = { __ModuleLoader__: { load(def) { captured = def; } } };
    try { Object.defineProperty(globalThis, 'BroadcastChannel', { value: undefined, configurable: true, writable: true }) } catch (e) { /* ignore */ }
    globalThis.fetch = async (url, init) => {
      if (!/\/_dsh\/dsh-prompt\/log$/.test(String(url))) return { ok: false, status: 503, json: async () => ({ ok: false }) };
      const body = JSON.parse(init.body);
      calls.push(body);
      const value = body.name.endsWith('.logGetSwitch') ? { ok: true, enabled: false, sampleRate: 1 } : { ok: true };
      return { ok: true, status: 200, json: async () => ({ ok: true, value }) };
    };
    const clientPath = path.join(ROOT, 'lib', 'client.js');
    delete require.cache[require.resolve(clientPath)];
    try { require(clientPath) } catch (e) { bad('构建产物经 ModuleLoader 壳加载失败：' + (e && e.message)) }
    if (!captured) bad('构建产物没有经 ModuleLoader 交出 factory（captured 为空）');
    else {
      let clientMod = null;
      try {
        clientMod = captured.factory((name) => {
          if (name === 'react') return require('react');
          throw new Error('unexpected require: ' + name);
        });
      } catch (e) { bad('客户端 factory 落地失败：' + (e && e.message)) }
      if (clientMod) {
        eq(typeof clientMod.apply, 'function', '客户端工厂导出 apply()');
        setThrowingLS();
        const effects = [];
        let threw = null;
        try {
          clientMod.apply({
            slots: { inject: () => undefined, register: () => undefined },
            effect: (fn) => { effects.push(fn); return () => undefined; },
            inputTriggers: { registerSource: () => undefined },
          });
        } catch (e) { threw = e }
        eq(threw, null, '抛环境下 apply 不抛 —— 整壳仍起（本票验收）');
        eq(effects.length >= 5, true, `apply 走到底：注册了 ${effects.length} 个 effect（≥5，含入口/面板/设置/悬浮卡/自动检查）`);
        // 启动对账是 apply 走到底的活证据：reconcile 经同一条日志桥发 logGetSwitch
        eq(calls.some((c) => c.name === 'dsh-prompt.logGetSwitch'), true, '整壳起来后照常向宿主对账（发了 logGetSwitch）');
        const slot = globalThis.__dshPromptLog;
        eq(!!slot, true, 'apply 把日志能力装进 globalThis.__dshPromptLog');
        if (slot) {
          let lt = null; let lr = null;
          try { lr = slot.log('app.boot', { hasReact: true, lang: 'zh', entryCount: 6 }) } catch (e) { lt = e }
          eq(lt, null, '降级后整壳的日志槽仍可打点（不抛）');
          void lr;
        }
      }
    }
    globalThis.window = prevWindow;
    restoreLS(prevDesc);
    globalThis.fetch = prevFetch;
    try {
      if (prevBC) Object.defineProperty(globalThis, 'BroadcastChannel', prevBC);
      else delete globalThis.BroadcastChannel;
    } catch (e) { /* ignore */ }
    try {
      if (prevSlot) Object.defineProperty(globalThis, '__dshPromptLog', prevSlot);
      else delete globalThis.__dshPromptLog;
    } catch (e) { /* ignore */ }
  }
}

console.log(failures === 0 ? '\n全部通过：裸 typeof localStorage 整壳崩溃（#59）' : '\n失败 ' + failures + ' 条。');
process.exit(failures === 0 ? 0 : 1);
