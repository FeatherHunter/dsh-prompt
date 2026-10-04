/**
 * dsh-prompt — 无 DOM 分页纯模型（#115，仿 remoteView.ts 纯视图契约）
 *
 * 只做整数页数学：不读 store、不碰 DOM/React，可转译后直接断言（见 test-issue-104 纯函数段）。
 * 测量（容器宽÷项宽、卡高）发生在调用方（picker.ts 量、ResizeObserver 重算），本模块只收数字。
 * 与 Q3b 联动：tab 定宽是均匀页的前提；若后人改回内容宽，页边界须改累计宽模型。
 */

export const PAGER_DEFAULT_PER_PAGE = 3

/** 总页数：0 项 → 0 页；perPage 非法 → 按 1 算 */
export function pageCount(total: unknown, perPage: unknown): number {
  const t = typeof total === 'number' && isFinite(total) ? Math.max(0, Math.floor(total)) : 0
  let p = typeof perPage === 'number' && isFinite(perPage) ? Math.floor(perPage) : NaN
  if (!(p >= 1)) p = 1
  if (t === 0) return 0
  return Math.ceil(t / p)
}

/** 页钳制：total=0 恒回 0；否则钳进 [0, pageCount-1]；页非法回 0 */
export function clampPage(page: unknown, total: unknown, perPage: unknown): number {
  const n = pageCount(total, perPage)
  if (n <= 0) return 0
  const v = typeof page === 'number' && isFinite(page) ? Math.floor(page) : 0
  if (v < 0) return 0
  if (v > n - 1) return n - 1
  return v
}

/** 项所在页（均匀项）：index 非法 → 0；perPage 非法 → 按 1 算 */
export function pageOf(index: unknown, perPage: unknown): number {
  let p = typeof perPage === 'number' && isFinite(perPage) ? Math.floor(perPage) : NaN
  if (!(p >= 1)) p = 1
  const i = typeof index === 'number' && isFinite(index) ? Math.floor(index) : 0
  if (i < 0) return 0
  return Math.floor(i / p)
}

/** 页内起止 [start, end）：调用方 slice 用；页非法先钳 */
export function pageRange(page: unknown, total: unknown, perPage: unknown): { start: number; end: number } {
  const t = typeof total === 'number' && isFinite(total) ? Math.max(0, Math.floor(total)) : 0
  let p = typeof perPage === 'number' && isFinite(perPage) ? Math.floor(perPage) : NaN
  if (!(p >= 1)) p = 1
  const c = clampPage(page, t, p)
  const start = c * p
  return { start, end: Math.min(start + p, t) }
}

/** 按量出像素算每页项数：floor(容器宽÷项宽)，至少 1；量不到回 fallback（测试/无 DOM 环境） */
export function perPageFromMeasure(containerPx: unknown, itemPx: unknown, fallback: unknown): number {
  const fb = typeof fallback === 'number' && isFinite(fallback) && Math.floor(fallback) >= 1
    ? Math.floor(fallback)
    : PAGER_DEFAULT_PER_PAGE
  const c = typeof containerPx === 'number' && isFinite(containerPx) ? containerPx : NaN
  const it = typeof itemPx === 'number' && isFinite(itemPx) ? itemPx : NaN
  if (!(c > 0) || !(it > 0)) return fb
  const n = Math.floor(c / it)
  return n >= 1 ? n : 1
}
