# Toolchain reference

The commands Linchpin projects actually expose, and what to do when they're missing.
**Run what the repo declares.** This file is a lookup table, not a script to run top to
bottom.

## PHP

| Intent | Command | Requires |
| --- | --- | --- |
| Everything | `composer run lint` | `scripts.lint` in `composer.json` |
| Syntax only | `composer run php-lint` | `php-parallel-lint` |
| Coding standards | `composer run phpcs` (or `phpcs --standard=phpcs.xml.dist`) | `phpcs.xml.dist` |
| Auto-fix standards | `composer run phpcbf` | same |
| Formatting check | `composer run fixer:test` | `.php-cs-fixer.dist.php` |
| Auto-fix formatting | `composer run fixer` | same |
| Static analysis | `composer run phpstan` | `phpstan.neon(.dist)` |
| Unit tests | `composer run phpunit` | `phpunit.xml(.dist)` |
| Lint + tests | `composer run test` | both |

The house `scripts.lint` composes `php-lint` → `phpcs` → `fixer:test` → `phpstan`, in that
order — cheapest failure first. Reproduce that order when running tools individually.

**PHPCS with no `phpcs.xml.dist`:** skip it and report it. Do not fall back to a global
standard — the result won't match CI, and a WordPress-standard run against a non-WordPress
codebase produces hundreds of meaningless violations.

**PHPStan baselines:** `phpstan-baseline.neon` records accepted debt. New errors go in the
code's fix, never in the baseline, unless the user explicitly asks to re-baseline.

## JavaScript / CSS

| Intent | Command | Notes |
| --- | --- | --- |
| Pre-commit equivalent | `npm run lint:check` | Where defined, this is `format` + `lint:js` |
| JS/TS | `npm run lint:js` | `wp-scripts lint-js` on WordPress projects |
| CSS/SCSS | `npm run lint:css` | `wp-scripts lint-style` |
| Format | `npm run format` | Prettier via `wp-scripts format` |
| Unit tests | `npm run test:unit` | |
| E2E | `npm run test:e2e` | Playwright; needs a running environment |
| Build | `npm run build` | Verify the change compiles before pushing |

**Nested workspaces.** Site repos build per package — e.g. a theme and a functionality
plugin each with their own `package.json`, sometimes an inner `src/`. Root scripts often
delegate (`npm run build --prefix themes/<theme>`). Lint a file in the workspace that owns
it; running the root script may silently skip it.

**Non-WordPress projects** (Workers, Astro, API services) use `eslint.config.mjs` +
`.prettierrc` directly. Same rule: run the declared `package.json` script.

## Pre-commit hooks

`husky` + `lint-staged` are the house pre-commit setup (`"prepare": "husky"`).

- `lint-staged.config.js` is the source of truth for what runs on commit. When it exists,
  **run the same commands it would run** — that's exactly what the hook will do.
- Config files are often excluded from linting there. Don't "fix" a config file the
  lint-staged rules deliberately skip.
- A blocked commit means the gate found something real. Fix the code; never `--no-verify`.

## Plugin Check

Applies to **distributed plugins only** — anything with a plugin header that ships to
WordPress.org, packagist.linchpin.com, or a client as a zip. Skip it for themes and site
repos.

### It is not PHPCS, and PHPCS cannot stand in for it

Plugin Check ships its own PHPCS sniffs — the `PluginCheck.*` ruleset — **inside the
plugin-check plugin**. They are not part of the Linchpin standard, so `phpcs.xml.dist` has
no way to reference them. `composer run phpcs` therefore runs green on code Plugin Check
reports on, and no amount of configuring PHPCS closes the gap.

It also runs checks PHPCS has no concept of: readme structure, header fields, the stable
tag, translations, enqueued-asset rules, image sizes in the zip.

A worked example. This passes `composer run phpcs` and fails Plugin Check:

```php
// phpcs:disable WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery
$ids = $wpdb->get_col( $wpdb->prepare( $sql, ...$values ) );
```

The `phpcs:disable` names the `WordPress.DB.*` sniffs, because those are the ones the local
standard has. `PluginCheck.Security.DirectDB.UnescapedDBParameter` is not silenced, is not
in the local standard, and fires only under Plugin Check.

### A green badge is not a passing check

`wordpress/plugin-check-action` fails the job on Plugin Check **errors** and not on
**warnings**. A PR can show a passing "Plugin Check" tick while carrying warnings that
WordPress.org review will raise — the check reports success and uploads the findings to an
artifact nobody opens.

So the local run is the authority, and it should treat **any finding as a failure**. When
CI and local disagree here, local is right.

This is the mirror image of *Green locally, red in CI* in
[`../SKILL.md`](../SKILL.md#green-locally-red-in-ci). There the shared lint workflow
annotates warnings a clean local run ignored; here CI ignores warnings a strict local run
catches. Same underlying cause both times — the two ends disagree about what counts as a
failure, not about what to check — so neither end is trustworthy on its own without knowing
which way it leans.

To see what CI actually found rather than trusting the tick:

```bash
gh run view <run-id> --log | grep -A5 'Run Plugin Check'
gh run download <run-id> -n plugin-check-results   # the findings, in full
```

### Running it

| Intent | Command |
| --- | --- |
| The gate | `composer run plugin-check` |
| What CI saw | `gh run download <run-id> -n plugin-check-results` |

When the repo has no script, the check needs a built plugin and a WordPress to run in:

```bash
# 1. Build the distributable — check what ships, not the source tree, or you
#    get findings from tests/ that never ship and miss what the build breaks.
composer run build

# 2. Boot WordPress with the *built* plugin mapped in, on a port nothing else holds.
#    wp-env defaults to 8888/8889, which any other project of yours already owns.
mkdir -p build/plugin-check && cd build/plugin-check
cat > .wp-env.json <<'JSON'
{ "core": null, "plugins": [ "../<slug>" ], "port": 8973, "testsPort": 8974 }
JSON
npx wp-env start

# 3. Check it, with the same flags as the workflow.
npx wp-env run cli wp plugin install plugin-check --activate
npx wp-env run cli wp plugin check <slug> \
  --categories=general,performance,accessibility,security,plugin_repo \
  --include-experimental \
  --format=csv
```

Keep `--categories` and `--exclude-checks` in step with
`.github/workflows/plugin-check.yml`. Two sets of flags that drift are two different gates,
and the PR is judged by the one you did not run.

### A finding you have decided to accept

Some findings are architectural and correct — a migration tool that queries `wp_posts`
directly because the post type it must reach is no longer registered, for instance. Those
do not get a silent pass:

1. Add the check id to `--exclude-checks` in **both** the local script and the workflow.
2. Comment the reason where the exclusion lives, not in a commit message.
3. Say so in the PR, because WordPress.org review will ask the same question.

`stable_tag_mismatch` / `no_stable_tag` / `trunk_stable_tag` are the standard exclusions on
a pre-release branch: release-please stamps the version on release, so before one the built
`readme.txt` legitimately trails the tag.

### The house script

```jsonc
// composer.json
"scripts": {
  "plugin-check": "bash scripts/plugin-check.sh"
}
```

The script builds, boots wp-env against the built artifact, installs plugin-check, runs it
with the workflow's flags, and **exits non-zero on any finding**. `linchpin/block-alchemy`
carries the reference implementation. It needs `@wordpress/env` in `devDependencies` and
Docker running; both are worth stating in the failure message, because a missing Docker
looks like a passing gate otherwise.

## The house script set

When a repo is missing these, propose adding them — matching the repo's existing tooling,
and only with the user's approval:

```jsonc
// package.json
"scripts": {
  "format":     "wp-scripts format",
  "lint:js":    "wp-scripts lint-js",
  "lint:css":   "wp-scripts lint-style",
  "lint:check": "npm run format && npm run lint:js",
  "prepare":    "husky"
}
```

```jsonc
// composer.json
"scripts": {
  "lint":    ["@php-lint", "@phpcs", "@fixer:test", "@phpstan"],
  "phpcs":   "phpcs --standard=phpcs.xml.dist",
  "phpcbf":  "phpcbf --standard=phpcs.xml.dist",
  "phpstan": "phpstan analyse"
}
```

Adding a script that references a tool the repo doesn't require is worse than having no
script — it fails for everyone. Check `require-dev` first, and add the dependency in the
same change or not at all.

## Local environments

**WordPress Studio is the default** for new Linchpin work. Repos still carrying wp-env or
LocalWP config predate that switch — those files are not evidence that the project is being
run that way today. Detect, and when both exist, ask which the user is on:

| Signal | Environment | Start |
| --- | --- | --- |
| Site registered in Studio | **WordPress Studio** (default) | [`wp-studio-cli`](../../wp-studio-cli/SKILL.md) — MCP `site_start`, else `studio site start` |
| `.wp-env.json` | wp-env (Docker) — legacy | `npx @wordpress/env start` |
| `.linchpin.json` → `wordpress.environments` | LocalWP or a declared path — legacy | Already running; use the path |

Unit tests and lint don't need any of this. Only reach for an environment when running E2E
or a check that boots WordPress.
