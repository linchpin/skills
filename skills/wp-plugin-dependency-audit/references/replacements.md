# Replacements

What to use instead of a package, in order of preference: something WordPress or
`@wordpress/scripts` already ships and maintains, then something the plugin already depends
on. Externalized `@wordpress/*` packages are loaded by core, so they add nothing to the bundle
or to our maintenance.

Check each row against the code before swapping. "Same job" is rarely "same API".

## npm — runtime

| Package | Replace with | Notes |
| --- | --- | --- |
| `lodash`, `lodash-es` | Native JS; `@wordpress/is-shallow-equal` for flat equality; `debounce`/`throttle` from `@wordpress/compose` | The extraction plugin externalizes lodash, so one import makes WordPress enqueue the full lodash script |
| `fast-deep-equal` and similar | `isShallowEqualObjects` from `@wordpress/is-shallow-equal`, applied per item | Only when the values are flat (strings, numbers, references). Keep a deep compare for nested data |
| `classnames` | `clsx` | WordPress packages moved to `clsx`, so it's usually already in the tree. Same call shape for ordinary use |
| `moment` | `@wordpress/date` | Externalized and aware of the site's timezone setting |
| `query-string`, `qs` (in the browser) | `addQueryArgs`, `getQueryArgs` from `@wordpress/url` | — |
| `axios`, `node-fetch` (in the browser) | `@wordpress/api-fetch` for the REST API; `fetch` otherwise | api-fetch adds the nonce and root URL |
| `react-router-dom` 7 | `react-router` 7 | v7 folded the DOM bindings into `react-router`; `-dom` is a re-export |
| `prop-types` | Delete the `propTypes` blocks (JSDoc if the shape matters) | Development-only checks; React 19 ignores them on function components |
| `react-dropzone` | `DropZone` and `FormFileUpload` from `@wordpress/components` | Different API; the editor's own drop handling |
| `react-ace`, bundled CodeMirror | Core's CodeMirror through `wp_enqueue_code_editor()` and `wp.codeEditor`, or lazy-load the editor | Ace adds about 1 MB to a bundle; core already ships CodeMirror |
| `ip-regex` and similar validators | The schema library already in use (`z.ipv4()`, `z.ipv6()` in zod) | Compare results on real inputs before swapping |
| `uuid` (in the browser) | `crypto.randomUUID()` | Secure contexts only (HTTPS or localhost). Keep `uuid` where wp-admin may be served over plain HTTP |
| `dotenv` | Usually nothing: check whether anything reads the variables. Node 20.6+ has `--env-file` and `process.loadEnvFile()` | A leftover from a tool config that no longer exists is common |

## npm — tooling

| Package | Replace with | Notes |
| --- | --- | --- |
| `webpack`, `webpack-cli`, `mini-css-extract-plugin`, `@wordpress/dependency-extraction-webpack-plugin` | Nothing; `@wordpress/scripts` provides them | Declare one only if your own config `require`s it, at scripts' range |
| `prettier`, `eslint`, `@wordpress/eslint-plugin`, `@wordpress/babel-preset-default` | Nothing; `@wordpress/scripts` provides them | Keep `@wordpress/prettier-config` if the `package.json` `prettier` field names it |
| `jest`, `babel-jest`, `jest-environment-jsdom`, `@wordpress/jest-preset-default`, `eslint-plugin-jest` | Vitest, on `@wordpress/scripts` 36+ | `jest-to-vitest.md` |

## Composer

| Package | Replace with | Notes |
| --- | --- | --- |
| `php-parallel-lint/php-parallel-lint`, `php-parallel-lint/php-console-highlighter`, `squizlabs/php_codesniffer`, `wp-coding-standards/wpcs`, `phpcompatibility/*` | Nothing, when `linchpin/coding-standards` requires them | Check the locked version's `require`; 1.1.x didn't require parallel-lint |
| `phpstan/phpstan` | Usually keep | `szepeviktor/phpstan-wordpress` and the phpstan extensions require it, but the config is written against its major |
| WP-CLI packages (`type: wp-cli-package` or `command`) in `require` | Remove from the plugin. Fold any command worth keeping into the plugin's own CLI classes | A bundled CLI package registers its commands on every client site. `geekpress/wp-rocket-cli` (a 2014 fork) did, and `wp rocket clean` fataled on WP Rocket 3.19 |
| `yoast/phpunit-polyfills` | Keep with `wp-phpunit/wp-phpunit` | WordPress's test bootstrap requires it even though nothing names it |
