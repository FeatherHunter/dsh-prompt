'use strict';
/**
 * 把 Node 进程里的界面语言钉成 zh-CN —— 只给回归脚本用，产品代码不走这里。
 *
 * 【为什么需要】Node ≥21 自带 `navigator`，它的 `language` 取自 ICU 默认区域：开发机（zh-CN）
 * 与 CI runner（en-US）会让同一份提交渲染出两套文案。而 `src/client/locale.ts` 的
 * `resolveLocale()` 在缺 html[lang] 时就读 `navigator.languages/language`，于是「按中文文案
 * 找节点」「断言中文界面」的回归脚本红绿取决于跑在谁的机器上 —— 2026-10-31 CI 首次运行
 * `check:modal` 就是这么误红的（'＋ 新增' 在 CI 上渲染成 '+ Add'）。
 *
 * 产品行为不动：浏览器里 navigator 就是用户语言，这是它该有的样子；需要确定性的只有回归脚本。
 * 用法：在任何 `require('react-test-renderer')` / 构建产物**之前**调用一次。
 */
function pinLocaleZh() {
  try {
    Object.defineProperty(globalThis, 'navigator', {
      value: { languages: ['zh-CN'], language: 'zh-CN' },
      configurable: true,
      writable: true,
    });
    return true;
  } catch (e) {
    // 钉不住不致命：脚本自己还会做兜底（例如按契约钩子而不是字形找节点）。
    return false;
  }
}

module.exports = { pinLocaleZh };
