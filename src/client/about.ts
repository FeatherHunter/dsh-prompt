/**
 * dsh-prompt — 设置页对外入口区（#37）
 * 两件东西：顶部右上角两个图标按钮（🌟 仓库 / 💬 ISSUE 列表，各带自绘悬停气泡）+ 底部「作者其他插件」四行引流区。
 * 边界：纯前端展示，不发网络请求、不写本地存档键、不碰模板数据与智能召回。
 * 顶层显示：气泡经 panel 的 TopPortal 挂到 body —— 设置面板自身会滚动、且带层叠上下文，内联气泡会被裁剪或遮挡。
 * 契约：导出 SettingsHeaderLinks({ lang }) 与 AuthorPlugins({ lang }) 两个组件；气泡、定位、清单常量都是内部实现。
 */
import { getReact, TopPortal, MODAL_Z } from './panel'
import { tr, STR, type Lang } from './i18n'

type StrKey = keyof typeof STR

const REPO_URL = 'https://github.com/FeatherHunter/dsh-prompt'
// 💬 落 ISSUE 列表页（不是 issues/new，与 dsh-opencode-palette 口径一致）
const ISSUES_URL = REPO_URL + '/issues'

// 作者其他插件清单：网址写死，不拉网络、不新增本地存档键。
// 描述文案里的数字都是实测（2026-09-12）：skills-deck 25 个 bundled-skills 目录、palette v1.7.1 设置面板 38 项配色、
// 本插件 24 条 PRESET_TEMPLATES、im-companion 9 路渠道。数字过期就改这里。
const MORE_PLUGINS: { slug: string; url: string; descKey: StrKey }[] = [
  { slug: 'dsh-mattpocock-skills-deck', url: 'https://github.com/FeatherHunter/dsh-mattpocock-skills-deck', descKey: 'moreDescDeck' },
  { slug: 'dsh-opencode-palette', url: 'https://github.com/FeatherHunter/dsh-opencode-palette', descKey: 'moreDescPalette' },
  { slug: 'dsh-prompt', url: REPO_URL, descKey: 'moreDescPrompt' },
  { slug: 'dsh-im-companion', url: 'https://github.com/FeatherHunter/dsh-im-companion', descKey: 'moreDescCompanion' },
]

/** 气泡层级：高于选择类浮层（PANEL_Z 9999）与设置面板自身，低于弹窗（MODAL_Z 11000）——弹窗打开时永远压住气泡。 */
const TIP_Z = MODAL_Z - 100

const headerRowStyle: any = { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, padding: '2px 4px 6px' }
const iconBtnStyle: any = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7,
  textDecoration: 'none', cursor: 'pointer', lineHeight: 1, border: '1px solid transparent',
  background: 'transparent', color: 'var(--dsw-alias-label-secondary)',
}
const iconBtnHover: any = { background: 'var(--dsw-alias-bg-layer-3)', borderColor: 'var(--dsw-alias-border-l1)', color: 'var(--dsw-alias-label-primary)' }
const tipStyle: any = {
  position: 'fixed', zIndex: TIP_Z, maxWidth: 220, pointerEvents: 'none',
  background: 'var(--dsw-specific-menu)', color: 'var(--dsw-alias-label-primary)',
  border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 8, padding: '6px 10px',
  boxShadow: 'var(--dsw-shadow-lv3)', fontFamily: 'var(--dsw-font-family)', fontSize: 12, lineHeight: 1.55,
}
const moreCardStyle: any = {
  display: 'flex', flexDirection: 'column', gap: 2, margin: '12px 4px 4px', padding: '10px 12px',
  border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 10, fontFamily: 'var(--dsw-font-family)',
}
const moreTitleStyle: any = { fontSize: '0.9em', fontWeight: 600, color: 'var(--dsw-alias-label-secondary)', paddingBottom: 4 }
const moreRowStyle: any = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 4px', borderRadius: 7,
  textDecoration: 'none', color: 'var(--dsw-alias-label-primary)',
}
const moreRowHover: any = { background: 'var(--dsw-alias-bg-layer-3)' }
const moreSlugStyle: any = { flex: 'none', fontFamily: 'Consolas,Menlo,monospace', fontSize: 12, fontWeight: 650, whiteSpace: 'nowrap' }
const moreDescStyle: any = { flex: 1, minWidth: 0, fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)', lineHeight: 1.5 }

/**
 * 自绘悬停气泡：hover 与键盘 focus 都出，mouseleave / blur / Esc 收。
 * 坐标以锚点 rect 现算（fixed + 右对齐锚点右缘；下方放不下就翻到上方）。
 * 滚动 / 尺寸变化时**跟着锚点重算**而不是收起：键盘 Tab 聚焦时浏览器会先把按钮滚进视口，
 * 「一聚焦就收起」会把「聚焦时看得到气泡」这条用户故事打掉，也会留下停不下来的错位坐标；
 * 只有锚点整个滚出视口（或脱离文档）才收起。
 * pointerEvents: 'none' 保证气泡本身不抢鼠标（翻转时不会和锚点互相打架）。
 */
function HoverTip(props: { content: string; children: any }): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  const st = react.useState(null as any)
  const tip = st[0]
  const setTip = st[1]
  const wrapRef = react.useRef(null as any)
  const open = !!tip
  const rectOf = () => {
    try {
      const el = wrapRef.current
      return el && typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null
    } catch (e) { return null }
  }
  const show = () => setTip({ rect: rectOf() })
  const hide = () => setTip(null)
  react.useEffect(() => {
    if (!open || typeof window === 'undefined') return
    let raf: any = 0
    const schedule = (fn: any) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(fn, 16))
    const unschedule = (id: any) => { try { if (typeof cancelAnimationFrame === 'function' && typeof id === 'number') cancelAnimationFrame(id); else clearTimeout(id) } catch (e) { /* ignore */ } }
    const sync = () => {
      if (raf) return
      raf = schedule(() => {
        raf = 0
        const r = rectOf()
        const vh = window.innerHeight || 0
        if (!r || !r.width || (vh > 0 && (r.bottom < 0 || r.top > vh))) setTip(null)
        else setTip({ rect: r })
      })
    }
    window.addEventListener('scroll', sync, true)
    window.addEventListener('resize', sync)
    return () => {
      window.removeEventListener('scroll', sync, true)
      window.removeEventListener('resize', sync)
      if (raf) unschedule(raf)
    }
  }, [open])
  const r = tip && tip.rect
  let style = tipStyle
  if (r) {
    const vw = (typeof window !== 'undefined' && window.innerWidth) || 0
    const vh = (typeof window !== 'undefined' && window.innerHeight) || 0
    const right = Math.max(8, vw - r.right)
    const fitsBelow = vh <= 0 || r.bottom + 8 + 64 <= vh
    style = Object.assign({}, tipStyle, fitsBelow ? { right, top: r.bottom + 8 } : { right, bottom: Math.max(8, vh - r.top + 8) })
  }
  return h('span', {
    ref: wrapRef, style: { display: 'inline-flex' },
    onMouseEnter: show, onMouseLeave: hide, onFocus: show, onBlur: hide,
    onKeyDown: (e: any) => { if (e && e.key === 'Escape') hide() },
  }, [
    props.children,
    tip ? h(TopPortal, { key: 'tip', rootAttr: 'data-dsh-prompt-tip-root' }, h('div', { style, 'data-dsh-prompt-tip': '' }, props.content)) : null,
  ])
}

/** 单个图标按钮：26×26 方形热区，自绘 hover 底色；不写 outline，保留原生 focus ring（键盘可见）。 */
function IconLink(props: any): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  const st = react.useState(false)
  const over = st[0]
  const setOver = st[1]
  return h('a', {
    href: props.href, target: '_blank', rel: 'noreferrer', 'aria-label': props.label,
    style: Object.assign({}, iconBtnStyle, over ? iconBtnHover : null),
    onMouseEnter: () => setOver(true), onMouseLeave: () => setOver(false),
  }, h('span', { 'aria-hidden': 'true', style: { fontSize: 15, lineHeight: 1 } }, props.emoji))
}

/** 引流区一行：等宽 slug + 灰色描述 + 右侧外链图标，整行可点跳仓库首页。 */
function PluginRow(props: any): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  const st = react.useState(false)
  const over = st[0]
  const setOver = st[1]
  return h('a', {
    href: props.url, target: '_blank', rel: 'noreferrer',
    style: Object.assign({}, moreRowStyle, over ? moreRowHover : null),
    onMouseEnter: () => setOver(true), onMouseLeave: () => setOver(false),
  }, [
    h('span', { key: 'slug', style: moreSlugStyle }, props.slug),
    h('span', { key: 'desc', style: moreDescStyle }, props.desc),
    h('svg', {
      key: 'ext', width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true',
      style: { flex: 'none', opacity: 0.7 },
    }, [
      h('path', { key: 'a', d: 'M14 4h6v6' }),
      h('path', { key: 'b', d: 'M20 4l-8.6 8.6' }),
      h('path', { key: 'c', d: 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5' }),
    ]),
  ])
}

/** 顶部右上角两个图标按钮（取代旧的一行文字链接）。 */
export function SettingsHeaderLinks(props: { lang: Lang }): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  const t = (k: StrKey) => tr(props.lang, STR[k])
  return h('div', { style: headerRowStyle }, [
    h(HoverTip, { key: 'star', content: t('starTip') },
      h(IconLink, { href: REPO_URL, label: t('gitHubRepo'), emoji: '🌟' })),
    h(HoverTip, { key: 'feedback', content: t('feedbackTip') },
      h(IconLink, { href: ISSUES_URL, label: t('feedback'), emoji: '💬' })),
  ])
}

/** 底部「作者其他插件」引流区：四行，每一行都能点开对应仓库首页。 */
export function AuthorPlugins(props: { lang: Lang }): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  const t = (k: StrKey) => tr(props.lang, STR[k])
  const rows = MORE_PLUGINS.map((p) => h(PluginRow, { key: p.slug, slug: p.slug, url: p.url, desc: t(p.descKey) }))
  return h('div', { style: moreCardStyle, 'data-dsh-prompt-more': '' }, [h('div', { key: 'title', style: moreTitleStyle }, t('moreTitle'))].concat(rows))
}
