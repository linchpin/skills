---
name: wp-plugin-dependency-audit
description: Audit a Linchpin WordPress plugin's npm and Composer dependencies for what it does not need to own — packages nothing uses, tooling @wordpress/scripts or a shared standard already provides, imports that only resolve through hoisting, stale or abandoned packages, and Composer packages that run on every request — then trim the manifests and prove nothing broke. Use when asked "do we need all these dependencies", "audit our packages", or "why is X a dependency", when security alerts keep naming packages nobody uses, before modernizing a plugin, or after a @wordpress/scripts major. Not for upgrading or patching a package — use `dependency-updates`.
when_to_use: Also when someone asks whether a plugin can lean on what wp-scripts already ships, clsx or classnames, whether to port or drop a package nobody maintains, or whether to move unit tests from Jest to Vitest.
version: 1.0.0
allowed-tools: Read Grep Glob Bash(node *scripts/audit-deps.mjs*) Bash(npm ls*) Bash(npm view*) Bash(composer why*) Bash(composer depends*) Bash(git grep*) Bash(git status*) Bash(git diff*)
---

# Plugin dependency audit

Every package in `package.json` or `composer.json` is one we have to audit, update, and answer
security advisories for. This skill finds the ones a plugin doesn't need to own and removes
them without breaking the build, leaning on what WordPress, `@wordpress/scripts`, and our
shared standards already maintain. Smaller bundles are a side effect, not the goal.

## When to use

- Someone asks whether a plugin needs all its dependencies, or why one is there.
- Advisories keep landing for packages no code seems to use.
- Before modernizing an inherited plugin, or after a `@wordpress/scripts` major changes what
  scripts ships.
- Choosing between two packages that do the same job (`clsx`/`classnames`), or deciding what
  to do with a dependency nobody maintains.

**Not this skill:** bumping, patching, or overriding a package — [`dependency-updates`](../dependency-updates/SKILL.md).
Draining the bot-PR backlog — [`maintenance-window`](../maintenance-window/SKILL.md). Which
files, scripts, and workflows a plugin repo must carry — [`wp-plugin-standards`](../wp-plugin-standards/SKILL.md).

## Owns

Canonical for: the declaration rule below, how each declared package is classified, the
replacement catalogue ([`references/replacements.md`](references/replacements.md)), the
Jest → Vitest migration recipe ([`references/jest-to-vitest.md`](references/jest-to-vitest.md)),
and proving a removal safe.

Defers: version bumps, advisories, and `overrides` → [`dependency-updates`](../dependency-updates/SKILL.md).
Running the gates → [`quality-gates`](../quality-gates/SKILL.md). The commit and PR →
[`commit-and-release`](../commit-and-release/SKILL.md). The task → [`task-tracking`](../task-tracking/SKILL.md).

## The rule

1. **Our code or config names it → declare it**, even when it is already installed
   transitively. `@wordpress/*` and `react` cost nothing to declare: the extraction plugin
   externalizes them to WordPress's own globals, so they never enter the bundle.
2. **Only a tool we depend on uses it → don't declare it.** `@wordpress/scripts` versions
   webpack, webpack-cli, Babel, ESLint, Prettier and the CSS loaders; `linchpin/coding-standards`
   versions PHPCS, WPCS and php-parallel-lint. A root copy overrides the one they were tested with.
3. **Prefer what's already maintained**: an API WordPress ships, then an existing dependency,
   then a new package. A package nobody maintains is a liability even when it works. Replace
   it with something upstream keeps current, or remove the need. Don't port it into the plugin.

## Preflight

| Look for | Tells you | If missing |
| --- | --- | --- |
| Every `package.json` (root, `blocks/`, …) and `workspaces` | Each is its own package root; a nested root also resolves from its parents' `node_modules` | No npm side — audit Composer only |
| `package-lock.json`, `composer.lock` | What the inventory reads: bins, peers, providers, autoload, release dates | Say so; providers and peers are unknown, fall back to `git grep` |
| `@wordpress/scripts` range | 36+ means `test-unit-js` is Vitest and the Jest preset is retired | Not a wp-scripts build — rule 2 applies to whatever owns the toolchain |
| `.github/workflows/*` `uses: linchpin/actions/…` | Tools a reusable workflow runs never appear in this repo | Read the called workflow (see `wp-plugin-standards`) before removing a CLI |
| `composer.json` `autoload.files`, package `type` | What runs on every request, and what WP-CLI commands the plugin registers | — |
| `.distignore`, build script | What ships: `vendor/`, `third-party/`, `build/` | Ask before treating a runtime package as dev-only |

## Procedure

1. **Resolve the task** through [`task-tracking`](../task-tracking/SKILL.md). → A task key or
   an accepted `NO-TASK`; branch cut from an up-to-date default branch.
2. **Baseline from a clean install.** `npm ci` in every package root (`npm ci --prefix blocks`),
   `composer install`, then the project's own gates via [`quality-gates`](../quality-gates/SKILL.md).
   Record the build result, the test count, and lint counts **per rule**. → Numbers written
   down that a later run can be compared against.
3. **Run the inventory.** `node <skill-dir>/scripts/audit-deps.mjs` from the repo root (or
   `--root <path>`); add `--registry` for latest-release dates, deprecations and abandonment.
   It is read-only and needs no install. → A report with one section per decision below.
4. **Triage every row** with [`references/triage.md`](references/triage.md). The script finds
   leads, not verdicts: confirm each removal with `git grep -n <pkg> -- ':!*lock*'`, and check
   reusable workflows and runtime side effects. → Each row is marked remove, declare,
   replace, or keep, with the reason.
5. **Pick replacements** for what stays but shouldn't, from
   [`references/replacements.md`](references/replacements.md). → A named replacement per
   package, or a reason to keep it.
6. **Change one ecosystem per commit**, with the tools, never by editing a lockfile:
   - **npm:** `npm uninstall` / `npm install <pkg>@<range>`, in each package root that declares it.
   - **Composer:** `composer remove <pkg> --minimal-changes`.
   - **Unit-test runner:** a commit of its own, last, per [`references/jest-to-vitest.md`](references/jest-to-vitest.md).

   → Each lockfile diff touches only the intended packages.
7. **Verify from clean**: `npm ci`, build every package root, run the tests (same count as the
   baseline), lint (no file or rule worse than the baseline), the Composer gates. Then re-run
   the inventory. → Removed rows are gone, no new undeclared rows, every gate at or better than
   baseline.
8. **Hand off** to [`commit-and-release`](../commit-and-release/SKILL.md). The PR body lists
   each removal with its reason, and calls out anything users can see, like a removed WP-CLI
   command. → PR open, task updated.

## Gotchas

Measured on Linchpin plugins, October 2026.

- **Zero imports isn't unused.** A package can be named only as a string in config (a Jest
  preset, the `package.json` `prettier` field), be a required peer, be a CLI in a script or
  hook, be loaded by a setting (`environment: 'jsdom'`), or run on load through Composer's
  `autoload.files`. The inventory checks all five. A tool run by a reusable workflow it can't see.
- **Removing a root copy of a tool can strand the toolchain's copy.** Before Mantle's
  cleanup, the root pinned `webpack-cli` 7 over scripts' ^5. After `npm uninstall webpack-cli`,
  npm left scripts' copy nested and the build stopped at "CLI for webpack must be installed".
  `npm dedupe` doesn't move it. Re-installing the toolchain package at its current range does:
  `npm install -D @wordpress/scripts@<same range>`. Then confirm with `npm ls webpack-cli`.
- **An override of a package you now declare must become `"$<pkg>"`**, or npm refuses with
  `EOVERRIDE`.
- **A webpack `resolve.alias` into `node_modules/<pkg>`** bypasses the package's `exports`,
  usually forcing its CommonJS build. One such `date-fns` alias put about 815 KB into each of
  three bundles.
- **Importing `lodash` makes WordPress enqueue core's whole lodash script** on every screen
  that loads the bundle. Check `build/*.asset.php`.
- **Once a package is declared, its `eslint-disable import/no-extraneous-dependencies`
  comments become "unused directive" warnings.** Delete them in the same commit.
- **`composer remove` exits 2 with "still present"** when another package also requires it.
  That's the expected result for a tool the shared standard provides.
- **Formatters can reach beyond their arguments.** `npm run format` and `wp-scripts lint-js
  --fix` rewrite repo-wide. Format with `npx wp-scripts format <files>`, then `git status`
  before staging.

## Guardrails

- **Never** remove a package on the inventory's word alone — grep for it, then prove the
  removal with a clean install, the build, and the tests.
- **Never** hand-edit `package-lock.json` or `composer.lock`. If npm won't produce the tree
  you need, use the reinstall in *Gotchas*, or stop and say so (see `dependency-updates`).
- **Never** remove a runtime Composer package without reading what its autoloaded files do. A
  client site may depend on a command or hook it registers. Name it in the PR.
- **Never** fold the test-runner migration into the removals; a rollback should take back
  one thing.
- **Never** raise `engines`, `require.php`, or the WordPress minimum as part of an audit.
- **Never** port an unmaintained package into the plugin before checking whether WordPress or
  an existing dependency already covers the need.
- **Never** skip the pre-commit hook silently. If it blocks on lint errors that predate the
  change, stop and say so, then fix them or get approval to bypass. When bypassing, run the
  hook's own steps by hand.
- If the inventory can't run (no lockfile, an unfamiliar layout), say so and audit by hand
  with `git grep` against the same rule rather than guessing.

## Done

- [ ] Baseline recorded from a clean install: build, test count, lint per rule.
- [ ] Every inventory row triaged with a reason; every removal confirmed by `git grep`.
- [ ] Lockfiles changed only by npm and Composer, one ecosystem per commit, test runner alone.
- [ ] From a clean install: build green, same test count, lint no worse than baseline,
      Composer gates green.
- [ ] Re-run inventory shows the removed rows gone and no new undeclared imports.
- [ ] PR lists each removal and any user-visible change; task updated.
