# AGENTS.md

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues, operated via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Release

Ship npm releases by running `scripts/publish-window.ps1` directly (it opens an interactive 2FA window via a schtasks `/IT` task — usage is in the script header); never hand the publish/OTP steps back to the user.
