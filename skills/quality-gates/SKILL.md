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

The gates are the same ones CI runs, so passing here almost always means passing there.
Almost: see [Green locally, red in CI](#green-locally-red-in-ci) for the one way the
shared lint workflow disagrees with a clean local run, which is not a difference in what
is checked but in what counts as a failure.

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

## Green locally, red in CI

The shared lint workflow (`linchpin/actions`) runs the same phpcs you do, and then does
two things to the result that your terminal does not.

**It sniffs only the files the PR changed.** `git diff --diff-filter=ACMRT <base>...HEAD`,
which means **you inherit the debt of every file you touch**. A file carrying violations
nobody has cleaned up becomes your problem the moment you edit one line of it.

**It pipes the report through `cs2pr`, and `cs2pr` fails on warnings.** This is the part
that surprises people:

```bash
phpcs -q --runtime-set ignore_warnings_on_exit 1 --report=checkstyle "${files[@]}" | cs2pr
```

`ignore_warnings_on_exit` does exactly what it says — **phpcs itself exits 0** on a
warnings-only run. But the checkstyle report still lists every warning as
`<error severity="warning">`, `cs2pr` turns each into an annotation and exits non-zero
when there is one, and the step runs under `set -e` with the pipeline's exit code being
the last command's. So `composer lint` is green, `phpcs` on its own is green, and the job
is red.

Put together: **one unfixed warning in a file makes every future PR that touches it red on
arrival.** Seen twice on linchpin.com — `PSR1.Files.SideEffects` on the standard
`defined( 'ABSPATH' ) || exit;` guard (which cost a PR merged red), and
`WordPress.WP.Capabilities.Unknown` on two custom capabilities.

Check the same thing CI checks — the count of annotations, warnings included, over the
files the PR changed:

```bash
git diff --name-only --diff-filter=ACMRT "$(git merge-base HEAD origin/main)"...HEAD -- '*.php' \
  | tr '\n' '\0' | xargs -0 vendor/bin/phpcs -q --report=checkstyle \
  | grep -c 'severity='
```

Zero means the job will pass. Any other number is what CI will annotate, whether phpcs
called them errors or not. (Piped through `xargs -0` rather than an unquoted `$files`
because zsh does not word-split, so the obvious version passes phpcs one long filename
and reports a file that does not exist.)

Fixing it is the same rule as everywhere else in this skill — **fix the warning, do not
silence the sniff.** Most are legitimately configuration rather than code: a custom
capability belongs in `custom_capabilities` in `phpcs.xml.dist`, a text domain in
`text_domain`. Register the real value and say in a comment where it comes from; a typo
registered there hides exactly the bug the sniff exists to catch. Setting the sniff to
`<severity>0</severity>` is the last resort, not the first.

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
- [ ] The changed-file annotation count is zero — warnings included, not just errors.
- [ ] No suppressions, config widenings, or `--no-verify` were used to get green.
- [ ] Skipped gates and missing house scripts are named in the report.
