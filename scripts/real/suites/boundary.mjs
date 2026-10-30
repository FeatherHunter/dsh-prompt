#!/usr/bin/env node
/**
 * 边界套件（#188）：边界观测层 × 真实输入驱动，三个代表性场景。
 *
 * 每个场景的骨架都是「布置 → 物理输入 → 原始观测 → 按契约断言 → 双通道对账」：
 *   1. 打开面板：物理悬停 vs element.click() 合成路径，两路原始观测与事件差异都进报告；
 *   2. 行插入落位：按用户可见名称定位模板行，点行后逐字断言宿主 composer 草稿与光标位置，
 *      再用 store（GET /_dsh/dsh-prompt/store）双通道对账 usage/lastUsed/被点行身份；
 *   3. 设置页控件切换：点底栏「模板管理」进设置页，物理点「屏蔽预制模板」与「触发方式」，
 *      每步同时断言界面状态（用户可见）与持久化数据（store）。
 *
 * 期望值来源：fixture 配方声明（seed/declared）+ 产品契约（data-dsh-prompt-* 钩子、
 * 宿主 composer inputActions 契约、TRIGGER 按钮 aria-pressed 契约），不读实现内部状态。
 *
 * 观测来源等级：自述 < 内部状态 < 公开接口 < 用户可见 < 持久化（见 observe/source.mjs）。
 * 本套件不依赖内部类名；缺稳定钩子的地方记录在 docs/real/hook-gaps.md。
 */

import path from 'node:path';

import { HarnessError } from '../harness/errors.mjs';
import {
  compareDualChannels,
  describeSources,
  diffEventSequences,
  diffObservations,
  hitTestExpression,
  locateRows,
  normalizeText,
  scrollLogClearExpression,
  scrollLogInstallExpression,
  scrollLogReadExpression,
  waitForLayoutSettled,
} from '../harness/observe/index.mjs';

/** 产品文本（字符串是产品行为的一部分，不是 locale 标签）。 */
const SECTION_NAMES = ['提示词模板', 'Prompt Templates'];

const ENTRY_SELECTOR = '[data-dsh-prompt-entry]';
const COMPOSER_SELECTOR = '[data-composer-input]';
const HIDE_TOGGLE_SELECTOR = '[data-dsh-prompt-hide-toggle]';
const TRIGGER_SELECTOR = '[data-dsh-prompt-trigger]';

const MAX_DETAIL = 6_000;

function json(value, max = MAX_DETAIL) {
  let text;
  try {
    text = JSON.stringify(value);
  } catch (error) {
    text = String(value);
  }
  if (text === undefined) text = String(value);
  return text.length > max ? text.slice(0, max) + '…（截断）' : text;
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 事件日志摘要（进报告的环境字段）：保留类型/isTrusted/命中的契约钩子/坐标，
 * 丢弃 describe() 里的长文本与重复字段，避免报告膨胀。
 */
function summarizeEventLog(entries) {
  return (entries || []).map((event) => ({
    seq: event.seq,
    type: event.type,
    trust: event.trust,
    tag: event.target && event.target.tag,
    attrs: event.target && event.target.attrs,
    chain: event.target && event.target.chain,
    text: event.target && event.target.text,
    x: event.x,
    y: event.y,
  }));
}

/**
 * 事件的契约链：目标元素自身 + 祖先上的 data-dsh-prompt-*。
 * 真实指针事件的 target 常是行内 span（自身可能只带 data-dsh-prompt-label），
 * 单看 attrs 会把「命中入口组件」误判成「没命中」——所以按链归属。
 */
function contractChainOf(event) {
  const target = event && event.target;
  if (!target) return [];
  if (Array.isArray(target.chain) && target.chain.length > 0) return target.chain;
  if (target.attrs && Object.keys(target.attrs).length > 0) return [{ tag: target.tag, attrs: target.attrs }];
  return [];
}

/** 事件是否命中某个契约钩子（链上任意一层带该属性即命中）。 */
function hitsHook(event, hook) {
  return contractChainOf(event).some((link) => link && link.attrs && link.attrs[hook] !== undefined);
}

/**
 * 场景级证据（#183 评审整改 F2）：scenario() 声明本场景的布置/操作步骤，
 * 场景内所有 assertField/assertDual 默认把它并入六元组，个别检查可覆盖。
 * 这样报告里的 steps 是「怎么重放这条检查」，而不是统一兜底文本。
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

/** 单字段断言：expected 来自契约/配方，observed 来自观测层，source 标来源等级。 */
function assertField(recorder, name, assertion, evidence = {}) {
  const { expected, observed, source, detail } = assertion;
  const tuple = evidenceFor(evidence);
  if (deepEqual(expected, observed)) {
    recorder.pass(name, {
      detail: 'source=' + source + '；expected=' + json(expected) + (detail ? '；' + detail : ''),
      ...tuple,
    });
    return true;
  }
  recorder.fail(name, {
    expected,
    observed,
    detail: 'source=' + source + (detail ? '；' + detail : ''),
    ...tuple,
    // 失败时也把观测值带进六元组，重放者不必翻 detail 解析
    observations: tuple.observations !== undefined ? tuple.observations : { expected, observed, source },
  });
  return false;
}

/** 双通道断言：两路来自不同来源（界面/公开接口 vs 持久化），一致才算证据闭合。 */
function assertDual(recorder, name, dual, evidence = {}) {
  const tuple = evidenceFor({
    observations: { a: { value: dual.a.value, source: dual.a.source }, b: { value: dual.b.value, source: dual.b.source } },
    ...evidence,
  });
  if (dual.agree) {
    recorder.pass(
      name,
      {
        detail: '双通道一致：' + dual.a.name + '=' + json(dual.a.value) + '（' + dual.a.source + '）↔ ' +
          dual.b.name + '=' + json(dual.b.value) + '（' + dual.b.source + '）',
        ...tuple,
      },
    );
    return true;
  }
  recorder.fail(name, {
    expected: dual.a.value,
    observed: dual.b.value,
    detail: dual.detail + '（双通道不一致）',
    ...tuple,
  });
  return false;
}

/**
 * 场景包装：超时 = FAIL（产品在预算内没有响应），工具链异常 = BLOCKED（不把宿主/工具故障记到产品头上）。
 * 无论成败都把原始观测刷新进报告环境，失败时证据仍然完整。
 * scenarioSteps 是本场景可重放的布置/操作步骤，场景内检查默认继承（#183 评审整改 F2）。
 */
async function scenario(recorder, boundaryEnv, name, scenarioSteps, body) {
  const evidence = {
    steps: scenarioSteps,
    claim: '场景「' + name + '」的布置、真实输入与观测按这些步骤可在同一环境重放',
    inference: '步骤在预算内成立时，本场景内的界面断言与双通道对账才有证据力',
  };
  currentScenarioEvidence = evidence;
  recorder.setEnvironment({ boundary: { ...boundaryEnv, currentScenario: name } });
  try {
    await body();
    boundaryEnv.completedScenarios.push(name);
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
    recorder.setEnvironment({ boundary: { ...boundaryEnv, currentScenario: null } });
  }
}

/** 保证面板收起（物理点关闭）。 */
async function ensurePanelClosed({ observe, input, client, panelMs }) {
  const raw = await observe.snapshot();
  if (!raw.panel.visible) return raw;
  const closeRect = raw.panel.bar.closeRect || (await client.getRect('[data-dsh-prompt-close]', { required: true }));
  await input.clickRect(closeRect, { steps: 6 });
  return await observe.waitFor((next) => !next.panel.visible, { timeoutMs: panelMs, label: '点关闭后面板收起' });
}

/** 保证面板打开（物理悬停入口；不是 element.click()）。 */
async function ensurePanelOpen({ observe, input, client, panelMs }) {
  const raw = await observe.snapshot();
  if (raw.panel.visible) return raw;
  const entryRect = (raw.entry.first && raw.entry.first.rect) || (await client.getRect(ENTRY_SELECTOR, { required: true }));
  await input.move(null, { x: entryRect.cx, y: entryRect.cy }, { steps: 10 });
  return await observe.waitFor((next) => next.panel.visible, { timeoutMs: panelMs, label: '悬停入口打开模板面板' });
}

/**
 * 草稿是否为空：Lexical 的空编辑器 innerText 可能是一个换行（<p><br></p> → "\n"），
 * 不能拿 === '' 当空判据；这里只用于**布置**，断言仍用逐字比较。
 */
function isBlankComposer(text) {
  return String(text === null || text === undefined ? '' : text)
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .trim() === '';
}

/** 用真实键盘清空 composer（先物理点进编辑区 → Ctrl+A → Backspace），返回清空后的原始观测。 */
async function clearComposer({ observe, input, panelMs }) {
  let raw = await observe.snapshot();
  if (!isBlankComposer(raw.composer.text)) {
    // 物理点进编辑区：DOM focus() 不一定把 Lexical 的选区放进编辑区，键盘会落到别处。
    if (raw.composer.rect) await input.clickRect(raw.composer.rect, { steps: 4 });
    else await input.focus(COMPOSER_SELECTOR);
    raw = await observe.snapshot();
    if (!isBlankComposer(raw.composer.text)) {
      await input.shortcut('Ctrl+A');
      await input.key('Backspace');
      raw = await observe.waitFor((next) => isBlankComposer(next.composer.text), { timeoutMs: panelMs, label: '真实键盘清空草稿' });
    }
  }
  const selection = await input.setSelection(COMPOSER_SELECTOR, 0, 0);
  raw = await observe.snapshot();
  return { raw, selection };
}

export async function runBoundary(context) {
  const { recorder, client, server, prepared, timeouts, observe, input, persistence, fixture, shotsDir } = context;
  const panelMs = (timeouts && timeouts.panelMs) || 8_000;

  const boundaryEnv = {
    purpose: '边界观测层 × 真实输入驱动（#188）：原始观测先记录再解释，关键断言双通道。',
    sourceOrder: describeSources(),
    inputMethods: {
      physical: 'CDP 输入协议（真实指针 / 键盘 / 文本输入，isTrusted=true）',
      synthetic: 'element.click()（显式可选路径，标注 method=synthetic.click()）',
    },
    completedScenarios: [],
    observations: {},
    diffs: {},
    screenshots: [],
  };
  recorder.setEnvironment({ boundary: boundaryEnv });

  /** 前置检查的证据：这些检查没进入任何场景，steps 显式写清「怎么重放前置自检」。 */
  const preflightEvidence = {
    steps: [
      '检查 run.mjs 是否创建并传入 observe/input/persistence 句柄',
      '检查 fixture.params.runTag、fixture.declared.customs、fixture.recipe.seed.customs 是否齐全',
      '在页面注入输入事件日志（input.log.install）并确认成功',
    ],
    claim: '边界套件的装配前置（句柄/配方/事件日志）齐全，后续场景检查才有归因意义',
    inference: '前置缺失属运行器装配或配方错误，记 BLOCKED 而不是产品失败',
  };

  if (!observe || !input || !persistence) {
    recorder.blocked('边界套件前置', '缺少 observe/input/persistence 句柄（run.mjs 需要创建并传给套件）', preflightEvidence);
    return;
  }

  /**
   * 解释快照：设置页导航按**产品文本**定位（提示词模板 / Prompt Templates）。
   * 文本列表必须传给解释器，否则 navMatch 无从比较——期望来自产品公开文案，不是 locale 猜测。
   */
  const interpret = (raw) => observe.interpret(raw, { sectionName: SECTION_NAMES });

  if (!fixture || !fixture.params || typeof fixture.params.runTag !== 'string') {
    recorder.blocked('边界套件前置', '缺少 fixture 装配结果（需要 fixture.params.runTag 以定位夹具模板）', preflightEvidence);
    return;
  }
  const declared = fixture.declared || {};
  const recipe = fixture.recipe || {};
  const seedCustoms = recipe.seed && Array.isArray(recipe.seed.customs) ? recipe.seed.customs : [];
  if (!Array.isArray(declared.customs) || declared.customs.length === 0 || seedCustoms.length === 0) {
    recorder.blocked('边界套件前置', '配方没有声明自定义模板或 seed.customs（需要 fixture templates.json）', preflightEvidence);
    return;
  }
  boundaryEnv.fixture = {
    name: fixture.name,
    runTag: fixture.params.runTag,
    declaredCustoms: declared.customs.map((item) => ({ id: item.id, name: item.name })),
    declaredUsage: declared.usage || {},
    declaredLastUsed: declared.lastUsed,
    declaredHidePreset: declared.hidePreset,
    declaredHoverTrigger: declared.hoverTrigger,
  };
  recorder.setEnvironment({ boundary: boundaryEnv });

  try {
    await input.log.install();
  } catch (error) {
    recorder.blocked('边界套件前置', '无法安装页面输入事件日志：' + String(error && error.message ? error.message : error), {
      ...preflightEvidence,
      steps: ['在页面注入输入事件日志脚本（input.log.install）'],
      inference: '事件日志装不上属工具链/页面异常；继续跑会让「真实事件」类断言失去证据，记 BLOCKED',
    });
    return;
  }

  /**
   * 机械预备：把控件滚进可点击区域后重新采集原始观测。
   * 滚动不动（ok=false）时记 BLOCKED 并返回 null——物理点击前的几何准备失败是工具/宿主限制，
   * 不能让后面的「点不到 → 观测超时」冒充产品失败。
   */
  async function scrollThenObserve(selector, key) {
    const scroll = await input.scrollIntoView(selector);
    boundaryEnv.observations[key + 'Scroll'] = scroll;
    recorder.setEnvironment({ boundary: boundaryEnv });
    if (!scroll.ok) {
      recorder.blocked('场景 3：机械滚动把控件放进视口', '物理点击前无法把设置页控件放进视口（宿主滚动容器限制，非产品失败）：' + json(scroll), evidenceFor({
        inference: '滚不动是宿主滚动容器限制，工具/宿主问题记 BLOCKED，不能冒充产品 FAIL',
      }));
      return null;
    }
    return { raw: await observe.snapshot(), scroll };
  }

  /**
   * 物理点击可能被「产品自己的异步滚动」挪动过的控件：
   * 每次点击前重新滚动+采集几何，并用 `document.elementFromPoint` 验证命中链上确实是目标控件；
   * 命中不对或点击后状态没翻转就重新来（≤3 次）。判定不放宽：3 次真实物理点击后状态仍未翻转 → FAIL。
   */
  async function clickControlWithVerify(options) {
    const { key, selector, hook, rectOf, predicate, waitLabel, attemptLog, perAttemptMs = 2_500, attempts = 3 } = options;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const prepared = await scrollThenObserve(selector, 'scenario3' + key + 'Attempt' + attempt);
      if (!prepared) return { ok: false, attempts: attemptLog, blocked: true };
      const rect = rectOf(prepared.raw);
      if (!rect) throw new HarnessError('设置页控件缺少几何：' + selector);
      const hit = await client.evaluate(hitTestExpression({ x: rect.cx, y: rect.cy }), { returnByValue: true });
      const hitAttrs = hit && hit.hit && ((hit.hit.owner && hit.hit.owner.attrs) || hit.hit.attrs);
      const hitsTarget = !!(hitAttrs && hitAttrs[hook] !== undefined);
      const record = {
        attempt,
        rect,
        hitsTarget,
        hit: hit && hit.hit && { tag: hit.hit.tag, text: hit.hit.text, owner: hit.hit.owner && hit.hit.owner.attrs },
      };
      attemptLog.push(record);
      if (!hitsTarget) {
        await sleep(250);
        continue;
      }
      await input.clickRect(rect, { steps: 6 });
      const rightAfter = await observe.snapshot();
      record.rightAfter = {
        rect: rectOf(rightAfter),
        ariaPressed: rightAfter.settings.section.triggerButton.ariaPressed,
        hideChecked: rightAfter.settings.section.hideToggle.checked,
        dialogPresent: rightAfter.settings.dialog.present,
      };
      try {
        const after = await observe.waitFor(predicate, { timeoutMs: perAttemptMs, label: waitLabel });
        return { ok: true, before: prepared.raw, after, attempts: attemptLog };
      } catch (error) {
        record.waitError = String(error && error.message ? error.message : error);
        await sleep(250);
      }
    }
    return { ok: false, attempts: attemptLog };
  }

  /* ────────────────────────── 场景 1：打开面板 ────────────────────────── */

  await scenario(recorder, boundaryEnv, '场景 1：打开面板', [
    '读快照确认面板初始收起（panel.visible=false）',
    'input.move 多段移动悬停在入口按钮上 → waitFor panel.visible 为真',
    '读 input.log：入口 pointerenter/pointerover/pointermove 都是 isTrusted=true，最后一段落点在入口矩形内',
    '解释快照：断言面板根可见、触发胶囊 aria-pressed 与 fixture 声明的 hoverTrigger 语义一致',
    'GET /_dsh/dsh-prompt/store 读回：界面行 id 集合与 store 自定义模板 id 集合一致（双通道），行数=自定义数',
    '物理点击底栏关闭按钮 → waitFor panel.visible=false',
    'input.syntheticClick 入口（element.click()）→ waitFor panel.visible；比对物理/合成两路径的观测差分与事件序列差分',
    '恢复面板收起态',
  ], async () => {
    await ensurePanelClosed({ observe, input, client, panelMs });
    const initial = await observe.snapshot();
    assertField(recorder, '①面板开关：场景开始时面板处于收起状态', {
      expected: false,
      observed: initial.panel.visible,
      source: 'user-visible',
    });
    const entryRect = initial.entry.first && initial.entry.first.rect;
    if (!entryRect) throw new HarnessError('悬浮入口不存在，无法做物理悬停');

    // ── 路径 A：物理指针（多段 move → 悬停）
    await input.log.clear();
    const physicalPlan = await input.move(null, { x: entryRect.cx, y: entryRect.cy }, { steps: 10 });
    const physicalRaw = await observe.waitFor((raw) => raw.panel.visible, { timeoutMs: panelMs, label: '物理悬停后打开面板' });
    const physicalLog = await input.log.read({ clear: false });
    const physical = interpret(physicalRaw);
    boundaryEnv.observations.scenario1Physical = physicalRaw;
    boundaryEnv.observations.scenario1PhysicalLog = summarizeEventLog(physicalLog);
    recorder.setEnvironment({ boundary: boundaryEnv });

    assertField(recorder, '①面板根：物理悬停入口后面板可见', {
      expected: true,
      observed: physical.panel.fields.visible.value,
      source: physical.panel.fields.visible.source,
      detail: 'rect=' + json(physical.panel.fields.rect.value),
    });
    // 契约链归属：内层 span（data-dsh-prompt-label）上的指针事件也归入口组件（data-dsh-prompt-entry）。
    const entryEvents = physicalLog.filter((event) => hitsHook(event, 'data-dsh-prompt-entry'));
    const isTrustedEntry = entryEvents.length > 0 && entryEvents.every((event) => event.trust === true);
    assertField(recorder, '物理指针：入口事件全部 isTrusted=true（真实输入，不是合成事件）', {
      expected: true,
      observed: isTrustedEntry,
      source: 'user-visible',
      detail: 'types=' + json(entryEvents.map((event) => event.type)),
    });
    const hasEnter = entryEvents.some((event) => event.type === 'pointerenter' || event.type === 'pointerover');
    const hasMove = entryEvents.some((event) => event.type === 'pointermove');
    // 多段 move：真实指针从起点走到入口，至少两段 pointermove；最后一段的落点必须落在入口矩形内，
    // 证明是「指针移到入口上」而不是别处的事件被记错归属（几何 + 归属双证据）。
    const trustedMoves = physicalLog.filter((event) => event && event.type === 'pointermove' && event.trust === true);
    const lastMove = trustedMoves[trustedMoves.length - 1] || null;
    const insideEntry = !!(lastMove && typeof lastMove.x === 'number' && typeof lastMove.y === 'number' &&
      lastMove.x >= entryRect.x && lastMove.x <= entryRect.x + entryRect.width &&
      lastMove.y >= entryRect.y && lastMove.y <= entryRect.y + entryRect.height);
    assertField(recorder, '物理指针：进入序列含 pointerenter/pointerover 与多段 pointermove', {
      expected: true,
      observed: hasEnter && hasMove && trustedMoves.length >= 2 && insideEntry,
      source: 'user-visible',
      detail: 'plan=' + json(physicalPlan.description.slice(0, 3)) + '…' +
        '；moveCount=' + trustedMoves.length +
        '；lastMove=' + json(lastMove && { x: lastMove.x, y: lastMove.y }) +
        '；entryRect=' + json({ x: entryRect.x, y: entryRect.y, width: entryRect.width, height: entryRect.height }) +
        '；insideEntry=' + insideEntry +
        '；entryTypes=' + json(entryEvents.map((event) => event.type)) +
        '；allTypes=' + json(physicalLog.map((event) => event.type)),
    });

    // ⑥ 触发按钮状态：fixture 声明 hoverTrigger → 底栏 aria-pressed 语义
    const expectedAria = declared.hoverTrigger === false ? 'true' : 'false';
    assertField(recorder, '⑥触发按钮：底栏触发方式与 fixture 声明一致（hoverTrigger 语义 ↔ aria-pressed）', {
      expected: expectedAria,
      observed: physical.trigger.fields.barTriggerAriaPressed.value,
      source: physical.trigger.fields.barTriggerAriaPressed.source,
      detail: 'text=' + json(physical.trigger.fields.barTriggerText.value),
    });

    // ② 模板行 + 双通道（界面行 ↔ 持久化 store 自定义模板）
    const storeStart = await persistence.read();
    const rowIds = physical.rows.fields.ids.value;
    const storeIds = (storeStart.baseline.customs || []).map((item) => item.id);
    assertDual(
      recorder,
      '②模板行：界面行 id 与持久化 store 自定义模板 id 双通道一致（同一组模板）',
      compareDualChannels(
        { name: 'panel.rowIds', value: [...rowIds].sort(), source: 'public-api' },
        { name: 'store.customs', value: [...storeIds].sort(), source: 'persisted' },
        // 断言语义是「同一组模板」，排序/置顶策略由产品决定，不属于窗口观测契约；
        // 两侧按 id 集合比较，顺序差异记录在 detail 里备查。
        { name: '模板行 ↔ store', compare: (left, right) => deepEqual(left, right) },
      ),
    );
    if (JSON.stringify(rowIds) !== JSON.stringify(storeIds)) {
      boundaryEnv.diffs.rowOrder = {
        panelOrder: rowIds,
        storeOrder: storeIds,
        note: '集合一致、呈现顺序不同（产品排序/置顶策略，不作为失败）',
      };
    }
    assertField(recorder, '②模板行：行数等于 store 自定义模板数（hidePreset=true 时只列自定义）', {
      expected: storeIds.length,
      observed: physical.rows.fields.count.value,
      source: physical.rows.fields.count.source,
      detail: 'texts=' + json(physical.rows.fields.texts.value),
    });

    // 关闭：物理点 ×，为合成路径准备同一初始态
    const closeRect = physicalRaw.panel.bar.closeRect;
    if (!closeRect) throw new HarnessError('底栏缺少关闭按钮几何');
    await input.clickRect(closeRect, { steps: 6 });
    const closed = await observe.waitFor((raw) => !raw.panel.visible, { timeoutMs: panelMs, label: '物理点关闭后面板收起' });
    assertField(recorder, '①面板开关：物理点击关闭按钮后面板收起', {
      expected: false,
      observed: closed.panel.visible,
      source: 'user-visible',
    });

    // ── 路径 B：合成点击（显式可选路径）
    await input.log.clear();
    const synthClick = await input.syntheticClick(ENTRY_SELECTOR);
    const synthRaw = await observe.waitFor((raw) => raw.panel.visible, { timeoutMs: panelMs, label: '合成点击后打开面板' });
    const synthLog = await input.log.read({ clear: false });
    boundaryEnv.observations.scenario1Synthetic = synthRaw;
    boundaryEnv.observations.scenario1SyntheticLog = summarizeEventLog(synthLog);
    boundaryEnv.observations.scenario1SyntheticClick = synthClick;
    recorder.setEnvironment({ boundary: boundaryEnv });

    assertField(recorder, '场景1 合成路径：element.click() 也能打开面板（显式可选路径）', {
      expected: true,
      observed: !!(synthClick.ok && synthRaw.panel.visible),
      source: 'user-visible',
      detail: 'method=' + synthClick.method,
    });
    const synthClickEvents = synthLog.filter((event) => event && event.type === 'click');
    const synthEntryNonTrusted = synthLog.filter((event) => hitsHook(event, 'data-dsh-prompt-entry'));
    assertField(recorder, '合成路径：只发出非 trusted 的 click，没有真实指针序列', {
      expected: true,
      observed:
        synthClickEvents.length > 0 &&
        synthClickEvents.every((event) => event.trust === false) &&
        !synthEntryNonTrusted.some((event) => /^pointer(down|up|over|enter|move)$/.test(event.type) && event.trust === true),
      source: 'user-visible',
      detail: 'types=' + json(synthEntryNonTrusted.map((event) => event.type + (event.trust ? '(trusted)' : '(untrusted)'))) +
        '；clickEvents=' + json(synthClickEvents),
    });

    // ── 票面 C：两路原始观测 + 差异清单
    const facets = (raw) => ({
      panelVisible: raw.panel.visible,
      barPresent: raw.panel.bar.present,
      rowIds: raw.panel.list.rows.map((row) => row.id),
      rowTexts: raw.panel.list.rows.map((row) => normalizeText(row.text)),
      triggerAriaPressed: raw.trigger.barTrigger.ariaPressed,
      modalCount: raw.overlays.modalCount,
    });
    const behaviorDiff = diffObservations(facets(physicalRaw), facets(synthRaw));
    boundaryEnv.diffs.scenario1Behavior = behaviorDiff.diffs;
    assertField(recorder, '两路径：打开面板后的行为观测一致（原始观测差分 0 条）', {
      expected: 0,
      observed: behaviorDiff.count,
      source: 'user-visible',
      detail: 'diffs=' + json(behaviorDiff.diffs),
    });

    const eventDiff = diffEventSequences(physicalLog, synthLog);
    boundaryEnv.diffs.scenario1Events = eventDiff;
    recorder.setEnvironment({ boundary: boundaryEnv });
    assertField(recorder, '两路径：事件序列差异清单符合预期（物理独有真实指针序列；两路 click 语义各一份）', {
      expected: true,
      observed: eventDiff.onlyLeft.some((type) => /^pointer/.test(type)) && synthClickEvents.every((event) => event.trust === false),
      source: 'user-visible',
      detail: '物理独有=' + json(eventDiff.onlyLeft) + '；合成独有=' + json(eventDiff.onlyRight),
    });

    // 恢复收起，后续场景从干净状态开始
    await ensurePanelClosed({ observe, input, client, panelMs });
  });

  /* ────────────────────────── 场景 2：行插入落位 ────────────────────────── */

  await scenario(recorder, boundaryEnv, '场景 2：行插入落位', [
    'clearComposer：物理点进 composer → Ctrl+A/Backspace → setSelection(0,0)，快照确认草稿为空且光标在起点',
    '物理悬停入口打开面板（不是 element.click()）',
    '解释快照按用户可见行名（fixture 声明）定位目标模板行，并核对行 id',
    '物理点击目标行（input.clickRect）→ waitFor composer.text 逐字等于 fixture 正文',
    '解释快照：草稿字节、DOM selection.start、宿主 captureInsertion.start 三处落点都在正文末尾；面板自动收起；点击事件 isTrusted 且命中该行',
    'GET /_dsh/dsh-prompt/store：usage 计数 +1、lastUsed=该模板，并与界面/公开接口身份做双通道对账',
    '清空草稿后走合成路径（element.click() 行）→ waitFor 草稿逐字等于正文；断言草稿与光标落点',
    '读 store：usage 计数 = 声明值 + 2（合成路径再 +1）',
    '比对物理/合成两路径的草稿/字符数/光标/面板状态差分（应为 0 条）',
  ], async () => {
    const alpha = declared.customs[0];
    const alphaSeed = seedCustoms.find((item) => item && item.id === alpha.id) || null;
    const body = alphaSeed && typeof alphaSeed.body === 'string' ? alphaSeed.body : '';
    if (!body) {
      recorder.blocked('场景 2：行插入落位', 'fixture 的 seed.customs[0].body 缺失，无法做字节级草稿断言', evidenceFor());
      return;
    }
    boundaryEnv.insertion = { templateId: alpha.id, templateName: alpha.name, expectedBody: body, expectedBodyChars: body.length };
    recorder.setEnvironment({ boundary: boundaryEnv });

    // 布置：真实键盘清空草稿 + selection API 把光标放到起点
    const { selection } = await clearComposer({ observe, input, panelMs });
    assertField(recorder, '③草稿布置：光标已由 selection API 放到草稿起点', {
      expected: 0,
      observed: selection.ok ? selection.start : null,
      source: 'user-visible',
      detail: 'selection=' + json(selection),
    });

    // 物理悬停打开面板
    const panelRaw = await ensurePanelOpen({ observe, input, client, panelMs });
    const panelSurface = interpret(panelRaw);
    const texts = panelSurface.rows.fields.texts.value;
    const ids = panelSurface.rows.fields.ids.value;
    const located = locateRows(texts.map((text, index) => ({ text, id: ids[index] })), { mode: 'contains', value: alpha.name });
    if (located.length === 0) {
      recorder.fail('②模板行：按用户可见名称定位目标行', {
        expected: '文本包含「' + alpha.name + '」的行',
        observed: json(texts),
        detail: '模板行文本不含 fixture 声明名称',
        ...evidenceFor(),
        observations: { expectedText: alpha.name, rows: texts },
        inference: '行名是用户可见的定位契约；行名不匹配说明 fixture 种子或列表渲染没有对齐',
      });
      throw new HarnessError('无法按语义文本定位模板行：' + alpha.name);
    }
    const row = located[0].row;
    const rowRect = panelRaw.panel.list.rows[located[0].index] && panelRaw.panel.list.rows[located[0].index].rect;
    if (!rowRect) throw new HarnessError('模板行没有可点击矩形');
    assertField(recorder, '②模板行：按用户可见名称定位到目标行（不靠内部类名）', {
      expected: alpha.id,
      observed: row.id,
      source: 'user-visible',
      detail: 'matchedText=' + json(row.text),
    });

    // ── 路径 A：物理点击模板行
    await input.log.clear();
    const insertion = await input.clickRect(rowRect, { steps: 8 });
    const physicalRaw = await observe.waitFor((raw) => raw.composer.text === body, { timeoutMs: panelMs, label: '物理点击模板行后草稿逐字出现正文' });
    const physical = interpret(physicalRaw);
    const physicalLog = await input.log.read({ clear: false });
    boundaryEnv.observations.scenario2Physical = physicalRaw;
    boundaryEnv.observations.scenario2PhysicalPlan = insertion.description;
    recorder.setEnvironment({ boundary: boundaryEnv });

    assertField(recorder, '③草稿文本：物理点击行后草稿逐字等于 fixture 正文（字节级）', {
      expected: body,
      observed: physicalRaw.composer.text,
      source: physical.composer.fields.draftText.source,
      detail: 'chars=' + physicalRaw.composer.text.length,
    });
    assertField(recorder, '③光标位置：插入后光标停在正文末尾（公开接口 captureInsertion）', {
      expected: body.length,
      observed: physical.composer.fields.caretStart.value,
      source: physical.composer.fields.caretStart.source,
    });
    assertField(recorder, '③光标位置（第二路）：DOM 选区偏移同样在正文末尾', {
      expected: body.length,
      observed: physical.composer.fields.selectionStart.value,
      source: physical.composer.fields.selectionStart.source,
    });
    assertField(recorder, '①面板开关：选中插入后面板自动收起', {
      expected: false,
      observed: physical.panel.fields.visible.value,
      source: physical.panel.fields.visible.source,
    });
    const trustedClickTarget = physicalLog
      .filter((event) => event && event.type === 'click' && event.trust === true)
      .map((event) => contractChainOf(event).map((link) => link.attrs['data-dsh-prompt-id']).find((value) => value !== undefined))
      .find((value) => value !== undefined);
    assertField(recorder, '物理指针：点击事件为 isTrusted=true 且命中目标模板行', {
      expected: alpha.id,
      observed: trustedClickTarget || null,
      source: 'user-visible',
      detail: 'clickEvents=' + json(physicalLog.filter((event) => event && event.type === 'click')),
    });

    // 双通道：界面草稿/行身份 ↔ store usage/lastUsed
    const declaredUsage = Number((declared.usage && declared.usage[alpha.id]) || 0);
    const storeAfterPhysical = await persistence.waitFor(
      (baseline) => Number(baseline.usage[alpha.id] || 0) === declaredUsage + 1 && baseline.lastUsed === alpha.id,
      { timeoutMs: 6_000, label: '物理插入后 store usage+1 且 lastUsed=该模板' },
    );
    boundaryEnv.observations.scenario2StoreAfterPhysical = storeAfterPhysical.baseline;
    assertField(recorder, '双通道·持久化：插入后 usage 计数 +1（store，期望=声明值+1）', {
      expected: declaredUsage + 1,
      observed: storeAfterPhysical.baseline.usage[alpha.id],
      source: 'persisted',
    });
    assertField(recorder, '双通道·持久化：插入后 lastUsed=被点模板（store）', {
      expected: alpha.id,
      observed: storeAfterPhysical.baseline.lastUsed,
      source: 'persisted',
    });
    assertDual(
      recorder,
      '双通道：被点击行身份（界面/公开接口）与持久化 lastUsed 一致（同一事实两路证据）',
      compareDualChannels(
        { name: 'clickedRowId', value: trustedClickTarget || null, source: 'public-api' },
        { name: 'store.lastUsed', value: storeAfterPhysical.baseline.lastUsed, source: 'persisted' },
      ),
    );

    // ── 路径 B：合成点击同一行（显式可选路径）
    await clearComposer({ observe, input, panelMs });
    const reopenedRaw = await ensurePanelOpen({ observe, input, client, panelMs });
    const targetId = alpha.id;
    const rowSelector = '[data-dsh-prompt-id="' + String(targetId).replace(/"/g, '\\"') + '"]';
    await input.log.clear();
    const synthInsert = await input.syntheticClick(rowSelector);
    const synthRaw = await observe.waitFor((raw) => raw.composer.text === body, { timeoutMs: panelMs, label: '合成点击模板行后草稿逐字出现正文' });
    const synth = interpret(synthRaw);
    boundaryEnv.observations.scenario2Synthetic = synthRaw;
    boundaryEnv.observations.scenario2SyntheticClick = synthInsert;
    recorder.setEnvironment({ boundary: boundaryEnv });

    assertField(recorder, '③草稿文本（合成路径）：与 fixture 正文逐字一致', {
      expected: body,
      observed: synthRaw.composer.text,
      source: synth.composer.fields.draftText.source,
      detail: 'method=' + synthInsert.method,
    });
    assertField(recorder, '③光标位置（合成路径）：插入后光标在正文末尾', {
      expected: body.length,
      observed: synth.composer.fields.caretStart.value,
      source: synth.composer.fields.caretStart.source,
    });
    const storeAfterSynthetic = await persistence.waitFor(
      (baseline) => Number(baseline.usage[alpha.id] || 0) === declaredUsage + 2 && baseline.lastUsed === alpha.id,
      { timeoutMs: 6_000, label: '合成插入后 store usage 再 +1' },
    );
    assertField(recorder, '双通道·持久化（合成路径）：usage 计数 = 声明值 + 2', {
      expected: declaredUsage + 2,
      observed: storeAfterSynthetic.baseline.usage[alpha.id],
      source: 'persisted',
    });

    // ── 票面 C：两路径插入结果差异
    const facets = (raw) => ({
      draftText: raw.composer.text,
      draftChars: raw.composer.text.length,
      caretStart: raw.composer.inputActions.capture ? raw.composer.inputActions.capture.start : null,
      panelVisible: raw.panel.visible,
    });
    const behaviorDiff = diffObservations(facets(physicalRaw), facets(synthRaw));
    boundaryEnv.diffs.scenario2Behavior = behaviorDiff.diffs;
    assertField(recorder, '两路径：插入结果观测一致（草稿/字符数/光标/面板状态差分 0 条）', {
      expected: 0,
      observed: behaviorDiff.count,
      source: 'user-visible',
      detail: 'diffs=' + json(behaviorDiff.diffs) + '；reopenedRows=' + json(reopenedRaw.panel.list.rows.map((item) => item.id)),
    });
    recorder.setEnvironment({ boundary: boundaryEnv });
  });

  /* ────────────────────────── 场景 3：设置页控件切换 ────────────────────────── */

  await scenario(recorder, boundaryEnv, '场景 3：设置页控件切换', [
    'GET /_dsh/dsh-prompt/store 读回起始 hidePreset，与 fixture 声明比对',
    '物理悬停入口打开面板，物理点击底栏「模板管理」（data-dsh-prompt-chrome="goSettings"）',
    'waitFor 宿主设置弹窗 + 插件设置分区 + 隐藏预置控件出现；装页面滚动事件日志并清空',
    '等设置页自身异步滚动落定（控件矩形 + 滚动日志连续两拍不变），重新采集快照',
    '解释快照：断言 dialog 打开、按产品文本定位分区导航、插件区块挂载、hidePreset 初始勾选与 fixture 一致',
    'elementFromPoint 验证命中链含 data-dsh-prompt-hide-toggle 后物理点击 → waitFor checked=false；读 store 双通道对账 hidePreset',
    '断言设置页触发方式初始为悬浮语义（aria-pressed=false）',
    'elementFromPoint 验证命中 data-dsh-prompt-trigger 后物理点击 → waitFor aria-pressed=true（#179 仅点击契约）；读 store 双通道对账 hoverTrigger=false',
    '解释快照：弹层观测面识别出设置弹窗（settingsDialogPresent）',
  ], async () => {
    const storeBefore = await persistence.read();
    assertField(recorder, '双通道·持久化：起始 hidePreset 与 fixture 声明一致', {
      expected: declared.hidePreset,
      observed: storeBefore.baseline.hidePreset,
      source: 'persisted',
    });

    const panelRaw = await ensurePanelOpen({ observe, input, client, panelMs });
    const goSettingsRect = panelRaw.panel.bar.goSettingsRect;
    if (!goSettingsRect) {
      recorder.blocked('场景 3：设置页导航', '底栏缺少 data-dsh-prompt-chrome="goSettings" 入口几何', evidenceFor({
        inference: '底栏设置入口几何缺失=宿主/产品入口变化，导航无法推进，记 BLOCKED',
      }));
      return;
    }
    await input.log.clear();
    await input.clickRect(goSettingsRect, { steps: 8 });

    let settingsRaw;
    try {
      settingsRaw = await observe.waitFor(
        (raw) => raw.settings.dialog.present && raw.settings.section.present && raw.settings.section.hideToggle.present,
        { timeoutMs: 12_000, label: '点底栏设置入口后插件设置页出现' },
      );
    } catch (error) {
      const raw = await observe.snapshot();
      boundaryEnv.observations.scenario3NavigateFailed = raw;
      recorder.blocked(
        '场景 3：设置页导航',
        '物理点底栏 goSettings 后宿主设置弹窗/插件设置页未出现（宿主设置入口可能变化）：' +
          json({ dialogs: raw.settings.dialog, bar: raw.panel.bar, settings: raw.settings.section }),
        evidenceFor({ inference: '宿主设置入口/弹窗结构变化时导航无法推进，记 BLOCKED 而不是产品 FAIL' }),
      );
      return;
    }
    // 诊断：装滚动事件日志并清空，失败时用来判断「谁把控件滚出了视口」。
    await client.evaluate(scrollLogInstallExpression(), { returnByValue: true });
    await client.evaluate(scrollLogClearExpression(), { returnByValue: true });
    // 产品行为：打开设置页后插件自己会把远程段滚进视野（异步，可能在弹窗出现之后），
    // 先等布局落定再采集几何与点击——否则快照矩形会在点击前失效。
    const settle = await waitForLayoutSettled({ client, observe, selector: TRIGGER_SELECTOR });
    settingsRaw = await observe.snapshot();
    boundaryEnv.observations.scenario3SettleSamples = settle.samples;
    boundaryEnv.observations.scenario3Settings = settingsRaw;
    const settings = interpret(settingsRaw);
    recorder.setEnvironment({ boundary: boundaryEnv });

    assertField(recorder, '④设置页：宿主设置弹窗已打开（role=dialog + aria-modal 语义定位）', {
      expected: true,
      observed: settings.settings.fields.dialogOpen.value,
      source: settings.settings.fields.dialogOpen.source,
      detail: 'rect=' + json(settings.settings.fields.dialogRect.value),
    });
    assertField(recorder, '④设置页：按产品文本定位到插件分区导航（提示词模板 / Prompt Templates）', {
      expected: true,
      observed: settings.settings.fields.navMatch.value,
      source: settings.settings.fields.navMatch.source,
      detail: 'navRows=' + json(settings.settings.fields.navRows.value),
    });
    assertField(recorder, '④设置页：插件区块已挂载（隐藏预置 + 远程模板 + 触发方式控件）', {
      expected: true,
      observed: settings.settings.fields.sectionPresent.value,
      source: settings.settings.fields.sectionPresent.source,
    });
    assertField(recorder, '④设置页：屏蔽预置控件初始勾选状态与 fixture 声明一致', {
      expected: declared.hidePreset,
      observed: settings.settings.fields.hidePreset.value,
      source: settings.settings.fields.hidePreset.source,
    });

    // ── 控件 1：屏蔽预制模板（UI ↔ store.hidePreset）
    const hideAttempts = [];
    const hideResult = await clickControlWithVerify({
      key: 'HideToggle',
      selector: HIDE_TOGGLE_SELECTOR,
      hook: 'data-dsh-prompt-hide-toggle',
      rectOf: (raw) => raw.settings.section.hideToggle.rect,
      predicate: (raw) => raw.settings.section.hideToggle.checked === false,
      waitLabel: '物理点「屏蔽预制模板」后取消勾选',
      attemptLog: hideAttempts,
    });
    boundaryEnv.observations.scenario3HideToggleAttempts = hideAttempts;
    if (!hideResult.ok) {
      if (hideResult.blocked) return;
      const lastRaw = await observe.snapshot();
      boundaryEnv.observations.scenario3HidePresetFailure = {
        attempts: hideAttempts,
        scrollLog: await client.evaluate(scrollLogReadExpression(), { returnByValue: true }),
        log: summarizeEventLog(await input.log.read({ clear: false })),
        store: (await persistence.read()).baseline.hidePreset,
        last: { hideChecked: lastRaw.settings.section.hideToggle.checked, rect: lastRaw.settings.section.hideToggle.rect },
      };
      recorder.setEnvironment({ boundary: boundaryEnv });
      recorder.fail('④设置页：物理点勾选框后 UI 状态翻转（true→false）', {
        expected: false,
        observed: interpret(lastRaw).settings.fields.hidePreset.value,
        detail: '3 次物理点击（每次点击前 elementFromPoint 命中验证）后勾选状态仍未翻转；attempts=' + json(hideAttempts),
        ...evidenceFor(),
        observations: { attempts: hideAttempts, lastHideChecked: lastRaw.settings.section.hideToggle.checked },
      });
      return;
    }
    const beforeToggle = hideResult.before;
    const toggledRaw = hideResult.after;
    const hideBefore = interpret(beforeToggle).settings.fields.hidePreset.value;
    const toggled = interpret(toggledRaw);
    boundaryEnv.observations.scenario3HidePreset = toggledRaw;
    assertField(recorder, '④设置页：物理点勾选框后 UI 状态翻转（true→false）', {
      expected: false,
      observed: toggled.settings.fields.hidePreset.value,
      source: toggled.settings.fields.hidePreset.source,
      detail: 'before=' + json(hideBefore) + '；attempts=' + hideAttempts.length,
    });
    const storeAfterToggle = await persistence.waitFor((baseline) => baseline.hidePreset === false, {
      timeoutMs: 6_000,
      label: '设置页控件切换后 store.hidePreset 落盘为 false',
    });
    boundaryEnv.observations.scenario3StoreHidePreset = storeAfterToggle.baseline;
    assertDual(
      recorder,
      '双通道：屏蔽预制模板的界面勾选状态 ↔ 持久化 hidePreset 一致',
      compareDualChannels(
        { name: 'ui.hidePreset', value: toggled.settings.fields.hidePreset.value, source: 'user-visible' },
        { name: 'store.hidePreset', value: storeAfterToggle.baseline.hidePreset, source: 'persisted' },
      ),
    );

    // ── 控件 2：触发方式（UI aria-pressed ↔ store.hoverTrigger）
    // 初始态用落定后的设置页快照断言（点击前采集，独立于后面的点击重试）。
    const initialTrigger = interpret(settingsRaw).settings;
    assertField(recorder, '⑥触发按钮：设置页触发方式初始为悬浮触发（fixture hoverTrigger=true）', {
      expected: 'hover',
      observed: initialTrigger.fields.triggerMode.value,
      source: initialTrigger.fields.triggerMode.source,
      detail: 'aria-pressed=' + json(initialTrigger.fields.triggerAriaPressed.value),
    });
    const triggerAttempts = [];
    const triggerResult = await clickControlWithVerify({
      key: 'Trigger',
      selector: TRIGGER_SELECTOR,
      hook: 'data-dsh-prompt-trigger',
      rectOf: (raw) => raw.settings.section.triggerButton.rect,
      predicate: (raw) => raw.settings.section.triggerButton.ariaPressed === 'true',
      waitLabel: '物理点触发方式按钮后切到仅点击',
      attemptLog: triggerAttempts,
    });
    boundaryEnv.observations.scenario3TriggerAttempts = triggerAttempts;
    if (!triggerResult.ok) {
      if (triggerResult.blocked) return;
      const lastAttempt = triggerAttempts[triggerAttempts.length - 1] || {};
      const lastRect = lastAttempt.rect;
      // 诊断证据（不改变判定）：区分「产品没响应」与「点击没打到目标 / 被遮挡 / 坐标过期」。
      const diagnose = {
        attempts: triggerAttempts,
        hitLast: lastRect
          ? await client.evaluate(hitTestExpression({ x: lastRect.cx, y: lastRect.cy }), { returnByValue: true })
          : null,
        samples: [],
      };
      for (const delay of [0, 300, 900]) {
        if (delay > 0) await sleep(delay);
        const raw = await observe.snapshot();
        diagnose.samples.push({
          delay,
          triggerAriaPressed: raw.settings.section.triggerButton.ariaPressed,
          triggerRect: raw.settings.section.triggerButton.rect,
          triggerCount: raw.trigger.triggerCount,
          hideChecked: raw.settings.section.hideToggle.checked,
          dialogPresent: raw.settings.dialog.present,
          panelVisible: raw.panel.visible,
          composerFocused: raw.composer.focused,
          capture: raw.composer.inputActions.capture,
        });
      }
      if (lastRect) {
        diagnose.hitAfter = await client.evaluate(hitTestExpression({ x: lastRect.cx, y: lastRect.cy }), { returnByValue: true });
      }
      diagnose.log = summarizeEventLog(await input.log.read({ clear: false }));
      diagnose.scrollLog = await client.evaluate(scrollLogReadExpression(), { returnByValue: true });
      const storeNow = await persistence.read();
      diagnose.store = { hidePreset: storeNow.baseline.hidePreset, hoverTrigger: storeNow.baseline.hoverTrigger };
      // 诊断（不改变物理路径判定）：合成点击同一按钮，区分「产品不响应」与「物理点击没打到」。
      try {
        const synthetic = await input.syntheticClick(TRIGGER_SELECTOR);
        const afterSynthetic = await observe.snapshot();
        diagnose.synthetic = {
          method: synthetic.method,
          ariaPressed: afterSynthetic.settings.section.triggerButton.ariaPressed,
          triggerRect: afterSynthetic.settings.section.triggerButton.rect,
          store: (await persistence.read()).baseline.hoverTrigger,
        };
        if (afterSynthetic.settings.section.triggerButton.ariaPressed === 'true') {
          // 诊断动作把状态切走了：再点一次恢复，避免污染后续断言（失败时也无副作用）。
          await input.syntheticClick(TRIGGER_SELECTOR);
          diagnose.synthetic.restored = (await persistence.read()).baseline.hoverTrigger;
        }
      } catch (syntheticError) {
        diagnose.syntheticError = String(syntheticError && syntheticError.message ? syntheticError.message : syntheticError);
      }
      if (shotsDir) {
        try {
          const shotPath = path.join(shotsDir, 'scenario3-trigger-failure.png');
          await client.screenshot(shotPath);
          diagnose.screenshot = shotPath;
          boundaryEnv.screenshots.push(shotPath);
        } catch (shotError) {
          diagnose.screenshotError = String(shotError && shotError.message ? shotError.message : shotError);
        }
      }
      boundaryEnv.observations.scenario3TriggerFailure = diagnose;
      recorder.setEnvironment({ boundary: boundaryEnv });
      const lastRaw = await observe.snapshot();
      recorder.fail('⑥触发按钮：物理点后 aria-pressed=true（#179 契约：仅点击触发）', {
        expected: 'click',
        observed: interpret(lastRaw).settings.fields.triggerMode.value,
        detail: '3 次物理点击（每次点击前 elementFromPoint 命中验证）后仍未切换；attempts=' + json(triggerAttempts),
        ...evidenceFor(),
        observations: { attempts: triggerAttempts, lastAriaPressed: lastRaw.settings.section.triggerButton.ariaPressed },
      });
      return;
    }
    const beforeTrigger = triggerResult.before;
    const switchedRaw = triggerResult.after;
    const switched = interpret(switchedRaw);
    boundaryEnv.observations.scenario3BeforeTrigger = beforeTrigger;
    boundaryEnv.observations.scenario3TriggerMode = switchedRaw;
    boundaryEnv.observations.scenario3TriggerScroll = boundaryEnv.observations.scenario3TriggerAttempt1Scroll;
    recorder.setEnvironment({ boundary: boundaryEnv });
    assertField(recorder, '⑥触发按钮：物理点后 aria-pressed=true（#179 契约：仅点击触发）', {
      expected: 'click',
      observed: switched.settings.fields.triggerMode.value,
      source: switched.settings.fields.triggerMode.source,
      detail: 'text=' + json(switched.settings.fields.triggerButtonText.value) + '；attempts=' + triggerAttempts.length,
    });
    const storeAfterMode = await persistence.waitFor((baseline) => baseline.hoverTrigger === false, {
      timeoutMs: 6_000,
      label: '触发方式切换后 store.hoverTrigger 落盘为 false',
    });
    boundaryEnv.observations.scenario3StoreHoverTrigger = storeAfterMode.baseline;
    assertDual(
      recorder,
      '双通道：触发方式界面语义 ↔ 持久化 hoverTrigger 一致（语义映射 click ⇔ false）',
      compareDualChannels(
        { name: 'ui.triggerMode', value: switched.settings.fields.triggerMode.value, source: 'public-api' },
        { name: 'store.hoverTrigger', value: storeAfterMode.baseline.hoverTrigger, source: 'persisted' },
        {
          name: '触发方式：UI ↔ store',
          compare: (uiMode, hoverTrigger) => (uiMode === 'click') === (hoverTrigger === false),
        },
      ),
    );

    // ⑤ 弹层观测面：设置弹窗本身也属弹层，报告里明确记一条
    assertField(recorder, '⑤弹层：设置弹窗被弹层观测面识别（settingsDialogPresent）', {
      expected: true,
      observed: settings.overlays.fields.settingsDialogPresent.value,
      source: settings.overlays.fields.settingsDialogPresent.source,
      detail: 'modalCount=' + json(settings.overlays.fields.modalCount.value),
    });
    recorder.setEnvironment({ boundary: boundaryEnv });
  });

  recorder.setEnvironment({ boundary: { ...boundaryEnv, finishedAt: Date.now() } });
}
