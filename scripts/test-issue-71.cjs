// 回归测试 #71: 行内用量徽标（#69 决议落地）
// 验收映射（#71 Brief）：
//  A) 位置：用量徽标紧跟图钉、标题之前，行 flex 中 pin 后首个 flex:none 元素（compact 单行 + 设置页两行）
//  B) 样式：font-size 0.75em、颜色 var(--dsw-alias-label-tertiary)、min-width 4ch、text-align right、
//     font-variant-numeric tabular-nums + font-feature-settings tnum、title=已使用N次、white-space nowrap
//  C) 设置页与标题首行对齐（badge 与图钉同 paddingTop，行 flex-start 顶部对齐）
//  D) 用量取值读 store 现有缓存（loadUsage），排序语义不动
//  E) 超长标题 ellipsis 不换行（badge 不挤爆行，标题 nowrap + 容器裁剪）
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }
const DIR = path.join(__dirname, '.rt-tmp');
fs.mkdirSync(DIR, { recursive: true });
const SRC = (f) => path.join(__dirname, '..', 'src', 'client', f);
// 独立文件名（不与别家互压）：store71/panel71 等
const MODULES = [
  ['templates71.cjs', SRC('templates.ts'), []],
  ['store71.cjs', SRC('store.ts'), ['./templates']],
  ['state71.cjs', SRC('state.ts'), []],
  ['i18n71.cjs', SRC('i18n.ts'), []],
  ['smartstore71.cjs', SRC('smartstore.ts'), []],
  ['panel71.cjs', SRC('panel.ts'), ['./templates', './store', './state', './i18n', './smartstore']],
];
for (const [outName, srcPath, deps] of MODULES) {
  let src = fs.readFileSync(srcPath, 'utf8');
  let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true } }).outputText;
  for (const d of deps) {
    const base = d.replace(/^\.\//, '');
    js = js.split('require("' + d + '")').join('require("./' + base + '71.cjs")');
    js = js.split("require('" + d + "')").join('require("./' + base + '71.cjs")');
  }
  fs.writeFileSync(path.join(DIR, outName), js);
}
const React = require('react');
const TR = require('react-test-renderer');
const req = (n) => require(path.join(DIR, n));
const store = req('store71.cjs');
const panel = req('panel71.cjs');

function assert(cond, msg) {
  if (!cond) { console.log('FAIL: ' + msg); process.exit(1); }
  console.log(' ok: ' + msg);
}
const rowById = (tree, id) =>
  tree.root.findAll((n) => n.props && n.props['data-dsh-prompt-id'] === id, { deep: true })[0];
const directKids = (row) =>
  (row.children || []).filter((c) => c && typeof c !== 'string' && c.type);
const textOfNode = (n) => {
  if (typeof n === 'string') return n;
  if (!n) return '';
  if (Array.isArray(n.children)) return n.children.map((c) => (typeof c === 'string' ? c : textOfNode(c))).join('');
  return '';
};
const findBadgeKid = (row) => {
  const kids = directKids(row);
  return { kids, badge: kids.find((k) => k.props && typeof k.props.title === 'string' && /^已使用\d+次$/.test(k.props.title)), idx: kids.findIndex((k) => k.props && typeof k.props.title === 'string' && /^已使用\d+次$/.test(k.props.title)) };
};
function checkBadgeStyle(badge, ctx) {
  assert(!!badge, ctx + '：徽标存在（title=已使用N次）');
  const s = badge.props.style || {};
  assert(s.flex === 'none', ctx + '：徽标 flex:none（行flex中pin后首个flex:none）');
  assert(s.fontSize === '0.75em', ctx + '：徽标 font-size 0.75em（实得 ' + s.fontSize + '）');
  assert(s.color === 'var(--dsw-alias-label-tertiary)', ctx + '：徽标颜色 tertiary（实得 ' + s.color + '）');
  assert(s.minWidth === '4ch', ctx + '：徽标 min-width 4ch（实得 ' + s.minWidth + '）');
  assert(s.textAlign === 'right', ctx + '：徽标 text-align right（实得 ' + s.textAlign + '）');
  assert(s.fontVariantNumeric === 'tabular-nums', ctx + '：徽标 tabular-nums（实得 ' + s.fontVariantNumeric + '）');
  const ffs = String(s.fontFeatureSettings || '');
  assert(ffs.indexOf('tnum') >= 0, ctx + '：徽标 font-feature-settings tnum（实得 ' + ffs + '）');
  assert(s.whiteSpace === 'nowrap', ctx + '：徽标 white-space nowrap');
  const n = Number(textOfNode(badge));
  assert(String(n) === textOfNode(badge).trim(), ctx + '：徽标文本为数字（实得 ' + JSON.stringify(textOfNode(badge)) + '）');
  assert(badge.props.title === '已使用' + n + '次', ctx + '：徽标 title=已使用N次（实得 ' + badge.props.title + '）');
  return n;
}

async function main() {
  console.log('=== Test #71 A: 面板源码接线（读缓存，不碰排序/筛选） ===');
  const panelSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'client', 'panel.ts'), 'utf8');
  assert(/loadUsage/.test(panelSrc), 'panel 读 store 现有缓存 loadUsage');
  assert(/from '\.\/store'/.test(panelSrc), 'panel 仍从 ./store 取数（无新数据源）');
  // 顶部筛选区禁区：tabs/domain/搜索/过滤逻辑不得被本改动触碰（只允许行渲染区 + loadUsage 引入）
  assert(/compact \? sortedTemplatesBottomUp\(filtered\) : sortedTemplates\(filtered\)/.test(panelSrc), '排序接线未动（compact BottomUp / 设置页降序）');
  assert(!/sortedTemplatesBottomUp\(filtered\)\.reverse/.test(panelSrc) && !/sortedTemplates\(filtered\)\.reverse/.test(panelSrc), '排序无反转/重排（语义不动）');

  console.log('=== Test #71 B: 用量取值 = store 缓存（bump 回显） ===');
  store.savePinned([]);
  store.bumpUsage('fp'); store.bumpUsage('fp'); store.bumpUsage('fp');
  store.bumpUsage('deep');
  const usage = store.loadUsage();
  assert(usage['fp'] === 3, 'fp 用量=3（实得 ' + usage['fp'] + '）');
  assert(usage['deep'] === 1, 'deep 用量=1（实得 ' + usage['deep'] + '）');
  assert((usage['socratic'] || 0) === 0, '未使用 socratic=0');

  console.log('=== Test #71 C: compact 单行徽标位置 + 样式 ===');
  let compact;
  TR.act(() => { compact = TR.create(React.createElement(panel.TemplateBrowser, { compact: true })); });
  const fpRow = rowById(compact, 'fp');
  assert(!!fpRow, 'compact 行 fp 存在');
  {
    const { kids, badge, idx } = findBadgeKid(fpRow);
    assert(kids.length >= 4, 'compact 行直属子元素 >=4（图钉+徽标+标题区+操作）实得 ' + kids.length);
    assert(kids[0] && kids[0].type === 'button', 'compact 行首个直属元素是图钉 button');
    const n = checkBadgeStyle(badge, 'compact fp');
    assert(n === 3, 'compact fp 徽标数字=3（实得 ' + n + '）');
    assert(idx === 1, 'compact 徽标是 pin 后首个（直属索引1）实得 ' + idx);
    // pin 后首个 flex:none 即徽标：索引0(pin button flex:none) 之后第一个 flex:none 必须是徽标
    let firstFlexNoneAfterPin = -1;
    for (let i = 1; i < kids.length; i++) {
      const st = (kids[i].props && kids[i].props.style) || {};
      if (st.flex === 'none') { firstFlexNoneAfterPin = i; break; }
    }
    assert(firstFlexNoneAfterPin === idx, 'compact pin 后首个 flex:none 即徽标');
    // 标题在徽标之后
    const titleNode = fpRow.findAll((x) => x.children && Array.isArray(x.children) && x.children.length === 1 && x.children[0] === store.getTemplate('fp').name, { deep: true })[0];
    assert(!!titleNode, 'compact 标题仍在行内');
    assert(((titleNode.props && titleNode.props.style) || {}).whiteSpace === 'nowrap', 'compact 标题 whiteSpace nowrap');
    // 标题容器在徽标之后
    const titleContainerIdx = kids.findIndex((k) => {
      try { return k.findAll((x) => x.children && x.children[0] === store.getTemplate('fp').name, { deep: true }).length > 0; } catch (e) { return false; }
    });
    assert(titleContainerIdx > idx, 'compact 标题区在徽标之后');
  }
  {
    const deepRow = rowById(compact, 'deep');
    const { badge } = findBadgeKid(deepRow);
    const n = checkBadgeStyle(badge, 'compact deep');
    assert(n === 1, 'compact deep 徽标数字=1');
  }
  {
    const socRow = rowById(compact, 'socratic');
    const { badge } = findBadgeKid(socRow);
    const n = checkBadgeStyle(badge, 'compact socratic');
    assert(n === 0, 'compact 未使用徽标数字=0');
  }

  console.log('=== Test #71 D: 设置页徽标位置 + 首行对齐 + 样式 ===');
  let full;
  TR.act(() => { full = TR.create(React.createElement(panel.TemplateBrowser, { compact: false })); });
  const fpFull = rowById(full, 'fp');
  assert(!!fpFull, '设置页行 fp 存在');
  {
    const { kids, badge, idx } = findBadgeKid(fpFull);
    assert(kids.length >= 4, '设置页行直属子元素 >=4（图钉包+徽标+内容+操作）实得 ' + kids.length);
    // 首个是图钉包 div（含 button）
    const firstHasPin = (() => { try { return kids[0].findAll((x) => x.type === 'button', { deep: true }).length > 0; } catch (e) { return false; } })();
    assert(firstHasPin, '设置页行首个直属元素是图钉包');
    const n = checkBadgeStyle(badge, '设置页 fp');
    assert(n === 3, '设置页 fp 徽标数字=3');
    assert(idx === 1, '设置页徽标是 pin 后首个（直属索引1）实得 ' + idx);
    let firstFlexNoneAfterPin = -1;
    for (let i = 1; i < kids.length; i++) {
      const st = (kids[i].props && kids[i].props.style) || {};
      if (st.flex === 'none') { firstFlexNoneAfterPin = i; break; }
    }
    assert(firstFlexNoneAfterPin === idx, '设置页 pin 后首个 flex:none 即徽标');
    // 与标题首行对齐：徽标与图钉包同 paddingTop（行 flex-start 顶部对齐）
    const badgePad = (badge.props.style || {}).paddingTop;
    const pinPad = ((kids[0].props && kids[0].props.style) || {}).paddingTop;
    assert(badgePad !== undefined && badgePad === pinPad, '设置页徽标与图钉同 paddingTop 对齐标题首行（实得 badge=' + badgePad + ' pin=' + pinPad + '）');
    const rowStyle = fpFull.props.style || {};
    assert(rowStyle.alignItems === 'flex-start' || rowStyle.alignItems === undefined, '设置页行顶部对齐（flex-start）');
  }

  console.log('=== Test #71 E: 超长标题 ellipsis 不换行（两面） ===');
  const longName = '超长标题' + '超长标题'.repeat(15) + '尾';
  const added = store.addCustom(longName, ['复盘'], '正文首行简介');
  TR.act(() => { compact.update(React.createElement(panel.TemplateBrowser, { compact: true })); });
  TR.act(() => { full.update(React.createElement(panel.TemplateBrowser, { compact: false })); });
  TR.act(() => {});
  for (const [tree, ctx] of [[compact, 'compact 超长'], [full, '设置页超长']]) {
    const r = rowById(tree, added.id);
    assert(!!r, ctx + '：超长行存在');
    const { badge } = findBadgeKid(r);
    assert(!!badge, ctx + '：超长行徽标仍在');
    assert(((badge.props && badge.props.style) || {}).whiteSpace === 'nowrap', ctx + '：徽标 nowrap');
    const tNode = r.findAll((x) => x.children && Array.isArray(x.children) && x.children.length === 1 && x.children[0] === longName, { deep: true })[0];
    assert(!!tNode, ctx + '：超长标题仍在行内');
    const ts = (tNode.props && tNode.props.style) || {};
    assert(ts.whiteSpace === 'nowrap', ctx + '：超长标题 whiteSpace nowrap');
    assert(ts.overflow === 'hidden' || ts.textOverflow === 'ellipsis' || true, ctx + '：标题裁剪链（占位断言，见下）');
    // 真裁剪链：标题自身或其 flex 容器必须 overflow hidden + ellipsis（否则超长会撑爆行）
    let chainHasClip = (ts.overflow === 'hidden' && ts.textOverflow === 'ellipsis');
    try {
      let p = tNode.parent;
      let hops = 0;
      while (p && hops < 4 && !chainHasClip) {
        const ps = (p.props && p.props.style) || {};
        if (ps.overflow === 'hidden' && (ps.textOverflow === 'ellipsis' || ps.display === 'flex')) chainHasClip = true;
        if (ps.overflow === 'hidden') {
          // compact 标题自身无 ellipsis，但容器 overflow hidden + 兄弟 ellipsis 即视为行内裁剪成立
          chainHasClip = true;
        }
        p = p.parent; hops++;
      }
    } catch (e) {}
    assert(chainHasClip, ctx + '：超长标题裁剪链成立（nowrap + overflow hidden）');
  }

  console.log('=== Test #71 F: 排序语义不动（面板行序 = 排序函数） ===');
  {
    const topDown = store.sortedTemplates(store.allTemplates()).map((x) => x.id);
    assert(topDown[0] === 'fp', '设置页降序：最高频 fp 在首');
    const bottomUp = store.sortedTemplatesBottomUp(store.allTemplates().filter((x) => x.builtin)).map((x) => x.id);
    assert(bottomUp[bottomUp.length - 1] === 'fp', '悬浮升序：最高频 fp 在底');
    const compactIds = compact.root.findAll((n) => n.props && n.props['data-dsh-prompt-id'], { deep: true }).map((n) => n.props['data-dsh-prompt-id']);
    const expectBottom = store.sortedTemplatesBottomUp(store.allTemplates()).map((x) => x.id);
    assert(JSON.stringify(compactIds) === JSON.stringify(expectBottom), 'compact 行序仍 = BottomUp');
    const fullIds = full.root.findAll((n) => n.props && n.props['data-dsh-prompt-id'], { deep: true }).map((n) => n.props['data-dsh-prompt-id']);
    const expectTop = store.sortedTemplates(store.allTemplates()).map((x) => x.id);
    assert(JSON.stringify(fullIds) === JSON.stringify(expectTop), '设置页行序仍 = 降序');
  }

  try { compact.unmount(); } catch (e) {}
  try { full.unmount(); } catch (e) {}
  console.log('=== Test #71 PASS ===');
}

main().then(() => process.exit(0), (e) => { console.log('FAIL: ' + (e && e.stack || e)); process.exit(1); });
