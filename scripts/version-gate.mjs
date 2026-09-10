#!/usr/bin/env node
// Every skill whose files changed must have its frontmatter `version` bumped.
//
//   node scripts/version-gate.mjs                 # against origin/main
//   node scripts/version-gate.mjs --base main     # against something else
//
// Why this needs enforcing: `version` is the only signal a consuming project has that a
// skill changed. `bin/install.mjs` compares the installed version against the package's to
// decide what to show as an update — so a behaviour change shipped on an unbumped version
// lands as "unchanged" and nobody re-reads it. The skill silently drifts out of date in
// every install at once.
//
// Exits 1 listing the skills that need a bump. Exits 0 when there is nothing to compare
// against (a shallow clone with no base) rather than failing a build for that.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function git(args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    if (allowFail) return null;
    throw err;
  }
}

function versionIn(text) {
  if (!text) return null;
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return null;
  const m = fm[1].match(/^version:\s*(.*)$/m);
  return m ? m[1].replace(/^["']|["']$/g, '').trim() : null;
}

function main() {
  const args = process.argv.slice(2);
  const baseArg = args.includes('--base') ? args[args.indexOf('--base') + 1] : null;

  // Prefer an explicit base, else origin/main, else main — a local branch cut before the
  // remote was fetched still has something to diff against.
  const candidates = baseArg ? [baseArg] : ['origin/main', 'main'];
  const base = candidates.find((c) => git(['rev-parse', '--verify', c], { allowFail: true }));
  if (!base) {
    console.log(`No base ref to compare against (tried ${candidates.join(', ')}) — skipping.`);
    return;
  }

  const mergeBase = git(['merge-base', base, 'HEAD'], { allowFail: true }) || base;
  const changed = (git(['diff', '--name-only', `${mergeBase}...HEAD`]) || '')
    .split('\n')
    .filter((f) => f.startsWith('skills/'));

  if (!changed.length) {
    console.log(`No skill files changed against ${base}.`);
    return;
  }

  // Group by skill. A change anywhere in the package counts — a reference file or a script
  // is as much a behaviour change as SKILL.md itself.
  const touched = [...new Set(changed.map((f) => f.split('/')[1]).filter(Boolean))].sort();

  const needBump = [];
  const bumped = [];
  for (const name of touched) {
    const file = `skills/${name}/SKILL.md`;
    const nowPath = path.join(ROOT, file);

    // Deleted outright: nothing to bump. It should be in retired.json instead, which is a
    // different check and a different conversation.
    if (!fs.existsSync(nowPath)) continue;

    const before = git(['show', `${mergeBase}:${file}`], { allowFail: true });
    if (before === null) {
      bumped.push(`${name} (new)`); // a brand-new skill has nothing to bump from
      continue;
    }

    const wasV = versionIn(before);
    const nowV = versionIn(fs.readFileSync(nowPath, 'utf8'));
    if (wasV && nowV && wasV === nowV) needBump.push({ name, version: nowV });
    else bumped.push(`${name} (${wasV} -> ${nowV})`);
  }

  for (const b of bumped) console.log(`  ok       ${b}`);
  for (const n of needBump) console.log(`  NO BUMP  ${n.name} (still ${n.version})`);

  if (needBump.length) {
    console.log(
      `\n${needBump.length} skill(s) changed without a version bump.\n\n` +
        `Bump \`version\` in each SKILL.md. It is how a consuming project's installer knows\n` +
        `to offer the change — without it the update shows as "unchanged" and nobody\n` +
        `re-reads the skill. Minor for a behaviour change, patch for a typo.`
    );
    process.exit(1);
  }
  console.log(`\n${touched.length} skill(s) changed, all versioned.`);
}

main();
