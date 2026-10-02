# Jest → Vitest on @wordpress/scripts 36+

`@wordpress/scripts` 36 made `test-unit-js` run Vitest and retired
`@wordpress/jest-preset-default` and `@wordpress/jest-console`; `test-unit-jest` is a
maintenance-only adapter. Staying on Jest means owning about six packages WordPress no longer
develops. The upstream guide ships with scripts:
`node_modules/@wordpress/scripts/docs/vitest-migration.md`. This page covers what it leaves
to you. It was measured migrating Mantle's 44 suites (517 tests) in October 2026.

Do it in **its own commit**, after any dependency removals.

## Packages

```bash
npm uninstall jest jest-environment-jsdom babel-jest @wordpress/jest-preset-default eslint-plugin-jest
npm uninstall @wordpress/babel-preset-default     # unless another config of yours names it
npm install -D vitest@^5 vite@^8 jsdom@^26.1.0
```

Set `"test:unit": "wp-scripts test-unit-js"`. Delete `jest.config.*` and the Jest setup file.
In `eslint.config.*`, delete any override that swapped scripts' `test-unit` (Vitest) rules for
Jest's. Scripts' default config already lints test files for Vitest.

## `vitest.config.mjs`

WordPress publishes no Vitest preset, so this file and the setup file carry what the Jest
preset did.

```js
import { fileURLToPath } from 'node:url';
import { transformWithOxc } from 'vite';
import { defineConfig } from 'vitest/config';

const SRC = fileURLToPath( new URL( './src/', import.meta.url ) );

export default defineConfig( {
	plugins: [
		{
			// Source .js files contain JSX. Vite 8 picks the parser from the extension and
			// won't let config override it, so parse src/**/*.js as JSX here.
			name: 'jsx-in-js',
			enforce: 'pre',
			transform( code, id ) {
				if ( ! id.startsWith( SRC ) || ! id.endsWith( '.js' ) ) {
					return null;
				}
				return transformWithOxc( code, id, { lang: 'jsx', jsx: { runtime: 'automatic' } } );
			},
		},
	],
	resolve: { alias: { /* every alias webpack.config.js defines */ } },
	test: {
		environment: 'jsdom',
		include: [ 'src/**/__tests__/**/*.[jt]s?(x)', 'src/**/*.test.[jt]s?(x)' ],
		setupFiles: [ './vitest.setup.js' ],
		reporters: process.env.GITHUB_ACTIONS ? [ 'default', 'github-actions' ] : [ 'default' ],
	},
} );
```

- **Don't rename sources to `.jsx`.** The upstream guide suggests it, but the plugin above is
  ten lines, and it keeps `@vitejs/plugin-react-swc` and its native binary out of the tree.
  Widening `oxc.include` to `.js` doesn't work: the file is still parsed as plain JS.
- **Restrict `include` to the unit tests.** Vitest's default also matches Playwright's `*.spec.ts`.
- Vitest loads ESM natively, so Jest's `transformIgnorePatterns` list of ESM-only packages and
  any `.mjs` transform simply go away.

## `vitest.setup.js` — what the Jest preset supplied

- `globalThis.SCRIPT_DEBUG = true`, so `@wordpress/warning` reports what it would in development.
- `window.requestIdleCallback` / `cancelIdleCallback` shims; WordPress's priority queue uses them.
- Whatever jsdom lacks that your dependencies touch: `matchMedia`, `ResizeObserver`,
  `IntersectionObserver`, `Element.prototype.scrollTo`. Node already provides `fetch`,
  `Response`, `TextEncoder` and the stream classes, so drop the old polyfills for those.
- **The console contract.** `@wordpress/jest-console` failed any test that logged. Without it,
  React warnings pass silently. Recreate it:

```js
import { format } from 'node:util';
import { afterEach, beforeEach, vi } from 'vitest';

const METHODS = [ 'error', 'info', 'log', 'warn' ];
const spies = METHODS.map( ( m ) => vi.spyOn( console, m ).mockImplementation( () => {} ) );

beforeEach( () => spies.forEach( ( spy ) => spy.mockClear() ) );
afterEach( () => {
	const calls = spies.flatMap( ( spy, i ) =>
		spy.mock.calls.map( ( args ) => `console.${ METHODS[ i ] }: ${ format( ...args ) }` )
	);
	if ( calls.length ) {
		throw new Error( `Unexpected console output:\n\n${ calls.join( '\n\n' ) }` );
	}
} );
```

A test that expects output calls `vi.spyOn( console, 'warn' )`. That returns the setup's spy,
so the test asserts on it and calls `mockClear()`. It must never call `mockRestore()`, which
switches the check off for the rest of the file.

## Converting the suites

Mostly mechanical, with a few traps:

1. **Import the APIs.** No globals: `import { describe, expect, it, vi } from 'vitest';`.
   Collect only the names each file uses.
2. **`jest.` → `vi.`** Some files split `jest` and `.spyOn` across lines, which a one-line
   regex misses, so grep for a bare `jest` afterwards.
3. **Default exports in mock factories.** `jest.mock( 'x', () => jest.fn() )` must become
   `vi.mock( 'x', () => ( { default: vi.fn() } ) )`.
4. **`require()` after setting a global** (a module that reads `window.*` at import time)
   becomes a top-level `await import( './module' )`.
5. **Name collisions.** A file that defines its own `test` helper can't also import `test`.
6. **Virtual mocks.** Jest's `{ virtual: true }` has no Vitest equivalent. Alias the specifier
   to a local stub in `resolve.alias`.
7. **Comments that blamed Jest's transform** for a mock ("Jest cannot load this ESM package")
   are now false. Note them as a follow-up; many of those mocks can go.

## Verify

- The test count matches the Jest baseline exactly.
- Break one assertion's subject deliberately and watch it fail, then restore it. A suite that
  passes for the wrong reason looks identical.
- A probe test that writes to `console.warn` fails, so the console contract is live.
- `npm run lint:js` reports no new errors in test files.
