# ⚡ dsh-prompt

**🌐 [中文](README.md) · [English](docs/README.en.md)**

**The prompt palette for DeepSeek Harness: 24 deep templates, custom management, /prompt trigger and a smart suggestion card — one click, inserted into the conversation.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/dsh-prompt)](https://www.npmjs.com/package/dsh-prompt)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-orange.svg)](https://github.com/FeatherHunter/dsh-prompt)
[![platform](https://img.shields.io/badge/platform-DeepSeek%20Harness-1f6feb.svg)](https://github.com/deepseek-ai/DeepSeek-Harness)

![hero](assets/hero-zh.svg)

## 📦 My other skills · More from FeatherHunter

| Repo | One-liner (pain → fix) |
| --- | --- |
| [🎨 dsh-opencode-palette](https://github.com/FeatherHunter/dsh-opencode-palette) | Tired of the default DSH look? **34 official opencode themes, one click, persisted.** |
| [🧠 dsh-mattpocock-skills-deck](https://github.com/FeatherHunter/dsh-mattpocock-skills-deck) | AI that chats but can't get things done? **25 engineering skills (wayfinder / triage / grilling / handoff), installed in one prompt.** |
## The pain

Three annoyances when writing: **forgetting which prompt to use**, **digging through history for that one good prompt**, **copy-paste and endless tweaking**.

dsh-prompt fixes that: **one click, and the template body lands in your input** — no memorizing, no searching, no copy-paste.

## Install in one command

You need the **DSH CLI** (DeepSeek Harness command-line tool). Install it first if missing:

```bash
npm install -g @deepseek-ai/dsh
```

Install into your profile:

```bash
dsh plugin --profile web add dsh-prompt
```

**Zero configuration**: the official DSH bundle mechanism — the package ships `cordis.patch.yml` (declaring `dsh.bundle.patch`), `dsh plugin add` appends it to `dsh.profile.bundles`; `dsh plugin remove` removes it cleanly. Restart DSH (or refresh the page) to activate.

## What it is

- **24 deep prompt presets** (Thinking 10 / Learning 3 / Engineering 4 / Execution 7): First Principles, Socratic Questioning, Adversarial Review, Decision Analysis, Feynman Technique, MECE Decomposition, Code Review, Test Design, Zero-loss Snapshot, Retrospective… All **colon-form**: instruction block + field block, each field a line like `Topic:` — type right after the colon, zero deletion.
- **Custom templates**: add, edit, delete (own only, confirmed); one-click "copy preset to custom".
- **/prompt trigger**: type `/prompt` in the input, keep typing to filter by name/body/domain/stage/action/tag, Enter or click to insert.
- **Smart suggestion card**: one global subtle dot (draggable, position remembered); when your draft matches, the card expands from the dot toward the top-right; click any row to insert; **no keyboard capture** — Enter keeps sending.
- **Scenario tags**: every template carries domain × stage × action tags; the panel groups by stage, filters by domain, searches.
- **Follows DSH**: fonts, sizes and colors follow the theme; bilingual UI (中文/English); local persistence.

## /prompt — type and go

![prompt trigger](assets/prompt-trigger-zh.svg)

## Smart card — matched, suggested

![smart card](assets/smart-card-zh.svg)

Score = strong word ×2 + weak word ×1, **card only when ≥2** (never padded); ≤3 candidates (top-2 scored + recently used); after insert the **caret lands after the first field colon** — start typing right away.

## Quick start

**⚡Prompt button (left of the input)** → panel opens → click any template → inserted (at caret, no overwrite), panel closes:

- Tabs: All / Before / During / After / Custom
- Domain row: All / Thinking / Learning / Engineering / Execution
- Search: name / body / tags
- 📌 Pin (≤5), ＋Add, Edit/Delete (customs only), Copy to custom

**Type `/prompt`** → slash menu lists (customs included) → Enter or click to insert.

**Smart mode (on by default)**: matched → click row to fill → × collapses to the dot; toggle in Settings.

## Settings

**Settings → Prompt Templates** (a direct settings page):

- Top: **GitHub repo** / **Report issue** (one-click links)
- **Smart suggestion card** switch
- **Template management**: full CRUD

## Development

```bash
npm run build:client   # tsdown → lib/client.js
npm run build          # full build
```

Source: `src/client/*` (panel/trigger/smart match/word table/settings); the matching engine shares data and sorting with /prompt; decisions: [issue #1 (wayfinding map)](https://github.com/FeatherHunter/dsh-prompt/issues/1).

## Contributing

New presets (colon-form), word-table tuning, UI polish, docs & translations — Issues and PRs welcome.

## License

MIT © FeatherHunter.
