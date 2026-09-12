# Conformance checklist

One row per artifact. Four verdicts only: **present** / **missing** / **wrong-shape** /
**not-applicable (channel)**. Severity is `Blocking` (CI or a release cannot work),
`Standard` (the house shape, and its absence costs something concrete), `Drift` (real but
low-cost inconsistency).

"Owner" is the skill whose value governs the row. This file owns that the row *exists* —
never copy the owner's value here.

## Group 1 — Plugin identity

Audited against the single root `.php` file carrying `Plugin Name:`.

**Anchor every grep on the colon.** `grep 'License'` matches `License URI` and will report a
field the plugin does not have. Use `^\s*\*\s*License:`.

| Field | Required | Severity | Why it exists |
| --- | --- | --- | --- |
| `Plugin Name` | always | Blocking | Without it WordPress does not see a plugin |
| `Plugin URI` | always | Standard | Where a user goes for the canonical page |
| `Description` | always | Standard | Shown in the plugins list |
| `Version` | always | Blocking | release-please and every updater key off it |
| `Author`, `Author URI` | always | Drift | Attribution |
| `Text Domain` | always | Blocking | Must equal the slug, or translations silently never load |
| `Domain Path` | when it ships `languages/` | Standard | WordPress looks in `/languages` only if told |
| `License`, `License URI` | always | Standard | wp.org rejects without it; GPL compatibility is a real claim |
| `Requires at least` | always | Standard | WordPress refuses to activate below it — the guard against a fatal |
| `Requires PHP` | always | Blocking | Without it WordPress will happily activate on a PHP that fatals |
| `Tested up to` | always | Standard | `wp-version-checker.yml@v4` has nothing to check without it |
| `Update URI` | **self-hosted only** | Blocking (2B) / **Forbidden** (2A) | wp.org forbids a hosted plugin shipping its own updater |
| `Requires Plugins` | when it hard-depends on another plugin | Blocking | Without it WordPress activates against a missing dependency and white-screens |

`Requires Plugins` is the one row that is not fully mechanical: cross-check it against
top-level `class_exists`/`function_exists` calls on a foreign prefix, and against the
plugin's own documentation. Report it as *assisted*, not asserted.

## Group 2 — PHP toolchain

| # | Row | Detect | Severity | Owner |
| --- | --- | --- | --- | --- |
| P-1 | `php-lint`, `phpstan`, `check-branch-cs` in `composer.json` `scripts` | `jq -r '.scripts \| keys[]' composer.json` | **Blocking** | this skill — they exist only as CI caller contracts |
| P-2 | House script shape: `fixer`, `fixer:test`, `phpcs`, `phpcbf`, `phpunit`, aggregate `lint` and `test` | same | Standard | [`quality-gates`](../../quality-gates/SKILL.md) |
| P-3 | `check_branch_cs` writes `./phpcs-report.xml` and scopes to changed **lines** | read `dev/Composer/Actions.php` | Standard | this skill |
| P-4 | `linchpin/coding-standards` in `require-dev` | `jq -e '.["require-dev"]["linchpin/coding-standards"]'` | Standard | [`quality-gates`](../../quality-gates/SKILL.md) |
| P-5 | `phpcs.xml.dist`, and no bare `phpcs.xml` beside it | `test -f phpcs.xml.dist && ! test -f phpcs.xml` | Standard | [`quality-gates`](../../quality-gates/SKILL.md) |
| P-6 | `phpstan.neon(.dist)` when `run_phpstan` is on | `test -f phpstan.neon*` | Standard | [`quality-gates`](../../quality-gates/SKILL.md) |
| P-7 | `phpunit.xml` **and** a real `tests/` — or an explicit `run_phpunit: false` in the caller | both | Standard | [`quality-gates`](../../quality-gates/SKILL.md) |

**P-1 is the prerequisite row for the whole of Group 4.** `php-checks.yml@v4` runs
`composer php-lint` and `composer check-branch-cs` directly; a repo missing them fails at
startup with *"Script php-lint is not defined"*, before a single check runs.

**P-3 matters more than it looks.** A `check_branch_cs` that scopes to changed *files* rather
than changed *lines* reports inherited debt against whoever touched the file — which is how a
red check becomes something people scroll past, and then switch off.

**P-7's failure mode is asymmetric.** `php-checks.yml@v4` defaults `run_phpunit: true` and
runs `vendor/bin/phpunit` directly, so a repo with a `phpunit.xml` pointing at a `tests/`
directory that does not exist **fails CI**, while a repo that sets `run_phpunit: false` has no
tests and looks green. Both are findings; they are different findings. A blanket
"backfill tests everywhere" sweep is not what this row asks for — an explicit
`run_phpunit: false` converts a silent gap into a visible decision, which is the conformant
state until someone scopes the test work.

## Group 3 — JS toolchain

| # | Row | Detect | Severity |
| --- | --- | --- | --- |
| J-1 | `package-lock.json` committed when the plugin builds assets | `test -f package-lock.json` | Blocking — without it CI skips Node setup entirely |
| J-2 | `.nvmrc`, and no hardcoded `node-version:` in any workflow | `test -f .nvmrc`; `grep -rc "node-version: *'\?[0-9]" .github/workflows` | Standard |
| J-3 | `lint:js` / `lint:css` / `build` npm scripts | `jq -r '.scripts \| keys[]' package.json` | Standard |

J-2 is worth stating plainly because the drift is measurable: four repos, four pinned Node
versions, none of them read from a file.

## Group 4 — CI callers

See [`workflow-callers.md`](workflow-callers.md) for the caller YAML and each one's contract.

| # | Row | Severity |
| --- | --- | --- |
| C-1 | `php.yml` calls `php-checks.yml@v4` | Blocking |
| C-2 | `plugin-check.yml` calls `plugin-check.yml@v4` | Standard |
| C-3 | `wp-version-checker.yml` calls `wp-version-checker.yml@v4`, cron-triggered | Standard |
| C-4 | `release-please.yml` calls `update-readme.yml@v4` where a composer.lock table exists | Standard |
| C-5 | **No repo-local file reimplementing a v4 reusable** | **Blocking** |
| C-6 | No legacy split workflows — `phpcs.yml`, `phpcbf.yml`, `phplint.yml`, `wiki.yml` | Standard |
| C-7 | Every `linchpin/actions` `uses:` pinned `@v4` | Blocking |
| C-8 | Every third-party `uses:` tagged or SHA-pinned, never `@master`/`@main` | Standard |

**C-5 is the highest-severity row in the audit** and the reason this skill exists. A
repo-local `plugin-check.yml`, `wp-version-checker.yml` or `override-check.yml` looks
identical to a conforming one in every file listing, passes CI, and never receives a fix made
upstream. Flag it at the top of the report, above everything else.

**C-6's `phpcbf.yml` is a special case.** v4 removed auto-fixing from CI deliberately — it
belongs in a pre-commit hook. Deleting `phpcbf.yml` without adding that hook means the repo
now auto-fixes nowhere, so C-6 and M-5 are one finding, not two.

## Group 5 — Build and distribution

| # | Row | Detect | Severity |
| --- | --- | --- | --- |
| B-1 | `.distignore` | `test -f .distignore` | Blocking — without it dev files ship |
| B-2 | A `build.sh` build script and `"build": "bash scripts/build.sh"` | both | Blocking when `plugin-check.yml@v4` is called — it defaults `build_command` to exactly this |
| B-3 | `.editorconfig` | `test -f .editorconfig` | Drift |

## Group 6 — Metadata and release

| # | Row | Detect | Severity | Owner |
| --- | --- | --- | --- | --- |
| M-1 | `.linchpin.json` with `wordpress.pluginSlug` matching the main file basename | `jq -e '.wordpress.pluginSlug'` | Standard | [`project-context`](../../project-context/SKILL.md) |
| M-2 | release-please config and manifest, with `extra-files` covering the main file and `readme.txt` | `jq` the config | Blocking | [`commit-and-release`](../../commit-and-release/SKILL.md) |
| M-3 | Version markers in the main file (`x-release-please-*`) | `grep -c` | Blocking | [`commit-and-release`](../../commit-and-release/SKILL.md) |
| M-4 | `commitlint.config.js` extending `@linchpinagency/commitlint-config`, plus `.husky/commit-msg` | `grep` | Standard | [`commit-and-release`](../../commit-and-release/SKILL.md) |
| M-5 | `.husky/pre-commit` **and** lint-staged | both | Standard | [`quality-gates`](../../quality-gates/SKILL.md) |
| M-6 | `renovate.json` on the org preset `github>linchpin/renovatebot-config` | `jq -r '.extends[]'` | Standard | [`dependency-updates`](../../dependency-updates/SKILL.md) |
| M-7 | `docs/` **and** a `sync-docs.yml` | both | Standard | [`docspress-publish`](../../docspress-publish/SKILL.md) |

**M-6 has two failure shapes, not one.** `config:base` is deprecated and should be reported
as wrong-shape. But a bare `config:recommended` is *also* non-conforming — the org preset adds
lock-file maintenance, grouping, labels and `ignoreDeps` that a bare preset never delivers.
Report both, at different severities: deprecated is Standard, bare-but-current is Drift.

**M-7 is about publishing, not authoring.** `docs/` alone means documentation exists in the
repo and nowhere else. The `sync-docs.yml` is what makes it reach docs.linchpin.com — and it
is a locally-committed workflow calling `linchpin/docspress`, **not** a `linchpin/actions`
reusable. Do not report it under Group 4.

## Channel exemptions

Exactly one channel applies. Establish it in Preflight. **An inapplicable row is omitted from
the report, never reported as passing** — a report that fails eight repos on rows that do not
apply to them gets ignored within a week.

### 2A — WordPress.org

Adds:

| Row | Severity |
| --- | --- |
| `readme.txt` with `== Description ==`, `== Changelog ==`, `== Upgrade Notice ==` | Blocking |
| `Stable tag` in `readme.txt` equals the released version | Blocking |
| `Tested up to` in `readme.txt` agrees with the plugin header | Standard |
| `.wordpress-org/` assets — banner, icon, at least one screenshot | Standard |
| `x-release-please-*` marker lines stripped before SVN, or they render as literal text on the listing | Blocking |
| An SVN deploy on `release: published`, and an asset/readme update on push to `main` | Blocking |
| `SVN_USERNAME` / `SVN_PASSWORD` repository secrets exist | Blocking |
| Plugin Check includes the `plugin_repo` category | Standard |

Waives — in fact **forbids** — `Update URI` and any bundled update checker.

### 2B — Self-hosted / self-updating

Adds `Update URI`, and a Plugin Check caller that excludes the updater findings **by name and
by code** — `exclude_checks` takes check *names*, `ignore_codes` takes the *codes* a check
emits, and neither errors on the wrong kind. Removes `plugin_repo` from the categories; it can
never apply. Waives `readme.txt` and the whole of 2A.

Excluding the updater findings here is correct rather than convenient: they exist because
wp.org forbids a plugin hosted *there* from shipping its own update checker. A self-hosted
plugin is not hosted there and deliberately ships one.

### 2C — Private (packagist.linchpin.com / SatisPress) and internal-only

Waives all of 2A and 2B. Still bound by every row in Groups 1–6 — internal is not a licence to
skip lint, tests, or release-please. Add one row: the repo is **private**
(`gh api repos/linchpin/<repo> --jq .visibility`), because an internal client functionality
plugin in a public repo is a disclosure.

If a `readme.txt` exists anyway, it must not carry a `Stable tag` — a stale one reads as a
wp.org claim that was never true.

## Rows whose conforming state is *absent*

These exist so nobody re-adds them "for consistency".

| Row | Conforming | Why |
| --- | --- | --- |
| `Dockerfile` | **absent** | No Linchpin plugin repo has one and none needs one. `.wp-env.json` covers local; hosted runners cover CI |
| `.gitattributes` | **absent**, or only `* text=auto eol=lf` | `export-ignore` affects `git archive`, which nothing in the pipeline runs. It is a second exclusion list that must be kept in sync with `.distignore` for no benefit |
| `phpcbf` in CI | **absent** | v4 removed it deliberately. It belongs in the pre-commit hook (M-5) |

## Report template

```
wp-plugin-standards — linchpin/<repo> @ <sha>
Channel: <wordpress-org | self-hosted | private> (<declared | inferred from X>)

FLAGGED FIRST
  C-5  Local .github/workflows/plugin-check.yml reimplements plugin-check.yml@v4
       → delete the body, call the reusable with build_dir and build_command

BLOCKING   n
  P-1  composer.json defines none of php-lint, phpstan, check-branch-cs
       → php-checks.yml@v4 cannot be called until these exist

STANDARD   n
DRIFT      n

NOT APPLICABLE (channel: private)
  readme.txt, Stable tag, .wordpress-org/, SVN deploy, Update URI

Next: <exactly one skill>
```

Two rules keep the report trusted: **an inapplicable row is omitted, never reported as
passing**, and **the report sequences nothing**. Ordering is
[`wp-plugin-modernization`](../../wp-plugin-modernization/SKILL.md)'s job, and a conformance
report that also proposes an order is two documents disagreeing with each other.
