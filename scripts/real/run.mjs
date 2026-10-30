#!/usr/bin/env node
/**
 * 真机 kit 入口：一条命令装配一次性宿主、安装被测产物、起无头浏览器、跑套件、出证据。
 *
 * 退出码（语义见 docs/real/report.md「退出码」）：
 *   0 = PASS（含仅有预期失败的情形）；
 *   1 = FAIL（产品不符合期望；预期失败不计）；
 *   2 = BLOCKED（装配/环境没就绪、fixture 不符、参数错误、未知套件）；
 *   3 = 工具故障（harness/CDP/驱动自身异常，不得冒充产品失败）。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveBindings, usage } from './harness/bindings.mjs';
import { HarnessError } from './harness/errors.mjs';
import { isPortFree, waitForPortFree } from './harness/proc.mjs';
import { bootstrapDisposableProfile } from './harness/profile.mjs';
import { startWebServer } from './harness/server.mjs';
import { launchBrowser } from './harness/browser.mjs';
import { connect } from './harness/cdp.mjs';
import { preparePage } from './harness/page.mjs';
import { createRunContext, Recorder, writeReport } from './harness/evidence.mjs';
import { captureFailureArtifacts } from './harness/report/artifacts.mjs';
import { runPreflight } from './harness/contract/preflight.mjs';
import { FixtureError, captureBaselineFromOrigin, checkBaseline, formatDiffs, loadFixture, makeFixtureParams, prepareFixture } from './harness/fixture/index.mjs';
import { createObserver, createPersistence } from './harness/observe/index.mjs';
import { createInputDriver } from './harness/input.mjs';
import { applyFaults, assertKnownFaultIds } from './harness/fault/index.mjs';
import { runSmoke } from './suites/smoke.mjs';
import { runBoundary } from './suites/boundary.mjs';

const SUITES = {
  smoke: runSmoke,
  boundary: runBoundary,
};

/**
 * 报告里的 environment.fixture：配方名、参数、应用结果（重置/种子/故障）、声明与实测基线、差异。
 * 声明与实测都进报告，失败时不必翻工作目录就能独立读结论。
 */
function fixtureEnvironment(prepared) {
  return {
    name: prepared.name,
    request: prepared.fixture,
    title: prepared.title,
    params: prepared.params ?? null,
    fault: prepared.applied.fault,
    storePath: prepared.storePath,
    storeGuard: prepared.guard ? { ok: prepared.guard.ok } : { ok: false },
    applied: prepared.applied,
    declared: prepared.declared,
    observed: null,
    ok: null,
    diffs: [],
  };
}

async function execute(bindings) {
  const runContext = createRunContext({ bindings, suite: bindings.suite });
  const recorder = new Recorder({ suite: bindings.suite, runTag: runContext.runTag, evidenceDir: runContext.evidenceDir });
  recorder.setEnvironment({
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    cpus: os.cpus().length,
    cwd: process.cwd(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    artifact: bindings.artifact,
    hostCli: bindings.dshCli,
    hostCliSource: bindings.dshCliSource,
    hostVersion: bindings.hostVersion,
    browser: bindings.browser,
    browserSource: bindings.browserSource,
    suite: bindings.suite,
    timeouts: bindings.timeouts,
    profile: { homeDir: runContext.homeDir, name: runContext.profileName },
  });

  let server = null;
  let browser = null;
  let client = null;
  try {
    recorder.setEnvironment({ phase: 'bootstrap-profile' });
    const bootstrap = bootstrapDisposableProfile({
      homeDir: runContext.homeDir,
      profileName: runContext.profileName,
      dshCli: bindings.dshCli,
      artifact: bindings.artifact,
      env: bindings.env,
      timeouts: bindings.timeouts,
    });
    recorder.setEnvironment({
      phase: 'start-host',
      profile: {
        homeDir: runContext.homeDir,
        name: runContext.profileName,
        installedVersion: bootstrap.installedVersion,
        skeletonBundles: bootstrap.skeletonBundles,
        packagePath: bootstrap.profilePackagePath,
      },
    });

    // 初始态：profile 就绪后、起宿主前应用「重置 + 种子」。
    // 声明是纯数据（--fixture 指向的配方），套件与用例代码零改动；种子按 storage-schema 契约写 store。
    recorder.setEnvironment({ phase: 'fixture-apply' });
    let preparedFixture;
    try {
      const fixtureParams = makeFixtureParams({ runTag: runContext.runTag });
      preparedFixture = prepareFixture({
        fixture: bindings.fixture,
        homeDir: runContext.homeDir,
        params: fixtureParams,
        fault: bindings.fixtureFault,
      });
      preparedFixture.params = fixtureParams;
    } catch (error) {
      if (error instanceof FixtureError) throw new HarnessError('fixture 装配失败：' + error.message);
      throw error;
    }
    recorder.setEnvironment({ fixture: fixtureEnvironment(preparedFixture) });

    server = await startWebServer({
      homeDir: runContext.homeDir,
      profileName: runContext.profileName,
      dshCli: bindings.dshCli,
      port: bindings.port,
      timeouts: bindings.timeouts,
      workDir: runContext.workDir,
      env: bindings.env,
    });
    recorder.setEnvironment({
      phase: 'launch-browser',
      server: { redactedUrl: server.redactedUrl, port: server.port, httpStatus: server.httpStatus, htmlBytes: server.htmlBytes },
    });

    browser = await launchBrowser({
      browser: bindings.browser,
      userDataDir: runContext.browserDir,
      timeouts: bindings.timeouts,
      env: bindings.env,
    });
    recorder.setEnvironment({
      phase: 'connect-cdp',
      browserRuntime: { pid: browser.pid, cdpPort: browser.cdpPort, version: browser.version },
    });

    client = await connect({ cdpPort: browser.cdpPort });
    recorder.setEnvironment({ phase: 'prepare-page' });
    const prepared = await preparePage(client, { url: server.url, timeouts: bindings.timeouts });
    recorder.setEnvironment({ page: prepared.facts, startupGate: prepared.gate.gateActions, startupGateRounds: prepared.gate.gateRounds });
    await client.screenshot(path.join(runContext.shotsDir, 'boot.png'));

    // 宿主契约 preflight：套件依赖的宿主行为事实先逐项核对。
    // 任何一项断链 → 只记该一项 BLOCKED、不进入套件，避免把"宿主没就绪"误报成产品 FAIL。
    recorder.setEnvironment({ phase: 'preflight' });
    const preflight = await runPreflight({
      client,
      server,
      prepared,
      homeDir: runContext.homeDir,
      bindings,
      browserVersion: browser.version,
      fault: bindings.contractFault,
    });
    recorder.setEnvironment({
      preflight: {
        contractVersion: preflight.contractVersion,
        fault: preflight.fault,
        ok: preflight.ok,
        checks: preflight.checks.map((check) => ({ id: check.id, ok: check.ok })),
      },
    });
    for (const check of preflight.checks) {
      if (check.ok) {
        recorder.pass('契约：' + check.id, JSON.stringify({ expected: check.expected, observed: check.observed }));
      } else {
        recorder.blocked(
          '契约：' + check.id,
          '宿主行为与钉住版本不一致，套件未执行。期望 ' + JSON.stringify(check.expected) +
            '；观测 ' + JSON.stringify(check.observed) + '；' + check.detail,
        );
      }
    }

    // 起始态基线：preflight 之后经产品公开路径（宿主 HTTP 桥 GET /_dsh/dsh-prompt/store）读回，
    // 与配方声明逐路径对比。不符 → 整轮 BLOCKED、列出 current vs expected，不执行套件：
    // 状态污染的锅不能记到产品头上，也不能让后续用例产生一堆假 FAIL。
    let fixtureBaseline = null;
    if (preflight.ok) {
      recorder.setEnvironment({ phase: 'fixture-readback' });
      let captured;
      try {
        captured = await captureBaselineFromOrigin({
          origin: server.origin,
          storePath: preparedFixture.storePath,
          timeoutMs: bindings.timeouts.pageLoadMs,
        });
      } catch (error) {
        if (error instanceof FixtureError) throw new HarnessError('fixture 起始态读回失败：' + error.message);
        throw error;
      }
      fixtureBaseline = checkBaseline(preparedFixture.recipe, captured.baseline);
      recorder.setEnvironment({
        fixture: {
          ...fixtureEnvironment(preparedFixture),
          http: captured.http,
          storeFile: captured.storeFile,
          observed: fixtureBaseline.observed,
          ok: fixtureBaseline.ok,
          diffs: fixtureBaseline.diffs,
        },
      });
      if (fixtureBaseline.ok) {
        recorder.pass('fixture 起始态', '配方 ' + preparedFixture.name + '：' + JSON.stringify(fixtureBaseline.observed));
        recorder.setEnvironment({ phase: 'fixture-ok' });
      } else {
        recorder.blocked(
          'fixture 起始态',
          '配方 ' + preparedFixture.name + ' 起始态与声明不符，套件未执行。' + formatDiffs(fixtureBaseline.diffs),
        );
      }
    }

    if (preflight.ok && fixtureBaseline && fixtureBaseline.ok) {
      recorder.setEnvironment({ phase: 'suite:' + bindings.suite });
      // 套件句柄：观测层（六面原始观测/解释）、真实输入驱动、持久化通道（store 双通道）。
      // 句柄只装一次、由 run.mjs 统一传入，套件不自己连 CDP/不自己拼 HTTP。
      const observe = createObserver(client, { timeouts: bindings.timeouts });
      const input = createInputDriver(client, { timeouts: bindings.timeouts });
      const persistence = createPersistence({
        origin: server.origin,
        storePath: preparedFixture.storePath,
        timeoutMs: bindings.timeouts.pageLoadMs,
      });
      // #191 故障注入：只在显式 --fault 时把接缝包成故障态；默认路径句柄原样、零影响。
      // 注入元数据（期望变红的检查）与页面内计数写进报告环境，读者不用翻代码就知道动过什么。
      let faultSession = null;
      let handles = { observe, input, persistence };
      if (bindings.faults.length > 0) {
        recorder.setEnvironment({ phase: 'fault-apply' });
        faultSession = await applyFaults({ ids: bindings.faults, handles: { client, observe, input, persistence } });
        handles = {
          observe: faultSession.handles.observe,
          input: faultSession.handles.input,
          persistence: faultSession.handles.persistence,
        };
      }
      // 失败产物：套件跑完（无论是否抛错）先给 FAIL 检查补截图/页面状态/store/输入日志，
      // 再进入清理（关 CDP / 浏览器之后就采不到了）。故障态要在卸载前采集。
      try {
        await SUITES[bindings.suite]({
          bindings,
          recorder,
          client,
          server,
          prepared,
          shotsDir: runContext.shotsDir,
          workDir: runContext.workDir,
          timeouts: bindings.timeouts,
          fixture: preparedFixture,
          observe: handles.observe,
          input: handles.input,
          persistence: handles.persistence,
          faults: faultSession ? faultSession.injectors : [],
        });
      } finally {
        await captureFailureArtifacts({ recorder, client, observe: handles.observe, persistence: handles.persistence, input: handles.input }).catch((error) => {
          // 产物采集自身失败不能改变判定，只记进环境供报告读者参考。
          recorder.setEnvironment({ artifactCapture: { ok: false, error: String(error && error.message ? error.message : error) } });
        });
        if (faultSession) {
          let uninstall;
          try {
            uninstall = await faultSession.uninstall();
          } catch (error) {
            uninstall = { error: String(error && error.message ? error.message : error) };
          }
          recorder.setEnvironment({
            faults: {
              mode: 'injected',
              injectors: faultSession.injectors,
              evidence: faultSession.evidence,
              uninstall,
            },
          });
          const results = uninstall && uninstall.results ? Object.values(uninstall.results) : [];
          const broken = results.filter((item) => item && item.restored === false);
          if (broken.length > 0) {
            recorder.toolFault('故障注入回滚失败', JSON.stringify(broken));
          }
        }
      }
      recorder.setEnvironment({ phase: 'done' });
    } else if (!preflight.ok) {
      recorder.setEnvironment({ phase: 'preflight-blocked' });
    } else {
      recorder.setEnvironment({ phase: 'fixture-blocked' });
    }
  } catch (error) {
    const message = error instanceof HarnessError ? error.message : String(error && error.stack ? error.stack : error);
    // 装配/环境问题 → BLOCKED（退出码 2）；运行器自身未预期异常 → 工具故障（退出码 3），
    // 绝不让工具故障冒充产品失败。
    if (error instanceof HarnessError) {
      recorder.blocked('装配环节', message);
    } else {
      recorder.toolFault('运行器未预期异常', message);
    }
  } finally {
    recorder.setEnvironment({ phase: 'cleanup' });
    const cleanup = { keptWorkDir: Boolean(bindings.keep) };
    try {
      if (client) {
        await client.close();
        cleanup.cdpClosed = true;
      }
    } catch (error) {
      cleanup.cdpClosed = false;
      recorder.blocked('CDP 连接收尾', String(error && error.message ? error.message : error));
    }
    try {
      if (browser) {
        const closed = await browser.close();
        cleanup.browser = { pid: closed.pid, exited: closed.exited, cdpPort: browser.cdpPort };
        // 进程退出后调试端口可能还压几拍才释放：等它，而不是一拍定生死。
        cleanup.browserCdpPortFree = await waitForPortFree(browser.cdpPort, 5_000);
      }
    } catch (error) {
      recorder.blocked('浏览器收尾', String(error && error.message ? error.message : error));
    }
    try {
      if (server) {
        const stopped = await server.stop();
        cleanup.server = stopped;
        cleanup.serverPortFree = await isPortFree(stopped.port);
      }
    } catch (error) {
      recorder.blocked('宿主服务收尾', String(error && error.message ? error.message : error));
    }
    if (!bindings.keep) {
      try {
        fs.rmSync(runContext.workDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
        cleanup.workDirPath = runContext.workDir;
        cleanup.workDirRemoved = !fs.existsSync(runContext.workDir);
        // 本次运行目录删掉后，把已经空了的 workRoot 也收掉（非递归，非空则留着不动）。
        try {
          fs.rmdirSync(bindings.workRoot);
          cleanup.workRootRemoved = !fs.existsSync(bindings.workRoot);
        } catch {
          cleanup.workRootRemoved = false;
          cleanup.workRootKept = fs.existsSync(bindings.workRoot);
        }
      } catch (error) {
        cleanup.workDirRemoved = false;
        recorder.blocked('清理一次性工作目录', String(error && error.message ? error.message : error));
      }
    }
    recorder.setEnvironment({ cleanup });
    const written = writeReport(recorder, runContext.evidenceDir);
    return { ...written, runContext };
  }
}

function printSummary(result, bindings) {
  const { reportPath, markdownPath, report, runContext } = result;
  console.log('[real] runTag=' + report.runTag);
  console.log('[real] 产物 ' + bindings.artifact.name + '@' + bindings.artifact.version + '  sha256=' + bindings.artifact.sha256);
  console.log('[real] 宿主 CLI ' + bindings.dshCli + '（' + bindings.hostVersion + '）');
  console.log('[real] 浏览器 ' + bindings.browser);
  if (bindings.contractFault) console.log('[real] 契约注入项 ' + bindings.contractFault + '（负例：只让该契约项不匹配）');
  if (bindings.faults.length > 0) {
    console.log('[real] 故障注入 ' + bindings.faults.join(', ') + '（显式开启；默认关闭，期望变红的检查见报告 environment.faults）');
  }
  const fixture = report.environment && report.environment.fixture ? report.environment.fixture : null;
  if (fixture) {
    const state = fixture.ok === null ? '未读回' : fixture.ok ? '匹配声明' : '与声明不符（BLOCKED）';
    console.log(
      '[real] fixture ' + fixture.name +
        (fixture.request && fixture.request !== fixture.name ? '（请求 ' + fixture.request + '）' : '') +
        (fixture.fault ? '  故障注入=' + fixture.fault : '') +
        '  起始态=' + state,
    );
  }
  const summary = report.summary;
  console.log(
    '[real] PASS ' + summary.PASS + ' / FAIL ' + summary.FAIL + ' / BLOCKED ' + summary.BLOCKED + ' / N-A ' + (summary['N-A'] || 0) +
      '  ->  ' + report.verdict + '（exitCode=' + report.exitCode + '）',
  );
  if (summary.expectedFailures > 0) {
    console.log('[real] 预期失败 ' + summary.expectedFailures + ' 条（不计入产品失败，退出码按 0 计）');
  }
  if (summary.failureTypes && (summary.FAIL > 0 || summary.BLOCKED > 0)) {
    console.log(
      '[real] FAIL 分型：产品 ' + summary.failureTypes.product + ' / 规格 ' + summary.failureTypes.spec +
        ' / 测试假象 ' + summary.failureTypes.test + ' / 工具 ' + summary.failureTypes.tool +
        '；工具故障（含阻塞）' + summary.toolFaults + ' 条',
    );
  }
  for (const check of report.checks) {
    if (check.verdict === 'PASS') continue;
    const expectedTag = check.expectedFailure === true ? '（预期失败）' : '';
    const typeTag = check.verdict === 'FAIL' && check.failureType ? '[' + check.failureType + ']' : '';
    const tail = check.reason ? '：' + check.reason : check.observed !== undefined ? '：observed=' + JSON.stringify(check.observed) : '';
    console.log('  [' + check.verdict + ']' + typeTag + expectedTag + ' ' + check.name + tail);
  }
  console.log('[real] 证据: ' + reportPath);
  console.log('[real] 摘要: ' + markdownPath);
  if (bindings.keep) console.log('[real] 工作目录已保留: ' + runContext.workDir);
}

async function main() {
  let bindings;
  try {
    bindings = resolveBindings(process.argv.slice(2));
  } catch (error) {
    if (error instanceof HarnessError) {
      console.error('[real][BLOCKED] ' + error.message);
      console.error('');
      console.error(usage());
      return 2;
    }
    throw error;
  }
  if (bindings.help) {
    console.log(usage());
    return 0;
  }
  if (!SUITES[bindings.suite]) {
    console.error('[real][BLOCKED] 未知套件: ' + bindings.suite + '。可用套件: ' + Object.keys(SUITES).join(', '));
    return 2;
  }
  // 配方名/路径在装配前先校验一次：typo 直接给可操作错误，不必先花几十秒起宿主。
  try {
    loadFixture(bindings.fixture);
  } catch (error) {
    if (error instanceof FixtureError) {
      console.error('[real][BLOCKED] ' + error.message);
      return 2;
    }
    throw error;
  }
  // 故障注入 id 在装配前先校验一次：typo 直接给可操作错误，不必先花几十秒起宿主。
  try {
    assertKnownFaultIds(bindings.faults);
  } catch (error) {
    if (error instanceof HarnessError) {
      console.error('[real][BLOCKED] ' + error.message);
      return 2;
    }
    throw error;
  }
  const result = await execute(bindings);
  printSummary(result, bindings);
  // 退出码由报告层统一映射：0 全绿 / 1 有真实 FAIL / 2 BLOCKED / 3 工具故障。
  return typeof result.report.exitCode === 'number' ? result.report.exitCode : 2;
}

main()
  .then((code) => {
    process.exit(typeof code === 'number' ? code : 0);
  })
  .catch((error) => {
    console.error('[real][TOOL-FAULT] 运行器崩溃: ' + String(error && error.stack ? error.stack : error));
    process.exit(3);
  });
