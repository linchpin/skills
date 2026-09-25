---
name: dependency-updates
description: Update npm and Composer dependencies on a Linchpin project the way Renovate expects — handling the work Renovate can't automerge (majors, breaking changes, conflicted or failing bot PRs, security advisories in transitive dependencies, @wordpress package bumps). Use when a Renovate PR is failing, conflicted, or needs review, when asked to upgrade or bump packages, when a security advisory lands, when npm audit or Dependabot flags a sub-dependency nothing in package.json names, when deciding whether to add an override or resolution, or when a lockfile is out of sync. Not for fixing lint failures — use `quality-gates`. Not for draining the whole backlog — use `maintenance-window`.
when_to_use: Also when a Renovate PR is red or conflicted, when someone says "bump the packages" or "deps are out of date", when a security advisory lands, or when a lockfile is out of sync with its manifest.
version: 1.3.0
allowed-tools: Read Grep Glob Bash(npm audit) Bash(composer audit*) Bash(npm outdated*) Bash(composer outdated*) Bash(git status*) Bash(git diff*)
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
Working through the whole bot-PR backlog, or a `maintenance/YYYY-MM` window — the recurring
pass is [`maintenance-window`](../maintenance-window/SKILL.md), which hands each single update
back here.

## Owns

Canonical for: deciding whether an update is Renovate's job or yours, the manual upgrade
procedure, lockfile hygiene, and holding an update Renovate must not raise yet. The recurring
pass over the whole backlog is [`maintenance-window`](../maintenance-window/SKILL.md)'s.

## Preflight — read the automation first

| Look for | Tells you |
| --- | --- |
| `renovate.json` → `packageRules` | What automerges (typically minor/patch and all dev deps) — **don't hand-do those** |
| `renovate.json` → `ignoreDeps` | Packages deliberately pinned; upgrading one needs a reason |
| `renovate.json` → `rangeStrategy` | Whether manifest ranges get bumped (`bump`) or only the lockfile |
| `renovate.json` → `lockFileMaintenance` | The bot refreshes lockfiles on its own schedule |
| `package.json` → `overrides` / `resolutions` | Transitive packages already forced past a parent's range — each is a standing liability to re-check |
| Open Dependabot PRs touching **only** a lockfile | Duplicates of work `lockFileMaintenance` already does — see below before merging any |
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

## Transitive advisories — refresh first, override second

Most advisories on a Linchpin repo are **transitive**: the vulnerable package sits three
levels down and nothing in `package.json` names it. There are only two ways to move one, and
trying them out of order is what produces the endless bot PRs.

1. **Let the lock file refresh reach it** — this works whenever the parent's range already
   allows the patched version, which is most cases: Renovate's `lockFileMaintenance` on its
   schedule, `npm update --package-lock-only` locally. A lockfile-only PR can never do more,
   which is why Dependabot's security-update PRs are switched off on Renovate repos (the
   alerts stay on).
2. **Override the one package that is stuck** — only when a parent's range *pins* the
   vulnerable version. A scoped `overrides` entry that names the parent, as a range, verified
   with `npm ci` and `npm audit` in every workspace. Composer's equivalent is a root
   `conflict` entry.

The recipe, the Dependabot switch, the silent failure modes, and the measurements behind each
rule: [`references/transitive-advisories.md`](references/transitive-advisories.md).

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
- **Security advisory** — patch the specific package, verify the advisory is actually closed
  (`npm audit`, `composer audit`), and ship it on its own branch ahead of other work. If the
  vulnerable package is transitive, follow the section above before touching anything.
- **A Dependabot PR that only edits a lockfile** — check whether the target version is already
  in `main` (`npm ls <pkg>`) before doing anything with it. On a Renovate repo it usually is,
  and the PR should be closed rather than merged.
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
- **Never** add a bare top-level `override`/`resolution` for a transitive advisory — it
  rewrites every copy in the tree. Name the parent that is stuck.
- **Never** pin an override to an exact version; a range keeps Renovate able to move it.
- **Never** disable Dependabot *alerts* — only the security-update PR opener. The alerts are
  the feed Renovate reads.
- **Never** leave an override in place once the parent ships the fix; delete it and prove it
  with `npm audit`.
- Don't duplicate an update Renovate would automerge — check open bot PRs first.

## Done

- [ ] Update classified, and it's genuinely not Renovate's automerge job.
- [ ] Lockfile diff contains only the intended packages, regenerated by the tool.
- [ ] Breaking changes identified and either handled in code or confirmed non-applicable.
- [ ] Clean install (`npm ci` / `composer install`) followed by green quality gates and build.
- [ ] Version floors (Node, PHP, WordPress) unchanged, or changed with explicit approval.
- [ ] One concern per PR, with breaking changes called out in the body.
- [ ] Any transitive advisory was tried against a lockfile refresh **before** an override.
- [ ] Every override names the stuck parent, uses a range, and is verified with `npm ci` +
      `npm audit` in each workspace.
