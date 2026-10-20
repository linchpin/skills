---
title: security-updates
---

Dependabot is how we find out; the manifest is where we fix it. A fix that lives only in a lock file is invisible in review, and the manifest still allows the vulnerable version, so the next lock file resolved from the wrong side of a conflict brings it straight back. On a Linchpin repo every security fix is written into `package.json` or `composer.json`, where a reviewer sees it and Renovate keeps it current.

## When to reach for it

- A Dependabot alert opens, or someone forwards a GitHub security advisory.
- `npm audit` or `composer audit` flags a package — especially one nothing in `package.json` names, three levels down.
- A Dependabot security PR is open, or someone asks whether to merge one.
- An `overrides` or Composer `conflict` entry is being added, reviewed, or questioned.
- A repo's Dependabot and Renovate security settings need checking or setting up.

Things you might say that load it: "there's a CVE in uuid", "the security tab is red", "can we just merge the Dependabot PR", "why is this override here", "can this override come out yet".

## Where it stops

> **Not this skill:** routine and major updates, failing or conflicted Renovate PRs, holds, and lockfile repair — [`dependency-updates`](dependency-updates.md). The recurring pass over the whole backlog is [`maintenance-window`](maintenance-window.md), which hands each advisory here. Whether a package should be declared at all is `wp-plugin-dependency-audit`.

## How it works

| Job | Owner | How |
| --- | --- | --- |
| Find the advisory | Dependabot alerts, always on | Renovate reads the same alerts, so switching them off blinds both bots |
| Raise the fix PR | Renovate, with `vulnerabilityAlerts` on and `rangeStrategy: "bump"` | Dependabot's security PRs are switched off: they only ever edit the lock file |
| Direct dependency | Renovate's `[SECURITY]` PR, or you | The manifest range moves up to the first patched version |
| Transitive npm package | You | A scoped `overrides` entry naming the parent that brings it in, as a range |
| Transitive Composer package | You | A root `conflict` entry banning the vulnerable range |
| Keeping the fix current | Renovate | It tracks every override entry as a dependency |

Severity sets the urgency, never the method. How fast each severity has to ship is the agency's patch cadence on [Security Scanning & Monitoring](https://docs.linchpin.com/security-policies-procedures/security-scanning-and-monitoring/). Whatever the urgency, the fix goes on its own branch to the default branch, never into a maintenance window.

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Read the alert","content":"<p>Note the package, the vulnerable range, the first patched version, whether it is direct or transitive, runtime or development, and which lock file it is in.</p>"},{"title":"Find the path","content":"<p>Use <code>npm explain</code> or <code>composer why</code> to name the parent whose own range admits the vulnerable version.</p>"},{"title":"Branch","content":"<p>One advisory, or one parent, per branch and PR.</p>"},{"title":"Write the fix into the manifest","content":"<p>Raise a direct dependency's range; add a scoped override naming the parent for a transitive npm package; add a root <code>conflict</code> floor for Composer. Never a lockfile-only change.</p>"},{"title":"Prove it took","content":"<p>Run <code>npm ci</code>, <code>npm ls</code> and <code>npm audit</code> in every root with a lock file, exercise the parent if the override crossed its major, then the gates and the build.</p>"},{"title":"Ship it ahead of other work","content":"<p>The PR names the advisory, the parent, the entry added, and the condition for removing it.</p>"},{"title":"Close the loop","content":"<p>Close any Dependabot PR for the same advisory with a link to the fix, and confirm the alert shows as fixed after merge.</p>"}]} /-->

An override comes out when the parent's own declared range no longer admits the vulnerable version, or when the parent has left the tree. Every override is checked in each maintenance pass.

## What it checks first

| Look for | Tells you |
| --- | --- |
| Open Dependabot alerts on the repo | Each advisory's package, patched version, relationship, scope, and lock file. No access usually means alerts are off, which is the first finding |
| Every `package.json` / `composer.json` with its own lock file, and the root's `workspaces` | How many places a fix has to land. npm reads `overrides` only from the root of an install |
| Existing `overrides` and `conflict` entries | Fixes already in place, drift (a bare top-level entry), and entries that can come out |
| `renovate.json` → `vulnerabilityAlerts` | Whether Renovate's security PRs bump the manifest or only the lock file, which is its default |
| Dependabot's security-update setting and open Dependabot PRs | Whether a second bot is opening lockfile-only fixes |
| Open PRs labelled `security` | A fix already in flight |

A repo whose own notes still say to refresh the lock file first predates this standard, and the skill reports it as drift.

## What it owns

Canonical for: the security-update standard; the split between Dependabot and Renovate and the repo settings that enforce it; the scoped-override recipe for npm and the `conflict` floor for Composer; and an override's whole life — when one is added, how it is verified, and when it comes out.

## Guardrails

<!-- wp:docspress/callout {"tone":"warning","title":"Never disable Dependabot alerts","content":"<p>They are the signal both bots read. Switch off only the security-update PRs, and never dismiss an alert without a written reason on it.</p>","collapsible":false} /-->

<!-- wp:docspress/callout {"tone":"warning","title":"Never run npm audit fix --force","content":"<p>It installs semver-major changes silently.</p>","collapsible":false} /-->

- Never fix an advisory with a lockfile-only change: not `npm audit fix`, not `npm update --package-lock-only`, not a merged Dependabot PR.
- Never add a bare top-level override; it rewrites every copy in the tree. Name the parent.
- Never pin an override to an exact version, and never set one above the first patched version.
- Never hand-edit a lock file to make an override take; regenerate it with the tool.
- Never fold a security fix into a maintenance window or an unrelated PR.
- If no patched release exists, or the only one is a major the parent can't run, stop and report the options. Never force the install.

## Done when

- [ ] Each advisory traced to a named parent and its range, in every root that has a lock file.
- [ ] The fix is in the manifest: a raised range, a scoped override as a range, or a Composer `conflict` floor. No lockfile-only fix.
- [ ] `npm ci`, `npm ls` and `npm audit` (or `composer audit`) are clean in every root, and the gates and build pass from a clean install.
- [ ] The PR names the advisory, the parent, and when the entry can come out.
- [ ] Any Dependabot PR for the same advisory is closed with a link to the fix.
- [ ] The repo's settings match the standard, or the drift is reported.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/security-updates/SKILL.md) is the skill's main instructions.
- [`references/overrides.md`](https://github.com/linchpin/skills/blob/main/skills/security-updates/references/overrides.md) — how a transitive fix is written, where it goes, how it fails, and when it comes out, for npm `overrides` and Composer `conflict`.
- [`references/repo-settings.md`](https://github.com/linchpin/skills/blob/main/skills/security-updates/references/repo-settings.md) — the five settings that make the standard the default on a repo: alerts on, Dependabot security PRs off, `dependabot.yml`, the shared Renovate preset, and a base branch Renovate processes.

Pre-approved, so the agent can run them without a prompt: reading and searching files, `npm audit`, `npm ls`, `npm explain`, `npm view`, `composer audit`, `composer why`, `git status`, and `git diff`. Anything that writes still asks.

## Related skills

- [`dependency-updates`](dependency-updates.md) — owns routine and major updates, lockfile hygiene, and holds.
- [`maintenance-window`](maintenance-window.md) — the recurring pass that hands each advisory here, and where every override is re-checked.
- [`quality-gates`](quality-gates.md) — runs the gates once the fix is in.
- [`task-tracking`](task-tracking.md) — owns the branch and the task.
- [`commit-and-release`](commit-and-release.md) — owns the commit and the PR title.
- `wp-plugin-dependency-audit` — decides whether a package should be declared at all.
