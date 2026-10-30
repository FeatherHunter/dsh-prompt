/**
 * 失败产物（票 #189 / 规格 #183「证据与门禁层」）。
 *
 * 规则（与 docs/real/report.md 一致）：
 *   - 每条 FAIL 检查尽量保存**可打开**的产物：截图、页面状态转储、store 转储、输入日志；
 *   - 产物写进 `<evidenceDir>/artifacts/`，报告同时记绝对路径（`file`，供本机直接打开）
 *     与相对路径（`relative`，POSIX 风格且以 `artifacts/` 开头，可安全贴进 issue）；
 *   - 确实拿不到产物时必须写 `artifactsWhy` 说明，报告校验会拒绝「既不产物也不解释」的失败。
 *
 * 本模块不 import 浏览器/宿主模块：句柄由 run.mjs 注入，自证可用假句柄离线验证。
 */

import fs from 'node:fs';
import path from 'node:path';

import { ReportError } from './model.mjs';

/** 自动采集的产物种类（顺序即采集顺序）。 */
export const ARTIFACT_KINDS = ['screenshot', 'page-state', 'store', 'input-log'];

function errorText(error) {
  return String(error && error.message ? error.message : error);
}

function safeSegment(text) {
  const cleaned = String(text ?? '')
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/[^\w.\-\u4e00-\u9fa5]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return cleaned || 'artifact';
}

/**
 * 产物仓库：把文件写进 `<evidenceDir>/artifacts/` 并生成报告用的引用对象。
 * 引用对象形如 {kind, name, file, relative, bytes}，可直接 JSON 序列化。
 */
export function createArtifactStore(evidenceDir) {
  if (typeof evidenceDir !== 'string' || evidenceDir.trim() === '') {
    throw new ReportError('createArtifactStore 需要 evidenceDir');
  }
  const root = path.resolve(evidenceDir);
  const dir = path.join(root, 'artifacts');
  fs.mkdirSync(dir, { recursive: true });
  const used = new Map();

  function nextFileName({ kind = 'artifact', name = '', ext = '.json' } = {}) {
    const base = safeSegment(kind) + '-' + safeSegment(name);
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return base + '-' + count + (ext.startsWith('.') ? ext : '.' + ext);
  }

  /** 为一个将要由外部工具写入的文件预留路径（如 CDP 截图）。 */
  function filePath({ kind = 'artifact', name = '', ext = '.json' } = {}) {
    return path.join(dir, nextFileName({ kind, name, ext }));
  }

  function relativeOf(file) {
    const relative = path.relative(root, path.resolve(file)).split(path.sep).join('/');
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new ReportError('产物文件必须位于 evidence 目录内：' + file);
    }
    return relative;
  }

  /** 把一个已存在的文件登记成产物引用（如 CDP 截图落盘后）。 */
  function refFromFile({ kind = 'artifact', name = '', file } = {}) {
    if (typeof file !== 'string' || file === '') throw new ReportError('registerArtifact 需要 file');
    const absolute = path.resolve(file);
    if (!fs.existsSync(absolute)) throw new ReportError('产物文件不存在：' + absolute);
    const stat = fs.statSync(absolute);
    return { kind, name, file: absolute, relative: relativeOf(absolute), bytes: stat.size };
  }

  function writeContent(file, content) {
    if (Buffer.isBuffer(content) || content instanceof Uint8Array) {
      fs.writeFileSync(file, content);
      return;
    }
    if (typeof content === 'string') {
      fs.writeFileSync(file, content);
      return;
    }
    fs.writeFileSync(file, JSON.stringify(content ?? null, null, 2) + '\n');
  }

  /** 写一份产物（对象默认存 JSON），返回引用对象。 */
  function save({ kind = 'artifact', name = '', content, ext, fileName } = {}) {
    const resolvedExt =
      ext ??
      (Buffer.isBuffer(content) || content instanceof Uint8Array
        ? '.bin'
        : typeof content === 'string'
          ? '.txt'
          : '.json');
    const file = fileName ? path.join(dir, fileName) : path.join(dir, nextFileName({ kind, name, ext: resolvedExt }));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    writeContent(file, content);
    return refFromFile({ kind, name, file });
  }

  return { root, dir, filePath, save, refFromFile, relativeOf };
}

/** 等待句柄返回 Promise 或直接值都接受。 */
async function resolveHandle(fn) {
  return await fn();
}

/**
 * 自动采集失败产物：对「已判定 FAIL、但既没产物也没 artifactsWhy」的检查，
 * 逐一尝试截图 / 页面状态 / store / 输入日志。任何一步失败只记原因，不抛错
 * （报告层不因产物采集失败而炸掉整轮）。
 *
 * @param {object} options
 * @param {import('../evidence.mjs').Recorder} options.recorder
 * @param {object} [options.client]      CDP client（需 screenshot）
 * @param {object} [options.observe]     观测句柄（observe()/snapshot()）
 * @param {object} [options.persistence] 持久化句柄（read()）
 * @param {object} [options.input]       输入驱动句柄（log.read()）
 * @param {number} [options.limit]       最多为几条失败检查采集（默认 8）
 * @returns {Promise<{captured:number, checks:number, failures:string[]}>}
 */
export async function captureFailureArtifacts({ recorder, client, observe, persistence, input, limit = 8 } = {}) {
  if (!recorder || !Array.isArray(recorder.checks)) {
    throw new ReportError('captureFailureArtifacts 需要带 checks 数组的 Recorder');
  }
  const pending = recorder.checks
    .filter((check) => {
      if (!check || check.verdict !== 'FAIL') return false;
      if (check.expected === true) return false; // 预期失败是差分基线，不浪费产物预算
      const hasArtifacts = Array.isArray(check.artifacts) && check.artifacts.length > 0;
      const hasWhy = typeof check.artifactsWhy === 'string' && check.artifactsWhy.trim() !== '';
      return !hasArtifacts && !hasWhy;
    })
    .slice(0, Math.max(0, limit));

  let captured = 0;
  const failures = [];

  for (const check of pending) {
    const reasons = [];
    const refs = [];
    try {
      if (client && typeof client.screenshot === 'function') {
        try {
          const file = recorder.artifactPath({ kind: 'screenshot', name: check.name, ext: '.png' });
          await client.screenshot(file);
          refs.push(recorder.registerArtifact({ kind: 'screenshot', name: check.name, file }));
        } catch (error) {
          reasons.push('截图失败：' + errorText(error));
        }
      } else {
        reasons.push('截图不可用：没有 CDP client 句柄');
      }

      if (observe && (typeof observe.observe === 'function' || typeof observe.snapshot === 'function')) {
        try {
          const state = typeof observe.observe === 'function' ? await resolveHandle(() => observe.observe()) : await observe.snapshot();
          refs.push(recorder.saveArtifact({ kind: 'page-state', name: check.name, content: state }));
        } catch (error) {
          reasons.push('页面状态转储失败：' + errorText(error));
        }
      } else {
        reasons.push('页面状态不可用：没有观测句柄');
      }

      if (persistence && typeof persistence.read === 'function') {
        try {
          const store = await persistence.read();
          refs.push(recorder.saveArtifact({ kind: 'store', name: check.name, content: store }));
        } catch (error) {
          reasons.push('store 转储失败：' + errorText(error));
        }
      } else {
        reasons.push('store 不可用：没有持久化句柄');
      }

      if (input && input.log && typeof input.log.read === 'function') {
        try {
          const log = await input.log.read();
          refs.push(recorder.saveArtifact({ kind: 'input-log', name: check.name, content: log }));
        } catch (error) {
          reasons.push('输入日志转储失败：' + errorText(error));
        }
      } else {
        reasons.push('输入日志不可用：没有输入驱动句柄');
      }
    } catch (error) {
      reasons.push('产物采集异常：' + errorText(error));
    }

    if (refs.length > 0) {
      check.artifacts = refs;
      captured += refs.length;
      if (reasons.length > 0) check.artifactsWhy = '部分产物缺失：' + reasons.join('；');
    } else {
      const why = '自动采集失败：' + (reasons.length > 0 ? reasons.join('；') : '没有可用证据句柄');
      check.artifactsWhy = why;
      failures.push(check.name + '：' + why);
    }
  }

  return { captured, checks: pending.length, failures };
}
