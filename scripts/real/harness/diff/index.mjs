/**
 * 差分运行器编排（票 #191 交付物 A）。
 *
 * 两种模式：
 * - artifact（默认）：对照侧 = 旧产物基线，判定侧 = 当前产物；
 *   期望清单来自 scripts/real/diffs/<suite>.expect.json（纯数据）。
 * - fault（--fault）：对照侧 = 当前产物干净跑，判定侧 = 当前产物 + 故障注入；
 *   期望清单由注入器注册表派生（哪些检查必须变红）。
 *
 * 两侧都**子进程调用现成的 run.mjs**：同一套件、同一 fixture、同一判定/证据协议，
 * 各自独立证据子目录（不清上一轮证据）。本模块只读两份 report.json 做判定，
 * 不重新解释产品行为 —— 判定唯一事实源是 diff.json。
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

import { REPO_ROOT, inspectArtifact, parseArgs } from '../bindings.mjs';
import { HarnessError } from '../errors.mjs';
import { killTree } from '../proc.mjs';
import { makeRunTag } from '../evidence.mjs';
import { assertKnownFaultIds, faultMetadata, parseFaultIds } from '../fault/index.mjs';
import { DIFF_EXIT_CODES, buildDiffDocument, extractEnvironment, MODE_LABELS } from './model.mjs';
import { renderDiffMarkdown } from './render.mjs';
import { loadExpect, validateExpect } from './expect.mjs';
import {
  describeBaselineRecord,
  findBaselineRecord,
  loadBaselineRegistry,
  resolveBaselineArtifact,
  verifyBaselineRecord,
} from './baseline.mjs';

const RUN_SCRIPT = path.join(REPO_ROOT, 'scripts', 'real', 'run.mjs');
const DIFFS_DIR = path.join(REPO_ROOT, 'scripts', 'real', 'diffs');
const CHILD_TIMEOUT_MS = 30 * 60 * 1000;

const USAGE = [
  '用法: node scripts/real/diff.mjs [options]',
  '',
  '差分判定（#191）：同一套件/fixture/判定与证据协议分别跑对照侧与判定侧，',
  '读两份 report.json 生成 diff.json（唯一事实源）+ diff.md（确定性渲染、可贴 issue）。',
  '',
  '两种模式:',
  '  默认（artifact）    对照侧 = 旧产物基线，判定侧 = 当前产物；期望清单读 diffs/<suite>.expect.json',
  '  --fault <id[,id…]>  对照侧 = 当前产物干净跑，判定侧 = 当前产物 + 故障注入；',
  '                      期望清单由 harness/fault 注入器注册表派生（哪些检查必须变红）',
  '',
  '选项:',
  '  --baseline-artifact <path>  旧产物 .tgz（artifact 模式；或 DSH_REAL_BASELINE）',
  '  --baseline <name>           从 scripts/real/diffs/baselines.json 按登记名解析基线',
  '  --baseline-dir <dir>        基线缓存目录（或 DSH_REAL_BASELINE_DIR；登记表只记文件名/sha）',
  '  --artifact <path>           当前产物 .tgz（或 DSH_REAL_ARTIFACT；必填）',
  '  --suite <name>              套件，默认 boundary（artifact 模式需 diffs/<suite>.expect.json）',
  '  --fixture <name|path>       初始态配方，默认 templates（或 DSH_REAL_FIXTURE）',
  '  --evidence-dir <dir>        证据根目录（子报告在 <dir>/reference、<dir>/candidate；不清上一轮证据）',
  '  --expect <path>             artifact 模式期望清单（默认 scripts/real/diffs/<suite>.expect.json）',
  '  --fault <id[,id…]>          故障注入（fault 模式；id 见 scripts/real/harness/fault/injectors.mjs）',
  '  --keep                      保留子进程工作目录便于排查',
  '  --timeout-scale <x>         超时倍率（透传子进程）',
  '  --dsh-cli <path>            宿主 CLI（透传子进程，同 run.mjs）',
  '  --browser <path>            无头浏览器（透传子进程，同 run.mjs）',
  '  --help                      打印本帮助',
  '',
  '退出码: 0 通过 / 1 区分力问题或回归 / 2 阻塞（含用法错误）/ 3 工具故障。',
  '',
  '示例:',
  '  node scripts/real/diff.mjs --artifact <当前.tgz> --baseline-artifact <旧.tgz> --suite boundary --fixture templates',
  '  node scripts/real/diff.mjs --artifact <当前.tgz> --fault input-actions-missing',
].join('\n');

const VALUE_FLAGS = [
  'artifact',
  'baseline-artifact',
  'baseline',
  'baseline-dir',
  'suite',
  'fixture',
  'evidence-dir',
  'expect',
  'fault',
  'timeout-scale',
  'dsh-cli',
  'browser',
];
const KNOWN_FLAGS = new Set([...VALUE_FLAGS, 'keep', 'help']);

export function usage() {
  return USAGE;
}

/**
 * 解析 diff 参数；结构问题抛 HarnessError（CLI 层映射成退出码 2）。
 * @param {string[]} argv
 * @param {NodeJS.ProcessEnv} [env]
 */
export function parseDiffArgs(argv, env = process.env) {
  const args = parseArgs(argv);
  if (args.help) return { help: true };
  const unknown = Object.keys(args).filter((key) => key !== 'positional' && !KNOWN_FLAGS.has(key));
  if (unknown.length > 0) {
    throw new HarnessError('未知参数：--' + unknown.join('、--') + '（--help 查看用法）');
  }
  if (Array.isArray(args.positional) && args.positional.length > 0) {
    throw new HarnessError('不接受位置参数：' + args.positional.join(' ') + '（用 --artifact / --baseline-artifact 指定产物）');
  }
  for (const key of VALUE_FLAGS) {
    if (key in args && (args[key] === undefined || args[key] === '' || args[key] === true)) {
      throw new HarnessError('--' + key + ' 需要一个值（--help 查看用法）');
    }
  }
  const suite = args.suite ?? 'boundary';
  const fixture = args.fixture ?? env.DSH_REAL_FIXTURE ?? (suite === 'boundary' ? 'templates' : 'clean');
  const faults = parseFaultIds(args.fault ?? env.DSH_REAL_FAULT ?? '');
  if (faults.length > 0) {
    if (args['baseline-artifact'] || args.baseline || args['baseline-dir']) {
      throw new HarnessError('--fault（fault 模式）不使用旧产物基线参数：--baseline-artifact / --baseline / --baseline-dir 只在 artifact 模式有效');
    }
  }
  const timeoutScaleRaw = args['timeout-scale'] ?? env.DSH_REAL_TIMEOUT_SCALE ?? null;
  let timeoutScale = null;
  if (timeoutScaleRaw != null) {
    timeoutScale = Number(timeoutScaleRaw);
    if (!Number.isFinite(timeoutScale) || timeoutScale <= 0) {
      throw new HarnessError('--timeout-scale 需要正数：' + timeoutScaleRaw);
    }
  }
  return {
    help: false,
    mode: faults.length > 0 ? 'fault' : 'artifact',
    suite,
    fixture,
    faults,
    artifact: args.artifact ?? env.DSH_REAL_ARTIFACT ?? null,
    baselineArtifact: args['baseline-artifact'] ?? null,
    baselineName: args.baseline ?? null,
    baselineDir: args['baseline-dir'] ?? null,
    expectPath: args.expect ?? null,
    evidenceDir: args['evidence-dir'] ?? env.DSH_REAL_EVIDENCE_DIR ?? null,
    timeoutScale,
    dshCli: args['dsh-cli'] ?? null,
    browser: args.browser ?? null,
    keep: Boolean(args.keep) || env.DSH_REAL_KEEP === '1',
    env,
  };
}

/* ------------------------------------------------------------------------- */
/* 子进程与证据收集                                                           */
/* ------------------------------------------------------------------------- */

/* 正在跑的子进程（对照侧 / 判定侧两个 run.mjs）。CLI 异常退出时用 killTreeAll() 兜底回收。 */
const activeChildren = new Set();

function runNode(args, { env, timeoutMs }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: REPO_ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    activeChildren.add(child);
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const finish = (result) => {
      activeChildren.delete(child);
      resolve(result);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        killTree(child.pid);
      } catch {
        /* 退出流程继续 */
      }
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      finish({ status: null, stdout, stderr, timedOut, error: String(error && error.message ? error.message : error) });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      finish({ status: code, stdout, stderr, timedOut, error: null });
    });
  });
}

/**
 * 兜底杀掉仍在跑的子进程（正常情况下 runNode 已经等它们自己退出）。
 * 差分 CLI 的 finally 调用它，防止异常路径遗留 run.mjs 子进程。
 */
export function killTreeAll() {
  let killed = 0;
  for (const child of activeChildren) {
    if (!child || !child.pid) continue;
    try {
      killTree(child.pid);
      killed += 1;
    } catch {
      /* 已经退出 */
    }
  }
  activeChildren.clear();
  return killed;
}

function tail(text, max = 2000) {
  const value = String(text ?? '');
  return value.length > max ? '…' + value.slice(value.length - max) : value;
}

function listEvidenceRuns(root) {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
    .filter((dir) => fs.existsSync(path.join(dir, 'report.json')));
}

function pickNewRun(root, before, startedAt) {
  const runs = listEvidenceRuns(root)
    .filter((dir) => !before.has(dir))
    .map((dir) => ({ dir, mtime: fs.statSync(dir).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (runs.length > 0) return runs[0].dir;
  // 兜底：子进程可能复用同名目录（极端情况），取 mtime 不早于启动时间的最新目录。
  const fallback = listEvidenceRuns(root)
    .map((dir) => ({ dir, mtime: fs.statSync(dir).mtimeMs }))
    .filter((item) => item.mtime >= startedAt - 1000)
    .sort((a, b) => b.mtime - a.mtime);
  return fallback.length > 0 ? fallback[0].dir : null;
}

function validateChildReport(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return 'report.json 不是对象';
  if (report.schemaVersion !== 2) return 'report.json schemaVersion 不是 2（实际 ' + String(report.schemaVersion) + '）';
  if (typeof report.verdict !== 'string') return 'report.json 缺 verdict';
  if (!Array.isArray(report.checks)) return 'report.json checks 不是数组';
  return null;
}

async function runSide(side) {
  fs.mkdirSync(side.evidenceRoot, { recursive: true });
  const args = [
    RUN_SCRIPT,
    '--artifact',
    side.artifact.path,
    '--suite',
    side.suite,
    '--fixture',
    side.fixture,
    '--evidence-dir',
    side.evidenceRoot,
  ];
  if (side.timeoutScale != null) args.push('--timeout-scale', String(side.timeoutScale));
  if (side.dshCli) args.push('--dsh-cli', side.dshCli);
  if (side.browser) args.push('--browser', side.browser);
  if (side.keep) args.push('--keep');
  if (side.faults.length > 0) args.push('--fault', side.faults.join(','));
  const before = new Set(listEvidenceRuns(side.evidenceRoot));
  const startedAt = Date.now();
  const childEnv = { ...process.env, ...side.env, NO_COLOR: '1', FORCE_COLOR: '0' };
  const result = await runNode(args, { env: childEnv, timeoutMs: CHILD_TIMEOUT_MS });
  const logPath = path.join(side.evidenceRoot, side.role + '-subprocess.log');
  fs.writeFileSync(
    logPath,
    [
      '# role=' + side.role + ' label=' + side.label,
      '# command=node ' + args.map((arg) => (/\s/.test(arg) ? JSON.stringify(arg) : arg)).join(' '),
      '# exit=' + String(result.status) + ' timedOut=' + String(result.timedOut),
      '',
      '## stdout',
      result.stdout,
      '',
      '## stderr',
      result.stderr,
    ].join('\n'),
  );
  const runDir = pickNewRun(side.evidenceRoot, before, startedAt);
  let report = null;
  let reportPath = null;
  let reportError = null;
  if (runDir) {
    reportPath = path.join(runDir, 'report.json');
    try {
      report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch (error) {
      reportError = String(error && error.message ? error.message : error);
    }
  }
  const relative = (target) =>
    target ? path.relative(side.evidenceDir, target).split(path.sep).join('/') : null;
  return {
    role: side.role,
    label: side.label,
    artifact: side.artifact,
    faults: side.faults,
    exitCode: result.status,
    timedOut: result.timedOut,
    spawnError: result.error,
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr),
    runDir,
    report,
    reportPath,
    reportError,
    evidenceReport: relative(reportPath),
    evidenceDir: relative(runDir),
    log: relative(logPath),
  };
}

/** 子进程没产出可用报告 → 工具故障问题（不冒充产品判定）。 */
function sideToolProblems(side) {
  const problems = [];
  const code = side.role;
  if (side.timedOut) {
    problems.push({ code: code + '-timeout', severity: 'TOOL_FAULT', message: code + ' 侧子进程超时（' + CHILD_TIMEOUT_MS / 60000 + ' 分钟）', checks: [] });
  }
  if (side.spawnError) {
    problems.push({ code: code + '-spawn-error', severity: 'TOOL_FAULT', message: code + ' 侧子进程启动失败：' + side.spawnError, checks: [] });
  }
  if (!side.runDir) {
    problems.push({ code: code + '-missing-evidence', severity: 'TOOL_FAULT', message: code + ' 侧没有产出证据目录（子进程 stderr：' + (side.stderrTail || '—') + '）', checks: [] });
  } else if (!side.report) {
    problems.push({
      code: code + '-missing-report',
      severity: 'TOOL_FAULT',
      message: code + ' 侧 report.json 读不到/解析失败：' + (side.reportError ?? '未知') + '（子进程 stderr：' + (side.stderrTail || '—') + '）',
      checks: [],
    });
  } else {
    const invalid = validateChildReport(side.report);
    if (invalid) {
      problems.push({ code: code + '-invalid-report', severity: 'TOOL_FAULT', message: code + ' 侧报告无效：' + invalid, checks: [] });
    }
  }
  if (typeof side.exitCode === 'number' && side.exitCode === 3) {
    problems.push({ code: code + '-tool-fault', severity: 'TOOL_FAULT', message: code + ' 侧子进程以工具故障退出（exit 3）：' + (side.stderrTail || '—'), checks: [] });
  }
  return problems;
}

/* ------------------------------------------------------------------------- */
/* 期望清单                                                                    */
/* ------------------------------------------------------------------------- */

function unique(items) {
  return [...new Set(items)];
}

/** fault 模式：由注入器注册表派生 mustFlip/mustStayGreen（不读磁盘清单）。 */
export function deriveFaultExpect({ suite, faults }) {
  const mustFlip = unique(faults.flatMap((fault) => fault.expectedRed ?? []));
  const mustStayGreen = unique(faults.flatMap((fault) => fault.expectedStayGreen ?? []));
  return validateExpect(
    {
      suite,
      mustFlipRedOnBaseline: mustFlip,
      mustStayGreen,
      notes: [
        'fault 模式：对照侧 = 当前产物干净跑，判定侧 = 当前产物 + 故障注入。',
        'mustFlip 由注入器元数据 expectedRed 派生：注入侧必须变红；对照侧若记录到该检查必须绿（常驻断言），' +
          '条件性检查（只在失败时记录，如「场景 N：…等待观测条件超时」）对照侧无记录属正常。',
        'mustStayGreen 由注入器元数据 expectedStayGreen 派生：对照侧与注入侧都必须绿（注入不得污染无关断言）。',
      ],
    },
    '注入器注册表派生清单',
  );
}

/* ------------------------------------------------------------------------- */
/* 主流程                                                                      */
/* ------------------------------------------------------------------------- */

export async function runDiff(options) {
  const args = options ?? parseDiffArgs(process.argv.slice(2));
  if (args.help) return { help: true };
  const env = args.env ?? process.env;

  // 当前产物：run.mjs 同样从 --artifact / DSH_REAL_ARTIFACT 取，没有自动发现。
  if (!args.artifact) {
    throw new HarnessError('缺少当前产物：用 --artifact <当前.tgz>（或 DSH_REAL_ARTIFACT）。');
  }
  const currentArtifact = inspectArtifact(args.artifact);
  if (args.faults.length > 0) {
    assertKnownFaultIds(args.faults);
  }

  let baselineArtifact = null;
  let baselineRecord = null;
  let expectList;
  if (args.mode === 'artifact') {
    // 先读期望清单：它的 baseline 声明（artifactFile/sha256）也是解析基线缓存的依据之一。
    expectList = args.expectPath
      ? loadExpect(args.expectPath)
      : loadExpect(path.join(DIFFS_DIR, args.suite + '.expect.json'));
    if (expectList.suite !== args.suite) {
      throw new HarnessError(
        '期望清单 suite（' + expectList.suite + '）与 --suite（' + args.suite + '）不一致：' + (expectList.source ?? ''),
      );
    }
    const resolved = resolveBaselineArtifact({
      arg: args.baselineArtifact,
      name: args.baselineName,
      env,
      expect: expectList,
      baselineDir: args.baselineDir,
    });
    baselineArtifact = inspectArtifact(resolved.path);
    let registry = null;
    try {
      registry = loadBaselineRegistry();
    } catch (error) {
      if (!(error instanceof HarnessError)) throw error;
      // 登记表缺失/损坏不阻塞显式路径：只失去 sha 校验与来源说明。
      registry = { schemaVersion: 1, baselines: [], source: null };
    }
    baselineRecord =
      resolved.record ?? findBaselineRecord(registry, { sha256: baselineArtifact.sha256, fileName: baselineArtifact.fileName });
    if (baselineRecord) {
      const verification = verifyBaselineRecord(baselineRecord, baselineArtifact);
      if (!verification.ok) {
        throw new HarnessError(
          '旧产物与 baselines.json 登记不一致：' + verification.problems.join('；') +
            '。如果确实要换基线，先更新登记表（sha256/来源说明），不要带着不确定的基线跑差分。',
        );
      }
    }
  } else {
    expectList = deriveFaultExpect({ suite: args.suite, faults: faultMetadata(args.faults) });
  }

  const evidenceDir = args.evidenceDir
    ? path.resolve(args.evidenceDir)
    : path.join(REPO_ROOT, '.tmp-real', makeRunTag('diff-' + args.suite));
  fs.mkdirSync(evidenceDir, { recursive: true });

  const faultMeta = args.mode === 'fault' ? faultMetadata(args.faults) : [];
  const common = {
    suite: args.suite,
    fixture: args.fixture,
    timeoutScale: args.timeoutScale,
    dshCli: args.dshCli,
    browser: args.browser,
    keep: args.keep,
    env,
    evidenceDir,
  };
  const referenceSide =
    args.mode === 'artifact'
      ? { ...common, role: 'reference', label: '旧产物基线', artifact: baselineArtifact, faults: [], evidenceRoot: path.join(evidenceDir, 'reference') }
      : { ...common, role: 'reference', label: '当前产物（干净）', artifact: currentArtifact, faults: [], evidenceRoot: path.join(evidenceDir, 'reference') };
  const candidateSide = {
    ...common,
    role: 'candidate',
    label: args.mode === 'artifact' ? '当前产物' : '当前产物 + 故障注入',
    artifact: currentArtifact,
    faults: args.faults,
    evidenceRoot: path.join(evidenceDir, 'candidate'),
  };

  const reference = await runSide(referenceSide);
  const candidate = await runSide(candidateSide);

  const toolProblems = [...sideToolProblems(reference), ...sideToolProblems(candidate)];
  const referenceReport = reference.report ?? emptyReport({ ...reference, suite: args.suite, artifact: baselineArtifact ?? currentArtifact });
  const candidateReport = candidate.report ?? emptyReport({ ...candidate, suite: args.suite, artifact: currentArtifact });

  const doc = buildDiffDocument({
    mode: args.mode,
    suite: args.suite,
    fixture: args.fixture,
    reference: {
      role: 'reference',
      label: reference.label,
      runTag: referenceReport.runTag ?? null,
      artifact: baselineArtifact ?? currentArtifact,
      report: referenceReport,
      exitCode: reference.exitCode,
      evidenceReport: reference.evidenceReport,
      evidenceDir: reference.evidenceDir,
      log: reference.log,
      faults: [],
    },
    candidate: {
      role: 'candidate',
      label: candidate.label,
      runTag: candidateReport.runTag ?? null,
      artifact: currentArtifact,
      report: candidateReport,
      exitCode: candidate.exitCode,
      evidenceReport: candidate.evidenceReport,
      evidenceDir: candidate.evidenceDir,
      log: candidate.log,
      faults: faultMeta,
    },
    expect: expectList,
    faults: faultMeta,
    baselineRecord: describeBaselineRecord(baselineRecord),
    evidence: {
      dir: relativeToRoot(evidenceDir),
      diffJson: 'diff.json',
      diffMarkdown: 'diff.md',
      reference: { report: reference.evidenceReport, log: reference.log },
      candidate: { report: candidate.evidenceReport, log: candidate.log },
    },
    toolProblems,
  });

  const diffJsonPath = path.join(evidenceDir, 'diff.json');
  const diffMarkdownPath = path.join(evidenceDir, 'diff.md');
  fs.writeFileSync(diffJsonPath, JSON.stringify(doc, null, 2) + '\n');
  fs.writeFileSync(diffMarkdownPath, renderDiffMarkdown(doc));

  return {
    exitCode: doc.exitCode,
    doc,
    paths: {
      evidenceDir,
      diffJson: diffJsonPath,
      diffMarkdown: diffMarkdownPath,
      referenceReport: reference.reportPath,
      candidateReport: candidate.reportPath,
    },
    sides: { reference, candidate },
  };
}

function emptyReport(side) {
  return {
    schemaVersion: 2,
    runTag: null,
    suite: side.suite,
    verdict: 'BLOCKED',
    exitCode: 2,
    environment: { artifact: side.artifact ?? null, suite: side.suite },
    summary: { total: 0, PASS: 0, FAIL: 0, BLOCKED: 0, 'N-A': 0 },
    checks: [],
  };
}

function relativeToRoot(target) {
  const relative = path.relative(REPO_ROOT, target);
  return relative === '' ? '.' : relative.split(path.sep).join('/');
}

/* ------------------------------------------------------------------------- */
/* 终端摘要                                                                    */
/* ------------------------------------------------------------------------- */

function shortArtifact(artifact) {
  if (!artifact) return '—';
  return (artifact.name ?? '?') + '@' + (artifact.version ?? '?');
}

function shaOrDash(artifact) {
  return artifact && artifact.sha256 ? artifact.sha256 : '—';
}

export function printDiffSummary(result) {
  const doc = result.doc;
  const stats = doc.statistics;
  const classification = stats.byClassification;
  const blocked =
    (classification.bothBlocked ?? 0) + (classification.baselineBlocked ?? 0) + (classification.candidateBlocked ?? 0);
  const missing =
    (classification.missingInBaseline ?? 0) + (classification.missingInCandidate ?? 0) + (classification.missingBoth ?? 0);
  const mustFlip = doc.expectations.evaluation.mustFlip;
  const mustStay = doc.expectations.evaluation.mustStayGreen;
  console.log('[diff] mode=' + doc.mode + '（' + MODE_LABELS[doc.mode] + '）  suite=' + doc.suite + '  fixture=' + doc.fixture);
  console.log('[diff] 对照 ' + doc.reference.label + '：' + shortArtifact(doc.reference.artifact) + '  sha256=' + shaOrDash(doc.reference.artifact) +
    '  报告判定=' + (doc.reference.reportVerdict ?? '—') + '（exit ' + String(doc.reference.childExitCode ?? '—') + '）');
  console.log('[diff] 判定 ' + doc.candidate.label + '：' + shortArtifact(doc.candidate.artifact) + '  sha256=' + shaOrDash(doc.candidate.artifact) +
    '  报告判定=' + (doc.candidate.reportVerdict ?? '—') + '（exit ' + String(doc.candidate.childExitCode ?? '—') + '）');
  if (doc.mode === 'fault') {
    console.log('[diff] 故障注入 ' + doc.faults.map((fault) => fault.id).join(', '));
  }
  console.log(
    '[diff] 检查 ' + stats.total + ' 条：翻转 ' + stats.flipped +
      ' / 有区分力 ' + (classification.discriminating ?? 0) +
      ' / 无区分力 ' + (classification.bothGreen ?? 0) +
      ' / 回归 ' + (classification.regression ?? 0) +
      ' / 两侧都红 ' + (classification.bothRed ?? 0) +
      ' / 阻塞 ' + blocked + ' / 缺失 ' + missing,
  );
  console.log(
    '[diff] 期望：mustFlip ' + mustFlip.filter((entry) => entry.status === 'ok').length + '/' + mustFlip.length + ' 满足；' +
      'mustStayGreen ' + mustStay.filter((entry) => entry.status === 'ok').length + '/' + mustStay.length + ' 保持绿；' +
      '问题 ' + doc.problems.length + ' 条',
  );
  console.log('[diff] 结论：' + doc.verdict + '（exitCode=' + doc.exitCode + '）— ' + doc.reason);
  for (const problem of doc.problems) {
    console.log('  [' + problem.severity + '] ' + problem.code + '：' + problem.message);
  }
  console.log('[diff] 事实源: ' + result.paths.diffJson);
  console.log('[diff] 可贴 issue: ' + result.paths.diffMarkdown);
  if (result.sides.reference.log) console.log('[diff] 对照侧子进程日志: ' + result.sides.reference.log);
  if (result.sides.candidate.log) console.log('[diff] 判定侧子进程日志: ' + result.sides.candidate.log);
}

export { DIFF_EXIT_CODES, extractEnvironment };
