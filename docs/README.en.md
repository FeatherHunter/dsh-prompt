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
# Pin a version for stability (current 0.4.38):
dsh plugin --profile web add dsh-prompt@0.4.38 --registry https://registry.npmjs.org
#     or
dsh plugin --profile desktop add dsh-prompt@0.4.38 --registry https://registry.npmjs.org
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

Move the mouse onto the "Prompt" button left of the input box and the list opens by itself — the official 24 preset templates plus the ones you made, with scope, labels, search and usage counts on one screen.

**👇 One click on the button and the panel looks like this.**

<img src="../assets/readme/02-panel-button.png" width="640" alt="Prompt button hover panel with scope and label filters, template list, and a one-click hide-presets button" style="border:1px solid #30363d;border-radius:6px">

Hit "Hide presets" in the bottom bar and the official presets tuck away, leaving only the ones you made; "Show presets" unfolds them again.

</div>

<div align="center">

## Way 2<br>/prompt trigger

</div>

<div align="center">

Type `/prompt` or `/p` in the box.<br>
`/prompt retro` narrows it down.

**👇 `/prompt` shows every template.**

<img src="../assets/readme/03-trigger-prompt.png" width="640" alt="`/prompt` trigger: candidates showing template name, labels and the opening of the body" style="border:1px solid #30363d;border-radius:6px">

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

**👇 Add a custom prompt template: name, labels, text color and body in one dialog.**

<img src="../assets/readme/06-custom-manage.png" width="560" alt="Custom management: new custom template dialog (name, labels, text color, body)" style="border:1px solid #30363d;border-radius:6px">

**👇 The text color can be changed, and text outline is supported.**

<img src="../assets/readme/07-custom-manage-color.png" width="560" alt="Text color popover: 60 swatches, follow-theme default, text outline toggle" style="border:1px solid #30363d;border-radius:6px">

**👇 Custom prompts: text color is configurable.**

<img src="../assets/readme/02-panel-button-only-custom.png" width="640" alt="Prompt button hover panel with preset templates hidden: custom templates only" style="border:1px solid #30363d;border-radius:6px">

</div>

<div align="center">

## More from the author <sub>MORE</sub>

</div>

<div align="left">

**[dsh-mattpocock-skills-deck](https://github.com/FeatherHunter/dsh-mattpocock-skills-deck)** — the whole mattpocock/skills set (nearly 300k stars) pre-installed: 27 skill packs, ready out of the box

**[dsh-opencode-palette](https://github.com/FeatherHunter/dsh-opencode-palette)** — 38 classic opencode themes + 20+ custom themes, one click to reskin DSH

**[dsh-im-companion](https://github.com/FeatherHunter/dsh-im-companion)** — adds the notions of "assistants" and "homes" to dsh-im

**[ilife](https://github.com/FeatherHunter/ilife)** — ⚠️under construction⚠️ love life: a home-life suite covering accounting, exercise, diet, weight, recipes, item management, routine planning, memos, and more

</div>

<div align="center">

## Thanks <sub>THANKS</sub>

</div>

<div align="left">

Questions, ideas, IDEs, inspiration, or just a chat: [open an ISSUE](https://github.com/FeatherHunter/dsh-prompt/issues)🌹

Thanks to everyone who filed issues, sent PRs, or starred the repo — you make this toolbox better, bit by bit. Thank you so much! 🎉🎉🎉🎉🎉🎉🎉🎉🎉

---

[@wqzhellohhwy](https://github.com/wqzhellohhwy)🌹🌹🌹 — [#146](https://github.com/FeatherHunter/dsh-prompt/issues/146) runtime styles missing attribution (fixed), [#147](https://github.com/FeatherHunter/dsh-prompt/issues/147) dependency declaration stalling plugins as pending (fixed), [#148](https://github.com/FeatherHunter/dsh-prompt/issues/148) remote tier resetting the whole UI to 14px when turned off (fixed)

[@dagangwo](https://github.com/dagangwo)🌹 — [#175](https://github.com/FeatherHunter/dsh-prompt/issues/175) hover list: the topmost entry cannot be selected and the window closes on its own (awaiting repro)

[@jheroy](https://github.com/jheroy)🌹 — [#165](https://github.com/FeatherHunter/dsh-prompt/issues/165) hiding preset templates, plus finalizing the button design and interaction details

</div>

---

<div align="center">

**👇 Scan with Feishu to join the DSH plugin group.**

<img src="../assets/readme/09-feishu-group.png" width="280" alt="Feishu QR for the DSH plugin group" style="border:1px solid #30363d;border-radius:6px">

</div>

---

<div align="center">

![Star history chart (dual axis): total stars on the left, daily new stars on the right](https://raw.githubusercontent.com/FeatherHunter/dsh-prompt/main/docs/star-history.svg?v=20261021)

</div>
