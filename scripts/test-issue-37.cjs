// 回归测试 #37：设置页「作者其他插件」引流区 + 右上角 GitHub/ISSUE 图标按钮
// 契约（对应用户故事与验收标准）：
//  1) 右上角两个图标按钮：🌟 → 仓库首页、💬 → ISSUE 列表页（不是 issues/new），双语 aria-label，新标签页打开；
//  2) 悬停 / 键盘聚焦出气泡，mouseleave / blur / Esc 收（气泡走顶层 portal，无 DOM 环境内联回退）；
//  3) 底部四行引流区：slug→URL 映射与顺序、中英双语描述、整行可点；
//  4) 不动的东西：智能开关 / storageNote / 模板列表顺序与行为一字不动；旧的一行文字链接不再渲染（同一入口不留两处）。
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }
const DIR = path.join(__dirname, '.rt-tmp');
fs.mkdirSync(DIR, { recursive: true });
const SRC = (f) => path.join(__dirname, '..', 'src', 'client', f);
const MODULES = [
  ['templates.ts', SRC('templates.ts'), []],
  ['store.ts', SRC('store.ts'), ['./templates']],
  ['state.ts', SRC('state.ts'), []],
  ['i18n.ts', SRC('i18n.ts'), []],
  ['smartstore.ts', SRC('smartstore.ts'), []],
  ['panel.ts', SRC('panel.ts'), ['./templates', './store', './state', './i18n', './smartstore']],
  ['about.ts', SRC('about.ts'), ['./panel', './i18n']],
  ['settings.ts', SRC('settings.ts'), ['./panel', './about', './smartstore', './i18n']],
];
for (const [outName, srcPath, deps] of MODULES) {
  let src = fs.readFileSync(srcPath, 'utf8');
  let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true } }).outputText;
  for (const d of deps) js = js.split('require("' + d + '")').join('require("' + d + '.cjs")');
  fs.writeFileSync(path.join(DIR, outName.replace(/\.ts$/, '.cjs')), js);
}
const React = require('react');
const TR = require('react-test-renderer');
const about = require(path.join(DIR, 'about.cjs'));
const panel = require(path.join(DIR, 'panel.cjs'));
const settings = require(path.join(DIR, 'settings.cjs'));
const { tr, STR } = require(path.join(DIR, 'i18n.cjs'));

const REPO = 'https://github.com/FeatherHunter/dsh-prompt';
const ISSUES = REPO + '/issues';
const MORE = [
  ['dsh-mattpocock-skills-deck', 'https://github.com/FeatherHunter/dsh-mattpocock-skills-deck', 'moreDescDeck', '25'],
  ['dsh-opencode-palette', 'https://github.com/FeatherHunter/dsh-opencode-palette', 'moreDescPalette', '38'],
  ['dsh-prompt', REPO, 'moreDescPrompt', '24'],
  ['dsh-im-companion', 'https://github.com/FeatherHunter/dsh-im-companion', 'moreDescCompanion', '9'],
];
const I18N_KEYS = ['starTip', 'feedbackTip', 'moreTitle', 'moreDescDeck', 'moreDescPalette', 'moreDescPrompt', 'moreDescCompanion', 'sectionName'];

let failures = 0;
function ok(cond, msg) { if (!cond) { failures++; console.log('  FAIL: ' + msg) } else { console.log('  ok: ' + msg) } }
function eq(actual, expected, msg) { ok(actual === expected, msg + '（实际 ' + JSON.stringify(actual) + ' ≠ 期望 ' + JSON.stringify(expected) + '）') }

const txt = (n) => {
  // 传 TestRenderer 进来也算数（renderer 上没有 children，非得先 toJSON，否则取到空串、断言变成空转）
  if (n && typeof n.toJSON === 'function') n = n.toJSON();
  const parts = [];
  const walk = (c) => {
    if (c === null || c === undefined || c === false || c === true) return;
    if (typeof c === 'string' || typeof c === 'number') { parts.push(String(c)); return }
    if (Array.isArray(c)) { c.forEach(walk); return }
    if (c.children) c.children.forEach(walk);
  };
  walk(n);
  return parts.join('');
};
const mount = (el) => { let c; TR.act(() => { c = TR.create(el) }); return c };
const anchors = (c, pred) => c.root.findAll((x) => x.type === 'a' && (!pred || pred(x)));
// 引流区按 DOM 子树取行：🌟 按钮的地址和 dsh-prompt 那一行相同，只按 href 认会把按钮也算成一行
const cardNode = (c) => c.root.findAll((x) => x.props && x.props['data-dsh-prompt-more'] === '')[0];
const rowsIn = (node) => node.findAll((x) => x.type === 'a');
// 顶部按钮按 aria-label 认（只有这两个按钮带 aria-label），避开引流区四行的干扰
const headBtns = (c) => c.root.findAll((x) => x.type === 'a' && !!x.props['aria-label']);
// 从 toJSON 的宿主树里捞 <a>：气泡宿主是 span，不能按 div 认
const jsonAnchors = (n) => {
  const out = [];
  const walk = (c) => {
    if (!c || typeof c !== 'object') return;
    if (Array.isArray(c)) { c.forEach(walk); return }
    if (c.type === 'a') out.push(c);
    (c.children || []).forEach(walk);
  };
  walk(n);
  return out;
};
const wrappers = (c) => c.root.findAll((x) => x.props && typeof x.props.onMouseEnter === 'function' && typeof x.props.onFocus === 'function');
const tips = (c) => c.root.findAll((x) => x.props && x.props['data-dsh-prompt-tip'] === '');
const fire = (node, name, ev) => { TR.act(() => { node.props[name](ev || {}) }); TR.act(() => {}) };

console.log('=== T1: i18n 双语齐全（英文不许夹中文） ===');
for (const k of I18N_KEYS) {
  const zh = STR[k] && STR[k].zh, en = STR[k] && STR[k].en;
  ok(typeof zh === 'string' && zh.length > 0, k + '.zh 非空');
  ok(typeof en === 'string' && en.length > 0, k + '.en 非空');
  ok(zh !== en, k + ' zh/en 不同（不是复制粘贴同一份）');
  ok(/[\u4e00-\u9fff]/.test(String(zh)), k + '.zh 是中文');
  ok(!/[\u4e00-\u9fff]/.test(String(en)), k + '.en 不含中文');
}
eq(STR.starTip.zh, '你的 ⭐是我夜空中最亮的星。', 'starTip 中文口径');
eq(STR.starTip.en, 'Your ⭐ is the brightest star in my night sky.', 'starTip 英文口径');
eq(STR.feedbackTip.zh, '提交反馈、建议和意见🌹', 'feedbackTip 中文口径');
eq(STR.feedbackTip.en, 'Feedback, suggestions and ideas — all welcome 🌹', 'feedbackTip 英文口径');
eq(STR.moreTitle.zh, '作者其他插件', 'moreTitle 中文口径');
eq(STR.moreTitle.en, 'More plugins by the author', 'moreTitle 英文口径');

console.log('=== T2: 顶部两个图标按钮（中文界面） ===');
let zhHdr = mount(React.createElement(about.SettingsHeaderLinks, { lang: 'zh' }));
let zhLinks = anchors(zhHdr);
eq(zhLinks.length, 2, '只有两个按钮（旧的一行文字链接不再出现）');
eq(zhLinks[0].props.href, REPO, '🌟 指向仓库首页');
eq(zhLinks[1].props.href, ISSUES, '💬 指向 ISSUE 列表页');
ok(!/\/issues\/new$/.test(zhLinks[1].props.href), '💬 不是 issues/new');
for (const [i, a] of zhLinks.entries()) {
  eq(a.props.target, '_blank', '按钮 ' + i + ' 新标签页打开');
  eq(a.props.rel, 'noreferrer', '按钮 ' + i + ' rel=noreferrer');
  eq(a.props['aria-label'], i === 0 ? STR.gitHubRepo.zh : STR.feedback.zh, '按钮 ' + i + ' aria-label 复用既有键（中文）');
  const icon = a.children.filter((c) => c && c.props)[0];
  eq(icon.props['aria-hidden'], 'true', '按钮 ' + i + ' 图标 aria-hidden');
  eq(txt(icon), i === 0 ? '🌟' : '💬', '按钮 ' + i + ' 图标是 emoji');
}
const hdrRow = zhHdr.root.findAll((x) => x.type === 'div' && x.props.style && x.props.style.display === 'flex')[0];
eq(hdrRow.props.style.justifyContent, 'space-between', '#53：头行两端布局（左标志+名字 / 右两个按钮）');
const brand = zhHdr.root.findAll((x) => x.type === 'span' && x.props.style && x.props.style.display === 'inline-flex' && txt(x).indexOf(STR.sectionName.zh) >= 0)[0];
ok(!!brand, '#53：头行左边有插件名字（' + STR.sectionName.zh + '）');
ok(!!brand && brand.findAll((x) => x.type === 'svg').length === 1, '#53：名字左边是插件标志（一个 svg）');
eq(brand ? txt(brand) : '', STR.sectionName.zh, '#53：左边只显示页面名，不带别的字');
eq(hdrRow.findAll((x) => x.type === 'svg').length, 1, '#53：整个头行只有一个标志 svg（没混进别的图形）');
zhHdr.unmount();

console.log('=== T3: 悬停 / 聚焦气泡（中文界面） ===');
let tipHost = mount(React.createElement(about.SettingsHeaderLinks, { lang: 'zh' }));
let wraps = wrappers(tipHost);
eq(wraps.length, 2, '两个按钮各挂一个气泡宿主');
eq(tips(tipHost).length, 0, '初始不显示气泡');
fire(wraps[0], 'onMouseEnter');
eq(tips(tipHost).length, 1, '鼠标进入出气泡');
eq(txt(tips(tipHost)[0]), STR.starTip.zh, '🌟 气泡文案 = starTip');
fire(wraps[0], 'onMouseLeave');
eq(tips(tipHost).length, 0, '鼠标离开收气泡');
fire(wraps[0], 'onFocus');
eq(tips(tipHost).length, 1, '键盘聚焦出气泡（用户故事 4）');
fire(wraps[0], 'onKeyDown', { key: 'Escape' });
eq(tips(tipHost).length, 0, 'Esc 收气泡');
fire(wraps[1], 'onFocus');
eq(txt(tips(tipHost)[0]), STR.feedbackTip.zh, '💬 气泡文案 = feedbackTip');
fire(wraps[1], 'onBlur');
eq(tips(tipHost).length, 0, '失焦收气泡');
tipHost.unmount();

console.log('=== T4: 英文界面（文案不许只写中文） ===');
let enHdr = mount(React.createElement(about.SettingsHeaderLinks, { lang: 'en' }));
let enLinks = anchors(enHdr);
eq(enLinks[0].props['aria-label'], STR.gitHubRepo.en, '🌟 aria-label 英文');
eq(enLinks[1].props['aria-label'], STR.feedback.en, '💬 aria-label 英文');
let enWraps = wrappers(enHdr);
fire(enWraps[0], 'onFocus');
eq(txt(tips(enHdr)[0]), STR.starTip.en, '🌟 气泡英文');
fire(enWraps[0], 'onBlur');
fire(enWraps[1], 'onFocus');
eq(txt(tips(enHdr)[0]), STR.feedbackTip.en, '💬 气泡英文');
// #53：头行左边的插件名字也要跟着界面语言走
eq(txt(enHdr).indexOf(STR.sectionName.en) >= 0, true, '#53：头行左边名字英文（' + STR.sectionName.en + '）');
eq(txt(enHdr).indexOf(STR.sectionName.zh) < 0, true, '#53：英文界面下不出现中文名字');
enHdr.unmount();

console.log('=== T5: 底部四行引流区 ===');
for (const lang of ['zh', 'en']) {
  const card = mount(React.createElement(about.AuthorPlugins, { lang }));
  eq(card.root.findAll((x) => x.props && x.props['data-dsh-prompt-more'] === '').length, 1, lang + '：一块引流区卡片');
  const rows = rowsIn(cardNode(card));
  eq(rows.length, 4, lang + '：四行');
  for (let i = 0; i < MORE.length; i++) {
    const [slug, url, descKey, count] = MORE[i];
    eq(txt(rows[i]).indexOf(slug) >= 0, true, lang + ' 第 ' + (i + 1) + ' 行 slug = ' + slug + '（顺序与 skills-deck 配置页一致）');
    eq(rows[i].props.href, url, lang + ' 第 ' + (i + 1) + ' 行地址');
    eq(rows[i].props.target, '_blank', lang + ' 第 ' + (i + 1) + ' 行新标签页打开');
    eq(rows[i].props.rel, 'noreferrer', lang + ' 第 ' + (i + 1) + ' 行 rel=noreferrer');
    eq(txt(rows[i]).indexOf(tr(lang, STR[descKey])) >= 0, true, lang + ' 第 ' + (i + 1) + ' 行描述 = ' + descKey);
    eq(txt(rows[i]).indexOf(count) >= 0, true, lang + ' 第 ' + (i + 1) + ' 行带实测数字 ' + count);
    eq(txt(rows[i]).indexOf('https://') < 0, true, lang + ' 第 ' + (i + 1) + ' 行不把网址糊给用户看');
  }
  card.unmount();
}

console.log('=== T6: 设置页装配（顺序与不动的东西） ===');
const page = mount(React.createElement(settings.SettingsPage, {}));
const pageHead = headBtns(page);
eq(pageHead.length, 2, '页面里两个图标按钮');
eq(pageHead.map((a) => a.props.href).join('|'), REPO + '|' + ISSUES, '两个按钮的地址分别是仓库首页与 ISSUE 列表页');
eq(rowsIn(cardNode(page)).length, 4, '页面里四行引流区');
eq(anchors(page).filter((a) => /\/issues\/new$/.test(a.props.href)).length, 0, '旧的 ⚠ 反馈故障 issues/new 链接已下线');
eq(txt(page).indexOf('⛭') < 0, true, '旧的 ⛭ GitHub 仓库文字链接已下线（同一入口不留两处）');
const tree = page.toJSON();
const kids = tree.children;
// #52 改版：版式变了（每个功能各收进一张卡片：智能推荐组 / 诊断日志组），所以这几条改成**按内容找**，
// 不再按索引钉死（索引断言会随版式变化而失去意义）。#37 自己的四条保证一条不减：
// 两个图标按钮、四行引流区、旧文字链接下线、末尾是引流区。
const hasCheckbox = (node) => !!(node && ((node.props && node.props.type === 'checkbox')
  || (Array.isArray(node.children) && node.children.some(hasCheckbox))));
eq(kids.length, 6, '设置页顶层六块：标题行 / 智能推荐组 / 诊断日志组 / 模板列表 / 存储说明 / 引流区');
eq(jsonAnchors(kids[0]).map((a) => a.props.href).join('|'), REPO + '|' + ISSUES, '第 1 块是右上角两个按钮（顺序：🌟 仓库、💬 ISSUE）');
eq(txt(kids[0]).indexOf(STR.sectionName.zh) >= 0, true, '#53：第 1 块左边有插件名字');
eq(txt(kids[1]).indexOf(STR.smartGroup.zh) >= 0, true, '第 2 块是「智能推荐」组（带组标题）');
eq(txt(kids[1]).indexOf(STR.smartToggle.zh) >= 0, true, '智能开关在组内（文案一字不动）');
eq(hasCheckbox(kids[1]), true, '智能开关仍是 checkbox');
eq(txt(kids[2]).indexOf(STR.logGroup.zh) >= 0, true, '第 3 块是「诊断日志」组');
eq([STR.logExport.zh, STR.logCopyPath.zh, STR.logClear.zh].every((s) => txt(kids[2]).indexOf(s) >= 0), true, '日志三入口都在组内（导出 / 复制路径 / 清空）');
eq(txt(kids[2]).indexOf(STR.logWhere.zh) >= 0, true, '组内有落点行（等宽字体，不再写尖括号）');
eq(kids[3].type, 'div', '第 4 块是模板浏览列表');
eq(!kids[3].props['data-dsh-prompt-more'], true, '第 4 块不是引流区');
eq(txt(kids[4]), STR.storageNote.zh, '第 5 块是存储说明（跟模板区走，文案一字不动）');
eq(kids[5].props['data-dsh-prompt-more'], '', '第 6 块（页面底部）是引流区');
// #53 回归：panel.ts 头行两处内联灯泡 SVG 换成 logo.ts 的 promptMark 后，设置页头行必须照旧（标志 + Prompt + 新增）
const browser = mount(React.createElement(panel.TemplateBrowser, { compact: false }));
eq(browser.root.findAll((x) => x.type === 'svg').length >= 1, true, '#53：模板列表头行仍有标志 svg');
eq(txt(browser).indexOf(STR.panelTitle.zh) >= 0, true, '#53：模板列表头行仍有标题 ' + STR.panelTitle.zh);
eq(txt(browser).indexOf(STR.addShort.zh) >= 0, true, '#53：模板列表头行仍有新增按钮');
browser.unmount();
page.unmount();

console.log(failures === 0 ? 'ALL PASS: #37 设置页引流区 + 图标按钮' : 'FAILURES: ' + failures);
process.exit(failures === 0 ? 0 : 1);
