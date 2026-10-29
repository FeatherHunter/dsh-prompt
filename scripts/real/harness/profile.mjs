/**
 * 一次性宿主 profile：从默认模板种子化 → 安装被测产物 → 断言装配结果。
 *
 * 关键事实（2026-10 实测，DSH CLI 0.2.1-rc.3）：
 * - 直接 plugin add 到空 DSH_HOME 只会得到 base + 插件，web-app 不会自动加入，
 *   boot 时插件停在 waiting for service: webServer；
 * - 正确做法是先用 --from-default-profile web --dump-config 生成 web profile 骨架
 *   （--dump-config 只写配置、不启动服务），再 plugin add。
 * 这些是平台契约，等 #185 收进契约模块后，这里只保留机械步骤。
 */

import fs from 'node:fs';
import path from 'node:path';

import { HarnessError } from './errors.mjs';
import { runCommand } from './proc.mjs';

const CONTAMINATING_DSH_ENV = ['DSH_PROFILE', 'DSH_PROFILE_DIR', 'DSH_SESSION_ID', 'DSH_WEB_URL'];

/** 一次性 home 的子进程环境：只钉 DSH_HOME，剔掉会指向真实环境的 DSH_*。 */
export function childEnv(homeDir, env) {
  const out = { ...(env ?? process.env), DSH_HOME: homeDir };
  for (const key of CONTAMINATING_DSH_ENV) delete out[key];
  return out;
}

export function profileDirOf(homeDir, profileName) {
  return path.join(homeDir, 'profiles', profileName);
}

/** bundle 清单的权威位置是 package.json 的 dsh.profile.bundles；兼容旧的顶层 bundles。 */
function readBundles(pkg) {
  const nested = pkg && pkg.dsh && pkg.dsh.profile && Array.isArray(pkg.dsh.profile.bundles) ? pkg.dsh.profile.bundles : null;
  if (nested) return nested;
  return Array.isArray(pkg && pkg.bundles) ? pkg.bundles : [];
}

function tail(text, limit = 1200) {
  const s = String(text ?? '');
  return s.length > limit ? s.slice(-limit) : s;
}

function requireSuccess(label, result) {
  if (result.status === 0) return;
  const reason = result.timedOut ? '超时' : 'exit=' + String(result.status);
  throw new HarnessError(label + '失败（' + reason + '）。输出末尾：\n' + tail(result.stderr || result.stdout));
}

export function verifyProfileSkeleton(homeDir, profileName) {
  const pkgPath = path.join(profileDirOf(homeDir, profileName), 'package.json');
  if (!fs.existsSync(pkgPath)) {
    throw new HarnessError('profile 骨架没有生成 package.json：' + pkgPath + '。检查 --from-default-profile web --dump-config 是否成功。');
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const bundles = readBundles(pkg);
  if (!bundles.includes('@deepseek-ai/dsh-web-app')) {
    throw new HarnessError(
      '默认 web profile 骨架缺少 @deepseek-ai/dsh-web-app bundle，无法起 Web 宿主：' + pkgPath + '（bundles=' + JSON.stringify(bundles) + '）',
    );
  }
  return { packagePath: pkgPath, bundles };
}

export function seedWebProfile({ homeDir, profileName, dshCli, env, timeoutMs }) {
  fs.mkdirSync(path.join(homeDir, 'profiles'), { recursive: true });
  const result = runCommand(dshCli, ['--profile', profileName, '--from-default-profile', 'web', '--dump-config'], {
    env: childEnv(homeDir, env),
    timeoutMs,
  });
  requireSuccess('种子化 web profile', result);
  return verifyProfileSkeleton(homeDir, profileName);
}

export function verifyInstallation(homeDir, profileName, artifact) {
  const dir = profileDirOf(homeDir, profileName);
  const pkgPath = path.join(dir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const deps = pkg.dependencies ?? {};
  const bundles = readBundles(pkg);
  if (!(artifact.name in deps)) {
    throw new HarnessError('profile 依赖里没有 ' + artifact.name + '：' + pkgPath + '（dependencies=' + JSON.stringify(deps) + '）');
  }
  if (!bundles.includes(artifact.name)) {
    throw new HarnessError('profile bundles 里没有 ' + artifact.name + '：' + pkgPath + '（bundles=' + JSON.stringify(bundles) + '）');
  }
  const modulePkgPath = path.join(dir, 'node_modules', ...artifact.name.split('/'), 'package.json');
  if (!fs.existsSync(modulePkgPath)) {
    throw new HarnessError('插件没有装进 profile：' + modulePkgPath);
  }
  const modulePkg = JSON.parse(fs.readFileSync(modulePkgPath, 'utf8'));
  if (modulePkg.version !== artifact.version) {
    throw new HarnessError(
      '装进去的版本与产物不一致：profile=' + String(modulePkg.version) + '，产物=' + artifact.version + '（' + modulePkgPath + '）',
    );
  }
  return { profileDir: dir, profilePackagePath: pkgPath, installedVersion: modulePkg.version, bundles };
}

export function installArtifact({ homeDir, profileName, dshCli, artifact, env, timeoutMs }) {
  const fileUrl = 'file:' + String(artifact.path).replace(/\\/g, '/');
  const result = runCommand(dshCli, ['plugin', '--profile', profileName, 'add', fileUrl], {
    env: childEnv(homeDir, env),
    timeoutMs,
  });
  requireSuccess('安装插件产物', result);
  return verifyInstallation(homeDir, profileName, artifact);
}

/** 一键装配：种子化 + 安装 + 校验，返回装配产物与证据所需的元信息。 */
export function bootstrapDisposableProfile({ homeDir, profileName, dshCli, artifact, env, timeouts }) {
  const skeleton = seedWebProfile({ homeDir, profileName, dshCli, env, timeoutMs: timeouts.seedProfileMs });
  const installed = installArtifact({ homeDir, profileName, dshCli, artifact, env, timeoutMs: timeouts.installPluginMs });
  return {
    homeDir,
    profileName,
    skeletonBundles: Array.isArray(skeleton.bundles) ? skeleton.bundles : [],
    ...installed,
  };
}
