// 回归测试 #74: 设置页行折叠（compact=false 分支）
// 验收映射（#74 Brief）：
//  A) 默认折叠：设置页行默认无简介节点；单行只显示图钉 + 用量徽标 + 名称 + 标签 + 操作
//  B) 点击行展开/收起简介（切换同一行；其余行不动）；展开态组件局部 useState，不进 store
//  C) 行末徽标位置保持（P5b 结果：acts 之后行末；折叠/展开态一致，样式只读）
//  D) 悬浮 compact 分支行为一行不改（默认有简介；点击不折叠）
//  E) #61 管理面语义：点击只做展开，不涨用量、不触发插入、不关窗（无 customs/pinned/usage 变化）
//  F) 顶部云区一行不碰（范围钮 + 行动词云存在且可滤）
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }
const DIR = path.join(__dirname, '.rt-tmp');
fs.mkdirSync(DIR, { recursive: true });
const SRC = (f) => path.join(__dirname, '..', 'src', 'client', f);
// 独立文件名（不与别家互压）：*74.cjs
const MODULES = [
  ['templates74.cjs', SRC('templates.ts'), []],
  ['store74.cjs', SRC('store.ts'), ['./templates']],
  ['state74.cjs', SRC('state.ts'), []],
  ['i1874.cjs', SRC('i18n.ts'), []],
  ['smartstore74.cjs', SRC('smartstore.ts'), []],
  ['panel74.cjs', SRC('panel.ts'), ['./templates', './store', './state', './i18n', './smartstore']],
];
for (const [outName, srcPath, deps] of MODULES) {
  let src = fs.readFileSync(srcPath, 'utf8');
  let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true } }).outputText;
  for (const d of deps) {
    const base = d.replace(/^\.\//, '');
    const outBase = base === 'i18n' ? 'i1874.cjs' : base + '74.cjs';
    js = js.split('require("' + d + '")').join('require("./' + outBase + '")');
    js = js.split("require('" + d + "')").join('require("./' + outBase + '")');
  }
  fs.writeFileSync(path.join(DIR, outName), js);
}
const React = require('react');
const TR = require('react-test-renderer');
const req = (n) => require(path.join(DIR, n));
const store = req('store74.cjs');
const panel = req('panel74.cjs');

function assert(cond, msg) {
  if (!cond) { console.log('FAIL: ' + msg); process.exit(1); }
  console.log(' ok: ' + msg);
}
const rowById = (tree, id) =>
  tree.root.findAll((n) => n.props && n.props['data-dsh-prompt-id'] === id, { deep: true })[0];
const rowIds = (tree) =>
  tree.root.findAll((n) => n.props && n.props['data-dsh-prompt-id'], { deep: true }).map((n) => n.props['data-dsh-prompt-id']);
const rowHasText = (row, s) => {
  try {
    return row.findAll((n) => n.children && Array.isArray(n.children) && n.children.length === 1 && n.children[0] === s, { deep: true }).length > 0;
  } catch (e) { return false; }
};
const rowStrings = (row) => {
  const acc = [];
  const walk = (n) => {
    if (n == null) return;
    if (typeof n === 'string') { acc.push(n); return; }
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n.children) walk(n.children);
  };
  try { walk(row.children); } catch (e) { /* ignore */ }
  return acc;
};
const textOf = (n) => (Array.isArray(n.children) ? n.children.filter((c) => typeof c === 'string').join('') : '');
const byButton = (tree, s) => tree.root.findAll((n) => n.type === 'button' && textOf(n) === s);
const directKids = (row) =>
  (row.children || []).filter((c) => c && typeof c !== 'string' && c.type);
const findBadgeKid = (row) => {
  const kids = directKids(row);
  const matches = kids.filter((k) => k.props && typeof k.props.title === 'string' && /^已使用 \d+ 次$/.test(k.props.title));
  const badge = matches.length > 0 ? matches[matches.length - 1] : undefined;
  const idx = badge ? kids.lastIndexOf(badge) : -1;
  return { kids, badge, idx };
};
// 设置页简介串（与 panel 设置页分支同式：body 前 44 字 + …）
const introOf = (t) => ((t.body || '').slice(0, 44) + '…');

async function main() {
  console.log('=== Test #74 A: 默认折叠（无简介节点；单行五件套） ===');
  store.savePinned([]);
  store.bumpUsage('fp'); store.bumpUsage('fp');
  store.bumpUsage('deep');
  const usageBase = JSON.stringify(store.loadUsage());
  const customsBase = store.loadCustoms().length;
  const pinnedBase = JSON.stringify(store.loadPinned());
  let full;
  TR.act(() => { full = TR.create(React.createElement(panel.TemplateBrowser, { compact: false })); });
  const fp = store.getTemplate('fp');
  const deep = store.getTemplate('deep');
  assert(!!rowById(full, 'fp'), '设置页行 fp 存在');
  assert(!!rowById(full, 'deep'), '设置页行 deep 存在');
  assert(typeof rowById(full, 'fp').props.onClick === 'function', '设置页行有 onClick（折叠开关）');
  assert(!rowHasText(rowById(full, 'fp'), introOf(fp)), '默认折叠：fp 无简介节点');
  assert(!rowHasText(rowById(full, 'deep'), introOf(deep)), '默认折叠：deep 无简介节点');
  for (const t of store.allTemplates()) {
    assert(!rowHasText(rowById(full, t.id), introOf(t)), '默认折叠：' + t.id + ' 无简介节点');
  }
  // 单行仍有名称 + 标签 + 徽标 + 操作（图钉包 + 操作区均含 button）
  assert(rowHasText(rowById(full, 'fp'), fp.name), '折叠单行仍有名称');
  assert(rowHasText(rowById(full, 'fp'), store.labelString(fp)), '折叠单行仍有标签串');
  {
    const r = rowById(full, 'fp');
    const btns = r.findAll((x) => x.type === 'button', { deep: true });
    assert(btns.length >= 2, '折叠单行仍有图钉 + 操作按钮（实得 ' + btns.length + '）');
    const { badge } = findBadgeKid(r);
    assert(!!badge, '折叠单行仍有用量徽标');
  }

  console.log('=== Test #74 B: act 点行展开 / 再点收起（只切同一行） ===');
  TR.act(() => { rowById(full, 'fp').props.onClick(); });
  TR.act(() => {});
  assert(rowHasText(rowById(full, 'fp'), introOf(fp)), '点行展开：fp 出现简介');
  assert(!rowHasText(rowById(full, 'deep'), introOf(deep)), '只切同一行：deep 仍无简介');
  TR.act(() => { rowById(full, 'fp').props.onClick(); });
  TR.act(() => {});
  assert(!rowHasText(rowById(full, 'fp'), introOf(fp)), '再点收起：fp 简介消失');
  TR.act(() => { rowById(full, 'deep').props.onClick(); });
  TR.act(() => {});
  assert(rowHasText(rowById(full, 'deep'), introOf(deep)), '点 deep 展开：deep 出现简介');
  assert(!rowHasText(rowById(full, 'fp'), introOf(fp)), '点 deep 不影响 fp（fp 仍收起）');
  TR.act(() => { rowById(full, 'deep').props.onClick(); });
  TR.act(() => {});
  assert(!rowHasText(rowById(full, 'deep'), introOf(deep)), 'deep 再点收起恢复基线');

  console.log('=== Test #74 C: 徽标仍行末（折叠/展开态一致） ===');
  for (const [label, prep] of [['折叠态', null], ['展开态', 'fp']]) {
    if (prep) { TR.act(() => { rowById(full, prep).props.onClick(); }); TR.act(() => {}); }
    const r = rowById(full, 'fp');
    const { kids, badge, idx } = findBadgeKid(r);
    assert(!!badge, label + '：徽标存在');
    assert(idx === kids.length - 1, label + '：徽标在行最末尾（实得 ' + idx + ' / ' + (kids.length - 1) + '）');
    assert(kids[kids.length - 1] === badge, label + '：行最后一个直属元素即徽标');
    const actsHasBtn = (() => { try { return kids[kids.length - 2].findAll((x) => x.type === 'button', { deep: true }).length > 0; } catch (e) { return false; } })();
    assert(actsHasBtn, label + '：徽标紧跟操作区之后');
    if (prep) { TR.act(() => { rowById(full, prep).props.onClick(); }); TR.act(() => {}); }
  }

  console.log('=== Test #74 D: compact 行无折叠行为（一行不改） ===');
  let compact;
  TR.act(() => { compact = TR.create(React.createElement(panel.TemplateBrowser, { compact: true })); });
  const fpC = rowById(compact, 'fp');
  assert(!!fpC, 'compact 行 fp 存在');
  const cIntro = ((fp.body || '').split('\n')[0].trim());
  assert(rowHasText(fpC, cIntro), 'compact 默认有简介（折叠仅设置页）');
  TR.act(() => { rowById(compact, 'fp').props.onClick(); });
  TR.act(() => {});
  assert(rowHasText(rowById(compact, 'fp'), cIntro), 'compact 点击后简介仍在（无折叠行为）');
  {
    const r = rowById(compact, 'fp');
    const { kids, badge, idx } = findBadgeKid(r);
    assert(!!badge && idx === kids.length - 1, 'compact 徽标仍行末（一行不改）');
  }

  console.log('=== Test #74 E: 不涨用量 / 不进 store（#61 管理面语义） ===');
  assert(JSON.stringify(store.loadUsage()) === usageBase, '点击折叠不涨用量');
  assert(store.loadCustoms().length === customsBase, '点击折叠不新增自定义');
  assert(JSON.stringify(store.loadPinned()) === pinnedBase, '点击折叠不动置顶');

  console.log('=== Test #74 F: 顶部云区一行不碰 ===');
  let full2;
  TR.act(() => { full2 = TR.create(React.createElement(panel.TemplateBrowser, { compact: false })); });
  assert(!!byButton(full2, '预置')[0] && !!byButton(full2, '自定义')[0], '范围钮预置/自定义存在');
  assert(!!byButton(full2, '启动')[0], '行动词云「启动」存在');
  const wantStart = store.allTemplates().filter((t) => store.matchLabel(t, '启动')).map((t) => t.id).sort();
  TR.act(() => { byButton(full2, '启动')[0].props.onClick(); });
  TR.act(() => {});
  assert(JSON.stringify(rowIds(full2).sort()) === JSON.stringify(wantStart), '云「启动」仍 == matchLabel 集');
  TR.act(() => { byButton(full2, '启动')[0].props.onClick(); });
  TR.act(() => {});
  assert(rowIds(full2).length === store.allTemplates().length, '云 toggle 回全部');

  try { full.unmount(); } catch (e) {}
  try { compact.unmount(); } catch (e) {}
  try { full2.unmount(); } catch (e) {}
  console.log('=== Test #74 PASS ===');
}

main().then(() => process.exit(0), (e) => { console.log('FAIL: ' + (e && e.stack || e)); process.exit(1); });
