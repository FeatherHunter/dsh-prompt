/**
 * dsh-prompt — 持久化与列表逻辑
 * localStorage 键空间：dsh.prompt.customs / dsh.prompt.usage / dsh.prompt.pinned
 * 用量计数仅排序不显示（#4/#5 决策）；置顶 ≤5。
 */
import type { PromptTemplate } from './templates'
import { PRESET_TEMPLATES, getPresetById } from './templates'

const CUSTOMS_KEY = 'dsh.prompt.customs'
const USAGE_KEY = 'dsh.prompt.usage'
const PINNED_KEY = 'dsh.prompt.pinned'
const LAST_USED_KEY = 'dsh.prompt.lastUsed'
const MAX_PIN = 5
const MAX_BODY = 1000

function ls(): Storage | null {
  try { return typeof globalThis !== 'undefined' && globalThis.localStorage ? globalThis.localStorage : null } catch (e) { return null }
}
function loadJSON<T>(key: string, fallback: T): T {
  try {
    const s = ls()
    if (!s) return fallback
    const raw = s.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch (e) { return fallback }
}
function saveJSON(key: string, value: unknown): void {
  try { const s = ls(); if (s) s.setItem(key, JSON.stringify(value)) } catch (e) { /* ignore */ }
}

/** 自定义模板：builtin=false；tag 为自定义标签（默认「自定义」）；domain/stage/action 走预制标签体系 */
export interface CustomTemplate extends PromptTemplate {
  tag: string
  createdAt: number
}

export function loadCustoms(): CustomTemplate[] {
  return loadJSON<CustomTemplate[]>(CUSTOMS_KEY, [])
}
export function saveCustoms(list: CustomTemplate[]): void {
  saveJSON(CUSTOMS_KEY, list)
}

export function loadUsage(): Record<string, number> {
  return loadJSON<Record<string, number>>(USAGE_KEY, {})
}
export function bumpUsage(id: string): void {
  const u = loadUsage()
  u[id] = (u[id] || 0) + 1
  saveJSON(USAGE_KEY, u)
  saveJSON(LAST_USED_KEY, id) // 最近使用（智能卡「1 条最近」槽）
}

/** 最近一次使用的模板 id（智能模式「最近使用」候选；无 → null） */
export function loadLastUsed(): string | null {
  try {
    const s = ls()
    if (!s) return null
    const raw = s.getItem(LAST_USED_KEY)
    return raw ? JSON.parse(raw) as string : null
  } catch (e) { return null }
}

export function loadPinned(): string[] {
  return loadJSON<string[]>(PINNED_KEY, [])
}
export function savePinned(ids: string[]): void {
  saveJSON(PINNED_KEY, ids)
}

/** 全部模板（预制 + 自定义） */
export function allTemplates(): PromptTemplate[] {
  return [...PRESET_TEMPLATES, ...loadCustoms()]
}

export function getTemplate(id: string): PromptTemplate | undefined {
  return allTemplates().find((t) => t.id === id)
}

/** 展示标签：预制 = 领域；自定义 = tag（默认「自定义」） */
export function displayTag(t: PromptTemplate): string {
  if (!t.builtin) return (t as CustomTemplate).tag || '自定义'
  return t.domain
}

/** 检索串（面板搜索与 /prompt 触发源共用）：名称/英文名/正文/领域/阶段/动作/标签 */
export function templateHaystack(t: PromptTemplate): string {
  const tag = !t.builtin ? ((t as CustomTemplate).tag || '自定义') : ''
  return (t.name + ' ' + (t.nameEn || '') + ' ' + (t.body || '') + ' ' + t.domain + ' ' + t.stage + ' ' + (t.action || []).join(' ') + ' ' + tag).toLowerCase()
}

/** 排序：置顶（pin 在前）→ 用量计数降序。用量仅供排序，不显示数字。 */
export function sortedTemplates(list: PromptTemplate[]): PromptTemplate[] {
  const usage = loadUsage()
  const pinned = loadPinned()
  const pinIdx = (id: string) => { const i = pinned.indexOf(id); return i < 0 ? MAX_PIN : i }
  return [...list].sort((a, b) => {
    const pa = pinIdx(a.id), pb = pinIdx(b.id)
    if (pa !== pb) return pa - pb
    return (usage[b.id] || 0) - (usage[a.id] || 0)
  })
}

/** 置顶原始顺序（预制按 final.md 定稿顺序，自定义按 createdAt）—— bottom-up 同分 tie-breaker */
const presetOrderMap = new Map<string, number>(PRESET_TEMPLATES.map((t, i) => [t.id, i]))
function tieBreakOrder(a: PromptTemplate, b: PromptTemplate): number {
  const aCustom = a as CustomTemplate
  const bCustom = b as CustomTemplate
  const aBuilt = !!a.builtin
  const bBuilt = !!b.builtin
  if (aBuilt && bBuilt) return (presetOrderMap.get(a.id) ?? 9999) - (presetOrderMap.get(b.id) ?? 9999)
  if (!aBuilt && !bBuilt) return (aCustom.createdAt || 0) - (bCustom.createdAt || 0)
  return aBuilt ? -1 : 1 // 预制在前，自定义在后（同为 0 次时稳定可预期）
}

/** bottom-up 排序：最常用在底部（DOM 底部 = 视觉底部），未使用在顶部
 *  - 非置顶在上、置顶簇在底部最贴近按钮
 *  - 簇内按用量升序（0→max，max 最靠底），同分按预制原始顺序 / 自定义创建时间
 */
export function sortedTemplatesBottomUp(list: PromptTemplate[]): PromptTemplate[] {
  const usage = loadUsage()
  const pinned = loadPinned()
  const isPinned = (id: string) => pinned.indexOf(id) >= 0
  const pinIdx = (id: string) => pinned.indexOf(id)
  return [...list].sort((a, b) => {
    const ap = isPinned(a.id), bp = isPinned(b.id)
    if (ap !== bp) return ap ? 1 : -1 // 非置顶在前（顶部），置顶在后（底部）
    const ua = usage[a.id] || 0, ub = usage[b.id] || 0
    if (ua !== ub) return ua - ub // 升序：少用在上，多用在下
    if (ap && bp) {
      const pa = pinIdx(a.id), pb = pinIdx(b.id)
      if (pa !== pb) return pa - pb
    }
    return tieBreakOrder(a, b)
  })
}

/** 置顶切换（置顶数 ≤5）；返回是否成功（超限返回 false） */
export function togglePin(id: string): { pinned: string[]; ok: boolean } {
  const pinned = loadPinned()
  const i = pinned.indexOf(id)
  if (i >= 0) { pinned.splice(i, 1) }
  else if (pinned.length >= MAX_PIN) { return { pinned, ok: false } }
  else { pinned.push(id) }
  savePinned(pinned)
  return { pinned, ok: true }
}

export function isPinned(id: string): boolean {
  return loadPinned().indexOf(id) >= 0
}

export function canPinMore(): boolean {
  return loadPinned().length < MAX_PIN
}

/** 新增自定义模板 */
export function addCustom(name: string, tag: string, body: string): CustomTemplate {
  const t: CustomTemplate = {
    id: 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    name, nameEn: '', domain: '执行', stage: '执行前', action: [],
    body, builtin: false, tag, createdAt: Date.now(),
  }
  const list = loadCustoms()
  list.push(t)
  saveCustoms(list)
  return t
}

/** 更新自定义模板 */
export function updateCustom(id: string, patch: { name?: string; tag?: string; body?: string }): void {
  const list = loadCustoms().map((t) => {
    if (t.id !== id) return t
    if (patch.name !== undefined) t.name = patch.name
    if (patch.tag !== undefined) t.tag = patch.tag
    if (patch.body !== undefined) t.body = patch.body
    return t
  })
  saveCustoms(list)
}

/** 删除自定义模板（仅限 builtin=false）；返回是否成功 */
export function removeCustom(id: string): boolean {
  const list = loadCustoms()
  const next = list.filter((t) => t.id !== id)
  if (next.length === list.length) return false
  saveCustoms(next)
  savePinned(loadPinned().filter((p) => p !== id))
  return true
}

/** 复制预制为自定义 */
export function copyPresetToCustom(id: string): CustomTemplate | null {
  const src = getPresetById(id)
  if (!src) return null
  return addCustom(src.name + '（副本）', src.domain, src.body)
}

export { MAX_BODY }
