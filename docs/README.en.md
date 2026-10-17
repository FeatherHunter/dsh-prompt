<h1 align="center">dsh-prompt</h1>

<div align="center">

[中文](../README.md) · **English**

**Turn every repeated prompt into a template.**
24 deep templates — one click drops the body into the chat box.<br>
Works out of the box, fully customizable.

Your ⭐ means the world to me.

[![Version](https://img.shields.io/npm/v/dsh-prompt?color=2563EB)](https://www.npmjs.com/package/dsh-prompt) [![Downloads](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.npmjs.org%2Fdownloads%2Fpoint%2Flast-month%2Fdsh-prompt&query=%24.downloads&label=downloads&suffix=%2Fmonth&color=059669)](https://www.npmjs.com/package/dsh-prompt) [![Last commit](https://img.shields.io/github/last-commit/FeatherHunter/dsh-prompt?color=7C3AED)](https://github.com/FeatherHunter/dsh-prompt/commits/main) [![Commits](https://img.shields.io/github/commit-activity/m/FeatherHunter/dsh-prompt?color=DB2777)](https://github.com/FeatherHunter/dsh-prompt/graphs/commit-activity) [![Contributions welcome](https://img.shields.io/badge/contributions-welcome-EA580C.svg)](https://github.com/FeatherHunter/dsh-prompt/issues)

</div>

<div align="center">

## Install <sub>INSTALL</sub>

</div>

<div align="center">

Requires [DSH](https://www.npmjs.com/package/@deepseek-ai/dsh) (DeepSeek Harness).

</div>

```bash
# 1. Install the DSH CLI (skip if present)
npm install -g @deepseek-ai/dsh

# 2. Install dsh-prompt — --profile is REQUIRED: install into the profile
#    behind the DSH entry you actually use (wrong profile = silent no-op)
dsh plugin --profile web add dsh-prompt       # self-hosted web service (dsh web)
#     or
dsh plugin --profile desktop add dsh-prompt   # DSH Desktop app
# Pin a version for stability (current 0.4.30):
dsh plugin --profile web add dsh-prompt@0.4.30 --registry https://registry.npmjs.org
#     or
dsh plugin --profile desktop add dsh-prompt@0.4.30 --registry https://registry.npmjs.org
```

<div align="center">

Restart DSH once after installing.

**👇 Restart after installing; a new button left of the input box means success.**

<img src="../assets/readme/01-install-ready.png" width="720" alt="Prompt button left of the input box after install" style="border:1px solid #30363d;border-radius:6px">

</div>

### Advanced install

#### Update silently ignored?

Examples below use the web profile — **DSH Desktop users, replace every `--profile web` with `--profile desktop`**.

```bash
# When an update is silently skipped, pin the official registry
dsh plugin --profile web add dsh-prompt@latest --registry https://registry.npmjs.org
```

#### Paste this to your AI and let it install dsh-prompt for you

```text
Please install the DeepSeek Harness plugin dsh-prompt. Read the repo README first: https://github.com/FeatherHunter/dsh-prompt
First confirm which profile my DSH entry uses (DSH Desktop app → desktop; self-hosted web service → web) and install into the right one;
then check the environment and install as needed (skip what's present), and report back briefly.
```

**Upgrade**

```bash
dsh plugin --profile web update dsh-prompt   # upgrade
```

**Uninstall**

```bash
dsh plugin --profile web remove dsh-prompt   # uninstall
```

<div align="center">

## Way 1<br>Prompt button

</div>

<div align="center">

Move the mouse onto the "⚡Prompt button" and the list opens by itself.

**👇 One click on the button and the panel looks like this.**

<img src="../assets/readme/02-panel-button.png" width="640" alt="Prompt button hover panel with phase filters and template list" style="border:1px solid #30363d;border-radius:6px">

</div>

<div align="center">

## Way 2<br>/prompt trigger

</div>

<div align="center">

Type `/prompt` in the box to get a pick list.<br>
`/prompt retro` narrows it down.

**👇 `/prompt` shows every template.**

<img src="../assets/readme/03-trigger-prompt.png" width="640" alt="`/prompt` trigger: filtered candidate list" style="border:1px solid #30363d;border-radius:6px">

</div>

<div align="center">

## Settings<br>SETTINGS

</div>

<div align="center">

**👇 The settings panel packs the whole feature set.**

<img src="../assets/readme/05-templates-gallery.png" width="640" alt="Gallery: 24 preset templates on the settings page" style="border:1px solid #30363d;border-radius:6px">

</div>

<div align="center">

## Customize & manage<br>CUSTOM

</div>

<div align="center">

**👇 Add a custom prompt template.**

<img src="../assets/readme/06-custom-manage.png" width="560" alt="Custom management: new custom template dialog" style="border:1px solid #30363d;border-radius:6px">

</div>

<div align="center">

## More from the author <sub>MORE</sub>

</div>

If you like this one, these may help too:

**[dsh-mattpocock-skills-deck](https://github.com/FeatherHunter/dsh-mattpocock-skills-deck)** — 25 engineering skill packs, callable right from the panel

**[dsh-opencode-palette](https://github.com/FeatherHunter/dsh-opencode-palette)** — 34 classic opencode themes for DSH, one click to reskin, survives restarts

**[ilife](https://github.com/FeatherHunter/ilife)** — love life: a home-life kit for DSH, seven independently installable plugins in one repo

**[dsh-im-companion](https://github.com/FeatherHunter/dsh-im-companion)** — enhances dsh-im with the notions of assistants and homes: see at a glance which workspace has an assistant on duty and whether it is online; moving is one drag

<div align="center">

Questions, ideas, IDEs, inspiration, or just a chat: [open an ISSUE](https://github.com/FeatherHunter/dsh-prompt/issues)🌹

</div>

<div align="center">

## Thanks <sub>THANKS</sub>

</div>

<div align="left">

Thanks to everyone who filed issues, sent PRs, or starred the repo — you make this toolbox better, bit by bit. Thank you so much! 🎉🎉🎉🎉🎉🎉🎉🎉🎉

[@wqzhellohhwy](https://github.com/wqzhellohhwy)🌹🌹🌹 — [#146](https://github.com/FeatherHunter/dsh-prompt/issues/146) runtime styles missing attribution (fixed), [#147](https://github.com/FeatherHunter/dsh-prompt/issues/147) dependency declaration stalling plugins as pending (fixed), [#148](https://github.com/FeatherHunter/dsh-prompt/issues/148) remote tier resetting the whole UI to 14px when turned off (fixed)

[@dagangwo](https://github.com/dagangwo)🌹 — [#175](https://github.com/FeatherHunter/dsh-prompt/issues/175) hover list: the topmost entry cannot be selected and the window closes on its own (awaiting repro)

[@jheroy](https://github.com/jheroy)🌹 — [#165](https://github.com/FeatherHunter/dsh-prompt/issues/165) hiding preset templates, plus finalizing the button design and interaction details

</div>
