# ⚡ dsh-prompt

**🌐 [中文](README.md) · [English](docs/README.en.md)**

**Deep prompt templates at your fingertips — 24 presets + custom management + /prompt trigger + smart suggestion card. One click inserts into the current conversation.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/dsh-prompt)](https://www.npmjs.com/package/dsh-prompt)

## Install in one command

You need the **DSH CLI** (DeepSeek Harness command-line tool). If you don't have it yet:

```bash
npm install -g @deepseek-ai/dsh
```

Then install the plugin into your profile:

```bash
dsh plugin --profile web add dsh-prompt
```

**Zero configuration**: the package ships its own `cordis.patch.yml` (declared via `dsh.bundle.patch`). `dsh plugin add` appends it to the profile's `dsh.profile.bundles` layer stack and DSH assembles it at startup; `dsh plugin remove` removes it cleanly. No manual file edits. Restart DSH (or refresh the browser page) to activate.

## What it is

There is a **⚡ Prompt** button beside the conversation input in DeepSeek Harness. Click it to open the template panel — **one click inserts the template body into the input**, no more memorizing, searching docs, or copy-paste.

- **24 deep prompt presets** (Thinking Frameworks 10 / Learning 3 / Engineering 4 / Execution 6): First Principles, Socratic Questioning, Adversarial Review, Decision Analysis, Feynman Technique, MECE Decomposition, Code Review, Test Design, Zero-loss Snapshot, Retrospective… All use the **colon-form body** (instruction block + field block; each field is a line like `Topic:` — you type right after the colon, zero deletion).
- **Custom templates**: add via ＋ dialog, delete only your own (with confirmation), full management in Settings; one-click "copy preset to custom".
- **/prompt trigger**: type `/prompt` in the input (keep typing to filter, e.g. `/prompt 思考框架`, `/prompt 拆解`) and pick to insert.
- **v1.1 smart suggestion card**: one global ⚡ handle dot (draggable, position remembered). When your draft matches a template (strong word ×2 + weak word ×1, card only when score ≥2), the card expands rightward with up to 3 candidates; click to insert, caret lands after the first field colon.
- **Scenario tags**: every template carries 领域×阶段×动作 (domain × stage × action) tags; the panel groups by stage and filters by domain.
- **Bilingual**: the panel follows the DSH UI language (中文 / English).
- **Local persistence**: customs, usage counts (sorting only, never shown), pins, card position and switch are all stored locally.

## Quick start

**⚡ Prompt button (left of the input)** → panel opens → click any template → body inserts at the caret (no overwrite) and the panel closes:

- Tabs: All / Before / During / After / Custom
- Domain row: All / Thinking / Learning / Engineering / Execution
- Search: matches name / body / tags
- ★ Pin (≤5), ＋ Add, Edit / Delete (customs only), Copy to custom

**Type `/prompt` directly in the input** → the slash menu lists templates (customs included); keep typing to filter; Enter or click to insert.

**Smart mode (on by default)**: type something like "help me decide between two options" and the ⚡ dot expands a recommendation card (≤3 candidates with an Insert button). Click × to collapse back to the dot; typing again brings it back. Turn it off in Settings if you prefer.

## Settings

**Settings → Prompt Templates** (a direct settings page):

- **Smart suggestion card** switch (on by default)
- **Template management**: full CRUD (add / edit / delete / copy preset to custom)

## Development

```bash
npm run build:client   # tsdown → lib/client.js (bundle artifact)
npm run typecheck      # tsc (note: repo tsconfig has pre-existing drift from source style, see #9 resolution)
npm run build          # full build (bash scripts/build.sh)
```

- Client source: `src/client/*` (panel / trigger / smart match / word table / bridge)
- The matching engine shares template data and sorting with /prompt; the smart word table covers all 24 presets
- Architecture and decision records: [GitHub issue #1 (wayfinding map)](https://github.com/FeatherHunter/dsh-prompt/issues/1)

## License

MIT © FeatherHunter.
