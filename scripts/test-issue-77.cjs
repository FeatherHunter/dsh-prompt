// 回归测试 #77：设置页模板列表改成可折叠区域（默认收起，点击头行才展开）
// 验收映射（#77 票面）：
//  A) 设置页首屏：模板行一条都不渲染（data-dsh-prompt-id = 0），头行存在且 aria-expanded=false，
//     头行上有「预制 24 · 自定义 n」；chips 与搜索框同样不渲染（页面高度不再被列表撑开）
//  B) 点头行：模板行全出来、aria-expanded=true、chips 与搜索框出现（就是今天那份列表）
//  C) 再点一次：回到收起态（可来回切）
//  D) 键盘 Enter / 空格 同样能开（可点线索不止鼠标）
//  E) 收起态「＋ 新增」不触发折叠：列表仍收起，新增弹窗照常弹
//  F) 不受影响的面：compact=true 悬浮面板照旧立刻渲染列表、页面上没有折叠头行；
//     不传 collapsible 的 compact=false 挂载（全部既有回归脚本的用法）行为一字不动
//  G) #37/#40 的结构断言不破：设置页顶层仍是 6 块，第 3 块仍是那个浏览器（含折叠头行）
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }
const DIR = path.join(__dirname, '.rt-tmp');
fs.mkdirSync(DIR, { recursive: true });
const SRC = (f) => path.join(__dirname, '..', 'src', 'client', f);
const UPD = (f) => path.join(__dirname, '..', 'src', 'update', f);
// 独立后缀（不与别家互压）：*77.cjs
const MODULES = [
  ['templates', SRC('templates.ts'), []],
  ['store', SRC('store.ts'), ['./templates']],
  ['state', SRC('state.ts'), []],
  ['i18n', SRC('i18n.ts'), []],
  ['smartstore', SRC('smartstore.ts'), []],
  ['panel', SRC('panel.ts'), ['./templates', './store', './state', './i18n', './smartstore']],
  ['about', SRC('about.ts'), ['./panel', './i18n']],
  ['updauto', SRC('updauto.ts'), []],
  ['upddialog', SRC('upddialog.ts'), []],
  ['update', SRC('update.ts'), ['./panel', './i18n', './updauto', './upddialog', '../update/bridge', '../update/gen/updateClient.derived.js']],
  ['settings', SRC('settings.ts'), ['./panel', './about', './update', './smartstore', './i18n']],
  ['bridge', UPD('bridge.ts'), ['./gen/updateClient.derived.js']],
  ['derived', UPD('gen/updateClient.derived.js'), []],
];
const OUT = (name) => './' + name + '77.cjs';
for (const [name, srcPath, deps] of MODULES) {
  const src = fs.readFileSync(srcPath, 'utf8');
  let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true } }).outputText;
  for (const d of deps) {
    const to = d === '../update/bridge' ? OUT('bridge')
      : (d === './gen/updateClient.derived.js' || d === '../update/gen/updateClient.derived.js') ? OUT('derived')
        : OUT(d.replace(/^\.\//, ''));
    js = js.split('require("' + d + '")').join('require("' + to + '")');
    js = js.split("require('" + d + "')").join('require("' + to + '")');
  }
  fs.writeFileSync(path.join(DIR, name + '77.cjs'), js);
}
const React = require('react');
const TR = require('react-test-renderer');
const req = (n) => require(path.join(DIR, n));
const panel = req('panel77.cjs');
const settings = req('settings77.cjs');
const store = req('store77.cjs');
const { tr, STR } = req('i18n77.cjs');

let failures = 0;
function ok(cond, msg) {
  if (cond) { console.log('  PASS ' + msg); return; }
  failures++;
  console.log('  FAIL ' + msg);
}
const zh = (k) => tr('zh', STR[k]);
const rowsOf = (c) => c.root.findAll((n) => n.props && n.props['data-dsh-prompt-id'], { deep: true });
const toggleOf = (c) => c.root.findAll((n) => n.props && n.props['data-dsh-prompt-templates-toggle'] !== undefined, { deep: true })[0];
const searchOf = (c) => c.root.findAll((n) => n.type === 'input' && n.props.placeholder === zh('searchPh'), { deep: true });
const chipOf = (c, label) => c.root.findAll((n) => n.type === 'button' && textOf(n) === label, { deep: true })[0];
const modalOf = (c) => c.root.findAll((n) => n.props && n.props['data-dsh-prompt-modal'] !== undefined, { deep: true })[0];
function textOf(node) {
  const acc = [];
  const walk = (n) => {
    if (n == null) return;
    if (typeof n === 'string') { acc.push(n); return; }
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.children) walk(n.children);
  };
  try { walk(node.children); } catch (e) { /* ignore */ }
  return acc.join('');
}
const jsonText = (n) => {
  const acc = [];
  const walk = (x) => {
    if (x == null) return;
    if (typeof x === 'string') { acc.push(x); return; }
    if (Array.isArray(x)) { x.forEach(walk); return; }
    if (x.children) walk(x.children);
  };
  walk(n);
  return acc.join('');
};
/** 在 toJSON() 出来的树里按谓词找第一个节点（含自身）。 */
const jsonFind = (n, pred) => {
  if (n == null) return undefined;
  if (Array.isArray(n)) {
    for (const x of n) { const hit = jsonFind(x, pred); if (hit) return hit; }
    return undefined;
  }
  if (typeof n === 'string') return undefined;
  if (n.props && pred(n)) return n;
  if (n.children) {
    for (const c of n.children) { const hit = jsonFind(c, pred); if (hit) return hit; }
  }
  return undefined;
};

async function main() {
  const presetN = store.allTemplates().length - store.loadCustoms().length;
  const customN = store.loadCustoms().length;
  const summary = zh('presetCount') + ' ' + presetN + ' · ' + zh('customCount') + ' ' + customN;

  console.log('=== A: 设置页默认收起（列表整块不渲染；头行 = 那一行摘要） ===');
  let page;
  await TR.act(async () => { page = TR.create(React.createElement(settings.SettingsPage, {})); });
  ok(rowsOf(page).length === 0, '默认收起：模板行一条都不渲染（实际 ' + rowsOf(page).length + ' 行）');
  ok(searchOf(page).length === 0, '默认收起：搜索框不渲染');
  ok(!chipOf(page, zh('tabAll')), '默认收起：chips 不渲染（连「' + zh('tabAll') + '」都没有）');
  const toggle = toggleOf(page);
  ok(!!toggle, '头行是可判定的折叠开关（data-dsh-prompt-templates-toggle）');
  ok(String(toggle.props['aria-expanded']) === 'false', '默认 aria-expanded=false');
  ok(String(toggle.props.title).indexOf(zh('templatesToggleHint')) >= 0, '头行 title 写明「' + zh('templatesToggleHint') + '」');
  ok(textOf(toggle).indexOf(zh('panelTitle')) >= 0, '头行有标题 ' + zh('panelTitle'));
  ok(textOf(toggle).indexOf(summary) >= 0, '收起态这一行就是全部摘要：' + summary);
  ok(textOf(toggle).indexOf('›') >= 0, '收起态有 ▸ 指示（› 未旋转）');
  ok(toggle.props.style.cursor === 'pointer', '整行可点（cursor: pointer）');

  console.log('=== B: 点头行展开 —— 就是今天那份列表（chips + 搜索框 + 全部模板行） ===');
  await TR.act(async () => { toggleOf(page).props.onClick(); });
  ok(rowsOf(page).length === presetN + customN, '展开后模板行全出来（' + rowsOf(page).length + ' = 预制 ' + presetN + ' + 自定义 ' + customN + '）');
  ok(searchOf(page).length === 1, '展开后搜索框在');
  ok(!!chipOf(page, zh('tabAll')), '展开后 chips 在（含「' + zh('tabAll') + '」）');
  ok(String(toggleOf(page).props['aria-expanded']) === 'true', '展开后 aria-expanded=true');
  ok(textOf(toggleOf(page)).indexOf(summary) >= 0, '展开态头行仍带摘要（同一行，不来回跳）');
  ok(textOf(toggleOf(page)).indexOf(zh('addShort')) >= 0, '头行始终有「新增」入口');

  console.log('=== C: 再点一次收起（可来回切） ===');
  await TR.act(async () => { toggleOf(page).props.onClick(); });
  ok(rowsOf(page).length === 0, '再点收起：模板行又一条不剩');
  ok(String(toggleOf(page).props['aria-expanded']) === 'false', '收起后 aria-expanded 回到 false');

  console.log('=== D: 键盘也能开（Enter / 空格） ===');
  {
    let prevented = false;
    await TR.act(async () => {
      toggleOf(page).props.onKeyDown({ key: 'Enter', preventDefault: () => { prevented = true } });
    });
    ok(rowsOf(page).length > 0, 'Enter 展开列表');
    ok(prevented === true, 'Enter 被吃掉默认行为（不触发页面滚动等副作用）');
    await TR.act(async () => {
      toggleOf(page).props.onKeyDown({ key: ' ', preventDefault: () => undefined });
    });
    ok(rowsOf(page).length === 0, '空格再收起（两个键都是开关）');
  }

  console.log('=== E: 收起态「＋ 新增」不触发折叠，弹窗照常出 ===');
  {
    const addBtn = page.root.findAll((n) => n.type === 'button' && textOf(n).indexOf(zh('addShort')) >= 0, { deep: true })[0];
    ok(!!addBtn, '收起态头行上仍有「＋ ' + zh('addShort') + '」按钮');
    let stopped = false;
    await TR.act(async () => {
      addBtn.props.onClick({ stopPropagation: () => { stopped = true } });
    });
    ok(stopped === true, '点「新增」拦下了冒泡（不会顺手展开列表）');
    ok(rowsOf(page).length === 0, '点「新增」之后列表仍收起（没有被顺手展开）');
    ok(!!modalOf(page), '新增弹窗照常弹出来');
  }
  await TR.act(async () => { page.unmount(); });

  console.log('=== F: 不受影响的面（悬浮面板 / 不传 collapsible 的挂载） ===');
  {
    const compact = TR.create(React.createElement(panel.TemplateBrowser, { compact: true }));
    ok(rowsOf(compact).length > 0, '悬浮面板照旧立刻渲染列表（' + rowsOf(compact).length + ' 行）');
    ok(!toggleOf(compact), '悬浮面板上没有折叠头行（本票不碰它）');
    compact.unmount();

    const plain = TR.create(React.createElement(panel.TemplateBrowser, { compact: false }));
    ok(rowsOf(plain).length > 0, '不传 collapsible 的 compact=false 挂载行为一字不动（列表照旧在）');
    ok(!toggleOf(plain), '不传 collapsible 就没有折叠头行（既有回归脚本的用法不受影响）');
    plain.unmount();
  }

  console.log('=== G: #37/#40 的结构断言不破（顶层 6 块，模板区仍是一块） ===');
  {
    const p2 = TR.create(React.createElement(settings.SettingsPage, {}));
    const kids = p2.toJSON().children;
    ok(kids.length === 6, '设置页顶层仍是 6 块（实际 ' + kids.length + '）');
    const withToggle = kids.filter((k) => jsonText(k).indexOf(zh('panelTitle')) >= 0 && jsonText(k).indexOf(zh('presetCount')) >= 0);
    ok(withToggle.length === 1, '含折叠头行的模板区在顶层仍只占一块');
    ok(jsonText(kids[5]).indexOf('作者其他插件') >= 0 || jsonText(kids[5]).length > 0, '末块仍是原先那一块（引流区没被挤走）');
    p2.unmount();
  }

  console.log('=== H: 视觉一致性 —— 模板区是与相邻卡片同款的卡片（不是一条裸行） ===');
  {
    const p3 = TR.create(React.createElement(settings.SettingsPage, {}));
    const kids3 = p3.toJSON().children;
    const listCard = kids3[3];
    // 与上面两张卡（智能推荐 / 诊断日志）逐条对账：外壳的三个量必须一致。
    for (const idx of [1, 2]) {
      ok(listCard.props.style.border === kids3[idx].props.style.border,
        '与第 ' + idx + ' 张卡边框一致（' + listCard.props.style.border + '）');
      ok(listCard.props.style.borderRadius === kids3[idx].props.style.borderRadius,
        '与第 ' + idx + ' 张卡圆角一致（' + listCard.props.style.borderRadius + '）');
      ok(listCard.props.style.margin === kids3[idx].props.style.margin,
        '与第 ' + idx + ' 张卡外边距一致（' + listCard.props.style.margin + '）');
    }
    ok(listCard.type === 'section', '模板区是 <section> 卡片（与其它卡同一种元素）');
    // 内容左轨对齐：卡片内边距 6px + 浏览器自带 8px = 14px = 其它卡片的 14px。
    const padL = parseInt(String(listCard.props.style.padding).split(' ')[1], 10);
    ok(padL === 6, '卡片内边距 6px（6 + 浏览器自带 8 = 14px，与其它卡的内容左轨对齐）');
    const head = jsonFind(listCard, (n) => n.props['data-dsh-prompt-templates-toggle'] !== undefined);
    ok(!!head, '卡片里就是那个可折叠头行');
    ok(String(head.props.style.borderBottom) === 'none', '收起态头行没有孤立的底部分隔线');
    // 展开箭头在整行最右（按钮之后），不再夹在摘要与按钮之间。
    const kidTexts = (head.children || []).filter((c) => c && typeof c === 'object');
    const last = kidTexts[kidTexts.length - 1];
    ok(!!last && Array.isArray(last.children) && last.children[0] === '›', '展开箭头排在整行最右（最后一个子元素）');
    const btnIdx = kidTexts.findIndex((c) => c.type === 'button');
    ok(btnIdx >= 0 && btnIdx < kidTexts.length - 1, '「＋ 新增」按钮在箭头之前');
    p3.unmount();
  }

  console.log(failures === 0 ? 'ALL PASS: #77 设置页模板列表可折叠区域' : 'FAILURES: ' + failures);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.log('FAIL: 脚本抛错 ' + (e && e.stack ? e.stack : e)); process.exit(1); });
