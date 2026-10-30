/**
 * undo-group 套件（#192）：把旧 pilot `scripts/repro/real/issue-181-real.mjs` 的
 * 「撤销分组」A 组场景迁移到 kit 上。
 *
 * 迁移边界（判定不倒退的对照见 docs/real/suites.md 与 #192 报告）：
 *   - 本文件只做**布置 + 断言**：装配一次性环境、CDP、真实输入、观测协议都来自 harness。
 *     pilot 自己那份 CDP 客户端 / PAGE_API 探针 / window.__IA 包裹一律不再存在。
 *   - 落点断言用 composer 草稿字节与 caret（DOM selection + 宿主 captureInsertion 两路），
 *     截图只作为失败证据，不是主证据。
 *   - pilot 用页面内包裹 inputActions 观察「两笔 insertText / 单笔 insertText / setDraft 降级」，
 *     那是产品内部实现细节；本套件只断言公开可观测结果（草稿、caret、宿主 captureInsertion 读数），
 *     对应偏差在 #192 报告里逐条记录。降级路径由 #191 的 `--fault input-actions-missing` 覆盖。
 *   - B 组失焦落点依赖旧包 0.4.39 的 LEGACY_JSON 基线，交给 #191 差分运行器（旧产物 vs 当前产物），
 *     这里显式记 N-A，不静默丢。
 */

import { HarnessError } from '../harness/errors.mjs';
import { locateRows } from '../harness/observe/text.mjs';
import { preparePage } from '../harness/page.mjs';

const COMPOSER_SELECTOR = '[data-composer-input]';
const CURSOR_MARKER = '{{cursor}}';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 场景级证据（#183 评审整改 F2）：scenario() 声明本场景的布置/操作步骤，
 * 场景内 assertField / assertDraftText 默认继承，个别检查可覆盖。
 */
let currentScenarioEvidence = null;

function evidenceFor(overrides = {}) {
  const base = currentScenarioEvidence || {};
  return {
    steps: overrides.steps !== undefined ? overrides.steps : base.steps,
    claim: overrides.claim !== undefined ? overrides.claim : base.claim,
    observations: overrides.observations,
    inference: overrides.inference !== undefined ? overrides.inference : base.inference,
  };
}

/** 六元组断言：期望/实测都写进报告；判定协议与 boundary 套件一致（PASS/FAIL + 证据）。 */
function assertField(recorder, name, options = {}) {
  const { expected, observed, source, detail, claim, steps, observations, inference } = options;
  const same = JSON.stringify(expected) === JSON.stringify(observed);
  const tuple = evidenceFor({ claim, steps, observations, inference });
  const record = { expected, observed, source, detail, ...tuple };
  if (same) recorder.pass(name, record);
  else recorder.fail(name, record);
  return same;
}

/**
 * 场景包装：超时 = FAIL（产品在预算内没给出结果），工具链异常 = BLOCKED。
 * 与 boundary 套件同一套语义，报告可并列比较。
 */
async function scenario(recorder, env, name, scenarioSteps, body) {
  const evidence = {
    steps: scenarioSteps,
    claim: '场景「' + name + '」的布置、真实输入与观测按这些步骤可在同一环境重放',
    inference: '步骤在预算内成立时，草稿字节/caret 断言与撤销分组才可归因到产品行为',
  };
  currentScenarioEvidence = evidence;
  recorder.setEnvironment({ undoGroup: { ...env, currentScenario: name } });
  try {
    await body();
    env.completedScenarios.push(name);
  } catch (error) {
    const message = error instanceof HarnessError ? error.message : String(error && error.stack ? error.stack : error);
    if (/等待超时/.test(message)) {
      recorder.fail(name + '：等待观测条件超时', {
        expected: '观测条件在预算内成立',
        observed: message,
        ...evidence,
        inference: '等待超时说明产品未在预算内响应，或布置前提不成立（工具链异常记 BLOCKED）',
      });
    } else {
      recorder.blocked(name + '：工具链异常', message, evidence);
    }
  } finally {
    currentScenarioEvidence = null;
    recorder.setEnvironment({ undoGroup: { ...env, currentScenario: null } });
  }
}

/** 草稿是否为空：Lexical 的空编辑器 innerText 可能是 "\n"，布置/空断言都按这个归一。 */
function isBlankComposer(text) {
  return String(text === null || text === undefined ? '' : text)
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .trim() === '';
}

/** 保证面板收起（物理点关闭按钮，不是 element.click()）。 */
async function ensurePanelClosed({ observe, input, client, panelMs }) {
  const raw = await observe.snapshot();
  if (!raw.panel.visible) return raw;
  const closeRect = raw.panel.bar.closeRect || (await client.getRect('[data-dsh-prompt-close]', { required: true }));
  await input.clickRect(closeRect, { steps: 6 });
  return await observe.waitFor((next) => !next.panel.visible, { timeoutMs: panelMs, label: '点关闭后面板收起' });
}

/** 保证面板打开（物理悬停入口；真实指针 move 序列）。 */
async function ensurePanelOpen({ observe, input, client, panelMs }) {
  const raw = await observe.snapshot();
  if (raw.panel.visible) return raw;
  const entryRect = (raw.entry.first && raw.entry.first.rect) || (await client.getRect('[data-dsh-prompt-entry]', { required: true }));
  await input.move(null, { x: entryRect.cx, y: entryRect.cy }, { steps: 10 });
  return await observe.waitFor((next) => next.panel.visible, { timeoutMs: panelMs, label: '悬停入口打开模板面板' });
}

/**
 * 用真实键盘/指针清空 composer：先物理点进编辑区保证焦点，再 Ctrl+A → Backspace，
 * 最后用 selection API 把 caret 放回起点并等宿主 captureInsertion 同步（布置与断言分开，布置不走断言口径）。
 */
async function clearComposer({ observe, input, panelMs }) {
  let raw = await observe.snapshot();
  if (raw.composer.rect) {
    await input.clickRect(raw.composer.rect, { steps: 4 });
    raw = await observe.snapshot();
  } else {
    await input.focus(COMPOSER_SELECTOR);
  }
  if (!isBlankComposer(raw.composer.text)) {
    await input.shortcut('Ctrl+A');
    await input.key('Backspace');
    raw = await observe.waitFor((next) => isBlankComposer(next.composer.text), { timeoutMs: panelMs, label: '真实键盘清空草稿' });
  }
  const selection = await input.setSelection(COMPOSER_SELECTOR, 0, 0);
  await waitCaretAt({ observe, panelMs, caret: 0, label: '清空后 caret/captureInsertion 同步在 0' });
  raw = await observe.snapshot();
  return { raw, selection };
}

/**
 * 键入一段草稿（单笔宿主文本插入，与旧 pilot 的 c.insertText 对齐）。
 * 不用逐键敲：逐键在机器卡顿时会被 Lexical 拆成多条 undo 记录，A1–A5 的撤销分组断言就会随机红。
 * 真实键盘路径由 trigger 套件覆盖；本套件关心的是插入后的撤销分组语义。
 * 宿主的单笔文本插入偶尔「焦点在、编辑区却没收到」：重新聚焦后重试一次，并记入环境观测。
 */
async function typeDraft({ observe, input, panelMs, text, env }) {
  await input.typeText(text);
  try {
    return await observe.waitFor((raw) => raw.composer.text === text, { timeoutMs: 3_000, label: '键入草稿文本 ' + JSON.stringify(text) });
  } catch (firstError) {
    const notes = (env && (env.observations.typingRetries = (env.observations.typingRetries || [])));
    if (notes) notes.push({ text, reason: String(firstError && firstError.message ? firstError.message : firstError).slice(0, 160) });
    const focused = await observe.snapshot();
    if (focused.composer.rect) await input.clickRect(focused.composer.rect, { steps: 4 });
    else await input.focus(COMPOSER_SELECTOR);
    await input.typeText(text);
    return await observe.waitFor((raw) => raw.composer.text === text, { timeoutMs: panelMs, label: '键入草稿文本（重新聚焦重试后） ' + JSON.stringify(text) });
  }
}

/**
 * 重新加载页面（对齐旧 pilot 每个场景都 boot(c, URL) 的做法）：
 * 清掉上一场景遗留的 undo 历史与编辑器内存状态，让每个场景从同一起点开始（A2–A5 进入前调用）。
 * 重载后重新安装输入事件日志（页面内挂载点随页面重建）。
 */
async function reloadPage({ client, server, timeouts, observe, input, pageLoadMs }) {
  await preparePage(client, { url: server.url, timeouts });
  await observe.waitFor(
    (raw) => raw.composer.present && raw.entry.count > 0,
    { timeoutMs: pageLoadMs, label: '重新加载后插件入口与 composer 就绪' },
  );
  await input.log.install();
  await input.log.clear();
  await delay(200);
}

/**
 * 等 DOM 选区与宿主 captureInsertion 同步到同一落点。
 * 产品落点守卫用 captureInsertion（宿主模型选择）对照决议落点；只改 DOM 选区（selection API）时
 * 模型选择要等 selectionchange 异步同步，赶在同步前点击会走 setDraft 降级（文本对、caret/历史分组不对）。
 * 布置阶段先等到两边一致，再发真实点击 —— 否则测到的是布置竞态，不是产品行为。
 */
async function waitCaretAt({ observe, panelMs, caret, label }) {
  return await observe.waitFor(
    (raw) =>
      raw.composer.selection.start === caret &&
      raw.composer.selection.end === caret &&
      raw.composer.inputActions.capture &&
      raw.composer.inputActions.capture.start === caret &&
      raw.composer.inputActions.capture.end === caret,
    { timeoutMs: panelMs, label: label || ('DOM 选区与 captureInsertion 同步在 ' + caret) },
  );
}

/** 真实键盘左移 caret（ArrowLeft 逐次）——比 selection API 更像用户操作，宿主会随按键同步模型选择。 */
async function moveCaretLeft({ observe, input, panelMs, times, from }) {
  for (let i = 0; i < times; i += 1) await input.key('ArrowLeft');
  return await waitCaretAt({ observe, panelMs, caret: from - times });
}

/**
 * 物理点击模板行插入：按用户可见名称定位，不靠内部类名；返回原始观测与输入计划。
 * expectedText 是插入完成后草稿的**整段文本**：空草稿插入等于正文去标记；
 * 非空草稿插入还要带上插入点前后的既有文本（A1/A2/A4），否则等待条件永远不成立。
 */
async function insertTemplate({ recorder, observe, input, client, panelMs, preset, env, expectedText = null, expectedCaret = null }) {
  await ensurePanelClosed({ observe, input, client, panelMs });
  const panelRaw = await ensurePanelOpen({ observe, input, client, panelMs });
  const rows = panelRaw.panel.list.rows;
  const located = locateRows(
    rows.map((row) => ({ text: row.text, id: row.id })),
    { mode: 'contains', value: preset.name },
  );
  if (located.length === 0) {
    recorder.fail('模板行定位：按用户可见名称找到目标模板行', {
      expected: '文本包含「' + preset.name + '」的行',
      observed: rows.map((row) => row.text),
      detail: '配方种子与界面行文本不一致，无法继续插入',
      ...evidenceFor(),
      observations: { expectedText: preset.name, rows: rows.map((row) => row.text) },
    });
    throw new HarnessError('无法按语义文本定位模板行：' + preset.name);
  }
  const match = located[0];
  const row = rows[match.index];
  const rowRect = row && row.rect;
  if (!rowRect) throw new HarnessError('模板行没有可点击矩形：' + preset.name);
  assertField(recorder, '模板行定位：按用户可见名称定位到目标行（不靠内部类名）', {
    expected: preset.id,
    observed: row.id,
    source: 'user-visible',
    detail: 'matchedText=' + JSON.stringify(row.text) + '；mode=contains',
  });
  await input.log.clear();
  const plan = await input.clickRect(rowRect, { steps: 8 });
  const targetText = expectedText !== null
    ? expectedText
    : String(preset.body).split(CURSOR_MARKER).join('');
  // 插入后产品会先更新草稿、再恢复光标（宿主 insertText 落点）；先等文本，再等光标归位，
  // 否则会读到中间态 caret=正文末尾，把正常落位误判成偏移。
  await observe.waitFor((next) => next.composer.text === targetText, {
    timeoutMs: panelMs,
    label: '物理点击模板行后草稿逐字出现期望文本',
  });
  const raw = expectedCaret === null
    ? await observe.snapshot()
    : await observe.waitFor(
      (next) => next.composer.text === targetText && next.composer.selection.start === expectedCaret,
      { timeoutMs: panelMs, label: '物理点击模板行后 caret 落到 ' + expectedCaret },
    );
  const log = await input.log.read({ clear: false });
  env.observations['insert:' + preset.id] = {
    plan: plan.description,
    expectedText: targetText,
    observedText: raw.composer.text,
    rowId: row.id,
    rowText: row.text,
    events: log.filter((event) => event && (event.type === 'click' || event.type === 'pointerdown')),
  };
  recorder.setEnvironment({ undoGroup: env });
  return { raw, plan, expectedText: targetText, row };
}

/** 快捷键 + 等草稿变成期望文本（空态按 isBlankComposer 归一）。 */
async function shortcutAndExpect({ input, observe, panelMs, shortcut, expected, label, blank = false }) {
  await input.shortcut(shortcut);
  if (blank) {
    return await observe.waitFor((raw) => isBlankComposer(raw.composer.text), { timeoutMs: panelMs, label });
  }
  return await observe.waitFor((raw) => raw.composer.text === expected, { timeoutMs: panelMs, label });
}

/** 断言草稿文本逐字相等（空态用 blank 归一），附带 caret 观测。 */
function assertDraftText(recorder, name, raw, expected, options = {}) {
  const { expectedCaret = null, detail = '' } = options;
  const observedText = raw.composer.text;
  const ok = expected === null ? isBlankComposer(observedText) : observedText === expected;
  const record = {
    expected: expected === null ? '（空草稿）' : expected,
    observed: observedText,
    detail: detail || ('chars=' + observedText.length),
    ...evidenceFor({
      claim: name,
      observations: { text: observedText, selectionStart: raw.composer.selection.start, selectionEnd: raw.composer.selection.end },
      inference: '草稿文本与旧 pilot 期望逐字一致时，撤销分组行为未倒退',
    }),
  };
  if (ok) recorder.pass(name, record);
  else recorder.fail(name, record);
  if (expectedCaret !== null) {
    assertField(recorder, name + '：caret', {
      expected: expectedCaret,
      observed: raw.composer.selection.start,
      source: 'user-visible',
      detail: 'DOM selection 全局文本偏移；capture=' + JSON.stringify(raw.composer.inputActions.capture),
    });
  }
  return ok;
}

/** 从 fixture 配方里取三条模板（id 后缀约定见 scripts/real/fixtures/undo-group.json）。 */
function pickPreset(fixture, suffix) {
  const seedCustoms = fixture && fixture.recipe && fixture.recipe.seed && Array.isArray(fixture.recipe.seed.customs) ? fixture.recipe.seed.customs : [];
  const found = seedCustoms.find((item) => item && typeof item.id === 'string' && item.id.endsWith(suffix));
  if (!found) return null;
  return { id: found.id, name: found.name, body: found.body };
}

export async function runUndoGroup(context) {
  const { recorder, client, server, prepared, timeouts, observe, input, fixture } = context;
  const panelMs = (timeouts && timeouts.panelMs) || 8_000;
  const pageLoadMs = (timeouts && timeouts.pageLoadMs) || 60_000;

  const env = {
    purpose: '旧 pilot（issue-181-real.mjs，A 组）迁移到 kit：含标记插入后的 undo 分组 / redo 链。',
    migratedFrom: 'scripts/repro/real/issue-181-real.mjs#A1-A5（#192 迁移前基线证据由 #192 报告记录，不在仓内）',
    inputMethods: {
      physical: 'CDP 输入协议（真实指针 move/press/release + 真实键盘 rawKeyDown/keyUp + insertText）',
      synthetic: '不使用（本套件只走真实输入路径）',
    },
    evidence: '断言主证据 = composer 草稿字节 + caret（DOM selection.start 与宿主 captureInsertion 两路）；截图只作失败产物',
    completedScenarios: [],
    observations: {},
  };
  recorder.setEnvironment({ undoGroup: env });

  /** 前置检查的证据（#183 评审整改 F2）：前置不在场景内，steps 显式写清怎么重放自检。 */
  const preflightEvidence = {
    steps: [
      '检查 run.mjs 传入的 observe/input 句柄',
      '检查 --fixture 是 undo-group，且配方含 -undo-single / -undo-multi / -undo-plain 三条模板',
      '在页面注入输入事件日志（input.log.install）并确认成功',
    ],
    claim: '撤销分组套件的装配前置（句柄/配方/事件日志）齐全，后续场景才可归因',
    inference: '前置缺失属运行器装配或配方错误，记 BLOCKED 而不是产品失败',
  };

  if (!observe || !input) {
    recorder.blocked('撤销分组套件前置', '缺少 observe/input 句柄（run.mjs 需要创建并传给套件）', preflightEvidence);
    return;
  }
  if (!fixture || fixture.name !== 'undo-group') {
    recorder.blocked('撤销分组套件前置', '本套件需要 --fixture undo-group（当前 fixture=' + (fixture ? fixture.name : '无') + '）', preflightEvidence);
    return;
  }
  const single = pickPreset(fixture, '-undo-single');
  const multi = pickPreset(fixture, '-undo-multi');
  const plain = pickPreset(fixture, '-undo-plain');
  if (!single || !multi || !plain) {
    recorder.blocked('撤销分组套件前置', 'undo-group 配方缺少三条约定模板（-undo-single / -undo-multi / -undo-plain）', preflightEvidence);
    return;
  }
  env.fixture = {
    name: fixture.name,
    runTag: fixture.params && fixture.params.runTag,
    templates: [single, multi, plain].map((item) => ({ id: item.id, name: item.name, body: item.body })),
  };
  recorder.setEnvironment({ undoGroup: env });

  try {
    await input.log.install();
  } catch (error) {
    recorder.blocked('撤销分组套件前置', '无法安装页面输入事件日志：' + String(error && error.message ? error.message : error), {
      ...preflightEvidence,
      steps: ['在页面注入输入事件日志脚本（input.log.install）'],
      inference: '事件日志装不上属工具链/页面异常；继续跑会让「真实输入」类证据不完整，记 BLOCKED',
    });
    return;
  }

  /* ───────────────────── A1：非空草稿末尾 + 含标记单行（undo1/2/3 + redo） ───────────────────── */

  await scenario(recorder, env, 'A1：末尾插入含标记单行', [
    '清空 composer（物理点进编辑区 → Ctrl+A/Backspace → selection API 归零）并用宿主单笔输入键入草稿 abc',
    '真实键盘把 caret 放到草稿末尾（等待 DOM selection 与 captureInsertion 同步在 3）',
    '物理悬停入口开面板 → 按用户可见名称定位「标记单行」模板行 → 物理点击',
    '等草稿 == abcSMARTEND 且 caret == 8；读宿主 captureInsertion 落点（公开接口）',
    '真实键盘 Ctrl+Z：等草稿 == abcSMART{{cursor}}END（标记重现）',
    '真实键盘 Ctrl+Z：等草稿 == abc',
    '真实键盘 Ctrl+Z：等草稿清空',
    '真实键盘 Ctrl+Y ×3：等草稿 == abc / abcSMART{{cursor}}END / abcSMARTEND',
    'Ctrl+Z 回标记态后按 Ctrl+Shift+Z：等草稿 == abcSMARTEND（redo 备选键）',
  ], async () => {
    const preparedDraft = await clearComposer({ observe, input, panelMs });
    env.observations.A1Prepared = { text: preparedDraft.raw.composer.text, selection: preparedDraft.raw.composer.selection };
    const typed = await typeDraft({ observe, input, panelMs, text: 'abc', env });
    assertField(recorder, 'A1-0 布置：键入草稿 abc（宿主单笔编辑，对齐旧 pilot c.insertText）', { expected: 'abc', observed: typed.composer.text, source: 'user-visible' });
    const ready = await waitCaretAt({ observe, panelMs, caret: 3 });
    assertField(recorder, 'A1-0b 布置：caret 放到草稿末尾', { expected: 3, observed: ready.composer.selection.start, source: 'user-visible' });

    const inserted = await insertTemplate({ recorder, observe, input, client, panelMs, preset: single, env, expectedText: 'abcSMARTEND', expectedCaret: 8 });
    assertDraftText(recorder, 'A1-1 插入后草稿文本 == abcSMARTEND', inserted.raw, 'abcSMARTEND', { expectedCaret: 8 });
    // A1-3（旧 pilot 断言「主路径两笔 insertText」）是产品内部调用计数，属实现细节。
    // 迁移后用公开接口证据替代：宿主 captureInsertion 读数非空且落点 = 正文末尾。
    assertField(recorder, 'A1-3 插入经宿主公开输入能力完成：captureInsertion 落点 == 正文末尾', {
      expected: 8,
      observed: inserted.raw.composer.inputActions.capture ? inserted.raw.composer.inputActions.capture.start : null,
      source: 'public-api',
      detail: 'capture=' + JSON.stringify(inserted.raw.composer.inputActions.capture) + '（旧 pilot 的 insertText 调用次数属产品内部细节，不再断言）',
    });

    const undo1 = await shortcutAndExpect({ input, observe, panelMs, shortcut: 'Ctrl+Z', expected: 'abcSMART{{cursor}}END', label: 'undo1 后标记文本重现' });
    assertDraftText(recorder, 'A1-4 undo1：草稿 == abcSMART{{cursor}}END（标记重现）', undo1, 'abcSMART{{cursor}}END');
    const undo2 = await shortcutAndExpect({ input, observe, panelMs, shortcut: 'Ctrl+Z', expected: 'abc', label: 'undo2 后回到 abc' });
    assertDraftText(recorder, 'A1-5 undo2：草稿 == abc', undo2, 'abc');
    const undo3 = await shortcutAndExpect({ input, observe, panelMs, shortcut: 'Ctrl+Z', expected: '', label: 'undo3 后草稿为空', blank: true });
    assertDraftText(recorder, 'A1-6 undo3：草稿为空', undo3, null);

    const redo1 = await shortcutAndExpect({ input, observe, panelMs, shortcut: 'Ctrl+Y', expected: 'abc', label: 'redo1 后重建 abc' });
    assertDraftText(recorder, 'A1-7 redo（Ctrl+Y）：草稿 == abc', redo1, 'abc');
    const redo2 = await shortcutAndExpect({ input, observe, panelMs, shortcut: 'Ctrl+Y', expected: 'abcSMART{{cursor}}END', label: 'redo2 后标记态' });
    assertDraftText(recorder, 'A1-8 redo2：草稿 == abcSMART{{cursor}}END', redo2, 'abcSMART{{cursor}}END');
    const redo3 = await shortcutAndExpect({ input, observe, panelMs, shortcut: 'Ctrl+Y', expected: 'abcSMARTEND', label: 'redo3 后回到插入后态' });
    assertDraftText(recorder, 'A1-9 redo3：草稿 == abcSMARTEND', redo3, 'abcSMARTEND');

    // redo 备选键：先 undo 一次回到标记态，再 Ctrl+Shift+Z 重建插入后态。
    const undoForAlt = await shortcutAndExpect({ input, observe, panelMs, shortcut: 'Ctrl+Z', expected: 'abcSMART{{cursor}}END', label: 'redo 备选：先 undo 回标记态' });
    assertDraftText(recorder, 'A1-10a redo 备选：undo 回标记态', undoForAlt, 'abcSMART{{cursor}}END');
    const redoAlt = await shortcutAndExpect({ input, observe, panelMs, shortcut: 'Ctrl+Shift+Z', expected: 'abcSMARTEND', label: 'redo 备选（Ctrl+Shift+Z）重建插入后态' });
    assertDraftText(recorder, 'A1-10b redo 备选（Ctrl+Shift+Z）：草稿 == abcSMARTEND', redoAlt, 'abcSMARTEND');
  });

  /* ───────────────────── A2：非空草稿中间 + 含标记单行 ───────────────────── */

  await scenario(recorder, env, 'A2：中间插入含标记单行', [
    '重载页面（对齐旧 pilot 每场景 boot，隔离上一场景 undo 历史）',
    '清空 composer 并键入 abc，真实键盘 ArrowLeft ×1 把 caret 放到 offset=2',
    '物理悬停开面板 → 按用户可见名称定位「标记单行」模板行 → 物理点击（插入到草稿中间）',
    '等草稿 == abSMARTENDc 且 caret == 7',
    '真实键盘 Ctrl+Z：等草稿 == abSMART{{cursor}}ENDc / abc / 空',
  ], async () => {
    // 对齐旧 pilot：每个场景重新 boot 页面，撤掉上一场景的 undo 历史与编辑器内存状态。
    await reloadPage({ client, server, timeouts, observe, input, pageLoadMs });
    await clearComposer({ observe, input, panelMs });
    await typeDraft({ observe, input, panelMs, text: 'abc', env });
    const ready = await moveCaretLeft({ observe, input, panelMs, times: 1, from: 3 });
    assertField(recorder, 'A2-0 布置：caret 放到 abc 中间（offset=2）', { expected: 2, observed: ready.composer.selection.start, source: 'user-visible' });

    const inserted = await insertTemplate({ recorder, observe, input, client, panelMs, preset: single, env, expectedText: 'abSMARTENDc', expectedCaret: 7 });
    assertDraftText(recorder, 'A2-1 插入后草稿 == abSMARTENDc', inserted.raw, 'abSMARTENDc', { expectedCaret: 7 });
    const undo1 = await shortcutAndExpect({ input, observe, panelMs, shortcut: 'Ctrl+Z', expected: 'abSMART{{cursor}}ENDc', label: 'undo1 后标记重现（中间插入）' });
    assertDraftText(recorder, 'A2-3 undo1：草稿 == abSMART{{cursor}}ENDc', undo1, 'abSMART{{cursor}}ENDc');
    const undo2 = await shortcutAndExpect({ input, observe, panelMs, shortcut: 'Ctrl+Z', expected: 'abc', label: 'undo2 后回到 abc' });
    assertDraftText(recorder, 'A2-4 undo2：草稿 == abc', undo2, 'abc');
    const undo3 = await shortcutAndExpect({ input, observe, panelMs, shortcut: 'Ctrl+Z', expected: '', label: 'undo3 后草稿为空', blank: true });
    assertDraftText(recorder, 'A2-5 undo3：草稿为空', undo3, null);
  });

  /* ───────────────────── A3：空草稿 + 含标记多行 ───────────────────── */

  await scenario(recorder, env, 'A3：空草稿插入含标记多行', [
    '重载页面（隔离上一场景 undo 历史）',
    '清空 composer，确认草稿为空且 caret 在起点',
    '物理悬停开面板 → 按用户可见名称定位「标记多行」模板行 → 物理点击',
    '等草稿 == 第一行第二行\\n第三行 且 caret == 3（多行保留）',
    '真实键盘 Ctrl+Z ×2：等草稿 == 第一行{{cursor}}第二行\\n第三行 / 空',
  ], async () => {
    await reloadPage({ client, server, timeouts, observe, input, pageLoadMs });
    const preparedDraft = await clearComposer({ observe, input, panelMs });
    assertField(recorder, 'A3-0 布置：草稿为空且 caret 在起点', {
      expected: { blank: true, selection: 0 },
      observed: { blank: isBlankComposer(preparedDraft.raw.composer.text), selection: preparedDraft.raw.composer.selection.start },
      source: 'user-visible',
    });

    const inserted = await insertTemplate({ recorder, observe, input, client, panelMs, preset: multi, env, expectedCaret: 3 });
    assertDraftText(recorder, 'A3-1 插入后草稿 == 第一行第二行\\n第三行（多行保留）', inserted.raw, '第一行第二行\n第三行', { expectedCaret: 3 });
    const undo1 = await shortcutAndExpect({ input, observe, panelMs, shortcut: 'Ctrl+Z', expected: '第一行{{cursor}}第二行\n第三行', label: 'undo1 后多行标记重现' });
    assertDraftText(recorder, 'A3-3 undo1：草稿 == 第一行{{cursor}}第二行\\n第三行', undo1, '第一行{{cursor}}第二行\n第三行');
    const undo2 = await shortcutAndExpect({ input, observe, panelMs, shortcut: 'Ctrl+Z', expected: '', label: 'undo2 后草稿为空', blank: true });
    assertDraftText(recorder, 'A3-4 undo2：草稿为空', undo2, null);
  });

  /* ───────────────────── A4：无标记模板插入非空草稿中间 ───────────────────── */

  await scenario(recorder, env, 'A4：中间插入无标记模板', [
    '重载页面（隔离上一场景 undo 历史）',
    '清空 composer 并键入 abc，真实键盘 ArrowLeft ×2 把 caret 放到 offset=1',
    '物理悬停开面板 → 按用户可见名称定位「无标记」模板行 → 物理点击（插入到草稿中间）',
    '等草稿 == aNOMARKbc 且 caret == 7；读宿主 captureInsertion 落点 == 7',
    '真实键盘 Ctrl+Z：等草稿 == abc（无标记只撤插入）',
  ], async () => {
    await reloadPage({ client, server, timeouts, observe, input, pageLoadMs });
    await clearComposer({ observe, input, panelMs });
    await typeDraft({ observe, input, panelMs, text: 'abc', env });
    const ready = await moveCaretLeft({ observe, input, panelMs, times: 2, from: 3 });
    assertField(recorder, 'A4-0 布置：caret 放到 abc offset=1', { expected: 1, observed: ready.composer.selection.start, source: 'user-visible' });

    const inserted = await insertTemplate({ recorder, observe, input, client, panelMs, preset: plain, env, expectedText: 'aNOMARKbc', expectedCaret: 7 });
    assertDraftText(recorder, 'A4-1 插入后草稿 == aNOMARKbc', inserted.raw, 'aNOMARKbc', { expectedCaret: 7 });
    // 旧 pilot A4-3「无标记路径单笔 insertText」是内部调用计数；迁移后用公开接口读数替代。
    assertField(recorder, 'A4-3 无标记插入经宿主公开输入能力落位：captureInsertion 落点 == 7', {
      expected: 7,
      observed: inserted.raw.composer.inputActions.capture ? inserted.raw.composer.inputActions.capture.start : null,
      source: 'public-api',
      detail: 'capture=' + JSON.stringify(inserted.raw.composer.inputActions.capture),
    });
    const undo1 = await shortcutAndExpect({ input, observe, panelMs, shortcut: 'Ctrl+Z', expected: 'abc', label: 'undo1 后回到 abc（无标记只撤插入）' });
    assertDraftText(recorder, 'A4-4 undo1：草稿 == abc', undo1, 'abc');
  });

  /* ───────────────────── A5：无标记模板插入空草稿 ───────────────────── */

  await scenario(recorder, env, 'A5：空草稿插入无标记模板', [
    '重载页面（隔离上一场景 undo 历史）',
    '清空 composer，确认草稿为空',
    '物理悬停开面板 → 按用户可见名称定位「无标记」模板行 → 物理点击',
    '等草稿 == NOMARK 且 caret == 6',
    '真实键盘 Ctrl+Z：等草稿清空（旧版不可撤销 → 新版可撤销）',
  ], async () => {
    await reloadPage({ client, server, timeouts, observe, input, pageLoadMs });
    await clearComposer({ observe, input, panelMs });
    const inserted = await insertTemplate({ recorder, observe, input, client, panelMs, preset: plain, env, expectedCaret: 6 });
    assertDraftText(recorder, 'A5-1 插入后草稿 == NOMARK', inserted.raw, 'NOMARK', { expectedCaret: 6 });
    const undo1 = await shortcutAndExpect({ input, observe, panelMs, shortcut: 'Ctrl+Z', expected: '', label: 'undo1 后草稿为空（旧版不可撤销 → 新版可撤销）', blank: true });
    assertDraftText(recorder, 'A5-3 undo1：草稿为空（旧版不可撤销 → 新版可撤销）', undo1, null);
  });

  /* ───────────────────── 未迁移断言的显式记账（不静默丢） ───────────────────── */

  recorder.na(
    'A6 降级路径（inputActions 缺失 / 坐标不一致 / 旧宿主）：未在本套件内迁移',
    '旧 pilot 用页面内包裹 window.__IA 人为制造 insertfalse / coordmismatch 来跑降级路径，那是复制产品内部探针；kit 不复制私有仪器，' +
      '降级路径改由 #191 故障注入覆盖：`node scripts/real/diff.mjs --fault input-actions-missing --suite boundary --fixture templates` 断言 captureInsertion 缺失时走 setDraft 降级且草稿正确。',
  );
  recorder.na(
    'A6-8 chip 草稿降级：未迁移',
    '旧 pilot 自己就标 N/A（公开 API 构造不出 chip 草稿）；迁移后保持 N/A，理由一致。',
  );
  recorder.na(
    'A7 提交消息 / 重载草稿：未在本套件内迁移',
    '迁移范围按 #192 brief 为 A1–A5（撤销分组与 redo）；提交消息、导航重载属于 composer 持久化行为，pilot 的提交是单轮副作用。' +
      '相关持久化双通道由 boundary 套件覆盖；如未来需要，单开票把提交/重载写成独立套件，不塞回本套件。',
  );
  recorder.na(
    'B1 失焦中段插入落点 == 旧包 0.4.39 基线：未在本套件内迁移',
    'B 组依赖 LEGACY_JSON（旧包 0.4.39 的失焦落点基线）作期望值；kit 不内置旧包基线。' +
      '该对照由 #191 差分运行器承担：旧产物 vs 当前产物跑同一套件/同一 fixture，两侧判定可并列比较（见 docs/real/diff.md）。',
  );
  recorder.na(
    'B2 失焦末尾插入落点 == 旧包 0.4.39 基线：未在本套件内迁移',
    '同 B1：旧包基线对照交给 #191 差分运行器，本套件不内建旧产物期望值。',
  );

  env.verdict = 'A1–A5 由本套件断言；A6/A7/B1/B2 显式 N-A 并注明覆盖方（见 #192 报告对照表）';
  recorder.setEnvironment({ undoGroup: env });
}
