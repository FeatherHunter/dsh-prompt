/**
 * Markdown 摘要渲染（票 #189 / 规格 #183「证据与门禁层」）。
 *
 * 硬规则：`report.md` **只能由 report.json 生成**（writeReport 先序列化 JSON，
 * 再对同一份 JSON 解析结果调用本函数），因此 report.md 与 report.json 永远一致，
 * 同一份 JSON 两次生成字节相同。本模块是纯函数，不读时钟、不读环境。
 *
 * 报告内容按「可直接贴 issue」组织：环境与版本、判定统计、失败明细（含分型与六元组要点）、
 * 预期失败、阻塞、N/A、证据路径。任何缺失字段都显式写 MISSING_MARKER，不静默省略。
 */

import { BLOCKER_KINDS, FAILURE_TYPES, ReportError, summarize, VERDICTS } from './model.mjs';

/** 字段缺失时显式占位（报告里宁可写「未记录」也不省略）。 */
export const MISSING_MARKER = '（未记录）';

const VERDICT_LABELS = { PASS: '通过', FAIL: '失败', BLOCKED: '阻塞', 'N-A': '不适用' };
const FAILURE_LABELS = Object.fromEntries(FAILURE_TYPES.map((type) => [type.id, type.label]));
const BLOCKER_LABELS = Object.fromEntries(BLOCKER_KINDS.map((kind) => [kind.id, kind.label]));
const KNOWN_CONDITION_KEYS = new Set([
  'runTag',
  'suite',
  'artifact',
  'host',
  'browser',
  'browserRuntime',
  'fixture',
]);

function present(value) {
  return value === undefined || value === null || value === '' ? MISSING_MARKER : value;
}

function asText(value) {
  if (value === undefined || value === null || value === '') return MISSING_MARKER;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function oneLine(value, limit = 600) {
  const text = asText(value).replace(/\s*\n\s*/g, ' ⏎ ');
  return text.length > limit ? text.slice(0, limit) + '…' : text;
}

function cell(value) {
  return oneLine(value, 300).replace(/\|/g, '\\|');
}

function shortSha(sha256) {
  if (typeof sha256 !== 'string' || sha256 === '') return MISSING_MARKER;
  return sha256.length > 12 ? sha256.slice(0, 12) + '…' : sha256;
}

function formatTime(value) {
  if (value === undefined || value === null || value === '') return MISSING_MARKER;
  if (value instanceof Date) return value.toISOString();
  return asText(value);
}

function describeArtifact(artifact) {
  if (artifact === undefined || artifact === null || artifact === '') return MISSING_MARKER;
  if (typeof artifact === 'string') return artifact;
  if (typeof artifact !== 'object') return asText(artifact);
  const name = artifact.name ?? artifact.fileName ?? '(未命名产物)';
  const version = artifact.version ? '@' + artifact.version : '';
  const fileName = artifact.fileName && artifact.fileName !== name ? '（' + artifact.fileName + '）' : '';
  return String(name) + version + fileName;
}

function describeFixture(fixture) {
  if (fixture === undefined || fixture === null || fixture === '') return MISSING_MARKER;
  if (typeof fixture === 'string') return fixture;
  if (typeof fixture !== 'object') return asText(fixture);
  const name = fixture.name ?? '(未命名配方)';
  let state = '';
  if (fixture.ok === true) state = '起始态 ok';
  else if (fixture.ok === false) state = '起始态不符';
  return String(name) + (state ? '（' + state + '）' : '');
}

function formatConditions(conditions) {
  if (!conditions || typeof conditions !== 'object' || Array.isArray(conditions)) return MISSING_MARKER;
  const parts = [];
  if (conditions.suite !== undefined) parts.push('suite=' + oneLine(conditions.suite, 120));
  if (conditions.runTag !== undefined) parts.push('runTag=' + oneLine(conditions.runTag, 120));
  if (conditions.artifact !== undefined) parts.push('artifact=' + describeArtifact(conditions.artifact));
  if (conditions.host !== undefined) {
    const host = conditions.host;
    const text =
      host && typeof host === 'object' ? [host.cli, host.version].filter(Boolean).join('@') : host;
    parts.push('host=' + oneLine(text, 160));
  }
  if (conditions.browser !== undefined) parts.push('browser=' + oneLine(conditions.browser, 160));
  if (conditions.browserRuntime !== undefined) parts.push('browserRuntime=' + oneLine(conditions.browserRuntime, 160));
  if (conditions.fixture !== undefined) parts.push('fixture=' + describeFixture(conditions.fixture));
  for (const [key, value] of Object.entries(conditions)) {
    if (KNOWN_CONDITION_KEYS.has(key)) continue;
    parts.push(key + '=' + oneLine(value, 200));
  }
  return parts.length > 0 ? parts.join('；') : MISSING_MARKER;
}

function formatSteps(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return [MISSING_MARKER];
  return steps.map((step) => {
    if (typeof step === 'string') return step.replace(/\n/g, ' ⏎ ');
    return JSON.stringify(step);
  });
}

function formatFailureType(check) {
  const id = check.failureType;
  const label = FAILURE_LABELS[id] ?? '(未记录)';
  const basis = check.failureTypeBasis;
  const source = basis && basis.source === 'explicit' ? '显式' : basis && basis.source === 'inferred' ? '推断' : MISSING_MARKER;
  const signal = basis && basis.signal ? 'signal=' + basis.signal : 'signal=' + MISSING_MARKER;
  return label + '（' + asText(id) + '） · 依据来源：' + source + '（' + signal + '）';
}

function formatArtifacts(check) {
  const artifacts = Array.isArray(check.artifacts) ? check.artifacts : [];
  if (artifacts.length > 0) {
    return artifacts
      .map((artifact) => {
        const relative = artifact.relative ?? artifact.file ?? MISSING_MARKER;
        const kind = artifact.kind ?? 'artifact';
        const name = artifact.name ? '，' + artifact.name : '';
        const bytes = artifact.bytes !== undefined ? '，' + artifact.bytes + ' bytes' : '';
        return '- **产物**：`' + relative + '`（' + kind + name + bytes + '）';
      })
      .join('\n');
  }
  const why = typeof check.artifactsWhy === 'string' && check.artifactsWhy.trim() !== '' ? check.artifactsWhy : MISSING_MARKER;
  return '- **产物**：无（' + oneLine(why, 400) + '）';
}

function pushEvidenceTuple(lines, check, indentFirst = false) {
  const prefix = indentFirst ? '' : '';
  lines.push(prefix + '- **声称**：' + oneLine(check.claim, 600));
  lines.push(prefix + '- **条件**：' + formatConditions(check.conditions));
  const steps = formatSteps(check.steps);
  lines.push(prefix + '- **步骤**：');
  steps.forEach((step, index) => lines.push('  ' + (index + 1) + '. ' + step));
  lines.push(prefix + '- **原始观测**：');
  lines.push('```json');
  lines.push(JSON.stringify(check.observations ?? null, null, 2));
  lines.push('```');
  lines.push(prefix + '- **推断**：' + oneLine(check.inference, 800));
}

function renderFailure(W, index) {
  const lines = [];
  lines.push('### ' + (index + 1) + '. ' + asText(W.name));
  lines.push('');
  lines.push('- 分型：' + formatFailureType(W));
  if (W.failureTypeBasis && W.failureTypeBasis.note) {
    lines.push('- 分型依据：' + oneLine(W.failureTypeBasis.note, 800));
  }
  lines.push('- 期望：' + oneLine(W.expected === false ? MISSING_MARKER : W.expected, 600));
  lines.push('- 观测：' + oneLine(W.observed, 600));
  if (W.detail !== undefined && W.detail !== null && W.detail !== '') {
    lines.push('- 说明：' + oneLine(W.detail, 800));
  }
  if (W.flakySuspect === true) {
    lines.push('- 不可复现标记：flakySuspect=true（按测试假象处理）');
  }
  pushEvidenceTuple(lines, W);
  lines.push('- **判定**：FAIL（非预期失败，计入产品失败）');
  const artifacts = formatArtifacts(W);
  for (const line of artifacts.split('\n')) lines.push(line);
  return lines;
}

function renderExpectedFailure(W, index) {
  const lines = [];
  lines.push('### ' + (index + 1) + '. ' + asText(W.name));
  lines.push('');
  lines.push('- 分型：' + formatFailureType(W));
  if (W.failureTypeBasis && W.failureTypeBasis.note) {
    lines.push('- 分型依据：' + oneLine(W.failureTypeBasis.note, 800));
  }
  lines.push('- 期望：' + oneLine(W.expected === false ? MISSING_MARKER : W.expected, 600));
  lines.push('- 观测：' + oneLine(W.observed, 600));
  if (W.detail !== undefined && W.detail !== null && W.detail !== '') {
    lines.push('- 说明：' + oneLine(W.detail, 800));
  }
  pushEvidenceTuple(lines, W);
  lines.push('- **判定**：FAIL，但标记为预期失败（expectedFailure=true），不计入产品失败、退出码按 0 计');
  const artifacts = formatArtifacts(W);
  for (const line of artifacts.split('\n')) lines.push(line);
  return lines;
}

function renderBlocked(check, index) {
  const lines = [];
  const kind = check.blockerKind ?? 'environment';
  lines.push('### ' + (index + 1) + '. ' + asText(check.name));
  lines.push('');
  lines.push('- 阻塞类别：' + (BLOCKER_LABELS[kind] ?? '(未知)') + '（' + asText(kind) + '）');
  lines.push('- 原因：' + oneLine(check.reason, 800));
  if (check.claim) lines.push('- 声称：' + oneLine(check.claim, 400));
  lines.push('- **判定**：BLOCKED（检查未执行完成，不是产品缺陷）');
  return lines;
}

/**
 * 渲染 Markdown 摘要。输入必须是 report.json 解析后的对象（writeReport 保证）。
 * @param {object} report
 * @returns {string}
 */
export function renderMarkdown(report) {
  if (!report || typeof report !== 'object') {
    throw new ReportError('renderMarkdown 需要 report.json 解析后的对象');
  }
  const checks = Array.isArray(report.checks) ? report.checks : [];
  const summary = report.summary && typeof report.summary === 'object' ? report.summary : summarize(checks);
  const failures = Array.isArray(report.failures)
    ? report.failures
    : checks.filter((check) => check && check.verdict === 'FAIL' && check.expected !== true);
  const expectedFailures = Array.isArray(report.expectedFailures)
    ? report.expectedFailures
    : checks.filter((check) => check && check.verdict === 'FAIL' && check.expected === true);
  const blocked = checks.filter((check) => check && check.verdict === 'BLOCKED');
  const notApplicable = checks.filter((check) => check && check.verdict === 'N-A');
  const passed = checks.filter((check) => check && check.verdict === 'PASS');
  const environment = report.environment && typeof report.environment === 'object' ? report.environment : {};
  const meta = report.meta && typeof report.meta === 'object' ? report.meta : {};
  const artifact = meta.artifact ?? environment.artifact ?? null;

  const lines = [];
  const verdictLabel = VERDICT_LABELS[report.verdict] ?? asText(report.verdict);
  lines.push('# 真机报告：' + asText(report.suite) + ' · ' + verdictLabel);
  lines.push('');
  lines.push(
    '> 本文件由同目录 `report.json` 生成（schema v' + asText(report.schemaVersion) + '），不要手改；JSON 是唯一事实来源。',
  );
  lines.push(
    '> runTag=' +
      asText(report.runTag) +
      ' · suite=' +
      asText(report.suite) +
      ' · 判定=' +
      asText(report.verdict) +
      '（' +
      verdictLabel +
      '）',
  );

  /* 环境与版本 */
  lines.push('');
  lines.push('## 环境与版本');
  lines.push('');
  lines.push('| 项 | 值 |');
  lines.push('| --- | --- |');
  lines.push('| 被测产物 | ' + cell(describeArtifact(artifact)) + ' |');
  const artifactObj = artifact && typeof artifact === 'object' ? artifact : {};
  lines.push('| 产物 sha256（短） | ' + cell(shortSha(artifactObj.sha256)) + ' |');
  lines.push(
    '| 产物大小 | ' + cell(artifactObj.sizeBytes !== undefined ? artifactObj.sizeBytes + ' bytes' : MISSING_MARKER) + ' |',
  );
  lines.push('| 宿主 CLI | ' + cell(present(environment.hostCli)) + ' |');
  lines.push(
    '| 宿主 runtime 版本 | ' + cell(meta.host && meta.host.version ? meta.host.version : present(environment.hostVersion)) + ' |',
  );
  lines.push('| 浏览器 | ' + cell(present(environment.browser)) + ' |');
  lines.push(
    '| 浏览器 runtime | ' +
      cell(
        meta.browser && meta.browser.runtime
          ? meta.browser.runtime
          : environment.browserRuntime && environment.browserRuntime.version
            ? environment.browserRuntime.version
            : MISSING_MARKER,
      ) +
      ' |',
  );
  lines.push('| fixture | ' + cell(describeFixture(meta.fixture ?? environment.fixture)) + ' |');
  lines.push(
    '| 平台/架构 | ' +
      cell(present(environment.platform) + ' / ' + present(environment.arch)) +
      ' |',
  );
  if (environment.node !== undefined) lines.push('| Node | ' + cell(environment.node) + ' |');
  lines.push(
    '| locale / 时区 | ' + cell(present(meta.locale) + ' / ' + present(meta.timezone)) + ' |',
  );
  lines.push('| runTag | ' + cell(present(meta.runTag ?? report.runTag)) + ' |');
  lines.push('| 开始时间 | ' + cell(formatTime(report.startedAt)) + ' |');
  lines.push('| 结束时间 | ' + cell(formatTime(report.finishedAt)) + ' |');
  lines.push('| 报告 schema | v' + asText(report.schemaVersion) + ' |');

  /* 判定统计 */
  lines.push('');
  lines.push('## 判定统计');
  lines.push('');
  lines.push('| 判定 | 数量 |');
  lines.push('| --- | --- |');
  lines.push('| PASS（通过） | ' + asText(summary.PASS ?? 0) + ' |');
  lines.push('| FAIL（失败，不含预期失败） | ' + asText(summary.FAIL ?? 0) + ' |');
  lines.push('| BLOCKED（阻塞） | ' + asText(summary.BLOCKED ?? 0) + ' |');
  lines.push('| N/A（不适用） | ' + asText(summary['N-A'] ?? 0) + ' |');
  lines.push('| 合计 | ' + asText(summary.total ?? checks.length) + ' |');
  lines.push('');
  lines.push('- 预期失败（不计入产品失败）：' + asText(summary.expectedFailures ?? expectedFailures.length) + ' 条');
  lines.push('- 工具故障（失败/阻塞中）：' + asText(summary.toolFaults ?? 0) + ' 条');
  lines.push('- 测试假象（flakySuspect）：' + asText(summary.flakySuspects ?? 0) + ' 条');
  const failureTypes = summary.failureTypes ?? {};
  lines.push(
    '- FAIL 分型：' +
      FAILURE_TYPES.map((type) => type.label + ' ' + asText(failureTypes[type.id] ?? 0)).join(' / '),
  );

  /* 失败明细 */
  lines.push('');
  lines.push('## 失败明细（' + failures.length + ' 条）');
  if (failures.length === 0) {
    lines.push('');
    lines.push('（无）');
  } else {
    failures.forEach((check, index) => {
      lines.push('');
      for (const line of renderFailure(check, index)) lines.push(line);
    });
  }

  /* 预期失败 */
  lines.push('');
  lines.push('## 预期失败（' + expectedFailures.length + ' 条，不计入产品失败）');
  lines.push('');
  lines.push(
    '> 这些检查在记录时被明确标为预期失败（差分基线/负例），不计入产品失败；若预期没成立（重跑变绿），会另记「无区分力」失败。',
  );
  if (expectedFailures.length === 0) {
    lines.push('');
    lines.push('（无）');
  } else {
    expectedFailures.forEach((check, index) => {
      lines.push('');
      for (const line of renderExpectedFailure(check, index)) lines.push(line);
    });
  }

  /* 阻塞 */
  lines.push('');
  lines.push('## 阻塞（' + blocked.length + ' 条）');
  if (blocked.length === 0) {
    lines.push('');
    lines.push('（无）');
  } else {
    blocked.forEach((check, index) => {
      lines.push('');
      for (const line of renderBlocked(check, index)) lines.push(line);
    });
  }

  /* N/A */
  lines.push('');
  lines.push('## N/A（' + notApplicable.length + ' 条）');
  if (notApplicable.length === 0) {
    lines.push('');
    lines.push('（无）');
  } else {
    notApplicable.forEach((check, index) => {
      lines.push('');
      lines.push('### ' + (index + 1) + '. ' + asText(check.name));
      lines.push('');
      lines.push('- 理由：' + oneLine(check.reason, 800));
      lines.push('- **判定**：N-A（本轮不适用，不影响退出码）');
    });
  }

  /* 通过检查 */
  lines.push('');
  lines.push('## 通过检查（' + passed.length + ' 条）');
  if (passed.length === 0) {
    lines.push('');
    lines.push('（无）');
  } else {
    for (const check of passed) {
      const detail = check.detail !== undefined && check.detail !== null && check.detail !== '' ? '：' + oneLine(check.detail, 240) : '';
      lines.push('- ' + asText(check.name) + detail);
    }
  }

  /* 证据路径 */
  lines.push('');
  lines.push('## 证据路径');
  lines.push('');
  lines.push('- 报告 JSON：`report.json`（与本文件同目录，唯一事实源）');
  lines.push('- Markdown 摘要：`report.md`（本文件，由 report.json 生成）');
  lines.push('- 证据根目录：本次 run 的 `--evidence-dir`（报告与 artifacts 目录都在其下）');
  const artifactLines = [];
  for (const check of checks) {
    const list = Array.isArray(check.artifacts) ? check.artifacts : [];
    for (const item of list) {
      artifactLines.push(
        '- `' + asText(item.relative ?? item.file ?? MISSING_MARKER) + '`（' + asText(item.kind ?? 'artifact') + '，' + asText(check.name) + '）',
      );
    }
  }
  if (artifactLines.length === 0) {
    lines.push('- 失败产物：（无）');
  } else {
    for (const line of artifactLines) lines.push(line);
  }
  for (const check of failures) {
    if (Array.isArray(check.artifacts) && check.artifacts.length > 0) continue;
    if (typeof check.artifactsWhy === 'string' && check.artifactsWhy.trim() !== '') {
      lines.push('- 无产物说明（' + asText(check.name) + '）：' + oneLine(check.artifactsWhy, 400));
    }
  }

  return lines.join('\n') + '\n';
}

export { VERDICT_LABELS, FAILURE_LABELS, BLOCKER_LABELS };
