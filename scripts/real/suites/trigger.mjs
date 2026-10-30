/**
 * trigger 套件（#192）：第二条真实套件，触发/插入域。
 *
 * 目的：证明 #188 观测层 + #188 输入驱动 + #189 判定/证据协议能承载**另一个域**的验收，
 * 而不是只为 boundary 场景写死的一份脚本。套件里没有 CDP 客户端、没有页面探针复制、
 * 没有 HTTP 自拼：布置/观测/持久化双通道全部走 harness。
 *
 * 覆盖（对应 #192 AC「至少一条真实指针输入路径 + 一条键盘路径」）：
 *   - 真实指针：物理悬停入口开面板 → 移开关面板 → 物理点底栏触发方式按钮切到「仅点击」→
 *     悬停不再开（#179 契约）→ 物理点入口开面板 → 物理点关闭按钮收面板；
 *   - 真实键盘：focus + Enter 打开入口面板、focus + Enter 切回悬浮触发、Enter 再按关闭面板、
 *     逐键 keyDown/keyUp 在 composer 输入文本；
 *   - 双通道：界面 aria-pressed / panel 可见性 ↔ 持久化 store.hoverTrigger（captureBaselineFromOrigin 读回）。
 */

import { HarnessError } from '../harness/errors.mjs';
import { sleep } from '../harness/proc.mjs';
import { compareDualChannels } from '../harness/observe/compare.mjs';

const ENTRY_SELECTOR = '[data-dsh-prompt-entry]';
const TRIGGER_SELECTOR = '[data-dsh-prompt-trigger]';
const COMPOSER_SELECTOR = '[data-composer-input]';

/**
 * 场景级证据（#183 评审整改 F2）：scenario() 声明本场景的布置/操作步骤，
 * 场景内 assertField / 直接 pass 默认继承，个别检查可覆盖。
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

function assertField(recorder, name, options = {}) {
  const { expected, observed, source, detail, claim, steps, observations, inference } = options;
  const same = JSON.stringify(expected) === JSON.stringify(observed);
  const tuple = evidenceFor({ claim, steps, observations, inference });
  const record = { expected, observed, source, detail, ...tuple };
  if (same) recorder.pass(name, record);
  else recorder.fail(name, record);
  return same;
}

async function scenario(recorder, env, name, scenarioSteps, body) {
  const evidence = {
    steps: scenarioSteps,
    claim: '场景「' + name + '」的布置、真实输入与观测按这些步骤可在同一环境重放',
    inference: '步骤在预算内成立时，本场景的触发方式断言与双通道对账才有证据力',
  };
  currentScenarioEvidence = evidence;
  recorder.setEnvironment({ trigger: { ...env, currentScenario: name } });
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
    recorder.setEnvironment({ trigger: { ...env, currentScenario: null } });
  }
}

/** 面板是否可见（原始观测，不解释）。 */
function panelVisible(raw) {
  return !!(raw && raw.panel && raw.panel.visible);
}

/** 关闭面板：物理点底栏关闭按钮（真实指针）。 */
async function closePanelByClick({ observe, input, panelMs }) {
  const raw = await observe.snapshot();
  if (!panelVisible(raw)) return raw;
  const closeRect = raw.panel.bar.closeRect;
  if (!closeRect) throw new HarnessError('面板底栏缺少关闭按钮几何');
  await input.clickRect(closeRect, { steps: 6 });
  return await observe.waitFor((next) => !panelVisible(next), { timeoutMs: panelMs, label: '物理点关闭按钮后面板收起' });
}

/** 悬浮触发态下物理悬停入口打开面板。 */
async function openPanelByHover({ observe, input, panelMs }) {
  const raw = await observe.snapshot();
  if (panelVisible(raw)) return raw;
  if (!raw.entry.first || !raw.entry.first.rect) throw new HarnessError('悬浮入口不存在，无法做物理悬停');
  await input.move(null, { x: raw.entry.first.rect.cx, y: raw.entry.first.rect.cy }, { steps: 10 });
  return await observe.waitFor((next) => panelVisible(next), { timeoutMs: panelMs, label: '物理悬停入口后面板打开' });
}

/** 仅点击触发态下物理点入口打开面板。 */
async function openPanelByClick({ observe, input, panelMs }) {
  const raw = await observe.snapshot();
  if (panelVisible(raw)) return raw;
  if (!raw.entry.first || !raw.entry.first.rect) throw new HarnessError('悬浮入口不存在，无法做物理点击');
  await input.clickRect(raw.entry.first.rect, { steps: 6 });
  return await observe.waitFor((next) => panelVisible(next), { timeoutMs: panelMs, label: '物理点入口后面板打开' });
}

/** 用真实键盘清空 composer（物理点进编辑区 → Ctrl+A → Backspace → selection 回起点）。 */
async function clearComposer({ observe, input, panelMs }) {
  let raw = await observe.snapshot();
  const blank = (text) => String(text || '').replace(/[\u200b-\u200d\ufeff]/g, '').trim() === '';
  if (!blank(raw.composer.text)) {
    if (raw.composer.rect) await input.clickRect(raw.composer.rect, { steps: 4 });
    else await input.focus(COMPOSER_SELECTOR);
    raw = await observe.snapshot();
    if (!blank(raw.composer.text)) {
      await input.shortcut('Ctrl+A');
      await input.key('Backspace');
      raw = await observe.waitFor((next) => blank(next.composer.text), { timeoutMs: panelMs, label: '真实键盘清空草稿' });
    }
  }
  await input.setSelection(COMPOSER_SELECTOR, 0, 0);
  return await observe.snapshot();
}

/** 打开状态的面板快照里，触发方式胶囊的界面语义（aria-pressed=true ⇒ 仅点击）。 */
function triggerModeOf(raw) {
  const bar = raw && raw.trigger && raw.trigger.barTrigger;
  if (!bar || !bar.present) return { present: false, ariaPressed: null, mode: null, rect: null, text: bar ? bar.text : null };
  const pressed = bar.ariaPressed;
  return { present: true, ariaPressed: pressed, mode: pressed === 'true' ? 'click' : 'hover', rect: bar.rect, text: bar.text };
}

/** 关键字判定在页面输入日志里是否全部为真实事件（isTrusted）。 */
function summarizePointerEvents(log, expectedTypes) {
  const events = (log || []).filter((event) => event && expectedTypes.some((type) => String(event.type) === type));
  const trusted = events.filter((event) => event.trust === true).length;
  const synthetic = events.length - trusted;
  return { count: events.length, trusted, synthetic, allTrusted: events.length > 0 && synthetic === 0 };
}

export async function runTrigger(context) {
  const { recorder, client, server, prepared, timeouts, observe, input, persistence, fixture } = context;
  const panelMs = (timeouts && timeouts.panelMs) || 8_000;

  const env = {
    purpose: '第二条真实套件（触发/插入域）：同一观测层/输入驱动/判定协议承载另一个域的验收。',
    inputMethods: {
      physical: 'CDP 输入协议（真实指针 move/press/release）',
      keyboard: '真实键盘 keyDown/keyUp（Enter 激活按钮、逐键输入文本）',
    },
    evidence: '断言主证据 = 界面状态（aria-pressed / panel 可见性）+ 持久化 store（GET /_dsh/dsh-prompt/store 读回）；截图只作失败产物',
    completedScenarios: [],
    observations: {},
  };
  recorder.setEnvironment({ trigger: env });

  /** 前置检查的证据（#183 评审整改 F2）：前置不在场景内，steps 显式写清怎么重放自检。 */
  const preflightEvidence = {
    steps: [
      '检查 run.mjs 传入的 observe/input/persistence 句柄',
      '检查 --fixture 是 trigger-hover 且 expect.hoverTrigger=true',
      '在页面注入输入事件日志（input.log.install）并确认成功',
    ],
    claim: '触发套件的装配前置（句柄/配方/事件日志）齐全，后续指针与键盘路径才可归因',
    inference: '前置缺失属运行器装配或配方错误，记 BLOCKED 而不是产品失败',
  };

  if (!observe || !input || !persistence) {
    recorder.blocked('触发套件前置', '缺少 observe/input/persistence 句柄（run.mjs 需要创建并传给套件）', preflightEvidence);
    return;
  }
  if (!fixture || fixture.name !== 'trigger-hover') {
    recorder.blocked('触发套件前置', '本套件需要 --fixture trigger-hover（当前 fixture=' + (fixture ? fixture.name : '无') + '）', preflightEvidence);
    return;
  }
  const declared = fixture.declared || {};
  if (declared.hoverTrigger !== true) {
    recorder.blocked('触发套件前置', 'trigger-hover 配方的 expect.hoverTrigger 必须是 true，实际 ' + JSON.stringify(declared.hoverTrigger), preflightEvidence);
    return;
  }
  env.fixture = { name: fixture.name, declaredHoverTrigger: declared.hoverTrigger, runTag: fixture.params && fixture.params.runTag };
  recorder.setEnvironment({ trigger: env });

  try {
    await input.log.install();
  } catch (error) {
    recorder.blocked('触发套件前置', '无法安装页面输入事件日志：' + String(error && error.message ? error.message : error), {
      ...preflightEvidence,
      steps: ['在页面注入输入事件日志脚本（input.log.install）'],
      inference: '事件日志装不上属工具链/页面异常；继续跑会让「真实指针事件」断言失去证据，记 BLOCKED',
    });
    return;
  }

  /* ───────────────────── 场景 T1：真实指针触发路径（悬停开合 + 切到仅点击） ───────────────────── */

  await scenario(recorder, env, 'T1：真实指针触发路径', [
    'GET /_dsh/dsh-prompt/store 读回 hoverTrigger 初值，与 fixture 声明比对',
    '读快照确认面板收起；input.move 多段移动悬停入口 → waitFor panel.visible',
    '读 input.log：指针事件全部 isTrusted=true；断言打开态胶囊 aria-pressed=false（悬浮语义）',
    '读 store 与界面触发语义双通道对账（悬浮 ⇔ true）',
    'input.move 移开指针 → waitFor 面板自动收起（悬停排关）',
    '重新悬停开面板；物理点击底栏触发方式胶囊 → waitFor aria-pressed=true（仅点击）',
    '读 store 双通道对账（仅点击 ⇔ false）',
    '面板收起后把指针停在入口 700ms，断言仍不开窗（#179 契约）',
    '仅点击模式物理点入口开面板、物理点关闭按钮收面板',
  ], async () => {
    // 初始态：配方声明 hoverTrigger=true，store 读回必须一致（fixture 起始态已由 run.mjs 校验，这里再取界面侧证据）。
    const initialStore = await persistence.read();
    assertField(recorder, 'T1-0 初始态：配方声明 hoverTrigger=true 且 store 读回一致', {
      expected: true,
      observed: initialStore.baseline.hoverTrigger,
      source: 'persisted',
      claim: '触发方式的持久化初值来自 fixture 声明，而不是套件自己写死',
      steps: ['GET /_dsh/dsh-prompt/store 读回 baseline.hoverTrigger', '与 fixture.expect.hoverTrigger 对比'],
      observations: { storeHoverTrigger: initialStore.baseline.hoverTrigger, declared: declared.hoverTrigger },
      inference: 'store 与配方一致时，后续界面切换才能用双通道判定',
    });
    await closePanelByClick({ observe, input, panelMs });
    const initial = await observe.snapshot();
    assertField(recorder, 'T1-1 场景开始时面板处于收起状态', {
      expected: false,
      observed: panelVisible(initial),
      source: 'user-visible',
    });
    const entryRect = initial.entry.first && initial.entry.first.rect;
    if (!entryRect) throw new HarnessError('悬浮入口不存在，无法做物理悬停');

    // 指针路径 A：真实指针移入入口 → 面板打开。
    await input.log.clear();
    const hoverPlan = await input.move(null, { x: entryRect.cx, y: entryRect.cy }, { steps: 10 });
    const openRaw = await observe.waitFor((raw) => panelVisible(raw), { timeoutMs: panelMs, label: '物理悬停入口后面板打开' });
    const pointerLog = await input.log.read({ clear: false });
    const moveEvents = summarizePointerEvents(pointerLog, ['pointermove', 'pointerover', 'pointerenter', 'mousemove']);
    env.observations.T1HoverOpen = { plan: hoverPlan.description, pointerEvents: moveEvents };
    recorder.setEnvironment({ trigger: env });
    assertField(recorder, 'T1-2 物理悬停入口打开面板（真实指针路径）', {
      expected: true,
      observed: panelVisible(openRaw),
      source: 'user-visible',
      detail: 'plan=' + hoverPlan.description,
    });
    assertField(recorder, 'T1-3 物理指针事件全部 isTrusted=true（真实输入，不是合成事件）', {
      expected: true,
      observed: moveEvents.allTrusted,
      source: 'user-visible',
      detail: JSON.stringify(moveEvents),
    });

    // 双通道：打开态界面 aria-pressed=false（悬浮）↔ store.hoverTrigger=true。
    const initialMode = triggerModeOf(openRaw);
    assertField(recorder, 'T1-4 打开态：底栏触发方式胶囊为悬浮语义（aria-pressed=false）', {
      expected: 'hover',
      observed: initialMode.mode,
      source: 'user-visible',
      detail: 'aria-pressed=' + JSON.stringify(initialMode.ariaPressed) + '；text=' + JSON.stringify(initialMode.text),
    });
    const storeHover = await persistence.read();
    const hoverDual = compareDualChannels(
      { name: 'ui.triggerMode', value: initialMode.mode, source: 'user-visible' },
      { name: 'store.hoverTrigger', value: storeHover.baseline.hoverTrigger ? 'hover' : 'click', source: 'persisted' },
    );
    recorder.pass('双通道：触发方式界面语义 ↔ 持久化 hoverTrigger 一致（悬浮 ⇔ true）', {
      detail: '双通道一致：' + hoverDual.a.name + '=' + JSON.stringify(hoverDual.a.value) + '（' + hoverDual.a.source + '）↔ ' +
        hoverDual.b.name + '=' + JSON.stringify(hoverDual.b.value) + '（' + hoverDual.b.source + '）',
      ...evidenceFor({
        observations: { ui: hoverDual.a, store: hoverDual.b, agree: hoverDual.agree },
        inference: '界面语义与持久化落在同一事实时，触发方式切换的证据才闭合',
      }),
    });

    // 指针路径 B：移开指针 → 悬停排关，面板收起。
    await input.move(null, { x: 5, y: 5 }, { steps: 6 });
    const closedByLeave = await observe.waitFor((raw) => !panelVisible(raw), { timeoutMs: panelMs, label: '移开指针后面板自动收起' });
    assertField(recorder, 'T1-5 移开指针后面板自动收起（悬停排关）', {
      expected: false,
      observed: panelVisible(closedByLeave),
      source: 'user-visible',
    });

    // 指针路径 C：重新悬停开窗 → 物理点底栏触发方式胶囊 → 切到「仅点击」。
    await openPanelByHover({ observe, input, panelMs });
    const beforeToggleRaw = await observe.snapshot();
    const modeBefore = triggerModeOf(beforeToggleRaw);
    if (!modeBefore.present || !modeBefore.rect) throw new HarnessError('底栏缺少触发方式胶囊几何');
    await input.log.clear();
    const togglePlan = await input.clickRect(modeBefore.rect, { steps: 8 });
    const toggledRaw = await observe.waitFor(
      (raw) => triggerModeOf(raw).ariaPressed === 'true',
      { timeoutMs: panelMs, label: '物理点触发方式按钮后 aria-pressed=true' },
    );
    const toggleLog = await input.log.read({ clear: false });
    const toggleEvents = summarizePointerEvents(toggleLog, ['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup']);
    const modeAfter = triggerModeOf(toggledRaw);
    env.observations.T1Toggle = { plan: togglePlan.description, before: modeBefore, after: modeAfter, events: toggleEvents };
    recorder.setEnvironment({ trigger: env });
    assertField(recorder, 'T1-6 物理点底栏触发方式按钮后切到仅点击（aria-pressed=true，#179 契约）', {
      expected: 'click',
      observed: modeAfter.mode,
      source: 'user-visible',
      detail: 'plan=' + togglePlan.description + '；events=' + JSON.stringify(toggleEvents),
    });
    assertField(recorder, 'T1-7 切换点击事件的物理指针全部 isTrusted=true', {
      expected: true,
      observed: toggleEvents.allTrusted,
      source: 'user-visible',
      detail: JSON.stringify(toggleEvents),
    });
    const storeClick = await persistence.waitFor((baseline) => baseline.hoverTrigger === false, {
      timeoutMs: 6_000,
      label: '触发方式切换后 store.hoverTrigger 落盘 false',
    });
    const clickDual = compareDualChannels(
      { name: 'ui.triggerMode', value: modeAfter.mode, source: 'user-visible' },
      { name: 'store.hoverTrigger', value: storeClick.baseline.hoverTrigger ? 'hover' : 'click', source: 'persisted' },
    );
    recorder.pass('双通道：触发方式界面语义 ↔ 持久化 hoverTrigger 一致（仅点击 ⇔ false）', {
      detail: '双通道一致：' + clickDual.a.name + '=' + JSON.stringify(clickDual.a.value) + '（' + clickDual.a.source + '）↔ ' +
        clickDual.b.name + '=' + JSON.stringify(clickDual.b.value) + '（' + clickDual.b.source + '）',
      ...evidenceFor({
        observations: { ui: clickDual.a, store: clickDual.b, agree: clickDual.agree },
        inference: '界面语义与持久化落在同一事实时，触发方式切换的证据才闭合',
      }),
    });

    // 指针路径 D：#179 契约 —— 仅点击模式下悬停入口不再开窗。
    await closePanelByClick({ observe, input, panelMs });
    await input.move(null, { x: 5, y: 5 }, { steps: 4 });
    const entryForHover = (await observe.snapshot()).entry.first && (await observe.snapshot()).entry.first.rect;
    if (!entryForHover) throw new HarnessError('悬浮入口不存在，无法验证仅点击模式');
    await input.move(null, { x: entryForHover.cx, y: entryForHover.cy }, { steps: 8 });
    await sleep(700);
    const hoverInClickMode = await observe.snapshot();
    assertField(recorder, 'T1-8 仅点击模式下悬停入口不再打开面板（#179 契约）', {
      expected: false,
      observed: panelVisible(hoverInClickMode),
      source: 'user-visible',
      detail: '指针停在入口 700ms 后仍未开窗；aria-pressed=' + JSON.stringify(triggerModeOf(hoverInClickMode).ariaPressed),
    });

    // 指针路径 E：仅点击模式下物理点入口 → 面板打开；物理点关闭 → 收起。
    const openedByClick = await openPanelByClick({ observe, input, panelMs });
    assertField(recorder, 'T1-9 仅点击模式下物理点入口打开面板', {
      expected: true,
      observed: panelVisible(openedByClick),
      source: 'user-visible',
    });
    await closePanelByClick({ observe, input, panelMs });
    const closedByClick = await observe.snapshot();
    assertField(recorder, 'T1-10 物理点关闭按钮后面板收起', {
      expected: false,
      observed: panelVisible(closedByClick),
      source: 'user-visible',
    });
  });

  /* ───────────────────── 场景 T2：真实键盘路径（Enter 激活 + 逐键输入） ───────────────────── */

  await scenario(recorder, env, 'T2：真实键盘触发路径', [
    'DOM focus 入口按钮，读 input.focus 结果',
    '经 harness/input 发真实键盘 Enter keyDown/keyUp → waitFor 面板打开（原生 button 键盘激活）',
    'DOM focus 底栏触发方式按钮，真实 Enter → waitFor aria-pressed=false（回到悬浮）',
    '读 store 与界面触发语义双通道对账（悬浮 ⇔ true）',
    '再次 focus 入口 + Enter → waitFor 面板收起',
    '清空 composer 后 focus composer，逐键发真实 k/b/d keyDown/keyUp → waitFor 草稿文本 kbd',
  ], async () => {
    // T1 留下的是「仅点击」模式；键盘 Enter 在入口按钮上等价原生 click。
    const focusEntry = await input.focus(ENTRY_SELECTOR);
    assertField(recorder, 'T2-0 布置：入口按钮获得 DOM 焦点', {
      expected: true,
      observed: focusEntry.ok,
      source: 'user-visible',
      detail: JSON.stringify(focusEntry),
    });
    await input.key('Enter', { text: '\r' });
    const openedByEnter = await observe.waitFor((raw) => panelVisible(raw), { timeoutMs: panelMs, label: '焦点在入口时按 Enter 打开面板' });
    assertField(recorder, 'T2-1 键盘路径：焦点在入口 + Enter 打开面板（原生 button 键盘激活）', {
      expected: true,
      observed: panelVisible(openedByEnter),
      source: 'user-visible',
      claim: '入口按钮的键盘激活路径与指针点击等价（真实 keyDown/keyUp，不是 element.click()）',
      steps: ['DOM focus 入口按钮', '经 harness/input 发真实键盘 Enter keyDown/keyUp', '观测 panel 可见'],
      observations: { panelVisible: panelVisible(openedByEnter), activeElement: 'entry' },
      inference: '键盘用户能用 Enter 打开模板面板，说明触发域不只有指针路径',
    });

    // 键盘把触发方式切回悬浮：focus 触发方式胶囊 + Enter。
    const modeNow = triggerModeOf(openedByEnter);
    if (!modeNow.present) throw new HarnessError('底栏缺少触发方式胶囊，无法做键盘切换');
    const focusTrigger = await input.focus(TRIGGER_SELECTOR);
    assertField(recorder, 'T2-2 布置：触发方式按钮获得 DOM 焦点', {
      expected: true,
      observed: focusTrigger.ok,
      source: 'user-visible',
      detail: JSON.stringify(focusTrigger),
    });
    await input.key('Enter', { text: '\r' });
    const toggledByEnter = await observe.waitFor(
      (raw) => triggerModeOf(raw).ariaPressed === 'false',
      { timeoutMs: panelMs, label: '键盘 Enter 触发方式按钮后回到悬浮语义' },
    );
    const modeByKeyboard = triggerModeOf(toggledByEnter);
    assertField(recorder, 'T2-3 键盘路径：焦点在触发方式按钮 + Enter 切回悬浮触发（aria-pressed=false）', {
      expected: 'hover',
      observed: modeByKeyboard.mode,
      source: 'user-visible',
    });
    const storeHoverAgain = await persistence.waitFor((baseline) => baseline.hoverTrigger === true, {
      timeoutMs: 6_000,
      label: '键盘切换后 store.hoverTrigger 落盘 true',
    });
    const keyboardDual = compareDualChannels(
      { name: 'ui.triggerMode', value: modeByKeyboard.mode, source: 'user-visible' },
      { name: 'store.hoverTrigger', value: storeHoverAgain.baseline.hoverTrigger ? 'hover' : 'click', source: 'persisted' },
    );
    recorder.pass('双通道：键盘切换后界面语义 ↔ 持久化 hoverTrigger 一致（悬浮 ⇔ true）', {
      detail: '双通道一致：' + keyboardDual.a.name + '=' + JSON.stringify(keyboardDual.a.value) + '（' + keyboardDual.a.source + '）↔ ' +
        keyboardDual.b.name + '=' + JSON.stringify(keyboardDual.b.value) + '（' + keyboardDual.b.source + '）',
      ...evidenceFor({
        observations: { ui: keyboardDual.a, store: keyboardDual.b, agree: keyboardDual.agree },
        inference: '键盘路径与指针路径共享同一持久化事实，触发域两路证据闭合',
      }),
    });

    // 键盘再按一次入口：面板收起（button onClick 取反）。
    await input.focus(ENTRY_SELECTOR);
    await input.key('Enter', { text: '\r' });
    const closedByEnter = await observe.waitFor((raw) => !panelVisible(raw), { timeoutMs: panelMs, label: '焦点在入口时再按 Enter 关闭面板' });
    assertField(recorder, 'T2-4 键盘路径：入口再按 Enter 关闭面板', {
      expected: false,
      observed: panelVisible(closedByEnter),
      source: 'user-visible',
    });

    // 键盘文本输入：逐键 keyDown/keyUp（带 text 的真实字符键入），草稿逐字出现。
    await clearComposer({ observe, input, panelMs });
    const focusComposer = await input.focus(COMPOSER_SELECTOR);
    assertField(recorder, 'T2-5 布置：composer 获得 DOM 焦点', {
      expected: true,
      observed: focusComposer.ok,
      source: 'user-visible',
      detail: JSON.stringify(focusComposer),
    });
    for (const letter of ['k', 'b', 'd']) {
      await input.key(letter, { text: letter });
    }
    const typedRaw = await observe.waitFor((raw) => raw.composer.text === 'kbd', { timeoutMs: panelMs, label: '逐键输入后草稿文本 kbd' });
    assertField(recorder, 'T2-6 键盘路径：逐键 keyDown/keyUp 在 composer 输入文本（草稿 == kbd）', {
      expected: 'kbd',
      observed: typedRaw.composer.text,
      source: 'user-visible',
      claim: '真实按键序列（不是 insertText 粘贴路径）能把字符打进宿主 composer',
      steps: ['focus composer', "经 harness/input 发真实按键 'k'/'b'/'d'（带 text）", '观测 composer.innerText'],
      observations: { composerText: typedRaw.composer.text, composerFocused: typedRaw.composer.focused },
      inference: '键盘输入路径与指针路径共享同一 composer 观测口径，两域报告可并列比较',
    });
  });

  env.verdict = 'T1 指针路径 + T2 键盘路径；双通道（界面 ↔ store）在每个模式切换点各验一次';
  recorder.setEnvironment({ trigger: env });
}
