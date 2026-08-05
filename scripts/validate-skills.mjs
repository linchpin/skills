#!/usr/bin/env node
// Validates every skill in ./skills against the house standard documented in
// skills/write-a-linchpin-skill/SKILL.md. Zero dependencies — pure Node (>=18).
//
//   node scripts/validate-skills.mjs             # all skills
//   node scripts/validate-skills.mjs wp-pressable task-tracking
//   node scripts/validate-skills.mjs --strict    # treat warnings as failures
//
// Exits 1 when any skill has an error (or, with --strict, a warning).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_ROOT = path.join(ROOT, 'skills');
const README = path.join(ROOT, 'README.md');

// Section anchors every skill must carry so any agent knows where to look.
// Matched against normalized `## ` headings; `test` gets the heading text.
const REQUIRED_SECTIONS = [
  { label: '## When to use', test: (h) => h.startsWith('when to use') },
  { label: '## Guardrails', test: (h) => h === 'guardrails' },
  { label: '## Done', test: (h) => h.startsWith('done') },
];

const TRIGGER_RE = /\bUse (when|whenever|for|before|after|during)\b/i;
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
// Absolute paths that only exist on one person's machine. Placeholder users are allowed so
// skills can show host paths as counter-examples (wp-studio-cli's PHP-WASM ABSPATH rule).
const HOST_PATH_RE = /(?:\/Users\/|\/home\/)([A-Za-z0-9._-]+)|([A-Z]:\\\\?[A-Za-z])/g;
const PLACEHOLDER_USERS = new Set(['me', 'you', 'user', 'username', 'your-user', '...', '…']);

const DESC_MIN = 80;
const DESC_MAX = 1000;
const DESC_WARN = 700;

// Undisclosed sprawl, not length, is what the tier model cares about: a long body is fine
// when the reference-shaped parts (templates, command matrices, schemas) have been promoted
// to `references/`. Gating on that presence makes the check unsatisfiable by compressing
// prose — which is how a plain line ceiling gets gamed, at the cost of the very clarity it
// was meant to protect.
const BODY_WARN_LINES = 200;

/**
 * Parse the leading `---` frontmatter block. Supports flat `key: value` pairs plus
 * folded/literal scalars (`key: >` / `key: |`), which is all the Agent Skills spec needs.
 */
function parseFrontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!m) return null;
  const out = {};
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    const [, key, rawValue] = kv;
    if (rawValue === '>' || rawValue === '|' || rawValue === '>-' || rawValue === '|-') {
      const block = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) block.push(lines[++i].trim());
      out[key] = block.join(' ').trim();
    } else {
      out[key] = rawValue.replace(/^["']|["']$/g, '').trim();
    }
  }
  return out;
}

/** Relative paths the skill points at, from markdown links and backticked path literals. */
function referencedPaths(body) {
  const found = new Set();
  for (const [, target] of body.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    found.add(target.split('#')[0]);
  }
  // `references/foo.md`, `scripts/bar.mjs`, `examples/baz.json` written as inline code.
  for (const [, target] of body.matchAll(/`((?:references|scripts|examples)\/[\w./-]+)`/g)) {
    found.add(target);
  }
  return [...found].filter(Boolean);
}

function validateSkill(name, readme) {
  const dir = path.join(SKILLS_ROOT, name);
  const errors = [];
  const warnings = [];
  const skillPath = path.join(dir, 'SKILL.md');

  if (!fs.existsSync(skillPath)) return { name, errors: ['no SKILL.md'], warnings };

  const md = fs.readFileSync(skillPath, 'utf8');
  const fm = parseFrontmatter(md);
  const body = md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');

  // --- Frontmatter -----------------------------------------------------------------
  if (!fm) {
    errors.push('missing `---` frontmatter block');
  } else {
    if (!fm.name) errors.push('frontmatter: `name` is required');
    else if (fm.name !== name) errors.push(`frontmatter: \`name: ${fm.name}\` must equal the directory name \`${name}\``);
    else if (!NAME_RE.test(fm.name)) errors.push(`frontmatter: \`name: ${fm.name}\` must be kebab-case`);

    if (!fm.description) {
      errors.push('frontmatter: `description` is required — it is the only thing an agent reads before loading the skill');
    } else {
      const len = fm.description.length;
      if (len < DESC_MIN) errors.push(`frontmatter: \`description\` is ${len} chars — too thin to match reliably (min ${DESC_MIN})`);
      else if (len > DESC_MAX) errors.push(`frontmatter: \`description\` is ${len} chars — that is a body, not a trigger (max ${DESC_MAX})`);
      else if (len > DESC_WARN) warnings.push(`\`description\` is ${len} chars — consider tightening (soft limit ${DESC_WARN})`);
      if (!TRIGGER_RE.test(fm.description)) errors.push('frontmatter: `description` must state when to reach for the skill ("Use when …")');
    }

    if (!fm.version) errors.push('frontmatter: `version` is required (semver)');
    else if (!SEMVER_RE.test(fm.version)) errors.push(`frontmatter: \`version: ${fm.version}\` is not semver`);
  }

  // --- Structure -------------------------------------------------------------------
  if (!/^#\s+\S/m.test(body)) warnings.push('no `# Title` heading');

  const headings = [...body.matchAll(/^##\s+(.+?)\s*$/gm)].map(([, h]) =>
    h.toLowerCase().replace(/[`*_]/g, '').replace(/[.:!?]+$/, '').trim()
  );
  for (const section of REQUIRED_SECTIONS) {
    if (!headings.some((h) => section.test(h))) errors.push(`missing required section \`${section.label}\``);
  }

  const lineCount = body.split('\n').length;
  if (lineCount > BODY_WARN_LINES && !fs.existsSync(path.join(dir, 'references'))) {
    warnings.push(
      `SKILL.md body is ${lineCount} lines with no references/ — promote the templates, ` +
        `command matrices, and schemas (Tier B; see the tier model)`
    );
  }

  // --- Portability -----------------------------------------------------------------
  for (const [match, user] of md.matchAll(HOST_PATH_RE)) {
    if (user && PLACEHOLDER_USERS.has(user)) continue;
    errors.push(`machine-specific absolute path \`${match}\` — skills must be portable`);
    break;
  }

  // --- Referenced files exist ------------------------------------------------------
  // Paths resolve against the skill directory first, then the repo root (skills may point
  // at repo tooling such as `scripts/validate-skills.mjs`).
  for (const rel of referencedPaths(body)) {
    if (fs.existsSync(path.resolve(dir, rel)) || fs.existsSync(path.resolve(ROOT, rel))) continue;
    errors.push(`referenced file not found: \`${rel}\``);
  }

  // --- Catalog ---------------------------------------------------------------------
  const listed = readme.split('\n').some((line) => line.trimStart().startsWith('|') && line.includes(`\`${name}\``));
  if (!listed) errors.push('not listed in the README "Available skills" table');

  return { name, errors, warnings };
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  const requested = args.filter((a) => !a.startsWith('-'));

  if (!fs.existsSync(SKILLS_ROOT)) {
    console.error('No skills/ directory found.');
    process.exit(1);
  }

  const all = fs
    .readdirSync(SKILLS_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const unknown = requested.filter((n) => !all.includes(n));
  if (unknown.length) {
    console.error(`Unknown skill(s): ${unknown.join(', ')}`);
    process.exit(1);
  }

  const targets = requested.length ? requested : all;
  const readme = fs.existsSync(README) ? fs.readFileSync(README, 'utf8') : '';
  const results = targets.map((name) => validateSkill(name, readme));

  let errorCount = 0;
  let warningCount = 0;
  for (const { name, errors, warnings } of results) {
    errorCount += errors.length;
    warningCount += warnings.length;
    if (!errors.length && !warnings.length) {
      console.log(`✓ ${name}`);
      continue;
    }
    console.log(`${errors.length ? '✗' : '⚠'} ${name}`);
    for (const e of errors) console.log(`    error:   ${e}`);
    for (const w of warnings) console.log(`    warning: ${w}`);
  }

  const summary = `\n${targets.length} skill(s) checked — ${errorCount} error(s), ${warningCount} warning(s).`;
  console.log(summary);
  if (errorCount || (strict && warningCount)) {
    console.log('See skills/write-a-linchpin-skill/SKILL.md for the standard.');
    process.exit(1);
  }
}

main();
