/**
 * 差分运行器自证（票 #191 交付物 D）—— 纯 Node，不起浏览器、不装插件。
 *
 * 证明「判定本身是可信的」：
 * - 对照表生成（逐检查 name/area/reference/candidate/classification/flipped）；
 * - 四类区分力分类：有区分力 / 回归 / 两侧都绿（mustFlip 未翻转 → FAIL，绝不判通过）/ 两侧都红；
 * - mustFlip 未翻转 → FAIL；mustFlip 指向不存在的检查 → FAIL；清单为空 → FAIL；
 * - 回归识别（即使没写进清单也 FAIL）；
 * - md 与 JSON 一致：同一 doc 两次渲染字节相同，JSON 往返后渲染仍相同；
 * - 注入器注册表、可逆性、默认关闭（无 --fault 零影响）、半装回滚；
 * - 退出码：全绿 0 / 有无区分力或回归 1 / 阻塞 2 / 工具故障 3；
 * - 仓库里的期望清单与基线登记表结构有效，且引用的检查名确实存在于当前套件源码。
 *
 * 浏览器行为由真机 `node scripts/real/diff.mjs ...` 负责；这里只钉死判定逻辑。
 * 运行：node scripts/real/harness/diff/selftest.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { REPO_ROOT } from '../bindings.mjs';
import { HarnessError } from '../errors.mjs';
import {
  AREA_RULES,
  CLASSIFICATIONS,
  DIFF_PROBLEM_FAILURE_TYPES,
  MISSING,
  PRODUCT_PROBLEM_CODES,
  UNCLASSIFIED_AREA,
  VERDICTS,
  areaOf,
  buildRows,
  classifyPair,
  describeArea,
  failureTypeForProblems,
  groupByArea,
  summarizeRows,
} from './classify.mjs';
import { loadExpect, matchPattern, validateExpect } from './expect.mjs';
import { evaluateFaultExpectations } from './expect.mjs';
import { DIFF_EXIT_CODES, buildDiffDocument, extractEnvironment } from './model.mjs';
import { renderDiffMarkdown } from './render.mjs';
import { findBaselineRecord, loadBaselineRegistry } from './baseline.mjs';
import { deriveFaultExpect, parseDiffArgs } from './index.mjs';
import { INJECTOR_IDS, INJECTORS, assertKnownFaultIds, describeInjector, getInjector, parseFaultIds } from '../fault/index.mjs';
import { applyFaults } from '../fault/index.mjs';

const DIFFS_DIR = path.join(REPO_ROOT, 'scripts', 'real', 'diffs');
const SUITE_PATH = path.join(REPO_ROOT, 'scripts', 'real', 'suites', 'boundary.mjs');
const RUN_PATH = path.join(REPO_ROOT, 'scripts', 'real', 'run.mjs');
const CLI_PATH = path.join(REPO_ROOT, 'scripts', 'real', 'diff.mjs');

/* ------------------------------------------------------------------------- */
/* 迷你测试框架                                                               */
/* ------------------------------------------------------------------------- */

const results = { passed: 0, failed: 0, failures: [] };

function test(name, fn) {
  try {
    fn();
    results.passed += 1;
  } catch (error) {
    results.failed += 1;
    results.failures.push({ name, error });
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    results.passed += 1;
  } catch (error) {
    results.failed += 1;
    results.failures.push({ name, error });
  }
}

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) fail((message ? message + '：' : '') + '期望 ' + JSON.stringify(expected) + '，实际 ' + JSON.stringify(actual));
}

function assertThrows(fn, matcher, message) {
  try {
    fn();
  } catch (error) {
    if (matcher && !matcher(error)) fail((message ? message + '：' : '') + '异常内容不符：' + (error && error.message ? error.message : String(error)));
    return error;
  }
  fail((message ? message + '：' : '') + '本该抛错但没有');
}

/* ------------------------------------------------------------------------- */
/* 合成报告（结构对齐 report/model.mjs 的 schemaVersion=2）                    */
/* ------------------------------------------------------------------------- */

const ARTIFACT_OLD = Object.freeze({
  name: 'dsh-prompt',
  version: '0.4.32',
  fileName: 'dsh-prompt-0.4.32.tgz',
  sizeBytes: 1024,
  sha256: 'a'.repeat(64),
});
const ARTIFACT_CUR = Object.freeze({
  name: 'dsh-prompt',
  version: '0.4.39',
  fileName: 'dsh-prompt-0.4.39.tgz',
  sizeBytes: 2048,
  sha256: 'b'.repeat(64),
});

function makeReport({ checks = [], verdict = 'PASS', artifact = ARTIFACT_CUR, suite = 'boundary' } = {}) {
  const normalized = checks.map((check) => {
    const entry = { name: check.name, verdict: check.verdict, conditions: {} };
    if (check.detail !== undefined) entry.detail = check.detail;
    if (check.reason !== undefined) entry.reason = check.reason;
    if (check.expectedFailure === true) entry.expectedFailure = true;
    return entry;
  });
  return {
    schemaVersion: 2,
    runTag: 'selftest-run',
    suite,
    verdict,
    exitCode: verdict === 'PASS' ? 0 : verdict === 'FAIL' ? 1 : 2,
    environment: {
      platform: 'win32',
      arch: 'x64',
      node: 'v24.0.0',
      timezone: 'Asia/Shanghai',
      hostVersion: '0.2.1-rc.3',
      hostCliSource: 'explicit',
      browserSource: 'default',
      suite,
      artifact,
      fixture: { name: 'templates', request: 'templates', ok: true },
    },
    summary: { total: normalized.length },
    checks: normalized,
  };
}

function makeSide(role, label, artifact, report) {
  return {
    role,
    label,
    runTag: report.runTag,
    artifact,
    report,
    exitCode: report.exitCode,
    evidenceReport: role + '/report.json',
    evidenceDir: role,
    log: role + '-subprocess.log',
    faults: [],
  };
}

function makeExpect(overrides = {}) {
  return validateExpect(
    {
      suite: 'boundary',
      mustFlipRedOnBaseline: ['场景 1：检查 A'],
      mustStayGreen: [],
      notes: ['selftest 合成清单'],
      ...overrides,
    },
    '<selftest>',
  );
}

function makeDoc({ refChecks = [], curChecks = [], refVerdict, curVerdict, expect = makeExpect(), mode = 'artifact', toolProblems = [] }) {
  return buildDiffDocument({
    mode,
    suite: 'boundary',
    fixture: 'templates',
    reference: makeSide('reference', '旧产物基线', ARTIFACT_OLD, makeReport({ checks: refChecks, verdict: refVerdict, artifact: ARTIFACT_OLD })),
    candidate: makeSide('candidate', '当前产物', ARTIFACT_CUR, makeReport({ checks: curChecks, verdict: curVerdict, artifact: ARTIFACT_CUR })),
    expect,
    faults: [],
    baselineRecord: null,
    evidence: { dir: 'selftest', diffJson: 'diff.json', diffMarkdown: 'diff.md' },
    toolProblems,
  });
}

/* ------------------------------------------------------------------------- */
/* 1. 分类与对照表生成                                                        */
/* ------------------------------------------------------------------------- */

test('分类：对照侧红 → 判定侧绿 才算有区分力', () => {
  assertEqual(classifyPair('FAIL', 'PASS'), 'discriminating');
});

test('分类：对照侧绿 → 判定侧红 是回归', () => {
  assertEqual(classifyPair('PASS', 'FAIL'), 'regression');
});

test('分类：两侧都绿不是通过，是「无区分力」', () => {
  assertEqual(classifyPair('PASS', 'PASS'), 'bothGreen');
  assertEqual(CLASSIFICATIONS.bothGreen.evidence, 'none');
  assert(CLASSIFICATIONS.bothGreen.label.includes('无区分力'), 'bothGreen 标签必须明确写无区分力');
});

test('分类：两侧都红/阻塞/缺失都有独立分类', () => {
  assertEqual(classifyPair('FAIL', 'FAIL'), 'bothRed');
  assertEqual(classifyPair('BLOCKED', 'PASS'), 'baselineBlocked');
  assertEqual(classifyPair('PASS', 'BLOCKED'), 'candidateBlocked');
  assertEqual(classifyPair(MISSING, 'PASS'), 'missingInBaseline');
  assertEqual(classifyPair('PASS', MISSING), 'missingInCandidate');
});

test('对照表：按对照侧顺序生成，判定侧独有检查补在后面', () => {
  const rows = buildRows(
    makeReport({ checks: [{ name: '场景 1：检查 A', verdict: 'FAIL' }, { name: '场景 1：检查 B', verdict: 'PASS' }] }),
    makeReport({ checks: [{ name: '场景 1：检查 B', verdict: 'PASS' }, { name: '场景 1：检查 A', verdict: 'PASS' }, { name: '检查 C', verdict: 'PASS' }] }),
  );
  assertEqual(rows.map((row) => row.name).join('|'), '场景 1：检查 A|场景 1：检查 B|检查 C', '顺序必须确定');
  assertEqual(rows[0].classification, 'discriminating');
  assertEqual(rows[0].flipped, true);
  assertEqual(rows[2].classification, 'missingInBaseline');
  assertEqual(rows[2].flipped, true);
  const summary = summarizeRows(rows);
  assertEqual(summary.total, 3);
  assertEqual(summary.flipped, 2);
  assertEqual(summary.byClassification.discriminating, 1);
  assertEqual(summary.evidence.flips, 1);
  assertEqual(summary.evidence.unknown, 1);
});

test('对照表：区域归类（场景/契约/fixture/冒号前缀）', () => {
  assertEqual(areaOf('契约：host.input-actions'), '契约 preflight');
  assertEqual(areaOf('fixture 起始态'), 'fixture 起始态');
  assertEqual(areaOf('场景 2：行插入落位：等待观测条件超时'), '场景 2');
  assertEqual(areaOf('③光标位置：插入后光标停在正文末尾'), '③光标位置');
  const groups = groupByArea(buildRows(makeReport({ checks: [{ name: '场景 1：x', verdict: 'PASS' }] }), makeReport({ checks: [] })));
  assertEqual(groups[0].area, '场景 1');
});

/* #183 评审整改 F5：区域归类要能被指名（命中哪条规则），未命中不静默换桶。 */
test('F5 区域归类：命中规则可指名，未命中判未归类', () => {
  assertEqual(describeArea('契约：host.input-actions').rule, 'contract');
  assertEqual(describeArea('fixture 起始态').rule, 'fixture');
  assertEqual(describeArea('场景 2：行插入落位').rule, 'scene');
  assertEqual(describeArea('A1-1 插入后草稿文本 == abcSMARTEND').rule, 'group');
  assertEqual(describeArea('A1-1 插入后草稿文本 == abcSMARTEND').area, '检查组 A1');
  assertEqual(describeArea('T1-6 物理点底栏触发方式按钮').area, '检查组 T1');
  assertEqual(describeArea('③光标位置：插入后光标停在正文末尾').rule, 'titled');
  assertEqual(describeArea('没有前缀没有冒号的裸检查名').rule, 'unclassified');
  assertEqual(describeArea('没有前缀没有冒号的裸检查名').area, UNCLASSIFIED_AREA);
  assertEqual(describeArea('').area, UNCLASSIFIED_AREA);
  assert(AREA_RULES.length >= 5, '区域规则必须显式声明（至少契约/fixture/场景/检查组分/冒号标题五类）');
});

test('F5 未归类检查名 → FAIL 问题（unclassified-check-areas），分型 test，不静默换桶', () => {
  const doc = makeDoc({
    refChecks: [{ name: '裸名字', verdict: 'FAIL', detail: '旧产物缺失' }, { name: '场景 1：A', verdict: 'PASS' }],
    curChecks: [{ name: '裸名字', verdict: 'PASS' }, { name: '场景 1：A', verdict: 'PASS' }],
    refVerdict: 'FAIL',
    curVerdict: 'PASS',
    expect: makeExpect({ mustFlipRedOnBaseline: ['裸名字'] }),
  });
  const problem = doc.problems.find((item) => item.code === 'unclassified-check-areas');
  assert(problem, '未归类检查名必须记一条问题');
  assertEqual(problem.severity, 'FAIL');
  assertEqual(problem.checks.join('|'), '裸名字');
  assertEqual(doc.verdict, 'FAIL');
  assertEqual(doc.coverage.unclassifiedAreas.join('|'), '裸名字');
  assertEqual(failureTypeForProblems(doc.problems).failureType, 'test');
});

test('F5 MISSING 是分类期哨兵，不是第五种判定', () => {
  assert(!VERDICTS.includes(MISSING), 'MISSING 不得进 VERDICTS（判定只有四类）');
  assertEqual(MISSING, 'MISSING');
});

test('检查名匹配：精确、前缀、* 通配', () => {
  assert(matchPattern('场景 2：行插入落位：等待观测条件超时', '场景 2：行插入落位'), '前缀应匹配');
  assert(matchPattern('场景 2：行插入落位：等待观测条件超时', '场景 *：行插入落位：*'), '通配应匹配');
  assert(!matchPattern('场景 3：别的', '场景 2：行插入落位'), '不同场景不应匹配');
});

/* ------------------------------------------------------------------------- */
/* 2. 判定：四类分类 × 退出码                                                 */
/* ------------------------------------------------------------------------- */

test('全绿且有区分力 → PASS / exit 0', () => {
  const doc = makeDoc({
    refChecks: [{ name: '场景 1：检查 A', verdict: 'FAIL', detail: '旧产物行为缺失' }, { name: '场景 1：检查 B', verdict: 'PASS' }],
    curChecks: [{ name: '场景 1：检查 A', verdict: 'PASS' }, { name: '场景 1：检查 B', verdict: 'PASS' }],
    refVerdict: 'FAIL',
    curVerdict: 'PASS',
    expect: makeExpect({ mustFlipRedOnBaseline: ['场景 1：检查 A'], mustStayGreen: ['场景 1：检查 B'] }),
  });
  assertEqual(doc.verdict, 'PASS', '结论');
  assertEqual(doc.exitCode, DIFF_EXIT_CODES.PASS);
  assertEqual(doc.statistics.byClassification.discriminating, 1);
  assertEqual(doc.expectations.evaluation.mustFlip[0].status, 'ok');
  assertEqual(doc.expectations.evaluation.mustStayGreen[0].status, 'ok');
  assertEqual(doc.problems.length, 0, '不应有问题项：' + JSON.stringify(doc.problems));
});

test('bothGreen → 清单内断言无区分力 → FAIL / exit 1（不得判通过）', () => {
  const doc = makeDoc({
    refChecks: [{ name: '场景 1：检查 A', verdict: 'PASS' }],
    curChecks: [{ name: '场景 1：检查 A', verdict: 'PASS' }],
    refVerdict: 'PASS',
    curVerdict: 'PASS',
    expect: makeExpect({ mustFlipRedOnBaseline: ['场景 1：检查 A'] }),
  });
  assertEqual(doc.verdict, 'FAIL', 'bothGreen 绝不能算通过');
  assertEqual(doc.exitCode, DIFF_EXIT_CODES.FAIL);
  const codes = doc.problems.map((problem) => problem.code);
  assert(codes.includes('no-discrimination'), '必须有 no-discrimination 问题：' + JSON.stringify(codes));
  const problem = doc.problems.find((item) => item.code === 'no-discrimination');
  assert(problem.message.includes('无区分力') || problem.message.includes('无证据力'), '问题文案必须写明无区分力');
  assertEqual(doc.expectations.evaluation.mustFlip[0].status, 'unmet');
});

test('mustFlip 引用了不存在的检查 → FAIL / exit 1（清单过期）', () => {
  const doc = makeDoc({
    refChecks: [{ name: '场景 1：检查 B', verdict: 'PASS' }],
    curChecks: [{ name: '场景 1：检查 B', verdict: 'PASS' }],
    refVerdict: 'PASS',
    curVerdict: 'PASS',
    expect: makeExpect({ mustFlipRedOnBaseline: ['检查 X'], mustStayGreen: [] }),
  });
  assertEqual(doc.exitCode, DIFF_EXIT_CODES.FAIL);
  assert(doc.problems.some((problem) => problem.code === 'expect-missing-check'), '应报 expect-missing-check');
});

test('清单为空（没有 mustFlip）→ FAIL / exit 1（无证据力）', () => {
  // validateExpect 会拒绝空 mustFlip（清单本身就无效）；这里直接构造未通过校验的
  // 清单对象，验证 buildDiffDocument 的兜底判定同样不判通过。
  const rawExpect = { suite: 'boundary', mustFlipRedOnBaseline: [], mustStayGreen: [], notes: [], source: '<selftest>' };
  const doc = makeDoc({
    refChecks: [{ name: '场景 1：检查 B', verdict: 'PASS' }],
    curChecks: [{ name: '场景 1：检查 B', verdict: 'PASS' }],
    refVerdict: 'PASS',
    curVerdict: 'PASS',
    expect: rawExpect,
  });
  assertEqual(doc.exitCode, DIFF_EXIT_CODES.FAIL);
  assert(doc.problems.some((problem) => problem.code === 'empty-expectations'), '应报 empty-expectations');
});

test('回归（对照侧绿 → 判定侧红）→ FAIL / exit 1，且问题醒目', () => {
  const doc = makeDoc({
    refChecks: [{ name: '场景 1：检查 M', verdict: 'FAIL' }, { name: '检查 R', verdict: 'PASS' }],
    curChecks: [{ name: '场景 1：检查 M', verdict: 'PASS' }, { name: '检查 R', verdict: 'FAIL' }],
    refVerdict: 'FAIL',
    curVerdict: 'FAIL',
    expect: makeExpect({ mustFlipRedOnBaseline: ['场景 1：检查 M'], mustStayGreen: [] }),
  });
  assertEqual(doc.exitCode, DIFF_EXIT_CODES.FAIL);
  const row = doc.checks.find((item) => item.name === '检查 R');
  assertEqual(row.classification, 'regression');
  assert(doc.problems.some((problem) => problem.code === 'regression'), '应报 regression 问题');
});

test('判定侧缺失检查（artifact 模式）→ FAIL / exit 1', () => {
  const doc = makeDoc({
    refChecks: [{ name: '场景 1：检查 M', verdict: 'FAIL' }],
    curChecks: [],
    refVerdict: 'FAIL',
    curVerdict: 'PASS',
    expect: makeExpect({ mustFlipRedOnBaseline: ['场景 1：检查 M'] }),
  });
  assertEqual(doc.checks[0].classification, 'missingInCandidate');
  assert(doc.problems.some((problem) => problem.code === 'candidate-missing-checks'), '应报 candidate-missing-checks');
  assertEqual(doc.exitCode, DIFF_EXIT_CODES.FAIL);
});

test('当前产物自身还有产品 FAIL（差分成立 ≠ 当前全绿）→ FAIL / exit 1', () => {
  const doc = makeDoc({
    refChecks: [{ name: '场景 1：检查 A', verdict: 'FAIL' }, { name: '检查 Z', verdict: 'FAIL' }],
    curChecks: [{ name: '场景 1：检查 A', verdict: 'PASS' }, { name: '检查 Z', verdict: 'FAIL' }],
    refVerdict: 'FAIL',
    curVerdict: 'FAIL',
    expect: makeExpect({ mustFlipRedOnBaseline: ['场景 1：检查 A'] }),
  });
  assert(doc.problems.some((problem) => problem.code === 'candidate-product-fail'), '应报 candidate-product-fail');
  assertEqual(doc.exitCode, DIFF_EXIT_CODES.FAIL);
});

test('对照侧报告整体 BLOCKED → BLOCKED / exit 2', () => {
  const doc = makeDoc({
    refChecks: [{ name: '场景 1：检查 A', verdict: 'BLOCKED' }],
    curChecks: [{ name: '场景 1：检查 A', verdict: 'PASS' }],
    refVerdict: 'BLOCKED',
    curVerdict: 'PASS',
    expect: makeExpect({ mustFlipRedOnBaseline: ['场景 1：检查 A'] }),
  });
  assertEqual(doc.verdict, 'BLOCKED');
  assertEqual(doc.exitCode, DIFF_EXIT_CODES.BLOCKED);
});

test('工具故障（子进程报告缺失等）→ TOOL_FAULT / exit 3，不冒充产品判定', () => {
  const doc = makeDoc({
    refChecks: [{ name: '场景 1：检查 A', verdict: 'FAIL' }],
    curChecks: [{ name: '场景 1：检查 A', verdict: 'PASS' }],
    refVerdict: 'FAIL',
    curVerdict: 'PASS',
    expect: makeExpect({ mustFlipRedOnBaseline: ['场景 1：检查 A'] }),
    toolProblems: [{ code: 'reference-missing-report', severity: 'TOOL_FAULT', message: 'report.json 读不到', checks: [] }],
  });
  assertEqual(doc.verdict, 'TOOL_FAULT');
  assertEqual(doc.exitCode, DIFF_EXIT_CODES.TOOL_FAULT);
});

test('退出码表与 report 层同一语义：0/1/2/3', () => {
  assertEqual(DIFF_EXIT_CODES.PASS, 0);
  assertEqual(DIFF_EXIT_CODES.FAIL, 1);
  assertEqual(DIFF_EXIT_CODES.BLOCKED, 2);
  assertEqual(DIFF_EXIT_CODES.TOOL_FAULT, 3);
});

/* ------------------------------------------------------------------------- */
/* 3. diff.md 与 diff.json 一致、确定性                                        */
/* ------------------------------------------------------------------------- */

test('md 由 JSON 唯一事实源渲染：两次渲染字节相同、JSON 往返后仍相同', () => {
  const doc = makeDoc({
    refChecks: [{ name: '场景 1：检查 A', verdict: 'FAIL', detail: '旧产物 observed=null' }, { name: '场景 1：检查 B', verdict: 'PASS' }],
    curChecks: [{ name: '场景 1：检查 A', verdict: 'PASS' }, { name: '场景 1：检查 B', verdict: 'PASS' }],
    refVerdict: 'FAIL',
    curVerdict: 'PASS',
    expect: makeExpect({ mustFlipRedOnBaseline: ['场景 1：检查 A'], mustStayGreen: ['场景 1：检查 B'] }),
  });
  const json = JSON.stringify(doc, null, 2);
  const roundTripped = JSON.parse(json);
  const md1 = renderDiffMarkdown(doc);
  const md2 = renderDiffMarkdown(doc);
  const md3 = renderDiffMarkdown(roundTripped);
  assert(md1 === md2, '同一 doc 两次渲染必须字节相同（确定性）');
  assert(md1 === md3, '先序列化再解析后渲染必须字节相同（md 只依赖 JSON 事实源）');
  assert(md1.includes('场景 1：检查 A'), 'md 必须列出检查名');
  assert(md1.includes('场景 1：检查 B'), 'md 必须列出检查名');
  assert(md1.includes('旧产物基线'), 'md 必须标出对照侧角色');
  assert(md1.includes('有区分力'), 'md 必须标出分类');
  assert(json.includes('"schemaVersion": 1'), 'diff.json 必须带 schemaVersion');
});

test('md 对 bothGreen 明说「无区分力」而不是通过', () => {
  const doc = makeDoc({
    refChecks: [{ name: '场景 1：检查 A', verdict: 'PASS' }],
    curChecks: [{ name: '场景 1：检查 A', verdict: 'PASS' }],
    refVerdict: 'PASS',
    curVerdict: 'PASS',
    expect: makeExpect({ mustFlipRedOnBaseline: ['场景 1：检查 A'] }),
  });
  const md = renderDiffMarkdown(doc);
  assert(md.includes('无区分力'), 'md 必须写出无区分力');
  assert(md.includes('FAIL'), '结论必须是 FAIL');
});

test('环境提取只带机器无关事实（不泄露绝对路径）', () => {
  const report = makeReport({ checks: [] });
  report.environment.artifact = { ...ARTIFACT_CUR, path: 'C:\\secret\\pkg.tgz' };
  report.environment.browser = 'C:\\secret\\msedge.exe';
  report.checks = [
    { name: '契约：x', verdict: 'PASS', conditions: { browserRuntime: { browser: 'Edg/156.0.4314.50', protocolVersion: '1.3' } } },
  ];
  const env = extractEnvironment(report);
  const serialized = JSON.stringify(env);
  assert(!serialized.includes('secret'), '环境事实里不应出现绝对路径：' + serialized);
  assertEqual(env.browser.runtime, 'Edg/156.0.4314.50');
  assertEqual(env.artifact.sha256, ARTIFACT_CUR.sha256);
  assertEqual(env.artifact.path, undefined);
});

/* ------------------------------------------------------------------------- */
/* 4. 期望清单与基线登记表（真实仓库文件）                                     */
/* ------------------------------------------------------------------------- */

test('boundary.expect.json 结构有效，且必须翻转的断言确实存在于套件源码', () => {
  const expect = loadExpect(path.join(DIFFS_DIR, 'boundary.expect.json'));
  assertEqual(expect.suite, 'boundary');
  assert(expect.mustFlipRedOnBaseline.length > 0, 'mustFlip 不能为空');
  assert(expect.notes.length > 0, '清单必须有说明');
  const haystacks = [fs.readFileSync(SUITE_PATH, 'utf8'), fs.readFileSync(RUN_PATH, 'utf8')].join('\n');
  const timeoutSuffix = '：等待观测条件超时';
  for (const pattern of [...expect.mustFlipRedOnBaseline, ...expect.mustStayGreen]) {
    const stripped = pattern.endsWith(timeoutSuffix) ? pattern.slice(0, -timeoutSuffix.length) : pattern;
    assert(
      haystacks.includes(stripped),
      '期望清单引用的检查名在当前套件/run.mjs 里找不到（清单过期？）：' + pattern,
    );
  }
});

test('期望清单拒绝未知字段/空 mustFlip（防止拼错静默失效）', () => {
  assertThrows(
    () => validateExpect({ suite: 'boundary', mustFlipRedOnBaseline: [], typo: true }, '<selftest>'),
    (error) => error instanceof HarnessError,
    '未知字段应报错',
  );
  assertThrows(
    () => validateExpect({ suite: 'boundary', mustFlipRedOnBaseline: [] }, '<selftest>'),
    (error) => error instanceof HarnessError,
    '空 mustFlip 应报错',
  );
});

test('baselines.json 结构有效，可按 sha256/名称命中登记记录', () => {
  const registry = loadBaselineRegistry();
  assert(registry.baselines.length >= 1, '至少登记一条基线');
  for (const record of registry.baselines) {
    assertEqual(record.sha256.length, 64);
  }
  const byName = findBaselineRecord(registry, { name: 'dsh-prompt-0.4.32' });
  assert(byName && byName.fileName === 'dsh-prompt-0.4.32.tgz', '应能按名称命中 0.4.32 基线');
  const bySha = findBaselineRecord(registry, { sha256: byName.sha256 });
  assert(bySha && bySha.name === byName.name, '应能按 sha256 命中同一条基线');
});

/* ------------------------------------------------------------------------- */
/* 5. 故障注入器：注册表 / 默认关闭 / 可逆 / 半装回滚                          */
/* ------------------------------------------------------------------------- */

test('注册表：恰好三种注入器，元数据完整且可序列化', () => {
  assertEqual(INJECTOR_IDS.length, 3);
  assertEqual(INJECTOR_IDS.join(','), 'input-actions-missing,insert-coordinate-offset,persistence-write-fail');
  for (const id of INJECTOR_IDS) {
    const injector = getInjector(id);
    assertEqual(typeof injector.install, 'function');
    assert(injector.expectedRed.length > 0, id + ' 必须声明 expectedRed');
    assert(Array.isArray(injector.expectedStayGreen), id + ' expectedStayGreen 必须是数组');
    const meta = describeInjector(injector);
    const json = JSON.parse(JSON.stringify(meta));
    assertEqual(json.id, id);
    assert(!('install' in json), '报告元数据不能带函数');
  }
  assertThrows(() => getInjector('nope'), (error) => error instanceof HarnessError, '未知注入器应抛错');
  assertKnownFaultIds(INJECTOR_IDS);
  assertThrows(() => assertKnownFaultIds(['nope']), (error) => error instanceof HarnessError, '未知注入器应抛错');
});

test('注入器期望变红的检查确实存在于当前套件源码（预期清单不漂移）', () => {
  const haystacks = [fs.readFileSync(SUITE_PATH, 'utf8'), fs.readFileSync(RUN_PATH, 'utf8')].join('\n');
  const timeoutSuffix = '：等待观测条件超时';
  for (const injector of INJECTORS) {
    for (const pattern of [...injector.expectedRed, ...injector.expectedStayGreen]) {
      const stripped = pattern.endsWith(timeoutSuffix) ? pattern.slice(0, -timeoutSuffix.length) : pattern;
      assert(haystacks.includes(stripped), injector.id + ' 的期望检查不在套件源码里：' + pattern);
    }
  }
});

async function runAsyncTests() {
  await testAsync('默认关闭：没有 --fault 时 applyFaults 不包装任何句柄、零影响', async () => {
    const handles = { client: {}, observe: {}, input: {}, persistence: {} };
    const session = await applyFaults({ ids: [], handles });
    assertEqual(session.injectors.length, 0);
    for (const key of Object.keys(handles)) {
      assert(session.handles[key] === handles[key], key + ' 句柄应保持原引用（默认零影响）');
    }
    const uninstalled = await session.uninstall();
    assertEqual(Object.keys(uninstalled.results).length, 0);
  });

test('默认关闭：parseFaultList / parseDiffArgs 无 --fault 时为空，显式给出才进 fault 模式', () => {
  assertEqual(parseFaultIds('').length, 0);
  assertEqual(parseFaultIds(null).length, 0);
  assertEqual(parseFaultIds('input-actions-missing,persistence-write-fail').length, 2);
  assertThrows(() => parseFaultIds('input-actions-missing,input-actions-missing'), (error) => error instanceof HarnessError, '重复 id 应报错');
  const artifactArgs = parseDiffArgs(['--artifact', 'pkg.tgz'], {});
  assertEqual(artifactArgs.mode, 'artifact');
  assertEqual(artifactArgs.faults.length, 0);
  const faultArgs = parseDiffArgs(['--artifact', 'pkg.tgz', '--fault', 'insert-coordinate-offset'], {});
  assertEqual(faultArgs.mode, 'fault');
  assertDeepEqual(faultArgs.faults, ['insert-coordinate-offset']);
  assertThrows(
    () => parseDiffArgs(['--artifact', 'pkg.tgz', '--baseline-artifact', 'old.tgz', '--fault', 'insert-coordinate-offset'], {}),
    (error) => error instanceof HarnessError,
    'fault 模式不应接受基线参数',
  );
  assertThrows(() => parseDiffArgs(['--nope'], {}), (error) => error instanceof HarnessError, '未知参数应报错');
});

function assertDeepEqual(actual, expected, message) {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) fail((message ? message + '：' : '') + '期望 ' + right + '，实际 ' + left);
}

  await testAsync('注入器 ①（页面内）：install 后产出证据，uninstall 恢复', async () => {
  const calls = [];
  const client = {
    async evaluate(expression) {
      calls.push(expression);
      if (expression.includes('uninstallInputActionsMissingInPage')) return { restored: true, captureType: 'function' };
      if (expression.includes('installInputActionsMissingInPage')) {
        return { installed: true, depth: 2, hadCaptureInsertion: true, methods: { insertText: 'function', setDraft: 'function' } };
      }
      return { installed: false };
    },
  };
  const handles = { client, observe: {}, input: {}, persistence: {} };
  const session = await applyFaults({ ids: ['input-actions-missing'], handles });
  assertEqual(session.injectors.length, 1);
  assert(session.evidence['input-actions-missing'] && session.evidence['input-actions-missing'].installed === true, '应记录安装证据');
  const uninstalled = await session.uninstall();
  assertEqual(uninstalled.results['input-actions-missing'].restored, true);
  assertEqual(uninstalled.results['input-actions-missing'].captureType, 'function');
  assert(calls.length >= 2, '安装与卸载各一次页面调用');
});

  await testAsync('注入器 ②（harness 包装）：只拦命中模板行的点击，可逆且不动原对象', async () => {
  const originalClicks = [];
  const originalInput = {
    client: { evaluate: async () => ({ x: 100, y: 100, width: 200, height: 40, id: 'row-1' }) },
    clickAt: async (point, options) => {
      originalClicks.push({ point, options });
      return { point, options };
    },
  };
  const handles = { client: originalInput.client, observe: {}, input: originalInput, persistence: {} };
  const originalClickAtRef = originalInput.clickAt;
  const session = await applyFaults({ ids: ['insert-coordinate-offset'], handles });
  const wrapped = session.handles.input;
  assert(wrapped !== originalInput, '应返回包装后的 input 句柄');
  assert(wrapped.clickAt !== originalInput.clickAt, 'clickAt 应被包装');
  await wrapped.clickAt({ x: 150, y: 110 }, { steps: 8 });
  assertEqual(originalClicks.length, 1);
  assertEqual(originalClicks[0].point.x, 318, '命中行的点击应被挪到行右缘之外');
  assertEqual(originalClicks[0].point.y, 110);
  // 未命中行 → 原样透传
  const bypassInput = {
    client: { evaluate: async () => null },
    clickAt: async (point) => {
      originalClicks.push({ point, options: null });
      return { point };
    },
  };
  const bypassSession = await applyFaults({ ids: ['insert-coordinate-offset'], handles: { client: bypassInput.client, observe: {}, input: bypassInput, persistence: {} } });
  await bypassSession.handles.input.clickAt({ x: 5, y: 6 });
  assertEqual(originalClicks[1].point.x, 5, '未命中行的点击必须原样透传');
  const uninstalled = await session.uninstall();
  assertEqual(uninstalled.results['insert-coordinate-offset'].restored, true);
  assertEqual(originalInput.clickAt, originalClickAtRef, '原对象不能被就地改写');
});

  await testAsync('注入器 ③（页面 fetch）：安装/读状态/恢复三步齐全', async () => {
  const calls = [];
  const client = {
    async evaluate(expression) {
      calls.push(expression);
      if (expression.includes('uninstallPersistenceWriteFailInPage')) return { restored: true, rejected: 3, fetchType: 'function' };
      if (expression.includes('readPersistenceWriteFailStateInPage')) return { installed: true, rejected: 3, passed: 7, attempts: [] };
      if (expression.includes('installPersistenceWriteFailInPage')) return { installed: true, prefix: '/_dsh/dsh-prompt/', fetchType: 'function' };
      return { installed: false };
    },
  };
  const handles = { client, observe: {}, input: {}, persistence: {} };
  const session = await applyFaults({ ids: ['persistence-write-fail'], handles });
  assert(session.evidence['persistence-write-fail'].installed === true);
  const uninstalled = await session.uninstall();
  assertEqual(uninstalled.results['persistence-write-fail'].restored, true);
  assertEqual(uninstalled.results['persistence-write-fail'].state.rejected, 3, '卸载前应带回被拒请求计数');
  assertEqual(calls.length, 3, '安装 + 读状态 + 恢复');
});

  await testAsync('半装回滚：第 2 个注入器失败时，第 1 个必须被卸载（要么全装要么全不装）', async () => {
    const calls = [];
    let uninstalledRollback = false;
    const client = {
      async evaluate(expression) {
        calls.push(expression);
        if (expression.includes('uninstallInputActionsMissingInPage')) {
          uninstalledRollback = true;
          return { restored: true };
        }
        if (expression.includes('installInputActionsMissingInPage')) {
          return { installed: true, depth: 1, hadCaptureInsertion: true, methods: {} };
        }
        return { installed: false, error: '模拟 fetch 覆写失败' };
      },
    };
    const input = { client: { evaluate: async () => null }, clickAt: async () => ({}) };
    const originalClickAt = input.clickAt;
    let thrown = null;
    try {
      await applyFaults({
        ids: ['input-actions-missing', 'persistence-write-fail'],
        handles: { client, observe: {}, input, persistence: {} },
      });
    } catch (error) {
      thrown = error;
    }
    assert(
      thrown instanceof HarnessError && thrown.message.includes('安装失败'),
      '安装失败应抛 HarnessError（实际：' + (thrown ? thrown.message : '没有抛错') + '）',
    );
    assert(uninstalledRollback, '已装好的第 1 个注入器必须被回滚卸载');
    assertEqual(input.clickAt, originalClickAt, '原 input 对象不应被就地改写');
  });
} // runAsyncTests

test('注入器元数据能派生 fault 模式的 mustFlip 清单', () => {
  const faults = INJECTOR_IDS.map((id) => describeInjector(getInjector(id)));
  const derived = deriveFaultExpect({ suite: 'boundary', faults });
  assertEqual(derived.suite, 'boundary');
  assertEqual(derived.mustFlipRedOnBaseline.length, 4, '三个注入器共享断言去重后应为 4 条');
  assertEqual(
    derived.mustFlipRedOnBaseline.filter((name) => name === '场景 2：行插入落位：等待观测条件超时').length,
    1,
    '共享断言只出现一次（去重）',
  );
  assertEqual(derived.mustStayGreen.length, 4);
});

test('fault 模式评估：注入侧红即检出，条件性检查不要求对照侧红', () => {
  const rows = buildRows(
    makeReport({
      checks: [
        { name: 'fixture 起始态', verdict: 'PASS' },
        { name: '③光标位置：插入后光标停在正文末尾（公开接口 captureInsertion）', verdict: 'PASS' },
        { name: '场景 2：行插入落位：等待观测条件超时', verdict: 'MISSING' },
      ],
    }),
    makeReport({
      verdict: 'FAIL',
      checks: [
        { name: 'fixture 起始态', verdict: 'PASS' },
        { name: '③光标位置：插入后光标停在正文末尾（公开接口 captureInsertion）', verdict: 'FAIL' },
        { name: '场景 2：行插入落位：等待观测条件超时', verdict: 'FAIL' },
      ],
    }),
  );
  const expect = makeExpect({
    mustFlipRedOnBaseline: [
      '③光标位置：插入后光标停在正文末尾（公开接口 captureInsertion）',
      '场景 2：行插入落位：等待观测条件超时',
    ],
    mustStayGreen: ['fixture 起始态'],
  });
  const result = evaluateFaultExpectations({ rows, expect });
  assertEqual(result.problems.length, 0, '两条期望都应满足（条件性检查对照侧无记录是正常的）');
  assert(result.entries.mustFlip[0].detail.includes('有区分力'), '常驻断言：对照侧绿 → 注入侧红');
  assert(result.entries.mustFlip[1].detail.includes('条件性断言'), '条件性检查：只看注入侧是否红');
  assert(result.expectedRedNames.includes('场景 2：行插入落位：等待观测条件超时'), '注入检出的检查名要能交给 model 汇总');
});

test('fault 模式评估：注入没有让断言变红 → FAIL（注入无区分力）', () => {
  const rows = buildRows(
    makeReport({ checks: [{ name: '场景 1：检查 A', verdict: 'PASS' }] }),
    makeReport({ checks: [{ name: '场景 1：检查 A', verdict: 'PASS' }] }),
  );
  const result = evaluateFaultExpectations({ rows, expect: makeExpect({ mustFlipRedOnBaseline: ['场景 1：检查 A'] }) });
  assert(
    result.problems.some((problem) => problem.code === 'fault-not-detected' && problem.severity === 'FAIL'),
    '注入后仍绿必须报 fault-not-detected（不得判通过）',
  );
});

test('fault 模式评估：注入污染了无关断言 → FAIL', () => {
  const rows = buildRows(
    makeReport({ checks: [{ name: '场景 1：检查 A', verdict: 'PASS' }, { name: '场景 1：检查 B', verdict: 'PASS' }] }),
    makeReport({ verdict: 'FAIL', checks: [{ name: '场景 1：检查 A', verdict: 'FAIL' }, { name: '场景 1：检查 B', verdict: 'FAIL' }] }),
  );
  const result = evaluateFaultExpectations({
    rows,
    expect: makeExpect({ mustFlipRedOnBaseline: ['场景 1：检查 A'], mustStayGreen: ['场景 1：检查 B'] }),
  });
  assert(
    result.problems.some((problem) => problem.code === 'fault-stay-green-broken' && problem.severity === 'FAIL'),
    '注入不应把未声明的期望绿检查弄红',
  );
});

test('fault 模式：注入侧出现未声明的红 → 整体 FAIL（影响面大于声明）', () => {
  const doc = makeDoc({
    mode: 'fault',
    refChecks: [{ name: '场景 1：检查 A', verdict: 'PASS' }],
    curChecks: [{ name: '场景 1：检查 A', verdict: 'FAIL' }, { name: '场景 1：检查 B', verdict: 'FAIL' }],
    refVerdict: 'PASS',
    curVerdict: 'FAIL',
    expect: makeExpect({ mustFlipRedOnBaseline: ['场景 1：检查 A'], mustStayGreen: [] }),
  });
  assertEqual(doc.mode, 'fault');
  assertEqual(doc.verdict, 'FAIL');
  assert(
    doc.problems.some((problem) => problem.code === 'unexpected-fault-influence' && problem.severity === 'FAIL'),
    '未声明的红必须单列问题，不能因为主要断言红了就放过',
  );
  assert(
    !doc.problems.some((problem) => problem.code === 'regression'),
    'expectedRed 命中的检查按设计从绿变红，不能被重复算成回归',
  );
});

/* ------------------------------------------------------------------------- */
/* 5b. 差分 FAIL 分型（#183 评审整改 S3）                                      */
/* ------------------------------------------------------------------------- */

test('S3 分型映射表：清单/证据力/注入面问题归 test，候选侧真实变差归 product', () => {
  assertEqual(DIFF_PROBLEM_FAILURE_TYPES['empty-expectations'], 'test', '空清单 → 测试方法问题');
  assertEqual(DIFF_PROBLEM_FAILURE_TYPES['no-discrimination'], 'test', '无区分力 → 测试方法问题');
  assertEqual(DIFF_PROBLEM_FAILURE_TYPES['unexpected-fault-influence'], 'test', '注入器串扰 → 测试方法问题');
  assertEqual(DIFF_PROBLEM_FAILURE_TYPES['candidate-product-fail'], 'product', '候选侧自身非预期红 → 产品');
  assertEqual(DIFF_PROBLEM_FAILURE_TYPES['regression'], 'product', '回归 → 产品');
  assert(PRODUCT_PROBLEM_CODES.includes('regression'), 'product 码清单可读且含 regression');
});

test('S3 failureTypeForProblems：清单缺失/无区分力 → test 且 basis 指向 diff 问题码', () => {
  const missing = failureTypeForProblems([{ code: 'expect-missing-check', severity: 'FAIL', message: '' }]);
  assertEqual(missing.failureType, 'test');
  assertEqual(missing.basis.source, 'diff');
  assert(missing.basis.signal.includes('expect-missing-check'), 'basis.signal 记录问题码');
  assert(missing.basis.note.includes('不是候选侧行为回归'), 'test 分型说明这不是产品回归');

  const noPower = failureTypeForProblems([{ code: 'no-discrimination', severity: 'FAIL', message: '' }]);
  assertEqual(noPower.failureType, 'test');
});

test('S3 failureTypeForProblems：候选侧真实红（candidate-product-fail/regression）→ product', () => {
  const product = failureTypeForProblems([{ code: 'candidate-product-fail', severity: 'FAIL', message: '' }]);
  assertEqual(product.failureType, 'product');
  assert(product.productCodes.includes('candidate-product-fail'));
  assert(product.basis.note.includes('候选侧真实行为比对照侧变差'));

  const regression = failureTypeForProblems([
    { code: 'no-flip', severity: 'FAIL' },
    { code: 'regression', severity: 'FAIL' },
  ]);
  assertEqual(regression.failureType, 'product', '混合问题时 product 优先（有产品行为证据就不能降级成 test）');
});

test('S3 failureTypeForProblems：未知码 → test（fail-closed，不把工具/方法问题报成产品缺陷）', () => {
  const unknown = failureTypeForProblems([{ code: 'mystery', severity: 'FAIL' }]);
  assertEqual(unknown.failureType, 'test');
  const none = failureTypeForProblems([]);
  assertEqual(none.failureType, 'test');
});

test('S3 由真实 diff 文档问题推导分型：bothGreen → test；回归 → product', () => {
  const noPowerDoc = makeDoc({
    refChecks: [{ name: '场景 1：检查 A', verdict: 'PASS' }],
    curChecks: [{ name: '场景 1：检查 A', verdict: 'PASS' }],
    refVerdict: 'PASS',
    curVerdict: 'PASS',
    expect: makeExpect({ mustFlipRedOnBaseline: ['场景 1：检查 A'] }),
  });
  assertEqual(noPowerDoc.verdict, 'FAIL');
  assert(noPowerDoc.problems.some((problem) => problem.code === 'no-discrimination'));
  assertEqual(failureTypeForProblems(noPowerDoc.problems).failureType, 'test', 'bothGreen 的整体 FAIL 属测试方法问题');

  const regressionDoc = makeDoc({
    refChecks: [{ name: '场景 1：检查 A', verdict: 'PASS' }],
    curChecks: [{ name: '场景 1：检查 A', verdict: 'FAIL' }],
    refVerdict: 'PASS',
    curVerdict: 'FAIL',
    expect: makeExpect({ mustFlipRedOnBaseline: ['场景 1：检查 A'], mustStayGreen: [] }),
  });
  assert(
    regressionDoc.problems.some((problem) => problem.code === 'regression'),
    '候选侧把原本绿的检查弄红应产生 regression 问题',
  );
  assertEqual(failureTypeForProblems(regressionDoc.problems).failureType, 'product', '回归的整体 FAIL 属产品缺陷');
});

/* ------------------------------------------------------------------------- */
/* 6. CLI 入口（纯参数路径，不起浏览器）                                       */
/* ------------------------------------------------------------------------- */

test('CLI --help → exit 0，且包含两种模式与基线参数说明', () => {
  const result = spawnSync(process.execPath, [CLI_PATH, '--help'], { cwd: REPO_ROOT, encoding: 'utf8' });
  assertEqual(result.status, 0, 'help 退出码：' + (result.stderr || ''));
  assert(result.stdout.includes('--baseline-artifact'), 'help 必须说明 --baseline-artifact');
  assert(result.stdout.includes('--fault'), 'help 必须说明 --fault');
  assert(result.stdout.includes('退出码'), 'help 必须说明退出码');
});

test('CLI 用法错误 → exit 2（阻塞，不是工具故障）', () => {
  const unknown = spawnSync(process.execPath, [CLI_PATH, '--nope'], { cwd: REPO_ROOT, encoding: 'utf8' });
  assertEqual(unknown.status, 2, '未知参数应 exit 2；stderr=' + unknown.stderr);
  assert(unknown.stderr.includes('[diff][BLOCKED]'), '应打印 BLOCKED');
  const missingArtifact = spawnSync(process.execPath, [CLI_PATH, '--fault', 'insert-coordinate-offset'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  assertEqual(missingArtifact.status, 2, '缺少 --artifact 应 exit 2；stderr=' + missingArtifact.stderr);
  assert(missingArtifact.stderr.includes('缺少当前产物'), '应提示缺少当前产物');
});

/* ------------------------------------------------------------------------- */
/* 汇总（等异步注入器用例跑完）                                                */
/* ------------------------------------------------------------------------- */

function report() {
  if (results.failures.length > 0) {
    console.error('[diff-selftest] FAIL ' + results.failures.length + ' 项：');
    for (const failure of results.failures) {
      console.error('  ✗ ' + failure.name);
      console.error('    ' + (failure.error && failure.error.stack ? failure.error.stack.split('\n').slice(0, 3).join('\n    ') : String(failure.error)));
    }
    console.error('[diff-selftest] 通过 ' + results.passed + ' / 失败 ' + results.failed);
    process.exitCode = 1;
    return;
  }
  console.log('[diff-selftest] PASS ' + results.passed + ' 项（差分判定/期望清单/基线登记/注入器/退出码/CLI）');
  process.exitCode = 0;
}

runAsyncTests()
  .then(report)
  .catch((error) => {
    console.error('[diff-selftest] TOOL-FAULT ' + (error && error.stack ? error.stack : String(error)));
    process.exitCode = 3;
  });
