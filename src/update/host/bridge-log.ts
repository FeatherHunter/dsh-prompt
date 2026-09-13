/**
 * dsh-prompt — 更新能力宿主半的**日志桥**（#39）：把更新包报的三条事件转给本仓日志能力。
 *
 * **签名按上游 `dist/` 的真实调用点抄，不按 README 的示例文字抄**：`dist/host.js:187,196` 发的是
 * `phoneLogCtx.fire(level, event, fields)`，`dist/store.js:273` 发的是 `log(level, event, fields)`
 * —— 都是三参，事件名在第二个位置。#39 第一版写成两参 `fire(event, fields)`，于是 `"info"` 被当成
 * 事件名、真事件名降级成字段对象、字段对象整条丢掉，再被事件闸门按「未声明事件」静默丢弃 ——
 * 更新能力的诊断轨迹全丢而测试全绿（审查爆点 1）。
 *
 * 级别（第一参）不转交：本仓的级别由清单 `event-list.dsh-prompt.json` 按事件名决定，
 * 不引入第二套级别语义。**字段名也不做第二道白名单**：白名单的权威是日志能力的闸门
 * （`lib/log/gate.js`），这里按名字逐个挑字段等于在闸门前面又立一道白名单 —— 上游字段一改名就在
 * 桥里被无声裁掉，而闸门的 `droppedFields` 恒 0，字段漂移变成零可观测（#39 复审 V3）。桥只判
 * **事件名**：包里那三条走原样转交（字段名一个不动），其余一律走 unknown-event 自报。
 * 清单没声明的事件（包升版新加）不静默丢：落一条 `update.route.fail`（reason = unknown-event）。
 *
 * #39 在这条链上的三层防护（**都在值这一侧，字段名一个不动**）：
 * - **语义白名单**（H1，一票否决项）：见 `safe-values.ts` 的 `SAFE_FIELD_ENUM` / `safeFields`。
 * - **失败落盘节流**（H2/K3，本文件）：见 `noteFail` / `clearFails` / `DEFAULT_RELOG_FLOOR_MS`。
 * - 事件名漂移自报：`unknown-event` 只落一次（事件名漂移是**状态**，不是每次调用都会变的事实）。
 */

import type { UpdateLogCtx } from 'dsh-plugin-update'
import { hash8 } from './hash.js'
import { safeFields, UPDATE_ROUTE_FAMILY } from './safe-values.js'

/** 日志能力的形状（本能力只用到 `log`；`lib/index.js` 传进来的那个实例满足它）。 */
export interface LogCapability {
  log(event: string, fields?: Record<string, unknown>): unknown
}

/** 落盘节流的时间源与间隔（`createUpdateCapability` 的注入口，生产用真时钟 + 默认间隔）。 */
export interface BridgeLogClock {
  now?: () => number
  relogFloorMs?: number
}

/**
 * 失败落盘节流（#39 四轮整改 K3）：同一 `(method, kind)` 的持续失败不能每请求刷一行 ——
 * `warn` 绕过日志开关（`dsh-log` 的 `isEnabled` 对 warn 恒真），真机上「电话持续失败」（断网 /
 * `check-expired` / registry 抽风）配上面板 `UPD_POLL = 1000ms` 就是每秒 2 行恒写、用户关不掉
 * （复审 D 实测 62 次请求 124 行 / 20402 B ⇒ 54.2 MiB/天）。
 *
 * 三轮的处置是「按状态落一次」，复审 F 又量出两个残余，四轮一并修：
 * - 同一状态**成因变化**（错误原文换了）→ 0 行，**第二种成因被静默吞掉**（本票最忌讳的一类病）；
 *   现在：新的成因指纹记进 `pending`，离开重落间隔的**下一次任何调用**把它补落（见 noteFail）。
 * - **成败交替**（每次成功清账、下一次失败又是新状态）→ 1 行/请求 ⇒ 13.38 MiB/天；现在受
 *   `DEFAULT_RELOG_FLOOR_MS` 约束：同一状态两次落盘之间至少要隔这么久。
 * 键**不含** errorHash（原文可能每次都不同 —— 超时里带毫秒、消息里带临时路径，放进去等于没去重），
 * 也不设「最多记几个成因」的上限（上限会把真实的新失败丢掉；间隔本身已经把频率压住了）。
 */
export const DEFAULT_RELOG_FLOOR_MS = 60000

/** 去重键：电话名 + 阶段（两个都是桥自己判过的语义取值，见 safe-values.ts）。 */
function failKeyOf(method: string, kind: string): string {
  return method + '\u0000' + kind
}

/** 一个失败状态的账：已落盘的成因、等间隔的成因队列（每项带到达时刻）、上次落盘时刻。 */
interface FailState {
  reported: Set<string>
  pending: Array<{ hash: string; at: number }>
  lastLogAt: number
}

/**
 * 建日志桥。能力是异步建起来的，这里用一个可变槽兜住；闭包在能力就绪前被调用时直接丢掉那一批
 * （只可能丢启动瞬间的一两条，日志能力缺席时的语义本来就是「不落盘」）。
 */
export function createBridgeLog(
  logReady: Promise<LogCapability | null> | null | undefined,
  clock?: BridgeLogClock,
): UpdateLogCtx {
  let cap: LogCapability | null = null
  const now = typeof clock?.now === 'function' ? clock.now : () => Date.now()
  const relogFloorMs = typeof clock?.relogFloorMs === 'number' && clock.relogFloorMs >= 0
    ? clock.relogFloorMs
    : DEFAULT_RELOG_FLOOR_MS
  /** unknown-event 自报只落一次：事件名漂移是**状态**，不是每次调用都会变的事实（同复审 V1 的处置）。 */
  let unknownReported = false
  /** 已落过盘的电话失败状态（键见 failKeyOf）：持续失败不再每请求刷一行。 */
  const failedStates = new Map<string, FailState>()
  if (logReady && typeof logReady.then === 'function') {
    logReady.then(
      (ready) => { cap = ready && typeof ready.log === 'function' ? ready : null },
      () => { cap = null },
    )
  }
  /**
   * 这个失败该不该落盘（H2 + 四轮整改 K3）。**速率由「失败到达的时刻」把关**（唯一定时器 = `lastLogAt`）：
   * ① 没见过这个 (method, kind) → 落（**首条必落**：真实故障不许因为节流而看不见）；
   * ② 这个成因**正排在队首等**且间隔已到 → 出队落它（见下）；
   * ③ 这个成因已经落过 → 不落；
   * ④ 这个成因已经在队列里等着 → 不落，**也不刷新它的等待起点**（重复报到不该让待落盘的东西一推再推）；
   * ⑤ 全新成因且距上次到达 ≥ `relogFloorMs` → 落它并记进 `reported`；否则进队列等下一次调用。
   * 「按到达时刻计时」而不是「按队列头年龄」是刻意的：成败交替时每次成功都会清账、
   * 下一个失败又是「新状态」，只有按到达时刻才挡得住它（复审 F 实测 13.38 MiB/天）。
   * 键稳定在 (method, kind)：**成因与次数进的是落盘判据，不是去重键**；队列不设条数上限
   * （上限同样会丢掉真实的新失败；频率已经由间隔把关：每个间隔最多落一条）。
   *
   * **② 是这个收口轮修掉的那个 FAIL**：早先的写法把「已在队列」放在最前面 return，
   * 于是「恢复 → 同一个成因再失败」这条路上，那个成因永远卡在队列里 —— 恢复把 `reported` 清空了，
   * 但（按设计）不碰队列，于是它每次报到都在第 ④ 步被挡回、补落根本轮不到执行；
   * 量出来的现象正是 `恢复（成功一次）+ 间隔到点后再失败 → 0 行`：一个**真实的持续故障被静默了**
   * （本票最忌讳的一类病，也是复审 F 的 Top3）。队列里的成因本来就是「还没落盘、在等间隔」的东西，
   * 所以它该被认成**待补落**而不是**重复**：只在「③ 已落过」时才压掉，队首那条在 ② 出队。
   * 这一条只在 `head.hash === cause` 时生效 —— 换一个成因进来时仍按 ⑤ 走，队列纪律不变。
   */
  function noteFail(method: string, kind: string, causeHash: string): boolean {
    const key = failKeyOf(method, kind)
    const cause = String(causeHash)
    const at = now()
    const entry = failedStates.get(key)
    if (!entry) {
      failedStates.set(key, { reported: new Set([cause]), pending: [], lastLogAt: at })
      return true
    }
    const head = entry.pending[0]
    if (head !== undefined && head.hash === cause) {
      if (at - entry.lastLogAt < relogFloorMs) return false
      entry.pending.shift()
      entry.reported.add(cause)
      entry.lastLogAt = at
      return true
    }
    if (entry.reported.has(cause)) return false
    if (entry.pending.some((p) => p.hash === cause)) return false
    if (at - entry.lastLogAt >= relogFloorMs) {
      entry.reported.add(cause)
      entry.lastLogAt = at
      return true
    }
    entry.pending.push({ hash: cause, at })
    return flushPendingFail(entry)
  }
  /**
   * 队列里最老的成因等够间隔（相对它自己到达的时刻）就落它，返回 true。成不落盘都不会被丢掉：
   * 没等够就留在队列里，下一次任何调用都会再试 —— 间隔内到达的成因不会因为「没人再报它」而被吞掉。
   */
  function flushPendingFail(entry: FailState): boolean {
    const head = entry.pending[0]
    if (!head) return false
    if (now() - head.at < relogFloorMs) return false
    entry.pending.shift()
    entry.reported.add(head.hash)
    entry.lastLogAt = now()
    return true
  }
  /**
   * 这个电话成功了：清掉它的**成因账**（恢复之后再失败是**新状态**，必须重新落一条 —— 不是只报一次）。
   * 条目本身留着：它记着上次落盘的时刻与队列（间隔的唯一依据）。
   */
  function clearFails(method: string): void {
    const prefix = failKeyOf(method, '')
    for (const [key, state] of failedStates) {
      if (!key.startsWith(prefix)) continue
      state.reported = new Set<string>()
      state.pending = []
    }
  }
  return {
    fire(level: string, event: string, fields?: Record<string, unknown>): void {
      try {
        if (!cap) return
        const f = (fields ?? {}) as Record<string, unknown>
        switch (String(event ?? '')) {
          case 'host.call': {
            const safe = safeFields('host.call', f)
            // 成功轨迹 = 这个电话已经恢复：清掉它的失败账（下一次失败会重新落一条）。
            if (safe.ok === true) clearFails(String(safe.method ?? ''))
            // 写作 `{ ...safe }` 而不是直接传 `safe`：本仓 `test:log` 的调用点扫描按「事件名后跟一个字面量
            // 对象」认调用点（CALL_RE），少了那对大括号，这个事件会被读成「声明了却没人打」（实测变红）。
            // 展开写法与整改前的 `{ ...f }` 同形，扫描面不变。
            cap.log('host.call', { ...safe })
            return
          }
          case 'host.call.fail': {
            const safe = safeFields('host.call.fail', f)
            // 成因 = 错误原文的指纹（拿原文过 hash8，而不是只看上游传的 errorHash 字段值，
            // 因为后者可能不是 8 位十六进制、会被安全网再散一次）。
            const causeHash = hash8(String(f.errorHash ?? ''))
            if (!noteFail(String(safe.method ?? ''), String(safe.kind ?? ''), causeHash)) return
            cap.log('host.call.fail', { ...safe })
            return
          }
          case 'update.install.exec': {
            // route 是 `cli-process` / `desktop-service`**或 `"none"`**：`"none"` 表示「没有安装配方」
            // （包 `dist/store.js:333` 的 catch 用 `error?.exitCode ?? exitCode`，配方为空时是 undefined）
            // —— 这条路径**没有 `exitCode` 键**，也不是一条真路由，排障时别读成一次真实执行（复审 D A3）。
            const safe = safeFields('update.install.exec', f)
            cap.log('update.install.exec', { ...safe })
            return
          }
          default:
            // 包升版新加的事件：清单里没有，落盘会被闸门按「未声明事件」丢掉 —— 那就留一条可见的
            // 自报，别让「包的日志契约变了」这件事无声通过（事件名本身不落盘，只落稳定指纹）。
            if (unknownReported) return
            unknownReported = true
            cap.log('update.route.fail', {
              route: UPDATE_ROUTE_FAMILY, reason: 'unknown-event', errorHash: hash8(String(event ?? '')),
            })
        }
      } catch (e) { /* 记日志失败不许影响安装 */ }
    },
  }
}
