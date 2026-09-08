/**
 * dsh-prompt — 持久化与列表逻辑（#20 直接切换：DSH 缓存目录为准）
 *
 * - customs / usage / pinned / lastUsed 不再读写 localStorage（旧键原地废弃、不读取）。
 *   首屏即空（旧数据按用户裁定丢弃），host 快照到达后更新。
 * - Host：同源 HTTP 桥 /_dsh/dsh-prompt/*（lib/index.js，storages/dsh_prompt.json）。
 *   智能开关与悬浮卡位置仍在 localStorage（纯本机 UI 偏好，无跨端意义，不进 domain）。
 * - 同步 API 保持（panel/trigger/match/smart 零改调用方）：读走内存缓存，
 *   写先更新缓存再 fire-and-forget 落 host；失败仅 console.warn（fail-soft，
 *   抄 projcache/vision-router warn-only，不静默丢也不崩 UI）。
 */
import type { PromptTemplate } from './templates'
import { PRESET_TEMPLATES, getPresetById } from './templates'

const MAX_PIN = 5
const MAX_BODY = 1000

const STORE_URL = '/_dsh/dsh-prompt/store'
const PUT_URL = '/_dsh/dsh-prompt/customs/put'
const DELETE_URL = '/_dsh/dsh-prompt/customs/delete'
const BUMP_URL = '/_dsh/dsh-prompt/usage/bump'
const PINNED_URL = '/_dsh/dsh-prompt/pinned/set'

/** 自定义模板：builtin=false；tag 为自定义标签（默认「自定义」）；domain/stage/action 走预制标签体系 */
export interface CustomTemplate extends PromptTemplate {
  tag: string
  createdAt: number
}

interface StoreSnapshot {
  customs: CustomTemplate[]
  usage: Record<string, number>
  pinned: string[]
  lastUsed: string | null
}

/* ── 内存缓存（唯一真相来源；初始空 = 直接切换语义） ── */

const cache: StoreSnapshot = { customs: [], usage: {}, pinned: [], lastUsed: null }
let storeLoaded = false
let loadPromise: Promise<void> | null = null
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

/** 拉取 host 快照并装入缓存（失败 → 保持内存默认 + warn，不读旧 localStorage）。 */
export function ensureLoaded(): Promise<void> {
  if (storeLoaded) return Promise.resolve()
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    const data = await fetchJSON(STORE_URL)
    if (data && data.ok && data.value) {
      const v = data.value as Partial<StoreSnapshot>
      if (Array.isArray(v.customs)) cache.customs = v.customs as CustomTemplate[]
      if (v.usage && typeof v.usage === 'object') cache.usage = v.usage as Record<string, number>
      if (Array.isArray(v.pinned)) cache.pinned = (v.pinned as unknown[]).filter((x): x is string => typeof x === 'string')
      cache.lastUsed = typeof v.lastUsed === 'string' ? v.lastUsed : null
    } else {
      try { console.warn('[dsh-prompt] store snapshot unavailable, using memory defaults') } catch (e) { /* ignore */ }
    }
    storeLoaded = true
    notifyStore()
  })().finally(() => { /* keep loadPromise for dedupe until resolved */ })
  return loadPromise
}

/** fire-and-forget 落盘（失败 warn，不回滚内存、不抛给 UI）。 */
function persist(url: string, body: unknown): void {
  try {
    if (typeof fetch === 'undefined') return
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(
      () => undefined,
      (e) => { try { console.warn('[dsh-prompt] persist failed', url, String(e && (e as Error).message || e)) } catch (err) { /* ignore */ } },
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
  for (const t of cache.customs) persist(PUT_URL, { template: t })
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

/** 全部模板（预制 + 自定义） */
export function allTemplates(): PromptTemplate[] {
  return [...PRESET_TEMPLATES, ...cache.customs]
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

/** 排序：置顶（pin 在前）→ 用量计数降序。用量仅供排序，不显示数字。
 *  #22 决议（用户 2026-09-09 裁定）：此降序为设置页与 /prompt 的保留语义——
 *  设置页是管理面（Q2=C），/prompt 的宿主菜单打开即 scrollTop=0 且高亮钉在 index 0，
 *  反转后首屏与回车选中都会变成最不常用（Q6=A）。悬浮列表与智能卡走 bottom-up。 */
export function sortedTemplates(list: PromptTemplate[]): PromptTemplate[] {
  const usage = cache.usage
  const pinned = cache.pinned
  const pinIdx = (id: string) => { const i = pinned.indexOf(id); return i < 0 ? MAX_PIN : i }
  return [...list].sort((a, b) => {
    const pa = pinIdx(a.id), pb = pinIdx(b.id)
    if (pa !== pb) return pa - pb
    return (usage[b.id] || 0) - (usage[a.id] || 0)
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

/** bottom-up 排序：最常用在底部（DOM 底部 = 视觉底部），未使用在顶部
 *  - 主键：用量升序（0→max，max 最靠底）—— 保证“最常用在底部”绝对可见
 *  - 次键：同用量时置顶靠后（更贴底），置顶内按 pin 顺序
 *  - 末键：预制原始顺序 / 自定义创建时间（稳定可预期）
 *  说明：与设置页的“置顶绝对优先”不同，此处用量优先于置顶，避免低用量置顶把高用量挤到次底部而被误判为“最常用不在底部”。
 */
export function sortedTemplatesBottomUp(list: PromptTemplate[]): PromptTemplate[] {
  const usage = cache.usage
  const pinned = cache.pinned
  const isPinned = (id: string) => pinned.indexOf(id) >= 0
  const pinIdx = (id: string) => pinned.indexOf(id)
  return [...list].sort((a, b) => {
    const ua = usage[a.id] || 0, ub = usage[b.id] || 0
    if (ua !== ub) return ua - ub // 主键升序：少用在上，多用在下
    const ap = isPinned(a.id), bp = isPinned(b.id)
    if (ap !== bp) return ap ? 1 : -1 // 同用量时置顶靠后（更贴底）
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

/** 新增自定义模板 */
export function addCustom(name: string, tag: string, body: string): CustomTemplate {
  const t: CustomTemplate = {
    id: 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    name, nameEn: '', domain: '执行', stage: '执行前', action: [],
    body, builtin: false, tag, createdAt: Date.now(),
  }
  cache.customs = [...cache.customs, t]
  notifyStore()
  persist(PUT_URL, { template: t })
  return t
}

/** 更新自定义模板 */
export function updateCustom(id: string, patch: { name?: string; tag?: string; body?: string }): void {
  cache.customs = cache.customs.map((t) => {
    if (t.id !== id) return t
    const next = { ...t }
    if (patch.name !== undefined) next.name = patch.name
    if (patch.tag !== undefined) next.tag = patch.tag
    if (patch.body !== undefined) next.body = patch.body
    persist(PUT_URL, { template: next })
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

/** 复制预制为自定义 */
export function copyPresetToCustom(id: string): CustomTemplate | null {
  const src = getPresetById(id)
  if (!src) return null
  return addCustom(src.name + '（副本）', src.domain, src.body)
}

export { MAX_BODY }
