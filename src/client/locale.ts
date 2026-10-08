/**
 * dsh-prompt — 语言解析与订阅（#137 基建，见 docs/adr/0006-locale-identity-and-subscription.md）
 *
 * 三件事，各只留一份实现：
 *   1) resolveLocale 纯函数：显式覆盖 > 已装宿主服务 > html[lang] > navigator.languages/language > 默认 zh；
 *   2) subscribeLocale 单例订阅：全模块共用一个 html[lang] MutationObserver（+ 至多一个宿主服务订阅），
 *      回调前与上次解析值比对去重（字典注册只 bump revision，不该引发重渲染）；
 *   3) installLocaleService：由 index.ts 在 apply 里把 ctx.get('locale') 包成适配器装进来
 *      （ctx.get 免声明；不往插件 inject 加 'locale'）。
 *
 * 【禁区】本模块只读 documentElement.lang，**绝不写它** —— 宿主 locale 包的 syncDocumentLanguage
 * 是 html[lang] 的唯一主人（ADR-0006「订阅不写回」，插件写即与宿主打架）；也不调 setLocale
 * （本图不做插件级语言覆盖开关）。navigator.* 只读，异常一律 fail-soft 落默认、不抛。
 */
export type Lang = 'zh' | 'en'

/** 显式覆盖的服务形态：稳定码字符串、或带 getActive/subscribe 的宿主面（可注入假信号源，测试不依赖 jsdom）。 */
export interface LocaleService {
  getActive(): string
  subscribe?(cb: () => void): () => void
}
export type LocaleOverride = string | LocaleService | null | undefined

/**
 * 归一语言标签：zh* → zh；形如 BCP47 的已知非中文标签 → en（与 dsh-plugin-update 同构）；
 * 空/垃圾/非字符串 → def。大小写不敏感，下划线视作横线。
 * 非 BCP47 垃圾（如 '123'）→def（旧 getLang 会落 en，此处有意收敛到 zh，与 update 包同构）。
 */
export function normalizeLangTag(tag: unknown, def: Lang = 'zh'): Lang {
  if (typeof tag !== 'string') return def
  const s = tag.trim().toLowerCase().replace(/_/g, '-')
  if (!s) return def
  if (s === 'zh' || s.startsWith('zh-')) return 'zh'
  if (s === 'en' || s.startsWith('en-')) return 'en'
  if (/^[a-z]{2,3}(-[a-z0-9]+)*$/.test(s)) return 'en'
  return def
}

/** 读 html[lang]；缺席/异常回 null（只读，永不写）。 */
function readDocumentLang(): string | null {
  try {
    const v = (globalThis as any).document?.documentElement?.lang
    return typeof v === 'string' && v.trim() ? v : null
  } catch (e) { return null }
}

/** 读 navigator.languages（逐条过滤）＋ navigator.language；缺席/异常回空数组。 */
function readNavigatorLangs(): string[] {
  try {
    const nav = (globalThis as any).navigator
    if (!nav) return []
    const out: string[] = []
    const list = nav.languages
    if (Array.isArray(list)) {
      for (const c of list) if (typeof c === 'string' && c.trim()) out.push(c)
    }
    if (typeof nav.language === 'string' && nav.language.trim()) out.push(nav.language)
    return out
  } catch (e) { return [] }
}

/**
 * 解出当前语言。纯函数（只读全局信号），无信号/任何异常落默认（默认 zh 保历史行为）。
 * 不传 override 时，已安装的宿主服务适配器即为隐式覆盖（宿主快照比 DOM 更新鲜，见 research §5）。
 */
export function resolveLocale(override?: LocaleOverride, def: Lang = 'zh'): Lang {
  const src: LocaleOverride = override != null ? override : (service || undefined)
  if (src != null) {
    if (typeof src === 'object') {
      try {
        const fn = (src as LocaleService).getActive
        if (typeof fn === 'function') {
          const v = fn.call(src)
          if (typeof v === 'string' && v.trim()) return normalizeLangTag(v, def)
        }
      } catch (e) { /* 宿主面坏了不拖垮解析，继续往下回落 */ }
    } else if (typeof src === 'string' && src.trim()) {
      return normalizeLangTag(src, def)
    }
  }
  const docLang = readDocumentLang()
  if (docLang !== null) return normalizeLangTag(docLang, def)
  const navs = readNavigatorLangs()
  if (navs.length) return normalizeLangTag(navs[0], def)
  return def
}

interface LocaleEntry {
  cb: (l: Lang) => void
  /** 上次投递的解析值：同值不投（MutationObserver 与被观察属性无关的抖动都靠它挡）。 */
  last: Lang
}

/** 宿主语言面适配器（installLocaleService 装入）；未安装即 null。 */
let service: LocaleService | null = null
/** 宿主服务订阅（全模块至多一个）；无面在册时释放。 */
let serviceUnsub: (() => void) | null = null
/** html[lang] 观察者（全模块至多一个）；最后一个面退订即断开。 */
let observer: any = null
const entries = new Set<LocaleEntry>()

/** 把新值投给所有变了的订阅者：先全部算出，再逐个投（某个面抛错不拖垮其余面）。 */
function notifyAll(): void {
  const pending: Array<[LocaleEntry, Lang]> = []
  for (const e of [...entries]) {
    let next: Lang
    try { next = resolveLocale() } catch (err) { continue }
    if (next !== e.last) pending.push([e, next])
  }
  for (const [e, next] of pending) {
    e.last = next
    try { e.cb(next) } catch (err) { /* 单面抛错不影响其余面与后续通知 */ }
  }
}

function ensureObserver(): void {
  if (observer) return
  try {
    const g = globalThis as any
    const docEl = g.document?.documentElement
    const MO = g.MutationObserver
    if (!docEl || typeof MO !== 'function') return
    const obs = new MO(() => notifyAll())
    obs.observe(docEl, { attributes: true, attributeFilter: ['lang'] })
    observer = obs
  } catch (e) { observer = null }
}

function releaseObserver(): void {
  try { if (observer && typeof observer.disconnect === 'function') observer.disconnect() } catch (e) { /* ignore */ }
  observer = null
}

function ensureServiceSub(): void {
  if (serviceUnsub || !service) return
  try {
    const fn = service.subscribe
    if (typeof fn !== 'function') return
    const un = fn.call(service, () => notifyAll())
    serviceUnsub = typeof un === 'function' ? un : null
  } catch (e) { serviceUnsub = null }
}

function releaseServiceSub(): void {
  try { if (typeof serviceUnsub === 'function') serviceUnsub() } catch (e) { /* ignore */ }
  serviceUnsub = null
}

/**
 * 订阅语言变化：html[lang] 变（兜底，永远在册）或宿主服务发布时投递新语言。
 * 模块级单例 —— 多个面共用一个观察者与一个服务订阅，不是每面一套。
 * 返回 unsubscribe：退订该面；最后一个面退订时断开观察者与服务订阅（无泄漏）。
 * 无 DOM / 无宿主面的环境安全降级：只记回调、永不触发，不抛。
 */
export function subscribeLocale(cb: (l: Lang) => void): () => void {
  if (typeof cb !== 'function') return () => undefined
  const entry: LocaleEntry = { cb, last: resolveLocale() }
  entries.add(entry)
  ensureObserver()
  ensureServiceSub()
  let done = false
  return () => {
    if (done) return
    done = true
    entries.delete(entry)
    if (entries.size === 0) {
      releaseObserver()
      releaseServiceSub()
    }
  }
}

/**
 * 装上宿主语言面适配器（index.ts 把 ctx.get('locale') 包成 { getActive, subscribe } 后调用）。
 * 有面在册才真的订它（无面时零订阅）。返回卸载函数：摘服务并回落 html[lang]，供 ctx.effect 收尾。
 */
export function installLocaleService(next?: LocaleService | null): () => void {
  releaseServiceSub()
  const installed: LocaleService | null = next && typeof next === 'object' ? next : null
  service = installed
  if (installed && entries.size > 0) ensureServiceSub()
  notifyAll()
  return () => {
    if (service !== installed) return // 已被后来的安装接管，不动新服务
    service = null
    releaseServiceSub()
    notifyAll() // 摘服务后回落 html[lang]，各面按新真值重渲染
  }
}
