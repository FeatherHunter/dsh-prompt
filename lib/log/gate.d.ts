/**
 * `lib/log/gate.js` 的类型声明（给 `tsc` 看：客户端 bundle 会 import 这个 JS 模块）。
 * 只声明客户端真正用到的那一面；形状变了这里也要改，漏改会当场类型报错。
 */
export interface EventGateStats {
  undeclared: number
  droppedFields: number
  oversize: number
  scrubbed: number
}

export interface EventGateResult {
  ok: boolean
  reason?: string
  level: string
  fields: Record<string, unknown>
}

export interface EventGate {
  filter(event: string, fields?: Record<string, unknown>): EventGateResult
  stats: EventGateStats
  manifestOk: boolean
  isDeclared(event: string): boolean
  levelOf(event: string): string | null
  eventNames(): string[]
}

export interface EventGateOptions {
  pluginId?: string
  onWarn?: (message: string) => void
}

export const MAX_EVENT_BYTES: number
export const MAX_FIELD_CHARS: number
export const HASH_RE: RegExp
export const MANIFEST_FAIL_EVENT: string
export const RULE_TABLE: Array<[string, RegExp]>

export function hash8(value: unknown): string
export function summarizeManifest(raw: unknown, pluginId?: string): { ok: boolean; reason: string; table: Map<string, { level: string; kind: string; fields: string[] }> | null }
export function createEventGate(raw: unknown, options?: EventGateOptions): EventGate
