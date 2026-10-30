/**
 * 宿主契约（#185）：把真机套件依赖的宿主行为事实收敛成一份**版本钉数据 + 纯探测函数**。
 *
 * 分层：
 * - 本文件 = 契约数据（版本范围、识别条件、期望形状、失败后果、升级路径）+ 纯函数探测
 *   （输入是"运行期观测"，输出是可断言的形状）。零 IO、零浏览器、零网络。
 * - harness/contract/preflight.mjs = 检查执行：从 CDP / 宿主进程 / 磁盘采集观测，调本文件判定。
 * - harness/contract/selftest.mjs = 纯 Node 自证：单项伪造只红该项；改契约常量即可适配新宿主。
 *
 * 版本钉原则：宿主版本超出 knownGoodRange 时 preflight 必须 BLOCKED（而不是带着未知行为
 * 去跑套件、把宿主差异误报成产品 FAIL）。升级路径 = 改本文件的版本/形状常量 + 在
 * docs/real/host-contract.md 记一条实测，用例层零改动。
 */

export const CONTRACT_VERSION = 1;

/** 真机负例用：DSH_REAL_CONTRACT_FAULT=<id> 时只替换该观测，模拟宿主升级后的形状变化。 */
export const CONTRACT_FAULT_IDS = [
  'host.startup-output',
  'host.startup-gates',
  'host.input-actions',
  'host.storage-schema',
  'host.ui-locale',
  'host.versions',
];

/**
 * 契约数据。每一项都带：适用版本范围、探测方式、期望形状、失败后果、升级路径。
 * 数据只写"实测成立"的形状；没实测过的行为不臆造。
 */
export const HOST_CONTRACT = {
  version: CONTRACT_VERSION,

  // ---- 宿主与浏览器版本窗口（实测：DSH 0.2.1-rc.3 + Edge 156 / Windows，2026-10-30）----
  host: {
    engineRange: '>=0.2.0-rc.2',
    knownGoodRange: '>=0.2.0-rc.2 <=0.2.1-rc.3',
    tested: ['0.2.1-rc.3'],
  },
  browser: {
    products: ['Edg', 'Chrome', 'Chromium', 'HeadlessChrome'],
    minMajor: 112, // --headless=new 与 CDP Input/Runtime 的实测下限
    tested: { Edg: [156], Chrome: [156] },
  },

  // ---- ① `dsh web` 启动输出与 token URL ----
  startup: {
    // 实测原文（stdout 单行）：dsh web: http://127.0.0.1:<port>/?token=<token>
    linePattern: '^dsh web: (http://127\\.0\\.0\\.1:(\\d+)/\\?token=([A-Za-z0-9_-]{20,}))$',
    allowPreambleLines: false,
    tokenMinLength: 20,
    expectedHttpStatus: 200,
  },

  // ---- ② 登录门 / 预览提示：识别条件、关闭方式、验证观测 ----
  gates: {
    overlay: {
      bodyDirectTag: 'DIV',
      position: 'fixed',
      minZIndex: 100,
      minWidthRatio: 0.9,
      minHeightRatio: 0.9,
    },
    continueLabels: ['继续', 'Continue', '跳过', 'Skip', '知道了', 'Got it', 'OK'],
    phases: [
      {
        id: 'preview',
        // 实测：同一遮罩容器先显示「预览版说明」，主按钮「继续」。
        textKeys: ['预览版说明', 'Preview'],
        actions: ['click:继续', 'click:Continue', 'click:跳过', 'click:Skip', 'click:知道了', 'click:Got it', 'click:OK'],
      },
      {
        id: 'login',
        // 实测：点掉预览后同一容器切成登录提示；一次性实例没有凭证，
        // 契约允许并只允许在本次会话里隐藏（不改产品、不点登录）。
        textKeys: ['登录 DeepSeek', '添加 API Key', 'Log in', 'Sign in', 'API Key'],
        actions: ['hide-gate'],
      },
    ],
    allowedActions: [
      'remove-inert',
      'click:继续',
      'click:Continue',
      'click:跳过',
      'click:Skip',
      'click:知道了',
      'click:Got it',
      'click:OK',
      'hide-gate',
    ],
    maxRounds: 4,
    post: {
      maxVisibleOverlays: 0,
      rootInert: false,
      rootAriaHiddenDisallowed: 'true',
      minComposerCount: 1,
    },
  },

  // ---- ③ 编辑器输入 actions 模型（宿主公开面）----
  inputActions: {
    requiredMethods: ['captureInsertion', 'insertText', 'setDraft'],
    methodTypes: { captureInsertion: 'function', insertText: 'function', setDraft: 'function' },
    captureInsertion: {
      types: { start: 'number', end: 'number', draftRev: 'number' },
      invariant: 'start<=end',
    },
    // 草稿读取口径：Lexical contenteditable DOM 的 innerText；以下标记属性是读草稿的锚点。
    composer: {
      selector: '[contenteditable="true"]',
      minCount: 1,
      requiredAttrs: [
        { name: 'contenteditable', value: 'true' },
        { name: 'role', value: 'textbox' },
        { name: 'data-composer-input' },
      ],
    },
    // 写入语义（文档用；preflight 只做只读能力探测，写入行为由套件覆盖）：
    // - captureInsertion(): {start,end,draftRev}；无选区时文末折叠。
    // - insertText(text, {draftRev,start,end}): boolean；rev 不匹配/不可编辑时 false；
    //   paste 语义 = 一次独立可撤销编辑，光标落在插入文本之后。
    // - setDraft(text): 整框替换，history-merge 并入当前步（不是独立撤销步），光标置尾。
    // - 没有 setCaret/setSelection 这类指定光标 API。
    writes: {
      captureInsertion: '{start,end,draftRev}：当前草稿选区（无选择时文末折叠）与修订号',
      insertText: 'boolean(text, {draftRev,start,end})：rev 不匹配或不可编辑时 false，一次独立可撤销编辑',
      setDraft: '整框替换（history-merge，不独立成撤销步），光标置尾',
      draftRead: '[data-composer-input] 的 innerText（Lexical contenteditable DOM）',
    },
  },

  // ---- ④ 持久化位置与顶层 schema ----
  storage: {
    // 实测：$DSH_HOME/storages/<域>.json，单文件单布局；顶层 unit/global/tables。
    rootRelative: 'storages',
    topKeys: ['unit', 'global', 'tables'],
    minSingleFiles: 1,
    // 插件域文件在"还没有模板写入"时不落盘是正常态，因此只记录存在性、不作必要条件。
    pluginDomain: { name: 'dsh_prompt', file: 'dsh_prompt.json' },
  },

  // ---- ⑤ 界面语言面 ----
  locale: {
    // 实测：唯一写入者是宿主 locale 服务；active=zh 时写 'zh-CN'，其余原样写。
    source: 'document.documentElement.lang',
    knownLocales: ['zh', 'en'],
    tagMapping: { zh: 'zh-CN', en: 'en' },
    // 切换方式（文档用）：宿主设置页 Language 行 → setLocale，live 生效不 reload；
    // 本 kit 只读 lang、不切语言、不写 lang。
    switchMechanism: '宿主设置页 Language 行（setLocale），不 reload；kit 只读不写',
  },

  // ---- 契约条目（文档与报告共用；顺序 = 检查顺序）----
  items: [
    {
      id: 'host.startup-output',
      title: 'web 启动输出形状与 token URL 解析',
      hostRange: '>=0.2.0-rc.2 <=0.2.1-rc.3',
      probe: '读 server.readLogs().stdout 原文，按 linePattern 逐行解析；解析端口必须等于实际监听端口；HTTP 探针 200。',
      expected: '单行 `dsh web: http://127.0.0.1:<port>/?token=<token>`；token 20+ 字符；端口与实际监听一致。',
      onFailure: '宿主地址无法解析或解析规则失效 → 浏览器进不去/证据 URL 不可信；后续判定全部不可归因。',
      upgradePath: '改本文件 startup.linePattern / allowPreambleLines / expectedHttpStatus，并在 docs/real/host-contract.md 记一条实测新形状。',
    },
    {
      id: 'host.startup-gates',
      title: '登录门与预览提示的识别/关闭/验证',
      hostRange: '>=0.2.0-rc.2 <=0.2.1-rc.3',
      probe: 'preparePage 记录每轮识别结果（层级/尺寸/阶段/动作），preflight 复查关闭后状态：无可见全屏遮罩、#root 无 inert/aria-hidden、composer 在场。',
      expected: '预览提示用「继续」类按钮关闭；登录提示仅本次会话隐藏；关闭后页面可交互。',
      onFailure: '入口被遮罩挡住 → 悬停/点击类用例的失败会被误报成产品 FAIL（假 FAIL）。',
      upgradePath: '改 gates.overlay / gates.phases / continueLabels / post 常量；关闭逻辑在 harness/page.mjs，用例不动。',
    },
    {
      id: 'host.input-actions',
      title: '编辑器输入 actions 模型与能力探测',
      hostRange: '>=0.2.0-rc.2 <=0.2.1-rc.3',
      probe: '从 composer 的 React fiber 链找宿主 inputActions（不依赖插件内部），只读探测 captureInsertion 形状与方法存在性。',
      expected: 'captureInsertion/insertText/setDraft 均为函数；captureInsertion 返回 {start:number,end:number,draftRev:number} 且 start<=end；composer 带 contenteditable=true/role=textbox/data-composer-input。',
      onFailure: '输入类用例无法准备草稿/无法校验插入语义；继续跑只会得到不可归因的 FAIL。',
      upgradePath: '改 inputActions.requiredMethods / captureInsertion / composer 常量；探针字符串随字段更新。',
    },
    {
      id: 'host.storage-schema',
      title: '持久化数据位置与顶层 schema',
      hostRange: '>=0.2.0-rc.2 <=0.2.1-rc.3',
      probe: '读一次性 DSH_HOME 下的 storages/：宿主自建域文件必须按单布局落盘，顶层 unit/global/tables 可解析；记录插件域文件路径与存在性。',
      expected: '$DSH_HOME/storages/<域>.json，顶层 {unit:{name,version},global,tables}；插件域 dsh_prompt.json 在无写入前允许缺失。',
      onFailure: '存储根或布局漂移 → 持久化/备份类用例读写错位置，证据不可解释。',
      upgradePath: '改 storage.rootRelative/topKeys/minSingleFiles；插件域命名变化时同步 pluginDomain。',
    },
    {
      id: 'host.ui-locale',
      title: '界面语言面与切换方式',
      hostRange: '>=0.2.0-rc.2 <=0.2.1-rc.3',
      probe: '读 document.documentElement.lang 与 navigator.language，按宿主语义归一段（zh→zh-CN，其余原样）。',
      expected: 'lang 属于已知语言集合 {zh,en} 且等于映射写回形状（zh-CN / en）。',
      onFailure: '语言落在未知集合 → 依赖文案/语言面的用例与门识别文案表失效，应 BLOCKED 而不是出假 FAIL。',
      upgradePath: '改 locale.knownLocales/tagMapping（新增语言时加映射），并补门文案表。',
    },
    {
      id: 'host.versions',
      title: '宿主与浏览器版本探测',
      hostRange: '>=0.2.0-rc.2 <=0.2.1-rc.3',
      probe: '宿主版本取 `dsh --version`（绑定层），浏览器版本取 CDP /json/version 的 Browser 串。',
      expected: '宿主 semver 在 knownGoodRange 内；浏览器为 Chromium 系（Edg/Chrome/Chromium/HeadlessChrome）且主版本 >= 112。',
      onFailure: '版本在钉住窗口外 → 宿主行为可能已变，带着未知行为跑套件会产出不可归因的 FAIL。',
      upgradePath: '改 host.knownGoodRange/tested 与 browser.minMajor/tested（附实测记录），用例零改动。',
    },
  ],
};

/* ================================================================== */
/* 版本解析与比较                                                       */
/* ================================================================== */

/** 解析 semver（含预发布标识）：0.2.1-rc.3 → {major:0,minor:2,patch:1,prerelease:['rc','3']}。 */
export function parseSemver(text) {
  const matched = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(text ?? '').trim());
  if (!matched) return null;
  return {
    major: Number(matched[1]),
    minor: Number(matched[2]),
    patch: Number(matched[3]),
    prerelease: matched[4] ? matched[4].split('.') : [],
  };
}

function compareIdentifier(a, b) {
  const aNumeric = /^\d+$/.test(a);
  const bNumeric = /^\d+$/.test(b);
  if (aNumeric && bNumeric) return Number(a) - Number(b);
  if (aNumeric) return -1;
  if (bNumeric) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** semver 优先级比较（预发布 < 正式版；数字段按数字比）。 */
export function compareSemver(a, b) {
  if (!a || !b) throw new Error('compareSemver 需要可解析的 semver 对象');
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] - b[key];
  }
  const aPre = a.prerelease;
  const bPre = b.prerelease;
  if (aPre.length === 0 && bPre.length === 0) return 0;
  if (aPre.length === 0) return 1;
  if (bPre.length === 0) return -1;
  const length = Math.max(aPre.length, bPre.length);
  for (let i = 0; i < length; i += 1) {
    if (aPre[i] === undefined) return -1;
    if (bPre[i] === undefined) return 1;
    const compared = compareIdentifier(aPre[i], bPre[i]);
    if (compared !== 0) return compared;
  }
  return 0;
}

/** 区间只支持空格分隔的 >= / <= / > / < / = 片段（够钉版本窗口用）。 */
export function satisfiesRange(version, rangeText) {
  if (!version) return false;
  const tokens = String(rangeText ?? '').trim().split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const matched = /^(>=|<=|>|<|=)(.+)$/.exec(token);
    if (!matched) throw new Error('不支持的版本区间片段：' + token);
    const bound = parseSemver(matched[2]);
    if (!bound) throw new Error('版本区间里的版本不可解析：' + matched[2]);
    const compared = compareSemver(version, bound);
    const op = matched[1];
    const satisfied =
      (op === '>=' && compared >= 0) ||
      (op === '<=' && compared <= 0) ||
      (op === '>' && compared > 0) ||
      (op === '<' && compared < 0) ||
      (op === '=' && compared === 0);
    if (!satisfied) return false;
  }
  return true;
}

/** 解析 CDP Browser 串（如 Edg/156.0.4314.50）；非 Chromium 系返回 null。 */
export function parseBrowserVersion(browser) {
  const matched = /^(Edg|Chrome|Chromium|HeadlessChrome)\/(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(String(browser ?? '').trim());
  if (!matched) return null;
  return {
    product: matched[1],
    major: Number(matched[2]),
    full: matched[0],
  };
}

/* ================================================================== */
/* 观测 → 可断言的值                                                     */
/* ================================================================== */

/**
 * ① 启动输出解析。
 * 观测：{stdout, stderrBytes, httpStatus, serverPort}
 * 返回：{ok, problems[], lineCount, matched, port, tokenLength, redactedUrl}
 */
export function parseStartupOutput(stdout, { contract = HOST_CONTRACT.startup, serverPort } = {}) {
  const problems = [];
  const raw = String(stdout ?? '');
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!contract.allowPreambleLines && lines.length !== 1) {
    problems.push('启动输出应为 1 行非空输出，实际 ' + lines.length + ' 行');
  }
  let pattern;
  try {
    pattern = new RegExp(contract.linePattern);
  } catch (error) {
    return { ok: false, problems: ['契约 linePattern 不是合法正则：' + String(error && error.message)], lineCount: lines.length, matched: false, port: null, tokenLength: 0, redactedUrl: null };
  }
  const matchedIndex = lines.findIndex((line) => pattern.test(line));
  let port = null;
  let tokenLength = 0;
  let redactedUrl = null;
  if (matchedIndex < 0) {
    problems.push('没有一行匹配启动形状 ' + contract.linePattern);
  } else {
    const matched = pattern.exec(lines[matchedIndex]);
    redactedUrl = matched[1].replace(/token=.*$/, 'token=***');
    port = Number(matched[2]);
    tokenLength = matched[3].length;
    if (tokenLength < (contract.tokenMinLength ?? 0)) {
      problems.push('token 长度 ' + tokenLength + ' 小于契约下限 ' + contract.tokenMinLength);
    }
    if (Number.isFinite(serverPort) && port !== Number(serverPort)) {
      problems.push('解析端口 ' + port + ' 与实际监听端口 ' + serverPort + ' 不一致');
    }
  }
  return {
    ok: problems.length === 0,
    problems,
    lineCount: lines.length,
    matched: matchedIndex >= 0,
    matchedLineIndex: matchedIndex,
    port,
    tokenLength,
    redactedUrl,
  };
}

/** ② 登录门/预览提示。观测：{actions[], rounds[], visibleOverlays[], rootInert, rootAriaHidden, composerCount}。 */
export function probeGates(observation, { contract = HOST_CONTRACT.gates } = {}) {
  const problems = [];
  const obs = observation ?? {};
  const actions = Array.isArray(obs.actions) ? obs.actions : [];
  for (const action of actions) {
    if (!contract.allowedActions.includes(action)) problems.push('出现未登记的关闸动作：' + action);
  }
  const rounds = Array.isArray(obs.rounds) ? obs.rounds : [];
  for (const round of rounds) {
    if (!round || !round.action) continue;
    if (!round.phase) continue; // 未识别阶段：允许走兜底动作（hide-gate / remove-inert / 通用继续按钮）
    const phase = contract.phases.find((item) => item.id === round.phase);
    if (!phase) {
      problems.push('报告了契约里不存在的门阶段：' + round.phase);
      continue;
    }
    if (!phase.actions.includes(round.action)) {
      problems.push('门阶段 ' + phase.id + ' 的关闭动作 ' + round.action + ' 不在契约动作表 ' + JSON.stringify(phase.actions));
    }
  }
  const visibleOverlays = Array.isArray(obs.visibleOverlays) ? obs.visibleOverlays : [];
  if (visibleOverlays.length > (contract.post.maxVisibleOverlays ?? 0)) {
    problems.push('关闭后仍有 ' + visibleOverlays.length + ' 个可见全屏遮罩');
  }
  if (contract.post.rootInert === false && obs.rootInert === true) problems.push('#root 仍带 inert 属性');
  if (obs.rootAriaHidden === contract.post.rootAriaHiddenDisallowed) problems.push('#root 仍 aria-hidden="' + obs.rootAriaHidden + '"');
  if ((obs.composerCount ?? 0) < (contract.post.minComposerCount ?? 1)) {
    problems.push('composer 数量 ' + (obs.composerCount ?? 0) + ' 少于契约下限 ' + contract.post.minComposerCount);
  }
  return {
    ok: problems.length === 0,
    problems,
    actions,
    roundCount: rounds.length,
    visibleOverlays,
    rootInert: obs.rootInert,
    rootAriaHidden: obs.rootAriaHidden,
    composerCount: obs.composerCount,
  };
}

/** ③ 输入 actions。观测：{ok, err?, methods, capture, captureError?, composerCount, composer}。 */
export function probeInputActions(observation, { contract = HOST_CONTRACT.inputActions } = {}) {
  const problems = [];
  const obs = observation ?? {};
  if (obs.ok !== true) {
    problems.push('页面内无法取得宿主 inputActions：' + (obs.err || '未知原因'));
    return { ok: false, problems, methods: obs.methods ?? null, capture: obs.capture ?? null, composer: obs.composer ?? null, composerCount: obs.composerCount ?? 0 };
  }
  const methods = obs.methods && typeof obs.methods === 'object' ? obs.methods : {};
  for (const name of contract.requiredMethods) {
    if (!(name in methods)) {
      problems.push('缺少输入 action：' + name);
      continue;
    }
    const requiredType = contract.methodTypes[name];
    if (requiredType && methods[name] !== requiredType) {
      problems.push('输入 action ' + name + ' 类型为 ' + methods[name] + '，契约为 ' + requiredType);
    }
  }
  const capture = obs.capture;
  if (!capture || typeof capture !== 'object') {
    problems.push('captureInsertion() 没有返回对象' + (obs.captureError ? '（' + obs.captureError + '）' : ''));
  } else {
    for (const [key, type] of Object.entries(contract.captureInsertion.types)) {
      if (typeof capture[key] !== type) problems.push('captureInsertion.' + key + ' 类型为 ' + typeof capture[key] + '，契约为 ' + type);
    }
    if (typeof capture.start === 'number' && typeof capture.end === 'number' && capture.start > capture.end) {
      problems.push('captureInsertion 违反 start<=end：' + capture.start + '>' + capture.end);
    }
  }
  if ((obs.composerCount ?? 0) < contract.composer.minCount) {
    problems.push('composer 数量 ' + (obs.composerCount ?? 0) + ' 少于契约下限 ' + contract.composer.minCount);
  }
  const attrs = obs.composer && obs.composer.attrs ? obs.composer.attrs : null;
  if (!attrs) {
    problems.push('没有取到 composer 的标记属性');
  } else {
    for (const required of contract.composer.requiredAttrs) {
      if (!(required.name in attrs)) problems.push('composer 缺少标记属性 ' + required.name);
      else if (required.value !== undefined && attrs[required.name] !== required.value) {
        problems.push('composer 属性 ' + required.name + '=' + JSON.stringify(attrs[required.name]) + '，契约为 ' + JSON.stringify(required.value));
      }
    }
  }
  return { ok: problems.length === 0, problems, methods, capture, composer: obs.composer ?? null, composerCount: obs.composerCount ?? 0 };
}

/** ④ 存储位置与顶层 schema。观测：{root:{pathSuffix,exists,singles[]}, pluginFile:{name,exists}}。 */
export function probeStorage(observation, { contract = HOST_CONTRACT.storage } = {}) {
  const problems = [];
  const obs = observation ?? {};
  const root = obs.root ?? {};
  if (!root.exists) problems.push('存储根 ' + (root.pathSuffix ?? contract.rootRelative) + '/ 不存在');
  const singles = Array.isArray(root.singles) ? root.singles : [];
  if (singles.length < contract.minSingleFiles) {
    problems.push('存储根下单布局文件数量 ' + singles.length + ' 少于契约下限 ' + contract.minSingleFiles);
  }
  for (const file of singles) {
    if (!file || typeof file.name !== 'string') {
      problems.push('存储文件条目缺少文件名');
      continue;
    }
    if (file.parseError) {
      problems.push(file.name + ' 不是合法 JSON');
      continue;
    }
    const topKeys = Array.isArray(file.topKeys) ? file.topKeys : [];
    for (const key of contract.topKeys) {
      if (!topKeys.includes(key)) problems.push(file.name + ' 缺少顶层键 ' + key);
    }
    const unit = file.unit && typeof file.unit === 'object' ? file.unit : null;
    if (!unit) problems.push(file.name + ' 缺少 unit');
    else {
      if (typeof unit.name !== 'string' || unit.name.length === 0) problems.push(file.name + '.unit.name 不是非空字符串');
      if (typeof unit.version !== 'number') problems.push(file.name + '.unit.version 不是数字');
    }
    if (!Array.isArray(file.tables)) problems.push(file.name + ' 的 tables 不是可解析对象（缺键列表）');
  }
  return { ok: problems.length === 0, problems, root: { pathSuffix: root.pathSuffix ?? contract.rootRelative, exists: Boolean(root.exists) }, singles, pluginFile: obs.pluginFile ?? null };
}

/**
 * ⑤ 语言面：宿主语义 = active==='zh' ? 'zh-CN' : active（其余原样写）。
 * 观测：{docLang, navLang, bodyLang}
 */
export function normalizeLocale(lang, { contract = HOST_CONTRACT.locale } = {}) {
  const raw = String(lang ?? '').trim();
  if (!raw) return { locale: null, expectedTag: null, raw };
  const primary = raw.toLowerCase().split(/[-_]/)[0];
  const locale = contract.knownLocales.includes(primary) ? primary : null;
  return { locale, expectedTag: locale ? contract.tagMapping[locale] : null, raw };
}

export function probeLocale(observation, { contract = HOST_CONTRACT.locale } = {}) {
  const problems = [];
  const obs = observation ?? {};
  const docLang = obs.docLang;
  const normalized = normalizeLocale(docLang, { contract });
  if (!normalized.locale) {
    problems.push('documentElement.lang ' + JSON.stringify(docLang) + ' 不在已知语言集合 ' + JSON.stringify(contract.knownLocales));
  } else if (normalized.expectedTag !== String(docLang ?? '').trim()) {
    problems.push('lang 写回形状 ' + JSON.stringify(docLang) + ' 与宿主映射不符（应为 ' + JSON.stringify(normalized.expectedTag) + '）');
  }
  return { ok: problems.length === 0, problems, docLang, navLang: obs.navLang ?? null, normalized: normalized.locale };
}

/** ⑥ 版本窗口。观测：{hostVersion, browserVersion:{browser,protocolVersion}}。 */
export function probeVersions(observation, { contract = HOST_CONTRACT } = {}) {
  const problems = [];
  const obs = observation ?? {};
  const hostVersion = obs.hostVersion;
  const parsedHost = parseSemver(hostVersion);
  let hostKnownGood = false;
  if (!parsedHost) {
    problems.push('宿主版本不可解析：' + JSON.stringify(hostVersion));
  } else {
    hostKnownGood = satisfiesRange(parsedHost, contract.host.knownGoodRange);
    if (!hostKnownGood) problems.push('宿主 ' + hostVersion + ' 不在 known-good 区间 ' + contract.host.knownGoodRange);
  }
  const browserRaw = obs.browserVersion && obs.browserVersion.browser;
  const parsedBrowser = parseBrowserVersion(browserRaw);
  let browserKnownGood = false;
  if (!parsedBrowser) {
    problems.push('浏览器版本串不可解析或不是 Chromium 系：' + JSON.stringify(browserRaw));
  } else {
    browserKnownGood = (contract.browser.tested[parsedBrowser.product] ?? []).includes(parsedBrowser.major);
    if (parsedBrowser.major < contract.browser.minMajor) {
      problems.push('浏览器主版本 ' + parsedBrowser.major + ' 低于契约下限 ' + contract.browser.minMajor);
    }
  }
  return {
    ok: problems.length === 0,
    problems,
    hostVersion,
    hostKnownGood,
    browser: parsedBrowser,
    browserKnownGood,
    protocolVersion: obs.browserVersion ? obs.browserVersion.protocolVersion : null,
  };
}

/* ================================================================== */
/* 检查执行：观测快照 → {ok, checks[]}                                   */
/* ================================================================== */

const CHECK_DEFS = [
  {
    id: 'host.startup-output',
    obsKey: 'startup',
    probe: (observation, { contract }) => parseStartupOutput(observation ? observation.stdout : '', { contract: contract.startup, serverPort: observation ? observation.serverPort : undefined }),
    expected: (contract) => ({
      shape: 'dsh web: http://127.0.0.1:<port>/?token=<token>',
      nonEmptyLines: contract.startup.allowPreambleLines ? '>=1' : 1,
      tokenMinLength: contract.startup.tokenMinLength,
      portMatchesListener: true,
      httpStatus: contract.startup.expectedHttpStatus,
    }),
    observed: (result, observation) => ({
      lineCount: result.lineCount,
      matched: result.matched,
      port: result.port,
      portMatchesListener: Number.isFinite(observation && observation.serverPort) ? result.port === Number(observation.serverPort) : null,
      tokenLength: result.tokenLength,
      redactedUrl: result.redactedUrl,
      httpStatus: observation ? observation.httpStatus : null,
      stderrBytes: observation ? observation.stderrBytes : null,
    }),
  },
  {
    id: 'host.startup-gates',
    obsKey: 'gates',
    probe: (observation, { contract }) => probeGates(observation, { contract: contract.gates }),
    expected: (contract) => ({
      overlay: contract.gates.overlay,
      phases: contract.gates.phases.map((phase) => ({ id: phase.id, actions: phase.actions })),
      allowedActions: contract.gates.allowedActions,
      post: contract.gates.post,
    }),
    observed: (result) => ({
      actions: result.actions,
      roundCount: result.roundCount,
      visibleOverlays: result.visibleOverlays,
      rootInert: result.rootInert,
      rootAriaHidden: result.rootAriaHidden,
      composerCount: result.composerCount,
    }),
  },
  {
    id: 'host.input-actions',
    obsKey: 'inputActions',
    probe: (observation, { contract }) => probeInputActions(observation, { contract: contract.inputActions }),
    expected: (contract) => ({
      requiredMethods: contract.inputActions.requiredMethods,
      captureInsertion: contract.inputActions.captureInsertion,
      composer: contract.inputActions.composer,
    }),
    observed: (result) => ({
      methods: result.methods,
      capture: result.capture,
      composer: result.composer,
      composerCount: result.composerCount,
    }),
  },
  {
    id: 'host.storage-schema',
    obsKey: 'storage',
    probe: (observation, { contract }) => probeStorage(observation, { contract: contract.storage }),
    expected: (contract) => ({
      rootRelative: contract.storage.rootRelative,
      topKeys: contract.storage.topKeys,
      minSingleFiles: contract.storage.minSingleFiles,
      pluginDomain: contract.storage.pluginDomain,
    }),
    observed: (result) => ({ root: result.root, singles: result.singles, pluginFile: result.pluginFile }),
  },
  {
    id: 'host.ui-locale',
    obsKey: 'locale',
    probe: (observation, { contract }) => probeLocale(observation, { contract: contract.locale }),
    expected: (contract) => ({
      source: contract.locale.source,
      knownLocales: contract.locale.knownLocales,
      tagMapping: contract.locale.tagMapping,
    }),
    observed: (result) => ({ docLang: result.docLang, navLang: result.navLang, normalized: result.normalized }),
  },
  {
    id: 'host.versions',
    obsKey: 'versions',
    probe: (observation, { contract }) => probeVersions(observation, { contract }),
    expected: (contract) => ({
      hostRange: contract.host.knownGoodRange,
      testedHosts: contract.host.tested,
      browser: { products: contract.browser.products, minMajor: contract.browser.minMajor, tested: contract.browser.tested },
    }),
    observed: (result) => ({
      hostVersion: result.hostVersion,
      hostKnownGood: result.hostKnownGood,
      browser: result.browser,
      browserKnownGood: result.browserKnownGood,
      protocolVersion: result.protocolVersion,
    }),
  },
];

/**
 * 对一份观测快照做全部契约检查。
 * @param {object} observations 运行期观测（形状见各 probe 注释；纯数据，可来自真机也可来自 selftest）。
 * @param {{contract?: object, fault?: string}} options
 * @returns {{ok: boolean, contractVersion: number, fault: string|null, checks: Array<{id,title,ok,expected,observed,detail}>}}
 */
export function evaluateContract(observations, options = {}) {
  const contract = options.contract ?? HOST_CONTRACT;
  let snapshot = observations;
  let fault = null;
  if (options.fault) {
    const applied = applyFault(observations, options.fault, { contract });
    if (applied.error) throw new Error(applied.error);
    snapshot = applied.observations;
    fault = options.fault;
  }
  const itemById = new Map(contract.items.map((item) => [item.id, item]));
  const checks = CHECK_DEFS.map((def) => {
    const item = itemById.get(def.id);
    if (!item) throw new Error('契约条目缺少检查定义：' + def.id);
    const observation = snapshot ? snapshot[def.obsKey] : undefined;
    const result = def.probe(observation, { contract });
    return {
      id: def.id,
      title: item.title,
      ok: result.ok === true,
      expected: def.expected(contract),
      observed: def.observed(result, observation),
      detail: result.problems.length > 0 ? result.problems.join('；') : '符合契约',
    };
  });
  return {
    ok: checks.every((check) => check.ok),
    contractVersion: contract.version,
    fault,
    checks,
  };
}

/* ================================================================== */
/* 宿主升级模拟 / 真机负例：只替换目标观测                                */
/* ================================================================== */

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * 注入一项"宿主升级后的观测"（用于真机负例 DSH_REAL_CONTRACT_FAULT 与 selftest）。
 * 只改目标观测、不改调用方输入；未知 id 返回 {error}。
 */
export function applyFault(observations, faultId, { contract = HOST_CONTRACT } = {}) {
  const known = contract.items.map((item) => item.id);
  if (!known.includes(faultId)) {
    return { error: '未知注入项：' + faultId + '（可选：' + known.join(', ') + '）' };
  }
  const snapshot = clone(observations);
  switch (faultId) {
    case 'host.startup-output': {
      const port = snapshot.startup && snapshot.startup.serverPort ? snapshot.startup.serverPort : 12345;
      snapshot.startup = { ...snapshot.startup, stdout: 'dsh web listening on http://127.0.0.1:' + port + '/ (token in env)\n' };
      break;
    }
    case 'host.startup-gates': {
      snapshot.gates = {
        ...snapshot.gates,
        visibleOverlays: [{ zIndex: 1000, widthRatio: 1, heightRatio: 1, display: 'flex' }],
      };
      break;
    }
    case 'host.input-actions': {
      snapshot.inputActions = { ...snapshot.inputActions, ok: true, methods: { insertText: 'function', setDraft: 'function' }, capture: null };
      break;
    }
    case 'host.storage-schema': {
      snapshot.storage = { ...snapshot.storage, root: { pathSuffix: 'storages', exists: true, singles: [] } };
      break;
    }
    case 'host.ui-locale': {
      snapshot.locale = { ...snapshot.locale, docLang: 'ja' };
      break;
    }
    case 'host.versions': {
      snapshot.versions = { ...snapshot.versions, hostVersion: '0.1.7-rc.2' };
      break;
    }
    default:
      return { error: '注入项没有实现：' + faultId };
  }
  return { observations: snapshot, fault: faultId };
}
