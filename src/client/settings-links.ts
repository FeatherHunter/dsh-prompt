/**
 * 设置页对外入口区（仓库/ISSUE/引流）（#171 N6：可 import 者 —— settings-page）。
 * 跑浏览器 bundle 线；禁被 src/update/host 进口（DO-NOT-IMPORT），禁跨运行时进口。
 */
/**
 * dsh-prompt — 设置页对外入口区（#37）
 * 两件东西：顶部右上角两个图标按钮（🌟 仓库 / 💬 ISSUE 列表，各带自绘悬停气泡）+ 底部「作者其他插件」引流区。
 * 边界：纯前端展示，不发网络请求、不写本地存档键、不碰模板数据与智能召回。
 * 顶层显示：气泡经 panel 的 TopPortal 挂到 body —— 设置面板自身会滚动、且带层叠上下文，内联气泡会被裁剪或遮挡。
 * 契约：导出 SettingsHeaderLinks({ lang, entry? })、ContactRow({ lang }) 与 AuthorPlugins({ lang }) 三个组件；
 * 气泡、定位都是内部实现。
 * 联系入口与作者推荐卡改由 dsh-featherhunter-plugin-base/client 提供（#254）：推荐清单与群码都来自 base 包的
 * 发布数据（CDN @latest），本仓不再持有第二份「作者其他插件」文案表或群码地址。
 * #60 追加交付 A 起多一个可选的 `entry`：调用方（settings-page.ts）把更新入口那枚按钮交进来，与两个图标同排。
 */
import { createBaseUI, ensureBaseStyles } from 'dsh-featherhunter-plugin-base/client'
import { getReact, TopPortal, MODAL_Z, PromptMark } from './template-browser'
import { tr, STR, type Lang } from './strings'

type StrKey = keyof typeof STR

const REPO_URL = 'https://github.com/FeatherHunter/dsh-prompt'
// 💬 落 ISSUE 列表页（不是 issues/new，与 dsh-opencode-palette 口径一致）
const ISSUES_URL = REPO_URL + '/issues'

// base 包共享 UI 单例：宿主 React 或界面语言变了才重建（createBaseUI 的组件都绑定建实例时的选项）。
// 推荐清单、群码地址与文案全部来自 base 包的发布数据，本仓不持有副本。
let baseUIReact: any = null
let baseUILang: Lang | undefined
let baseUICache: any = null
function baseUI(lang?: Lang): any {
  const react = getReact()
  if (!react) return null
  if (!baseUICache || baseUIReact !== react || baseUILang !== lang) {
    baseUIReact = react
    baseUILang = lang
    baseUICache = createBaseUI(react, { lang, selfId: 'prompt' })
  }
  return baseUICache
}

/** base 包的样式是文档级一次性注入（id: dsh-base-ui-style），首帧前补齐。 */
function ensureBaseStylesOnce(): void {
  if (typeof document !== 'undefined') ensureBaseStyles(document)
}

/** 气泡层级：高于选择类浮层（PANEL_Z 9999）与设置面板自身，低于弹窗（MODAL_Z 11000）——弹窗打开时永远压住气泡。 */
const TIP_Z = MODAL_Z - 100

const headerRowStyle: any = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '2px 4px 6px' }
// #53：头行左侧的插件标志与页面名 —— 名字与设置面板导航项同名（i18n 的 sectionName），标志与模板列表同一个
const brandStyle: any = { display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }
const brandNameStyle: any = { fontWeight: 600, fontSize: '0.95em', color: 'var(--dsw-alias-label-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
// #60 追加交付 A：这一组里现在还会坐一枚「检查更新」，所以整组可收缩（minWidth 0 + flex '0 1 auto'）——
// 窄容器下先让文案省略，两个图标各自 flex:'none' 恒定 26×26，永远留着。
const headBtnsStyle: any = { display: 'inline-flex', alignItems: 'center', gap: 4, flex: '0 1 auto', minWidth: 0 }
const iconBtnStyle: any = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7,
  textDecoration: 'none', cursor: 'pointer', lineHeight: 1, border: '1px solid transparent',
  background: 'transparent', color: 'var(--dsw-alias-label-secondary)', flex: 'none',
}
const iconBtnHover: any = { background: 'var(--dsw-alias-bg-layer-3)', borderColor: 'var(--dsw-alias-border-l1)', color: 'var(--dsw-alias-label-primary)' }
const tipStyle: any = {
  position: 'fixed', zIndex: TIP_Z, maxWidth: 220, pointerEvents: 'none',
  background: 'var(--dsw-specific-menu)', color: 'var(--dsw-alias-label-primary)',
  border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 8, padding: '6px 10px',
  boxShadow: 'var(--dsw-shadow-lv3)', fontFamily: 'var(--dsw-font-family)', fontSize: 12, lineHeight: 1.55,
}
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

/**
 * 顶部头行：左边插件标志与页面名，右边「入口位（调用方给了就渲染）+ 两个图标按钮」。
 *
 * #127 自研更新入口已删：`entry` 仍由 settings-page.ts 交进来（#128 接新整组件时再定形态），
 * 本文件不持有更新引用。`entry` 缺席时这一行与 #37 一致。
 */
export function SettingsHeaderLinks(props: { lang: Lang; entry?: any }): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  const t = (k: StrKey) => tr(props.lang, STR[k])
  return h('div', { style: headerRowStyle }, [
    h('span', { key: 'brand', style: brandStyle }, [
      h(PromptMark, { key: 'mark', size: 16 }),
      h('span', { key: 'name', style: brandNameStyle }, t('sectionName')),
    ]),
    h('span', { key: 'btns', style: headBtnsStyle }, [
      // 更新入口在图标**之前**（同一行的左起第二段），两个图标仍是 #37 那两枚、地址与顺序一字不动。
      props.entry || null,
      h(HoverTip, { key: 'star', content: t('starTip') },
        h(IconLink, { href: REPO_URL, label: t('gitHubRepo'), emoji: '🌟' })),
      h(HoverTip, { key: 'feedback', content: t('feedbackTip') },
        h(IconLink, { href: ISSUES_URL, label: t('feedback'), emoji: '💬' })),
    ]),
  ])
}

/**
 * 底部「作者其他插件」引流区：base 包 AuthorPlugins。
 * 首帧渲染包内基线清单（不白屏），挂载后由共享内容加载器静默换成 CDN 上的最新清单；
 * 行整行可点、新标签页打开，selfId 已交给 createBaseUI，自动排除本仓。
 */
export function AuthorPlugins(props: { lang: Lang }): any {
  const react = getReact()
  const ui = baseUI(props.lang)
  if (!react || !ui) return null
  ensureBaseStylesOnce()
  return react.createElement(ui.AuthorPlugins, { lang: props.lang })
}

/**
 * 整行式联系入口：base 包 ContactRow（图标 + 文案 + 外链箭头），点击在设置面板上层弹联系弹窗。
 * 文案与群码来自 base 包数据；语言跟本页当前语言（base 实例按 lang 重建）。
 */
export function ContactRow(props: { lang: Lang }): any {
  const react = getReact()
  const ui = baseUI(props.lang)
  if (!react || !ui) return null
  ensureBaseStylesOnce()
  return react.createElement(ui.ContactRow, {})
}
