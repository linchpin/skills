# Workflow callers and their contracts

The caller YAML a Linchpin plugin repo should contain, and **the obligation each reusable
places on the caller**. That obligation is the load-bearing content here.

**This file deliberately contains no input tables.** Input semantics live in the
[`linchpin/actions` README](https://github.com/linchpin/actions), which ships with the
workflows and is versioned alongside them. A copy here would outlive the version it
described — which is exactly how `@v3` documentation survived into a `v4` world.

Current line: **`@v4`** (floating major tag; `v4.10.1` at the time of writing).
`linchpin/actions` v3 has no `php-checks.yml`, no `plugin-check.yml` and no
`wp-version-checker.yml` — a plugin repo pinned there has nothing to call.

## `php-checks.yml@v4` — the PHP gate

```yaml
jobs:
  php:
    if: >-
      !startsWith(github.head_ref || github.ref_name, 'release-please--')
    uses: linchpin/actions/.github/workflows/php-checks.yml@v4
    secrets: inherit
    with:
      php_version: '8.2'
      php_extra_version: '8.4'      # second runtime for the suite; empty runs it once
      php_extensions: 'dom, libxml, mbstring'
      setup_command: composer install-wp-core
      composer_scripts: fixer:test
```

**Contract.** The caller's `composer.json` must define:

- `php-lint` — invoked as `composer php-lint -- --checkstyle | cs2pr`
- `phpstan` — when `run_phpstan` is on (it defaults **on**)
- `check-branch-cs` — invoked as `composer check-branch-cs -- "origin/$BASE_REF"`, and it
  must write `./phpcs-report.xml`

A repo missing any of these fails at startup with *"Script … is not defined"*. **Check this
before recommending the workflow** — adding the caller first turns CI red on arrival, which
is how a conformance PR gets reverted.

PHPCS runs on **pull requests only**, because it diffs the base branch. The
`release-please--` guard tests the *branch*, not `github.actor`: `head_ref` is empty on push,
where `ref_name` takes over, and `actor` becomes whoever clicked a re-run.

Repo-specific checks stay in the caller as their own job. Not everything is worth an input —
`mantle` keeps a grep for silently-ignored REST arg keys next to its `php` job rather than
pushing it upstream, and that is the right call.

## `plugin-check.yml@v4` — WordPress Plugin Check

```yaml
jobs:
  plugin-check:
    uses: linchpin/actions/.github/workflows/plugin-check.yml@v4
    secrets: inherit
    with:
      build_dir: ./build/<slug>
      build_command: |
        npm ci
        npm run build
        bash scripts/build.sh
      exclude_directories: vendor,third-party
```

**Contract.** A build that actually produces a distributable at `build_dir`.
`build_command` defaults to `bash scripts/build.sh`, so a repo without that script cannot
call this workflow whatever its inputs say.

Node resolves as `node_version` → the caller's `.nvmrc` → `lts/*`, and **setup is skipped
entirely without a `package-lock.json`**, because `cache: npm` fails outright without one.

`exclude_checks` takes check **names**; `ignore_codes` takes the **codes** a check emits.
Neither errors on the wrong kind — `mantle` carried codes in `exclude_checks` for a while,
which silently excluded nothing and then failed a release. Which values belong there is
[`quality-gates`](../../quality-gates/SKILL.md)'s call, not this skill's.

This workflow deliberately declares no `concurrency`: invoked via `workflow_call`,
`github.workflow` resolves to the *caller's* name, so a group defined here would deadlock
against the caller's own.

## `wp-version-checker.yml@v4` — the `Tested up to` guard

```yaml
on:
  schedule:
    - cron: '0 6 * * 1'
  workflow_dispatch:

jobs:
  wp-version-checker:
    uses: linchpin/actions/.github/workflows/wp-version-checker.yml@v4
```

**Contract.** A `Tested up to` header to check. No inputs and no secrets; the action reads
`wordpress-version-checker.json` (or the same key in `composer.json`/`package.json`) from the
caller.

Cron only, on purpose: a push trigger fired ~46 extra times in 8 days to re-check the same
header.

## `update-readme.yml@v4` — release bookkeeping

Called from `release-please.yml`. Re-syncs `composer.lock`, regenerates the README
plugin/theme table, opens a PR against the release-please branch and squash-merges it.

**Contract.** A `GH_BOT_TOKEN` secret — it is the one required secret among these — and a
README table for it to regenerate. A plugin with no bundled plugin/theme table has nothing for
this to do; that is a legitimate reason not to call it, and should be recorded rather than
reported as a gap.

## `check-overrides.yml@v4` — npm `overrides` hygiene

Worth calling only where `package.json` actually declares `overrides`. It reports redundant
and dangling pins and never fails by default.

## Not reusable — do not try to call these

`linchpin/actions` also contains `ci.yml`, `release.yml`, `composer-bump.yml` and
`sync-docs.yml`. **None of them declare `workflow_call`** — they are that repo's own
workflows. In particular:

- **`sync-docs.yml` is not a reusable workflow.** A plugin repo's `sync-docs.yml` is a
  locally-committed workflow that calls the `linchpin/docspress` action. It is owned by
  [`docspress-publish`](../../docspress-publish/SKILL.md) and is **not** a Group 4 conformance
  row.
- `lint.yml` and `build.yml` *are* reusable but are the **site** shape —
  `wp-content`-repo-wide, no test suite. `lint.yml` does not fit a plugin; `php-checks.yml` is
  the plugin shape. Recommending `lint.yml` to a plugin repo is a real and easy mistake.

## Known gaps — hand-roll these, and do not report them as failures

Nothing in `linchpin/actions` covers the following today. A repo that hand-rolls one of them
is **conformant**; note it as context, never as a finding, or every report grows a permanent
red row nobody can close.

| Gap | What repos do instead |
| --- | --- |
| WordPress.org SVN deploy | Hand-rolled `10up/action-wordpress-plugin-deploy` + `…-asset-update` |
| Standalone-plugin build/zip | The caller's own `bash scripts/build.sh` |
| JS lint / Jest / Playwright | A hand-rolled `js.yml` or `lint-js.yml` per repo |
| A consumer-facing release-please workflow | Each caller carries its own |
| Packagist / npm publish | Per-repo |

If one of these is being *added* to `linchpin/actions`, that is a change to the pipeline, not
a conformance fix — it belongs in a task against that repo.

## Reference implementations

Read the current shape rather than trusting this file's snapshot:

```bash
gh search code --owner linchpin "php-checks.yml@v4" --limit 20
```

- **`linchpin/mantle`** — the fullest v4 adopter: `php-checks`, `plugin-check`,
  `wp-version-checker`, `update-readme`, all at `@v4`. Self-hosted channel, so it is also the
  reference for the updater exclusions.
- **`linchpin/block-alchemy`** — the cleanest modern repo *shape*, though it still carries a
  local `plugin-check.yml` rather than calling the reusable, which makes it a live example of
  the C-5 anti-pattern rather than a model for it.
