/**
 * 证据与判定：每次运行一个目录，报告有固定 schema，可以脱离对话独立阅读。
 *
 * 判定只有四类：PASS / FAIL / BLOCKED / N-A（语义与分型判据见 ./report/model.mjs）。
 * 本模块负责**记录**与**落盘**：
 *   - Recorder 提供 pass/fail/blocked/na/toolFault/expectFail 等入口，自动补全证据六元组
 *     （claim/conditions/steps/observations/inference/verdict），FAIL 自动补分型与依据；
 *   - writeReport 先序列化 report.json，再用同一份 JSON 渲染 report.md（Markdown 由 JSON 生成，
 *     同 JSON 两次生成字节相同），并做报告校验（缺字段/缺依据/缺产物说明直接抛错）。
 *
 * 兼容：v1 的导出名（makeRunTag / createRunContext / Recorder / writeReport）与 v1 顶层字段、
 * checks 既有字段（expected/observed/detail/reason）全部保留；schemaVersion 升到 2。
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { ReportError, SCHEMA_VERSION, assertValidReport, classifyFailure, exitCodeFor, isExpectedFailure, overallVerdict, summarize } from './report/model.mjs';
import { createArtifactStore } from './report/artifacts.mjs';
import { renderMarkdown } from './report/markdown.mjs';

function pad2(value) {
  return String(value).padStart(2, '0');
}

/**
 * 每轮唯一的 run tag：`<YYYYMMDD-HHmmss>-<pid36><序号36>-<随机6位36>-<套件>`。
 * 只用秒级时间戳会在同一秒连跑时撞目录（旧实现的问题）：这里加三样冗余 ——
 *   序号（同进程内必然递增，100 次连跑也不重复）、pid（区分并行/连续进程）、随机段（区分跨进程同秒）。
 * 字符集只含 [0-9a-z-]，可直接做目录名（Windows 也安全），并原样写进 report.json 的 runTag。
 */
let runTagSequence = 0;

export function makeRunTag(suite, now = new Date()) {
  const stamp =
    now.getFullYear() +
    pad2(now.getMonth() + 1) +
    pad2(now.getDate()) +
    '-' +
    pad2(now.getHours()) +
    pad2(now.getMinutes()) +
    pad2(now.getSeconds());
  runTagSequence = (runTagSequence % (36 ** 3 - 1)) + 1;
  const processSegment = process.pid.toString(36) + runTagSequence.toString(36);
  const entropy = crypto.randomBytes(4).toString('hex').slice(0, 6);
  return stamp + '-' + processSegment + '-' + entropy + '-' + suite;
}

export function createRunContext({ bindings, suite }) {
  const runTag = makeRunTag(suite);
  const workDir = path.join(bindings.workRoot, runTag);
  const evidenceDir = path.join(bindings.evidenceRoot, runTag);
  const shotsDir = path.join(evidenceDir, 'shots');
  const homeDir = path.join(workDir, 'home');
  const browserDir = path.join(workDir, 'browser');
  fs.mkdirSync(workDir, { recursive: true });
  fs.mkdirSync(shotsDir, { recursive: true });
  return { runTag, workDir, evidenceDir, shotsDir, homeDir, browserDir, profileName: 'real' };
}

const FAILURE_LABELS = { product: '产品缺陷', spec: '规格缺陷', test: '测试假象', tool: '工具故障' };

/** 缺省推断文案：套件没显式给 inference 时，按判定给一句可核查的结论。 */
function inferenceFor(item) {
  if (item.verdict === 'PASS') return '检查成立：观测满足期望。';
  if (item.verdict === 'BLOCKED') return '检查未执行完成，证据不足以判定产品对错。';
  if (item.verdict === 'N-A') return '本轮不适用，未纳入判定。';
  if (item.verdict === 'FAIL') {
    const label = FAILURE_LABELS[item.failureType] ?? '（未定分型）';
    return '期望未成立，按证据推断为' + label + '；分型依据见 failureTypeBasis。';
  }
  return '（未记录推断）';
}

/** 缺省原始观测：先记录套件给的原始字段，再让 inference 解释（不要混写）。 */
function observationsFor(item) {
  const observations = {};
  if (item.expected !== undefined) observations.expected = item.expected;
  if (item.observed !== undefined) observations.observed = item.observed;
  if (item.detail !== undefined) observations.detail = item.detail;
  if (item.reason !== undefined) observations.reason = item.reason;
  if (Object.keys(observations).length === 0) {
    observations.note = '套件未提供原始观测；本条仅记录判定（报告要求先记录后解释，请套件补充 observations）';
  }
  return observations;
}

function compact(value) {
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) out[key] = entry;
  }
  return out;
}

export class Recorder {
  constructor({ suite, runTag, evidenceDir = null } = {}) {
    this.suite = suite;
    this.runTag = runTag;
    this.evidenceDir = evidenceDir;
    this.startedAt = new Date().toISOString();
    this.checks = [];
    this.environment = {};
    /** 套件额外声明的固定条件（合并进每条检查的 conditions）。 */
    this.conditions = {};
    /** 预期失败登记：expectFailures([...]) 声明「这些用例应该红」，finish 时对账。 */
    this.expectedFailureNames = new Set();
    this._finished = null;
    this._reconciled = false;
    this._artifactStoreInstance = null;
  }

  setEnvironment(patch) {
    Object.assign(this.environment, patch || {});
    this._finished = null;
  }

  /** 套件声明本轮固定条件（如 locale、fixture 变体），会合并进每条检查的 conditions。 */
  setConditions(patch) {
    Object.assign(this.conditions, patch || {});
    this._finished = null;
  }

  /* ───────────────────────── 证据仓库（产物） ───────────────────────── */

  _artifactStore() {
    if (!this._artifactStoreInstance) {
      this._artifactStoreInstance = createArtifactStore(this.evidenceDir);
    }
    return this._artifactStoreInstance;
  }

  /** 预留一个将由外部工具写入的产物文件路径（如 CDP 截图）。 */
  artifactPath(options) {
    return this._artifactStore().filePath(options);
  }

  /** 写一份产物（对象默认写 JSON），返回 {kind,name,file,relative,bytes}。 */
  saveArtifact(options) {
    return this._artifactStore().save(options);
  }

  /** 登记一个已经由外部工具写好的产物文件（如截图）。 */
  registerArtifact(options) {
    return this._artifactStore().refFromFile(options);
  }

  /* ───────────────────────── 记录 ───────────────────────── */

  /**
   * 补全证据六元组与 v2 字段。调用前提：item 上已带上套件显式提供的字段。
   * 显式字段优先，缺哪个补哪个（来源在字段值或 conditions 里可读）。
   */
  _enrich(item) {
    const environment = this.environment || {};
    const baseConditions = {
      runTag: this.runTag,
      suite: this.suite,
      artifact: environment.artifact
        ? {
            name: environment.artifact.name ?? null,
            version: environment.artifact.version ?? null,
            fileName: environment.artifact.fileName ?? null,
            sha256: environment.artifact.sha256 ?? null,
          }
        : null,
      host: environment.hostCli
        ? { cli: environment.hostCli, version: environment.hostVersion ?? null }
        : null,
      browser: environment.browser ?? null,
      browserRuntime: environment.browserRuntime ? environment.browserRuntime.version ?? null : null,
      fixture: environment.fixture
        ? { name: environment.fixture.name ?? null, ok: environment.fixture.ok ?? null }
        : null,
    };
    const conditions = { ...baseConditions, ...(this.conditions || {}), ...(item.conditions || {}) };
    item.claim = item.claim ?? item.name;
    item.conditions = conditions;
    item.steps =
      Array.isArray(item.steps) && item.steps.length > 0
        ? item.steps
        : ['执行检查「' + item.name + '」（套件未声明逐步操作）'];
    item.observations = item.observations ?? observationsFor(item);
    item.inference = item.inference ?? inferenceFor(item);
    return item;
  }

  /** 底层记录：任何判定都要经过这里补全六元组。 */
  record(verdict, name, extra = {}) {
    const item = { name, verdict, at: new Date().toISOString(), ...extra };
    this._enrich(item);
    this.checks.push(item);
    this._finished = null;
    return item;
  }

  /**
   * 记录通过。第二个参数沿用 v1 的 detail（字符串），也接受 v2 的选项对象
   * （detail/claim/conditions/steps/observations/inference）。
   */
  pass(name, detailOrOptions) {
    if (detailOrOptions && typeof detailOrOptions === 'object' && !Array.isArray(detailOrOptions)) {
      return this.record('PASS', name, { ...detailOrOptions });
    }
    return this.record('PASS', name, detailOrOptions === undefined ? {} : { detail: detailOrOptions });
  }

  /** 票面约定：fail({ expected: true }) 也视为预期失败简写；显式 expectedFailure 优先。 */
  _isExpectedFailure({ expected, expectedFailure }) {
    if (typeof expectedFailure === 'boolean') return expectedFailure;
    return expected === true;
  }

  /**
   * 记录失败。v1 的 {expected, observed, detail} 全部保留；v2 新增：
   *   error          套件捕获到的异常（用于自动分型；不会原样进报告）
   *   failureType    product/spec/test/tool 显式分型（覆盖自动推断）
   *   failureTypeBasis 显式分型的依据
   *   flakySuspect / reproducible 不可复现标记 → 自动归 test
   *   expectedFailure:true（或 expected:true 简写）→ 预期失败，不计入产品失败
   *   artifacts / artifactsWhy 失败产物或缺失说明
   *   claim/conditions/steps/observations/inference 证据六元组显式值
   */
  fail(name, options = {}) {
    const { error, claim, conditions, steps, observations, inference, artifacts, artifactsWhy } = options;
    const expectedFailure = this._isExpectedFailure(options);
    const classification = classifyFailure({
      error,
      detail: options.detail,
      observed: options.observed,
      reason: options.reason,
      failureType: options.failureType,
      failureTypeBasis: options.failureTypeBasis,
      flakySuspect: options.flakySuspect,
      reproducible: options.reproducible,
    });
    const extra = compact({
      expected: options.expected,
      observed: options.observed,
      detail: options.detail,
      reason: options.reason,
      claim,
      conditions,
      steps,
      observations,
      inference,
      failureType: classification.type,
      failureTypeBasis: classification.basis,
      flakySuspect: classification.type === 'test' ? true : options.flakySuspect,
      expectedFailure,
      artifacts,
      artifactsWhy,
    });
    return this.record('FAIL', name, extra);
  }

  /**
   * 记录一个「预期失败」（差分/负例用例，票 #191 用）：真判定仍是 FAIL，
   * 但不计入产品失败、不改变整体判定、退出码按 0 计。
   */
  expectFail(name, options = {}) {
    return this.fail(name, { ...options, expectedFailure: true });
  }

  /**
   * 声明一组「本轮应该红」的用例名。finish 时对账：没红 → 追加一条
   * 「预期失败未成立：<name>」的真实 FAIL（分型 test，注明无区分力）。
   */
  expectFailures(names = []) {
    for (const name of [].concat(names)) this.expectedFailureNames.add(name);
    this._finished = null;
    return this;
  }

  /** 记录阻塞：默认环境未就绪（blockerKind=environment）；工具故障用 toolFault()。 */
  blocked(name, reason, options = {}) {
    return this.record('BLOCKED', name, {
      blockerKind: options.blockerKind ?? 'environment',
      reason: reason === undefined || reason === null || String(reason).trim() === '' ? '（未记录阻塞原因）' : String(reason),
      claim: options.claim,
      steps: options.steps,
      observations: options.observations,
      inference: options.inference,
      ...compact({ artifacts: options.artifacts, artifactsWhy: options.artifactsWhy }),
    });
  }

  /** 记录工具故障导致的阻塞（退出码 3）：不得记成产品失败。 */
  toolFault(name, reason, options = {}) {
    return this.blocked(name, reason, { ...options, blockerKind: 'tool' });
  }

  /** 记录 N-A：reason 必填，缺理由直接抛错且不留下残缺检查。 */
  na(name, reason, options = {}) {
    if (reason === undefined || reason === null || String(reason).trim() === '') {
      throw new ReportError('N-A 必须写 reason（为什么不适用）：' + name);
    }
    const text = String(reason);
    return this.record('N-A', name, {
      reason: text,
      claim: options.claim,
      // N-A 也带 steps：写清「为什么没执行、谁来覆盖」，报告里不能出现空步骤（#183 评审整改 S1）。
      steps: Array.isArray(options.steps) && options.steps.length > 0 ? options.steps : ['N-A 不执行：' + text],
      observations: options.observations,
      inference: options.inference,
    });
  }

  /* ───────────────────────── 统计与落盘 ───────────────────────── */

  /** 判定统计（预期失败不计入 FAIL，含分型/工具故障/flaky 细分）。 */
  summary() {
    return summarize(this.checks);
  }

  verdict() {
    return overallVerdict(this.checks);
  }

  /** 退出码映射（run.mjs 用；语义见 model.mjs 的 exitCodeFor）。 */
  exitCode() {
    return exitCodeFor(this.checks);
  }

  _reconcileExpectedFailures() {
    if (this._reconciled) return;
    this._reconciled = true;
    for (const name of this.expectedFailureNames) {
      const red = this.checks.some((check) => check.name === name && check.verdict === 'FAIL');
      if (red) continue;
      const observedCheck = this.checks.find((check) => check.name === name) ?? null;
      const item = {
        name: '预期失败未成立：' + name,
        verdict: 'FAIL',
        claim: '差分/负例用例「' + name + '」应当失败，用以证明它能区分新旧产物',
        steps: ['执行「' + name + '」', '对照新产物：若同样通过，则该用例没有区分力'],
        observations: {
          expectedVerdict: 'FAIL',
          actualVerdict: observedCheck ? observedCheck.verdict : '（该检查未记录）',
          actualObserved: observedCheck ? observedCheck.observed : null,
        },
        inference: '预期失败未成立，说明该用例无法区分新旧产物，记为测试假象（无区分力）。',
        reason: '预期失败未成立（' + (observedCheck ? '实际 ' + observedCheck.verdict : '该检查未记录') + '）',
        failureType: 'test',
        failureTypeBasis: {
          source: 'inferred',
          signal: 'expected-not-met',
          note: '差分/负例用例没有红，说明它没有区分力（预期失败未成立）',
        },
        expectedFailure: false,
      };
      this._enrich(item);
      this.checks.push(item);
      this._finished = null;
    }
  }

  _buildMeta() {
    const environment = this.environment || {};
    const artifact = environment.artifact
      ? {
          name: environment.artifact.name ?? null,
          version: environment.artifact.version ?? null,
          fileName: environment.artifact.fileName ?? null,
          sizeBytes: environment.artifact.sizeBytes ?? null,
          sha256: environment.artifact.sha256 ?? null,
        }
      : null;
    return {
      runTag: this.runTag,
      suite: this.suite,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt ?? null,
      timezone: environment.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
      locale: environment.locale ?? Intl.DateTimeFormat().resolvedOptions().locale ?? null,
      artifact,
      host: {
        cli: environment.hostCli ?? null,
        version: environment.hostVersion ?? null,
        source: environment.hostCliSource ?? null,
      },
      browser: {
        id: environment.browser ?? null,
        source: environment.browserSource ?? null,
        runtime: environment.browserRuntime ? environment.browserRuntime.version ?? null : null,
      },
      fixture: environment.fixture ? { name: environment.fixture.name ?? null, ok: environment.fixture.ok ?? null } : null,
      evidenceDir: this.evidenceDir ?? null,
    };
  }

  /**
   * 生成报告对象。首次调用固定 finishedAt 并缓存；重复调用返回同一对象
   * （writeReport 两次写出的 JSON 字节因此完全一致）。
   */
  finish() {
    this._reconcileExpectedFailures();
    if (this._finished) return this._finished;
    this.finishedAt = this.finishedAt ?? new Date().toISOString();
    const report = {
      schemaVersion: SCHEMA_VERSION,
      runTag: this.runTag,
      suite: this.suite,
      verdict: overallVerdict(this.checks),
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      environment: this.environment,
      summary: summarize(this.checks),
      checks: this.checks,
      exitCode: exitCodeFor(this.checks),
      meta: this._buildMeta(),
      failures: this.checks.filter((check) => check.verdict === 'FAIL' && !isExpectedFailure(check)),
      expectedFailures: this.checks.filter((check) => check.verdict === 'FAIL' && isExpectedFailure(check)),
    };
    this._finished = report;
    return report;
  }
}

/** FAIL 检查必须有产物或缺失说明；writeReport 在落盘前做最后兜底（显式写原因，不静默）。 */
function ensureFailureArtifactsExplained(report) {
  for (const check of report.checks) {
    if (!check || check.verdict !== 'FAIL') continue;
    if (Array.isArray(check.artifacts) && check.artifacts.length > 0) continue;
    if (typeof check.artifactsWhy === 'string' && check.artifactsWhy.trim() !== '') continue;
    check.artifactsWhy =
      check.expectedFailure === true
        ? '预期失败（差分基线/负例）不保存产物'
        : '未保存产物：本轮没有可用的证据句柄或产物采集未执行（run.mjs 的 captureFailureArtifacts 应已尝试截图/页面状态/store/输入日志）';
    report._finished = null;
  }
}

/**
 * 落盘 report.json + report.md。Markdown 严格由 report.json 生成：
 * 先序列化 JSON，再对同一份 JSON 的解析结果调用 renderMarkdown，因此两者永远一致。
 *
 * @returns {{reportPath:string, markdownPath:string, report:object, markdown:string}}
 */
export function writeReport(recorder, evidenceDir) {
  const targetDir = evidenceDir ?? recorder.evidenceDir;
  if (!targetDir) throw new ReportError('writeReport 需要 evidenceDir（或 Recorder 构造时传入）');
  fs.mkdirSync(targetDir, { recursive: true });
  const report = recorder.finish();
  ensureFailureArtifactsExplained(report);
  const jsonText = JSON.stringify(report, null, 2) + '\n';
  const snapshot = JSON.parse(jsonText);
  assertValidReport(snapshot);
  const markdown = renderMarkdown(snapshot);
  const reportPath = path.join(targetDir, 'report.json');
  const markdownPath = path.join(targetDir, 'report.md');
  fs.writeFileSync(reportPath, jsonText, 'utf8');
  fs.writeFileSync(markdownPath, markdown, 'utf8');
  return { reportPath, markdownPath, report: snapshot, markdown };
}
