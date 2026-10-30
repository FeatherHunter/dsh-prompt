/**
 * 真实输入序列构造（#188，纯函数）：把「用户做了什么」描述成可执行、可断言、可复核的动作序列。
 *
 * 为什么不直接点元素：`element.click()` 只覆盖合成路径；hover、按键、选区、焦点这些
 * 真实交互只有物理指针/键盘事件（trusted）才能验证。本模块把动作计划构造与 CDP 传输分开：
 * 这里只产出纯数据（open/closed 计划），自证脚本可在 Node 里逐条核对，input.mjs 负责发送。
 *
 * 坐标/键码约定与 Chrome DevTools Protocol 对齐（Input.dispatchMouseEvent / dispatchKeyEvent），
 * 修饰键位掩码 alt=1 ctrl=2 meta=4 shift=8。
 */

/** CDP 修饰键位掩码。 */
export const MODIFIER_BITS = Object.freeze({ alt: 1, ctrl: 2, meta: 4, shift: 8 });

const MODIFIER_ALIASES = new Map([
  ['alt', 'alt'],
  ['option', 'alt'],
  ['opt', 'alt'],
  ['ctrl', 'ctrl'],
  ['control', 'ctrl'],
  ['meta', 'meta'],
  ['cmd', 'meta'],
  ['command', 'meta'],
  ['super', 'meta'],
  ['win', 'meta'],
  ['shift', 'shift'],
]);

/** 修饰键列表/简写 → 位掩码；未知修饰键抛错（拼错的快捷键不能悄悄变成无修饰）。 */
export function modifierMask(modifiers) {
  if (modifiers === null || modifiers === undefined) return 0;
  const list = Array.isArray(modifiers) ? modifiers : String(modifiers).split(/[+,\s]+/).filter(Boolean);
  let mask = 0;
  for (const raw of list) {
    const key = MODIFIER_ALIASES.get(String(raw).trim().toLowerCase());
    if (!key) throw new Error('未知修饰键：' + JSON.stringify(raw) + '（可用：alt/ctrl/meta/shift）');
    mask |= MODIFIER_BITS[key];
  }
  return mask;
}

/** 常用按键表（input.mjs 发送与自证共用一份）。 */
export const KEY_TABLE = (() => {
  const table = {
    Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 },
    Escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
    Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 },
    Space: { key: ' ', code: 'Space', windowsVirtualKeyCode: 32 },
    Backspace: { key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 },
    Delete: { key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 },
    ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 },
    ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', windowsVirtualKeyCode: 38 },
    ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 },
    ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 },
    Home: { key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 },
    End: { key: 'End', code: 'End', windowsVirtualKeyCode: 35 },
    PageUp: { key: 'PageUp', code: 'PageUp', windowsVirtualKeyCode: 33 },
    PageDown: { key: 'PageDown', code: 'PageDown', windowsVirtualKeyCode: 34 },
  };
  for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
    table[letter] = {
      key: letter,
      code: 'Key' + letter.toUpperCase(),
      windowsVirtualKeyCode: letter.toUpperCase().charCodeAt(0),
    };
  }
  for (const digit of '0123456789') {
    table[digit] = { key: digit, code: 'Digit' + digit, windowsVirtualKeyCode: digit.charCodeAt(0) };
  }
  return Object.freeze(table);
})();

/** 按键名 → CDP 键规格；字母大小写不敏感，未知按键抛错。 */
function resolveKey(name) {
  const raw = String(name === null || name === undefined ? '' : name).trim();
  if (!raw) throw new Error('按键不能为空');
  if (KEY_TABLE[raw]) return KEY_TABLE[raw];
  const lower = raw.toLowerCase();
  if (KEY_TABLE[lower]) return KEY_TABLE[lower];
  if (raw.length === 1) {
    const code = /[a-z]/i.test(raw) ? 'Key' + raw.toUpperCase() : '';
    return { key: raw, code, windowsVirtualKeyCode: raw.toUpperCase().charCodeAt(0) };
  }
  throw new Error('未知按键：' + JSON.stringify(raw));
}

/** 多段指针移动：返回从 from 到 to 的插值点序列。 */
export function planPointerPath(from, to, options = {}) {
  const start = { x: Number(from && from.x), y: Number(from && from.y) };
  const end = { x: Number(to && to.x), y: Number(to && to.y) };
  if (!Number.isFinite(start.x) || !Number.isFinite(start.y) || !Number.isFinite(end.x) || !Number.isFinite(end.y)) {
    throw new Error('指针路径需要有限坐标：from=' + JSON.stringify(from) + '，to=' + JSON.stringify(to));
  }
  const steps = options.steps === undefined ? 8 : Math.floor(Number(options.steps));
  if (!Number.isFinite(steps) || steps < 1) throw new Error('指针步数必须是 >=1 的整数：' + JSON.stringify(options.steps));
  const round = (value) => Math.round(value * 100) / 100;
  if (steps === 1) return [{ x: round(end.x), y: round(end.y) }];
  if (start.x === end.x && start.y === end.y) {
    return [{ x: round(start.x), y: round(start.y) }, { x: round(end.x), y: round(end.y) }];
  }
  const count = Math.max(2, steps);
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const ratio = index / (count - 1);
    points.push({ x: round(start.x + (end.x - start.x) * ratio), y: round(start.y + (end.y - start.y) * ratio) });
  }
  return points;
}

/** 一次物理点击计划：先移动（可多段），再按下、抬起。 */
export function planClick(point, options = {}) {
  const target = { x: Number(point && point.x), y: Number(point && point.y) };
  const from = options.from ? { x: Number(options.from.x), y: Number(options.from.y) } : target;
  const steps = options.steps === undefined ? 8 : options.steps;
  const button = options.button || 'left';
  const clickCount = options.clickCount === undefined ? 1 : options.clickCount;
  const modifiers = modifierMask(options.modifiers);
  const ops = planPointerPath(from, target, { steps }).map((position) => ({
    type: 'mouseMoved',
    x: position.x,
    y: position.y,
    buttons: 0,
    button: 'none',
    clickCount: 0,
    modifiers,
  }));
  ops.push({
    type: 'mousePressed',
    x: target.x,
    y: target.y,
    buttons: button === 'left' ? 1 : button === 'right' ? 2 : 4,
    button,
    clickCount,
    modifiers,
  });
  ops.push({
    type: 'mouseReleased',
    x: target.x,
    y: target.y,
    buttons: 0,
    button,
    clickCount,
    modifiers,
  });
  return ops;
}

/** 一个按键（可带修饰键）：keyDown + keyUp。 */
export function planKey(name, options = {}) {
  const spec = resolveKey(name);
  const modifiers = modifierMask(options.modifiers);
  const base = { ...spec, modifiers };
  return [
    { type: 'keyDown', ...base, text: options.text },
    { type: 'keyUp', ...base, text: undefined },
  ];
}

/** 快捷键简写（"Ctrl+A" / "Shift+ArrowLeft"）→ 按键序列。 */
export function planShortcut(spec, options = {}) {
  const raw = String(spec === null || spec === undefined ? '' : spec).trim();
  if (!raw) throw new Error('快捷键不能为空');
  const parts = raw.split('+').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) throw new Error('快捷键不能为空');
  const keyName = parts.pop();
  const modifiers = parts;
  return planKey(keyName, { ...options, modifiers });
}

/** 文本输入计划：一次 insertText（等价粘贴），不逐字符伪造 keydown。 */
export function planTextInput(text) {
  return [{ type: 'insertText', text: String(text === null || text === undefined ? '' : text) }];
}

function modifierNames(mask) {
  const names = [];
  for (const [name, bit] of [['Ctrl', MODIFIER_BITS.ctrl], ['Alt', MODIFIER_BITS.alt], ['Meta', MODIFIER_BITS.meta], ['Shift', MODIFIER_BITS.shift]]) {
    if (mask & bit) names.push(name);
  }
  return names;
}

/** 计划 → 报告里的人类可读摘要（不记录输入正文，避免报告泄露草稿内容）。 */
export function describePlan(plan) {
  const lines = [];
  for (const op of plan || []) {
    if (op.type === 'mouseMoved') lines.push('pointer.move(' + op.x + ',' + op.y + ')');
    else if (op.type === 'mousePressed') lines.push('pointer.press(' + op.button + ')');
    else if (op.type === 'mouseReleased') lines.push('pointer.release(' + op.button + ')');
    else if (op.type === 'keyDown' || op.type === 'keyUp') {
      const mods = modifierNames(op.modifiers || 0);
      const keyLabel = typeof op.key === 'string' && /^[a-z]$/.test(op.key) ? op.key.toUpperCase() : op.key;
      const combo = mods.length ? mods.join('+') + '+' + keyLabel : String(keyLabel);
      lines.push('key.' + (op.type === 'keyDown' ? 'down' : 'up') + '(' + combo + ')');
    } else if (op.type === 'insertText') {
      lines.push('text.insert(' + String(op.text || '').length + ' chars)');
    } else {
      lines.push(String(op.type));
    }
  }
  return lines;
}
