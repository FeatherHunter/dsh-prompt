/**
 * dsh-prompt — 宿主内容字桥（#92 功能，机制 #148 重做）
 *
 * 目标（#92 用户拍板保留）：开远程后 DSH 宿主内容字按档位等比动，关远程恢复原样。
 * 机制（#148）：**声明式覆盖，零宿主状态写入**——
 * - 开 → 注入/更新自家 <style data-plugin>：body{--dsh-content-font-size:<hostContentFontPx>px !important;}
 * - 关 → 摘掉自家 <style>。宿主行内值当即原样可见，无需快照、无需回滚、无需判定“宿主后来写没写”。
 * - 注入缝不在本文件：`<style>` 的建/收养/更新/摘除归 styleOwnership.ts 的
 *   applyOwnedStyle / dropOwnedStyle（#146 归属账本），本文件只决定“写什么 CSS、什么时候写”。
 *   三条桥共用同一份协议，本包不再有第三份拷贝——#146 的漏打归属正是“多份拷贝漂移”的产物。
 *
 * 为什么是 !important 覆盖而不是直接写变量（#148 实测，Chromium 8 项断言）：
 * - 这个变量的所有者是宿主：`ThemePresenter.apply` 每次 `theme/change` 都重放 body 行内
 *   `setProperty`，只有 `dispose()` 才 `removeProperty`（注释原文 “Body variable carrying the
 *   user's content font size in px.”）；宿主另有读回者 `bootstrapFontSize()` 读
 *   `body.style.getPropertyValue('--dsh-content-font-size')`（越界回 14）。
 *   插件写进去 = 写别人的状态：关远程时 `removeProperty` 删掉的是宿主的值（#148 报的就是这个），
 *   而下一次主题重放又会把插件的值冲掉（“谁后写谁赢”，宿主有持续重放权，插件没有）。
 * - 作者样式表的 !important 声明在 cascade 上高于行内**普通**声明
 *   （CSS Cascade 4：important author > 行内）；实测：宿主行内 17px + 自家 !important 42px
 *   → 算得 42px，且宿主行内 17px 原样保留；宿主随后重写 16px 仍被自家规则压住（重放免疫）；
 *   摘掉自家 <style> 当即回到宿主值。research/host-font-scale-bridge.md:29
 *   “行内样式优先级高于任何样式表规则，插件靠样式表覆盖赢不了水龙头”只在**普通**声明下成立。
 *   复跑用探针：research/probe-hostfont-cascade.html（自包含，headless Chrome `--dump-dom` 即出结论）。
 * - 落点必须是 body：:root 规则会被 body 行内值在 body 及其整棵子树赢掉（实测），
 *   旧稿的 documentElement 双写是无的放矢（宿主从不写 :root）。
 * - 派生链自动跟随：宿主在 body 的声明里由本变量推导 --dsh-content-font-delta /
 *   --dsh-content-font-size-secondary / --dsh-content-font-delta-secondary /
 *   --dsw-font-markdown-base-font-size 等（gradient-shadow-text.css），覆盖上游即整链等比。
 * - 已知局限（#92 拍板保留，非本票范围）：宿主定死 px 处不跟（small/code 阶梯）；#103 已用
 *   zoom 另行覆盖 AI 响应区。
 * - 已知交互（#148 审查记，待维护者裁定，本票未改）：重放免疫是双向的——远程开着时用户在
 *   「设置→通用→字号大小」改的值不会立即见效（关远程即见）；且自家面 scaledBaseFontSize 锚的
 *   --dsw-font-markdown-base-font-size 由被覆盖的这个变量派生 ⇒ 远程开时自家面吃两遍档位
 *   （实测覆盖值 5 档 = 42px，自家面 calc(42px × 3) = 126px，非本票引入、旧稿同样成立，
 *   但旧稿会被宿主重放打回而自限，现为常驻）。见 issue #148 的 Q2 / follow-up。
 * - 本文件是唯一的 DOM 接触点；remoteView.ts 保持纯函数（禁 DOM/宿主调用）。
 * - 全程守卫 + try/catch fail-soft，不抛（单测无 DOM 时静默 no-op）。
 */
import { hostContentFontPx, remoteSizeScale } from './remoteView'
import { applyOwnedStyle, dropOwnedStyle, styleDocument } from './styleOwnership'

const HOST_CONTENT_FONT_VAR = '--dsh-content-font-size'
/** 宿主内容字覆盖段的自家 style 钩 */
const HOST_FONT_STYLE_ID = 'dsh-prompt-remote-hostfont'

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

/** 档位倍数（非法 / 非正 / 非有限 → null，调用方按“摘掉”处理） */
function zoomScale(size: unknown): number | null {
  let scale: unknown = NaN
  try {
    scale = remoteSizeScale(size)
  } catch (e) {
    scale = NaN
  }
  if (typeof scale !== 'number' || !isFinite(scale) || scale <= 0) return null
  return scale
}

/**
 * 同步宿主内容字（fail-soft，不抛）：
 * - enabled=true 且档位是有限数值 → 覆盖变量为 hostContentFontPx(size) + 'px'（!important，压住宿主 body 行内）；
 * - 其它（关 / 非法档位）→ 摘掉自家覆盖段，宿主原值当即生效。
 *   非法档位按“摘掉”而不落 14px：宿主内容字可能被用户设成 18~22px，覆盖成 14px 等于以覆盖方式
 *   改写宿主的有效字号（与另两条桥的非法档语义也对齐）。
 * **永不读写宿主行内样式**（#148：那是宿主的状态，写它即删除宿主真相）。
 * 无 DOM（typeof document 缺席 / head 缺席）时静默 no-op。
 */
export function syncHostFont(enabled: unknown, size: unknown): void {
  try {
    const doc = styleDocument()
    if (!doc) return
    if (enabled !== true || typeof size !== 'number' || !isFinite(size)) {
      dropOwnedStyle(doc, HOST_FONT_STYLE_ID)
      return
    }
    const px = hostContentFontPx(size) + 'px'
    applyOwnedStyle(doc, HOST_FONT_STYLE_ID, 'body{' + HOST_CONTENT_FONT_VAR + ':' + px + ' !important;}')
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
    const doc = styleDocument()
    if (!doc) return
    if (enabled !== true) {
      dropOwnedStyle(doc, ROWS_STYLE_ID)
      return
    }
    const scale = zoomScale(size)
    if (scale === null) {
      dropOwnedStyle(doc, ROWS_STYLE_ID)
      return
    }
    applyOwnedStyle(doc, ROWS_STYLE_ID, ROWS_SELECTOR + '{zoom:' + scale + ';}')
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
    const doc = styleDocument()
    if (!doc) return
    if (enabled !== true) {
      dropOwnedStyle(doc, ASSISTANT_STYLE_ID)
      return
    }
    const scale = zoomScale(size)
    if (scale === null) {
      dropOwnedStyle(doc, ASSISTANT_STYLE_ID)
      return
    }
    applyOwnedStyle(doc, ASSISTANT_STYLE_ID, ASSISTANT_SELECTOR + '{zoom:' + scale + ';}')
  } catch (e) { /* fail-soft：AI 跟随永不影响自家面 */ }
}

/**
 * 卸载/回收清场（#148 审查补）：覆盖段必须有一条**插件侧**摘除路径。
 * 只靠宿主账本兜底的话，一旦 data-plugin 归属哪天失配（#146 立论所依赖的假设），
 * 这个 !important 段没有任何路径能摘掉，整机内容字会被钉死一整个会话——
 * 旧稿靠宿主重放能自愈，新机制不会。index.ts 的 effect cleanup 调它（退订后再摘）。
 */
export function clearHostBridges(): void {
  try {
    const doc = styleDocument()
    if (!doc) return
    dropOwnedStyle(doc, HOST_FONT_STYLE_ID)
    dropOwnedStyle(doc, ROWS_STYLE_ID)
    dropOwnedStyle(doc, ASSISTANT_STYLE_ID)
  } catch (e) { /* fail-soft：清场永不影响装配 */ }
}
