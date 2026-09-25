# Integration harness, CI and local runs

The integration layer loads WordPress through its own PHPUnit library (`WP_UnitTestCase`).
The library installs WordPress into a real database before the first test and wraps every
test in a transaction, so it needs a database even for tests that never query one. Locally
that database is SQLite. In CI it's the runner image's MySQL.

## phpunit-integration.xml.dist

```xml
<?xml version="1.0"?>
<!-- WordPress integration tests. Run with `composer test:integration` (SQLite locally). -->
<phpunit
	xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xsi:noNamespaceSchemaLocation="https://schema.phpunit.de/9.5/phpunit.xsd"
	bootstrap="tests/phpunit/Integration/bootstrap.php"
	backupGlobals="false"
	colors="true"
	cacheResultFile=".phpunit.cache/integration.result.cache"
>
	<testsuites>
		<testsuite name="Integration">
			<directory suffix="Test.php">./tests/phpunit/Integration</directory>
		</testsuite>
	</testsuites>
</phpunit>
```

**No `<env name="WP_TESTS_DIR" value="/tmp/…"/>`.** The installer writes to `$TMPDIR`, which
isn't `/tmp` on macOS. Let the bootstrap fall back to `sys_get_temp_dir()`, which reads the
same variable.

## tests/phpunit/Integration/bootstrap.php

The classic scaffolded bootstrap. Keep it, and prefix its globals: lint-staged runs PHPCS on
staged test files.

```php
<?php
require_once dirname( __DIR__, 3 ) . '/vendor/autoload.php';

$<plugin>_tests_dir = getenv( 'WP_TESTS_DIR' ) ?: rtrim( sys_get_temp_dir(), '/\\' ) . '/wordpress-tests-lib';

if ( ! file_exists( "{$<plugin>_tests_dir}/includes/functions.php" ) ) {
	// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite -- CLI error before WordPress loads.
	fwrite( STDERR, "Could not find {$<plugin>_tests_dir}/includes/functions.php. Run `composer test:integration` to install it." . PHP_EOL );
	exit( 1 );
}

require_once "{$<plugin>_tests_dir}/includes/functions.php";

tests_add_filter(
	'muplugins_loaded',
	static function () {
		require dirname( __DIR__, 3 ) . '/<plugin-main-file>.php';
	}
);

require "{$<plugin>_tests_dir}/includes/bootstrap.php";
```

## bin/install-wp-tests.sh — three changes to the scaffolded script

1. **Choose the engine.** After the positional arguments:

   ```bash
   DB_ENGINE=${WP_TESTS_DB_ENGINE-mysql}
   ```

2. **Delete the wp-mysqli download** from `install_wp()`:

   ```bash
   download https://raw.github.com/markoheijnen/wp-mysqli/master/db.php $WP_CORE_DIR/wp-content/db.php
   ```

   It's an unpinned third-party `wpdb` from the PHP 5 era. Core's `mysqli` `wpdb` has been
   the default since WordPress 3.9.

3. **Add the drop-in step, and skip database creation for SQLite:**

   ```bash
   install_db_dropin() {
   	local DROPIN="$WP_CORE_DIR/wp-content/db.php"

   	# MySQL runs on WordPress's own wpdb, so no drop-in.
   	if [ "$DB_ENGINE" != "sqlite" ]; then
   		rm -f "$DROPIN"
   		return
   	fi

   	local PLUGIN_DIR="$WP_CORE_DIR/wp-content/plugins/sqlite-database-integration"

   	if [ ! -d "$PLUGIN_DIR" ]; then
   		download https://downloads.wordpress.org/plugin/sqlite-database-integration.zip "$TMPDIR/sqlite-database-integration.zip"
   		unzip -q "$TMPDIR/sqlite-database-integration.zip" -d "$WP_CORE_DIR/wp-content/plugins"
   		rm -f "$TMPDIR/sqlite-database-integration.zip"
   	fi

   	# db.copy finds the plugin in wp-content/plugins when its placeholders are left as-is.
   	cp "$PLUGIN_DIR/db.copy" "$DROPIN"
   }

   install_db() {
   	if [ ${SKIP_DB_CREATE} = "true" ] || [ "$DB_ENGINE" = "sqlite" ]; then
   		return 0
   	fi
   	# … unchanged …
   }

   install_wp
   install_db_dropin
   install_test_suite
   install_db
   ```

Use the **wordpress.org release zip**. The GitHub repo is now a monorepo that symlinks the
driver in from another package, so copying its `main` branch leaves a drop-in with nothing
to load. `install_db_dropin` runs on every install, not just the first, so switching engines
on an existing install works.

## bin/test-integration.sh — the local runner

```bash
#!/usr/bin/env bash
# Run the WordPress integration tests locally on SQLite, with nothing but PHP.
#   composer test:integration
#   composer test:integration -- --filter SomeTest   # extra args go to PHPUnit
#   composer test:integration -- --reinstall         # fresh WordPress download
#   WP_VERSION=6.8 composer test:integration -- --reinstall
set -euo pipefail

cd "$(dirname "$0")/.."

TMPDIR=${TMPDIR-/tmp}
TMPDIR=${TMPDIR%/}
export WP_TESTS_DIR=${WP_TESTS_DIR-$TMPDIR/wordpress-tests-lib}
export WP_CORE_DIR=${WP_CORE_DIR-$TMPDIR/wordpress}

if [ "${1-}" = "--reinstall" ]; then
	shift
	rm -rf "$WP_TESTS_DIR" "$WP_CORE_DIR"
fi

# Only when the integration tests read a build (block plugins: the blocks manifest).
if [ ! -f blocks/build/blocks-manifest.php ]; then
	echo "The blocks aren't built yet. Run \`npm run build --prefix blocks\`, then try again." >&2
	exit 1
fi

if [ ! -f "$WP_TESTS_DIR/includes/functions.php" ] || [ ! -f "$WP_CORE_DIR/wp-content/db.php" ]; then
	WP_TESTS_DB_ENGINE=sqlite bash bin/install-wp-tests.sh wordpress_test root '' localhost "${WP_VERSION-latest}"
fi

exec vendor/bin/phpunit -c phpunit-integration.xml.dist "$@"
```

To confirm SQLite is really in use, check that
`$TMPDIR/wordpress/wp-content/database/.ht.sqlite` exists and holds `wptests_*` tables.

## CI job

One job for both layers. Actions bills each job rounded up to the minute, and the layers
share PHP and Composer setup. When the repo already calls `php-checks.yml@v4`, which runs the
unit layer, drop the unit step and keep the rest as an integration-only job.

```yaml
jobs:
  phpunit:
    name: PHPUnit (PHP ${{ matrix.php }} / WP ${{ matrix.wp }})
    runs-on: ubuntu-latest
    timeout-minutes: 10
    strategy:
      matrix:
        include:
          - php: '8.2'
            wp: 'latest'
    steps:
      - uses: actions/checkout@v7

      - uses: shivammathur/setup-php@v2
        with:
          php-version: ${{ matrix.php }}
          extensions: mbstring, intl, mysqli
          coverage: none          # until a CODECOV_TOKEN exists
          tools: composer:v2

      # … Composer cache + `composer install --prefer-dist --no-progress` …

      # No WordPress, database or Node: run first, fail fast.
      - name: Run unit tests
        run: composer phpunit

      # Only if the integration tests read a build. Key on everything the build reads.
      - name: Restore block build
        id: block-build
        uses: actions/cache@v6
        with:
          path: blocks/build
          key: block-build-${{ hashFiles('blocks/src/**', 'blocks/*.js', 'blocks/package.json', 'blocks/package-lock.json') }}
      - name: Build blocks
        if: steps.block-build.outputs.cache-hit != 'true'
        run: npm ci --prefix blocks && npm run build --prefix blocks   # after setup-node, also gated on the miss

      # The runner image ships MySQL (root/root), stopped by default.
      - name: Start MySQL
        run: sudo systemctl start mysql.service

      - name: Install WordPress test suite
        run: bash bin/install-wp-tests.sh wordpress_test root root 127.0.0.1 ${{ matrix.wp }}

      - name: Run integration tests
        run: vendor/bin/phpunit -c phpunit-integration.xml.dist
```

Add every file the job depends on to the workflow's `pull_request` `paths`: both PHPUnit
configs, `bin/install-wp-tests.sh`, `composer.lock`, and the build's package files and
`block.json` files. A PR that changes only a lockfile otherwise runs no tests at all.

## Renovate

```json
{
	"description": "WP_UnitTestCase only runs on PHPUnit 9.x. Its expectDeprecated() calls an API that PHPUnit 10 removed.",
	"matchManagers": ["composer"],
	"matchPackageNames": ["phpunit/phpunit"],
	"allowedVersions": "<10"
}
```

Composer's dependency types are `require` and `require-dev`, not npm's `dependencies` and
`devDependencies`. A `matchDepTypes` rule written with the npm names never matches, and it
fails silently. The rest of Renovate policy → `dependency-updates`.

## What it bought on the reference plugin

`linchpin-blocks`, 53 tests: 29 unit, 24 integration.

| PHP job | Before | After, build cached | After, blocks changed |
| --- | --- | --- | --- |
| Total | 210s, billed 4 min | 33s, billed 1 min | 163s, billed 3 min |
| MySQL | 59s service container | 6s runner MySQL | 7s |
| Block build | 101s every run | 2s cache restore | 106s |

Locally, `composer test` needs only PHP. A warm run spends under a second in the tests, and
the first integration run, downloads included, took about 7s.
