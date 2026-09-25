---
title: dependency-updates
---

Renovate already runs on every Linchpin repo and automerges the boring updates — patches, minors, and dev dependencies for both npm and Composer, grouped by manager. Running `npm update` by hand fights a bot that reopens the same change tomorrow. This skill covers the part Renovate deliberately leaves to a human: majors, breakage, conflicts, and urgency.

## When to reach for it

- A Renovate PR is failing CI, conflicted, or waiting on a judgment call.
- A major version bump is requested or required.
- A security advisory needs a fix now rather than on the bot's schedule.
- `@wordpress/*` packages need moving as a set.
- A lockfile is out of sync with its manifest.

Things you might say that load it: "bump the packages", "deps are out of date". It also applies whenever a security advisory lands.

## Where it stops

> **Not this skill:** lint/test failures unrelated to a version change — [`quality-gates`](quality-gates.md). Committing and releasing the result — [`commit-and-release`](commit-and-release.md). Working through the whole bot-PR backlog, or a `maintenance/YYYY-MM` window — the recurring pass is [`maintenance-window`](maintenance-window.md), which hands each single update back here.

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Classify the update","content":"<p>Say in a sentence whether this is routine, a major or breaking change, a security fix, or a lockfile repair, and why.</p>"},{"title":"Branch on one concern","content":"<p>Cut a branch for a single concern. For an existing bot PR, push fixes onto that branch instead of opening a rival.</p>"},{"title":"Apply the update with the right tool","content":"<p>Use <code>npm install</code> for a single package, <code>npm run packages-update</code> for the whole <code>@wordpress/*</code> set, or <code>composer update --with-all-dependencies</code> for Composer.</p>"},{"title":"Read what changed, for majors","content":"<p>Read the upstream changelog and migration notes, then grep the codebase for every removed or renamed API it touches.</p>"},{"title":"Verify","content":"<p>Reinstall clean, run quality gates and the build, and sanity-check the admin and front end when the change touches runtime code.</p>"},{"title":"Hand off","content":"<p>Commit and release the result as a build or chore commit, calling out any breaking change in the PR body.</p>"}]} /-->

Most advisories are transitive, and the fix depends on which case applies:

| Transitive advisory | Fix |
| --- | --- |
| A parent's range already allows the patched version | Refresh the lockfile — Renovate's `lockFileMaintenance`, or `npm update --package-lock-only` |
| A parent's range pins the vulnerable version | Add a scoped override naming the stuck parent, as a range, never a pin |

## What it checks first

Before touching anything, it reads the automation already governing the repo:

| Look for | Tells you |
| --- | --- |
| `renovate.json` → `packageRules`, `ignoreDeps`, `rangeStrategy`, `lockFileMaintenance` | What already automerges, what's deliberately pinned, and whether the bot refreshes lockfiles on its own |
| `package.json` → `overrides` / `resolutions` | Transitive packages already forced past a parent's range |
| Open Dependabot or Renovate PRs | Work already in flight, or a lockfile-only duplicate of what `lockFileMaintenance` already does |
| `engines` / `require.php`, `.nvmrc`, the CI matrix | The Node/PHP floors the update must not raise without approval |

If `renovate.json` would already automerge the change, it closes the change and lets the bot do it instead.

## What it owns

Canonical for: deciding whether an update is Renovate's job or yours, the manual upgrade procedure, lockfile hygiene, and holding an update Renovate must not raise yet. The recurring pass over the whole backlog belongs to [`maintenance-window`](maintenance-window.md).

## Guardrails

- Never run `npm audit fix --force` — it installs semver-major changes silently.
- Never hand-edit `package-lock.json` or `composer.lock`; regenerate them with the tool.
- Never commit a lockfile you didn't produce from a clean install.
- Never add `--legacy-peer-deps`, `--force`, or `--ignore-platform-reqs` to make an install succeed without saying so — it hides a real incompatibility.
- Never raise `engines`, `require.php`, or the WordPress minimum without approval.
- Never bundle unrelated upgrades into one PR.
- Never add a bare top-level override or resolution for a transitive advisory — name the stuck parent instead.
- Never pin an override to an exact version; use a range so Renovate can still move it.
- Never disable Dependabot alerts — only the security-update PR opener; the alerts feed Renovate reads.
- Never leave an override in place once the parent ships the fix; delete it and prove it with `npm audit`.
- Don't duplicate an update Renovate would automerge — check open bot PRs first.

## Done when

- [ ] Update classified, and it's genuinely not Renovate's automerge job.
- [ ] Lockfile diff contains only the intended packages, regenerated by the tool.
- [ ] Breaking changes identified and either handled in code or confirmed non-applicable.
- [ ] Clean install (`npm ci` / `composer install`) followed by green quality gates and build.
- [ ] Version floors (Node, PHP, WordPress) unchanged, or changed with explicit approval.
- [ ] One concern per PR, with breaking changes called out in the body.
- [ ] Any transitive advisory was tried against a lockfile refresh before an override.
- [ ] Every override names the stuck parent, uses a range, and is verified with `npm ci` and `npm audit` in each workspace.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/dependency-updates/SKILL.md) is the skill's main instructions.
- [`references/transitive-advisories.md`](https://github.com/linchpin/skills/blob/main/skills/dependency-updates/references/transitive-advisories.md) — the refresh-first, override-second recipe for transitive advisories: the Dependabot switch, scoped `overrides`, Composer's `conflict` form, and how to verify them.

Pre-approved, so the agent can run them without a prompt: reading and searching files, `npm audit`, `composer audit`, `npm outdated`, `composer outdated`, `git status`, and `git diff`. Anything that writes still asks.

## Related skills

- [`quality-gates`](quality-gates.md) — owns lint/test failures unrelated to a version change.
- [`commit-and-release`](commit-and-release.md) — owns committing and releasing the result once it's verified.
- [`task-tracking`](task-tracking.md) — owns the branch cut this skill's work happens on.
- [`maintenance-window`](maintenance-window.md) — owns the recurring pass over the whole backlog, and hands single updates here.
