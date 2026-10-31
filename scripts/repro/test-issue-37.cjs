// 回归测试 #37（#254 / header-action-cluster-v2 现行口径）：设置页对外入口区 —— 页头「联系 / Star / Issue」
// 三件套 + 底部作者插件引流区。
// 契约（对应 base 0.1.2 ActionCluster v2 与 #254 的用户故事 / 验收标准）：
//  1) 页头三件套由 dsh-featherhunter-plugin-base 的 ActionCluster（静默簇）渲染：联系是 <button>（开群码弹窗）、
//     Star 是 <a> → 仓库首页、Issue 是 <a> → ISSUE 列表页（不是 issues/new）；顺序固定 联系 → Star → Issue，
//     两枚地址由本仓 createBaseUI({ repoUrl, issuesUrl }) 交给 base；无障碍名 / 悬停文案由 base MESSAGES 提供；
//  2) 本仓不再自绘页头图标与气泡：无 data-dsh-prompt-tip 节点、无 TopPortal 挂载（气泡是 base 的文档级单例）；
//     旧 ActionGroup 胶囊（dsh-base-actions--group）退役，彩色 16px 图标带渐变，簇无托盘外框；
//  3) 底部引流区 = base AuthorPlugins：标题与行数据来自 base 包清单，自动排除本仓（selfId = prompt）；
//  4) 不动的东西：智能开关 / 模板列表顺序与行为一字不动；旧的 ⛭ / ⚠ 一行文字链接不再渲染（同一入口不留两处）；
//     底部整行 ContactRow 已退役（联系入口全页只在页头）；
//  5) 版式：模板区是一张卡片；页面顶层 5 块（身份行 / 模板列表卡 / 远程模式 / 诊断日志 / 引流区）。
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }
const DIR = path.join(__dirname, '.rt-tmp');
fs.mkdirSync(DIR, { recursive: true });
const ROOT = path.join(__dirname, '..', '..');
const SRC = (f) => path.join(ROOT, 'src', 'client', f);
// P1：只声明根；闭包与 require 改写由共享件顺着源码 import 推导（不再是手抄表）。
const { buildFlat } = require('../lib/transpile-client.cjs');
buildFlat(DIR, [
  SRC('settings-page.ts'),
  SRC('settings-links.ts'),
  SRC('template-browser.ts'),
]);
const React = require('react');
const TR = require('react-test-renderer');
const base = require('dsh-featherhunter-plugin-base/client');
const MSG = base.MESSAGES;
const about = require(path.join(DIR, 'settings-links.cjs'));
const panel = require(path.join(DIR, 'template-browser.cjs'));
const settings = require(path.join(DIR, 'settings-page.cjs'));
const { tr, STR } = require(path.join(DIR, 'strings.cjs'));

const REPO = 'https://github.com/FeatherHunter/dsh-prompt';
const ISSUES = REPO + '/issues';
// base 包发布数据里的作者插件清单：渲染结果必须与它一致（本仓不再持有第二份文案表/地址表）。
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', 'dsh-featherhunter-plugin-base', 'data', 'manifest.json'), 'utf8'));
const SELF_ID = 'prompt';
const pluginRows = () => (MANIFEST.plugins || []).slice()
  .filter((p) => p.id !== SELF_ID)
  .sort((a, b) => a.order - b.order)
  .slice(0, 5);
const hrefOf = (p) => (typeof p.url === 'string' && p.url.length > 0 ? p.url : 'https://github.com/' + p.repo);

let failures = 0;
function ok(cond, msg) { if (!cond) { failures++; console.log('  FAIL: ' + msg) } else { console.log('  ok: ' + msg) } }
function eq(actual, expected, msg) { ok(actual === expected, actual === expected ? msg : msg + '（实际 ' + JSON.stringify(actual) + ' ≠ 期望 ' + JSON.stringify(expected) + '）') }

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
const cls = (n) => String((n && n.props && n.props.className) || '');
const hasClass = (n, name) => cls(n).split(/\s+/).indexOf(name) >= 0;
// 三件套控件按 base 标记类认（ActionCluster v2：控件本身带 dsh-base-cluster__btn，按 token 比，不能按子串）
const clusterBtns = (c) => c.root.findAll((x) => (x.type === 'a' || x.type === 'button') && hasClass(x, 'dsh-base-cluster__btn'));
const clusterOf = (c) => c.root.findAll((x) => x.props && hasClass(x, 'dsh-base-cluster'));
const legacyGroupOf = (c) => c.root.findAll((x) => x.props && hasClass(x, 'dsh-base-actions--group'));
const tips = (c) => c.root.findAll((x) => x.props && x.props['data-dsh-prompt-tip'] !== undefined);
const svgCount = (n) => {
  const root = typeof n.findAll === 'function' ? n : n.root;
  return root.findAll((x) => x.type === 'svg').length;
};
const fire = (node, name, ev) => { TR.act(() => { node.props[name](ev || {}) }); TR.act(() => {}) };
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
const domSeq = (n) => {
  const out = [];
  const walk = (c) => {
    if (!c || typeof c !== 'object') return;
    if (Array.isArray(c)) { c.forEach(walk); return }
    out.push(c);
    (c.children || []).forEach(walk);
  };
  walk(n);
  return out;
};

console.log('=== T0: 源码层（页头交回 base，本仓不再自绘） ===');
const linksSrc = fs.readFileSync(SRC('settings-links.ts'), 'utf8');
ok(linksSrc.indexOf('ActionCluster') >= 0, '页头用 base ActionCluster 渲染三件套');
ok(linksSrc.indexOf('ui.ActionGroup') < 0, '旧 ActionGroup 用法已退役（源码不再渲染它）');
ok(linksSrc.indexOf('ui.ContactRow') < 0, '旧底部整行 ContactRow 包装已退役（源码不再渲染它）');
ok(linksSrc.indexOf('repoUrl: REPO_URL') >= 0, '仓库地址交给 createBaseUI（repoUrl: REPO_URL）');
ok(linksSrc.indexOf('issuesUrl: ISSUES_URL') >= 0, 'ISSUE 地址交给 createBaseUI（issuesUrl: ISSUES_URL）');
for (const stale of ['data-dsh-prompt-tip', 'IconLink', 'TopPortal', 'starTip', 'feedbackTip', '🌟', '💬']) {
  ok(linksSrc.indexOf(stale) < 0, 'settings-links.ts 不再出现 ' + stale);
}

console.log('=== T1: 文案双语齐全（header 用 base MESSAGES，品牌名用本仓 STR） ===');
const BASE_KEYS = ['contact', 'starLabel', 'issueLabel', 'actionsLabel', 'starTip', 'issueTip', 'contactTip'];
for (const k of BASE_KEYS) {
  const zh = MSG.zh && MSG.zh[k], en = MSG.en && MSG.en[k];
  ok(typeof zh === 'string' && zh.length > 0, 'MESSAGES.zh.' + k + ' 非空');
  ok(typeof en === 'string' && en.length > 0, 'MESSAGES.en.' + k + ' 非空');
  ok(zh !== en, 'MESSAGES.' + k + ' zh/en 不同（不是复制粘贴同一份）');
  ok(/[\u4e00-\u9fff]/.test(String(zh)), 'MESSAGES.' + k + '.zh 是中文');
  ok(!/[\u4e00-\u9fff]/.test(String(en)), 'MESSAGES.' + k + '.en 不含中文');
}
for (const k of ['sectionName']) {
  const zh = STR[k] && STR[k].zh, en = STR[k] && STR[k].en;
  ok(typeof zh === 'string' && zh.length > 0, k + '.zh 非空');
  ok(typeof en === 'string' && en.length > 0, k + '.en 非空');
  ok(zh !== en, k + ' zh/en 不同');
  ok(/[\u4e00-\u9fff]/.test(String(zh)), k + '.zh 是中文');
  ok(!/[\u4e00-\u9fff]/.test(String(en)), k + '.en 不含中文');
}

console.log('=== T2: 页头三件套（中文界面，base ActionCluster 静默簇） ===');
let zhHdr = mount(React.createElement(about.SettingsHeaderLinks, { lang: 'zh' }));
const zhCtrls = clusterBtns(zhHdr);
eq(zhCtrls.length, 3, '三件套三枚控件（联系按钮 + 两枚外链）');
const [contact, star, issue] = zhCtrls;
eq(contact.type, 'button', '联系是 <button>（开群码弹窗，不是外链）');
eq(contact.props.type, 'button', '联系按钮 type=button');
ok(hasClass(contact, 'dsh-base-cluster__btn--contact'), '联系按钮带 base 簇标记类 dsh-base-cluster__btn--contact');
eq(contact.props['aria-label'], MSG.zh.contact, '联系无障碍名 = MESSAGES.zh.contact');
eq(star.type, 'a', 'Star 是链接');
eq(star.props.href, REPO, 'Star 指向仓库首页');
eq(star.props['aria-label'], MSG.zh.starLabel, 'Star 无障碍名 = MESSAGES.zh.starLabel');
eq(issue.type, 'a', 'Issue 是链接');
eq(issue.props.href, ISSUES, 'Issue 指向 ISSUE 列表页');
ok(!/\/issues\/new$/.test(issue.props.href), 'Issue 不是 issues/new');
for (const [i, a] of [star, issue].entries()) {
  eq(a.props.target, '_blank', '外链 ' + i + ' 新标签页打开');
  ok(String(a.props.rel || '').indexOf('noreferrer') >= 0, '外链 ' + i + ' rel 含 noreferrer');
  ok(String(a.props.rel || '').indexOf('noopener') >= 0, '外链 ' + i + ' rel 含 noopener');
}
const zhClusters = clusterOf(zhHdr);
eq(zhClusters.length, 1, '三枚控件收在一枚静默簇里');
eq(zhClusters[0].props.role, 'group', '簇 role=group');
eq(zhClusters[0].props['aria-label'], MSG.zh.actionsLabel, '簇 aria-label = MESSAGES.zh.actionsLabel');
ok(hasClass(zhClusters[0], 'dsh-base-cluster'), '簇带 base 类名 dsh-base-cluster');
ok(!hasClass(zhClusters[0], 'dsh-base-cluster--tray'), 'quiet 变体：无托盘外框');
eq(legacyGroupOf(zhHdr).length, 0, '旧 ActionGroup 胶囊类名 dsh-base-actions--group 不在场');
ok(txt(zhHdr).indexOf('🌟') < 0 && txt(zhHdr).indexOf('💬') < 0, '不再用 emoji 当图标（改 base 彩色 svg）');
for (const [i, ctl] of zhCtrls.entries()) {
  const icon = ctl.findAll((x) => x.type === 'span' && x.props['aria-hidden'] === 'true')[0];
  ok(!!icon, '控件 ' + i + ' 图标容器 aria-hidden');
  eq(icon ? svgCount(icon) : 0, 1, '控件 ' + i + ' 图标是一枚 16px svg');
  const svg = ctl.findAll((x) => x.type === 'svg')[0];
  eq(svg ? svg.props.width : 0, 16, '控件 ' + i + ' 图标 16px 宽');
  eq(svg ? svg.props.height : 0, 16, '控件 ' + i + ' 图标 16px 高');
  const gradients = svg ? svg.findAll((x) => x.type === 'linearGradient' || x.type === 'radialGradient').length : 0;
  ok(gradients >= 1, '控件 ' + i + ' 彩色图标带渐变定义（linearGradient / radialGradient）');
  eq(ctl.props.style ? ctl.props.style.width : 0, 28, '控件 ' + i + ' 按钮 28×28（size 16 + 内边距）');
  eq(ctl.props['data-cluster-item'], ['contact', 'star', 'issue'][i], '控件 ' + i + ' 带 data-cluster-item 标记');
}
eq(tips(zhHdr).length, 0, '本仓不再自绘气泡节点（data-dsh-prompt-tip）');
const hdrRow = zhHdr.root.findAll((x) => x.type === 'div' && x.props.style && x.props.style.display === 'flex' && x.props.style.justifyContent === 'space-between')[0];
ok(!!hdrRow, '#53：头行两端布局（左标志+名字 / 右三件套）');
const brand = zhHdr.root.findAll((x) => x.type === 'span' && x.props.style && x.props.style.display === 'inline-flex' && txt(x).indexOf(STR.sectionName.zh) >= 0)[0];
ok(!!brand, '#53：头行左边有插件名字（' + STR.sectionName.zh + '）');
ok(!!brand && svgCount(brand) === 1, '#53：名字左边是插件标志（一个 svg）');
eq(brand ? txt(brand) : '', STR.sectionName.zh, '#53：左边只显示页面名，不带别的字');
eq(svgCount(zhHdr), 4, '整个头行四枚 svg：品牌标志 1 + 三件套彩色图标 3（没混进别的图形）');
zhHdr.unmount();

console.log('=== T3: 气泡接线（base HoverTip；本仓不渲染气泡本体） ===');
let tipHost = mount(React.createElement(about.SettingsHeaderLinks, { lang: 'zh' }));
const tipWraps = clusterBtns(tipHost);
eq(tipWraps.length, 3, '三件套三枚控件各自接悬停/聚焦');
for (const [i, w] of tipWraps.entries()) {
  eq(typeof w.props.onMouseEnter, 'function', '控件 ' + i + ' 接 onMouseEnter');
  eq(typeof w.props.onFocus, 'function', '控件 ' + i + ' 接 onFocus（键盘可达）');
}
// 无 document 的测试环境里 base 不会把气泡挂进渲染树：本仓也不该有内联气泡或内联文案副本
fire(tipWraps[0], 'onMouseEnter');
fire(tipWraps[0], 'onFocus');
eq(tips(tipHost).length, 0, '悬停/聚焦后仍没有本仓自绘气泡节点');
eq(txt(tipHost).indexOf(MSG.zh.starTip) < 0, true, '气泡文案不写进内联树（由 base 文档级单例负责）');
tipHost.unmount();

console.log('=== T4: 英文界面（文案不许只写中文） ===');
let enHdr = mount(React.createElement(about.SettingsHeaderLinks, { lang: 'en' }));
const enCtrls = clusterBtns(enHdr);
eq(enCtrls.length, 3, '英文界面仍三枚控件');
eq(enCtrls[0].props['aria-label'], MSG.en.contact, '联系无障碍名英文');
eq(enCtrls[1].props['aria-label'], MSG.en.starLabel, 'Star 无障碍名英文');
eq(enCtrls[2].props['aria-label'], MSG.en.issueLabel, 'Issue 无障碍名英文');
eq(clusterOf(enHdr)[0].props['aria-label'], MSG.en.actionsLabel, '簇 aria-label 英文');
eq(enCtrls[1].props.href, REPO, '英文界面 Star 地址不变');
eq(enCtrls[2].props.href, ISSUES, '英文界面 Issue 地址不变');
eq(txt(enHdr).indexOf(STR.sectionName.en) >= 0, true, '#53：头行左边名字英文（' + STR.sectionName.en + '）');
eq(/[\u4e00-\u9fff]/.test(txt(enHdr)), false, '英文界面头行不含中文（含品牌名与无障碍名）');
enHdr.unmount();

console.log('=== T5: 底部引流区（base AuthorPlugins，数据来自 base 清单） ===');
for (const lang of ['zh', 'en']) {
  const card = mount(React.createElement(about.AuthorPlugins, { lang }));
  const cards = card.root.findAll((x) => x.props && cls(x).split(/\s+/).indexOf('dsh-base-plugins') >= 0);
  eq(cards.length, 1, lang + '：一块引流区卡片');
  eq(txt(card).indexOf(MSG[lang].plugins) >= 0, true, lang + '：卡片标题 = base MESSAGES.' + lang + '.plugins');
  const rows = card.root.findAll((x) => x.type === 'a' && cls(x).split(/\s+/).indexOf('dsh-base-plugins__row') >= 0);
  const expected = pluginRows();
  eq(rows.length, expected.length, lang + '：行数 = base 清单去掉本仓（selfId=' + SELF_ID + '）');
  for (let i = 0; i < expected.length; i++) {
    const p = expected[i];
    eq(rows[i].props.href, hrefOf(p), lang + ' 第 ' + (i + 1) + ' 行地址');
    eq(rows[i].props.target, '_blank', lang + ' 第 ' + (i + 1) + ' 行新标签页打开');
    ok(String(rows[i].props.rel || '').indexOf('noopener') >= 0, lang + ' 第 ' + (i + 1) + ' 行 rel 含 noopener');
    const rowText = txt(rows[i]);
    ok(rowText.indexOf(p.name) >= 0, lang + ' 第 ' + (i + 1) + ' 行插件名 = ' + p.name);
    ok(rowText.indexOf(p.desc[lang]) >= 0, lang + ' 第 ' + (i + 1) + ' 行描述跟随语言');
    ok(rowText.indexOf('https://') < 0, lang + ' 第 ' + (i + 1) + ' 行不把网址糊给用户看');
  }
  eq(rows.filter((r) => txt(r).indexOf('dsh-prompt') >= 0).length, 0, lang + '：本仓自己不出现在推荐卡里');
  card.unmount();
}

console.log('=== T6: 设置页装配（顺序与不动的东西） ===');
const page = mount(React.createElement(settings.SettingsPage, {}));
const pageCtrls = clusterBtns(page);
eq(pageCtrls.length, 3, '页面里三件套三枚控件（联系 + 两枚外链）');
eq(pageCtrls.filter((x) => x.type === 'a').map((a) => a.props.href).join('|'), REPO + '|' + ISSUES, '两枚外链地址分别是仓库首页与 ISSUE 列表页');
eq(page.root.findAll((x) => x.type === 'a' && /\/issues\/new$/.test(String(x.props.href))).length, 0, '旧的 ⚠ 反馈故障 issues/new 链接已下线');
eq(txt(page).indexOf('⛭') < 0, true, '旧的 ⛭ GitHub 仓库文字链接已下线（同一入口不留两处）');
const tree = page.toJSON();
const kids = tree.children;
// header-action-cluster-v2 版式：身份行 / 模板列表卡 / 远程模式 / 诊断日志 / 引流区。
eq(kids.length, 5, '设置页顶层五块：身份行 / 模板列表卡 / 远程模式 / 诊断日志 / 引流区');
eq(jsonAnchors(kids[0]).length, 2, '第 0 块是右上角三件套里的两枚外链（更新入口为可选外挂，不挤掉它）');
eq(txt(kids[0]).indexOf(STR.sectionName.zh) >= 0, true, '#53：第 0 块左边有插件名字');
// #129（0.3.1 整组件，接替 #60-A）：入口是 http 挂载容器（data-dsh-prompt-update-entry，
// 上游 button 形态，空容器 fail-soft），与三件套同属头行且在静默簇之前；更新面板是独立 dialog（点开才挂）。
{
  const seq0 = domSeq(kids[0]);
  const entryNode = seq0.find((n) => n.props && n.props['data-dsh-prompt-update-entry'] !== undefined);
  ok(!!entryNode, '#129：更新入口容器在身份行内部（data-dsh-prompt-update-entry）');
  const clusterNode = seq0.find((n) => hasClass(n, 'dsh-base-cluster'));
  ok(!!clusterNode, 'header-action-cluster-v2：身份行内部有三件套静默簇');
  ok(!!entryNode && !!clusterNode && seq0.indexOf(entryNode) < seq0.indexOf(clusterNode), '#60：更新入口落在三件套**之前**（同一行、同一父级）');
  const stray = domSeq(page.toJSON()).filter((n) => n.props && (n.props['data-dsh-prompt-update-archive'] !== undefined || n.props['data-dsh-prompt-update-panel'] !== undefined));
  eq(stray.length, 0, '无手写开关无常驻面板容器（dialog 只由入口开）');
  eq(STR.updateEntry, undefined, '#129：旧 STR.updateEntry 文案已删除（自研弹窗退役）');
}
// 底部整行 ContactRow 已退役：页面里不该再出现 dsh-base-contact-row，联系入口全页只在页头。
{
  const contactRows = page.root.findAll((x) => x.props && hasClass(x, 'dsh-base-contact-row'));
  eq(contactRows.length, 0, '底部整行联系入口（base ContactRow）已退役，全页只留页头一处');
  eq(legacyGroupOf(page).length, 0, '旧 ActionGroup 胶囊（dsh-base-actions--group）不在页面里');
}
// 按内容找、不按索引钉死（索引断言会随版式漂移，且会假绿）。
const blockWith = (s) => kids.find((k) => txt(k).indexOf(s) >= 0);
const logBlock = blockWith(STR.logGroup.zh);
eq(!!logBlock, true, '有「诊断日志」组（带组标题）');
eq([STR.logExport.zh, STR.logCopyPath.zh, STR.logClear.zh].every((s) => txt(logBlock).indexOf(s) >= 0), true, '日志三入口都在组内（导出 / 复制路径 / 清空）');
eq(txt(logBlock).indexOf(STR.logWhere.zh) >= 0, true, '组内有落点行（等宽字体，不再写尖括号）');
const listBlock = kids.find((k) => k.type === 'section' && txt(k).indexOf(STR.addShort.zh) >= 0);
eq(!!listBlock, true, '#77：模板浏览列表仍是有壳的卡片（section），且带新增入口');
eq(blockWith(STR.smartGroup.zh) === undefined, true, '智能推荐组整组不渲染（#36 裁定废弃后暂不放开）');
eq(blockWith(STR.smartToggle.zh) === undefined, true, '智能开关的文案也不出现');
// 末块（页面底部）是引流区，且由 base 渲染（本仓不再带 data-dsh-prompt-more 标记）。
eq(txt(kids[kids.length - 1]).indexOf(MSG.zh.plugins) >= 0, true, '末块（页面底部）是引流区');
eq(cls(kids[kids.length - 1]).split(/\s+/).indexOf('dsh-base-plugins') >= 0, true, '末块带 base 引流区类名 dsh-base-plugins');
// #53 回归：template-browser.ts 头行两处内联灯泡 SVG 换成 logo.ts 的 promptMark 后，设置页头行必须照旧（标志 + Prompt + 新增）
const browser = mount(React.createElement(panel.TemplateBrowser, { compact: false }));
eq(browser.root.findAll((x) => x.type === 'svg').length >= 1, true, '#53：模板列表头行仍有标志 svg');
eq(txt(browser).indexOf(STR.panelTitle.zh) >= 0, true, '#53：模板列表头行仍有标题 ' + STR.panelTitle.zh);
eq(txt(browser).indexOf(STR.addShort.zh) >= 0, true, '#53：模板列表头行仍有新增按钮');
browser.unmount();
page.unmount();

console.log(failures === 0 ? 'ALL PASS: #37 设置页对外入口区（三件套 + 引流区，base ActionCluster 口径）' : 'FAILURES: ' + failures);
process.exit(failures === 0 ? 0 : 1);
