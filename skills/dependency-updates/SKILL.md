---
name: dependency-updates
description: Update npm and Composer dependencies on a Linchpin project the way Renovate expects — handling the work Renovate can't automerge (majors, breaking changes, conflicted or failing bot PRs, security advisories, @wordpress package bumps). Use when a Renovate PR is failing, conflicted, or needs review, when asked to upgrade or bump packages, when a security advisory lands, or when a lockfile is out of sync. Not for fixing lint failures — use `quality-gates`.
version: 1.0.0
---

# Dependency updates

**Renovate already runs on every Linchpin repo**, and it automerges the boring updates —
patches, minors, and dev dependencies for both npm and Composer, grouped by manager. If you
run `npm update` by hand you are fighting a bot that will re-open the same change tomorrow.

Your job is the part Renovate deliberately leaves to a human: **majors, breakage, conflicts,
and urgency.**

## When to use

- A Renovate PR is failing CI, conflicted, or waiting on a judgment call.
- A major version bump is requested or required.
- A security advisory needs a fix now rather than on the bot's schedule.
- `@wordpress/*` packages need moving as a set.
- A lockfile is out of sync with its manifest.

**Not this skill:** lint/test failures unrelated to a version change — [`quality-gates`](../quality-gates/SKILL.md).
Committing and releasing the result — [`commit-and-release`](../commit-and-release/SKILL.md).

## Owns

Canonical for: deciding whether an update is Renovate's job or yours, the manual upgrade
procedure, and lockfile hygiene.

## Preflight — read the automation first

| Look for | Tells you |
| --- | --- |
| `renovate.json` → `packageRules` | What automerges (typically minor/patch and all dev deps) — **don't hand-do those** |
| `renovate.json` → `ignoreDeps` | Packages deliberately pinned; upgrading one needs a reason |
| `renovate.json` → `rangeStrategy` | Whether manifest ranges get bumped (`bump`) or only the lockfile |
| `renovate.json` → `lockFileMaintenance` | The bot refreshes lockfiles on its own schedule |
| Open PRs labelled `type: dependencies` | Work already in flight — extend it, don't duplicate it |
| `composer.json` / `package.json` `engines`, `require.php` | Floors you must not raise without approval |
| `.nvmrc`, CI matrix | The Node/PHP versions the update must keep working |

**Decision:** if `renovate.json` would automerge it, close your change and let the bot do it.
Hand-updating creates lockfile churn and conflicts against the bot's next run.

## Procedure

1. **Classify the update.** Routine (bot's job) · major/breaking · security · lockfile
   repair. → You can say which one and why in a sentence.
2. **Work on a branch, one concern at a time.** A major upgrade and a security patch don't
   share a PR. For an existing bot PR, check it out and push fixes onto that branch rather
   than opening a rival. → Branch cut per [`task-tracking`](../task-tracking/SKILL.md).
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

- **Failing Renovate PR** — reproduce locally on the bot's branch first. Most failures are a
  peer-dependency conflict or a lint rule that moved; fix the code, push to the branch.
- **Conflicted Renovate PR** — `rebaseWhen: conflicted` means the bot rebases itself. Give
  it a chance before rebasing by hand; if you do rebase, regenerate the lockfile rather than
  resolving it line by line.
- **Security advisory** — patch the specific package, verify the advisory is actually closed
  (`npm audit`, `composer audit`), and ship it on its own branch ahead of other work.
- **PHP or WordPress minimum bumps** — these are product decisions with support
  implications. Confirm with the user; never raise a floor as a side effect.

## Guardrails

- **Never** run `npm audit fix --force` — it installs semver-major changes silently.
- **Never** hand-edit `package-lock.json` or `composer.lock`. Regenerate them with the tool.
- **Never** commit a lockfile you didn't produce from a clean install.
- **Never** add `--legacy-peer-deps`, `--force`, or `--ignore-platform-reqs` to make an
  install succeed without saying so — it hides a real incompatibility.
- **Never** raise `engines`, `require.php`, or the WordPress minimum without approval.
- **Never** bundle unrelated upgrades into one PR; a rollback then has to take back changes
  nobody wanted to revert.
- Don't duplicate an update Renovate would automerge — check open bot PRs first.

## Done

- [ ] Update classified, and it's genuinely not Renovate's automerge job.
- [ ] Lockfile diff contains only the intended packages, regenerated by the tool.
- [ ] Breaking changes identified and either handled in code or confirmed non-applicable.
- [ ] Clean install (`npm ci` / `composer install`) followed by green quality gates and build.
- [ ] Version floors (Node, PHP, WordPress) unchanged, or changed with explicit approval.
- [ ] One concern per PR, with breaking changes called out in the body.
