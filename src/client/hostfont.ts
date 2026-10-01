/**
 * dsh-prompt — 宿主内容字桥（#92 野路子，用户拍板已知局限：px 定死区不跟随；
 * #103 野路子三期：主会话 AI 定死区改 targeted zoom 覆盖，局限关闭）。
 *
 * - 开远程后 DSH 宿主内容字按档位等比动（hostContentFontPx），关远程恢复原样（两边 removeProperty）。
 * - 落点 documentElement + body 双写：body 行内即时赢下 cascade（派生链定义在 body 上，
 *   行内优先级最高）；documentElement（:root）写入不被 theme/change 重放 смыв，
 *   作 body 行内被重放覆盖时的兜底与恢复语义的对称点。关即两边 removeProperty 回宿主真相。
 * - 本文件是唯一的 DOM 接触点；remoteView.ts 保持纯函数（禁 DOM/宿主调用）。
 * - 全程守卫 + try/catch fail-soft，不抛（单测无 DOM 时静默 no-op）。
 */
import { hostContentFontPx, remoteSizeScale } from './remoteView'

const HOST_CONTENT_FONT_VAR = '--dsh-content-font-size'

/** 工作区列表跟随样式钩（D-targeted，自家 style 注入惯例见 button.ts 窄屏/反馈样式） */
const ROWS_STYLE_ID = 'dsh-prompt-remote-rows'
/** 只用稳定选择器：行自带 data-row-key（session:/workspace:，宿主自用），哈希类名一律不写 */
const ROWS_SELECTOR = '[data-row-key^="session:"],[data-row-key^="workspace:"]'

/** 主会话 AI 跟随样式钩（#103：与 ROWS 同体例的第三条桥） */
const ASSISTANT_STYLE_ID = 'dsh-prompt-remote-assistant'
/**
 * 只用稳定选择器：宿主会话流以 data-chat-group-part="response" 标 AI 响应组
 *（0.2.0-rc.2 app.asar 实测；用户组另标 user/steering，不在内）。
 * 哈希类名（随发版可变的混淆类名）一律不写；
 * data-markdown-variant 仅标 compact，不标常规正文，不用它做主钩。
 */
const ASSISTANT_SELECTOR = '[data-chat-group-part="response"]'

function collectStyleTargets(): any[] {
  const out: any[] = []
  try {
    const g = globalThis as any
    const doc = g && g.document
    if (!doc) return out
    try {
      if (doc.documentElement && doc.documentElement.style) out.push(doc.documentElement.style)
    } catch (e) { /* ignore */ }
    try {
      if (doc.body && doc.body.style) out.push(doc.body.style)
    } catch (e) { /* ignore */ }
  } catch (e) { /* ignore */ }
  return out
}

/**
 * 同步宿主内容字（fail-soft，不抛）：
 * - enabled=true → 双写变量为 hostContentFontPx(size) + 'px'；
 * - 其它（含关/非法）→ 两边 removeProperty（恢复宿主原样）。
 * 无 DOM（typeof document 缺席 / element 缺席）时静默 no-op。
 */
export function syncHostFont(enabled: unknown, size: unknown): void {
  try {
    if (typeof document === 'undefined') {
      try {
        const g = globalThis as any
        if (!g || !g.document) return
      } catch (e) {
        return
      }
    }
    const targets = collectStyleTargets()
    if (targets.length === 0) return
    if (enabled !== true) {
      for (const st of targets) {
        try {
          if (st && typeof st.removeProperty === 'function') st.removeProperty(HOST_CONTENT_FONT_VAR)
        } catch (e) { /* ignore */ }
      }
      return
    }
    let px = '14px'
    try {
      px = hostContentFontPx(size) + 'px'
    } catch (e) {
      px = '14px'
    }
    for (const st of targets) {
      try {
        if (st && typeof st.setProperty === 'function') st.setProperty(HOST_CONTENT_FONT_VAR, px)
      } catch (e) { /* ignore */ }
    }
  } catch (e) { /* fail-soft：宿主字桥永不影响自家面 */ }
}

/**
 * 工作区列表跟随（D-targeted，野路子二期，用户拍板）：
 * - 工作区会话列表走 C 类硬编码（faucet 零引用），变量桥够不着，只能 targeted 覆盖；
 * - rem/px 体系下唯一能动硬编码 px 文字的纯 CSS 手段是 zoom（Chromium/Electron 支持），
 *   zoom 缩行整体（含命中区，触控正好），因子取档位全额 remoteSizeScale；
 * - 开→注入/更新自家 <style>（幂等：先查后建），关/非法→摘掉恢复原样；
 * - 全程守卫 + try/catch fail-soft，不抛，无新日志事件（沿用 setRemoteEnabled/Size 已有事件）。
 */
export function syncRemoteRows(enabled: unknown, size: unknown): void {
  try {
    const g = globalThis as any
    const doc = g && g.document
    if (!doc || typeof doc.createElement !== 'function' || !doc.head) return
    const sel = 'style[data-dsh-prompt-style="' + ROWS_STYLE_ID + '"]'
    const find = (): any => {
      try {
        return typeof doc.querySelector === 'function' ? doc.querySelector(sel) : null
      } catch (e) {
        return null
      }
    }
    const remove = (): void => {
      try {
        const el = find()
        if (!el) return
        if (el.parentNode && typeof el.parentNode.removeChild === 'function') el.parentNode.removeChild(el)
        else if (typeof el.remove === 'function') el.remove()
      } catch (e) { /* ignore */ }
    }
    if (enabled !== true) {
      remove()
      return
    }
    let scale = 1
    try {
      scale = remoteSizeScale(size)
    } catch (e) {
      scale = NaN as unknown as number
    }
    if (typeof scale !== 'number' || !isFinite(scale) || scale <= 0) {
      remove()
      return
    }
    const css = ROWS_SELECTOR + '{zoom:' + scale + ';}'
    try {
      const prev = find()
      if (prev) {
        try {
          prev.textContent = css
        } catch (e) { /* ignore */ }
        return
      }
    } catch (e) { /* ignore → 走新建 */ }
    try {
      const tag = doc.createElement('style')
      if (!tag || typeof tag.setAttribute !== 'function') return
      tag.setAttribute('data-dsh-prompt-style', ROWS_STYLE_ID)
      try {
        tag.textContent = css
      } catch (e) { /* ignore */ }
      doc.head.appendChild(tag)
    } catch (e) { /* ignore */ }
  } catch (e) { /* fail-soft：行跟随永不影响自家面 */ }
}

/**
 * 主会话 AI 跟随（#103，野路子三期，用户拍板突破整机政策）：
 * - 0.2.0-rc.2 起主会话 AI 正文走定死 --dsw-font-xs-13（13px）+ 标题/code 定死 px，
 *   变量桥（--dsh-content-font-size）够不着，只能 targeted 覆盖；
 * - 与 syncRemoteRows 同理：rem/px 体系下唯一能动硬编码 px 文字的纯 CSS 手段是 zoom，
 *   zoom 缩响应组整体（含命中区，触控正好），因子取档位全额 remoteSizeScale；
 * - 开→注入/更新自家 <style>（幂等：先查后建），关/非法→摘掉恢复原样；
 * - 选择器只走稳定 data-chat-group-part="response"（AI 响应组；用户组另标，不在内），
 *   哈希类名一律不写；旧宿主无此属性时自然 no-op（选择器命中空，变量桥仍覆盖旧链路）；
 * - 全程守卫 + try/catch fail-soft，不抛，无新日志事件（沿用 setRemoteEnabled/Size 已有事件）。
 */
export function syncAssistantZoom(enabled: unknown, size: unknown): void {
  try {
    const g = globalThis as any
    const doc = g && g.document
    if (!doc || typeof doc.createElement !== 'function' || !doc.head) return
    const sel = 'style[data-dsh-prompt-style="' + ASSISTANT_STYLE_ID + '"]'
    const find = (): any => {
      try {
        return typeof doc.querySelector === 'function' ? doc.querySelector(sel) : null
      } catch (e) {
        return null
      }
    }
    const remove = (): void => {
      try {
        const el = find()
        if (!el) return
        if (el.parentNode && typeof el.parentNode.removeChild === 'function') el.parentNode.removeChild(el)
        else if (typeof el.remove === 'function') el.remove()
      } catch (e) { /* ignore */ }
    }
    if (enabled !== true) {
      remove()
      return
    }
    let scale = 1
    try {
      scale = remoteSizeScale(size)
    } catch (e) {
      scale = NaN as unknown as number
    }
    if (typeof scale !== 'number' || !isFinite(scale) || scale <= 0) {
      remove()
      return
    }
    const css = ASSISTANT_SELECTOR + '{zoom:' + scale + ';}'
    try {
      const prev = find()
      if (prev) {
        try {
          prev.textContent = css
        } catch (e) { /* ignore */ }
        return
      }
    } catch (e) { /* ignore → 走新建 */ }
    try {
      const tag = doc.createElement('style')
      if (!tag || typeof tag.setAttribute !== 'function') return
      tag.setAttribute('data-dsh-prompt-style', ASSISTANT_STYLE_ID)
      try {
        tag.textContent = css
      } catch (e) { /* ignore */ }
      doc.head.appendChild(tag)
    } catch (e) { /* ignore */ }
  } catch (e) { /* fail-soft：AI 跟随永不影响自家面 */ }
}
