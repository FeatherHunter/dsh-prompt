#!/usr/bin/env node
/**
 * 声明式 fixture 的自证脚本：纯 node、不起宿主、不动用户数据。
 *
 * 覆盖票 #187 的可离线验证面：
 * 1. 配方清单与解析（名字 / 显式路径 / 参数化占位符）；
 * 2. 配方校验（缺键、类型、未知键、枚举、上限）——负例逐条证明能红；
 * 3. 路径守卫（store 必须落在一次性 home 内，越界拒绝）；
 * 4. 重置语义（删除插件持久化数据、幂等、不碰无关文件）；
 * 5. 种子写入（store 文档形状 = storage-schema 契约、默认值合并、期望自洽）；
 * 6. 基线投影与 diff（current vs expected、嵌套路径、数组长度、格式化）；
 * 7. 故障注入（pollute / skip-seed / drop-store 都必然让基线不符）；
 * 8. HTTP 读回（用本机临时 http server 模拟宿主 `GET /_dsh/dsh-prompt/store`）；
 * 9. run tag 唯一性（同一毫秒 100 次不重复）。
 *
 * 运行：node scripts/real/harness/fixture/selftest.mjs
 * 退出码：0 = 全部通过；1 = 有失败（逐条列出）。
 */

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

import {
  CLEAN_GLOBAL,
  DEFAULT_DOMAIN,
  DEFAULT_FIXTURES_DIR,
  FAULT_MODES,
  FIXTURE_FORMAT_VERSION,
  FixtureError,
  STORE_FILE_NAME,
  STORE_RELATIVE_PATH,
  applyFixture,
  assertStorePathInsideHome,
  baselineFromSnapshot,
  baselineFromStorePath,
  captureBaselineFromOrigin,
  checkBaseline,
  diffBaseline,
  fixtureStorePath,
  formatDiffs,
  loadFixture,
  listFixtures,
  resolveFixture,
  validateFixture,
} from './index.mjs';
import { HOST_CONTRACT } from '../contract/host.mjs';
import { makeRunTag } from '../evidence.mjs';

let passCount = 0;
const failures = [];

function ok(condition, name, detail) {
  if (condition) {
    passCount += 1;
    return true;
  }
  failures.push({ name, detail });
  return false;
}

function eq(actual, expected, name) {
  const same = Object.is(actual, expected);
  return ok(same, name, same ? '' : '当前=' + JSON.stringify(actual) + '，期望=' + JSON.stringify(expected));
}

function deepEq(actual, expected, name) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  return ok(a === b, name, a === b ? '' : '当前=' + a + '，期望=' + b);
}

/** 期望调用抛 FixtureError，且 code / 文案片段命中。 */
function throwsFixture(fn, expected, name) {
  try {
    fn();
    return ok(false, name, '没有抛错（期望 code=' + expected.code + '）');
  } catch (error) {
    if (!(error instanceof FixtureError)) return ok(false, name, '抛出的不是 FixtureError：' + (error && error.stack ? error.stack : error));
    ok(error.code === expected.code, name + '（code）', '当前 code=' + error.code + '，期望=' + expected.code);
    if (expected.messageIncludes) {
      ok(String(error.message).includes(expected.messageIncludes), name + '（文案）', '文案=' + error.message);
    }
    return true;
  }
}

let sectionNo = 0;
function section(title) {
  sectionNo += 1;
  console.log('\n## ' + sectionNo + '. ' + title);
}

function tempRoot(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-fixture-' + label + '-'));
}

function newHome() {
  const home = tempRoot('home');
  fs.mkdirSync(path.join(home, 'storages'), { recursive: true });
  return home;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/* ────────────────────────────── 1. 配方清单 ────────────────────────────── */

section('配方清单与解析');
const fixtures = listFixtures();
ok(Array.isArray(fixtures) && fixtures.length >= 5, '仓库内置配方 ≥ 5 条', '实际 ' + fixtures.length + ' 条');
const names = fixtures.map((item) => item.name);
deepEq(names.slice().sort(), ['clean', 'remote-prefs', 'templates', 'trigger-click', 'trigger-hover', 'undo-group'], '内置配方名字齐全');
for (const item of fixtures) {
  ok(typeof item.path === 'string' && fs.existsSync(item.path), '配方路径存在：' + item.name, item.path);
}

const cleanRaw = loadFixture('clean');
eq(cleanRaw.formatVersion, FIXTURE_FORMAT_VERSION, 'clean 配方 formatVersion');
eq(cleanRaw.name, 'clean', 'clean 配方 name');

const byPath = loadFixture(path.join(DEFAULT_FIXTURES_DIR, 'templates.json'));
eq(byPath.name, 'templates', '显式路径也能加载配方');

throwsFixture(() => loadFixture('no-such-fixture'), { code: 'fixture-not-found' }, '未知配方名 → fixture-not-found');

for (const name of ['clean', 'templates', 'trigger-click', 'trigger-hover', 'remote-prefs', 'undo-group']) {
  const resolved = resolveFixture(loadFixture(name), { runTag: 'selftest-run' });
  validateFixture(resolved);
  passCount += 1;
}

const templatesRaw = loadFixture('templates');
const templatesResolved = resolveFixture(templatesRaw, { runTag: 'RT-1' });
deepEq(
  templatesResolved.seed.customs.map((item) => item.id),
  ['fx-RT-1-alpha', 'fx-RT-1-beta'],
  '参数化：seed.customs 的 id 全部替换',
);
eq(templatesResolved.seed.customs[0].name, '夹具模板 A（RT-1）', '参数化：嵌套字符串替换');
eq(templatesResolved.expect.pinned[0], 'fx-RT-1-alpha', '参数化：expect 同参数替换');
ok(!JSON.stringify(templatesResolved).includes('${'), '参数化后不残留占位符', JSON.stringify(templatesResolved).slice(0, 200));
ok(JSON.stringify(templatesRaw).includes('${runTag}'), 'resolveFixture 不改原配方（原始占位符还在）');

throwsFixture(
  () => resolveFixture({ ...templatesRaw, name: 'x-${missingParam}' }, { runTag: 'RT-1' }),
  { code: 'unknown-placeholder', messageIncludes: 'missingParam' },
  '未知占位符 → unknown-placeholder',
);
throwsFixture(() => resolveFixture(cleanRaw, null), { code: 'invalid-params' }, 'params 不是对象 → invalid-params');
throwsFixture(
  () => resolveFixture({ ...cleanRaw, name: 'x-${runTag}' }, {}),
  { code: 'unknown-placeholder' },
  'params 缺 runTag → unknown-placeholder',
);

/* ────────────────────────────── 2. 配方校验负例 ────────────────────────────── */

section('配方校验负例');
const validationCases = [
  ['缺少 name', (raw) => { delete raw.name; }],
  ['formatVersion 不支持', (raw) => { raw.formatVersion = 99; }],
  ['未知顶层键', (raw) => { raw.expct = {}; }],
  ['reset 非布尔', (raw) => { raw.reset = 'yes'; }],
  ['缺少 expect', (raw) => { delete raw.expect; }],
  ['expect 未知键', (raw) => { raw.expect.remoteColor = null; }],
  ['expect.remote 缺 density', (raw) => { delete raw.expect.remote.density; }],
  ['expect.remote.size 越界', (raw) => { raw.expect.remote.size = 11; }],
  ['expect.customs 不是数组', (raw) => { raw.expect.customs = {}; }],
  ['expect.customs 记录缺 name', (raw) => { delete raw.expect.customs[0].name; }],
  ['seed.global 未知键', (raw) => { raw.seed.global = { remoteMagic: true }; }],
  ['seed.global 类型不符', (raw) => { raw.seed.global = { hoverTrigger: 'no' }; }],
  ['seed.global 枚举不符', (raw) => { raw.seed.global = { remoteOrientation: 'diagonal' }; }],
  ['seed.customs 记录缺 body', (raw) => { delete raw.seed.customs[0].body; }],
  ['seed.customs id 重复', (raw) => { raw.seed.customs[1].id = raw.seed.customs[0].id; }],
  ['seed.customs createdAt 非法', (raw) => { raw.seed.customs[0].createdAt = -1; }],
  ['seed.pinned 超过 5 个', (raw) => { raw.seed.pinned = ['a', 'b', 'c', 'd', 'e', 'f']; }],
  ['seed.usage 计数非法', (raw) => { raw.seed.usage['fx-1'] = -2; }],
  ['seed 未知键', (raw) => { raw.seed.localStorage = {}; }],
];
for (const [label, mutate] of validationCases) {
  const raw = clone(templatesRaw);
  mutate(raw);
  throwsFixture(() => validateFixture(resolveFixture(raw, { runTag: 'RT-1' })), { code: 'invalid-recipe' }, label + ' → invalid-recipe');
}

const emptyExpectRejected = (() => {
  try {
    validateFixture({ ...cleanRaw, expect: {} });
    return false;
  } catch (error) {
    return error instanceof FixtureError && /expect/.test(error.message);
  }
})();
ok(emptyExpectRejected, '空 expect 被拒绝（声明不能为空）');

/* ────────────────────────────── 3. 路径守卫 ────────────────────────────── */

section('路径守卫（store 只能落在一次性 home 内）');
const home = newHome();
const storePath = fixtureStorePath(home);
eq(
  path.relative(home, storePath).split(path.sep).join('/'),
  'storages/dsh_prompt.json',
  'store 路径 = <home>/storages/dsh_prompt.json',
);
ok(assertStorePathInsideHome({ homeDir: home, storePath }).ok, 'home 内的 store 路径通过守卫');

const otherHome = newHome();
const outside = assertStorePathInsideHome({ homeDir: home, storePath: fixtureStorePath(otherHome) });
ok(!outside.ok && outside.problems.length > 0, '别的 home 的 store 路径被拒', JSON.stringify(outside));
ok(outside.problems.join(' ').includes('不在一次性 home'), '越界问题文案可读', outside.problems.join(' '));

const escapePath = path.join(home, '..', 'storages', 'dsh_prompt.json');
const escaped = assertStorePathInsideHome({ homeDir: home, storePath: escapePath });
ok(!escaped.ok, '.. 逃逸路径被拒', JSON.stringify(escaped));

const wrongName = assertStorePathInsideHome({ homeDir: home, storePath: path.join(home, 'storages', 'other.json') });
ok(!wrongName.ok, '非 dsh_prompt.json 的路径被拒', JSON.stringify(wrongName));

const relativeStore = assertStorePathInsideHome({ homeDir: home, storePath: 'storages/dsh_prompt.json' });
ok(!relativeStore.ok, '相对路径被拒（必须显式绝对路径）', JSON.stringify(relativeStore));

throwsFixture(
  () => applyFixture({
    recipe: resolveFixture(cleanRaw, { runTag: 'RT-1' }),
    homeDir: otherHome,
    storePath: fixtureStorePath(home),
  }),
  { code: 'store-path-outside-home' },
  'applyFixture 越界写入被拒',
);

/* ────────────────────────────── 4. 重置语义 ────────────────────────────── */

section('重置语义');
const resetHome = newHome();
const resetStore = fixtureStorePath(resetHome);
fs.writeFileSync(resetStore, JSON.stringify({ unit: { name: 'dsh_prompt', version: 0 }, global: {}, tables: {} }), 'utf8');
fs.writeFileSync(path.join(resetHome, 'storages', 'other.json'), '{"keep":true}', 'utf8');
const cleanRecipe = resolveFixture(loadFixture('clean'), { runTag: 'RT-1' });
const cleanApplied = applyFixture({ recipe: cleanRecipe, homeDir: resetHome });
ok(cleanApplied.applied.reset.removed, '重置删除了上一轮残留的 store 文件');
ok(!fs.existsSync(resetStore), '重置后 store 文件不存在');
ok(fs.existsSync(path.join(resetHome, 'storages', 'other.json')), '重置不碰无关域文件');
eq(cleanApplied.applied.seed.written, false, '干净态配方不写种子文件');
ok(!fs.existsSync(resetStore), '干净态应用后仍然没有 store 文件');

const cleanAgain = applyFixture({ recipe: cleanRecipe, homeDir: resetHome });
eq(cleanAgain.applied.reset.removed, false, '重复重置幂等（无文件可删不报错）');
eq(cleanAgain.applied.reset.existed, false, '重置如实报告删除前的存在性');

/* ────────────────────────────── 5. 种子写入与期望自洽 ────────────────────────────── */

section('种子写入与期望自洽');
const seedHome = newHome();
const templatesRecipe = resolveFixture(loadFixture('templates'), { runTag: 'RT-1' });
const seeded = applyFixture({ recipe: templatesRecipe, homeDir: seedHome });
const seedStore = fixtureStorePath(seedHome);
ok(fs.existsSync(seedStore), '有 seed 的配方写出了 store 文件');
eq(seeded.storeAfter.present, true, '应用后 storeAfter.present=true');

const doc = readJson(seedStore);
deepEq(doc.unit, { name: 'dsh_prompt', version: 0 }, 'store 文档 unit 形状符合 storage-schema');
deepEq(Object.keys(doc).sort(), ['global', 'tables', 'unit'], 'store 文档顶层键 = unit/global/tables');
deepEq(Object.keys(doc.tables).sort(), ['customs', 'pinned', 'usage'], 'tables 键 = customs/usage/pinned');
eq(doc.global.remoteEnabled, false, '种子未覆盖的全局偏好回落默认（remoteEnabled=false）');
eq(doc.global.remoteSize, 5, '种子未覆盖的全局偏好回落默认（remoteSize=5）');
eq(doc.global.hoverTrigger, true, '种子未覆盖的全局偏好回落默认（hoverTrigger=true）');
eq(doc.tables.pinned['fx-RT-1-alpha'].pos, 0, 'pinned 落盘为 {pos} 行');
eq(doc.tables.usage['fx-RT-1-alpha'].count, 2, 'usage 落盘为 {count} 行');

const templatesBaseline = baselineFromStorePath(seedStore);
const templatesCheck = checkBaseline(templatesRecipe, templatesBaseline);
ok(templatesCheck.ok, '模板配方：声明期望与盘上实测基线自洽', formatDiffs(templatesCheck.diffs));

const triggerRecipe = resolveFixture(loadFixture('trigger-click'), { runTag: 'RT-1' });
const triggerHome = newHome();
applyFixture({ recipe: triggerRecipe, homeDir: triggerHome });
eq(readJson(fixtureStorePath(triggerHome)).global.hoverTrigger, false, '触发模式配方写入 hoverTrigger=false');
ok(checkBaseline(triggerRecipe, baselineFromStorePath(fixtureStorePath(triggerHome))).ok, '触发模式配方期望自洽');

const remoteRecipe = resolveFixture(loadFixture('remote-prefs'), { runTag: 'RT-1' });
const remoteHome = newHome();
applyFixture({ recipe: remoteRecipe, homeDir: remoteHome });
const remoteCheck = checkBaseline(remoteRecipe, baselineFromStorePath(fixtureStorePath(remoteHome)));
ok(remoteCheck.ok, '远程偏好配方期望自洽', formatDiffs(remoteCheck.diffs));

const missingHome = newHome();
deepEq(baselineFromStorePath(fixtureStorePath(missingHome)), {
  unit: null,
  storePresent: false,
  customs: [],
  usage: {},
  pinned: [],
  lastUsed: null,
  remote: { enabled: false, size: 5, orientation: 'auto', density: 'a' },
  hidePreset: true,
  hoverTrigger: true,
}, '文件不存在时的基线 = 插件定义默认');
ok(checkBaseline(cleanRecipe, baselineFromStorePath(fixtureStorePath(missingHome))).ok, '干净态配方与默认基线自洽');

/* ────────────────────────────── 6. 基线投影与 diff ────────────────────────────── */

section('基线投影与 diff');
const snapshot = {
  customs: [
    { id: 'a', name: '甲', labels: ['夹具'], builtin: false, body: '正文' },
    { id: 'b', name: '乙', labels: [], builtin: true, body: '' },
  ],
  usage: { a: 3 },
  pinned: ['a'],
  lastUsed: 'a',
  remote: { enabled: true, size: 4, orientation: 'portrait', density: 'b' },
  hidePreset: false,
  hoverTrigger: false,
};
const projected = baselineFromSnapshot(snapshot, { storePresent: true, unit: { name: 'dsh_prompt', version: 0 } });
deepEq(projected.customs, [
  { id: 'a', name: '甲', builtin: false, labels: ['夹具'] },
  { id: 'b', name: '乙', builtin: true, labels: [] },
], 'snapshot 投影只留基线关心的字段（customs）');
deepEq(projected.remote, { enabled: true, size: 4, orientation: 'portrait', density: 'b' }, 'snapshot 投影保留 remote 四元组');

ok(diffBaseline(projected, projected).ok, '同值 diff 为空');
const valueDiff = diffBaseline({ hoverTrigger: true }, { hoverTrigger: false });
ok(!valueDiff.ok, '值不符 → diff.ok=false');
eq(valueDiff.diffs[0].path, 'hoverTrigger', '值不符的路径');
eq(valueDiff.diffs[0].expected, true, '值不符记录期望');
eq(valueDiff.diffs[0].actual, false, '值不符记录当前');

const nestedDiff = diffBaseline({ remote: { size: 5 } }, { remote: { size: 3 } });
eq(nestedDiff.diffs[0].path, 'remote.size', '嵌套值不符的路径');

const missingDiff = diffBaseline({ pinned: ['a'] }, {});
eq(missingDiff.diffs[0].path, 'pinned', '缺键记录路径');
eq(missingDiff.diffs[0].kind, 'missing', '缺键的 kind=missing');

const extraDiff = diffBaseline({ customs: [] }, { customs: [], hidePreset: true });
eq(extraDiff.diffs[0].path, 'hidePreset', '多键记录路径');
eq(extraDiff.diffs[0].kind, 'extra', '多键的 kind=extra');

const arrayDiff = diffBaseline({ pinned: ['a', 'b'] }, { pinned: ['a'] });
eq(arrayDiff.diffs[0].path, 'pinned.length', '数组长度不符的路径');
eq(arrayDiff.diffs[0].expected, 2, '数组长度记录期望');

const formatText = formatDiffs(diffBaseline({ remote: { size: 5 } }, { remote: { size: 3 } }).diffs);
ok(formatText.includes('remote.size') && formatText.includes('当前') && formatText.includes('期望'), 'formatDiffs 文案含路径/当前/期望', formatText);

/* ────────────────────────────── 7. 故障注入（负例证明基线门能红） ────────────────────────────── */

section('故障注入');
ok(FAULT_MODES.includes('pollute') && FAULT_MODES.includes('skip-seed') && FAULT_MODES.includes('drop-store'), '故障模式清单包含三种');

for (const { fault, label } of [
  { fault: 'pollute', label: 'pollute：多写一条未声明的模板 + 翻转 hoverTrigger' },
  { fault: 'skip-seed', label: 'skip-seed：只重置不写种子' },
  { fault: 'drop-store', label: 'drop-store：写完种子又删掉 store' },
]) {
  const faultHome = newHome();
  const applied = applyFixture({ recipe: templatesRecipe, homeDir: faultHome, fault });
  eq(applied.applied.fault, fault, label + ' 记录 fault');
  const check = checkBaseline(templatesRecipe, baselineFromStorePath(fixtureStorePath(faultHome)));
  ok(!check.ok && check.diffs.length > 0, label + ' → 基线必然不符', formatDiffs(check.diffs));
}

throwsFixture(
  () => applyFixture({ recipe: templatesRecipe, homeDir: newHome(), fault: 'no-such-fault' }),
  { code: 'invalid-fault' },
  '未知故障模式 → invalid-fault',
);

/* ────────────────────────────── 8. HTTP 读回 ────────────────────────────── */

section('HTTP 读回（模拟宿主 GET /_dsh/dsh-prompt/store）');
async function withFakeStoreServer(value, fn) {
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/_dsh/dsh-prompt/store') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', connection: 'close' });
      res.end(JSON.stringify(value));
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json', connection: 'close' });
    res.end(JSON.stringify({ ok: false, error: { code: 'not_found' } }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  try {
    return await fn(origin);
  } finally {
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

const captureHome = newHome();
await withFakeStoreServer({ ok: true, value: snapshot }, async (origin) => {
  const captured = await captureBaselineFromOrigin({ origin, storePath: fixtureStorePath(captureHome) });
  deepEq(captured.baseline, { ...projected, unit: null, storePresent: false }, 'HTTP 读回投影与 snapshot 一致');
  eq(captured.http.status, 200, 'HTTP 读回状态码');
  eq(captured.baseline.storePresent, false, 'HTTP 读回同时报告 store 文件存在性');
  return null;
});

await withFakeStoreServer({ ok: false, error: { code: 'degraded', message: 'store not ready' } }, async (origin) => {
  try {
    await captureBaselineFromOrigin({ origin, storePath: fixtureStorePath(captureHome) });
    ok(false, '宿主返回 {ok:false} → store-read-failed', '没有抛错');
  } catch (error) {
    ok(error instanceof FixtureError && error.code === 'store-read-failed', '宿主返回 {ok:false} → store-read-failed', String(error && error.message));
  }
  return null;
});

/* ────────────────────────────── 9. run tag 唯一性 ────────────────────────────── */

section('run tag 唯一性与可区分性');
const fixed = new Date('2026-10-30T15:07:09+08:00');
const tags = new Set();
for (let i = 0; i < 100; i += 1) tags.add(makeRunTag('smoke', fixed));
eq(tags.size, 100, '同一毫秒内连续 100 次 makeRunTag 不重复');
const sampleTag = makeRunTag('smoke', fixed);
ok(/^[0-9]{8}-[0-9]{6}-[0-9a-z]+-[0-9a-z]+-smoke$/.test(sampleTag), 'run tag 形状 = 时间戳-随机-序号-套件', sampleTag);
ok(!/[\\/:*?"<>|]/.test(sampleTag), 'run tag 不含文件系统非法字符', sampleTag);
eq(makeRunTag('smoke', fixed).endsWith('-smoke'), true, 'run tag 以套件结尾，报告可区分套件');
ok(makeRunTag('smoke', fixed) !== makeRunTag('smoke', fixed), '同套件连续两次 tag 不同');

/* ──────────────────────── 10. 宿主事实单一来源（#183 S2） ──────────────────────── */

section('宿主事实单一来源：store 路径/domain 来自契约，CLEAN_GLOBAL 与产品 initial 对账');
{
  deepEq(
    [STORE_RELATIVE_PATH, STORE_FILE_NAME],
    [
      HOST_CONTRACT.storage.rootRelative + '/' + HOST_CONTRACT.storage.pluginDomain.file,
      HOST_CONTRACT.storage.pluginDomain.file,
    ],
    'store 相对路径/文件名由宿主契约派生（fixture 不再各存一份字符串）',
  );
  deepEq(
    DEFAULT_DOMAIN,
    {
      name: HOST_CONTRACT.storage.pluginDomain.name,
      version: HOST_CONTRACT.storage.pluginDomain.version,
    },
    'domain name/version 由宿主契约派生（unit 落盘形状只有一份事实）',
  );
  eq(typeof HOST_CONTRACT.storage.pluginDomain.version, 'number', '契约 pluginDomain 钉住 version（seed 的 unit 用它）');

  // CLEAN_GLOBAL 是唯一允许在测试侧固化的产品 seed 值：读产物 lib/index.js 的域定义 initial，
  // 与固化副本逐键对比。产品改默认值而 fixture 没跟上时这里必须红（不是静默用旧默认值跑真机）。
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..', '..', '..', '..');
  const libPath = path.join(repoRoot, 'lib', 'index.js');
  let libText = '';
  try {
    libText = fs.readFileSync(libPath, 'utf8');
  } catch (error) {
    ok(false, '可读到产物 lib/index.js（CLEAN_GLOBAL 对账的前提）', String(error && error.message));
  }
  const initialMatch = libText.match(/initial:\s*\{([^}]*)\}/);
  ok(!!initialMatch, '在 lib/index.js 找到 promptDomainSpec 的 initial 定义');
  const parsedInitial = {};
  if (initialMatch) {
    for (const entry of String(initialMatch[1]).split(',')) {
      const pair = entry.trim();
      if (!pair) continue;
      const colon = pair.indexOf(':');
      if (colon <= 0) continue;
      const key = pair.slice(0, colon).trim();
      const raw = pair.slice(colon + 1).trim();
      if (raw === 'null') parsedInitial[key] = null;
      else if (raw === 'true') parsedInitial[key] = true;
      else if (raw === 'false') parsedInitial[key] = false;
      else if (/^["']/.test(raw)) parsedInitial[key] = raw.replace(/^["']|["']$/g, '');
      else parsedInitial[key] = Number(raw);
    }
  }
  deepEq(parsedInitial, { ...CLEAN_GLOBAL }, 'CLEAN_GLOBAL 与产品 lib/index.js 的 initial 逐键一致');
}

/* ────────────────────────────── 汇总 ────────────────────────────── */

console.log('\n' + '-'.repeat(72));
if (failures.length === 0) {
  console.log('RESULT: ' + passCount + ' PASS / 0 FAIL（fixture 自证全绿）');
  process.exit(0);
}
console.log('RESULT: ' + passCount + ' PASS / ' + failures.length + ' FAIL');
for (const failure of failures) console.log('  ✗ ' + failure.name + (failure.detail ? '：' + failure.detail : ''));
process.exit(1);
