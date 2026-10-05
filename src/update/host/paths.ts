/**
 * 更新四条路由的路径常量（#127 从已删的客户端 bridge.ts 搬家到宿主半）。
 *
 * 宿主半与 `lib/index.js` 的 UPDATE_ROUTES 同值；#128 起客户端新整组件经
 * http helper 的 routes 表映射到这里，不再需要客户端 bridge。
 */
export const UPDATE_STATUS_PATH = '/_dsh/dsh-prompt/update/status'
export const UPDATE_CHECK_PATH = '/_dsh/dsh-prompt/update/check'
export const UPDATE_INSTALL_PATH = '/_dsh/dsh-prompt/update/install'
export const UPDATE_CHANGELOG_PATH = '/_dsh/dsh-prompt/update/changelog'
