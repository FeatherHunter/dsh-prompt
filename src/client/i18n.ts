/**
 * dsh-prompt — 双语词表与兼容入口（中文为主，html[lang] 跟随）
 *
 * #137 起语言解析与订阅收口在 ./locale（normalizeLangTag / resolveLocale / subscribeLocale）；
 * 本模块只留词表面（STR / tr）与 getLang 兼容薄壳 —— 新代码请直接用 ./locale，
 * 不要经这个历史入口（它保留只是为了不动既有调用点的表面签名）。
 */
import { resolveLocale, type Lang } from './locale'

export type { Lang } from './locale'

/** @deprecated #137：兼容薄壳，内部走 resolveLocale（签名与默认值 zh 不变）。新代码用 ./locale 的 resolveLocale。 */
export function getLang(): Lang {
  return resolveLocale()
}

export interface I18NMap { zh: string; en: string }

export function tr(lang: Lang, m: I18NMap): string {
  return lang === 'zh' ? m.zh : m.en
}

export const STR = {
  panelTitle: { zh: 'Prompt', en: 'Prompt' },
  // #77：设置页那一块模板列表默认收起，头行整行是开关 —— 这一个是它的 title / 可点提示。
  templatesToggleHint: { zh: '点击展开/收起模板列表', en: 'Click to expand or collapse the template list' },
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
  // #141：范围钮「预制」—— 不复用 presetCount（那是条数摘要；同字不同位，钩子要能分开定位），
  // 也不复用 store.LABEL_FALLBACK（那是写进用户数据的身份值，不是显示串）。术语统一：铬一律「预制」。
  // 改 en 文案时与 presetCount 同步改；门禁 P1_KEYS 卡住单键缺失但卡不住语义分叉。
  scopePreset: { zh: '预制', en: 'Preset' },
  customCount: { zh: '自定义', en: 'Custom' },
  // #142：空标签回落词显示映射 —— en 与 tabCustom/customCount 同字（Custom）但**不同键、不复用**
  // （那两个是范围钮/条数摘要的铬，钩子要能分开定位；见 #141 presetCount/scopePreset 先例）。
  // store.LABEL_FALLBACK 是写进用户数据的身份值（永不翻译），这里只是它在各展示位的显示串。
  labelFallback: { zh: '自定义', en: 'Custom' },
  // #142 边缘裁决 a：复制预置拼进 name 落盘（用户数据一部分，已存永不改写）。无 parse 回代码
  // （grep 仅 store.ts 创建行），故新建那一刻按当前语言取一次后缀；en 含前导空格（name + suffix 自然拼出 'name (copy)'）。
  copySuffix: { zh: '（副本）', en: ' (copy)' },
  goSettings: { zh: '设置 → 模板管理', en: 'Settings → Templates' },
  edit: { zh: '编辑', en: 'Edit' },
  del: { zh: '删除', en: 'Delete' },
  copy: { zh: '复制', en: 'Copy' },
  pin: { zh: '置顶/取消置顶', en: 'Pin/Unpin' },
  noMatch: { zh: '无匹配模板', en: 'No matching templates' },
  addTitle: { zh: '新增自定义模板', en: 'Add custom template' },
  editTitle: { zh: '编辑自定义模板', en: 'Edit custom template' },
  namePh: { zh: '模板名称', en: 'Template name' },
  labelsPh: { zh: '添加标签（逗号/空格/顿号分隔，回车确认）', en: 'Add labels (comma/space separated, Enter to confirm)' },
  labelsHint: { zh: '最多 3 个，每条 1–10 字；可从已有词里选，也可新造', en: 'At most 3 labels, 1–10 chars each; pick existing or invent new' },
  labelsTooMany: { zh: '最多 3 个标签', en: 'At most 3 labels' },
  labelTooLong: { zh: '每条标签 1–10 字', en: 'Each label 1–10 chars' },
  removeLabel: { zh: '移除标签', en: 'Remove label' },
  labelPicker: { zh: '标签选择', en: 'Pick tags' },
  labelDone: { zh: '完成', en: 'Done' },
  bodyPh: { zh: 'Prompt 正文（≤10000 字）', en: 'Prompt body (≤10000 chars)' },
  cancel: { zh: '取消', en: 'Cancel' },
  save: { zh: '保存', en: 'Save' },
  addOk: { zh: '添加', en: 'Add' },
  nameRequired: { zh: '名称必填', en: 'Name is required' },
  bodyTooLong: { zh: '正文超过 10000 字上限', en: 'Body exceeds 10000 chars' },
  delTitle: { zh: '删除确认', en: 'Confirm delete' },
  delMsg: { zh: '确定删除自定义模板', en: 'Delete custom template' },
  // #141 P2：模板名的括法（zh 全角引号 / en 弯引号）——{name} 是数据词，只有标点是铬
  nameQuote: { zh: '「{name}」', en: '“{name}”' },
  delUnrecover: { zh: '此操作不可撤销。', en: 'This cannot be undone.' },
  delOk: { zh: '删除', en: 'Delete' },
  pinFull: { zh: '置顶已达上限（5 个）', en: 'Pin limit reached (5)' },
  insertHint: { zh: '点击即插入', en: 'Click to insert' },
  // #141：行内用量徽标的 title「已使用 N 次」（zh {n} 在中间，en 在尾部；调用方 .replace('{n}', …)）
  usageTitle: { zh: '已使用 {n} 次', en: 'Used {n} times' },
  // #141：设置页行折叠提示（title 里数据词之后那半截；' · ' 分隔符留在调用方）
  rowExpandHint: { zh: '点击展开/收起简介', en: 'Click to expand or collapse the summary' },
  close: { zh: '关闭', en: 'Close' },
  // #141 P2：全角加号（'＋ 新增' 与裸 '＋'）—— 纯符号，en 下落半角 '+'
  plusGlyph: { zh: '＋', en: '+' },
  smartToggle: { zh: '智能模式悬浮卡（输入匹配时推荐模板；默认关）', en: 'Smart card (recommends templates while typing; off by default)' },
  smartToggleHint: { zh: '默认关；打开后仅在输入匹配时出卡', en: 'Off by default; when on, the card appears on match' },
  smartDot: { zh: '智能模式 · 拖动调整位置；输入匹配时出卡', en: 'Smart mode · drag to move; card appears on match' },
  smartTitle: { zh: '智能推荐', en: 'Smart suggest' },
  smartHint: { zh: '点击即填入', en: 'Click to insert' },
  smartFill: { zh: '点击填入', en: 'Insert' },
  smartDismiss: { zh: '收起（继续输入可再次出现）', en: 'Dismiss (reappears as you type)' },
  smartRecent: { zh: '最近使用', en: 'Recently used' },
  smartCommon: { zh: '常用模板', en: 'Common templates' },
  // #141：智能卡行内后缀（'·常用' 是 0 分兜底行，'·分N' 是评分行）——与上面 smartCommon（命中列文案）语义不同
  smartCommonSuffix: { zh: '·常用', en: '·Common' },
  smartScoreSuffix: { zh: '·分{n}', en: '·Score {n}' },
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
  // 注：原「自定义模板与使用次数保存在 DSH 缓存目录…」那句界面文案已按作者决定删除 —— 它摆在
  // 两张卡片之间像一句游离的声明，而说明的对象就是上面那张模板卡，不再单独占一行。
  // 地图 #45 / #51：配置页的日志开关 + 导出 + 清空三个入口（文案写明「错误与告警始终记录」）
  logToggle: { zh: '调试日志', en: 'Debug log' },
  logToggleHint: { zh: '关闭只停信息与调试两级，错误与告警始终记录。', en: 'Off stops only info and debug; errors and warnings are always recorded.' },
  logGroup: { zh: '诊断日志', en: 'Diagnostics' },
  logWhere: { zh: '落点：~/.dsh/logs/dsh-prompt/', en: 'Location: ~/.dsh/logs/dsh-prompt/' },
  smartGroup: { zh: '智能推荐', en: 'Smart suggestions' },
  // #82 远程模式段（规格 #85 US6/US7/US8/US18/US19/US24/US25）：总闸 + 字号/控件三档 + 宿主缺席明示。
  // 栏头不设切换（#85 US10），进出只走这里；总闸默认关。
  remoteGroup: { zh: '远程模式-配合网易UU远程等手机App', en: 'Remote mode' },
  remoteToggle: { zh: '远程模式-配合网易UU远程等手机App', en: 'Remote mode' },
  remoteSize: { zh: '大小', en: 'Size' },
  remoteSizeMin: { zh: '1档', en: '1' },
  remoteSizeMax: { zh: '10档', en: '10' },
  // #141：滑块值 pill「N档·P%」（与 remoteSizeMin/Max 同口径：en 不带「档」）
  remoteSizeValue: { zh: '{n}档·{p}%', en: '{n} · {p}%' },
  remotePersistFail: { zh: '持久化失败：本次选择当次有效，下次恢复默认并请重试。', en: 'Persist failed: this choice works for now, defaults return next time — please retry.' },
  remoteOrientation: { zh: '方向偏好', en: 'Orientation' },
  remoteOrientationHint: { zh: '自动跟整机方向，无桥时跟视口；锁定先切整机方向，失败只锁自家布局。', en: 'Auto follows the system display, falling back to viewport without a bridge; a lock tries the system display first, falling back to our own layout.' },
  remoteOrientationAuto: { zh: '自动', en: 'Auto' },
  remoteOrientationLandscape: { zh: '横屏', en: 'Landscape' },
  remoteOrientationPortrait: { zh: '竖屏', en: 'Portrait' },
  remoteOrientationBusy: { zh: '正在切换整机方向…', en: 'Switching system orientation…' },
  remoteOrientationOsFail: { zh: '整机未改变，已锁定自家布局（原因：{code}）。', en: 'System display unchanged; own layout locked (reason: {code}).' },
  remoteNeedOn: { zh: '需先开启远程模式', en: 'Turn on remote mode first' },
  remoteEffectiveNow: { zh: '当前：{orient}（{source}）', en: 'Now: {orient} ({source})' },
  remoteSourceSystem: { zh: '整机', en: 'system display' },
  remoteSourceViewport: { zh: '视口', en: 'viewport' },
  remoteLockedOrientation: { zh: '锁定为{orient}', en: 'Locked to {orient}' },
  remoteDensity: { zh: '宫格密度', en: 'Grid density' },
  remoteDensityA: { zh: '12宫格', en: '12' },
  remoteDensityB: { zh: '8宫格', en: '8 large' },
  remoteHostPending: { zh: '整机待宿主', en: 'Waiting on host' },
  remoteSystemOrientation: { zh: '整机跟手转（需宿主 H1）', en: 'Rotate whole system (needs host H1)' },
  remoteSystemOrientationHint: { zh: '宿主支持时一键切外部系统横竖屏；缺席只灰这一行，总闸照常可用。', en: 'One tap rotates the outside system when the host supports it; when absent only this row is greyed and the master switch still works.' },
  remoteSystemFont: { zh: '整机字号跟随（需宿主 H2）', en: 'System font follow (needs host H2)' },
  remoteSystemFontHint: { zh: '宿主支持时整机字号一起走；缺席先放大自家面并明示。', en: 'The whole system follows when the host supports it; when absent our own surface still enlarges.' },
  remoteConfigKey: { zh: '远程设置', en: 'Remote settings' },
  remoteConfigKeyFallbackHint: { zh: '打开设置页远程段', en: 'Opens the settings remote section' },
  // #94：齿轮右侧侧栏折叠键的两态可访问名（展开/折叠 DSH 右侧边栏）
  sidebarExpand: { zh: '展开右侧边栏', en: 'Expand right sidebar' },
  sidebarCollapse: { zh: '折叠右侧边栏', en: 'Collapse right sidebar' },
  // #95：远程 Dock 收展键可访问名
  dockCollapse: { zh: '收起工具条', en: 'Collapse toolbar' },
  dockExpand: { zh: '展开工具条', en: 'Expand toolbar' },
  // #104：左工作区折叠键（休眠契约）+ 全屏挑选器入口键（异步双门控）
  workspaceLeftExpand: { zh: '展开左侧工作区', en: 'Expand left workspace' },
  workspaceLeftCollapse: { zh: '折叠左侧工作区', en: 'Collapse left workspace' },
  workspacePicker: { zh: '选择会话', en: 'Pick session' },
  pickerSearch: { zh: '搜索：标题 + 工作区名…', en: 'Search: title + workspace…' },
  pickerLoading: { zh: '加载中…', en: 'Loading…' },
  pickerCancel: { zh: '取消等待', en: 'Cancel' },
  pickerRetry: { zh: '整面重试', en: 'Retry' },
  pickerEmpty: { zh: '真无会话：当前没有任何可用会话', en: 'No sessions available' },
  pickerEmptySearch: { zh: '搜无结果：换个关键词（不回退全量）', en: 'No matches — try another keyword' },
  pickerProbeFail: { zh: '探测缺席：宿主机会面不可用，原地重试', en: 'Host surface unavailable — retry here' },
  pickerSwitchFail: { zh: '切换失败：留屏，可原地重试', en: 'Switch failed — retry here' },
  pickerSwitchFailBadge: { zh: '切换失败', en: 'Failed' },
  pickerSwitching: { zh: '正在切换', en: 'Switching' },
  pickerCurrent: { zh: '当前', en: 'Current' },
  pickerBlank: { zh: '空白', en: 'Blank' },
  pickerUntitled: { zh: '（空白会话）', en: '(Blank session)' },
  pickerUngrouped: { zh: '未归属', en: 'Ungrouped' },
  pickerUnassignedShort: { zh: '散', en: 'misc' },
  pickerWorkspaces: { zh: '工作区', en: 'Workspaces' },
  pickerSessions: { zh: '会话', en: 'Sessions' },
  pickerPrev: { zh: '上一页', en: 'Previous' },
  pickerNext: { zh: '下一页', en: 'Next' },
  pickerOpBar: { zh: '翻页与关闭', en: 'Paging and close' },
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
  // #141 P2：导出回执里字节数的括法（zh 全角括号 / en 半角括号）
  bytesParen: { zh: '（{v}）', en: '({v})' },
  logFiles: { zh: '个文件', en: 'file(s)' },
  logReasonHost: { zh: '宿主不可达', en: 'host unreachable' },
  logReasonRejected: { zh: '宿主拒绝写入', en: 'host rejected the write' },
  logReasonTimeout: { zh: '宿主超时未应答', en: 'host timed out' },
  logReasonStale: { zh: '已有更新的开关操作，本次作废', en: 'a newer switch action superseded this one' },
  logReasonOther: { zh: '未知原因', en: 'unknown reason' },
  // #123 遥控输入镜 + 模型休眠（承 121/122 定稿；双层文案 b主+a次，恒disabled）
  remoteInputKey: { zh: '遥控输入（实时镜子）', en: 'Remote input (live mirror)' },
  remoteInputTitle: { zh: '✎ 遥控输入', en: '✎ Remote input' },
  remoteInputSub: { zh: '实时镜子 · 自动同步当前会话草稿', en: 'Live mirror · auto-syncs current draft' },
  remoteInputPh: { zh: '在此输入…自动同步到当前会话输入框（去抖串行 setDraft）', en: 'Type here… auto-syncs to current input (debounced serial setDraft)' },
  remoteInputSend: { zh: '➤ 发送（禁用）', en: '➤ Send (disabled)' },
  remoteInputSendTitle: { zh: '宿主未给提交面', en: 'No host submit surface' },
  remoteInputExplicitMain: { zh: '草稿已同步，去大屏那头发起发送', en: 'Draft synced — send from the big screen' },
  remoteInputExplicitSub: { zh: '宿主未提供提交面，此键恒禁用、绝不伪造回车。', en: 'No host submit surface; this key stays disabled, never fakes Enter.' },
  remoteInputStale: { zh: '会话已切换，本框已停写（防串写），请重开。', en: 'Session switched; writes paused to avoid cross-talk. Reopen.' },
  remoteInputMeta: { zh: '实时镜子 · 去抖300ms串行 · session校验 · 组词中延迟', en: 'Live mirror · 300ms debounced serial · session check · IME deferred' },
  remoteInputChars: { zh: '{n}字', en: '{n} chars' },
  remoteModelKey: { zh: '模型切换（休眠中）', en: 'Model switch (dormant)' },
  remoteModelTitle: { zh: '▤ 模型切换', en: '▤ Model switch' },
  remoteModelEmpty: { zh: '宿主暂无模型面（首次出现会提示一次）', en: 'No host model surface yet (first appearance shows once)' },
}
