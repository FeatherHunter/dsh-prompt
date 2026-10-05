/**
 * dsh-prompt — 更新整组件 HTTP 接线（#128）
 *
 * 0.4.0 万能插头：mountUpdateEntryHttp(button) + mountUpdatePanelHttp(dialog,默认主题，更新日志自动展示)。
 * 三要素与网关同值：pluginId dsh-prompt、prefix prompt、baseUrl /_dsh/dsh-prompt/update，
 * routes { updateStatus:status, updateCheck:check, updateInstall:install, updateChangelog:changelog }
 * 落到宿主四条路由（src/update/host/paths.ts；0.4.0 起加取日志电话）。宿主网关已改裸回包（方案A），
 * http helper 取回即整形透传。更新日志 autoChangelog 默认自动：有新版调一次取该版 tarball 全文。
 *
 * 只查不开自动装：入口 autoCheck mount（只读查一次）+ openOn has-update（有新版才开面板），
 * 入口源码级禁 install（包内 guarded，调即抛）；面板挂载即 refresh 查一次，安装只走用户点击。
 * 失败 fail-soft：挂载抛错（无 fetch / 网关不可达）时留空容器，不挡设置页其余卡。
 */
import { getReact } from './panel'
import { mountUpdateEntryHttp, mountUpdatePanelHttp } from 'dsh-plugin-update/http'

/** 与宿主四条路由同值（baseUrl + 短动作覆写拼出 status/check/install/changelog，不写电话名字面量）。 */
export const UPDATE_PLUGIN_ID = 'dsh-prompt'
export const UPDATE_PREFIX = 'prompt'
export const UPDATE_BASE_URL = '/_dsh/dsh-prompt/update'
export const UPDATE_ROUTES = {
  updateStatus: 'status',
  updateCheck: 'check',
  updateInstall: 'install',
  updateChangelog: 'changelog',
} as const

/** 头行入口按钮（settings 头行 🌟/💬 之前，与 #60 旧落位一致）。 */
export function UpdateEntryButton(_props: any): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  const ref = react.useRef(null as any)
  react.useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    let ctrl: any = null
    try {
      ctrl = mountUpdateEntryHttp(el, {
        pluginId: UPDATE_PLUGIN_ID,
        prefix: UPDATE_PREFIX,
        baseUrl: UPDATE_BASE_URL,
        routes: { ...UPDATE_ROUTES },
        variant: 'button',
        theme: 'default',
        autoCheck: 'mount',
        openOn: 'has-update',
      })
    } catch (e) {
      return undefined
    }
    return () => {
      try {
        if (ctrl && typeof ctrl.unmount === 'function') ctrl.unmount()
      } catch (e) { /* ignore */ }
    }
  }, [])
  return h('span', {
    ref,
    style: { display: 'inline-flex', alignItems: 'center' },
    'data-dsh-prompt-update-entry': '',
  })
}

/** 设置页更新面板（dialog + 默认主题，挂载即查一次，安装走用户点击；更新日志有新版自动展示）。 */
export function UpdatePanelEmbedded(_props: any): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  const ref = react.useRef(null as any)
  react.useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    let ctrl: any = null
    try {
      ctrl = mountUpdatePanelHttp(el, {
        pluginId: UPDATE_PLUGIN_ID,
        prefix: UPDATE_PREFIX,
        baseUrl: UPDATE_BASE_URL,
        routes: { ...UPDATE_ROUTES },
        mode: 'dialog',
        theme: 'default',
      })
    } catch (e) {
      return undefined
    }
    return () => {
      try {
        if (ctrl && typeof ctrl.unmount === 'function') ctrl.unmount()
      } catch (e) { /* ignore */ }
    }
  }, [])
  return h('div', { ref, 'data-dsh-prompt-update-panel': '' })
}
