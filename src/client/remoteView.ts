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
 * 方向偏好（去宿主化，纯插件）：
 * auto 跟视口走，landscape/portrait 强制锁定。非法回 auto（调用方兜底，不抛）。
 */
export type RemoteOrientationPref = 'auto' | 'landscape' | 'portrait'

export function normalizeRemoteOrientationPref(v: unknown): RemoteOrientationPref {
  return v === 'landscape' || v === 'portrait' || v === 'auto' ? v : 'auto'
}

/**
 * 解析最终方向（纯函数，去宿主化后的唯一方向入口）：
 * 偏好非 auto 即锁定值；auto 则按视口比例（宽不小于高即横屏，否则竖屏；非法回横屏）。
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
 * 统一大小倍数表（2026-09-29 用户拍板，两次调优收敛）：1 档=100%，之后每档 +25%，
 * 即 100 / 125 / 150 / 175 / 200 / 225 / 250 / 275 / 300 / 325，等距步进、档档手感一致。
 */
export const REMOTE_SIZE_SCALES = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25]
/** 档位→倍数：非法回默认 5 档（2x） */
export function remoteSizeScale(size: unknown): number {
  const v = typeof size === 'number' && isFinite(size) ? Math.min(10, Math.max(1, Math.round(size))) : NaN
  const idx = v >= 1 && v <= 10 ? v : 5
  return REMOTE_SIZE_SCALES[idx - 1]
}

/**
 * 控制面倍数（2026-09-29 晚用户拍板去封顶：档位自由变大——入口/齿轮/智能卡跟内容面吃同一全额，
 * 不再钳在 2x；小窗挤爆风险由用户认）。
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
 * 远程标签域（收敛，不另起第二套筛选）：
 * - 只留 [全部] + 在用动态词单选；预置 / 自定义二分在远程合并（调用方用 matchLabel 单选包含，跨内置自建）。
 * - 在用动态词 = 调用方传入的 allKnownLabels() 经与悬浮云同一套去留过滤；自定义新词天然在内（平权）。
 * - 本函数只做去留与排序（预置行动词首现序 + 自定义追加由调用方保序传入），不做匹配。
 */
const REMOTE_TAG_EXCLUDE_LIST = [
  'all',
  '思考框架',
  '学习',
  '工程',
  '执行',
  '执行前',
  '执行中',
  '执行后',
  '自定义',
]

/** 仅供测试：读出去留表（与悬浮云同值，远程不另起维度） */
export function remoteTagExcludeList(): string[] {
  return [...REMOTE_TAG_EXCLUDE_LIST]
}

/** 远程标签选项：[全部] + 过滤后的在用动态词（保序） */
export function remoteTagOptions(allLabels: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (l: string): void => {
    if (!l || seen.has(l)) return
    seen.add(l)
    out.push(l)
  }
  for (const l of Array.isArray(allLabels) ? allLabels : []) {
    if (typeof l !== 'string' || !l) continue
    if (REMOTE_TAG_EXCLUDE_LIST.indexOf(l) >= 0) continue
    push(l)
  }
  return ['全部', ...out]
}
