/**
 * 期望翻转清单（票 #191 交付物 B 的「纯数据」部分）。
 *
 * 清单是 `scripts/real/diffs/<suite>.expect.json`，只描述产品行为差异，不写代码：
 *   {
 *     "suite": "boundary",
 *     "baseline": { "artifactFile": "dsh-prompt-0.4.32.tgz", "sha256": "…", "note": "…" },
 *     "mustFlipRedOnBaseline": ["检查名", "检查名前缀", "含 * 的通配"],
 *     "mustStayGreen": ["…"],
 *     "notes": ["…"]
 *   }
 *
 * 判定规则（规格 #183 的差分决策）：
 * - mustFlip 的每一项在对照侧必须**红**、判定侧必须**绿**（discriminating）；两侧都绿 → 无区分力
 *   → 整体 FAIL；两侧都红 / 对照侧阻塞 / 检查缺失 → 同样不算有区分力。
 * - mustStayGreen 的每一项在对照侧必须绿：对照侧红 = 基线/环境问题（按原因 FAIL 或 BLOCKED）。
 * - 清单引用不存在的检查名 → FAIL（清单过期，不是「通过」）。
 */

import fs from 'node:fs';

import { HarnessError } from '../errors.mjs';
import { classificationMeta, normalizeVerdict } from './classify.mjs';

export const EXPECT_TOP_LEVEL_KEYS = Object.freeze([
  'suite',
  'baseline',
  'mustFlipRedOnBaseline',
  'mustStayGreen',
  'notes',
]);

export const EXPECT_BASELINE_KEYS = Object.freeze(['name', 'artifactFile', 'sha256', 'version', 'commit', 'note']);

/** 读 + 校验清单；任何结构问题都抛可操作错误（工具/用法问题，不冒充产品判定）。 */
export function loadExpect(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new HarnessError(
      '读不到期望清单：' + filePath + '（' + (error && error.code ? error.code : error && error.message) + '）。' +
        '用 --expect 指定清单，或先建 scripts/real/diffs/<suite>.expect.json（见 docs/real/diff.md）。',
    );
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new HarnessError('期望清单不是合法 JSON：' + filePath + '：' + (error && error.message ? error.message : error));
  }
  return validateExpect(json, filePath);
}

export function validateExpect(json, label = '<expect>') {
  const problems = [];
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new HarnessError(label + ' 必须是 JSON 对象');
  }
  for (const key of Object.keys(json)) {
    if (!EXPECT_TOP_LEVEL_KEYS.includes(key)) {
      problems.push('未知顶层字段 "' + key + '"（允许：' + EXPECT_TOP_LEVEL_KEYS.join(', ') + '）');
    }
  }
  if (typeof json.suite !== 'string' || !json.suite.trim()) {
    problems.push('suite 必须是非空字符串（例如 "boundary"）');
  }
  const mustFlip = json.mustFlipRedOnBaseline;
  if (!Array.isArray(mustFlip) || mustFlip.length === 0) {
    problems.push('mustFlipRedOnBaseline 必须是非空字符串数组（没有它就无法证明区分力）');
  } else if (mustFlip.some((item) => typeof item !== 'string' || !item.trim())) {
    problems.push('mustFlipRedOnBaseline 里每一项都必须是非空字符串');
  }
  const mustStayGreen = json.mustStayGreen ?? [];
  if (!Array.isArray(mustStayGreen) || mustStayGreen.some((item) => typeof item !== 'string' || !item.trim())) {
    problems.push('mustStayGreen 必须是非空字符串数组（可省略/空数组）');
  }
  if (json.baseline !== undefined) {
    if (!json.baseline || typeof json.baseline !== 'object' || Array.isArray(json.baseline)) {
      problems.push('baseline 必须是对象（可省略）');
    } else {
      for (const key of Object.keys(json.baseline)) {
        if (!EXPECT_BASELINE_KEYS.includes(key)) {
          problems.push('baseline 未知字段 "' + key + '"（允许：' + EXPECT_BASELINE_KEYS.join(', ') + '）');
        }
      }
      for (const key of Object.keys(json.baseline)) {
        if (typeof json.baseline[key] !== 'string') problems.push('baseline.' + key + ' 必须是字符串');
      }
    }
  }
  const notes = json.notes ?? [];
  if (!Array.isArray(notes) || notes.some((item) => typeof item !== 'string')) {
    problems.push('notes 必须是字符串数组（可省略）');
  }
  if (problems.length > 0) {
    throw new HarnessError('期望清单不合法（' + label + '）：' + problems.join('；'));
  }
  return {
    suite: json.suite.trim(),
    baseline: json.baseline ?? null,
    mustFlipRedOnBaseline: [...mustFlip],
    mustStayGreen: [...mustStayGreen],
    notes: [...notes],
    source: label,
  };
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 检查名匹配：精确名、前缀（票面允许）、或带 `*` 的通配。
 * 前缀匹配是有意为之：mustFlip 常写成「场景 2：行插入落位：*」这种断言族。
 */
export function matchPattern(name, pattern) {
  if (typeof name !== 'string' || typeof pattern !== 'string' || !pattern) return false;
  if (pattern.includes('*')) {
    const source = pattern.split('*').map(escapeRegExp).join('.*');
    return new RegExp('^' + source + '$').test(name);
  }
  return name === pattern || name.startsWith(pattern);
}

export function matchRows(rows, pattern) {
  return rows.filter((row) => matchPattern(row.name, pattern));
}

function compactList(items, max = 4) {
  if (items.length <= max) return items.join('、');
  return items.slice(0, max).join('、') + ' 等 ' + items.length + ' 条';
}

/**
 * 评估清单：返回结构化证据（每项的命中检查/结果）与问题清单（带严重度）。
 * 严重度：FAIL = 有区分力/基线绿要求被打破；BLOCKED = 对照侧整侧没跑起来，无法判定。
 */
export function evaluateExpectations({ rows, expect }) {
  const problems = [];
  const mustFlip = [];
  const mustStayGreen = [];

  for (const pattern of expect.mustFlipRedOnBaseline) {
    const matched = matchRows(rows, pattern);
    const entry = {
      pattern,
      list: 'mustFlipRedOnBaseline',
      matched: matched.map((row) => row.name),
      classifications: matched.map((row) => ({ name: row.name, classification: row.classification })),
      status: 'ok',
      detail: null,
    };
    if (matched.length === 0) {
      entry.status = 'missing-check';
      entry.detail = '清单引用的检查名不存在';
      problems.push({
        code: 'expect-missing-check',
        severity: 'FAIL',
        pattern,
        message: '期望清单引用不存在的检查：' + pattern + '（清单过期或套件改名，需修正清单）',
      });
    } else {
      const unmet = matched.filter((row) => row.classification !== 'discriminating');
      if (unmet.length === 0) {
        entry.detail = '全部检查：对照侧红 → 判定侧绿';
      } else {
        entry.status = 'unmet';
        const kinds = [...new Set(unmet.map((row) => row.classification))];
        const blocked = kinds.some((kind) => ['baselineBlocked', 'bothBlocked', 'missingInBaseline'].includes(kind));
        const bothGreen = kinds.every((kind) => kind === 'bothGreen');
        const noFlipRed = kinds.every((kind) => ['bothGreen', 'bothRed'].includes(kind)) && kinds.includes('bothRed');
        let detail;
        let severity;
        let code;
        if (bothGreen) {
          severity = 'FAIL';
          code = 'no-discrimination';
          detail = '对照侧与判定侧都绿：该断言无区分力/无证据力，不得判通过';
        } else if (blocked) {
          severity = 'BLOCKED';
          code = 'expect-baseline-blocked';
          detail = '对照侧未跑出红（阻塞/缺失），无法证明区分力';
        } else if (kinds.includes('regression')) {
          severity = 'FAIL';
          code = 'expect-regression';
          detail = '对照侧绿而判定侧红：不是修复，是回归';
        } else {
          severity = 'FAIL';
          code = 'no-flip';
          detail = '对照侧没有红（或判定侧没有绿）：断言未按期望翻转';
        }
        entry.detail = detail;
        entry.unmet = unmet.map((row) => ({ name: row.name, classification: row.classification, label: classificationMeta(row.classification).short }));
        problems.push({
          code,
          severity,
          pattern,
          checks: unmet.map((row) => row.name),
          message:
            'mustFlip 未满足（' + code + '）：' + pattern + ' → ' +
            compactList(unmet.map((row) => row.name + '=' + classificationMeta(row.classification).short)) +
            '；' + detail,
        });
        if (noFlipRed) entry.detail = entry.detail + '（对照侧旧红未修复，判定侧仍红）';
      }
    }
    mustFlip.push(entry);
  }

  for (const pattern of expect.mustStayGreen) {
    const matched = matchRows(rows, pattern);
    const entry = {
      pattern,
      list: 'mustStayGreen',
      matched: matched.map((row) => row.name),
      classifications: matched.map((row) => ({ name: row.name, classification: row.classification })),
      status: 'ok',
      detail: null,
    };
    if (matched.length === 0) {
      entry.status = 'missing-check';
      entry.detail = '清单引用的检查名不存在';
      problems.push({
        code: 'expect-missing-check',
        severity: 'FAIL',
        pattern,
        message: '期望清单引用不存在的检查：' + pattern + '（清单过期或套件改名，需修正清单）',
      });
    } else {
      const badReference = matched.filter((row) => normalizeVerdict(row.reference.verdict) !== 'PASS');
      const badCandidate = matched.filter((row) => normalizeVerdict(row.candidate.verdict) !== 'PASS');
      if (badReference.length > 0) {
        const blocked = badReference.some((row) => ['BLOCKED', 'MISSING'].includes(normalizeVerdict(row.reference.verdict)));
        entry.status = 'baseline-not-green';
        entry.detail = '对照侧该检查不是绿';
        problems.push({
          code: blocked ? 'expect-baseline-blocked' : 'expect-baseline-not-green',
          severity: blocked ? 'BLOCKED' : 'FAIL',
          pattern,
          checks: badReference.map((row) => row.name),
          message:
            'mustStayGreen 不成立：' + pattern + ' → 对照侧 ' +
            compactList(badReference.map((row) => row.name + '=' + row.reference.verdict)) +
            '（对照侧必须绿：红/阻塞是基线或环境问题，不是产品差异）',
        });
      }
      if (badCandidate.length > 0) {
        const blocked = badCandidate.some((row) => ['BLOCKED', 'MISSING'].includes(normalizeVerdict(row.candidate.verdict)));
        entry.status = entry.status === 'ok' ? 'candidate-not-green' : entry.status;
        entry.detail = (entry.detail ? entry.detail + '；' : '') + '判定侧该检查不是绿';
        problems.push({
          code: blocked ? 'expect-candidate-blocked' : 'expect-candidate-not-green',
          severity: blocked ? 'BLOCKED' : 'FAIL',
          pattern,
          checks: badCandidate.map((row) => row.name),
          message:
            'mustStayGreen 在判定侧不成立：' + pattern + ' → 判定侧 ' +
            compactList(badCandidate.map((row) => row.name + '=' + row.candidate.verdict)),
        });
      }
      if (badReference.length === 0 && badCandidate.length === 0) entry.detail = '两侧均绿';
    }
    mustStayGreen.push(entry);
  }

  return {
    source: expect.source ?? null,
    suite: expect.suite,
    baseline: expect.baseline ?? null,
    mustFlipRedOnBaseline: [...expect.mustFlipRedOnBaseline],
    mustStayGreen: [...expect.mustStayGreen],
    notes: [...(expect.notes ?? [])],
    entries: { mustFlip, mustStayGreen },
    problems,
  };
}

/**
 * fault 模式评估（对照侧 = 干净当前产物，判定侧 = 当前产物 + 故障注入）。
 *
 * 与 artifact 模式的差别在于「翻转」不能照搬：注入器对准的检查有两类 ——
 * 1. 常驻断言（干净跑也有记录）：期望「对照侧绿 → 注入侧红」，这是完整的区分力证据；
 * 2. 条件性断言（只在失败时记录，例如「场景 N：…等待观测条件超时」）：
 *    干净跑根本不产生这条检查，注入后才出现 —— 仍然算「注入被检出」，
 *    不能用「对照侧必须红」来要求它，否则会把正确检出误判成对照侧缺失。
 *
 * 因此这里的规则是：
 * - expectedRed（清单字段沿用以保持数据格式一致）：判定侧必须红（FAIL）；
 *   对照侧若记录过这条检查则必须绿（红/阻塞 = 基线环境问题，不是注入的功劳）；
 * - expectedStayGreen：对照侧与注入侧都必须绿（注入不得污染无关断言）；
 * - expectedRed 命中的检查会被 model 从「回归」汇总里排除（它们按设计就是从绿变红）。
 */
export function evaluateFaultExpectations({ rows, expect }) {
  const problems = [];
  const expectedRed = [];
  const expectedStayGreen = [];
  const redMatchedNames = new Set();

  for (const pattern of expect.mustFlipRedOnBaseline) {
    const matched = matchRows(rows, pattern);
    const entry = {
      pattern,
      list: 'expectedRed',
      matched: matched.map((row) => row.name),
      classifications: matched.map((row) => ({ name: row.name, classification: row.classification })),
      referenceVerdicts: matched.map((row) => ({ name: row.name, verdict: row.reference.verdict })),
      candidateVerdicts: matched.map((row) => ({ name: row.name, verdict: row.candidate.verdict })),
      status: 'ok',
      detail: null,
    };
    const candidateRed = matched.filter((row) => normalizeVerdict(row.candidate.verdict) === 'FAIL');
    const candidateNotRed = matched.filter((row) => normalizeVerdict(row.candidate.verdict) !== 'FAIL');
    const referenceBad = matched.filter((row) => !['PASS', 'MISSING'].includes(normalizeVerdict(row.reference.verdict)));
    const referenceGreen = matched.filter((row) => normalizeVerdict(row.reference.verdict) === 'PASS');

    if (candidateRed.length === 0) {
      entry.status = 'not-detected';
      entry.detail = '注入下没有出现期望的红';
      problems.push({
        code: 'fault-not-detected',
        severity: 'FAIL',
        pattern,
        checks: matched.map((row) => row.name),
        message:
          '故障注入未被检出（无区分力）：' + pattern + ' → 注入侧 ' +
          (matched.length > 0 ? compactList(matched.map((row) => row.name + '=' + row.candidate.verdict)) : '没有这条检查') +
          '；注入下该断言必须红，否则注入器没有证明到这条检查。',
      });
    } else if (candidateNotRed.length > 0) {
      entry.status = 'partial';
      entry.detail = '同一模式命中的检查里并非全部变红';
      problems.push({
        code: 'fault-partial-red',
        severity: 'FAIL',
        pattern,
        checks: candidateNotRed.map((row) => row.name),
        message:
          '故障注入只让部分命中检查变红：' + pattern + ' → ' +
          compactList(candidateNotRed.map((row) => row.name + '=' + row.candidate.verdict)) +
          '；注入器声明的整族断言都应变红。',
      });
    }
    if (referenceBad.length > 0) {
      const blocked = referenceBad.some((row) => normalizeVerdict(row.reference.verdict) === 'BLOCKED');
      entry.status = entry.status === 'ok' ? 'reference-not-green' : entry.status;
      problems.push({
        code: blocked ? 'fault-reference-blocked' : 'fault-reference-not-green',
        severity: blocked ? 'BLOCKED' : 'FAIL',
        pattern,
        checks: referenceBad.map((row) => row.name),
        message:
          'fault 模式对照侧（干净当前产物）该检查不是绿：' + pattern + ' → ' +
          compactList(referenceBad.map((row) => row.name + '=' + row.reference.verdict)) +
          '；对照侧必须绿，否则无法证明是注入让它变红。',
      });
    }
    if (entry.status === 'ok') {
      entry.detail =
        referenceGreen.length > 0
          ? '对照侧绿 → 注入侧红（有区分力）'
          : '注入侧红（对照侧没有这条检查记录：条件性断言，干净跑正常完成）';
    }
    for (const row of matched) redMatchedNames.add(row.name);
    expectedRed.push(entry);
  }

  for (const pattern of expect.mustStayGreen) {
    const matched = matchRows(rows, pattern);
    const entry = {
      pattern,
      list: 'expectedStayGreen',
      matched: matched.map((row) => row.name),
      classifications: matched.map((row) => ({ name: row.name, classification: row.classification })),
      status: 'ok',
      detail: null,
    };
    if (matched.length === 0) {
      entry.status = 'missing-check';
      entry.detail = '清单引用的检查名不存在';
      problems.push({
        code: 'expect-missing-check',
        severity: 'FAIL',
        pattern,
        message: '注入器声明的保持绿检查不存在：' + pattern + '（名单过期或套件改名，需修正注入器元数据）',
      });
    } else {
      const badReference = matched.filter((row) => normalizeVerdict(row.reference.verdict) !== 'PASS');
      const badCandidate = matched.filter((row) => normalizeVerdict(row.candidate.verdict) !== 'PASS');
      if (badReference.length > 0) {
        const blocked = badReference.some((row) => ['BLOCKED', 'MISSING'].includes(normalizeVerdict(row.reference.verdict)));
        entry.status = 'reference-not-green';
        entry.detail = '对照侧该检查不是绿';
        problems.push({
          code: blocked ? 'fault-stay-green-reference-blocked' : 'fault-stay-green-reference',
          severity: blocked ? 'BLOCKED' : 'FAIL',
          pattern,
          checks: badReference.map((row) => row.name),
          message:
            'fault 模式对照组必须绿（干净当前产物）：' + pattern + ' → 对照侧 ' +
            compactList(badReference.map((row) => row.name + '=' + row.reference.verdict)),
        });
      }
      if (badCandidate.length > 0) {
        const unobserved = badCandidate.some((row) => normalizeVerdict(row.candidate.verdict) === 'MISSING');
        const blocked = badCandidate.some((row) => normalizeVerdict(row.candidate.verdict) === 'BLOCKED');
        entry.status = entry.status === 'ok' ? 'candidate-not-green' : entry.status;
        entry.detail = (entry.detail ? entry.detail + '；' : '') + '注入侧该检查不是绿';
        problems.push({
          code: unobserved
            ? 'fault-stay-green-unobserved'
            : blocked
              ? 'fault-stay-green-blocked'
              : 'fault-stay-green-broken',
          severity: unobserved || blocked ? 'BLOCKED' : 'FAIL',
          pattern,
          checks: badCandidate.map((row) => row.name),
          message:
            '注入会污染无关断言（' + (unobserved ? '注入导致该检查没被记录' : blocked ? '注入侧该检查阻塞' : '注入侧该检查变红') + '）：' +
            pattern + ' → 注入侧 ' +
            compactList(badCandidate.map((row) => row.name + '=' + row.candidate.verdict)) +
            (unobserved ? '；注入提前中止了场景，需调整注入范围或清单' : '；这不是注入器声明的期望影响'),
        });
      }
      if (badReference.length === 0 && badCandidate.length === 0) entry.detail = '两侧均绿（注入没有污染该断言）';
    }
    expectedStayGreen.push(entry);
  }

  return {
    source: expect.source ?? null,
    suite: expect.suite,
    baseline: expect.baseline ?? null,
    mustFlipRedOnBaseline: [...expect.mustFlipRedOnBaseline],
    mustStayGreen: [...expect.mustStayGreen],
    notes: [...(expect.notes ?? [])],
    entries: { mustFlip: expectedRed, mustStayGreen: expectedStayGreen },
    problems,
    expectedRedNames: [...redMatchedNames],
  };
}

/** 把差异行里所有 regression 汇总成一条醒目的整体问题（即使没写进清单也要报）。 */
export function regressionProblems(rows) {
  const regressions = rows.filter((row) => row.classification === 'regression');
  if (regressions.length === 0) return [];
  return [
    {
      code: 'regression',
      severity: 'FAIL',
      checks: regressions.map((row) => row.name),
      message:
        '出现回归（对照侧绿 → 判定侧红）' + regressions.length + ' 条：' +
        compactList(regressions.map((row) => row.name)) +
        '。回归必须视为变差，整体不得判通过。',
    },
  ];
}
