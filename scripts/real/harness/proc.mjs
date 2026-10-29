/**
 * 进程与端口底座：启动命令、杀进程树、探测端口。
 *
 * 只回答"怎么跑"，不包含任何被测产品假设。跨平台策略：
 * - Windows 用 cmd.exe 启动（dsh 是 .cmd 启动器），杀进程树用 taskkill /T /F；
 * - POSIX 用 /bin/sh -c，子进程独立进程组，杀进程组。
 */

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';

export const IS_WIN = process.platform === 'win32';

/** 给 shell 命令行用的参数引用（不是给 spawn 数组参数用的）。 */
export function quoteShellArg(arg) {
  const s = String(arg);
  if (IS_WIN) {
    if (s === '') return '""';
    return /[\s"&|<>^()%!]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  return /[^\w@%+=:,./-]/.test(s) ? "'" + s.replace(/'/g, "'\\''") + "'" : s;
}

export function buildCommandLine(command, args = []) {
  return [command, ...args].map(quoteShellArg).join(' ');
}

function shellInvocation(line) {
  if (IS_WIN) {
    // cmd /d /s /c 的经典包裹：整条命令再套一层引号，否则 /s 会剥掉
    // 第一个带引号参数的外层引号（含空格路径就会被拆断）。
    return {
      file: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', '"' + line + '"'],
      windowsVerbatimArguments: true,
    };
  }
  return { file: '/bin/sh', args: ['-c', line], windowsVerbatimArguments: false };
}

/** 同步跑一条命令，返回 { status, stdout, stderr, timedOut, error }。 */
export function runCommand(command, args = [], options = {}) {
  const line = buildCommandLine(command, args);
  const inv = shellInvocation(line);
  const res = spawnSync(inv.file, inv.args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: options.encoding ?? 'utf8',
    timeout: options.timeoutMs ?? 120_000,
    windowsHide: true,
    windowsVerbatimArguments: inv.windowsVerbatimArguments,
    stdio: options.stdio ?? 'pipe',
  });
  const timedOut = res.error?.code === 'ETIMEDOUT' || res.signal === 'SIGTERM';
  return {
    status: res.status,
    stdout: typeof res.stdout === 'string' ? res.stdout : (res.stdout?.toString('utf8') ?? ''),
    stderr: typeof res.stderr === 'string' ? res.stderr : (res.stderr?.toString('utf8') ?? ''),
    timedOut,
    error: res.error ?? null,
  };
}

/** 异步起一个长生命周期进程（服务、浏览器）。返回 child_process.ChildProcess。 */
export function startLongRunning(command, args = [], options = {}) {
  const line = buildCommandLine(command, args);
  const inv = shellInvocation(line);
  return spawn(inv.file, inv.args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    windowsHide: true,
    windowsVerbatimArguments: inv.windowsVerbatimArguments,
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
    detached: !IS_WIN,
  });
}

/** 杀进程树。pid 是 shellInvocation 启动出来的 shell 进程。 */
export function killTree(pid) {
  if (!pid) return;
  if (IS_WIN) {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, encoding: 'utf8' });
    return;
  }
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      /* 已经退出 */
    }
  }
}

export function waitForExit(child, timeoutMs = 20_000) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null || child.signalCode !== null) {
      resolve(true);
      return;
    }
    let done = false;
    const finish = (exited) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(exited);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    child.once('exit', () => finish(true));
  });
}

export function isPortFree(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    const done = (free) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(free);
    };
    socket.setTimeout(500);
    socket.once('connect', () => done(false));
    socket.once('timeout', () => done(true));
    socket.once('error', () => done(true));
  });
}

export async function waitForPortFree(port, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await isPortFree(port)) return true;
    if (Date.now() > deadline) return false;
    await sleep(200);
  }
}

/** 端口监听者 PID（树杀失败时兜底用）。拿不到返回 null。 */
export function findPortOwner(port) {
  if (IS_WIN) {
    const r = runCommand('powershell.exe', [
      '-NoProfile',
      '-Command',
      '(Get-NetTCPConnection -LocalPort ' + Number(port) + ' -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess',
    ], { timeoutMs: 30_000 });
    const n = Number(r.stdout.trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const lsof = runCommand('lsof', ['-ti', 'tcp:' + Number(port), '-sTCP:LISTEN'], { timeoutMs: 30_000 });
  const n = Number((lsof.stdout.split(/\r?\n/)[0] ?? '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 把 token 从 URL/日志里打码，写进报告与错误信息。 */
export function redactUrl(text) {
  return String(text ?? '').replace(/([?&]token=)[^\s"'&]+/g, '$1***');
}

/** 读文件尾部（错误现场用）。文件不存在时返回 ''。 */
export function readFileTail(file, maxBytes = 4096) {
  try {
    const stat = fs.statSync(file);
    const start = Math.max(0, stat.size - maxBytes);
    const fd = fs.openSync(file, 'r');
    try {
      const buf = Buffer.alloc(stat.size - start);
      fs.readSync(fd, buf, 0, buf.length, start);
      return buf.toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return '';
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
