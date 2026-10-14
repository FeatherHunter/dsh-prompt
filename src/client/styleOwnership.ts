/**
 * dsh-prompt — 运行时 <style> 归属（#146）
 *
 * DSH 宿主用 `<style>` 上的 `data-plugin` 维护样式归属账本：插件物化时认领
 * 所有无归属的 `<style>`，插件重载/回收时删除自己名下的 `<style>`。
 * 自家 6 枚运行时样式（picker 动画 / entry 窄屏 / remote 反馈 / 宿主内容字 / rows / assistant）
 * 共 4 处注入点（hostfont 的三条桥自 #148 起共用本文件的 applyOwnedStyle，不再各写一份拷贝）；
 * 若只写私有标记 `data-dsh-prompt-style` 而不写 `data-plugin`，就会被随后物化的
 * 别的插件误认领、对方重载时被连带删除且不会恢复。
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

// ─────────────────────────────────────────────────────────────────────────────
// 注入缝（#148 从 hostfont 迁入）：查自家段 → 建/收养 → 写 css → 摘除。
// 为什么归这里：本文件就是「运行时 <style> 归属」的唯一缝（#146），注入协议散落各处
// 正是那次漏打归属的成因；三条桥共用这一份后，全包只剩 4 处 createElement，且每处都在账本上。
// 为什么带 doc 参数：调用方一次判完「有没有 DOM」，这里不再各查一遍 globalThis.document；
// 同时让假 DOM（多种 document）可注入，归属逻辑才测得动。
// ─────────────────────────────────────────────────────────────────────────────

/** DOM 句柄（无 DOM / 无 head → null）；调用方拿到 null 即静默 no-op */
export function styleDocument(): any {
  try {
    const g = globalThis as any
    const doc = g && g.document
    if (!doc || typeof doc.createElement !== 'function' || !doc.head) return null
    return doc
  } catch (e) { /* ignore */ }
  return null
}

/** 读元素私有标记（有 getAttribute 走属性，极简 mock 的 attrs 字典兜底） */
function readMarker(el: any): string | null {
  try {
    if (!el) return null
    if (typeof el.getAttribute === 'function') {
      const v = el.getAttribute(STYLE_MARKER_ATTR)
      return typeof v === 'string' ? v : null
    }
    const v = el.attrs && el.attrs[STYLE_MARKER_ATTR]
    return typeof v === 'string' ? v : null
  } catch (e) { /* ignore */ }
  return null
}

/**
 * 查自家样式段：选择器命中后**复核私有标记逐字相等**。
 * 复核是必要的：选择器盲的假 DOM（老测试桩 `querySelector: () => head[0]`）会返回别家段，
 * 不核对就会改写/摘掉别家桥的样式；宁可当作没找到（新建一份），也绝不误伤非自家 <style>。
 */
export function findOwnedStyle(doc: any, markerId: string): any {
  try {
    if (typeof doc.querySelector !== 'function') return null
    const el = doc.querySelector(selectorForMarker(markerId))
    return readMarker(el) === markerId ? el : null
  } catch (e) { /* ignore */ }
  return null
}

/** 同标记的其余副本（双份 bundle / 外部克隆会留下旧值副本；同权重时文档更后者胜 ⇒ 必须清掉） */
function extraOwnedStyles(doc: any, markerId: string): any[] {
  const out: any[] = []
  try {
    if (typeof doc.querySelectorAll !== 'function') return out
    const all = doc.querySelectorAll(selectorForMarker(markerId))
    if (!all || typeof all.length !== 'number') return out
    for (let i = 0; i < all.length; i++) if (readMarker(all[i]) === markerId) out.push(all[i])
  } catch (e) { /* ignore */ }
  return out
}

function removeTag(el: any): void {
  try {
    if (!el) return
    if (el.parentNode && typeof el.parentNode.removeChild === 'function') el.parentNode.removeChild(el)
    else if (typeof el.remove === 'function') el.remove()
  } catch (e) { /* ignore */ }
}

/**
 * 写入/更新自家样式段（幂等）。同值短路：偏好变更（滑块每档一次）会反复调到，
 * 同 css 不重写 textContent，免掉无谓的样式重算。
 */
export function applyOwnedStyle(doc: any, markerId: string, css: string): void {
  try {
    const prev = findOwnedStyle(doc, markerId)
    if (prev) {
      // 更新边（#146 补丁 1b）：改 css 的同时补归属，无主旧 tag 就地转正。
      ensureOwnedStyleTag(prev)
      if (prev.textContent !== css) {
        try {
          prev.textContent = css
        } catch (e) { /* ignore */ }
      }
      for (const dup of extraOwnedStyles(doc, markerId)) if (dup !== prev) removeTag(dup)
      return
    }
  } catch (e) { /* ignore → 走新建 */ }
  try {
    const tag = doc.createElement('style')
    if (!tag || typeof tag.setAttribute !== 'function') return
    markOwnedStyleTag(tag)
    tag.setAttribute(STYLE_MARKER_ATTR, markerId)
    try {
      tag.textContent = css
    } catch (e) { /* ignore */ }
    doc.head.appendChild(tag)
    for (const dup of extraOwnedStyles(doc, markerId)) if (dup !== tag) removeTag(dup)
  } catch (e) { /* ignore */ }
}

/** 摘自家样式段（幂等：不在也不抛；同标记的多余副本一并清） */
export function dropOwnedStyle(doc: any, markerId: string): void {
  try {
    const first = findOwnedStyle(doc, markerId)
    if (first) removeTag(first)
    for (const dup of extraOwnedStyles(doc, markerId)) removeTag(dup)
  } catch (e) { /* ignore */ }
}
