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

/** 单条归一（fail-soft：无 id 回 null，调用方过滤） */
export function normalizeSession(raw: any, workspaceNames?: Map<string, string> | Record<string, string>): WorkspaceSession | null {
  try {
    if (!raw || typeof raw !== 'object') return null
    const id = asString((raw as any).id || (raw as any).sid || (raw as any).sessionId)
    if (id === '') return null
    const wsId = sessionWorkspaceIdOf(raw)
    let wsName = ''
    try {
      if (workspaceNames instanceof Map) wsName = workspaceNames.get(wsId || '') || ''
      else if (workspaceNames && typeof workspaceNames === 'object') wsName = (workspaceNames as any)[wsId || ''] || ''
    } catch (e) { /* ignore */ }
    if (!wsName && raw && typeof raw === 'object') {
      const cands = [(raw as any).workspaceName, (raw as any).workspace_name, (raw as any).groupName]
      for (const c of cands) {
        if (typeof c === 'string' && c.trim() !== '') { wsName = c; break }
      }
    }
    const title = sessionTitleOf(raw, id)
    return {
      id,
      title,
      workspaceId: wsId,
      workspaceName: wsName || (wsId || ''),
      cwd: sessionCwdOf(raw),
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
export function normalizeSessions(input: unknown, workspaceNames?: Map<string, string> | Record<string, string>): WorkspaceSession[] {
  try {
    const raws = rawSessionItems(input)
    const out: WorkspaceSession[] = []
    const seen = new Set<string>()
    for (const r of raws) {
      const s = normalizeSession(r, workspaceNames)
      if (!s || seen.has(s.id)) continue
      seen.add(s.id)
      out.push(s)
    }
    return out
  } catch (e) { return [] }
}

/** 从多态工作区登记里捞出 id→名（数组 / {items} / {byId} / 单体，不抛） */
export function normalizeWorkspaceNames(input: unknown): Map<string, string> {
  const out = new Map<string, string>()
  try {
    if (!input) return out
    const pushOne = (r: any): void => {
      try {
        if (!r || typeof r !== 'object') return
        const id = asString(r.id || r.workspaceId || r.key)
        if (id === '') return
        const name = asString(r.name || r.title || r.label) || id
        if (!out.has(id)) out.set(id, name)
      } catch (e) { /* ignore */ }
    }
    if (Array.isArray(input)) { (input as any[]).forEach(pushOne); return out }
    const o = input as any
    if (Array.isArray(o.items)) { o.items.forEach(pushOne); return out }
    if (Array.isArray(o.workspaces)) { o.workspaces.forEach(pushOne); return out }
    if (Array.isArray(o.list)) { o.list.forEach(pushOne); return out }
    if (o.byId && typeof o.byId === 'object') {
      try {
        for (const k of Object.keys(o.byId)) {
          const r = o.byId[k]
          if (r && typeof r === 'object' && typeof r.id === 'string') pushOne(r)
          else if (typeof r === 'string') { if (!out.has(k)) out.set(k, r) }
          else pushOne({ id: k, name: '' })
        }
      } catch (e) { /* ignore */ }
      return out
    }
    if (typeof o === 'object' && typeof o.id === 'string' && o.id !== '') { pushOne(o); return out }
    return out
  } catch (e) { return out }
}

/** 归一 cwd（分组键：去尾斜杠，空回 ''，不抛） */
export function normalizeCwd(cwd: unknown): string {
  try {
    const s = asString(cwd)
    if (s === '') return ''
    return s.replace(/[/\\]+$/, '')
  } catch (e) { return '' }
}

/**
 * 纯视图分组（#107 Q3 / #111 US8–US11）：
 * - 按 workspaceId 分组，无归属（null/''）进未归属桶；
 * - 未归属桶置底；其余组按组内最新倒序；
 * - 组内按 updatedAt 倒序；组头名 = 登记名 || workspaceId || 未归属；
 * - 同标题跨组冲突行打 collision=true（尾段芯片只给这些行，v7 省空间）；
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

/** 单工作区退化：组数 ≤1 即隐藏组头退化平铺（#111 US9） */
export function isSingleWorkspace(groups: WorkspaceGroup[]): boolean {
  try { return Array.isArray(groups) && groups.length <= 1 } catch (e) { return true }
}

/** 搜索 haystack（标题 + 工作区名，调用方拼好后做大小写不敏感子串；拼音/cwd 全文首版不做，留缝） */
export function sessionHaystack(s: WorkspaceSession): string {
  try {
    return ((s.title || '') + ' ' + (s.workspaceName || '')).toLowerCase()
  } catch (e) { return '' }
}

/** 搜索过滤（#107 Q4 / #111 US12–US14：大小写不敏感子串；空查询回全量；无结果回 [] 由调用方进空态，不回退） */
export function filterWorkspaceSessions(sessions: WorkspaceSession[], query: unknown): WorkspaceSession[] {
  try {
    const list = Array.isArray(sessions) ? sessions : []
    const q = String(query || '').trim().toLowerCase()
    if (q === '') return list.slice()
    return list.filter((s) => sessionHaystack(s).indexOf(q) >= 0)
  } catch (e) { return [] }
}

/** 紧凑相对时间（v7 口径：刚刚/5分/3时/2天，悬停看绝对，不抛） */
export function relativeWorkspaceTime(ts: unknown, now?: number): string {
  try {
    const t = Number(ts)
    if (!isFinite(t) || t <= 0) return ''
    const base = typeof now === 'number' && isFinite(now) ? now : Date.now()
    const d = base - t
    if (d < 0) return '刚刚'
    const m = Math.floor(d / 60000)
    if (m < 1) return '刚刚'
    if (m < 60) return m + '分'
    const h = Math.floor(m / 60)
    if (h < 24) return h + '时'
    return Math.floor(h / 24) + '天'
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
    const workspaces = (faces as any).workspaces
    const ui = (faces as any).uiWorkspace
    void workspaces
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
          else if (typeof (sessions as any).get === 'function') enumerable = true
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

export interface WorkspaceSnapshot {
  sessions: WorkspaceSession[]
  names: Map<string, string>
}

/**
 * 枚举（每次打开重探，抄 sidebarCtl 晚到模式）：
 * - 成功回 {sessions, names}（空数组即真无，由调用方进空态，不是失败）；
 * - 双面全空（连一个条目都捞不到且同步门控本就不满足）抛错，由调用方进失败/探测缺席；
 * - 全程异步全捕获，不抛宿主原生错以外的错。
 */
export async function enumerateWorkspaceSessions(faces: WorkspaceFaces | null | undefined): Promise<WorkspaceSnapshot> {
  try {
    if (!faces || typeof faces !== 'object') throw new Error('probe-absent')
    const gates = probeWorkspaceGates(faces)
    const [sRaws, wRaws] = await Promise.all([
      resolveSessionRaws((faces as any).sessions),
      resolveWorkspaceRaws((faces as any).workspaces),
    ])
    const names = normalizeWorkspaceNames(wRaws)
    const sessions = normalizeSessions(sRaws, names)
    // 回填登记名（含单体 current 形态）
    const filled = sessions.map((s) => {
      if (s.workspaceName && s.workspaceName !== '') return s
      if (!s.workspaceId) return { ...s, workspaceName: '' }
      return { ...s, workspaceName: names.get(s.workspaceId) || s.workspaceId }
    })
    if (filled.length === 0 && !gates.enumerable) throw new Error('probe-absent')
    return { sessions: filled, names }
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
    const errors: unknown[] = []
    if (ui && typeof (ui as any).openSession === 'function') {
      try {
        const r = (ui as any).openSession(id)
        if (r && typeof (r as any).then === 'function') await (r as any)
        return true
      } catch (e) { errors.push(e) }
    }
    if (sessions && typeof (sessions as any).open === 'function') {
      try {
        const r = (sessions as any).open(id)
        if (r && typeof (r as any).then === 'function') await (r as any)
        return true
      } catch (e) { errors.push(e) }
    }
    void errors
    throw new Error('switch-failed')
  } catch (e) {
    throw e instanceof Error ? e : new Error('switch-failed')
  }
}

/** 仅供测试：重置无模块态（本模块无状态，占位以对齐既有口径） */
export function __resetWorkspaceForTests(): void {
  return undefined
}
