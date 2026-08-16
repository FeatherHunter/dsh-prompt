/**
 * dsh-prompt — 设置页模板管理（settings.plugins.tab）
 */
import { getReact, TemplateBrowser } from './panel'

export function SettingsPage(props: any): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  return h('div', { style: { padding: 8 } }, [
    h(TemplateBrowser, { compact: false }),
  ])
}
