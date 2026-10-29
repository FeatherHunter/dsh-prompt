/**
 * 真机 kit 的错误分类。
 *
 * - HarnessError：工具/环境/装配环节失败（找不到浏览器、装不上插件、服务起不来……）。
 *   这类失败不能算产品 FAIL，报告里记 BLOCKED。
 * - CheckFailure：断言失败，说明被测行为与期望不符。
 *   这类失败记 FAIL，并且必须能重放（T5 会补六元组）。
 */

export class HarnessError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'HarnessError';
    this.code = options.code ?? 'HARNESS';
    this.detail = options.detail ?? null;
  }
}

export class CheckFailure extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'CheckFailure';
    this.expected = options.expected ?? null;
    this.observed = options.observed ?? null;
    this.detail = options.detail ?? null;
  }
}
