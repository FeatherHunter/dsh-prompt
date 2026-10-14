'use strict';
// 回归测试 #149（#150 起加严）：① prompt 小列表显示的条数上限 = 屏幕装得下的最大数量（不再固定 360/约 10 行）
//              ② 浮层重排：列表在上、底栏（tab 行 + 合并行）垫底、弹窗在最上
//              ③ 点设置入口真的打开插件设置页（宿主图标触发器 + 失败不再静默）
// 根因（R1）：紧凑浮层的列表区写死 maxHeight/height=360 —— 一屏能装 20+ 行，却只给约 10 行，用户看到「上限」。
// 修法：面板只封上限 maxHeight = calc(100vh - 底边锚点 - 8px)（相对视口，窗口怎么变自己算），
//       实际高度由内容决定；列表 flex:0 1 auto + overflow:auto 内滚。
// 验收映射：
//  A) 面板层（渲染 + 源码）：maxHeight 相对视口、无固定高度
//  B) 列表区（渲染 + 源码）：flex 收缩 + 内滚 + 无固定高度 + **无固定下限**（#150：高度完全由内容决定）
//  C) 浮层结构（渲染 + 源码）：列表 → 底栏 → 弹窗 的 DOM 顺序；底栏 flex:none；弹窗遮罩 zIndex = MODAL_Z > 面板 PANEL_Z
//  D) 底栏（渲染）：#150 起 tab 行之下只有**一行** —— 搜索（弹性）→ 当前条数 → ＋新增 → 设置入口 → ×；无第二头行
//  E) 设置入口（渲染）：显示短形 / 全称在 title+aria；走 goSettings handler；done(true) 才收面板；done(false) 与「无 handler」都在原位提示，绝不静默
//  F) 源码级：触发钮认 aria-label/title/可见文本（宿主是图标钮）+ 排除本插件自己的铬（#150 防自点自）+ 轮询重试 + 失败留痕；i18n 双语齐
const fs = require('node:fs');
const path = require('node:path');
const { buildFlat, stripComments } = require('./lib/transpile-client.cjs');
const DIR = path.join(__dirname, '.rt-tmp-149');
const ROOT = path.join(__dirname, '..');
const SRC = (n) => path.join(ROOT, 'src', 'client', n);

let failures = 0;
function fail(msg) { failures++; console.log('FAIL: ' + msg); }
function ok(msg) { console.log(' ok: ' + msg); }
const eq = (a, b, msg) => { if (a !== b) fail(msg + '（期望 ' + JSON.stringify(b) + '，实际 ' + JSON.stringify(a) + '）'); };

buildFlat(DIR, [SRC('panel.ts')]);
const React = require('react');
const TR = require('react-test-renderer');
const req = (n) => require(path.join(DIR, n + '.cjs'));
const panelMod = req('panel');
const i18nMod = req('i18n');
const stateMod = req('state');
const storeMod = req('store');
const remoteMod = req('remote');
const LANG = (typeof i18nMod.getLang === 'function' ? i18nMod.getLang() : 'zh');
const T = (k) => i18nMod.tr(LANG, i18nMod.STR[k]);
try { if (storeMod.__resetStoreForTests) storeMod.__resetStoreForTests(); } catch (e) { /* 无复位钩子则继续 */ }
try { if (remoteMod.__resetRemoteForTests) remoteMod.__resetRemoteForTests(); } catch (e) { /* 同上 */ }

const panelSrc = fs.readFileSync(SRC('panel.ts'), 'utf8');
const panelCode = stripComments(panelSrc);
const flatCode = panelCode.replace(/\s+/g, ' ');
const indexSrc = fs.readFileSync(SRC('index.ts'), 'utf8');

// 关闭面板的唯一观测点（state.setPanelOpen）：patch 成计数器，看「谁在什么时候真收面板」
let closedCount = 0;
stateMod.setPanelOpen = () => { closedCount += 1; };

// ── 挂载紧凑浮层 ──
let tree;
try { TR.act(() => { tree = TR.create(React.createElement(panelMod.TemplateBrowser, { compact: true })); }); }
catch (e) { fail('TemplateBrowser compact:true 挂载应成功，实际抛错 ' + (e && e.message)); }
if (tree) {
  const json = tree.toJSON();
  const rootStyle = json.props.style;
  const byAttr = (k, v) => tree.root.findAll((x) => x.props && x.props[k] === v);

  // ── A) 面板层：只封上限、上限相对视口 ──
  if (rootStyle.maxHeight !== 'calc(100vh - 0px - 8px)') fail('未定位时上限应为 calc(100vh - 0px - 8px)（相对视口），实际 ' + rootStyle.maxHeight);
  if (rootStyle.overflow !== 'hidden') fail('面板应 overflow:hidden 收住圆角，实际 ' + rootStyle.overflow);
  if (rootStyle.display !== 'flex') fail('面板应 flex 纵向列，实际 ' + rootStyle.display);
  if (rootStyle.zIndex !== panelMod.PANEL_Z) fail('面板 zIndex 应为 PANEL_Z，实际 ' + rootStyle.zIndex);
  if ('height' in rootStyle) fail('面板不得写死 height（高度由内容决定），实际 ' + rootStyle.height);
  if (failures === 0) ok('A) 面板只封上限：maxHeight 相对视口、无固定高度');

  // ── B) 列表区：无固定高度、无固定下限（#150：高度完全由内容决定）+ 内滚 ──
  const listEl = byAttr('data-dsh-prompt-list', '1')[0];
  if (!listEl) fail('列表区应带 data-dsh-prompt-list（稳定的断言面）');
  else {
    const ls = listEl.props.style;
    eq(ls.flex, '0 1 auto', '列表应可收缩不放大（flex:0 1 auto）');
    eq(ls.overflow, 'auto', '列表溢出应内滚（overflow:auto）');
    eq(ls.minHeight, 0, '列表不得再有固定下限（#150：内容多高就多高）');
    if ('height' in ls) fail('列表不得写死 height（旧的 360 就是需求里那个上限），实际 ' + ls.height);
    if ('maxHeight' in ls) fail('列表不得写死 maxHeight，实际 ' + ls.maxHeight);
  }
  const rows = tree.root.findAll((n) => n.props && n.props['data-dsh-prompt-id'] !== undefined && n.props['data-dsh-prompt-id'] !== null).length;
  if (rows === 0) fail('紧凑浮层默认应展开列出模板行');
  if (failures === 0) ok('B) 列表自适应：内容定高、溢出内滚、无固定上下限');

  // ── C) 结构：列表 → 底栏 → 弹窗 ──
  const bar = byAttr('data-dsh-prompt-bar', '1')[0];
  if (!bar) fail('紧凑浮层应有底栏节点（data-dsh-prompt-bar）');
  else {
    eq(bar.props.style.flex, 'none', '底栏应 flex:none 钉在底部（内容多少都不抖）');
    eq(bar.props.style.flexDirection, 'column', '底栏应纵向两行（tab / 合并动作行）');
    if (!bar.props.style.borderTop) fail('底栏应有上分隔线');
    const childKinds = (json.children || []).map((c) => {
      if (c.props && c.props['data-dsh-prompt-bar'] === '1') return 'bar';
      if (c.props && c.props['data-dsh-prompt-list'] === '1') return 'list';
      return 'other';
    });
    const iList = childKinds.indexOf('list'); const iBar = childKinds.indexOf('bar');
    if (iList < 0 || iBar < 0) fail('面板顶层应同时有列表与底栏，实际 ' + JSON.stringify(childKinds));
    else if (!(iList < iBar)) fail('列表应排在底栏之前（DOM 顺序即层序），实际 ' + JSON.stringify(childKinds));
    // 没有第二头行：标题「Prompt」那行（panelTitle + fontWeight 700）只属设置页折叠卡，
    // 紧凑浮层省下这一行，正是列表能多装的那一格。
    eq(tree.root.findAll((n) => n.type === 'span' && n.props && n.props.children === T('panelTitle') && n.props.style && n.props.style.fontWeight === 700).length, 0, '紧凑浮层不应再有标题头行');
    eq(tree.root.findAll((n) => n.props && n.props['data-dsh-prompt-templates-toggle'] !== undefined).length, 0, '紧凑浮层不应有折叠开关头行（那是设置页的）');
    // 重复按钮：＋新增 / 设置入口 各只一枚
    eq(byAttr('data-dsh-prompt-chrome', 'plusGlyph').length, 1, '紧凑浮层应只有一枚 ＋新增');
    eq(byAttr('data-dsh-prompt-chrome', 'goSettings').length, 1, '紧凑浮层应只有一枚 设置→模板管理');
  }

  // ── D) 底栏：tab 行 + 一行合并动作行（#150 方案 A） ──
  if (bar) {
    // ① tab 行（chips）仍在底栏内，是第一行（范围钮带 data-dsh-prompt-scope）
    if (bar.findAll((n) => n.props && n.props['data-dsh-prompt-scope'] !== undefined).length === 0) fail('底栏第一行应是 tab 行（chips 下沉）');
    // ② 合并行：搜索 → 条数 → ＋新增 → 设置入口 → ×，恰好一行、不换行
    const row = bar.findAll((n) => n.props && n.props['data-dsh-prompt-row'] === '1')[0];
    if (!row) fail('底栏应有合并动作行（data-dsh-prompt-row）');
    else {
      eq(row.props.style.flexWrap, 'nowrap', '合并行必须锁单行（flexWrap:nowrap）');
      const direct = (row.children || []).filter((c) => c && typeof c !== 'string');
      const kindOf = (c) => {
        if (!c || !c.props) return '?';
        if (c.props.placeholder === T('searchPh')) return 'search';
        if (c.props['data-dsh-prompt-counts'] === '1') return 'counts';
        const chrome = c.props['data-dsh-prompt-chrome'];
        if (chrome === 'plusGlyph') return 'add';
        if (chrome === 'goSettings') return 'go';
        if (c.props.title === T('close')) return 'close';
        return '?';
      };
      eq(direct.map(kindOf).join(','), 'search,counts,add,go,close', '合并行从左到右应为 搜索 → 条数 → ＋新增 → 设置入口 → ×');
      const ss = direct[0] && direct[0].props && direct[0].props.style;
      eq(ss && ss.flex, '1 1 auto', '搜索框应吃掉弹性宽度（flex:1 1 auto）');
      eq(ss && ss.minWidth, 0, '搜索框须可收缩（minWidth:0），否则撑破单行');
      eq(ss && ss.margin, 0, '搜索框在行内不再带外边距（交回行容器）');
      // ③ 条数 = 当前视图行数；完整分解（预制/自定义）退到 title + aria-label
      const countsSpan = row.findAll((n) => n.props && n.props['data-dsh-prompt-counts'] === '1')[0];
      if (!countsSpan) fail('合并行应有条数');
      else {
        eq(countsSpan.props.children, String(rows), '条数应=当前视图行数');
        if (String(countsSpan.props.title || '').indexOf(T('presetCount')) < 0) fail('条数 title 应带完整分解（预制/自定义）');
        if (String(countsSpan.props['aria-label'] || '').indexOf(T('customCount')) < 0) fail('条数 aria-label 应带完整分解');
      }
    }
    const searchInBar = bar.findAll((n) => n.props && n.props.placeholder === T('searchPh'));
    eq(searchInBar.length, 1, '搜索输入应在底栏内（唯一输入口）');
    // × 收面板
    const closeBtn = bar.findAll((n) => n.type === 'button' && (n.props.title === T('close') || n.children.indexOf('×') >= 0))[0];
    if (!closeBtn) fail('底栏应有 × 关闭钮');
    else {
      const before = closedCount;
      TR.act(() => { closeBtn.props.onClick(); });
      eq(closedCount - before, 1, '点 × 应收面板（setPanelOpen(false)）');
    }
    // ＋ 开新增弹窗
    const addBtn = bar.findAll((n) => n.props && n.props['data-dsh-prompt-chrome'] === 'plusGlyph')[0];
    if (!addBtn) fail('底栏应有 ＋新增钮');
    else {
      TR.act(() => { addBtn.props.onClick(); });
      const mask = tree.root.findAll((n) => n.props && n.props['data-dsh-prompt-modal'] === '')[0];
      if (!mask) fail('点底栏 ＋ 应打开新增 prompt 弹窗');
      else {
        eq(mask.props.style.zIndex, panelMod.MODAL_Z, '弹窗遮罩 zIndex 应为 MODAL_Z');
        if (!(panelMod.MODAL_Z > panelMod.PANEL_Z)) fail('弹窗层级应高于面板（MODAL_Z > PANEL_Z）');
      }
      if (failures === 0) ok('D) 底栏：tab 行 + 一行合并动作行（搜索/条数/＋新增/设置/×），层级 MODAL_Z > PANEL_Z');
    }
    // 关掉弹窗，避免影响后面的设置入口断言
    const maskNow = tree.root.findAll((n) => n.props && n.props['data-dsh-prompt-modal'] === '')[0];
    if (maskNow && typeof maskNow.props.onClick === 'function') TR.act(() => { maskNow.props.onClick({ target: 1, currentTarget: 1 }); });
  }

  // ── E) 设置 → 模板管理：真打开插件设置页；失败原位提示，绝不静默 ──
  const goBtn = byAttr('data-dsh-prompt-chrome', 'goSettings')[0];
  if (!goBtn) fail('底栏应有 设置→模板管理 钮');
  else {
    // #150：底栏显示用短形；全称留在 title + aria —— 可访问名不能只读「模板管理」
    eq(goBtn.props.children, T('goSettingsShort'), '未触发时设置钮应显示短形（goSettingsShort）');
    eq(goBtn.props.title, T('goSettings'), '全称应留在 title');
    eq(goBtn.props['aria-label'], T('goSettings'), '可访问名应是全称');
    let seen = null; let calls = 0;
    panelMod.setGoSettingsHandler((done) => { calls += 1; seen = done; });
    TR.act(() => { goBtn.props.onClick(); });
    eq(calls, 1, '点设置应把跳转交给宿主侧 goSettings');
    if (typeof seen !== 'function') fail('goSettings 应收到 done 回调（成败都要回报）');
    else {
      const beforeFail = closedCount;
      TR.act(() => { seen(false); });
      eq(closedCount - beforeFail, 0, '跳转失败不得收面板（旧实现就是先关面板然后什么都没发生）');
      eq(goBtn.props.children, T('goSettingsFail'), '跳转失败应在原位换成提示');
      // 成功路径：收面板
      const beforeOk = closedCount;
      TR.act(() => { goBtn.props.onClick(); });
      TR.act(() => { seen(true); });
      eq(closedCount - beforeOk, 1, '跳转成功应收面板');
    }
    // 无 handler（宿主没注册）：同样不静默
    panelMod.setGoSettingsHandler(null);
    TR.act(() => { goBtn.props.onClick(); });
    eq(goBtn.props.children, T('goSettingsFail'), '无 handler 时也应在原位提示');
    panelMod.setGoSettingsHandler(null);
    if (failures === 0) ok('E) 设置入口：成功才收面板，失败/无 handler 原位提示');
  }
}

// ── F) 源码级：修法本身不得被后面的改动漂移掉 ──
if (!panelCode.includes("maxHeight: 'calc(100vh - ' + panelBottom + 'px - 8px)'")) fail('panelStyle 上限应= calc(100vh - 底边锚点 - 8px)');
if (!panelCode.includes("const panelBottom = (pos && typeof pos.bottom === 'number') ? pos.bottom : 0")) fail('上限应取定位 effect 的 pos.bottom（入口按钮上方 8px）');
if (!panelCode.includes("bottom: (pos && pos.bottom) || 0")) fail('面板应贴在入口按钮之上（bottom 锚点）');
if (panelCode.includes('COMPACT_LIST_MIN_H')) fail('#150 后不得再出现列表下限常量（删掉 5 行下限，高度完全由内容决定）');
if (!panelCode.includes("minHeight: 0, overflow: 'auto'")) fail('紧凑列表应= minHeight:0 + 内滚（flex 收缩）');
if (!panelCode.includes('...(compact ? {} : { height: 360 })')) fail('空态：紧凑走自然高度，设置页折叠卡保持 360');
if (!panelCode.includes("const searchStyleCompact: any = { ...searchStyle, margin: 0, flex: '1 1 auto', minWidth: 0 }")) fail('搜索框应有行内紧凑样式（弹性 + 可收缩 + 无外边距）');
if (!panelCode.includes("key: 'bar-row', 'data-dsh-prompt-row': '1'")) fail('合并行应有稳定钩子 data-dsh-prompt-row');
if (!panelCode.includes('String(rows.length)')) fail('计数应取当前视图行数');
if ((panelCode.match(/height: 360/g) || []).length !== 1) fail('height:360 只应留给设置页折叠卡（紧凑浮层不得再有固定上限）');
if (!flatCode.includes('showList ? listNode : null, compactBar, modalNode, ] : [')) fail('紧凑分支顺序应为 列表 → 底栏 → 弹窗');
if (!flatCode.includes('showList ? cloudNodes : null, searchNode, showList ? listNode : null, footer, modalNode,')) fail('设置页（非 compact）分支结构不得被动到');
const iBarNode = flatCode.indexOf("const barNode = h('div', { key: 'dsh-prompt-bar'");
const iBarEnd = flatCode.indexOf('const compactBar = compact ? barNode : null');
if (iBarNode < 0 || iBarEnd <= iBarNode) fail('底栏应聚成一个 barNode（便于断言与复用）');
else {
  const barSlice = flatCode.slice(iBarNode, iBarEnd);
  if (!barSlice.includes("modalState[1]({ kind: 'add' })")) fail('底栏的 ＋ 应直接开新增弹窗（modalState add）');
  if (!barSlice.includes("t('goSettingsFail')")) fail('底栏设置钮应带失败提示分支');
  if (!barSlice.includes("t('goSettingsShort')")) fail('设置入口显示应用短形（全称留在 title/aria）');
  if (!barSlice.includes("'data-dsh-prompt-row': '1'")) fail('底栏应含合并动作行');
  if (barSlice.includes("t('presetCount') + ' ' + presetCount")) fail('#150：底栏不应再有「预制 n · 自定义 m」独立摘要行（与 tab 标签重复）');
  if (barSlice.includes("key: 'spacer'")) fail('#150 合并后不应再留 spacer（短形 + 弹性搜索已无余量）');
  if (!barSlice.includes('emitGoSettings(')) fail('底栏设置钮应走 emitGoSettings（可回报成败）');
}
// 触发钮：宿主是图标钮（aria-label + aria-haspopup），只认 textContent 会一次都不点 → 必须三处认
for (const needle of ['SETTINGS_TRIGGER_LABEL_RE', "b.getAttribute('aria-label')", "b.getAttribute('title')", "button[aria-haspopup=\"dialog\"]", "aria-keyshortcuts"]) {
  if (!indexSrc.includes(needle)) fail('index.ts 的 goSettings 触发器识别缺：' + needle);
}
if (!indexSrc.includes('setGoSettingsHandler(goSettings)')) fail('index.ts 应把 goSettings 注册给面板');
if (!indexSrc.includes('__dshPromptGoSettings = goSettings')) fail('index.ts 应保留 __dshPromptGoSettings 兜底挂载（remote.openRemoteSettings 复用）');
if (!indexSrc.includes('const tid = setInterval(')) fail('等待导航项挂载应是轮询（setInterval），不是一次性硬等');
if (!/if \(n === 6\) \{ try \{ trig\.click\(\) \}/.test(indexSrc)) fail('首次点空应有补点一次（不做"点一下就算了"）');
// #150：候选必须排除本插件自己的铬 —— 面板里那枚设置入口的 title/aria 就是全称（含「设置/Settings」），
// 不排掉它，「找不到宿主触发器」时会命中它自己 → 自点自 → 同步递归到栈溢出。
if (!indexSrc.includes('isOwnChrome')) fail('index.ts 应排除本插件自己的铬（isOwnChrome）再挑触发器');
if (!indexSrc.includes("hasAttribute('data-dsh-prompt-chrome')")) fail('isOwnChrome 应认 data-dsh-prompt-chrome');
if (!indexSrc.includes("closest('[data-dsh-prompt-bar]')")) fail('isOwnChrome 应认底栏容器 [data-dsh-prompt-bar]');
if (!/document\.querySelectorAll\('button'\)\) as HTMLElement\[\]\)\.filter\(\(b\) => !isOwnChrome\(b\)\)/.test(indexSrc)) fail('allButtons 的兜底扫描应过滤自身铬');
// 失败留痕：事件与字段必须都在清单白名单内（test-log 的调用点扫描同口径）
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'event-list.dsh-prompt.json'), 'utf8'));
const evt = manifest.events && manifest.events['remote.direct.open'];
if (!evt) fail('事件清单应有 remote.direct.open');
else eq(evt.fields.slice().sort().join(','), 'method,ok', 'remote.direct.open 字段白名单');
if (!indexSrc.includes("logEvent('remote.direct.open', { method: 'dom', ok: false })")) fail('失败应留痕：logEvent(remote.direct.open, {method:dom, ok:false})（字段不超白名单）');
if (failures === 0) ok('F) 源码级：上限/顺序/触发器识别/失败留痕全部对得上');

// i18n：新词条双语齐
const failEntry = i18nMod.STR.goSettingsFail;
if (!failEntry || !failEntry.zh || !failEntry.en) fail('i18n 应加 goSettingsFail 且 zh/en 齐');
else if (failEntry.zh === i18nMod.STR.goSettings.zh) fail('goSettingsFail 不得与 goSettings 同文（失败提示要能区分）');
// #150：短形词条（底栏合并行显示用）
const shortEntry = i18nMod.STR.goSettingsShort;
if (!shortEntry || !shortEntry.zh || !shortEntry.en) fail('i18n 应加 goSettingsShort 且 zh/en 齐');
else {
  if (shortEntry.zh === i18nMod.STR.goSettings.zh) fail('goSettingsShort 应与全称不同（否则短形没意义）');
  if (String(shortEntry.zh).length >= String(i18nMod.STR.goSettings.zh).length) fail('中文短形应比全称短');
  if (String(shortEntry.en).length >= String(i18nMod.STR.goSettings.en).length) fail('英文短形应比全称短');
}
if (failures === 0) ok('i18n：goSettingsFail / goSettingsShort 双语齐');

if (failures > 0) { console.log('\nRESULT: FAIL (' + failures + ')'); process.exit(1); }
console.log('\nRESULT: PASS');
