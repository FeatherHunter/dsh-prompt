/**
 * dsh-prompt — 运行时 <style> 归属（#146）
 *
 * DSH 宿主用 `<style>` 上的 `data-plugin` 维护样式归属账本：插件物化时认领
 * 所有无归属的 `<style>`，插件重载/回收时删除自己名下的 `<style>`。
 * 自家 5 处运行时注入（picker 动画 / entry 窄屏 / remote 反馈 / rows / assistant）
 * 若只写私有标记 `data-dsh-prompt-style` 而不写 `data-plugin`，就会被随后物化的
 * 任意插件误认领、对方重载时被连带删除且不会恢复。
 *
 * 约定（对抗审查补丁已认可）：
 * - 归属键恒为包名，唯一真相 = `package.json:name` = `cordis.patch.yml:id/name`
 *   （= `dsh-prompt`），收敛在此单常量，不在各注入点散写字面量；
 * - 私有标记 `data-dsh-prompt-style` 保留（幂等/排查用），查询键
 *   `style[data-dsh-prompt-style="..."]` 保持不变（现有 test-issue-66/112 mock
 *   靠它精确匹配）；
 * - 只给自家样式打标，禁止触碰非自家 `<style>`；
 * - 全程 fail-soft：无 DOM / 方法缺席 / 异常一律静默，不影响调用方渲染，
 *   不记新日志、不进持久化。
 */

export const STYLE_OWNER_ID = 'dsh-prompt'
export const STYLE_OWNER_ATTR = 'data-plugin'
export const STYLE_MARKER_ATTR = 'data-dsh-prompt-style'

/** 查询键（与历史字面量逐字一致）：style[data-dsh-prompt-style="<marker>"] */
export function selectorForMarker(markerId: string): string {
  return 'style[' + STYLE_MARKER_ATTR + '="' + markerId + '"]'
}

function readOwner(el: any): string | null {
  try {
    if (!el) return null
    if (typeof el.getAttribute === 'function') {
      const v = el.getAttribute(STYLE_OWNER_ATTR)
      return typeof v === 'string' ? v : v == null ? null : String(v)
    }
    if (el.attrs && typeof el.attrs === 'object') {
      const v = (el.attrs as any)[STYLE_OWNER_ATTR]
      return typeof v === 'string' ? v : v == null ? null : String(v)
    }
    if (el.dataset && typeof el.dataset === 'object') {
      const v = (el.dataset as any).plugin
      return typeof v === 'string' ? v : v == null ? null : String(v)
    }
  } catch (e) { /* ignore */ }
  return null
}

/** 是否已正确归属（值全等于归属键） */
export function isOwnedStyleTag(el: unknown): boolean {
  try {
    return readOwner(el as any) === STYLE_OWNER_ID
  } catch (e) {
    return false
  }
}

/**
 * 打上归属（新建边用；幂等，可重复调用）。
 * 先写 `data-plugin` 再写私有标记是调用方的顺序，本函数只保证归属位正确。
 */
export function markOwnedStyleTag(el: unknown): void {
  try {
    const tag = el as any
    if (!tag) return
    if (typeof tag.setAttribute === 'function') {
      try {
        tag.setAttribute(STYLE_OWNER_ATTR, STYLE_OWNER_ID)
      } catch (e) { /* ignore */ }
      return
    }
    // 极简 mock 只有 attrs 字典（无 setAttribute）时的兜底
    try {
      if (tag.attrs && typeof tag.attrs === 'object') {
        ;(tag.attrs as any)[STYLE_OWNER_ATTR] = STYLE_OWNER_ID
      }
    } catch (e) { /* ignore */ }
  } catch (e) { /* fail-soft */ }
}

/**
 * 保证归属正确（收养边 / 更新边 / 闩命中边用）：
 * 已正确归属则 no-op，否则补上。永不抛。
 */
export function ensureOwnedStyleTag(el: unknown): void {
  try {
    if (isOwnedStyleTag(el)) return
    markOwnedStyleTag(el)
  } catch (e) { /* fail-soft */ }
}
