# ⚡ dsh-prompt

**🌐 [中文](../README.md) · [English](README.en.md)**

**A Prompt toolbox for DeepSeek Harness: 24 deep templates, custom management, /prompt trigger source, and a smart suggestion card — click once, inserted into your current conversation.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](../LICENSE)
[![npm](https://img.shields.io/npm/v/dsh-prompt)](https://www.npmjs.com/package/dsh-prompt)
[![dsh-plugin](https://img.shields.io/badge/dsh-plugin-orange.svg)](https://github.com/FeatherHunter/dsh-prompt)
[![platform](https://img.shields.io/badge/platform-DeepSeek%20Harness-1f6feb.svg)](https://github.com/deepseek-ai/DeepSeek-Harness)

![hero](../assets/hero-en.svg)

## Quick navigation

[![Install in one command](../assets/nav-install-en.svg)](#install-in-one-command)

[![Three ways to summon templates](../assets/nav-ways-en.svg)](#three-ways-to-summon-templates)

[![24 deep templates](../assets/nav-templates-en.svg)](#what-the-templates-look-like)

[![Customize & manage](../assets/nav-settings-en.svg)](#customization--management)

[![FAQ](../assets/nav-faq-en.svg)](#faq)

[![npm release](../assets/nav-npm-en.svg)](https://www.npmjs.com/package/dsh-prompt)

[![Report a bug](../assets/nav-issues-en.svg)](https://github.com/FeatherHunter/dsh-prompt/issues/new)

[![Changelog](../assets/nav-releases-en.svg)](https://github.com/FeatherHunter/dsh-prompt/releases)

## Is this for you

![Is this for you](../assets/who-en.svg)

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

![Way 1 · Prompt button panel](../assets/panel-en.svg)

### 2 · /prompt trigger source

![Way 2 · /prompt trigger](../assets/prompt-trigger-en.svg)

### 3 · Smart suggestion card

![Way 3 · Smart suggestion card](../assets/smart-card-en.svg)

## What the templates look like

![Real templates](../assets/templates-en.svg)

## Customization & management

![Customize & manage](../assets/custom-en.svg)

## Privacy

![Privacy](../assets/privacy-en.svg)

## FAQ

![FAQ](../assets/faq-en.svg)

## Development

```bash
npm run build:client   # tsdown → lib/client.js
npm run build          # full build
```

Source in `src/client/*` (panel/trigger/smart matching/word tables/settings page); the matching engine and /prompt share the same data and ranking base; decision records in [issue #1 (wayfinding map)](https://github.com/FeatherHunter/dsh-prompt/issues/1).

## From the same author

Two more DSH plugins:

- [**dsh-opencode-palette**](https://github.com/FeatherHunter/dsh-opencode-palette) — Love opencode's look? Your DSH can wear it too — 34 classic themes, easier on the eyes, happier to code in.
- [**dsh-mattpocock-skills-deck**](https://github.com/FeatherHunter/dsh-mattpocock-skills-deck) — 25 engineering skill packs, paste one install Prompt to use.

## From the author

![From the author](../assets/author-en.svg)

## License

![License](../assets/license-en.svg)
