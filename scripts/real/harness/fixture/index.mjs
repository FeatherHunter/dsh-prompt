/**
 * 声明式 fixture：每轮真机运行的初始态 = 一份纯数据配方（`scripts/real/fixtures/*.json`）。
 *
 * 分工（对应 spec #183 / 票 #187）：
 * - 配方只描述「起始态」，不描述用例；套件（#188 起）继续只写布置与断言。
 * - 「重置」= 删除插件的持久化数据（single 布局唯一一份 store），让插件定义生效；
 *   「种子」= 按 storage-schema 契约把声明好的数据写进 store（服务启动前写文件最确定）。
 * - 运行前读回当前态（产品公开路径：宿主 HTTP 桥 GET /_dsh/dsh-prompt/store）并与声明比对；
 *   不符 → 整轮 BLOCKED、列出 current vs expected，不执行套件，避免状态污染冒充产品 FAIL。
 * - 路径守卫：store 路径必须落在一次性 DSH_HOME 内，越界直接拒绝（不污染真实用户数据）。
 *
 * 配方格式（formatVersion 1）：见 docs/real/fixture.md。
 *
 * 供 #188 使用的最短路径：
 *   const prepared = prepareFixture({ fixture: 'templates', homeDir, params: makeFixtureParams({ runTag }) });
 *   // ... 场景动作之后读回并断言：
 *   const observed = (await captureBaselineFromOrigin({ origin: server.origin, storePath: prepared.storePath })).baseline;
 *   const check = checkBaseline(prepared.recipe, observed);
 *   if (!check.ok) recorder.fail('场景后的模板集合', { expected: check.declared, observed: check.observed, detail: formatDiffs(check.diffs) });
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

import { HOST_CONTRACT } from '../contract/host.mjs';

const FIXTURE_MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

/** 仓库内置配方目录（scripts/real/fixtures），与 harness 同级。 */
export const DEFAULT_FIXTURES_DIR = path.resolve(FIXTURE_MODULE_DIR, '..', '..', 'fixtures');

export const FIXTURE_FORMAT_VERSION = 1;

// #183 评审整改 S2：store 位置与插件域只从宿主契约（harness/contract/host.mjs）取一份，
// fixture 层不再各存一份字符串常量——宿主升级时只改契约，种子/读回路径自动跟着改。
const { storage } = HOST_CONTRACT;

/** 插件 store 相对一次性 DSH_HOME 的位置（single 布局：<root>/<域>.json）。 */
export const STORE_RELATIVE_PATH = storage.rootRelative + '/' + storage.pluginDomain.file;
export const STORE_FILE_NAME = storage.pluginDomain.file;

/** 插件 domain 声明（`promptDomainSpec`：name/version 必须与落盘 unit 一致，否则宿主拒读）。 */
export const DEFAULT_DOMAIN = Object.freeze({
  name: storage.pluginDomain.name,
  version: storage.pluginDomain.version,
});

/**
 * 插件定义里的全局默认值（`promptDomainSpec.global.initial` 的产品固化副本）。
 *
 * 来源：产品构建产物 lib/index.js 的 `initial: { ... }`（域定义随产物发布，不随测试改）。
 * 这是唯一允许在测试侧固化的产品 seed 值——因为 harness 不能 import 产物 bundle；
 * 由 `harness/fixture/selftest.mjs` 的「CLEAN_GLOBAL 与产品 initial 一致」断言盯着：
 * 产品改了 initial 而这里没跟上，fixture 自证会红，不会静默用旧默认值跑真机。
 */
export const CLEAN_GLOBAL = Object.freeze({
  lastUsed: null,
  remoteEnabled: false,
  remoteSize: 5,
  remoteFont: 'large',
  remoteControl: 'large',
  remoteOrientation: 'auto',
  remoteDensity: 'a',
  hidePreset: true,
  hoverTrigger: true,
});

/** 故障注入：只用于证明「起始态与声明不符 → BLOCKED」，不参与正常路径。 */
export const FAULT_MODES = Object.freeze(['pollute', 'skip-seed', 'drop-store']);

const RECIPE_KEYS = ['formatVersion', 'name', 'title', 'description', 'reset', 'seed', 'expect'];
const SEED_KEYS = ['global', 'customs', 'usage', 'pinned'];
const EXPECT_KEYS = ['unit', 'storePresent', 'customs', 'usage', 'pinned', 'lastUsed', 'remote', 'hidePreset', 'hoverTrigger'];
const GLOBAL_KEYS = Object.keys(CLEAN_GLOBAL);
const CUSTOM_KEYS = ['id', 'name', 'nameEn', 'labels', 'color', 'outline', 'body', 'builtin', 'createdAt', 'tag', 'domain', 'stage', 'action'];
const PROJECTED_CUSTOM_KEYS = ['id', 'name', 'builtin', 'labels'];
const REMOTE_KEYS = ['enabled', 'size', 'orientation', 'density'];
const FONT_TIERS = ['small', 'medium', 'large'];
const ORIENTATIONS = ['auto', 'landscape', 'portrait'];
const DENSITIES = ['a', 'b'];

export class FixtureError extends Error {
  constructor(message, { code = 'FIXTURE', path: at = null, detail = null } = {}) {
    super(message);
    this.name = 'FixtureError';
    this.code = code;
    this.path = at;
    this.detail = detail;
  }
}

function fail(message, code, at) {
  throw new FixtureError(message, { code, path: at });
}

/* ────────────────────────── 配方清单与加载 ────────────────────────── */

/** 列出内置配方（按名字排序）：[{ name, path }]。 */
export function listFixtures({ fixturesDir = DEFAULT_FIXTURES_DIR } = {}) {
  let entries;
  try {
    entries = fs.readdirSync(fixturesDir, { withFileTypes: true });
  } catch (error) {
    fail('读不了配方目录：' + fixturesDir + '（' + error.message + '）', 'fixtures-dir-missing', fixturesDir);
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => ({ name: entry.name.slice(0, -'.json'.length), path: path.join(fixturesDir, entry.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * 加载配方（未解析占位符）：参数是内置配方名，或显式 `.json` 路径。
 * 只做信封级检查（JSON / formatVersion / name / 未知顶层键），深层校验在 resolve 之后做，
 * 因为 `${runTag}` 这类参数可能出现在枚举字段里（先替换再校验类型才合理）。
 */
export function loadFixture(nameOrPath, { fixturesDir = DEFAULT_FIXTURES_DIR } = {}) {
  if (typeof nameOrPath !== 'string' || nameOrPath.trim() === '') {
    fail('配方名/路径必须是非空字符串：' + JSON.stringify(nameOrPath), 'invalid-fixture-ref');
  }
  const explicitPath = /[\\/]/.test(nameOrPath) || nameOrPath.endsWith('.json');
  const file = explicitPath ? path.resolve(nameOrPath) : path.join(fixturesDir, nameOrPath + '.json');
  if (!fs.existsSync(file)) {
    fail(
      '找不到配方' + (explicitPath ? '文件：' + nameOrPath : '：' + nameOrPath + '（目录 ' + fixturesDir + '，可用配方 ' + listFixtures({ fixturesDir }).map((item) => item.name).join(' / ') + '）'),
      'fixture-not-found',
      file,
    );
  }
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    fail('读不了配方文件：' + file + '（' + error.message + '）', 'fixture-read-failed', file);
  }
  let recipe;
  try {
    recipe = JSON.parse(text);
  } catch (error) {
    fail('配方不是合法 JSON：' + file + '（' + error.message + '）', 'invalid-recipe', file);
  }
  validateEnvelope(recipe);
  return recipe;
}

function validateEnvelope(recipe) {
  if (recipe === null || typeof recipe !== 'object' || Array.isArray(recipe)) {
    fail('配方必须是 JSON 对象', 'invalid-recipe');
  }
  if (recipe.formatVersion !== FIXTURE_FORMAT_VERSION) {
    fail('配方 formatVersion 必须是 ' + FIXTURE_FORMAT_VERSION + '（实际 ' + JSON.stringify(recipe.formatVersion) + '）', 'invalid-recipe', 'formatVersion');
  }
  if (typeof recipe.name !== 'string' || recipe.name.trim() === '') {
    fail('配方 name 必须是非空字符串', 'invalid-recipe', 'name');
  }
  for (const key of Object.keys(recipe)) {
    if (!RECIPE_KEYS.includes(key)) fail('配方有未知顶层键：' + key + '（允许：' + RECIPE_KEYS.join(', ') + '）', 'invalid-recipe', key);
  }
  if (recipe.title !== undefined && typeof recipe.title !== 'string') fail('配方 title 必须是字符串', 'invalid-recipe', 'title');
  if (recipe.description !== undefined && typeof recipe.description !== 'string') fail('配方 description 必须是字符串', 'invalid-recipe', 'description');
  if (recipe.reset !== undefined && typeof recipe.reset !== 'boolean') fail('配方 reset 必须是布尔', 'invalid-recipe', 'reset');
  if (recipe.seed !== undefined && (recipe.seed === null || typeof recipe.seed !== 'object' || Array.isArray(recipe.seed))) {
    fail('配方 seed 必须是对象', 'invalid-recipe', 'seed');
  }
  if (recipe.expect !== undefined && (recipe.expect === null || typeof recipe.expect !== 'object' || Array.isArray(recipe.expect))) {
    fail('配方 expect 必须是对象', 'invalid-recipe', 'expect');
  }
}

/* ────────────────────────── 参数化与校验 ────────────────────────── */

/** 运行期可用的配方参数：目前只有 runTag（每轮唯一，进报告）。 */
export function makeFixtureParams({ runTag } = {}) {
  if (typeof runTag !== 'string' || runTag.trim() === '') {
    throw new FixtureError('makeFixtureParams 需要非空 runTag（每轮唯一）', { code: 'invalid-params' });
  }
  return { runTag };
}

const PLACEHOLDER = /\$\{([A-Za-z][A-Za-z0-9_]*)\}/g;

/** 深拷贝配方并把 `${参数}` 替换成 params 里的值；未知参数直接报错（不允许静默留空）。 */
export function resolveFixture(recipe, params) {
  if (params === null || typeof params !== 'object' || Array.isArray(params)) {
    fail('resolveFixture 的 params 必须是对象（例如 { runTag }）', 'invalid-params');
  }
  const available = Object.keys(params);
  const resolveParam = (whole, key) => {
    if (!Object.prototype.hasOwnProperty.call(params, key)) {
      fail(
        '配方占位符 ' + whole + ' 没有对应参数（可用参数：' + (available.length ? available.join(', ') : '无') + '）',
        'unknown-placeholder',
        key,
      );
    }
    const replacement = params[key];
    if (typeof replacement === 'string') return replacement;
    if (typeof replacement === 'number' || typeof replacement === 'boolean') return String(replacement);
    return fail('参数 ' + key + ' 的类型不支持（' + typeof replacement + '），只能是字符串/数字/布尔', 'invalid-params', key);
  };
  const resolveString = (value) => value.replace(PLACEHOLDER, (whole, key) => resolveParam(whole, key));
  const resolveValue = (value) => {
    if (typeof value === 'string') return resolveString(value);
    if (Array.isArray(value)) return value.map(resolveValue);
    if (value !== null && typeof value === 'object') {
      const out = {};
      for (const [key, inner] of Object.entries(value)) {
        // 键也要参数化：usage / pinned 之类以模板 id 为键，id 里可能带 ${runTag}。
        out[resolveString(key)] = resolveValue(inner);
      }
      return out;
    }
    return value;
  };
  return resolveValue(recipe);
}

function ensureObject(value, at) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(at + ' 必须是对象', 'invalid-recipe', at);
  }
}

function ensureKnownKeys(value, allowed, at) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      fail(at + ' 有未知键：' + key + '（允许：' + allowed.join(', ') + '）', 'invalid-recipe', at + '.' + key);
    }
  }
}

function ensureBoolean(value, at) {
  if (typeof value !== 'boolean') fail(at + ' 必须是布尔（实际 ' + JSON.stringify(value) + '）', 'invalid-recipe', at);
}

function ensureNonNegativeInt(value, at) {
  if (!Number.isInteger(value) || value < 0) fail(at + ' 必须是非负整数（实际 ' + JSON.stringify(value) + '）', 'invalid-recipe', at);
}

function ensureOneOf(value, allowed, at) {
  if (!allowed.includes(value)) fail(at + ' 必须是 ' + allowed.join('/') + ' 之一（实际 ' + JSON.stringify(value) + '）', 'invalid-recipe', at);
}

function ensureString(value, at, { allowEmpty = false } = {}) {
  if (typeof value !== 'string' || (!allowEmpty && value.trim() === '')) {
    fail(at + ' 必须是' + (allowEmpty ? '字符串' : '非空字符串') + '（实际 ' + JSON.stringify(value) + '）', 'invalid-recipe', at);
  }
}

function validateSeedGlobal(global, at) {
  ensureObject(global, at);
  ensureKnownKeys(global, GLOBAL_KEYS, at);
  for (const [key, value] of Object.entries(global)) {
    const keyPath = at + '.' + key;
    if (key === 'lastUsed') {
      if (value !== null && typeof value !== 'string') fail(keyPath + ' 必须是字符串或 null', 'invalid-recipe', keyPath);
    } else if (key === 'remoteEnabled' || key === 'hidePreset' || key === 'hoverTrigger') {
      ensureBoolean(value, keyPath);
    } else if (key === 'remoteSize') {
      if (!Number.isInteger(value) || value < 1 || value > 10) fail(keyPath + ' 必须是 1..10 的整数', 'invalid-recipe', keyPath);
    } else if (key === 'remoteFont' || key === 'remoteControl') {
      ensureOneOf(value, FONT_TIERS, keyPath);
    } else if (key === 'remoteOrientation') {
      ensureOneOf(value, ORIENTATIONS, keyPath);
    } else if (key === 'remoteDensity') {
      ensureOneOf(value, DENSITIES, keyPath);
    }
  }
}

function validateCustomRecord(record, at) {
  ensureObject(record, at);
  ensureKnownKeys(record, CUSTOM_KEYS, at);
  ensureString(record.id, at + '.id');
  ensureString(record.name, at + '.name');
  if (record.nameEn !== undefined) ensureString(record.nameEn, at + '.nameEn', { allowEmpty: true });
  if (record.labels !== undefined) {
    if (!Array.isArray(record.labels)) fail(at + '.labels 必须是字符串数组', 'invalid-recipe', at + '.labels');
    record.labels.forEach((label, index) => ensureString(label, at + '.labels[' + index + ']'));
  }
  if (record.color !== undefined) ensureString(record.color, at + '.color');
  if (record.outline !== undefined) ensureBoolean(record.outline, at + '.outline');
  ensureString(record.body, at + '.body', { allowEmpty: true });
  if (record.body.length > 10000) fail(at + '.body 超过 10000 字符上限', 'invalid-recipe', at + '.body');
  if (record.builtin !== undefined) ensureBoolean(record.builtin, at + '.builtin');
  ensureNonNegativeInt(record.createdAt, at + '.createdAt');
}

function validateSeed(seed) {
  if (seed === undefined) return;
  ensureObject(seed, 'seed');
  ensureKnownKeys(seed, SEED_KEYS, 'seed');
  if (seed.global !== undefined) validateSeedGlobal(seed.global, 'seed.global');
  if (seed.customs !== undefined) {
    if (!Array.isArray(seed.customs)) fail('seed.customs 必须是数组', 'invalid-recipe', 'seed.customs');
    const ids = new Set();
    seed.customs.forEach((record, index) => {
      validateCustomRecord(record, 'seed.customs[' + index + ']');
      if (ids.has(record.id)) fail('seed.customs 的 id 重复：' + record.id, 'invalid-recipe', 'seed.customs[' + index + '].id');
      ids.add(record.id);
    });
  }
  if (seed.usage !== undefined) {
    ensureObject(seed.usage, 'seed.usage');
    for (const [id, count] of Object.entries(seed.usage)) {
      if (id.trim() === '') fail('seed.usage 的模板 id 不能为空', 'invalid-recipe', 'seed.usage');
      ensureNonNegativeInt(count, 'seed.usage.' + id);
    }
  }
  if (seed.pinned !== undefined) {
    if (!Array.isArray(seed.pinned)) fail('seed.pinned 必须是字符串数组', 'invalid-recipe', 'seed.pinned');
    if (seed.pinned.length > 5) fail('seed.pinned 最多 5 个 id（实际 ' + seed.pinned.length + ' 个）', 'invalid-recipe', 'seed.pinned');
    const seen = new Set();
    seed.pinned.forEach((id, index) => {
      ensureString(id, 'seed.pinned[' + index + ']');
      if (seen.has(id)) fail('seed.pinned 的 id 重复：' + id, 'invalid-recipe', 'seed.pinned[' + index + ']');
      seen.add(id);
    });
  }
}

function validateExpect(expect) {
  if (expect === undefined || expect === null) fail('配方必须声明 expect（起始态期望）', 'invalid-recipe', 'expect');
  ensureObject(expect, 'expect');
  ensureKnownKeys(expect, EXPECT_KEYS, 'expect');
  const keys = Object.keys(expect);
  if (keys.length === 0) fail('expect 不能为空（至少声明一项起始态）', 'invalid-recipe', 'expect');
  if (expect.unit !== undefined && expect.unit !== null) {
    ensureObject(expect.unit, 'expect.unit');
    ensureKnownKeys(expect.unit, ['name', 'version'], 'expect.unit');
    ensureString(expect.unit.name, 'expect.unit.name');
    ensureNonNegativeInt(expect.unit.version, 'expect.unit.version');
  }
  if (expect.storePresent !== undefined) ensureBoolean(expect.storePresent, 'expect.storePresent');
  if (expect.customs !== undefined) {
    if (!Array.isArray(expect.customs)) fail('expect.customs 必须是数组', 'invalid-recipe', 'expect.customs');
    expect.customs.forEach((record, index) => {
      ensureObject(record, 'expect.customs[' + index + ']');
      ensureKnownKeys(record, PROJECTED_CUSTOM_KEYS, 'expect.customs[' + index + ']');
      ensureString(record.id, 'expect.customs[' + index + '].id');
      ensureString(record.name, 'expect.customs[' + index + '].name');
      ensureBoolean(record.builtin, 'expect.customs[' + index + '].builtin');
      if (!Array.isArray(record.labels)) fail('expect.customs[' + index + '].labels 必须是字符串数组', 'invalid-recipe', 'expect.customs[' + index + '].labels');
      record.labels.forEach((label, labelIndex) => ensureString(label, 'expect.customs[' + index + '].labels[' + labelIndex + ']'));
    });
  }
  if (expect.usage !== undefined) {
    ensureObject(expect.usage, 'expect.usage');
    for (const [id, count] of Object.entries(expect.usage)) ensureNonNegativeInt(count, 'expect.usage.' + id);
  }
  if (expect.pinned !== undefined) {
    if (!Array.isArray(expect.pinned)) fail('expect.pinned 必须是字符串数组', 'invalid-recipe', 'expect.pinned');
    expect.pinned.forEach((id, index) => ensureString(id, 'expect.pinned[' + index + ']'));
  }
  if (expect.lastUsed !== undefined && expect.lastUsed !== null) ensureString(expect.lastUsed, 'expect.lastUsed');
  if (expect.remote !== undefined) {
    ensureObject(expect.remote, 'expect.remote');
    ensureKnownKeys(expect.remote, REMOTE_KEYS, 'expect.remote');
    for (const key of REMOTE_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(expect.remote, key)) {
        fail('expect.remote 缺 ' + key + '（四元组必须写全：' + REMOTE_KEYS.join(', ') + '）', 'invalid-recipe', 'expect.remote.' + key);
      }
    }
    ensureBoolean(expect.remote.enabled, 'expect.remote.enabled');
    if (!Number.isInteger(expect.remote.size) || expect.remote.size < 1 || expect.remote.size > 10) {
      fail('expect.remote.size 必须是 1..10 的整数', 'invalid-recipe', 'expect.remote.size');
    }
    ensureOneOf(expect.remote.orientation, ORIENTATIONS, 'expect.remote.orientation');
    ensureOneOf(expect.remote.density, DENSITIES, 'expect.remote.density');
  }
  if (expect.hidePreset !== undefined) ensureBoolean(expect.hidePreset, 'expect.hidePreset');
  if (expect.hoverTrigger !== undefined) ensureBoolean(expect.hoverTrigger, 'expect.hoverTrigger');
}

/** 深层校验一份已解析参数的配方（信封 + seed + expect）。 */
export function validateFixture(recipe) {
  validateEnvelope(recipe);
  validateSeed(recipe.seed);
  validateExpect(recipe.expect);
  return recipe;
}

/* ────────────────────────── store 路径与重置/种子 ────────────────────────── */

/** 一次性 DSH_HOME 下插件 store 的绝对路径。 */
export function fixtureStorePath(homeDir) {
  if (typeof homeDir !== 'string' || !path.isAbsolute(homeDir)) {
    throw new FixtureError('homeDir 必须是绝对路径：' + JSON.stringify(homeDir), { code: 'invalid-params', path: 'homeDir' });
  }
  return path.join(homeDir, ...STORE_RELATIVE_PATH.split('/'));
}

/**
 * 路径守卫：store 必须落在本轮一次性 home 内、且文件名是插件 store。
 * 越界说明运行期绑定把 DSH_HOME 指到了别处，继续跑会污染真实用户数据 —— 直接拒绝。
 */
export function assertStorePathInsideHome({ homeDir, storePath }) {
  const problems = [];
  if (typeof homeDir !== 'string' || !path.isAbsolute(homeDir)) problems.push('homeDir 必须是绝对路径：' + JSON.stringify(homeDir));
  if (typeof storePath !== 'string' || !path.isAbsolute(storePath)) {
    problems.push('store 路径必须是绝对路径：' + JSON.stringify(storePath));
  }
  if (problems.length === 0) {
    const resolvedHome = path.resolve(homeDir);
    const resolvedStore = path.resolve(storePath);
    const relative = path.relative(resolvedHome, resolvedStore);
    const outside = relative === '' || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative);
    if (outside) {
      problems.push('store 路径 ' + resolvedStore + ' 不在一次性 home ' + resolvedHome + ' 内（越界写入会污染真实用户数据，已拒绝）');
    } else if (path.basename(resolvedStore) !== STORE_FILE_NAME) {
      problems.push('store 路径文件名必须是 ' + STORE_FILE_NAME + '（实际 ' + path.basename(resolvedStore) + '）');
    }
  }
  return { ok: problems.length === 0, problems, homeDir, storePath };
}

/** 重置：删除插件持久化数据。返回删除前后的存在性（幂等，文件不存在不算错）。 */
export function resetStore({ storePath }) {
  const existed = fs.existsSync(storePath);
  let removed = false;
  if (existed) {
    fs.rmSync(storePath, { force: true });
    removed = !fs.existsSync(storePath);
  }
  return { existed, removed, storePath };
}

export function readStoreFile({ storePath }) {
  if (!fs.existsSync(storePath)) return { present: false, doc: null, bytes: 0, error: null };
  try {
    const text = fs.readFileSync(storePath, 'utf8');
    return { present: true, doc: JSON.parse(text), bytes: Buffer.byteLength(text), error: null };
  } catch (error) {
    return { present: true, doc: null, bytes: 0, error: String(error && error.message ? error.message : error) };
  }
}

/** 种子是否含实际内容（空 seed = 干净态，不写 store 文件，让插件定义生效）。 */
export function seedHasContent(recipe) {
  const seed = recipe.seed ?? {};
  if (Array.isArray(seed.customs) && seed.customs.length > 0) return true;
  if (Array.isArray(seed.pinned) && seed.pinned.length > 0) return true;
  if (seed.usage && Object.keys(seed.usage).length > 0) return true;
  if (seed.global && Object.keys(seed.global).length > 0) return true;
  return false;
}

/** 由配方构造落盘文档：顶层固定 unit/global/tables（storage-schema 契约）。 */
export function buildStoreDocument(recipe) {
  const seed = recipe.seed ?? {};
  const global = { ...CLEAN_GLOBAL, ...(seed.global ?? {}) };
  const customs = {};
  for (const record of seed.customs ?? []) {
    customs[record.id] = { ...record };
  }
  const usage = {};
  for (const [id, count] of Object.entries(seed.usage ?? {})) usage[id] = { count };
  const pinned = {};
  (seed.pinned ?? []).forEach((id, index) => {
    pinned[id] = { pos: index };
  });
  return { unit: { ...DEFAULT_DOMAIN }, global, tables: { customs, usage, pinned } };
}

function writeStoreFile({ storePath, doc }) {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  const text = JSON.stringify(doc, null, 2) + '\n';
  // 先写同目录临时文件再改名：与宿主 json 后端的原子发布一致，中途崩溃不留半份 JSON。
  const tempPath = storePath + '.fixture-tmp';
  fs.writeFileSync(tempPath, text, 'utf8');
  fs.renameSync(tempPath, storePath);
  const sha256 = crypto.createHash('sha256').update(text).digest('hex');
  return { written: true, bytes: Buffer.byteLength(text), sha256 };
}

/* ────────────────────────── 基线投影 ────────────────────────── */

/** 与宿主 snapshot 同规则的远程偏好归一化（lib/index.js 的 normalizeRemotePrefs）。 */
function normalizeRemotePrefs(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {};
  let size = 5;
  const isTier = (value) => FONT_TIERS.includes(value);
  if (Number.isInteger(source.size) && source.size >= 1 && source.size <= 10) size = source.size;
  else if (source.font === 'large' || source.control === 'large') size = 2;
  else if (isTier(source.font) || isTier(source.control)) size = 1;
  return {
    enabled: source.enabled === true,
    size,
    orientation: ORIENTATIONS.includes(source.orientation) ? source.orientation : 'auto',
    density: DENSITIES.includes(source.density) ? source.density : 'a',
  };
}

/** 与宿主 snapshot 同规则的标签归一化（#23 旧形状兼容）：空 labels 回落 tag / 「自定义」。 */
function normalizeLabels(record) {
  if (Array.isArray(record.labels) && record.labels.length > 0) return record.labels;
  const tag = typeof record.tag === 'string' ? record.tag.trim() : '';
  return [tag || '自定义'];
}

function projectCustomsFromDocument(tables) {
  const rows = (tables && tables.customs) || {};
  return Object.entries(rows)
    .filter(([, record]) => record !== null && typeof record === 'object')
    .sort((a, b) => (Number(a[1].createdAt) || 0) - (Number(b[1].createdAt) || 0))
    .map(([key, record]) => ({
      id: typeof record.id === 'string' && record.id ? record.id : key,
      name: typeof record.name === 'string' ? record.name : '',
      builtin: record.builtin === true,
      labels: normalizeLabels(record),
    }));
}

function projectUsageFromDocument(tables) {
  const rows = (tables && tables.usage) || {};
  const usage = {};
  for (const [id, row] of Object.entries(rows)) {
    if (row !== null && typeof row === 'object' && typeof row.count === 'number') usage[id] = row.count;
  }
  return usage;
}

function projectPinnedFromDocument(tables) {
  const rows = (tables && tables.pinned) || {};
  return Object.entries(rows)
    .filter(([, row]) => row !== null && typeof row === 'object')
    .sort((a, b) => (Number(a[1].pos) || 0) - (Number(b[1].pos) || 0))
    .map(([id]) => id);
}

/** 干净态基线（插件定义默认，store 文件不存在时宿主读到的快照）。 */
export function cleanBaseline() {
  return baselineFromStoreDocument(null, { present: false });
}

/** 由落盘文档投影出可比对的基线（口径对齐宿主 GET /store 的 snapshot）。 */
export function baselineFromStoreDocument(doc, { present = true } = {}) {
  if (!present || doc === null || typeof doc !== 'object') {
    return {
      unit: null,
      storePresent: false,
      customs: [],
      usage: {},
      pinned: [],
      lastUsed: null,
      remote: normalizeRemotePrefs({}),
      hidePreset: true,
      hoverTrigger: true,
    };
  }
  const global = doc.global !== null && typeof doc.global === 'object' ? doc.global : {};
  return {
    unit: doc.unit !== null && typeof doc.unit === 'object' ? { name: doc.unit.name, version: doc.unit.version } : null,
    storePresent: true,
    customs: projectCustomsFromDocument(doc.tables),
    usage: projectUsageFromDocument(doc.tables),
    pinned: projectPinnedFromDocument(doc.tables),
    lastUsed: global.lastUsed === undefined ? null : global.lastUsed,
    remote: normalizeRemotePrefs({
      enabled: global.remoteEnabled,
      size: global.remoteSize,
      font: global.remoteFont,
      control: global.remoteControl,
      orientation: global.remoteOrientation,
      density: global.remoteDensity,
    }),
    hidePreset: typeof global.hidePreset === 'boolean' ? global.hidePreset : true,
    hoverTrigger: typeof global.hoverTrigger === 'boolean' ? global.hoverTrigger : true,
  };
}

/**
 * 由宿主 GET /store 的 snapshot 投影出可比对的基线。
 * snapshot 已经是宿主归一化后的形状（labels 已补、remote 已归一），这里只做字段裁剪。
 */
export function baselineFromSnapshot(snapshot, { storePresent = false, unit = null } = {}) {
  if (snapshot === null || typeof snapshot !== 'object') {
    throw new FixtureError('snapshot 必须是对象', { code: 'invalid-params', path: 'snapshot' });
  }
  const customs = Array.isArray(snapshot.customs) ? snapshot.customs : [];
  const remoteRaw = snapshot.remote !== null && typeof snapshot.remote === 'object' ? snapshot.remote : {};
  return {
    unit: unit === undefined ? null : unit,
    storePresent: Boolean(storePresent),
    customs: customs.map((record) => ({
      id: record.id,
      name: record.name,
      builtin: record.builtin === true,
      labels: Array.isArray(record.labels) ? record.labels : [],
    })),
    usage:
      snapshot.usage !== null && typeof snapshot.usage === 'object'
        ? Object.fromEntries(Object.entries(snapshot.usage).map(([id, count]) => [id, Number(count)]))
        : {},
    pinned: Array.isArray(snapshot.pinned) ? [...snapshot.pinned] : [],
    lastUsed: snapshot.lastUsed === undefined ? null : snapshot.lastUsed,
    remote: {
      enabled: remoteRaw.enabled === true,
      size: Number(remoteRaw.size),
      orientation: remoteRaw.orientation,
      density: remoteRaw.density,
    },
    hidePreset: typeof snapshot.hidePreset === 'boolean' ? snapshot.hidePreset : true,
    hoverTrigger: typeof snapshot.hoverTrigger === 'boolean' ? snapshot.hoverTrigger : true,
  };
}

/** 直接读盘投影（不经宿主）：用于服务启动前的种子自检与离线自证。 */
export function baselineFromStorePath(storePath) {
  const file = readStoreFile({ storePath });
  if (!file.present) return baselineFromStoreDocument(null, { present: false });
  if (file.error) {
    throw new FixtureError('store 文件不是合法 JSON：' + storePath + '（' + file.error + '）', { code: 'store-read-failed', path: storePath });
  }
  return baselineFromStoreDocument(file.doc, { present: true });
}

/* ────────────────────────── diff ────────────────────────── */

function describeValue(value) {
  if (value === undefined) return '（缺）';
  const text = JSON.stringify(value);
  return text === undefined ? String(value) : text;
}

/** 逐路径对比 declared（子集语义）与 observed：只检查声明里出现的键。 */
export function diffBaseline(declared, observed) {
  const diffs = [];
  const walk = (expected, actual, at) => {
    if (Array.isArray(expected)) {
      if (!Array.isArray(actual)) {
        diffs.push({ path: at, expected, actual, kind: 'type' });
        return;
      }
      if (expected.length !== actual.length) {
        diffs.push({ path: at + '.length', expected: expected.length, actual: actual.length, kind: 'length' });
      }
      const shortest = Math.min(expected.length, actual.length);
      for (let index = 0; index < shortest; index += 1) walk(expected[index], actual[index], at + '[' + index + ']');
      return;
    }
    if (expected !== null && typeof expected === 'object') {
      if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) {
        diffs.push({ path: at, expected, actual, kind: 'type' });
        return;
      }
      for (const key of Object.keys(expected)) {
        const childPath = at === '' ? key : at + '.' + key;
        if (!Object.prototype.hasOwnProperty.call(actual, key)) {
          diffs.push({ path: childPath, expected: expected[key], actual: undefined, kind: 'missing' });
          continue;
        }
        walk(expected[key], actual[key], childPath);
      }
      for (const key of Object.keys(actual)) {
        if (Object.prototype.hasOwnProperty.call(expected, key)) continue;
        const childPath = at === '' ? key : at + '.' + key;
        diffs.push({ path: childPath, expected: undefined, actual: actual[key], kind: 'extra' });
      }
      return;
    }
    if (!Object.is(expected, actual)) diffs.push({ path: at, expected, actual, kind: 'value' });
  };
  walk(declared === null || declared === undefined ? {} : declared, observed === null || observed === undefined ? {} : observed, '');
  return { ok: diffs.length === 0, diffs };
}

/** 把差异压成一条人能直接读的 BLOCKED 理由（路径：当前 vs 期望）。 */
export function formatDiffs(diffs, { max = 8 } = {}) {
  const list = Array.isArray(diffs) ? diffs : [];
  if (list.length === 0) return '起始态与声明一致';
  const parts = list.slice(0, max).map((diff) => {
    const kindTag = diff.kind === 'missing' ? '（缺少）' : diff.kind === 'extra' ? '（多出）' : '';
    return diff.path + '：当前=' + describeValue(diff.actual) + '，期望=' + describeValue(diff.expected) + kindTag;
  });
  if (list.length > max) parts.push('…另有 ' + (list.length - max) + ' 处差异，完整清单见 environment.fixture.diffs');
  return '起始态与声明不符（' + list.length + ' 处）：' + parts.join('；');
}

/**
 * 声明 vs 实测：recipe 可以是配方对象（读 expect），也可以直接传声明的 expect。
 * 返回 { ok, diffs, declared, observed }，供 run.mjs 判 BLOCKED / 供 #188 在场景后断言。
 */
export function checkBaseline(recipeOrDeclared, observed) {
  const declared = recipeOrDeclared && typeof recipeOrDeclared === 'object' && Object.prototype.hasOwnProperty.call(recipeOrDeclared, 'expect') && recipeOrDeclared.expect !== undefined
    ? recipeOrDeclared.expect
    : recipeOrDeclared;
  validateExpect(declared);
  const diff = diffBaseline(declared, observed);
  return { ok: diff.ok, diffs: diff.diffs, declared, observed };
}

/* ────────────────────────── 应用配方（重置 + 种子 + 故障注入） ────────────────────────── */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 应用配方：路径守卫 → 重置 → 种子（服务启动前写 store 文件）→ 故障注入。
 * fault 只用于负例自证；正常路径传 null。
 */
export function applyFixture({ recipe, homeDir, storePath = null, fault = null, now = new Date() } = {}) {
  if (recipe === null || typeof recipe !== 'object') {
    throw new FixtureError('applyFixture 需要一份已解析的配方对象', { code: 'invalid-params', path: 'recipe' });
  }
  validateFixture(recipe);
  if (fault !== null && !FAULT_MODES.includes(fault)) {
    throw new FixtureError('未知故障模式：' + fault + '（可用：' + FAULT_MODES.join(', ') + '）', { code: 'invalid-fault', path: 'fault' });
  }
  const targetStorePath = storePath === null ? fixtureStorePath(homeDir) : storePath;
  const guard = assertStorePathInsideHome({ homeDir, storePath: targetStorePath });
  if (!guard.ok) {
    throw new FixtureError('store 路径守卫拒绝：' + guard.problems.join('；'), { code: 'store-path-outside-home', path: targetStorePath, detail: { guard } });
  }

  const storeBefore = readStoreFile({ storePath: targetStorePath });
  const reset = recipe.reset === false
    ? { existed: storeBefore.present, removed: false, skipped: true, storePath: targetStorePath }
    : resetStore({ storePath: targetStorePath });

  const shouldSeed = seedHasContent(recipe) && fault !== 'skip-seed';
  let seed = { written: false, skipped: fault === 'skip-seed', bytes: 0, sha256: null };
  let document = null;
  const faultNotes = [];

  if (shouldSeed) {
    document = buildStoreDocument(recipe);
    seed = { ...writeStoreFile({ storePath: targetStorePath, doc: document }), skipped: false };
  }

  if (fault === 'pollute') {
    // 模拟「上一轮残留 / 外部写入把起始态弄脏」：多一条未声明模板 + 翻转触发方式。
    const base = document ?? buildStoreDocument(recipe);
    const polluted = {
      unit: { ...base.unit },
      global: { ...base.global, hoverTrigger: !(base.global.hoverTrigger === true) },
      tables: {
        customs: { ...base.tables.customs },
        usage: { ...base.tables.usage },
        pinned: { ...base.tables.pinned },
      },
    };
    const pollutionId = 'fx-pollution-' + now.getTime().toString(36);
    polluted.tables.customs[pollutionId] = {
      id: pollutionId,
      name: '未声明模板（故障注入）',
      nameEn: '',
      labels: ['污染'],
      body: 'fault: pollute',
      builtin: false,
      createdAt: 1800000000000,
    };
    seed = { ...writeStoreFile({ storePath: targetStorePath, doc: polluted }), skipped: false };
    document = polluted;
    faultNotes.push('多写一条未声明模板 ' + pollutionId + '，并翻转 hoverTrigger');
  }
  if (fault === 'drop-store') {
    const removed = fs.existsSync(targetStorePath) ? resetStore({ storePath: targetStorePath }) : { existed: false, removed: false };
    faultNotes.push('种子写完后又删除 store（removed=' + removed.removed + '）');
    seed = { ...seed, dropped: true };
  }
  if (fault === 'skip-seed') {
    faultNotes.push('只重置、不写种子');
  }

  const storeAfter = readStoreFile({ storePath: targetStorePath });
  return {
    name: recipe.name,
    storePath: targetStorePath,
    guard,
    declared: recipe.expect,
    applied: {
      reset,
      seed,
      fault,
      faultNotes,
      storeBefore: { present: storeBefore.present, bytes: storeBefore.bytes },
      storeAfter: { present: storeAfter.present, bytes: storeAfter.bytes, error: storeAfter.error },
      document: document === null ? null : { unit: document.unit, global: document.global, tables: summarizeTables(document.tables) },
    },
    storeBefore: { present: storeBefore.present, bytes: storeBefore.bytes },
    storeAfter: { present: storeAfter.present, bytes: storeAfter.bytes, error: storeAfter.error },
  };
}

function summarizeTables(tables) {
  return {
    customs: Object.keys(tables.customs ?? {}),
    usage: tables.usage ?? {},
    pinned: tables.pinned ?? {},
  };
}

/**
 * run.mjs 用的组合入口：加载 → 参数化 → 校验 → 应用。失败抛 FixtureError（会被记 BLOCKED）。
 */
export function prepareFixture({ fixture = 'clean', fixturesDir = DEFAULT_FIXTURES_DIR, homeDir, params = {}, fault = null, now = new Date() } = {}) {
  const raw = loadFixture(fixture, { fixturesDir });
  const recipe = resolveFixture(raw, params);
  validateFixture(recipe);
  const applied = applyFixture({ recipe, homeDir, fault, now });
  return {
    fixture,
    name: recipe.name,
    title: recipe.title ?? null,
    recipe,
    declared: recipe.expect,
    storePath: applied.storePath,
    guard: applied.guard,
    applied: applied.applied,
    storeBefore: applied.storeBefore,
    storeAfter: applied.storeAfter,
  };
}

/* ────────────────────────── HTTP 读回（产品公开路径） ────────────────────────── */

function storeReadError(message, extra = {}) {
  return new FixtureError(message, { code: 'store-read-failed', detail: extra });
}

/**
 * 经宿主 HTTP 桥读回当前 store 快照（GET /_dsh/dsh-prompt/store，同源围栏内）。
 * 返回 { origin, url, http:{status,bytes}, snapshot, baseline, storeFile }。
 */
export async function captureBaselineFromOrigin({
  origin,
  storePath,
  timeoutMs = 15_000,
  retries = 5,
  retryDelayMs = 400,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof origin !== 'string' || !/^https?:\/\//.test(origin)) {
    throw new FixtureError('origin 必须是 http(s) URL：' + JSON.stringify(origin), { code: 'invalid-params', path: 'origin' });
  }
  if (typeof fetchImpl !== 'function') {
    throw new FixtureError('当前 Node 运行时不提供 fetch，无法读回宿主 store', { code: 'invalid-params', path: 'fetch' });
  }
  const url = origin.replace(/\/$/, '') + '/_dsh/dsh-prompt/store';
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    let timer = null;
    try {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      if (controller) timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: { origin, accept: 'application/json' },
        signal: controller ? controller.signal : undefined,
      });
      const text = await response.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch (error) {
        throw storeReadError('宿主 store 读回不是合法 JSON（HTTP ' + response.status + '）：' + text.slice(0, 300));
      }
      if (!body || body.ok !== true || body.value === undefined) {
        throw storeReadError('宿主 store 读回失败（HTTP ' + response.status + '）：' + JSON.stringify(body).slice(0, 500), { status: response.status });
      }
      const file = readStoreFile({ storePath });
      const unit = file.present && file.doc && file.doc.unit !== null && typeof file.doc.unit === 'object' ? { name: file.doc.unit.name, version: file.doc.unit.version } : null;
      return {
        origin,
        url,
        http: { status: response.status, bytes: Buffer.byteLength(text) },
        snapshot: body.value,
        baseline: baselineFromSnapshot(body.value, { storePresent: file.present, unit }),
        storeFile: { present: file.present, bytes: file.bytes },
      };
    } catch (error) {
      lastError = error;
      if (error instanceof FixtureError) throw error;
      if (attempt < retries) await sleep(retryDelayMs);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  const detail = lastError && lastError.message ? lastError.message : String(lastError);
  throw storeReadError('读回宿主 store 失败（重试 ' + retries + ' 次）：' + detail);
}
