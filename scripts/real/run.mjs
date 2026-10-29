#!/usr/bin/env node
/**
 * 真机 kit 入口：一条命令装配一次性宿主、安装被测产物、起无头浏览器、跑套件、出证据。
 *
 * 退出码：0 = PASS；1 = FAIL（产品不符合期望）；2 = BLOCKED（装配/工具没就绪或未知套件）。
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
import { runSmoke } from './suites/smoke.mjs';

const SUITES = {
  smoke: runSmoke,
};

async function execute(bindings) {
  const runContext = createRunContext({ bindings, suite: bindings.suite });
  const recorder = new Recorder({ suite: bindings.suite, runTag: runContext.runTag });
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
    recorder.setEnvironment({ page: prepared.facts, startupGate: prepared.gate.gateActions });
    await client.screenshot(path.join(runContext.shotsDir, 'boot.png'));

    recorder.setEnvironment({ phase: 'suite:' + bindings.suite });
    await SUITES[bindings.suite]({
      bindings,
      recorder,
      client,
      server,
      prepared,
      shotsDir: runContext.shotsDir,
      workDir: runContext.workDir,
      timeouts: bindings.timeouts,
    });
    recorder.setEnvironment({ phase: 'done' });
  } catch (error) {
    const message = error instanceof HarnessError ? error.message : String(error && error.stack ? error.stack : error);
    recorder.blocked(error instanceof HarnessError ? '装配环节' : '运行器未预期异常', message);
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
  const { reportPath, report, runContext } = result;
  console.log('[real] runTag=' + report.runTag);
  console.log('[real] 产物 ' + bindings.artifact.name + '@' + bindings.artifact.version + '  sha256=' + bindings.artifact.sha256);
  console.log('[real] 宿主 CLI ' + bindings.dshCli + '（' + bindings.hostVersion + '）');
  console.log('[real] 浏览器 ' + bindings.browser);
  const summary = report.summary;
  console.log(
    '[real] PASS ' + summary.PASS + ' / FAIL ' + summary.FAIL + ' / BLOCKED ' + summary.BLOCKED + ' / N-A ' + (summary['N-A'] || 0) + '  ->  ' + report.verdict,
  );
  for (const check of report.checks) {
    if (check.verdict === 'PASS') continue;
    const tail = check.reason ? '：' + check.reason : check.observed !== undefined ? '：observed=' + JSON.stringify(check.observed) : '';
    console.log('  [' + check.verdict + '] ' + check.name + tail);
  }
  console.log('[real] 证据: ' + reportPath);
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
  const result = await execute(bindings);
  printSummary(result, bindings);
  if (result.report.verdict === 'PASS') return 0;
  return result.report.verdict === 'FAIL' ? 1 : 2;
}

main()
  .then((code) => {
    process.exit(typeof code === 'number' ? code : 0);
  })
  .catch((error) => {
    console.error('[real][BLOCKED] 运行器崩溃: ' + String(error && error.stack ? error.stack : error));
    process.exit(2);
  });
