#!/usr/bin/env node
// @linchpinagency/skills — installed-version check.
//
// Prints ONE line when a newer release is published, and nothing at all otherwise. Exits 0
// on every path — offline, unwritable cache, missing stamp, malformed JSON — because this is
// meant to be wired into a Claude Code `SessionStart` hook, where stdout becomes session
// context. A failure here must never be the first thing an agent reads.
//
//   node .claude/skills/.linchpin-skills/update-check.mjs
//   node .claude/skills/.linchpin-skills/update-check.mjs --force   # ignore throttle + snooze
//   node .claude/skills/.linchpin-skills/update-check.mjs --json    # always emit a status
//   node .claude/skills/.linchpin-skills/update-check.mjs --scan     # every install, not just this one
//   node .claude/skills/.linchpin-skills/update-check.mjs --hook    # print the hook snippet
//
// It reports; it never installs anything. Acting on the report is the `skill-updates`
// skill's job — including the preference flags below, which exist so that skill never has
// to hand-edit JSON:
//
//   --enable-auto / --disable-auto   let updates apply without asking
//   --snooze                         defer this version (24h -> 48h -> 1 week)
//   --disable / --enable             stop / resume checking entirely
//
// Off switch: LINCHPIN_SKILLS_UPDATE_CHECK=0, or `--disable`. Also silent when CI is set.
//
// `bin/install.mjs` copies this file next to the `version.json` stamp it writes, so the
// installed copy is self-contained — it reads the stamp as a sibling, not from the package.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = '@linchpinagency/skills';
// Overridable so this is testable offline, and usable behind a private registry mirror.
const REGISTRY = process.env.LINCHPIN_SKILLS_REGISTRY || `https://registry.npmjs.org/${PKG}/latest`;
const THROTTLE_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3000;
const OFF = new Set(['0', 'false', 'off', 'no']);

// Escalating snooze: someone who defers twice is telling you something, so stop asking
// weekly and start asking monthly-ish. Indexed by snooze level, capped at the last entry.
const SNOOZE_MS = [24 * 60 * 60 * 1000, 48 * 60 * 60 * 1000, 7 * 24 * 60 * 60 * 1000];
const SNOOZE_LABEL = ['24h', '48h', '1 week'];

// Every relative directory any supported agent reads, checked under both the project root
// and home. `bin/install.mjs`'s AGENTS map is the owner of this list; it is repeated here
// because this file gets copied away from the package and has to stand alone. Adding an
// agent there means adding its directories here.
const SKILL_DIRS = [
  '.claude/skills',
  '.agents/skills',
  '.github/skills',
  '.codex/skills',
  '.cursor/skills',
  '.copilot/skills',
];

const STAMP_DIR = '.linchpin-skills';
const STAMP_FILE = 'version.json';

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * The installed version, from the stamp `install.mjs` wrote alongside this file. Falls back
 * to the package's own version so the script is still exercisable from a checkout, where no
 * install stamp exists.
 */
function readStamp() {
  const stamp = readJson(path.join(HERE, STAMP_FILE));
  if (stamp?.version) return stamp;
  const pkg = readJson(path.join(HERE, '..', 'package.json'));
  if (pkg?.version) return { version: pkg.version, updateCommand: `npx ${PKG}`, source: 'package' };
  return null;
}

// --- Preferences ---------------------------------------------------------------------
// Config, deliberately not cache: "never ask me again" has to survive a cache wipe, and
// `~/.cache` is a directory people delete on purpose.

function configFile() {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'linchpin-skills', 'config.json');
}

function readConfig() {
  const c = readJson(configFile()) || {};
  return {
    autoUpdate: c.autoUpdate === true,
    updateCheck: c.updateCheck !== false, // absent means on
  };
}

/** Returns the written config, or null when the write failed (reported by the caller). */
function writeConfig(patch) {
  const file = configFile();
  const next = { ...(readJson(file) || {}), ...patch };
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
    return next;
  } catch {
    return null;
  }
}

function cacheFile() {
  const base = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  return path.join(base, 'linchpin-skills', 'update-check.json');
}

function readCache() {
  return readJson(cacheFile()) || null;
}

function writeCache(patch) {
  try {
    const file = cacheFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ ...(readCache() || {}), ...patch }, null, 2) + '\n');
    return true;
  } catch {
    // A read-only or missing HOME just means we check again next time.
    return false;
  }
}

/**
 * Snooze lives in the cache rather than the config because it is disposable state about one
 * version, not a preference — losing it costs one extra prompt. Keyed to the version that
 * was deferred, so a newer release than the one you snoozed still speaks up.
 */
function snoozedUntil(cache, version) {
  if (!cache || cache.snoozeVersion !== version) return 0;
  const level = Number.isInteger(cache.snoozeLevel) ? cache.snoozeLevel : 1;
  const ms = SNOOZE_MS[Math.min(level, SNOOZE_MS.length) - 1] ?? SNOOZE_MS[0];
  return (Number(cache.snoozedAt) || 0) + ms;
}

function snooze(version) {
  const cache = readCache();
  const level = cache?.snoozeVersion === version ? Math.min((cache.snoozeLevel || 0) + 1, SNOOZE_MS.length) : 1;
  const ok = writeCache({ snoozeVersion: version, snoozeLevel: level, snoozedAt: Date.now() });
  return { ok, level, label: SNOOZE_LABEL[level - 1] };
}

async function fetchLatest() {
  try {
    const res = await fetch(REGISTRY, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    const { version } = await res.json();
    return typeof version === 'string' ? version : null;
  } catch {
    return null; // offline, DNS, timeout, private registry — all the same answer here.
  }
}

/** -1 / 0 / 1. Release beats prerelease at the same core version; build metadata ignored. */
function compareVersions(a, b) {
  const parse = (v) => {
    const [core, pre = ''] = String(v).trim().replace(/^v/, '').split('+')[0].split('-');
    const parts = core.split('.').map((n) => Number.parseInt(n, 10));
    return { nums: [0, 1, 2].map((i) => (Number.isFinite(parts[i]) ? parts[i] : 0)), pre };
  };
  const A = parse(a);
  const B = parse(b);
  for (let i = 0; i < 3; i++) {
    if (A.nums[i] !== B.nums[i]) return A.nums[i] < B.nums[i] ? -1 : 1;
  }
  if (A.pre === B.pre) return 0;
  if (!A.pre) return 1;
  if (!B.pre) return -1;
  return A.pre < B.pre ? -1 : 1;
}

// --- Scan ----------------------------------------------------------------------------
// The stamp beside this file describes ONE install. Most machines have more than one — a
// global copy plus a project copy, or Copilot's two directories — and updating only the one
// that happened to run the hook is how a stale skill survives an "update".

function scanInstalls() {
  const found = [];
  const seen = new Set();
  const roots = [
    { root: process.cwd(), scope: 'project' },
    { root: os.homedir(), scope: 'global' },
  ];
  for (const { root, scope } of roots) {
    for (const rel of SKILL_DIRS) {
      const dir = path.resolve(root, rel);
      if (seen.has(dir)) continue;
      seen.add(dir);
      const stamp = readJson(path.join(dir, STAMP_DIR, STAMP_FILE));
      if (!stamp?.version) continue;
      found.push({
        dir,
        scope: stamp.scope || scope,
        agent: stamp.agent || null,
        version: stamp.version,
        installedAt: stamp.installedAt || null,
        updateCommand: stamp.updateCommand || `npx ${PKG}`,
        skills: Array.isArray(stamp.skills) ? stamp.skills.length : null,
      });
    }
  }
  return found;
}

async function scan({ asJson }) {
  const installs = scanInstalls();
  const latest = await fetchLatest();
  const rows = installs.map((i) => ({
    ...i,
    behind: latest ? compareVersions(latest, i.version) > 0 : null,
  }));

  if (asJson) {
    const { autoUpdate, updateCheck } = readConfig();
    const cache = readCache();
    return console.log(
      JSON.stringify({ latest, autoUpdate, updateCheck, snoozedUntil: snoozedUntil(cache, latest) || null, installs: rows }, null, 2)
    );
  }

  if (!installs.length) {
    console.log('No @linchpinagency/skills installs found under this project or your home directory.');
    console.log(`Directories checked: ${SKILL_DIRS.join(', ')} (under both).`);
    return;
  }
  console.log(`latest published: ${latest || '(registry unreachable)'}\n`);
  const width = Math.max(...rows.map((r) => r.dir.length));
  for (const r of rows) {
    const state = r.behind === null ? '?' : r.behind ? 'BEHIND' : 'current';
    console.log(`  ${r.dir.padEnd(width)}  v${r.version}  ${r.scope.padEnd(7)} ${state}`);
  }
  const behind = rows.filter((r) => r.behind);
  if (behind.length) {
    console.log(`\n${behind.length} of ${rows.length} install(s) behind. Update each with its own recorded command:`);
    for (const r of new Map(behind.map((r) => [r.updateCommand, r])).values()) {
      console.log(`  ${r.updateCommand}`);
    }
  }
}

async function evaluate({ force }) {
  if (OFF.has(String(process.env.LINCHPIN_SKILLS_UPDATE_CHECK ?? '').toLowerCase())) {
    return { status: 'disabled', reason: 'LINCHPIN_SKILLS_UPDATE_CHECK' };
  }
  const config = readConfig();
  if (!config.updateCheck && !force) return { status: 'disabled', reason: 'config.updateCheck' };
  // No human reads a CI log for upgrade nudges, and headless runs shouldn't reach the network.
  if (process.env.CI && !force) return { status: 'disabled', reason: 'CI' };

  const stamp = readStamp();
  if (!stamp) return { status: 'unknown', reason: 'no-version-stamp' };

  // Throttle the network call, not the message: a known-newer version keeps surfacing on
  // later sessions from cache, so the nudge survives without re-hitting the registry.
  const cache = force ? null : readCache();
  const cached = Boolean(
    cache && typeof cache.checkedAt === 'number' && cache.latest && Date.now() - cache.checkedAt < THROTTLE_MS
  );
  const latest = cached ? cache.latest : await fetchLatest();
  if (!latest) return { status: 'unknown', reason: 'registry-unreachable', installed: stamp.version };
  if (!cached) writeCache({ checkedAt: Date.now(), latest });

  const command = stamp.updateCommand || `npx ${PKG}`;
  const result = {
    installed: stamp.version,
    latest,
    command,
    installedAt: stamp.installedAt ?? null,
    autoUpdate: config.autoUpdate,
  };

  if (compareVersions(latest, stamp.version) <= 0) return { status: 'up-to-date', ...result };

  const until = snoozedUntil(readCache(), latest);
  if (until > Date.now() && !force) {
    return { status: 'snoozed', snoozedUntil: new Date(until).toISOString(), ...result };
  }
  return { status: 'update-available', ...result };
}

function hookSnippet() {
  const run =
    'f=.claude/skills/.linchpin-skills/update-check.mjs; ' +
    '[ -f "$f" ] || f=$HOME/.claude/skills/.linchpin-skills/update-check.mjs; ' +
    '[ -f "$f" ] && node "$f" || true';
  return `{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [{
          "type": "command",
          "command": ${JSON.stringify(`bash -c '${run}'`)},
          "timeout": 10
        }]
      }
    ]
  }
}`;
}

function printHook() {
  console.log(`Add to .claude/settings.json (project) or ~/.claude/settings.json (global):\n`);
  console.log(hookSnippet());
  console.log(`
The command prefers the project install and falls back to the global one, and swallows its
own failures — a session never fails to start because of this check.

Or let the installer write it for you, idempotently:
  npx @linchpinagency/skills --with-hook`);
}

function help() {
  console.log(
    `
${PKG} — report when the installed skills are behind the published release.

Usage:
  node update-check.mjs [options]

Options:
  --scan     Report every install found under this project and your home directory
  --force    Ignore the 24h throttle, any snooze, and the CI opt-out; query the registry now
  --json     Always print a status object, even when up to date
  --hook     Print the Claude Code SessionStart hook snippet that runs this check
  -h, --help Show this help

Preferences (written to ${'$'}{XDG_CONFIG_HOME:-~/.config}/linchpin-skills/config.json):
  --enable-auto     Apply updates without asking
  --disable-auto    Ask before applying updates (the default)
  --snooze          Defer the currently-available version (24h, then 48h, then 1 week)
  --disable         Stop checking entirely
  --enable          Resume checking

Environment:
  LINCHPIN_SKILLS_UPDATE_CHECK=0   Disable the check entirely
  LINCHPIN_SKILLS_REGISTRY=<url>   Query a different registry endpoint

Prints one line when an update is available, nothing otherwise. Reports only — it never
installs anything; ask an agent to "update the skills" for that. Always exits 0.
`.trimStart()
  );
}

/** Preference flags. Returns true when one was handled, so main() can stop. */
async function handlePreference(args) {
  const set = (patch, message) => {
    const ok = writeConfig(patch);
    console.log(ok ? message : `Could not write ${configFile()} — preference not saved.`);
    return true;
  };

  if (args.includes('--enable-auto')) {
    return set({ autoUpdate: true }, 'Auto-update on: updates will be applied without asking.');
  }
  if (args.includes('--disable-auto')) {
    return set({ autoUpdate: false }, 'Auto-update off: you will be asked before updates apply.');
  }
  if (args.includes('--disable')) {
    return set({ updateCheck: false }, 'Update checks off. Re-enable with --enable.');
  }
  if (args.includes('--enable')) {
    return set({ updateCheck: true }, 'Update checks on.');
  }
  if (args.includes('--snooze')) {
    // Prefer the version we most recently saw; only reach for the network if there is none.
    const version = readCache()?.latest || (await fetchLatest());
    if (!version) {
      console.log('Nothing to snooze — no known published version (offline?).');
      return true;
    }
    const { ok, label } = snooze(version);
    console.log(ok ? `Snoozed v${version} for ${label}.` : 'Could not write the cache — snooze not saved.');
    return true;
  }
  return false;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) return help();
  if (args.includes('--hook')) return printHook();

  const asJson = args.includes('--json');
  if (args.includes('--scan')) return scan({ asJson });
  if (await handlePreference(args)) return;

  const result = await evaluate({ force: args.includes('--force') });

  if (asJson) return console.log(JSON.stringify(result));
  if (result.status !== 'update-available') return;

  const when = result.installedAt ? ` (installed ${String(result.installedAt).slice(0, 10)})` : '';
  console.log(
    `Linchpin skills ${result.installed} → ${result.latest} available${when}. ` +
      `Say "update the skills" to review and apply, or run: ${result.command}`
  );
}

main().catch(() => {}); // Never let this be the reason a session start fails.
