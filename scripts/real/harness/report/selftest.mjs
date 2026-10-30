#!/usr/bin/env node
/**
 * 判定分类与证据报告自证（票 #189）：纯 Node、零浏览器、零宿主、零网络。
 *
 * 目的（对应票 #189 的验收口径）：
 * A. 协议常量与退出码表：四类判定、FAIL 四分型、阻塞两类、退出码 0/1/2/3；
 * B. 四类样例端到端：真失败 → FAIL + exit 1；基线阻塞 → BLOCKED + exit 2；
 *    N-A → exit 0 且计入统计；通过 → PASS + exit 0；
 * C. FAIL 四分型全覆盖（推断与显式覆盖）；分型依据必须可读；
 * D. 证据六元组：每条检查自动补全声称/条件/步骤/原始观测/推断/判定，缺字段报错；
 * E. N-A 无理由 → 记录层直接抛错，原始报告校验也拒绝；
 * F. 预期失败（差分基线）：不计入产品 FAIL、报告显式分区；预期没成立 → 标「无区分力」；
 * G. 失败产物：有产物写路径且文件可打开；无产物必须有 artifactsWhy 说明；
 * H. Markdown 由 JSON 生成：同 JSON 两次生成字节相同，report.md 与 report.json 一致，缺字段显式；
 * I. JSON schema v2 向后兼容：v1 顶层字段与 checks 既有字段保留；
 * J. 退出码映射矩阵（全绿 / FAIL / 阻塞 / 工具故障 / 混合）。
 *
 * 运行：node scripts/real/harness/report/selftest.mjs
 * 可选：--out <目录> 把四类样例报告落盘（人工查看 report.json / report.md / artifacts）。
 * 退出码：0 = 全绿；1 = 有失败。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { HarnessError } from '../errors.mjs';
import { Recorder, writeReport } from '../evidence.mjs';
import {
  BLOCKER_KINDS,
  EVIDENCE_TUPLE_FIELDS,
  EXIT_CODES,
  FAILURE_TYPE_IDS,
  FAILURE_TYPES,
  SCHEMA_VERSION,
  VERDICTS,
  ReportError,
  assertEvidenceTuple,
  classifyFailure,
  exitCodeFor,
  overallVerdict,
  summarize,
  validateReport,
} from './model.mjs';
import { captureFailureArtifacts } from './artifacts.mjs';
import { MISSING_MARKER, renderMarkdown } from './markdown.mjs';

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

function throws(fn, messageIncludes, name) {
  try {
    fn();
    return ok(false, name, '没有抛错');
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    return ok(message.includes(messageIncludes), name, '文案=' + message);
  }
}

function section(title) {
  console.log('\n## ' + title);
}

function problemsMatching(problems, pattern) {
  return (problems || []).filter((problem) => pattern.test(String(problem && problem.message ? problem.message : problem)));
}

/** 样例环境：与 run.mjs 写进 environment 的字段同形，但值全部是测试用假值，不含本机信息。 */
function sampleEnvironment() {
  return {
    artifact: {
      name: 'dsh-prompt',
      version: '0.4.39',
      fileName: 'dsh-prompt-0.4.39.tgz',
      sizeBytes: 123_456,
      sha256: 'a'.repeat(64),
    },
    hostCli: 'dsh-cli-test',
    hostVersion: '0.2.1-rc.3',
    browser: 'msedge-test',
    browserRuntime: { version: 'Edg/156.0.4314.50' },
    fixture: { name: 'templates', ok: true },
    platform: 'test',
    arch: 'x64',
    node: 'v22.0.0',
    timezone: 'UTC',
    locale: 'zh-CN',
  };
}

function newRecorder({ suite = 'selftest', runTag = 'selftest-fixture', evidenceDir } = {}) {
  const recorder = new Recorder({ suite, runTag, evidenceDir });
  recorder.setEnvironment(sampleEnvironment());
  return recorder;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function checkByName(report, name) {
  return report.checks.find((check) => check.name === name) || null;
}

/* ─────────────────────────────── 样例场景 ─────────────────────────────── */

function samplePass(dir) {
  const recorder = newRecorder({ evidenceDir: dir });
  recorder.pass('宿主页面可加载', 'HTTP 200，1234 bytes');
  recorder.pass('插件入口渲染', '入口文案: "提示词模板"');
  return { recorder, written: writeReport(recorder, dir) };
}

function sampleProductFail(dir) {
  const recorder = newRecorder({ evidenceDir: dir });
  recorder.fail('悬停打开模板面板', {
    claim: '物理悬停插件入口后，模板面板在预算内出现且可见',
    expected: '[data-dsh-prompt-panel-root] 存在且可见',
    observed: '等待超时：8000ms 内未出现面板',
    detail: '等待超时：物理悬停入口后 8s 内面板未出现',
    steps: ['起一次性宿主并安装被测产物', '连接 CDP 打开宿主页面', '物理悬停 [data-dsh-prompt-entry]', '等待 [data-dsh-prompt-panel-root] 可见（8s）'],
    observations: { hoverRect: { cx: 960, cy: 24 }, panelVisible: false },
    inference: '输入事件已发出且命中入口，但产品未在预算内打开面板 → 产品行为不符合期望',
  });
  return { recorder, written: writeReport(recorder, dir) };
}

function sampleBlocked(dir) {
  const recorder = newRecorder({ evidenceDir: dir });
  recorder.blocked('fixture 起始态', '配方 templates 起始态与声明不符，套件未执行：global.hidePreset current=false expected=true');
  return { recorder, written: writeReport(recorder, dir) };
}

function sampleNa(dir) {
  const recorder = newRecorder({ evidenceDir: dir });
  recorder.pass('宿主页面可加载', 'HTTP 200，1234 bytes');
  recorder.na('远程模板分组', '本轮远程总闸关闭（remote-prefs 配方），远程观测不适用');
  return { recorder, written: writeReport(recorder, dir) };
}

function sampleToolFault(dir) {
  const recorder = newRecorder({ evidenceDir: dir });
  recorder.fail('读取 store（双通道）', {
    expected: 'store 可读且与界面一致',
    observed: 'CDP 连接已关闭，无法 evaluate',
    error: new HarnessError('CDP 连接已关闭：Runtime.evaluate 失败'),
  });
  return { recorder, written: writeReport(recorder, dir) };
}

function sampleExpectedFailure(dir) {
  const recorder = newRecorder({ evidenceDir: dir });
  recorder.expectFail('旧产物：草稿逐字等于 fixture 正文', {
    expected: 'fixture 正文',
    observed: '空草稿（旧产物缺陷）',
    detail: '旧工件预期在插入落位断言上红（差分基线）',
  });
  recorder.pass('当前产物：草稿逐字等于 fixture 正文', '与 fixture 正文逐字一致');
  return { recorder, written: writeReport(recorder, dir) };
}

/* ─────────────────────────────── A. 协议常量 ─────────────────────────────── */

section('A. 协议常量与退出码表');
{
  eq(SCHEMA_VERSION, 2, 'A1 schemaVersion 升到 2');
  deepEq(VERDICTS, ['PASS', 'FAIL', 'BLOCKED', 'N-A'], 'A2 四类判定固定且顺序稳定');
  deepEq(FAILURE_TYPE_IDS, ['product', 'spec', 'test', 'tool'], 'A3 FAIL 四分型固定');
  deepEq(
    FAILURE_TYPES.map((type) => type.label),
    ['产品缺陷', '规格缺陷', '测试假象', '工具故障'],
    'A4 分型中文名与票面一致',
  );
  deepEq(
    BLOCKER_KINDS.map((kind) => kind.id),
    ['environment', 'tool'],
    'A5 阻塞分环境未就绪与工具故障两类',
  );
  deepEq(EXIT_CODES, { PASS: 0, FAIL: 1, BLOCKED: 2, TOOL_FAULT: 3 }, 'A6 退出码 0/1/2/3 表');
  deepEq(
    EVIDENCE_TUPLE_FIELDS,
    ['claim', 'conditions', 'steps', 'observations', 'inference', 'verdict'],
    'A7 证据六元组字段固定',
  );
}

/* ─────────────────────────────── B. 四类样例 ─────────────────────────────── */

const rootIsTemp = !pickOutDir();
const rootDir = pickOutDir() ?? fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-report-selftest-'));

function pickOutDir() {
  const argv = process.argv.slice(2);
  const index = argv.indexOf('--out');
  if (index >= 0 && argv[index + 1]) return path.resolve(argv[index + 1]);
  return null;
}

function sampleDir(name) {
  const dir = path.join(rootDir, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

section('B. 四类判定样例（真失败 / 基线阻塞 / N-A / 通过）');
{
  // B1 通过 → PASS + exit 0
  const pass = samplePass(sampleDir('pass'));
  eq(pass.written.report.verdict, 'PASS', 'B1a 通过样例整体判定 PASS');
  eq(pass.written.report.exitCode, 0, 'B1b 通过样例退出码 0');
  eq(pass.written.report.summary.PASS, 2, 'B1c 通过样例 PASS 计数 2');
  ok(fs.existsSync(pass.written.reportPath), 'B1d report.json 已落盘');
  ok(fs.existsSync(pass.written.markdownPath), 'B1e report.md 已落盘');
  ok(path.basename(pass.written.markdownPath) === 'report.md', 'B1f Markdown 与 JSON 同目录同名报告');
  const passMd = fs.readFileSync(pass.written.markdownPath, 'utf8');
  ok(passMd.includes('## 判定统计'), 'B1g Markdown 含判定统计');
  ok(passMd.includes('## 失败明细（0 条）'), 'B1h 无失败时显式写「失败明细（0 条）」');

  // B2 真失败（产品）→ FAIL + exit 1
  const fail = sampleProductFail(sampleDir('fail-product'));
  eq(fail.written.report.verdict, 'FAIL', 'B2a 真失败整体判定 FAIL');
  eq(fail.written.report.exitCode, 1, 'B2b 真失败退出码 1');
  eq(fail.written.report.summary.FAIL, 1, 'B2c 产品 FAIL 计入 FAIL 计数');
  const failCheck = checkByName(fail.written.report, '悬停打开模板面板');
  eq(failCheck && failCheck.failureType, 'product', 'B2d 超时类断言不成立 → 产品缺陷');
  eq(failCheck && failCheck.failureTypeBasis && failCheck.failureTypeBasis.signal, 'timeout', 'B2e 分型依据记录信号 timeout');
  eq(failCheck && failCheck.expectedFailure, false, 'B2f 普通失败不是预期失败');
  ok(fail.written.report.failures.length === 1, 'B2g failures 分区恰好一条');
  const failMd = fs.readFileSync(fail.written.markdownPath, 'utf8');
  ok(failMd.includes('## 失败明细（1 条）'), 'B2h Markdown 失败明细 1 条');
  ok(failMd.includes('产品缺陷'), 'B2i Markdown 写产品缺陷分型');
  ok(failMd.includes('等待超时'), 'B2j Markdown 含原始观测文本');
  ok(failMd.includes('**声称**'), 'B2k Markdown 含六元组「声称」');
  ok(failMd.includes('**步骤**'), 'B2l Markdown 含六元组「步骤」');
  ok(failMd.includes('**推断**'), 'B2m Markdown 含六元组「推断」');

  // B3 基线阻塞 → BLOCKED + exit 2
  const blocked = sampleBlocked(sampleDir('blocked'));
  eq(blocked.written.report.verdict, 'BLOCKED', 'B3a 基线阻塞整体判定 BLOCKED');
  eq(blocked.written.report.exitCode, 2, 'B3b 基线阻塞退出码 2');
  const blockedCheck = checkByName(blocked.written.report, 'fixture 起始态');
  eq(blockedCheck && blockedCheck.blockerKind, 'environment', 'B3c 阻塞默认是环境未就绪（不是工具故障）');
  ok(typeof blockedCheck.reason === 'string' && blockedCheck.reason.length > 0, 'B3d 阻塞必须写原因');
  const blockedMd = fs.readFileSync(blocked.written.markdownPath, 'utf8');
  ok(blockedMd.includes('## 阻塞（1 条）'), 'B3e Markdown 有阻塞分区');
  ok(blockedMd.includes('fixture 起始态'), 'B3f Markdown 指名阻塞检查');

  // B4 N-A → exit 0 且计入统计
  const na = sampleNa(sampleDir('na'));
  eq(na.written.report.verdict, 'PASS', 'B4a 只有 PASS + N-A 时整体判定 PASS');
  eq(na.written.report.exitCode, 0, 'B4b N-A 不影响退出码（0）');
  eq(na.written.report.summary['N-A'], 1, 'B4c N-A 计入统计');
  const naMd = fs.readFileSync(na.written.markdownPath, 'utf8');
  ok(naMd.includes('## N/A（1 条）'), 'B4d Markdown 有 N/A 分区');
  ok(naMd.includes('本轮远程总闸关闭'), 'B4e Markdown 写 N/A 理由');

  // B5 工具故障 → 退出码 3（判定仍是 FAIL：证据上确实失败了，但分型不是产品缺陷）
  const tool = sampleToolFault(sampleDir('tool-fault'));
  eq(tool.written.report.verdict, 'FAIL', 'B5a 工具故障样例整体判定 FAIL');
  eq(tool.written.report.exitCode, 3, 'B5b 工具故障退出码 3（不冒充产品失败 exit 1）');
  const toolCheck = checkByName(tool.written.report, '读取 store（双通道）');
  eq(toolCheck && toolCheck.failureType, 'tool', 'B5c HarnessError → 工具故障分型');
  eq(toolCheck && toolCheck.failureTypeBasis && toolCheck.failureTypeBasis.source, 'inferred', 'B5d 分型来源=推断');
  eq(tool.written.report.summary.failureTypes.product, 0, 'B5e 工具故障不计入产品缺陷');
  const toolMd = fs.readFileSync(tool.written.markdownPath, 'utf8');
  ok(toolMd.includes('工具故障'), 'B5f Markdown 写工具故障分型');
}

/* ─────────────────────────────── C. 分型判据 ─────────────────────────────── */

section('C. FAIL 四分型判据（自动推断 + 显式覆盖）');
{
  const harness = classifyFailure({ error: new HarnessError('浏览器启动失败') });
  eq(harness.type, 'tool', 'C1 HarnessError → 工具故障');
  eq(harness.basis.signal, 'harness-error', 'C2 分型依据信号 harness-error');

  const driver = classifyFailure({ error: new Error('WebSocket 已关闭：Runtime.evaluate 失败') });
  eq(driver.type, 'tool', 'C3 驱动/协议异常 → 工具故障');
  eq(driver.basis.signal, 'driver-error', 'C4 分型依据信号 driver-error');

  const timeout = classifyFailure({ detail: '等待超时：8s 内面板未出现' });
  eq(timeout.type, 'product', 'C5 等待超时 → 产品缺陷');
  eq(timeout.basis.signal, 'timeout', 'C6 分型依据信号 timeout');

  const missing = classifyFailure({ observed: '元素不存在：未找到 [data-dsh-prompt-panel-root]' });
  eq(missing.type, 'product', 'C7 元素缺失 → 产品缺陷');
  eq(missing.basis.signal, 'element-missing', 'C8 分型依据信号 element-missing');

  const fallback = classifyFailure({ detail: '期望与观测不一致' });
  eq(fallback.type, 'product', 'C9 普通断言不成立默认产品缺陷');
  eq(fallback.basis.signal, 'assertion', 'C10 分型依据信号 assertion');
  ok(fallback.basis.note.includes('spec'), 'C11 默认分型依据提示可显式覆盖为规格缺陷');

  const spec = classifyFailure({
    failureType: 'spec',
    failureTypeBasis: '规格未写清面板打开后焦点归属，期望值本身有歧义',
  });
  eq(spec.type, 'spec', 'C12 显式覆盖为规格缺陷');
  eq(spec.basis.source, 'explicit', 'C13 显式分型依据来源=explicit');
  ok(spec.basis.note.includes('规格'), 'C14 显式分型依据保留理由原文');

  const flaky = classifyFailure({ flakySuspect: true, detail: '第一次红、重跑绿' });
  eq(flaky.type, 'test', 'C15 不可复现/环境抖动 → 测试假象');
  eq(flaky.basis.signal, 'not-reproducible', 'C16 分型依据信号 not-reproducible');

  const explicitWins = classifyFailure({ error: new HarnessError('x'), failureType: 'product' });
  eq(explicitWins.type, 'product', 'C17 显式覆盖优先于自动推断');
  ok(explicitWins.basis.note.length > 0, 'C18 显式覆盖也必须带分型依据');

  throws(() => classifyFailure({ failureType: 'nope' }), 'failureType', 'C19 未知分型直接抛错');

  // 四分型在报告里各自落位（product 已由 B2 覆盖，这里补 spec / test）
  const dir = sampleDir('types');
  const recorder = newRecorder({ evidenceDir: dir });
  recorder.fail('规格缺陷样例', { expected: 'x', observed: 'y', failureType: 'spec', failureTypeBasis: '规格歧义' });
  recorder.fail('测试假象样例', { expected: 'x', observed: 'y', flakySuspect: true });
  const written = writeReport(recorder, dir);
  const specCheck = checkByName(written.report, '规格缺陷样例');
  const flakyCheck = checkByName(written.report, '测试假象样例');
  eq(specCheck && specCheck.failureType, 'spec', 'C20 显式规格缺陷进报告');
  eq(flakyCheck && flakyCheck.failureType, 'test', 'C21 测试假象进报告');
  eq(flakyCheck && flakyCheck.flakySuspect, true, 'C22 测试假象必须记 flakySuspect');
  eq(written.report.summary.failureTypes.spec, 1, 'C23 报告统计含规格缺陷计数');
  eq(written.report.summary.failureTypes.test, 1, 'C24 报告统计含测试假象计数');

  // 原始报告缺分型 → 校验拒绝
  const broken = JSON.parse(JSON.stringify(written.report));
  delete broken.checks[0].failureType;
  delete broken.checks[0].failureTypeBasis;
  ok(problemsMatching(validateReport(broken), /failureType/).length > 0, 'C25 FAIL 缺分型 → 报告校验拒绝');
}

/* ─────────────────────────────── D. 证据六元组 ─────────────────────────────── */

section('D. 证据六元组（完整性 + 自动补全）');
{
  const dir = sampleDir('tuple');
  const recorder = newRecorder({ evidenceDir: dir });
  recorder.fail('自动补全六元组', { expected: 'a', observed: 'b' });
  const written = writeReport(recorder, dir);
  const check = checkByName(written.report, '自动补全六元组');

  const missingFields = EVIDENCE_TUPLE_FIELDS.filter((field) => check[field] === undefined || check[field] === null);
  deepEq(missingFields, [], 'D1 失败检查自动补全六元组，无缺失字段');
  eq(check.claim, '自动补全六元组', 'D2 声称缺省取检查名');
  eq(check.status || check.verdict, 'FAIL', 'D3 六元组第六项 verdict=FAIL');
  eq(check.conditions.runTag, 'selftest-fixture', 'D4 条件含 runTag');
  eq(check.conditions.artifact && check.conditions.artifact.name, 'dsh-prompt', 'D5 条件含 artifact');
  eq(check.conditions.host && check.conditions.host.version, '0.2.1-rc.3', 'D6 条件含宿主版本');
  ok(check.conditions.browser !== undefined, 'D7 条件含浏览器');
  ok(check.conditions.fixture !== undefined, 'D8 条件含 fixture');
  ok(Array.isArray(check.steps) && check.steps.length > 0, 'D9 步骤非空数组');
  ok(check.observations && Object.keys(check.observations).length > 0, 'D10 原始观测非空对象');
  ok(typeof check.inference === 'string' && check.inference.length > 0, 'D11 推断非空字符串');
  ok(typeof check.expected === 'string' && check.expected === 'a', 'D12 兼容字段 expected 保留');
  ok(typeof check.observed === 'string' && check.observed === 'b', 'D13 兼容字段 observed 保留');

  // 显式六元组逐字段保留
  const explicitDir = sampleDir('tuple-explicit');
  const explicit = newRecorder({ evidenceDir: explicitDir });
  explicit.fail('显式六元组', {
    claim: '自定义声称',
    conditions: { artifact: { name: '自定义产物' } },
    steps: ['第一步', { action: 'click', target: '[data-x]' }],
    observations: { raw: [1, 2, 3] },
    inference: '自定义推断',
    expected: 'e',
    observed: 'o',
  });
  writeReport(explicit, explicitDir);
  const explicitCheck = checkByName(explicit.finish(), '显式六元组');
  eq(explicitCheck.claim, '自定义声称', 'D14 显式声称保留');
  ok(explicitCheck.steps.length === 2 && explicitCheck.steps[1].action === 'click', 'D15 显式步骤保留');
  deepEq(explicitCheck.observations.raw, [1, 2, 3], 'D16 显式原始观测保留');
  eq(explicitCheck.inference, '自定义推断', 'D17 显式推断保留');
  eq(explicitCheck.conditions.artifact.name, '自定义产物', 'D18 显式条件合并覆盖');
  eq(explicitCheck.conditions.runTag, 'selftest-fixture', 'D19 显式条件不丢运行标签');

  // 缺字段 → 抛错并指名字段
  for (const field of EVIDENCE_TUPLE_FIELDS) {
    const sample = JSON.parse(JSON.stringify(check));
    delete sample[field];
    throws(() => assertEvidenceTuple(sample), field, 'D20 缺 ' + field + ' → 六元组校验报错指名');
  }
  const rawBroken = JSON.parse(JSON.stringify(written.report));
  delete rawBroken.checks[0].claim;
  delete rawBroken.checks[0].inference;
  const problems = validateReport(rawBroken);
  ok(problemsMatching(problems, /claim/).length > 0, 'D21 报告校验拒绝缺 claim 的失败检查');
  ok(problemsMatching(problems, /inference/).length > 0, 'D22 报告校验拒绝缺 inference 的失败检查');
}

/* ─────────────────────────────── E. N-A 理由 ─────────────────────────────── */

section('E. N-A 必须写理由');
{
  const dir = sampleDir('na-reason');
  const recorder = newRecorder({ evidenceDir: dir });
  const before = recorder.checks.length;
  throws(() => recorder.na('无理由的 N-A'), 'reason', 'E1 记录层：N-A 缺理由直接抛错');
  eq(recorder.checks.length, before, 'E2 抛错时不留下残缺检查');
  throws(() => recorder.na('空理由的 N-A', '   '), 'reason', 'E3 空白理由同样拒绝');
  eq(recorder.checks.length, before, 'E4 空白理由也不记录');

  recorder.na('有理由的 N-A', '本轮 fixture 关闭远程，远程观测不适用');
  writeReport(recorder, dir);

  const broken = {
    schemaVersion: 2,
    runTag: 'r',
    suite: 's',
    verdict: 'PASS',
    startedAt: '2026-01-01T00:00:00.000Z',
    finishedAt: '2026-01-01T00:00:01.000Z',
    environment: {},
    summary: summarize([{ name: 'x', verdict: 'N-A', claim: 'x', conditions: {}, steps: ['s'], observations: { a: 1 }, inference: 'i' }]),
    checks: [{ name: 'x', verdict: 'N-A', claim: 'x', conditions: {}, steps: ['s'], observations: { a: 1 }, inference: 'i' }],
  };
  ok(problemsMatching(validateReport(broken), /N-A.*reason|reason.*N-A/i).length > 0, 'E5 原始报告校验：N-A 缺 reason 拒绝');
}

/* ─────────────────────────────── F. 预期失败 ─────────────────────────────── */

section('F. 预期失败（差分/负例）不计入产品失败');
{
  const dir = sampleDir('expected');
  const expected = sampleExpectedFailure(dir);
  eq(expected.written.report.summary.FAIL, 0, 'F1 预期失败不计入 FAIL 计数');
  eq(expected.written.report.summary.expectedFailures, 1, 'F2 预期失败单独计入 expectedFailures');
  eq(expected.written.report.verdict, 'PASS', 'F3 只有预期失败时整体判定 PASS');
  eq(expected.written.report.exitCode, 0, 'F4 只有预期失败时退出码 0');
  eq(expected.written.report.failures.length, 0, 'F5 failures 分区不含预期失败');
  eq(expected.written.report.expectedFailures.length, 1, 'F6 expectedFailures 分区含该条');
  const expectedCheck = checkByName(expected.written.report, '旧产物：草稿逐字等于 fixture 正文');
  eq(expectedCheck && expectedCheck.expectedFailure, true, 'F7 检查带 expectedFailure=true 标记');
  eq(expectedCheck && expectedCheck.verdict, 'FAIL', 'F8 预期失败仍保留真实 FAIL 判定');
  eq(expected.written.report.summary.failureTypes.product, 0, 'F9 预期失败不污染分型统计');
  const md = fs.readFileSync(expected.written.markdownPath, 'utf8');
  ok(md.includes('## 预期失败（1 条，不计入产品失败）'), 'F10 Markdown 显式区分预期失败');
  ok(md.includes('## 失败明细（0 条）'), 'F11 预期失败不进入产品失败明细');

  // fail({expected:true}) 等价入口（票面约定）与 fail({expectedFailure:true}) 等价入口
  const dir2 = sampleDir('expected-fail-flag');
  const recorder2 = newRecorder({ evidenceDir: dir2 });
  recorder2.fail('另一条预期失败', { expected: 'x', observed: 'y', expectedFailure: true });
  recorder2.fail('票面入口：fail({expected:true})', { expected: true, observed: 'z' });
  eq(recorder2.summary().expectedFailures, 2, 'F12 expectFail / fail({expected:true}) 都记为预期失败');
  eq(recorder2.summary().FAIL, 0, 'F13 预期失败不计产品失败');
  writeReport(recorder2, dir2);

  // 显式 expectedFailure:false 覆盖「expected:true」简写（期望值恰好是布尔 true 的极端情况）
  const dir2b = sampleDir('expected-explicit-false');
  const recorder2b = newRecorder({ evidenceDir: dir2b });
  recorder2b.fail('显式否定优先', { expected: true, expectedFailure: false, observed: 'w' });
  eq(recorder2b.summary().expectedFailures, 0, 'F13b 显式 expectedFailure=false 覆盖票面简写');
  eq(recorder2b.summary().FAIL, 1, 'F13c 显式否定后按真实失败计数');
  writeReport(recorder2b, dir2b);

  // 预期没成立 → 标「无区分力」，算真实失败
  const dir3 = sampleDir('expected-missed');
  const recorder3 = newRecorder({ evidenceDir: dir3 });
  recorder3.expectFailures(['旧产物的关键断言']);
  recorder3.pass('旧产物的关键断言', '旧产物也绿了');
  const missed = writeReport(recorder3, dir3);
  eq(missed.report.summary.FAIL, 1, 'F14 预期失败未成立 → 记真实 FAIL');
  eq(missed.report.verdict, 'FAIL', 'F15 预期失败未成立 → 整体 FAIL');
  eq(missed.report.exitCode, 1, 'F16 预期失败未成立 → 退出码 1');
  const noPower = checkByName(missed.report, '预期失败未成立：旧产物的关键断言');
  ok(!!noPower, 'F17 记录「预期失败未成立」检查');
  eq(noPower && noPower.failureType, 'test', 'F18 无区分力归类为测试假象');
  ok(noPower && String(noPower.inference).includes('无区分力'), 'F19 推断写明无区分力/无证据力');
  const missedMd = fs.readFileSync(missed.written ? missed.written.markdownPath : missed.markdownPath, 'utf8');
  ok(missedMd.includes('无区分力'), 'F20 Markdown 写明无区分力');
}

/* ─────────────────────────────── G. 失败产物 ─────────────────────────────── */

section('G. 失败产物（可打开文件 / 无产物说明）');
{
  // G1 显式登记产物：文件可打开、报告带相对与绝对路径
  const dir = sampleDir('artifacts');
  const recorder = newRecorder({ evidenceDir: dir });
  const logRef = recorder.saveArtifact({ kind: 'log', name: '悬停失败', content: { reason: 'timeout', panel: false } });
  const stateRef = recorder.saveArtifact({ kind: 'page-state', name: '悬停失败', content: { panel: { visible: false } } });
  recorder.fail('悬停打开模板面板', {
    expected: '面板可见',
    observed: '面板不可见',
    artifacts: [logRef, stateRef],
  });
  const written = writeReport(recorder, dir);
  const check = checkByName(written.report, '悬停打开模板面板');
  eq(check.artifacts.length, 2, 'G1 失败检查带两份产物');
  ok(check.artifacts.every((artifact) => fs.existsSync(artifact.file)), 'G2 产物文件可打开（绝对路径存在）');
  ok(check.artifacts.every((artifact) => typeof artifact.relative === 'string' && artifact.relative.startsWith('artifacts/')), 'G3 产物相对路径以 artifacts/ 开头');
  ok(check.artifacts.every((artifact) => !path.isAbsolute(artifact.relative) && !/^[A-Za-z]:/.test(artifact.relative)), 'G4 相对路径不含绝对路径/盘符（可进仓引用）');
  deepEq(readJson(check.artifacts[0].file), { reason: 'timeout', panel: false }, 'G5 产物 JSON 可直接打开读回');
  const md = fs.readFileSync(written.markdownPath, 'utf8');
  ok(md.includes(check.artifacts[0].relative), 'G6 Markdown 写产物相对路径');

  // G2 无产物 → 必须有 artifactsWhy（写报告时显式兜底）
  const dir2 = sampleDir('artifacts-missing');
  const recorder2 = newRecorder({ evidenceDir: dir2 });
  recorder2.fail('无产物的失败', { expected: 'x', observed: 'y' });
  const written2 = writeReport(recorder2, dir2);
  const check2 = checkByName(written2.report, '无产物的失败');
  ok(typeof check2.artifactsWhy === 'string' && check2.artifactsWhy.length > 0, 'G7 无产物失败必须有 artifactsWhy');
  ok(fs.readFileSync(written2.markdownPath, 'utf8').includes('产物'), 'G8 Markdown 显式写产物缺失说明');

  const broken = JSON.parse(JSON.stringify(written2.report));
  delete broken.checks[0].artifacts;
  delete broken.checks[0].artifactsWhy;
  ok(problemsMatching(validateReport(broken), /artifacts/).length > 0, 'G9 原始报告校验：无产物且无说明 → 拒绝');

  // G3 自动采集：失败后无需套件手动截图也能拿到四类产物（用假句柄离线验证）
  const dir3 = sampleDir('artifacts-auto');
  const recorder3 = newRecorder({ evidenceDir: dir3 });
  recorder3.fail('自动采集产物的失败', { expected: 'x', observed: 'y' });
  const savedShot = [];
  const fakeClient = {
    async screenshot(file) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from('89504e47', 'hex'));
      savedShot.push(file);
      return file;
    },
  };
  const fakeObserve = { async snapshot() { return { panel: { visible: false }, composer: { text: '' } }; } };
  const fakePersistence = { async read() { return { baseline: { hidePreset: true } }; } };
  const fakeInput = { log: { async read() { return [{ type: 'pointermove', trust: true }]; } } };
  const capture = await captureFailureArtifacts({
    recorder: recorder3,
    client: fakeClient,
    observe: fakeObserve,
    persistence: fakePersistence,
    input: fakeInput,
  });
  ok(capture.captured >= 4, 'G10 自动采集到截图/页面状态/store/输入日志四类产物');
  const autoCheck = checkByName(recorder3.finish(), '自动采集产物的失败');
  const kinds = (autoCheck.artifacts || []).map((artifact) => artifact.kind);
  deepEq([...new Set(kinds)].sort(), ['input-log', 'page-state', 'screenshot', 'store'], 'G11 四类产物 kind 齐全');
  ok((autoCheck.artifacts || []).every((artifact) => fs.existsSync(artifact.file)), 'G12 自动采集的产物文件都存在');
  eq(autoCheck.artifactsWhy, undefined, 'G13 已拿到产物时不再写 artifactsWhy 兜底');
  writeReport(recorder3, dir3);

  // G4 自动采集无失败时不写文件
  const dir4 = sampleDir('artifacts-none');
  const recorder4 = newRecorder({ evidenceDir: dir4 });
  recorder4.pass('全绿', 'ok');
  const empty = await captureFailureArtifacts({ recorder: recorder4, client: fakeClient, observe: fakeObserve, persistence: fakePersistence, input: fakeInput });
  eq(empty.captured, 0, 'G14 无失败时不采集产物');
}

/* ─────────────────────────────── H. Markdown ─────────────────────────────── */

section('H. Markdown 由 JSON 生成且一致');
{
  const dir = sampleDir('markdown');
  const recorder = newRecorder({ evidenceDir: dir });
  recorder.fail('悬停打开模板面板', {
    expected: '面板可见',
    observed: '等待超时',
    detail: '等待超时：8s 内面板未出现',
    steps: ['物理悬停入口', '等待面板可见'],
  });
  recorder.na('远程模板分组', '本轮远程总闸关闭');
  const written = writeReport(recorder, dir);
  const jsonText = fs.readFileSync(written.reportPath, 'utf8');
  const mdText = fs.readFileSync(written.markdownPath, 'utf8');

  eq(renderMarkdown(JSON.parse(jsonText)), mdText, 'H1 report.md 与 report.json 逐字节一致（由 JSON 生成）');
  eq(renderMarkdown(written.report), renderMarkdown(written.report), 'H2 同一 JSON 两次生成字节相同');
  const again = writeReport(recorder, dir);
  eq(fs.readFileSync(again.markdownPath, 'utf8'), mdText, 'H3 重复写出 report.md 字节不变');
  eq(fs.readFileSync(again.reportPath, 'utf8'), jsonText, 'H4 重复写出 report.json 字节不变');

  for (const heading of ['## 环境与版本', '## 判定统计', '## 失败明细（1 条）', '## 预期失败（0 条，不计入产品失败）', '## N/A（1 条）', '## 证据路径']) {
    ok(mdText.includes(heading), 'H5 Markdown 含分区「' + heading + '」');
  }
  ok(mdText.includes('sha256'), 'H6 Markdown 写产物 sha256（短）');
  ok(mdText.includes('aussian') === false, 'H7 无占位乱码');
  ok(mdText.includes('runTag=selftest-fixture'), 'H8 Markdown 写 runTag');
  ok(mdText.includes('0.4.39'), 'H9 Markdown 写产物版本');
  ok(mdText.includes('dsh-cli-test'), 'H10 Markdown 写宿主 CLI');
  ok(mdText.includes('Edg/156.0.4314.50'), 'H11 Markdown 写浏览器 runtime');

  const sparse = {
    schemaVersion: 2,
    runTag: 'r',
    suite: 's',
    verdict: 'PASS',
    startedAt: null,
    finishedAt: null,
    environment: {},
    summary: summarize([]),
    checks: [],
  };
  const sparseMd = renderMarkdown(sparse);
  ok(sparseMd.includes(MISSING_MARKER), 'H12 字段缺失时显式写「' + MISSING_MARKER + '」，不静默省略');
}

/* ─────────────────────────────── I. schema v2 兼容 ─────────────────────────────── */

section('I. 报告 schema v2 与向后兼容');
{
  const dir = sampleDir('compat');
  const recorder = newRecorder({ evidenceDir: dir });
  recorder.pass('旧调用：pass(name, detail)', '旧风格 detail 字符串');
  recorder.fail('旧调用：fail({expected,observed,detail})', { expected: 'e', observed: 'o', detail: 'd' });
  const written = writeReport(recorder, dir);
  const report = written.report;

  eq(report.schemaVersion, 2, 'I1 schemaVersion=2');
  for (const field of ['runTag', 'suite', 'verdict', 'startedAt', 'finishedAt', 'environment', 'summary', 'checks']) {
    ok(report[field] !== undefined, 'I2 v1 顶层字段保留：' + field);
  }
  for (const field of ['exitCode', 'meta', 'failures', 'expectedFailures']) {
    ok(report[field] !== undefined, 'I3 v2 新顶层字段：' + field);
  }
  const passCheck = checkByName(report, '旧调用：pass(name, detail)');
  eq(passCheck.verdict, 'PASS', 'I4 旧 pass 调用判定不变');
  eq(passCheck.detail, '旧风格 detail 字符串', 'I5 旧 pass 调用 detail 字段保留');
  const failCheck = checkByName(report, '旧调用：fail({expected,observed,detail})');
  eq(failCheck.expected, 'e', 'I6 旧 fail expected 字段保留');
  eq(failCheck.observed, 'o', 'I7 旧 fail observed 字段保留');
  eq(failCheck.detail, 'd', 'I8 旧 fail detail 字段保留');
  eq(failCheck.failureType, 'product', 'I9 旧 fail 自动补分型');
  ok(typeof failCheck.failureTypeBasis.note === 'string' && failCheck.failureTypeBasis.note.length > 0, 'I10 旧 fail 自动补分型依据');

  eq(report.meta.artifact && report.meta.artifact.name, 'dsh-prompt', 'I11 meta 含产物名');
  eq(report.meta.artifact && report.meta.artifact.version, '0.4.39', 'I12 meta 含产物版本');
  eq(report.meta.artifact && report.meta.artifact.sha256.length, 64, 'I13 meta 含产物 sha256');
  eq(report.meta.host && report.meta.host.version, '0.2.1-rc.3', 'I14 meta 含宿主 runtime 版本');
  ok(report.meta.browser && report.meta.browser.runtime === 'Edg/156.0.4314.50', 'I15 meta 含浏览器 runtime');
  eq(report.meta.timezone, 'UTC', 'I16 meta 含时区');
  eq(report.meta.locale, 'zh-CN', 'I17 meta 含 locale');
  eq(report.meta.runTag, 'selftest-fixture', 'I18 meta 含 runTag');
  ok(typeof report.meta.startedAt === 'string' && report.meta.startedAt.length > 0, 'I19 meta 含开始时间');

  ok(typeof written.reportPath === 'string' && typeof written.markdownPath === 'string' && typeof written.markdown === 'string', 'I20 writeReport 返回 JSON/Markdown 路径与内容');
  eq(report.summary.total, report.checks.length, 'I21 summary.total = checks 数');
}

/* ─────────────────────────────── J. 退出码矩阵 ─────────────────────────────── */

section('J. 退出码映射矩阵');
{
  const mk = (verdict, extra = {}) => ({ name: 'n', verdict, ...extra });
  eq(exitCodeFor([mk('PASS')]), 0, 'J1 全 PASS → 0');
  eq(exitCodeFor([mk('PASS'), mk('N-A')]), 0, 'J2 PASS + N-A → 0');
  eq(exitCodeFor([mk('FAIL', { failureType: 'product' })]), 1, 'J3 产品 FAIL → 1');
  eq(exitCodeFor([mk('FAIL', { failureType: 'spec' })]), 1, 'J4 规格 FAIL → 1');
  eq(exitCodeFor([mk('FAIL', { failureType: 'test', flakySuspect: true })]), 1, 'J5 测试假象 FAIL → 1');
  eq(exitCodeFor([mk('FAIL', { failureType: 'tool' })]), 3, 'J6 只有工具故障 FAIL → 3');
  eq(exitCodeFor([mk('FAIL', { failureType: 'tool' }), mk('FAIL', { failureType: 'product' })]), 1, 'J7 工具故障 + 产品失败 → 1（产品优先）');
  eq(exitCodeFor([mk('BLOCKED', { blockerKind: 'tool' })]), 3, 'J8 工具故障阻塞 → 3');
  eq(exitCodeFor([mk('BLOCKED', { blockerKind: 'environment' })]), 2, 'J9 环境未就绪阻塞 → 2');
  eq(exitCodeFor([mk('FAIL', { failureType: 'product' }), mk('BLOCKED', { blockerKind: 'environment' })]), 1, 'J10 失败 + 阻塞 → 1（失败优先）');
  eq(exitCodeFor([mk('FAIL', { failureType: 'product', expected: true })]), 0, 'J11 预期失败 → 0');
  eq(exitCodeFor([]), 0, 'J12 无检查 → 0');

  eq(overallVerdict([mk('FAIL', { failureType: 'tool' })]), 'FAIL', 'J13 工具故障判定仍是 FAIL（退出码区分原因）');
  eq(overallVerdict([mk('FAIL', { failureType: 'product', expected: true })]), 'PASS', 'J14 预期失败不改变整体判定');
  eq(overallVerdict([mk('BLOCKED', { blockerKind: 'tool' })]), 'BLOCKED', 'J15 阻塞整体判定 BLOCKED');
  eq(overallVerdict([mk('PASS'), mk('N-A')]), 'PASS', 'J16 N-A 不改变整体判定');
}

/* ─────────────────────────────── 收尾 ─────────────────────────────── */

if (rootIsTemp) {
  fs.rmSync(rootDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
} else {
  console.log('\n[samples] 四类样例报告已落盘：' + rootDir);
  for (const name of ['pass', 'fail-product', 'blocked', 'na', 'tool-fault']) {
    if (fs.existsSync(path.join(rootDir, name))) console.log('[samples]   ' + path.join(rootDir, name));
  }
}

if (failures.length > 0) {
  console.error('\n[selftest] FAILED ' + failures.length + ' 项：');
  for (const failure of failures) console.error('  - ' + failure.name + ' ' + JSON.stringify(failure.detail));
  console.error('\nRESULT: ' + passCount + ' PASS / ' + failures.length + ' FAIL');
  process.exit(1);
}
console.log('\nRESULT: ' + passCount + ' PASS / 0 FAIL（判定分类与证据报告自证全绿）');
process.exit(0);
