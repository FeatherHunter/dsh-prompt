/**
 * dsh-prompt — 工作区/会话挑选器纯视图契约 + 机会链（#104 MAP，规格 #111/#113，原型 #108 v7，拍板 #107/#109）
 *
 * 约束（沿 #94/#95 政策）：
 * - 纯客户端机会面 + 探测式守卫 + 缺席降级，不新增桥路由、不碰草稿、不进持久化、不记新日志；
 * - 本文件无 React、无 DOM、无 fetch、无 logEvent、无持久化桥，只有纯函数 + 对宿主面的表层探测；
 * - 左折叠面是右侧栏面的语义镜像契约（#105 NO-GO 休眠：无面隐藏，有面自动出现，fail-soft）。
 */

/** 会话行（归一后的稳定形状） */
export interface WorkspaceSession {
  id: string
  title: string
  workspaceId: string | null
  workspaceName: string
  cwd: string
  updatedAt: number
  blank: boolean
  /** 同标题跨组冲突时打尾段芯片（v7：仅 s4/s7 这类冲突行显示） */
  collision?: boolean
}

/** 工作区分组槽位（纯视图输出） */
export interface WorkspaceGroup {
  key: string
  workspaceId: string | null
  name: string
  items: WorkspaceSession[]
  latest: number
  ungrouped: boolean
}

/** 未归属桶名（中英由调用方按 i18n 覆盖，这里只给默认中文；测试断分组逻辑不依赖文案） */
export const UNGROUPED_KEY = '__ungrouped'

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function asNumber(v: unknown, fallback: number): number {
  if (typeof v === 'number' && isFinite(v)) return v as number
  const n = Number(v)
  return isFinite(n) ? n : fallback
}

/** 容错读会话归属 id：workspaceId / workspace_id / workspace / groupId / wsId，只认非空 string */
export function sessionWorkspaceIdOf(raw: any): string | null {
  try {
    if (!raw || typeof raw !== 'object') return null
    const cands = [raw.workspaceId, raw.workspace_id, raw.workspace, raw.groupId, raw.wsId]
    for (const c of cands) {
      if (typeof c === 'string' && c.trim() !== '') return c
      if (c && typeof c === 'object' && typeof (c as any).id === 'string' && (c as any).id.trim() !== '') {
        return (c as any).id
      }
    }
    return null
  } catch (e) { return null }
}

function sessionTitleOf(raw: any, fallbackId: string): string {
  try {
    const cands = [raw.title, raw.name, raw.label]
    for (const c of cands) {
      if (typeof c === 'string' && c.trim() !== '') return c
    }
    return fallbackId
  } catch (e) { return fallbackId }
}

function sessionCwdOf(raw: any): string {
  try {
    const cands = [raw.cwd, raw.path, raw.dir, raw.workdir, raw.workspacePath]
    for (const c of cands) {
      if (typeof c === 'string' && c !== '') return c
    }
    if (raw && raw.meta && typeof raw.meta === 'object') {
      const m = (raw.meta as any).cwd
      if (typeof m === 'string' && m !== '') return m
    }
    if (raw && raw.header && typeof raw.header === 'object') {
      const h = (raw.header as any).cwd
      if (typeof h === 'string' && h !== '') return h
    }
    return ''
  } catch (e) { return '' }
}

function sessionTimeOf(raw: any): number {
  try {
    const cands = [raw.updatedAt, raw.updated_at, raw.mtime, raw.lastOpenedAt, raw.lastActiveAt]
    for (const c of cands) {
      const n = Number(c)
      if (isFinite(n) && n > 0) {
        // 秒级时间戳容错（<1e12 视为秒，转毫秒）
        return n < 1e12 ? n * 1000 : n
      }
    }
    return 0
  } catch (e) { return 0 }
}

function sessionBlankOf(raw: any, title: string): boolean {
  try {
    if ((raw as any).blank === true) return true
    if ((raw as any).isBlank === true) return true
    if (/空白/.test(title)) return true
    // 空标题会话按空白展示（#111 US22 照常展示，不丢失）
    if (title.trim() === '') return true
    return false
  } catch (e) { return false }
}

/** 单条归一（fail-soft：无 id 回 null，调用方过滤）。
 *  归属优先取 `index`（工作区登记反查，见 buildWorkspaceIndex）；查不到才退回会话自身字段探测。 */
export function normalizeSession(
  raw: any,
  workspaceNames?: Map<string, string> | Record<string, string>,
  index?: Map<string, WorkspaceIndexEntry>,
): WorkspaceSession | null {
  try {
    if (!raw || typeof raw !== 'object') return null
    const id = asString((raw as any).id || (raw as any).sid || (raw as any).sessionId)
    if (id === '') return null
    let hit: WorkspaceIndexEntry | null = null
    try { hit = index && typeof index.get === 'function' ? (index.get(id) || null) : null } catch (e) { hit = null }
    const wsId = hit ? hit.workspaceId : sessionWorkspaceIdOf(raw)
    let wsName = hit ? hit.workspaceName : ''
    try {
      if (workspaceNames instanceof Map) wsName = wsName || workspaceNames.get(wsId || '') || ''
      else if (workspaceNames && typeof workspaceNames === 'object') wsName = wsName || (workspaceNames as any)[wsId || ''] || ''
    } catch (e) { /* ignore */ }
    if (!wsName && raw && typeof raw === 'object') {
      const cands = [(raw as any).workspaceName, (raw as any).workspace_name, (raw as any).groupName]
      for (const c of cands) {
        if (typeof c === 'string' && c.trim() !== '') { wsName = c; break }
      }
    }
    const title = sessionTitleOf(raw, id)
    const ownCwd = sessionCwdOf(raw)
    return {
      id,
      title,
      workspaceId: wsId,
      workspaceName: wsName || (wsId || ''),
      cwd: ownCwd || (hit ? hit.path : ''),
      updatedAt: sessionTimeOf(raw),
      blank: sessionBlankOf(raw, title),
    }
  } catch (e) { return null }
}

/** 从多态快照里捞出原始条目数组（数组 / {items} / {sessions} / {byId}，其余回 []，不抛） */
export function rawSessionItems(input: unknown): any[] {
  try {
    if (!input) return []
    if (Array.isArray(input)) return input as any[]
    const o = input as any
    if (Array.isArray(o.items)) return o.items
    if (Array.isArray(o.sessions)) return o.sessions
    if (Array.isArray(o.list)) return o.list
    if (o.byId && typeof o.byId === 'object') {
      try { return Object.keys(o.byId).map((k) => o.byId[k]) } catch (e) { return [] }
    }
    if (typeof o === 'object') {
      // 单条会话对象（有 id）→ 包成一行，方便 sessions.get(sid) 这类单体面复用
      if (typeof o.id === 'string' && o.id !== '') return [o]
    }
    return []
  } catch (e) { return [] }
}

/** 批量归一（去重保首见序，无 id 行丢弃，不抛） */
export function normalizeSessions(
  input: unknown,
  workspaceNames?: Map<string, string> | Record<string, string>,
  index?: Map<string, WorkspaceIndexEntry>,
): WorkspaceSession[] {
  try {
    const raws = rawSessionItems(input)
    const out: WorkspaceSession[] = []
    const seen = new Set<string>()
    for (const r of raws) {
      const s = normalizeSession(r, workspaceNames, index)
      if (!s || seen.has(s.id)) continue
      seen.add(s.id)
      out.push(s)
    }
    return out
  } catch (e) { return [] }
}

/**
 * 从多态工作区登记里捞出原始登记数组（数组 / {items} / {workspaces} / {list} / {byId} / 单体，不抛）。
 * 名字表与反查索引共用这一条形态解析，两处不再各认一份形状。
 */
export function rawWorkspaceItems(input: unknown): any[] {
  try {
    if (!input) return []
    if (Array.isArray(input)) return input as any[]
    const o = input as any
    if (Array.isArray(o.items)) return o.items
    if (Array.isArray(o.workspaces)) return o.workspaces
    if (Array.isArray(o.list)) return o.list
    if (o.byId && typeof o.byId === 'object') {
      try {
        return Object.keys(o.byId).map((k) => {
          const r = o.byId[k]
          if (r && typeof r === 'object' && typeof r.id === 'string') return r
          if (typeof r === 'string') return { id: k, name: r }
          return { id: k, name: '' }
        })
      } catch (e) { return [] }
    }
    if (typeof o === 'object' && typeof o.id === 'string' && o.id !== '') return [o]
    return []
  } catch (e) { return [] }
}

/** 从多态工作区登记里捞出 id→名（数组 / {items} / {byId} / 单体，不抛） */
export function normalizeWorkspaceNames(input: unknown): Map<string, string> {
  const out = new Map<string, string>()
  try {
    const pushOne = (r: any): void => {
      try {
        if (!r || typeof r !== 'object') return
        const id = asString(r.id || r.workspaceId || r.key)
        if (id === '') return
        const name = asString(r.name || r.title || r.label) || id
        if (!out.has(id)) out.set(id, name)
      } catch (e) { /* ignore */ }
    }
    for (const r of rawWorkspaceItems(input)) pushOne(r)
    return out
  } catch (e) { return out }
}

/** 一条归属（反查索引的值：工作区 id + 展示名 + 路径） */
export interface WorkspaceIndexEntry {
  workspaceId: string
  workspaceName: string
  path: string
}

/**
 * 工作区登记 → `sessionId → 归属` 反查索引（**归属的权威来源**）。
 *
 * 宿主的归属关系存在**工作区这一侧**：`workspaceView` 的形状是
 * `{ workspaceId, path, title, sessionIds: string[], createdAt, updatedAt }`，
 * 会话对象自身**不带任何 workspaceId 字段**。所以归属只能从工作区登记反查——
 * 去会话身上找字段那条路恒为 null，会让所有会话塌进未归属桶、分组整面失效。
 * 登记里没有的会话保持无归属（调用方归未归属桶），不猜、不按 path 兜底。
 */
export function buildWorkspaceIndex(input: unknown): Map<string, WorkspaceIndexEntry> {
  const out = new Map<string, WorkspaceIndexEntry>()
  try {
    for (const r of rawWorkspaceItems(input)) {
      if (!r || typeof r !== 'object') continue
      const workspaceId = asString(r.workspaceId || r.id || r.key)
      if (workspaceId === '') continue
      const workspaceName = asString(r.title || r.name || r.label) || workspaceId
      const path = asString(r.path)
      const ids = Array.isArray(r.sessionIds) ? r.sessionIds : []
      for (const sid of ids) {
        const id = asString(sid)
        if (id === '' || out.has(id)) continue
        out.set(id, { workspaceId, workspaceName, path })
      }
    }
  } catch (e) { return out }
  return out
}

/**
 * 纯视图分组（#107 Q3 / #111 US8–US11）：
 * - 按 workspaceId 分组，无归属（null/''）进未归属桶；
 * - 未归属桶置底；其余组按组内最新倒序；
 * - 组内按 updatedAt 倒序；组头名 = 登记名 || workspaceId || 未归属；
 * - 同标题行打 collision=true（全局统计：跨组同名恰是真消歧场景；原型按组统计，此处故意 diverged，见审查结论 #9）；
 * - 不读存储不碰界面，纯函数。
 */
export function groupWorkspaceSessions(
  sessions: WorkspaceSession[],
  workspaceNames?: Map<string, string> | Record<string, string>,
  ungroupedName?: string,
): WorkspaceGroup[] {
  try {
    const list = Array.isArray(sessions) ? sessions.slice() : []
    const unName = typeof ungroupedName === 'string' && ungroupedName !== '' ? ungroupedName : '未归属'
    const nameOf = (wsId: string | null): string => {
      try {
        if (!wsId) return unName
        if (workspaceNames instanceof Map) return workspaceNames.get(wsId) || wsId
        if (workspaceNames && typeof (workspaceNames as any)[wsId] === 'string') return (workspaceNames as any)[wsId] || wsId
        return wsId
      } catch (e) { return wsId || unName }
    }
    // 先补工作区名（登记晚到也可在分组时回填，不改输入数组）
    const withNames = list.map((s) => {
      if (s.workspaceName && s.workspaceName !== '') return s
      if (!s.workspaceId) return { ...s, workspaceName: unName }
      return { ...s, workspaceName: nameOf(s.workspaceId) }
    })
    // 冲突统计：同标题出现 >1 即冲突（跨组/组内一视同仁，调用方只给冲突行显尾段）
    const titleCount = new Map<string, number>()
    for (const s of withNames) titleCount.set(s.title, (titleCount.get(s.title) || 0) + 1)
    const marked = withNames.map((s) => ({ ...s, collision: (titleCount.get(s.title) || 0) > 1 }))
    const map = new Map<string, WorkspaceGroup>()
    const order: string[] = []
    for (const s of marked) {
      const k = s.workspaceId || UNGROUPED_KEY
      let g = map.get(k)
      if (!g) {
        g = {
          key: k,
          workspaceId: s.workspaceId,
          name: s.workspaceId ? nameOf(s.workspaceId) : unName,
          items: [],
          latest: 0,
          ungrouped: !s.workspaceId,
        }
        map.set(k, g)
        order.push(k)
      }
      g.items.push(s)
      if (s.updatedAt > g.latest) g.latest = s.updatedAt
    }
    const groups = order.map((k) => map.get(k) as WorkspaceGroup)
    for (const g of groups) g.items.sort((a, b) => b.updatedAt - a.updatedAt)
    groups.sort((a, b) => {
      if (a.ungrouped && !b.ungrouped) return 1
      if (!a.ungrouped && b.ungrouped) return -1
      return b.latest - a.latest
    })
    return groups
  } catch (e) { return [] }
}

/** 搜索 haystack（标题 + 工作区名，未归属行用展示名回填，保证搜“未归属”可达；拼音/cwd 全文首版不做，留缝） */
export function sessionHaystack(s: WorkspaceSession, ungroupedName?: string): string {
  try {
    const wn = (s.workspaceName || '') !== '' ? s.workspaceName : (asString(ungroupedName) || '')
    return ((s.title || '') + ' ' + wn).toLowerCase()
  } catch (e) { return '' }
}

/** 搜索过滤（#107 Q4 / #111 US12–US14：大小写不敏感子串；空查询回全量；无结果回 [] 由调用方进空态，不回退） */
export function filterWorkspaceSessions(sessions: WorkspaceSession[], query: unknown, ungroupedName?: string): WorkspaceSession[] {
  try {
    const list = Array.isArray(sessions) ? sessions : []
    const q = String(query || '').trim().toLowerCase()
    if (q === '') return list.slice()
    return list.filter((s) => sessionHaystack(s, ungroupedName).indexOf(q) >= 0)
  } catch (e) { return [] }
}

/** 紧凑相对时间（v7 口径中文：刚刚/5分/3时/2天；英文：now/5m/3h/2d；悬停看绝对，不抛） */
export function relativeWorkspaceTime(ts: unknown, now?: number, lang?: string): string {
  try {
    const en = lang === 'en'
    const t = Number(ts)
    if (!isFinite(t) || t <= 0) return ''
    const base = typeof now === 'number' && isFinite(now) ? now : Date.now()
    const d = base - t
    if (d < 0) return en ? 'now' : '刚刚'
    const m = Math.floor(d / 60000)
    if (m < 1) return en ? 'now' : '刚刚'
    if (m < 60) return en ? m + 'm' : m + '分'
    const h = Math.floor(m / 60)
    if (h < 24) return en ? h + 'h' : h + '时'
    return en ? Math.floor(h / 24) + 'd' : Math.floor(h / 24) + '天'
  } catch (e) { return '' }
}

/** 绝对时间（title 悬停用，失败回 String(ts)，不抛） */
export function absoluteWorkspaceTime(ts: unknown): string {
  try {
    const t = Number(ts)
    if (!isFinite(t) || t <= 0) return ''
    try { return new Date(t).toLocaleString() } catch (e) { return String(ts) }
  } catch (e) { return '' }
}

/** 工作区配色（v7 色点通道：按 workspaceId 稳定哈希进固定调色盘，null 进未归属位；只定可辨，不定具体色） */
const WORKSPACE_DOT_COLORS = ['#f0a45c', '#7fd08a', '#b388ff', '#6cb8e0', '#e06c75', '#8ad0c8']
export function workspaceColor(wsId: string | null): string {
  try {
    const s = typeof wsId === 'string' && wsId !== '' ? wsId : '__ungrouped'
    let acc = 0
    for (let i = 0; i < s.length; i++) acc = (acc * 31 + s.charCodeAt(i)) >>> 0
    return WORKSPACE_DOT_COLORS[acc % WORKSPACE_DOT_COLORS.length]
  } catch (e) { return WORKSPACE_DOT_COLORS[0] }
}

/**
 * 工作区短码（v7 短码通道的数据驱动版：取归属名按分隔符切分的末段前 4 字；
 * 如 dsh-prompt→prom、dsh-opencode-palette→pale；空归属回 '' 由调用方按双语回退。
 * 原型 SHORT 表是演示数据硬编码（prompt/配色/散），生产不定死表。）
 */
export function workspaceShortCode(name: unknown, wsId: unknown): string {
  try {
    const raw = asString(name) || asString(wsId)
    if (raw === '') return ''
    const parts = raw.split(/[-_\/\\:.]+/).filter((p) => p !== '')
    const last = parts.length > 1 ? parts[parts.length - 1] : raw
    return last.slice(0, 4)
  } catch (e) { return '' }
}

/** 路径尾段（… + 尾段，空回 ''，不抛；v7 只给冲突行显） */
export function tailSegment(cwd: unknown): string {
  try {
    const s = asString(cwd)
    if (s === '') return ''
    const parts = s.split('/')
    const last = parts[parts.length - 1] || s
    return last
  } catch (e) { return '' }
}

/* ── 左折叠镜像面（#105 休眠契约：语义镜像右键，空面/残面/抛错一律 fail-soft） ── */

export interface WorkspaceLeftCtl {
  isExpanded?: () => boolean
  toggleExpanded?: () => void
}

/** 安全读左展开态：true=展开、false=折叠、null=未知（缺席/未实现/异常，不抛） */
export function readWorkspaceLeftExpanded(ctl: unknown): boolean | null {
  try {
    const f = (ctl as any) && (ctl as any).isExpanded
    if (typeof f !== 'function') return null
    const v = f.call(ctl)
    return v === true ? true : v === false ? false : null
  } catch (e) { return null }
}

/** 只切左栏：调宿主 toggleExpanded，不碰本插件任何 state、不记日志；返回是否真调到宿主面 */
export function toggleWorkspaceLeft(ctl: unknown): boolean {
  try {
    const f = (ctl as any) && (ctl as any).toggleExpanded
    if (typeof f !== 'function') return false
    f.call(ctl)
    return true
  } catch (e) { return false }
}

/** 左键门控：有切换面即有资格渲染（今天恒为 false → 休眠隐藏；宿主补面后自动出现） */
export function canShowWorkspaceLeft(ctl: unknown): boolean {
  try {
    return !!ctl && typeof (ctl as any).toggleExpanded === 'function'
  } catch (e) { return false }
}

/* ── 挑选器机会链（#106 可用面清单 + #111 探测式守卫，异步全捕获） ── */

export interface WorkspaceFaces {
  sessions?: any
  workspaces?: any
  uiWorkspace?: any
}

/** 同步双门控（#111 US27–US28 / #113 US6：可枚举且可切换双满足才出现；半残隐藏；探测中由调用方另置 pending） */
export function probeWorkspaceGates(faces: WorkspaceFaces | null | undefined): { enumerable: boolean; switchable: boolean } {
  try {
    if (!faces || typeof faces !== 'object') return { enumerable: false, switchable: false }
    const sessions = (faces as any).sessions
    const ui = (faces as any).uiWorkspace
    let enumerable = false
    try {
      if (sessions) {
        if (Array.isArray(sessions) && sessions.length >= 0) enumerable = true
        else if (typeof sessions === 'object') {
          const lst = (sessions as any).list
          if (lst && typeof lst.getSnapshot === 'function') enumerable = true
          else if (typeof (sessions as any).getSnapshot === 'function') enumerable = true
          else if (Array.isArray((sessions as any).items)) enumerable = true
          else if (Array.isArray((sessions as any).sessions)) enumerable = true
          else if ((sessions as any).byId && typeof (sessions as any).byId === 'object') enumerable = true
          // 注意：裸 sessions.get(sid) 是单体面（取一行要先有 id），不能枚举——
          // 它在此不算 enumerable（#106 点名它，但枚举链用不上；误算会导致假“真无会话”）。
        }
      }
    } catch (e) { enumerable = false }
    let switchable = false
    try {
      if (ui && typeof (ui as any).openSession === 'function') switchable = true
      else if (sessions && typeof (sessions as any).open === 'function') switchable = true
    } catch (e) { switchable = false }
    return { enumerable, switchable }
  } catch (e) { return { enumerable: false, switchable: false }
  }
}

/** 双满足才出现（门控唯一出口，调用方据此隐藏入口键） */
export function canShowWorkspacePicker(faces: WorkspaceFaces | null | undefined): boolean {
  try {
    const g = probeWorkspaceGates(faces)
    return g.enumerable === true && g.switchable === true
  } catch (e) { return false }
}

function callMaybeFn(v: unknown): unknown {
  try {
    if (typeof v === 'function') return (v as any)()
    return v
  } catch (e) { return undefined }
}

async function awaitMaybe(v: unknown): Promise<unknown> {
  try {
    if (v && typeof (v as any).then === 'function') return await (v as any)
    return v
  } catch (e) { throw e }
}

/** 从 sessions 机会面捞快照（多态容错：list.getSnapshot / getSnapshot / items / 数组 / get，异步全捕获） */
async function resolveSessionRaws(sessions: any): Promise<any[]> {
  const tries: Array<() => unknown> = []
  try {
    if (!sessions) return []
    if (Array.isArray(sessions)) return sessions
    if (typeof sessions === 'object') {
      const lst = (sessions as any).list
      if (lst && typeof lst.getSnapshot === 'function') {
        tries.push(() => lst.getSnapshot())
      }
      if (typeof (sessions as any).getSnapshot === 'function') {
        tries.push(() => (sessions as any).getSnapshot())
      }
      if (typeof (sessions as any).getSnapshots === 'function') {
        tries.push(() => (sessions as any).getSnapshots())
      }
      for (const t of tries) {
        try {
          const v = await awaitMaybe(callMaybeFn(t()))
          const items = rawSessionItems(v)
          if (items.length > 0) return items
        } catch (e) { /* 下一个形态 */ }
      }
      if (Array.isArray((sessions as any).items)) return (sessions as any).items
      if (Array.isArray((sessions as any).sessions)) return (sessions as any).sessions
      if ((sessions as any).byId && typeof (sessions as any).byId === 'object') {
        return rawSessionItems(sessions)
      }
    }
    return []
  } catch (e) { return [] }
}

/** 从 workspaces 机会面捞登记（多态容错：list.getSnapshot / getSnapshot / getCurrent / list / getAll / 数组，异步全捕获） */
async function resolveWorkspaceRaws(workspaces: any): Promise<any[]> {
  try {
    if (!workspaces) return []
    if (Array.isArray(workspaces)) return workspaces
    if (typeof workspaces === 'object') {
      const fns: unknown[] = []
      try {
        const lst = (workspaces as any).list
        if (lst && typeof lst.getSnapshot === 'function') fns.push(() => lst.getSnapshot())
        if (typeof (workspaces as any).getSnapshot === 'function') fns.push(() => (workspaces as any).getSnapshot())
        if (typeof (workspaces as any).getCurrent === 'function') fns.push(() => (workspaces as any).getCurrent())
        if (typeof (workspaces as any).list === 'function') fns.push(() => (workspaces as any).list())
        if (typeof (workspaces as any).getAll === 'function') fns.push(() => (workspaces as any).getAll())
      } catch (e) { /* ignore */ }
      for (const f of fns) {
        try {
          const v = await awaitMaybe(callMaybeFn(f as any))
          if (Array.isArray(v) && v.length > 0) return v
          if (v && typeof v === 'object') {
            const items = rawSessionItems(v)
            // 工作区登记与会话快照同形（items/byId），借复用；单体 getCurrent 也包一行
            if (items.length > 0) {
              // 单体 current（有 id 无 items）→ 包成一行登记
              if (items.length === 1 && (v as any).id && (items[0] as any).id === (v as any).id) return items
              return items
            }
            if ((v as any).id) return [v]
          }
        } catch (e) { /* 下一个形态 */ }
      }
      if (Array.isArray((workspaces as any).items)) return (workspaces as any).items
      if ((workspaces as any).byId) {
        try {
          const keys = Object.keys((workspaces as any).byId)
          if (keys.length > 0) return keys.map((k) => (workspaces as any).byId[k])
        } catch (e) { /* ignore */ }
      }
    }
    return []
  } catch (e) { return [] }
}

/**
 * 从 workspaces 面捞归档会话 id 集（快照 `archivedSessionIds` / 面直挂同名属性，多态容错，不抛）。
 * 归档 = 用户主动收起的会话，挑选器默认不列（否则快速切换列表会被历史垃圾淹没）。
 */
async function resolveArchivedSessionIds(workspaces: any): Promise<Set<string>> {
  const out = new Set<string>()
  const eat = (v: unknown): void => {
    if (!Array.isArray(v)) return
    for (const x of v) { const s = asString(x); if (s !== '') out.add(s) }
  }
  const eatSnapshot = (snap: unknown): void => {
    if (snap && typeof snap === 'object') eat((snap as any).archivedSessionIds)
  }
  try {
    if (!workspaces || typeof workspaces !== 'object') return out
    try {
      const lst = (workspaces as any).list
      if (lst && typeof lst.getSnapshot === 'function') eatSnapshot(await awaitMaybe(callMaybeFn(lst.getSnapshot())))
    } catch (e) { /* 下一个形态 */ }
    try {
      if (typeof (workspaces as any).getSnapshot === 'function') eatSnapshot(await awaitMaybe(callMaybeFn((workspaces as any).getSnapshot())))
    } catch (e) { /* 下一个形态 */ }
    try { eat((workspaces as any).archivedSessionIds) } catch (e) { /* ignore */ }
  } catch (e) { /* ignore */ }
  return out
}

export interface WorkspaceSnapshot {
  sessions: WorkspaceSession[]
  names: Map<string, string>
  /** 归档会话 id（已在 sessions 里滤掉，这里只作透传备查） */
  archived: Set<string>
}

/**
 * 枚举（每次打开重探，抄 sidebarCtl 晚到模式）：
 * - 成功回 {sessions, names, archived}（空数组即真无，由调用方进空态，不是失败）；
 * - 双面全空（连一个条目都捞不到且同步门控本就不满足）抛错，由调用方进失败/探测缺席；
 * - 全程异步全捕获，不抛宿主原生错以外的错。
 */
export async function enumerateWorkspaceSessions(faces: WorkspaceFaces | null | undefined): Promise<WorkspaceSnapshot> {
  try {
    if (!faces || typeof faces !== 'object') throw new Error('probe-absent')
    const gates = probeWorkspaceGates(faces)
    const [sRaws, wRaws, archived] = await Promise.all([
      resolveSessionRaws((faces as any).sessions),
      resolveWorkspaceRaws((faces as any).workspaces),
      resolveArchivedSessionIds((faces as any).workspaces),
    ])
    const names = normalizeWorkspaceNames(wRaws)
    // 归属只能从工作区登记反查（宿主把归属存在工作区侧 sessionIds[]，会话自身没有归属字段）。
    const index = buildWorkspaceIndex(wRaws)
    const sessions = normalizeSessions(sRaws, names, index)
    // 回填登记名（含单体 current 形态）
    const filled = sessions
      .filter((s) => !archived.has(s.id))
      .map((s) => {
        if (s.workspaceName && s.workspaceName !== '') return s
        if (!s.workspaceId) return { ...s, workspaceName: '' }
        return { ...s, workspaceName: names.get(s.workspaceId) || s.workspaceId }
      })
    if (filled.length === 0 && !gates.enumerable) throw new Error('probe-absent')
    return { sessions: filled, names, archived }
  } catch (e) {
    throw e instanceof Error ? e : new Error('probe-absent')
  }
}

/**
 * 切换（机会链：uiWorkspace.openSession 优先、sessions.open 回退，异步全捕获）：
 * - 成功回 true（调用方关挑选器）；
 * - 失败抛错（调用方留屏重试，不注入错误会话，沿 #739）；
 * - 只接 thenable 才等，非 thenable 视为同步成功；
 * - 不读写任何草稿。
 */
export async function switchWorkspaceSession(faces: WorkspaceFaces | null | undefined, sid: unknown): Promise<boolean> {
  try {
    const id = typeof sid === 'string' ? sid : String((sid as any) || '')
    if (id === '') throw new Error('switch-failed')
    if (!faces || typeof faces !== 'object') throw new Error('switch-failed')
    const ui = (faces as any).uiWorkspace
    const sessions = (faces as any).sessions
    // 失败不记日志（沿 #111 不记新日志约束），直接落到回退/抛错，调用方进留屏重试。
    if (ui && typeof (ui as any).openSession === 'function') {
      try {
        const r = (ui as any).openSession(id)
        if (r && typeof (r as any).then === 'function') await (r as any)
        return true
      } catch (e) { /* 回退位 */ }
    }
    if (sessions && typeof (sessions as any).open === 'function') {
      try {
        const r = (sessions as any).open(id)
        if (r && typeof (r as any).then === 'function') await (r as any)
        return true
      } catch (e) { /* 无面可退即失败 */ }
    }
    throw new Error('switch-failed')
  } catch (e) {
    throw e instanceof Error ? e : new Error('switch-failed')
  }
}

/** 仅供测试：重置无模块态（本模块无状态，占位以对齐既有口径） */
export function __resetWorkspaceForTests(): void {
  return undefined
}
