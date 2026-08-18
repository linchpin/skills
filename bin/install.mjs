#!/usr/bin/env node
// @linchpinagency/skills installer
// Copies bundled Linchpin skills into a coding agent's skills directory, and (by
// default) vendors a pinned base layer of upstream WordPress/agent-skills alongside them.
// Zero runtime dependencies — pure Node (>=18, uses global fetch) + the system `tar`.
// Re-run to update (it overwrites in place).

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..');
const SKILLS_ROOT = path.join(PKG_ROOT, 'skills');
const UPSTREAM_MANIFEST = path.join(PKG_ROOT, 'upstream.json');
const PKG_MANIFEST = path.join(PKG_ROOT, 'package.json');

// Version stamp + a self-contained copy of the update checker, written into each install
// directory. Dot-prefixed and without a SKILL.md, so no agent mistakes it for a skill.
const STAMP_DIR = '.linchpin-skills';
const STAMP_FILE = 'version.json';
const CHECKER = 'update-check.mjs';

// Per-agent install locations. `project` paths are relative to cwd, `global` to home.
// These follow the Agent Skills conventions each tool reads from. An agent may read more
// than one directory (Copilot honors both `.agents/skills` and `.github/skills`), so every
// entry is a list.
const AGENTS = {
  'claude-code': { label: 'Claude Code', project: ['.claude/skills'], global: ['.claude/skills'] },
  'github-copilot': { label: 'GitHub Copilot', project: ['.agents/skills', '.github/skills'], global: ['.copilot/skills'] },
  codex: { label: 'Codex', project: ['.codex/skills'], global: ['.codex/skills'] },
  cursor: { label: 'Cursor', project: ['.cursor/skills'], global: ['.cursor/skills'] },
};

function resolveAgents(id) {
  if (id === 'all') return Object.keys(AGENTS);
  return AGENTS[id] ? [id] : null;
}

function parseArgs(argv) {
  const opts = {
    agent: 'claude-code',
    global: false,
    list: false,
    help: false,
    skipUpstream: false,
    force: false,
    check: false,
    yes: false,
    dryRun: false,
    skills: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--global' || a === '-g') opts.global = true;
    else if (a === '--list' || a === '-l') opts.list = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--skip-upstream') opts.skipUpstream = true;
    else if (a === '--force' || a === '-f') opts.force = true;
    else if (a === '--check') opts.check = true;
    else if (a === '--yes' || a === '-y') opts.yes = true;
    else if (a === '--dry-run' || a === '-n') opts.dryRun = true;
    else if (a === '--agent') opts.agent = argv[++i];
    else if (a.startsWith('--agent=')) opts.agent = a.slice('--agent='.length);
    else if (a.startsWith('-')) {
      console.error(`Unknown option: ${a}  (try --help)`);
      process.exit(1);
    } else opts.skills.push(a);
  }
  return opts;
}

function readDescription(skillDir) {
  try {
    const md = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
    const fm = md.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) return '';
    const d = fm[1].match(/^description:\s*(.*)$/m);
    return d ? d[1].replace(/^["']|["']$/g, '').trim() : '';
  } catch {
    return '';
  }
}

function availableSkills() {
  if (!fs.existsSync(SKILLS_ROOT)) return [];
  return fs
    .readdirSync(SKILLS_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(SKILLS_ROOT, e.name, 'SKILL.md')))
    .map((e) => e.name)
    .sort();
}

// --- Scope collisions ----------------------------------------------------------------
// Agents load every skills directory they can see and do NOT dedupe by name. The same
// skill installed at two scopes is therefore listed twice and its `description` is paid
// for twice in the context window, every session, before any work starts. Installing on
// top of an install at another scope is always waste, never a merge — so we stop.

function installedSkillsIn(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'SKILL.md')))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

function readStamp(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, STAMP_DIR, STAMP_FILE), 'utf8'));
  } catch {
    return null;
  }
}

// Every directory the selected agents also read, other than the ones we're about to write:
// the opposite scope, plus any project-scope dir in a parent directory. That last case is
// the one people hit by accident — running the installer from a checkouts folder like
// ~/GitHub instead of inside a repo seeds a directory that shadows nothing and duplicates
// everything.
function rivalDirs(agentIds, opts) {
  const home = os.homedir();
  const seen = new Set();
  const out = [];
  const add = (dir, scope) => {
    const resolved = path.resolve(dir);
    if (seen.has(resolved)) return;
    seen.add(resolved);
    out.push({ dir: resolved, scope });
  };

  for (const id of agentIds) {
    const opposite = opts.global ? AGENTS[id].project : AGENTS[id].global;
    const oppositeRoot = opts.global ? process.cwd() : home;
    for (const rel of opposite) add(path.join(oppositeRoot, rel), opts.global ? 'project' : 'global');

    // Walk up to, but not into, home — home is the global scope, already covered above.
    let cur = path.dirname(process.cwd());
    while (cur.startsWith(home + path.sep)) {
      for (const rel of AGENTS[id].project) add(path.join(cur, rel), 'ancestor');
      const next = path.dirname(cur);
      if (next === cur) break;
      cur = next;
    }
  }
  return out;
}

function findCollisions(agentIds, opts, wanted, targetDirs) {
  const mine = new Set(targetDirs.map((d) => path.resolve(d)));
  const want = new Set(wanted);
  return rivalDirs(agentIds, opts)
    .filter((r) => !mine.has(r.dir))
    .map((r) => {
      const present = installedSkillsIn(r.dir);
      return { ...r, present, overlap: present.filter((n) => want.has(n)), stamp: readStamp(r.dir) };
    })
    .filter((r) => r.present.length);
}

function stampLine(stamp) {
  if (!stamp) return 'no install stamp — copied by hand, or by a pre-0.2 installer';
  return `v${stamp.version}, ${stamp.scope} scope, installed ${String(stamp.installedAt).slice(0, 10)}`;
}

const SCOPE_HINT = {
  global: 'the user-global directory — loaded in every project',
  project: 'a project directory — loaded when working in that repo',
  ancestor: 'a parent of the current directory — almost certainly an installer run from the wrong folder',
};

// --- Update planning -----------------------------------------------------------------
// Re-running the installer is the update path, so a re-run should say what it is about to
// change before it changes it. Skills carry their own `version` in frontmatter, so the diff
// is per skill rather than per package — a release usually touches two or three of them.

function readSkillVersion(skillDir) {
  try {
    const md = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
    const fm = md.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) return null;
    const v = fm[1].match(/^version:\s*(.*)$/m);
    return v ? v[1].replace(/^["']|["']$/g, '').trim() : null;
  } catch {
    return null;
  }
}

// Content fingerprint over every file in the skill, so we can tell "same version, edited
// in place" from "same version, untouched". Hand-edits in a consuming project get silently
// overwritten by an install; the least we can do is name them first.
function hashSkillDir(dir) {
  const h = crypto.createHash('sha1');
  const walk = (cur, rel) => {
    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return;
    }
    for (const e of entries) {
      const next = path.join(cur, e.name);
      const nextRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(next, nextRel);
      else {
        h.update(nextRel);
        h.update('\0');
        try {
          h.update(fs.readFileSync(next));
        } catch {
          /* unreadable file — its absence from the hash is itself a difference */
        }
      }
    }
  };
  walk(dir, '');
  return h.digest('hex');
}

function compareSemver(a, b) {
  if (!a || !b) return null;
  const pa = String(a).split('.').map((n) => parseInt(n, 10));
  const pb = String(b).split('.').map((n) => parseInt(n, 10));
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

// What installing `wanted` into `base` would actually do, per skill.
function planFor(base, wanted) {
  return wanted.map((name) => {
    const src = path.join(SKILLS_ROOT, name);
    const dest = path.join(base, name);
    const to = readSkillVersion(src);
    if (!fs.existsSync(path.join(dest, 'SKILL.md'))) return { name, from: null, to, status: 'new' };

    const from = readSkillVersion(dest);
    const cmp = compareSemver(from, to);
    if (cmp === -1) return { name, from, to, status: 'update' };
    if (cmp === 1) return { name, from, to, status: 'downgrade' };
    if (hashSkillDir(src) !== hashSkillDir(dest)) return { name, from, to, status: 'modified' };
    return { name, from, to, status: 'unchanged' };
  });
}

const PLAN_LABEL = {
  new: 'new',
  update: 'update',
  downgrade: 'DOWNGRADE',
  modified: 'local edits will be lost',
  unchanged: 'unchanged',
};

function renderPlan(plan) {
  const shown = plan.filter((p) => p.status !== 'unchanged');
  const width = Math.max(0, ...shown.map((p) => p.name.length));
  for (const p of shown) {
    const ver =
      p.status === 'new'
        ? `        -> v${p.to}`
        : p.from === p.to
          ? `   v${p.from}`
          : `   v${p.from} -> v${p.to}`;
    console.log(`  ${p.name.padEnd(width)}${ver}   ${PLAN_LABEL[p.status]}`);
  }
  const same = plan.length - shown.length;
  if (same) console.log(`  (${same} unchanged)`);
}

function confirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      rl.close();
      resolve(value);
    };
    // Ctrl-D or a closed stdin resolves as "no" — without this the promise never settles
    // and the installer exits silently having done nothing.
    rl.on('close', () => finish(false));
    rl.question(question, (answer) => finish(/^y(es)?$/i.test(answer.trim())));
  });
}

function readUpstreamManifest() {
  try {
    const m = JSON.parse(fs.readFileSync(UPSTREAM_MANIFEST, 'utf8'));
    return Array.isArray(m.sources) ? m.sources : [];
  } catch {
    return [];
  }
}

function packageVersion() {
  try {
    return JSON.parse(fs.readFileSync(PKG_MANIFEST, 'utf8')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// The exact command that reproduces this install, recorded in the stamp so the update
// checker can tell someone how to re-run it with the flags they actually used.
function updateCommand(opts) {
  const parts = ['npx @linchpinagency/skills'];
  if (opts.skills.length) parts.push(...opts.skills);
  if (opts.agent !== 'claude-code') parts.push('--agent', opts.agent);
  if (opts.global) parts.push('--global');
  if (opts.skipUpstream) parts.push('--skip-upstream');
  return parts.join(' ');
}

// Record what landed here and leave the checker beside it. Best-effort: a stamp we can't
// write costs an upgrade nudge, not the install.
function writeStamp(target, { version, opts, skills, upstream }) {
  const dir = path.join(target.dir, STAMP_DIR);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const stamp = {
      package: '@linchpinagency/skills',
      version,
      installedAt: new Date().toISOString(),
      agent: target.agent,
      scope: opts.global ? 'global' : 'project',
      updateCommand: updateCommand(opts),
      skills,
      upstream,
    };
    fs.writeFileSync(path.join(dir, STAMP_FILE), JSON.stringify(stamp, null, 2) + '\n');
    fs.copyFileSync(path.join(__dirname, CHECKER), path.join(dir, CHECKER));
    return true;
  } catch (err) {
    console.warn(`  ! Could not write the version stamp in ${dir}: ${err.message}`);
    return false;
  }
}

// Fetch a repo tarball at a pinned ref, extract it once, and copy the requested skill
// dirs into every directory in `bases`. Best-effort: any failure (offline, no `tar`,
// missing skill) warns and returns false rather than aborting the Linchpin install.
async function installUpstreamSource(source, bases) {
  const { repo, ref, skills = [] } = source;
  if (!repo || !ref || !skills.length) return false;

  const url = `https://codeload.github.com/${repo}/tar.gz/${ref}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-skills-'));
  const tarPath = path.join(tmp, 'src.tar.gz');
  const extractDir = path.join(tmp, 'x');
  fs.mkdirSync(extractDir);

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    fs.writeFileSync(tarPath, Buffer.from(await res.arrayBuffer()));

    // System tar handles gunzip + long paths + pax headers robustly (bsdtar/gnutar).
    execFileSync('tar', ['-xzf', tarPath, '-C', extractDir], { stdio: ['ignore', 'ignore', 'pipe'] });

    // GitHub tarballs wrap everything in a single top-level dir (`<repo>-<ref>`); find it
    // rather than reconstruct its name.
    const topdir = fs.readdirSync(extractDir).find((n) => fs.statSync(path.join(extractDir, n)).isDirectory());
    if (!topdir) throw new Error('unexpected tarball layout (no top-level dir)');

    let count = 0;
    for (const name of skills) {
      const from = path.join(extractDir, topdir, 'skills', name);
      if (!fs.existsSync(path.join(from, 'SKILL.md'))) {
        console.warn(`  ! ${repo}:${name} not found at ${ref} — skipped`);
        continue;
      }
      for (const base of bases) {
        const dest = path.join(base, name);
        fs.rmSync(dest, { recursive: true, force: true });
        fs.cpSync(from, dest, { recursive: true });
      }
      console.log(`  ✓ ${name}  (${repo})`);
      count++;
    }
    return count > 0;
  } catch (err) {
    console.warn(`  ! Skipped base layer from ${repo}: ${err.message}`);
    console.warn(`    (Linchpin skills installed fine. Re-run online, or use --skip-upstream to silence.)`);
    return false;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function help() {
  console.log(
    `
@linchpinagency/skills — install Linchpin AI agent skills

Linchpin skills are portable, cross-project tooling. By default the installer also vendors
a pinned base layer of upstream WordPress/agent-skills (generic WordPress expertise)
alongside them.

Usage:
  npx @linchpinagency/skills [skills...] [options]

Arguments:
  skills            One or more Linchpin skill names to install (default: all)

Options:
  -l, --list        List available skills (Linchpin + pinned base layer) and exit
      --check       Audit every scope this agent reads for duplicate skills; install nothing
  -g, --global      Install to the user-global skills dir instead of the project
      --agent <id>  Target agent: claude-code (default) | github-copilot | codex | cursor
                    | all  (installs into every agent's directory)
      --skip-upstream  Install only Linchpin skills; don't vendor the upstream base layer
  -f, --force       Reinstall everything, and install even if these skills already exist
                    at another scope
  -y, --yes         Skip the confirmation prompt (implied when not a TTY)
  -n, --dry-run     Show what would change and exit without writing anything
  -h, --help        Show this help

Updating:
  Re-running is the update path. The installer compares each skill's version against what
  is installed, prints what would change, and asks before touching anything. A run with
  nothing to change exits early. --dry-run shows the diff and writes nothing; note that a
  non-interactive run (piped stdin, CI) proceeds without prompting.

Scopes:
  Agents load every skills directory they find and do not dedupe by name, so a skill
  installed both globally and in a project is listed twice and costs its description
  twice in every session. Installing over another scope aborts unless you pass --force.
  Use --check to see what is already installed where.

Examples:
  npx @linchpinagency/skills                    # Linchpin skills + base layer -> ./.claude/skills
  npx @linchpinagency/skills wp-studio-cli      # one Linchpin skill (+ base layer)
  npx @linchpinagency/skills --check            # audit scopes, install nothing
  npx @linchpinagency/skills --dry-run          # preview an update, write nothing
  npx @linchpinagency/skills --yes              # update without the confirmation prompt
  npx @linchpinagency/skills --skip-upstream    # Linchpin skills only
  npx @linchpinagency/skills --agent github-copilot
  npx @linchpinagency/skills --agent all        # every agent dir in this project
  npx @linchpinagency/skills --global           # -> ~/.claude/skills
`.trimStart()
  );
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) return help();

  const all = availableSkills();
  const sources = readUpstreamManifest();

  if (opts.list) {
    console.log('Linchpin skills (portable, cross-project):\n');
    if (!all.length) console.log('  (none found in this package)');
    for (const name of all) {
      const desc = readDescription(path.join(SKILLS_ROOT, name));
      console.log(`  ${name}${desc ? ` — ${desc}` : ''}`);
    }
    for (const s of sources) {
      console.log(`\nBase layer — ${s.repo} @ ${String(s.ref).slice(0, 12)} (${s.license || 'see repo'}):\n`);
      for (const name of s.skills || []) console.log(`  ${name}`);
    }
    console.log('\nThe base layer is fetched at install time unless --skip-upstream is passed.');
    return;
  }

  const agentIds = resolveAgents(opts.agent);
  if (!agentIds) {
    console.error(`Unknown agent "${opts.agent}". Known: ${Object.keys(AGENTS).join(', ')}, all`);
    process.exit(1);
  }

  // Every destination across every selected agent, each tagged with the agent it belongs to
  // (the stamp records it; the copy loops only need the directory).
  const targets = agentIds.flatMap((id) =>
    (opts.global ? AGENTS[id].global : AGENTS[id].project).map((rel) => ({
      agent: id,
      dir: opts.global ? path.join(os.homedir(), rel) : path.join(process.cwd(), rel),
    }))
  );
  const bases = targets.map((t) => t.dir);

  const wanted = opts.skills.length ? opts.skills : all;
  const unknown = wanted.filter((s) => !all.includes(s));
  if (unknown.length) {
    console.error(`Unknown skill(s): ${unknown.join(', ')}`);
    console.error('Run with --list to see available skills.');
    process.exit(1);
  }
  if (!wanted.length && !sources.length) return console.log('No skills to install.');

  const labels = agentIds.map((id) => AGENTS[id].label).join(', ');

  if (opts.check) {
    // An audit reports what is actually installed, not just what this package ships —
    // duplicates seeded by an older version or another library still cost context.
    const installedHere = new Set(targets.flatMap((t) => installedSkillsIn(t.dir)));
    const audit = findCollisions(agentIds, opts, [...installedHere], bases);
    console.log(`Skill directories ${labels} reads, for this project:\n`);
    for (const t of targets) {
      const have = installedSkillsIn(t.dir);
      console.log(`  [target]  ${t.dir}`);
      console.log(`            ${have.length} skill(s) — ${stampLine(readStamp(t.dir))}\n`);
    }
    for (const c of audit) {
      console.log(`  [${c.scope}] ${c.dir}`);
      console.log(`            ${c.present.length} skill(s) — ${stampLine(c.stamp)}`);
      console.log(`            ${SCOPE_HINT[c.scope]}`);
      if (c.overlap.length) console.log(`            ${c.overlap.length} duplicate(s): ${c.overlap.join(', ')}`);
      console.log();
    }
    const dupes = audit.reduce((n, c) => n + c.overlap.length, 0);
    if (!dupes) {
      console.log('No duplicate skills across scopes.');
      return;
    }
    console.log(`${dupes} duplicate skill copies across scopes. Each one's description is loaded`);
    console.log('once per copy, every session. Remove whichever copy you do not want.');
    process.exitCode = 1;
    return;
  }

  // Plan first: whether a collision is a problem depends on whether this run would be
  // *creating* the second copy or merely maintaining one that already exists.
  const version = packageVersion();
  const plans = targets.map((t) => ({ target: t, plan: planFor(t.dir, wanted) }));
  const changed = plans.flatMap((p) => p.plan).filter((p) => p.status !== 'unchanged');

  // A skill that is 'new' in every target but already present at another scope is a
  // duplicate about to be born — that we refuse. A skill already installed here is an
  // update; refusing it would only strand someone on a stale copy without removing the
  // duplication, so it warns instead.
  const arriving = new Set(
    plans.flatMap(({ plan }) => plan.filter((p) => p.status === 'new').map((p) => p.name))
  );
  const existing = new Set(
    plans.flatMap(({ plan }) => plan.filter((p) => p.status !== 'new').map((p) => p.name))
  );
  const collisions = findCollisions(agentIds, opts, wanted, bases);
  const wouldCreate = collisions
    .map((c) => ({ ...c, overlap: c.overlap.filter((n) => arriving.has(n) && !existing.has(n)) }))
    .filter((c) => c.overlap.length);
  const preExisting = collisions
    .map((c) => ({ ...c, overlap: c.overlap.filter((n) => existing.has(n)) }))
    .filter((c) => c.overlap.length);

  if (wouldCreate.length && !opts.force) {
    const dupes = wouldCreate.reduce((n, c) => n + c.overlap.length, 0);
    console.error(`Refusing to install: ${dupes} of these skills are already installed at another scope.\n`);
    for (const c of wouldCreate) {
      console.error(`  ${c.dir}`);
      console.error(`    ${SCOPE_HINT[c.scope]}`);
      console.error(`    ${stampLine(c.stamp)}`);
      console.error(`    would duplicate: ${c.overlap.join(', ')}\n`);
    }
    console.error(`${labels} loads every directory it finds and does not dedupe by name, so each`);
    console.error('duplicate is listed twice and costs its description twice in every session.\n');
    console.error('Pick one scope:');
    console.error('  - keep the existing copy — nothing to do here; this install would be redundant');
    console.error('  - move them here         — drop just the duplicates at the other scope, then re-run:');
    for (const c of wouldCreate) {
      console.error(`      (cd ${c.dir} && rm -rf ${c.overlap.join(' ')})`);
    }
    console.error('  - keep both anyway       — re-run with --force');
    console.error('\nRun with --check to audit every scope without installing.');
    process.exit(1);
  }

  if (preExisting.length) {
    const dupes = preExisting.reduce((n, c) => n + c.overlap.length, 0);
    console.log(`! ${dupes} of these skills are also installed at another scope, and were before this run:`);
    for (const c of preExisting) console.log(`    ${c.dir}  (${c.scope})`);
    console.log('  Updating here does not fix that. Run --check for the duplicates and how to drop them.\n');
  }

  // A re-run is the update path, so most runs land here with a handful of skills to
  // update and the rest already current.
  if (!changed.length && !opts.force) {
    console.log(`Already up to date — ${wanted.length} skill(s) for ${labels}, nothing to change.`);
    if (!opts.dryRun) console.log('Re-run with --force to reinstall anyway.');
    return;
  }

  if (changed.length) {
    console.log(`@linchpinagency/skills v${version} — ${labels}\n`);
    for (const { target, plan } of plans) {
      if (plans.length > 1) console.log(`${target.dir}`);
      renderPlan(plan);
      if (plans.length > 1) console.log();
    }

    const edited = changed.filter((p) => p.status === 'modified');
    if (edited.length) {
      console.log(`\n! ${edited.length} skill(s) were edited in place and will be overwritten.`);
      console.log('  Skills are owned by this package — change them in the library, not the install.');
    }
    const down = changed.filter((p) => p.status === 'downgrade');
    if (down.length) {
      console.log(`\n! ${down.length} skill(s) would go BACKWARDS — this package is older than what is installed.`);
      console.log('  Check the version you invoked before continuing.');
    }

    const counts = ['new', 'update', 'downgrade', 'modified']
      .map((k) => [k, changed.filter((p) => p.status === k).length])
      .filter(([, n]) => n)
      .map(([k, n]) => `${n} ${k}`)
      .join(', ');
    console.log(`\n${changed.length} change(s): ${counts}`);

    if (opts.dryRun) {
      console.log('\nDry run — nothing was written.');
      return;
    }

    if (!opts.yes && !opts.force) {
      if (!process.stdin.isTTY) {
        console.log('Non-interactive — proceeding. Pass --yes to silence this notice.');
      } else if (!(await confirm('\nApply? [y/N] '))) {
        console.log('Nothing changed.');
        return;
      }
    }
    console.log();
  }

  const applied = new Set(changed.map((p) => p.name));
  for (const base of bases) {
    fs.mkdirSync(base, { recursive: true });
    for (const name of wanted) {
      const dest = path.join(base, name);
      fs.rmSync(dest, { recursive: true, force: true });
      fs.cpSync(path.join(SKILLS_ROOT, name), dest, { recursive: true });
      if (applied.has(name) || opts.force) console.log(`✓ ${name} -> ${dest}`);
    }
  }
  console.log(`\nInstalled ${wanted.length} Linchpin skill(s) for ${labels}.`);

  const upstream = [];
  if (!opts.skipUpstream && sources.length) {
    console.log('\nVendoring pinned base layer (upstream WordPress/agent-skills):');
    for (const s of sources) {
      const installed = await installUpstreamSource(s, bases);
      upstream.push({ repo: s.repo, ref: s.ref, installed });
    }
    console.log('\nTip: --skip-upstream installs Linchpin skills only.');
  }

  // Stamp last, so `upstream` reflects what actually landed rather than what was intended.
  const stamped = targets.filter((t) => writeStamp(t, { version, opts, skills: wanted, upstream }));
  if (stamped.length && agentIds.includes('claude-code')) {
    const rel = path.join(STAMP_DIR, CHECKER);
    console.log(
      `\nStamped v${version}. To be told when these skills go stale, add a SessionStart hook:` +
        `\n  node ${path.join(opts.global ? '~/.claude/skills' : '.claude/skills', rel)} --hook`
    );
  }
}

main();
