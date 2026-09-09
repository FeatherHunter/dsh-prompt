/**
 * dsh-prompt — /prompt 触发源（inputTriggers registerSource）
 * #9：trigger=/ name=prompt；列出预制+自定义模板，支持过滤（标签/搜索）；选中即插入（span 替换，与面板插入一致）。
 * v1 只做「列出+过滤」，不做评分匹配（评分/强弱词留给 v1.1 智能卡 #10）；排序与面板共用（置顶→用量，sortedTemplates）。
 * #22 决议（用户 2026-09-09 裁定，Q6=A）：/prompt 保留降序为例外——宿主 slash-menu 打开即 scrollTop=0
 * 且初始高亮钉在 index 0（dsh-client-ui-input-trigger MenuView/firstHighlight），反转后首屏可见区与回车
 * 默认选中都会变成最不常用；返回集合仍是最常用的 30 条头部截取（集合与改前一致）。
 * #23 统一标签：过滤 = 标签包含 OR 全文检索兼容；描述行 = 标签串 + 正文前段（截断长度不变）。
 */
import type { PromptTemplate } from './templates'
import {
  allTemplates, sortedTemplates, templateHaystack, labelString, matchLabel, getTemplate, bumpUsage,
  ensureLoaded,
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
 * /prompt 过滤：先剥离源名前缀（`/prompt` 本身 → 全量列出；`/prompt <词>` 与
 * `/prompt<词>`（无空格，宿主 slash 会话遇到空白即结束、带空格的 query 到不了这里）
 * → 按词过滤），剩余词匹配同一标签（含预置派生与自定义自选）或全文检索（haystack 兼容旧找法）。
 */
export function filterPromptTemplates(query: string): PromptTemplate[] {
  let q = (query || '').trim()
  const ql = q.toLowerCase()
  const src = SOURCE_NAME.toLowerCase()
  if (ql.startsWith(src)) {
    q = q.slice(src.length).trim()
  }
  if (!q) return sortedTemplates(allTemplates())
  const needle = q.toLowerCase()
  return sortedTemplates(allTemplates().filter((x) => matchLabel(x, q) || templateHaystack(x).indexOf(needle) >= 0))
}

/** /prompt 触发源（inputTriggers source 契约：candidates → onPick → {text} span 替换） */
export function buildPromptSource(): PromptTriggerSource {
  return {
    trigger: '/',
    name: SOURCE_NAME,
    order: 5, // '/' 分组内排在 command(0)、skill(2) 之后
    candidates: async (_projection, req) => {
      try { await ensureLoaded() } catch (e) { /* host 不可用时用内存默认 */ }
      return filterPromptTemplates(req.query).slice(0, MAX_ITEMS).map((t) => ({
        name: t.name,
        description: labelString(t) + ' — ' + (t.body || '').replace(/\s+/g, ' ').slice(0, 42),
        templateId: t.id,
      }))
    },
    onPick: (pick) => {
      const tpl = getTemplate(pick.candidate.templateId)
      if (!tpl) return undefined
      bumpUsage(tpl.id) // 与面板插入一致：用量仅排序不显示
      return { text: tpl.body }
    },
  }
}
