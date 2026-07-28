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
