/**
 * 旧产物基线登记表（票 #191 交付物 B 的「可复用基线」部分）。
 *
 * 基线是缓存里的 `.tgz`；仓库只登记**怎么找到它、怎么验它**，不写机器绝对路径：
 * `scripts/real/diffs/baselines.json` 只需要 name / fileName / sha256 / source（来源说明）
 * 与可选 commit/version/note。运行期用 `--baseline-dir`（或 DSH_REAL_BASELINE_DIR）
 * 指向缓存目录，或用 `--baseline-artifact` 直接指路径。
 *
 * 生成方法见 docs/real/diff.md：git worktree add <旧commit> → npm ci → npm run build → npm pack。
 */

import fs from 'node:fs';
import path from 'node:path';

import { HarnessError } from '../errors.mjs';
import { REPO_ROOT } from '../bindings.mjs';

export const BASELINES_SCHEMA_VERSION = 1;
export const BASELINES_PATH = path.join(REPO_ROOT, 'scripts', 'real', 'diffs', 'baselines.json');
export const BASELINE_RECORD_KEYS = Object.freeze(['name', 'fileName', 'sha256', 'version', 'commit', 'source', 'note', 'suites']);

/**
 * 读并校验基线登记表。任何结构问题抛可操作错误（用法/工具问题 → 退出码 2）。
 * @param {string} [filePath]
 */
export function loadBaselineRegistry(filePath = BASELINES_PATH) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new HarnessError(
      '读不到基线登记表：' + filePath + '（' + (error && error.code ? error.code : error && error.message) + '）。' +
        '可用 --baseline-artifact 直接指定旧产物，不必登记。',
    );
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new HarnessError('基线登记表不是合法 JSON：' + filePath + '：' + (error && error.message ? error.message : error));
  }
  return validateBaselineRegistry(json, filePath);
}

export function validateBaselineRegistry(json, label = '<baselines>') {
  const problems = [];
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new HarnessError(label + ' 必须是 JSON 对象');
  }
  if (json.schemaVersion !== BASELINES_SCHEMA_VERSION) {
    problems.push('schemaVersion 必须是 ' + BASELINES_SCHEMA_VERSION);
  }
  for (const key of Object.keys(json)) {
    if (!['schemaVersion', 'notes', 'baselines'].includes(key)) problems.push('未知顶层字段 "' + key + '"');
  }
  if (json.notes !== undefined && (!Array.isArray(json.notes) || json.notes.some((item) => typeof item !== 'string'))) {
    problems.push('notes 必须是字符串数组（可省略）');
  }
  if (!Array.isArray(json.baselines)) {
    problems.push('baselines 必须是数组');
  } else {
    json.baselines.forEach((record, index) => {
      const where = 'baselines[' + index + ']';
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        problems.push(where + ' 必须是对象');
        return;
      }
      for (const key of Object.keys(record)) {
        if (!BASELINE_RECORD_KEYS.includes(key)) problems.push(where + ' 未知字段 "' + key + '"');
      }
      if (typeof record.name !== 'string' || !record.name.trim()) problems.push(where + '.name 必须是非空字符串');
      if (typeof record.fileName !== 'string' || !record.fileName.trim()) problems.push(where + '.fileName 必须是非空字符串');
      if (typeof record.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(record.sha256)) problems.push(where + '.sha256 必须是 64 位十六进制');
      if (typeof record.source !== 'string' || !record.source.trim()) problems.push(where + '.source 必须是非空字符串（说明基线来源，不写机器绝对路径）');
      for (const key of ['version', 'commit', 'note']) {
        if (record[key] !== undefined && typeof record[key] !== 'string') problems.push(where + '.' + key + ' 必须是字符串');
      }
      if (record.suites !== undefined && (!Array.isArray(record.suites) || record.suites.some((item) => typeof item !== 'string'))) {
        problems.push(where + '.suites 必须是字符串数组');
      }
    });
  }
  if (problems.length > 0) {
    throw new HarnessError('基线登记表不合法（' + label + '）：' + problems.join('；'));
  }
  return {
    schemaVersion: json.schemaVersion,
    notes: [...(json.notes ?? [])],
    baselines: json.baselines.map((record) => ({ ...record, sha256: record.sha256.toLowerCase() })),
    source: label,
  };
}

/**
 * 按 name / sha256 / fileName 找登记记录（三者按优先级）。
 * @returns {object|null}
 */
export function findBaselineRecord(registry, { name = null, sha256 = null, fileName = null } = {}) {
  const baselines = (registry && registry.baselines) || [];
  if (name) return baselines.find((record) => record.name === name) ?? null;
  if (fileName) {
    const byFile = baselines.find((record) => record.fileName === fileName);
    if (byFile) return byFile;
  }
  if (sha256) return baselines.find((record) => record.sha256 === String(sha256).toLowerCase()) ?? null;
  return null;
}

export function recordForArtifact(registry, artifact) {
  if (!artifact) return null;
  return findBaselineRecord(registry, { sha256: artifact.sha256, fileName: artifact.fileName });
}

/**
 * 解析旧产物基线路径。
 *
 * 解析顺序：`--baseline-artifact` → `DSH_REAL_BASELINE` → 登记表 + 缓存目录
 * （`--baseline-dir` / `DSH_REAL_BASELINE_DIR`）+ 期望清单 baseline 里声明的 artifactFile/sha256。
 *
 * @param {object} input
 * @param {string|null} input.arg --baseline-artifact
 * @param {string|null} input.name --baseline 登记名
 * @param {object} input.env
 * @param {object|null} input.expect 期望清单（可选，用来按 sha/filename 找登记）
 * @param {string|null} input.baselineDir
 * @param {object|null} input.registry 已加载的登记表（selftest 可注入）
 * @param {(path: string) => boolean} [input.fileExists]
 * @returns {{path: string, resolvedFrom: string, record: object|null}}
 */
export function resolveBaselineArtifact(input) {
  const {
    arg = null,
    name = null,
    env = process.env,
    expect = null,
    baselineDir = null,
    registry = null,
    fileExists = fs.existsSync,
  } = input;
  if (arg) return { path: path.resolve(arg), resolvedFrom: '--baseline-artifact', record: null };
  if (env.DSH_REAL_BASELINE) {
    return { path: path.resolve(env.DSH_REAL_BASELINE), resolvedFrom: 'DSH_REAL_BASELINE', record: null };
  }
  const reg = registry ?? loadBaselineRegistry();
  const wanted = {
    name,
    sha256: expect && expect.baseline ? expect.baseline.sha256 ?? null : null,
    fileName: expect && expect.baseline ? expect.baseline.artifactFile ?? null : null,
  };
  if (!name && !wanted.sha256 && !wanted.fileName) {
    throw new HarnessError(
      '无法解析旧产物基线：给 --baseline-artifact <旧.tgz>，或让 --expect 清单的 baseline 声明 artifactFile/sha256，' +
        '或 --baseline <登记名> + --baseline-dir <缓存目录>（登记表：' + BASELINES_PATH + '）。',
    );
  }
  const record = findBaselineRecord(reg, wanted);
  if (!record) {
    throw new HarnessError(
      'baselines.json 里找不到匹配的基线（name=' + (name ?? '—') + '，sha256=' + (wanted.sha256 ?? '—') +
        '，file=' + (wanted.fileName ?? '—') + '）。先在登记表里补一条 name/fileName/sha256/source，或用 --baseline-artifact 直接指路径。',
    );
  }
  const dirs = [baselineDir, env.DSH_REAL_BASELINE_DIR]
    .filter(Boolean)
    .map((dir) => path.resolve(dir));
  if (dirs.length === 0) {
    throw new HarnessError(
      '基线登记表命中了 ' + record.fileName + '，但没有缓存目录：用 --baseline-dir 或 DSH_REAL_BASELINE_DIR 指向存放该 tgz 的目录，' +
        '或用 --baseline-artifact 直接指路径。',
    );
  }
  for (const dir of dirs) {
    const candidate = path.join(dir, record.fileName);
    if (fileExists(candidate)) return { path: candidate, resolvedFrom: 'baseline cache', record };
  }
  throw new HarnessError(
    '基线缓存里找不到 ' + record.fileName + '（查找目录：' + dirs.join('；') + '）。' +
      '按 docs/real/diff.md 的「旧产物基线生成」生成，或用 --baseline-artifact 指已有文件。',
  );
}

/**
 * 校验产物与登记记录一致（sha256 是硬契约：登记了就必须对得上，避免"以为测的是旧版本"）。
 * @returns {{ok: boolean, problems: string[]}}
 */
export function verifyBaselineRecord(record, artifact) {
  if (!record) return { ok: true, problems: [] };
  const problems = [];
  if (record.sha256 && artifact && artifact.sha256 && record.sha256 !== String(artifact.sha256).toLowerCase()) {
    problems.push('sha256 不符（登记 ' + record.sha256 + '，实际 ' + artifact.sha256 + '）');
  }
  if (record.fileName && artifact && artifact.fileName && record.fileName !== artifact.fileName) {
    problems.push('文件名不符（登记 ' + record.fileName + '，实际 ' + artifact.fileName + '）');
  }
  return { ok: problems.length === 0, problems };
}

/** 报告里只需要来源说明，不需要缓存路径。 */
export function describeBaselineRecord(record) {
  if (!record) return null;
  return {
    name: record.name,
    fileName: record.fileName,
    sha256: record.sha256,
    version: record.version ?? null,
    commit: record.commit ?? null,
    source: record.source,
    note: record.note ?? null,
  };
}
