---
name: quality-gates
description: Run a Linchpin project's own lint, coding-standards, static-analysis, and test gates before committing or opening a PR — detecting the toolchain from composer.json, package.json, phpcs.xml.dist and lint-staged rather than assuming it. Use when preparing to commit, when asked "is this ready to commit/ship", when CI lint or PHPCS is failing, when a pre-commit hook blocks you, or when a repo is missing the standard lint scripts. Not for writing the commit message — use `commit-and-release`.
version: 1.0.0
---

# Quality gates

Every Linchpin repo already declares how it wants to be checked — in `composer.json`
scripts, `package.json` scripts, `phpcs.xml.dist`, `lint-staged.config.js`. Your job is to
**find those declarations and run them**, not to invent commands. Getting this right is
what makes the difference between a clean PR and a red CI run.

The gates are the same ones CI runs, so passing here means passing there.

## When to use

- About to commit or open a PR.
- The user asks whether a change is ready to ship.
- CI lint / PHPCS / PHPStan failed and you need to reproduce and fix it locally.
- A husky pre-commit hook is blocking a commit.
- A repo is missing the house lint scripts and should get them.

**Not this skill:** the commit message, branch, or release — [`commit-and-release`](../commit-and-release/SKILL.md).
Upgrading packages — [`dependency-updates`](../dependency-updates/SKILL.md).

## Owns

Canonical for: which gates exist, how to detect them, the order they run in, and how to fix
failures without suppressing them. Skills that end in a commit defer here for verification.

## Preflight — detect, never assume

Read these before running anything. Our repos genuinely differ: PHP-heavy plugin repos,
`wp-content`-shaped site repos with nested builds, and JS/TS Workers projects all live under
the same conventions but expose different gates.

| Look for | Tells you | If missing |
| --- | --- | --- |
| `composer.json` → `scripts.lint` | The canonical PHP gate: `composer run lint` | Run the individual tools below that do exist |
| `phpcs.xml.dist` or `phpcs.xml` | Coding standards are configured → PHPCS applies | **Skip PHPCS and say so** — never invent a standard |
| `phpstan.neon(.dist)` | Static analysis applies | Skip; don't add it unprompted |
| `.php-cs-fixer.dist.php` | PHP-CS-Fixer applies (`composer run fixer`) | Skip |
| `package.json` → `scripts` | JS/CSS gates (`lint:js`, `lint:css`, `format`, `lint:check`) | Fall back to `eslint`/`prettier` only if configured |
| `lint-staged.config.js` + `.husky/` | Pre-commit is already wired — **mirror those exact commands** | Run the scripts directly |
| Nested `package.json` (e.g. `themes/*`, `plugins/*`, `src/`) | Gates run **in that workspace**, not the root | Root only |
| `.linchpin.json` | Project metadata and local environments | Not every repo has one |

Full command matrix: [`references/toolchain.md`](references/toolchain.md).

## Procedure

1. **Scope to what changed.** Staged: `git diff --name-only --cached --diff-filter=ACMR`.
   Whole branch: diff against the merge base with `main`. Split into PHP, JS/TS, CSS/SCSS,
   and config buckets. → You can name every changed file and which gate covers it.
2. **PHP gate** (any `.php` changed). Prefer `composer run lint`. If absent, run only the
   tools whose config exists: `composer run phpcs`, `composer run phpstan`,
   `composer run fixer:test`. → Each command exits 0, or you have the exact violations.
3. **JS / CSS gate** (any `.js`/`.ts`/`.css`/`.scss` changed). Prefer `npm run lint:check`
   when defined; otherwise `npm run lint:js` and `npm run lint:css`. Run them in the
   workspace that owns the file. → Exit 0 or a concrete rule violation list.
4. **Tests** when the change touches covered code: `composer run phpunit`, `npm run test:unit`.
   E2E (`npm run test:e2e`) only when asked or when the change is UI-facing — it needs a
   running environment. → Green, or a named failing test.
5. **Fix, don't silence.** Auto-fixers first (`composer run phpcbf`, `composer run fixer`,
   `npm run format`), then re-run the gate; hand-fix what remains. → Gate passes with the
   fix in the code, not in the config.
6. **Report gaps, then hand off.** State which gates ran, which were skipped and why. If the
   repo lacks a house script, propose it (see `references/toolchain.md`) and add it **only
   with approval**. → Then go to [`commit-and-release`](../commit-and-release/SKILL.md).

## Guardrails

- **Never** commit with `--no-verify`. The hook is the gate; if it blocks you, fix the code.
- **Never** silence a violation to make a gate pass — no widening `phpcs.xml.dist` excludes,
  no new `phpcs:ignore` / `phpcs:disable` / `eslint-disable` / `@phpstan-ignore` without a
  stated reason the user accepted, no editing a PHPStan baseline to hide a new error.
- **Never** reformat files the change didn't touch. A formatting-only diff across the repo
  buries the actual change and blows up review.
- **Never** run `composer update` or `npm update` to fix a lint failure — that's a
  dependency change ([`dependency-updates`](../dependency-updates/SKILL.md)), not a fix.
- **Never** commit `vendor/`, `node_modules/`, or build output unless the repo already
  tracks it — check `.gitignore` and `.distignore` first.
- If a tool can't run (not installed, no config, requires Docker that isn't up), **say so
  explicitly**. A silently skipped gate reads as a passing gate.

## Done

- [ ] Every changed file is covered by a gate that ran, or is explicitly reported as uncovered.
- [ ] PHP gate passed (or is correctly not applicable — no `phpcs.xml.dist`, no PHP changed).
- [ ] JS/CSS gate passed in the owning workspace (or correctly not applicable).
- [ ] Tests run for touched, covered code.
- [ ] No suppressions, config widenings, or `--no-verify` were used to get green.
- [ ] Skipped gates and missing house scripts are named in the report.
