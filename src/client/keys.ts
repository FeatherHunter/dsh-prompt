/**
 * dsh-prompt — 身份-显示分离的最小落地（#141；契约见 docs/adr/0006-locale-identity-and-subscription.md §1）
 *
 * 一句话：**身份（Key）稳定且语言无关，显示串（label）由词表按当前语言解析**；
 * 存量中文值只在**读侧**经 LegacyChineseStorageAdapter 归一，写盘永远是原值。
 *
 * 三件事，各只留一份实现：
 *   1) 具名 CanonicalKey：范围身份 'all' | 'preset' | 'custom'（ScopeKey）+ 用户词身份
 *      （WordKey = 用户词的原文，folksonomy 永不翻译）；
 *   2) normalizeKey：吸收别名（All/all/全部、旧拼写「预置」与铬用词「预制」、Preset、
 *      自定义/Custom）与空白
 *      （前后空白、全角空格 U+3000）→ 规范身份；空/垃圾 → null；
 *      非别名的词 trim + 大小写归一后**原样保留**（#134 结论：不拒绝建词）；
 *   3) LegacyChineseStorageAdapter：读侧把存量中文值（'自定义' → 'custom' 等）映射到规范身份；
 *      **写侧原样返回** —— adapter 只读不迁，用户数据与存储值一律不改写。
 *
 * 【本模块的边界：只认「键」，不认数据】
 * normalizeKey / adapter 的输入是**键**（范围选中态、存量存储值、去留表这类由程序掌控的值）；
 * 用户数据里的词（模板标签）**不走归一** —— 数据词的身份就是原文。
 * 反例（必须避免）：拿 normalizeKey 去判数据词，'全部'/'预置' 这类合法用户词会被判成范围身份，
 * 于是「点云里的『全部』」变成「不过滤」——过滤语义就变了。见 panel.ts 的云行注释与
 * EXCLUDED_LABEL_WORDS 的注释（#141 硬约束：zh 下过滤结果逐字不动）。
 */

/** 范围身份：顶部唯一那排 [全部][预制][自定义] 的三态（#70 P6a 单选互斥）。 */
export type ScopeKey = 'all' | 'preset' | 'custom'
/** 用户词身份：用户词的**原文**即身份（不翻译、不大小写改写）。 */
export type WordKey = string
/** 规范身份 = 范围身份 ∪ 用户词身份。 */
export type CanonicalKey = ScopeKey | WordKey

export const SCOPE_ALL: ScopeKey = 'all'
export const SCOPE_PRESET: ScopeKey = 'preset'
export const SCOPE_CUSTOM: ScopeKey = 'custom'
/** 三态枚举（顺序即 UI 顺序：全部 → 预制 → 自定义）。 */
export const SCOPE_KEYS: readonly ScopeKey[] = [SCOPE_ALL, SCOPE_PRESET, SCOPE_CUSTOM]

/**
 * 云行选中态：**带来源的**规范身份。
 * 为什么不是裸字符串：'preset' / 'custom' 是 ASCII 身份，而用户词可以是任何串 ——
 * 裸串模型下「用户把标签起名叫 preset」会被误判成范围；带 kind 后两条轴结构性不可混。
 * null = 无选择（= 范围 'all'，不过滤；#70 起「全部」归一到 null，不保留显式值）。
 */
export type Selection = { kind: 'scope'; key: ScopeKey } | { kind: 'word'; word: WordKey }

/** 别名表：键 = 归一后的读入形（全角空格压半角 + trim + 小写），值 = 规范身份。 */
export const SCOPE_ALIASES: Readonly<Record<string, ScopeKey>> = {
  all: SCOPE_ALL,
  '全部': SCOPE_ALL,
  preset: SCOPE_PRESET,
  '预置': SCOPE_PRESET,
  '预制': SCOPE_PRESET,
  custom: SCOPE_CUSTOM,
  '自定义': SCOPE_CUSTOM,
}

/** 读入形：非串 → ''；全角空格/不换行空格压半角 → trim → 小写（#134：trim + 大小写 + 别名）。 */
function readForm(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.replace(/[\u3000\u00A0]/g, ' ').trim().toLowerCase()
}

/** 是否范围身份（具名三态之一）。 */
export function isScopeKey(v: unknown): v is ScopeKey {
  return v === SCOPE_ALL || v === SCOPE_PRESET || v === SCOPE_CUSTOM
}

/** 键读入（范围）：别名（含存量中文）→ 范围身份；其余（含用户词、空、垃圾）→ null。 */
export function normalizeScopeKey(raw: unknown): ScopeKey | null {
  const s = readForm(raw)
  if (!s) return null
  const hit = SCOPE_ALIASES[s]
  return hit === undefined ? null : hit
}

/**
 * 键读入（通用）：别名 → 范围身份；其余非空串 → 用户词身份（trim + 大小写归一的原文）；
 * 空/垃圾 → null。**不拒绝建词**：任何非空词都合法。
 */
export function normalizeKey(raw: unknown): CanonicalKey | null {
  const s = readForm(raw)
  if (!s) return null
  const hit = SCOPE_ALIASES[s]
  return hit === undefined ? s : hit
}

/** 范围选中态（范围钮点击的产物）。 */
export function scopeSelection(key: ScopeKey): Selection {
  return { kind: 'scope', key }
}

/** 用户词选中态（行动云里那个词，原文即身份）。 */
export function wordSelection(word: WordKey): Selection {
  return { kind: 'word', word }
}

/** 无选择 = null，或范围 'all'（#70：'全部' 归一到 null，两种写法同一态）。 */
export function isNoFilter(sel: Selection | null | undefined): boolean {
  if (sel === null || sel === undefined) return true
  return sel.kind === 'scope' && sel.key === SCOPE_ALL
}

/** 范围钮选中态：'all' 钮 = 无选择态；'preset'/'custom' 钮 = 同身份即选中。 */
export function selectionActive(sel: Selection | null | undefined, key: ScopeKey): boolean {
  if (key === SCOPE_ALL) return isNoFilter(sel)
  if (!sel || sel.kind !== 'scope') return false
  return sel.key === key
}

/** 用户词选中态：同词即选中（原文逐字比对）。 */
export function wordActive(sel: Selection | null | undefined, word: WordKey): boolean {
  return !!sel && sel.kind === 'word' && sel.word === word
}

/** 点范围钮：'all' 恒归一到 null；点已选项回 null（toggle）；点他项切过去。 */
export function toggleScope(sel: Selection | null | undefined, key: ScopeKey): Selection | null {
  if (key === SCOPE_ALL) return null
  return selectionActive(sel, key) ? null : scopeSelection(key)
}

/** 点行动词：点已选项回 null（toggle）；否则切到该词身份。 */
export function toggleWord(sel: Selection | null | undefined, word: WordKey): Selection | null {
  return wordActive(sel, word) ? null : wordSelection(word)
}

/** 身份适配器形态：读侧归一、写侧原样（只读不迁）。 */
export interface KeyAdapter {
  /** 读侧：存量值/别名 → 规范身份；空与垃圾 → null。 */
  toCanonical(raw: unknown): CanonicalKey | null
  /** 写侧：**原样返回**（adapter 不做迁移写：用户数据里的中文值永不被改写）。 */
  toStorage(key: CanonicalKey): CanonicalKey
}

/**
 * 存量中文值的读侧适配器（#134 v3：具名 CanonicalKey，不用无名映射）。
 * 只做 trim + 大小写 + 「预置/预制」别名（外加 '自定义'→'custom' 这类范围身份）；
 * 不做迁移写 —— 存储里的 '自定义' 读成身份 'custom'，写回去仍是 '自定义'（写侧根本拿不到旧拼写）。
 */
export const LegacyChineseStorageAdapter: KeyAdapter = {
  toCanonical: normalizeKey,
  toStorage(key: CanonicalKey): CanonicalKey { return key },
}

/**
 * 行动云/远程标签域的**去留词存量拼写**（与改前那份表逐字一致）。
 * 'all' 是非标签哨兵；'自定义' 是空标签回落词（store.LABEL_FALLBACK）在数据里的写法；
 * 其余 7 词是领域/阶段数据词。**比对一律用拼写**（数据词不归一，见模块头注释）。
 */
export const EXCLUDED_LABEL_WORDS: readonly string[] = ['all', '思考框架', '学习', '工程', '执行', '执行前', '执行中', '执行后', '自定义']

/**
 * 去留表的**身份视图**（adapter 读侧映射的结果）：'all'/'custom' 是范围身份，其余是数据词身份。
 * 供 #138 门禁与 P1(#140) 身份直存迁移消费；本票内由 keys 的单测逐条钉住（拼写 ↔ 身份一一对应）。
 */
export const EXCLUDED_LABEL_KEYS: readonly CanonicalKey[] = EXCLUDED_LABEL_WORDS.map((w) => LegacyChineseStorageAdapter.toCanonical(w) as CanonicalKey)

/** 云/远程标签域去留判定：数据词**原文**命中存量拼写表即出局（不归一，语义逐字不动）。 */
export function isExcludedLabel(word: string): boolean {
  return EXCLUDED_LABEL_WORDS.indexOf(word) >= 0
}
