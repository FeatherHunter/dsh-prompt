// 由 dsh-plugin-update@0.1.1 的集成工具生成，人手不改。
// 生成命令：node dsh-plugin-update/derive-client-values.mjs --prefix prompt --out <本文件路径>
// 生成对象：dsh-prompt。改了前缀或想升级本包，重新跑一次这条命令即可。
// node_modules/dsh-plugin-update/dist/config.js
var DEFAULT_CONFIRMATION_TTL_MS = 10 * 6e4;
var DEFAULT_INSTALL_TIMEOUT_MS = 15 * 6e4;
var DEFAULT_PANEL_POLL_MS = 1e3;
var MIN_PANEL_POLL_MS = 250;
function assertPrefix(value, role) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("[dsh-plugin-update] " + role + " \u975E\u6CD5\uFF1A\u987B\u4E3A\u975E\u7A7A\u5B57\u7B26\u4E32\uFF08\u6536\u5230 " + JSON.stringify(value) + "\uFF09");
  }
  if (value.includes(".") || value.includes("/") || value.includes("\\") || /\s/.test(value)) {
    throw new Error("[dsh-plugin-update] " + role + " \u975E\u6CD5\uFF1A\u4E0D\u5F97\u542B\u6709\u70B9\u3001\u8DEF\u5F84\u5206\u9694\u7B26\u6216\u7A7A\u767D\uFF08\u6536\u5230 " + JSON.stringify(value) + "\uFF09");
  }
  return value;
}
function buildPhoneNames(prefix) {
  const checked = assertPrefix(prefix, "\u7535\u8BDD\u540D\u524D\u7F00 prefix");
  return {
    updateStatus: checked + ".updateStatus",
    updateCheck: checked + ".updateCheck",
    updateInstall: checked + ".updateInstall"
  };
}
function buildPhoneName(prefix, action) {
  return buildPhoneNames(prefix)[action];
}

// node_modules/dsh-plugin-update/dist/commands.js
var PACKAGE_NAME = "dsh-mattpocock-skills-deck";
var NPM_REGISTRY = "https://registry.npmjs.org/";
var INSTALL_TIMEOUT_MS = 15 * 6e4;
function validVersion(v) {
  return typeof v === "string" && /^\d+\.\d+\.\d+$/.test(v);
}
function parseTriple(v) {
  const parts = String(v).split(".");
  if (parts.length > 3) return null;
  const nums = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const n = Number(p);
    if (!Number.isSafeInteger(n)) return null;
    nums.push(n);
  }
  while (nums.length < 3) nums.push(0);
  return [nums[0], nums[1], nums[2]];
}
function compareVersions(a, b) {
  const pa = parseTriple(a);
  const pb = parseTriple(b);
  if (!pa || !pb) throw new Error("invalid-release");
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}
function usableProfileName(raw) {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name || name.length > 255 || name.startsWith("-")) return null;
  if ([".", "..", "node_modules"].includes(name)) return null;
  return name;
}
function manualCommand(input) {
  if (input.sourceInstall || input.blockedReason === "source-install" || input.blockedReason === "unknown-profile") return null;
  const name = usableProfileName(input.profileName);
  if (!name) return null;
  const targetName = input.targetPackageName ?? PACKAGE_NAME;
  const registry = input.registryUrl ?? NPM_REGISTRY;
  if (!targetName || !registry) return null;
  const arg = /^[A-Za-z0-9_.-]+$/.test(name) ? name : JSON.stringify(name);
  const picks = [input.latestVersion, input.jobTargetVersion, input.installedVersion].filter(validVersion);
  let version = picks.length > 0 ? picks[0] : "latest";
  try {
    const ranked = picks.filter((v) => compareVersions(v, input.runningVersion) >= 0);
    if (ranked.length > 0) {
      version = ranked[0];
      for (const v of ranked) if (compareVersions(v, version) === 1) version = v;
    }
  } catch {
  }
  return `dsh plugin --profile ${arg} add --save-exact ${targetName}@${version} --registry=${registry}`;
}

// node_modules/dsh-plugin-update/dist/client.js
var CLIENT_POLL = {
  defaultMs: DEFAULT_PANEL_POLL_MS,
  minMs: MIN_PANEL_POLL_MS
};
function buildClientPhoneNames(prefix) {
  return buildPhoneNames(prefix);
}
function assertPollInterval(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < MIN_PANEL_POLL_MS) {
    throw new Error("[dsh-plugin-update] \u9762\u677F\u8F6E\u8BE2\u95F4\u9694\u975E\u6CD5\uFF1A\u4E0D\u5F97\u5C0F\u4E8E 250 \u6BEB\u79D2\uFF08\u6536\u5230 " + JSON.stringify(ms) + "\uFF09");
  }
  return ms;
}

// ---- 取值：从更新包的客户端入口算出本插件要用的电话名与轮询间隔 ----
// 面板只该用下面这几个常量，不要再写死电话名字面量与轮询数字。
const UPD_PHONE_NAMES = buildClientPhoneNames("prompt")
const UPD_POLL_MS = CLIENT_POLL.defaultMs
const UPD_POLL_MIN_MS = CLIENT_POLL.minMs
export const UPD_STATUS = UPD_PHONE_NAMES.updateStatus
export const UPD_CHECK = UPD_PHONE_NAMES.updateCheck
export const UPD_INSTALL = UPD_PHONE_NAMES.updateInstall
export const UPD_POLL = UPD_POLL_MS
export const UPD_POLL_MIN = UPD_POLL_MIN_MS
