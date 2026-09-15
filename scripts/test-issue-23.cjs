// 回归测试 #23: 统一 label 落地（schema + 编辑 UI + 筛选联动）
// 验收映射（issue #23 正文 + Agent Brief）：
//  A) 预置 24 条 labels == 领域+阶段+动作机械派生（#19 R2 附录逐条锁定），词表 23，无「任意」
//  B) 同一标签三处同集合：设置页领域行/页签 == matchLabel 集 == /prompt 集；行内全标签串
//  C) 动作词/阶段词跨入口可找（用户故事 5/6）；搜索旧找法不断；排序维持 #22 现状
//  D) 自定义：最多 3、可选可造、去空去重、超长超数/「任意」阻断+行内提示、全空回落「自定义」
//  E) 迁移：旧单 tag 为首元、空回落、占位三件套不污染；自定义页签按 builtin（待确认 1 推荐）
//  F) /prompt 描述行 = 标签串 + 正文前段（42 字截断不变）；智能卡只换展示行（#32 后自定义可参评）
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
  ['words.ts', SRC('words.ts'), []],
  ['match.ts', SRC('match.ts'), ['./store', './words']],
  ['trigger.ts', SRC('trigger.ts'), ['./store']],
  ['panel.ts', SRC('panel.ts'), ['./templates', './store', './state', './i18n', './smartstore']],
  ['smart.ts', SRC('smart.ts'), ['./panel', './match', './store', './smartstore', './i18n']],
];
for (const [outName, srcPath, deps] of MODULES) {
  let src = fs.readFileSync(srcPath, 'utf8');
  let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true } }).outputText;
  for (const d of deps) js = js.split('require("' + d + '")').join('require("' + d + '.cjs")');
  fs.writeFileSync(path.join(DIR, outName.replace(/\.ts$/, '.cjs')), js);
}
const React = require('react');
const TR = require('react-test-renderer');
const req = (n) => require(path.join(DIR, n + '.cjs'));
const templates = req('templates');
const store = req('store');
const trigger = req('trigger');
const match = req('match');
const panel = req('panel');
const { tr, STR } = req('i18n');
const zh = (k) => tr('zh', STR[k]);

function assert(cond, msg) {
  if (!cond) { console.log('FAIL: ' + msg); process.exit(1); }
  console.log(' ok: ' + msg);
}
const ids = (list) => list.map((t) => t.id).sort();
const rowIds = (tree) =>
  tree.root.findAll((n) => n.props && n.props['data-dsh-prompt-id'], { deep: true }).map((n) => n.props['data-dsh-prompt-id']);
function texts(node, acc) {
  if (node == null) return acc || [];
  acc = acc || [];
  if (typeof node === 'string') { acc.push(node); return acc }
  if (Array.isArray(node)) { node.forEach((n) => texts(n, acc)); return acc }
  if (node.children) texts(node.children, acc);
  return acc;
}
const rowTexts = (tree) => {
  const acc = [];
  tree.root.findAll((n) => n.props && n.props['data-dsh-prompt-id'], { deep: true })
    .forEach((n) => texts(n.children, acc));
  return acc;
};
const textOf = (n) => (Array.isArray(n.children) ? n.children.filter((c) => typeof c === 'string').join('') : '');
const byText = (tree, s) => tree.root.findAll((n) => n.children && textOf(n) === s);
const byButton = (tree, s) => tree.root.findAll((n) => n.type === 'button' && textOf(n) === s);

async function main() {
  console.log('=== Test #23 A: 预置回填 ==');
  assert(templates.PRESET_TEMPLATES.length === 24, '预制 24 条');
  let vocab = new Set();
  for (const t of templates.PRESET_TEMPLATES) {
    const mech = [t.domain, t.stage, ...(t.action || [])];
    assert(JSON.stringify(store.templateLabels(t)) === JSON.stringify(mech), '派生一致 ' + t.id);
    assert(t.builtin === true, 'builtin ' + t.id);
    store.templateLabels(t).forEach((l) => vocab.add(l));
    assert(store.labelString(t).indexOf('任意') < 0, '无幽灵 ' + t.id);
  }
  assert(vocab.size === 23, '词表 23 词（实得 ' + vocab.size + '）');

  console.log('=== Test #23 B: 三处同一标签同一集合（执行） ===');
  const want = ids(store.allTemplates().filter((t) => store.matchLabel(t, '执行')));
  assert(want.length === 7, '标签「执行」= 7 条预置（实得 ' + want.length + '）');
  // 设置页：点领域行「执行」
  let full;
  TR.act(() => { full = TR.create(React.createElement(panel.TemplateBrowser, { compact: false })); });
  // #70 置换：领域行已由行动云替代（旧「执行」按钮节点删除，原断言不可达），按报告 §3.3 改写模板换成云等价；store 层 want（执行集 7 条）保持不动
  const wantCloud = ids(store.allTemplates().filter((t) => store.matchLabel(t, '复盘')));
  const cloudBtnPick = byButton(full, '复盘')[0];
  assert(!!cloudBtnPick, '云「复盘」按钮存在');
  TR.act(() => { cloudBtnPick.props.onClick(); });
  TR.act(() => {});
  assert(JSON.stringify(rowIds(full).sort()) === JSON.stringify(wantCloud), '设置页云 == matchLabel 集');
  // 设置页：页签「执行前」== 同名标签集
  let full2;
  TR.act(() => { full2 = TR.create(React.createElement(panel.TemplateBrowser, { compact: false })); });
  const tabBtn = byButton(full2, '执行前')[0];
  assert(!!tabBtn, '页签「执行前」存在');
  TR.act(() => { tabBtn.props.onClick(); });
  TR.act(() => {});
  const wantBefore = ids(store.allTemplates().filter((t) => store.matchLabel(t, '执行前')));
  assert(JSON.stringify(rowIds(full2).sort()) === JSON.stringify(wantBefore), '页签「执行前」== 同名标签集（' + wantBefore.length + ' 条）');
  // /prompt：D7 语义 = 标签包含 OR 全文兼容（超集）：含全部标签命中，且与旧 haystack 行为一致
  const promptHits = trigger.filterPromptTemplates('prompt 执行');
  const hayOnly = store.allTemplates().filter((t) => store.templateHaystack(t).indexOf('执行') >= 0);
  assert(JSON.stringify(ids(promptHits)) === JSON.stringify(ids(hayOnly)), '/prompt 保持 haystack 兼容（24 条，同改前）');
  assert(want.every((id) => ids(promptHits).indexOf(id) >= 0), '/prompt 包含全部 7 条标签命中');
  // 悬浮列表行内含完整标签串
  let compact;
  TR.act(() => { compact = TR.create(React.createElement(panel.TemplateBrowser, { compact: true })); });
  const ctxt = rowTexts(compact);
  assert(ctxt.includes('思考框架/执行前/拆解'), '悬浮列表行内含完整标签串');
  assert(!ctxt.some((t) => t === '思考框架'), '悬浮列表行内无裸领域串');
  // 设置页行内含完整标签串
  assert(rowTexts(full).includes('执行/执行前/启动') || rowTexts(full2).includes('思考框架/执行前/拆解'), '设置页行内含完整标签串');
  // /prompt 描述行 = 标签串 + 正文前段
  const src = { candidates: null };
  src.candidates = await (async () => {
    const s = trigger.buildPromptSource();
    return s.candidates({}, { query: 'prompt 执行', position: '0' });
  })();
  assert(src.candidates.length === hayOnly.length, '/prompt 候选数与 haystack 一致');
  assert(src.candidates.every((c) => {
    const t = store.getTemplate(c.templateId);
    return c.description === store.labelString(t) + ' — ' + (t.body || '').replace(/\s+/g, ' ').slice(0, 42);
  }), '/prompt 描述行 = 标签串 + 正文前 42 字');

  console.log('=== Test #23 C: 动作词/阶段词/旧找法/自定义页签 ===');
  const retro = store.getTemplate('retro');
  assert(store.matchLabel(retro, '复盘'), '动作词命中：过程复盘含「复盘」');
  assert(ids(trigger.filterPromptTemplates('prompt 复盘')).includes('retro'), '/prompt 动作词找到过程复盘');
  assert(ids(trigger.filterPromptTemplates('prompt复盘')).includes('retro'), '/prompt 无空格源名前缀同样剥离（宿主不传带空格 query）');  const cross = store.allTemplates().filter((t) => store.matchLabel(t, '执行中'));
  const crossDomains = new Set(cross.map((t) => t.domain));
  assert(crossDomains.size >= 3, '阶段词「执行中」横跨多领域（实得 ' + [...crossDomains].join('/') + '）');
  assert(ids(trigger.filterPromptTemplates('prompt 第一性原理')).includes('fp'), '旧找法：搜名称仍有效');
  let full3;
  TR.act(() => { full3 = TR.create(React.createElement(panel.TemplateBrowser, { compact: false })); });
  TR.act(() => { byButton(full3, '自定义')[0].props.onClick(); });
  TR.act(() => {});
  assert(rowIds(full3).length === 0 && rowIds(full3).every((id) => !store.getTemplate(id).builtin), '自定义页签按 builtin（空库 0 条）');

  console.log('=== Test #23 B2: 单行动标签云（#70，加法段）===');
  // 云词表（预置 16 行动词固定首现序；自定义在用词追加在后；领域/阶段/哨兵不进云）
  const cloudWant = ['拆解', '检验', '归因', '决策', '理解', '路线', '概念', '考验', '审查', '测试', '重构', '解读', '启动', '固化', '记录', '复盘'];
  let cloudTree;
  TR.act(() => { cloudTree = TR.create(React.createElement(panel.TemplateBrowser, { compact: false })); });
  const cloudBtns = cloudTree.root.findAll((n) => n.type === 'button').map(textOf).filter((s) => cloudWant.indexOf(s) >= 0);
  assert(JSON.stringify(cloudBtns) === JSON.stringify(cloudWant), '云 16 行动词齐且序固定（实得 ' + cloudBtns.join('/') + '）');
  assert(byButton(cloudTree, '思考框架').length === 0 && byButton(cloudTree, '学习').length === 0 && byButton(cloudTree, '工程').length === 0 && byButton(cloudTree, '执行').length === 0, '领域词不进云');
  assert(byButton(cloudTree, '全领域').length === 0, '旧领域行“全领域”按钮已移除');
  assert(byButton(cloudTree, '全部').length === 2, '页签全 + 云全共存（悬浮/设置共用同一顶部两行）');
  // 点云任一标签 == matchLabel 集（照抄 B 段三行式；设置页）
  const wantStart = ids(store.allTemplates().filter((t) => store.matchLabel(t, '启动')));
  assert(wantStart.length === 4, '标签「启动」= 4 条预置（实得 ' + wantStart.length + '）');
  let cloudFull;
  TR.act(() => { cloudFull = TR.create(React.createElement(panel.TemplateBrowser, { compact: false })); });
  TR.act(() => { byButton(cloudFull, '启动')[0].props.onClick(); });
  TR.act(() => {});
  assert(JSON.stringify(rowIds(cloudFull).sort()) === JSON.stringify(wantStart), '设置页云「启动」== matchLabel 集');
  // 同一顶部：悬浮 compact 点同一云词得同一集合
  let cloudCompact;
  TR.act(() => { cloudCompact = TR.create(React.createElement(panel.TemplateBrowser, { compact: true })); });
  TR.act(() => { byButton(cloudCompact, '启动')[0].props.onClick(); });
  TR.act(() => {});
  assert(JSON.stringify(rowIds(cloudCompact).sort()) === JSON.stringify(wantStart), '悬浮云「启动」== 同一 matchLabel 集');
  // 云是更细粒度（不是领域换皮）：「复盘」集是「执行」集的真子集
  const wantExec = ids(store.allTemplates().filter((t) => store.matchLabel(t, '执行')));
  const wantRetro = ids(store.allTemplates().filter((t) => store.matchLabel(t, '复盘')));
  assert(wantRetro.length === 1 && wantRetro.every((id) => wantExec.indexOf(id) >= 0) && wantRetro.length < wantExec.length, '云「复盘」是领域「执行」的真子集（1 vs ' + wantExec.length + '）');
  // toggle：再点已选项回全部
  TR.act(() => { byButton(cloudFull, '启动')[0].props.onClick(); });
  TR.act(() => {});
  assert(rowIds(cloudFull).length === store.allTemplates().length, '云 toggle：再点回全部（' + store.allTemplates().length + ' 条）');
  try { cloudTree.unmount(); cloudFull.unmount(); cloudCompact.unmount(); } catch (e) {}
  // 自定义在用词进云并可滤（追加在末尾）；用完即删，保持后段基线干净
  const cloudBase = store.loadCustoms().length;
  const cloudCustom = store.addCustom('云客', ['观星'], '仰望星空正文');
  let cloudCus;
  TR.act(() => { cloudCus = TR.create(React.createElement(panel.TemplateBrowser, { compact: false })); });
  const cusBtns = cloudCus.root.findAll((n) => n.type === 'button').map(textOf).filter((s) => cloudWant.concat(['观星']).indexOf(s) >= 0);
  assert(cusBtns[cusBtns.length - 1] === '观星', '自定义词追加在云末尾');
  TR.act(() => { byButton(cloudCus, '观星')[0].props.onClick(); });
  TR.act(() => {});
  const wantStar = ids(store.allTemplates().filter((t) => store.matchLabel(t, '观星')));
  assert(JSON.stringify(wantStar) === JSON.stringify([cloudCustom.id]), '自定义词 matchLabel 集仅自身');
  assert(JSON.stringify(rowIds(cloudCus).sort()) === JSON.stringify(wantStar), '云「观星」== 含自定义的 matchLabel 集');
  try { cloudCus.unmount(); } catch (e) {}
  // tab=自定义 短路保持：云已选「启动」时切自定义页签，仍展示全部自定义（不叠加云过滤）
  assert(store.removeCustom(cloudCustom.id) === true, '云 B2 自定义清理');
  const cloudPlain = store.addCustom('云路人', ['闲逛'], '路过正文');
  let cloudMix;
  TR.act(() => { cloudMix = TR.create(React.createElement(panel.TemplateBrowser, { compact: false })); });
  TR.act(() => { byButton(cloudMix, '启动')[0].props.onClick(); });
  TR.act(() => {});
  assert(rowIds(cloudMix).length === wantStart.length, '云「启动」先过滤出 4 条预置');
  TR.act(() => { byButton(cloudMix, '自定义')[0].props.onClick(); });
  TR.act(() => {});
  assert(JSON.stringify(rowIds(cloudMix).sort()) === JSON.stringify([cloudPlain.id]), '自定义页签下云不生效（短路，仅自定义）');
  try { cloudMix.unmount(); } catch (e) {}
  assert(store.removeCustom(cloudPlain.id) === true, '云 B2 短路自定义清理');
  assert(store.loadCustoms().length === cloudBase, '云 B2 无残留（后段基线干净）');

  console.log('=== Test #23 D: 校验矩阵 ===');
  let r = store.validateLabels(['复盘', '执行后']);
  assert(r.ok && JSON.stringify(r.labels) === JSON.stringify(['复盘', '执行后']), '合法通过');
  r = store.validateLabels(['  复盘 ', '', '复盘', '执行后']);
  assert(r.ok && JSON.stringify(r.labels) === JSON.stringify(['复盘', '执行后']), '去空去重');
  r = store.validateLabels(['a', 'b', 'c', 'd']);
  assert(!r.ok && r.error === 'labelsTooMany', '超数阻断');
  r = store.validateLabels(['0123456789X']);
  assert(!r.ok && r.error === 'labelTooLong', '超长阻断（11 字）');
  r = store.validateLabels(['0123456789']);
  assert(r.ok, '10 字通过');
  r = store.validateLabels(['任意']);
  assert(!r.ok && r.error === 'labelReserved', '幽灵「任意」阻断');
  r = store.validateLabels([]);
  assert(r.ok && JSON.stringify(r.labels) === JSON.stringify(['自定义']), '全空回落「自定义」');
  r = store.validateLabels('复盘，执行后');
  assert(r.ok && JSON.stringify(r.labels) === JSON.stringify(['复盘', '执行后']), '单字符串逗号分隔兼容');

  console.log('=== Test #23 E: 迁移与落盘形状 ===');
  const legacy = { id: 'cx', name: '旧', nameEn: '', domain: '执行', stage: '执行前', action: [], body: 'b', builtin: false, tag: '复盘', createdAt: 1 };
  assert(JSON.stringify(store.templateLabels(legacy)) === JSON.stringify(['复盘']), '旧单 tag 为首元');
  const legacyEmpty = { ...legacy, id: 'cy', tag: '' };
  assert(JSON.stringify(store.templateLabels(legacyEmpty)) === JSON.stringify(['自定义']), '空 tag 回落');
  assert(store.templateLabels(legacy).indexOf('执行前') < 0, '占位 stage 不污染标签');
  const added = store.addCustom('新模板', ['复盘', '执行后'], '正文');
  assert(!('tag' in added) && !('domain' in added) && JSON.stringify(added.labels) === JSON.stringify(['复盘', '执行后']), '新形状无旧字段');
  store.updateCustom(added.id, { labels: ['学习'] });
  assert(JSON.stringify(store.loadCustoms().find((x) => x.id === added.id).labels) === JSON.stringify(['学习']), 'updateCustom 生效');
  const copied = store.copyPresetToCustom('fp');
  assert(JSON.stringify(store.templateLabels(copied)) === JSON.stringify(['思考框架', '执行前', '拆解']), '复制预置照搬标签串');

  console.log('=== Test #23 F: 弹窗交互 ===');
  let f4;
  TR.act(() => { f4 = TR.create(React.createElement(panel.TemplateBrowser, { compact: false })); });
  const addBtn = byText(f4, '＋ ' + zh('addShort'))[0];
  assert(!!addBtn, '新增按钮存在');
  TR.act(() => { addBtn.props.onClick(); });
  TR.act(() => {});
  const nameInput = f4.root.findAll((x) => (x.type === 'input' || x.type === 'textarea') && x.props && x.props.placeholder === zh('namePh'))[0];
  const labelInput = f4.root.findAll((x) => x.type === 'input' && x.props && x.props.placeholder === zh('labelsPh'))[0];
  assert(!!nameInput && !!labelInput, '名称框 + 标签框存在（旧 namePh/bodyPh 保留）');
  const before = store.loadCustoms().length;
  TR.act(() => { nameInput.props.onChange({ target: { value: '超数模板' } }); });
  TR.act(() => { labelInput.props.onChange({ target: { value: 'a,b,c,d' } }); });
  TR.act(() => {});
  const okBtn = byText(f4, zh('addOk'))[0];
  TR.act(() => { okBtn.props.onClick(); });
  TR.act(() => {});
  assert(byText(f4, zh('labelsTooMany')).length > 0, '超数行内提示');
  assert(store.loadCustoms().length === before, '阻断后未落盘');
  // 回车并入 chips 后合法保存
  TR.act(() => { labelInput.props.onChange({ target: { value: '复盘,执行后' } }); });
  TR.act(() => { labelInput.props.onKeyDown({ key: 'Enter', preventDefault() {} }); });
  TR.act(() => {});
  TR.act(() => { byText(f4, zh('addOk'))[0].props.onClick(); });
  TR.act(() => {});
  const saved = store.loadCustoms().find((x) => x.name === '超数模板');
  assert(!!saved && JSON.stringify(store.templateLabels(saved)) === JSON.stringify(['复盘', '执行后']), '合法保存标签落盘');
  try { f4.unmount(); } catch (e) {}

  console.log('=== Test #23 G: 智能卡展示行（#32 后自定义可参评） ===');
  const cands = match.smartCandidates('帮我复盘这次迭代');
  // #32 起自定义经标签分进入召回，不再断言“只出预置”（旧边界）；只断言结构不变
  assert(cands.length > 0, '有候选');
  assert(cands.some((s) => s.tpl.id === 'retro'), '预置仍在');
  assert(cands.every((s, i, a) => i === 0 || a[i - 1].score <= s.score), '展示 bottom-up（分数升序）');
  assert(cands.filter((s) => s.score > 0).every((s) => s.score >= 2), '阈值 2 保持（0 分仅 lastUsed 槽）');
  const smartSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'client', 'smart.ts'), 'utf8');
  assert(/labelString\(c\.tpl\)/.test(smartSrc), '智能卡行用 labelString');
  assert(/scoreDraft|SMART_THRESHOLD/.test(smartSrc) || /smartCandidates/.test(smartSrc), '评分链引用保留');
  const tagLine = smartSrc.split('\n').find((l) => l.includes('tagText'));
  assert(/·常用/.test(tagLine) && /·分/.test(tagLine), '评分后缀保留');

  console.log('=== Test #23 H: 排序维持 #22 现状 ===');  store.bumpUsage('fp'); store.bumpUsage('fp'); store.bumpUsage('fp');
  store.bumpUsage('deep');
  const topDown = store.sortedTemplates(store.allTemplates());
  assert(topDown[0].id === 'fp', '设置页降序：最高频在首');
  const bottomUp = store.sortedTemplatesBottomUp(store.allTemplates());
  assert(bottomUp[bottomUp.length - 1].id === 'fp', '悬浮升序：最高频在底');
  const pFirst = trigger.filterPromptTemplates('prompt')[0];
  assert(pFirst.id === 'fp', '/prompt 降序首位最高频');

  console.log('=== Test #23 I: 智能卡默认关闭（验收要求，暂时） ===');
  const smartstore = req('smartstore');
  assert(smartstore.isSmartEnabled() === false, '缺键默认关（node 无 localStorage）');
  smartstore.setSmartEnabled(true);
  assert(smartstore.isSmartEnabled() === false, '无存储时 set 不崩且保持关（node 环境）');

  console.log('=== Test #23 PASS ===');
}

main().then(() => process.exit(0), (e) => { console.log('FAIL: ' + (e && e.stack || e)); process.exit(1); });
