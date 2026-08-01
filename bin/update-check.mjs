#!/usr/bin/env node
// @linchpinagency/skills — installed-version check.
//
// Prints ONE line when a newer release is published, and nothing at all otherwise. Exits 0
// on every path — offline, unwritable cache, missing stamp, malformed JSON — because this is
// meant to be wired into a Claude Code `SessionStart` hook, where stdout becomes session
// context. A failure here must never be the first thing an agent reads.
//
//   node .claude/skills/.linchpin-skills/update-check.mjs
//   node .claude/skills/.linchpin-skills/update-check.mjs --force   # ignore the throttle
//   node .claude/skills/.linchpin-skills/update-check.mjs --json    # always emit a status
//   node .claude/skills/.linchpin-skills/update-check.mjs --hook    # print the hook snippet
//
// Off switch: LINCHPIN_SKILLS_UPDATE_CHECK=0. Also silent when CI is set.
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
  const stamp = readJson(path.join(HERE, 'version.json'));
  if (stamp?.version) return stamp;
  const pkg = readJson(path.join(HERE, '..', 'package.json'));
  if (pkg?.version) return { version: pkg.version, updateCommand: `npx ${PKG}`, source: 'package' };
  return null;
}

function cacheFile() {
  const base = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  return path.join(base, 'linchpin-skills', 'update-check.json');
}

function readCache() {
  const c = readJson(cacheFile());
  return typeof c?.checkedAt === 'number' && c.latest ? c : null;
}

function writeCache(entry) {
  try {
    const file = cacheFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(entry) + '\n');
  } catch {
    // A read-only or missing HOME just means we check again next time.
  }
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

async function evaluate({ force }) {
  if (OFF.has(String(process.env.LINCHPIN_SKILLS_UPDATE_CHECK ?? '').toLowerCase())) {
    return { status: 'disabled', reason: 'LINCHPIN_SKILLS_UPDATE_CHECK' };
  }
  // No human reads a CI log for upgrade nudges, and headless runs shouldn't reach the network.
  if (process.env.CI && !force) return { status: 'disabled', reason: 'CI' };

  const stamp = readStamp();
  if (!stamp) return { status: 'unknown', reason: 'no-version-stamp' };

  // Throttle the network call, not the message: a known-newer version keeps surfacing on
  // later sessions from cache, so the nudge survives without re-hitting the registry.
  const cache = force ? null : readCache();
  const cached = cache && Date.now() - cache.checkedAt < THROTTLE_MS;
  const latest = cached ? cache.latest : await fetchLatest();
  if (!latest) return { status: 'unknown', reason: 'registry-unreachable', installed: stamp.version };
  if (!cached) writeCache({ checkedAt: Date.now(), latest });

  const command = stamp.updateCommand || `npx ${PKG}`;
  const result = { installed: stamp.version, latest, command, installedAt: stamp.installedAt ?? null };
  return compareVersions(latest, stamp.version) > 0
    ? { status: 'update-available', ...result }
    : { status: 'up-to-date', ...result };
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
own failures — a session never fails to start because of this check.`);
}

function help() {
  console.log(
    `
${PKG} — report when the installed skills are behind the published release.

Usage:
  node update-check.mjs [options]

Options:
  --force    Ignore the 24h throttle (and the CI opt-out) and query the registry now
  --json     Always print a status object, even when up to date
  --hook     Print the Claude Code SessionStart hook snippet that runs this check
  -h, --help Show this help

Environment:
  LINCHPIN_SKILLS_UPDATE_CHECK=0   Disable the check entirely
  LINCHPIN_SKILLS_REGISTRY=<url>   Query a different registry endpoint

Prints one line when an update is available, nothing otherwise. Always exits 0.
`.trimStart()
  );
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) return help();
  if (args.includes('--hook')) return printHook();

  const asJson = args.includes('--json');
  const result = await evaluate({ force: args.includes('--force') });

  if (asJson) return console.log(JSON.stringify(result));
  if (result.status !== 'update-available') return;

  const when = result.installedAt ? ` (installed ${String(result.installedAt).slice(0, 10)})` : '';
  console.log(
    `Linchpin skills ${result.installed} → ${result.latest} available${when}. Update with: ${result.command}`
  );
}

main().catch(() => {}); // Never let this be the reason a session start fails.
