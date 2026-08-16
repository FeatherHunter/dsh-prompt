/**
 * dsh-prompt — 智能匹配引擎（v1.1）
 * 评分 = 专属词×2 + 通用词×1；门限 ≥2 出卡（专属×1 或 通用×2，宁缺毋滥）；
 * 候选 ≤3 = top-2 评分 + 1 最近使用（去重，不足不凑）；
 * 排序 = 评分（专属优先）→ 用量计数；代码块内关键词降权；
 * 与 /prompt 共用模板数据/排序基础（架构：allTemplates/bumpUsage/loadLastUsed）。
 */
import type { PromptTemplate } from './templates'
import { allTemplates, getTemplate, loadUsage, loadLastUsed } from './store'
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

/** 智能候选：draft → ≤3 条（top-2 评分 + 1 最近使用），不足不凑；自定义无词表，仅经最近使用槽进入 */
export function smartCandidates(draft: string): ScoredTemplate[] {
  const text = draft.trim().toLowerCase()
  if (!text || text.length < 2) return []
  if (insideCodeBlock(draft)) return []
  const usage = loadUsage()
  const scored: ScoredTemplate[] = []
  for (const tpl of allTemplates()) {
    if (!tpl.builtin) continue
    const r = scoreDraft(text, tpl)
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
  return top
}

/** DEC11 修订：插入后光标定位到第一个字段的冒号后（冒号表单式正文）；无字段 → 正文末尾 */
export function firstFieldCaret(body: string): number {
  const i = body.indexOf('：')
  return i < 0 ? body.length : i + 1
}
