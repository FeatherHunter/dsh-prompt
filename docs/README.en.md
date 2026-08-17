# ⚡ dsh-prompt

**🌐 [中文](README.md) · [English](docs/README.en.md)**

**The prompt palette for DeepSeek Harness: 24 deep templates, custom management, /prompt trigger and a smart suggestion card — one click, inserted into the conversation.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/dsh-prompt)](https://www.npmjs.com/package/dsh-prompt)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-orange.svg)](https://github.com/FeatherHunter/dsh-prompt)
[![platform](https://img.shields.io/badge/platform-DeepSeek%20Harness-1f6feb.svg)](https://github.com/deepseek-ai/DeepSeek-Harness)

![hero](assets/hero-zh.svg)

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

## Who it's for

People who chat with DeepSeek a lot and write prompts from scratch every time; people who want to turn their hard-won prompts into a personal library; people who want the AI to quietly suggest "there's a template for this" at the right moment.

## What it is

- **24 deep prompt presets** (Thinking 10 / Learning 3 / Engineering 4 / Execution 7): First Principles, Socratic Questioning, Adversarial Review, Decision Analysis, Feynman Technique, MECE Decomposition, Code Review, Test Design, Zero-loss Snapshot, Retrospective… All **colon-form**: instruction block + field block, each field a line like `Topic:` — type right after the colon, zero deletion.
- **Custom templates**: add, edit, delete (own only, confirmed); one-click "copy preset to custom".
- **/prompt trigger**: type `/prompt` in the input, keep typing to filter by name/body/domain/stage/action/tag, Enter or click to insert.
- **Smart suggestion card**: one global subtle dot (draggable, position remembered); when your draft matches, the card expands from the dot toward the top-right; click any row to insert; **no keyboard capture** — Enter keeps sending.
- **Scenario tags**: every template carries domain × stage × action tags; the panel groups by stage, filters by domain, searches.
- **Follows DSH**: fonts, sizes and colors follow the theme; bilingual UI (中文/English); local persistence.

## Real templates, for real

- **First Principles** — `Analyze the topic from first principles… 5. Give your original take. Topic:`
- **Adversarial Review** — `Red-team this plan… 4. What evidence would change your mind? Plan:`
- **Decision Analysis** — `You are a calm decision analyst… 6. Is there a no-return path? My situation:`
- **Zero-loss Snapshot** — `List the key info from this session — no compression, no merging, better verbose than omitted.`
- **MECE Decomposition** — `Break the problem down with MECE… 4. Rank the key sub-questions. Problem:`

Every template is "instruction block + field block": click in, the caret lands right after the first colon, start typing.

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

## Privacy

Everything stays local: templates, usage counts, pins and the card position live in localStorage only. Nothing is uploaded.

## FAQ

- **Not working after install?** Restart DSH or refresh the page.
- **Can I delete a preset?** Not directly — but copy it to a custom template first and edit freely.
- **Smart card too noisy?** Turn it off in Settings; the panel and /prompt are unaffected.
- **Data lost when switching machines?** Storage is local for now; export/migration is planned — open an issue to push it up.

## Development

```bash
npm run build:client   # tsdown → lib/client.js
npm run build          # full build
```

Source: `src/client/*` (panel/trigger/smart match/word table/settings); the matching engine shares data and sorting with /prompt; decisions: [issue #1 (wayfinding map)](https://github.com/FeatherHunter/dsh-prompt/issues/1).

## More from the same author

Two more DSH plugins:

- [**dsh-opencode-palette**](https://github.com/FeatherHunter/dsh-opencode-palette) — 34 official opencode themes, one-click restyle for the DSH UI.
- [**dsh-mattpocock-skills-deck**](https://github.com/FeatherHunter/dsh-mattpocock-skills-deck) — 25 engineering skills, paste one install prompt and go.

## Contributing

New presets (colon-form), word-table tuning, UI polish, docs & translations — Issues and PRs welcome.

## A note from the author

I built this because I was tired of hunting for prompts mid-conversation too. If something in your day-to-day usage grinds, open an issue — I read them.

## License

MIT © FeatherHunter.
