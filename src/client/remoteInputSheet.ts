/**
 * dsh-prompt — 遥控输入 Sheet（#123，v3 A贴底定稿落地）
 *
 * 复用挑选器 mask＋缩放根数学（ADR-0005）：仅对齐/上限/max-width 三参数不同，
 * 禁第三套 math。层级与齿轮/挑选器同层 MODAL_Z，高于 Dock DOCK_Z。
 * 语义：实时镜子（无写入按钮；2026-10-06 用户拍板删发送键与解释文案）、isComposing门、
 * 去抖300ms串行 setDraft、session校验、键盘感知 scrollIntoView＋dvh、
 * 单模态由调用方（button.ts）裁决，本组件只管关后焦点回 opener。
 */
import { getReact, keepComposerFocus, MODAL_Z } from './panel';
import { remoteSizeScale } from './remoteView';
import { tr, STR } from './i18n';
import { resolveLocale, subscribeLocale } from './locale';
import { getSmartInput, onSmartInput } from './smartstore';
import {
  MIRROR_DEBOUNCE_MS,
  SHEET_WIDTH,
  SHEET_MIN_WIDTH,
  SHEET_MAX_HEIGHT,
  shouldWriteMirror,
  shouldAdoptHostDraft,
} from './remoteInput';

export interface RemoteInputSheetProps {
  /** open 瞬间钉死的 sessionId（写前校验用；切换即停写） */
  capturedSessionId?: string;
  remoteSize: number;
  onClose: () => void;
}

export function RemoteInputSheet(props: RemoteInputSheetProps): any {
  const react = getReact();
  if (!react) return null;
  const h = react.createElement;
  const langState = react.useState(resolveLocale());
  const lang = langState[0];
  // 语言跟随：共享单例订阅器（#137；观察者与去重都在 locale.ts 一处）
  react.useEffect(() => subscribeLocale((l) => { langState[1](l) }), []);
  const uiScale = remoteSizeScale((props as any).remoteSize);

  // 根＋遮罩：与 picker.ts 同式，仅三参数不同（对齐底贴/上限62dvh/宽min三段）。
  const rootStyle: any = { position: 'fixed', inset: 0, zIndex: MODAL_Z, fontSize: 'calc(1em * ' + uiScale + ')' };
  const maskStyle: any = {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    padding: '0 0.75em 5em', boxSizing: 'border-box',
  };
  const sheetStyle: any = {
    position: 'relative', width: SHEET_WIDTH, minWidth: SHEET_MIN_WIDTH, maxHeight: SHEET_MAX_HEIGHT,
    margin: 0,
    background: 'var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))',
    backgroundColor: 'var(--dsw-alias-bg-layer-1, var(--dsw-specific-menu))',
    borderRadius: 14, border: '1px solid var(--dsw-alias-border-l1)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    fontSize: '1em',
    fontFamily: 'var(--dsw-font-family)', color: 'var(--dsw-alias-label-primary)',
  };
  const headStyle: any = { display: 'flex', alignItems: 'center', gap: 8, padding: '0.5em 0.75em 0.1em', flex: 'none' };
  const titleStyle: any = { fontSize: '0.95em', fontWeight: 700 };
  const subStyle: any = { fontSize: '0.72em', color: 'var(--dsw-alias-label-tertiary)' };
  const xStyle: any = {
    marginLeft: 'auto', flex: 'none', width: '2.4em', height: '2.4em', borderRadius: '50%', cursor: 'pointer',
    border: '1px solid var(--dsw-alias-border-l1)',
    background: 'var(--dsw-alias-bg-layer-3)', color: 'var(--dsw-alias-label-primary)',
    fontSize: '1em', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const taStyle: any = {
    margin: '0.5em 0.75em 0', minHeight: '6em', maxHeight: '14em', resize: 'vertical',
    background: 'var(--dsw-alias-bg-layer-3)', border: '1px solid var(--dsw-alias-border-l1)',
    borderRadius: 10, color: 'var(--dsw-alias-label-primary)',
    fontSize: '0.95em', padding: '0.6em 0.75em', fontFamily: 'inherit', lineHeight: 1.5,
    width: 'calc(100% - 1.5em)', boxSizing: 'border-box', outline: 'none', flex: 'none',
  };
  const metaStyle: any = { fontSize: '0.72em', color: 'var(--dsw-alias-label-tertiary)', padding: '0.5em 0.75em 0.75em', lineHeight: 1.6, flex: 'none' };

  const snap0 = getSmartInput();
  const initText = typeof snap0.draft === 'string' ? snap0.draft : '';
  const textState = react.useState(initText);
  const local = textState[0];
  const setLocal = textState[1];
  const staleState = react.useState(false);
  const composingRef: any = react.useRef ? react.useRef(false) : { current: false };
  const queuedRef: any = react.useRef ? react.useRef('') : { current: '' };
  const timerRef: any = react.useRef ? react.useRef(null) : { current: null };
  const lastHostRef: any = react.useRef ? react.useRef(initText) : { current: initText };
  const chainRef: any = react.useRef ? react.useRef(Promise.resolve()) : { current: Promise.resolve() };
  const taRef: any = react.useRef ? react.useRef(null) : { current: null };
  const captured = (props as any).capturedSessionId || '';

  // 开框即聚＋键盘感知（dvh 上限 Natal；scrollIntoView 防键盘盖框）
  react.useEffect(() => {
    try {
      const el = taRef && taRef.current;
      if (el && typeof el.focus === 'function') {
        const t = setTimeout(() => {
          try { el.focus(); } catch (e) { /* ignore */ }
          try { if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ }
        }, 0);
        return () => { try { clearTimeout(t); } catch (e) { /* ignore */ } };
      }
    } catch (e) { /* ignore */ }
    return undefined;
  }, []);

  // host→sheet：订阅桥，采纳即跟（组词中/聚焦在敲时不盖字）
  react.useEffect(() => {
    const sync = (): void => {
      try {
        const cur = getSmartInput();
        const host = typeof cur.draft === 'string' ? cur.draft : '';
        const curId = typeof cur.sessionId === 'string' ? cur.sessionId : '';
        // 会话切换即标 stale（停写，提示重开）
        try {
          if (captured !== '' && curId !== '' && curId !== captured) {
            try { staleState[1](true); } catch (e) { /* ignore */ }
          } else {
            try { staleState[1](false); } catch (e) { /* ignore */ }
          }
        } catch (e) { /* ignore */ }
        let focused = false;
        try {
          const ae = (globalThis as any).document && (globalThis as any).document.activeElement;
          focused = !!(taRef && taRef.current && ae === taRef.current);
        } catch (e) { focused = false; }
        const composing = !!(composingRef && composingRef.current === true);
        const last = typeof lastHostRef.current === 'string' ? lastHostRef.current : '';
        const curLocal = (textState[0] as string);
        if (shouldAdoptHostDraft({ hostDraft: host, local: curLocal, lastHost: last, composing, focused })) {
          lastHostRef.current = host;
          if (curLocal !== host) {
            try { setLocal(host); } catch (e) { /* ignore */ }
          }
        } else if (host !== last && !composing && !focused) {
          // 非聚焦兜底：仍记 last，避免旧值反复触发
          lastHostRef.current = host;
        }
      } catch (e) { /* ignore */ }
    };
    sync();
    let off: any = null;
    try { off = onSmartInput(sync); } catch (e) { /* ignore */ }
    return () => { try { if (typeof off === 'function') off(); } catch (e) { /* ignore */ } };
  }, []);

  // 拆 timer（unmount 清）
  react.useEffect(() => {
    return () => { try { if (timerRef.current) clearTimeout(timerRef.current); } catch (e) { /* ignore */ } };
  }, []);

  const pushSerial = (v: string): void => {
    try {
      const run = chainRef.current || Promise.resolve();
      chainRef.current = run.then(() => {
        try {
          const cur = getSmartInput();
          const curId = typeof cur.sessionId === 'string' ? cur.sessionId : '';
          const composing = !!(composingRef && composingRef.current === true);
          if (!shouldWriteMirror(captured, curId, composing)) return;
          const actions = (cur as any).actions;
          if (!actions || typeof actions.setDraft !== 'function') return;
          // 现决现拼语义：全量替换（宿主 setDraft 即全文＋光标置尾，无光标级 API）
          actions.setDraft(v);
          try { lastHostRef.current = v; } catch (e) { /* ignore */ }
        } catch (e) { /* ignore */ }
      });
    } catch (e) { /* ignore */ }
  };

  const schedule = (v: string): void => {
    try {
      if (timerRef.current) clearTimeout(timerRef.current);
    } catch (e) { /* ignore */ }
    try {
      timerRef.current = setTimeout(() => { pushSerial(v); }, MIRROR_DEBOUNCE_MS);
    } catch (e) { /* ignore */ }
  };

  const stale = (staleState[0] as boolean) === true;

  return h('div', { style: rootStyle, 'data-dsh-prompt-remote-input-root': '1' },
    h('div', {
      style: maskStyle, 'data-dsh-prompt-remote-input-mask': '1',
      onClick: (e: any) => { if (e.target === e.currentTarget) (props as any).onClose(); },
    }, [
      h('div', { style: sheetStyle, role: 'dialog', 'aria-modal': 'true', 'aria-label': tr(lang, STR.remoteInputTitle), 'data-dsh-prompt-remote-input-sheet': '1' }, [
        h('div', { style: headStyle }, [
          h('span', { style: titleStyle }, tr(lang, STR.remoteInputTitle)),
          h('span', { style: subStyle }, tr(lang, STR.remoteInputSub)),
          h('button', { type: 'button', style: xStyle, title: tr(lang, STR.close), 'aria-label': tr(lang, STR.close), onClick: () => (props as any).onClose() }, '×'),
        ]),
        h('textarea', {
          ref: (el: any) => { try { if (taRef) taRef.current = el; } catch (e) { /* ignore */ } },
          style: taStyle, rows: 3, value: local,
          placeholder: tr(lang, STR.remoteInputPh),
          'data-dsh-prompt-remote-input-ta': '1',
          onMouseDown: keepComposerFocus,
          onFocus: () => {
            try {
              const el = taRef && taRef.current;
              if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
            } catch (e) { /* ignore */ }
          },
          onCompositionStart: () => { try { composingRef.current = true; } catch (e) { /* ignore */ } },
          onCompositionEnd: () => {
            try { composingRef.current = false; } catch (e) { /* ignore */ }
            try {
              const q = typeof queuedRef.current === 'string' ? queuedRef.current : '';
              if (q !== '') { queuedRef.current = ''; schedule(q); }
            } catch (e) { /* ignore */ }
          },
          onChange: (e: any) => {
            try {
              const v = (e && e.target && typeof e.target.value === 'string') ? e.target.value : '';
              setLocal(v);
              if (composingRef.current === true) { queuedRef.current = v; return; }
              schedule(v);
            } catch (err) { /* ignore */ }
          },
        }),
        h('div', { style: metaStyle },
          (stale ? tr(lang, STR.remoteInputStale) + ' · ' : '') + tr(lang, STR.remoteInputMeta) + ' · ' + String((local || '').length) + '字'),
      ]),
    ]),
  );
}
