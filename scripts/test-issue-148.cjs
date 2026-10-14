/**
 * #148 回归：关闭远程档位不再打回整机字号（宿主内容字桥改为声明式覆盖）。
 *
 * 现象（reporter 复现）：`syncHostFont` 在「远程档位关」（默认态）时对
 * `documentElement.style` / `body.style` 双删 `--dsh-content-font-size`——那是宿主发布、并在每次
 * `theme/change` 重放的会话字号权威通道；删掉即全站静默回落 14px，宿主不重发、不自愈。
 *
 * 契约（本文件钉的就是它）：
 *   R1 零宿主行内写入：任何开关/档位下都不 setProperty/removeProperty 宿主行内样式；
 *   R2 关 = 摘自家覆盖段：宿主行内值原样可见（不是删它、也不是回放旧快照）；
 *   R3 开 = 自家 <style data-plugin> 覆盖 body{--dsh-content-font-size:<px> !important;}；
 *   R4 重放免疫：宿主随后重写自己的值，自家不补写、不摘段、不记账（无状态可失配）；
 *   R5 归属协议沿用 #146（data-plugin + 私有标记），且三条桥共用同一注入点；
 *   R6 无 DOM fail-soft、无新日志事件；
 *   R7 三条桥同存时互不误伤（关一条不动另两条）；
 *   R8 同标记副本去重（陈旧副本同权重时后者胜，必须先清）、清场 clearHostBridges 零残留；
 *   R9 开→关→外部摘段→再开：重建且只有一枚、值取当前档位（无闩、现查现建）。
 *
 * 注意：cascade 优先级（作者样式表 !important 声明 > 行内**普通**声明）无法在假 DOM 上计算，
 * 已在真实 Chromium 上另做 8 项实测（2026-10-14）：17px 行内 + 42px !important → 算得 42px 且
 * 行内 17px 原样保留；宿主随后重写 16px 仍被压住；摘段当即回到宿主值。
 * 探针是可复跑的仓内文件 research/probe-hostfont-cascade.html（headless Chrome `--dump-dom` 出结论），
 * 数值同时记在 research/host-font-scale-bridge.md §5 与 issue #148 的实施评论里。
 * 本文件钉「声明形状 + 零宿主写入 + 桥间不误伤」，探针钉「cascade 真的这么算」，两者合起来才是机制成立的全部前提。
 *
 * 体例沿用 scripts/test-issue-83/103.cjs（ts 转译 + 假 document + 源码级断言）。
 */
const fs = require('node:fs');
const path = require('node:path');
let ts;
try { ts = require('typescript') } catch (e) { ts = require('D:/0Tools/DSH Desktop/resources/app/node_modules/typescript') }

const ROOT = path.join(__dirname, '..');
const DIR = path.join(__dirname, '.rt-tmp-148');
fs.mkdirSync(DIR, { recursive: true });

let failures = 0;
function fail(msg) { console.error('  FAIL ' + msg); failures++; }
function ok(cond, msg) { if (cond) console.log('  PASS ' + msg); else fail(msg); }
function cleanup() {
  try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (e) { /* ignore */ }
}

const FAUCET = '--dsh-content-font-size';
const MARK = 'dsh-prompt-remote-hostfont';
const CSS = (px) => 'body{' + FAUCET + ':' + px + ' !important;}';

// ── 转译 hostfont + 两条依赖边（手抄 harness，同 83/103 体例） ──
try {
  const transpile = (srcPath) => ts.transpileModule(fs.readFileSync(srcPath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true },
  }).outputText;
  const SRC = (f) => path.join(ROOT, 'src', 'client', f);
  fs.writeFileSync(path.join(DIR, 'remoteView.cjs'), transpile(SRC('remoteView.ts')));
  fs.writeFileSync(path.join(DIR, 'styleOwnership.cjs'), transpile(SRC('styleOwnership.ts')));
  let hostJs = transpile(SRC('hostfont.ts'));
  hostJs = hostJs.split('require("./remoteView")').join('require("./remoteView.cjs")');
  hostJs = hostJs.split('require("./styleOwnership")').join('require("./styleOwnership.cjs")');
  fs.writeFileSync(path.join(DIR, 'hostfont.cjs'), hostJs);
} catch (e) { fail('转译失败：' + ((e && e.message) || e)); cleanup(); process.exit(1); }
const hostfont = require(path.join(DIR, 'hostfont.cjs'));

const hostSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'hostfont.ts'), 'utf8');
// 注释里出现 setProperty/removeProperty 是记录宿主行为（合法），契约按**去注释后的代码**判
const hostCode = hostSrc.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '')).join('\n');

// ── R1 源码契约 ──
console.log('=== R1: 零宿主行内写入（源码契约） ===');
const deComment = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '')).join('\n');
const ownerSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'styleOwnership.ts'), 'utf8');
const ownerCode = deComment(ownerSrc);
const indexSrc = fs.readFileSync(path.join(ROOT, 'src', 'client', 'index.ts'), 'utf8');
ok(!/\bsetProperty\b|\bremoveProperty\b/.test(hostCode), 'hostfont.ts 代码零 setProperty/removeProperty');
ok(!/\bsetProperty\b|\bremoveProperty\b/.test(ownerCode), 'styleOwnership.ts（注入缝所在）代码零 setProperty/removeProperty');
ok(!/\.cssText|setAttribute\(\s*['"]style['"]/.test(hostCode + ownerCode), '注入缝不写宿主行内 CSS 文本（cssText / setAttribute("style") 也逃不掉）');
ok(!/documentElement/.test(hostCode + ownerCode), 'hostfont/styleOwnership 代码不碰 documentElement（:root 规则够不着 body 行内，旧对称点是死码）');
ok(new RegExp("HOST_CONTENT_FONT_VAR\\s*=\\s*'--dsh-content-font-size'").test(hostCode), '覆盖目标 = 宿主变量名单常量');
ok(/'body\{'/.test(hostCode), '覆盖落点 = body{（:root 够不着 body 行内）');
ok(/!important/.test(hostCode), '覆盖声明带 !important（普通声明赢不了宿主行内）');
ok(hostCode.includes(MARK), '自家 style 私有标记存在');
ok(!/__dshPromptLog|logEvent/.test(hostCode), '无新日志事件');
const createIn = (src) => (src.match(/createElement\(['"]style['"]\)/g) || []).length;
ok(createIn(hostCode) === 0 && createIn(ownerCode) === 1, '三条桥不自建 <style>，注入缝唯一（hostfont=' + createIn(hostCode)
  + '，styleOwnership=' + createIn(ownerCode) + '）');
ok(/syncHostFont/.test(indexSrc) && /subscribeRemote/.test(indexSrc), 'index.ts 保持 sync + subscribeRemote 接线');
ok(/clearHostBridges/.test(indexSrc), 'index.ts 卸载清场调 clearHostBridges（覆盖段不能只靠宿主账本摘）');

// ── R2 无 DOM fail-soft ──
console.log('=== R2: 无 DOM fail-soft ===');
if (typeof document !== 'undefined') fail('回归环境应无 DOM');
else {
  let threw = null;
  try {
    hostfont.syncHostFont(true, 10);
    hostfont.syncHostFont(false, 10);
    hostfont.syncHostFont(undefined, undefined);
    hostfont.syncHostFont('true', null);
    hostfont.syncRemoteRows(true, 5);
    hostfont.syncAssistantZoom(true, 5);
    hostfont.clearHostBridges();
  } catch (e) { threw = e; }
  ok(!threw, '无 DOM 时不抛（含关态/清场）' + (threw ? '：' + threw.message : ''));
}

// ── 假宿主环境：body 行内真相 + 写入记账 + 自家 <style> 账本 ──
function makeEnv(initialPx) {
  const hostWrites = [];
  const hostInline = { [FAUCET]: initialPx };
  const headKids = [];
  const head = {
    appendChild(el) { headKids.push(el); el.parentNode = head; return el; },
    removeChild(el) { const i = headKids.indexOf(el); if (i >= 0) headKids.splice(i, 1); return el; },
  };
  const mkTag = () => ({
    attrs: {},
    textContent: '',
    parentNode: null,
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
    remove() { if (this.parentNode && this.parentNode.removeChild) this.parentNode.removeChild(this); },
  });
  const mkHostStyle = (tag) => {
    const target = {
      setProperty(k, v) { hostWrites.push(tag + '|set|' + k + '|' + v); hostInline[k] = v; },
      removeProperty(k) { hostWrites.push(tag + '|del|' + k); delete hostInline[k]; },
      getPropertyValue(k) { return Object.prototype.hasOwnProperty.call(hostInline, k) ? hostInline[k] : ''; },
    };
    // 宿主行内样式的**任何**写入都记账：cssText= / 直接赋属性 / delete / defineProperty 也逃不掉
    return new Proxy(target, {
      set(t, prop, value) {
        if (typeof prop === 'string' && !Object.prototype.hasOwnProperty.call(t, prop)) hostWrites.push(tag + '|prop|' + prop);
        return Reflect.set(t, prop, value);
      },
      deleteProperty(t, prop) { hostWrites.push(tag + '|delprop|' + String(prop)); return Reflect.deleteProperty(t, prop); },
      defineProperty(t, prop, desc) { hostWrites.push(tag + '|define|' + String(prop)); return Reflect.defineProperty(t, prop, desc); },
    });
  };
  const doc = {
    documentElement: { style: mkHostStyle('root') },
    body: { style: mkHostStyle('body') },
    head,
    querySelector(sel) {
      const m = /^style\[data-dsh-prompt-style="(.+)"\]$/.exec(sel);
      if (!m) return null;
      return headKids.find((el) => el.attrs['data-dsh-prompt-style'] === m[1]) || null;
    },
    querySelectorAll(sel) {
      const m = /^style\[data-dsh-prompt-style="(.+)"\]$/.exec(sel);
      if (!m) return [];
      return headKids.filter((el) => el.attrs['data-dsh-prompt-style'] === m[1]);
    },
    createElement(tag) { return tag === 'style' ? mkTag() : null; },
  };
  return {
    doc, hostWrites, headKids,
    // 宿主自己的读回者（app.asar bootstrapFontSize 读 body.style.getPropertyValue）
    hostReads: () => doc.body.style.getPropertyValue(FAUCET),
    mine: () => headKids.filter((el) => el.attrs['data-dsh-prompt-style'] === MARK),
  };
}
function withEnv(env, fn) {
  const saved = globalThis.document;
  globalThis.document = env.doc;
  try { fn(); } finally {
    if (saved === undefined) { try { delete globalThis.document; } catch (e) { globalThis.document = saved; } }
    else globalThis.document = saved;
  }
}
const noWrites = (env, where) => ok(env.hostWrites.length === 0, where + ' 零宿主行内写入' + (env.hostWrites.length ? '，实际 ' + env.hostWrites.join(';') : ''));

// ── R3 关闭态（默认态）：#148 缺陷本体 ──
console.log('=== R3: 关闭态 = 零写入 + 宿主值原样（缺陷本体） ===');
{
  const env = makeEnv('17px');
  withEnv(env, () => {
    hostfont.syncHostFont(false, 10);   // 档位默认关：旧稿在此 removeProperty 掉宿主的值
    ok(env.headKids.length === 0, '关远程不注入覆盖段，实际 ' + env.headKids.length);
    noWrites(env, '关远程');
    ok(env.hostReads() === '17px', '宿主行内值原样 17px（宿主读回者仍看到自己的真相），实际 ' + env.hostReads());
    hostfont.syncHostFont(false, 5);    // 重复关：幂等
    hostfont.syncHostFont(undefined, undefined);
    noWrites(env, '重复关/缺参');
    ok(env.hostReads() === '17px', '重复关后宿主值仍原样');
  });
}

// ── R4 开态：覆盖段形状 + 归属 + 幂等 + 换档 ──
console.log('=== R4: 开态 = 自家覆盖段（!important/归属/幂等/换档） ===');
{
  const env = makeEnv('17px');
  withEnv(env, () => {
    hostfont.syncHostFont(true, 2);
    ok(env.headKids.length === 1, '开应注入 1 枚 style，实际 ' + env.headKids.length);
    const tag = env.headKids[0];
    ok(tag.textContent === CSS('21px'), '2 档应覆盖 21px !important（= round(1.5*14)），实际 ' + tag.textContent);
    ok(tag.attrs['data-plugin'] === 'dsh-prompt', '归属 = dsh-prompt（#146 账本不误认领）');
    ok(tag.attrs['data-dsh-prompt-style'] === MARK, '私有标记 = ' + MARK);
    noWrites(env, '开远程');
    ok(env.hostReads() === '17px', '宿主行内仍是 17px（插件不再篡改宿主状态）');
    hostfont.syncHostFont(true, 2);     // 重复开：不叠加
    ok(env.headKids.length === 1, '重复开不叠加，实际 ' + env.headKids.length);
    hostfont.syncHostFont(true, 10);    // 换档：原位更新
    ok(env.headKids.length === 1 && env.headKids[0] === tag, '换档复用同一枚 style');
    ok(tag.textContent === CSS('77px'), '10 档应 77px，实际 ' + tag.textContent);
    // 非法档位（非数值/非有限）：摘段而不是落 14px——宿主内容字可能是用户设的 18~22px，
    // 覆盖成 14px 等于以覆盖方式把宿主的有效字号改小（与另两条桥的非法档语义也对齐）。
    hostfont.syncHostFont(true, 'x');
    ok(env.headKids.length === 0, '非法档位应摘段（不落 14px），实际 ' + env.headKids.length);
    hostfont.syncHostFont(true, NaN);
    ok(env.headKids.length === 0, 'NaN 档位应摘段，实际 ' + env.headKids.length);
    hostfont.syncHostFont(true, Infinity);
    ok(env.headKids.length === 0, 'Infinity 档位应摘段，实际 ' + env.headKids.length);
    hostfont.syncHostFont(true, 5);
    ok(env.headKids.length === 1 && env.headKids[0].textContent === CSS('42px'), '回正常档应重新注入 42px，实际 '
      + (env.headKids.length ? env.headKids[0].textContent : '<无>'));
    noWrites(env, '开态全程');
  });
}

// ── R5 重放免疫 + 关=撤覆盖（不是回放快照） ──
console.log('=== R5: 宿主重放免疫 + 关 = 撤自家覆盖 ===');
{
  const env = makeEnv('17px');
  withEnv(env, () => {
    hostfont.syncHostFont(true, 5);
    ok(env.mine().length === 1 && env.mine()[0].textContent === CSS('42px'), '开 5 档覆盖 42px');
    // 宿主 ThemePresenter.apply 重放（模拟切主题/调官方步进器）
    env.doc.body.style.setProperty(FAUCET, '16px');
    ok(env.mine().length === 1 && env.mine()[0].textContent === CSS('42px'), '宿主重放后自家覆盖段不变（无状态可失配，不补写）');
    ok(env.hostReads() === '16px', '宿主重放后宿主读回者看到 16px（宿主真相未被插件掩盖）');
    ok(env.hostWrites.join(';') === 'body|set|' + FAUCET + '|16px', '全程只有宿主自己那一次写入，实际 ' + env.hostWrites.join(';'));
    // 关：摘自家段 → 宿主**当前**值（16px）当即生效；不回放开发前的旧快照（17px）
    hostfont.syncHostFont(false, 5);
    ok(env.headKids.length === 0, '关后无自家段残留，实际 ' + env.headKids.length);
    ok(env.hostReads() === '16px', '关后宿主当前值原样可见（不是回放旧快照），实际 ' + env.hostReads());
    ok(env.hostWrites.join(';') === 'body|set|' + FAUCET + '|16px', '关也不产生任何宿主写入，实际 ' + env.hostWrites.join(';'));
  });
}

// ── R6 全链路：偏好变更 → 覆盖段（index.ts 接线形状） ──
console.log('=== R6: 全链路（remote.ts 驱动） ===');
{
  let remote = null;
  try {
    const remoteJs = ts.transpileModule(fs.readFileSync(path.join(ROOT, 'src', 'client', 'remote.ts'), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, isolatedModules: true },
    }).outputText;
    fs.writeFileSync(path.join(DIR, 'remote.cjs'), remoteJs);
    remote = require(path.join(DIR, 'remote.cjs'));
  } catch (e) { fail('remote.ts 转译失败：' + ((e && e.message) || e)); }
  if (remote) {
    const env = makeEnv('17px');
    const savedFetch = globalThis.fetch;
    withEnv(env, () => {
      try { globalThis.fetch = undefined; } catch (e) { /* ignore */ }
      remote.__resetRemoteForTests();
      const sync = () => {
        const p = remote.getRemotePrefs();
        hostfont.syncHostFont(p.enabled, p.size);
      };
      sync();
      remote.subscribeRemote(sync);
      const sole = () => (env.headKids.length === 1 ? env.headKids[0].textContent : '<' + env.headKids.length + ' 段>');
      env.headKids.length = 0;
      remote.setRemoteEnabled(true);
      ok(sole() === CSS('42px'), '开总闸应覆盖默认 5 档 42px，实际 ' + sole());
      remote.setRemoteSize(10);
      ok(sole() === CSS('77px'), '拖到 10 档应覆盖 77px，实际 ' + sole());
      remote.setRemoteSize(5);
      ok(sole() === CSS('42px'), '拖回 5 档应覆盖 42px，实际 ' + sole());
      remote.setRemoteEnabled(false);
      ok(env.headKids.length === 0, '关总闸应摘掉覆盖段，实际残留 ' + env.headKids.length);
      noWrites(env, '全链路');
      ok(env.hostReads() === '17px', '全链路后宿主值原样 17px（#148 已修）');
      remote.__resetRemoteForTests();
      try {
        if (savedFetch === undefined) { try { delete globalThis.fetch; } catch (e) { globalThis.fetch = savedFetch; } }
        else globalThis.fetch = savedFetch;
      } catch (e) { /* ignore */ }
    });
  }
}

// ── R7 桥间不误伤（三桥同存，关一条不得动另两条） ──
console.log('=== R7: 三条桥互不误伤 ===');
{
  const env = makeEnv('17px');
  const ROWS_CSS = '[data-row-key^="session:"],[data-row-key^="workspace:"]{zoom:3;}';
  const ASST_CSS = '[data-chat-group-part="response"]{zoom:3;}';
  withEnv(env, () => {
    const css = (mark) => {
      const el = env.headKids.find((t) => t.attrs['data-dsh-prompt-style'] === mark);
      return el ? el.textContent : '<无>';
    };
    hostfont.syncHostFont(true, 5);
    hostfont.syncRemoteRows(true, 5);
    hostfont.syncAssistantZoom(true, 5);
    ok(env.headKids.length === 3, '三桥各一枚共 3 枚，实际 ' + env.headKids.length);
    hostfont.syncRemoteRows(false, 5);
    ok(css(MARK) === CSS('42px'), '关行桥后宿主字段原样在，实际 ' + css(MARK));
    hostfont.syncAssistantZoom(false, 5);
    ok(css(MARK) === CSS('42px') && env.headKids.length === 1, '关 AI 桥后只剩宿主字段，实际剩 ' + env.headKids.length);
    hostfont.syncRemoteRows(true, 5);            // 反向：关宿主字桥不得动另两条
    hostfont.syncAssistantZoom(true, 5);
    hostfont.syncHostFont(false, 5);
    ok(css(MARK) === '<无>' && css('dsh-prompt-remote-rows') === ROWS_CSS && css('dsh-prompt-remote-assistant') === ASST_CSS,
      '关宿主字桥只摘自己那枚（rows=' + css('dsh-prompt-remote-rows') + '）');
    noWrites(env, '三桥全程');
  });
}

// ── R8 同标记副本去重 + clearHostBridges 清场（#148 审查：陈旧副本同权重时文档更后者胜） ──
console.log('=== R8: 副本去重 + 清场 ===');
{
  const env = makeEnv('17px');
  const seedStale = (px) => {
    const el = {
      attrs: {}, textContent: CSS(px), parentNode: null,
      setAttribute(k, v) { this.attrs[k] = v; },
      getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
      remove() { if (this.parentNode && this.parentNode.removeChild) this.parentNode.removeChild(this); },
    };
    el.setAttribute('data-dsh-prompt-style', MARK);
    env.doc.head.appendChild(el);
    return el;
  };
  withEnv(env, () => {
    seedStale('21px');
    seedStale('77px');   // 陈旧副本在文档更后 ⇒ 不清掉的话它会压过新值
    hostfont.syncHostFont(true, 5);
    const mine = env.headKids.filter((t) => t.attrs['data-dsh-prompt-style'] === MARK);
    ok(mine.length === 1 && mine[0].textContent === CSS('42px'),
      '预置陈旧副本后应只剩 1 枚且为新值，实际 ' + mine.length + ' 枚 / ' + (mine[0] && mine[0].textContent));
    ok(mine[0] && mine[0].attrs['data-plugin'] === 'dsh-prompt', '被收养的首枚补上了归属（#146 收养边）');
    hostfont.syncRemoteRows(true, 5);
    hostfont.syncAssistantZoom(true, 5);
    ok(env.headKids.length === 3, '清场前三桥各一枚，实际 ' + env.headKids.length);
    hostfont.clearHostBridges();
    ok(env.headKids.length === 0, 'clearHostBridges 后零残留，实际 ' + env.headKids.length);
    noWrites(env, '清场');
  });
}

// ── R9 开→关→外部摘段→再开（无闩、现查现建、值取当前档位） ──
console.log('=== R9: 外部摘段后自愈 ===');
{
  const env = makeEnv('17px');
  withEnv(env, () => {
    hostfont.syncHostFont(true, 2);
    ok(env.headKids.length === 1 && env.headKids[0].textContent === CSS('21px'), '2 档应 21px');
    hostfont.syncHostFont(false, 2);
    ok(env.headKids.length === 0, '关后零残留');
    hostfont.syncHostFont(true, 10);
    const t1 = env.headKids[0];
    ok(env.headKids.length === 1 && t1.textContent === CSS('77px'), '再开 10 档应重建 77px');
    env.doc.head.removeChild(t1);      // 外部（宿主账本 / 消费者）摘掉自家段
    hostfont.syncHostFont(true, 5);
    ok(env.headKids.length === 1 && env.headKids[0].textContent === CSS('42px'),
      '外部摘段后下次 sync 自愈重建，实际 ' + env.headKids.length);
    ok(env.hostReads() === '17px', '全程宿主值原样 17px');
    noWrites(env, '重建全程');
  });
}

cleanup();
if (failures) { console.error('FAILURES: ' + failures); process.exit(1); }
console.log('ALL GREEN: #148');
process.exit(0);
