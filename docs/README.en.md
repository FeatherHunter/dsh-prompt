# ⚡ dsh-prompt

**🌐 [中文](README.md) · [English](docs/README.en.md)**

**Deep prompt templates at your fingertips — 24 presets + custom management + /prompt trigger + smart suggestion card. One click inserts into the current conversation.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/dsh-prompt)](https://www.npmjs.com/package/dsh-prompt)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-orange.svg)](https://github.com/FeatherHunter/dsh-prompt)
[![platform](https://img.shields.io/badge/platform-DeepSeek%20Harness-1f6feb.svg)](https://github.com/deepseek-ai/DeepSeek-Harness)

![hero](assets/hero-zh.svg)

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

There is a **⚡Prompt button** beside the conversation input in DeepSeek Harness. Click it to open the template panel — **one click inserts the template body into the input**, no more memorizing, searching docs, or copy-paste.

- **24 deep prompt presets** (Thinking Frameworks 10 / Learning 3 / Engineering 4 / Execution 6): First Principles, Socratic Questioning, Adversarial Review, Decision Analysis, Feynman Technique, MECE Decomposition, Code Review, Test Design, Zero-loss Snapshot, Retrospective… All use the **colon-form body** (instruction block + field block; each field is a line like `Topic:` — you type right after the colon, zero deletion).
- **Custom templates**: add via ＋, delete only your own (with confirmation), editable; one-click "copy preset to custom".
- **/prompt trigger**: type `/prompt` in the input (keep typing to filter, e.g. `/prompt 思考框架`, `/prompt 拆解`) and press Enter or click to insert.
- **v1.1 smart suggestion card**: one global subtle dot (draggable, position remembered). When your draft matches a template, the card expands from the dot toward the top-right; click any row to insert, the caret lands after the first field colon. No keyboard capture — Enter keeps sending.
- **Scenario tags**: every template carries 领域×阶段×动作 (domain × stage × action) tags; the panel groups by stage, filters by domain, and searches.
- **Bilingual UI**: the panel follows the DSH UI language (中文 / English).
- **Theme-aware**: fonts, sizes and colors all follow the DSH theme and typography settings.
- **Local persistence**: customs, usage counts (sorting only, never shown), pins, card position and switch are all stored locally.

## /prompt — type and go

![prompt trigger](assets/prompt-trigger-zh.svg)

Type `/prompt` to list templates; keep typing to filter (`/prompt 思考框架`, `/prompt 执行前`, `/prompt 拆解`… matched against name / body / domain / stage / action / tag); Enter or click to insert.

## Smart card — matched, suggested

![smart card](assets/smart-card-zh.svg)

Type something like "help me decide between two options" and the card expands from the dot (≤3 candidates: top-2 scored + recently used; score = strong word ×2 + weak word ×1, card only when ≥2, never padded). Click any row to insert; the caret lands after the first field colon.

## Quick start

**⚡Prompt button (left of the input)** → panel opens → click any template → body inserts at the caret (no overwrite) and the panel closes:

- Tabs: All / Before / During / After / Custom
- Domain row: All / Thinking / Learning / Engineering / Execution
- Search: matches name / body / tags
- 📌 Pin (≤5), ＋ Add, Edit / Delete (customs only), Copy to custom

**Type `/prompt` directly in the input** → the slash menu lists templates (customs included); keep typing to filter; Enter or click to insert.

**Smart mode (on by default)**: matches your draft and shows the card; click × to collapse back to the dot; typing again brings it back; turn it off in Settings.

## Settings

**Settings → Prompt Templates** (a direct settings page):

- Top: **GitHub repo** / **Report issue** (one-click links)
- **Smart suggestion card** switch (on by default)
- **Template management**: full CRUD (＋add / edit / delete / copy preset to custom)

## Development

```bash
npm run build:client   # tsdown → lib/client.js (bundle artifact)
npm run build          # full build (bash scripts/build.sh)
```

- Client source: `src/client/*` (panel / trigger / smart match / word table / bridge / settings)
- The matching engine shares template data and sorting with /prompt; the smart word table covers all 24 presets
- Architecture and decision records: [GitHub issue #1 (wayfinding map)](https://github.com/FeatherHunter/dsh-prompt/issues/1)

## Contributing

Good entry points: new preset templates (colon-form), word-table tuning, UI polish, docs & translations. Issues and PRs welcome!

## License

MIT © FeatherHunter.
