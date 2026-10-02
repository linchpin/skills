#!/usr/bin/env node
// Inventory a WordPress plugin's declared dependencies against what its code, config and
// toolchain actually use, for the wp-plugin-dependency-audit skill.
// Zero dependencies — Node >= 18. Works on a fresh clone: it reads lockfiles, not node_modules.
//
//   node audit-deps.mjs                    # the repo in the current directory
//   node audit-deps.mjs --root ../psst     # another checkout
//   node audit-deps.mjs --json             # machine-readable, same data
//   node audit-deps.mjs --registry         # also ask npm and Packagist when each package last shipped
//   node audit-deps.mjs --stale-years 3    # what counts as stale with --registry (default 2)
//
// READ-ONLY. It reads manifests, lockfiles, config and source files, and runs `git rev-parse`.
// With --registry it also runs `npm view` and GETs repo.packagist.org. It never installs,
// removes, or writes anything; the skill decides what to do with what it reports.
//
// Why a script and not prose: the misses it prevents are the ones agents make when they
// hand-roll `grep` every run. A package named only as a string in a config file (a Jest preset,
// the package.json `prettier` field) reads as unused. A required peer of another dependency
// reads as unused. A root copy of a tool that @wordpress/scripts also depends on looks fine
// until you notice it overrides the version scripts was tested with. An import that resolves
// only through hoisting looks declared. And nobody remembers which packages the extraction
// plugin externalizes, so nobody knows what actually ships.
//
// extractSpecifiers(), analyzeNpm(), analyzeComposer() and render() are pure and exported for
// scripts/audit-deps.test.mjs. Only collect() and fetchRegistry() touch the disk or network.

import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

// --- Shapes -------------------------------------------------------------------------------

const CODE_EXT = /\.(?:[cm]?js|jsx|tsx?)$/;
const STYLE_EXT = /\.(?:s[ac]ss|css)$/;
const TEST_FILE = /(?:^|\/)(?:__tests__|tests?)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/;
// Build, lint and release tooling: imports here never reach the plugin's bundle.
const TOOLING_FILE = /(?:^|\/)(?:scripts|bin|tools|\.github|\.husky)\/|(?:^|\/)[\w.-]+\.config\.[cm]?[jt]s$|(?:^|\/)\.[\w-]+rc\.[cm]?js$/;
const SKIP_DIRS = new Set([
  'node_modules', 'vendor', 'build', 'dist', 'third-party', '.git', '.claude', '.agents',
  '.codex', 'coverage', 'test-results', 'playwright-report', 'languages', '.wordpress-org',
  'wp-content',
]);
// Dot-directories are caches and tool state (.wp-env-e2e, .cache, .turbo) except these two.
const KEEP_DOT_DIRS = new Set(['.github', '.husky']);
// Tool config that names packages as strings rather than importing them.
const CONFIG_FILE = /^(?:\.[\w-]+rc(?:\.(?:[cm]?js|json|ya?ml))?|[\w.-]+\.config\.(?:[cm]?js|ts|json)|\.babelrc|tsconfig[\w.-]*\.json|composer\.json)$/;
const PHP_CONFIG_FILE = /^(?:phpcs\.xml(?:\.dist)?|\.phpcs\.xml(?:\.dist)?|phpstan\.neon(?:\.dist)?|phpstan[\w.-]*\.neon|phpunit\.xml(?:\.dist)?|\.php-cs-fixer(?:\.dist)?\.php|scoper\.inc\.php|rector\.php|psalm\.xml(?:\.dist)?)$/;
const MAX_FILE_BYTES = 1_000_000;

// The extraction plugin's own list (v6.56) of @wordpress packages it bundles rather than
// externalizes. Read from node_modules when installed; this is the fallback.
const DEWP_BUNDLED_FALLBACK = [
  '@wordpress/admin-ui', '@wordpress/dataviews', '@wordpress/dataviews/wp', '@wordpress/fields',
  '@wordpress/global-styles-engine', '@wordpress/global-styles-ui', '@wordpress/grid',
  '@wordpress/icons', '@wordpress/interface', '@wordpress/kebab-case',
  '@wordpress/style-runtime', '@wordpress/ui', '@wordpress/undo-manager', '@wordpress/views',
];
// Externalized to a core script that is heavy for what plugins typically use from it.
const HEAVY_EXTERNALS = { lodash: 'lodash', 'lodash-es': 'lodash', moment: 'moment', jquery: 'jquery' };
const EXTERNAL_NON_WP = new Set(['react', 'react-dom', 'lodash', 'lodash-es', 'moment', 'jquery']);
// wp-scripts subcommands that need a runner the project must install itself (scripts 36+).
const WP_SCRIPTS_COMMAND_NEEDS = {
  'test-unit-jest': ['jest'],
  'test-unit-js': ['vitest', 'vite'],
  'test-playwright': ['@playwright/test'],
};
// Packages a tool loads by convention from a setting, so no file names the package itself.
const CONVENTIONS = [
  {
    pkg: 'jest-environment-jsdom',
    why: "Jest's jsdom environment",
    when: ({ declared, configText }) => declared.has('@wordpress/jest-preset-default') || /testEnvironment\W+jsdom/.test(configText),
  },
  {
    pkg: 'jsdom',
    why: 'the jsdom test environment',
    when: ({ configText }) => /environment\W+jsdom/.test(configText),
  },
  {
    pkg: 'happy-dom',
    why: 'the happy-dom test environment',
    when: ({ configText }) => /environment\W+happy-dom/.test(configText),
  },
];
// Composer packages a tool requires by convention without a composer.json `require` of its own.
const COMPOSER_CONVENTIONS = [
  {
    pkg: 'yoast/phpunit-polyfills',
    why: "WordPress's PHPUnit bootstrap requires it (WP_TESTS_PHPUNIT_POLYFILLS_PATH)",
    when: ({ declared, phpText }) => declared.has('wp-phpunit/wp-phpunit') || /WP_TESTS_DIR|WP_PHPUNIT__DIR|includes\/bootstrap\.php/.test(phpText),
  },
];
const COMPOSER_PLATFORM = /^(?:php|hhvm|ext-.+|lib-.+|composer-plugin-api|composer-runtime-api|composer)$/;
const COMPOSER_IMPLICIT_TYPES = new Set([
  'composer-plugin', 'phpcodesniffer-standard', 'phpstan-extension',
]);
const BUILTINS = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

// --- Pure: specifiers ---------------------------------------------------------------------

/** Every module specifier a JS/TS file references: import, export-from, require, mocks. */
export function extractSpecifiers(text) {
  const found = new Set();
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[\w*{}\s,$]+?\s+from\s+)?['"]([^'"\n]+)['"]/g,
    /\bexport\s+(?:type\s+)?(?:\*(?:\s+as\s+\w+)?|\{[^}]*\})\s+from\s+['"]([^'"\n]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
    /\brequire(?:\.resolve)?\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) found.add(m[1]);
  }
  // A virtual mock stands in for a module that is deliberately not installed here.
  const mockRe = /\b(?:jest|vi)\.(?:mock|doMock|requireActual|importActual|unmock)\s*\(\s*['"]([^'"\n]+)['"]/g;
  for (const m of text.matchAll(mockRe)) {
    if (!/virtual\s*:\s*true/.test(callArguments(text, m.index + m[0].indexOf('(')))) found.add(m[1]);
  }
  return [...found];
}

/** The text between the parenthesis at `open` and its match; strings are not special-cased. */
function callArguments(text, open) {
  let depth = 0;
  for (let i = open; i < text.length && i < open + 20000; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return text.slice(open, i + 1);
  }
  return text.slice(open, open + 20000);
}

/**
 * Packages a stylesheet pulls from node_modules: `@use '~pkg/x'`, or a bare specifier naming a
 * declared package. Bare names that aren't declared are Sass partials, not packages.
 */
export function extractStyleSpecifiers(text, declared = new Set()) {
  const found = new Set();
  for (const m of text.matchAll(/@(?:import|use|forward)\s+(?:url\(\s*)?['"]([^'"\n]+)['"]/g)) {
    const spec = m[1].startsWith('~') ? m[1].slice(1) : m[1];
    const name = packageNameOf(spec);
    if (name && (m[1].startsWith('~') || declared.has(name))) found.add(spec);
  }
  return [...found];
}

/** `@scope/name/sub` → `@scope/name`; `name/sub` → `name`; relative, builtin and URL → null. */
export function packageNameOf(spec) {
  if (!spec || /^[./]/.test(spec) || /^[a-z]+:\/\//i.test(spec) || BUILTINS.has(spec)) return null;
  if (spec.startsWith('node:')) return null;
  const parts = spec.split('/');
  const name = spec.startsWith('@') ? (parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null) : parts[0];
  // Rejects code that only looks like a specifier: template strings, URLs built at runtime.
  return name && /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i.test(name) ? name : null;
}

/** Whether the extraction plugin turns this request into a WordPress global. */
export function isExternalized(spec, bundled = DEWP_BUNDLED_FALLBACK) {
  if (bundled.includes(spec)) return false;
  if (spec.startsWith('@wordpress/')) return !bundled.includes(packageNameOf(spec));
  return EXTERNAL_NON_WP.has(packageNameOf(spec)) || spec === 'react/jsx-runtime';
}

const major = (v) => {
  const m = String(v || '').match(/(\d+)/);
  return m ? Number(m[1]) : null;
};
// A package name as a string value, or as a subpath (`name/x`) — but not as an object key, so
// the package.json `"prettier": …` field doesn't count as a reference to `prettier`.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const quoted = (name) => new RegExp(`['"\`]${escapeRe(name)}(?:['"\`](?!\\s*:)|/)`);
// In JS config a package name may be a key (a moduleNameMapper entry, an alias), and may be
// anchored as a regex: `'^@wordpress/interactivity$': …` still says the package is in use.
const quotedLoose = (name) => new RegExp(`['"\`]\\^?${escapeRe(name)}(?:\\$?['"\`]|/)`);
const tokensOf = (text) => new Set(
  String(text || '').split(/[\s;&|()'"`=,]+/).filter(Boolean).map((t) => t.split('/').pop())
);
const lockEntry = (lock, name) => lock?.packages?.[`node_modules/${name}`];

// --- Pure: npm ----------------------------------------------------------------------------

/**
 * One package root: a package.json, its lockfile, and the files it owns.
 *
 * input = { dir, manifest, lock, sources: [{path,text}], configs: [{path,text}],
 *           commands: [string], bundled: [string] | null }
 */
export function analyzeNpm(input) {
  const { dir = '', manifest = {}, lock = null, sources = [], configs = [], commands = [] } = input;
  const bundled = input.bundled || DEWP_BUNDLED_FALLBACK;
  const declared = new Map();
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const [name, range] of Object.entries(manifest[section] || {})) {
      declared.set(name, { name, section, range });
    }
  }

  // Aliases a bundler or test runner resolves, so their specifiers aren't reported as packages.
  const aliases = new Set();
  const nodeModulesAliases = [];
  for (const c of configs) {
    for (const m of c.text.matchAll(/['"]\^?([@\w][\w@/.-]*?)\$?['"]\s*:\s*(?:path\.(?:resolve|join)|require\.resolve|fileURLToPath|new URL|`|['"]<rootDir>)/g)) {
      aliases.add(m[1]);
    }
    for (const m of c.text.matchAll(/['"]([@\w][\w@/.-]*)['"]\s*:\s*path\.(?:resolve|join)\([^)]*?['"`][^'"`]*node_modules\/([^'"`)]+)['"`]/g)) {
      nodeModulesAliases.push({ file: c.path, alias: m[1], target: m[2] });
    }
  }

  // What the code imports.
  const imports = new Map();
  const declaredNames = new Set(declared.keys());
  for (const file of sources) {
    const specs = STYLE_EXT.test(file.path)
      ? extractStyleSpecifiers(file.text, declaredNames)
      : extractSpecifiers(file.text);
    for (const spec of specs) {
      const name = packageNameOf(spec);
      if (!name || name === manifest.name) continue;
      if ((aliases.has(name) || aliases.has(spec)) && !declared.has(name) && !lockEntry(lock, name)) continue;
      const entry = imports.get(name) || { name, files: new Set(), specs: new Set(), shippingSpecs: new Set(), testOnly: true };
      entry.files.add(file.path);
      entry.specs.add(spec);
      if (!TEST_FILE.test(file.path)) entry.testOnly = false;
      if (!TEST_FILE.test(file.path) && !TOOLING_FILE.test(file.path)) entry.shippingSpecs.add(spec);
      imports.set(name, entry);
    }
  }

  // What config names as a string, and the package.json fields that act as config.
  const manifestAsConfig = { ...manifest };
  for (const k of ['name', 'version', 'dependencies', 'devDependencies', 'optionalDependencies',
    'peerDependencies', 'overrides', 'scripts', 'description', 'repository', 'bugs', 'author']) {
    delete manifestAsConfig[k];
  }
  const manifestConfig = { path: 'package.json', text: JSON.stringify(manifestAsConfig) };
  const configTexts = [...configs, manifestConfig];
  const configRefs = new Map();
  for (const name of declared.keys()) {
    const loose = quotedLoose(name);
    const hits = configs.filter((c) => loose.test(c.text)).map((c) => c.path);
    const viaPath = new RegExp(`node_modules/${escapeRe(name)}(?:[/'"\`]|$)`);
    for (const c of configs) if (!hits.includes(c.path) && viaPath.test(c.text)) hits.push(c.path);
    if (quoted(name).test(manifestConfig.text)) hits.push('package.json');
    if (hits.length) configRefs.set(name, hits);
  }

  // Code in another package root that this one's files import by relative path (a root test
  // importing blocks/src/…): whatever that code imports must resolve from here too.
  const reachedRefs = new Map();
  for (const file of input.reached || []) {
    for (const spec of extractSpecifiers(file.text)) {
      const name = packageNameOf(spec);
      if (name && declared.has(name)) reachedRefs.set(name, [...(reachedRefs.get(name) || []), file.path]);
    }
  }

  // CLI binaries the project's own commands run.
  const commandTexts = [...Object.values(manifest.scripts || {}), ...commands];
  const commandTokens = tokensOf(commandTexts.join('\n'));
  const binRefs = new Map();
  for (const name of declared.keys()) {
    const bins = Object.keys(lockEntry(lock, name)?.bin || {});
    const used = bins.filter((b) => commandTokens.has(b));
    if (used.length) binRefs.set(name, used);
  }
  const runnerNeeds = new Map();
  for (const [sub, needs] of Object.entries(WP_SCRIPTS_COMMAND_NEEDS)) {
    if (!commandTokens.has(sub)) continue;
    for (const n of needs) runnerNeeds.set(n, `wp-scripts ${sub}`);
  }

  // Required (non-optional) peers of other declared packages.
  const peerOf = new Map();
  const providers = new Map();
  for (const name of declared.keys()) {
    const e = lockEntry(lock, name);
    if (!e) continue;
    const optional = e.peerDependenciesMeta || {};
    for (const peer of Object.keys(e.peerDependencies || {})) {
      if (optional[peer]?.optional || !declared.has(peer)) continue;
      peerOf.set(peer, [...(peerOf.get(peer) || []), name]);
    }
    for (const dep of Object.keys({ ...e.dependencies, ...e.optionalDependencies })) {
      if (!declared.has(dep) || dep === name) continue;
      providers.set(dep, [...(providers.get(dep) || []), name]);
    }
  }

  const conventionText = configTexts.map((c) => c.text).join('\n');
  const convention = new Map(
    CONVENTIONS.filter((c) => declared.has(c.pkg) && c.when({ declared, configText: conventionText }))
      .map((c) => [c.pkg, c.why])
  );
  const hasTs = sources.some((s) => /\.tsx?$/.test(s.path));
  const buildsWithDewp = declared.has('@wordpress/scripts') ||
    declared.has('@wordpress/dependency-extraction-webpack-plugin');

  // Classify every declared package. First matching reason wins.
  const packages = [];
  for (const d of declared.values()) {
    const imp = imports.get(d.name);
    const reasons = [];
    if (imp) reasons.push(imp.testOnly ? 'imported by tests' : 'imported');
    if (reachedRefs.has(d.name)) reasons.push(`imported by ${reachedRefs.get(d.name)[0]}, which this package's code imports`);
    if (configRefs.has(d.name)) reasons.push(`named in ${configRefs.get(d.name).join(', ')}`);
    if (binRefs.has(d.name)) reasons.push(`runs \`${binRefs.get(d.name).join('`, `')}\``);
    if (runnerNeeds.has(d.name)) reasons.push(`needed by \`${runnerNeeds.get(d.name)}\``);
    if (peerOf.has(d.name)) reasons.push(`required peer of ${peerOf.get(d.name).join(', ')}`);
    if (convention.has(d.name)) reasons.push(`loaded by convention: ${convention.get(d.name)}`);
    if (d.name.startsWith('@types/') && hasTs) reasons.push('types for TypeScript sources');
    if (d.name === 'typescript' && hasTs) reasons.push('TypeScript sources');
    const provided = providers.get(d.name) || [];
    let verdict;
    if (imp || reachedRefs.has(d.name) || configRefs.has(d.name) || runnerNeeds.has(d.name) || convention.has(d.name) ||
      reasons.some((r) => r.startsWith('types') || r === 'TypeScript sources')) {
      verdict = 'keep';
    } else if (binRefs.has(d.name) || peerOf.has(d.name)) {
      // Needed only as a CLI or to satisfy a peer. If another dependency already installs it,
      // that copy does the job and the root declaration only pins a second version.
      verdict = provided.length ? 'consider' : 'keep';
    } else {
      verdict = provided.length ? 'provided' : 'unused';
    }
    const shadowed = provided
      .map((p) => {
        const nested = lock?.packages?.[`node_modules/${p}/node_modules/${d.name}`];
        const top = lockEntry(lock, d.name);
        return nested && top && major(nested.version) !== major(top.version)
          ? { provider: p, theirs: nested.version, ours: top.version }
          : null;
      })
      .filter(Boolean);
    packages.push({
      ...d,
      verdict,
      reasons,
      providedBy: provided,
      shadowed,
      bundled: imp && buildsWithDewp && imp.shippingSpecs.size
        ? [...imp.shippingSpecs].some((s) => !isExternalized(s, bundled))
        : null,
      heavyExternal: imp && buildsWithDewp && imp.shippingSpecs.size && HEAVY_EXTERNALS[d.name]
        ? HEAVY_EXTERNALS[d.name]
        : null,
    });
  }

  // Imported but never declared.
  const undeclared = [...imports.values()]
    .filter((i) => !declared.has(i.name))
    .map((i) => ({
      name: i.name,
      files: [...i.files].sort(),
      testOnly: i.testOnly,
      installed: Boolean(lockEntry(lock, i.name)),
      // Node resolution walks up, so blocks/src can load a package only the root installs.
      viaAncestor: lockEntry(lock, i.name) ? null : (input.ancestors || []).find((a) => a.installed.has(i.name)) || null,
      externalized: buildsWithDewp && i.shippingSpecs.size
        ? [...i.shippingSpecs].every((s) => isExternalized(s, bundled))
        : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Overrides that npm will refuse, or that no longer match anything.
  const overrides = [];
  for (const [name, value] of Object.entries(manifest.overrides || {})) {
    if (declared.has(name) && typeof value === 'string' && value !== `$${name}`) {
      overrides.push({ name, value, problem: `declared directly too, so npm rejects it (EOVERRIDE) unless it is "$${name}"` });
    }
  }

  const findings = [];
  const wpScripts = declared.get('@wordpress/scripts');
  const jestish = ['jest', '@wordpress/jest-preset-default', 'babel-jest', 'jest-environment-jsdom']
    .filter((n) => declared.has(n));
  if (wpScripts && major(wpScripts.range) >= 36 && jestish.length) {
    findings.push({
      id: 'jest-on-retired-preset',
      message: `Unit tests run on Jest (${jestish.join(', ')}) but @wordpress/scripts ${wpScripts.range} targets Vitest; @wordpress/jest-preset-default and @wordpress/jest-console are retired.`,
    });
  }
  if (wpScripts && major(wpScripts.range) < 36 && commandTokens.has('test-unit-js')) {
    findings.push({
      id: 'test-unit-js-before-36',
      message: `\`wp-scripts test-unit-js\` runs Jest on @wordpress/scripts ${wpScripts.range} and switches to Vitest at 36. Plan the runner change with that upgrade.`,
    });
  }
  for (const a of nodeModulesAliases) {
    findings.push({
      id: 'alias-into-node-modules',
      message: `${a.file} aliases \`${a.alias}\` to node_modules/${a.target}: it bypasses the package's \`exports\` (often forcing its CommonJS build into the bundle) and depends on a hoisting layout nobody declared.`,
    });
  }

  return {
    dir,
    name: manifest.name || null,
    declaredCount: declared.size,
    wpScripts: wpScripts?.range || null,
    buildsWithDewp,
    packages: packages.sort((a, b) => a.name.localeCompare(b.name)),
    undeclared,
    overrides,
    findings,
  };
}

// --- Pure: Composer -----------------------------------------------------------------------

/**
 * input = { manifest, lock, phpSources: [{path,text}], configs: [{path,text}], commands: [string] }
 */
export function analyzeComposer(input) {
  const { manifest = {}, lock = null, phpSources = [], configs = [], commands = [] } = input;
  const locked = new Map();
  for (const p of [...(lock?.packages || []), ...(lock?.['packages-dev'] || [])]) locked.set(p.name, p);

  const declared = new Map();
  for (const section of ['require', 'require-dev']) {
    for (const [name, range] of Object.entries(manifest[section] || {})) {
      if (COMPOSER_PLATFORM.test(name)) continue;
      declared.set(name, { name, section, range });
    }
  }

  const phpText = phpSources.map((s) => s.text).join('\n');
  const configText = configs.map((c) => c.text).join('\n');
  // `extra` is left out on purpose: an installer-paths entry proves a package is installed,
  // not that anything uses it.
  const manifestText = JSON.stringify({
    autoload: manifest.autoload, 'autoload-dev': manifest['autoload-dev'], scripts: manifest.scripts,
  });
  const commandText = [...Object.values(manifest.scripts || {}).flat(), ...commands].join('\n');
  const commandTokens = tokensOf([...Object.values(manifest.scripts || {}).flat(), ...commands].join('\n'));

  const providers = new Map();
  for (const name of declared.keys()) {
    for (const dep of Object.keys(locked.get(name)?.require || {})) {
      if (declared.has(dep) && dep !== name) providers.set(dep, [...(providers.get(dep) || []), name]);
    }
  }

  const packages = [];
  for (const d of declared.values()) {
    const p = locked.get(d.name) || {};
    const reasons = [];
    const namespaces = Object.keys({ ...p.autoload?.['psr-4'], ...p.autoload?.['psr-0'] })
      .map((ns) => ns.replace(/\\+$/, ''))
      .filter(Boolean);
    const nsHit = namespaces.find((ns) => phpText.includes(`${ns}\\`) || phpText.includes(`${ns.replace(/\\/g, '\\\\')}\\\\`));
    if (nsHit) reasons.push(`uses \`${nsHit}\\\``);
    const pathRe = new RegExp(`vendor/${escapeRe(d.name)}\\b`);
    if (pathRe.test(phpText) || pathRe.test(manifestText) || pathRe.test(commandText)) reasons.push(`loads vendor/${d.name}`);
    if (pathRe.test(configText) || configs.some((c) => c.text.includes(d.name))) reasons.push('named in tool config');
    const bins = (p.bin || []).map((b) => b.split('/').pop());
    const usedBins = bins.filter((b) => commandTokens.has(b));
    if (usedBins.length) reasons.push(`runs \`${usedBins.join('`, `')}\``);
    if (COMPOSER_IMPLICIT_TYPES.has(p.type)) reasons.push(`${p.type}, loaded by Composer or its tool`);
    // A WP-CLI package is used through its subcommand, never a binary of its own.
    const sub = /^wp-cli\/(.+?)-command$/.exec(d.name)?.[1];
    if (sub && new RegExp(`\\bwp\\s+${escapeRe(sub)}\\b`).test(commandText)) reasons.push(`runs \`wp ${sub}\``);
    const conv = COMPOSER_CONVENTIONS.find((c) => c.pkg === d.name && c.when({ declared, phpText }));
    if (conv) reasons.push(`loaded by convention: ${conv.why}`);
    const provided = providers.get(d.name) || [];
    const direct = reasons.some((r) => r.startsWith('uses') || r.startsWith('loads') || r.startsWith('loaded by convention'));
    let verdict;
    if (direct || reasons.some((r) => r === 'named in tool config')) verdict = 'keep';
    else if (reasons.length) verdict = provided.length ? 'consider' : 'keep';
    else verdict = provided.length ? 'provided' : 'unused';

    const filesAutoload = p.autoload?.files || [];
    packages.push({
      ...d,
      type: p.type || null,
      lockedVersion: p.version || null,
      released: p.time || null,
      abandoned: p.abandoned ?? null,
      verdict,
      reasons,
      providedBy: provided,
      sideEffectFiles: d.section === 'require' ? filesAutoload : [],
      cliPackage: d.section === 'require' && /^(?:wp-cli-package|command)$/.test(p.type || ''),
    });
  }
  return { declaredCount: declared.size, packages: packages.sort((a, b) => a.name.localeCompare(b.name)) };
}

// --- Pure: report -------------------------------------------------------------------------

const ageYears = (iso, now) => (iso ? (now - new Date(iso)) / (365.25 * 24 * 3600 * 1000) : null);

/** Markdown for a human; every section is a decision the skill's procedure walks through. */
export function render(report, { now = new Date(), staleYears = 2 } = {}) {
  const out = [];
  const line = (s = '') => out.push(s);
  const table = (head, rows) => {
    if (!rows.length) return;
    line(`| ${head.join(' | ')} |`);
    line(`| ${head.map(() => '---').join(' | ')} |`);
    for (const r of rows) line(`| ${r.join(' | ')} |`);
    line();
  };
  line(`# Dependency audit: ${report.repo}`);
  line();
  line(`Ref \`${report.ref || 'unknown'}\` · generated ${now.toISOString().slice(0, 10)} · read-only inventory, not a verdict — see the skill's procedure.`);
  line();

  for (const root of report.npm) {
    const label = root.dir ? `${root.dir}/package.json` : 'package.json';
    const p = (v) => root.packages.filter((x) => x.verdict === v);
    line(`## npm: \`${label}\``);
    line();
    line(`${root.declaredCount} declared · @wordpress/scripts ${root.wpScripts || 'not declared'} · ${root.lockMissing ? '**no package-lock.json: peers, bins and providers unknown**' : 'lockfile read'}`);
    line();
    if (p('unused').length) {
      line('### No reference found');
      line();
      table(['Package', 'Section', 'Range'], p('unused').map((x) => [`\`${x.name}\``, x.section, x.range]));
    }
    if (p('provided').length) {
      line('### Provided by another dependency, never referenced directly');
      line();
      table(['Package', 'Also a dependency of', 'Shadowing'], p('provided').map((x) => [
        `\`${x.name}\``, x.providedBy.join(', '),
        x.shadowed.map((s) => `root ${s.ours} overrides ${s.provider}'s ${s.theirs}`).join('; ') || '',
      ]));
    }
    if (p('consider').length) {
      line('### Needed only as a CLI or a peer, and another dependency already provides it');
      line();
      table(['Package', 'Used as', 'Also a dependency of'], p('consider').map((x) => [`\`${x.name}\``, x.reasons.join('; '), x.providedBy.join(', ')]));
    }
    if (root.undeclared.length) {
      line('### Imported but not declared');
      line();
      table(['Package', 'Installed', 'Externalized', 'Where'], root.undeclared.map((u) => [
        `\`${u.name}\``,
        u.installed ? 'transitively'
          : u.viaAncestor ? `via \`${u.viaAncestor.dir || '.'}/node_modules\`${u.viaAncestor.declared.has(u.name) ? ' (declared there)' : ''}`
            : '**not installed**',
        u.externalized === null ? 'n/a (tests or tooling)' : u.externalized ? 'yes (free to declare)' : 'no',
        `${u.testOnly ? 'tests only: ' : ''}${u.files.slice(0, 3).join(', ')}${u.files.length > 3 ? ` +${u.files.length - 3}` : ''}`,
      ]));
    }
    const heavy = [
      ...root.packages.filter((x) => x.heavyExternal).map((x) => [x.name, x.heavyExternal, 'declared']),
      ...root.undeclared.filter((u) => u.externalized && HEAVY_EXTERNALS[u.name]).map((u) => [u.name, HEAVY_EXTERNALS[u.name], 'not declared']),
    ];
    if (heavy.length) {
      line('### Imports that make WordPress enqueue a heavy core script');
      line();
      table(['Package', 'Core script', 'Declared'], heavy.map(([n, script, d]) => [`\`${n}\``, `\`${script}\``, d]));
    }
    const shipped = root.packages.filter((x) => x.bundled);
    if (shipped.length) {
      line('### Bundled into the build (ships in the zip)');
      line();
      line(shipped.map((x) => `\`${x.name}\``).join(', '));
      line();
    }
    if (root.overrides.length) {
      line('### Overrides');
      line();
      table(['Override', 'Value', 'Problem'], root.overrides.map((o) => [`\`${o.name}\``, `\`${o.value}\``, o.problem]));
    }
    for (const f of root.findings) line(`- **${f.id}**: ${f.message}`);
    if (root.findings.length) line();
    const kept = p('keep');
    if (kept.length) {
      line(`<details><summary>Kept (${kept.length})</summary>`);
      line();
      for (const x of kept) line(`- \`${x.name}\`: ${x.reasons.join('; ')}`);
      line();
      line('</details>');
      line();
    }
  }

  if (report.composer) {
    const c = report.composer;
    const p = (v) => c.packages.filter((x) => x.verdict === v);
    line('## Composer: `composer.json`');
    line();
    line(`${c.declaredCount} declared · ${c.lockMissing ? '**no composer.lock: providers and autoload unknown**' : 'lockfile read'}`);
    line();
    if (p('unused').length) {
      line('### No reference found');
      line();
      table(['Package', 'Section', 'Type', 'Locked release'], p('unused').map((x) => [`\`${x.name}\``, x.section, x.type || '', x.released?.slice(0, 10) || '']));
    }
    if (p('provided').length) {
      line('### Provided by another dependency, never referenced directly');
      line();
      table(['Package', 'Also required by'], p('provided').map((x) => [`\`${x.name}\``, x.providedBy.join(', ')]));
    }
    if (p('consider').length) {
      line('### Used only as a CLI or tool another dependency already requires');
      line();
      table(['Package', 'Used as', 'Also required by'], p('consider').map((x) => [`\`${x.name}\``, x.reasons.join('; '), x.providedBy.join(', ')]));
    }
    const effects = c.packages.filter((x) => x.sideEffectFiles.length || x.cliPackage);
    if (effects.length) {
      line('### Runtime packages that execute on load');
      line();
      table(['Package', 'Type', 'Autoloaded files'], effects.map((x) => [`\`${x.name}\``, x.type || '', x.sideEffectFiles.join(', ')]));
    }
    const old = c.packages.filter((x) => x.abandoned || (ageYears(x.released, now) ?? 0) >= staleYears);
    if (old.length) {
      line(`### Locked release older than ${staleYears} years, or abandoned`);
      line();
      table(['Package', 'Locked', 'Released', 'Abandoned'], old.map((x) => [`\`${x.name}\``, x.lockedVersion || '', x.released?.slice(0, 10) || '', x.abandoned ? String(x.abandoned) : '']));
    }
    const kept = p('keep');
    if (kept.length) {
      line(`<details><summary>Kept (${kept.length})</summary>`);
      line();
      for (const x of kept) line(`- \`${x.name}\`: ${x.reasons.join('; ')}`);
      line();
      line('</details>');
      line();
    }
  }

  if (report.registry) {
    const rows = report.registry
      .filter((r) => r.deprecated || r.abandoned || (ageYears(r.latestAt, now) ?? 0) >= staleYears || r.error)
      .map((r) => [`\`${r.name}\``, r.ecosystem, r.latest || '', r.latestAt?.slice(0, 10) || '', r.maintainers ?? '',
        r.deprecated || (r.abandoned ? `abandoned${typeof r.abandoned === 'string' ? ` → ${r.abandoned}` : ''}` : '') || r.error || '']);
    line(`## Registry: latest release older than ${staleYears} years, deprecated, or abandoned`);
    line();
    if (rows.length) table(['Package', 'Registry', 'Latest', 'Released', 'Maintainers', 'Note'], rows);
    else line('Nothing stale.\n');
  }
  return out.join('\n');
}

// --- Effects: collect from disk -----------------------------------------------------------

const readJson = (file) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};
const readText = (file) => {
  try {
    const st = fs.statSync(file);
    return st.size > MAX_FILE_BYTES ? null : fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
};

/** Every file under `dir`, skipping dependency, build and agent directories. */
function walk(dir, root, out = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name) && (!e.name.startsWith('.') || KEEP_DOT_DIRS.has(e.name))) walk(full, root, out);
    } else if (e.isFile()) {
      out.push(path.relative(root, full).split(path.sep).join('/'));
    }
  }
  return out;
}

/** Read the repo at `root` into the plain shapes the analyzers take. */
export function collect(root) {
  const files = walk(root, root);
  const packageRoots = files
    .filter((f) => f === 'package.json' || f.endsWith('/package.json'))
    .map((f) => path.posix.dirname(f) === '.' ? '' : path.posix.dirname(f))
    .sort((a, b) => b.length - a.length);
  const ownerOf = (file) => packageRoots.find((r) => r === '' || file === r || file.startsWith(`${r}/`)) ?? '';
  const read = (rel) => ({ path: rel, text: readText(path.join(root, rel)) ?? '' });

  // Commands that run tools: hooks, workflows, shell scripts.
  const commands = files
    .filter((f) => f.startsWith('.husky/') || /^bin\//.test(f) || /\.sh$/.test(f))
    .map((f) => read(f).text);
  for (const f of files.filter((x) => /^\.github\/workflows\/.+\.ya?ml$/.test(x))) {
    commands.push(...[...read(f).text.matchAll(/^\s*(?:-\s*)?run:\s*(.+)$/gm)].map((m) => m[1]));
  }

  let bundled = null;
  try {
    const util = readText(path.join(root, 'node_modules/@wordpress/dependency-extraction-webpack-plugin/lib/util.js'));
    const m = util?.match(/BUNDLED_PACKAGES\s*=\s*\[([^\]]*)\]/);
    if (m) bundled = [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
  } catch {
    bundled = null;
  }

  // Follow relative imports out of a package root into another one, so code a root's tests
  // import from blocks/src counts against the root too.
  const fileSet = new Set(files);
  const resolveRelative = (from, spec) => {
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
    return ['', '.js', '.jsx', '.ts', '.tsx', '.mjs', '/index.js', '/index.ts', '/index.jsx']
      .map((ext) => base + ext)
      .find((c) => fileSet.has(c));
  };
  const reachedFrom = (dir, starts) => {
    const seen = new Set();
    const queue = [...starts];
    while (queue.length && seen.size < 500) {
      const file = queue.shift();
      for (const spec of extractSpecifiers(read(file).text)) {
        if (!spec.startsWith('.')) continue;
        const target = resolveRelative(file, spec);
        if (!target || seen.has(target) || !CODE_EXT.test(target)) continue;
        if (ownerOf(target) !== dir) {
          seen.add(target);
          queue.push(target);
        }
      }
    }
    return [...seen].map(read);
  };

  const npm = [];
  for (const dir of [...packageRoots].reverse()) {
    const base = dir ? `${dir}/` : '';
    const manifest = readJson(path.join(root, base, 'package.json'));
    if (!manifest) continue;
    const own = files.filter((f) => ownerOf(f) === dir);
    const sources = own.filter((f) => (CODE_EXT.test(f) || STYLE_EXT.test(f)) && !/\.min\.(?:js|css)$/.test(f)).map(read);
    const configs = own
      .filter((f) => CONFIG_FILE.test(path.posix.basename(f)) && path.posix.dirname(f) === (dir || '.'))
      .map(read);
    const lsc = manifest['lint-staged'] ? [JSON.stringify(manifest['lint-staged'])] : [];
    const lock = readJson(path.join(root, base, 'package-lock.json'));
    const reached = reachedFrom(dir, sources.map((x) => x.path));
    const ancestors = packageRoots
      .filter((r) => r !== dir && (r === '' || dir.startsWith(`${r}/`)))
      .map((r) => {
        const b = r ? `${r}/` : '';
        const m = readJson(path.join(root, b, 'package.json')) || {};
        const l = readJson(path.join(root, b, 'package-lock.json'));
        return {
          dir: r,
          installed: new Set(Object.keys(l?.packages || {}).filter((k) => /^node_modules\/(?:@[^/]+\/)?[^/]+$/.test(k)).map((k) => k.slice('node_modules/'.length))),
          declared: new Set(Object.keys({ ...m.dependencies, ...m.devDependencies })),
        };
      });
    const result = analyzeNpm({
      dir, manifest, lock, sources, configs, reached, ancestors,
      commands: dir ? lsc : [...commands, ...lsc],
      bundled,
    });
    result.lockMissing = !lock;
    npm.push(result);
  }

  let composer = null;
  const composerJson = readJson(path.join(root, 'composer.json'));
  if (composerJson) {
    const lock = readJson(path.join(root, 'composer.lock'));
    const phpSources = files.filter((f) => f.endsWith('.php') && !f.startsWith('build-tools/')).map(read);
    const configs = files.filter((f) => PHP_CONFIG_FILE.test(path.posix.basename(f)) && !f.includes('/')).map(read);
    const npmScripts = Object.values(readJson(path.join(root, 'package.json'))?.scripts || {});
    composer = analyzeComposer({ manifest: composerJson, lock, phpSources, configs, commands: [...commands, ...npmScripts] });
    composer.lockMissing = !lock;
  }

  let ref = null;
  try {
    const opts = { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
    ref = `${execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], opts).trim()}@${execFileSync('git', ['rev-parse', '--short', 'HEAD'], opts).trim()}`;
  } catch {
    ref = null;
  }
  return { repo: path.basename(path.resolve(root)), ref, npm, composer };
}

// --- Effects: registry --------------------------------------------------------------------

const execFileAsync = promisify(execFile);

async function pool(items, size, fn) {
  const out = [];
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return out;
}

/** Latest release, deprecation and abandonment for every declared package. */
export async function fetchRegistry(report) {
  const npmNames = new Map();
  for (const root of report.npm) {
    for (const p of root.packages) {
      const alias = /^npm:(@?[^@]+)@/.exec(p.range);
      npmNames.set(alias ? alias[1] : p.name, p.name);
    }
  }
  const npmRows = await pool([...npmNames.keys()], 6, async (name) => {
    try {
      const { stdout } = await execFileAsync('npm', ['view', name, 'dist-tags', 'time', 'deprecated', 'maintainers', '--json'], { maxBuffer: 32 * 1024 * 1024 });
      const j = JSON.parse(stdout);
      const latest = j['dist-tags']?.latest;
      return { ecosystem: 'npm', name, latest, latestAt: j.time?.[latest] || null, deprecated: j.deprecated || null, maintainers: (j.maintainers || []).length };
    } catch (e) {
      return { ecosystem: 'npm', name, error: `npm view failed: ${String(e.message).split('\n')[0]}` };
    }
  });
  const composerNames = (report.composer?.packages || []).map((p) => p.name);
  const composerRows = await pool(composerNames, 6, async (name) => {
    try {
      const res = await fetch(`https://repo.packagist.org/p2/${name}.json`);
      if (!res.ok) return { ecosystem: 'packagist', name, error: res.status === 404 ? 'not on Packagist (VCS or private)' : `HTTP ${res.status}` };
      const j = await res.json();
      const versions = (j.packages?.[name] || []).filter((v) => !/^dev-|-dev$/.test(v.version));
      const latest = versions[0] || {};
      return { ecosystem: 'packagist', name, latest: latest.version, latestAt: latest.time || null, abandoned: latest.abandoned ?? null };
    } catch (e) {
      return { ecosystem: 'packagist', name, error: String(e.message) };
    }
  });
  return [...npmRows, ...composerRows];
}

// --- CLI ----------------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { root: process.cwd(), json: false, registry: false, staleYears: 2 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') args.root = path.resolve(argv[++i]);
    else if (a === '--json') args.json = true;
    else if (a === '--registry') args.registry = true;
    else if (a === '--stale-years') args.staleYears = Number(argv[++i]);
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node audit-deps.mjs [--root <dir>] [--json] [--registry] [--stale-years <n>]');
    return;
  }
  if (!fs.existsSync(path.join(args.root, 'package.json')) && !fs.existsSync(path.join(args.root, 'composer.json'))) {
    throw new Error(`No package.json or composer.json in ${args.root}`);
  }
  const report = collect(args.root);
  if (args.registry) report.registry = await fetchRegistry(report);
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(render(report, { staleYears: args.staleYears }));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
