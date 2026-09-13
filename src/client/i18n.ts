/**
 * dsh-prompt — 双语（中文为主，html[lang] 跟随）
 */
export type Lang = 'zh' | 'en'

export function getLang(): Lang {
  try {
    const l = (document.documentElement && document.documentElement.lang) || (navigator.language || 'en')
    return /^zh/i.test(l) ? 'zh' : 'en'
  } catch (e) { return 'zh' }
}

export interface I18NMap { zh: string; en: string }

export function tr(lang: Lang, m: I18NMap): string {
  return lang === 'zh' ? m.zh : m.en
}

export const STR = {
  panelTitle: { zh: 'Prompt', en: 'Prompt' },
  // #53：本插件在设置面板里的页面名 —— 配置页头行左侧与 settings.section 的 label 共用这一份
  sectionName: { zh: '提示词模板', en: 'Prompt Templates' },
  entryBtn: { zh: 'Prompt', en: 'Prompt' },
  add: { zh: '新增自定义模板', en: 'Add custom template' },
  addShort: { zh: '新增', en: 'Add' },
  searchPh: { zh: '搜索模板…', en: 'Search templates…' },
  tabAll: { zh: '全部', en: 'All' },
  tabBefore: { zh: '执行前', en: 'Before' },
  tabDuring: { zh: '执行中', en: 'During' },
  tabAfter: { zh: '执行后', en: 'After' },
  tabCustom: { zh: '自定义', en: 'Custom' },
  domainAll: { zh: '全领域', en: 'All domains' },
  presetCount: { zh: '预制', en: 'Preset' },
  customCount: { zh: '自定义', en: 'Custom' },
  goSettings: { zh: '设置 → 模板管理', en: 'Settings → Templates' },
  edit: { zh: '编辑', en: 'Edit' },
  del: { zh: '删除', en: 'Delete' },
  copy: { zh: '复制为自定义', en: 'Copy to custom' },
  pin: { zh: '置顶/取消置顶', en: 'Pin/Unpin' },
  noMatch: { zh: '无匹配模板', en: 'No matching templates' },
  addTitle: { zh: '新增自定义模板', en: 'Add custom template' },
  editTitle: { zh: '编辑自定义模板', en: 'Edit custom template' },
  namePh: { zh: '模板名称', en: 'Template name' },
  labelsPh: { zh: '添加标签（逗号/空格/顿号分隔，回车确认）', en: 'Add labels (comma/space separated, Enter to confirm)' },
  labelsHint: { zh: '最多 3 个，每条 1–10 字；可从已有词里选，也可新造', en: 'At most 3 labels, 1–10 chars each; pick existing or invent new' },
  labelsTooMany: { zh: '最多 3 个标签', en: 'At most 3 labels' },
  labelTooLong: { zh: '每条标签 1–10 字', en: 'Each label 1–10 chars' },
  labelReserved: { zh: '“任意”不能作为标签', en: '"任意" is reserved and cannot be a label' },
  removeLabel: { zh: '移除标签', en: 'Remove label' },
  bodyPh: { zh: 'Prompt 正文（≤1000 字）', en: 'Prompt body (≤1000 chars)' },
  cancel: { zh: '取消', en: 'Cancel' },
  save: { zh: '保存', en: 'Save' },
  addOk: { zh: '添加', en: 'Add' },
  nameRequired: { zh: '名称必填', en: 'Name is required' },
  bodyTooLong: { zh: '正文超过 1000 字上限', en: 'Body exceeds 1000 chars' },
  delTitle: { zh: '删除确认', en: 'Confirm delete' },
  delMsg: { zh: '确定删除自定义模板', en: 'Delete custom template' },
  delUnrecover: { zh: '此操作不可撤销。', en: 'This cannot be undone.' },
  delOk: { zh: '删除', en: 'Delete' },
  pinFull: { zh: '置顶已达上限（5 个）', en: 'Pin limit reached (5)' },
  insertHint: { zh: '点击即插入', en: 'Click to insert' },
  close: { zh: '关闭', en: 'Close' },
  smartToggle: { zh: '智能模式悬浮卡（输入匹配时推荐模板；默认关）', en: 'Smart card (recommends templates while typing; off by default)' },
  smartToggleHint: { zh: '默认关；打开后仅在输入匹配时出卡', en: 'Off by default; when on, the card appears on match' },
  smartDot: { zh: '智能模式 · 拖动调整位置；输入匹配时出卡', en: 'Smart mode · drag to move; card appears on match' },
  smartTitle: { zh: '智能推荐', en: 'Smart suggest' },
  smartHint: { zh: '点击即填入', en: 'Click to insert' },
  smartFill: { zh: '点击填入', en: 'Insert' },
  smartDismiss: { zh: '收起（继续输入可再次出现）', en: 'Dismiss (reappears as you type)' },
  smartRecent: { zh: '最近使用', en: 'Recently used' },
  smartCommon: { zh: '常用模板', en: 'Common templates' },
  gitHubRepo: { zh: 'GitHub 仓库', en: 'GitHub repo' },
  feedback: { zh: '反馈故障', en: 'Report issue' },
  // #37：设置页右上角两个图标按钮的悬停气泡 + 底部「作者其他插件」引流区（数字均为实测：25 / 38 / 24 / 9）
  starTip: { zh: '你的 ⭐是我夜空中最亮的星。', en: 'Your ⭐ is the brightest star in my night sky.' },
  feedbackTip: { zh: '提交反馈、建议和意见🌹', en: 'Feedback, suggestions and ideas — all welcome 🌹' },
  moreTitle: { zh: '作者其他插件', en: 'More plugins by the author' },
  moreDescDeck: { zh: '装好就有 25 个工程技能在右侧直接用', en: '25 engineering skills ready on the side once installed' },
  moreDescPalette: { zh: '38 款长时间编程护眼配色，一键换上', en: '38 eye-friendly palettes for long coding sessions, applied in one click' },
  moreDescPrompt: { zh: '本面板自己：24 条常用提示模板随手点，不用来回复制粘贴', en: 'This panel itself: 24 everyday prompt templates at hand — no more copy-paste round trips' },
  moreDescCompanion: { zh: '聊天机器人的伴侣插件：扫码或填凭据就把飞书、微信等 9 路聊天接进来', en: 'Companion plugin for chat bots: bring in 9 chat channels such as Feishu and WeChat by scanning a code or filling in credentials' },
  storageNote: { zh: '自定义模板与使用次数保存在 DSH 缓存目录（卸载重装保留）；历史 localStorage 数据不再读取。', en: 'Custom templates and usage live in the DSH cache dir (kept across reinstall); legacy localStorage data is no longer read.' },
  // 地图 #45 / #51：配置页的日志开关 + 导出 + 清空三个入口（文案写明「错误与告警始终记录」）
  logToggle: { zh: '调试日志', en: 'Debug log' },
  logToggleHint: { zh: '默认关。关只停信息与调试两级，错误与告警始终记录；开关以宿主为准，刷新后仍读宿主那份。', en: 'Off by default. Off stops only info and debug, while errors and warnings are always recorded; the host is authoritative and the value survives a refresh.' },
  logGroup: { zh: '诊断日志', en: 'Diagnostics' },
  logWhere: { zh: '落点：~/.dsh/logs/dsh-prompt/', en: 'Location: ~/.dsh/logs/dsh-prompt/' },
  smartGroup: { zh: '智能推荐', en: 'Smart suggestions' },
  logExport: { zh: '导出日志', en: 'Export log' },
  logCopyPath: { zh: '复制路径', en: 'Copy path' },
  logClear: { zh: '清空日志', en: 'Clear log' },
  logClearConfirm: { zh: '确认清空', en: 'Confirm clear' },
  logClearAsk: { zh: '再点一次「确认清空」会删掉全部日志文件（正在排查的证据也会一起删掉）。', en: 'Click "Confirm clear" again to delete every log file — including any evidence you are collecting.' },
  logSwitchOn: { zh: '日志已开启（信息与调试也会记录）。', en: 'Logging enabled (info and debug are recorded too).' },
  logSwitchOff: { zh: '日志已关闭：错误与告警仍会记录。', en: 'Logging disabled: errors and warnings are still recorded.' },
  logSwitchFail: { zh: '开关未保存，仍按原值：', en: 'Switch not saved, previous value kept: ' },
  logExportSaved: { zh: '已导出到下载目录：', en: 'Exported to your downloads: ' },
  logExportDownloadBlocked: { zh: '浏览器拦下了下载，请改用「复制正文」：', en: 'The browser blocked the download — use "Copy text" instead: ' },
  logExportEmpty: { zh: '当天还没有日志文件（开关关闭时只有错误与告警会落盘）。', en: 'No log file for today yet (with the switch off, only errors and warnings are written).' },
  logExportFail: { zh: '导出失败：', en: 'Export failed: ' },
  logPathCopied: { zh: '已复制日志文件路径：', en: 'Log file path copied: ' },
  logPathFail: { zh: '拿不到日志路径，请改用「导出日志」。', en: 'Could not resolve the log path — use "Export log" instead.' },
  logClearOk: { zh: '已删除日志文件', en: 'Deleted log files: ' },
  logClearFail: { zh: '清空失败，请稍后再试。', en: 'Clear failed, please try again.' },
  logWorking: { zh: '处理中…', en: 'Working…' },
  logDropped: { zh: '日志管道已丢弃条数：', en: 'Entries dropped by the log pipeline: ' },
  logUnavailable: { zh: '日志能力当前不可用（宿主未接通）。', en: 'Logging is currently unavailable (host not reachable).' },
  logBytes: { zh: '字节', en: 'bytes' },
  logFiles: { zh: '个文件', en: 'file(s)' },
  logReasonHost: { zh: '宿主不可达', en: 'host unreachable' },
  logReasonRejected: { zh: '宿主拒绝写入', en: 'host rejected the write' },
  logReasonTimeout: { zh: '宿主超时未应答', en: 'host timed out' },
  logReasonStale: { zh: '已有更新的开关操作，本次作废', en: 'a newer switch action superseded this one' },
  logReasonOther: { zh: '未知原因', en: 'unknown reason' },
  // #40：设置面板顶部的「检查更新」入口 + 更新弹窗。
  // 八条失败原因的文案逐字对齐包 README 第 8 节的第三列（「用户该做什么」）——
  // 只显示英文原因码对用户没用，这一列才是可执行的。第 8 条 registry-conflict 在 0.1.1 里
  // 零处产出（#55 实测）：**预留文案，但不许为它编情形**（真机到不了就不要在别处假装它会到）。
  updateEntry: { zh: '检查更新', en: 'Check for updates' },
  updateEntryHint: { zh: '看当前版本，并问官方源有没有新版', en: 'See your version and ask the registry for a newer one' },
  // #60 追加交付 B：结论行（这一页唯一的视觉主角）。它只回答「我是不是最新版」，三选一。
  // `{version}` / `{latest}` / `{running}` 三个占位由 update.ts 的 fill() 填。
  updateVerdictUpToDate: { zh: '已是最新版本（{version}）', en: 'Up to date ({version})' },
  updateVerdictNewer: { zh: '有新版本 {latest}（当前 {running}）', en: 'Update {latest} available (you have {running})' },
  updateVerdictUnknown: { zh: '这次没查到', en: 'Could not find out this time' },
  updateVerdictUnknownHint: { zh: '还没问过官方源：点「检查更新」问一次。', en: 'The registry has not been asked yet — click "Check now".' },
  // 三个版本号收进「详情」，默认收起：它们是排查用的实现细节。
  updateDetails: { zh: '详情', en: 'Details' },
  updateVersionUnknown: { zh: '版本未知', en: 'version unknown' },
  updateRowRunning: { zh: '当前版本', en: 'Running' },
  updateRowInstalled: { zh: '已装版本', en: 'Installed' },
  updateRowLatest: { zh: '最新版本', en: 'Latest' },
  updateLatestNone: { zh: '还没查过（点「检查更新」问官方源）', en: 'not checked yet (click "Check now" to ask the registry)' },
  updateNotAvailable: { zh: '未知', en: 'unknown' },
  updateBtnCheck: { zh: '检查更新', en: 'Check now' },
  updateBtnChecking: { zh: '查询中…', en: 'Checking…' },
  updateBtnInstall: { zh: '安装新版本', en: 'Install update' },
  updateBtnInstalling: { zh: '安装中…', en: 'Installing…' },
  updateBtnCopy: { zh: '复制命令', en: 'Copy command' },
  updateCopied: { zh: '已复制到剪贴板。', en: 'Copied to the clipboard.' },
  updateCopyFail: { zh: '复制失败，请手动选中命令复制。', en: 'Copy failed — select the command manually.' },
  updateClose: { zh: '关闭', en: 'Close' },
  // #41：启动后延迟一次自动检查，只在发现新版本时弹一次（同一个组件，不是第二只弹窗）。
  updateAutoNote: {
    zh: '这是启动时自动检查的结果：只在发现新版本时弹这一次，之后不再打扰。',
    en: 'Automatic check on start: this dialog appears once, and only when a newer version exists.',
  },
  // #41：「跳过此版本」只落 localStorage（不进 storages/dsh_prompt.json），同版本不再自动弹。
  updateSkipVersion: { zh: '跳过此版本', en: 'Skip this version' },
  updateSkipDone: {
    zh: '已跳过 {version}：下次启动不再自动提示这个版本；点「检查更新」仍能看到它。',
    en: 'Skipped {version}: it will not be auto-prompted on the next start; "Check now" still shows it.',
  },
  updateSkipFail: {
    zh: '没能记住这个版本（本机存储不可用）：下次启动可能还会自动提示。',
    en: 'Could not remember this version (local storage unavailable): it may be auto-prompted again next start.',
  },
  // 两类「电话级失败」的标题与 hint 是**分开**的：桥真的没回答（上面这两条）与宿主回答了但这次操作没成
  // （下面这两条）不是一回事，后者照前者说就是撒谎（用户会去报一个不存在的「宿主没接通」）。
  updateHostFailTitle: { zh: '宿主没有回答更新状态', en: 'The host did not answer the update status' },
  updateHostFailHint: {
    zh: '更新能力可能没接通（宿主半未加载），也可能宿主半刚起、还没就绪。刷新页面再点一次；一直这样就把日志导出后提 Issue。',
    en: 'The update capability may not be wired up (host half not loaded), or the host half is not ready yet. Refresh the page and try again; if it keeps happening, export the log and open an issue.',
  },
  // 第三类：宿主**回了话**，回的却是「更新能力没接通」（`update-capability-unavailable` / `phone-failed` /
  // `unknown-phone`）。它不是「宿主是通的，不用刷新页面」那一类 —— 把它划过去就是撒谎（红队 L2 的 N1），
  // #43 真机验收最容易撞的失败态（宿主半没加载）正好落在它上面。
  updateCapDownTitle: { zh: '更新能力没接通（宿主半降级或未加载）', en: 'The update capability is not wired up (host half degraded or not loaded)' },
  updateCapDownAction: {
    zh: '宿主回了这个码 = 它那边的更新能力没起来：把宿主整个重启一次（关掉 DSH 再开）让能力重建，再点「检查更新」。',
    en: 'This code comes from the host and means its update capability did not come up: restart the host (quit DSH and start it again) so it is rebuilt, then click "Check now".',
  },
  updateFailAnsweredTitle: { zh: '宿主回答了：这次操作没成', en: 'The host answered — this operation did not go through' },
  updateFailAnsweredHint: {
    zh: '往下看这个错误码与对应做法（表里没有的新码也会给一条兜底做法）；宿主这次确实回了话，除非那个码本身就说能力没接通，否则不用刷新页面、也不用按「宿主没接通」报故障。',
    en: 'See the code below and what to do about it (an unknown code still gets a fallback action). The host did answer this time, so unless the code itself says the capability is not wired up, there is no need to refresh the page or report a "host not reachable" fault.',
  },
  updateFailNoFault: {
    zh: '这不是故障码，是包设计内的守卫（README 第 11 节点名为正常错误码）。',
    en: 'This is not a fault code but a guard the package documents (section 11 of its README names it a normal error code).',
  },
  // 实产失败码的「下一步动作」：码 → 文案键（表在 update.ts 的 UPDATE_FAIL_KEYS，两边同名对应）。
  // 每个键的文本都要能独立成立（读者可能只看这一行）。
  updateFailBusy: {
    zh: '宿主正在装另一个任务或刚装完：等它跑完、面板会自己刷新；一直这样就把宿主重启一次。',
    en: 'The host is busy with another install (or just finished one): wait for it to settle — the panel refreshes itself; if it persists, restart the host.',
  },
  updateFailCheckFailed: {
    zh: '查新版没查成（多半是网络没通到官方源）：确认网络能访问 npm 官方源，再点一次「检查更新」。',
    en: 'The version check did not complete (usually the registry was unreachable): make sure the npm registry is reachable, then click "Check now" again.',
  },
  updateFailInvalidRelease: {
    zh: '官方源回的元数据不是本包或版本号非法：先确认没被代理/镜像换过内容，再点一次「检查更新」。',
    en: 'The registry returned metadata that is not this package, or an invalid version: check that a proxy or mirror is not rewriting the response, then click "Check now" again.',
  },
  updateFailInstallFailed: {
    zh: '这次安装没成功，磁盘上的版本没变：用下面的手工兜底命令装，或点「检查更新」拿到新凭证再试一次。',
    en: 'This install did not succeed and the version on disk is unchanged: use the manual fallback command below, or click "Check now" to get a fresh credential and retry.',
  },
  updateFailCheckExpired: {
    zh: '安装凭证过期了（默认 10 分钟）：点「检查更新」重新取一张凭证，再点「安装新版本」。',
    en: 'The install credential expired (10 minutes by default): click "Check now" to get a fresh one, then click "Install update" again.',
  },
  updateFailInstallationChanged: {
    zh: '安装位置在使用中途变了：把宿主重开一次，再点「检查更新」让指纹重新绑定。',
    en: 'The installation moved mid-flight: reopen the host, then click "Check now" so the fingerprint rebinds.',
  },
  updateFailRegistryConflict: {
    zh: '本地声明的版本与磁盘实际版本矛盾：打开使用范围的清单文件，把目标包那一行改成版本号再试。',
    en: 'The version declared locally contradicts the one on disk: open the profile manifest, pin the target package to a version, and retry.',
  },
  updateFailRecoveryRequired: {
    zh: '上次安装被打断，留下一个半截任务：点「检查更新」看现在的状态，必要时重新点一次安装。',
    en: 'The previous install was interrupted and left a half-done job: click "Check now" to see the current state, then retry the install if needed.',
  },
  updateFailUnknown: {
    zh: '面板还不认识这个码：把原始错误码记下来提 Issue，或点「检查更新」重试一次。',
    en: 'The panel does not know this code yet: note the raw error code down and open an issue, or click "Check now" to retry.',
  },
  updateNoCredential: {
    zh: '宿主这次没给安装凭证，装不了；再点一次「检查更新」拿张新凭证。',
    en: 'The host returned no install credential this time, so nothing was installed; click "Check now" again for a fresh one.',
  },
  // 单飞锁挡下这一下点击时的说法（N5）：真实原因是「面板上一次通话还在飞」（多半是轮询那一发），
  // **不是**宿主没给凭证 —— 照后者说就把用户支去重新查新版了。
  updateBusyRetry: {
    zh: '面板上一次通话还没回来（多半是轮询那一发在飞），这次点击没发出去；等一拍再点一次「安装新版本」。',
    en: 'A previous call from the panel has not returned yet (usually the polling shot), so this click sent nothing; wait a moment and click "Install update" again.',
  },
  // 安装任务自己的终态失败（`snapshot.job.state` 为 failed / interrupted）。这不是 `blockedReason` 的
  // 八条之一 —— 包 README 第 8 节没有「安装失败」这种情形，所以**另起一条**、不冒充那八条。
  // 注意：这里**没有**上一版那条凭空编出来的「参数不对」文案。那个码在更新包的 `updateError(...)`
  // 实参全集与本仓宿主半的码表里都不存在（整个 dist 连 `params` 这个字都没有），红队 L2 的 N2 点名删掉。
  // 不认识的码一律走 `updateFailUnknown` 的兜底动作，不再为它编情形。
  updateJobFailTitle: { zh: '这次安装没成功', en: 'This install did not succeed' },
  updateJobFailHint: {
    zh: '磁盘上的版本没变。用下面的手工兜底命令重装，或点「检查更新」再试一次；一直这样就把日志导出后提 Issue。',
    en: 'The version on disk is unchanged. Reinstall with the manual fallback command below, or click "Check now" to retry; if it keeps happening, export the log and open an issue.',
  },
  updateReasonTitle: { zh: '装不了的原因', en: 'Why it cannot install' },
  updateReasonUnknown: {
    zh: '这条原因码本面板还不认识（多半是更新包升版加了新码）。把原始原因码记下来提 Issue。',
    en: 'This panel does not know this reason code (an update package upgrade probably added it). Note the raw code down and open an issue.',
  },
  updateWhyUnknownProfile: {
    zh: '检查使用范围名是否含特殊字符、目录是否还在；这种情形不给手工命令，先把范围修好。',
    en: 'Check whether the profile name has special characters and whether the directory still exists; no manual command is given for this case — fix the profile first.',
  },
  updateWhySourceInstall: {
    zh: '这种情形不给手工命令；想走更新，先按版本号重装一次。',
    en: 'No manual command is given for this case; to use updates, reinstall once from a published version.',
  },
  updateWhyInvalidInstallation: {
    zh: '重装当前版本，把已装目录修好再查更新。',
    en: 'Reinstall the current version, fix the installed directory, then check again.',
  },
  updateWhyInstallationChanged: {
    zh: '重新打开宿主再查一次，让指纹重新绑定；还出现就重装。',
    en: 'Reopen the host and check again so the fingerprint rebinds; if it still appears, reinstall.',
  },
  updateWhyPendingRestart: {
    zh: '重启宿主，让新版跑起来；这是正常终态，不是失败。',
    en: 'Restart the host so the new version takes over; this is a normal end state, not a failure.',
  },
  updateWhyRegistryConflict: {
    zh: '打开使用范围的清单文件，看目标包名那一行写的是不是版本号，改成版本号再试。',
    en: 'Open the profile manifest and check whether the target package line pins a version; pin one and retry.',
  },
  updateWhyIncompatibleNode: {
    // 包 README 第 8 节第三列原话是「先升级 Node 到 22 或更高，再查更新」——这一行**照抄**，不是偏离：
    // 包判断的是远端 `engines.node` 声明的门槛（`satisfiesNodeRange(ports.nodeVersion, release.nodeRange)`），
    // 本仓没有第二处门槛可写（#42 已经把 DSH 版本声明收成一处真值）。所以这里**只剩一处**有意偏离
    // （`recovery-required`，见下），不要把它算成两处。
    zh: '先升级 Node 到 22 或更高，再查更新。',
    en: 'Upgrade Node to 22 or newer first, then check again.',
  },
  updateWhyRecoveryRequired: {
    // 包 README 第三列的原话是「重新点一次安装；一直出现就按第 12 节排错」——「第 12 节」是**包自己的**
    // README，用户手里没有，所以这里把那半句换成一句用户真能执行的话（点安装 / 导出日志提 Issue）。
    zh: '重新点一次「安装新版本」；一直出现就把日志导出后提 Issue。',
    en: 'Click "Install update" once more; if it keeps appearing, export the log and open an issue.',
  },
  updatePendingBanner: {
    zh: '⚠️ 新版 {new} 已装好，正在跑的还是 {old}，重启宿主后生效。',
    en: '⚠️ Update {new} is installed; {old} is still running — restart the host to apply it.',
  },
  updatePendingHint: {
    zh: '桌面端完全退出重开；web 端重启后刷新页面（Ctrl+F5）。',
    en: 'Fully quit and reopen the desktop app; for the web host, restart it and refresh the page (Ctrl+F5).',
  },
  updateManualTitle: { zh: '手工兜底命令', en: 'Manual fallback command' },
  updateManualNone: { zh: '宿主这次没有给出手工命令（只展示上面的原因）。', en: 'The host returned no manual command this time (only the reason above).' },
  // #60 追加交付 B 第 4/6 条：命令下面**只留一句**说清它能做什么。上一版那四行自我辩解
  // （「这不是万能药…」）与末尾那句缓存机制说明都删了 —— 把作者的不确定感摊给用户，正是这次要修的。
  updateManualHint: {
    zh: '这条命令会把「已装版本」重装一遍。',
    en: 'This command reinstalls the version you already have.',
  },
  updateManualStale: {
    zh: '这条命令来自上一次成功的通话，不是这次失败的答复。',
    en: 'This command comes from the last call that succeeded, not from the call that just failed.',
  },
}
