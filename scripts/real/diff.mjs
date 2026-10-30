/**
 * 差分运行器 CLI（票 #191 交付物 A）。
 *
 * 主入口仍是 scripts/real/run.mjs；这里是并排跑两次的差分命令：
 * - 默认 artifact 模式：旧产物基线（对照）vs 当前产物（判定），期望清单 scripts/real/diffs/<suite>.expect.json；
 * - --fault 模式：当前产物干净跑（对照）vs 当前产物 + 故障注入（判定），期望由注入器注册表派生。
 *
 * 退出码：0 通过 / 1 区分力问题或回归 / 2 阻塞（含用法错误） / 3 工具故障。
 * 工具故障不冒充产品判定：子进程崩溃、报告缺失、超时都记 TOOL_FAULT。
 *
 * 差分命令本身也按 #189 报告协议留一份 report.json/report.md（判定/退出码与 diff 结论一致），
 * 与 diff.json（差分事实源）/ diff.md（由 diff.json 确定性渲染）放在同一个证据根目录。
 */

import { HarnessError } from './harness/errors.mjs';
import { Recorder, makeRunTag, writeReport } from './harness/evidence.mjs';
import { killTreeAll, parseDiffArgs, printDiffSummary, runDiff, usage } from './harness/diff/index.mjs';
import { DIFF_EXIT_CODES } from './harness/diff/model.mjs';

/**
 * 把差分结论写成标准报告（#189 协议），供下游工具按同一套 report.json 消费。
 * 判定与退出码必须与 diff.json 一致：PASS/FAIL/BLOCKED/TOOL_FAULT 各一条检查落地。
 *
 * @param {object} result {@link runDiff} 的返回值
 * @returns {string} report.json 路径
 */
function writeRunReport(result) {
  const { doc, paths } = result;
  const suite = 'diff-' + doc.mode + '-' + doc.suite;
  const recorder = new Recorder({ suite, runTag: makeRunTag(suite), evidenceDir: paths.evidenceDir });
  recorder.setEnvironment({
    tool: 'scripts/real/diff.mjs',
    mode: doc.mode,
    modeLabel: doc.modeLabel,
    suite: doc.suite,
    fixture: doc.fixture,
    verdict: doc.verdict,
    reference: {
      role: doc.reference.role,
      artifact: doc.reference.artifact,
      runTag: doc.reference.runTag,
      reportVerdict: doc.reference.reportVerdict,
      reportExitCode: doc.reference.reportExitCode,
    },
    candidate: {
      role: doc.candidate.role,
      artifact: doc.candidate.artifact,
      runTag: doc.candidate.runTag,
      reportVerdict: doc.candidate.reportVerdict,
      reportExitCode: doc.candidate.reportExitCode,
    },
    statistics: doc.statistics,
    expectationSource: doc.expectations.source,
    diffJson: paths.diffJson,
    diffMarkdown: paths.diffMarkdown,
    referenceReport: paths.referenceReport,
    candidateReport: paths.candidateReport,
  });
  recorder.setConditions({
    suite: doc.suite,
    fixture: doc.fixture,
    mode: doc.mode,
    referenceArtifact: doc.reference.artifact,
    candidateArtifact: doc.candidate.artifact,
    faults: doc.faults.map((fault) => fault.id),
  });
  const name = '差分判定：' + doc.mode + ' / ' + doc.suite;
  const observations = {
    reason: doc.reason,
    problems: doc.problems.map((problem) => ({ code: problem.code, severity: problem.severity, message: problem.message })),
    diffJson: paths.diffJson,
    diffMarkdown: paths.diffMarkdown,
  };
  if (doc.verdict === 'PASS') {
    recorder.pass(name, { detail: doc.reason, observations });
  } else if (doc.verdict === 'FAIL') {
    recorder.fail(name, {
      expected: '差分判定通过：清单内必须翻转的断言全部成立、保持绿全部成立、且无回归',
      observed: doc.reason,
      reason: doc.reason,
      failureType: 'product',
      failureTypeBasis: { source: 'diff', signal: 'expectation', note: '差分结论不满足期望清单/出现回归' },
      observations,
    });
  } else if (doc.verdict === 'BLOCKED') {
    recorder.blocked(name, doc.reason, { blockerKind: 'environment', observations });
  } else {
    recorder.toolFault(name, doc.reason, { observations });
  }
  return writeReport(recorder, paths.evidenceDir).reportPath;
}

async function main() {
  let options;
  try {
    options = parseDiffArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof HarnessError) {
      console.error('[diff][BLOCKED] ' + error.message);
      console.error('（--help 查看用法）');
      return DIFF_EXIT_CODES.BLOCKED;
    }
    throw error;
  }
  if (options.help) {
    console.log(usage());
    return 0;
  }
  try {
    const result = await runDiff(options);
    const reportPath = writeRunReport(result);
    printDiffSummary(result);
    console.log('[diff] 标准报告: ' + reportPath);
    return result.exitCode;
  } catch (error) {
    if (error instanceof HarnessError) {
      console.error('[diff][BLOCKED] ' + error.message);
      return DIFF_EXIT_CODES.BLOCKED;
    }
    console.error('[diff][TOOL-FAULT] ' + (error && error.stack ? error.stack : String(error)));
    return DIFF_EXIT_CODES.TOOL_FAULT;
  } finally {
    // 正常路径子进程已退出；异常路径（Ctrl+C / 抛出）兜底回收，避免遗留 run.mjs。
    killTreeAll();
  }
}

main()
  .then((code) => {
    // 显式列出四个退出码字面量：静态门禁 R2 要求入口能区分 0 与非 0（不是只赋一个变量）。
    if (code === 0) {
      process.exitCode = 0;
      return;
    }
    if (code === 1) {
      process.exitCode = 1;
      return;
    }
    if (code === 2) {
      process.exitCode = 2;
      return;
    }
    process.exitCode = 3;
  })
  .catch((error) => {
    console.error('[diff][TOOL-FAULT] ' + (error && error.stack ? error.stack : String(error)));
    process.exitCode = 3;
  });
