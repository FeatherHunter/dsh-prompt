// 回归测试 #145：预置标签英文显示（身份-显示分离落地到「预制词」这一层）
// 背景：English 环境下范围钮已翻（#141），但预制模板的派生标签（思考框架/执行前/拆解…）仍显示中文。
// 修法：keys.ts 新增 PRESET_WORD_EN 词表 + displayWord/displayLabels/dispalyLabelString 走显示映射；
//       云行动词与标签选择格显示英译，**身份仍是中文原文**（点选即 matchLabel(中文)）。
// 边界：用户词永不翻；回落词仍按 #142；存储/比较/评分/落盘一律不动。
// 断言组：
//  A) displayWord 纯函数：预制词 en 翻 / zh 不翻；用户词与表外词原样
//  B) 覆盖完备：全部预制派生词都在词表里（漏登记在此红）；词表 23 词；en 译词零 CJK
//  C) 逻辑位不动：templateLabels/labelString/matchLabel 仍中文身份；显示串才跟语言
//  D) 用户词与回落词：en 下用户词原样、回落词仍跟随语言（#142 不回归）
//  E) 渲染 en：云行与行内胶囊显示英文，点英译按钮仍按中文身份过滤（结果集与 zh 一致）
//  F) 渲染 zh：云行与行内胶囊仍是中文（零回归）
const fs = require('node:fs');
const path = require('node:path');
const { buildFlat } = require('./lib/transpile-client.cjs');
const DIR = path.join(__dirname, '.rt-tmp-145');
const ROOT = path.join(__dirname, '..');
const SRC = (n) => path.join(ROOT, 'src', 'client', n);

let failures = 0;
function fail(msg) { failures++; console.log('FAIL: ' + msg); }
function ok(msg) { console.log(' ok: ' + msg); }
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) fail(msg + ' —— 实际 ' + a + '，期望 ' + e); else ok(msg);
}
const CJK = /[\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;

// ── DOM 桩（与 #137/#141 同口径：只读 html[lang]，不写）──
function mkEl(tag) {
  return {
    tagName: String(tag).toUpperCase(), style: {}, children: [], dataset: {}, attributes: {},
    setAttribute(k, v) { this.attributes[k] = v; }, getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; },
    appendChild(c) { this.children.push(c); return c; }, removeChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {}, removeAttribute() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
  };
}
let docEl = null;
function installDom(lang) {
  docEl = Object.assign(mkEl('html'), { lang });
  globalThis.document = {
    documentElement: docEl, head: mkEl('head'), body: mkEl('body'), activeElement: null,
    createElement: mkEl, createTextNode: (t) => ({ text: t }),
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
    addEventListener() {}, removeEventListener() {},
  };
  globalThis.window = { innerWidth: 1280, innerHeight: 800, addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout };
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.MutationObserver = class { constructor() {} observe() {} disconnect() {} takeRecords() { return []; } };
}
installDom('zh-CN');
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) });

buildFlat(DIR, [SRC('panel.ts')]);
const req = (n) => require(path.join(DIR, n + '.cjs'));
const keys = req('keys');
const i18n = req('i18n');
const store = req('store');
const templates = req('templates');
const panelMod = req('panel');
const React = require('react');
const TR = require('react-test-renderer');

// ═══ A) displayWord 纯函数 ═══
eq(keys.displayWord('拆解', 'en'), 'Decompose', '预制词 en → 英译');
eq(keys.displayWord('思考框架', 'en'), 'Thinking', '领域词 en → 英译');
eq(keys.displayWord('拆解', 'zh'), '拆解', '预制词 zh → 原文（不翻）');
eq(keys.displayWord('观星', 'en'), '观星', '用户词 en → 原样（永不翻）');
eq(keys.displayWord('Whatever', 'en'), 'Whatever', '表外词 en → 原样');
eq(keys.isPresetWord('拆解'), true, 'isPresetWord：预制词');
eq(keys.isPresetWord('观星'), false, 'isPresetWord：用户词不是预制词');

// ═══ B) 覆盖完备 ═══
{
  const missing = new Set();
  for (const t of templates.PRESET_TEMPLATES) {
    for (const w of [t.domain, t.stage, ...(t.action || []), ...(t.labels || [])]) {
      if (typeof w === 'string' && w && !keys.isPresetWord(w)) missing.add(w);
    }
  }
  eq([...missing], [], '全部预制派生词都在词表内（漏登记＝en 下仍显示中文，这里红）');
  eq(Object.keys(keys.PRESET_WORD_EN).length, 23, '词表 23 词（4 领域 + 3 阶段 + 16 行动词）');
  eq(Object.keys(keys.PRESET_WORD_EN).filter((k) => CJK.test(keys.PRESET_WORD_EN[k])), [], 'en 译词零 CJK');
}

// ═══ C) 逻辑位不动（身份仍中文）═══
const fp = templates.PRESET_TEMPLATES.find((t) => t.id === 'fp');
eq(store.templateLabels(fp), ['思考框架', '执行前', '拆解'], 'templateLabels 仍是中文身份（存储/比较用）');
eq(store.labelString(fp), '思考框架/执行前/拆解', 'labelString 仍是中文身份');
eq(store.matchLabel(fp, '拆解'), true, 'matchLabel 用中文身份命中');
eq(keys.displayLabelString(fp, 'en'), 'Thinking/Before/Decompose', 'en 显示串走英译');
eq(keys.displayLabelString(fp, 'zh'), '思考框架/执行前/拆解', 'zh 显示串保持中文');

// ═══ D) 用户词与回落词 ═══
const custom = store.addCustom('观星笔记', ['观星'], '正文首行');
eq(keys.displayLabelString(custom, 'en'), '观星', '自定义模板的用户词 en 下原样');
const noLabel = store.addCustom('无标签模板', [], '正文首行');
eq(keys.displayLabelString(noLabel, 'en'), i18n.STR.labelFallback.en, '回落词仍跟随语言（#142 不回归）');
eq(keys.displayLabelString(noLabel, 'zh'), i18n.STR.labelFallback.zh, '回落词 zh 仍是中文');

// ═══ 渲染辅助 ═══
function mountSettings(lang) {
  installDom(lang);
  let tree;
  TR.act(() => { tree = TR.create(React.createElement(panelMod.TemplateBrowser, { compact: false, collapsible: true })); });
  const toggle = tree.root.findAll((n) => n.props && n.props['data-dsh-prompt-templates-toggle'] !== undefined)[0];
  if (toggle) TR.act(() => { toggle.props.onClick(); });
  return tree;
}
const cloudTexts = (tree) => tree.root
  .findAll((n) => n.type === 'button' && n.props && n.props.style && n.props.style.borderRadius === 999 && n.props.style.fontSize === '0.85em')
  .map((n) => (n.children || []).filter((c) => typeof c === 'string').join(''));
const rowIds = (tree) => tree.root.findAll((n) => n.props && n.props['data-dsh-prompt-id']).map((n) => n.props['data-dsh-prompt-id']);
const chipOf = (tree, id) => {
  const row = tree.root.findAll((n) => n.props && n.props['data-dsh-prompt-id'] === id)[0];
  if (!row) return null;
  const chip = row.findAll((n) => n.type === 'span' && n.props && n.props.style && n.props.style.fontSize === '0.7em')[0];
  return chip ? (chip.children || []).filter((c) => typeof c === 'string').join('') : null;
};

// ═══ E) 渲染 en ═══
{
  const tree = mountSettings('en');
  const cloud = cloudTexts(tree);
  if (cloud.indexOf('Decompose') < 0) fail('en 云行应出现英译行动词 Decompose，实际 ' + JSON.stringify(cloud.slice(0, 8)));
  if (cloud.indexOf('拆解') >= 0) fail('en 云行不应再出现中文行动词 拆解');
  if (cloud.indexOf('All') < 0 || cloud.indexOf('Preset') < 0 || cloud.indexOf('Custom') < 0) fail('en 范围三钮应为 All/Preset/Custom，实际 ' + JSON.stringify(cloud.slice(0, 3)));
  if (failures === 0) ok('en 云行：行动词英译到场、范围三钮 All/Preset/Custom、无中文行动词');
  eq(chipOf(tree, 'fp'), 'Thinking/Before/Decompose', 'en 行内胶囊显示英译串');
  eq(chipOf(tree, noLabel.id), i18n.STR.labelFallback.en, 'en 行内胶囊：空标签回落词显示 Custom');
  eq(chipOf(tree, custom.id), '观星', 'en 行内胶囊：用户词原样');

  // 点英译按钮 → 仍按中文身份过滤（结果集与 zh 侧一致：仅命中 拆解 的两条预制）
  const btn = tree.root.findAll((n) => n.type === 'button' && (n.children || []).filter((c) => typeof c === 'string').join('') === 'Decompose')[0];
  if (!btn) fail('en 云行应能找到 Decompose 按钮');
  else {
    TR.act(() => { btn.props.onClick(); });
    const ids = rowIds(tree);
    eq(ids.sort(), ['fp', 'mece'], 'en 点 Decompose 过滤结果 = 中文身份「拆解」命中的两条预制');
  }
}

// ═══ F) 渲染 zh（零回归）═══
{
  const tree = mountSettings('zh-CN');
  const cloud = cloudTexts(tree);
  if (cloud.indexOf('拆解') < 0) fail('zh 云行应仍是中文行动词 拆解，实际 ' + JSON.stringify(cloud.slice(0, 8)));
  if (cloud.indexOf('Decompose') >= 0) fail('zh 云行不应出现英译 Decompose');
  eq(chipOf(tree, 'fp'), '思考框架/执行前/拆解', 'zh 行内胶囊仍是中文身份串');
  if (failures === 0) ok('zh 渲染：云行与胶囊保持中文，零回归');
}

if (failures > 0) { console.log('\nRESULT: FAIL (' + failures + ')'); process.exit(1); }
console.log('\nRESULT: PASS');
