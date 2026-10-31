/**
 * 设置页对外入口区（仓库/ISSUE/引流）（#171 N6：可 import 者 —— settings-page）。
 * 跑浏览器 bundle 线；禁被 src/update/host 进口（DO-NOT-IMPORT），禁跨运行时进口。
 */
/**
 * dsh-prompt — 设置页对外入口区（#37 / #254）
 * 两件东西：顶部右上角「联系 / Star / Issue」三件套（base 包 ActionGroup 一枚胶囊：联系弹群码弹窗、
 * Star 落仓库、Issue 落 ISSUE 列表；悬停文案与气泡由 base 包 HoverTip 提供）+ 底部「作者其他插件」引流区。
 * 边界：纯前端展示，不发网络请求、不写本地存档键、不碰模板数据与智能召回。
 * 契约：导出 SettingsHeaderLinks({ lang, entry? })、ContactRow({ lang }) 与 AuthorPlugins({ lang }) 三个组件；
 * 图标、胶囊、悬停气泡与弹窗都是 base 包内部实现。
 * #254：入口区、联系行与作者推荐卡改由 dsh-featherhunter-plugin-base/client 提供；推荐清单与群码都来自
 * base 包的发布数据（CDN @latest），本仓不再持有第二份「作者其他插件」文案表、群码地址或图标文案。
 * #60 追加交付 A 起多一个可选的 `entry`：调用方（settings-page.ts）把更新入口那枚按钮交进来，与三件套同排。
 */
import { createBaseUI, ensureBaseStyles } from 'dsh-featherhunter-plugin-base/client'
import { getReact, PromptMark } from './template-browser'
import { tr, STR, type Lang } from './strings'

type StrKey = keyof typeof STR

const REPO_URL = 'https://github.com/FeatherHunter/dsh-prompt'
// Issue 入口落 ISSUE 列表页（不是 issues/new，与 dsh-opencode-palette 口径一致）
const ISSUES_URL = REPO_URL + '/issues'

// base 包共享 UI 单例：宿主 React 或界面语言变了才重建（createBaseUI 的组件都绑定建实例时的选项）。
// 推荐清单、群码地址、页头三件套的仓库/ISSUE 地址与文案全部来自 base 包的发布数据，本仓不持有副本。
let baseUIReact: any = null
let baseUILang: Lang | undefined
let baseUICache: any = null
function baseUI(lang?: Lang): any {
  const react = getReact()
  if (!react) return null
  if (!baseUICache || baseUIReact !== react || baseUILang !== lang) {
    baseUIReact = react
    baseUILang = lang
    baseUICache = createBaseUI(react, { lang, selfId: 'prompt', repoUrl: REPO_URL, issuesUrl: ISSUES_URL })
  }
  return baseUICache
}

/** base 包的样式是文档级一次性注入（id: dsh-base-ui-style），首帧前补齐。 */
function ensureBaseStylesOnce(): void {
  if (typeof document !== 'undefined') ensureBaseStyles(document)
}

const headerRowStyle: any = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '2px 4px 6px' }
// #53：头行左侧的插件标志与页面名 —— 名字与设置面板导航项同名（i18n 的 sectionName），标志与模板列表同一个
const brandStyle: any = { display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }
const brandNameStyle: any = { fontWeight: 600, fontSize: '0.95em', color: 'var(--dsw-alias-label-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
// #60 追加交付 A：这一组里现在还会坐一枚「检查更新」，所以整组可收缩（minWidth 0 + flex '0 1 auto'）——
// 窄容器下先让文案省略；三件套胶囊整枚 flex:'none'，永远留着。
const headBtnsStyle: any = { display: 'inline-flex', alignItems: 'center', gap: 6, flex: '0 1 auto', minWidth: 0 }

/**
 * 顶部头行：左边插件标志与页面名，右边「入口位（调用方给了就渲染）+ 联系/Star/Issue 三件套胶囊」。
 *
 * 三件套由 base 包 ActionGroup 渲染（size 16 与更新入口同高；内部顺序固定 联系/Star/Issue，各带悬停气泡）：
 * repoUrl / issuesUrl 已在 createBaseUI 里交给 base，本文件不再各画一枚图标或一条自绘气泡。
 *
 * #127 自研更新入口已删：`entry` 仍由 settings-page.ts 交进来（#128 接新整组件时再定形态），
 * 本文件不持有更新引用。`entry` 缺席时这一行只有三件套。
 */
export function SettingsHeaderLinks(props: { lang: Lang; entry?: any }): any {
  const react = getReact()
  const ui = baseUI(props.lang)
  if (!react || !ui) return null
  const h = react.createElement
  const t = (k: StrKey) => tr(props.lang, STR[k])
  ensureBaseStylesOnce()
  return h('div', { style: headerRowStyle }, [
    h('span', { key: 'brand', style: brandStyle }, [
      h(PromptMark, { key: 'mark', size: 16 }),
      h('span', { key: 'name', style: brandNameStyle }, t('sectionName')),
    ]),
    h('span', { key: 'btns', style: headBtnsStyle }, [
      // 更新入口在三件套**之前**（同一行的左起第二段），与 #60 交付时的落位一致。
      props.entry || null,
      h(ui.ActionGroup, { key: 'actions', size: 16 }),
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
