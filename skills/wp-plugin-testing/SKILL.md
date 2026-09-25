---
name: wp-plugin-testing
description: Structure a Linchpin plugin's PHP tests as a WordPress-free unit layer and a WP_UnitTestCase integration layer, so most tests need only PHP, CI needs no MySQL container, and integration tests run locally on SQLite. Use when adding PHPUnit to a plugin, when PHP tests need MySQL or Docker to run, when PHP CI is slow or expensive, when deciding whether a new test needs WordPress, or when PHPUnit exits 0 having run nothing. Not for running the suite before a commit — use `quality-gates`.
when_to_use: Also when Renovate proposes phpunit 10 or later or a mysql image major, when someone asks why the tests use MySQL, when install-wp-tests.sh or WP_UnitTestCase comes up, or when choosing between Brain Monkey, WP_Mock and hand-written stubs.
version: 1.0.0
allowed-tools: Read Grep Glob Bash(git ls-files*) Bash(composer run phpunit*) Bash(vendor/bin/phpunit --list-tests*)
---

# WordPress plugin testing

Most plugin PHP tests don't need WordPress, yet the scaffolded setup (`install-wp-tests.sh`
plus `WP_UnitTestCase`) installs WordPress into MySQL before running even a pure-function
test. That setup is why the suite won't run on a laptop and why the CI job spends minutes
on setup for a second of testing. This skill splits the suite so each test pays only for
what it uses.

## When to use

- Adding PHPUnit to a plugin, or reshaping a suite where every test extends `WP_UnitTestCase`.
- The PHP job is slow or costly, or it starts a MySQL service container.
- The tests can't run locally without Docker, MySQL or a hand-installed test library.
- Deciding which layer a new test belongs in.
- PHPUnit prints its banner and exits 0 without reporting any tests.
- Renovate proposes `phpunit/phpunit` 10 or later, or a `mysql` image major.

**Not this skill:** running the suite before a commit, or deciding a finding's fate — use
[`quality-gates`](../quality-gates/SKILL.md). Whether the repo *calls* the shared PHP
workflow at all — use [`wp-plugin-standards`](../wp-plugin-standards/SKILL.md). JS unit tests
and Playwright are not covered here.

## Owns

Canonical for: **the two PHP test layers** and the rule for which one a test belongs in; the
unit harness (bootstrap constants, base TestCase, the completion guard); the integration
harness (installer, SQLite for local runs, the runner's MySQL in CI); the PHPUnit and MySQL
version constraints the harness imposes; and the CI job shape for the integration layer.

Defers:

- The composer script *names* and running them as gates → [`quality-gates`](../quality-gates/SKILL.md).
- What `php-checks.yml@v4` does and its caller contract → [`wp-plugin-standards`](../wp-plugin-standards/SKILL.md)
  and the `linchpin/actions` README.
- Expressing a version cap in Renovate, and dependency majors in general →
  [`dependency-updates`](../dependency-updates/SKILL.md).
- Studio as a local site, which is **not** a PHPUnit host (PHP-WASM) → [`wp-studio-cli`](../wp-studio-cli/SKILL.md).
- The task, branch and commit → [`task-tracking`](../task-tracking/SKILL.md), [`commit-and-release`](../commit-and-release/SKILL.md).

## The two layers

| Layer | Config | Loads | Database | Composer script |
| --- | --- | --- | --- | --- |
| Unit | `phpunit.xml.dist` | Plugin code; WordPress functions stubbed | None | `phpunit` |
| Integration | `phpunit-integration.xml.dist` | WordPress and its PHPUnit library (`WP_UnitTestCase`) | SQLite locally, MySQL in CI | `test:integration` |

**`phpunit.xml.dist` is the unit layer, always.** `php-checks.yml@v4` runs bare
`vendor/bin/phpunit` with no database. If the default config loads WordPress's test
library, that job fails once a repo adopts the shared workflow.

**Which layer:** start with a unit test. It becomes an integration test only if it needs
something that can't reasonably be stubbed: block registration, `render_block()` output, the
HTML API, the script and style registries, hooks firing across WordPress, or real posts,
options and users. One class often has tests in both layers, for example a sanitizer tested
as a unit and its renderer tested in integration.

## Preflight

| Look for | Tells you | If missing |
| --- | --- | --- |
| `extends WP_UnitTestCase` across `tests/` | How many tests are integration today | No tests at all → build the unit layer first; there's nothing to split |
| The guard at the top of `includes/**/*.php`: `defined( 'WPINC' )` or `defined( 'ABSPATH' )` | Which constants the unit bootstrap **must** define | No guard → nothing to define, but the completion guard still earns its place |
| `brain/monkey`, `10up/wp_mock`, `yoast/wp-test-utils`, or a `tests/shadows/`-style stub directory | How this repo already stubs WordPress | None → Brain Monkey. Otherwise **extend what exists**; never add a second stubbing library |
| `phpunit.xml`/`.dist` → `bootstrap` | Which layer bare `vendor/bin/phpunit` runs today | — |
| `bin/install-wp-tests.sh` and any `db.php` it downloads | The integration installer, and whether it still ships the old wp-mysqli drop-in | No installer → copy the one in [`references/ci-and-local.md`](references/ci-and-local.md) |
| `services: mysql` or `mysql:` images in `.github/workflows/` | The container to replace | — |
| `uses: …/php-checks.yml@v4` and its `run_phpunit` | Whether the unit layer already runs in the shared job | Not called → the repo's own test job runs both layers until it adopts it |
| What the integration tests read from disk: a `build/` dir, a blocks manifest | What CI must build or restore first | — |
| `composer.json` → `config.platform.php`, `require-dev` phpunit | PHP floor and PHPUnit line | — |

## Procedure

1. **Inventory the suite.** For every `*Test.php`, record its base class, what it calls,
   and the layer it belongs in by the rule above. → A table of every test file with a layer,
   plus the total test count (`vendor/bin/phpunit --list-tests`) to compare against later.
2. **Build the unit layer.** Follow [`references/harness.md`](references/harness.md): a
   bootstrap that defines the guard constants **before** the autoloader, a base TestCase,
   the completion guard, and `phpunit.xml.dist`. Move the unit tests over and stub what they
   call. → `composer run phpunit` passes with no WordPress installed. Then remove the guard
   constant from the bootstrap: the run must now **fail**. Put the constant back.
3. **Build the integration layer.** `phpunit-integration.xml.dist`, its WordPress
   bootstrap, the installer's SQLite mode, and the local runner, all in
   [`references/ci-and-local.md`](references/ci-and-local.md). → `composer run
   test:integration` passes on a laptop with only PHP. The SQLite file under
   `wp-content/database/` holds `wptests_` tables, and unit plus integration counts equal
   step 1's total.
4. **Wire CI.** Integration runs on the runner image's own MySQL, started with
   `systemctl`, never a service container. Cache whatever the integration tests read from a
   build. Run the unit layer first in the same job, unless `php-checks.yml@v4` already runs
   it. → A green PR run, with the job time recorded before and after, cold and warm cache.
5. **Pin what the harness can't survive.** Cap `phpunit/phpunit` below 10 while any test
   extends `WP_UnitTestCase`. With no MySQL image left in the workflows, there's no image to
   pin. How to express the cap → [`dependency-updates`](../dependency-updates/SKILL.md). →
   The Renovate config carries the cap and still validates.
6. **Document and hand off.** Write a short testing page covering the layers, the commands,
   which layer a new test goes in, and SQLite's limits. Then run the gates through
   [`quality-gates`](../quality-gates/SKILL.md) and commit through
   [`commit-and-release`](../commit-and-release/SKILL.md). → The page exists and the PR
   links the task.

## Gotchas

- **A `die` in plugin code passes the run.** `if ( ! defined( 'WPINC' ) ) die;` exits with
  status 0. If the unit bootstrap doesn't define `WPINC`, the first class a test loads ends
  PHPUnit mid-run: banner printed, no summary, **exit 0**, and CI goes green. Defining the
  constants fixes the known case. The completion guard catches the next `die` or `exit`
  someone adds.
- **The scaffolded installer installs a third-party `wpdb`.** Older `install-wp-tests.sh`
  copies download `markoheijnen/wp-mysqli/master/db.php`, unpinned, into
  `wp-content/db.php`, so tests run on that instead of core's `wpdb`. Remove it.
- **`WP_TESTS_DIR=/tmp/…` in `phpunit.xml` breaks macOS.** The installer writes to
  `$TMPDIR`, which on macOS is under `/var/folders/`. Let both sides fall back to the temp
  directory instead of hardcoding `/tmp`.
- **Coverage with nowhere to go.** An Xdebug run plus a Codecov step without
  `CODECOV_TOKEN` fails the upload silently ("Token required") while still slowing every
  run. Turn coverage off until a token exists.
- **SQLite isn't MySQL.** Custom SQL, `dbDelta` and charset handling can differ. CI on MySQL
  is the authority, and a test that only fails on one engine is a finding, not flakiness.

## Guardrails

- **Never point `phpunit.xml.dist` at WordPress's test library.** The shared PHP job runs it
  with no database.
- **Never remove or loosen the completion guard or the bootstrap constants** to make a run
  pass. A run the guard fails really did stop early; find the `die`.
- **Never move a test between layers by deleting assertions.** Counts before and after must
  match (step 1 against step 3).
- **Never upgrade PHPUnit to 10 or later while any test extends `WP_UnitTestCase`.** Its
  `expectDeprecated()` calls an API PHPUnit 10 removed. Moving past 9 means leaving core's
  test library, for example for Mantle Testkit, which needs PHP 8.3.
- **Never add a MySQL service container or a `mysql:latest`/`innovation` tag.** Use the
  runner's MySQL.
- **Never download an unpinned third-party `db.php` drop-in.** The SQLite drop-in comes from
  the wordpress.org plugin release.
- **Never run PHPUnit inside Studio.** It's PHP-WASM; use the machine's PHP.
- If the repo stubs WordPress one way already, extend it. Two stubbing libraries in one
  suite is a guardrail breach, not a style choice.

## Done

- [ ] Every test file has a layer, and the unit and integration counts sum to the original total.
- [ ] `composer run phpunit` passes with no WordPress or database on the machine.
- [ ] Removing the guard constant makes the unit run fail, and it was put back.
- [ ] `composer run test:integration` passes locally on SQLite; CI runs it on the runner's MySQL.
- [ ] No MySQL service container or image remains in the workflows.
- [ ] PHPUnit is capped below 10 wherever `WP_UnitTestCase` is in use.
- [ ] CI job time is recorded before and after, cold and warm.
- [ ] A testing page names the layers, the commands, and which layer a new test goes in.
