---
name: dependency-updates
description: Update npm and Composer dependencies on a Linchpin project the way Renovate expects — handling the work Renovate can't automerge (majors, breaking changes, conflicted or failing bot PRs, @wordpress package bumps, holds). Use when a Renovate PR is failing, conflicted, or needs review, when asked to upgrade or bump packages, when a major version needs moving, or when a lockfile is out of sync. Not for security advisories, Dependabot alerts, or overrides — use `security-updates`. Not for fixing lint failures — use `quality-gates`. Not for draining the whole backlog — use `maintenance-window`.
when_to_use: Also when a Renovate PR is red or conflicted, when someone says "bump the packages" or "deps are out of date", or when a lockfile is out of sync with its manifest.
version: 2.0.0
allowed-tools: Read Grep Glob Bash(npm outdated*) Bash(composer outdated*) Bash(git status*) Bash(git diff*)
---

# Dependency updates

**Renovate already runs on every Linchpin repo**, and it automerges the boring updates —
patches, minors, and dev dependencies for both npm and Composer, grouped by manager. If you
run `npm update` by hand you are fighting a bot that will re-open the same change tomorrow.

Your job is the part Renovate deliberately leaves to a human: **majors, breakage, and
conflicts.**

## When to use

- A Renovate PR is failing CI, conflicted, or waiting on a judgment call.
- A major version bump is requested or required.
- `@wordpress/*` packages need moving as a set.
- A lockfile is out of sync with its manifest.

**Not this skill:** a security advisory, a Dependabot alert or PR, or an `overrides` entry —
[`security-updates`](../security-updates/SKILL.md), which owns the security standard.
Lint/test failures unrelated to a version change — [`quality-gates`](../quality-gates/SKILL.md).
Committing and releasing the result — [`commit-and-release`](../commit-and-release/SKILL.md).
Working through the whole bot-PR backlog, or a `maintenance/YYYY-MM` window — the recurring
pass is [`maintenance-window`](../maintenance-window/SKILL.md), which hands each single update
back here. Whether a package should be declared at all — unused, provided by the toolchain, or
not worth owning — is [`wp-plugin-dependency-audit`](../wp-plugin-dependency-audit/SKILL.md).

## Owns

Canonical for: deciding whether an update is Renovate's job or yours, the manual upgrade
procedure, lockfile hygiene, and holding an update Renovate must not raise yet. The recurring
pass over the whole backlog is [`maintenance-window`](../maintenance-window/SKILL.md)'s;
advisories, overrides, `conflict` floors and the Dependabot settings belong to
[`security-updates`](../security-updates/SKILL.md).

## Preflight — read the automation first

| Look for | Tells you |
| --- | --- |
| `renovate.json` → `packageRules` | What automerges (typically minor/patch and all dev deps) — **don't hand-do those** |
| `renovate.json` → `ignoreDeps` | Packages deliberately pinned; upgrading one needs a reason |
| `renovate.json` → `rangeStrategy` | Whether manifest ranges get bumped (`bump`) or only the lockfile |
| `renovate.json` → `lockFileMaintenance` | The bot refreshes lockfiles on its own schedule |
| `package.json` → `overrides`, `composer.json` → `conflict` | Security floors owned by [`security-updates`](../security-updates/SKILL.md). An update that moves a parent may let one come out — check its retirement rule rather than deleting inline |
| Open Dependabot PRs | Dependabot's PRs are off by standard; any that are open belong to [`security-updates`](../security-updates/SKILL.md) |
| Open PRs labelled `type: dependencies` | Work already in flight — extend it, don't duplicate it |
| `composer.json` / `package.json` `engines`, `require.php` | Floors you must not raise without approval |
| `.nvmrc`, CI matrix | The Node/PHP versions the update must keep working |

**Decision:** if `renovate.json` would automerge it, close your change and let the bot do it.
Hand-updating creates lockfile churn and conflicts against the bot's next run.

## Procedure

1. **Classify the update.** Routine (bot's job) · major/breaking · lockfile repair. A security
   fix is not one of them: hand it to [`security-updates`](../security-updates/SKILL.md).
   → You can say which one and why in a sentence.
2. **Work on a branch, one concern at a time.** A major upgrade and a security patch don't
   share a PR. For an existing bot PR, check it out and push fixes onto that branch rather
   than opening a rival — but read *Failing Renovate PR* below first, because pushing hands
   the branch to you. → Branch cut per [`task-tracking`](../task-tracking/SKILL.md).
3. **Apply the update with the right tool:**
   - npm: `npm install <pkg>@<version>` (or `@latest` for a deliberate major).
   - `@wordpress/*` packages move as a set — `npm run packages-update`, not one at a time.
   - Composer: `composer update <vendor>/<pkg> --with-all-dependencies`. Bare
     `composer update` re-resolves everything and buries the change.
   → Only the intended packages appear in the lockfile diff.
4. **Read what actually changed** for majors: the upstream changelog/migration notes, then
   grep the codebase for the removed or renamed APIs. → You can name every breaking change
   and where it hits this repo, or confirm none do.
5. **Verify.** Reinstall clean (`npm ci`, `composer install`), then run
   [`quality-gates`](../quality-gates/SKILL.md), then build. For WordPress projects also
   sanity-check the admin/front end when the change touches runtime code.
   → Gates green on a clean install, not just an incremental one.
6. **Hand off** to [`commit-and-release`](../commit-and-release/SKILL.md). A dependency
   change is `build(<TASK-KEY>): …` when it changes what ships, `chore(<TASK-KEY>): …` for
   dev tooling. Note breaking changes explicitly in the PR body.

## Special cases

- **Failing Renovate PR** — first check it isn't simply stale: a PR behind its base ran its
  checks against old code, so ask Renovate to rebase (the `rebase` label or the PR's rebase
  checkbox) and re-read them. Then reproduce locally on the bot's branch. Most failures are a
  peer-dependency conflict or a lint rule that moved; fix the code, push to the branch. **Once
  you push, the branch is yours** — Renovate stops rebasing it and stops moving it to newer
  versions — so push only when you will merge promptly. To hand it back, tick its entry under
  the Dependency Dashboard's *PR Edited (Blocked)* heading, which discards your commits; don't
  close it, because Renovate ignores a closed update. If the same check is red on other
  bot PRs too, the fault is on the base branch: fix it there and let Renovate rebase. Never
  push to a `renovate/*` branch from a workflow or bot; Renovate abandons the PR and the
  queue jams at its PR limit.
- **Conflicted Renovate PR** — `rebaseWhen: conflicted` means the bot rebases itself. Give
  it a chance before rebasing by hand; if you do rebase, regenerate the lockfile rather than
  resolving it line by line.
- **A Renovate `[SECURITY]` PR, a Dependabot PR, or an advisory** — stop and use
  [`security-updates`](../security-updates/SKILL.md). It owns how the fix is written, and a
  routine merge here would land a lockfile-only fix the standard rejects.
- **PHP or WordPress minimum bumps** — these are product decisions with support
  implications. Confirm with the user; never raise a floor as a side effect.
- **Holding an update that can't land yet** — add a `renovate.json` `packageRules` entry
  with `matchDepNames` and `allowedVersions` (`"<4.0.0"`), and a `description` that says
  why, what the bound was measured against, and when to revisit. A hold without its reason is
  lifted by the next person who doesn't know why it's there. `allowedVersions` cannot share a
  rule with `matchUpdateTypes` — Renovate rejects the pair. Lift holds that travel together
  (a tool and the plugin that pins it) in the same change.

## Guardrails

- **Never** run `npm audit fix --force` — it installs semver-major changes silently.
- **Never** hand-edit `package-lock.json` or `composer.lock`. Regenerate them with the tool.
- **Never** commit a lockfile you didn't produce from a clean install.
- **Never** add `--legacy-peer-deps`, `--force`, or `--ignore-platform-reqs` to make an
  install succeed without saying so — it hides a real incompatibility.
- **Never** raise `engines`, `require.php`, or the WordPress minimum without approval.
- **Never** bundle unrelated upgrades into one PR; a rollback then has to take back changes
  nobody wanted to revert.
- **Never** remove or rewrite an `overrides` or `conflict` entry as a side effect of an
  update. Each one is a security floor; its rules are
  [`security-updates`](../security-updates/SKILL.md)'s.
- Don't duplicate an update Renovate would automerge — check open bot PRs first.

## Done

- [ ] Update classified, and it's genuinely not Renovate's automerge job.
- [ ] Lockfile diff contains only the intended packages, regenerated by the tool.
- [ ] Breaking changes identified and either handled in code or confirmed non-applicable.
- [ ] Clean install (`npm ci` / `composer install`) followed by green quality gates and build.
- [ ] Version floors (Node, PHP, WordPress) unchanged, or changed with explicit approval.
- [ ] One concern per PR, with breaking changes called out in the body.
