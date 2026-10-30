/**
 * 差分对照与区分力分类（票 #191 交付物 B）。
 *
 * 纯函数：不读文件、不读时钟、不 spawn、不依赖 CDP/browser —— 差分判定本身可被
 * selftest 用合成报告完整覆盖，真实结果只由两份 report.json 决定。
 *
 * 术语：reference = 对照侧（artifact 模式为旧产物基线；fault 模式为干净当前产物），
 * candidate = 被判定侧（artifact 模式为当前产物；fault 模式为注入后当前产物）。
 *
 * 分类里的「翻转」只看 verdict 是否变化；「有区分力」严格限制为
 * reference FAIL → candidate PASS（缺陷/差异必须在对照侧真红、当前侧才绿）。
 */

export const VERDICTS = Object.freeze(['PASS', 'FAIL', 'BLOCKED', 'N-A']);

/**
 * 差分侧的分类期哨兵（#183 评审整改 F5）：表示「该侧报告里没有这条检查」，
 * 即某侧没跑到；它不是第五种判定，不进 `VERDICTS`、不参与退出码，
 * 只在对照表里让「缺失」显式可见（否则会静默按 PASS 处理）。
 */
export const MISSING = 'MISSING';

/** 分类 → 中文标签 / 证据力 / 严重度。渲染与统计共用同一张表，避免两处漂移。 */
export const CLASSIFICATIONS = Object.freeze({
  discriminating: {
    label: '有区分力（对照侧红 → 判定侧绿）',
    short: '有区分力',
    evidence: 'flips',
    tone: 'good',
  },
  regression: {
    label: '回归（对照侧绿 → 判定侧红，变差）',
    short: '回归',
    evidence: 'regression',
    tone: 'bad',
  },
  bothGreen: {
    label: '无区分力（两侧都绿，无证据力）',
    short: '无区分力',
    evidence: 'none',
    tone: 'neutral',
  },
  bothRed: {
    label: '两侧都红（未翻转，不可作为「已修复」证据）',
    short: '两侧都红',
    evidence: 'none',
    tone: 'neutral',
  },
  bothBlocked: { label: '两侧阻塞（无法判定）', short: '两侧阻塞', evidence: 'unknown', tone: 'warn' },
  baselineBlocked: { label: '对照侧阻塞（无法判定）', short: '对照侧阻塞', evidence: 'unknown', tone: 'warn' },
  candidateBlocked: { label: '判定侧阻塞（无法判定）', short: '判定侧阻塞', evidence: 'unknown', tone: 'warn' },
  missingInBaseline: { label: '对照侧缺失（该侧未跑到此检查）', short: '对照侧缺失', evidence: 'unknown', tone: 'warn' },
  missingInCandidate: { label: '判定侧缺失（该侧未跑到此检查）', short: '判定侧缺失', evidence: 'unknown', tone: 'warn' },
  missingBoth: { label: '两侧都缺失', short: '两侧缺失', evidence: 'unknown', tone: 'warn' },
  bothNa: { label: '两侧 N-A', short: '两侧 N-A', evidence: 'unknown', tone: 'neutral' },
  naMismatch: { label: 'N-A 与判定不一致', short: 'N-A 不一致', evidence: 'unknown', tone: 'warn' },
  unknown: { label: '未分类', short: '未分类', evidence: 'unknown', tone: 'warn' },
});

export function normalizeVerdict(verdict) {
  if (verdict === MISSING) return MISSING;
  return VERDICTS.includes(verdict) ? verdict : MISSING;
}

export function verdictLabel(verdict) {
  const normalized = normalizeVerdict(verdict);
  return normalized === MISSING ? '缺失' : normalized;
}

/**
 * 两个 verdict 的配对分类。
 * 能说的「有区分力」只有一种：reference FAIL 且 candidate PASS。
 */
export function classifyPair(referenceVerdict, candidateVerdict) {
  const ref = normalizeVerdict(referenceVerdict);
  const cur = normalizeVerdict(candidateVerdict);
  if (ref === MISSING && cur === MISSING) return 'missingBoth';
  if (ref === MISSING) return 'missingInBaseline';
  if (cur === MISSING) return 'missingInCandidate';
  if (ref === 'FAIL' && cur === 'PASS') return 'discriminating';
  if (ref === 'PASS' && cur === 'FAIL') return 'regression';
  if (ref === 'PASS' && cur === 'PASS') return 'bothGreen';
  if (ref === 'FAIL' && cur === 'FAIL') return 'bothRed';
  if (ref === 'BLOCKED' && cur === 'BLOCKED') return 'bothBlocked';
  if (ref === 'BLOCKED') return 'baselineBlocked';
  if (cur === 'BLOCKED') return 'candidateBlocked';
  if (ref === 'N-A' && cur === 'N-A') return 'bothNa';
  if (ref === 'N-A' || cur === 'N-A') return 'naMismatch';
  return 'unknown';
}

export function classificationMeta(kind) {
  return CLASSIFICATIONS[kind] ?? CLASSIFICATIONS.unknown;
}

/**
 * 检查名 → 区域的可读归组规则（#183 评审整改 F5：不再「取第一个冒号前」静默换桶）。
 *
 * 每条规则声明它认得的命名形态；`describeArea` 返回命中的规则 id，
 * 一条都不命中时返回 `UNCLASSIFIED_AREA` 而不是把整条检查名当成区域名 ——
 * 后者会让每一条新检查各成一个「区域」，报告看起来有覆盖、实际没有归组。
 */
export const AREA_RULES = Object.freeze([
  { id: 'contract', pattern: /^契约：/, area: () => '契约 preflight' },
  { id: 'fixture', pattern: /^fixture\b/, area: () => 'fixture 起始态' },
  { id: 'scene', pattern: /^场景\s*(\d+)/, area: (match) => '场景 ' + match[1] },
  { id: 'group', pattern: /^([A-Z]\d+)-/, area: (match) => '检查组 ' + match[1] },
  { id: 'titled', pattern: /^([^：]{1,40})：/, area: (match) => match[1].trim() },
]);

/** 没有命中任何 AREA_RULES 的检查名归到这里（调用方据此报警，而不是静默换桶）。 */
export const UNCLASSIFIED_AREA = '（未归类）';

/**
 * 解析检查名所属区域与依据。
 * @param {unknown} name
 * @returns {{area: string, rule: string}}
 */
export function describeArea(name) {
  const text = typeof name === 'string' ? name : String(name ?? '');
  if (!text) return { area: UNCLASSIFIED_AREA, rule: 'unclassified' };
  for (const rule of AREA_RULES) {
    const match = text.match(rule.pattern);
    if (match) return { area: rule.area(match), rule: rule.id };
  }
  return { area: UNCLASSIFIED_AREA, rule: 'unclassified' };
}

/** 把检查名归到可读区域；规则见 AREA_RULES，未命中一律 UNCLASSIFIED_AREA。 */
export function areaOf(name) {
  return describeArea(name).area;
}

/** 一条检查的简短原因（写进对照表，便于贴 issue 时直接看懂为什么红/绿）。 */
export function describeCheck(check) {
  if (!check) return null;
  const reason = check.reason ?? check.detail ?? null;
  if (typeof reason === 'string' && reason) return clip(reason, 180);
  if (check.observed !== undefined) return clip('observed=' + JSON.stringify(check.observed), 180);
  return null;
}

function clip(text, max) {
  const value = String(text).replace(/\s+/g, ' ').trim();
  return value.length > max ? value.slice(0, max - 1) + '…' : value;
}

function indexChecks(checks) {
  const map = new Map();
  for (const check of checks ?? []) {
    if (!check || typeof check.name !== 'string') continue;
    if (!map.has(check.name)) map.set(check.name, check);
  }
  return map;
}

/**
 * 合并两份报告的检查，构建逐检查对照行。
 * 顺序：先按 reference 报告里的顺序，再补 candidate 独有检查（按 candidate 顺序），保证确定性。
 */
export function buildRows(referenceReport, candidateReport) {
  const refChecks = indexChecks(referenceReport?.checks);
  const curChecks = indexChecks(candidateReport?.checks);
  const names = [];
  const seen = new Set();
  for (const name of refChecks.keys()) {
    names.push(name);
    seen.add(name);
  }
  for (const name of curChecks.keys()) {
    if (seen.has(name)) continue;
    names.push(name);
    seen.add(name);
  }
  return names.map((name) => {
    const reference = refChecks.get(name) ?? null;
    const candidate = curChecks.get(name) ?? null;
    const referenceVerdict = reference ? normalizeVerdict(reference.verdict) : MISSING;
    const candidateVerdict = candidate ? normalizeVerdict(candidate.verdict) : MISSING;
    const kind = classifyPair(referenceVerdict, candidateVerdict);
    const area = describeArea(name);
    return {
      name,
      area: area.area,
      areaRule: area.rule,
      reference: {
        verdict: referenceVerdict,
        reason: describeCheck(reference),
        expectedFailure: reference ? reference.expectedFailure === true : false,
      },
      candidate: {
        verdict: candidateVerdict,
        reason: describeCheck(candidate),
        expectedFailure: candidate ? candidate.expectedFailure === true : false,
      },
      classification: kind,
      flipped: referenceVerdict !== candidateVerdict,
    };
  });
}

/** 逐检查统计；数值全部来自 rows，让 md 与 json 共用同一份事实。 */
export function summarizeRows(rows) {
  const byClassification = {};
  for (const kind of Object.keys(CLASSIFICATIONS)) byClassification[kind] = 0;
  const referenceVerdicts = { PASS: 0, FAIL: 0, BLOCKED: 0, 'N-A': 0, MISSING: 0 };
  const candidateVerdicts = { PASS: 0, FAIL: 0, BLOCKED: 0, 'N-A': 0, MISSING: 0 };
  let flipped = 0;
  for (const row of rows) {
    byClassification[row.classification] = (byClassification[row.classification] ?? 0) + 1;
    if (row.flipped) flipped += 1;
    referenceVerdicts[row.reference.verdict] = (referenceVerdicts[row.reference.verdict] ?? 0) + 1;
    candidateVerdicts[row.candidate.verdict] = (candidateVerdicts[row.candidate.verdict] ?? 0) + 1;
  }
  const evidence = { flips: 0, none: 0, regression: 0, unknown: 0 };
  for (const [kind, count] of Object.entries(byClassification)) {
    const meta = classificationMeta(kind);
    evidence[meta.evidence] = (evidence[meta.evidence] ?? 0) + count;
  }
  return {
    total: rows.length,
    flipped,
    byClassification,
    referenceVerdicts,
    candidateVerdicts,
    evidence,
  };
}

/** 对照表的区域分组（保持首次出现顺序，供 md 用）。 */
export function groupByArea(rows) {
  const groups = [];
  const index = new Map();
  for (const row of rows) {
    if (!index.has(row.area)) {
      index.set(row.area, { area: row.area, rows: [] });
      groups.push(index.get(row.area));
    }
    index.get(row.area).rows.push(row);
  }
  return groups;
}

/* ───────────────────── 差分问题的失败分型（#183 评审整改 S3） ───────────────────── */

/**
 * 差分问题码 → FAIL 分型的显式映射表（不进 model 逻辑，方便单测和文档引用）。
 *
 * 判据：差分 FAIL 不都是产品缺陷。
 * - 期望清单缺失/写错、清单内断言没有区分力、注入器串扰 → test（测试方法/证据不足）；
 * - 候选侧真实行为比对照侧变差（回归、候选自身非预期红、必须保持绿的断言在判定侧红了）→ product；
 * - 环境不一致 → test（环境准备问题，不是产品行为）。
 * 未知码按 test 处理（fail-closed 到「不足以判产品」这一侧，避免把工具问题报成产品缺陷）。
 */
export const DIFF_PROBLEM_FAILURE_TYPES = Object.freeze({
  'regression': 'product',
  'expect-regression': 'product',
  'candidate-product-fail': 'product',
  'expect-candidate-not-green': 'product',
  'candidate-missing-checks': 'test',
  'empty-expectations': 'test',
  'expect-missing-check': 'test',
  'no-discrimination': 'test',
  'no-flip': 'test',
  'expect-baseline-not-green': 'test',
  'fault-not-detected': 'test',
  'fault-partial-red': 'test',
  'fault-reference-not-green': 'test',
  'fault-stay-green-reference': 'test',
  'fault-stay-green-broken': 'test',
  'unexpected-fault-influence': 'test',
  'environment-mismatch': 'test',
  'unclassified-check-areas': 'test',
});

/** FAIL 检查里「有产品行为证据」的问题码白名单（用于 reason 文案，可读可测）。 */
export const PRODUCT_PROBLEM_CODES = Object.freeze(
  Object.entries(DIFF_PROBLEM_FAILURE_TYPES)
    .filter(([, type]) => type === 'product')
    .map(([code]) => code),
);

/**
 * 从一组差分问题（doc.problems）推导写进 #189 报告的 FAIL 分型。
 * 只要有一个 FAIL 问题码映射到 product，就按 product 记；否则 test。
 * 返回 { failureType, codes, productCodes, basis }，basis 直接用于 failureTypeBasis。
 */
export function failureTypeForProblems(problems) {
  const fails = (Array.isArray(problems) ? problems : []).filter((problem) => problem && problem.severity === 'FAIL');
  const codes = fails.map((problem) => String(problem.code ?? 'unknown'));
  const productCodes = codes.filter((code) => DIFF_PROBLEM_FAILURE_TYPES[code] === 'product');
  const failureType = productCodes.length > 0 ? 'product' : 'test';
  const signal = codes.length > 0 ? codes.join(',') : 'unknown';
  return {
    failureType,
    codes,
    productCodes,
    basis: {
      source: 'diff',
      signal,
      note:
        failureType === 'product'
          ? '候选侧真实行为比对照侧变差（问题码：' + productCodes.join(',') + '）'
          : '差分结论被清单/证据力/注入面问题阻断（问题码：' + signal + '）；不是候选侧行为回归',
    },
  };
}
