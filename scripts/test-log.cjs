// 回归：日志能力（地图 #45）。宿主半能落盘、字段白名单真拦得住、开关语义与包一致、电话能通。
// 跑法：npm run test:log（或 node scripts/test-log.cjs）
// 口径：断言失败即退出码 1；用真实 lib/log/index.js + 真实 dsh-log 包，只有目录与文件系统可注入。
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..');
const TMP = path.join(os.tmpdir(), 'dsh-prompt-testlog-' + Date.now());

let failures = 0;
function ok(msg) { console.log(' ok: ' + msg); }
function fail(msg) { failures += 1; console.log('FAIL: ' + msg); }
function assert(cond, msg) { if (cond) ok(msg); else fail(msg); }
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected);
  if (a === e) ok(msg + ' → ' + e);
  else fail(msg + ' → 实际 ' + a + '，期望 ' + e);
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function logFileOf(home) {
  const day = new Date();
  const name = day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' + String(day.getDate()).padStart(2, '0') + '.log';
  return path.join(home, 'logs', 'dsh-prompt', name);
}
function logLines(home) {
  const file = logFileOf(home);
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
}
function eventsOf(home) { return logLines(home).map((e) => e.event); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 从构建产物里抠出内联的事件清单字面量（rolldown 以 `//#region event-list.dsh-prompt.json` 标注它）。 */
function extractInlinedManifest(bundle) {
  const region = bundle.indexOf('//#region event-list.dsh-prompt.json');
  if (region < 0) return null;
  const braceAt = bundle.indexOf('{', bundle.indexOf('= {', region));
  if (braceAt < 0) return null;
  let depth = 0;
  for (let p = braceAt; p < bundle.length; p += 1) {
    const ch = bundle[p];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        try { return new Function('return ' + bundle.slice(braceAt, p + 1))(); } catch (e) { return null; }
      }
    }
  }
  return null;
}

/**
 * 落盘不是同步的：包的 flushNow 在上一次刷盘仍在进行时只置一个待办标记就返回（dist/store.js L207-213），
 * 真正写下去可能在下一个防抖窗口。所以断言前一律「催一次 + 轮询等目标出现」，不写死睡眠。
 */
async function drain(cap, home, expectEvent) {
  try { await cap.store.flushNow(); } catch (e) { /* 包只计数不抛，这里也不拦 */ }
  if (!expectEvent) { await sleep(50); return; }
  const t0 = Date.now();
  while (Date.now() - t0 < 3000) {
    if (eventsOf(home).includes(expectEvent)) return;
    await cap.store.flushNow().catch(() => undefined);
    await sleep(50);
  }
}

(async () => {
  const mod = await import(pathToFileURL(path.join(ROOT, 'lib', 'log', 'index.js')).href);
  const manifest = readJson(path.join(ROOT, 'event-list.dsh-prompt.json'));

  /* ── 1) 事件清单：三个检查器 + 计数逐项一致 ── */
  const dshLogHost = await import('dsh-log/host');
  const parsed = dshLogHost.parseEventListManifest(manifest);
  ok('parseEventListManifest 通过（形状合规）');
  assert(dshLogHost.checkEventCounts(parsed).ok, 'checkEventCounts 通过（自报 counts 与实际条数逐项一致）');
  const names = Object.keys(parsed.events);
  assert(names.length === 35, `事件条数 35 → 实际 ${names.length}`);
  const actualKinds = { resident: 0, ondemand: 0, selfmon: 0 };
  for (const n of names) actualKinds[parsed.events[n].kind] += 1;
  eq(actualKinds, { resident: 22, ondemand: 8, selfmon: 5 }, '三类 kind 计数');

  let fieldBad = 0;
  for (const n of names) if (!dshLogHost.checkEventFields(parsed, n, parsed.events[n].fields).ok) fieldBad += 1;
  eq(fieldBad, 0, '每个事件的允许字段都通过 checkEventFields');
  assert(!dshLogHost.checkEventFields(parsed, 'app.boot', ['__not_declared__']).ok, '反例：未声明字段被 checkEventFields 拒绝');
  assert(!dshLogHost.checkEventFields(parsed, 'no.such.event', []).ok, '反例：未声明事件被 checkEventFields 拒绝');

  /* ── 2) 单条事件体积上限（字段填满 32 字符） ── */
  let worst = 0; let worstName = '';
  for (const n of names) {
    const fields = {};
    for (const f of parsed.events[n].fields) fields[f] = 'x'.repeat(32);
    const line = JSON.stringify({ ts: Date.now(), level: parsed.events[n].level, event: n, fields });
    if (line.length > worst) { worst = line.length; worstName = n; }
  }
  assert(worst <= 1024, `最肥一条 ${worstName} = ${worst} 字节 ≤ 1024`);
  let longestField = 0;
  for (const n of names) for (const f of parsed.events[n].fields) longestField = Math.max(longestField, f.length);
  assert(longestField <= 32, `最长字段名 ${longestField} 字符 ≤ 32`);

  /* ── 3) 落盘路径 + 开关文件落点 ── */
  const home = path.join(TMP, 'home');
  const cap = await mod.createLogCapability({ env: { DSH_HOME: home } });
  assert(cap.ok === true, '日志能力建成（真实 dsh-log）');
  eq(cap.phoneNames.logBatch, 'dsh-prompt.logBatch', '电话名前缀用插件标识（不复用 wf）');
  eq(cap.store.config.logDirName, 'dsh-prompt', 'logDirName 显式覆盖为 dsh-prompt');
  eq(cap.store.config.switchFileName, 'log-switch-dsh-prompt.json', '开关文件名按插件标识派生');

  // 开关默认关 → info 不落盘（第 6 节专门验这条）。这里先打开，验落盘路径与字段白名单。
  await cap.runPhone(cap.phoneNames.logSetSwitch, { enabled: true, sampleRate: 1 });
  cap.log('app.boot', { hasReact: true, lang: 'zh', entryCount: 5 });
  await drain(cap, home, 'app.boot');
  let lines = logLines(home);
  assert(lines.length >= 1, '日志文件落在 <home>/logs/dsh-prompt/ 且非空');
  const boot = lines.find((l) => l.event === 'app.boot');
  assert(!!boot, 'app.boot 落盘');
  eq(boot && boot.fields, { hasReact: true, lang: 'zh', entryCount: 5 }, 'app.boot 字段原样通过白名单');

  /* ── 4) 字段闸门：白名单硬拦 ── */
  cap.log('panel.open', { mode: 'compact', rows: 3, body: '这是用户 prompt 正文', name: '模板名' });
  cap.log('no.such.event', { whatever: 1 });
  cap.log('store.snapshot.fail', { reason: 'http-fail', latencyMs: 12, path: 'C:\\Users\\someone\\secret' });
  cap.log('store.persist.fail', { route: 'usage.bump', errorHash: 'C:\\Users\\someone\\secret.txt' });
  cap.log('app.boot', { lang: 'zh', long: 'y'.repeat(200) });
  await drain(cap, home, 'store.persist.fail');
  lines = logLines(home);
  const panelOpen = lines.find((l) => l.event === 'panel.open');
  assert(!!panelOpen, 'panel.open 落盘');
  eq(Object.keys(panelOpen.fields).sort(), ['mode', 'rows'], '未声明字段（body/name）被丢弃');
  assert(!lines.some((l) => l.event === 'no.such.event'), '未声明事件整条丢弃');
  const snapshotFail = lines.find((l) => l.event === 'store.snapshot.fail');
  eq(Object.keys(snapshotFail.fields).sort(), ['latencyMs', 'reason'], 'snapshot.fail 只留声明字段');
  const persistFail = lines.find((l) => l.event === 'store.persist.fail');
  assert(/^[0-9a-f]{8}$/.test(String(persistFail.fields.errorHash)), 'errorHash 被净化为 8 位十六进制（原文不落盘）');
  const rawFile = fs.readFileSync(logFileOf(home), 'utf8');
  assert(!rawFile.includes('用户 prompt 正文'), '文件里查不到用户 prompt 正文');
  assert(!rawFile.includes('模板名'), '文件里查不到模板名称');
  assert(!rawFile.includes('C:\\Users\\someone'), '文件里查不到路径原文');

  const longBoot = lines.filter((l) => l.event === 'app.boot').pop();
  eq(Object.keys(longBoot.fields).sort(), ['lang'], '未声明长字段被丢弃；声明字段原样');
  const stats = cap.stats();
  assert(stats.droppedFields >= 4, `未声明字段计数在涨（实际 ${stats.droppedFields}）`);
  assert(stats.undeclared === 1, `未声明事件计数为 1（实际 ${stats.undeclared}）`);

  /* ── 5) 具名规则命中：值换成规则名 ── */
  cap.log('host.bridge.reject', { reason: 'ghp_abcdefgh12345678' });
  await drain(cap, home, 'host.bridge.reject');
  const reject = logLines(home).filter((l) => l.event === 'host.bridge.reject').pop();
  eq(reject.fields.reason, 'R_TOKEN', '令牌形状命中 R_TOKEN，只记规则名');

  /* ── 6) 开关语义：关只停 info 与 debug ── */
  const home2 = path.join(TMP, 'home-switch');
  const cap2 = await mod.createLogCapability({ env: { DSH_HOME: home2 } });
  cap2.log('app.boot', { hasReact: true, lang: 'zh', entryCount: 5 });
  cap2.log('store.snapshot.fail', { reason: 'http-fail', latencyMs: 1 });
  await drain(cap2, home2, 'store.snapshot.fail');
  eq(eventsOf(home2).filter((e) => e === 'app.boot').length, 0, '开关关：info 不落盘');
  eq(eventsOf(home2).filter((e) => e === 'store.snapshot.fail').length, 1, '开关关：warn 仍落盘');
  await cap2.runPhone(cap2.phoneNames.logSetSwitch, { enabled: true, sampleRate: 1 });
  cap2.log('app.boot', { hasReact: true, lang: 'zh', entryCount: 5 });
  await drain(cap2, home2, 'app.boot');
  eq(eventsOf(home2).filter((e) => e === 'app.boot').length, 1, '开关开：info 落盘');
  const switchFile = path.join(home2, 'logs', 'log-switch-dsh-prompt.json');
  assert(fs.existsSync(switchFile), '开关文件落在 <home>/logs/log-switch-dsh-prompt.json');
  eq(readJson(switchFile), { enabled: true, sampleRate: 1 }, '开关文件内容为 { enabled, sampleRate }');
  const getSwitch = await cap2.runPhone(cap2.phoneNames.logGetSwitch, {});
  eq(getSwitch.ok && getSwitch.value.enabled, true, '电话 logGetSwitch 回 ok + enabled');
  assert(eventsOf(home2).includes('host.log.switch.set'), '宿主记了 host.log.switch.set');
  assert(!eventsOf(home2).includes('log.persist.fail'), '首次安装不产生假的 log.persist.fail 告警');

  /* ── 7) 清单不可用 → 失败关闭（字段全丢，事件名与级别仍在） ── */
  const home3 = path.join(TMP, 'home-badmanifest');
  const bad = await mod.createLogCapability({ env: { DSH_HOME: home3 }, manifest: { version: 2, pluginId: 'dsh-prompt', counts: {}, events: {} } });
  assert(bad.manifestOk === false, '坏清单被识别（manifestOk=false）');
  await bad.runPhone(bad.phoneNames.logSetSwitch, { enabled: true, sampleRate: 1 });
  bad.log('app.boot', { hasReact: true, lang: 'zh' });
  await drain(bad, home3, 'app.boot');
  const badLines = logLines(home3);
  const badBoot = badLines.find((l) => l.event === 'app.boot');
  assert(!!badBoot, '失败关闭下事件名仍落盘');
  eq(badBoot.fields, {}, '失败关闭下字段全丢');
  const badManifestFail = badLines.find((l) => l.event === 'host.log.manifest.fail');
  assert(!!badManifestFail, '清单故障事件仍能落盘（硬编码字段例外）');
  eq(badManifestFail.fields.reason, 'shape-fail', '清单故障原因码落盘');

  /* ── 8) 落盘降级：主目录写不进 → os.tmpdir()/dsh-prompt ── */
  const fallbackDir = path.join(TMP, 'fallback');
  const home4 = path.join(TMP, 'home-degrade');
  const denyFs = {
    mkdir: async (dir) => {
      if (String(dir).startsWith(home4)) throw new Error('EPERM: denied');
      fs.mkdirSync(dir, { recursive: true });
    },
    readFile: async (file) => {
      if (String(file).startsWith(home4)) throw new Error('EPERM: denied');
      return fs.readFileSync(file, 'utf8');
    },
    readdir: async (dir) => fs.readdirSync(dir),
    unlink: async (file) => {
      if (String(file).startsWith(home4)) throw new Error('EPERM: denied');
      fs.unlinkSync(file);
    },
    writeFile: async (file, text) => {
      if (String(file).startsWith(home4)) throw new Error('EPERM: denied');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text, 'utf8');
    },
  };
  const cap4 = await mod.createLogCapability({
    env: { DSH_HOME: home4 },
    sink: mod.createLogSink({ env: { DSH_HOME: home4 }, fallbackDir, fsImpl: denyFs }),
  });
  assert(cap4.sink.isDegraded() === true, '主目录写不进 → 标记为降级');
  cap4.log('store.snapshot.fail', { reason: 'http-fail', latencyMs: 2 });
  const fbFile = path.join(fallbackDir, 'dsh-prompt', new Date().toISOString().slice(0, 10) + '.log');
  const t0 = Date.now();
  while (Date.now() - t0 < 3000) {
    await cap4.store.flushNow().catch(() => undefined);
    if (fs.existsSync(fbFile) && fs.readFileSync(fbFile, 'utf8').includes('store.snapshot.fail')) break;
    await sleep(50);
  }
  assert(fs.existsSync(fbFile), '降级后日志落在 os.tmpdir()/dsh-prompt/…（本次用注入的 fallbackDir 代替）');
  assert(fs.existsSync(fbFile) && fs.readFileSync(fbFile, 'utf8').includes('store.snapshot.fail'), '降级文件里能看到那条事件');

  /* ── 9) 导出与清空电话的最小形状 ── */
  const unknown = await cap2.runPhone('dsh-prompt.noSuchPhone', {});
  eq(unknown.ok, false, '未知电话回 ok:false');
  const exported = await cap2.runPhone(cap2.phoneNames.logExport, {});
  assert(exported.ok && typeof exported.value.text === 'string' && exported.value.text.includes('store.snapshot.fail'), 'logExport 能拿到当天日志原文');
  const cleared = await cap2.runPhone(cap2.phoneNames.logClear, { date: 'all' });
  assert(cleared.ok && cleared.value.removed >= 1, `logClear 报出删除文件数（实际 ${cleared.value.removed}）`);

  /* ── 10) 结构规则：对外导出不超过五个 + 路由常量不漂移 ── */
  const hostExports = Object.keys(mod).filter((k) => k !== 'default');
  assert(hostExports.length <= 5, `宿主日志能力对外导出 ${hostExports.length} 个 ≤ 5（${hostExports.join(', ')}）`);
  const clientSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'log', 'index.ts'), 'utf8');
  const clientRuntimeExports = [...clientSrc.matchAll(/^export (?:function|const) (\w+)/gm)].map((m) => m[1]);
  assert(clientRuntimeExports.length <= 5, `客户端日志能力对外导出 ${clientRuntimeExports.length} 个 ≤ 5（${clientRuntimeExports.join(', ')}）`);
  const hostSrc = fs.readFileSync(path.join(ROOT, 'lib', 'index.js'), 'utf8');
  assert(hostSrc.includes(mod.LOG_ROUTE_PATH), `lib/index.js 里的日志路由与 LOG_ROUTE_PATH 一致（${mod.LOG_ROUTE_PATH}）`);
  const bundle = fs.readFileSync(path.join(ROOT, 'lib', 'client.js'), 'utf8');
  const inlined = extractInlinedManifest(bundle);
  assert(!!inlined, '客户端 bundle 里找得到内联的事件清单');
  eq(inlined && JSON.stringify(inlined) === JSON.stringify(manifest), true, '客户端内联的清单与仓库清单逐字段一致（同一份表）');

  /* ── 11) 全仓不再有第二个出口 + 调用点与清单逐条对得上 ── */
  const sourceFiles = [];
  for (const dir of [path.join(ROOT, 'src'), path.join(ROOT, 'lib')]) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
      if (!entry.isFile()) continue;
      if (!/\.(ts|js)$/.test(entry.name)) continue;
      if (entry.name === 'client.js' || entry.name.endsWith('.d.ts')) continue; // 构建产物在下面单独查
      sourceFiles.push(path.join(entry.parentPath || entry.path, entry.name));
    }
  }
  const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/([^:])\/\/.*$/gm, '$1');
  const consoleHits = [];
  for (const file of sourceFiles) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/console\.(?:log|warn|error|info|debug)/g)) {
      consoleHits.push(path.relative(ROOT, file) + ':' + m.index);
    }
  }
  assert(consoleHits.length === 0, `源码里 console.* 已清零（残留：${consoleHits.join(', ') || '无'}）`);
  const liveCode = sourceFiles.map((f) => stripComments(fs.readFileSync(f, 'utf8'))).join('\n');
  assert(!/reportDiag\s*\(|client-diag\.jsonl'/.test(liveCode), '临时诊断上报（reportDiag / client-diag.jsonl）已删除');
  assert(fs.readFileSync(path.join(ROOT, 'lib', 'index.js'), 'utf8').includes('removed-endpoint'), '宿主 /_dsh/dsh-prompt/debug 已改为 404（不再是诊断落盘分支）');

  const PACKAGE_INTERNAL = ['host.start', 'host.call.fail', 'log.persist.fail', 'log.export.fail', 'log.forward.summary', 'log.switch.watchdog'];
  /** 已声明但尚未接调用点的事件：只在票与票之间短暂存在，接上就删（见对应票）。 */
  const PENDING_CALL_SITES = []; // 配置页三入口（#51）已接上，此清单为空
  const CALL_RE = /\b(?:log\w*|\w*Log)(?:\?\.)?\(\s*['"]([a-zA-Z0-9._]+)['"]\s*,\s*\{([^}]*)\}/g;
  const seen = new Map(); // 事件名 → [字段名]
  const scanTargets = [...sourceFiles, path.join(ROOT, 'lib', 'client.js')];
  for (const file of scanTargets) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(CALL_RE)) {
      const fields = [...m[2].matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*:/g)].map((x) => x[1]);
      const prior = seen.get(m[1]) || [];
      seen.set(m[1], [...new Set([...prior, ...fields])]);
    }
  }
  seen.set('host.log.manifest.fail', ['reason', 'errorHash']); // 常量名调用，静态扫不到实参，按其硬编码字段计

  const unknownEvents = [...seen.keys()].filter((n) => !parsed.events[n]);
  assert(unknownEvents.length === 0, `调用点用的都是清单里声明的事件（未声明：${unknownEvents.join(', ') || '无'}）`);
  let fieldViolations = 0;
  for (const [event, fields] of seen) {
    if (!parsed.events[event]) continue;
    const res = dshLogHost.checkEventFields(parsed, event, fields);
    if (!res.ok) {
      fieldViolations += 1;
      fail(`调用点字段超出白名单：${event} → ${res.unknownFields.join(', ')}`);
    }
  }
  assert(fieldViolations === 0, `每个调用点的字段都在白名单内（${seen.size} 个事件有调用点）`);
  const unused = names.filter((n) => !seen.has(n) && !PACKAGE_INTERNAL.includes(n) && !PENDING_CALL_SITES.includes(n));
  assert(unused.length === 0, `清单里没有"声明了却没人打"的事件（${unused.join(', ') || '无'}）`);

  /* ── 12) 客户端半端到端：用 ModuleLoader 壳加载构建产物，走一遍 apply() ── */
  let captured = null;
  const prevWindow = globalThis.window;
  globalThis.window = { __ModuleLoader__: { load(def) { captured = def; } } };
  globalThis.localStorage = { _v: {}, getItem(k) { return this._v[k] ?? null; }, setItem(k, v) { this._v[k] = String(v); } };
  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({ ok: false }) });
  require(path.join(ROOT, 'lib', 'client.js'));
  assert(!!captured && captured.id === 'dsh-prompt', '构建产物经 ModuleLoader 壳可加载（id = dsh-prompt）');
  const clientMod = captured.factory((name) => {
    if (name === 'react') return require('react');
    throw new Error('unexpected require: ' + name);
  });
  assert(typeof clientMod.apply === 'function', '客户端工厂导出 apply()');
  const effects = [];
  clientMod.apply({ slots: { inject: () => undefined, register: () => undefined }, effect: (fn) => { effects.push(fn); return () => undefined; }, inputTriggers: { registerSource: () => undefined } });
  const slot = globalThis.__dshPromptLog;
  assert(!!slot, 'apply() 把日志能力装进 globalThis.__dshPromptLog（调用点从这里取）');
  slot.log('app.boot', { hasReact: true, lang: 'zh', entryCount: 5 });
  slot.log('app.boot', { hasReact: true, lang: 'zh', entryCount: 5, name: '模板名', body: '正文' });
  slot.log('not.declared.event', { x: 1 });
  const cst = slot.status();
  eq(cst.droppedFields, 2, '客户端闸门丢掉未声明字段（模板名与正文没进队列）');
  eq(cst.undeclared, 1, '客户端闸门丢掉未声明事件');
  eq(cst.manifestOk, true, '客户端清单可用（构建期内联，形状自检通过）');

  // 三个入口的客户端半（#51）：开关 / 导出 / 清空 各发一次电话，回参能透到调用方。
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    const value = body.name.endsWith('.logExport') ? { ok: true, fileName: '2026-09-12.log', bytes: 12, fallback: true, text: '{"event":"a"}\n' }
      : body.name.endsWith('.logClear') ? { ok: true, removed: 3 }
        : body.name.endsWith('.logSetSwitch') ? { ok: true, enabled: true }
          : body.name.endsWith('.logGetSwitch') ? { ok: true, enabled: false, sampleRate: 1 }
            : { ok: true };
    return { ok: true, status: 200, json: async () => ({ ok: true, value }) };
  };
  const sw = await slot.setSwitch(true);
  eq(sw.ok && sw.enabled, true, '开关入口：写入成功并回 enabled');
  const ex = await slot.exportLog();
  eq(ex.ok && ex.bytes === 12 && ex.text.indexOf('event') >= 0, true, '导出入口：拿到正文与长度');
  const cl = await slot.clearLog('all');
  eq(cl.ok && cl.removed === 3, true, '清空入口：回报删掉几个文件');
  eq(calls.map((c) => c.name).join(' , '), 'dsh-prompt.logSetSwitch , dsh-prompt.logExport , dsh-prompt.logClear', '三个入口都经同一条日志桥、用本插件的电话名');
  const swFail = await (async () => {
    globalThis.fetch = async () => { throw new Error('host-down'); };
    return slot.setSwitch(false);
  })();
  eq(swFail.ok, false, '开关写失败回 ok:false（界面据此保持旧值并提示）');
  globalThis.window = prevWindow;

  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* 清理失败不影响结论 */ }
  console.log(failures === 0 ? '=== Test log PASS ===' : `=== Test log FAIL（${failures} 项）===`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.log('HARNESS-ERROR: ' + (e && e.stack ? e.stack.split('\n').slice(0, 8).join(' | ') : String(e)));
  process.exit(3);
});
