/**
 * dsh-prompt — client 入口（骨架：验证注入/装配/构建管线）
 * 构建：npm run build:client（tsdown → lib/client.js，ModuleLoader.load 格式）
 * 本票（#7）只验证管线；面板/模板/触发源在 #8-#10 实现。
 */

type ClientContext = {
  slots: any
  effect: (fn: () => unknown, key?: string) => unknown
}

export const inject = ['slots']

function getReact(): any {
  if (typeof require === 'function') { try { return require('react') } catch (e) { /* ignore */ } }
  if (typeof globalThis !== 'undefined' && (globalThis as any).React) return (globalThis as any).React
  return null
}

/** 骨架调试视图（tool.view.cordis，开发者控制台可见；非产品 UI） */
function SkeletonView() {
  const react = getReact()
  if (!react) return null
  const h = react.createElement
  return h('div', { style: { padding: 12, fontFamily: 'monospace', fontSize: 12, color: 'var(--dsw-alias-label-primary)' } }, 'dsh-prompt skeleton OK — 构建/注入管线已验证')
}

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.slots.inject('settings.plugins.tab', () =>
    ctx.slots.register({ name: 'settings.plugins.tab', id: 'dsh-prompt-skeleton', order: 99, label: () => 'dsh-prompt（骨架）' }, SkeletonView),
  ), 'dsh-prompt: skeleton')
}
