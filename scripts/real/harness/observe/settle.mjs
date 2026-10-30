/**
 * 布局落定等待（#183 评审整改 F1）：原先写在 boundary 套件里，现在属于观测层设施。
 *
 * 为什么需要它：产品行为（#82 直达）决定「点底栏设置入口」后插件会程序化点宿主设置导航，
 * 并把远程段滚进视野（`src/client/index.ts` goSettings 里 200ms 轮询 + scrollIntoView），
 * 滚动可能发生在设置弹窗出现之后，让刚刚采集的控件几何瞬间过期。
 * 这里按「目标控件矩形 + 页面滚动日志长度连续两拍不变」判稳；超时也继续
 * （点击前还有 elementFromPoint 命中验证兜底），不把「等待落定」当产品结论。
 *
 * 本文件只读页面状态、不写期望：套件负责把结果记进 observations，判定仍由套件的
 * 物理点击 + 命中验证 + 观测等待完成。
 */

import { SCROLL_LOG_KEY } from './probes.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 构造「布局落定采样」页面表达式：读目标控件矩形与滚动日志长度。
 * 单独导出便于自证与复用（表达式必须自包含、只读）。
 */
export function layoutSettledExpression(selector, scrollLogKey = SCROLL_LOG_KEY) {
  return (
    '(function () {' +
    '  const node = document.querySelector(' + JSON.stringify(selector) + ');' +
    '  const rect = node ? node.getBoundingClientRect() : null;' +
    '  const log = window.' + scrollLogKey + ' || [];' +
    '  return { rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null, scrollCount: log.length };' +
    '})()'
  );
}

/**
 * 等目标控件与页面滚动日志连续两拍不变。
 *
 * @param {object} options
 * @param {object} options.client   CDP 客户端（必须）
 * @param {object} [options.observe] 观测句柄（保留给调用方传同一套句柄，便于日后在这里采集快照）
 * @param {string} [options.selector='[data-dsh-prompt-trigger]'] 目标控件选择器
 * @param {number} [options.attempts=25] 采样上限
 * @param {number} [options.intervalMs=150] 采样间隔
 * @param {string} [options.scrollLogKey=SCROLL_LOG_KEY] 滚动日志键
 * @param {(sample: object) => void} [options.logger] 每次采样的可选记录器（诊断用，只记录不判定）
 * @returns {Promise<{samples:number, settled:boolean, attempts:number, key:string|null, scrollCount:number}>}
 */
export async function waitForLayoutSettled(options = {}) {
  const { client, observe, selector = '[data-dsh-prompt-trigger]', attempts = 25, intervalMs = 150, logger } = options;
  const scrollLogKey = options.scrollLogKey || SCROLL_LOG_KEY;
  if (!client || typeof client.evaluate !== 'function') {
    throw new Error('waitForLayoutSettled 需要带 evaluate 的 client（CDP 客户端）');
  }
  const expression = layoutSettledExpression(selector, scrollLogKey);
  let previous = null;
  let scrollCount = -1;
  let stable = 0;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const sample = await client.evaluate(expression, { returnByValue: true });
    const key = sample && sample.rect ? sample.rect.x + ',' + sample.rect.y : 'none';
    const unchanged = previous !== null && key === previous && sample && sample.scrollCount === scrollCount;
    if (logger) {
      try {
        logger({ attempt, key, scrollCount: sample ? sample.scrollCount : null, unchanged, observe });
      } catch (error) {
        /* 记录器异常不影响等待本身 */
      }
    }
    previous = key;
    scrollCount = sample ? sample.scrollCount : -1;
    if (unchanged) {
      stable += 1;
      if (stable >= 2) {
        return { samples: attempt + 1, settled: true, attempts, key, scrollCount };
      }
    } else {
      stable = 0;
    }
    await sleep(intervalMs);
  }
  return { samples: attempts, settled: false, attempts, key: previous, scrollCount };
}
