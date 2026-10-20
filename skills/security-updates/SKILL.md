---
name: security-updates
description: Fix a security advisory in a Linchpin repo's npm or Composer dependencies the house way — Dependabot alerts are the signal and stay on, Dependabot's PRs stay off, and every fix is declared in the manifest, so a transitive package gets a scoped `overrides` entry naming its parent (or a Composer `conflict` floor), never a lockfile-only bump. Use when a Dependabot alert or security advisory lands, when npm audit or composer audit flags a package nothing in package.json names, when a Dependabot security PR is open, or when adding, reviewing or removing an override. Not for routine or major updates — use `dependency-updates`.
when_to_use: Also when someone says "there's a CVE in uuid", "the security tab is red", "can we just merge the Dependabot PR", "why is this override here", or "can this override come out yet" — and when checking or setting up a repo's Dependabot and Renovate security settings.
version: 1.0.0
allowed-tools: Read Grep Glob Bash(npm audit) Bash(npm audit --omit=dev) Bash(npm ls *) Bash(npm explain *) Bash(npm view *) Bash(composer audit*) Bash(composer why *) Bash(git status*) Bash(git diff*)
---

# Security updates

Dependabot is how we **find out**; the manifest is where we **fix it**. A fix that lives only
in a lock file is invisible in review, and the manifest still allows the vulnerable version, so
the next lock file resolved from the wrong side of a conflict brings it straight back. On a
Linchpin repo every security fix is written into `package.json` or `composer.json`, where a
reviewer sees it and Renovate keeps it current.

## When to use

- A Dependabot alert opens, or someone forwards a GitHub security advisory.
- `npm audit` or `composer audit` flags a package — especially one nothing in `package.json`
  names, three levels down.
- A Dependabot security PR is open, or someone asks whether to merge one.
- An `overrides` or Composer `conflict` entry is being added, reviewed, or questioned.
- A repo's Dependabot and Renovate security settings need checking or setting up.

**Not this skill:** routine and major updates, failing or conflicted Renovate PRs, holds, and
lockfile repair — [`dependency-updates`](../dependency-updates/SKILL.md). The recurring pass
over the whole backlog is [`maintenance-window`](../maintenance-window/SKILL.md), which hands
each advisory here. Whether a package should be declared at all is
[`wp-plugin-dependency-audit`](../wp-plugin-dependency-audit/SKILL.md).

## Owns

Canonical for: the security-update standard below; the split between Dependabot and Renovate
and the repo settings that enforce it; the scoped-override recipe for npm and the `conflict`
floor for Composer; and an override's whole life — when one is added, how it is verified, and
when it comes out.

Defers: applying a routine or major update, lockfile hygiene, holds →
[`dependency-updates`](../dependency-updates/SKILL.md). Draining the backlog →
[`maintenance-window`](../maintenance-window/SKILL.md). Running the gates →
[`quality-gates`](../quality-gates/SKILL.md). Branch and task →
[`task-tracking`](../task-tracking/SKILL.md). The commit and PR title →
[`commit-and-release`](../commit-and-release/SKILL.md).

## The standard

| Job | Owner | How |
| --- | --- | --- |
| Find the advisory | **Dependabot alerts** — always on | Renovate reads the same alerts, so switching them off blinds both bots |
| Raise the fix PR | **Renovate**, via the shared preset — `rangeStrategy: "bump"` | Dependabot's security PRs are switched **off**: they only ever edit the lock file |
| Direct dependency | Renovate's `[SECURITY]` PR, or you | The manifest range moves up to the first patched version |
| Transitive npm package | You | A **scoped** `overrides` entry naming the parent that brings it in, as a range |
| Transitive Composer package | You | A root `conflict` entry banning the vulnerable range |
| Keeping the fix current | Renovate | It tracks every override entry as a dependency (`depType: overrides`) |

This replaces the older *refresh first, override second* rule, which `dependency-updates`
carried until 2.0.0 and some repos still quote in their `renovate.json`. A lock file refresh
is no longer a fix on its own, even when it would reach the patched version.

**Severity sets the urgency, never the method.** How fast each severity has to ship is the
agency's patch cadence, owned by *Security Scanning & Monitoring* on docs.linchpin.com (its
*From disclosure to patch* table), not by this skill. Whatever the urgency, the fix goes on its
own branch to the default branch — never into a `maintenance/*` window, where it isn't on the
site until the window merges.

The settings that make this the default on a repo, and how to check them:
[`references/repo-settings.md`](references/repo-settings.md).

## Preflight

| Look for | Tells you | If missing |
| --- | --- | --- |
| Open Dependabot alerts (`gh api repos/<owner>/<repo>/dependabot/alerts?state=open`) | Each advisory's package, patched version, `relationship` (direct/transitive), `scope` (runtime/development), and manifest | A 403 or 404 usually means alerts are off. That is the first finding — say so |
| Every `package.json` / `composer.json` with its own lock file | How many places a fix has to land — a separate `blocks/` project needs its own entry | — |
| Root `package.json` → `workspaces` | npm reads `overrides` **only at the root** of a workspace set | No `workspaces` → each project with a lock file is its own root |
| `package.json` → `overrides`, `composer.json` → `conflict` | Fixes already in place. A bare top-level entry is drift; an entry whose parent has moved on can come out | — |
| `renovate.json` → `extends`, `vulnerabilityAlerts`, `packageRules`, `baseBranchPatterns` | Whether the shared preset's security behaviour applies, and whether Renovate processes the default branch at all | Only `config:recommended` means Renovate's defaults: security PRs on, but **lockfile-only** (`update-lockfile`) |
| Dependabot security PRs (`gh api repos/<owner>/<repo>/automated-security-fixes`) and open Dependabot PRs | Whether a second bot is opening lockfile-only fixes | — |
| Open PRs labelled `security` | A fix already in flight — extend it, don't duplicate it | — |

A repo whose `renovate.json` description or `CLAUDE.md` still says to refresh the lock file
first predates this standard. Report it as drift; don't follow it.

## Procedure

1. **Read the alert.** Note the package, the vulnerable range, the first patched version, the
   relationship, the scope, and the manifest path. → One line you can say out loud, e.g.
   "`uuid` below 11.1.1 (CVE-2026-41907), transitive via `sockjs`, development,
   `blocks/package-lock.json`."
2. **Find the path.** `npm explain <pkg>` (or `npm ls <pkg>`) shows every chain that reaches the
   vulnerable copy; `composer why <vendor/pkg>` does the same for Composer. → You can name each
   **parent** — the package whose own range admits the vulnerable version — and that range.
3. **Branch** on its own, one advisory (or one parent) per PR, per
   [`task-tracking`](../task-tracking/SKILL.md). → A branch off an up-to-date default branch.
4. **Write the fix into the manifest.**
   - **Direct dependency** — raise the declared range to the first patched version
     (`npm install <pkg>@^<patched>`, `composer require <vendor/pkg>:^<patched>`), or merge
     Renovate's `[SECURITY]` PR once it bumps the range rather than only the lock.
   - **Transitive npm** — a scoped override naming the parent, as a `^` range of the first
     patched version: `"overrides": { "sockjs": { "uuid": "^11.1.1" } }`. One entry per
     parent, in every root the Preflight found.
   - **Transitive Composer** — a root `conflict` entry banning everything below the patched
     version, `"conflict": { "vendor/pkg": "<1.2.3" }`, then
     `composer update vendor/pkg --with-all-dependencies`.

   The forms, the cases where the override belongs on the parent itself, and the ways an
   override silently fails: [`references/overrides.md`](references/overrides.md).
   → `git diff` shows the manifest entry plus a lock file diff limited to that package.
5. **Prove it took — both failure modes are silent.** In each root: `npm ci` (a bad override
   desyncs the lock and fails here, not in your editor), `npm ls <pkg>` (every copy is at or
   above the patched version), `npm audit` (the advisory is gone). Composer: `composer audit`.
   An override that crosses the parent's major is a compatibility claim, so exercise the code
   that loads the parent. Then the repo's gates and build through
   [`quality-gates`](../quality-gates/SKILL.md). → All green from a clean install.
6. **Ship it ahead of other work.** Commit and title per
   [`commit-and-release`](../commit-and-release/SKILL.md). The PR body names the advisory
   (GHSA or CVE id), the parent, the entry added, and the condition for removing it. → PR open
   against the default branch.
7. **Close the loop.** Close any Dependabot PR for the same advisory with a comment linking
   yours. → After merge, the alert shows as fixed on the default branch. An alert still open
   means a copy was missed: back to step 2.

## Retiring an override

Every override is a promise to check the parent again. It comes out when **the parent's own
declared range no longer admits the vulnerable version** — not merely when a newer parent
exists. That is the only removal test that works for every entry, including ones a lock file
refresh could have reached.

To find candidates, read the latest run of the repo's `check-overrides` workflow
(`linchpin/actions`, v4) if it has one. It labels each entry *still needed*, *redundant* or
*dangling*. *Redundant* only means the tree would currently resolve a safe version without the
entry; it is not the removal test. Check with
`npm view <parent>@<installed version> dependencies.<pkg>`, or when the parent has left the
tree, `npm ls <parent>` comes back empty. Then delete the entry, reinstall, and
re-run step 5. A clean `npm audit` after the removal is the proof. Check every override in
each [`maintenance-window`](../maintenance-window/SKILL.md) pass, so none outlives its reason.

## Guardrails

- **Never** disable Dependabot **alerts**, and never dismiss one without a written reason on
  the alert. They are the signal both bots read. Switch off only the security-update PRs.
- **Never** fix an advisory with a lockfile-only change — not `npm audit fix`,
  `npm update --package-lock-only`, nor merging a Dependabot PR. Declare it in the manifest.
- **Never** run `npm audit fix --force`; it installs majors silently.
- **Never** add a bare top-level override (`"uuid": "^14.0.2"`). It rewrites every copy in the
  tree, including ones that were never vulnerable. Name the parent.
- **Never** pin an override to an exact version. A range lets Renovate keep moving it.
- **Never** hand-edit a lock file to make an override take; regenerate it with the tool.
- **Never** set an override above the first patched version "to be safe". The minimum says
  which advisory the entry answers, and crossing extra majors is risk nobody asked for;
  anything newer is Renovate's job.
- **Never** fold a security fix into a maintenance window or an unrelated PR.
- If no patched release exists, or the only one is a major the parent can't run, stop and
  report it with the options: replace the parent, wait for upstream, or dismiss the alert with
  the reason written on it. Never force the install with `--force` or `--legacy-peer-deps`.

## Done

- [ ] Each advisory traced to a named parent and its range, in every root that has a lock file.
- [ ] The fix is in the manifest: a raised range, a scoped override as a range, or a Composer
      `conflict` floor. No lockfile-only fix.
- [ ] `npm ci`, `npm ls <pkg>` and `npm audit` (or `composer audit`) are clean in every root,
      and the gates and build pass from a clean install.
- [ ] The PR names the advisory, the parent, and when the entry can come out.
- [ ] Any Dependabot PR for the same advisory is closed with a link to the fix.
- [ ] The repo's settings match [`references/repo-settings.md`](references/repo-settings.md),
      or the drift is reported.
