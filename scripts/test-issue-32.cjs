// 回归测试 #32: 自定义标签进智能召回评分
// 验收映射（#32 正文 + Agent Brief）：
//  A) 自选标签命中按强词 +2（大小写不敏感）；名称/正文命中按弱词 +1（自身文本，不用 haystack）
//  B) 与预置同池竞争 top-2（分数降序→用量降序选集），强相关自定义可挤掉弱预置
//  C) 空 / 仅回落“自定义” / 单字标签不参评（0 分，仅 lastUsed 槽可见）
//  D) 阈值 2、槽位结构、lastUsed、展示行、bottom-up 展示顺序全不动；预置路径一字不动
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
  ['words.ts', SRC('words.ts'), []],
  ['match.ts', SRC('match.ts'), ['./store', './words']],
];
for (const [outName, srcPath, deps] of MODULES) {
  let src = fs.readFileSync(srcPath, 'utf8');
  let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true } }).outputText;
  for (const d of deps) js = js.split('require("' + d + '")').join('require("' + d + '.cjs")');
  fs.writeFileSync(path.join(DIR, outName.replace(/\.ts$/, '.cjs')), js);
}
const req = (n) => require(path.join(DIR, n + '.cjs'));
const store = req('store');
const match = req('match');

function assert(cond, msg) {
  if (!cond) { console.log('FAIL: ' + msg); process.exit(1); }
  console.log(' ok: ' + msg);
}

async function main() {
  console.log('=== Test #32 A: 自定义评分纯函数 ===');
  const t = (labels, name, body) => ({ id: 'x', name, nameEn: '', labels, body, builtin: false });
  let r = match.scoreCustomLabels('帮我复盘这次迭代', t(['复盘'], '复盘助手', '总结一下'));
  assert(r.score === 2 && r.strong.join() === '复盘', '标签命中 +2（实得 ' + r.score + '）');
  r = match.scoreCustomLabels('帮我复盘这次迭代', t(['复盘', '迭代'], '复盘助手', '总结一下'));
  assert(r.score === 4, '双标签命中 +4（实得 ' + r.score + '）');
  r = match.scoreCustomLabels('排期助手帮我排期', t(['排期'], '排期助手', '写点别的'));
  assert(r.score === 3 && r.weak.join() === '排期助手', '名称命中 +1（标签 +2 并存）');
  r = match.scoreCustomLabels('帮我排期', t(['qqqxyz'], '名字', '帮我排期'));
  assert(r.score === 1 && r.strong.length === 0, '正文命中 +1（仅弱词，不足阈值）');
  r = match.scoreCustomLabels('RETRO time', t(['Retro'], 'n', 'b'));
  assert(r.score === 2, '大小写不敏感');
  r = match.scoreCustomLabels('帮我复盘这次迭代', t([], 'n', 'b'));
  assert(r.score === 0, '空标签 0 分');
  r = match.scoreCustomLabels('自定义模板怎么用', t(['自定义'], 'n', 'b'));
  assert(r.score === 0, '仅回落词 0 分（draft 含“自定义”也不参评）');
  r = match.scoreCustomLabels('我想学点东西', t(['学'], '单字', '正文'));
  assert(r.score === 0, '单字标签不参评');

  console.log('=== Test #32 B: 同池竞争 top-2 ===');
  const c1 = store.addCustom('复盘助手', ['复盘', '迭代'], '总结一下');
  const cEmpty = store.addCustom('空的', [], '与复盘无关的正文');
  const cOne = store.addCustom('单字', ['学'], '正文');
  let cands = match.smartCandidates('帮我复盘这次迭代');
  const ids = cands.map((s) => s.tpl.id);
  assert(ids.includes(c1.id), '自定义凭标签分进入候选');
  assert(ids.includes('retro'), '预置仍在（同池共存）');
  assert(!ids.includes(cEmpty.id) && !ids.includes(cOne.id), '空/单字不因评分出卡');
  // 强相关自定义（4 分）挤掉弱预置：展示 bottom-up，最相关在底部
  assert(cands[cands.length - 1].tpl.id === c1.id, '最相关在底部（bottom-up 展示不动）');
  assert(cands.length <= 3, '候选仍 ≤3');

  console.log('=== Test #32 C/D: 阈值/槽位/预置不动 ===');
  // 阈值：1 分（仅弱词）不出卡
  const cWeak = store.addCustom('弱引用', ['qqqxyz'], '帮我排期');
  cands = match.smartCandidates('帮我排期');
  assert(!cands.some((s) => s.tpl.id === cWeak.id), '1 分不足阈值不出卡');
  // lastUsed 槽保留：无命中 draft 仍带入最近使用
  store.bumpUsage(cWeak.id);
  cands = match.smartCandidates('zxqw 无匹配串');
  assert(cands.length === 1 && cands[0].tpl.id === cWeak.id && cands[0].score === 0, 'lastUsed 槽保留（含自定义）');
  // 预置路径一字不动：阈值与行为
  const rp = match.scoreDraft('帮我复盘这次迭代', store.getTemplate('retro'));
  assert(rp.score === 2, '预置评分不动');

  console.log('=== Test #32 PASS ===');
}

main().then(() => process.exit(0), (e) => { console.log('FAIL: ' + (e && e.stack || e)); process.exit(1); });
