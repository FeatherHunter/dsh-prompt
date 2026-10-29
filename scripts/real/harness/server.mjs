/**
 * 宿主 Web 服务生命周期：启动、解析访问 URL、等 HTTP 就绪、干净收尾。
 *
 * 收尾规则（实测）：Windows 上 dsh 是 .cmd 启动器，真正的监听进程是孙进程；
 * 只杀 shell 父进程会留下监听者，所以杀进程树后再用端口兜底确认。
 * URL 里的 token 只用于导航，写进证据前一律打码。
 */

import fs from 'node:fs';
import path from 'node:path';

import { HarnessError } from './errors.mjs';
import { findPortOwner, killTree, redactUrl, sleep, startLongRunning, waitForExit, waitForPortFree } from './proc.mjs';
import { childEnv } from './profile.mjs';

const URL_PATTERN = /dsh web:\s*(http:\/\/127\.0\.0\.1:\d+\/\?token=\S+)/;

function tail(text, limit = 1600) {
  const s = String(text ?? '');
  return s.length > limit ? s.slice(-limit) : s;
}

async function fetchProbe(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const first = await fetch(url, { signal: controller.signal, redirect: 'manual' });
    let cookie = '';
    try {
      const setCookies = typeof first.headers.getSetCookie === 'function' ? first.headers.getSetCookie() : [];
      cookie = setCookies.map((value) => String(value).split(';')[0]).join('; ');
    } catch {
      cookie = '';
    }
    if (first.status >= 300 && first.status < 400) {
      const next = new URL(first.headers.get('location') || '/', url).toString();
      const second = await fetch(next, { signal: controller.signal, redirect: 'follow', headers: cookie ? { cookie } : {} });
      const body = await second.text();
      return { status: second.status, bytes: body.length, body, tokenStatus: first.status, authenticated: Boolean(cookie) };
    }
    const body = await first.text();
    return { status: first.status, bytes: body.length, body, tokenStatus: first.status, authenticated: false };
  } catch (error) {
    return { error };
  } finally {
    clearTimeout(timer);
  }
}

export async function startWebServer({ homeDir, profileName, dshCli, port = 0, timeouts, workDir, env }) {
  fs.mkdirSync(workDir, { recursive: true });
  const stdoutPath = path.join(workDir, 'server.out.log');
  const stderrPath = path.join(workDir, 'server.err.log');
  const stdoutFd = fs.openSync(stdoutPath, 'w');
  const stderrFd = fs.openSync(stderrPath, 'w');
  const child = startLongRunning(dshCli, ['--profile', profileName, '--port', String(port), '--no-open'], {
    cwd: workDir,
    env: childEnv(homeDir, env),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout = (stdout + chunk.toString('utf8')).slice(-200_000);
    fs.writeSync(stdoutFd, chunk);
  });
  child.stderr.on('data', (chunk) => {
    stderr = (stderr + chunk.toString('utf8')).slice(-200_000);
    fs.writeSync(stderrFd, chunk);
  });

  const deadline = Date.now() + timeouts.serverStartMs;
  let url = null;
  while (Date.now() < deadline) {
    const match = URL_PATTERN.exec(stdout);
    if (match) {
      url = match[1];
      break;
    }
    if (child.exitCode !== null) {
      throw new HarnessError(
        'DSH web 服务提前退出（exit=' + String(child.exitCode) + '）。stderr 末尾：\n' + tail(stderr) + '\nstdout 末尾：\n' + tail(stdout),
      );
    }
    await sleep(100);
  }
  if (!url) {
    killTree(child.pid);
    throw new HarnessError('等待 DSH web URL 超时（' + timeouts.serverStartMs + 'ms）。stdout 末尾：\n' + tail(stdout));
  }

  let probe = null;
  const probeDeadline = Date.now() + timeouts.pageLoadMs;
  while (Date.now() < probeDeadline) {
    probe = await fetchProbe(url, 10_000);
    if (probe.status === 200) break;
    await sleep(250);
  }
  if (!probe || probe.status !== 200) {
    killTree(child.pid);
    throw new HarnessError(
      'DSH web 页面加载失败（' + redactUrl(url) + '）：' +
        (probe?.error ? String(probe.error) : 'HTTP ' + String(probe?.status ?? 'unknown')) +
        '。stderr 末尾：\n' + tail(stderr),
    );
  }

  const parsed = new URL(url);
  const actualPort = Number(parsed.port);
  const origin = parsed.origin;
  let stopped = false;

  async function stop() {
    if (stopped) return { port: actualPort, portFree: true, alreadyStopped: true };
    stopped = true;
    try {
      fs.closeSync(stdoutFd);
    } catch {
      /* 已关 */
    }
    try {
      fs.closeSync(stderrFd);
    } catch {
      /* 已关 */
    }
    killTree(child.pid);
    await waitForExit(child, timeouts.shutdownMs);
    let free = await waitForPortFree(actualPort, 5_000);
    if (!free) {
      const owner = findPortOwner(actualPort);
      if (owner) {
        killTree(owner);
        free = await waitForPortFree(actualPort, 5_000);
      }
    }
    if (!free) {
      throw new HarnessError('端口 ' + actualPort + ' 在收尾后仍被占用，一次性宿主没有清理干净');
    }
    return { port: actualPort, portFree: free, alreadyStopped: false };
  }

  return {
    child,
    pid: child.pid,
    url,
    redactedUrl: redactUrl(url),
    origin,
    port: actualPort,
    httpStatus: probe.status,
    htmlBytes: probe.bytes,
    html: probe.body,
    stdoutPath,
    stderrPath,
    readLogs: () => ({ stdout, stderr }),
    stop,
  };
}
