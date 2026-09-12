/**
 * dsh-prompt — 设置页模板管理（settings.plugins.tab）+ 智能模式开关
 */
import { getReact, TemplateBrowser } from './panel'
import { SettingsHeaderLinks, AuthorPlugins } from './about'
import { isSmartEnabled, setSmartEnabled } from './smartstore'
import { getLang, tr, STR } from './i18n'

export function SettingsPage(props: any): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  const smartState = react.useState(isSmartEnabled())
  const smartOn = smartState[0]
  const lang = getLang()
  const t = (k: keyof typeof STR) => tr(lang, STR[k])
  const row: any = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 4px',
    fontFamily: 'var(--dsw-font-family)', fontSize: 12.5, color: 'var(--dsw-alias-label-primary)',
  }
  // #37：旧的一行文字链接（⛭ GitHub 仓库 / ⚠ 反馈故障）已由顶部右上角两个图标按钮取代，不再保留第二处入口。
  return h('div', { style: { padding: 4, display: 'flex', flexDirection: 'column' } }, [
    h(SettingsHeaderLinks, { key: 'links', lang }),
    h('label', { style: row, title: t('smartToggleHint') }, [
      h('input', {
        type: 'checkbox', checked: smartOn,
        onChange: (e: any) => { const on = e.target.checked; smartState[1](on); setSmartEnabled(on) },
      }),
      h('span', null, t('smartToggle')),
    ]),
    h('div', { style: { padding: '2px 4px 8px', fontSize: '0.85em', color: 'var(--dsw-alias-label-tertiary)', fontFamily: 'var(--dsw-font-family)' } }, t('storageNote')),
    h(TemplateBrowser, { compact: false }),
    h(AuthorPlugins, { key: 'more', lang }),
  ])
}
