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
  panelTitle: { zh: 'Prompt 调色板', en: 'Prompt Palette' },
  entryBtn: { zh: 'Prompt', en: 'Prompt' },
  add: { zh: '新增自定义模板', en: 'Add custom template' },
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
  tagPh: { zh: '标签', en: 'Tag' },
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
}
