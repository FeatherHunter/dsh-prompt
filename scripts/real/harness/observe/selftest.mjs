#!/usr/bin/env node
/**
 * 边界观测层 / 真实输入驱动的自证脚本：纯 Node、不起宿主、不动浏览器。
 *
 * 覆盖票 #188 里所有可以离线验证的纯函数面：
 * 1. 来源等级模型（自述 < 内部状态 < 公开接口 < 用户可见 < 持久化）：序、比较、最低来源；
 * 2. 语义文本定位（归一 / exact / contains / regex / any）：不靠内部类名只靠用户可见文本；
 * 3. 原始观测先记录再解释：解释器只吃原始 JSON、输出带来源等级的可判字段；
 * 4. 双通道比较（界面文本 + 持久化数据）与两条输入路径的观测差分；
 * 5. 输入序列构造（多段指针移动、按下/抬起、修饰键位掩码、快捷键、文本输入）；
 * 6. 句柄装配（observer/input/persistence 接口封闭、页面表达式可解析、参数校验）。
 *
 * 运行：node scripts/real/harness/observe/selftest.mjs
 * 退出码：0 = 全部通过；1 = 有失败（逐条列出）。
 */

import {
  SOURCES,
  SOURCE_IDS,
  assertSourceId,
  describeSources,
  grade,
  isSourceId,
  meetsMinimum,
  rankOf,
  strongerSource,
  summarizeGrading,
  weakestSource,
} from './source.mjs';
import {
  MATCH_MODES,
  describeTextSpec,
  findRow,
  locateRows,
  matchText,
  normalizeText,
  rowKey,
} from './text.mjs';
import {
  compareDualChannels,
  diffEventSequences,
  diffObservations,
  eventTypeSequence,
  flattenObservation,
  sameObservation,
} from './compare.mjs';
import {
  KEY_TABLE,
  MODIFIER_BITS,
  describePlan,
  modifierMask,
  planClick,
  planKey,
  planPointerPath,
  planShortcut,
  planTextInput,
} from '../input-plan.mjs';
import {
  interpretComposer,
  interpretOverlays,
  interpretPanel,
  interpretRows,
  interpretSettings,
  interpretSnapshot,
  interpretStore,
  interpretTrigger,
} from './interpret.mjs';
import { HOOKS, PROBE_VERSION, snapshotExpression } from './probes.mjs';
import { createObserver, createPersistence } from './index.mjs';
import { INPUT_LOG_CAP, INPUT_LOG_KEY, createInputDriver } from '../input.mjs';

let passCount = 0;
const failures = [];

function ok(condition, name, detail) {
  if (condition) {
    passCount += 1;
    return true;
  }
  failures.push({ name, detail });
  return false;
}

function eq(actual, expected, name) {
  const same = Object.is(actual, expected);
  return ok(same, name, same ? '' : '当前=' + JSON.stringify(actual) + '，期望=' + JSON.stringify(expected));
}

function deepEq(actual, expected, name) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  return ok(a === b, name, a === b ? '' : '当前=' + a + '，期望=' + b);
}

function section(title) {
  console.log('\n## ' + title);
}

function throws(fn, expected, name) {
  try {
    fn();
    return ok(false, name, '没有抛错');
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    ok(message.includes(expected.messageIncludes), name, '文案=' + message);
    return true;
  }
}

/* ────────────────────────────── 1. 来源等级模型 ────────────────────────────── */

section('1. 来源等级模型（自述 < 内部状态 < 公开接口 < 用户可见 < 持久化）');

deepEq(
  SOURCES.map((source) => source.id),
  ['self-report', 'internal-state', 'public-api', 'user-visible', 'persisted'],
  '五个等级且按强度从弱到强排序',
);
deepEq(
  SOURCES.map((source) => source.label),
  ['自述', '内部状态', '公开接口', '用户可见', '持久化'],
  '等级中文标签与票面口径一致',
);
eq(SOURCE_IDS.length, 5, 'SOURCE_IDS 与 SOURCES 同长');
ok(SOURCE_IDS.every((id) => isSourceId(id)), 'SOURCE_IDS 全部可识别');
ok(!isSourceId('className'), '内部类名不是合法来源等级');
ok(!isSourceId(''), '空串不是合法来源等级');

eq(rankOf('self-report'), 1, '自述 = 1');
eq(rankOf('internal-state'), 2, '内部状态 = 2');
eq(rankOf('public-api'), 3, '公开接口 = 3');
eq(rankOf('user-visible'), 4, '用户可见 = 4');
eq(rankOf('persisted'), 5, '持久化 = 5');
throws(() => rankOf('guess'), { messageIncludes: '未知来源等级' }, 'rankOf 对未知等级抛错（不允许匿名等级混进报告）');

eq(strongerSource('user-visible', 'public-api'), 'user-visible', '用户可见强于公开接口');
eq(strongerSource('public-api', 'persisted'), 'persisted', '持久化强于公开接口');
eq(strongerSource('user-visible', 'user-visible'), 'user-visible', '同级返回自身');
eq(weakestSource(['persisted', 'user-visible', 'public-api']), 'public-api', 'weakestSource 取最弱一级');
eq(weakestSource([]), null, '空集合没有最弱来源');
eq(strongerSource('internal-state', 'self-report'), 'internal-state', '内部状态强于自述');

ok(meetsMinimum('persisted', 'user-visible'), '持久化满足用户可见的最低要求');
ok(meetsMinimum('user-visible', 'user-visible'), '同级满足最低要求');
ok(!meetsMinimum('public-api', 'user-visible'), '公开接口不满足用户可见的最低要求');
ok(!meetsMinimum('self-report', 'internal-state'), '自述不满足内部状态的最低要求');
deepEq(
  grade(42, 'persisted'),
  { value: 42, source: 'persisted' },
  'grade 把值与其来源等级绑在一起（不给出处的值不放进报告）',
);
throws(() => grade(1, 'hearsay'), { messageIncludes: '未知来源等级' }, 'grade 拒绝未知来源等级');
throws(() => assertSourceId('hearsay'), { messageIncludes: '未知来源等级' }, 'assertSourceId 拒绝未知来源等级');
eq(assertSourceId('user-visible'), 'user-visible', 'assertSourceId 对合法等级原样返回');

const grading = summarizeGrading({
  text: { value: '模板 A', source: 'user-visible' },
  caret: { value: 12, source: 'public-api' },
  store: { value: { usage: 3 }, source: 'persisted' },
});
eq(grading.minSource, 'public-api', 'summarizeGrading 取全部字段里最弱的来源（报告不能自吹）');
eq(grading.fields, 3, 'summarizeGrading 统计字段数');
deepEq(grading.weak, ['caret'], 'summarizeGrading 列出处在最弱级的字段');
deepEq(
  describeSources(),
  ['自述(1)', '内部状态(2)', '公开接口(3)', '用户可见(4)', '持久化(5)'],
  'describeSources 打印有序等级表（文档与报告共用一份）',
);

/* ────────────────────────────── 2. 语义文本定位 ────────────────────────────── */

section('2. 语义文本定位（按用户可见文本找元素，不靠内部类名）');

deepEq(MATCH_MODES, ['exact', 'contains', 'regex', 'any'], '四种文本匹配模式');
eq(normalizeText('  模板 A\n  第二行 \u00a0 '), '模板 A 第二行', '归一：去首尾、折叠空白与不换行空格');
eq(normalizeText('a\u200bb'), 'ab', '归一：去零宽字符（字体/换行器插入物不该影响定位）');
eq(normalizeText(undefined), '', '归一：非字符串当空串（缺文本不是匹配成功）');

eq(matchText('模板 A', '模板 A'), true, '字符串简写 = exact 精确匹配');
eq(matchText(' 模板 A ', '模板 A'), true, 'exact 匹配前先归一（首尾空白不影响）');
eq(matchText('模板 A（run-1）', '模板 A'), false, 'exact 不接受多余文本');
eq(matchText('模板 A（run-1）', { mode: 'contains', value: '模板 A' }), true, 'contains 命中子串');
eq(matchText('模板 A', { mode: 'contains', value: '模板 B' }), false, 'contains 不命中时返回 false');
throws(
  () => matchText('模板 A', { mode: 'startsWith', value: '模板' }),
  { messageIncludes: '未知文本匹配模式' },
  '未知模式不被悄悄接受',
);
eq(matchText('模板 A（run-7）', { mode: 'regex', value: '模板 A（run-[0-9]+）' }), true, 'regex 命中（动态 run tag 场景）');
eq(matchText('模板 A', { mode: 'regex', value: '[' }), false, '非法正则返回 false 而不是抛错炸套件');
eq(
  matchText('模板 B', { mode: 'any', values: ['模板 A', { mode: 'contains', value: '模板 B' }] }),
  true,
  'any 里任一条命中即可（同一文案的多语言候选）',
);
eq(matchText('模板 C', { mode: 'any', values: ['模板 A', '模板 B'] }), false, 'any 全不命中返回 false');
throws(() => matchText('x', { mode: 'guess', value: 'x' }), { messageIncludes: '未知文本匹配模式' }, '未知匹配模式抛错');
eq(describeTextSpec('模板 A'), 'exact「模板 A」', 'describeTextSpec 把期望写进报告');
eq(describeTextSpec({ mode: 'contains', value: '模板' }), 'contains「模板」', 'describeTextSpec 描述非精确模式');

const FIXTURE_ROWS = [
  { id: 'fx-run-alpha', text: '夹具模板 A（run-1） 夹具 第一条夹具模板正文，run=run-1。 3', rect: { cx: 100, cy: 10 } },
  { id: 'fx-run-beta', text: '夹具模板 B 夹具 第二条夹具模板正文。 0', rect: { cx: 100, cy: 30 } },
];
deepEq(rowKey(FIXTURE_ROWS[0]), 'fx-run-alpha', 'rowKey 用契约钩子 data-dsh-prompt-id 作为行身份');
eq(findRow(FIXTURE_ROWS, { mode: 'contains', value: '模板 B' }).index, 1, 'findRow 按语义文本定位行（大小写/空白归一后）');
eq(findRow(FIXTURE_ROWS, { mode: 'contains', value: '模板 Z' }), null, '找不到行返回 null 而不是抛错（由调用方决定 FAIL/BLOCKED）');
eq(locateRows(FIXTURE_ROWS, { mode: 'contains', value: '夹具模板' }).length, 2, 'locateRows 返回全部命中（断言列表规模）');
deepEq(
  locateRows(FIXTURE_ROWS, { mode: 'contains', value: '夹具模板' }).map((hit) => hit.index),
  [0, 1],
  'locateRows 保留原始顺序（视觉顺序即用户读到的顺序）',
);
throws(
  () => findRow(FIXTURE_ROWS, { mode: 'agent-report', value: 'x' }),
  { messageIncludes: '未知文本匹配模式' },
  '未知模式在 findRow 里同样被拒绝（不静默当不匹配）',
);



/* ────────────────────────────── 3. 原始观测差分与双通道 ────────────────────────────── */

section('3. 原始观测先记录再解释：差分与双通道比较');

deepEq(
  flattenObservation({ open: true, panel: { visible: true, rect: { width: 320, height: 200 } } }),
  [
    { path: 'open', value: true },
    { path: 'panel.visible', value: true },
    { path: 'panel.rect.width', value: 320 },
    { path: 'panel.rect.height', value: 200 },
  ],
  'flattenObservation 把原始观测拍平成 路径→值（报告里逐条可判）',
);
deepEq(
  flattenObservation({ rows: [{ id: 'a' }, { id: 'b' }] }),
  [
    { path: 'rows.0.id', value: 'a' },
    { path: 'rows.1.id', value: 'b' },
  ],
  'flattenObservation 数组按下标展开（模板行顺序也是观测面）',
);
eq(flattenObservation({ empty: '' }).length, 1, '空串仍是叶子值（缺值不能跟空串混为一谈）');

const BEFORE = { panel: { open: true, rect: { width: 320 } }, composer: { draft: '第一行', caret: 3 } };
const AFTER = { panel: { open: true, rect: { width: 340 } }, composer: { draft: '第一行第二行', caret: 7 } };
const diff = diffObservations(BEFORE, AFTER);
eq(diff.count, 3, 'diffObservations 数出全部变化路径');
deepEq(
  diff.diffs.map((item) => item.path),
  ['panel.rect.width', 'composer.draft', 'composer.caret'],
  'diffObservations 输出路径顺序稳定（报告可 diff）',
);
eq(diffObservations(BEFORE, BEFORE).count, 0, '同一份原始观测差分 0 条');
eq(sameObservation(BEFORE, AFTER), false, 'sameObservation 有变化返回 false');
eq(sameObservation(BEFORE, { ...BEFORE }), true, 'sameObservation 值相同返回 true');
eq(
  diffObservations(BEFORE, AFTER, { ignore: ['panel.rect.width'] }).count,
  2,
  'ignore 精确路径：尺寸抖动不算行为变化',
);
eq(
  diffObservations(BEFORE, { ...AFTER, panel: { ...AFTER.panel, rect: {} } }, { ignore: ['panel.rect.*'] }).count,
  2,
  'ignore 通配前缀：面板几何整体忽略（只剩草稿/光标两条）',
);
deepEq(
  diffObservations({ a: 1 }, { a: 1, b: 2 }).diffs[0],
  { path: 'b', before: undefined, after: 2 },
  '新增路径的 before 记 undefined（不伪造旧值）',
);

const dualAgree = compareDualChannels(
  { name: 'ui', value: false, source: 'user-visible' },
  { name: 'store', value: false, source: 'persisted' },
  { name: 'hidePreset' },
);
deepEq([dualAgree.agree, dualAgree.name], [true, 'hidePreset'], '双通道一致时 agree=true');
const dualMapped = compareDualChannels(
  { name: 'ui', value: '3', source: 'user-visible' },
  { name: 'store', value: 3, source: 'persisted' },
  { name: 'usage', compare: (a, b) => Number(a) === Number(b) },
);
eq(dualMapped.agree, true, '双通道允许显式 mapper 比较（界面文本「3」vs 持久化数字 3）');
const dualDisagree = compareDualChannels(
  { name: 'ui', value: true, source: 'user-visible' },
  { name: 'store', value: false, source: 'persisted' },
  { name: 'hoverTrigger' },
);
eq(dualDisagree.agree, false, '双通道不一致 → agree=false（两路都留在报告里）');
eq(dualDisagree.a.source, 'user-visible', '不一致时保留界面通道来源');
eq(dualDisagree.b.source, 'persisted', '不一致时保留持久化通道来源');
throws(
  () => compareDualChannels({ name: 'ui', value: 1, source: 'guess' }, { name: 'store', value: 1, source: 'persisted' }),
  { messageIncludes: '未知来源等级' },
  '双通道不允许匿名来源（拿不到可信来源的通道不能当证据）',
);

// #183 评审整改 S4：两路证据同层不能当双通道（即使值相等也必须 agree=false/证据不闭合）。
const dualSameLayer = compareDualChannels(
  { name: 'panelVisible', value: true, source: 'user-visible' },
  { name: 'rowVisible', value: true, source: 'user-visible' },
  { name: 'visible' },
);
eq(dualSameLayer.agree, false, 'S4 同一来源层（user-visible vs user-visible）不算双通道一致');
eq(dualSameLayer.sourceConflict, true, 'S4 同层对账显式标记 sourceConflict=true');
ok(String(dualSameLayer.detail).includes('两路证据同源'), 'S4 同层对账写明「两路证据同源，证据不闭合」');
const dualSamePersisted = compareDualChannels(
  { name: 'storeUsage', value: 1, source: 'persisted' },
  { name: 'storeLastUsed', value: 1, source: 'persisted' },
  { name: 'persistedPair' },
);
eq(dualSamePersisted.agree, false, 'S4 两条 persisted 证据同样不能互证（同层）');
eq(dualSamePersisted.sourceConflict, true, 'S4 两条持久化证据也标 sourceConflict');
const dualCrossLayer = compareDualChannels(
  { name: 'api', value: true, source: 'public-api' },
  { name: 'store', value: true, source: 'persisted' },
  { name: 'crossLayer' },
);
deepEq([dualCrossLayer.agree, dualCrossLayer.sourceConflict], [true, false], 'S4 跨层（public-api vs persisted）仍判 agree=true');

const PHYS = [
  { type: 'pointer.move', phase: 'enter', target: 'entry' },
  { type: 'pointer.down', target: 'entry' },
  { type: 'pointer.up', target: 'entry' },
  { type: 'panel.open' },
];
const SYNTH = [
  { type: 'synthetic.click', target: 'entry' },
  { type: 'panel.open' },
];
deepEq(eventTypeSequence(PHYS), ['pointer.move', 'pointer.down', 'pointer.up', 'panel.open'], 'eventTypeSequence 只取事件名序列');
const eventsDiff = diffEventSequences(PHYS, SYNTH);
deepEq(eventsDiff.onlyLeft, ['pointer.move', 'pointer.down', 'pointer.up'], '两路事件差异：物理指针独有 move/down/up');
deepEq(eventsDiff.onlyRight, ['synthetic.click'], '合成路径独有 synthetic.click（物理路径的点击由 down/up 表达）');
eq(eventsDiff.same, false, '两路事件序列不同 → same=false，但要靠观测差分判断行为是否一致');

/* ────────────────────────────── 4. 输入序列构造 ────────────────────────────── */

section('4. 输入序列构造（多段指针移动 / 修饰键 / 快捷键 / 文本输入）');

deepEq(MODIFIER_BITS, { alt: 1, ctrl: 2, meta: 4, shift: 8 }, 'CDP 修饰键位掩码（alt=1 ctrl=2 meta=4 shift=8）');
eq(modifierMask([]), 0, '无修饰键 = 0');
eq(modifierMask(['shift']), 8, 'shift 单独 = 8');
eq(modifierMask(['Alt', 'Control']), 3, '别名 Alt/Control 映射到 alt/ctrl（大小写不敏感）');
eq(modifierMask('shift'), 8, '字符串简写也接受');
throws(() => modifierMask(['hyper']), { messageIncludes: '未知修饰键' }, '未知修饰键抛错');

deepEq(
  planPointerPath({ x: 0, y: 0 }, { x: 100, y: 50 }, { steps: 3 }).map((point) => [point.x, point.y]),
  [[0, 0], [50, 25], [100, 50]],
  '多段指针移动：起点与终点都在序列里，中间线性插值（move→…→终点）',
);
eq(planPointerPath({ x: 10, y: 10 }, { x: 20, y: 20 }).length, 8, '默认 8 段移动（跨过 hover 检测阈值）');
eq(planPointerPath({ x: 5, y: 5 }, { x: 5, y: 5 }).length, 2, '原地也至少两段（先进入再点击）');
deepEq(planPointerPath({ x: 0, y: 0 }, { x: 10, y: 10 }, { steps: 2 })[1], { x: 10, y: 10 }, '两段 = 起点+终点');

const clickPlan = planClick({ x: 100, y: 200 }, { steps: 2 });
deepEq(
  clickPlan.map((op) => op.type),
  ['mouseMoved', 'mouseMoved', 'mousePressed', 'mouseReleased'],
  '一次物理点击 = 多段 move → pressed → released',
);
deepEq(clickPlan[2].buttons, 1, '按下时 buttons 位含左键（1）');
deepEq(clickPlan[3].buttons, 0, '抬起时 buttons 清空（0）');
eq(clickPlan[3].x, 100, '抬起坐标与按下一致（不是回到 0,0）');
eq(planClick({ x: 1, y: 2 }, { clickCount: 2 })[3].clickCount, 2, '双击点击计数透传');
eq(planClick({ x: 1, y: 2 }, { button: 'right' })[2].button, 'right', '右键按钮透传');

const enterSpec = planKey('Enter');
eq(enterSpec[0].key, 'Enter', 'Enter 按键名');
eq(enterSpec[0].code, 'Enter', 'Enter code');
eq(enterSpec[0].windowsVirtualKeyCode, 13, 'Enter 虚拟键码 13');
eq(enterSpec[0].modifiers, 0, '无修饰键默认 0');
eq(enterSpec[1].type, 'keyUp', '一次按键 = keyDown + keyUp');
eq(planKey('ArrowDown').length, 2, '方向键也能构造');
eq(KEY_TABLE.Enter.windowsVirtualKeyCode, 13, 'KEY_TABLE 公开按键表（input.mjs 与自证同一份）');

const shortcutPlan = planShortcut('Ctrl+A');
eq(shortcutPlan[0].type, 'keyDown', '快捷键先 keyDown');
eq(shortcutPlan[0].key, 'a', 'Ctrl+A 的 key 是 a');
eq(shortcutPlan[0].code, 'KeyA', 'Ctrl+A 的 code 是 KeyA');
eq(shortcutPlan[0].modifiers, 2, 'Ctrl+A 带 ctrl 位掩码 2');
eq(shortcutPlan[1].type, 'keyUp', '快捷键再 keyUp');
eq(planShortcut('Shift+ArrowLeft')[0].modifiers, 8, 'Shift+方向键选区：shift 位掩码');
eq(planShortcut('Alt+Control+Enter')[0].modifiers, 3, '多修饰键组合');
throws(() => planShortcut('Hyper+A'), { messageIncludes: '未知修饰键' }, '快捷键里的未知修饰键抛错');
throws(() => planShortcut(''), { messageIncludes: '快捷键不能为空' }, '空快捷键抛错');

deepEq(planTextInput('模板 A\n第二行'), [{ type: 'insertText', text: '模板 A\n第二行' }], '文本输入走 insertText（一次提交，不逐字符伪造 keydown）');
eq(planTextInput('')[0].text, '', '空文本也是合法输入（先清空再断言）');
deepEq(describePlan(planClick({ x: 1, y: 2 }, { steps: 1 })), ['pointer.move(1,2)', 'pointer.press(left)', 'pointer.release(left)'], 'describePlan 给报告人类可读摘要');
deepEq(describePlan(planShortcut('Ctrl+A')), ['key.down(Ctrl+A)', 'key.up(Ctrl+A)'], 'describePlan 描述快捷键');
deepEq(describePlan(planTextInput('abc')), ['text.insert(3 chars)'], 'describePlan 不把输入正文塞进日志（避免报告泄露草稿）');

/* ────────────────────────────── 5. 原始观测 → 分级字段（解释器） ────────────────────────────── */

section('5. 原始观测先记录再解释：六个观测面的分级字段');

const RAW = {
  version: 1,
  at: 1700000000000,
  href: 'http://127.0.0.1:1/',
  lang: 'zh-CN',
  entry: {
    count: 1,
    first: { rect: { x: 10, y: 20, width: 24, height: 24 }, text: '模板', visible: true, title: '提示词模板' },
  },
  panel: {
    holderCount: 1,
    visible: true,
    rect: { x: 100, y: 200, width: 320, height: 180 },
    childCount: 5,
    bar: { present: true, text: '搜索 2 模板管理', countsText: '2', closePresent: true },
    list: {
      present: true,
      rows: [
        { index: 0, id: 'fx-run-alpha', text: '夹具模板 A（run-1） 夹具 第一条正文 2', visible: true, rect: { x: 100, y: 240, width: 300, height: 28 } },
        { index: 1, id: 'fx-run-beta', text: '夹具模板 B 夹具 第二条正文 0', visible: true, rect: { x: 100, y: 268, width: 300, height: 28 } },
      ],
    },
    remotePanel: { present: true, visible: false, rect: null, textSnippet: '' },
    modals: [{ kind: 'modal', rect: { x: 0, y: 0, width: 800, height: 600 }, textSnippet: '' }],
  },
  composer: {
    present: true,
    rect: { x: 0, y: 700, width: 800, height: 120 },
    focused: true,
    text: '第一行\n第二行',
    textLength: 7,
    selection: { start: 9, end: 9, collapsed: true, anchorText: '第二行', focusText: '第二行', rangeCount: 1 },
    inputActions: { found: true, depth: 6, capture: { start: 9, end: 9, draftRev: 4 }, captureError: null },
  },
  settings: {
    dialog: {
      present: true,
      visible: true,
      rect: { x: 200, y: 100, width: 640, height: 480 },
      ariaModal: true,
      sectionNavRows: [{ text: '通用', visible: true }, { text: '提示词模板', visible: true }],
    },
    section: {
      present: true,
      hideToggle: { present: true, checked: true, rect: { x: 300, y: 220, width: 16, height: 16 } },
      remoteSection: { present: true },
      triggerButton: { present: true, ariaPressed: 'true', text: '当前：点击触发', title: '当前：点击触发，点击切换为悬浮触发', rect: { x: 300, y: 260, width: 120, height: 24 } },
    },
  },
  trigger: {
    entryPresent: true,
    entryRect: { x: 10, y: 20, width: 24, height: 24 },
    barTrigger: { present: true, ariaPressed: 'false', text: '当前：悬浮触发', title: '当前：悬浮触发，点击切换为点击触发', rect: { x: 500, y: 210, width: 120, height: 24 } },
  },
  overlays: { modalCount: 1, remotePanelPresent: true, remotePanelVisible: false, settingsDialogPresent: true },
};

const panel = interpretPanel(RAW);
eq(panel.fields.present.value, true, '①面板根：holder 存在（契约钩子，public-api）');
eq(panel.fields.present.source, 'public-api', '①面板根的来源标 public-api');
eq(panel.fields.visible.value, true, '①面板可见（用户可见）');
eq(panel.fields.visible.source, 'user-visible', '①可见性来源标 user-visible');
deepEq(panel.fields.rect.value, { x: 100, y: 200, width: 320, height: 180 }, '①面板几何原样进观测（机器可判尺寸）');
eq(panel.fields.barPresent.value, true, '①底栏存在（契约钩子）');
eq(interpretPanel(null).fields.present.value, false, '缺 raw.panel 时 present=false（不是抛错）');

const rows = interpretRows(RAW);
eq(rows.fields.count.value, 2, '②模板行数=2（逐行渲染结果，不是 store 条数）');
eq(rows.fields.count.source, 'user-visible', '②行数来源标 user-visible（用户看到几行）');
deepEq(rows.fields.ids.value, ['fx-run-alpha', 'fx-run-beta'], '②行身份来自 data-dsh-prompt-id 契约钩子');
eq(rows.fields.ids.source, 'public-api', '②行 id 来源标 public-api');
deepEq(rows.fields.texts.value, ['夹具模板 A（run-1） 夹具 第一条正文 2', '夹具模板 B 夹具 第二条正文 0'], '②行文本原样进观测（语义定位输入）');
eq(findRow(rows.fields.texts.value.map((text, index) => ({ id: rows.fields.ids.value[index], text })), { mode: 'contains', value: '模板 B' }).index, 1, '②解释后的行能被语义文本定位（与 §2 串起来）');
eq(interpretRows({}).fields.count.value, 0, '②没有列表时行数=0');

const composer = interpretComposer(RAW);
eq(composer.fields.draftText.value, '第一行\n第二行', '③草稿文本来自 composer 用户可见文本（不抄内部 state）');
eq(composer.fields.draftChars.value, 7, '③草稿字符数按原文算（换行也算 1 个字符）');
deepEq([composer.fields.caretStart.value, composer.fields.caretEnd.value], [9, 9], '③光标位置来自宿主公开接口 captureInsertion');
eq(composer.fields.caretStart.source, 'public-api', '③光标来源标 public-api（宿主钉住接口）');
eq(composer.fields.selectionStart.value, 9, '③DOM 选区偏移是第二路（用户可见）');
eq(composer.fields.selectionStart.source, 'user-visible', '③DOM 选区来源标 user-visible');
eq(composer.fields.focused.value, true, '③焦点状态');
eq(composer.fields.draftRev.value, 4, '③draftRev 原样保留（后续断言插入前后修订号变化）');
eq(interpretComposer({}).fields.draftText.value, '', '③composer 不存在时草稿文本为空串');

const settings = interpretSettings(RAW, { sectionName: '提示词模板' });
eq(settings.fields.dialogOpen.value, true, '④设置弹窗已打开（role=dialog 语义）');
eq(settings.fields.navMatch.value, true, '④导航行按产品文本精确匹配（STR.sectionName）');
eq(settings.fields.sectionPresent.value, true, '④插件设置页区块已挂载');
eq(settings.fields.hidePreset.value, true, '④「屏蔽预制模板」勾选状态来自 checkbox 用户可见状态');
eq(settings.fields.hidePreset.source, 'user-visible', '④开关来源标 user-visible');
eq(settings.fields.triggerAriaPressed.value, 'true', '④触发方式按钮 aria-pressed 原样观测');
eq(settings.fields.triggerMode.value, 'click', '④aria-pressed=true 解释为「仅点击触发」（#179 契约）');
eq(settings.fields.triggerMode.source, 'public-api', '④触发方式语义来源标 public-api（契约钉住 aria-pressed 语义）');
eq(interpretSettings({}, { sectionName: '提示词模板' }).fields.dialogOpen.value, false, '④没有设置弹窗时 dialogOpen=false');

const overlays = interpretOverlays(RAW);
eq(overlays.fields.modalCount.value, 1, '⑤弹层计数（data-dsh-prompt-modal）');
eq(overlays.fields.remotePanelPresent.value, true, '⑤远程列表容器存在（契约钩子）');
eq(overlays.fields.remotePanelVisible.value, false, '⑤远程列表当前不可见');
eq(overlays.fields.settingsDialogPresent.value, true, '⑤设置弹层存在（弹层观测面覆盖设置页）');

const trigger = interpretTrigger(RAW);
eq(trigger.fields.entryPresent.value, true, '⑥悬浮入口存在');
eq(trigger.fields.barTriggerPresent.value, true, '⑥底栏触发方式按钮存在');
eq(trigger.fields.barTriggerAriaPressed.value, 'false', '⑥底栏按钮 aria-pressed=false = 悬浮触发');
eq(trigger.fields.entryRect.value.width, 24, '⑥入口尺寸进观测（hover 需要真实几何）');

const store = interpretStore({
  storePresent: true,
  unit: { name: 'dsh_prompt', version: 0 },
  customs: [{ id: 'fx-run-alpha', name: '夹具模板 A（run-1）', builtin: false, labels: ['夹具'] }],
  usage: { 'fx-run-alpha': 1 },
  pinned: ['fx-run-alpha'],
  lastUsed: 'fx-run-alpha',
  remote: { enabled: false, size: 5, orientation: 'auto', density: 'a' },
  hidePreset: true,
  hoverTrigger: false,
});
eq(store.fields.storePresent.value, true, '双通道之持久化：store 读回存在');
eq(store.fields.hidePreset.value, true, '双通道之持久化：hidePreset 从 store 读回');
eq(store.fields.hidePreset.source, 'persisted', '双通道之持久化来源标 persisted');
eq(store.fields.usage.value['fx-run-alpha'], 1, '插入后 usage 计数的持久化通道');
eq(store.fields.lastUsed.value, 'fx-run-alpha', '插入后 lastUsed 的持久化通道');
eq(interpretStore(null).fields.storePresent.value, false, 'store 缺文件时 storePresent=false');

const snapshot = interpretSnapshot(RAW);
deepEq(Object.keys(snapshot), ['panel', 'rows', 'composer', 'settings', 'overlays', 'trigger'], '统一入口一次解释六个观测面');
eq(snapshot.composer.fields.draftChars.value, 7, '统一入口保留各面字段（套件按面断言）');
eq(summarizeGrading(snapshot.composer.fields).minSource, 'public-api', '单个面的最弱来源可汇总（草稿的公开接口通道是最弱一环）');

/* ────────────────────────────── 6. 观测/输入句柄的装配面 ────────────────────────────── */

section('6. 观测/输入句柄装配：注入表达式可解析、句柄接口封闭');

eq(PROBE_VERSION, 1, '探针版本号固定（报告可追溯到观测层口径）');
const expression = snapshotExpression();
eq(typeof expression, 'string', 'snapshotExpression 返回可注入页面的表达式字符串');
let expressionParsed = true;
try {
  // 只做语法解析，不执行（执行需要 DOM）
  new Function(expression);
} catch (error) {
  expressionParsed = false;
}
eq(expressionParsed, true, '注入表达式语法合法（Node 侧可解析，不必等真机才发现）');
for (const [name, value] of Object.entries(HOOKS)) {
  ok(expression.includes(value), '注入表达式包含契约钩子 ' + name + '=' + value, expression.includes(value) ? '' : '未找到');
}
ok(expression.includes('data-composer-input'), '注入表达式用宿主契约定位 composer（data-composer-input）');
ok(expression.includes('aria-modal'), '设置弹窗按 aria-modal 语义定位，不靠内部类名');

throws(() => createObserver(null), { messageIncludes: '需要 CDP client' }, '观测句柄拒绝空 client');
const observer = createObserver({ evaluate: async () => null }, { defaultTimeoutMs: 50, pollMs: 10 });
deepEq(Object.keys(observer), ['version', 'client', 'snapshot', 'waitFor', 'interpret', 'observe', 'interpretStore'], '观测句柄接口固定（套件按此消费）');
eq(typeof observer.waitFor, 'function', '观测句柄有 waitFor（条件轮询，不用套件自己写轮询）');

throws(() => createInputDriver(null), { messageIncludes: '需要 CDP client' }, '输入句柄拒绝空 client');
const fakeClient = {
  mouseMove: async () => {},
  mouseDown: async () => {},
  mouseUp: async () => {},
  keyDown: async () => {},
  keyUp: async () => {},
  insertText: async () => {},
  evaluate: async () => null,
};
const input = createInputDriver(fakeClient, { steps: 3 });
for (const method of ['move', 'moveToRect', 'clickAt', 'clickRect', 'key', 'shortcut', 'typeText', 'keyRepeat', 'focus', 'blur', 'setSelection', 'syntheticClick', 'scrollIntoView', 'waitForLog']) {
  eq(typeof input[method], 'function', '输入句柄有 ' + method + '（物理路径 + 显式合成路径）');
}
eq(typeof input.log.install, 'function', '输入句柄带页面事件日志安装/读取（isTrusted 证据）');
eq(INPUT_LOG_KEY.startsWith('__'), true, '事件日志键是私有页内约定，不污染业务全局');
ok(INPUT_LOG_CAP >= 100, '事件日志有容量上限（长跑不爆内存）', 'cap=' + INPUT_LOG_CAP);

throws(() => createPersistence({ origin: 'nope', storePath: 'x' }), { messageIncludes: 'http(s) origin' }, '持久化句柄拒绝非法 origin');
throws(() => createPersistence({ origin: 'http://127.0.0.1:1', storePath: '' }), { messageIncludes: 'storePath' }, '持久化句柄拒绝空 storePath');
const persistence = createPersistence({ origin: 'http://127.0.0.1:1', storePath: 'D:/fixed/store.json' });
deepEq(Object.keys(persistence), ['origin', 'storePath', 'read', 'waitFor'], '持久化句柄接口固定（读回 + 条件等待）');
eq(persistence.origin, 'http://127.0.0.1:1', '持久化句柄保留运行期 origin（不硬编码）');

console.log('\n' + '-'.repeat(72));
if (failures.length === 0) {
  console.log('RESULT: ' + passCount + ' PASS / 0 FAIL（观测层自证全绿）');
  process.exit(0);
}
console.log('RESULT: ' + passCount + ' PASS / ' + failures.length + ' FAIL');
for (const failure of failures) console.log('  ✗ ' + failure.name + (failure.detail ? '：' + failure.detail : ''));
process.exit(1);
