/**
 * /prompt 触发源装配（#171 N6：可 import 者 —— index）。
 * 跑浏览器 bundle 线；禁被 src/update/host 进口（DO-NOT-IMPORT），禁跨运行时进口。
 */
/**
 * dsh-prompt — /prompt 触发源（inputTriggers registerSource）
 * #9：trigger=/ name=prompt；列出预制+自定义模板，支持过滤（标签/搜索）；选中即插入（span 替换，与面板插入一致）。
 * v1 只做「列出+过滤」，不做评分匹配（评分/强弱词留给 v1.1 智能卡 #10）；排序与面板共用 sortedTemplates（#68 起忽略置顶、只留用量降序）。
 * #22 决议（用户 2026-09-09 裁定，Q6=A）：/prompt 保留降序为例外——宿主 slash-menu 打开即 scrollTop=0
 * 且初始高亮钉在 index 0（dsh-client-ui-input-trigger MenuView/firstHighlight），反转后首屏可见区与回车
 * 默认选中都会变成最不常用；返回集合仍是最常用的 30 条头部截取（集合与改前一致）。
 * #23 统一标签：过滤 = 标签包含 OR 全文检索兼容；描述行 = 标签串 + 正文前段（截断长度不变）。
 */
import type { PromptTemplate } from './templates'
import {
  allTemplates, sortedTemplates, templateHaystack, matchLabel, getTemplate, bumpUsage,
  ensureLoaded, oneLinePreview, stripCursorMarkers,
} from './template-library'
import { displayLabelString } from './label-identity'
import { resolveLocale } from './locale'

const SOURCE_NAME = 'prompt'
/** 候选上限（宿主一屏可容纳量）；导出供回归脚本对齐，不参与持久化。 */
export const MAX_ITEMS = 30

export interface PromptTriggerSource {
  trigger: string
  name: string
  order: number
  candidates(projection: unknown, req: { query: string; position: string; signal?: AbortSignal }): Promise<Array<{ name: string; description: string; templateId: string }>>
  onPick(pick: { candidate: { templateId: string } }): { text: string } | undefined
}

/**
 * /prompt 过滤（#196：裸 `/` 不再列出模板）。
 *  - 空 query（宿主触发组刚打开、用户只敲了 `/`）→ []：宿主对空候选组整组不渲染，
 *    命令/技能组不会再被 30 条模板挤到下面；要看模板必须显式敲源名。
 *  - `/prompt`（大小写不敏感）→ 全量；尾部空白不影响。
 *  - 精确 `/p` → 全量：README 两页一直把 `/p` 写成入口，这里补成精确别名（#196）。
 *    `/p<词>` 不在承诺内 —— 按普通检索词处理（不剥 p 前缀），不会静默变成全量。
 *  - `/prompt<词>`：剥掉源名前缀后按「标签 OR 全文检索」过滤（#23 规则；宿主 slash 会话
 *    遇空白即结束，无空格是唯一可达形态，带空格形式仅作宽容处理）。
 */
export function filterPromptTemplates(query: string): PromptTemplate[] {
  const trimmed = (query || '').trim()
  if (!trimmed) return []
  const lower = trimmed.toLowerCase()
  const sourceLower = SOURCE_NAME.toLowerCase()
  let keyword = trimmed
  if (lower.startsWith(sourceLower)) {
    keyword = trimmed.slice(SOURCE_NAME.length).trim()
  } else if (lower === 'p') {
    keyword = '' // 精确 /p = 全量别名，与 /prompt 同一条路径
  }
  if (!keyword) return sortedTemplates(allTemplates())
  const needle = keyword.toLowerCase()
  return sortedTemplates(allTemplates().filter((x) => matchLabel(x, keyword) || templateHaystack(x).indexOf(needle) >= 0))
}

/** /prompt 触发源（inputTriggers source 契约：candidates → onPick → {text} span 替换） */
export function buildPromptSource(): PromptTriggerSource {
  return {
    trigger: '/',
    name: SOURCE_NAME,
    order: 5, // '/' 分组内排在 command(0)、skill(2) 之后
    candidates: async (_projection, req) => {
      try { await ensureLoaded() } catch (e) { /* host 不可用时用内存默认 */ }
      // #142：描述行标签段走显示映射（逻辑过滤仍走 matchLabel 原值）；trigger 无 React 订阅面，
      // 按次 resolveLocale() 取 live 语言（candidates 每 query 调一次，切语言下次即翻；不新增裸 getLang）。
      return filterPromptTemplates(req.query).slice(0, MAX_ITEMS).map((t) => ({
        name: t.name,
        // #178：描述行取单行预览（剥标记 + 空白压成单空格），不显示 {{cursor}}、不出空首行。
        description: displayLabelString(t, resolveLocale()) + ' — ' + oneLinePreview(t.body).slice(0, 42),
        templateId: t.id,
      }))
    },
    onPick: (pick) => {
      const tpl = getTemplate(pick.candidate.templateId)
      if (!tpl) return undefined
      bumpUsage(tpl.id) // 与面板插入一致：用量仅排序不显示
      // #178 R2：斜杠管线只剥光标标记、不承诺光标落位（宿主替换 span 后光标由宿主定）。
      return { text: stripCursorMarkers(tpl.body).text }
    },
  }
}
