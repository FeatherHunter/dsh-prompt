/**
 * 模板库集合 + 持久 + 标签收敛（Template Library）（#171 N6：可 import 者 —— index、label-identity、prompt-trigger、settings-page、smart-card、smart-score、template-browser）。
 * 跑浏览器 bundle 线；禁被 src/update/host 进口（DO-NOT-IMPORT），禁跨运行时进口。
 */
/**
 * dsh-prompt — 持久化与列表逻辑（#20 直接切换：DSH 缓存目录为准）
 *
 * - customs / usage / pinned / lastUsed 不再读写 localStorage（旧键原地废弃、不读取）。
 *   首屏即空（旧数据按用户裁定丢弃），host 快照到达后更新。
 * - Host：同源 HTTP 桥 /_dsh/dsh-prompt/*（lib/index.js，storages/dsh_prompt.json）。
 *   智能开关与悬浮卡位置仍在 localStorage（纯本机 UI 偏好，无跨端意义，不进 domain）。
 * - 同步 API 保持（panel/trigger/match/smart 零改调用方）：读走内存缓存，
 *   写先更新缓存再 fire-and-forget 落 host；失败记 store.persist.fail 事件（fail-soft，
 *   不静默丢也不崩 UI；#49 起不再往 console 写）。
 * - #23 统一标签：模板统一携带 labels；templateLabels()/labelString()/matchLabel()
 *   是筛选与展示的唯一收敛点（三处共用，不另起新缝）。
 * - #159 颜色标签：color 是**原始存储值**（可选、用户数据）。合法性判据与读侧回落都收在本模块
 *   （sanitizeInkColor / inkColorOf；判据出自 research/ink-contrast-floor.md）；写入口拦非法值，
 *   出站原样透传 —— 存量逐字节不变、绝不把带外值改写回存储
 *   （docs/adr/0007-template-color-is-user-data.md）。
 *   不新开 color.ts：本仓 8 个旧回归脚本各自手抄「转译哪些模块 + 改哪些 require」的表，
 *   store 多一条 import 边会当场把它们打红（template-browser.ts:42 记着同一条代价）。
 */
import type { PromptTemplate } from './templates'
import { PRESET_TEMPLATES, getPresetById } from './templates'


const MAX_PIN = 5
const MAX_BODY = 10000

/* ── 统一标签约束（#23：#19 R2 上限与校验；#19 R3 单选筛选） ── */

/** 自定义最多标签数（与预制 3 对等） */
export const MAX_LABELS = 3
/** 每条标签字数下限 */
export const LABEL_MIN_LEN = 1
/** 每条标签字数上限 */
export const LABEL_MAX_LEN = 10
/** 输入分隔符：逗号（中英）/顿号/空白 */
export const LABEL_SEP = /[,，、\s]+/
// #141（地图 #134 第二轮对抗结论）：旧的「幽灵值」LABEL_RESERVED='任意' 拒绝分支已砍 ——
// #141：'任意' 从此是普通用户词（不拒绝建词）；原 const 与 LABEL_RESERVED/labelReserved 错误码一并删除。
/** 回落词：空标签回落（#19 R2 D4；不是归属维度，见自定义页签语义）。
 *  #141 身份：它在读写两侧都是**存量中文拼写**，读侧归一到范围身份 'custom'
 *  （见 label-identity.ts 的 LegacyChineseStorageAdapter）—— 但它本身是数据值，显示与落盘都不翻译、不改写。 */
export const LABEL_FALLBACK = '自定义'

/**
 * 自定义模板：builtin=false；labels 为自选标签（最多 3 个）。
 * tag 为旧单标签字段（#23 前形状），只读迁移来源，不再写入；
 * 旧占位 domain/stage/action 不再写入（读时忽略，不参与筛选展示）。
 */
export interface CustomTemplate extends PromptTemplate {
  labels?: string[]
  tag?: string
  createdAt: number
}

const STORE_URL = '/_dsh/dsh-prompt/store'
const PUT_URL = '/_dsh/dsh-prompt/customs/put'
const DELETE_URL = '/_dsh/dsh-prompt/customs/delete'
const BUMP_URL = '/_dsh/dsh-prompt/usage/bump'
const PINNED_URL = '/_dsh/dsh-prompt/pinned/set'
// #165 屏蔽预制：全局开关落 host global 区（storages/dsh_prompt.json），缺省=屏蔽
const HIDE_URL = '/_dsh/dsh-prompt/hide/set'
// #179 触发方式：同一条 host global 区，缺省=true（悬浮触发，历史行为一字不动）
const HOVER_TRIGGER_URL = '/_dsh/dsh-prompt/trigger/set'

interface StoreSnapshot {
  customs: CustomTemplate[]
  usage: Record<string, number>
  pinned: string[]
  lastUsed: string | null
  hidePreset: boolean
  hoverTrigger: boolean
}

/* ── 内存缓存（唯一真相来源；初始空 = 直接切换语义） ── */

const cache: StoreSnapshot = { customs: [], usage: {}, pinned: [], lastUsed: null, hidePreset: true, hoverTrigger: true }
let storeLoaded = false
let loadPromise: Promise<void> | null = null
// #91 启动竞态兜底旗（与 remote.ts loadRetried 同构）：快照失败只补一次延迟重拉。
let loadRetried = false
const storeListeners = new Set<() => void>()

function notifyStore(): void {
  storeListeners.forEach((fn) => { try { fn() } catch (e) { /* ignore */ } })
}

/** 订阅存储变更（React 侧用 effect 订阅 + refresh；返回取消函数）。 */
export function subscribeStore(fn: () => void): () => void {
  storeListeners.add(fn)
  return () => { storeListeners.delete(fn) }
}

export function isStoreLoaded(): boolean {
  return storeLoaded
}

async function fetchJSON(url: string, init?: RequestInit): Promise<any | null> {
  try {
    if (typeof fetch === 'undefined') return null
    const res = await fetch(url, init)
    if (!res.ok) return null
    return await res.json()
  } catch (e) {
    return null
  }
}

/** 路由名（日志里只记这个枚举，不记 URL 原文；与事件清单的 route 取值一一对应）。 */
const ROUTE_NAMES: Record<string, string> = {
  [PUT_URL]: 'customs.put',
  [DELETE_URL]: 'customs.delete',
  [BUMP_URL]: 'usage.bump',
  [PINNED_URL]: 'pinned.set',
  [HIDE_URL]: 'hide.set',
  [HOVER_TRIGGER_URL]: 'trigger.set',
}

/** 拉取 host 快照并装入缓存（失败 → 保持内存默认 + 记事件，不读旧 localStorage；#91 起失败补一次 2500ms 延迟重拉，与 remote 同构）。 */
export function ensureLoaded(): Promise<void> {
  if (storeLoaded) return Promise.resolve()
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    const startedAt = Date.now()
    const data = await fetchJSON(STORE_URL)
    if (data && data.ok && data.value) {
      const v = data.value as Partial<StoreSnapshot>
      if (Array.isArray(v.customs)) cache.customs = v.customs as CustomTemplate[]
      if (v.usage && typeof v.usage === 'object') cache.usage = v.usage as Record<string, number>
      if (Array.isArray(v.pinned)) cache.pinned = (v.pinned as unknown[]).filter((x): x is string => typeof x === 'string')
      cache.lastUsed = typeof v.lastUsed === 'string' ? v.lastUsed : null
      cache.hidePreset = normalizeHidePreset((v as { hidePreset?: unknown }).hidePreset)
      cache.hoverTrigger = normalizeHoverTrigger((v as { hoverTrigger?: unknown }).hoverTrigger)
      logEvent('store.snapshot.ok', { customs: cache.customs.length, pinned: cache.pinned.length, latencyMs: Date.now() - startedAt })
    } else {
      logEvent('store.snapshot.fail', {
        reason: typeof fetch === 'undefined' ? 'no-fetch' : 'http-or-json-fail',
        latencyMs: Date.now() - startedAt,
      })
      // #91 启动竞态（宿主 domain 异步打开中撞 503/不可达）：旧实现直接锁死空默认 → 自定义全不见、用量全 0。
      // 与 remote.ts ensureRemoteLoaded 同构：只补一次 2500ms 延迟重拉；命中则覆盖默认并经既有 notifyStore 刷新 UI。
      // 只复用既有事件字面量（store.snapshot.ok/fail），不新增事件、不加失败明示行。
      if (!loadRetried) {
        loadRetried = true
        try {
          if (typeof setTimeout === 'function') {
            const tid: any = setTimeout(() => {
              loadPromise = null
              storeLoaded = false
              ensureLoaded().catch(() => undefined)
            }, 2500)
            try { if (tid && typeof tid.unref === 'function') tid.unref() } catch (e) { /* ignore */ }
          }
        } catch (e) { /* ignore */ }
      }
    }
    storeLoaded = true
    notifyStore()
  })().finally(() => { /* keep loadPromise for dedupe until resolved */ })
  return loadPromise
}

/** 落盘形状（#23：只写 labels；旧 tag 与占位三件套不写回，读时映射即可，不双写）
 *  #159：color 经 {...rest} 原样透传 —— 有意为之：存量逐字节不变、带外值绝不改写回存储
 *  （回落只发生在读侧 inkColorOf，不回写）。 */
function toHostShape(t: CustomTemplate): object {
  const rest = { ...(t as unknown as Record<string, unknown>) }
  delete rest.tag
  delete rest.domain
  delete rest.stage
  delete rest.action
  return { ...rest, labels: templateLabels(t as PromptTemplate) }
}

/** fire-and-forget 落盘（失败记事件，不回滚内存、不抛给 UI）。 */
function persist(url: string, body: unknown): void {
  try {
    if (typeof fetch === 'undefined') return
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(
      () => undefined,
      (e) => {
        logEvent('store.persist.fail', {
          route: ROUTE_NAMES[url] ?? 'unknown',
          errorHash: String(e && (e as Error).message || e),
        })
      },
    )
  } catch (e) { /* ignore */ }
}

/* ── 读（同步，走缓存） ── */

export function loadCustoms(): CustomTemplate[] {
  return [...cache.customs]
}
export function saveCustoms(list: CustomTemplate[]): void {
  cache.customs = [...list]
  notifyStore()
  // 全量保存无对应单路由时按序逐条 put（量小，手写量级）；失败各自 warn
  for (const t of cache.customs) persist(PUT_URL, { template: toHostShape(t) })
}

export function loadUsage(): Record<string, number> {
  return { ...cache.usage }
}
export function bumpUsage(id: string): void {
  cache.usage[id] = (cache.usage[id] || 0) + 1
  cache.lastUsed = id // 最近使用（智能卡「1 条最近」槽；与旧 L49-50 副作用一致，现由 host 原子做，内存先行）
  notifyStore()
  persist(BUMP_URL, { id })
}

/** 最近一次使用的模板 id（智能模式「最近使用」候选；无 → null） */
export function loadLastUsed(): string | null {
  return cache.lastUsed
}

export function loadPinned(): string[] {
  return [...cache.pinned]
}
export function savePinned(ids: string[]): void {
  cache.pinned = [...ids]
  notifyStore()
  persist(PINNED_URL, { ids })
}

/* ── 屏蔽预制（#165：全局开关，缺省=屏蔽；落 host global 区） ── */

/** 读侧归一：只有显式 false 是展示，其余一律屏蔽（缺键/非法值/存量脏数据全部回落 true）。 */
export function normalizeHidePreset(v: unknown): boolean {
  return v === false ? false : true
}

/** 当前是否屏蔽预制（读走内存缓存，与 loadPinned 同构）。 */
export function loadHidePreset(): boolean {
  return cache.hidePreset
}

/** 翻转/设置屏蔽（内存先行 + notifyStore 刷 UI，再 fire-and-forget 落 host）。 */
export function saveHidePreset(hide: boolean): void {
  cache.hidePreset = hide === false ? false : true
  notifyStore()
  persist(HIDE_URL, { hide: cache.hidePreset })
}

/** 屏蔽过滤（纯函数）：hide=true 去掉 builtin（无 builtin 键视为自定义），不改原数组。 */
export function applyHidePreset(list: PromptTemplate[], hide: boolean): PromptTemplate[] {
  if (!hide) return [...list]
  return list.filter((x) => !x.builtin)
}

/* ── 触发方式（#179：悬浮触发/仅点击触发，全局开关，缺省=悬浮；落 host global 区） ── */

/** 读侧归一：只有显式 false 是「仅点击」，其余一律悬浮触发（缺键/非法值/存量脏数据全部回落 true）。 */
export function normalizeHoverTrigger(v: unknown): boolean {
  return v === false ? false : true
}

/** 当前是否悬浮触发（true=悬浮开菜单；false=仅点击开菜单）。 */
export function loadHoverTrigger(): boolean {
  return cache.hoverTrigger
}

/** 设置触发方式（内存先行 + notifyStore 刷底栏/设置页两处 UI，再 fire-and-forget 落 host）。 */
export function saveHoverTrigger(hover: boolean): void {
  cache.hoverTrigger = hover === false ? false : true
  notifyStore()
  persist(HOVER_TRIGGER_URL, { hover: cache.hoverTrigger })
}

/** 全部模板（预制 + 自定义） */
export function allTemplates(): PromptTemplate[] {
  return [...PRESET_TEMPLATES, ...cache.customs]
}

/** id 索引（#171：O(T)→O(1)；全部写入口都重赋 cache.customs，故以数组 identity 为失效键） */
let idIndexCache: { list: CustomTemplate[]; map: Map<string, PromptTemplate> } | null = null
export function getTemplate(id: string): PromptTemplate | undefined {
  if (idIndexCache?.list !== cache.customs) {
    const map = new Map<string, PromptTemplate>()
    for (const t of allTemplates()) map.set(t.id, t)
    idIndexCache = { list: cache.customs, map }
  }
  return idIndexCache.map.get(id)
}

/* ── 统一标签收敛（#23：匹配与展示的唯一纯函数，三处共用） ── */

/** 字数（按码点，CJK 一字计一） */
function labelLen(s: string): number {
  return Array.from(s).length
}

/**
 * 模板标签：预制 = labels（回填值，恒 3 个）；自定义 = 自选 labels。
 * 读时兼容旧形状：labels 缺失/为空 → 预制按领域+阶段+动作机械派生（#19 R2 D3 公式），
 * 自定义取旧单 tag 为首元、空则回落「自定义」（#19 R2 D4；旧占位三件套直接丢弃）。
 */
export function templateLabels(t: PromptTemplate): string[] {
  const own = (t as CustomTemplate).labels
  if (Array.isArray(own) && own.length > 0) return [...own]
  if (t.builtin) {
    const derived = [t.domain, t.stage, ...(t.action || [])].filter((x): x is string => typeof x === 'string')
    if (derived.length > 0) return derived
  } else {
    const tag = ((t as CustomTemplate).tag || '').trim()
    if (tag) return [tag]
  }
  return [LABEL_FALLBACK]
}

/** 标签串（展示共用；分隔符 '/'，与 #19 R2 附录记法一致） */
export function labelString(t: PromptTemplate, sep = '/'): string {
  return templateLabels(t).join(sep)
}

/** 标签命中（筛选共用；单选语义：包含所选标签即命中，#19 R3 D5） */
export function matchLabel(t: PromptTemplate, label: string): boolean {
  return templateLabels(t).indexOf(label) >= 0
}

/** 已有词（自定义标签输入的选取来源：预制 23 词 + 在用自定义词，去重保序） */
export function allKnownLabels(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const push = (l: string) => { if (l && !seen.has(l)) { seen.add(l); out.push(l) } }
  for (const t of PRESET_TEMPLATES) templateLabels(t).forEach(push)
  for (const t of cache.customs) templateLabels(t).forEach(push)
  return out
}

/** 归一化：拆分 → 去首尾空 → 去空 → 去重（保序）。空标签与重复是自动清理项，不是错误。 */
export function normalizeLabels(input: string | string[] | undefined): string[] {
  const parts = Array.isArray(input) ? input.slice() : (typeof input === 'string' ? input.split(LABEL_SEP) : [])
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts.flatMap((x) => String(x).split(LABEL_SEP))) {
    const w = p.trim()
    if (!w || seen.has(w)) continue
    seen.add(w)
    out.push(w)
  }
  return out
}

export type LabelsCheck =
  | { ok: true; labels: string[] }
  | { ok: false; error: 'labelTooLong' | 'labelsTooMany' }

/**
 * 校验（保存时阻断并行内提示，不静默截断）：
 * 空输入 → 回落 ['自定义']（#19 R2 D4）；超长 → 阻断；超数 → 阻断。
 * #141 起不再有保留词：任何 1–10 字的词都能建（'任意' 从此是普通用户词，地图 #134 第二轮对抗结论已采纳）。
 */
export function validateLabels(input: string | string[] | undefined): LabelsCheck {
  const cleaned = normalizeLabels(input)
  if (cleaned.length === 0) return { ok: true, labels: [LABEL_FALLBACK] }
  for (const w of cleaned) {
    const n = labelLen(w)
    if (n < LABEL_MIN_LEN || n > LABEL_MAX_LEN) return { ok: false, error: 'labelTooLong' }
  }
  if (cleaned.length > MAX_LABELS) return { ok: false, error: 'labelsTooMany' }
  return { ok: true, labels: cleaned }
}

/* ── 颜色标签（#159）：可读性判据与读侧回落（判据出自 research/ink-contrast-floor.md） ── */

/** 相对亮度下限（裸 3:1 线，含端点） */
export const INK_L_MIN = 0.17602
/** 相对亮度上限（同上） */
export const INK_L_MAX = 0.3
/** 控件取值带下限（含 3.2:1 余量；#158 的取色控件把可选范围收在这里，数据侧判据仍是上面两条） */
export const INK_PICK_L_MIN = 0.19109
/** 控件取值带上限（同上） */
export const INK_PICK_L_MAX = 0.27813

const HEX_RE = /^#[0-9a-fA-F]{6}$/

/** sRGB 单通道线性化（WCAG 2.2 相对亮度定义里的第一步） */
function linearize(v: number): number {
  const s = v / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

/** 六位 hex（带 #）判定：大小写都收（存储回原样，不归一） */
export function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && HEX_RE.test(v)
}

/** WCAG 相对亮度 L = 0.2126R + 0.7152G + 0.0722B（入参须是合法 hex） */
export function relativeLuminance(hex: string): number {
  return 0.2126 * linearize(parseInt(hex.slice(1, 3), 16))
    + 0.7152 * linearize(parseInt(hex.slice(3, 5), 16))
    + 0.0722 * linearize(parseInt(hex.slice(5, 7), 16))
}

/** 可读性判据：形状合法 **且** L 落在裸 3:1 带内 */
export function isReadableInk(v: unknown): v is string {
  if (!isHexColor(v)) return false
  const l = relativeLuminance(v)
  return l >= INK_L_MIN && l <= INK_L_MAX
}

/**
 * 写入口守卫：合法原样返回，非法 / 带外 / 空 ⇒ undefined（＝未选颜色）。
 * 不吸附、不补默认白、不改大小写 —— 改写用户数据是 ADR-0007 明令禁止的。
 */
export function sanitizeInkColor(v: unknown): string | undefined {
  return isReadableInk(v) ? v : undefined
}

/**
 * 读侧唯一入口：模板 → 能用的颜色或 undefined。
 * 存储里可能是手改 / 外部写入的带外值，这里一律回落成「未选颜色」（跟随主题、无描边）；
 * 回落只发生在内存里，**不回写存储**。消费颜色的地方（小列表 / 大列表 / 设置页）都走这里。
 */
export function inkColorOf(t: { color?: unknown }): string | undefined {
  return sanitizeInkColor(t ? t.color : undefined)
}

/**
 * #162 读侧唯一入口：这个模板的名字要不要描边。
 * 规则只有两条：① **只有选了颜色才有描边可言**（未选颜色恒 false —— 用户口径「不选颜色的 prompt
 * 不提供描边」）；② 存储里 `outline: false` 才是关，缺键（含 #162 之前的全部存量）＝开。
 * 只认严格的 false，`'false'` / 0 / 其它杂值一律当作开 —— 读侧不做语义猜测（与 inkColorOf 同精神）。
 */
export function inkOutlineOf(t: { color?: unknown; outline?: unknown }): boolean {
  if (inkColorOf(t) === undefined) return false
  return t ? t.outline !== false : true
}

/** #178 R2：光标标记 —— 正文里写 {{cursor}} 表示「插入后光标停这儿」；第一个生效，其余在插入时删除。 */
export const CURSOR_MARKER = '{{cursor}}'

/** #178 R2：剥掉正文里所有光标标记，并给出第一个标记在**剥后文本**中的偏移（插入后的光标目标）。
 *  无标记 → caret = null（插入行为与旧版完全一致：单次整框 setDraft，光标由宿主置尾）。
 *  标记不参与任何展示、检索与评分；标记以外的字（含换行、空格）逐字节原样。 */
export function stripCursorMarkers(body: string): { text: string; caret: number | null } {
  const src = body == null ? '' : String(body)
  const parts = src.split(CURSOR_MARKER)
  return { text: parts.join(''), caret: parts.length > 1 ? parts[0].length : null }
}

/** 检索串（面板搜索与 /prompt 触发源共用）：名称/英文名/正文/领域/阶段/动作/标签（旧找法不断）
 *  #178 R2：正文先剥光标标记 —— 搜索不能把 {{cursor}} 当关键词命中。 */
export function templateHaystack(t: PromptTemplate): string {
  return (t.name + ' ' + (t.nameEn || '') + ' ' + stripCursorMarkers(t.body || '').text + ' ' + (t.domain || '') + ' ' + (t.stage || '') + ' ' + (t.action || []).join(' ') + ' ' + templateLabels(t).join(' ')).toLowerCase()
}

/**
 * #178 R1：保存路径的正文清洗 —— 只削「行首/行尾的空格与 tab」，**保留所有换行**（含正文开头/结尾的空行）。
 * 旧实现用的是 body.trim()：它会把首尾换行一并吃掉，于是「正文顶部的空行」「结尾的空行」存不下来。
 * 之所以不引入 \n 转义语言：真换行本来就能存能插，存量正文里的 C:\new、/\n/ 等字面文本不能被解码误伤
 * （见 docs/adr/0010 与 ADR-0007 的「用户数据逐字节不变」价值观）。
 */
export function trimBodyEdges(body: string): string {
  return (body == null ? '' : String(body)).replace(/^[ \t]+|[ \t]+$/g, '')
}

/** #178 R1：展示用首行 —— 先剥光标标记，再取第一个**非空**行（行首尾空白削掉）；正文以空行开头时不产生空简介。 */
export function firstLineIntro(body: string): string {
  const lines = stripCursorMarkers(body).text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line) return line
  }
  return ''
}

/** #178 R1：展示用单行预览 —— 先剥光标标记，再把空白（含换行）压成单空格并削首尾；远程大卡简介与设置页展开预览用。 */
export function oneLinePreview(body: string): string {
  return stripCursorMarkers(body).text.split(/\s+/).filter((x) => !!x).join(' ')
}

/** 排序（#68 决议 2026-09-15）：设置页与 /prompt 忽略置顶，只按用量计数降序 → 末键。
 *  置顶仅悬浮列表生效（见 sortedTemplatesBottomUp）。用量仅供排序，不显示数字（显示由 #69/#71 落地）。
 *  #22 决议中“设置页置顶绝对优先”一句被本票推翻；降序方向本身维持（管理面与菜单首屏例外，见 #22 Q2/Q6）。 */
export function sortedTemplates(list: PromptTemplate[]): PromptTemplate[] {
  const usage = cache.usage
  return [...list].sort((a, b) => {
    const d = (usage[b.id] || 0) - (usage[a.id] || 0)
    if (d !== 0) return d
    return tieBreakOrder(a, b)
  })
}

/** 统一末键（#22：三面 bottom-up 共用）——置顶原始顺序（预制按 final.md 定稿顺序，自定义按 createdAt） */
const presetOrderMap = new Map<string, number>(PRESET_TEMPLATES.map((t, i) => [t.id, i]))
export function tieBreakOrder(a: PromptTemplate, b: PromptTemplate): number {
  const aCustom = a as CustomTemplate
  const bCustom = b as CustomTemplate
  const aBuilt = !!a.builtin
  const bBuilt = !!b.builtin
  if (aBuilt && bBuilt) return (presetOrderMap.get(a.id) ?? 9999) - (presetOrderMap.get(b.id) ?? 9999)
  if (!aBuilt && !bBuilt) return (aCustom.createdAt || 0) - (bCustom.createdAt || 0)
  return aBuilt ? -1 : 1 // 预制在前，自定义在后（同为 0 次时稳定可预期）
}

/** bottom-up 排序（#68 终式 2026-09-15）：置顶簇在底部聚拢，分区内维持 bottom-up。
 *  - 一级分区：非置顶在上、置顶在下（置顶簇整体占底部连续段，不再按用量散插）——
 *    本票推翻 #22“用量主键、置顶只做同分 tie-break”（该式导致不同用量下置顶必散）。
 *  - 二级：分区内用量升序（0→max，max 最靠底；置顶簇内最常用置顶在非常底部，
 *    非置顶中最常用紧贴置顶簇之上）。
 *  - 三级：置顶簇内同用量时按 pin 顺序（维持 #22 原式）。
 *  - 末键：预制原始顺序 / 自定义创建时间（tieBreakOrder，维持 #22 原式）。
 *  设置页与 /prompt 不走此函数（走 sortedTemplates，忽略置顶）。
 */
export function sortedTemplatesBottomUp(list: PromptTemplate[]): PromptTemplate[] {
  const usage = cache.usage
  const pinned = cache.pinned
  const isPinned = (id: string) => pinned.indexOf(id) >= 0
  const pinIdx = (id: string) => pinned.indexOf(id)
  return [...list].sort((a, b) => {
    const ap = isPinned(a.id), bp = isPinned(b.id)
    if (ap !== bp) return ap ? 1 : -1 // 一级：置顶簇聚底（连续段）
    const ua = usage[a.id] || 0, ub = usage[b.id] || 0
    if (ua !== ub) return ua - ub // 二级：分区内用量升序
    if (ap && bp) {
      const pa = pinIdx(a.id), pb = pinIdx(b.id)
      if (pa !== pb) return pa - pb
    }
    return tieBreakOrder(a, b)
  })
}

/** 置顶切换（置顶数 ≤5）；返回是否成功（超限返回 false） */
export function togglePin(id: string): { pinned: string[]; ok: boolean } {
  const pinned = [...cache.pinned]
  const i = pinned.indexOf(id)
  if (i >= 0) { pinned.splice(i, 1) }
  else if (pinned.length >= MAX_PIN) { return { pinned, ok: false } }
  else { pinned.push(id) }
  cache.pinned = pinned
  notifyStore()
  persist(PINNED_URL, { ids: pinned })
  return { pinned: [...pinned], ok: true }
}

export function isPinned(id: string): boolean {
  return cache.pinned.indexOf(id) >= 0
}

export function canPinMore(): boolean {
  return cache.pinned.length < MAX_PIN
}

/**
 * 新增自定义模板（#23）。
 * labels 接受数组或单字符串（单字符串兼容旧调用：视为一个标签）。
 * 先归一化+校验，不合法直接抛错——面板侧已做行内校验先行，此处是契约守卫，不静默截断。
 * 落盘新形状（只写 labels，不写旧 tag 与占位三件套）。
 * #159：color 可选；未选（缺参 / 非法 / 带外）时**根本不写这个键** —— 不是写默认白。
 * #162：outline 可选；**只在「有颜色且用户关掉描边」时写 `false`**，其余一律不写键（默认态零改动）。
 */
export function addCustom(name: string, labels: string | string[], body: string, color?: string, outline?: boolean): CustomTemplate {
  const checked = validateLabels(labels)
  if (!checked.ok) throw new Error('[dsh-prompt] invalid labels: ' + checked.error)
  const t: CustomTemplate = {
    id: 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    name, nameEn: '',
    labels: checked.labels,
    body, builtin: false, createdAt: Date.now(),
  }
  const ink = sanitizeInkColor(color)
  if (ink !== undefined) t.color = ink
  if (ink !== undefined && outline === false) t.outline = false
  cache.customs = [...cache.customs, t]
  notifyStore()
  persist(PUT_URL, { template: toHostShape(t) })
  return t
}

/** 更新自定义模板（#23：labels 数组或单字符串；兼容旧 patch.tag，折算为单标签）。
 *  #159：patch.color 是写入口 —— 合法（带内六位 hex）原样落；非法 / 空 / 带外落回「未选颜色」
 *  （删键，不吸附到最近的合法色）；缺参（undefined）表示这一项不改。
 *  #162：patch.outline —— `false` 表示用户关掉描边（只在**有颜色**时落键）；`true` / 缺参一律不写键。
 *  清空颜色的同时把 `outline` 一并删掉：无颜色＝无描边，不留孤儿数据。 */
export function updateCustom(id: string, patch: { name?: string; labels?: string | string[]; tag?: string; body?: string; color?: string; outline?: boolean }): void {
  cache.customs = cache.customs.map((t) => {
    if (t.id !== id) return t
    const next: CustomTemplate = { ...t }
    if (patch.name !== undefined) next.name = patch.name
    const incoming = patch.labels !== undefined ? patch.labels : patch.tag
    if (incoming !== undefined) {
      const checked = validateLabels(incoming)
      if (!checked.ok) throw new Error('[dsh-prompt] invalid labels: ' + checked.error)
      next.labels = checked.labels
      delete next.tag // 旧单标签字段不再保留（不双写）
    }
    if (patch.body !== undefined) next.body = patch.body
    if (patch.color !== undefined) {
      const ink = sanitizeInkColor(patch.color)
      if (ink === undefined) { delete next.color; delete next.outline }
      else next.color = ink
    }
    if (patch.outline !== undefined) {
      // #162：判据是**读侧权威** inkColorOf(next)，不是原始存储值 —— color 是带外值（只能手改数据造成）的
      // 存量记录，读侧就是「未选颜色」：此时这个键既不新增也不删除（ADR-0007：存量逐字节不变）。
      // 旧写法 `next.color !== undefined` 会让「只改名字」的一次保存顺手写下 outline:false。
      const hasInk = inkColorOf(next) !== undefined
      if (hasInk && patch.outline === false) next.outline = false
      else if (hasInk) delete next.outline
    }
    persist(PUT_URL, { template: toHostShape(next) })
    return next
  })
  notifyStore()
}

/** 删除自定义模板（仅限 builtin=false）；返回是否成功 */
export function removeCustom(id: string): boolean {
  const next = cache.customs.filter((t) => t.id !== id)
  if (next.length === cache.customs.length) return false
  cache.customs = next
  cache.pinned = cache.pinned.filter((p) => p !== id)
  notifyStore()
  persist(DELETE_URL, { id })
  persist(PINNED_URL, { ids: cache.pinned })
  return true
}

/** 复制预制为自定义（#23：标签照搬预制派生串，最多 3 个天然合规）。
 *  #141 裁决：'（副本）' 拼进 name **落进用户数据**，一律不动 —— 它既不是铬、也不是身份键，
 *  是用户数据的一部分；要本地化只能「新建那一刻按当前语言取一次」，已存数据永不改写。
 *  #142 边缘裁决 a：grep 确认无把后缀 parse 回的代码（仅本行拼进去），故加可选 suffix 参数 ——
 *  调用方（panel handleCopy）传 tr(lang, STR.copySuffix)，缺省仍是 '（副本）'（既有调用与回归不动）；
 *  已存 name 永不改写（切语言不回写）。store 不 import i18n/locale，后缀由调用方按订阅 lang 取。 */
export function copyPresetToCustom(id: string, suffix?: string): CustomTemplate | null {
  const src = getPresetById(id)
  if (!src) return null
  const tail = typeof suffix === 'string' ? suffix : '（副本）'
  return addCustom(src.name + tail, templateLabels(src), src.body)
}

export { MAX_BODY }

/** 记一条日志事件。出口只有一个：日志能力装进 globalThis.__dshPromptLog 的那个实例。
 *  走槽而不是 import 的原因：本仓既有回归脚本会把客户端模块逐个转译后单独 require
 *  （scripts/.rt-tmp/*.cjs），而单文件 bundle 里也没有可用的模块内 require——槽是两边都能用的唯一机制。
 *  能力缺席时是空操作，绝不因为记日志失败而影响功能。 */
function logEvent(event: string, fields?: Record<string, unknown>): void {
  try {
    const log = (globalThis as any).__dshPromptLog
    if (log && typeof log.log === 'function') log.log(event, fields)
  } catch (e) { /* ignore */ }
}
