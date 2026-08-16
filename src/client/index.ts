/**
 * dsh-prompt — client 入口（v1 常规模式）
 * 装配：input.left 入口按钮 / input.overlay 面板浮层 / settings.plugins.tab 模板管理页 / inputTriggers /prompt 触发源（#9）
 */
import { getReact, TemplateBrowser, setGoSettingsHandler } from './panel'
import { EntryButton } from './button'
import { SettingsPage } from './settings'
import { buildPromptSource } from './trigger'
import { isPanelOpen, onPanelOpen } from './state'

type ClientContext = {
  slots: any
  inputTriggers: any
  effect: (fn: () => unknown, key?: string) => unknown
}

export const inject = ['slots', 'inputTriggers']

/** 面板浮层（conversation.input.overlay，session 作用域 → 有 useInput/inputActions） */
function PanelHost(props: any): any {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  const openState = react.useState(isPanelOpen())
  const open = openState[0]
  react.useEffect(() => { onPanelOpen((v) => openState[1](v)); console.log('[dsh-prompt] PanelHost props:', Object.keys(props), '| useInput?', !!props.useInput, '| inputActions?', !!props.inputActions) }, [])
  if (!open) return null
  return h(TemplateBrowser, { compact: true, useInput: props.useInput, inputActions: props.inputActions })
}

export function apply(ctx: ClientContext): void {
  // 入口按钮（input.left；开合状态跟随面板）
  ctx.effect(() => ctx.slots.inject('conversation.input.left', () =>
    ctx.slots.register({ name: 'conversation.input.left', id: 'dsh-prompt-entry', order: 10, label: () => 'dsh-prompt' },
      (props: any) => {
        const react = getReact()
        if (!react) return null
        const h = react.createElement
        const openState = react.useState(isPanelOpen())
        react.useEffect(() => onPanelOpen((v) => openState[1](v)), [])
        return h(EntryButton, { open: openState[0] })
      }),
  ), 'dsh-prompt: entry')

  // 面板浮层
  ctx.effect(() => ctx.slots.inject('conversation.input.overlay', () =>
    ctx.slots.register({ name: 'conversation.input.overlay', id: 'dsh-prompt-panel', order: 2, label: () => 'dsh-prompt panel' }, PanelHost),
  ), 'dsh-prompt: panel')

  // 设置页模板管理
  ctx.effect(() => ctx.slots.inject('settings.plugins.tab', () =>
    ctx.slots.register({ name: 'settings.plugins.tab', id: 'dsh-prompt-settings', order: 10, label: () => 'dsh-prompt（模板管理）' }, SettingsPage),
  ), 'dsh-prompt: settings')

  // 面板「设置 → 模板管理」：当前 v1 关闭面板即可（设置页经 ⚙ → 插件 → dsh-prompt 到达）
  setGoSettingsHandler(() => { /* 跳转宿主设置页留待后续（需要宿主 settings 路由 API） */ })

  // /prompt 触发源（#9）：列出预制+自定义模板，支持过滤（标签/搜索），选中即插入
  if (ctx.inputTriggers && typeof ctx.inputTriggers.registerSource === 'function') {
    ctx.effect(() => ctx.inputTriggers.registerSource(buildPromptSource()), 'dsh-prompt: /prompt source')
  }
}
