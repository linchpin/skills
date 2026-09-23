---
title: quality-gates
---

Every Linchpin repo already declares how it wants to be checked — in `composer.json` scripts, `package.json` scripts, `phpcs.xml.dist`, `lint-staged.config.js`. The job is to find those declarations and run them, not to invent commands. Getting this right is the difference between a clean PR and a red CI run.

## When to reach for it

- About to commit or open a PR.
- The user asks whether a change is ready to ship.
- CI lint / PHPCS / PHPStan failed and you need to reproduce and fix it locally.
- A husky pre-commit hook is blocking a commit.
- A plugin is heading for WordPress.org, packagist.linchpin.com, or a release.
- A repo is missing the house lint scripts and should get them.

Things you might say that load it: "is this ready to commit", "did lint pass", "PHPCS is failing in CI", "the pre-commit hook is blocking me", "does this plugin pass Plugin Check".

## Where it stops

> **Not this skill:** the commit message, branch, or release — [`commit-and-release`](commit-and-release.md). Upgrading packages — [`dependency-updates`](dependency-updates.md). Whether the repo is wired for these gates at all — the composer scripts the shared workflows require, the Plugin Check caller and its build script, `phpcs.xml.dist` versus `phpcs.xml` — [`wp-plugin-standards`](wp-plugin-standards.md). That skill says the gate must exist; this one runs it.

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Scope to what changed","content":"<p>Diff staged files, or the whole branch against the merge base with <code>main</code>, and sort them into PHP, JS/TS, CSS/SCSS, and config buckets.</p>"},{"title":"Run the PHP gate","content":"<p>Prefer the repo's own <code>composer run lint</code>; otherwise run only the tools whose config file actually exists — PHPCS, PHPStan, PHP-CS-Fixer.</p>"},{"title":"Run the JS/CSS gate","content":"<p>Prefer <code>npm run lint:check</code> where defined, run in the workspace that owns the changed file.</p>"},{"title":"Run tests","content":"<p>Unit tests for touched, covered code; E2E only when asked or the change is UI-facing, since it needs a running environment.</p>"},{"title":"Fix, don't silence","content":"<p>Run auto-fixers first, then re-run the gate and hand-fix what remains — the fix lands in the code, never in the config.</p>"},{"title":"Run Plugin Check","content":"<p>Distributed plugins only. It builds the distributable and boots WordPress, so run it before opening the PR rather than on every commit, and treat any finding — warnings included — as a failure.</p>"},{"title":"Report gaps, then hand off","content":"<p>State which gates ran and which were skipped and why, propose any missing house script with approval, then move to commit-and-release.</p>"}]} /-->

## What it checks first

Before running anything, it reads what the repo has declared rather than assuming a standard toolchain — PHP-heavy plugin repos, `wp-content`-shaped site repos, and JS/TS Workers projects all expose different gates.

| Reads | Tells you |
| --- | --- |
| `composer.json` → `scripts.lint` | The canonical PHP gate |
| `phpcs.xml.dist` / `phpcs.xml` | Whether coding standards apply — never invent a standard if absent |
| `phpstan.neon(.dist)` | Whether static analysis applies |
| `package.json` → `scripts` | The JS/CSS gates |
| `lint-staged.config.js` + `.husky/` | The exact pre-commit commands to mirror |
| Nested `package.json` | Which workspace actually owns the gate |
| A plugin header plus `readme.txt` or a Plugin Check workflow | Whether Plugin Check applies |
| `.linchpin.json` | Project metadata and local environments |

## What it owns

Canonical for: which gates exist, how to detect them, the order they run in, and how to fix failures without suppressing them. Skills that end in a commit defer here for verification. It defers whether a repo declares the right gates and wires them to the shared workflows to [`wp-plugin-standards`](wp-plugin-standards.md).

## Guardrails

- Never commit with `--no-verify`. The hook is the gate; if it blocks you, fix the code.
- Never silence a violation to make a gate pass — no widening excludes, no new suppression comment without a stated reason the user accepted, no editing a PHPStan baseline to hide a new error.
- Never reformat files the change didn't touch.
- Never run `composer update` or `npm update` to fix a lint failure — that's a dependency change, not a fix.
- Never commit `vendor/`, `node_modules/`, or build output unless the repo already tracks it.
- Never read a green Plugin Check tick on a PR as a passing Plugin Check — it fails the job on errors only, not warnings.
- Never assume `composer phpcs` covers Plugin Check — it ships its own sniffs the Linchpin standard can't reference.
- If a tool can't run, say so explicitly. A silently skipped gate reads as a passing gate.

## Done when

- [ ] Every changed file is covered by a gate that ran, or is explicitly reported as uncovered.
- [ ] PHP gate passed (or is correctly not applicable).
- [ ] JS/CSS gate passed in the owning workspace (or correctly not applicable).
- [ ] Tests run for touched, covered code.
- [ ] The changed-file annotation count is zero — warnings included, not just errors.
- [ ] For a distributed plugin: Plugin Check run locally with zero findings, warnings included.
- [ ] No suppressions, config widenings, or `--no-verify` were used to get green.
- [ ] Skipped gates and missing house scripts are named in the report.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/quality-gates/SKILL.md) is the skill's main instructions.
- [`references/toolchain.md`](https://github.com/linchpin/skills/blob/main/skills/quality-gates/references/toolchain.md) — the command matrix for PHP, JS/CSS, pre-commit hooks, Plugin Check, and detecting the local environment.

Pre-approved, so the agent can run them without a prompt: reading and searching files, the composer `lint`/`phpcs`/`phpstan`/`phpunit`/`plugin-check`/`fixer:test` scripts, the npm `lint:check`/`lint:css`/`lint:js`/`test:unit`/`test:e2e` scripts, and `git diff`/`status`/`merge-base`. Anything that writes or installs still asks.

## Related skills

- [`commit-and-release`](commit-and-release.md) — owns the commit message, branch, and release once the gates are green.
- [`dependency-updates`](dependency-updates.md) — owns upgrading packages, which this skill never does to fix a lint failure.
- [`wp-plugin-standards`](wp-plugin-standards.md) — owns whether a repo is wired for these gates at all.
