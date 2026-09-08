// 回归测试 #22：全列表 bottom-up 统一（用户 2026-09-09 裁定落盘）
// 验收映射（改后验收，以用户 grilling 决议为准）：
//  Q1=A 统一公式：用量升序 → 同分置顶更贴底 → 置顶内 pin 序 → 末键（预制原始顺序/自定义 createdAt）
//  Q2=C 设置页保留降序（置顶绝对优先 → 用量降序），不做 bottom-up
//  Q3=A 智能卡：候选集不变（top-2 评分 + 1 最近使用），显示顺序改为评分升序（最相关在底部）→ 用量升序
//  Q4=A 最近使用槽（score=0）不做特例，自然落到最顶部
//  Q6=A /prompt 保留降序为例外（宿主菜单 scrollTop=0 + 高亮钉 index 0），返回集合仍是最常用的 30 条
//  Q7=A 智能卡序号按排名（1=最相关，在底部）
// 另补齐：#13 评论声称存在但仓库中缺失的 bottom-up 回归脚本（本文件即其后继）。
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript') }
const DIR = path.join(__dirname, '.rt-tmp');
fs.mkdirSync(DIR, { recursive: true });

function fail(msg) { console.log('FAIL: ' + msg); process.exit(1) }
function ok(msg) { console.log(' ok: ' + msg) }

const SRC = (...p) => path.join(__dirname, '..', 'src', 'client', ...p);
function transpile(out, src, deps) {
  let js = ts.transpileModule(fs.readFileSync(src, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true },
  }).outputText;
  for (const d of deps) js = js.split('require("' + d + '")').join('require("' + d + '.cjs")');
  fs.writeFileSync(path.join(DIR, out), js);
}
transpile('templates.cjs', SRC('templates.ts'), []);
transpile('words22.cjs', SRC('words.ts'), []);
transpile('store22.cjs', SRC('store.ts'), ['./templates']);
{
  // match 引用 ./store → 需指向本文件的 store22.cjs
  let js = ts.transpileModule(fs.readFileSync(SRC('match.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true },
  }).outputText;
  js = js.split('require("./templates")').join('require("./templates.cjs")');
  js = js.split('require("./store")').join('require("./store22.cjs")');
  js = js.split('require("./words")').join('require("./words22.cjs")');
  fs.writeFileSync(path.join(DIR, 'match22.cjs'), js);
}
const store = require(path.join(DIR, 'store22.cjs'));
const match = require(path.join(DIR, 'match22.cjs'));
const ids = (list) => list.map((x) => x.tpl ? x.tpl.id : x.id);

// ── A) 悬浮列表 bottom-up：sortedTemplatesBottomUp（统一公式） ──
console.log('=== A: 悬浮列表 bottom-up（统一公式） ===');
if (typeof store.tieBreakOrder !== 'function') fail('store 应导出 tieBreakOrder（统一末键）');
ok('tieBreakOrder 已导出（三面共用末键）');
store.savePinned([]);
const cLow = store.addCustom('低频', '自定义', 'low');
const cHigh = store.addCustom('高频', '自定义', 'high');
store.bumpUsage(cHigh.id); store.bumpUsage(cHigh.id); store.bumpUsage(cHigh.id);
// A1: 无置顶时用量升序，最常用在底部
let r = store.sortedTemplatesBottomUp([cLow, cHigh]).map((x) => x.id);
if (r[0] !== cLow.id || r[r.length - 1] !== cHigh.id) fail('无置顶时应为用量升序（高频在底部）: ' + JSON.stringify(r));
ok('A1 无置顶：用量升序，高频在底部');
// A2: 置顶只做同分 tie-break——0 次置顶仍在一切 1+ 用量之上（用量主键），同用量时置顶更贴底
store.savePinned([cLow.id]);
r = store.sortedTemplatesBottomUp([cLow, cHigh]).map((x) => x.id);
if (r[0] !== cLow.id || r[1] !== cHigh.id) fail('用量主键：0次置顶应在1+用量之上: ' + JSON.stringify(r));
ok('A2 用量主键：0次置顶不挤走高频（高频仍在底部）');
const cZero2 = store.addCustom('零二', '自定义', 'z2');
r = store.sortedTemplatesBottomUp([cLow, cZero2]).map((x) => x.id);
if (r[0] !== cZero2.id || r[1] !== cLow.id) fail('同用量时置顶应更贴底: ' + JSON.stringify(r));
ok('A2b 同用量：置顶更贴底');
// A3: 全 0 时预制按原始顺序、预制在自定义前、自定义按 createdAt
store.savePinned([]);
const presets = store.allTemplates().filter((x) => x.builtin);
const zero3 = store.sortedTemplatesBottomUp(presets.slice(0, 3)).map((x) => x.id);
if (zero3[0] !== 'fp' || zero3[1] !== 'socratic' || zero3[2] !== 'deep') fail('全0预制应按原始顺序: ' + JSON.stringify(zero3));
ok('A3a 全0预制按原始顺序（fp/socratic/deep）');
const customs = store.allTemplates().filter((x) => !x.builtin);
const mixed = store.sortedTemplatesBottomUp([...customs.slice(0, 2), ...presets.slice(0, 1)]).map((x) => x.id);
if (mixed[0] !== 'fp') fail('同0次时预制应在自定义之前: ' + JSON.stringify(mixed));
// 自定义之间按 createdAt 先后（cLow 先建 → 在上）
const customOnly = store.sortedTemplatesBottomUp([...customs]).map((x) => x.id);
if (customOnly.indexOf(cLow.id) > customOnly.indexOf(cZero2.id)) fail('同0次自定义应按 createdAt 先后: ' + JSON.stringify(customOnly));
ok('A3b 同0次：预制在前，自定义按 createdAt');

// ── B) 设置页 + /prompt 保留降序：sortedTemplates ──
console.log('=== B: 设置页 + /prompt 保留降序 ===');
store.savePinned([cLow.id]); // 0 次置顶
r = store.sortedTemplates([cLow, cHigh]).map((x) => x.id);
if (r[0] !== cLow.id) fail('降序面：0次置顶应绝对在前: ' + JSON.stringify(r));
ok('B1 置顶绝对优先（0次置顶盖过高频）');
store.savePinned([]);
r = store.sortedTemplates([cLow, cHigh]).map((x) => x.id);
if (r[0] !== cHigh.id) fail('降序面：非置顶应按用量降序: ' + JSON.stringify(r));
ok('B2 非置顶按用量降序（高频在上）');

// ── C) 智能卡：候选集不变 + 显示顺序 bottom-up ──
// 注意：store 模块缓存在同一进程内共享；bumpUsage 会同步改 lastUsed（最近使用槽），
// 下面每一步都把 lastUsed 精确控制在"预期 top-2 内"或"预期的最近使用项"，避免串扰。
console.log('=== C: 智能卡（评分升序显示） ===');
store.savePinned([]);
store.bumpUsage('fp'); // lastUsed=fp（C1/C2 的 top-2 成员，不产生多余行），fp 用量=1
// C1: 不同评分 → 最相关在底部（fp 强词×3+弱×1=7，deep 强词×2+弱×1=5）
let rows = match.smartCandidates('第一性原理 基本组成单元 颠覆 深度分析 多维');
if (rows.length !== 2) fail('应恰好 2 行（top-2，阈值≥2）: ' + JSON.stringify(ids(rows)));
if (rows[rows.length - 1].tpl.id !== 'fp' || rows[0].tpl.id !== 'deep') fail('最相关（fp）应在底部: ' + JSON.stringify(rows.map((x) => [x.tpl.id, x.score])));
ok('C1 评分升序：最相关（fp）在底部，deep 在上');
// C2: top-2 截断不变（第三名 fivewhys 强×1+弱×1=3 不入选）
rows = match.smartCandidates('第一性原理 基本组成单元 颠覆 深度分析 多维 五个为什么');
if (rows.length !== 2 || rows.some((x) => x.tpl.id === 'fivewhys')) fail('top-2 截断应保持（fivewhys 不入选）: ' + JSON.stringify(ids(rows)));
ok('C2 候选集不变：top-2 截断保持');
// C3: 同分时用量升序（fp=3 强×1+弱×1，deep=3 强×1+弱×1；deep 用量 2 > fp 用量 1 → deep 在底部）
store.bumpUsage('deep'); store.bumpUsage('deep'); // deep 用量=2，lastUsed=deep（top-2 成员）
rows = match.smartCandidates('第一性原理 深度分析');
if (rows.length !== 2) fail('同分双候选应恰好 2 行: ' + JSON.stringify(ids(rows)));
const last = rows[rows.length - 1];
if (last.tpl.id !== 'deep') fail('同分时高用量（deep=2次）应在底部: ' + JSON.stringify(rows.map((x) => [x.tpl.id, x.score])));
ok('C3 同分：用量升序（高用量在底部）');
// C4: 同（评分，用量）时置顶更贴底（socratic=2, feynman=2，用量各 1；置顶 feynman）
store.bumpUsage('feynman'); store.bumpUsage('socratic'); // 用量拉平，lastUsed=socratic（top-2 成员）
store.savePinned(['feynman']);
rows = match.smartCandidates('苏格拉底 费曼');
store.savePinned([]);
if (rows.length !== 2 || rows[rows.length - 1].tpl.id !== 'feynman') fail('同键时置顶应更贴底: ' + JSON.stringify(rows.map((x) => [x.tpl.id, x.score])));
ok('C4 同键：置顶更贴底');
// C5: 最近使用槽（score=0）自然在顶部——recent=quiz 不在 top-2 内
store.bumpUsage('quiz'); // lastUsed=quiz（非 top-2，将被追加）
rows = match.smartCandidates('第一性原理 基本组成单元 颠覆 深度分析 多维');
if (rows.length !== 3) fail('最近使用（quiz）应以 score=0 追加为第 3 行: ' + JSON.stringify(ids(rows)));
if (rows[0].tpl.id !== 'quiz' || rows[0].score !== 0) fail('最近使用应自然在顶部: ' + JSON.stringify(rows.map((x) => [x.tpl.id, x.score])));
if (rows[rows.length - 1].tpl.id !== 'fp') fail('追加最近使用后最相关仍应在底部: ' + JSON.stringify(ids(rows)));
ok('C5 最近使用槽：score=0 自然在顶部，最相关仍在底部');
// C6: 自定义仅经最近使用槽进入（recent=自定义）
store.bumpUsage(cLow.id); // lastUsed=自定义（非 top-2，将被追加）
rows = match.smartCandidates('第一性原理');
const customRecent = rows.find((x) => !x.tpl.builtin);
if (!customRecent || customRecent.score !== 0) fail('自定义应仅以 score=0 经最近使用进入: ' + JSON.stringify(rows.map((x) => [x.tpl.id, x.score])));
ok('C6 自定义仅经最近使用槽进入');
// C7: 门槛与守卫不变（弱词单次 score=1 不得分行；代码块内抑制；过短抑制）
// 注意：最近使用槽是 score=0 追加行，不受阈值门控（原有设计），故阈值断言为"无 score>0 行"
rows = match.smartCandidates('分析');
if (rows.some((x) => x.score > 0)) fail('弱词单次（score=1）不应产生得分行: ' + JSON.stringify(rows.map((x) => [x.tpl.id, x.score])));
if (match.smartCandidates('```\n第一性原理 基本组成单元 颠覆').length !== 0) fail('代码块内（未闭合围栏）应抑制出卡');
if (match.smartCandidates('a').length !== 0) fail('过短草稿应抑制出卡');
ok('C7 阈值≥2 / 代码块抑制 / 过短抑制保持');

// ── D) 四面接线（源码级）：谁用哪个排序函数 ──
console.log('=== D: 四面接线（源码级） ===');
const panelSrc = fs.readFileSync(SRC('panel.ts'), 'utf8');
if (!/compact \? sortedTemplatesBottomUp\(filtered\) : sortedTemplates\(filtered\)/.test(panelSrc)) fail('panel：compact 应走 BottomUp、设置页走降序');
if (!/bottom-up 浮层：打开 \/ 过滤变化后自动滚到底部/.test(panelSrc)) fail('panel：悬浮列表自动滚底注释丢失');
const scrollFx = panelSrc.slice(panelSrc.indexOf('自动滚到底部'));
if (!/if \(!compact\) return/.test(scrollFx)) fail('panel：滚底 effect 应仅 compact 生效');
ok('D1 panel：悬浮 bottom-up+滚底，设置页降序');
const triggerSrc = fs.readFileSync(SRC('trigger.ts'), 'utf8');
if (!triggerSrc.includes('sortedTemplates(')) fail('trigger：/prompt 应继续用 sortedTemplates（降序）');
if (triggerSrc.includes('sortedTemplatesBottomUp')) fail('trigger：/prompt 不得反转（宿主高亮钉首行）');
if (!triggerSrc.includes('slice(0, MAX_ITEMS)')) fail('trigger：应保留最常用的 30 条头部截取');
ok('D2 trigger：/prompt 降序 + 头部 30 条（例外有注释）');
const smartSrc = fs.readFileSync(SRC('smart.ts'), 'utf8');
if (!smartSrc.includes('String(rows.length - i)')) fail('smart：序号应按排名（1=最相关在底部）');
if (/String\(i \+ 1\)/.test(smartSrc)) fail('smart：不应再有按位置编号 String(i + 1)');
if (!smartSrc.includes('fallbackUsage')) fail('smart：兜底集合应套用 bottom-up 行内顺序');
ok('D3 smart：序号按排名 + 兜底行内 bottom-up');
const ctx = fs.readFileSync(path.join(__dirname, '..', 'CONTEXT.md'), 'utf8');
if (!ctx.includes('智能卡以评分为键')) fail('CONTEXT：底置排序应写明智能卡以评分为键');
if (!ctx.includes('设置页与 /prompt 为明确例外') && !ctx.includes('设置页与 /prompt 保留用量降序')) fail('CONTEXT：应写明设置页//prompt 例外');
ok('D4 CONTEXT.md 术语同步（含两处例外）');

console.log('=== Test #22 PASS ===');
process.exit(0);
