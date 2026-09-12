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
  logToggle: { zh: '调试日志（默认关）', en: 'Debug log (off by default)' },
  logToggleHint: { zh: '关只停信息与调试两级，错误与告警始终记录。开关以宿主为准，刷新后仍读宿主那份；日志落在 <DSH 家目录>/logs/dsh-prompt/。', en: 'Off stops only info and debug; errors and warnings are always recorded. The host is authoritative and the value survives a refresh; logs land in <DSH home>/logs/dsh-prompt/.' },
  logExport: { zh: '导出日志', en: 'Export log' },
  logCopy: { zh: '复制正文', en: 'Copy text' },
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
  logCopied: { zh: '日志正文已复制到剪贴板', en: 'Log text copied to clipboard' },
  logCopyFail: { zh: '复制失败，请改用「导出日志」。', en: 'Copy failed — use "Export log" instead.' },
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
}
