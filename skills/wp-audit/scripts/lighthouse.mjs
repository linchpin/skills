#!/usr/bin/env node
// Run Lighthouse on a set of pages, mobile and desktop, the same way every time, and summarize.
// Zero dependencies of its own: Node >= 18; it runs Lighthouse through `npx`.
//
//   node lighthouse.mjs --out lh-before https://example.com/ https://example.com/about/
//   node lighthouse.mjs --out lh-after --forms mobile <urls>
//   node lighthouse.mjs --summary lh-before                    # re-print a finished run
//
// Writes one JSON report per page and form factor into --out. It sends GET requests to warm
// each page and nothing else.
//
// Why a script and not prose: three things make hand-run Lighthouse numbers incomparable,
// and agents get each of them wrong. (1) The DevTools MCP's lighthouse_audit leaves out the
// Performance category, so the score people ask about is missing. (2) An unwarmed page
// measures the server's render, not the page; and page caches that key on a phone user
// agent (Batcache does) keep a separate copy for mobile, so warming with a desktop agent
// leaves the mobile run cold. (3) An unpinned `npx lighthouse` changes scoring between
// before and after. This warms with both agents and pins the version.
//
// `summarize()` is pure and exported for lighthouse.test.mjs.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { USER_AGENTS } from './footprint.mjs';

// Pin, so a before/after pair is scored by the same Lighthouse. Bump deliberately.
export const LIGHTHOUSE_VERSION = '13.5.0';

const METRICS = [
  ['FCP', 'first-contentful-paint', 1000, 's'],
  ['LCP', 'largest-contentful-paint', 1000, 's'],
  ['TBT', 'total-blocking-time', 1, 'ms'],
  ['CLS', 'cumulative-layout-shift', 1, ''],
  ['SI', 'speed-index', 1000, 's'],
  ['TTFB', 'server-response-time', 1, 'ms'],
];
const SCORE_AUDIT_SKIP = new Set(METRICS.map((m) => m[1]).concat(['interactive', 'max-potential-fid']));

const slugOf = (url) => {
  const u = new URL(url);
  return (u.pathname.replace(/^\/|\/$/g, '').replace(/\//g, '_') || 'home') + (u.search ? '_q' : '');
};

/** A table of scores and metrics, then the failing audits ranked by how many runs fail them. Pure. */
export function summarize(reports) {
  const lines = [];
  const header = [
    'page'.padEnd(36),
    'form   ',
    'perf',
    'a11y',
    ' bp ',
    'seo ',
    ...METRICS.map((m) => m[0].padStart(6)),
  ];
  lines.push(header.join(' '));
  const failing = new Map();
  const warnings = [];
  for (const { slug, form, report } of reports) {
    const cat = (k) => {
      const s = report.categories?.[k]?.score;
      return s === null || s === undefined ? '  - ' : String(Math.round(s * 100)).padStart(4);
    };
    const metric = ([, id, div, unit]) => {
      const v = report.audits?.[id]?.numericValue;
      if (v === undefined) return '-'.padStart(6);
      return (
        unit === '' ? v.toFixed(3) : unit === 's' ? (v / div).toFixed(1) : String(Math.round(v))
      ).padStart(6);
    };
    lines.push(
      [
        slug.slice(0, 36).padEnd(36),
        form.padEnd(7),
        cat('performance'),
        cat('accessibility'),
        cat('best-practices'),
        cat('seo'),
        ...METRICS.map(metric),
      ].join(' '),
    );
    const requested = report.requestedUrl || '';
    const final = report.finalDisplayedUrl || report.finalUrl || '';
    if (requested && final && new URL(requested).host !== new URL(final).host) {
      warnings.push(`${slug}/${form}: ended on ${final}, not the page (a sign-in or Access wall?)`);
    }
    for (const [id, audit] of Object.entries(report.audits || {})) {
      if (SCORE_AUDIT_SKIP.has(id) || audit.score === null || audit.score >= 0.9) continue;
      if (!['metricSavings', 'numeric', 'binary'].includes(audit.scoreDisplayMode)) continue;
      const entry = failing.get(id) || { id, runs: 0, example: '' };
      entry.runs += 1;
      if (!entry.example && audit.displayValue) entry.example = `${slug}/${form}: ${audit.displayValue}`;
      failing.set(id, entry);
    }
  }
  if (warnings.length) lines.push('', 'Warnings:', ...warnings.map((w) => `  - ${w}`));
  lines.push('', 'Failing audits (runs failing, an example):');
  for (const f of [...failing.values()].sort((a, b) => b.runs - a.runs)) {
    lines.push(`  ${String(f.runs).padStart(3)}  ${f.id.padEnd(40)} ${f.example}`);
  }
  return lines.join('\n');
}

function readReports(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const [slug, form] = f.replace(/\.json$/, '').split('.');
      return { slug, form, report: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) };
    });
}

async function warm(url, ua) {
  for (let i = 0; i < 2; i++) {
    await fetch(url, { headers: { 'user-agent': ua } })
      .then((r) => r.arrayBuffer())
      .catch(() => {});
  }
}

async function main(argv) {
  const args = [...argv];
  const take = (flag) => {
    const i = args.indexOf(flag);
    return i === -1 ? null : args.splice(i, 2)[1];
  };
  const summaryDir = take('--summary');
  if (summaryDir) {
    console.log(summarize(readReports(summaryDir)));
    return;
  }
  const out = take('--out');
  const forms = (take('--forms') || 'mobile,desktop').split(',');
  if (!out || !args.length) {
    console.error(
      'Usage: lighthouse.mjs --out <dir> [--forms mobile,desktop] <url>…\n       lighthouse.mjs --summary <dir>',
    );
    process.exitCode = 2;
    return;
  }
  fs.mkdirSync(out, { recursive: true });
  for (const url of args) {
    for (const form of forms) {
      await warm(url, USER_AGENTS[form] || USER_AGENTS.desktop);
      const file = path.join(out, `${slugOf(url)}.${form}.json`);
      const lhArgs = [
        '-y',
        `lighthouse@${LIGHTHOUSE_VERSION}`,
        url,
        '--quiet',
        '--output=json',
        `--output-path=${file}`,
        '--chrome-flags=--headless=new --no-first-run',
        '--max-wait-for-load=60000',
      ];
      if (form === 'desktop') lhArgs.splice(3, 0, '--preset=desktop');
      try {
        execFileSync('npx', lhArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
        console.error(`ok   ${slugOf(url)} ${form}`);
      } catch (err) {
        console.error(`FAIL ${slugOf(url)} ${form}: ${String(err.stderr || err.message).split('\n')[0]}`);
      }
    }
  }
  console.log(summarize(readReports(out)));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
