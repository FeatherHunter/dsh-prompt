/**
 * `src/update/gen/updateClient.derived.js` 的类型声明（本仓自备）。
 *
 * 那个文件是 `dsh-plugin-update` 的官方集成工具 `derive-client-values.mjs` 生成的纯 JS
 * （包故意只发 JS，不要求消费方有 TypeScript 工具链），本身没有 `.d.ts`。这里手写一份，
 * 让面板与 shim 能按类型引用；**取值仍以生成文件为唯一真相**，改前缀时重跑
 * `npm run derive:update-values`，这份声明不用动。
 */
export declare const UPD_STATUS: string
export declare const UPD_CHECK: string
export declare const UPD_INSTALL: string
/** 面板轮询间隔默认值（毫秒）。 */
export declare const UPD_POLL: number
/** 面板轮询间隔下限（毫秒）。 */
export declare const UPD_POLL_MIN: number
