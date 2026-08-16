# Triage Labels

This repo enforces a **mandatory label system**: every issue in the tracker must carry at least one of the labels below. They are created in GitHub Issues and applied by the skills that read and write tickets.

| Label                | Meaning                                                        |
| -------------------- | -------------------------------------------------------------- |
| `bug`                | Something isn't working — a defect report.                     |
| `needs-triage`       | Maintainer needs to evaluate this issue.                       |
| `wayfinder:grilling` | Wayfinder child ticket of type `grilling` — stress-test a plan, decision, or idea. |

## Mapping from the canonical skill roles

The skills speak in terms of five canonical triage roles. Map them onto this repo's vocabulary as follows:

| Role in skills | Label in our tracker                                    |
| -------------- | ------------------------------------------------------- |
| `needs-triage` | `needs-triage`                                          |
| `needs-info`   | `needs-triage` (ask for the missing info in comments)   |
| `ready-for-agent` | `needs-triage` (body fully specifies the work)      |
| `ready-for-human` | `needs-triage` (body marks it human-required)       |
| `wontfix`      | `wontfix` (GitHub default label, kept for closures)    |

When a skill mentions a role (e.g. "apply the triage label"), use the corresponding label string from this table. GitHub's other default labels (`question`, `duplicate`, `invalid`, …) remain available as supplements; the three enforced labels are the baseline every issue needs.

Wayfinder's map/child convention additionally uses `wayfinder:map` and `wayfinder:<type>` labels on demand — see `docs/agents/issue-tracker.md`.
