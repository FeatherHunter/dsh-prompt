/**
 * dsh-prompt — 智能匹配引擎（v1.1）
 * 评分 = 专属词×2 + 通用词×1；门限 ≥2 出卡（专属×1 或 通用×2，宁缺毋滥）；
 * 候选 ≤3 = top-2 评分 + 1 最近使用（去重，不足不凑）；
 * 显示顺序（#22 bottom-up，用户 2026-09-09 裁定）：评分升序（最相关在底部）→ 用量升序；
 * 代码块内关键词降权；
 * 与 /prompt 共用模板数据/排序基础（架构：allTemplates/bumpUsage/loadLastUsed）。
 */
import type { PromptTemplate } from './templates'
import { allTemplates, getTemplate, loadUsage, loadLastUsed, loadPinned, tieBreakOrder, templateLabels, LABEL_FALLBACK } from './store'
import { SMART_WORDS } from './words'

export const SMART_THRESHOLD = 2

export interface ScoreResult {
  score: number
  strong: string[]
  weak: string[]
}

export interface ScoredTemplate {
  tpl: PromptTemplate
  score: number
  strongHits: string[]
  weakHits: string[]
}

/** 命中统计：专属词×2 + 通用词×1（子串匹配，忽略大小写） */
export function scoreDraft(draft: string, tpl: PromptTemplate): ScoreResult {
  const words = SMART_WORDS[tpl.id]
  if (!words) return { score: 0, strong: [], weak: [] }
  const text = draft.toLowerCase()
  const strong = words.strong.filter((w) => text.includes(w.toLowerCase()))
  const weak = words.weak.filter((w) => text.includes(w.toLowerCase()))
  return { score: strong.length * 2 + weak.length, strong, weak }
}

/**
 * 自定义评分（#32）：自选标签命中按强词 +2，名称/正文命中按弱词 +1（子串匹配，忽略大小写）。
 * 空 / 仅回落“自定义” / 单字标签不参评（0 分，仅 lastUsed 槽可见）。
 * 名称/正文用自身文本匹配（不用 templateHaystack——haystack 含 labels，会重复计分）。
 */
export function scoreCustomLabels(draft: string, tpl: PromptTemplate): ScoreResult {
  const text = draft.toLowerCase()
  const labels = templateLabels(tpl)
    .map((l) => l.trim())
    .filter((l) => Array.from(l).length >= 2 && l !== LABEL_FALLBACK)
  if (labels.length === 0) return { score: 0, strong: [], weak: [] }
  const strong = labels.filter((l) => text.includes(l.toLowerCase()))
  const weak: string[] = []
  const name = (tpl.name || '').trim()
  if (name && text.includes(name.toLowerCase())) weak.push(name)
  const body = (tpl.body || '').trim()
  if (body && text.includes(body.toLowerCase())) weak.push(body.slice(0, 12) + '…')
  return { score: strong.length * 2 + weak.length, strong, weak }
}

/** 代码块降权：draft 中 ``` 出现奇数次 → 视为处于代码块内 → 抑制出卡 */
export function insideCodeBlock(draft: string): boolean {
  let n = 0
  let i = 0
  for (;;) {
    i = draft.indexOf('```', i)
    if (i < 0) break
    n++
    i += 3
  }
  return n % 2 === 1
}

/** 智能候选：draft → ≤3 条（top-2 评分 + 1 最近使用），不足不凑
 *  #22 决议：候选集不变（评分链、阈值、top-2 + 最近使用均不动），仅显示顺序改为统一 bottom-up——
 *  评分升序（最相关在底部）→ 用量升序 → 同键置顶更贴底 → 预制原始顺序/自定义创建时间；
 *  最近使用槽（score=0）不做特例，自然落到最顶部（Q4=A）。
 *  #32：自定义经自选标签进入评分（scoreCustomLabels），与预置同池竞争 top-2；
 *  空/回落/单字标签 0 分，仅 lastUsed 槽可见。
 */
export function smartCandidates(draft: string): ScoredTemplate[] {
  const text = draft.trim().toLowerCase()
  if (!text || text.length < 2) return []
  if (insideCodeBlock(draft)) return []
  const usage = loadUsage()
  const scored: ScoredTemplate[] = []
  for (const tpl of allTemplates()) {
    const r = tpl.builtin ? scoreDraft(text, tpl) : scoreCustomLabels(text, tpl)
    if (r.score >= SMART_THRESHOLD) scored.push({ tpl, score: r.score, strongHits: r.strong, weakHits: r.weak })
  }
  scored.sort((a, b) => b.score - a.score || (usage[b.tpl.id] || 0) - (usage[a.tpl.id] || 0))
  const top = scored.slice(0, 2)
  const used = new Set(top.map((s) => s.tpl.id))
  const recentId = loadLastUsed()
  if (recentId && !used.has(recentId)) {
    const tpl = getTemplate(recentId)
    if (tpl) top.push({ tpl, score: 0, strongHits: [], weakHits: [] })
  }
  // 统一 bottom-up 显示顺序：悬浮列表公式以评分为主键套用（最相关贴底）
  const pinned = loadPinned()
  const pinIdx = (id: string) => pinned.indexOf(id)
  top.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score // 评分升序：最相关在底部
    const ua = usage[a.tpl.id] || 0, ub = usage[b.tpl.id] || 0
    if (ua !== ub) return ua - ub // 同分时用量升序
    const ap = pinIdx(a.tpl.id), bp = pinIdx(b.tpl.id)
    if (ap !== bp) return ap < 0 ? -1 : (bp < 0 ? 1 : ap - bp) // 同键时置顶更贴底，置顶内按 pin 顺序
    return tieBreakOrder(a.tpl, b.tpl) // 末键：预制原始顺序 / 自定义创建时间
  })
  return top
}

/** DEC11 修订：插入后光标定位到第一个字段的冒号后（冒号表单式正文）；无字段 → 正文末尾 */
export function firstFieldCaret(body: string): number {
  const i = body.indexOf('：')
  return i < 0 ? body.length : i + 1
}
