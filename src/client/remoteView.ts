/**
 * dsh-prompt — 远程大触控十二槽纯视图模型（#83，按 #85 规格）
 *
 * 唯一新缝（#85 实现决策）：纯视图模型。
 * - 输入：已排序过滤后的模板序、查询、标签、页码、方向、字号档、控件档、远程开关、宿主能力位。
 * - 输出：十二槽位（含空位占位）、底栏状态、门槛状态。
 * - 复用既有排序与匹配收敛点（store.ts 的 sortedTemplatesBottomUp / matchLabel / templateHaystack），
 *   本模块不做排序、不做匹配、不读 store、不碰 DOM/React，只做分页与槽位划分。
 *
 * 尺寸规范（#85「尺寸规范」节，取代原型演示代码）：
 * - 面板取锚点上方全部可用高度、宽度近全宽（由调用方按锚点定位，本模块只给行列）。
 * - 内部尺寸以面板为基准相对缩放（调用方用相对单位 fr / em / 百分比），本模块无长度常量。
 * - 十二槽恒定、卡片收缩、不减行：每页恒为十二槽位，不满补空位，满页无空白。
 * - 原型演示代码里的长度常量与减行逻辑一律不得沿用（本模块无此类常量与分支）。
 * - 字号 / 控件三档为自动推导基准之上的乘数，与分辨率解耦（构造性成立，不靠承诺）。
 *
 * 本文件无长度单位、无视口读写、无宿主调用，可转译后直接断言（见 scripts/test-issue-83.cjs）。
 */

export type RemoteOrientation = 'landscape' | 'portrait'
export type RemoteTierName = 'small' | 'medium' | 'large'

/**
 * 方向偏好（三档语义，#110 检测统一后）：
 * auto 跟整机方向（环境方向缓存命中即用，缺席回落视口比例）；
 * landscape/portrait 强制锁定。非法回 auto（调用方兜底，不抛）。
 */
export type RemoteOrientationPref = 'auto' | 'landscape' | 'portrait'

export function normalizeRemoteOrientationPref(v: unknown): RemoteOrientationPref {
  return v === 'landscape' || v === 'portrait' || v === 'auto' ? v : 'auto'
}

/**
 * 解析最终方向（纯函数，去宿主化后的唯一方向入口）：
 * 偏好非 auto 即锁定值；auto 则按视口比例（宽不小于高即横屏，否则竖屏；非法回横屏）。
 * #110 检测统一后 auto 的首选是环境方向缓存（见 resolveEffectiveOrientation），
 * 本函数保留为视口回落原语，不动既有调用点。
 */
export function resolveRemoteOrientation(width: unknown, height: unknown, pref: unknown): RemoteOrientation {
  try {
    const p = normalizeRemoteOrientationPref(pref)
    if (p === 'landscape') return 'landscape'
    if (p === 'portrait') return 'portrait'
    return deriveRemoteOrientation(width, height)
  } catch (e) {
    return 'landscape'
  }
}

/**
 * 解析有效方向（#110 检测统一，纯函数）：
 * 显式偏好赢；auto 取环境方向缓存（整机桥已知值）；缓存缺席/非法回落视口推导。
 * 调用方传已算好的视口方向（面板侧用监听值、设置页用现算值），本函数只做优先级裁决。
 */
export function resolveEffectiveOrientation(pref: unknown, env: unknown, viewport: unknown): RemoteOrientation {
  try {
    if (pref === 'landscape' || pref === 'portrait') return pref
    if (env === 'landscape' || env === 'portrait') return env
    if (viewport === 'landscape' || viewport === 'portrait') return viewport
    return 'landscape'
  } catch (e) {
    return 'landscape'
  }
}

export interface RemoteHostCapsInput {
  hasSystemOrientation: boolean
  hasSystemFont: boolean
  hasStableOpen: boolean
}

/** 每页固定槽位数（遗留：A 档十二槽；密度化后以 remotePageSizeFor 为准） */
export const REMOTE_PAGE_SIZE = 12

/**
 * 密度档（#90，用户拍板，不许改）：
 * - A（默认）= 竖 3×4 / 横 4×3，12 宫现状零改动；
 * - B = 竖 2×4 / 横 4×2，8 宫大卡，不满补空位恒 8。
 * 字面量 'a'/'b'（无额外样式，网格自然撑大）；纯手动，禁任何自动切档逻辑。
 */
export type RemoteDensity = 'a' | 'b'

/** 密度归一化：非法/缺键回默认 A（纯函数，不抛） */
export function normalizeRemoteDensity(v: unknown): RemoteDensity {
  return v === 'b' ? 'b' : 'a'
}

/** 密度校验（纯函数） */
export function isRemoteDensity(v: unknown): v is RemoteDensity {
  return v === 'a' || v === 'b'
}

/** 密度→每页槽位数：A=12，B=8（纯函数） */
export function remotePageSizeFor(density: unknown): number {
  return normalizeRemoteDensity(density) === 'b' ? 8 : REMOTE_PAGE_SIZE
}

/** 横屏列数（A 横 4×3 / 竖 3×4；B 横 4×2 / 竖 2×4；缺省 A 现状值） */
export function remoteColsFor(orientation: RemoteOrientation, density: unknown = 'a'): number {
  if (normalizeRemoteDensity(density) === 'b') return orientation === 'portrait' ? 2 : 4
  return orientation === 'portrait' ? 3 : 4
}

/** 行数（A 横 3 / 竖 4；B 横 2 / 竖 4；缺省 A 现状值） */
export function remoteRowsFor(orientation: RemoteOrientation, density: unknown = 'a'): number {
  if (normalizeRemoteDensity(density) === 'b') return orientation === 'portrait' ? 4 : 2
  return orientation === 'portrait' ? 4 : 3
}

/**
 * 按视口比例自适应切方向（恒开、零宿主依赖）：
 * 宽不小于高即横屏，否则竖屏；非法输入回横屏（调用方兜底，不抛）。
 */
export function deriveRemoteOrientation(width: unknown, height: unknown): RemoteOrientation {
  try {
    const w = typeof width === 'number' ? width : NaN
    const hgt = typeof height === 'number' ? height : NaN
    if (!isFinite(w) || !isFinite(hgt) || w <= 0 || hgt <= 0) return 'landscape'
    return w >= hgt ? 'landscape' : 'portrait'
  } catch (e) {
    return 'landscape'
  }
}

/**
 * 统一大小倍数表（2026-10-03 用户拍板改步进）：1 档=100%，之后每档 +50%，
 * 即 100 / 150 / 200 / 250 / 300 / 350 / 400 / 450 / 500 / 550，等距步进、档档手感一致。
 * 原为 +25% 步进、上限 325%（2026-09-29 两次调优收敛）；远程诉求是「拿远了也点得中、看得清」，
 * 后半段 25% 的增量在串流画面下与前一段手感几乎无差、顶到 325% 仍不够大，故步进加粗一倍。
 */
export const REMOTE_SIZE_SCALES = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5]
/** 档位→倍数：非法回默认 5 档（3x） */
export function remoteSizeScale(size: unknown): number {
  const v = typeof size === 'number' && isFinite(size) ? Math.min(10, Math.max(1, Math.round(size))) : NaN
  const idx = v >= 1 && v <= 10 ? v : 5
  return REMOTE_SIZE_SCALES[idx - 1]
}

/** 宿主基准字号变量（缩放根的唯一锚点；各调用方不得另起第二套基准） */
const BASE_FONT_VAR = 'var(--dsw-font-markdown-base-font-size)'

/**
 * 缩放根收敛点（#116，不计成本的一致性收敛；纯函数，可转译断言）：
 * 开吃全额 calc(宿主基准变量 * 档位倍数)、关回基准变量。各调用方只传开关与档位，
 * 不手写表达式，防多处拷贝漂移。注意：设置页子树内必须用宿主变量基重算，
 * 禁用 `1em` 基——`1em` 在缩放祖先里会复乘（double-scale）。
 */
export function scaledBaseFontSize(enabled: unknown, size: unknown): string {
  if (enabled !== true) return BASE_FONT_VAR
  return 'calc(' + BASE_FONT_VAR + ' * ' + remoteSizeScale(size) + ')'
}

/**
 * 控制面倍数（2026-09-29 晚用户拍板去封顶：档位自由变大——入口/齿轮/智能卡跟内容面吃同一全额，
 * 不再另设更小的封顶（2026-10-03 步进加粗后 10 档为 5.5x）；小窗挤爆风险由用户认）。
 */
export function remoteChromeScale(size: unknown): number {
  return remoteSizeScale(size)
}

/**
 * 宿主内容字 px（#92 野路子，纯函数）：
 * round(remoteSizeScale(size) * 14)，非法（非有限数值）回 14（宿主默认内容字号）。
 * 只返数值、不拼单位、不碰 DOM（落点/单位拼接归 hostfont.ts）。
 */
export function hostContentFontPx(size: unknown): number {
  try {
    if (typeof size !== 'number' || !isFinite(size)) return 14
    return Math.round(remoteSizeScale(size) * 14)
  } catch (e) {
    return 14
  }
}

/** 大小归一化（非法回默认 5，与 remote.ts 同规则的纯投影，不读模块） */
export function normalizeRemoteSize(v: unknown): number {
  return remoteSizeScale(v)
}

/** 页码归一化（NaN/越界钳制，不抛） */
export function normalizeRemotePage(page: unknown, totalPages: number): number {
  const total = typeof totalPages === 'number' && isFinite(totalPages) && totalPages > 0
    ? Math.floor(totalPages)
    : 1
  const p = typeof page === 'number' && isFinite(page) ? Math.floor(page) : 0
  if (p < 0) return 0
  if (p > total - 1) return total - 1
  return p
}

export type RemoteSlotInput = { id: string }

export type RemoteSlot =
  | { kind: 'template'; order: number; id: string }
  | { kind: 'empty'; order: number }

export interface RemoteViewInput {
  /** 已排序过滤后的模板序（调用方用既有排序与匹配产出，本模块只分页） */
  ids: string[]
  page: number
  orientation: RemoteOrientation
  /** 远程总闸（关=小列表，调用方不渲染本视图；开=大列表） */
  enabled: boolean
  /** 统一大小 1–10（单滑块字号控件联动） */
  size: number
  hostCaps: RemoteHostCapsInput
  /** 搜索展开态（底栏大键收起 → 点开展开行内顶起，UI 持有，模型只回显） */
  searchOpen: boolean
  /** 密度档（#90）：'a'=12 宫默认，'b'=8 宫大卡；缺省 A（旧调用点零改动） */
  density?: RemoteDensity
}

export interface RemoteView {
  orientation: RemoteOrientation
  cols: number
  rows: number
  per: number
  total: number
  totalPages: number
  page: number
  /** 恒十二槽位：模板槽按序填充，不满补空位（同尺寸占位、不可点、高度稳定） */
  slots: RemoteSlot[]
  cards: number
  empties: number
  bottomBar: {
    hasPrev: boolean
    hasNext: boolean
    pageText: string
    searchOpen: boolean
  }
  fontScale: number
  controlScale: number
  threshold: {
    /** 去宿主化：总闸只以自家面能否真变大为准，恒可用；保留形状供旧调用点兼容 */
    masterEnabled: boolean
    /** 去宿主化后恒 false（不再有宿主缺席概念）；保留形状供旧调用点兼容 */
    hostPending: boolean
    hostNote: string
  }
}

/**
 * 十二槽分页（纯函数，bottom-up 首屏语义）：
 * - 每页恒十二槽，不满补空位；页码越界钳制；空输入仍给一页全空位（高度稳定）。
 * - 不减行：行列只由方向决定，与内容多少、视口大小无关。
 * - 首屏即最常用（2026-09-29 用户拍板）：输入为 bottom-up 升序（最常用在末尾），
 *   页码从最重要一端取——page=0 取末尾 per 条，页内保持升序（最重要在该页底部）；
 *   不满页空位补在顶部（内容贴底，高度稳定）。
 */
export function computeRemoteView(input: RemoteViewInput): RemoteView {
  const orientation: RemoteOrientation = input.orientation === 'portrait' ? 'portrait' : 'landscape'
  const density = normalizeRemoteDensity((input as any).density)
  const cols = remoteColsFor(orientation, density)
  const rows = remoteRowsFor(orientation, density)
  const per = remotePageSizeFor(density)
  const ids = Array.isArray(input.ids) ? input.ids.filter((x) => typeof x === 'string') : []
  const total = ids.length
  const totalPages = Math.max(1, Math.ceil(total / per))
  const page = normalizeRemotePage(input.page, totalPages)
  const end = Math.max(0, total - page * per)
  const start = Math.max(0, end - per)
  const slice = ids.slice(start, end)
  const emptiesCount = per - slice.length
  const slots: RemoteSlot[] = []
  for (let i = 0; i < per; i++) {
    if (i < emptiesCount) slots.push({ kind: 'empty', order: i })
    else slots.push({ kind: 'template', order: i, id: slice[i - emptiesCount] })
  }
  // 单滑块联动：字号与控件吃同一倍数（内容面全额，封顶只管控制面，不管这里）。
  // 仅远程开时生效（2026-09-29 用户拍板大小跟随开关）：关=一切正常尺寸。
  const sizeScale = remoteSizeScale(input.enabled ? (input as any).size : 1)
  // 去宿主化：hostCaps 仅为兼容保留，不再参与门控；总闸恒以自家面为准，无灰字。
  void input.hostCaps
  return {
    orientation,
    cols,
    rows,
    per,
    total,
    totalPages,
    page,
    slots,
    cards: slice.length,
    empties: per - slice.length,
    bottomBar: {
      hasPrev: page > 0,
      hasNext: page < totalPages - 1,
      pageText: String(page + 1) + '/' + String(totalPages),
      searchOpen: !!input.searchOpen,
    },
    fontScale: sizeScale,
    controlScale: sizeScale,
    threshold: {
      masterEnabled: !!input.enabled,
      hostPending: false,
      hostNote: '',
    },
  }
}

/**
 * 【#141 裁决｜远程标签域死码已清】#132 移除远程标签区之后，本模块这两样东西生产不可达：
 *   · REMOTE_TAG_EXCLUDE_LIST（去留表）：与悬浮云的去留表逐字重复，现已单点收敛到 keys.ts
 *     的 EXCLUDED_LABEL_WORDS（+ 身份视图 EXCLUDED_LABEL_KEYS）；
 *   · remoteTagOptions()：返回 ['全部', ...] 的**显示串**数组 —— 纯模型里硬编码中文铬，
 *     与「身份-显示分离」正面冲突（选中的身份本就是 ScopeKey 'all'，显示由词表按语言解析）。
 * 全仓唯一消费者是 scripts/test-issue-83.cjs，本票连它一起改按 keys.ts 断言。
 * 远程标签域若将来复活，去留与身份从 keys.ts 取，不要再抄一份表。 */
