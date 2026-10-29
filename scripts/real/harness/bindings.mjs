/**
 * 运行期绑定解析：真机 kit 需要的机器相关值都在这里变成显式输入。
 *
 * 三层分离（对应 spec #183）：
 * - 方法层：与机器无关的协议/判据，不在本文件；
 * - 平台契约层：宿主行为事实，后续收进 contract（#185）；
 * - 运行期绑定层（本文件）：CLI 路径、浏览器路径、产物路径、临时目录、端口、超时。
 *   所有值都能用参数或环境变量覆盖；无法解析时给一条可操作错误，而不是堆栈。
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import { fileURLToPath } from 'node:url';

import { HarnessError } from './errors.mjs';
import { IS_WIN, runCommand } from './proc.mjs';

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url));

/** 仓库根目录（scripts/real/harness 的上三级）。 */
export const REPO_ROOT = path.resolve(HARNESS_DIR, '..', '..', '..');

export const DEFAULT_TIMEOUTS = {
  seedProfileMs: 120_000,
  installPluginMs: 180_000,
  serverStartMs: 90_000,
  browserStartMs: 30_000,
  pageLoadMs: 60_000,
  pluginReadyMs: 40_000,
  panelMs: 8_000,
  shutdownMs: 20_000,
};

const USAGE = [
  '用法: node scripts/real/run.mjs --artifact <插件打包产物.tgz> [options]',
  '',
  '必要:',
  '  --artifact <path>        插件 .tgz 打包产物路径（或 DSH_REAL_ARTIFACT）',
  '',
  '可选:',
  '  --suite <name>           套件，默认 smoke',
  '  --dsh-cli <path>         DSH CLI（或 DSH_REAL_DSH_CLI / DSH_CLI / PATH）',
  '  --browser <path>         无头浏览器（或 DSH_REAL_BROWSER）',
  '  --workdir <path>         一次性工作目录根（或 DSH_REAL_WORKDIR）',
  '  --evidence-dir <path>    证据目录根（或 DSH_REAL_EVIDENCE_DIR，默认仓库 .tmp-real）',
  '  --port <n>               指定端口；默认 0 由宿主自选',
  '  --timeout-scale <x>      超时倍率（或 DSH_REAL_TIMEOUT_SCALE）',
  '  --keep                   保留工作目录便于排查（默认清理）',
  '  --help                   打印本帮助',
].join('\n');

export function usage() {
  return USAGE;
}

export function parseArgs(argv) {
  const out = { positional: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      out.help = true;
      continue;
    }
    if (token === '--keep') {
      out.keep = true;
      continue;
    }
    if (token.startsWith('--')) {
      const eq = token.indexOf('=');
      const key = eq >= 0 ? token.slice(2, eq) : token.slice(2);
      out[key] = eq >= 0 ? token.slice(eq + 1) : argv[++i];
      continue;
    }
    out.positional.push(token);
  }
  return out;
}

function whichCommand(name) {
  const r = runCommand(IS_WIN ? 'where.exe' : 'which', [name], { timeoutMs: 20_000 });
  if (r.status !== 0) return null;
  const first = r.stdout.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
  return first || null;
}

function describeDshVersion(abs) {
  const versionRun = runCommand(abs, ['--version'], { timeoutMs: 30_000 });
  if (versionRun.status !== 0) {
    throw new HarnessError(
      'DSH CLI 无法执行 --version（' + abs + '）：' + (versionRun.stderr || versionRun.stdout).slice(0, 500) +
        '。检查 --dsh-cli / DSH_REAL_DSH_CLI 是否指向可执行的 dsh。',
    );
  }
  return versionRun.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
}

function resolveDshCli(args, env) {
  const explicit = args['dsh-cli'] ?? env.DSH_REAL_DSH_CLI ?? env.DSH_CLI ?? null;
  if (explicit) {
    // 显式给了就是契约：找不到直接报，不再悄悄退回 PATH——否则调用方以为自己测的是这个 CLI。
    const abs = path.isAbsolute(explicit) ? explicit : (whichCommand(explicit) ?? path.resolve(explicit));
    if (!fs.existsSync(abs)) {
      throw new HarnessError(
        '指定的 DSH CLI 不存在：' + abs + '。修正 --dsh-cli / DSH_REAL_DSH_CLI / DSH_CLI 指向 dsh 可执行文件（Windows 常见位置 <DSH 安装目录>\\runtime\\cli\\bin\\dsh.cmd）。',
      );
    }
    return { exe: abs, source: '显式参数/环境变量', version: describeDshVersion(abs) };
  }
  const fromPath = whichCommand('dsh') ?? (IS_WIN ? whichCommand('dsh.cmd') : null);
  if (fromPath) return { exe: fromPath, source: 'PATH', version: describeDshVersion(fromPath) };
  throw new HarnessError(
    '找不到 DSH CLI。设置 DSH_REAL_DSH_CLI=<dsh 可执行文件路径>，或把 dsh 加入 PATH（Windows 常见位置 <DSH 安装目录>\\runtime\\cli\\bin\\dsh.cmd）。',
  );
}

function browserCandidates(env) {
  const out = [];
  if (process.platform === 'win32') {
    const programFiles = env.ProgramFiles || 'C:\\\\Program Files';
    const programFilesX86 = env['ProgramFiles(x86)'] || 'C:\\\\Program Files (x86)';
    const localAppData = env.LOCALAPPDATA || '';
    out.push({ path: path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), source: 'Windows Edge' });
    out.push({ path: path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), source: 'Windows Edge' });
    out.push({ path: path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'), source: 'Windows Chrome' });
    out.push({ path: path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'), source: 'Windows Chrome' });
    if (localAppData) out.push({ path: path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'), source: 'Windows Chrome' });
    return out;
  }
  if (process.platform === 'darwin') {
    out.push({ path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', source: 'macOS Chrome' });
    out.push({ path: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', source: 'macOS Edge' });
    out.push({ path: '/Applications/Chromium.app/Contents/MacOS/Chromium', source: 'macOS Chromium' });
    return out;
  }
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'microsoft-edge-stable']) {
    out.push({ path: '/usr/bin/' + name, source: 'Linux ' + name });
    out.push({ path: '/usr/local/bin/' + name, source: 'Linux ' + name });
  }
  return out;
}

function resolveBrowser(args, env) {
  const explicit = args.browser ?? env.DSH_REAL_BROWSER ?? env.CHROME_PATH ?? env.EDGE_PATH ?? null;
  const tried = [];
  if (explicit) {
    // 显式给了就是契约：缺失直接报，不悄悄换成本机另一个浏览器。
    const abs = path.resolve(explicit);
    if (!fs.existsSync(abs)) {
      throw new HarnessError(
        '指定的无头浏览器不存在：' + abs + '。修正 --browser / DSH_REAL_BROWSER 指向 Edge / Chrome / Chromium 可执行文件（Windows 例如 C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe）。',
      );
    }
    return { exe: abs, source: '显式参数/环境变量' };
  }
  for (const candidate of browserCandidates(env)) {
    tried.push(candidate.source + ': ' + candidate.path);
    if (fs.existsSync(candidate.path)) return { exe: candidate.path, source: candidate.source };
  }
  for (const name of ['msedge', 'chrome', 'google-chrome', 'chromium']) {
    const found = whichCommand(name);
    if (found) {
      tried.push('PATH: ' + found);
      return { exe: found, source: 'PATH' };
    }
  }
  throw new HarnessError(
    '找不到可用的无头浏览器（Edge / Chrome / Chromium）。设置 DSH_REAL_BROWSER=<浏览器可执行文件路径>。已尝试：' + tried.join('；'),
  );
}

function readTgzEntries(tgzPath, wantedNames) {
  const gz = fs.readFileSync(tgzPath);
  let tar;
  try {
    tar = zlib.gunzipSync(gz);
  } catch (error) {
    throw new HarnessError('产物不是合法的 gzip/tar 包：' + tgzPath + '（' + error.message + '）');
  }
  const wanted = new Set(wantedNames);
  const found = {};
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    if (!name) break;
    const sizeText = header.subarray(124, 136).toString('ascii').replace(/\0.*$/, '').trim();
    const size = parseInt(sizeText, 8);
    if (!Number.isFinite(size) || size < 0) break;
    const bodyStart = offset + 512;
    if (wanted.has(name)) found[name] = tar.subarray(bodyStart, bodyStart + size).toString('utf8');
    offset = bodyStart + Math.ceil(size / 512) * 512;
  }
  return found;
}

/** 读产物元信息：版本、大小、摘要、包名。摘要进证据，保证报告可对回具体产物。 */
export function inspectArtifact(artifactPath) {
  const abs = path.resolve(artifactPath);
  if (!fs.existsSync(abs)) {
    throw new HarnessError('找不到打包产物：' + abs + '。先用 npm pack 生成 .tgz，或用 --artifact 指向已有产物。');
  }
  const stat = fs.statSync(abs);
  if (!stat.isFile()) throw new HarnessError('--artifact 需要指向一个文件：' + abs);
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
  const files = readTgzEntries(abs, ['package/package.json']);
  const raw = files['package/package.json'];
  if (!raw) throw new HarnessError('产物里没有 package/package.json，无法确认插件身份：' + abs);
  let pkg;
  try {
    pkg = JSON.parse(raw);
  } catch (error) {
    throw new HarnessError('产物 package/package.json 不是合法 JSON：' + error.message);
  }
  if (!pkg.name || !pkg.version) throw new HarnessError('产物 package.json 缺少 name / version：' + abs);
  return { path: abs, fileName: path.basename(abs), sizeBytes: stat.size, sha256, name: pkg.name, version: pkg.version };
}

/** 解析全部运行期绑定。抛 HarnessError 时给可操作的错误文本。 */
export function resolveBindings(argv, env = process.env) {
  const args = parseArgs(argv);
  if (args.help) return { help: true };
  const artifactArg = args.artifact ?? env.DSH_REAL_ARTIFACT ?? null;
  if (!artifactArg) {
    throw new HarnessError('缺少打包产物。用法：node scripts/real/run.mjs --artifact <path-to.tgz> [--suite smoke]。也可用环境变量 DSH_REAL_ARTIFACT 传入。');
  }
  const artifact = inspectArtifact(artifactArg);
  const dsh = resolveDshCli(args, env);
  const browser = resolveBrowser(args, env);
  const workRoot = path.resolve(args.workdir ?? env.DSH_REAL_WORKDIR ?? path.join(os.tmpdir(), 'dsh-prompt-real'));
  const evidenceRoot = path.resolve(args['evidence-dir'] ?? env.DSH_REAL_EVIDENCE_DIR ?? path.join(REPO_ROOT, '.tmp-real'));
  const timeouts = { ...DEFAULT_TIMEOUTS };
  const scale = Number(args['timeout-scale'] ?? env.DSH_REAL_TIMEOUT_SCALE ?? '1');
  if (Number.isFinite(scale) && scale > 0 && scale !== 1) {
    for (const key of Object.keys(timeouts)) timeouts[key] = Math.round(timeouts[key] * scale);
  }
  const port = args.port == null ? 0 : Number(args.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new HarnessError('--port 需要是 0..65535 的整数：' + args.port);
  return {
    args,
    artifact,
    dshCli: dsh.exe,
    dshCliSource: dsh.source,
    hostVersion: dsh.version,
    browser: browser.exe,
    browserSource: browser.source,
    workRoot,
    evidenceRoot,
    timeouts,
    suite: args.suite ?? 'smoke',
    port,
    keep: Boolean(args.keep) || env.DSH_REAL_KEEP === '1',
    env,
  };
}
