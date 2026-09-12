/**
 * `dsh-log/client` 的本仓手写声明（子票 #49）。
 *
 * 为什么手写：dsh-log@0.2.1 的发布白名单里只有 6 个 JS 产物，不带 `.d.ts`；
 * 直接 import 会让 `npm run typecheck` 报 TS7016（隐式 any）。声明只覆盖本仓真正用到的那一面，
 * 不做全包复刻——包升级改了别处，这里不会假通过。
 * 形状依据：dsh-log 的 `dist/client.js` 返回值（L420-443）与 `README.md` 第 5.1 节。
 */
declare module 'dsh-log/client' {
  export interface ClientLogHost {
    call(name: string, args?: unknown): Promise<unknown>
  }

  export interface ClientLogTimer {
    timeout(fn: () => void, ms: number): unknown
  }

  export interface ClientLogStorage {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
  }

  export interface ClientLogDeps {
    host?: ClientLogHost | null
    timer?: ClientLogTimer | null
    storage?: ClientLogStorage | null
    broadcastLogSwitch?: (() => void) | null
  }

  export interface ClientLogConfig {
    pluginId?: string
    prefix?: string
    eventList?: unknown
  }

  export interface ClientLogSwitchState {
    enabled: boolean
    sampleRate: number
    rev: number
  }

  export interface ClientLogPhoneNames {
    logBatch: string
    logExport: string
    logClear: string
    logGetSwitch: string
    logSetSwitch: string
  }

  export interface ClientLogSwitchResult {
    ok: boolean
    enabled: boolean
    sampleRate?: number
    error?: string
  }

  export interface ClientLog {
    config: { pluginId: string; prefix: string; eventList: unknown }
    phoneNames: ClientLogPhoneNames
    logSwitch: ClientLogSwitchState
    isEnabled(level: string): boolean
    log(level: string, event: string, fields?: Record<string, unknown>): void
    flush(): { ok: boolean }
    getDroppedCount(): number
    readLocalDebugSwitch(): ClientLogSwitchState
    reconcileLogSwitch(): Promise<ClientLogSwitchResult>
    setLogSwitch(enabled: boolean, sampleRate?: number): Promise<ClientLogSwitchResult>
  }

  export function createClientLog(deps?: ClientLogDeps, config?: ClientLogConfig): ClientLog
  export function buildPhoneNames(prefix: string): ClientLogPhoneNames
  export const LOG_DEBUG_KEY: string
  export const LOG_LEVELS: string[]
}
