/**
 * 判定分类与证据报告模型（票 #189 / 规格 #183「证据与门禁层」）。
 *
 * 本模块是报告层的**唯一判定语义来源**：四类判定、FAIL 四分型、阻塞两类、
 * 退出码表、证据六元组、失败分型判据、统计与报告校验。
 * 它不碰文件系统、不碰浏览器，纯函数，便于自证（selftest）与复用。
 *
 * 判定语义（与 docs/real/report.md 一致）：
 *   PASS    检查成立；
 *   FAIL    检查不成立。必须带分型 product / spec / test / tool 与分型依据；
 *   BLOCKED 检查没跑起来（环境未就绪或工具故障），必须带原因；
 *   N-A     本轮不适用，必须带理由。
 *
 * 预期失败（差分基线/负例，票 #191 用）：记录时标 `expectedFailure: true`
 * （或票面约定的 `expected: true` 简写，见 Recorder.fail），真实判定仍是 FAIL，
 * 但不计入产品失败、不改变整体判定、退出码按 0 计。v1 的 `expected` 字段
 * 语义（期望值本身）保持不变，因此兼容 old suites。
 */

import { CheckFailure, HarnessError } from '../errors.mjs';

/** 报告 JSON 的 schema 版本。v2 新增判定分型/六元组/退出码/meta/分区，v1 字段全部保留。 */
export const SCHEMA_VERSION = 2;

/** 四类判定，顺序固定（Markdown 与统计按此顺序输出）。 */
export const VERDICTS = ['PASS', 'FAIL', 'BLOCKED', 'N-A'];

/** FAIL 四分型。`id` 进 JSON，`label` 进 Markdown，`description` 供文档与 CLI 提示。 */
export const FAILURE_TYPES = [
  {
    id: 'product',
    label: '产品缺陷',
    description: '被测产物（或宿主）行为不符合规格期望：断言不成立、等待超时、元素/状态缺失。',
  },
  {
    id: 'spec',
    label: '规格缺陷',
    description: '期望本身可疑或规格没写清，无法据此判定产品对错；由套件显式覆盖。',
  },
  {
    id: 'test',
    label: '测试假象',
    description: '不可复现或环境抖动导致的红（flaky），重跑可能变绿；报告记 flakySuspect。',
  },
  {
    id: 'tool',
    label: '工具故障',
    description: '测试工具链自身故障（HarnessError/驱动异常/协议断开），不得冒充产品失败。',
  },
];

export const FAILURE_TYPE_IDS = FAILURE_TYPES.map((type) => type.id);

/** 阻塞两类：环境没准备好（非缺陷）与工具故障（退出码 3）。 */
export const BLOCKER_KINDS = [
  {
    id: 'environment',
    label: '环境未就绪',
    description: 'fixture 起始态不符、前置条件不满足、宿主没起来等；不是产品缺陷。',
  },
  {
    id: 'tool',
    label: '工具故障',
    description: '证据/驱动/宿主控制通道自身故障，导致检查根本没法执行。',
  },
];

/** 退出码表（run.mjs 使用）。参数错误保持 2 并与 BLOCKED 共用，文档写明。 */
export const EXIT_CODES = {
  PASS: 0,
  FAIL: 1,
  BLOCKED: 2,
  TOOL_FAULT: 3,
};

/** 证据六元组字段，顺序即报告与 Markdown 的展示顺序。 */
export const EVIDENCE_TUPLE_FIELDS = ['claim', 'conditions', 'steps', 'observations', 'inference', 'verdict'];

/**
 * 套件未声明步骤时的历史兜底文本（evidence.mjs 仍会生成，但报告校验必须拒绝，
 * 防止「兜底文本 = 空壳 steps」静默通过）。#183 评审整改 S1
 */
export const PLACEHOLDER_STEPS_TEXT = /套件未声明逐步操作/;

/** 报告层协议/校验错误（与 HarnessError 区分：这是「报告不合法」，不是「被测系统坏了」）。 */
export class ReportError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = 'ReportError';
    this.detail = detail;
  }
}

/* ───────────────────────────── 失败分型判据 ───────────────────────────── */

const DRIVER_ERROR_PATTERN =
  /CDP|WebSocket|DevTools|Runtime\.evaluate|输入驱动|输入事件注入|driver|协议层|socket|Target closed|Session closed/i;
const TIMEOUT_PATTERN = /等待超时|超时|timeout|timed out/i;
const ELEMENT_MISSING_PATTERN =
  /元素不存在|找不到元素|未找到|没有[\s\S]{0,8}(几何|矩形)|缺少[\s\S]{0,12}(几何|矩形|选择器)|element not found|no such element/i;

function textOf(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function truncate(value, limit = 300) {
  const text = String(value ?? '');
  return text.length > limit ? text.slice(0, limit) + '…' : text;
}

/**
 * FAIL 分型判据（优先级从高到低，与 docs/real/report.md 的表格一致）：
 *   1. 套件显式给 failureType → 按显式，依据必须可读（failureTypeBasis，缺省给通用说明）；
 *   2. flakySuspect / reproducible=false → test（报告记 flakySuspect）；
 *   3. HarnessError → tool；
 *   4. CheckFailure → product；
 *   5. 其它 Error：命中驱动/协议特征 → tool，否则一律 tool（未预期异常不冒充产品缺陷）；
 *   6. 观测文本命中等待超时 → product；命中元素缺失 → product；
 *   7. 默认 product（断言不成立）；依据里提示可显式覆盖为 spec。
 *
 * @param {object} input
 * @param {Error} [input.error]           套件捕获到的异常对象（有则优先于文本判据）
 * @param {string} [input.detail]         套件补充说明
 * @param {string} [input.observed]       原始观测文本
 * @param {string} [input.reason]         失败原因文本
 * @param {'product'|'spec'|'test'|'tool'} [input.failureType] 套件显式分型（可覆盖推断）
 * @param {string} [input.failureTypeBasis] 显式分型的依据
 * @param {boolean} [input.flakySuspect]  不可复现/环境抖动标记
 * @param {boolean} [input.reproducible]  是否可复现（false 等价 flakySuspect）
 * @returns {{type:string, basis:{source:'inferred'|'explicit', signal:string, note:string}}}
 */
export function classifyFailure(input = {}) {
  const {
    error,
    detail,
    observed,
    reason,
    failureType,
    failureTypeBasis,
    flakySuspect,
    reproducible,
  } = input;

  if (failureType !== undefined && failureType !== null && failureType !== '') {
    if (!FAILURE_TYPE_IDS.includes(failureType)) {
      throw new ReportError(
        '未知的失败分型 failureType=' + JSON.stringify(failureType) + '，可选：' + FAILURE_TYPE_IDS.join(' / '),
      );
    }
    return {
      type: failureType,
      basis: {
        source: 'explicit',
        signal: 'explicit',
        note: textOf(failureTypeBasis) || '套件显式指定分型（未附依据说明）',
      },
    };
  }

  if (flakySuspect === true || reproducible === false) {
    return {
      type: 'test',
      basis: {
        source: 'inferred',
        signal: 'not-reproducible',
        note: textOf(failureTypeBasis) || '标记为不可复现或环境抖动（flakySuspect），按测试假象处理；报告需记 flakySuspect',
      },
    };
  }

  if (error instanceof HarnessError) {
    return {
      type: 'tool',
      basis: {
        source: 'inferred',
        signal: 'harness-error',
        note: 'HarnessError（测试工具链自身故障）：' + truncate(error.message),
      },
    };
  }

  if (error instanceof CheckFailure) {
    return {
      type: 'product',
      basis: {
        source: 'inferred',
        signal: 'check-failure',
        note: 'CheckFailure（断言不成立）：' + truncate(error.message),
      },
    };
  }

  if (error instanceof Error) {
    const message = truncate(error.message);
    if (DRIVER_ERROR_PATTERN.test(String(error.message ?? ''))) {
      return {
        type: 'tool',
        basis: {
          source: 'inferred',
          signal: 'driver-error',
          note: '异常信息命中驱动/协议故障特征，按工具故障处理：' + message,
        },
      };
    }
    return {
      type: 'tool',
      basis: {
        source: 'inferred',
        signal: 'unexpected-error',
        note: '未预期异常（不属于断言失败），按工具故障处理：' + message,
      },
    };
  }

  const text = [detail, observed, reason].map(textOf).filter(Boolean).join('\n');

  if (TIMEOUT_PATTERN.test(text)) {
    return {
      type: 'product',
      basis: {
        source: 'inferred',
        signal: 'timeout',
        note: '观测在预算内未等到期望状态（等待超时），按产品缺陷处理；若预算本身不合理请显式覆盖为 spec',
      },
    };
  }

  if (ELEMENT_MISSING_PATTERN.test(text)) {
    return {
      type: 'product',
      basis: {
        source: 'inferred',
        signal: 'element-missing',
        note: '观测目标元素/几何缺失或不可定位，按产品缺陷处理；若是选择器写错请显式覆盖为 test/spec',
      },
    };
  }

  return {
    type: 'product',
    basis: {
      source: 'inferred',
      signal: 'assertion',
      note: '断言不成立但未命中具体特征，默认按产品缺陷处理；若期望本身可疑，请用 failureType=spec 显式覆盖',
    },
  };
}

/* ───────────────────────────── 证据六元组 ───────────────────────────── */

/**
 * 校验一条检查是否带齐证据六元组；缺字段直接抛 ReportError。
 * 每个字段的「算不算缺失」按类型判定，报错信息点名具体字段，便于套件修。
 */
export function assertEvidenceTuple(check, label = '检查') {
  if (!check || typeof check !== 'object') {
    throw new ReportError(label + ' 不是对象，无法校验证据六元组');
  }
  const problems = [];
  for (const field of EVIDENCE_TUPLE_FIELDS) {
    const value = check[field];
    if (value === undefined || value === null) {
      problems.push(field + ' 缺失');
      continue;
    }
    if (field === 'claim' || field === 'inference') {
      if (typeof value !== 'string' || value.trim() === '') problems.push(field + ' 必须是非空字符串');
    } else if (field === 'steps') {
      if (!Array.isArray(value) || value.length === 0) problems.push('steps 必须是非空数组');
    } else if (field === 'conditions') {
      if (typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length === 0) {
        problems.push('conditions 必须是非空对象');
      }
    } else if (field === 'observations') {
      if (typeof value !== 'object' || value === null) problems.push('observations 必须是对象（原始观测，先记录后解释）');
    } else if (field === 'verdict') {
      if (!VERDICTS.includes(value)) problems.push('verdict 必须是 ' + VERDICTS.join('/') + ' 之一');
    }
  }
  if (problems.length > 0) {
    throw new ReportError((label + '「' + (check.name ?? '(未命名)') + '」证据六元组不完整：' + problems.join('；')));
  }
  return true;
}

/* ───────────────────────────── 统计与整体判定 ───────────────────────────── */

/** 预期失败标记：显式 `expectedFailure` 优先；票面简写 `expected:true` 仅在未给布尔标记时生效。 */
export function isExpectedFailure(check) {
  if (!check || check.verdict !== 'FAIL') return false;
  if (typeof check.expectedFailure === 'boolean') return check.expectedFailure;
  return check.expected === true;
}

/**
 * 统计判定结果。预期失败不计入 FAIL 计数、不计入分型统计，单独计 expectedFailures。
 * toolFaults 统计「工具故障导致的失败或阻塞」；flakySuspects 统计测试假象检查数。
 */
export function summarize(checks = []) {
  const summary = {
    total: checks.length,
    PASS: 0,
    FAIL: 0,
    BLOCKED: 0,
    'N-A': 0,
    expectedFailures: 0,
    failureTypes: { product: 0, spec: 0, test: 0, tool: 0 },
    toolFaults: 0,
    flakySuspects: 0,
  };

  for (const check of checks) {
    const verdict = check && check.verdict;
    if (isExpectedFailure(check)) {
      summary.expectedFailures += 1;
      continue;
    }
    if (verdict === 'PASS' || verdict === 'FAIL' || verdict === 'BLOCKED' || verdict === 'N-A') {
      summary[verdict] += 1;
    }
    if (verdict === 'FAIL') {
      const type = check.failureType;
      if (type && Object.prototype.hasOwnProperty.call(summary.failureTypes, type)) {
        summary.failureTypes[type] += 1;
      }
      if (type === 'tool') summary.toolFaults += 1;
      if (check.flakySuspect === true) summary.flakySuspects += 1;
    }
    if (verdict === 'BLOCKED') {
      if (check.blockerKind === 'tool') summary.toolFaults += 1;
      if (check.flakySuspect === true) summary.flakySuspects += 1;
    }
  }

  return summary;
}

/**
 * 整体判定：有非预期 FAIL → FAIL；否则有 BLOCKED → BLOCKED；否则 PASS。
 * 预期失败、N/A 都不改变整体判定。
 */
export function overallVerdict(checks = []) {
  const effective = checks.filter((check) => check && !isExpectedFailure(check));
  if (effective.some((check) => check.verdict === 'FAIL')) return 'FAIL';
  if (effective.some((check) => check.verdict === 'BLOCKED')) return 'BLOCKED';
  return 'PASS';
}

/**
 * 退出码映射（票面 E 节）：
 *   非预期 FAIL 中存在非 tool 分型 → 1（产品/规格/测试缺陷优先暴露）；
 *   只有 tool 分型的 FAIL          → 3；
 *   阻塞里有工具故障               → 3；
 *   有阻塞                         → 2；
 *   全绿（含只有 N-A / 预期失败）  → 0。
 * 参数错误不进这张表：run.mjs 在解析阶段直接返回 2，并在文档写明与 BLOCKED 共用。
 */
export function exitCodeFor(checks = []) {
  const failed = checks.filter((check) => check && check.verdict === 'FAIL' && !isExpectedFailure(check));
  if (failed.some((check) => check.failureType !== 'tool')) return EXIT_CODES.FAIL;
  if (failed.length > 0) return EXIT_CODES.TOOL_FAULT;
  const blocked = checks.filter((check) => check && check.verdict === 'BLOCKED');
  if (blocked.some((check) => check.blockerKind === 'tool')) return EXIT_CODES.TOOL_FAULT;
  if (blocked.length > 0) return EXIT_CODES.BLOCKED;
  return EXIT_CODES.PASS;
}

/* ───────────────────────────── 报告校验 ───────────────────────────── */

function problem(message, path) {
  return path ? { message, path } : { message };
}

/**
 * 校验一份报告对象是否满足 schema v2 的硬要求；返回问题列表（不抛错）。
 * 报告生成路径（writeReport）用 assertValidReport 把问题聚合成一次抛错。
 */
export function validateReport(report) {
  const problems = [];
  if (!report || typeof report !== 'object') {
    return [problem('报告不是对象')];
  }
  if (report.schemaVersion !== SCHEMA_VERSION) {
    problems.push(problem('schemaVersion 必须是 ' + SCHEMA_VERSION + '，当前=' + JSON.stringify(report.schemaVersion)));
  }
  for (const field of ['runTag', 'suite', 'verdict', 'environment', 'summary']) {
    if (report[field] === undefined || report[field] === null) problems.push(problem('缺少字段 ' + field));
  }
  if (!VERDICTS.includes(report.verdict)) problems.push(problem('verdict 非法：' + JSON.stringify(report.verdict)));
  if (!Array.isArray(report.checks)) {
    problems.push(problem('checks 必须是数组'));
    return problems;
  }

  report.checks.forEach((check, index) => {
    const where = 'checks[' + index + ']' + (check && check.name ? '（' + check.name + '）' : '');
    if (!check || typeof check !== 'object') {
      problems.push(problem(where + ' 不是对象'));
      return;
    }
    if (typeof check.name !== 'string' || check.name.trim() === '') problems.push(problem(where + ' 缺少 name'));
    if (!VERDICTS.includes(check.verdict)) {
      problems.push(problem(where + ' verdict 非法：' + JSON.stringify(check.verdict)));
    }

    // #183 评审整改 S1：六元组 steps 是「怎么重放这条检查」的唯一入口，报告层 fail-closed：
    // 空步骤或套件兜底占位文本（含「套件未声明逐步操作」）一律判报告不合格。
    // 步骤项允许字符串或结构化对象（如 {action, target}），但不许空项/空壳。
    const steps = check.steps;
    const isValidStep = (step) => {
      if (typeof step === 'string') return step.trim() !== '' && !PLACEHOLDER_STEPS_TEXT.test(step);
      if (step && typeof step === 'object' && !Array.isArray(step)) return Object.keys(step).length > 0;
      return false;
    };
    if (!Array.isArray(steps) || steps.length === 0) {
      problems.push(problem(where + ' 必须带可重放的 steps（非空数组；报告不允许空步骤）', 'steps'));
    } else if (!steps.every(isValidStep)) {
      problems.push(problem(where + ' 的 steps 含空项或套件兜底占位文本「套件未声明逐步操作」；每条检查都要写怎么重放', 'steps'));
    }

    if (check.verdict === 'N-A') {
      if (typeof check.reason !== 'string' || check.reason.trim() === '') {
        problems.push(problem(where + ' 是 N-A，必须带 reason（N/A 必须写清楚为什么不适用）', 'reason'));
      }
      return;
    }

    if (check.verdict === 'BLOCKED') {
      if (typeof check.reason !== 'string' || check.reason.trim() === '') {
        problems.push(problem(where + ' 是 BLOCKED，必须带 reason 说明阻塞原因', 'reason'));
      }
      if (check.blockerKind !== undefined && !BLOCKER_KINDS.some((kind) => kind.id === check.blockerKind)) {
        problems.push(problem(where + ' blockerKind 非法：' + JSON.stringify(check.blockerKind)));
      }
      return;
    }

    if (check.verdict === 'FAIL') {
      try {
        assertEvidenceTuple(check, where);
      } catch (error) {
        problems.push(problem(where + ' 证据六元组不完整：' + error.message, 'evidence'));
      }
      if (!FAILURE_TYPE_IDS.includes(check.failureType)) {
        problems.push(problem(where + ' 失败必须带 failureType（product/spec/test/tool），当前=' + JSON.stringify(check.failureType), 'failureType'));
      }
      const basis = check.failureTypeBasis;
      if (!basis || typeof basis !== 'object' || typeof basis.note !== 'string' || basis.note.trim() === '') {
        problems.push(problem(where + ' 失败必须带 failureTypeBasis（至少要能读出分型依据 note）', 'failureTypeBasis'));
      }
      if (typeof check.expectedFailure !== 'boolean') {
        problems.push(
          problem(where + ' 失败必须明确 expectedFailure 布尔标记（true=预期失败，不计入产品失败）', 'expectedFailure'),
        );
      }
      const hasArtifacts = Array.isArray(check.artifacts) && check.artifacts.length > 0;
      const hasWhy = typeof check.artifactsWhy === 'string' && check.artifactsWhy.trim() !== '';
      if (!hasArtifacts && !hasWhy) {
        problems.push(problem(where + ' 失败缺少可打开产物（artifacts）且没有 artifactsWhy 说明', 'artifacts'));
      }
      if (check.flakySuspect === true && check.failureType !== 'test') {
        problems.push(problem(where + ' 标了 flakySuspect 但分型不是 test，判定语义自相矛盾', 'flakySuspect'));
      }
    }
  });

  return problems;
}

/** 校验并抛错；错误信息一次性列出全部问题（报告层不静默放过）。 */
export function assertValidReport(report) {
  const problems = validateReport(report);
  if (problems.length > 0) {
    throw new ReportError(
      '报告校验失败（' + problems.length + ' 项）：' + problems.map((item) => item.message).join('；'),
      problems,
    );
  }
  return report;
}
