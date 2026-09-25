---
title: wp-plugin-testing
---

Most of a plugin's PHP tests don't need WordPress. The scaffolded setup (`install-wp-tests.sh` plus `WP_UnitTestCase`) installs WordPress into MySQL even for a pure-function test, which is why the suite won't run on a laptop and why the CI job spends minutes on setup for a second of testing. This skill splits the suite into a WordPress-free unit layer and a WordPress integration layer, so each test pays only for what it uses.

## When to reach for it

- Adding PHPUnit to a plugin, or reshaping a suite where every test extends `WP_UnitTestCase`.
- The PHP job is slow or costly, or it starts a MySQL service container.
- The tests can't run locally without Docker, MySQL or a hand-installed test library.
- Deciding which layer a new test belongs in.
- PHPUnit prints its banner and exits 0 without reporting any tests.
- Renovate proposes PHPUnit 10 or later, or a `mysql` image major.

Things you might say that load it: "why do the tests need MySQL", "the PHP tests are slow in CI", "can I run the tests locally", "does this test need WordPress".

## Where it stops

> **Not this skill:** running the suite before a commit, or deciding a finding's fate — [`quality-gates`](quality-gates.md). Whether the repo *calls* the shared PHP workflow at all — [`wp-plugin-standards`](wp-plugin-standards.md). JS unit tests and Playwright are not covered.

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Inventory the suite","content":"<p>Record every test file's base class, what it calls, and which layer it belongs in, plus the total test count to compare against later.</p>"},{"title":"Build the unit layer","content":"<p>phpunit.xml.dist with a bootstrap that defines the constants the plugin's file guards check, a Brain Monkey base TestCase, and a completion guard. Prove the guard by removing the constant and watching the run fail.</p>"},{"title":"Build the integration layer","content":"<p>phpunit-integration.xml.dist on WordPress's test library, with an installer that can use SQLite, so composer test:integration runs on a laptop with only PHP.</p>"},{"title":"Wire CI","content":"<p>Run the unit layer first, then the integration layer on the runner image's own MySQL, not a service container. Cache the build the integration tests read, and record the job time before and after.</p>"},{"title":"Pin what the harness can't survive","content":"<p>Cap PHPUnit below 10 while any test extends WP_UnitTestCase. With the MySQL image gone, there's no Docker tag left for Renovate to chase.</p>"},{"title":"Document and hand off","content":"<p>A short testing page covering the layers, the commands and which layer a new test goes in. Then run the gates and commit.</p>"}]} /-->

| Layer | Config | Database | Composer script |
| --- | --- | --- | --- |
| Unit | `phpunit.xml.dist` | None | `phpunit` |
| Integration | `phpunit-integration.xml.dist` | SQLite locally, MySQL in CI | `test:integration` |

`phpunit.xml.dist` is always the unit layer, because `php-checks.yml@v4` runs bare `vendor/bin/phpunit` with no database.

## What it checks first

- `extends WP_UnitTestCase` across `tests/`: how much of the suite is integration today.
- The guard at the top of the plugin's PHP files (`defined( 'WPINC' )` or `defined( 'ABSPATH' )`): the constants the unit bootstrap must define.
- How the repo already stubs WordPress: Brain Monkey, WP_Mock, `yoast/wp-test-utils`, or hand-written stubs like mantle's `tests/shadows/`. The skill extends whatever it finds.
- `bin/install-wp-tests.sh`, and whether it still downloads the old wp-mysqli `db.php` drop-in.
- MySQL service containers in `.github/workflows/`, and whether `php-checks.yml@v4` already runs the unit layer.

## What it owns

Canonical for: the two PHP test layers and the rule for which one a test belongs in; the unit harness (bootstrap constants, base TestCase, completion guard); the integration harness (installer, SQLite for local runs, the runner's MySQL in CI); the PHPUnit and MySQL constraints the harness imposes; and the CI job shape for the integration layer. It defers the composer script names and running the gates to [`quality-gates`](quality-gates.md), the shared workflow's contract to [`wp-plugin-standards`](wp-plugin-standards.md), and Renovate mechanics to [`dependency-updates`](dependency-updates.md).

## Guardrails

- Never point `phpunit.xml.dist` at WordPress's test library, since the shared PHP job runs it with no database.
- Never remove or loosen the completion guard or the bootstrap constants to make a run pass. Find the `die`.
- Never move a test between layers by deleting assertions. Counts before and after must match.
- Never upgrade PHPUnit to 10 or later while any test extends `WP_UnitTestCase`.
- Never add a MySQL service container or a `mysql:latest`/`innovation` tag.
- Never download an unpinned third-party `db.php` drop-in. The SQLite drop-in comes from the wordpress.org release.
- Never run PHPUnit inside Studio, which is PHP-WASM.
- Extend the repo's existing stubbing approach rather than adding a second one.

## Done when

- [ ] Every test file has a layer, and the unit and integration counts sum to the original total.
- [ ] `composer run phpunit` passes with no WordPress or database on the machine.
- [ ] Removing the guard constant makes the unit run fail, and it was put back.
- [ ] `composer run test:integration` passes locally on SQLite, and CI runs it on the runner's MySQL.
- [ ] No MySQL service container or image remains, and PHPUnit is capped below 10 where `WP_UnitTestCase` is used.
- [ ] CI job time is recorded before and after, and a testing page exists.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/wp-plugin-testing/SKILL.md) is the skill.
- [`references/harness.md`](https://github.com/linchpin/skills/blob/main/skills/wp-plugin-testing/references/harness.md): the unit layer's templates (composer scripts, `phpunit.xml.dist`, the bootstrap, the Brain Monkey base TestCase, the completion guard), how to prove the guard, and a stubbing table.
- [`references/ci-and-local.md`](https://github.com/linchpin/skills/blob/main/skills/wp-plugin-testing/references/ci-and-local.md): the integration config and bootstrap, the three changes to `install-wp-tests.sh` (SQLite mode, dropping wp-mysqli), the local runner, the CI job, the Renovate cap, and before and after numbers from the reference plugin.

`allowed-tools` pre-approves reading and searching files, `git ls-files`, running the unit layer (`composer run phpunit`), and `vendor/bin/phpunit --list-tests`. Anything that writes still asks.

## Related skills

- [`quality-gates`](quality-gates.md): owns the composer script names and running the tests as gates.
- [`wp-plugin-standards`](wp-plugin-standards.md): owns whether the repo calls `php-checks.yml@v4`, which runs the unit layer.
- [`wp-plugin-modernization`](wp-plugin-modernization.md): owns staging this on a shipped plugin, where the test net comes first.
- [`dependency-updates`](dependency-updates.md): owns Renovate policy, including how the PHPUnit cap is expressed.
- [`wp-studio-cli`](wp-studio-cli.md): owns the local Studio site, which is not a PHPUnit host.
- [`task-tracking`](task-tracking.md) and [`commit-and-release`](commit-and-release.md): own the task, branch and commit.
