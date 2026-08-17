# ⚡ dsh-prompt

**🌐 [中文](../README.md) · [English](README.en.md)**

**A Prompt palette for DeepSeek Harness: 24 deep templates, custom management, /prompt trigger source, and a smart suggestion card — click once, inserted into your current conversation.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../LICENSE)
[![npm](https://img.shields.io/npm/v/dsh-prompt)](https://www.npmjs.com/package/dsh-prompt)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-orange.svg)](https://github.com/FeatherHunter/dsh-prompt)
[![platform](https://img.shields.io/badge/platform-DeepSeek%20Harness-1f6feb.svg)](https://github.com/deepseek-ai/DeepSeek-Harness)

![hero](../assets/hero-zh.svg)

## Is this for you

When writing a conversation, do you: **can't recall the right Prompt**, **scroll endlessly for that one good prompt from history**, **copy-paste and tweak over and over**?

If so, this plugin is for you: **click once, the template body lands in your input box** — no memorizing, no searching, no copy-paste.

> Built for anyone who talks to DeepSeek a lot, wants to accumulate good Prompts into their own library, and appreciates the AI proactively suggesting "there's a template for this" at the right moment.

## Install in one command

You need the **DSH CLI** (DeepSeek Harness command-line tool). If you don't have it yet:

```bash
npm install -g @deepseek-ai/dsh
```

Install into your profile:

```bash
dsh plugin --profile web add dsh-prompt
```

**Zero config**: official DSH bundle mechanism — the package ships its own `cordis.patch.yml`, and `dsh plugin add` automatically joins it to the `dsh.profile.bundles` assembly layer; `dsh plugin remove` cleans up. Takes effect after restarting DSH (or refreshing the page).

## Three ways to summon templates

Once installed, templates come from three entry points — pick whichever feels natural:

### 1 · ⚡Prompt button

The ⚡Prompt button to the left of the input box → the panel opens → click any template → inserted (cursor-first, never overwrites), panel auto-closes.

The panel is organized by phase tabs (All / Before / During / After / Custom) plus domain rows (Thinking / Learning / Engineering / Executing), with search filtering; 📌 pin (up to 5), ＋create, edit/delete (custom only), and one-click "copy to custom" for presets.

### 2 · /prompt trigger source

![prompt trigger](../assets/prompt-trigger-zh.svg)

Type `/prompt` directly in the input box, keep typing to filter by name/body/domain/phase/action/tag, then Enter or click to insert.

### 3 · Smart suggestion card

![smart card](../assets/smart-card-zh.svg)

When your draft matches a template, a global dot (draggable, position remembered) expands into a recommendation card up-right; click a row to fill it in.

- Scoring = specific words×2 + generic words×1, **shown only at ≥2 points** (better absent than noisy); ≤3 candidates (top-2 matches + most recent);
- **No keyboard capture** — Enter still sends; × collapses back to the dot; keep typing and it can reappear;
- After insertion the **cursor lands right after the first field's colon** — start writing immediately; toggle it off in settings.

## What the templates look like

- **First-principles breakdown** — `Please analyze the following topic using first principles…5. Give your original conclusion based on the reasoning above. Topic:`
- **Adversarial review** — `Please adversarially review the following plan (red-team role)…4. What evidence would change your mind. Plan/conclusion:`
- **Decision game analysis** — `You are a calm decision analyst…6. Is there a path with no return? My situation:`
- **Zero-loss snapshot** — `List all key information from our session so far — no compression, no merging; prefer verbosity over omission.`
- **MECE breakdown** — `Break down the following problem with the MECE principle…4. Give the key sub-questions ranked by importance. Problem:`

**24 templates** (Thinking 10 / Learning 3 / Engineering 4 / Executing 7). All **colon-form**: body = instruction block + field block; each field is one line of `Label:`, you type right after the colon — zero deletion.

## Customization & management

**Settings → Prompt Templates** (a dedicated settings page):

- **Template management**: ＋create / edit / delete (custom only, with confirm) / copy-to-custom
- **Smart card toggle** (on by default)
- Top links: **GitHub repo** / **Report a bug** (one click)

Bilingual UI (中文/English); font, size, and colors follow the DSH theme.

## Privacy

Everything stays local: templates, usage, pins, and card position live in localStorage only — nothing is uploaded.

## FAQ

- **Installed but nothing shows?** Restart DSH or refresh the page.
- **Can I delete preset templates?** Not directly, but one-click copy-to-custom then edit.
- **Smart card too noisy?** Turn it off in settings; panel and /prompt are unaffected.
- **Will data survive a machine change?** Currently local storage; export/migration is planned — open an Issue to nudge me.

## Development

```bash
npm run build:client   # tsdown → lib/client.js
npm run build          # full build
```

Source in `src/client/*` (panel/trigger/smart matching/word tables/settings page); the matching engine and /prompt share the same data and ranking base; decision records in [issue #1 (wayfinding map)](https://github.com/FeatherHunter/dsh-prompt/issues/1).

## From the same author

Two more DSH plugins:

- [**dsh-opencode-palette**](https://github.com/FeatherHunter/dsh-opencode-palette) — 34 opencode official themes, one-click reskin for DSH.
- [**dsh-mattpocock-skills-deck**](https://github.com/FeatherHunter/dsh-mattpocock-skills-deck) — 25 engineering skill packs, paste one install Prompt to use.

## Contributing

New preset templates (colon-form), word-table polishing, UI details, doc translation — Issues and PRs are welcome.

## From the author

I built this plugin because I'm tired of hunting for Prompts on the fly. If anything in your experience stings, open an Issue — I read them carefully.

## License

MIT © FeatherHunter.
