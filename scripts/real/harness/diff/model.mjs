/**
 * 差分文档模型（票 #191 交付物 A/B）。
 *
 * 输入两份真实 report.json + 期望清单，输出**唯一事实源** diff.json 的对象；
 * diff.md 只由这个对象确定性渲染（render.mjs），不另算任何数。
 *
 * 纯函数：不读文件、不读时钟、不 spawn —— selftest 用合成报告即可覆盖全部判定分支。
 */

import { CLASSIFICATIONS, buildRows, classificationMeta, normalizeVerdict, summarizeRows } from './classify.mjs';
import { evaluateExpectations, evaluateFaultExpectations, regressionProblems } from './expect.mjs';

export const DIFF_SCHEMA_VERSION = 1;

/** 与 report 层同一套退出码语义：0 通过 / 1 有区分力问题或回归 / 2 阻塞 / 3 工具故障。 */
export const DIFF_EXIT_CODES = Object.freeze({ PASS: 0, FAIL: 1, BLOCKED: 2, TOOL_FAULT: 3 });

export const MODE_LABELS = Object.freeze({
  artifact: '旧产物基线 vs 当前产物',
  fault: '当前产物（干净）vs 当前产物 + 故障注入',
});

/** 从 report 里取与机器无关的环境事实（不落绝对路径，md 可原样贴 issue）。 */
export function extractEnvironment(report) {
  const env = (report && report.environment) || {};
  const checks = Array.isArray(report && report.checks) ? report.checks : [];
  const runtime = checks
    .map((check) => check && check.conditions && check.conditions.browserRuntime)
    .find((item) => item && (item.browser || item.protocolVersion)) ?? null;
  const artifact = env.artifact ?? null;
  return {
    host: { version: env.hostVersion ?? null, cliSource: env.hostCliSource ?? null },
    browser: {
      runtime: runtime && runtime.browser ? runtime.browser : null,
      protocolVersion: runtime && runtime.protocolVersion ? runtime.protocolVersion : null,
      source: env.browserSource ?? null,
    },
    node: env.node ?? null,
    platform: env.platform ?? null,
    arch: env.arch ?? null,
    timezone: env.timezone ?? null,
    suite: env.suite ?? (report && report.suite) ?? null,
    fixture: env.fixture ? { name: env.fixture.name ?? null, request: env.fixture.request ?? null, ok: env.fixture.ok ?? null } : null,
    artifact: artifact
      ? {
          name: artifact.name ?? null,
          version: artifact.version ?? null,
          fileName: artifact.fileName ?? null,
          sizeBytes: artifact.sizeBytes ?? null,
          sha256: artifact.sha256 ?? null,
        }
      : null,
  };
}

function environmentDrift(referenceEnv, candidateEnv) {
  const drift = [];
  const pairs = [
    ['host.version', referenceEnv.host.version, candidateEnv.host.version],
    ['browser.runtime', referenceEnv.browser.runtime, candidateEnv.browser.runtime],
    ['node', referenceEnv.node, candidateEnv.node],
    ['platform', referenceEnv.platform, candidateEnv.platform],
    ['suite', referenceEnv.suite, candidateEnv.suite],
    ['fixture.name', referenceEnv.fixture && referenceEnv.fixture.name, candidateEnv.fixture && candidateEnv.fixture.name],
  ];
  for (const [field, ref, cur] of pairs) {
    if (ref == null || cur == null ? ref !== cur : ref !== cur) drift.push({ field, reference: ref, candidate: cur });
  }
  return drift;
}

function sideSummary(side) {
  const report = side.report;
  return {
    role: side.role,
    label: side.label,
    runTag: side.runTag ?? (report && report.runTag) ?? null,
    artifact: side.artifact ?? (report && report.environment && report.environment.artifact) ?? null,
    reportVerdict: (report && report.verdict) ?? null,
    reportExitCode: (report && typeof report.exitCode === 'number') ? report.exitCode : null,
    childExitCode: typeof side.exitCode === 'number' ? side.exitCode : null,
    summary: (report && report.summary) ?? null,
    evidenceReport: side.evidenceReport ?? null,
    evidenceDir: side.evidenceDir ?? null,
    log: side.log ?? null,
    faults: side.faults ?? [],
  };
}

function collectCoverage(rows) {
  const risk = [];
  const missingInReference = [];
  const missingInCandidate = [];
  const blocked = [];
  const bothGreen = [];
  const bothRed = [];
  // #183 评审整改 F5：检查名没能归进任何已声明区域规则时，不静默按「自己一个区域」处理，
  // 而是记进 unclassifiedAreas 并由 buildDiffDocument 记一条 FAIL 问题（fail-closed）。
  const unclassifiedAreas = [];
  for (const row of rows) {
    if (row.reference.verdict === 'MISSING' && row.candidate.verdict === 'MISSING') continue;
    if (row.reference.verdict === 'MISSING') missingInReference.push(row.name);
    else if (row.candidate.verdict === 'MISSING') missingInCandidate.push(row.name);
    else if (row.reference.verdict === 'BLOCKED' || row.candidate.verdict === 'BLOCKED') blocked.push(row.name);
    if (row.classification === 'bothGreen') bothGreen.push(row.name);
    if (row.classification === 'bothRed') bothRed.push(row.name);
    if (row.areaRule === 'unclassified') unclassifiedAreas.push(row.name);
  }
  if (blocked.length > 0) risk.push('有 ' + blocked.length + ' 条检查被阻塞（不是产品判定，覆盖不完整）');
  if (missingInReference.length > 0) risk.push('对照侧有 ' + missingInReference.length + ' 条检查未跑到（旧套件/场景中断），这些检查没有对照证据');
  if (missingInCandidate.length > 0) risk.push('判定侧有 ' + missingInCandidate.length + ' 条检查未跑到（场景中断），这些检查没有判定证据');
  if (unclassifiedAreas.length > 0) risk.push('有 ' + unclassifiedAreas.length + ' 条检查名没有命中任何区域规则（报告无法归组，按测试方法缺陷处理）');
  return { missingInReference, missingInCandidate, blocked, bothGreen, bothRed, unclassifiedAreas, risk };
}

function decide(referenceReport, candidateReport, problems) {
  const toolProblem = problems.find((problem) => problem.severity === 'TOOL_FAULT');
  if (toolProblem) return { verdict: 'TOOL_FAULT', exitCode: DIFF_EXIT_CODES.TOOL_FAULT };
  const referenceBlocked = referenceReport && referenceReport.verdict === 'BLOCKED';
  const candidateBlocked = candidateReport && candidateReport.verdict === 'BLOCKED';
  if (referenceBlocked || candidateBlocked) return { verdict: 'BLOCKED', exitCode: DIFF_EXIT_CODES.BLOCKED };
  if (problems.some((problem) => problem.severity === 'BLOCKED')) return { verdict: 'BLOCKED', exitCode: DIFF_EXIT_CODES.BLOCKED };
  if (problems.some((problem) => problem.severity === 'FAIL')) return { verdict: 'FAIL', exitCode: DIFF_EXIT_CODES.FAIL };
  return { verdict: 'PASS', exitCode: DIFF_EXIT_CODES.PASS };
}

function makeReason({ verdict, mode, rows, problems, referenceReport, candidateReport, injectedRedChecks }) {
  if (verdict === 'TOOL_FAULT') {
    return '工具故障：差分工具链自身出错，不冒充产品判定。' + problems.map((problem) => problem.message).slice(0, 2).join('；');
  }
  if (verdict === 'BLOCKED') {
    const blocked = problems.find((problem) => problem.severity === 'BLOCKED');
    if (blocked) return '阻塞：' + blocked.message;
    const which = referenceReport && referenceReport.verdict === 'BLOCKED' ? '对照侧' : '判定侧';
    return '阻塞：' + which + '报告整体 BLOCKED（装配/环境未就绪），无法完成差分判定。';
  }
  if (verdict === 'FAIL') {
    const failed = problems.filter((problem) => problem.severity === 'FAIL');
    return '不通过：' + failed.map((problem) => problem.message).slice(0, 3).join('；');
  }
  if (mode === 'fault') {
    const injected = Array.isArray(injectedRedChecks) ? injectedRedChecks.length : 0;
    return (
      '注入检出：' + injected + ' 条期望变红的检查在注入侧变红（对照侧绿或条件性检查），' +
      '保持绿断言全部成立，且没有未声明的红。'
    );
  }
  const discriminating = rows.filter((row) => row.classification === 'discriminating').length;
  const bothGreen = rows.filter((row) => row.classification === 'bothGreen').length;
  return (
    '有区分力：' + discriminating + ' 条检查对照侧红、判定侧绿，清单内必须翻转的断言全部成立，且无回归。' +
    (bothGreen > 0 ? '另有 ' + bothGreen + ' 条检查两侧都绿（无证据力，不计入区分力）。' : '')
  );
}

/**
 * 构建 diff 文档。
 *
 * @param {object} input
 * @param {'artifact'|'fault'} input.mode
 * @param {string} input.suite
 * @param {string} input.fixture
 * @param {object} input.reference  {@link sideSummary} 的输入：{role,label,runTag,artifact,report,exitCode,evidenceReport,evidenceDir,log,faults}
 * @param {object} input.candidate
 * @param {object} input.expect     经过 validateExpect 的清单对象
 * @param {object[]} input.faults   注入器元数据（fault 模式）
 * @param {object|null} input.baselineRecord 命中的 baselines.json 记录
 * @param {object} input.evidence   证据位置（相对路径，便于贴 issue）
 * @param {object[]} input.toolProblems 运行前的工具故障问题
 */
export function buildDiffDocument(input) {
  const { mode, suite, fixture, reference, candidate, expect, faults, baselineRecord, evidence, toolProblems } = input;
  if (mode !== 'artifact' && mode !== 'fault') throw new Error('未知 diff 模式：' + mode);
  const referenceReport = reference.report;
  const candidateReport = candidate.report;
  const rows = buildRows(referenceReport, candidateReport);
  const statistics = summarizeRows(rows);
  const referenceEnvironment = extractEnvironment(referenceReport);
  const candidateEnvironment = extractEnvironment(candidateReport);
  const drift = environmentDrift(referenceEnvironment, candidateEnvironment);

  const problems = [];
  if (Array.isArray(toolProblems)) problems.push(...toolProblems);
  if (drift.length > 0) {
    problems.push({
      code: 'environment-mismatch',
      severity: 'BLOCKED',
      message:
        '两侧运行环境不一致（差分要求同一宿主/浏览器/套件/fixture）：' +
        drift.map((item) => item.field + '=' + JSON.stringify(item.reference) + ' vs ' + JSON.stringify(item.candidate)).join('；'),
      checks: [],
    });
  }
  const evaluation =
    mode === 'fault' ? evaluateFaultExpectations({ rows, expect }) : evaluateExpectations({ rows, expect });
  problems.push(...evaluation.problems);
  // fault 模式里 expectedRed 命中的检查按设计就是「对照侧绿 → 注入侧红」，
  // 它们会落在 regression 分类里；那是注入的证据，不是产品回归，汇总时必须排除。
  const expectedRedNames = new Set(mode === 'fault' ? (evaluation.expectedRedNames ?? []) : []);
  problems.push(...regressionProblems(rows.filter((row) => !expectedRedNames.has(row.name))));

  if (!expect.mustFlipRedOnBaseline || expect.mustFlipRedOnBaseline.length === 0) {
    problems.push({
      code: 'empty-expectations',
      severity: 'FAIL',
      message: '期望清单没有 mustFlipRedOnBaseline：无法证明任何区分力，不得判通过。',
      checks: [],
    });
  }

  // #183 评审整改 F5：检查名必须能归进 AREA_RULES 声明的区域规则；归不进去时
  // 报告会退化成「每条检查各一个区域」，覆盖统计看起来完整、实际没人能按区域读。
  // 这是测试命名/方法问题，fail-closed 记 FAIL（分型 test），不静默换桶。
  const unclassifiedAreaNames = rows.filter((row) => row.areaRule === 'unclassified').map((row) => row.name);
  if (unclassifiedAreaNames.length > 0) {
    problems.push({
      code: 'unclassified-check-areas',
      severity: 'FAIL',
      checks: unclassifiedAreaNames,
      message:
        '有 ' + unclassifiedAreaNames.length + ' 条检查名没有命中任何区域规则（见 harness/diff/classify.mjs 的 AREA_RULES）；' +
        '报告无法按区域归组，先补命名或补规则：' + unclassifiedAreaNames.slice(0, 3).join('、') + '…',
    });
  }

  if (referenceReport && referenceReport.verdict === 'BLOCKED') {
    problems.push({ code: 'reference-blocked', severity: 'BLOCKED', message: '对照侧报告整体 BLOCKED：无法证明断言在旧/故障场景下会红。', checks: [] });
  }
  if (candidateReport && candidateReport.verdict === 'BLOCKED') {
    problems.push({ code: 'candidate-blocked', severity: 'BLOCKED', message: '判定侧报告整体 BLOCKED：无法证明断言在旧/故障场景下会红。', checks: [] });
  }
  if (typeof reference.exitCode === 'number' && reference.exitCode === 3) {
    problems.push({ code: 'reference-tool-fault', severity: 'TOOL_FAULT', message: '对照侧子进程以工具故障退出（exit 3）：' + (reference.log ?? ''), checks: [] });
  }
  if (typeof candidate.exitCode === 'number' && candidate.exitCode === 3) {
    problems.push({ code: 'candidate-tool-fault', severity: 'TOOL_FAULT', message: '判定侧子进程以工具故障退出（exit 3）：' + (candidate.log ?? ''), checks: [] });
  }
  if (mode === 'artifact') {
    // 只把「对照侧本来是正常断言（PASS/FAIL）」的缺失算问题：
    // 对照侧本来 BLOCKED/N-A 的诊断性检查（例如「场景 3：设置页导航」只在导航失败时记录）
    // 在判定侧跑通后自然不存在，不能算判定侧漏跑。
    const missingCandidate = rows.filter(
      (row) =>
        row.classification === 'missingInCandidate' &&
        ['PASS', 'FAIL'].includes(normalizeVerdict(row.reference.verdict)),
    );
    if (missingCandidate.length > 0 && !(candidateReport && candidateReport.verdict === 'BLOCKED')) {
      problems.push({
        code: 'candidate-missing-checks',
        severity: 'FAIL',
        checks: missingCandidate.map((row) => row.name),
        message:
          '判定侧缺失 ' + missingCandidate.length + ' 条检查（当前产物应跑完整套件；缺检查不能算通过）：' +
          missingCandidate.slice(0, 3).map((row) => row.name).join('、') + '…',
      });
    }
    // 差分只证明「这些断言能区分旧/新」，不代表当前产物本身全绿：
    // 当前产物若还有未预期 FAIL（不在 mustFlip 里也一样），diff 不得判通过。
    const candidateFailures = (Array.isArray(candidateReport && candidateReport.checks) ? candidateReport.checks : []).filter(
      (check) => check && check.verdict === 'FAIL' && !check.expectedFailure,
    );
    if (candidateFailures.length > 0 && !(candidateReport && candidateReport.verdict === 'BLOCKED')) {
      problems.push({
        code: 'candidate-product-fail',
        severity: 'FAIL',
        checks: candidateFailures.map((check) => check.name),
        message:
          '当前产物自身还有 ' + candidateFailures.length + ' 条未预期 FAIL（差分成立 ≠ 当前全绿）：' +
          candidateFailures.slice(0, 3).map((check) => check.name).join('、') + '…',
      });
    }
  }

  if (mode === 'fault') {
    // 注入影响面必须与注入器声明一致：判定侧出现清单里没有的红，说明注入波及了别的断言，
    // 清单需要更新或注入需要收窄；不能因为「主要断言红了」就放过。
    const candidateFailures = (Array.isArray(candidateReport && candidateReport.checks) ? candidateReport.checks : []).filter(
      (check) => check && check.verdict === 'FAIL' && !check.expectedFailure,
    );
    const unexpected = candidateFailures.filter((check) => !expectedRedNames.has(check.name));
    if (unexpected.length > 0 && !(candidateReport && candidateReport.verdict === 'BLOCKED')) {
      problems.push({
        code: 'unexpected-fault-influence',
        severity: 'FAIL',
        checks: unexpected.map((check) => check.name),
        message:
          '注入产生了未声明的红 ' + unexpected.length + ' 条（影响面大于注入器声明）：' +
          unexpected.slice(0, 3).map((check) => check.name).join('、') +
          '…；要么更新注入器 expectedRed，要么收窄注入。',
      });
    }
  }

  const decision = decide(referenceReport, candidateReport, problems);
  const coverage = collectCoverage(rows);
  const reason = makeReason({
    verdict: decision.verdict,
    mode,
    rows,
    problems,
    referenceReport,
    candidateReport,
    injectedRedChecks: evaluation.expectedRedNames,
  });

  return {
    schemaVersion: DIFF_SCHEMA_VERSION,
    tool: 'scripts/real/diff.mjs',
    mode,
    modeLabel: MODE_LABELS[mode],
    suite,
    fixture,
    verdict: decision.verdict,
    exitCode: decision.exitCode,
    reason,
    reference: sideSummary(reference),
    candidate: sideSummary(candidate),
    environment: { reference: referenceEnvironment, candidate: candidateEnvironment, drift },
    statistics,
    checks: rows,
    expectations: {
      source: evaluation.source,
      suite: evaluation.suite,
      baseline: evaluation.baseline,
      mustFlipRedOnBaseline: evaluation.mustFlipRedOnBaseline,
      mustStayGreen: evaluation.mustStayGreen,
      notes: evaluation.notes,
      evaluation: evaluation.entries,
      injectedRedChecks: mode === 'fault' ? [...(evaluation.expectedRedNames ?? [])] : [],
    },
    problems,
    coverage,
    faults: mode === 'fault' ? (faults ?? []).map((fault) => ({ ...fault })) : [],
    baselineRecord: baselineRecord ?? null,
    evidence: evidence ?? null,
    classificationLabels: Object.fromEntries(Object.entries(CLASSIFICATIONS).map(([kind, meta]) => [kind, meta.label])),
  };
}

export { classificationMeta };
