/**
 * diff.md 确定性渲染（票 #191 交付物 A）。
 *
 * 唯一输入是 diff.json 的对象（见 model.mjs）；本模块不读文件、不读时钟、不做判定，
 * 只做格式化。同样的 diff.json 两次渲染必须字节相同（selftest 钉住）。
 */

import { classificationMeta, verdictLabel } from './classify.mjs';
import { MODE_LABELS } from './model.mjs';

const MISSING_MARKER = '—';

const VERDICT_LABELS = Object.freeze({
  PASS: '通过',
  FAIL: '不通过',
  BLOCKED: '阻塞',
  TOOL_FAULT: '工具故障',
});

const PROBLEM_SEVERITY_LABELS = Object.freeze({
  FAIL: '不通过',
  BLOCKED: '阻塞',
  TOOL_FAULT: '工具故障',
});

function cell(value, fallback = MISSING_MARKER) {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value)
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\|/g, '\\|')
    .trim() || fallback;
}

function shortSha(sha) {
  if (!sha || typeof sha !== 'string') return MISSING_MARKER;
  return sha.length > 20 ? sha.slice(0, 20) + '…' : sha;
}

function shortArtifact(artifact) {
  if (!artifact) return MISSING_MARKER;
  const name = artifact.name ?? '?';
  const version = artifact.version ?? '?';
  return name + '@' + version;
}

function formatVerdict(value) {
  const label = verdictLabel(value);
  return label;
}

function classifyLabel(kind) {
  return classificationMeta(kind).label;
}

function renderTable(headers, rows) {
  const lines = [];
  lines.push('| ' + headers.map((header) => cell(header)).join(' | ') + ' |');
  lines.push('| ' + headers.map(() => '---').join(' | ') + ' |');
  for (const row of rows) {
    lines.push('| ' + row.map((value) => cell(value)).join(' | ') + ' |');
  }
  return lines.join('\n');
}

function section(title, body) {
  return '## ' + title + '\n\n' + body.trim() + '\n';
}

function renderEnvironment(doc) {
  const rows = [
    ['reference', doc.reference, doc.environment.reference],
    ['candidate', doc.candidate, doc.environment.candidate],
  ].map(([role, side, env]) => {
    const roleLabel = role === 'reference' ? '对照（' + side.label + '）' : '判定（' + side.label + '）';
    return [
      roleLabel,
      shortArtifact(env.artifact),
      env.artifact ? env.artifact.fileName : MISSING_MARKER,
      env.artifact ? shortSha(env.artifact.sha256) : MISSING_MARKER,
      env.artifact && env.artifact.sizeBytes != null ? String(env.artifact.sizeBytes) : MISSING_MARKER,
      env.host.version ?? MISSING_MARKER,
      env.browser.runtime ?? MISSING_MARKER,
      side.runTag ?? MISSING_MARKER,
      (side.reportVerdict ?? MISSING_MARKER) + (typeof side.reportExitCode === 'number' ? '（exit ' + side.reportExitCode + '）' : ''),
    ];
  });
  const table = renderTable(
    ['角色', '产物', '文件名', 'sha256', '大小(字节)', '宿主版本', '浏览器运行时', 'runTag', '子报告判定'],
    rows,
  );
  const extra = [];
  extra.push('- 模式：' + (MODE_LABELS[doc.mode] ?? doc.mode));
  extra.push('- 套件：' + cell(doc.suite) + '；fixture：' + cell(doc.fixture));
  if (doc.environment.reference.node) extra.push('- Node：' + cell(doc.environment.reference.node) + '；平台：' + cell(doc.environment.reference.platform));
  if (doc.environment.drift.length > 0) {
    extra.push('- **环境漂移：**' + doc.environment.drift.map((item) => item.field).join('、') + '（见问题清单）');
  }
  if (doc.baselineRecord) {
    const record = doc.baselineRecord;
    extra.push(
      '- 基线登记（scripts/real/diffs/baselines.json）：' + cell(record.name) + '，来源 ' + cell(record.source) +
        (record.commit ? '，commit ' + cell(record.commit) : ''),
    );
  }
  return table + '\n\n' + extra.join('\n');
}

function renderStatistics(doc) {
  const stats = doc.statistics;
  const rows = [
    ['检查总数', String(stats.total), '两侧报告合并后的检查名数量'],
    ['翻转', String(stats.flipped), 'verdict 发生变化的检查数'],
    ['有区分力', String(stats.byClassification.discriminating ?? 0), '对照侧红 → 判定侧绿'],
    ['回归', String(stats.byClassification.regression ?? 0), '对照侧绿 → 判定侧红（变差）'],
    ['无区分力', String(stats.byClassification.bothGreen ?? 0), '两侧都绿：无证据力'],
    ['两侧都红', String(stats.byClassification.bothRed ?? 0), '未翻转，不能作为修复证据'],
    ['阻塞', String((stats.byClassification.bothBlocked ?? 0) + (stats.byClassification.baselineBlocked ?? 0) + (stats.byClassification.candidateBlocked ?? 0)), '对照/判定侧未跑出结果'],
    ['缺失', String((stats.byClassification.missingInBaseline ?? 0) + (stats.byClassification.missingInCandidate ?? 0) + (stats.byClassification.missingBoth ?? 0)), '某一侧没跑到该检查'],
    ['N-A', String((stats.byClassification.bothNa ?? 0) + (stats.byClassification.naMismatch ?? 0)), '不适用'],
  ];
  return renderTable(['指标', '数量', '含义'], rows) + '\n\n' +
    '证据力汇总：翻转 ' + stats.evidence.flips + ' / 无证据力 ' + stats.evidence.none + ' / 回归 ' + stats.evidence.regression + ' / 未知 ' + stats.evidence.unknown + '。';
}

function renderExpectations(doc) {
  const expectations = doc.expectations;
  const faultMode = doc.mode === 'fault';
  const lines = ['- 清单来源：' + cell(expectations.source) + '（suite=' + cell(expectations.suite) + '）'];
  if (faultMode && Array.isArray(doc.faults) && doc.faults.length > 0) {
    lines.push('- 本次注入：' + doc.faults.map((fault) => '`' + fault.id + '`').join('、'));
  }
  if (expectations.baseline) {
    const baseline = expectations.baseline;
    lines.push(
      '- 清单声明基线：' + cell(baseline.artifactFile ?? baseline.name ?? '未写明') +
        (baseline.sha256 ? '，sha256 ' + shortSha(baseline.sha256) : '') +
        (baseline.note ? '；' + cell(baseline.note) : ''),
    );
  }
  const mustFlipRows = expectations.evaluation.mustFlip.map((entry, index) => [
    String(index + 1),
    entry.pattern,
    String(entry.matched.length),
    entry.status === 'ok' ? '满足' : entry.status,
    entry.detail ?? '',
  ]);
  const parts = [lines.join('\n')];
  parts.push(
    (faultMode
      ? '**期望变红（对照侧绿 → 注入侧红；条件性检查只看注入侧是否出现）**'
      : '**必须翻转（对照侧红 → 判定侧绿）**') +
      '\n\n' +
      renderTable(['#', '清单项', '命中', '结果', '说明'], mustFlipRows),
  );
  if (expectations.evaluation.mustStayGreen.length > 0) {
    const stayRows = expectations.evaluation.mustStayGreen.map((entry, index) => [
      String(index + 1),
      entry.pattern,
      String(entry.matched.length),
      entry.status === 'ok' ? '满足' : entry.status,
      entry.detail ?? '',
    ]);
    parts.push(
      (faultMode ? '**必须保持绿（对照侧与注入侧都绿）**' : '**必须保持绿**') +
        '\n\n' +
        renderTable(['#', '清单项', '命中', '结果', '说明'], stayRows),
    );
  }
  if (expectations.notes.length > 0) {
    parts.push('清单备注：\n' + expectations.notes.map((note) => '- ' + note).join('\n'));
  }
  return parts.join('\n\n');
}

function checkReason(row) {
  if (row.reference.verdict === 'FAIL') return row.reference.reason;
  if (row.candidate.verdict === 'FAIL') return row.candidate.reason;
  if (row.reference.verdict === 'BLOCKED') return row.reference.reason;
  return null;
}

function renderChecks(doc) {
  const groups = [];
  const index = new Map();
  for (const row of doc.checks) {
    if (!index.has(row.area)) {
      index.set(row.area, { area: row.area, rows: [] });
      groups.push(index.get(row.area));
    }
    index.get(row.area).rows.push(row);
  }
  const parts = [];
  for (const group of groups) {
    const rows = group.rows.map((row, indexInGroup) => [
      String(indexInGroup + 1),
      row.name,
      formatVerdict(row.reference.verdict),
      formatVerdict(row.candidate.verdict),
      row.flipped ? '是' : '',
      classifyLabel(row.classification) + (checkReason(row) ? '：' + checkReason(row) : ''),
    ]);
    parts.push('### ' + group.area + '\n\n' + renderTable(['#', '检查', '对照侧', '判定侧', '翻转', '分类（含原因）'], rows));
  }
  return parts.join('\n\n');
}

function renderProblems(doc) {
  if (doc.problems.length === 0) return '无。';
  const order = ['TOOL_FAULT', 'BLOCKED', 'FAIL'];
  const lines = [];
  for (const severity of order) {
    const problems = doc.problems.filter((problem) => problem.severity === severity);
    if (problems.length === 0) continue;
    lines.push('**' + (PROBLEM_SEVERITY_LABELS[severity] ?? severity) + '**');
    for (const problem of problems) {
      lines.push('- `' + problem.code + '`：' + problem.message);
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

function renderCoverage(doc) {
  const coverage = doc.coverage;
  const lines = [];
  if (coverage.risk.length === 0) {
    lines.push('- 两侧检查覆盖一致，没有阻塞/缺失。');
  } else {
    for (const risk of coverage.risk) lines.push('- ' + risk);
  }
  if (coverage.bothGreen.length > 0) {
    lines.push('- 无区分力检查 ' + coverage.bothGreen.length + ' 条：' + coverage.bothGreen.slice(0, 8).join('、') + (coverage.bothGreen.length > 8 ? '…' : '') + '（两侧都绿，不能算证据）');
  }
  if (coverage.bothRed.length > 0) {
    lines.push('- 两侧都红检查 ' + coverage.bothRed.length + ' 条：' + coverage.bothRed.slice(0, 8).join('、') + (coverage.bothRed.length > 8 ? '…' : '') + '（未翻转）');
  }
  if (coverage.blocked.length > 0) {
    lines.push('- 阻塞检查：' + coverage.blocked.slice(0, 10).join('、') + (coverage.blocked.length > 10 ? '…' : ''));
  }
  if (coverage.missingInReference.length > 0) {
    lines.push('- 对照侧缺失：' + coverage.missingInReference.slice(0, 10).join('、') + (coverage.missingInReference.length > 10 ? '…' : ''));
  }
  if (coverage.missingInCandidate.length > 0) {
    lines.push('- 判定侧缺失：' + coverage.missingInCandidate.slice(0, 10).join('、') + (coverage.missingInCandidate.length > 10 ? '…' : ''));
  }
  return lines.join('\n');
}

function renderFaults(doc) {
  if (doc.mode !== 'fault') return '无（artifact 模式比较两份产物，不注入故障）。';
  if (doc.faults.length === 0) return '（无注入器元数据）';
  return renderTable(
    ['注入器', '名称', '期望变红检查'],
    doc.faults.map((fault) => [fault.id, fault.title, (fault.expectedRed ?? []).join('；')]),
  ) + '\n\n' +
    doc.faults.map((fault) => '- `' + fault.id + '`：' + (fault.description ?? '')).join('\n');
}

function renderEvidence(doc) {
  if (!doc.evidence) return '（未记录）';
  const lines = [];
  if (doc.evidence.dir) lines.push('- 证据目录：`' + doc.evidence.dir + '`');
  if (doc.evidence.reference) {
    const ref = doc.evidence.reference;
    lines.push('- 对照侧报告：`' + (ref.report ?? '—') + '`；子进程日志：`' + (ref.log ?? '—') + '`');
  }
  if (doc.evidence.candidate) {
    const cur = doc.evidence.candidate;
    lines.push('- 判定侧报告：`' + (cur.report ?? '—') + '`；子进程日志：`' + (cur.log ?? '—') + '`');
  }
  if (doc.evidence.diffJson) lines.push('- 事实源：`' + doc.evidence.diffJson + '`');
  if (doc.evidence.diffMarkdown) lines.push('- 本文件：`' + doc.evidence.diffMarkdown + '`');
  return lines.join('\n');
}

export function renderDiffMarkdown(doc) {
  const verdictLabelText = VERDICT_LABELS[doc.verdict] ?? doc.verdict;
  const lines = [];
  lines.push('# 差分判定：' + cell(doc.suite) + '（' + (MODE_LABELS[doc.mode] ?? doc.mode) + '）');
  lines.push('');
  lines.push(
    '> 由 `diff.json` 确定性渲染，判定以 `diff.json` 为唯一事实源；本文件可直接贴 issue。',
  );
  lines.push('');
  lines.push('## 结论');
  lines.push('');
  lines.push('**' + verdictLabelText + '（' + doc.verdict + '，exitCode=' + doc.exitCode + '）** — ' + doc.reason);
  lines.push('');
  if (doc.mode === 'fault') {
    const injected = Array.isArray(doc.expectations.injectedRedChecks) ? doc.expectations.injectedRedChecks.length : 0;
    lines.push(
      '检查 ' + doc.statistics.total + ' 条：注入侧检出 ' + injected +
        ' 条（expectedRed 命中变红）；未被本次注入影响 ' + Math.max(0, doc.statistics.total - injected) +
        ' 条；问题 ' + doc.problems.length + ' 条。',
    );
    lines.push('');
    lines.push(
      '> fault 模式的证据力只来自 expectedRed 命中的「干净侧绿 → 注入侧红」；' +
        '未被注入影响的检查保持绿是正常的，不构成区分力；未声明却变红的检查会单列为问题。',
    );
  } else {
    lines.push(
      '检查 ' + doc.statistics.total + ' 条：翻转 ' + doc.statistics.flipped +
        '；有区分力 ' + (doc.statistics.byClassification.discriminating ?? 0) +
        '；回归 ' + (doc.statistics.byClassification.regression ?? 0) +
        '；无区分力 ' + (doc.statistics.byClassification.bothGreen ?? 0) +
        '；问题 ' + doc.problems.length + ' 条。',
    );
  }
  lines.push('');
  lines.push(section('环境', renderEnvironment(doc)));
  lines.push(section('差异统计', renderStatistics(doc)));
  lines.push(section('期望清单与判定', renderExpectations(doc)));
  lines.push(section('逐检查对照', renderChecks(doc)));
  lines.push(section('问题清单', renderProblems(doc)));
  lines.push(section('覆盖与风险', renderCoverage(doc)));
  lines.push(section('故障注入', renderFaults(doc)));
  lines.push(section('证据位置', renderEvidence(doc)));
  lines.push(section('判定规则', verdictRules(doc).join('\n')));
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '') + '\n';
}

function verdictRules(doc) {
  const rules = [
    doc.mode === 'fault'
      ? '- `PASS`（0）：清单内 expectedRed 全部在注入侧变红（对照侧绿，或条件性检查对照侧无记录）、expectedStayGreen 两侧绿、无未声明的红。'
      : '- `PASS`（0）：清单内 mustFlip 全部成立（对照侧红 → 判定侧绿）、mustStayGreen 两侧绿、无回归。',
    '- `FAIL`（1）：有 expectedRed/mustFlip 未成立（尤其两侧都绿 = 无区分力）、有回归、清单引用不存在的检查、或缺检查。',
    '- `BLOCKED`（2）：某一侧整体 BLOCKED、环境漂移、或期望项因对照侧阻塞/缺失而无法证明。',
    '- `TOOL_FAULT`（3）：子进程工具故障、报告缺失/损坏等差分工具链自身问题，不冒充产品判定。',
    doc.mode === 'fault'
      ? '- 注入的区分力来自「干净侧绿、注入侧红」；注入后仍绿/未被记录的检查不能算检出。'
      : '- 两侧都绿（bothGreen）的检查**永远不算通过或证据**；mustFlip 里出现即整体 FAIL。',
  ];
  return rules;
}

export { MISSING_MARKER, VERDICT_LABELS };
