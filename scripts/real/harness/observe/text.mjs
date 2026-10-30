/**
 * 语义文本定位（#188）：用「用户看得见的那句话」找元素，而不是内部类名 / DOM 结构。
 *
 * 为什么需要它：面板行、设置导航行、按钮文案都是产品的公开语义面；内部类名一重构就漂，
 * 而用户可见文本就是用户验收时说的那句话。场景里只写期望文本（exact / contains / regex /
 * any 多语言候选），由本模块归一后匹配；**归一发生在匹配时，不污染被测原文** ——
 * 草稿文本的字节级断言必须用它自己的原文，不能经过这里。
 *
 * 纯函数、零 IO；页面探针负责把行文本原样带回 Node，这里负责解释。
 */

/** 支持的匹配模式。 */
export const MATCH_MODES = Object.freeze(['exact', 'contains', 'regex', 'any']);

/** 归一化：字符串化、去零宽字符、折叠所有空白（含全角空格与换行）、去首尾。 */
export function normalizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/[\s\u00a0\u3000]+/g, ' ')
    .trim();
}

/** 把场景里的简写（字符串）升级成规范 spec；对象原样返回。 */
function canonicalSpec(spec) {
  if (typeof spec === 'string') return { mode: 'exact', value: spec };
  if (spec && typeof spec === 'object') return spec;
  throw new Error('文本期望必须是字符串或 {mode, value}：' + JSON.stringify(spec));
}

/** 一条文本是否命中期望 spec。非法正则/未知模式按「不匹配」或抛错处理，绝不静默当成功。 */
export function matchText(actual, spec) {
  const canonical = canonicalSpec(spec);
  const mode = canonical.mode;
  const haystack = normalizeText(actual);
  if (mode === 'exact') return haystack === normalizeText(canonical.value);
  if (mode === 'contains') return haystack.includes(normalizeText(canonical.value));
  if (mode === 'regex') {
    let re;
    try {
      re = new RegExp(String(canonical.value));
    } catch {
      return false;
    }
    return re.test(haystack);
  }
  if (mode === 'any') {
    if (!Array.isArray(canonical.values)) throw new Error('any 模式需要 values 数组：' + JSON.stringify(canonical));
    return canonical.values.some((item) => matchText(haystack, item));
  }
  throw new Error('未知文本匹配模式：' + JSON.stringify(mode) + '（可用：' + MATCH_MODES.join(', ') + '）');
}

/** 一行观测（原始）的行身份：优先契约钩子 id，退化到文本本身（只用于报告可读性）。 */
export function rowKey(row) {
  if (row && typeof row.id === 'string' && row.id) return row.id;
  return 'text:' + normalizeText(row && row.text);
}

/** 按语义文本定位行：返回 { index, row }，找不到返回 null。 */
export function findRow(rows, spec) {
  if (!Array.isArray(rows)) return null;
  for (let index = 0; index < rows.length; index += 1) {
    if (matchText(rows[index] && rows[index].text, spec)) return { index, row: rows[index] };
  }
  return null;
}

/** 按语义文本找出全部行（保留原始 / 视觉顺序）。 */
export function locateRows(rows, spec) {
  const hits = [];
  if (!Array.isArray(rows)) return hits;
  for (let index = 0; index < rows.length; index += 1) {
    if (matchText(rows[index] && rows[index].text, spec)) hits.push({ index, row: rows[index] });
  }
  return hits;
}

/** 把期望 spec 描述成报告里人能读的一句话。 */
export function describeTextSpec(spec) {
  const canonical = canonicalSpec(spec);
  const mode = canonical.mode;
  if (mode === 'exact') return 'exact「' + canonical.value + '」';
  if (mode === 'contains') return 'contains「' + canonical.value + '」';
  if (mode === 'regex') return 'regex「' + canonical.value + '」';
  if (mode === 'any') {
    const parts = (canonical.values || []).map((item) => describeTextSpec(item));
    return 'any[' + parts.join(' | ') + ']';
  }
  throw new Error('未知文本匹配模式：' + JSON.stringify(mode));
}
