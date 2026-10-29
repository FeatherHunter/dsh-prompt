/**
 * 无头浏览器生命周期：用临时 user-data-dir 起一个可丢弃的浏览会话。
 *
 * 端口用 --remote-debugging-port=0，由浏览器写 DevToolsActivePort 文件告知实际端口，
 * 避免固定端口在同一台机器上互相踩。收尾同样杀进程树，不留下孤儿。
 */

import fs from 'node:fs';
import path from 'node:path';

import { HarnessError } from './errors.mjs';
import { killTree, sleep, startLongRunning, waitForExit } from './proc.mjs';

export function devtoolsPortFile(userDataDir) {
  return path.join(userDataDir, 'DevToolsActivePort');
}

async function readBrowserVersion(cdpPort) {
  try {
    const response = await fetch('http://127.0.0.1:' + cdpPort + '/json/version');
    if (!response.ok) return null;
    const data = await response.json();
    return { browser: data.Browser ?? null, protocolVersion: data['Protocol-Version'] ?? null, webSocketDebuggerUrl: data.webSocketDebuggerUrl ?? null };
  } catch {
    return null;
  }
}

export async function launchBrowser({ browser, userDataDir, timeouts, env, width = 1440, height = 900 }) {
  fs.mkdirSync(userDataDir, { recursive: true });
  try {
    fs.rmSync(devtoolsPortFile(userDataDir), { force: true });
  } catch {
    /* 首次运行没有该文件 */
  }
  const args = [
    '--headless=new',
    '--remote-debugging-port=0',
    '--user-data-dir=' + userDataDir,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-features=Translate,MediaRouter',
    '--window-size=' + width + ',' + height,
  ];
  if (process.platform === 'linux') args.push('--no-sandbox', '--disable-dev-shm-usage');
  args.push('about:blank');

  const child = startLongRunning(browser, args, {
    env: env ?? process.env,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr = (stderr + chunk.toString('utf8')).slice(-20_000);
  });

  const portFile = devtoolsPortFile(userDataDir);
  const deadline = Date.now() + timeouts.browserStartMs;
  let cdpPort = null;
  let wsPath = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new HarnessError('无头浏览器提前退出（exit=' + String(child.exitCode) + '）：\n' + stderr.slice(-1200));
    }
    try {
      const lines = fs.readFileSync(portFile, 'utf8').split(/\r?\n/).filter(Boolean);
      const candidate = Number(lines[0]);
      if (Number.isFinite(candidate) && candidate > 0) {
        cdpPort = candidate;
        wsPath = lines[1] ?? '';
        break;
      }
    } catch {
      /* 还没写出来 */
    }
    const stderrMatch = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(stderr);
    if (stderrMatch) {
      cdpPort = Number(stderrMatch[1]);
      break;
    }
    await sleep(100);
  }
  if (!cdpPort) {
    killTree(child.pid);
    throw new HarnessError('无头浏览器没有写出 DevToolsActivePort（' + timeouts.browserStartMs + 'ms）：' + portFile);
  }

  const version = await readBrowserVersion(cdpPort);
  let closed = false;

  async function close() {
    if (closed) return { pid: child.pid, exited: child.exitCode !== null, alreadyClosed: true };
    closed = true;
    killTree(child.pid);
    await waitForExit(child, 10_000);
    if (child.exitCode === null) {
      killTree(child.pid);
      await waitForExit(child, 5_000);
    }
    return { pid: child.pid, exited: child.exitCode !== null, alreadyClosed: false };
  }

  return { pid: child.pid, cdpPort, wsPath, version, userDataDir, close };
}
