/**
 * dsh-prompt — /prompt 触发源（inputTriggers registerSource）
 * #9：trigger=/ name=prompt；列出预制+自定义模板，支持过滤（标签/搜索）；选中即插入（span 替换，与面板插入一致）。
 * v1 只做「列出+过滤」，不做评分匹配（评分/强弱词留给 v1.1 智能卡 #10）；排序与面板共用（置顶→用量，sortedTemplates）。
 */
import type { PromptTemplate } from './templates'
import {
  allTemplates, sortedTemplates, templateHaystack, displayTag, getTemplate, bumpUsage,
} from './store'

const SOURCE_NAME = 'prompt'
const MAX_ITEMS = 30

export interface PromptTriggerSource {
  trigger: string
  name: string
  order: number
  candidates(projection: unknown, req: { query: string; position: string; signal?: AbortSignal }): Promise<Array<{ name: string; description: string; templateId: string }>>
  onPick(pick: { candidate: { templateId: string } }): { text: string } | undefined
}

/**
 * /prompt 过滤：先剥离源名前缀（/prompt 本身 → 全量列出；/prompt <词> → 按词过滤），
 * 剩余词匹配 名称/英文名/正文/领域/阶段/动作/标签（场景标签手动筛选的检索底座）。
 */
export function filterPromptTemplates(query: string): PromptTemplate[] {
  let q = (query || '').trim()
  const ql = q.toLowerCase()
  const src = SOURCE_NAME.toLowerCase()
  if (ql === src || ql.startsWith(src + ' ') || ql.startsWith(src + '\t') || ql.startsWith(src + '\n')) {
    q = q.slice(src.length).trim()
  }
  if (!q) return sortedTemplates(allTemplates())
  const needle = q.toLowerCase()
  return sortedTemplates(allTemplates().filter((x) => templateHaystack(x).indexOf(needle) >= 0))
}

/** /prompt 触发源（inputTriggers source 契约：candidates → onPick → {text} span 替换） */
export function buildPromptSource(): PromptTriggerSource {
  return {
    trigger: '/',
    name: SOURCE_NAME,
    order: 5, // '/' 分组内排在 command(0)、skill(2) 之后
    candidates: async (_projection, req) =>
      filterPromptTemplates(req.query).slice(0, MAX_ITEMS).map((t) => ({
        name: t.name,
        description: displayTag(t) + ' · ' + t.stage + ' — ' + (t.body || '').replace(/\s+/g, ' ').slice(0, 42),
        templateId: t.id,
      })),
    onPick: (pick) => {
      const tpl = getTemplate(pick.candidate.templateId)
      if (!tpl) return undefined
      bumpUsage(tpl.id) // 与面板插入一致：用量仅排序不显示
      return { text: tpl.body }
    },
  }
}
