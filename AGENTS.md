# AGENTS.md

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues, operated via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Release

Ship npm releases with the token script `scripts/publish-token.ps1` (unattended, no human clicks; usage is in the script header); never hand the publish/OTP steps back to the user. Token path: the `NODE_AUTH_TOKEN` value lives in the User-scope environment (read it into the process with `$env:NODE_AUTH_TOKEN = [Environment]::GetEnvironmentVariable('NODE_AUTH_TOKEN','User')`, name only, never print the value) → `pwsh -NoProfile -File scripts\publish-token.ps1 -Probe` first (must be PROBE-OK; on a fresh version it reports PROBE-SKIP, which is expected — prove the write chain against the current published version instead) → `pwsh -NoProfile -File scripts\publish-token.ps1` (gates → publish → one-pass sampling; add `-FullPost` before announcing). Do not use `scripts/publish-window.ps1` (interactive 2FA window) unless the token path is unavailable. Accepted ≠ visible: `E409 previously-staged` means received, wait minutes, do not republish or bump.
