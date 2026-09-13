/**
 * dsh-prompt — 更新弹窗的**归属闸**（#41 收口 R2）：同一时刻只允许一只更新弹窗处于可操作态。
 *
 * 为什么需要它（红队 N §1 实测）：同一个组件在真机上有两个实例 —— 设置页那一份（`auto` 不传）与
 * shell.overlay 那一份（`auto: true`）。两份各自持有一份 `open` 状态、各走一次 ModalPortal，
 * 于是「用户点开设置页入口行」+「自动检查到点」会**同屏叠出两只**（两个全屏遮罩 + 两套
 * 检查/跳过/安装按钮）。真包有两道闸（job 状态 + `acquire()` 独占锁）兜住磁盘，但第二只对用户显示
 * 「安装失败」，而真实情况只是「另一次安装正在进行」—— 客户端这一侧当时零防护。
 *
 * 口径（本闸只管「谁来开」，不管怎么渲染）：
 *   1. 一只已经打开 ⇒ 自动那一只**不接手**（用户已经在看的就是唯一那只）；
 *   2. 用户主动开（点设置页入口行）⇒ 压掉自动那一只（那只立刻关闭），用户的手高于背景动作；
 *   3. 窗口关掉后**不释放**名额：自动那只绝不「关了又弹回来」，不再打扰是这个 UI 的契约。
 *      名额跟着实例卸载走（`releasePort`），所以下次挂载 / 下次启动不受影响。
 *
 * 与 `updauto.ts` 的分工：那边是**纯判据**（不认识 React），这边是**模块级状态 + 订阅**（不认识
 * 版本号、不认识电话、不渲染）。两块都发生在同一个会话里，各管各的闸，合起来才够。
 *
 * 本文件不认识 localStorage / storages：与 `state.ts`、`smartstore.ts` 同一套「纯客户端模块」性格。
 */

/** 当前占着名额的实例；`''` = 没人占（可以开）。 */
let owner = ''
/** 自动那一只是否被用户的手压掉（压掉后它自己关，且不再接手）。 */
let autoBlocked = false
/** 归属变化时的订阅者（每个组件实例一份）。 */
const listeners: Array<() => void> = []
/**
 * 本闸**主动指派**的归属（订阅者据此决定要不要关自己）：`null` = 这次变化不是指派
 * （例如用户那只重开自己的窗），订阅者什么都不做。
 */
let nextOwner: string | null = null

/** 实例 token：每个挂载一份，用来回答「名额现在是不是我占着」。 */
export function newPortToken(): string {
  return 'updport-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

function notify(): void {
  for (const fn of listeners.slice()) {
    try { fn() } catch (e) { /* 一个订阅者抛不许影响别人与调用方 */ }
  }
}

/** 订阅归属变化（组件把回调交给 `useState` 即可重新渲染）；返回退订函数。 */
export function subscribePort(fn: () => void): () => void {
  listeners.push(fn)
  return () => {
    const i = listeners.indexOf(fn)
    if (i >= 0) listeners.splice(i, 1)
  }
}

/** 让 `token` 占住名额并广播（`takeAutoPort` 与用户主动开都走这里）。 */
function take(token: string): void {
  owner = token
  nextOwner = token
  notify()
}

/**
 * 自动那一只请求开窗：名额空着才给 true。
 *
 * 两道条件：
 *   1. 名额空着（有另一只已经打开 ⇒ 不接手，用户正在看的就是唯一那只）；
 *   2. 没被用户的手压掉过（点过设置页入口行 ⇒ 自动那只不再开）。
 * 同一次 render 里连调两次也只成功一次（`take` 之后 `owner` 已是自己，第二次照样回 false）。
 */
export function takeAutoPort(token: string): boolean {
  if (owner !== '' || autoBlocked) return false
  take(token)
  return true
}

/**
 * 用户主动开窗（点设置页那一行入口）：调用方拿到之后 `setOpen(true)` 即可 —— 用户的手总是算数。
 *
 * 用户的手高于背景动作：名额被别人（自动那一只）占着就先压掉它（订阅者据此自己关，见
 * `portAutoShouldClose`），并记下「自动不再接手」—— 用户关掉这只窗之后，被压掉的那只**不会**弹回来。
 */
export function askPort(token: string): void {
  if (owner !== '' && owner !== token) autoBlocked = true
  take(token)
}

/**
 * 卸载时归还名额（只在「还占着」时才还：晚挂载的实例接手后，旧实例的清理不许把名额抢回来）。
 * **关窗不调用它** —— 名额要一直占到实例卸载，自动那只才不会「关了又弹回来」。
 */
export function releasePort(token: string): void {
  if (owner === '' || owner !== token) return
  owner = ''
  nextOwner = null
}

/** 自动那一只要不要主动关掉：本闸指派了别的实例（通常是用户那只）⇒ true。 */
export function portAutoShouldClose(token: string): boolean {
  return nextOwner !== null && nextOwner !== token
}
