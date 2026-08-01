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
  const opts = { agent: 'claude-code', global: false, list: false, help: false, skipUpstream: false, skills: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--global' || a === '-g') opts.global = true;
    else if (a === '--list' || a === '-l') opts.list = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--skip-upstream') opts.skipUpstream = true;
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
  -g, --global      Install to the user-global skills dir instead of the project
      --agent <id>  Target agent: claude-code (default) | github-copilot | codex | cursor
                    | all  (installs into every agent's directory)
      --skip-upstream  Install only Linchpin skills; don't vendor the upstream base layer
  -h, --help        Show this help

Examples:
  npx @linchpinagency/skills                    # Linchpin skills + base layer -> ./.claude/skills
  npx @linchpinagency/skills wp-studio-cli      # one Linchpin skill (+ base layer)
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

  for (const base of bases) {
    fs.mkdirSync(base, { recursive: true });
    for (const name of wanted) {
      const dest = path.join(base, name);
      fs.rmSync(dest, { recursive: true, force: true });
      fs.cpSync(path.join(SKILLS_ROOT, name), dest, { recursive: true });
      console.log(`✓ ${name} -> ${dest}`);
    }
  }
  const labels = agentIds.map((id) => AGENTS[id].label).join(', ');
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
  const version = packageVersion();
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
