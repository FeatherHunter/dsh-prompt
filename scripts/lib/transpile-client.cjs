'use strict';
/**
 * 客户端回归脚本的共享件（P1/P2）—— 两件事，各只留一份实现。
 *
 * 【为什么有这一件】
 * 原来每个回归脚本都自己抄一份「要转译哪些模块 + 要把哪些 require 改写掉」的表。
 * 真相只有一份（各 .ts 自己的 import 边），表是它的手抄快照，于是：
 *   · `panel.ts` 多一条 `./remote` 边 → 11 个套件同时崩在 `Cannot find module './remote'`；
 *   · `settings.ts` 多一条 `./remoteView` → 再崩一个；
 *   · 补一条边、下一行又缺另一个模块 —— 修一次红一次（打地鼠）；
 *   · 代价已经外溢到产品设计：`src/client/panel.ts:42` 明写「不新开模块，因为每个回归脚本
 *     都自己列一遍要转译的模块」。
 *
 * 现在反过来：**脚本只声明根，闭包与 require 改写由这里推导**。
 *   · 从给定的根出发，顺着**源码里真实的相对 import** 递归解析（用源码路径解析，不是用产物名），
 *     缺哪个模块就自己补进来 —— 于是「表没跟上」这一类崩溃在构造上不可能发生；
 *   · 产物一律扁平落在 outDir（沿用各脚本既有的 `require(path.join(DIR,'x.cjs'))` 站点，零改动）；
 *   · 两个源文件若映射到同一个产物名（扁平布局的固有风险），**立刻抛错并点名两者**，不静默覆盖；
 *   · 解析不到的相对 require **带文件名与缺失目标抛错**，而不是让人对着 MODULE_NOT_FOUND 猜。
 */
const fs = require('node:fs');
const path = require('node:path');

/** typescript 在本仓是 devDependency；兜底路径是 DSH Desktop 内置那份（沿用既有脚本的先例）。 */
function loadTypescript() {
  try {
    return require('typescript');
  } catch {
    return require('D:/0Tools/DSHDesktop/DSH Desktop/resources/app/node_modules/typescript');
  }
}

/** `import x from './y'` 里的相对说明符（转译后就是 `require("./y")`）。 */
const REL_RE = /require\("(\.[^"]*)"\)/g;

/** 产物名：去掉 .ts/.js 后缀，挂上脚本自定的后缀（如 test-77 的 `77`，避免共用临时目录时互压）。 */
const outNameOf = (abs, suffix) => path.basename(abs).replace(/\.(ts|js)$/, '') + (suffix || '') + '.cjs';

/** 把一个相对说明符按**源码路径**解析成真实文件；解析不到回 null。 */
function resolveSource(fromAbs, spec) {
  const base = path.resolve(path.dirname(fromAbs), spec);
  for (const cand of [base, base + '.ts', base + '.js', path.join(base, 'index.ts'), path.join(base, 'index.js')]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  }
  return null;
}

/**
 * 从 roots 出发，把闭包内所有模块转译成扁平的 CJS 放进 outDir。
 *
 * @param {string}   outDir 临时目录（会被清空重建）
 * @param {string[]} roots  入口源文件绝对路径（其余靠 import 边推导）
 * @param {{suffix?:string}} [opts] suffix：产物名后缀（共用临时目录的脚本用它避让，如 test-77 的 '77'）
 * @returns {{modules:number}} 实际转译的模块数
 */
function buildFlat(outDir, roots, opts) {
  const ts = loadTypescript();
  const suffix = (opts && opts.suffix) || '';
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const byOut = new Map(); // 产物名 -> 源文件（扁平布局的撞名检测）
  const done = new Set(); // 已转译的源文件
  const queue = roots.filter(Boolean).map((p) => path.resolve(p));

  while (queue.length) {
    const abs = queue.shift();
    if (done.has(abs)) continue;
    if (!fs.existsSync(abs)) throw new Error('buildFlat：根文件不存在 ' + abs);
    done.add(abs);

    const out = outNameOf(abs, suffix);
    const prev = byOut.get(out);
    if (prev && prev !== abs) {
      throw new Error(
        'buildFlat：扁平布局撞名 —— 两个源文件都要写成 ' + out + '：\n  ' + prev + '\n  ' + abs +
        '\n修法：本脚本的临时目录改成保留目录结构（path.join(DIR, \'src/...\')），或把其中一个改走别的产物名。'
      );
    }
    byOut.set(out, abs);

    let js = ts.transpileModule(fs.readFileSync(abs, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
        isolatedModules: true,
      },
    }).outputText;

    // 相对 require 一律塌成同目录的 <basename>.cjs：跨目录的边（'../update/bridge'）
    // 因此自动落到同一批产物里，脚本里那两条硬编码映射也随之消失。
    js = js.replace(REL_RE, (m, spec) => {
      if (/\.json$/.test(spec)) return m; // JSON 资源不进产物树，原样留着（只有 log/index 这类用手写特例的脚本会碰）
      const target = resolveSource(abs, spec);
      if (!target) {
        throw new Error(
          'buildFlat：' + path.relative(process.cwd(), abs) + ' 里的 require("' + spec + '") 解析不到源文件。\n' +
          '修法：确认这个模块还在；若它本就不该被转译，把它从本脚本的根列表里去掉。'
        );
      }
      queue.push(target);
      return 'require("./' + outNameOf(target, suffix) + '")';
    });

    fs.writeFileSync(path.join(outDir, out), js);
  }

  return { modules: done.size };
}

/**
 * 行尾无关地剥掉块注释与行注释。
 *
 * 旧写法 `src.split('\n').map(l => l.replace(/\/\/.*$/, ''))` 在 CRLF 上是**静默失效**的：
 * 每行尾部留着 `\r`，而 JS 的 `.` 匹配不了 `\r`，`$` 于是永远不成立 —— 行注释一句都没被剥掉。
 * 本仓 `* text=auto` + 默认 `core.eol=native`，Windows 检出恒为 CRLF，所以这不是偶发。
 */
function stripComments(src) {
  return String(src)
    .replace(/\r\n?/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');
}

module.exports = { buildFlat, stripComments, loadTypescript };
