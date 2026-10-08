// 回归测试 #141：铬切换（映射 + 钩子 + normalizeKey）—— 身份-显示分离落地
// 规格：#134 地图 v3 定稿（含第二轮对抗结论）+ #141 票面 + research/i18n-audit/classification.md §3-§6。
// 口径（seam 级，不断实现细节）：
//  A) normalizeKey：范围别名（All/all/全部/预置/预制/Preset/自定义/Custom）+ 前后空白 + 全角空格 → 规范身份；
//     空/垃圾 → null；用户词 trim+大小写归一后原样保留（不拒绝建词）
//  B) LegacyChineseStorageAdapter：读侧存量中文值 → 规范身份；写侧原样（adapter 只读不迁，用户数据永不改写）
//  C) 砍保留词拒绝：LABEL_RESERVED / STR.labelReserved 已删，'任意' 是普通用户词
//  D) 过滤语义逐字不动：zh 下范围（全部/预制/自定义）与标签云过滤与改前等价（固定夹具）；
//     '全部'/'预置' 这类**合法用户词**不得被归一成范围身份而连坐出局
//  E) 铬全切 tr：范围钮/远程翻页/已使用 N 次/档·%/·常用/·分N/字数/术语「预制」
//  F) data 钩子：data-dsh-prompt-chrome="<STR key>"（文本位与 title/aria-label/placeholder）
//     + 三钮 data-dsh-prompt-scope="all|preset|custom"
//  G) en 渲染：钩子节点的铬文本与 title/aria-label/placeholder 无 CJK（剔除数据词后）；zh 渲染文案正确
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const SRC = (f) => path.join(ROOT, 'src', 'client', f);
const DIR = path.join(__dirname, '.rt-tmp-141');
const { buildFlat, stripComments } = require('./lib/transpile-client.cjs');

let failures = 0;
function fail(msg) { failures++; console.log('FAIL: ' + msg); }
function ok(msg) { console.log(' ok: ' + msg); }
function eq(actual, want, msg) {
  if (actual !== want) fail(msg + ' → 实际 ' + JSON.stringify(actual) + '，期望 ' + JSON.stringify(want));
}

// ── DOM 桩（与 #137 同口径：只读 html[lang]，不写）──
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
const domTextareas = [];
function installDom(lang) {
  domTextareas.length = 0;
  docEl = Object.assign(mkEl('html'), { lang });
  globalThis.document = {
    documentElement: docEl, head: mkEl('head'), body: mkEl('body'), activeElement: null,
    createElement: mkEl, createTextNode: (t) => ({ text: t }),
    querySelector: () => null, querySelectorAll: (sel) => (sel === 'textarea' ? domTextareas : []), getElementById: () => null,
    addEventListener() {}, removeEventListener() {},
  };
  globalThis.window = { innerWidth: 1280, innerHeight: 800, addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout };
  // 智能卡开关走 localStorage（同 #137 口径：已显式打开）
  globalThis.localStorage = { getItem: (k) => (String(k).startsWith('dsh.prompt.smart') ? '1' : null), setItem() {}, removeItem() {} };
  globalThis.MutationObserver = class { constructor() {} observe() {} disconnect() {} takeRecords() { return []; } };
}
installDom('zh-CN');

// 宿主写桥一律成功（同 #137 口径）：不桩则 ensureRemoteLoaded 走相对 URL 失败，远程面不渲染。
/** host 写桥桩：store 快照跟随**当前**远程偏好（否则快照把总闸翻回开，compact 面永远走大列表） */
function installFetch() {
  globalThis.fetch = async (url) => ({
    ok: true, status: 200,
    json: async () => (/\/store$/.test(String(url))
      ? { ok: true, value: { remote: Object.assign({}, remoteMod.getRemotePrefs()) } }
      : { ok: true }),
  });
}
installFetch();

buildFlat(DIR, [SRC('keys.ts'), SRC('i18n.ts'), SRC('store.ts'), SRC('panel.ts'), SRC('settings.ts'), SRC('smart.ts'), SRC('remote.ts'), SRC('smartstore.ts'), SRC('remoteInputSheet.ts')]);
const req = (n) => require(path.join(DIR, n + '.cjs'));
const keys = req('keys');
const i18n = req('i18n');
const store = req('store');
const panel = req('panel');
const settingsMod = req('settings');
const smartMod = req('smart');
const remoteMod = req('remote');
const smartstore = req('smartstore');
const sheetMod = req('remoteInputSheet');
const STR = i18n.STR;
const adapter = keys.LegacyChineseStorageAdapter;
const React = require('react');
const TR = require('react-test-renderer');

// ═══ A) normalizeKey：别名 / 空白 / 垃圾 / 用户词 ═══
{
  eq(keys.normalizeKey('all'), 'all', 'all 原样→all');
  eq(keys.normalizeKey('All'), 'all', 'All→all（大小写不敏感）');
  eq(keys.normalizeKey('  ALL  '), 'all', '前后空白吸收');
  eq(keys.normalizeKey('\u3000全部\u3000'), 'all', '全角空格吸收 + 全部→all');
  eq(keys.normalizeKey('预置'), 'preset', '预置→preset');
  eq(keys.normalizeKey('预制'), 'preset', '预制→preset（术语统一后同一身份）');
  eq(keys.normalizeKey('Preset'), 'preset', 'Preset→preset');
  eq(keys.normalizeKey('自定义'), 'custom', '自定义→custom');
  eq(keys.normalizeKey('Custom'), 'custom', 'Custom→custom');
  eq(keys.normalizeKey('复盘'), '复盘', '用户词原样保留（身份即原文）');
  eq(keys.normalizeKey(' \u3000观星 '), '观星', '用户词：trim + 全角空格吸收');
  eq(keys.normalizeKey('MyWord'), 'myword', '用户词：大小写归一');
  eq(keys.normalizeKey(''), null, '空串→null');
  eq(keys.normalizeKey('   '), null, '空白串→null');
  eq(keys.normalizeKey('\u3000'), null, '全角空格串→null');
  eq(keys.normalizeKey(null), null, 'null→null');
  eq(keys.normalizeKey(undefined), null, 'undefined→null');
  eq(keys.normalizeKey(42), null, '数字→null');
  eq(keys.normalizeKey({}), null, '对象→null');
  eq(keys.normalizeKey(['all']), null, '数组→null（不猜）');
  eq(keys.normalizeScopeKey('全部'), 'all', 'normalizeScopeKey：全部→all');
  eq(keys.normalizeScopeKey('预制'), 'preset', 'normalizeScopeKey：预制→preset');
  eq(keys.normalizeScopeKey('复盘'), null, 'normalizeScopeKey：用户词不是范围身份');
  eq(keys.normalizeScopeKey(''), null, 'normalizeScopeKey：空→null');
  eq(keys.isScopeKey('custom'), true, 'isScopeKey：custom');
  eq(keys.isScopeKey('custom!'), false, 'isScopeKey：非身份');
  eq(keys.SCOPE_KEYS.join('/'), 'all/preset/custom', 'SCOPE_KEYS 三态具名');
  if (failures === 0) ok('A) normalizeKey / normalizeScopeKey：别名 + 空白 + 垃圾 + 用户词');
}

// ═══ B) LegacyChineseStorageAdapter：读侧归一、写侧原样 ═══
{
  eq(adapter.toCanonical(store.LABEL_FALLBACK), 'custom', '读侧：store 回落词 ' + store.LABEL_FALLBACK + ' → custom');
  eq(adapter.toCanonical('预置'), 'preset', '读侧：存量中文 预置 → preset');
  eq(adapter.toCanonical('全部'), 'all', '读侧：存量中文 全部 → all');
  eq(adapter.toCanonical('复盘'), '复盘', '读侧：数据词身份即原文（不被翻译/改写）');
  eq(adapter.toCanonical(''), null, '读侧：空→null');
  eq(adapter.toStorage('custom'), 'custom', '写侧：原样返回（adapter 不做迁移写）');
  eq(adapter.toStorage('自定义'), '自定义', '写侧：中文原值原样（用户数据永不改写）');
  eq(adapter.toStorage('复盘'), '复盘', '写侧：数据词原样');
  if (failures === 0) ok('B) LegacyChineseStorageAdapter：读侧映射身份、写侧原样（只读不迁）');
}

// ═══ C) 砍保留词拒绝：'任意' 是普通用户词 ═══
{
  eq(Object.prototype.hasOwnProperty.call(store, 'LABEL_RESERVED'), false, 'store 不再导出 LABEL_RESERVED');
  eq(Object.prototype.hasOwnProperty.call(STR, 'labelReserved'), false, 'STR.labelReserved 已删（en 唯一含 CJK 条目）');
  const r = store.validateLabels(['任意']);
  eq(r.ok, true, "validateLabels(['任意']) 通过（不拒绝建词）");
  eq(JSON.stringify(r.labels), '["任意"]', "'任意' 原样落成标签");
  const r2 = store.validateLabels(['任意', '复盘']);
  eq(r2.ok, true, "'任意' 与别的词共存");
  // 数据链路：'任意' 正常参与标签串/命中/检索
  const t = store.addCustom('任意模板', ['任意'], '正文');
  eq(store.matchLabel(store.getTemplate(t.id), '任意'), true, "'任意' 正常参与 matchLabel");
  eq(store.labelString(store.getTemplate(t.id)), '任意', "'任意' 正常参与 labelString");
  try { store.removeCustom(t.id); } catch (e) {}
  if (failures === 0) ok("C) 保留词拒绝已砍：'任意' 是普通用户词（无 LABEL_RESERVED/labelReserved）");
}

// ═══ D) 过滤语义逐字不动（固定夹具：范围 + 云，zh）═══
{
  // 夹具：3 个边界自定义 —— 词面恰好是范围别名/保留词旧值/回落词，验「数据词不归一、不连坐」
  const cAll = store.addCustom('边界全部', ['全部'], 'b');
  const cPreset = store.addCustom('边界预置', ['预置'], 'b');
  const cAny = store.addCustom('边界任意', ['任意'], 'b');
  const cFallback = store.addCustom('边界空标签', [], 'b');
  const dataWords = store.allTemplates().map((t) => t.name + '|' + store.labelString(t)).join(' ; ');

  const scopeHook = (tree, s) => tree.root.findAll((n) => n.type === 'button' && n.props && n.props['data-dsh-prompt-scope'] === s)[0];
  const cloudTexts = (tree) => tree.root.findAll((n) => n.type === 'button' && n.props && n.props['data-dsh-prompt-scope'] === undefined).map((n) => (n.children || []).filter((c) => typeof c === 'string').join(''));
  const rowIds = (tree) => tree.root.findAll((n) => n.props && n.props['data-dsh-prompt-id'], { deep: true }).map((n) => n.props['data-dsh-prompt-id']).sort();
  const ids = (l) => l.map((t) => t.id).sort();

  let tree;
  TR.act(() => { tree = TR.create(React.createElement(panel.TemplateBrowser, { compact: false })); });

  // 云：范围三钮有钩子；数据词不归一 —— '全部'/'预置'/'任意' 进云，回落词 '自定义'/领域词不进
  const cloud = cloudTexts(tree);
  eq(cloud.indexOf('全部') >= 0, true, "云含数据词 '全部'（合法用户词，不因归一被去）");
  eq(cloud.indexOf('预置') >= 0, true, "云含数据词 '预置'（合法用户词，不因归一被去）");
  eq(cloud.indexOf('任意') >= 0, true, "云含 '任意'（保留词拒绝已砍）");
  eq(cloud.indexOf('自定义') >= 0, false, "云去留：回落词 '自定义' 不进云（逐字不动）");
  eq(cloud.indexOf('思考框架') >= 0, false, '云去留：领域词不进云');
  eq(cloud.indexOf('执行前') >= 0, false, '云去留：阶段词不进云');
  eq(cloud.indexOf('all') >= 0, false, "云去留：哨兵 'all' 不进云");

  // 过滤等价：全部 = 不过滤
  eq(JSON.stringify(rowIds(tree)), JSON.stringify(ids(store.allTemplates())), '范围「全部」= 不过滤（全部模板）');
  // 范围「预制」= 仅内置
  TR.act(() => { scopeHook(tree, 'preset').props.onClick(); });
  TR.act(() => {});
  eq(JSON.stringify(rowIds(tree)), JSON.stringify(ids(store.allTemplates().filter((t) => t.builtin))), '范围「预制」= 仅内置集');
  // 范围「自定义」= 仅自建（含 4 条夹具）
  TR.act(() => { scopeHook(tree, 'custom').props.onClick(); });
  TR.act(() => {});
  eq(JSON.stringify(rowIds(tree)), JSON.stringify(ids(store.allTemplates().filter((t) => !t.builtin))), '范围「自定义」= 仅自建集');
  // 再点已选项回「全部」
  TR.act(() => { scopeHook(tree, 'custom').props.onClick(); });
  TR.act(() => {});
  eq(rowIds(tree).length, store.allTemplates().length, '范围钮 toggle：再点回全部');
  // 数据词 '全部' 当**行动词**用：== matchLabel 集（只有夹具那一条），不得变成「不过滤」
  // 行动词按钮 = 文本命中且**不带**范围钩子的那个（范围钮文本与词面可以同名，如 '全部'）
  const wordBtn = (s) => tree.root.findAll((n) => n.type === 'button' && n.props && n.props['data-dsh-prompt-scope'] === undefined && (n.children || []).filter((c) => typeof c === 'string').join('') === s)[0];
  TR.act(() => { wordBtn('全部').props.onClick(); });
  TR.act(() => {});
  eq(JSON.stringify(rowIds(tree)), JSON.stringify([cAll.id]), "行动词 '全部' == matchLabel 集（不归一成范围 all）");
  TR.act(() => { wordBtn('全部').props.onClick(); });
  TR.act(() => {});
  eq(rowIds(tree).length, store.allTemplates().length, "行动词 '全部' toggle 回全部");
  // 数据词 '预置' 同理
  TR.act(() => { wordBtn('预置').props.onClick(); });
  TR.act(() => {});
  eq(JSON.stringify(rowIds(tree)), JSON.stringify([cPreset.id]), "行动词 '预置' == matchLabel 集（不被当成范围 preset）");
  TR.act(() => { wordBtn('预置').props.onClick(); });
  TR.act(() => {});
  // '任意' 当行动词
  TR.act(() => { wordBtn('任意').props.onClick(); });
  TR.act(() => {});
  eq(JSON.stringify(rowIds(tree)), JSON.stringify([cAny.id]), "行动词 '任意' == matchLabel 集");
  TR.act(() => { wordBtn('任意').props.onClick(); });
  TR.act(() => {});
  // 空标签回落词落在数据里（'自定义'），但不进云（上面已断言），搜索可达
  eq(JSON.stringify(store.templateLabels(store.getTemplate(cFallback.id))), '["自定义"]', '空标签回落「自定义」（存量数据身份不动）');
  try { tree.unmount(); } catch (e) {}
  [cAll, cPreset, cAny, cFallback].forEach((t) => store.removeCustom(t.id));
  eq(store.allTemplates().length, 24, '夹具清理干净（回到 24 条预制）');
  eq(dataWords.length > 0, true, '夹具数据词表非空（供 G 段剔除用）');
  if (failures === 0) ok('D) 过滤语义逐字不动：范围三态 + 云去留（数据词不归一、不连坐）');
}

// ═══ E) 铬钩子先定死：键名即 STR key，值即身份；三钮另带 scope ═══
const CJK = /[\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;
const HOOK_FILES = ['panel.ts', 'settings.ts', 'smart.ts', 'remoteInputSheet.ts'];
const EXPECT_HOOKS = [
  'tabAll', 'scopePreset', 'tabCustom', 'pickerPrev', 'pickerNext', 'usageTitle',
  'rowExpandHint', 'insertHint', 'remoteSizeValue', 'smartCommonSuffix', 'smartScoreSuffix',
  'remoteInputChars', 'nameQuote', 'plusGlyph',
];
{
  const seen = new Map();
  for (const f of HOOK_FILES) {
    const code = fs.readFileSync(SRC(f), 'utf8');
    const re = /['"]data-dsh-prompt-chrome['"]\s*:\s*'([A-Za-z0-9_]+)'/g;
    let m;
    while ((m = re.exec(code))) {
      const arr = seen.get(m[1]) || [];
      arr.push(f);
      seen.set(m[1], arr);
    }
  }
  for (const k of EXPECT_HOOKS) {
    if (seen.has(k)) continue;
    // 智能卡后缀的键是变量（common ? A : B），按源码引用判
    const dyn = (k === 'smartCommonSuffix' || k === 'smartScoreSuffix') &&
      new RegExp("'" + k + "'").test(fs.readFileSync(SRC('smart.ts'), 'utf8'));
    if (!dyn) fail('铬钩子缺 ' + k);
  }
  for (const k of seen.keys()) {
    if (!Object.prototype.hasOwnProperty.call(STR, k)) fail('钩子值 ' + k + ' 不是 STR key');
  }
  // 字典二级断言（审计 §5）：en 值不得含 CJK（zh 值含 CJK，例外只有品牌词 Prompt）
  const enCJK = Object.keys(STR).filter((k) => CJK.test(STR[k].en));
  eq(JSON.stringify(enCJK), '[]', 'STR 全字典 en 值零 CJK');
  const zhPlain = Object.keys(STR).filter((k) => !CJK.test(STR[k].zh));
  eq(zhPlain.sort().join('/'), 'entryBtn/panelTitle', 'STR zh 值不含 CJK 的只有品牌词 panelTitle/entryBtn');
  if (failures === 0) ok('E) 铬钩子：' + EXPECT_HOOKS.length + ' 个键齐、均为 STR key、en 零 CJK');
}

// ═══ F) 三钮 scope 钩子 + 渲染面收集器 ═══
/** 收集渲染树里全部铬钩子节点：{key, kind, text, attrs} */
function chromeNodes(inst) {
  const out = [];
  const walk = (n) => {
    if (!n) return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.props && n.props['data-dsh-prompt-chrome'] !== undefined) {
      const text = (function pick(node) {
        if (node == null) return '';
        if (typeof node === 'string') return node;
        if (Array.isArray(node)) return node.map(pick).join('');
        if (node.children) return node.children.map(pick).join('');
        return '';
      })(n.children);
      out.push({ key: n.props['data-dsh-prompt-chrome'], kind: n.props['data-dsh-prompt-chrome-kind'] || '', text: text, title: n.props.title, aria: n.props['aria-label'], ph: n.props.placeholder });
    }
    if (n.children) n.children.forEach(walk);
  };
  walk(inst.toJSON());
  return out;
}
const dataWords = (() => {
  const s = new Set();
  for (const t of store.allTemplates()) {
    s.add(t.name);
    for (const l of store.templateLabels(t)) s.add(l);
  }
  return [...s].sort((a, b) => b.length - a.length);
})();
/** 铬钩子位置剔除数据词后仍剩的文本（题面：钩子节点无 CJK —— 数据词是用户内容，不算铬） */
const chromeOnly = (s) => {
  let v = String(s == null ? '' : s);
  for (const w of dataWords) if (w && v.indexOf(w) >= 0) v = v.split(w).join('');
  return v;
};
/** 钩子位置：带 kind 的是属性位（只查那几个属性）；不带的是文本位（只查节点文本）。
 *  行这一类节点的子树文本含名称/正文（数据词），属性位不能混进来判。 */
const hookAttrs = (n) => {
  if (!n.kind) return typeof n.text === 'string' && n.text.length > 0 ? [n.text] : [];
  return n.kind.split(/\s+/).map((k) => (k === 'title' ? n.title : k === 'aria-label' ? n.aria : k === 'placeholder' ? n.ph : null))
    .filter((v) => typeof v === 'string' && v.length > 0);
};

/** 设置页那一块列表 → 点行内删除 → 打开删除确认（nameQuote 钩子只在弹窗里） */
async function openDelModal() {
  let tree;
  TR.act(() => { tree = TR.create(React.createElement(panel.TemplateBrowser, { compact: false })); });
  const rowDel = tree.root.findAll((n) => n.type === 'button' && (n.children || []).filter((c) => typeof c === 'string').join('') === STR.del[docEl.lang.indexOf('en') === 0 ? 'en' : 'zh'])[0];
  if (!rowDel) { fail('找不到设置页行内删除键（lang=' + docEl.lang + '）'); return tree; }
  TR.act(() => { rowDel.props.onClick({ stopPropagation() {} }); });
  TR.act(() => {});
  return tree;
}

async function renderFaces() {
  const faces = [];
  /** 一个面：渲染 → **立刻冻结**钩子与 JSON（远程总闸在面之间翻转，会让仍挂载的面重渲染成另一分支） */
  const add = async (name, el) => {
    let inst;
    await TR.act(async () => { inst = TR.create(el); });
    await TR.act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    const frozen = { name: name, inst: inst, hooks: chromeNodes(inst), json: JSON.stringify(inst.toJSON()) };
    faces.push(frozen);
    return frozen;
  };
  // ① 悬浮小列表（远程关）：行内 title（insertHint）+ 裸加号 + 云行
  remoteMod.__resetRemoteForTests();
  remoteMod.setRemoteEnabled(false);
  installFetch();
  await add('panel-compact', React.createElement(panel.TemplateBrowser, { compact: true }));
  // ② 设置页那一块列表（compact=false）：三钮 + 行提示 + 用量
  await add('panel-settings', React.createElement(panel.TemplateBrowser, { compact: false }));
  // ③ 设置页整页：档位值 pill
  await add('settings-page', React.createElement(settingsMod.SettingsPage, {}));
  // ④ 远程大列表（compact + 总闸开）：翻页 title/aria-label
  remoteMod.setRemoteEnabled(true);
  await add('panel-remote', React.createElement(panel.TemplateBrowser, { compact: true }));
  // ⑤ 智能卡：开关开 + 草稿命中（同 #137 口径：textarea 活读）
  const ta = {
    tagName: 'TEXTAREA', value: '复盘', offsetParent: {},
    closest: () => null, focus: () => {}, setSelectionRange: () => {}, selectionStart: 2,
  };
  globalThis.document.activeElement = ta;
  domTextareas.push(ta);
  smartstore.setSmartInput({ draft: '复盘' });
  await add('smart-card', React.createElement(smartMod.SmartCardHost, {}));
  // ⑥ 遥控输入镜
  await add('remote-sheet', React.createElement(sheetMod.RemoteInputSheet, { capturedSessionId: 's1', remoteSize: 5, onClose: () => {} }));
  return faces;
}

// ═══ G) en 渲染：钩子节点文本与 title/aria-label/placeholder 无 CJK ═══
(async () => {
  store.bumpUsage('fp'); store.bumpUsage('fp'); store.bumpUsage('fp');
  const cust = store.addCustom('EnFixture', ['EnLabel'], 'en fixture body');

  installDom('en-US');
  const faces = await renderFaces();

  // G1：三钮 scope 钩子（身份值冻结）—— 云行在设置页那一块（悬浮面板远程开时走大列表，无云行）
  const settingsTree = faces.find((f) => f.name === 'panel-settings').inst;
  const scopes = settingsTree.root.findAll((n) => n.type === 'button' && n.props && n.props['data-dsh-prompt-scope']);
  eq(scopes.map((n) => n.props['data-dsh-prompt-scope']).join('/'), 'all/preset/custom', '三钮 scope 钩子序：all/preset/custom');
  eq(scopes.map((n) => (n.children || []).filter((c) => typeof c === 'string').join('')).join('/'), 'All/Preset/Custom', 'en 下三钮文本走词表');
  eq(scopes.map((n) => n.props['data-dsh-prompt-chrome']).join('/'), 'tabAll/scopePreset/tabCustom', '三钮 chrome 钩子键');

  // G2：逐面逐钩子位置：剔除数据词后无 CJK
  const found = new Map();
  for (const f of faces) {
    for (const n of f.hooks) {
      for (const v of hookAttrs(n)) {
        if (CJK.test(chromeOnly(v))) fail(f.name + ' 钩子 ' + n.key + ' 位置仍有 CJK：' + JSON.stringify(v));
      }
      const arr = found.get(n.key) || [];
      arr.push(f.name + (n.kind ? '(' + n.kind + ')' : '(text)'));
      found.set(n.key, arr);
    }
  }
  for (const f of faces) eq(f.json.length > 2, true, f.name + ' 渲染出树');
  for (const k of EXPECT_HOOKS) {
    if (k === 'nameQuote') continue;                            // 弹窗另行打开（G5）
    if (k === 'smartCommonSuffix') continue;                    // 与 smartScoreSuffix 互斥（同一行的两种形态）
    if (k === 'smartScoreSuffix' && found.has('smartCommonSuffix')) continue;
    if (!found.has(k)) fail('en 渲染里缺钩子 ' + k + '（实际：' + [...found.keys()].join('/') + '）');
  }
  if (!found.has('smartCommonSuffix') && !found.has('smartScoreSuffix')) fail('智能卡两种后缀一个都没渲染到');
  const kinds = [...found.entries()].map(([k, v]) => k + ':' + v.join(',')).join(' ');
  const hasHook = (k, entry) => (found.get(k) || []).indexOf(entry) >= 0;
  if (!hasHook('pickerPrev', 'panel-remote(title aria-label)')) fail('pickerPrev 应在远程大列表报属性位 title aria-label（实际 ' + kinds + '）');
  if (!hasHook('usageTitle', 'panel-settings(title)')) fail('usageTitle 应在设置页列表报属性位 title（实际 ' + kinds + '）');
  if (!hasHook('remoteSizeValue', 'settings-page(text)')) fail('remoteSizeValue 应在设置页文本位（实际 ' + kinds + '）');
  if (!hasHook('smartCommonSuffix', 'smart-card(text)') && !hasHook('smartScoreSuffix', 'smart-card(text)')) {
    fail('智能卡后缀应在 smart-card 文本位（实际 ' + kinds + '）');
  }

  // G3：en 文案确实切换（反面：不能只靠「没 CJK」）
  const enText = faces.map((f) => f.name + ':' + f.json).join('\n');
  for (const marker of ['Used 3 times', '5 · 300%', 'chars', 'Click to expand or collapse the summary', 'Click to insert', 'Previous', 'Next']) {
    if (enText.indexOf(marker) < 0) fail('en 渲染缺铬文案：' + marker);
  }
  if (!/·Common|·Score/.test(enText)) fail('en 智能卡缺后缀文案（·Common/·Score）');
  const pickerTitle = faces.find((f) => f.name === 'panel-remote').hooks.filter((n) => n.key === 'pickerPrev')[0];
  eq(pickerTitle.title, 'Previous', 'en pickerPrev title=Previous');
  eq(pickerTitle.aria, 'Previous', 'en pickerPrev aria-label=Previous');
  // G2b：删除确认（en）—— 模板名括法走词表，数据词不含 CJK
  {
    const modalTree = await openDelModal();
    const quote = chromeNodes(modalTree).filter((n) => n.key === 'nameQuote')[0];
    if (!quote) fail('en 删除确认里应有 nameQuote 铬钩子');
    else {
      if (quote.text.indexOf('“EnFixture”') < 0) fail('en 删除确认应用弯引号包名（实得 ' + JSON.stringify(quote.text) + '）');
      if (CJK.test(quote.text)) fail('en 删除确认不该有 CJK（实得 ' + JSON.stringify(quote.text) + '）');
    }
    try { modalTree.unmount(); } catch (e) {}
  }

  // 先收 en 六面，再换语言重渲染（DOM 桩不能同时喂两段）
  for (const f of faces) { try { f.inst.unmount(); } catch (e) {} }
  smartstore.setSmartInput({ draft: '' });

  // G4：zh 渲染（含术语「预制」），同一批钩子逐面复核
  installDom('zh-CN');
  const zhFaces = await renderFaces();
  const zhText = zhFaces.map((f) => f.name + ':' + f.json).join('\n');
  for (const marker of ['全部', '预制', '自定义', '已使用 3 次', '上一页', '下一页', '5档·300%', '点击展开/收起简介', '点击即插入']) {
    if (zhText.indexOf(marker) < 0) fail('zh 渲染缺铬文案：' + marker);
  }
  if (!/·常用/.test(zhText) && !/·分\d/.test(zhText)) fail('zh 智能卡缺后缀文案（·常用/·分N）');
  if (zhText.indexOf('预置') >= 0) fail('zh 渲染仍有旧术语「预置」（应统一为「预制」）');
  const zhScopes = zhFaces.find((f) => f.name === 'panel-settings').inst.root.findAll((n) => n.type === 'button' && n.props && n.props['data-dsh-prompt-scope']);
  eq(zhScopes.map((n) => (n.children || []).filter((c) => typeof c === 'string').join('')).join('/'), '全部/预制/自定义', 'zh 下三钮文本：全部/预制/自定义');
  const zhUsage = zhFaces.find((f) => f.name === 'panel-settings').inst.root.findAll((n) => n.props && n.props['data-dsh-prompt-chrome'] === 'usageTitle')[0];
  eq(String(zhUsage.props.title).indexOf('已使用 3 次') >= 0, true, 'zh 用量 title：已使用 3 次（实得 ' + zhUsage.props.title + '）');
  const zhSheet = zhFaces.find((f) => f.name === 'remote-sheet').hooks.filter((n) => n.key === 'remoteInputChars')[0];
  if (!/\d+字$/.test(String(zhSheet && zhSheet.text))) fail('zh 遥控输入镜字数应为「N字」（实得 ' + JSON.stringify(zhSheet && zhSheet.text) + '）');

  // G5：删除确认（zh）：全角引号 + 数据词原样
  {
    const modalTree = await openDelModal();
    const quote = chromeNodes(modalTree).filter((n) => n.key === 'nameQuote')[0];
    if (!quote) fail('zh 删除确认里应有 nameQuote 铬钩子');
    else if (quote.text.indexOf('「EnFixture」') < 0) fail('zh 删除确认应保留全角引号包名（实得 ' + JSON.stringify(quote.text) + '）');
    try { modalTree.unmount(); } catch (e) {}
  }
  for (const f of zhFaces) { try { f.inst.unmount(); } catch (e) {} }
  smartstore.setSmartInput({ draft: '' });
  store.removeCustom(cust.id);
  if (failures === 0) ok('G) 六面渲染：en 钩子位置零 CJK、zh 文案正确且术语为「预制」');
})().then(() => {
  if (failures > 0) { console.log('\nRESULT: FAIL (' + failures + ')'); process.exit(1); }
  console.log('\nRESULT: PASS');
}, (e) => { console.log('FAIL: 未捕获异常 ' + ((e && e.stack) || e)); process.exit(1); });

