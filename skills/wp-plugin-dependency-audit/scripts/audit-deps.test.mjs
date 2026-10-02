// Tests for audit-deps.mjs. Pure functions only — no disk, no network.
//
//   node --test skills/wp-plugin-dependency-audit/scripts/audit-deps.test.mjs
//
// Inputs are synthetic but reproduce what the MANTLE-515 audit of a real plugin found in
// October 2026: packages named only in config, peers that read as unused, a root tool copy
// shadowing the one @wordpress/scripts depends on, imports that resolved only by hoisting, and
// a Composer WP-CLI package nothing called that still ran on every request.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeComposer,
  analyzeNpm,
  extractSpecifiers,
  isExternalized,
  packageNameOf,
  render,
} from './audit-deps.mjs';

const verdictOf = (report, name) => report.packages.find((p) => p.name === name)?.verdict;
const pkg = (report, name) => report.packages.find((p) => p.name === name);

test('extractSpecifiers finds every way a file can reach a module', () => {
  const text = `
    import a from 'alpha';
    import { b } from "@scope/beta/sub";
    import 'side-effect';
    import type { T } from 'types-only';
    export * from 'reexport';
    export { c } from 'named-reexport';
    const d = require( 'delta' );
    const e = await import( 'epsilon' );
    require.resolve( 'zeta/package.json' );
    vi.mock( 'mocked-vi', () => ( {} ) );
    jest.mock( 'mocked-jest' );
  `;
  assert.deepEqual(extractSpecifiers(text).sort(), [
    '@scope/beta/sub', 'alpha', 'delta', 'epsilon', 'mocked-jest', 'mocked-vi',
    'named-reexport', 'reexport', 'side-effect', 'types-only', 'zeta/package.json',
  ]);
});

test('packageNameOf strips subpaths and ignores relative, builtin and URL specifiers', () => {
  assert.equal(packageNameOf('@wordpress/scripts/config/webpack.config'), '@wordpress/scripts');
  assert.equal(packageNameOf('ace-builds/src-noconflict/mode-html'), 'ace-builds');
  assert.equal(packageNameOf('./local'), null);
  assert.equal(packageNameOf('node:path'), null);
  assert.equal(packageNameOf('fs'), null);
  assert.equal(packageNameOf('https://example.com/x.js'), null);
});

test('isExternalized follows the extraction plugin: core globals yes, its bundled list no', () => {
  assert.equal(isExternalized('@wordpress/data'), true);
  assert.equal(isExternalized('react-dom/client'), true);
  assert.equal(isExternalized('lodash'), true);
  assert.equal(isExternalized('@wordpress/ui'), false);
  assert.equal(isExternalized('@wordpress/dataviews/wp'), false);
  assert.equal(isExternalized('clsx'), false);
});

const plugin = () => ({
  manifest: {
    name: 'example-plugin',
    prettier: '@wordpress/prettier-config',
    scripts: { build: 'wp-scripts build', 'test:unit': 'wp-scripts test-unit-jest', prepare: 'husky' },
    dependencies: {
      clsx: '^2.1.1',
      dotenv: '^17.0.0',
      lodash: '^4.17.21',
      '@example/ui': '^1.0.0',
      '@wordpress/admin-ui': '^2.0.0',
    },
    devDependencies: {
      '@wordpress/scripts': '^36.0.0',
      '@wordpress/prettier-config': '^4.0.0',
      '@wordpress/jest-preset-default': '^14.0.0',
      'jest-environment-jsdom': '^30.0.0',
      jest: '^30.0.0',
      husky: '^9.0.0',
      prettier: 'npm:wp-prettier@3.9.6',
      'webpack-cli': '^7.0.0',
      'mini-css-extract-plugin': '^2.0.0',
    },
    overrides: { clsx: '2.1.1' },
  },
  lock: {
    packages: {
      'node_modules/@wordpress/scripts': {
        version: '36.0.0',
        bin: { 'wp-scripts': 'bin/wp-scripts.js' },
        dependencies: { 'webpack-cli': '^5.1.4', 'mini-css-extract-plugin': '^2.9.2', prettier: 'npm:wp-prettier@^3.9.6' },
      },
      'node_modules/@wordpress/scripts/node_modules/webpack-cli': { version: '5.1.4' },
      'node_modules/webpack-cli': { version: '7.2.3', bin: { 'webpack-cli': 'bin/cli.js' } },
      'node_modules/mini-css-extract-plugin': { version: '2.10.2' },
      'node_modules/@wordpress/prettier-config': { version: '4.56.0', peerDependencies: { prettier: '>=3' } },
      'node_modules/prettier': { version: '3.9.6', bin: { prettier: 'bin/prettier.cjs' } },
      'node_modules/@example/ui': { version: '1.0.0', peerDependencies: { '@wordpress/admin-ui': '>=2' } },
      'node_modules/@wordpress/admin-ui': { version: '2.11.0' },
      'node_modules/husky': { version: '9.1.7', bin: { husky: 'bin.js' } },
      'node_modules/jest': { version: '30.5.2', bin: { jest: 'bin/jest.js' } },
      'node_modules/@wordpress/compose': { version: '8.9.0' },
      'node_modules/clsx': { version: '2.1.1' },
      'node_modules/lodash': { version: '4.17.21' },
    },
  },
  sources: [
    { path: 'src/index.js', text: "import clsx from 'clsx';\nimport { isEqual } from 'lodash';\nimport { Page } from '@example/ui';\nimport { useDebounce } from '@wordpress/compose';\nimport { PluginSidebar } from '@wordpress/editor';\nimport { thing } from '@slots';" },
    { path: 'src/__tests__/index.test.js', text: "import { act } from 'react';" },
  ],
  configs: [
    { path: 'jest.config.js', text: "module.exports = { preset: '@wordpress/jest-preset-default' };" },
    { path: 'webpack.config.js', text: "alias: { '@slots': path.resolve( __dirname, './src/slots' ), 'date-fns': path.resolve( __dirname, 'node_modules/date-fns' ) }" },
  ],
  commands: ['npx lint-staged --concurrent false'],
});

test('analyzeNpm sorts declared packages into keep, provided, consider and unused', () => {
  const r = analyzeNpm(plugin());
  assert.equal(verdictOf(r, 'dotenv'), 'unused');
  assert.equal(verdictOf(r, 'webpack-cli'), 'provided');
  assert.equal(verdictOf(r, 'mini-css-extract-plugin'), 'provided');
  assert.equal(verdictOf(r, 'clsx'), 'keep');
  assert.equal(verdictOf(r, 'husky'), 'keep', 'a CLI the project runs is a reference');
});

test('a package named only in config is kept, not reported unused', () => {
  const r = analyzeNpm(plugin());
  assert.equal(verdictOf(r, '@wordpress/jest-preset-default'), 'keep');
  assert.equal(verdictOf(r, '@wordpress/prettier-config'), 'keep', 'the package.json prettier field names it');
});

test('a required peer is kept, unless another dependency already installs it', () => {
  const r = analyzeNpm(plugin());
  assert.equal(verdictOf(r, '@wordpress/admin-ui'), 'keep', 'peer of @example/ui, provided by nobody');
  assert.equal(verdictOf(r, 'prettier'), 'consider', 'peer of prettier-config, but wp-scripts installs it');
  assert.ok(!pkg(r, 'prettier').reasons.some((x) => x.startsWith('named in')), 'the "prettier" key is not a reference');
});

test('test-runner packages a wp-scripts command or a convention loads are kept', () => {
  const r = analyzeNpm(plugin());
  assert.equal(verdictOf(r, 'jest'), 'keep');
  assert.equal(verdictOf(r, 'jest-environment-jsdom'), 'keep');
});

test('a root copy that differs in major from the toolchain copy is reported as shadowing', () => {
  const r = analyzeNpm(plugin());
  assert.deepEqual(pkg(r, 'webpack-cli').shadowed, [
    { provider: '@wordpress/scripts', theirs: '5.1.4', ours: '7.2.3' },
  ]);
});

test('undeclared imports are split into hoisted and not installed, aliases excluded', () => {
  const r = analyzeNpm(plugin());
  const byName = Object.fromEntries(r.undeclared.map((u) => [u.name, u]));
  assert.equal(byName['@wordpress/compose'].installed, true);
  assert.equal(byName['@wordpress/compose'].externalized, true);
  assert.equal(byName['@wordpress/editor'].installed, false);
  assert.equal(byName.react.testOnly, true);
  assert.equal(byName['@slots'], undefined, 'a webpack alias is not a package');
});

test('lodash is flagged for enqueuing core lodash, and clsx as bundled', () => {
  const r = analyzeNpm(plugin());
  assert.equal(pkg(r, 'lodash').heavyExternal, 'lodash');
  assert.equal(pkg(r, 'clsx').bundled, true);
  assert.equal(pkg(r, '@wordpress/scripts').bundled, null, 'tooling is never bundled');
});

test('findings cover the retired Jest preset, aliases into node_modules, and bad overrides', () => {
  const r = analyzeNpm(plugin());
  const ids = r.findings.map((f) => f.id);
  assert.ok(ids.includes('jest-on-retired-preset'));
  assert.ok(ids.includes('alias-into-node-modules'));
  assert.equal(r.overrides[0].name, 'clsx');
});

test('analyzeComposer finds the unused CLI package and the lint tools a standard provides', () => {
  const r = analyzeComposer({
    manifest: {
      require: { php: '^8.2', 'geekpress/wp-rocket-cli': '^1.0', 'wordpress/mcp-adapter': '^0.6' },
      'require-dev': {
        'linchpin/coding-standards': '1.3.1',
        'php-parallel-lint/php-parallel-lint': '^1.4',
        'php-parallel-lint/php-console-highlighter': '^1.0',
      },
      scripts: { 'php-lint': 'parallel-lint --exclude vendor .' },
    },
    lock: {
      packages: [
        { name: 'geekpress/wp-rocket-cli', version: '1.0', type: 'command', autoload: { files: ['wp-rocket-cli.php'] }, time: '2014-05-23T18:29:43+00:00' },
        { name: 'wordpress/mcp-adapter', version: 'v0.6.1', type: 'wordpress-plugin', autoload: { 'psr-4': { 'WP\\MCP\\': 'includes/' } } },
      ],
      'packages-dev': [
        { name: 'linchpin/coding-standards', type: 'phpcodesniffer-standard', require: { 'php-parallel-lint/php-parallel-lint': '^1.4', 'php-parallel-lint/php-console-highlighter': '^1.0' } },
        { name: 'php-parallel-lint/php-parallel-lint', bin: ['parallel-lint'] },
        { name: 'php-parallel-lint/php-console-highlighter' },
      ],
    },
    phpSources: [{ path: 'includes/Server.php', text: '<?php\nuse WP\\MCP\\Core\\McpAdapter;' }],
    configs: [],
    commands: [],
  });
  assert.equal(verdictOf(r, 'geekpress/wp-rocket-cli'), 'unused');
  assert.equal(pkg(r, 'geekpress/wp-rocket-cli').cliPackage, true);
  assert.deepEqual(pkg(r, 'geekpress/wp-rocket-cli').sideEffectFiles, ['wp-rocket-cli.php']);
  assert.equal(verdictOf(r, 'wordpress/mcp-adapter'), 'keep');
  assert.equal(verdictOf(r, 'php-parallel-lint/php-parallel-lint'), 'consider');
  assert.equal(verdictOf(r, 'php-parallel-lint/php-console-highlighter'), 'provided');
  assert.equal(r.packages.some((p) => p.name === 'php'), false, 'platform requirements are not packages');
});

test('render groups findings by decision and lists stale Composer locks', () => {
  const npm = analyzeNpm(plugin());
  const composer = analyzeComposer({
    manifest: { require: { 'geekpress/wp-rocket-cli': '^1.0' } },
    lock: { packages: [{ name: 'geekpress/wp-rocket-cli', version: '1.0', type: 'command', autoload: { files: ['x.php'] }, time: '2014-05-23T18:29:43+00:00' }] },
  });
  const md = render({ repo: 'example', ref: 'main@abc123', npm: [npm], composer }, { now: new Date('2026-10-02T00:00:00Z') });
  assert.match(md, /### No reference found\n\n\| Package \| Section \| Range \|[\s\S]*`dotenv`/);
  assert.match(md, /root 7\.2\.3 overrides @wordpress\/scripts's 5\.1\.4/);
  assert.match(md, /### Imported but not declared/);
  assert.match(md, /\*\*not installed\*\*/);
  assert.match(md, /### Runtime packages that execute on load[\s\S]*geekpress\/wp-rocket-cli/);
  assert.match(md, /### Locked release older than 2 years[\s\S]*2014-05-23/);
});

// Cases found by running the script against linchpin-blocks, psst and courier-notices.

test('a virtual mock is not an import of an installed package', () => {
  const text = "jest.mock( 'three', () => ( {} ), { virtual: true } );\njest.mock( 'real', () => ( {} ) );";
  assert.deepEqual(extractSpecifiers(text), ['real']);
});

test('a moduleNameMapper entry that maps a real package to a mock still counts as using it', () => {
  const r = analyzeNpm({
    manifest: { dependencies: { '@wordpress/interactivity': '^6.0.0' } },
    lock: { packages: { 'node_modules/@wordpress/interactivity': { version: '6.56.0' } } },
    sources: [{ path: 'src/polyfill.js', text: "import { store } from '@wordpress/interactivity';" }],
    configs: [{ path: 'jest.config.js', text: "moduleNameMapper: { '^@wordpress/interactivity$': '<rootDir>/tests/__mocks__/interactivity.js' }" }],
  });
  assert.equal(verdictOf(r, '@wordpress/interactivity'), 'keep');
});

test('code a root test reaches in a nested package counts for the root, without undeclared noise', () => {
  const r = analyzeNpm({
    manifest: { devDependencies: { '@wordpress/date': '^5.0.0' } },
    lock: { packages: { 'node_modules/@wordpress/date': { version: '5.56.0' } } },
    sources: [{ path: 'tests/jest/timeline.test.js', text: "import '../../blocks/src/timeline/view';" }],
    reached: [{ path: 'blocks/src/timeline/view.js', text: "import { dateI18n } from '@wordpress/date';\nimport Swiper from 'swiper';" }],
  });
  assert.equal(verdictOf(r, '@wordpress/date'), 'keep');
  assert.equal(r.undeclared.length, 0, 'the nested package declares what its own code imports');
});

test('a node_modules path in config is a reference', () => {
  const r = analyzeNpm({
    manifest: { dependencies: { 'what-input': '5.2.12' } },
    configs: [{ path: 'webpack.config.js', text: "patterns: [ { from: 'node_modules/what-input/dist/what-input.min.js' } ]" }],
  });
  assert.equal(verdictOf(r, 'what-input'), 'keep');
});

test('a WP-CLI package is used through its subcommand, and the WP test bootstrap needs the polyfills', () => {
  const r = analyzeComposer({
    manifest: {
      'require-dev': { 'wp-cli/i18n-command': '^2.6', 'yoast/phpunit-polyfills': '^4.0', 'wp-phpunit/wp-phpunit': '^6.8' },
      scripts: { 'i18n:pot': 'wp i18n make-pot . languages/example.pot' },
    },
    lock: { packages: [], 'packages-dev': [
      { name: 'wp-cli/i18n-command', type: 'wp-cli-package' },
      { name: 'yoast/phpunit-polyfills', type: 'library', autoload: { files: ['phpunitpolyfills-autoload.php'] } },
      { name: 'wp-phpunit/wp-phpunit', type: 'library' },
    ] },
    phpSources: [{ path: 'tests/bootstrap.php', text: "<?php\nrequire getenv( 'WP_PHPUNIT__DIR' ) . '/includes/bootstrap.php';" }],
  });
  assert.equal(verdictOf(r, 'wp-cli/i18n-command'), 'keep');
  assert.equal(verdictOf(r, 'yoast/phpunit-polyfills'), 'keep');
});

test('a stylesheet that pulls a declared package from node_modules counts as using it', () => {
  const r = analyzeNpm({
    manifest: { dependencies: { swiper: '^11.0.0' } },
    sources: [{ path: 'src/slider/style.scss', text: "@use 'swiper/css';\n@import 'variables';" }],
  });
  assert.equal(verdictOf(r, 'swiper'), 'keep');
  assert.equal(r.undeclared.length, 0, 'a Sass partial is not a package');
});
