/**
 * 边界观测层统一入口（#188 票面 A）：套件只需要拿到一个 `observe` 句柄。
 *
 *   const observer = createObserver(client, { timeouts });
 *   const { raw, surfaces } = await observer.observe();
 *   await observer.waitFor((raw) => raw.panel.visible, { label: '面板打开' });
 *
 * 另提供持久化通道 `createPersistence`（宿主 HTTP 桥 GET /_dsh/dsh-prompt/store，
 * 复用 #187 fixture 的读回与投影），供双通道断言：界面文本（user-visible）↔ store（persisted）。
 *
 * 本入口同时重导出纯函数层，套件/自证只需要记一个模块路径。
 */

import { HarnessError } from '../errors.mjs';
import { captureBaselineFromOrigin } from '../fixture/index.mjs';
import { collectSnapshot, waitForSnapshot, PROBE_VERSION, HOOKS } from './probes.mjs';
import { interpretSnapshot, interpretStore } from './interpret.mjs';

export * from './source.mjs';
export * from './text.mjs';
export * from './compare.mjs';
export * from './interpret.mjs';
export {
  collectSnapshot,
  waitForSnapshot,
  snapshotExpression,
  hitTestExpression,
  scrollLogInstallExpression,
  scrollLogClearExpression,
  scrollLogReadExpression,
  SCROLL_LOG_KEY,
  PROBE_VERSION,
  HOOKS,
} from './probes.mjs';
export { waitForLayoutSettled, layoutSettledExpression } from './settle.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 观测句柄：采集原始快照、等条件成立、解释为分级字段。不做断言。 */
export function createObserver(client, options = {}) {
  if (!client || typeof client.evaluate !== 'function') throw new HarnessError('createObserver 需要 CDP client');
  const timeouts = options.timeouts || {};
  const defaultTimeoutMs = options.defaultTimeoutMs ?? timeouts.panelMs ?? 8_000;
  const defaultPollMs = options.pollMs ?? 100;
  const evaluateTimeoutMs = options.evaluateTimeoutMs ?? timeouts.pageLoadMs ?? 15_000;
  return {
    version: PROBE_VERSION,
    client,
    /** 采集一次原始快照。 */
    snapshot: (snapshotOptions = {}) => collectSnapshot(client, { timeoutMs: evaluateTimeoutMs, ...snapshotOptions }),
    /** 轮询直到 predicate(raw) 为真，返回满足条件的原始快照。 */
    waitFor: (predicate, waitOptions = {}) => waitForSnapshot(client, predicate, {
      timeoutMs: defaultTimeoutMs,
      pollMs: defaultPollMs,
      ...waitOptions,
    }),
    /** 原始快照 → 六个观测面的分级字段（选项透传，如 `{sectionName}`）。 */
    interpret: (raw, interpretOptions) => interpretSnapshot(raw, interpretOptions),
    /** 采集并解释（报告里 raw 与分级字段都留）。 */
    async observe(snapshotOptions = {}, interpretOptions) {
      const raw = await collectSnapshot(client, { timeoutMs: evaluateTimeoutMs, ...snapshotOptions });
      return { raw, surfaces: interpretSnapshot(raw, interpretOptions), at: raw.at };
    },
    /** 持久化通道解释（store 快照 → persisted 字段）。 */
    interpretStore: (snapshot) => interpretStore(snapshot),
  };
}

/**
 * 持久化通道句柄：每次 read 都经宿主公开 HTTP 桥读回并投影为 baseline。
 * waitFor 轮询直到 predicate(baseline) 为真（写入是异步落盘，不能读一次就断言）。
 */
export function createPersistence(options = {}) {
  const { origin, storePath } = options;
  if (typeof origin !== 'string' || !/^https?:\/\//.test(origin)) {
    throw new HarnessError('createPersistence 需要 http(s) origin：' + JSON.stringify(origin));
  }
  if (typeof storePath !== 'string' || !storePath) throw new HarnessError('createPersistence 需要 storePath');
  const timeoutMs = options.timeoutMs ?? 15_000;
  const defaultPollMs = options.pollMs ?? 250;

  async function read() {
    const captured = await captureBaselineFromOrigin({
      origin,
      storePath,
      timeoutMs,
      retries: options.retries ?? 5,
      retryDelayMs: options.retryDelayMs ?? 400,
    });
    return {
      origin,
      url: captured.url,
      at: Date.now(),
      http: captured.http,
      snapshot: captured.snapshot,
      baseline: captured.baseline,
      storeFile: captured.storeFile,
    };
  }

  async function waitFor(predicate, waitOptions = {}) {
    const limit = waitOptions.timeoutMs ?? timeoutMs;
    const pollMs = waitOptions.pollMs ?? defaultPollMs;
    const label = waitOptions.label || 'store 条件成立';
    const started = Date.now();
    let last = null;
    let lastError = null;
    while (Date.now() - started <= limit) {
      try {
        last = await read();
        lastError = null;
        if (predicate(last.baseline, last)) return last;
      } catch (error) {
        lastError = error;
      }
      await sleep(pollMs);
    }
    const tail = lastError
      ? '；读回失败：' + String(lastError.message || lastError)
      : '；末次 baseline=' + JSON.stringify(last && last.baseline);
    throw new HarnessError('等待超时（' + limit + 'ms）：' + label + tail);
  }

  return { origin, storePath, read, waitFor };
}
