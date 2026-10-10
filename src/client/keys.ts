/**
 * dsh-prompt — 身份-显示分离的最小落地（#141；契约见 docs/adr/0006-locale-identity-and-subscription.md §1）
 *
 * 一句话：**身份（Key）稳定且语言无关，显示串（label）由词表按当前语言解析**；
 * 存量中文值只在**读侧**经 LegacyChineseStorageAdapter 归一，写盘永远是原值。
 *
 * 三件事，各只留一份实现：
 *   1) 具名 CanonicalKey：范围身份 'all' | 'preset' | 'custom'（ScopeKey）+ 用户词身份
 *      （WordKey = 用户词的原文，folksonomy 永不翻译）；
 *   2) normalizeKey：吸收别名（All/ALL/全部、旧拼写「预置」与铬用词「预制」、Preset（大小写不限）、
 *      自定义/Custom）与空白
 *      （前后空白、全角空格 U+3000）→ 规范身份；空/垃圾 → null；
 *      非别名的用户词 trim 后原文原样保留（保大小写，#134 结论：不拒绝建词）；
 *      用户词身份=trim 后原文（保大小写）；大小写不敏感仅用于范围别名查表；
 *      P1 身份直存必须用本函数，禁止另起小写归一；
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

import { LABEL_FALLBACK, templateLabels } from './store'
import { tr, STR, type Lang } from './i18n'
import type { PromptTemplate } from './templates'

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

/** 别名表：键 = 全小写的读入形（查表时对 readForm 结果再 .toLowerCase()）；值 = 规范身份。 */
export const SCOPE_ALIASES: Readonly<Record<string, ScopeKey>> = {
  all: SCOPE_ALL,
  '全部': SCOPE_ALL,
  preset: SCOPE_PRESET,
  '预置': SCOPE_PRESET,
  '预制': SCOPE_PRESET,
  custom: SCOPE_CUSTOM,
  '自定义': SCOPE_CUSTOM,
}

/** 读入形：非串 → ''；全角空格/不换行空格压半角 → trim（保大小写；大小写不敏感仅用于别名查表时的二次小写）。 */
function readForm(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.replace(/[\u3000\u00A0]/g, ' ').trim()
}

/** 是否范围身份（具名三态之一）。 */
export function isScopeKey(v: unknown): v is ScopeKey {
  return v === SCOPE_ALL || v === SCOPE_PRESET || v === SCOPE_CUSTOM
}

/** 键读入（范围）：别名（含存量中文，查表大小写不敏感）→ 范围身份；其余（含用户词、空、垃圾）→ null。 */
export function normalizeScopeKey(raw: unknown): ScopeKey | null {
  const s = readForm(raw)
  if (!s) return null
  const hit = SCOPE_ALIASES[s.toLowerCase()]
  return hit === undefined ? null : hit
}

/**
 * 键读入（通用）：别名（查表大小写不敏感）→ 范围身份；其余非空串 → 用户词身份（trim 后原文，保大小写）；
 * 空/垃圾 → null。**不拒绝建词**：任何非空词都合法。
 * 用户词身份=trim 后原文（保大小写）；大小写不敏感仅用于范围别名查表；
 * P1 身份直存必须用本函数，禁止另起小写归一。
 */
export function normalizeKey(raw: unknown): CanonicalKey | null {
  const s = readForm(raw)
  if (!s) return null
  const hit = SCOPE_ALIASES[s.toLowerCase()]
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
 * 只做 trim + 别名查表（大小写不敏感）+ 「预置/预制」别名（外加 '自定义'→'custom' 这类范围身份）；
 * 不做迁移写 —— 存储里的 '自定义' 读成身份 'custom'，写回去仍是 '自定义'（写侧根本拿不到旧拼写）。
 * P0 生产未接线（故意）：scope 不持久化、标签不归一；P1 身份直存时由存储层调用 toCanonical/toStorage，本票仅钉住契约。
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

/**
 * 预制词英译表（#145）：预制模板派生标签（4 领域 + 3 阶段 + 16 行动词）的**显示形**。
 *
 * 边界（与 ADR-0006 §1 同一套身份-显示分离）：
 *   · 只翻**预制词**（词表由本仓拥有）；**用户词永不翻**（原文即身份，folksonomy 不进词表）；
 *   · 本表只服务显示位，逻辑位（matchLabel / isExcludedLabel / 评分 / 落盘）继续用中文原文；
 *   · 表里没有的原样返回 —— 新增预制词忘了登记时，表现为"少翻一个词"，而不是把用户词翻错。
 * 条目选择按"云行胶囊不加宽太多"取舍：优先短词（如 归因→Attribution、固化→Freeze）。
 */
export const PRESET_WORD_EN: Readonly<Record<string, string>> = {
  // 领域（4）
  '思考框架': 'Thinking', '学习': 'Learning', '工程': 'Engineering', '执行': 'Execution',
  // 阶段（3）
  '执行前': 'Before', '执行中': 'During', '执行后': 'After',
  // 行动词（16，按预制首现序）
  '拆解': 'Decompose', '检验': 'Verify', '归因': 'Attribution', '决策': 'Decide', '理解': 'Understand',
  '路线': 'Roadmap', '概念': 'Concepts', '考验': 'Quiz', '审查': 'Review', '测试': 'Test',
  '重构': 'Refactor', '解读': 'Explain', '启动': 'Kickoff', '固化': 'Freeze', '记录': 'Log', '复盘': 'Retrospect',
}

/** 单个数据词的显示形：en 且命中预制词表 → 英文；其余（zh / 用户词 / 表外词）→ 原文原样。 */
export function displayWord(word: string, lang: Lang): string {
  if (lang !== 'en') return word
  const hit = PRESET_WORD_EN[word]
  return hit === undefined ? word : hit
}

/** 是否预制词（云行/标签选择格据此决定要不要走英译，也便于门禁自证）。 */
export function isPresetWord(word: string): boolean {
  return Object.prototype.hasOwnProperty.call(PRESET_WORD_EN, word)
}

/**
 * #142 回落词显示映射 + #145 预制词英译（只读展示位专用，逻辑位一律不用）。
 * templateLabels(t) 里**全等** LABEL_FALLBACK（'自定义'，===，大小写敏感）的段换成 tr(lang, STR.labelFallback)；
 * 预制词段走 displayWord；其余段原文原样（大小写不动，遵 #134 code-review 结论：用户词保大小写）。
 * 存储与全部比较（matchLabel/isExcludedLabel/过滤/评分/落盘）继续用原值，本函数永不回写。
 * 循环依赖检查（2026-10-09）：store.ts 仅 import ./templates，i18n.ts 仅 import ./locale，
 * 均不 import keys —— keys → store/templates + keys → i18n/locale 单向，无环（tsc + 转译测试双重验证）。
 * 门禁口径（#138）：这些位置是**数据词**（dataWords 剔除），故英译后 en 铬无 CJK 断言不受影响，
 * 也不进 P1 溢出预算（预算只卡铬键）。
 */
export function displayLabels(t: PromptTemplate, lang: Lang): string[] {
  return templateLabels(t).map((seg) => {
    if (seg === LABEL_FALLBACK) return tr(lang, STR.labelFallback)
    return displayWord(seg, lang)
  })
}

/** 标签串显示形（展示共用；分隔符 '/'，与 store.labelString 同口径，仅回落段与预制词跟语言）。 */
export function displayLabelString(t: PromptTemplate, lang: Lang, sep = '/'): string {
  return displayLabels(t, lang).join(sep)
}
