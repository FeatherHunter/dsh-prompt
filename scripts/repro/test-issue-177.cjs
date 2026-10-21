'use strict';
/**
 * dsh-prompt #177 回归：更新日志桥不再把更新包**目录内**的正常事件误报成
 * `update.route.fail`（reason=unknown-event，warn，每进程 1 条）。
 *
 * 现象（#177）：每个 DSH 宿主进程启动后 `~/.dsh/logs/dsh-prompt/YYYY-MM-DD.log` 都会多一行
 * warn `update.route.fail { route:"/_dsh/dsh-prompt/update", reason:"unknown-event",
 * errorHash:"a7f3cf72" }` —— a7f3cf72 是 `update.status.changed` 的 djb2 指纹；真实更新链路
 * 全 ok:true。根因：桥只镜像三条事件（host.call / host.call.fail / update.install.exec），
 * default 分支把「更新包目录内的正常事件」和「真目录外漂移」folded 成同一条自报。
 *
 * 本票的修复口径（#177 Agent Brief）：
 *   A) 更新包**目录内**的未镜像事件：静默丢弃（不转交、不自报、不落 update.route.fail）；
 *   C) 目录在构建期从**本次内联的更新包版本**派生，作为检入快照随产物冻结；构建期门禁检查
 *      「快照 == node_modules 里的包目录」+「桥源码镜像事件名都在目录里」，不满足即 fail-closed；
 *   B) 真目录外事件：落一条 `update.bridge.unknown-event`（info/resident，只有 errorHash），每进程一次。
 *
 * 分组：
 *   A) 静态接线：目录快照 / 桥源码 / 清单 / 安全网 / 构建门禁 / 构建起点快照刷新 / npm 接线逐项对得上；
 *   B) 构建产物级（假更新包注入，不碰网络与真文件系统）：镜像三条行为不变、目录内事件零误报、
 *      目录外事件恰好一条 info 自报且只落一次、host.call.fail 节流仍生效；
 *   C) 构建期门禁自测：正常通过；「快照缺一条镜像名」「提取不到镜像名」「版本过期」「目录多一条」
 *      都必须给出人话成因并以非 0 退出（绝不允许恒绿）；另验快照生成脚本离线可用（构建起点靠它刷新）。
 *
 * 跑法：node scripts/repro/test-issue-177.cjs（exit 0 = 全绿）。
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..', '..');
const TMP = path.join(__dirname, '.tmp-177');
const readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readJson = (rel) => JSON.parse(readSrc(rel));
const MANIFEST_PATH = path.join(ROOT, 'event-list.dsh-prompt.json');
const CATALOG_PATH = path.join(ROOT, 'src/update/host/update-event-catalog.json');
const BRIDGE_PATH = path.join(ROOT, 'src/update/host/bridge-log.ts');
const GATE_PATH = path.join(ROOT, 'scripts/update/event-catalog-gate.mjs');

let failures = 0;
function fail(msg) { failures++; console.log('FAIL: ' + msg); }
function ok(msg) { console.log(' ok: ' + msg); }
function eq(actual, want, msg) {
  if (JSON.stringify(actual) !== JSON.stringify(want)) {
    fail(msg + ' → 实际 ' + JSON.stringify(actual) + '，期望 ' + JSON.stringify(want));
  } else ok(msg);
}
function assert(cond, msg) { if (!cond) fail(msg); else ok(msg); }

/** 与 src/update/host/error-fingerprint.ts 逐字同形的 djb2（回归端独立实现，不 import 被测代码）。 */
function hash8(value) {
  const text = String(value ?? '');
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return ('0000000' + h.toString(16)).slice(-8);
}

/** 造一个「假更新包 + 记录型日志能力」的宿主能力；返回能力与两个观测口。 */
async function buildHarness(updateMod, { relogFloorMs } = {}) {
  const calls = [];
  const logCap = { log(event, fields) { calls.push({ event, fields: fields || {} }); return undefined; } };
  let logCtx = null;
  const phoneNames = {
    updateStatus: 'prompt.updateStatus', updateCheck: 'prompt.updateCheck',
    updateInstall: 'prompt.updateInstall', updateChangelog: 'prompt.updateChangelog',
  };
  const fakeHostUpdate = {
    createHostUpdate(deps) {
      if (!deps || typeof deps.logCtx === 'undefined') fail('B) 宿主应把 bridgeLog 交给更新包（logCtx 缺席）');
      logCtx = deps.logCtx;
      const handlers = {};
      for (const phone of Object.values(phoneNames)) {
        handlers[phone] = async () => ({ ok: true, snapshot: null, manual: null, receipt: null });
      }
      return { phoneNames: { ...phoneNames }, handlers };
    },
  };
  const cap = await updateMod.createUpdateCapability({
    hostUpdate: fakeHostUpdate,
    logReady: Promise.resolve(logCap),
    ...(relogFloorMs === undefined ? {} : { relogFloorMs }),
  });
  // bridge 的能力槽经 Promise.then 落地：放一个宏任务，确保 logReady 已生效。
  await new Promise((r) => setImmediate(r));
  return { cap, calls, fire: (level, event, fields) => logCtx.fire(level, event, fields) };
}

const emitted = (calls, name) => calls.filter((c) => c.event === name);

// ═══ A) 静态接线 ═══
function groupA() {
  const pkg = readJson('package.json');
  const pin = pkg.devDependencies['dsh-plugin-update'];
  const manifest = readJson('event-list.dsh-prompt.json');
  const bridgeSrc = readSrc('src/update/host/bridge-log.ts');
  const safeSrc = readSrc('src/update/host/safe-values.ts');
  const buildHostSrc = readSrc('scripts/update/build-host.mjs');
  const hostTsconfig = readJson('tsconfig.host.json');

  // A1) 目录快照：存在、版本与内联包一致、事件表与 node_modules 里的包目录逐项一致。
  assert(fs.existsSync(CATALOG_PATH), 'A) 目录快照 src/update/host/update-event-catalog.json 存在（构建期生成、检入）');
  const catalog = fs.existsSync(CATALOG_PATH) ? JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8')) : null;
  if (catalog) {
    eq(catalog.updatePackage, 'dsh-plugin-update', 'A) 目录快照标注的来源包');
    eq(catalog.updateVersion, pin, 'A) 目录快照版本 == devDependencies 钉版（随产物冻结）');
    const upstream = readJson('node_modules/dsh-plugin-update/event-list.update.json');
    const known = Object.keys(upstream.events).sort();
    eq(catalog.events, known, 'A) 目录快照与 node_modules 里的更新包事件目录逐项一致');
    for (const mirror of ['host.call', 'host.call.fail', 'update.install.exec']) {
      assert(catalog.events.includes(mirror), 'A) 镜像事件 ' + mirror + ' 在目录快照内');
    }
    for (const knownEvent of ['update.status.changed', 'update.install.verify', 'update.poll', 'update.queue.transition', 'update.log.degraded']) {
      assert(catalog.events.includes(knownEvent), 'A) 已观测到的正常事件 ' + knownEvent + ' 在目录快照内（#177 的误报源）');
    }
  }
  assert(hostTsconfig.compilerOptions.resolveJsonModule === true, 'A) tsconfig.host.json 开启 resolveJsonModule（桥要 import 目录快照）');
  assert(bridgeSrc.includes("from './update-event-catalog.json'"), 'A) 桥从目录快照取已知事件集');
  assert(bridgeSrc.includes('update.bridge.unknown-event'), 'A) 桥有新的目录外事件自报出口 update.bridge.unknown-event');
  assert(!/reason:\s*['"]unknown-event['"]/.test(bridgeSrc), 'A) 桥不再把 unknown-event 当 update.route.fail 的 reason');
  assert(!bridgeSrc.includes('UPDATE_ROUTE_FAMILY'), 'A) 桥不再给 update.route.fail 填 route 族（那条事件只归真实路由失败）');

  // A2) 清单：新事件 info/resident/errorHash；update.route.fail 回归「真实路由失败」语义。
  const declared = manifest.events['update.bridge.unknown-event'];
  assert(!!declared, 'A) 清单声明 update.bridge.unknown-event');
  if (declared) {
    eq(declared.level, 'info', 'A) 新事件级别 info（不绕过日志开关）');
    eq(declared.kind, 'resident', 'A) 新事件 kind resident（开关关闭时宿主日志能力也收）');
    eq(declared.fields, ['errorHash'], 'A) 新事件只落 errorHash（事件名本身不落盘）');
    assert(Array.isArray(declared.codes) && declared.codes.includes('H_ERR'), 'A) 新事件声明 H_ERR（8 位指纹）');
  }
  assert(!manifest.events['update.route.fail'].guard.includes('unknown-event'),
    'A) update.route.fail 的 guard 不再把 unknown-event 列进 reason 枚举（枚举在 safe-values.ts）');
  assert(!/['"]unknown-event['"]/.test(safeSrc), 'A) safe-values.ts 的 SAFE_REASONS 不再有 unknown-event（真路由失败才归 route.fail）');

  // A3) 构建期门禁接线：build-host 在打包前调用纯门禁，门禁文件在。
  assert(fs.existsSync(GATE_PATH), 'A) 构建期门禁模块 scripts/update/event-catalog-gate.mjs 存在');
  assert(buildHostSrc.includes('event-catalog-gate.mjs'), 'A) build-host.mjs 引用门禁模块');
  assert(buildHostSrc.includes('catalogProblem({'), 'A) build-host.mjs 调用目录快照/镜像名门禁');
  const gateCallAt = buildHostSrc.indexOf('catalogProblem({');
  const buildAt = buildHostSrc.indexOf('await build(');
  assert(gateCallAt >= 0 && buildAt >= 0 && gateCallAt < buildAt, 'A) 门禁在打包之前执行（失败即拒建）');

  // A3b) 快照刷新住在构建起点（ensure-latest → gen），门禁保持只读 —— 自动跟最新（#98）不得退化成人工步骤。
  const ensureSrc = readSrc('scripts/update/ensure-latest.mjs');
  assert(fs.existsSync(path.join(ROOT, 'scripts/update/gen-event-catalog.mjs')), 'A) 快照生成脚本 scripts/update/gen-event-catalog.mjs 存在');
  assert(ensureSrc.includes('gen-event-catalog.mjs'), 'A) 构建起点（ensure-latest）会自动刷新事件目录快照');
  assert(/process\.exit\(1\)/.test(ensureSrc), 'A) 快照刷新失败时不硬建（ensure 以非 0 退出）');
  const libSyncSrc = readSrc('scripts/check-lib-sync.mjs');
  assert(libSyncSrc.includes('src/update/host/update-event-catalog.json'), 'A) check-lib-sync 把事件目录快照纳入「重建一致」判定（忘提交会红）');

  // A4) npm 接线：生成脚本、回归入口、check 链。
  const s = pkg.scripts || {};
  eq(s['gen:update-catalog'], 'node scripts/update/gen-event-catalog.mjs', 'A) package.json 有 gen:update-catalog 生成脚本');
  eq(s['check:update-catalog'], 'node scripts/update/event-catalog-gate.mjs', 'A) package.json 有 check:update-catalog（门禁的只读自查口，不是幽灵脚本）');
  eq(s['test:issue-177'], 'node scripts/repro/test-issue-177.cjs', 'A) package.json 有 test:issue-177');
  eq(s['check:issue-177'], 'node scripts/repro/test-issue-177.cjs', 'A) package.json 有 check:issue-177');
  assert(String(s.check || '').includes('check:issue-177'), 'A) npm run check 链挂着 check:issue-177（门禁不游离在链外）');
  assert(String(s.check || '').includes('check:update-catalog'), 'A) npm run check 链挂着 check:update-catalog');
  const chain = String(s.check || '');
  assert(chain.indexOf('check:update-catalog') >= 0
    && chain.indexOf('check:update-catalog') < chain.indexOf('check:lib-sync'),
  'A) check:update-catalog 排在 check:lib-sync 之前（重建前先验提交的快照，否则先被构建刷新就失去意义）');

  // A5) 宿主侧真实失败通道没被误伤：lib/index.js 仍发 update.route.fail（check-expired / 降级等）。
  const indexSrc = readSrc('lib/index.js');
  assert(indexSrc.includes('"update.route.fail"'), 'A) lib/index.js 仍保留真实 update.route.fail 发射点');
  assert(indexSrc.includes('check-expired') || indexSrc.includes('capability-build-fail'), 'A) 真实失败 reason 枚举仍在宿主侧');
}

// ═══ B) 构建产物级（假更新包注入）═══
async function groupB() {
  const updateMod = await import(pathToFileURL(path.join(ROOT, 'lib', 'update.js')).href);

  // B1) 复现面：先镜像 host.call，再喂 #177 真机上出现的四个目录内正常事件 + log.degraded。
  const h1 = await buildHarness(updateMod, { relogFloorMs: 0 });
  if (!h1.cap || h1.cap.ok !== true) fail('B) 假包注入后能力应 ok:true，实为 ' + JSON.stringify(h1.cap));
  h1.fire('info', 'host.call', { method: 'prompt.updateStatus', latencyMs: 3, ok: true, kind: 'update-status', pluginId: 'dsh-prompt' });
  eq(emitted(h1.calls, 'host.call').length, 1, 'B) 镜像事件 host.call 照旧转交');
  const before = h1.calls.length;
  for (const knownEvent of ['update.status.changed', 'update.install.verify', 'update.poll', 'update.queue.transition', 'update.log.degraded']) {
    h1.fire('info', knownEvent, { status: 'idle', via: 'poll' });
  }
  eq(h1.calls.length, before, 'B) 目录内未镜像事件零落盘（不再产生任何 warn / 自报行）');
  eq(emitted(h1.calls, 'update.route.fail').length, 0, 'B) 不再把正常事件报成 update.route.fail（#177 的核心断言）');

  // B2) 目录外事件：恰好一条 update.bridge.unknown-event，哈希是事件名的 djb2，第二次不再落。
  h1.fire('info', 'update.foo.new', { anything: 'ignored' });
  const unknownCalls = emitted(h1.calls, 'update.bridge.unknown-event');
  eq(unknownCalls.length, 1, 'B) 目录外事件恰好一条 info 自报');
  if (unknownCalls[0]) {
    eq(unknownCalls[0].fields, { errorHash: hash8('update.foo.new') }, 'B) 自报只带事件名的 8 位指纹（不是字段/原文）');
    assert(/^[0-9a-f]{8}$/.test(String(unknownCalls[0].fields.errorHash)), 'B) 指纹是 8 位小写十六进制');
  }
  h1.fire('info', 'update.bar.new2', {});
  eq(emitted(h1.calls, 'update.bridge.unknown-event').length, 1, 'B) 同进程第二个目录外事件不再落（每进程一次）');

  // B3) 另起一个进程语义的桥：目录外自报不依赖「先见过镜像事件」，且镜像三条行为不变。
  const h2 = await buildHarness(updateMod, { relogFloorMs: 0 });
  h2.fire('info', 'update.unknown.first', {});
  eq(emitted(h2.calls, 'update.bridge.unknown-event').length, 1, 'B) 未见过任何镜像事件时目录外自报同样只一条');
  h2.fire('warn', 'update.install.exec', { route: 'cli-process', ok: true, exitCode: 0, durationMs: 9, pluginId: 'dsh-prompt' });
  eq(emitted(h2.calls, 'update.install.exec').length, 1, 'B) 镜像事件 update.install.exec 照旧转交');
  eq(emitted(h2.calls, 'update.route.fail').length, 0, 'B) 镜像分支不产生 update.route.fail');

  // B4) host.call.fail 节流不变：首条必落、同 (method,kind) 同状态不重复、换状态再落。
  const h3 = await buildHarness(updateMod, { relogFloorMs: 60000 });
  h3.fire('warn', 'host.call.fail', { method: 'prompt.updateCheck', kind: 'update-check', errorHash: 'boom', pluginId: 'dsh-prompt' });
  const fails1 = emitted(h3.calls, 'host.call.fail');
  eq(fails1.length, 1, 'B) 电话失败首条必落');
  if (fails1[0]) eq(fails1[0].fields.errorHash, hash8('boom'), 'B) 失败成因落 8 位指纹（原文不落）');
  h3.fire('warn', 'host.call.fail', { method: 'prompt.updateCheck', kind: 'update-check', errorHash: 'boom2', pluginId: 'dsh-prompt' });
  eq(emitted(h3.calls, 'host.call.fail').length, 1, 'B) 同一 (method,kind) 状态重复失败不刷行（节流仍在）');
  h3.fire('warn', 'host.call.fail', { method: 'prompt.updateInstall', kind: 'install-failed', errorHash: 'boom3', pluginId: 'dsh-prompt' });
  eq(emitted(h3.calls, 'host.call.fail').length, 2, 'B) 新状态（新 method/kind）照旧落一条');

  // B5) 构建产物已把目录快照内联进去（否则运行期已知集为空、修复无从谈起）。
  // 断言目录快照自身的生成标记（gen-event-catalog.mjs），而不是任何更新包里也出现的字符串 ——
  // update.status.changed 这类事件名在包代码里本来就有，用它当「快照被内联」的证据会恒绿。
  const built = readSrc('lib/update.js');
  assert(built.includes('gen-event-catalog.mjs'), 'B) lib/update.js 内联了目录快照（生成标记 gen-event-catalog.mjs 在产物里）');
  assert(built.includes('update.bridge.unknown-event'), 'B) lib/update.js 含新的自报出口');
  assert(!/reason:\s*["']unknown-event["']/.test(built), 'B) lib/update.js 里不再有 route.fail/unknown-event');
}

// ═══ C) 构建期门禁自测（must be able to go red）═══
async function groupC() {
  const gate = await import(pathToFileURL(GATE_PATH).href);
  const pin = readJson('package.json').devDependencies['dsh-plugin-update'];
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/dsh-plugin-update/event-list.update.json'), 'utf8'));
  const bridgeSource = fs.readFileSync(BRIDGE_PATH, 'utf8');
  const runGate = (over) => gate.catalogProblem({
    catalog, updateManifest: manifest, bridgeSource, inlinedVersion: pin, ...over,
  });

  eq(runGate({}), null, 'C) 正常输入：目录快照 + 镜像名门禁通过');
  const missingMirror = runGate({ catalog: { ...catalog, events: catalog.events.filter((n) => n !== 'update.install.exec') } });
  assert(typeof missingMirror === 'string' && missingMirror.includes('update.install.exec'),
    'C) 快照缺一条镜像名 → 报出名字（实为 ' + JSON.stringify(missingMirror) + '）');
  const noCases = runGate({ bridgeSource: '// 镜像分支被删了\nexport function fire() {}\n' });
  assert(typeof noCases === 'string' && noCases.length > 0, 'C) 从桥源码提取不到镜像名 → fail-closed 拒绝（实为 ' + JSON.stringify(noCases) + '）');
  const stale = runGate({ catalog: { ...catalog, updateVersion: '0.0.0' } });
  assert(typeof stale === 'string' && stale.includes('0.0.0'), 'C) 快照版本与内联版本不一致 → 报版本（实为 ' + JSON.stringify(stale) + '）');
  const extra = runGate({ catalog: { ...catalog, events: [...catalog.events, 'update.future.event'].sort() } });
  assert(typeof extra === 'string' && extra.includes('update.future.event'),
    'C) 快照比包目录多一条 → 报出多余项（实为 ' + JSON.stringify(extra) + '）');
  const missingManifest = runGate({ updateManifest: {} });
  assert(typeof missingManifest === 'string' && missingManifest.length > 0, 'C) 读不出包事件目录 → fail-closed（实为 ' + JSON.stringify(missingManifest) + '）');

  // CLI 口径：模拟输入必须让进程非 0 退出并打印人话（这就是「构建期门禁有效」的可执行证据）。
  fs.mkdirSync(TMP, { recursive: true });
  const badCatalogFile = path.join(TMP, 'catalog-missing-mirror.json');
  fs.writeFileSync(badCatalogFile, JSON.stringify({ ...catalog, events: catalog.events.filter((n) => n !== 'host.call.fail') }, null, 2), 'utf8');
  const noCaseBridgeFile = path.join(TMP, 'bridge-no-cases.ts');
  fs.writeFileSync(noCaseBridgeFile, 'export function nothingHere(): void {}\n', 'utf8');
  const cli = (args) => spawnSync(process.execPath, [GATE_PATH, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });

  const happy = cli([]);
  eq(happy.status, 0, 'C) CLI 正常输入退出码 0');
  const bad1 = cli(['--catalog=' + badCatalogFile]);
  assert(bad1.status !== 0, 'C) CLI 模拟「快照缺镜像名」非 0 退出（实际 ' + bad1.status + '）');
  assert(String(bad1.stdout + bad1.stderr).includes('host.call.fail'), 'C) CLI 在成因里点名缺的镜像事件');
  const bad2 = cli(['--bridge=' + noCaseBridgeFile]);
  assert(bad2.status !== 0, 'C) CLI 模拟「提取不到镜像名」非 0 退出（实际 ' + bad2.status + '）');
  assert(String(bad2.stdout + bad2.stderr).trim().length > 0, 'C) CLI 失败时给出人话成因（不静默）');

  // 快照生成脚本离线可用：构建起点（ensure-latest）靠它刷新；输出点名快照路径与事件条数。
  const genRun = spawnSync(process.execPath, [path.join(ROOT, 'scripts/update/gen-event-catalog.mjs')], {
    cwd: ROOT, encoding: 'utf8', timeout: 60000,
  });
  eq(genRun.status, 0, 'C) 快照生成脚本离线可跑（exit 0）');
  assert(String(genRun.stdout).includes('update-event-catalog.json'), 'C) 生成脚本输出点名快照路径');
  assert(String(genRun.stdout).includes('事件'), 'C) 生成脚本输出事件条数');

  // 门禁提取/派生本身：镜像事件名从 switch case 标签派生，目录从 events 表派生。
  eq(gate.extractMirrorEvents(bridgeSource), ['host.call', 'host.call.fail', 'update.install.exec'], 'C) 镜像事件名从桥的 switch case 标签提取');
  eq(gate.deriveKnownEvents(manifest), Object.keys(manifest.events).sort(), 'C) 已知事件集从包目录的 events 表派生');
  eq(gate.extractMirrorEvents('// 没有 case\n'), [], 'C) 提取不到时返回空数组（调用方据此 fail-closed）');
}

(async () => {
  groupA();
  await groupB();
  await groupC();
  if (failures > 0) {
    console.log('\nRESULT: FAIL (' + failures + ')');
    process.exit(1);
  }
  console.log('\nRESULT: PASS');
})().catch((e) => {
  console.log('FAIL: 未捕获异常 ' + ((e && e.stack) || e));
  process.exit(1);
});
