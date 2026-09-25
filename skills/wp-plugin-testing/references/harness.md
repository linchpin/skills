# Unit harness

Templates for the WordPress-free unit layer. Replace `<Plugin>` with the plugin's PHP
namespace root (for example `Linchpin_Blocks`) and `<plugin>` with its prefix. Read the
repo's own guard and namespace first; don't copy these blind.

## composer.json

```jsonc
"require-dev": {
  "phpunit/phpunit": "^9.6",
  "yoast/phpunit-polyfills": "^4.0",   // WordPress's test library needs it; keep whatever major is already there
  "brain/monkey": "^2.7"               // only when the repo has no stubbing approach yet
},
"autoload-dev": {
  "psr-4": { "<Plugin>\\Tests\\": "tests/phpunit/" }
},
"scripts": {
  "phpunit": "phpunit",
  "test:integration": "bash bin/test-integration.sh",
  "test": ["@lint", "@phpunit", "@test:integration"]
},
"scripts-descriptions": {
  "phpunit": "Run the unit tests. No WordPress or database needed.",
  "test:integration": "Run the WordPress integration tests on SQLite. Installs the WordPress test library on first run.",
  "test": "Run lint, the unit tests, then the WordPress integration tests."
}
```

The script names follow the house set in `quality-gates`: `phpunit` is the unit tests, and
`test` is lint plus tests. Add Brain Monkey with a minimal lock change:
`composer require --dev brain/monkey:^2.7 --no-update && composer update brain/monkey --with-dependencies`.

**Avoid `yoast/wp-test-utils`** in a repo already on `yoast/phpunit-polyfills` 2 or later.
Its 1.x line requires polyfills `^1.1`, so Composer can't resolve both. Use Brain Monkey
directly.

## Layout

```
phpunit.xml.dist                      unit (the default config: bare `vendor/bin/phpunit` runs it)
phpunit-integration.xml.dist          integration
tests/phpunit/Unit/bootstrap.php
tests/phpunit/Unit/TestCase.php
tests/phpunit/Unit/Completion_Guard.php
tests/phpunit/Unit/<mirrors includes/>/*Test.php
tests/phpunit/Integration/bootstrap.php
tests/phpunit/Integration/<mirrors includes/>/*Test.php
```

`TestCase.php` and `Completion_Guard.php` don't end in `Test.php`, so the
`suffix="Test.php"` suite directory skips them.

## phpunit.xml.dist

```xml
<?xml version="1.0"?>
<!--
	Unit tests: no WordPress, no database. Run with `composer phpunit`. Keep it WordPress-free:
	the shared php-checks.yml@v4 workflow runs `vendor/bin/phpunit` against this file with no database.
-->
<phpunit
	xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xsi:noNamespaceSchemaLocation="https://schema.phpunit.de/9.5/phpunit.xsd"
	bootstrap="tests/phpunit/Unit/bootstrap.php"
	backupGlobals="false"
	colors="true"
	cacheResultFile=".phpunit.cache/unit.result.cache"
>
	<extensions>
		<extension class="<Plugin>\Tests\Unit\Completion_Guard"/>
	</extensions>
	<testsuites>
		<testsuite name="Unit">
			<directory suffix="Test.php">./tests/phpunit/Unit</directory>
		</testsuite>
	</testsuites>
	<coverage>
		<include>
			<directory suffix=".php">./includes</directory>
		</include>
	</coverage>
</phpunit>
```

Leave `<report>` out of `<coverage>`. With it, PHPUnit collects coverage whenever a driver is
loaded, and warns when none is. `--coverage-html` still works on request.

## tests/phpunit/Unit/bootstrap.php

```php
<?php
/**
 * PHPUnit bootstrap for the unit tests: no WordPress, no database.
 *
 * @package <Plugin>
 */

// Every file in includes/ opens with `if ( ! defined( 'WPINC' ) ) die;`. Without these
// constants the first class the autoloader loads ends PHPUnit with exit code 0, and every
// test after it silently never runs.
// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- WordPress core constant.
define( 'ABSPATH', sys_get_temp_dir() . '/<plugin>-unit/' );
// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- WordPress core constant.
define( 'WPINC', 'wp-includes' );

require_once dirname( __DIR__, 3 ) . '/vendor/autoload.php';

// Function-only files the plugin requires by hand (not autoloadable) go here too.

// If a `die` or `exit` still ends the run early, fail instead of reporting success.
register_shutdown_function(
	static function (): void {
		if ( <Plugin>\Tests\Unit\Completion_Guard::$started && ! <Plugin>\Tests\Unit\Completion_Guard::$finished ) {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite -- CLI output.
			fwrite( STDERR, PHP_EOL . 'PHPUnit stopped before the last test finished: a die or exit in the code under test ended the run.' . PHP_EOL );
			exit( 1 );
		}
	}
);
```

Define the constants the repo's guards actually check (Preflight), and define them before
the autoloader. The PHPCS ignores matter because lint-staged usually runs PHPCS on staged
files explicitly, which reaches `tests/` even when `phpcs.xml.dist` doesn't list it.

## tests/phpunit/Unit/TestCase.php

```php
<?php
namespace <Plugin>\Tests\Unit;

use Brain\Monkey;
use Mockery\Adapter\Phpunit\MockeryPHPUnitIntegration;
use PHPUnit\Framework\TestCase as PHPUnit_TestCase;

abstract class TestCase extends PHPUnit_TestCase {

	use MockeryPHPUnitIntegration;

	protected function setUp(): void {
		parent::setUp();
		Monkey\setUp();
		// Real escaping, so output assertions still prove the value was escaped.
		Monkey\Functions\stubEscapeFunctions();
	}

	protected function tearDown(): void {
		Monkey\tearDown();
		parent::tearDown();
	}
}
```

## tests/phpunit/Unit/Completion_Guard.php

```php
<?php
namespace <Plugin>\Tests\Unit;

use PHPUnit\Runner\AfterLastTestHook;
use PHPUnit\Runner\BeforeFirstTestHook;

/**
 * Records whether the run reached its last test. The shutdown function in bootstrap.php
 * turns a run that started but never finished into exit 1.
 */
final class Completion_Guard implements BeforeFirstTestHook, AfterLastTestHook {

	public static bool $started = false;

	public static bool $finished = false;

	public function executeBeforeFirstTest(): void {
		self::$started = true;
	}

	public function executeAfterLastTest(): void {
		self::$finished = true;
	}
}
```

`$started` keeps `--list-tests` and `--help` from tripping the guard, since neither runs a
test. These hooks are the PHPUnit 9 extension API. Mantle Testkit or PHPUnit 10 or later
would need an event subscriber instead.

## Proving the guard (Procedure step 2)

```bash
vendor/bin/phpunit | tail -1                     # OK (N tests, …), exit 0
# Temporarily delete the WPINC define from the bootstrap, then:
vendor/bin/phpunit; echo "exit $?"               # the guard's message, exit 1 (it was 0 before the guard)
vendor/bin/phpunit --list-tests >/dev/null; echo "exit $?"   # still 0
# Restore the define.
```

## Stubbing

| The code calls | Stub with |
| --- | --- |
| `esc_attr`, `esc_html`, `esc_url` and the rest of the `esc_*()` family | Already stubbed by the base class (`stubEscapeFunctions()`) |
| `__`, `_e`, `esc_html__` and other translation functions | `Monkey\Functions\stubTranslationFunctions()` |
| A function whose result matters, e.g. `sanitize_key` | `Functions\when( 'sanitize_key' )->alias( static fn( $k ) => preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $k ) ) );` using core's own rules |
| A function whose result doesn't matter | `Functions\when( 'wp_json_encode' )->alias( 'json_encode' );` or `->justReturn( … )` |
| A WordPress class (`WP_HTML_Tag_Processor`, `WP_Block`) | Don't stub it. That test belongs in the integration layer |

Other approaches Preflight may find: WP_Mock (`WP_Mock::userFunction()`), or hand-written
stub files loaded from the bootstrap, as mantle does with `tests/shadows/`. Extend whichever
the repo already uses.
