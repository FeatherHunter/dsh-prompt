/**
 * `dsh-plugin-update` 的类型声明（本仓自备）。
 *
 * 为什么不装 `@types/dsh-plugin-update`：包 0.1.1 没有随包发 `.d.ts`，registry 上也没有对应的
 * @types 包（实测 2026-09）。本仓只在宿主半用到一个入口 `createHostUpdate`，所以这里**只声明
 * 用得到的那一面**，形状逐字对着 `dist/` 的**调用点**（不是 README 的示例文字）：
 * `dist/host.js:187,196` 发 `phoneLogCtx.fire(level, event, fields)`、`dist/store.js:273` 发
 * `log(level, event, fields)` —— 两处都是**三参**，事件名在第二个位置。升级包版本时要回头核这份声明。
 *
 * 声明面故意收窄：包里还有 reader / store / gate 等十几个导出，本仓一个都不用，
 * 不声明就不会有人从这儿顺手引进去。
 */
declare module 'dsh-plugin-update' {
  /** 快照六字段（包 README 第 8 节）。字段含义由更新包定义，本仓不解释、不裁剪。 */
  export interface UpdateSnapshot {
    runningVersion: string
    installedVersion: string | null
    latestVersion: string | null
    canInstall: boolean
    blockedReason: string | null
    job: unknown
  }

  /**
   * 一条电话的回包形状（`loggedPhone` 的返回）。逐字对着 `dist/host.js:204-208`：
   * 成功是 `{ ok: true, snapshot, manual, receipt }`，失败是 `{ ok: false, error, errorKind }`
   * —— `error` 是**机器码字符串**（例如 `'check-expired'`），不是对象，别按对象用。
   */
  export interface UpdatePhoneResult {
    ok: boolean
    snapshot?: UpdateSnapshot | null
    manual?: string | null
    receipt?: unknown
    error?: string
    errorKind?: string
  }

  export interface UpdatePhoneNames {
    updateStatus: string
    updateCheck: string
    updateInstall: string
  }

  export interface UpdateConfigInput {
    pluginId: string
    prefix?: string
    targetPackageName?: string
    registryUrl?: string
    homeDir?: string
    checkTimeoutMs?: number
    confirmationTtlMs?: number
    installTimeoutMs?: number
    panelPollMs?: number
  }

  /**
   * 更新包的日志口。形状抄 `dist/host.js:187,196`（`phoneLogCtx.fire(...)`）与 `dist/store.js:273`
   * （`log("info", "update.install.exec", {...})`）两处真实调用：**三个位置参数，事件名在第二位**。
   *
   * 别按两参写 —— 那个形状会让 `"info"` 变成事件名、真事件名降级成字段对象，两条事件被闸门整条丢掉
   * （#39 第一版就是这么错的，测试全绿、诊断全丢）。第一个参数只表达级别，本仓不据此分派
   * （级别由仓库根 `event-list.dsh-prompt.json` 决定，不引入第二套级别语义），但仍必须收下，
   * 否则参数位置整体错位。调用是同步的，返回值被忽略。
   */
  export interface UpdateLogCtx {
    fire(level: string, event: string, fields?: Record<string, unknown>): void
  }

  export interface CreateHostUpdateDeps {
    ctx?: unknown
    logCtx?: UpdateLogCtx | null
    desktopPnpm?: unknown
    readerOverrides?: Record<string, unknown>
  }

  export interface HostUpdate {
    phoneNames: UpdatePhoneNames
    handlers: Record<string, (args: Record<string, unknown>) => Promise<UpdatePhoneResult>>
  }

  export function createHostUpdate(deps?: CreateHostUpdateDeps, config?: UpdateConfigInput): HostUpdate
}
