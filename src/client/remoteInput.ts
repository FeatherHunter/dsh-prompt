/**
 * dsh-prompt — 遥控输入镜 + 模型休眠门（#123，承 #119/#120/#121/#122 定稿）
 *
 * 纯模块：无 React、无 DOM（除一次性提示的 localStorage 守卫）、无 fetch、无日志。
 * 可转译后直接断言（见 scripts/test-issue-123.cjs）。
 *
 * 前置决议：
 * - 119 GO写入+聚焦 / NO-GO等价回车：读 H+D 经 resolveDraft 合并，写唯一 setDraft 全文替换，
 *   发送面零命中不伪造 Enter。
 * - 120 ABSENT：宿主无模型/思考等级面，模型键休眠隐藏，插件不自造列表、不做 DOM 代点。
 * - 121 Q1 发送键禁用明示、无写入按钮；Q2 模型键休眠保留 canShow 门控；
 *   Q3 可见序 入口→齿轮→左→右→挑选器→输入框→收起（模型面补齐后插输入框后、收起前）。
 * - 122 v3 定稿：A贴底 / 双层文案“草稿已同步，去大屏那头发起发送” / 无C /
 *   em地板＋dvh / 键盘感知 / isComposing门 / 模型面休眠＋首次一次性提示。
 *
 * 尺寸（ADR-0002 续篇，见 docs/adr/0005-remote-input-sheet-sizing.md）：
 * - 禁第三套 math：复用挑选器 mask＋缩放根数学，仅对齐/上限/max-width 三参数不同。
 * - 根：position fixed inset 0 z MODAL_Z fontSize calc(1em * scale)（与 picker.ts 同式）。
 * - 遮罩：同色同层，仅对齐改为底贴（flex-end）＋底垫 Dock 高。
 * - Sheet：宽 min(100% - 1em, 36em)（em地板）、上限 62dvh（键盘感知＋dvh）。
 */

/** sheet→host 去抖串行窗（与 PanelHost 300ms 轮询同拍，见 index.ts） */
export const MIRROR_DEBOUNCE_MS = 300;

/** Sheet 宽（v3 定稿：em 地板 min(100%-1em,36em)，见原型 maskA bottom sheet） */
export const SHEET_WIDTH = 'min(100% - 1em, 36em)';

/** Sheet 最小宽（v3 定稿：min(100%-1em,20em)，窄屏不挤成一条缝） */
export const SHEET_MIN_WIDTH = 'min(100% - 1em, 20em)';

/** Sheet 上限（v3 定稿：62dvh，内容定高、上限后内滚；dvh 键盘感知） */
export const SHEET_MAX_HEIGHT = '62dvh';

/** 模型面首次一次性提示键（localStorage，见过即灭） */
export const MODEL_SEEN_KEY = 'dsh.prompt.modelSeen.v1';

/**
 * 模型键门控（120 ABSENT 收敛：今日恒 false → 零占位隐藏）。
 *
 * 未来有面后的形状已预留：与挑选器同款“可枚举且可切换双满足才渲染”
 * （probeWorkspaceGates 同构），宿主枚举优先、插件不自造、不做 DOM 代点。
 * 今日无面可探，故不读任何 face，直接回 false；调用方不得渲染占位。
 */
export function canShowRemoteModel(_faces?: unknown): boolean {
  try {
    void _faces;
    return false;
  } catch (e) { return false; }
}

/** 读模型一次性提示是否已见（缺席存储/禁写一律当未见，不抛） */
export function hasSeenRemoteModel(): boolean {
  try {
    const s = (globalThis as any).localStorage;
    if (!s || typeof s.getItem !== 'function') return false;
    return s.getItem(MODEL_SEEN_KEY) === '1';
  } catch (e) { return false; }
}

/** 记模型一次性提示已见（失败静默，不抛） */
export function markSeenRemoteModel(): void {
  try {
    const s = (globalThis as any).localStorage;
    if (s && typeof s.setItem === 'function') s.setItem(MODEL_SEEN_KEY, '1');
  } catch (e) { /* ignore */ }
}

/** 仅供测试：清模型已见位 */
export function __resetModelSeenForTests(): void {
  try {
    const s = (globalThis as any).localStorage;
    if (s && typeof s.removeItem === 'function') s.removeItem(MODEL_SEEN_KEY);
  } catch (e) { /* ignore */ }
}

/**
 * 写前 session 校验＋isComposing 门（119 约束的镜面投影）。
 * - captured 为 open 瞬间钉死的 sessionId，current 为写瞬间现值；
 * - 两者非空且相等才写（防 stale actions 跨会话串写）；
 * - 组词中只收不发（compositionend 收敛后由调用方重放队尾）。
 */
export function shouldWriteMirror(
  capturedSessionId: unknown,
  currentSessionId: unknown,
  isComposing: unknown,
): boolean {
  try {
    if (isComposing === true) return false;
    if (typeof capturedSessionId !== 'string' || capturedSessionId === '') return false;
    if (typeof currentSessionId !== 'string' || currentSessionId === '') return false;
    return capturedSessionId === currentSessionId;
  } catch (e) { return false; }
}

export interface AdoptArgs {
  hostDraft: unknown;
  local: unknown;
  lastHost: unknown;
  composing: unknown;
  focused: unknown;
}

/**
 * host→sheet 是否采纳（防抖镜不盖住用户在敲的字）。
 * - 组词中不采（等 compositionend）；
 * - host 无变化不采（hostDraft === lastHost）；
 * - sheet 聚焦且本地已有未同步编辑（local !== lastHost）不采，保住在敲的字；
 * - 其余采纳（初开、失焦、本地与上次同步一致时跟 host 走）。
 */
export function shouldAdoptHostDraft(args: AdoptArgs): boolean {
  try {
    const host = typeof args.hostDraft === 'string' ? args.hostDraft : '';
    const local = typeof args.local === 'string' ? args.local : '';
    const last = typeof args.lastHost === 'string' ? args.lastHost : '';
    if (args.composing === true) return false;
    if (host === last) return false;
    if (args.focused === true && local !== last) return false;
    return true;
  } catch (e) { return false; }
}

/** 引用 chip 形（与 panel.ts 同式：DOM 显示形≠存储形时信桥；镜面只做透传不断言） */
const CHIP_RE = /[\uE100-\uE11D\uFFFC]/;

/** 含 chip 即真（含空串守卫，不抛） */
export function hasChipChar(v: unknown): boolean {
  try {
    if (typeof v !== 'string') return false;
    return CHIP_RE.test(v);
  } catch (e) { return false; }
}
