// 回归测试 #167：远程放大下 Prompt 头行重叠 + 新增按钮背景圈不跟字
// 根因（诊断 R1+R2）：
//  R1：头容器单行 flex 不换行 + 计数可换行无收缩保护 → 高档总宽溢出，计数先被压竖排再与标题重叠。
//      修法：头行允许换行利用纵向空白（flexWrap:wrap，默认两行；1x 单行像素不变）；
//            标题与计数 nowrap + flex:none（短串 1x 无视觉差，高档整块换行不再内部压竖排）；
//            垫片 minWidth:0（空 div，1x 无差，高档先压到 0 再换行）。
//  R2：新增按钮高度钉死 26px（覆盖漏了高度）+ 纵向 padding 未 em 化 → 字大后背景上下包不住。
//      修法：height:auto + 纵向 padding em 化（1x 总高与旧 26px 一致，之后同比放大）；
//            横向已 em 化保留，nowrap + flex:none 保留。设置页折叠头行与悬浮底栏两枚同形，一并修。
// 验收映射（#167 Agent Brief Q1–Q3 默认答案）：
//  A) 头行换行：toggle 头容器 flexWrap:wrap（修前缺失必红）+ rowGap + minWidth:0
//  B) 标题/计数整块：nowrap + flex:none（修前计数可换行必红）
//  C) 新增按钮背景跟字：height:auto + 纵向 padding 含 em（修前 height:26 必红）；横向/圆角/单行锁保留
//  D) 无回归：默认收起零行（#77）；设置页根缩放基准不变；compact 悬浮分支不崩
const fs = require('node:fs');
const path = require('node:path');
const { buildFlat } = require('./lib/transpile-client.cjs');
const DIR = path.join(__dirname, '.rt-tmp-167');
const ROOT = path.join(__dirname, '..');
const SRC = (n) => path.join(ROOT, 'src', 'client', n);

let failures = 0;
function fail(msg) { failures++; console.log('FAIL: ' + msg); }
function ok(msg) { console.log(' ok: ' + msg); }

buildFlat(DIR, [SRC('panel.ts')]);
const React = require('react');
const TR = require('react-test-renderer');
const req = (n) => require(path.join(DIR, n + '.cjs'));
const panelMod = req('panel');
try { const sm = req('store'); if (sm.saveHidePreset) sm.saveHidePreset(false); } catch (e) {}

let page;
try {
  TR.act(() => { page = TR.create(React.createElement(panelMod.TemplateBrowser, { compact: false, collapsible: true })); });
} catch (e) { fail('TemplateBrowser compact:false collapsible:true 挂载应成功，实际抛错 ' + (e && e.message)); }

const toggleOf = (root) => root.findAll((n) => n.props && n.props['data-dsh-prompt-templates-toggle'] !== undefined)[0];

// ── A) 头行换行：flexWrap:wrap + rowGap + minWidth:0（修前无 wrap 必红） ──
if (page) {
  const toggle = toggleOf(page.root);
  if (!toggle) fail('应找到折叠开关头行（data-dsh-prompt-templates-toggle）');
  else {
    const st = toggle.props.style || {};
    if (st.display !== 'flex') fail('头行应保持 display:flex，实际 ' + JSON.stringify(st.display));
    if (st.flexWrap !== 'wrap') fail('头行应 flexWrap:wrap（利用纵向空白默认两行），实际 ' + JSON.stringify(st.flexWrap));
    if (st.minWidth !== 0) fail('头行应 minWidth:0（允许收缩后换行），实际 ' + JSON.stringify(st.minWidth));
    if (typeof st.rowGap === 'undefined') fail('头行应带 rowGap（多行时行距，1x 单行无影响），实际缺失');
    else if (!/em/.test(String(st.rowGap))) fail('头行 rowGap 应 em 化（跟档，禁 px），实际 ' + JSON.stringify(st.rowGap));
    if (failures === 0) ok('头行：flexWrap:wrap + rowGap + minWidth:0');
  }
}

// ── B) 标题/计数整块：nowrap + flex:none（修前计数可换行必红） ──
if (page) {
  const toggle = toggleOf(page.root);
  if (toggle) {
    const spans = toggle.findAll((n) => n.type === 'span' && n.props && n.props.style);
    const title = spans.filter((n) => n.props.style.fontWeight === 700)[0];
    if (!title) fail('头行内应找到标题 span（fontWeight 700）');
    else {
      if (title.props.style.whiteSpace !== 'nowrap') fail('标题应 whiteSpace:nowrap，实际 ' + JSON.stringify(title.props.style.whiteSpace));
      if (title.props.style.flex !== 'none') fail('标题应 flex:none，实际 ' + JSON.stringify(title.props.style.flex));
    }
    const count = spans.filter((n) => n.props.style.fontSize === '0.85em' && n.props.style.marginLeft === 6)[0];
    if (!count) fail('头行内应找到计数 span（0.85em + marginLeft 6）');
    else {
      if (count.props.style.whiteSpace !== 'nowrap') fail('计数应 whiteSpace:nowrap（整块换行，不内部压竖排），实际 ' + JSON.stringify(count.props.style.whiteSpace));
      if (count.props.style.flex !== 'none') fail('计数应 flex:none（内容多宽就多宽，绝不被压窄），实际 ' + JSON.stringify(count.props.style.flex));
    }
    const spacer = toggle.findAll((n) => n.type === 'div' && n.props && n.props.style && n.props.style.flex === 1)[0];
    if (!spacer) fail('头行内应找到弹性垫片（flex:1）');
    else if (spacer.props.style.minWidth !== 0) fail('垫片应 minWidth:0（高档先压到 0 再换行），实际 ' + JSON.stringify(spacer.props.style.minWidth));
    if (failures === 0) ok('标题/计数：整块 nowrap + flex:none；垫片 minWidth:0');
  }
}

// ── C) 新增按钮背景跟字：height:auto + 纵向 padding em 化（修前 height:26 必红） ──
if (page) {
  const toggle = toggleOf(page.root);
  if (toggle) {
    const btns = toggle.findAll((n) => n.type === 'button' && n.props && n.props.style && n.props.style.width === 'auto');
    const plusAdd = btns.filter((n) => {
      try { return String((n.children || []).join('')).indexOf('＋') === 0; } catch (e) { return false; }
    })[0];
    if (!plusAdd) fail('头行内应找到「＋ 新增」按钮（width auto）');
    else {
      const st = plusAdd.props.style;
      if (st.height !== 'auto') fail('新增按钮高度应 height:auto（内容自适应，修前钉死 26），实际 ' + JSON.stringify(st.height));
      const pad = String(st.padding || '');
      const parts = pad.split(' ');
      if (parts.length < 2 || !/em/.test(parts[0] || '')) fail('新增按钮纵向 padding 应 em 化（跟档放大，1x 总高与旧 26px 一致），实际 padding=' + JSON.stringify(st.padding));
      if (!/em/.test(parts[1] || parts[0] || '')) fail('新增按钮横向 padding 应保持 em 化，实际 padding=' + JSON.stringify(st.padding));
      if (st.fontSize !== '0.92em') fail('新增按钮字号应保持 0.92em，实际 ' + JSON.stringify(st.fontSize));
      if (st.whiteSpace !== 'nowrap') fail('新增按钮应保留 nowrap 锁单行，实际 ' + JSON.stringify(st.whiteSpace));
      if (st.flex !== 'none') fail('新增按钮应保留 flex:none 不被挤，实际 ' + JSON.stringify(st.flex));
    }
    if (failures === 0) ok('新增按钮：height:auto + 纵向 padding em 化，横向/单行锁保留');
  }
}

// ── C2) 悬浮底栏同形按钮一并跟字（同根因 siblings，防留一枚仍钉死） ──
{
  let compact;
  try {
    TR.act(() => { compact = TR.create(React.createElement(panelMod.TemplateBrowser, { compact: true })); });
  } catch (e) { fail('compact 悬浮分支挂载应成功，实际抛错 ' + (e && e.message)); }
  if (compact) {
    const rows = compact.root.findAll((n) => n.props && n.props['data-dsh-prompt-row'] === '1');
    const scope = rows.length > 0 ? rows[0] : compact.root;
    const btns = scope.findAll((n) => n.type === 'button' && n.props && n.props.style && n.props.style.width === 'auto');
    const plusAdd = btns.filter((n) => {
      try { return String((n.children || []).join('')).indexOf('＋') === 0; } catch (e) { return false; }
    })[0];
    if (!plusAdd) fail('悬浮底栏应找到「＋ 新增」按钮（width auto）');
    else if (plusAdd.props.style.height !== 'auto') fail('悬浮底栏新增按钮高度亦应 height:auto（同形同修），实际 ' + JSON.stringify(plusAdd.props.style.height));
    if (failures === 0) ok('悬浮底栏：同形按钮一并 height:auto');
  }
}

// ── D) 无回归：默认收起零行 + 展开渲染不崩 ──
if (page) {
  const rowsClosed = page.root.findAll((n) => n.props && n.props['data-dsh-prompt-id']);
  if (rowsClosed.length !== 0) fail('默认收起模板行应为 0（#77 语义），实际 ' + rowsClosed.length);
  const toggle = toggleOf(page.root);
  if (toggle) TR.act(() => { toggle.props.onClick(); });
  const rowsOpen = page.root.findAll((n) => n.props && n.props['data-dsh-prompt-id']);
  if (rowsOpen.length === 0) fail('点开展开后模板行应渲染');
  if (failures === 0) ok('默认收起/展开语义不变');
}

if (failures > 0) { console.log('\nRESULT: FAIL (' + failures + ')'); process.exit(1); }
console.log('\nRESULT: PASS');
