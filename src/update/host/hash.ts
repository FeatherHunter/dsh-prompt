/**
 * 8 位错误指纹（djb2，与 `lib/log/gate.js` 的 `hash8`、`lib/index.js` 的 `hashText` 同形）。
 *
 * 宿主半自备一份：它不反向依赖日志能力的内部模块（那会把闸门代码一并打进 `lib/update.js`）。
 * 单独一个文件是因为两条链都要用它 —— 值域安全网（safe-values.ts 把不在已知取值集合里的值指纹化）
 * 与失败落盘节流（bridge-log.ts 把成因变成可比的指纹）。
 */
export function hash8(value: unknown): string {
  const text = String(value ?? '')
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
  return ('0000000' + h.toString(16)).slice(-8)
}
