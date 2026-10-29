/**
 * 证据与判定：每次运行一个目录，报告有固定 schema，可以脱离对话独立阅读。
 *
 * 判定只有四类：PASS / FAIL / BLOCKED / N-A。
 * - FAIL  = 产品行为不符合期望（需要可复现，报告带 expected/observed）；
 * - BLOCKED = 装配或工具环节没就绪，证据不足以下结论；
 * - N-A   = 本环境/本产物不适用，必须写原因。
 * 整体结论：有 FAIL 即 FAIL；否则有 BLOCKED 即 BLOCKED；否则 PASS。
 */

import fs from 'node:fs';
import path from 'node:path';

function pad2(value) {
  return String(value).padStart(2, '0');
}

export function makeRunTag(suite, now = new Date()) {
  const stamp =
    now.getFullYear() +
    pad2(now.getMonth() + 1) +
    pad2(now.getDate()) +
    '-' +
    pad2(now.getHours()) +
    pad2(now.getMinutes()) +
    pad2(now.getSeconds());
  return stamp + '-' + suite;
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

export class Recorder {
  constructor({ suite, runTag }) {
    this.suite = suite;
    this.runTag = runTag;
    this.startedAt = new Date().toISOString();
    this.checks = [];
    this.environment = {};
  }

  setEnvironment(patch) {
    Object.assign(this.environment, patch);
  }

  record(verdict, name, extra = {}) {
    const item = { name, verdict, at: new Date().toISOString(), ...extra };
    this.checks.push(item);
    return item;
  }

  pass(name, detail) {
    return this.record('PASS', name, detail === undefined ? {} : { detail });
  }

  fail(name, { expected, observed, detail }) {
    return this.record('FAIL', name, { expected, observed, detail });
  }

  blocked(name, reason) {
    return this.record('BLOCKED', name, { reason });
  }

  na(name, reason) {
    return this.record('N-A', name, { reason });
  }

  summary() {
    const counts = { PASS: 0, FAIL: 0, BLOCKED: 0, 'N-A': 0 };
    for (const check of this.checks) {
      if (counts[check.verdict] === undefined) counts[check.verdict] = 0;
      counts[check.verdict] += 1;
    }
    return { total: this.checks.length, ...counts };
  }

  verdict() {
    const counts = this.summary();
    if (counts.FAIL > 0) return 'FAIL';
    if (counts.BLOCKED > 0) return 'BLOCKED';
    return 'PASS';
  }

  finish() {
    this.finishedAt = new Date().toISOString();
    return {
      schemaVersion: 1,
      runTag: this.runTag,
      suite: this.suite,
      verdict: this.verdict(),
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      environment: this.environment,
      summary: this.summary(),
      checks: this.checks,
    };
  }
}

export function writeReport(recorder, evidenceDir) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const report = recorder.finish();
  const reportPath = path.join(evidenceDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  return { reportPath, report };
}
