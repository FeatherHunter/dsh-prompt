/**
 * 故障注入会话（票 #191 交付物 C 的门面）。
 *
 * run.mjs 在套件开始前调用 `applyFaults({ ids, handles })`：
 * - 返回**替换后的句柄**（observe/input/persistence 可能被包装）与注入器元数据；
 * - 全部注入器按顺序安装，任一失败则逆序回滚已装好的，再抛错（不把半截状态留给套件）；
 * - `uninstall()` 逆序卸载并把页面内计数（命中次数/被拒请求等）一并带回。
 *
 * 没有 `--fault` 时 run.mjs 根本不调用本模块 → 默认路径零影响。
 */

import { HarnessError } from '../errors.mjs';
import {
  INJECTORS,
  INJECTOR_IDS,
  assertKnownFaultIds,
  describeInjector,
  getInjector,
  listInjectors,
  parseFaultIds,
} from './injectors.mjs';

export { INJECTORS, INJECTOR_IDS, assertKnownFaultIds, describeInjector, getInjector, listInjectors, parseFaultIds };

export function faultMetadata(ids) {
  return ids.map((id) => describeInjector(getInjector(id)));
}

/**
 * 安装一组注入器。
 * @param {{ids: string[], handles: {client: object, observe: object, input: object, persistence: object}}} input
 * @returns {Promise<{handles: object, original: object, injectors: object[], evidence: object, uninstall: Function}>}
 */
export async function applyFaults({ ids, handles }) {
  const faultIds = assertFaultIds(ids);
  const original = { ...handles };
  let current = { ...handles };
  const installed = [];
  const evidence = {};
  try {
    for (const id of faultIds) {
      const injector = getInjector(id);
      const result = await injector.install(current);
      installed.push({ injector, result });
      evidence[id] = result.evidence ?? null;
      if (result.handles) current = { ...current, ...result.handles };
    }
  } catch (error) {
    // 半装状态回滚，保持"要么全装、要么全不装"。
    for (const item of installed.reverse()) {
      try {
        await item.result.uninstall();
      } catch {
        /* 回滚失败也不能掩盖原始安装错误 */
      }
    }
    throw error;
  }
  return {
    handles: current,
    original,
    injectors: faultMetadata(faultIds),
    evidence,
    async uninstall() {
      const results = {};
      for (const item of installed.reverse()) {
        try {
          results[item.injector.id] = await item.result.uninstall();
        } catch (error) {
          results[item.injector.id] = { restored: false, error: String(error && error.message ? error.message : error) };
        }
      }
      return { results, evidence };
    },
  };
}

function assertFaultIds(ids) {
  if (!Array.isArray(ids)) throw new HarnessError('故障注入器列表必须是数组');
  if (ids.length === 0) return [];
  const seen = new Set();
  for (const id of ids) {
    if (typeof id !== 'string' || id === '') throw new HarnessError('故障注入器 id 必须是非空字符串：' + JSON.stringify(id));
    if (seen.has(id)) throw new HarnessError('重复的故障注入器：' + id);
    seen.add(id);
    if (!INJECTOR_IDS.includes(id)) {
      throw new HarnessError('未知故障注入器：' + id + '。可用：' + INJECTOR_IDS.join(', '));
    }
  }
  return [...ids];
}
