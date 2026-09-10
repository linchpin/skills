#!/usr/bin/env node
// Scaffold a new skill from the house template.
//
//   npm run new-skill -- <name> [--tier a|b|c] [--domain "WordPress"]
//   node scripts/new-skill.mjs wp-thing --tier b
//
// Creates skills/<name>/ from skills/write-a-linchpin-skill/references/template.md, adds a
// draft row to the README catalog, and prints what is left to write by hand.
//
// The template is READ, never duplicated here: it belongs to write-a-linchpin-skill, which
// owns the standard. A second copy in this file is a second thing to keep in step, and the
// one that would quietly fall behind.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS = path.join(ROOT, 'skills');
const TEMPLATE = path.join(SKILLS, 'write-a-linchpin-skill', 'references', 'template.md');
const README = path.join(ROOT, 'README.md');

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Same prefix vocabulary as the standard's naming table. Un-prefixed means cross-cutting.
const DOMAIN_BY_PREFIX = [
  ['wp-', 'WordPress'],
  ['wordpress-', 'WordPress'],
  ['react-', 'React'],
  ['cf-', 'Cloudflare'],
  ['seo-', 'Marketing'],
  ['design-', 'Design'],
];

function usage(code = 0) {
  console.log(
    `
Scaffold a new Linchpin skill.

Usage:
  npm run new-skill -- <name> [options]

Arguments:
  name              kebab-case, and it becomes the directory name

Options:
  --tier a|b|c      a = SKILL.md only (default), b = + references/, c = + scripts/
  --domain <text>   Catalog "Domain" cell; inferred from the name prefix otherwise
  -h, --help        Show this help

The standard is skills/write-a-linchpin-skill/SKILL.md — load it before writing the body.
`.trimStart()
  );
  process.exit(code);
}

function parseArgs(argv) {
  const opts = { name: null, tier: 'a', domain: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') usage();
    else if (a === '--tier') opts.tier = String(argv[++i] || '').toLowerCase();
    else if (a.startsWith('--tier=')) opts.tier = a.slice('--tier='.length).toLowerCase();
    else if (a === '--domain') opts.domain = argv[++i];
    else if (a.startsWith('--domain=')) opts.domain = a.slice('--domain='.length);
    else if (a.startsWith('-')) {
      console.error(`Unknown option: ${a}`);
      usage(1);
    } else if (!opts.name) opts.name = a;
    else {
      console.error(`Unexpected argument: ${a}`);
      usage(1);
    }
  }
  return opts;
}

/** Pull the fenced ```markdown block out of the template — that block IS the skeleton. */
function skeletonFromTemplate() {
  const md = fs.readFileSync(TEMPLATE, 'utf8');
  const fence = md.match(/```markdown\n([\s\S]*?)```/);
  if (!fence) {
    console.error(`Could not find a \`\`\`markdown block in ${path.relative(ROOT, TEMPLATE)}.`);
    console.error('The template owns the skeleton; fix it there rather than inlining one here.');
    process.exit(1);
  }
  return fence[1];
}

function inferDomain(name) {
  for (const [prefix, domain] of DOMAIN_BY_PREFIX) {
    if (name.startsWith(prefix)) return domain;
  }
  return 'Workflow';
}

/**
 * Insert a draft catalog row. The validator errors when a skill has no row, so scaffolding
 * without one hands you a failing repo. It is deliberately a *draft*: the surrounding rows
 * are hand-written prose that reads better than any generated summary, so this marks itself
 * as needing an edit rather than pretending to be finished.
 */
function addCatalogRow(name, domain) {
  const md = fs.readFileSync(README, 'utf8');
  const lines = md.split('\n');

  // Anchor on the last row of the Linchpin catalog: the final table row before the
  // "Base layer" heading that follows it.
  const baseLayerIdx = lines.findIndex((l) => /^###\s+Base layer/.test(l));
  let insertAt = -1;
  for (let i = (baseLayerIdx === -1 ? lines.length : baseLayerIdx) - 1; i >= 0; i--) {
    if (lines[i].trimStart().startsWith('|')) {
      insertAt = i + 1;
      break;
    }
  }
  if (insertAt === -1) {
    console.warn('  ! Could not locate the README catalog table — add the row by hand.');
    return false;
  }

  lines.splice(insertAt, 0, `| \`${name}\` | ${domain} | TODO — one line on what this does. |`);
  fs.writeFileSync(README, lines.join('\n'));
  return true;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.name) usage(1);

  if (!NAME_RE.test(opts.name)) {
    console.error(`"${opts.name}" is not kebab-case. Use lowercase words joined by hyphens.`);
    process.exit(1);
  }
  if (!['a', 'b', 'c'].includes(opts.tier)) {
    console.error(`--tier must be a, b, or c (got "${opts.tier}").`);
    process.exit(1);
  }

  const dir = path.join(SKILLS, opts.name);
  if (fs.existsSync(dir)) {
    console.error(`skills/${opts.name}/ already exists — pick another name, or edit it directly.`);
    process.exit(1);
  }

  const domain = opts.domain || inferDomain(opts.name);
  const body = skeletonFromTemplate().replace('<kebab-case-name-matching-the-directory>', opts.name);

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), body);
  const created = [`skills/${opts.name}/SKILL.md`];

  if (opts.tier === 'b' || opts.tier === 'c') {
    fs.mkdirSync(path.join(dir, 'references'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'references', 'README.md'),
      `# ${opts.name} references\n\nDetail promoted out of SKILL.md — command matrices, schemas, recipes.\nDelete this file once there is a real reference here.\n`
    );
    created.push(`skills/${opts.name}/references/`);
  }
  if (opts.tier === 'c') {
    fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
    created.push(`skills/${opts.name}/scripts/`);
  }

  const rowAdded = addCatalogRow(opts.name, domain);
  if (rowAdded) created.push('README.md (draft catalog row)');

  console.log(`Created:\n${created.map((c) => `  ${c}`).join('\n')}\n`);
  console.log(`Tier ${opts.tier.toUpperCase()}. Now, in order:\n`);
  console.log('  1. Write the `description` — it is the whole retrieval surface. Capability');
  console.log('     first, then "Use when …" with two or more phrasings a user would type.');
  console.log('  2. Replace every <…> placeholder, including the `allowed-tools` grants —');
  console.log('     read-only commands this skill actually runs, never bare Bash.');
  console.log(`  3. Fix the draft README row for \`${opts.name}\` (Domain: ${domain}).`);
  if (opts.tier === 'c') {
    console.log('  4. Tier C needs a named failure it prevents. If you cannot name one, drop to B.');
  }
  console.log(`\nThe standard: skills/write-a-linchpin-skill/SKILL.md`);
  console.log(`Then: node scripts/validate-skills.mjs ${opts.name}`);
}

main();
