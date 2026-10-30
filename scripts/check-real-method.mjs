#!/usr/bin/env node
/**
 * 方法层文档门禁（#193）。
 *
 * 方法层（用户级 skill、onboarding 配方、边界政策、分层 ADR、docs/real 索引）
 * 的使命是「换机器 / 换宿主版本 / 换插件 / 换人也能直接照做」，
 * 因此文档里只允许占位符与运行期参数，不允许任何本机绑定值：
 * 盘符绝对路径、用户主目录、固定端口、浏览器安装路径、固定 locale、IPv4 字面量……
 *
 * 同时校验 skill 里的契约常量与 `scripts/real/harness/report/model.mjs` 保持同步，
 * 防止方法层文档与实现层常量各说各话。
 *
 * 用法：
 *   node scripts/check-real-method.mjs             扫描方法层文档
 *   node scripts/check-real-method.mjs --selftest  用故意违规样本证明门禁能红
 *   node scripts/check-real-method.mjs --help
 *
 * 退出码：0 全绿 / 1 有违规或 selftest 失败 / 2 用法错误。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VERDICTS,
  FAILURE_TYPE_IDS,
  EVIDENCE_TUPLE_FIELDS,
} from './real/harness/report/model.mjs';

/** 仓库根（本文件位于 scripts/ 下）。 */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_ROOT = path.join(REPO_ROOT, 'skills');
const SAMPLES_ROOT = path.join(REPO_ROOT, 'scripts', 'real', 'method', 'samples');
const DOC_TARGETS = [
  'docs/real/README.md',
  'docs/real/onboarding.md',
  'docs/real/boundary-policy.md',
  'docs/adr/0011-real-test-kit-layering.md',
];

/* ───────────────────────────── 机器特定值规则 ───────────────────────────── */

/** 方法层文档禁止出现的本机绑定值。`id` 供 selftest 断言命中规则。 */
export const MACHINE_VALUE_RULES = [
  {
    id: 'M1',
    title: '盘符绝对路径',
    pattern: /(?<![A-Za-z0-9_])[A-Za-z]:[\\/]/,
  },
  {
    id: 'M2',
    title: 'POSIX 主目录/系统目录绝对路径',
    pattern: /(?:^|[^\w])\/(?:home|Users|root|opt|usr|tmp|var|mnt|Volumes|private)\//,
  },
  {
    id: 'M3',
    title: '本机用户名目录',
    pattern: /[\\/]Users[\\/][^\\/\s"'`]+/i,
  },
  {
    id: 'M4',
    title: '固定主机与端口',
    pattern: /\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0)\s*:\s*[1-9]\d{0,4}\b/,
  },
  {
    id: 'M5',
    title: '浏览器安装路径',
    pattern: /Program Files|(?:Microsoft|Google)[\\/](?:Edge|Chrome)[\\/]|(?:msedge|chrome|chromium)\.exe/i,
  },
  {
    id: 'M6',
    title: '固定 locale',
    pattern: /\b(?:zh-CN|zh_CN|zh-Hans|zh-Hant|en-US|en_US)\b/,
  },
  {
    id: 'M7',
    title: '宿主安装位置/本机数据目录',
    pattern: /AppData[\\/](?:Roaming|Local)|DeepseekHarness|DeepSeek[\\/]Harness/i,
  },
  {
    id: 'M8',
    title: 'IPv4 字面量',
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
  },
];

/**
 * 逐行检测方法层文档里的本机绑定值。
 * @param {string} text
 * @returns {{ruleId: string, title: string, line: number, snippet: string}[]}
 */
export function detectMachineValues(text) {
  const hits = [];
  const lines = String(text).split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const rule of MACHINE_VALUE_RULES) {
      if (rule.pattern.test(line)) {
        hits.push({
          ruleId: rule.id,
          title: rule.title,
          line: index + 1,
          snippet: snippetOf(line),
        });
      }
    }
  }
  return hits;
}

/* ───────────────────────────── skill 结构校验 ───────────────────────────── */

/**
 * 解析 Markdown frontmatter（`---` 包住的 `key: value` 行）。
 * @param {string} text
 * @returns {{fields: Map<string, string>} | null}
 */
export function parseFrontmatter(text) {
  const lines = String(text).split(/\r?\n/);
  if (lines.length === 0 || lines[0].trim() !== '---') return null;
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (end === -1) return null;
  const fields = new Map();
  for (const line of lines.slice(1, end)) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (match) fields.set(match[1], match[2].trim().replace(/^['"]|['"]$/g, ''));
  }
  return { fields };
}

/**
 * 校验 SKILL.md 的 frontmatter：必须有 name（kebab-case）与 description；
 * 打包形态 `skills/<name>/SKILL.md` 的 name 必须与目录名一致。
 * @param {{text: string, expectedName?: string}} input
 * @returns {{ruleId: string, message: string}[]}
 */
export function checkSkillFrontmatter(input = {}) {
  const { text = '', expectedName } = input;
  const violations = [];
  const frontmatter = parseFrontmatter(text);
  if (!frontmatter) {
    violations.push({ ruleId: 'S1', message: '缺少 frontmatter（首行是 `---`，内含 name/description）' });
    return violations;
  }
  const name = (frontmatter.fields.get('name') ?? '').trim();
  const description = (frontmatter.fields.get('description') ?? '').trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    violations.push({ ruleId: 'S2', message: `name 必须是 kebab-case，实际是 ${JSON.stringify(name)}` });
  }
  if (description.length === 0) {
    violations.push({ ruleId: 'S3', message: 'description 不能为空' });
  }
  if (expectedName && name && name !== expectedName) {
    violations.push({
      ruleId: 'S4',
      message: `name（${name}）必须与目录名（${expectedName}）一致`,
    });
  }
  return violations;
}

/** 方法层 skill 必须与实现层同步的常量块。 */
const CONTRACT_EXPECTATIONS = [
  { key: 'VERDICTS', values: VERDICTS },
  { key: 'FAILURE_TYPE_IDS', values: FAILURE_TYPE_IDS },
  { key: 'EVIDENCE_TUPLE_FIELDS', values: EVIDENCE_TUPLE_FIELDS },
];

function splitContractValues(raw) {
  return String(raw)
    .split('|')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * 校验 skill 里声明的判定分类 / 失败分型 / 证据六元组字段与实现层常量一致。
 * 约定文档里有一段被 `method-contract:start/end` 注释包住的常量块。
 * @param {string} text
 * @returns {{ruleId: string, message: string}[]}
 */
export function checkContractBlock(text) {
  const violations = [];
  const match = String(text).match(
    /<!--\s*method-contract:start\s*-->\s*([\s\S]*?)<!--\s*method-contract:end\s*-->/,
  );
  if (!match) {
    violations.push({
      ruleId: 'C1',
      message: '缺少 method-contract 常量块（用 <!-- method-contract:start/end --> 包住 VERDICTS / FAILURE_TYPE_IDS / EVIDENCE_TUPLE_FIELDS）',
    });
    return violations;
  }
  const declared = new Map();
  for (const line of match[1].split(/\r?\n/)) {
    const lineMatch = line.match(/^([A-Z_]+):\s*(.*)$/);
    if (lineMatch) declared.set(lineMatch[1], lineMatch[2]);
  }
  for (const expectation of CONTRACT_EXPECTATIONS) {
    const raw = declared.get(expectation.key);
    if (raw === undefined) {
      violations.push({ ruleId: 'C2', message: `契约块缺少 ${expectation.key}` });
      continue;
    }
    const actual = splitContractValues(raw);
    const expected = expectation.values;
    if (actual.length !== expected.length || actual.some((item, index) => item !== expected[index])) {
      violations.push({
        ruleId: 'C3',
        message: `${expectation.key} 与实现层不同步：文档=${JSON.stringify(actual)}，实现=${JSON.stringify(expected)}`,
      });
    }
  }
  return violations;
}

/* ───────────────────────────── 扫描 ───────────────────────────── */

function relativePath(file) {
  return path.relative(REPO_ROOT, file).split(path.sep).join('/');
}

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function walkMarkdown(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(entryPath);
      else if (entry.isFile() && entry.name.endsWith('.md')) files.push(entryPath);
    }
  }
  files.sort();
  return files;
}

function snippetOf(line) {
  const trimmed = line.trim();
  return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
}

/**
 * 扫描一份方法层文档。
 * @param {string} file
 * @param {{root?: string}} options  `root` 用于 skill 结构校验的目录名比对
 */
export function scanDocument(file, options = {}) {
  const text = readText(file);
  const violations = detectMachineValues(text).map((hit) => ({
    file: relativePath(file),
    line: hit.line,
    ruleId: hit.ruleId,
    title: hit.title,
    detail: hit.snippet,
  }));

  const isSkill = path.basename(file) === 'SKILL.md';
  if (!isSkill) return violations;

  const expectedName = options.root ? path.basename(options.root) : undefined;
  for (const item of checkSkillFrontmatter({ text, expectedName })) {
    violations.push({
      file: relativePath(file),
      line: 1,
      ruleId: item.ruleId,
      title: 'skill frontmatter',
      detail: item.message,
    });
  }
  for (const item of checkContractBlock(text)) {
    violations.push({
      file: relativePath(file),
      line: 1,
      ruleId: item.ruleId,
      title: '契约常量同步',
      detail: item.message,
    });
  }
  return violations;
}

/**
 * 正式扫描：skills/ 下全部方法层文档 + 固定文档清单。
 * @returns {{files: string[], violations: object[]}}
 */
export function scanAll() {
  const files = [];
  const violations = [];
  const skillFiles = walkMarkdown(SKILLS_ROOT);
  for (const file of skillFiles) files.push(file);
  for (const doc of DOC_TARGETS) {
    const file = path.join(REPO_ROOT, doc);
    if (!fs.existsSync(file)) {
      violations.push({
        file: doc,
        line: 0,
        ruleId: 'M0',
        title: '方法层文档缺失',
        detail: '必需的方法层文档不存在',
      });
      continue;
    }
    files.push(file);
  }
  if (skillFiles.length === 0) {
    violations.push({
      file: 'skills/',
      line: 0,
      ruleId: 'M0',
      title: '方法层 skill 缺失',
      detail: 'skills/ 下没有任何 SKILL.md',
    });
  }
  for (const file of files) {
    const root = file.startsWith(SKILLS_ROOT + path.sep) ? path.dirname(file) : undefined;
    violations.push(...scanDocument(file, { root }));
  }
  return { files, violations };
}

function printViolation(violation) {
  const where = violation.line > 0 ? `${violation.file}:${violation.line}` : violation.file;
  console.log(`FAIL ${where} [${violation.ruleId}] ${violation.title} :: ${violation.detail}`);
}

/* ───────────────────────────── selftest ───────────────────────────── */

function readSample(...parts) {
  const file = path.join(SAMPLES_ROOT, ...parts);
  if (!fs.existsSync(file)) throw new Error(`样本不存在：${relativePath(file)}`);
  return { file, text: readText(file) };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function contractText(verdicts, failureTypes, tupleFields) {
  return [
    '<!-- method-contract:start -->',
    `VERDICTS: ${verdicts.join(' | ')}`,
    `FAILURE_TYPE_IDS: ${failureTypes.join(' | ')}`,
    `EVIDENCE_TUPLE_FIELDS: ${tupleFields.join(' | ')}`,
    '<!-- method-contract:end -->',
  ].join('\n');
}

function runSelftest() {
  const failures = [];
  const record = (ok, name, detail) => {
    if (ok) {
      console.log(`PASS ${name}`);
    } else {
      failures.push(name);
      console.log(`FAIL ${name}${detail ? ` :: ${detail}` : ''}`);
    }
  };
  const check = (name, body) => {
    try {
      body();
      record(true, name);
    } catch (error) {
      record(false, name, error.message);
    }
  };

  const badCases = [
    ['bad/m1-drive-path.md', 'M1'],
    ['bad/m2-posix-home.md', 'M2'],
    ['bad/m3-users-name.md', 'M3'],
    ['bad/m4-fixed-port.md', 'M4'],
    ['bad/m5-browser-path.md', 'M5'],
    ['bad/m6-locale.md', 'M6'],
    ['bad/m7-host-install.md', 'M7'],
    ['bad/m8-ipv4.md', 'M8'],
  ];
  for (const [sample, expectedRule] of badCases) {
    check(`坏样本被拒：${sample} → ${expectedRule}`, () => {
      const { text } = readSample(sample);
      const hits = detectMachineValues(text);
      assert(
        hits.some((hit) => hit.ruleId === expectedRule),
        `期望命中 ${expectedRule}，实际 ${JSON.stringify(hits.map((hit) => hit.ruleId))}`,
      );
    });
  }

  check('好样本不误报：good/clean.md', () => {
    const { text } = readSample('good/clean.md');
    const hits = detectMachineValues(text);
    assert(hits.length === 0, `误报 ${JSON.stringify(hits)}`);
  });

  check('结构坏样本被拒：frontmatter 缺 description', () => {
    const { text } = readSample('bad-frontmatter/SKILL.md');
    const violations = checkSkillFrontmatter({ text, expectedName: 'bad-frontmatter' });
    assert(violations.length > 0, '缺 description 却未报错');
  });

  check('结构好样本通过：frontmatter 合法', () => {
    const { text } = readSample('good/SKILL.md');
    const violations = checkSkillFrontmatter({ text, expectedName: 'real-evidence' });
    assert(violations.length === 0, JSON.stringify(violations));
  });

  check('frontmatter name 与目录名不一致被拒', () => {
    const { text } = readSample('good/SKILL.md');
    const violations = checkSkillFrontmatter({ text, expectedName: 'other-skill' });
    assert(violations.length > 0, '目录名不一致却未报错');
  });

  check('契约常量块与实现一致时通过', () => {
    const text = contractText(VERDICTS, FAILURE_TYPE_IDS, EVIDENCE_TUPLE_FIELDS);
    const violations = checkContractBlock(text);
    assert(violations.length === 0, JSON.stringify(violations));
  });

  check('契约常量漂移被拒：判定分类少一类', () => {
    const tampered = contractText(VERDICTS.slice(0, 3), FAILURE_TYPE_IDS, EVIDENCE_TUPLE_FIELDS);
    const violations = checkContractBlock(tampered);
    assert(violations.length > 0, '判定分类漂移却未报错');
  });

  check('契约常量漂移被拒：证据六元组字段不一致', () => {
    const tampered = contractText(VERDICTS, FAILURE_TYPE_IDS, ['claim', 'verdict']);
    const violations = checkContractBlock(tampered);
    assert(violations.length > 0, '六元组漂移却未报错');
  });

  check('契约块缺失被拒', () => {
    const violations = checkContractBlock('# 没有契约块的 skill');
    assert(violations.length > 0, '缺契约块却未报错');
  });

  const failed = failures.length;
  console.log(`RESULT: ${failed} FAIL（方法层门禁自证：坏样本必须被拒、好样本必须通过）`);
  return failed === 0 ? 0 : 1;
}

/* ───────────────────────────── CLI ───────────────────────────── */

function usage() {
  return [
    '用法：node scripts/check-real-method.mjs [--selftest] [--help]',
    '',
    '扫描方法层文档（skills/**、docs/real/README.md、docs/real/onboarding.md、',
    'docs/real/boundary-policy.md、docs/adr/0011-real-test-kit-layering.md）：',
    '命中本机绑定值（盘符路径、用户主目录、固定端口、浏览器安装路径、固定 locale、',
    'IPv4 字面量……）即 FAIL；同时校验 skill 契约常量与 harness/report/model.mjs 同步。',
    '',
    '--selftest  用 scripts/real/method/samples/ 下的坏/好样本证明门禁能红也能绿',
    '--help      打印本帮助',
  ].join('\n');
}

function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(usage());
    return 0;
  }
  if (argv.includes('--selftest')) {
    return runSelftest();
  }
  if (argv.length > 0) {
    console.error(`[method] 未知参数：${argv.join(' ')}`);
    console.error(usage());
    return 2;
  }

  const { files, violations } = scanAll();
  const skillCount = files.filter((file) => file.startsWith(SKILLS_ROOT + path.sep)).length;
  console.log(`[method] 扫描 ${files.length} 个方法层文档（skill ${skillCount} / docs ${files.length - skillCount}）`);
  for (const violation of violations) printViolation(violation);
  console.log(`RESULT: ${violations.length} FAIL`);
  return violations.length === 0 ? 0 : 1;
}

const isEntry = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntry) {
  process.exitCode = main(process.argv.slice(2));
}
