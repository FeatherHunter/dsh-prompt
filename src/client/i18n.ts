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
}
