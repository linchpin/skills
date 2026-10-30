#!/usr/bin/env node
// Lighthouse runs for the wp-performance-audit skill: run, reduce, embed in a report, compare.
// Zero dependencies — Node >= 18. Lighthouse itself runs through npx; Chrome must be installed.
//
//   node lighthouse-runs.mjs run --urls urls.txt --label production --out ./lh/baseline
//   node lighthouse-runs.mjs run --baseline PERFORMANCE-AUDIT-2026-10-30.md --label production --out ./lh/followup
//   node lighthouse-runs.mjs run --urls urls.txt --block '*googletagmanager.com*' --out ./lh/gtm
//   node lighthouse-runs.mjs embed PERFORMANCE-AUDIT-2026-10-30.md ./lh/baseline/summary.json --metrics metrics.json
//   node lighthouse-runs.mjs compare PERFORMANCE-AUDIT-2026-10-30.md ./lh/followup/summary.json --metrics metrics.json
//   node lighthouse-runs.mjs compare ./lh/release-2.63/summary.json ./lh/branch/summary.json
//   node lighthouse-runs.mjs report ./lh/baseline/summary.json
//
// urls.txt holds one page per line, optionally named: `Homepage | https://example.com/`.
// Blank lines and lines starting with # are ignored.
//
// READ-ONLY against the site: it loads pages the way a visitor would. It writes only under
// --out (raw Lighthouse reports in raw/, plus summary.json and summary.md), and `embed`
// rewrites the data block at the end of the report it is given.
//
// Why a script and not prose: the reduction is where hand-run audits drift apart. One audit
// quotes a single run, the next averages scores, a third mixes metrics from different runs, so
// a before/after across audits compares different things. This one does it the same way every
// time: the representative run is the median-scoring run, and TBT, which swings most between
// runs, is the median across all runs. With --block, runs alternate between normal and blocked
// so both conditions share the same machine, network and hour.
//
// The data block. `embed` writes the lab summary and the audit's other measures into the report
// as an HTML comment at the end of the file, so it is invisible when rendered and travels with
// the Markdown. `run --baseline` reads it to reuse the baseline's pages, run count, form factors
// and exact Lighthouse version; `compare` reads it as the "before" side. A report whose block was
// stripped still compares if its tables came from this script, because they are parsed back, but
// the page URLs and the Lighthouse version are lost with the block.
//
// Everything except runLighthouse() and the CLI is pure and exported for the test file.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULT_RUNS = 3;
export const DEFAULT_LIGHTHOUSE = 'lighthouse@12';
// The other three categories come from the same runs at almost no cost. Their scores are
// Lighthouse's automated checks, never an accessibility audit.
export const DEFAULT_CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
// A page counts as changed past run-to-run noise at 8+ score points, or an LCP move of at least
// 1 s that is also at least 20% of the baseline LCP.
export const SCORE_NOISE = 8;
export const LCP_NOISE_MS = 1000;
export const LCP_NOISE_SHARE = 0.2;

// --- Parsing ----------------------------------------------------------------------------

export function parseUrlList(text) {
  const pages = [];
  for (const raw of text.split(/\r?\n|,(?=\s*https?:)/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const bar = line.indexOf('|');
    const name = bar === -1 ? '' : line.slice(0, bar).trim();
    const url = (bar === -1 ? line : line.slice(bar + 1)).trim();
    if (!/^https?:\/\//.test(url)) throw new Error(`not a URL: ${line}`);
    pages.push({ name, url });
  }
  return pages;
}

// Pull the audited numbers out of one Lighthouse JSON report. Missing audits come back null
// rather than throwing: Lighthouse renames and retires audits between majors.
export function extractMetrics(lhr) {
  const num = (id) => lhr.audits?.[id]?.numericValue ?? null;
  const thirdParties = (lhr.audits?.['third-party-summary']?.details?.items ?? [])
    .map((item) => ({
      entity: typeof item.entity === 'object' ? item.entity?.text : item.entity,
      mainThreadMs: item.mainThreadTime ?? 0,
      blockingMs: item.blockingTime ?? 0,
      bytes: item.transferSize ?? 0,
    }))
    .filter((t) => t.entity)
    .sort((a, b) => b.mainThreadMs - a.mainThreadMs)
    .slice(0, 5);
  const cat = (id) => {
    const s = lhr.categories?.[id]?.score;
    return s == null ? null : Math.round(s * 100);
  };
  return {
    score: cat('performance'),
    a11y: cat('accessibility'),
    bestPractices: cat('best-practices'),
    seo: cat('seo'),
    fcp: num('first-contentful-paint'),
    lcp: num('largest-contentful-paint'),
    tbt: num('total-blocking-time'),
    si: num('speed-index'),
    cls: num('cumulative-layout-shift'),
    bytes: num('total-byte-weight'),
    scriptMs: num('bootup-time'),
    thirdParties,
    error: lhr.runtimeError?.code ?? null,
  };
}

// "6.7 s" → 6700, "2,233 ms" → 2233, "7.1 MB" → bytes, "52" → 52, "n/a" → null.
export function parseValue(cell) {
  const m = String(cell).replace(/,/g, '').trim().match(/^(-?[\d.]+)\s*(ms|s|KB|MB)?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = (m[2] || '').toLowerCase();
  if (unit === 's') return n * 1000;
  if (unit === 'kb') return n * 1024;
  if (unit === 'mb') return n * 1024 * 1024;
  return n;
}

// The fallback when a report's data block is gone: read back the result tables this script
// wrote (`| Page | Score | FCP | LCP | TBT | Speed Index | …`), taking the form factor from the
// nearest heading. Blocked-condition tables and before → after tables are skipped.
export function parseReportTables(md) {
  const lines = md.split(/\r?\n/);
  const results = [];
  let formFactor = null;
  let blocked = false;
  for (let i = 0; i < lines.length; i++) {
    const heading = lines[i].match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      formFactor = /desktop/i.test(heading[1]) ? 'desktop' : /mobile/i.test(heading[1]) ? 'mobile' : null;
      blocked = /blocked/i.test(heading[1]);
      continue;
    }
    if (!formFactor || blocked || !/^\|\s*Page\s*\|\s*Score\s*\|\s*FCP\s*\|\s*LCP\s*\|\s*TBT\s*\|\s*Speed Index\s*\|/i.test(lines[i])) continue;
    for (i += 2; i < lines.length && lines[i].trim().startsWith('|'); i++) {
      const cells = lines[i].split('|').slice(1, -1).map((c) => c.trim());
      if (cells.some((c) => c.includes('→'))) continue;
      const label = cells[0].match(/^(.*?)\s*`([^`]+)`\s*$/);
      if (!label) continue;
      const score = parseValue(cells[1]);
      if (score == null) continue;
      results.push({
        name: label[1],
        path: label[2],
        formFactor,
        condition: 'normal',
        representative: { score, fcp: parseValue(cells[2]), lcp: parseValue(cells[3]), si: parseValue(cells[5]), cls: parseValue(cells[6] ?? ''), bytes: parseValue(cells[7] ?? '') },
        tbtMedian: parseValue(cells[4]),
      });
    }
    i--;
  }
  return results;
}

// --- The data block ---------------------------------------------------------------------

const BLOCK_RE = /\n*<!-- wp-performance-audit:data\n([\s\S]*?)\n-->\n?/;

export function readDataBlock(md) {
  const m = md.match(BLOCK_RE);
  return m ? JSON.parse(m[1]) : null;
}

// Replace the block if there is one, otherwise append it. `-->` inside a string would end the
// comment early, so it is escaped; > is still valid JSON.
export function writeDataBlock(md, data) {
  const json = JSON.stringify({ schema: 1, tool: 'wp-performance-audit', ...data }, null, 2).replace(/-->/g, '--\\u003e');
  const block = `\n\n<!-- wp-performance-audit:data\n${json}\n-->\n`;
  return BLOCK_RE.test(md) ? md.replace(BLOCK_RE, block) : `${md.trimEnd()}${block}`;
}

// What a follow-up run must reuse to be comparable: same pages, runs, form factors, and the
// exact Lighthouse version, because scores are not comparable across versions.
export function baselineOptions(md) {
  const lab = readDataBlock(md)?.lab;
  if (!lab) throw new Error('the baseline has no wp-performance-audit data block: pass --urls (and --lighthouse) yourself');
  const seen = new Set();
  const pages = lab.pages ?? lab.results.filter((r) => !seen.has(r.url) && seen.add(r.url)).map((r) => ({ name: r.name, url: r.url }));
  return {
    pages,
    runs: lab.runs ?? DEFAULT_RUNS,
    formFactors: lab.formFactors ?? [...new Set(lab.results.map((r) => r.formFactor))],
    lighthouse: lab.lighthouseVersion ? `lighthouse@${lab.lighthouseVersion}` : DEFAULT_LIGHTHOUSE,
  };
}

// One shape for every input `compare` accepts: a summary.json, or a report with a data block
// or with this script's tables.
export function loadSide({ text, file, measures }) {
  if (/\.json$/i.test(file)) {
    const lab = JSON.parse(text);
    return { label: lab.label, date: lab.date, lighthouseVersion: lab.lighthouseVersion, results: lab.results, measures: measures ?? [] };
  }
  const data = readDataBlock(text);
  if (data?.lab) {
    return { label: data.lab.label, date: data.lab.date, lighthouseVersion: data.lab.lighthouseVersion, results: data.lab.results, measures: measures ?? data.measures ?? [] };
  }
  const results = parseReportTables(text);
  if (!results.length) throw new Error(`${file}: no data block and no result tables to read`);
  return { label: path.basename(file, '.md'), date: null, lighthouseVersion: null, results, measures: measures ?? [], parsed: true };
}

// --- Reduction --------------------------------------------------------------------------

export function median(values) {
  const v = values.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

// The run whose score sits at the median. With an even count, the run closest to the median
// score, earliest first, so the choice is deterministic.
export function pickMedianRun(runs) {
  const ok = runs.filter((r) => r.score != null && !r.error);
  if (!ok.length) return null;
  const target = median(ok.map((r) => r.score));
  let best = ok[0];
  for (const r of ok) if (Math.abs(r.score - target) < Math.abs(best.score - target)) best = r;
  return best;
}

export function summarize(runs) {
  const ok = runs.filter((r) => r.score != null && !r.error);
  const rep = pickMedianRun(runs);
  return {
    representative: rep,
    tbtMedian: median(ok.map((r) => r.tbt)),
    scores: runs.map((r) => (r.error ? `error:${r.error}` : r.score)),
    failed: runs.length - ok.length,
  };
}

// Improved / Worse / Mixed / Within noise for one page, from its representative runs.
export function verdict(a, b) {
  const ds = b.score - a.score;
  const hasLcp = a.lcp != null && b.lcp != null && a.lcp > 0;
  const dl = hasLcp ? b.lcp - a.lcp : 0;
  const share = hasLcp ? dl / a.lcp : 0;
  const better = ds >= SCORE_NOISE || (dl <= -LCP_NOISE_MS && share <= -LCP_NOISE_SHARE);
  const worse = ds <= -SCORE_NOISE || (dl >= LCP_NOISE_MS && share >= LCP_NOISE_SHARE);
  if (better && worse) return 'Mixed';
  return better ? 'Improved' : worse ? 'Worse' : 'Within noise';
}

// --- Formatting -------------------------------------------------------------------------

const sec = (ms) => (ms == null ? 'n/a' : `${(ms / 1000).toFixed(1)} s`);
const msf = (ms) => (ms == null ? 'n/a' : `${Math.round(ms).toLocaleString('en-US')} ms`);
const mb = (b) => (b == null ? 'n/a' : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const clsf = (v) => (v == null ? 'n/a' : v.toFixed(3));
const arrow = (a, b, f) => `${f(a)} → ${f(b)}`;
const numf = (v) => Number(Number(v).toFixed(2)).toLocaleString('en-US');
const titleCase = (s) => `${s[0].toUpperCase()}${s.slice(1)}`;
const sideName = (side) => [side.label, side.date].filter(Boolean).join(' ');

export function pathOf(page) {
  if (page.path) return page.path;
  try {
    const u = new URL(page.url);
    return `${u.pathname || '/'}${u.search}`;
  } catch {
    return page.url;
  }
}

export function pageLabel(page) {
  const p = pathOf(page);
  return page.name ? `${page.name} \`${p}\`` : `\`${p}\``;
}

// Pages match on path, not full URL, so a baseline whose block was lost (tables only) still
// lines up with a fresh run.
const groupKey = (r) => `${pathOf(r)}|${r.formFactor}|${r.condition}`;

export function renderSummary(summary) {
  const out = [];
  const forms = [...new Set(summary.results.map((r) => r.formFactor))];
  const conditions = [...new Set(summary.results.map((r) => r.condition))];
  out.push(`Lighthouse ${summary.lighthouseVersion ?? '?'} · ${summary.runs} run(s) per page · label: ${summary.label}`);
  out.push('Each row is the median-scoring run; TBT is the median across all runs.');
  for (const ff of forms) {
    for (const cond of conditions) {
      const rows = summary.results.filter((r) => r.formFactor === ff && r.condition === cond);
      if (!rows.length) continue;
      out.push('', `### ${titleCase(ff)}${cond === 'normal' ? '' : ` (${cond})`}`, '');
      out.push('| Page | Score | FCP | LCP | TBT | Speed Index | CLS | Page weight |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
      for (const r of rows) {
        const m = r.representative;
        if (!m) {
          out.push(`| ${pageLabel(r)} | all runs failed (${r.scores.join(', ')}) | | | | | | |`);
          continue;
        }
        out.push(`| ${pageLabel(r)} | ${m.score} | ${sec(m.fcp)} | ${sec(m.lcp)} | ${msf(r.tbtMedian)} | ${sec(m.si)} | ${clsf(m.cls)} | ${mb(m.bytes)} |`);
      }
      out.push('', `Individual scores: ${rows.map((r) => `${r.name || pageLabel(r)} ${r.scores.join('/')}`).join(' · ')}`);
    }
  }
  for (const ff of forms) {
    const rows = summary.results.filter((r) => r.formFactor === ff && r.condition === 'normal');
    const table = renderCategories(rows, ff);
    if (table) out.push('', table);
  }
  const tp = summary.results.filter((r) => r.condition === 'normal' && r.representative?.thirdParties?.length);
  if (tp.length) {
    out.push('', '### Top third parties (main-thread time, representative run)', '');
    for (const r of tp) {
      const list = r.representative.thirdParties.slice(0, 3).map((t) => `${t.entity} ${msf(t.mainThreadMs)}`).join(', ');
      out.push(`- ${pageLabel(r)}, ${r.formFactor}: ${list}`);
    }
  }
  if (conditions.length === 2) out.push('', renderPaired(summary));
  const failed = summary.results.reduce((n, r) => n + r.failed, 0);
  if (failed) out.push('', `**${failed} run(s) failed** and were left out of the medians.`);
  return out.join('\n');
}

const CATEGORY_KEYS = [['score', 'Performance'], ['a11y', 'Accessibility'], ['bestPractices', 'Best Practices'], ['seo', 'SEO']];
const hasCategories = (rows) => rows.some((r) => r.representative?.a11y != null);
const mean = (values) => {
  const v = values.filter((x) => x != null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
};
const orNa = (v) => (v == null ? 'n/a' : v);

// All four Lighthouse category scores per page, with the site-wide average clients ask for.
export function renderCategories(rows, formFactor) {
  if (!hasCategories(rows)) return '';
  const out = [`### Lighthouse category scores, ${formFactor}`, '', `| Page | ${CATEGORY_KEYS.map(([, l]) => l).join(' | ')} |`, `| --- |${' --- |'.repeat(CATEGORY_KEYS.length)}`];
  for (const r of rows) out.push(`| ${pageLabel(r)} | ${CATEGORY_KEYS.map(([k]) => orNa(r.representative?.[k])).join(' | ')} |`);
  out.push(`| **Average** | ${CATEGORY_KEYS.map(([k]) => orNa(mean(rows.map((r) => r.representative?.[k])))).join(' | ')} |`);
  return out.join('\n');
}

export function renderCategoryCompare(beforeRows, afterIndex, formFactor, names) {
  const pairs = beforeRows.map((r) => [r, afterIndex.get(groupKey(r))]).filter(([a, b]) => a.representative && b?.representative);
  if (!hasCategories(pairs.map(([a]) => a)) || !hasCategories(pairs.map(([, b]) => b))) return '';
  const cell = (a, b) => `${orNa(a)} → ${orNa(b)}`;
  const out = [`### Lighthouse category scores, ${formFactor} (${names})`, '', `| Page | ${CATEGORY_KEYS.map(([, l]) => l).join(' | ')} |`, `| --- |${' --- |'.repeat(CATEGORY_KEYS.length)}`];
  for (const [a, b] of pairs) out.push(`| ${pageLabel(a)} | ${CATEGORY_KEYS.map(([k]) => cell(a.representative[k], b.representative[k])).join(' | ')} |`);
  out.push(`| **Average** | ${CATEGORY_KEYS.map(([k]) => cell(mean(pairs.map(([a]) => a.representative[k])), mean(pairs.map(([, b]) => b.representative[k])))).join(' | ')} |`);
  return out.join('\n');
}

// Normal vs blocked, side by side: the attribution table.
export function renderPaired(summary) {
  const [a, b] = [...new Set(summary.results.map((r) => r.condition))];
  const index = new Map(summary.results.map((r) => [groupKey(r), r]));
  const out = [`### TBT with and without \`${summary.blocked.join('`, `')}\``, ''];
  out.push(`| Page | Form factor | TBT ${a} | TBT ${b} | Change | Score ${a} → ${b} |`, '| --- | --- | --- | --- | --- | --- |');
  for (const r of summary.results.filter((x) => x.condition === a)) {
    const other = index.get(`${pathOf(r)}|${r.formFactor}|${b}`);
    if (!other) continue;
    const change = r.tbtMedian ? `${Math.round(((other.tbtMedian - r.tbtMedian) / r.tbtMedian) * 100)}%` : 'n/a';
    out.push(`| ${pageLabel(r)} | ${r.formFactor} | ${msf(r.tbtMedian)} | ${msf(other.tbtMedian)} | ${change} | ${r.representative?.score ?? 'n/a'} → ${other.representative?.score ?? 'n/a'} |`);
  }
  return out.join('\n');
}

export function renderMeasures(before, after) {
  const a = new Map(before.map((m) => [m.key, m]));
  const b = new Map(after.map((m) => [m.key, m]));
  const keys = [...new Set([...a.keys(), ...b.keys()])];
  if (!keys.length) return '';
  const out = ['### Other measures', '', '| Measure | Baseline | Now | Change |', '| --- | --- | --- | --- |'];
  for (const key of keys) {
    const x = a.get(key);
    const y = b.get(key);
    const m = x ?? y;
    const fmt = (v) => (v?.value == null ? 'not measured' : `${numf(v.value)}${m.unit ? ` ${m.unit}` : ''}`);
    let change = 'n/a';
    if (x?.value != null && y?.value != null) {
      const d = y.value - x.value;
      const good = m.better === 'higher' ? d > 0 : d < 0;
      change = d === 0 ? 'no change' : `${d > 0 ? '+' : '−'}${numf(Math.abs(d))}${m.unit ? ` ${m.unit}` : ''}${m.better ? (good ? ' (better)' : ' (worse)') : ''}`;
    }
    out.push(`| ${m.label ?? key} | ${fmt(x)} | ${fmt(y)} | ${change} |`);
  }
  return out.join('\n');
}

export function renderCompare(before, after) {
  const out = [];
  if (before.parsed) {
    out.push('> **Note:** the baseline had no data block, so its numbers were read from its tables and its Lighthouse version is unknown.', '');
  } else if (before.lighthouseVersion !== after.lighthouseVersion) {
    out.push(`> **Warning:** Lighthouse ${before.lighthouseVersion} vs ${after.lighthouseVersion}. Scores are not comparable across versions; re-run with \`--baseline\` to pin the baseline's version.`, '');
  }
  const index = new Map(after.results.map((r) => [groupKey(r), r]));
  const forms = [...new Set(before.results.map((r) => r.formFactor))];
  const tally = [];
  const sections = [];
  for (const ff of forms) {
    const counts = { Improved: 0, Worse: 0, Mixed: 0, 'Within noise': 0 };
    const rows = [`### ${titleCase(ff)} (${sideName(before)} → ${sideName(after)})`, ''];
    rows.push('| Page | Score | FCP | LCP | TBT | Speed Index | Change |', '| --- | --- | --- | --- | --- | --- | --- |');
    let compared = 0;
    for (const r of before.results.filter((x) => x.formFactor === ff && x.condition === 'normal')) {
      const o = index.get(groupKey(r));
      const a = r.representative;
      const b = o?.representative;
      if (!a || !b) {
        rows.push(`| ${pageLabel(r)} | missing on one side | | | | | |`);
        continue;
      }
      const v = verdict(a, b);
      counts[v]++;
      compared++;
      rows.push(`| ${pageLabel(r)} | ${a.score} → ${b.score} | ${arrow(a.fcp, b.fcp, sec)} | ${arrow(a.lcp, b.lcp, sec)} | ${arrow(r.tbtMedian, o.tbtMedian, msf)} | ${arrow(a.si, b.si, sec)} | ${v} |`);
    }
    const parts = [`improved on ${counts.Improved} of ${compared} pages`];
    if (counts.Worse) parts.push(`worse on ${counts.Worse}`);
    if (counts.Mixed) parts.push(`mixed on ${counts.Mixed}`);
    parts.push(`within noise on ${counts['Within noise']}`);
    tally.push(`- ${titleCase(ff)}: ${parts.join(', ')}.`);
    sections.push(rows.join('\n'));
    const cats = renderCategoryCompare(before.results.filter((x) => x.formFactor === ff && x.condition === 'normal'), index, ff, `${sideName(before)} → ${sideName(after)}`);
    if (cats) sections.push(cats);
  }
  out.push(...tally, '', `"Improved" or "Worse" means ${SCORE_NOISE}+ score points, or an LCP change of ${LCP_NOISE_MS / 1000} s or more that is also ${LCP_NOISE_SHARE * 100}%+ of the baseline LCP. Anything smaller is within run-to-run noise.`);
  for (const s of sections) out.push('', s);
  const measures = renderMeasures(before.measures ?? [], after.measures ?? []);
  if (measures) out.push('', measures);
  return out.join('\n');
}

// --- Running ----------------------------------------------------------------------------

function slug(page, i) {
  const p = new URL(page.url).pathname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  return `${String(i + 1).padStart(2, '0')}-${p || 'home'}`;
}

function runLighthouse({ url, formFactor, blocked, file, spec, categories }) {
  const args = [
    '--yes', spec, url,
    '--output=json', `--output-path=${file}`, '--quiet',
    `--only-categories=${categories.join(',')}`, '--chrome-flags=--headless=new',
    ...(formFactor === 'desktop' ? ['--preset=desktop'] : []),
    ...blocked.map((p) => `--blocked-url-patterns=${p}`),
  ];
  const res = spawnSync('npx', args, { encoding: 'utf8', timeout: 240_000 });
  if (res.status !== 0 || !fs.existsSync(file)) {
    return { lhr: null, error: (res.stderr || res.error?.message || `exit ${res.status}`).trim().split('\n').pop() };
  }
  return { lhr: JSON.parse(fs.readFileSync(file, 'utf8')), error: null };
}

function parseArgs(argv) {
  const opts = { block: [], positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--urls') opts.urls = next();
    else if (a === '--baseline') opts.baseline = next();
    else if (a === '--runs') opts.runs = Number(next());
    else if (a === '--form-factor') opts.formFactor = next();
    else if (a === '--label') opts.label = next();
    else if (a === '--out') opts.out = next();
    else if (a === '--block') opts.block.push(next());
    else if (a === '--lighthouse') opts.lighthouse = next();
    else if (a === '--metrics') opts.metrics = next();
    else if (a === '--categories') opts.categories = next().split(',').map((c) => c.trim()).filter(Boolean);
    else opts.positional.push(a);
  }
  return opts;
}

const readMeasures = (file) => {
  if (!file) return undefined;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(data) ? data : data.measures ?? [];
};

function cmdRun(opts) {
  // Explicit flags win over the baseline's; the baseline wins over the defaults.
  const base = opts.baseline ? baselineOptions(fs.readFileSync(opts.baseline, 'utf8')) : null;
  if (!opts.urls && !base) throw new Error('--urls or --baseline is required');
  const pages = opts.urls ? parseUrlList(fs.existsSync(opts.urls) ? fs.readFileSync(opts.urls, 'utf8') : opts.urls) : base.pages;
  const forms = opts.formFactor ? (opts.formFactor === 'both' ? ['mobile', 'desktop'] : [opts.formFactor]) : base?.formFactors ?? ['mobile', 'desktop'];
  const runs = opts.runs ?? base?.runs ?? DEFAULT_RUNS;
  const spec = opts.lighthouse ?? base?.lighthouse ?? DEFAULT_LIGHTHOUSE;
  const out = opts.out ?? './lighthouse';
  // A --block attribution run only needs performance; the extra categories would just cost time.
  const categories = opts.categories ?? (opts.block.length ? ['performance'] : DEFAULT_CATEGORIES);
  const conditions = opts.block.length ? ['normal', 'blocked'] : ['normal'];
  const rawDir = path.join(out, 'raw');
  fs.mkdirSync(rawDir, { recursive: true });
  if (base) process.stderr.write(`Reusing the baseline's ${pages.length} pages, ${runs} runs, ${forms.join(' + ')}, ${spec}\n`);

  let lighthouseVersion = null;
  const groups = new Map();
  const total = pages.length * forms.length * conditions.length * runs;
  let n = 0;
  pages.forEach((page, pi) => {
    for (const formFactor of forms) {
      // Runs outermost, conditions inner: normal and blocked alternate, never batch.
      for (let run = 0; run < runs; run++) {
        for (const condition of conditions) {
          const file = path.join(rawDir, `${slug(page, pi)}-${formFactor}-${condition}-${run + 1}.json`);
          process.stderr.write(`[${++n}/${total}] ${page.url} ${formFactor} ${condition} #${run + 1}\n`);
          const { lhr, error } = runLighthouse({ url: page.url, formFactor, blocked: condition === 'blocked' ? opts.block : [], file, spec, categories });
          const metrics = lhr ? extractMetrics(lhr) : { score: null, error };
          if (lhr) lighthouseVersion ??= lhr.lighthouseVersion;
          if (metrics.error) process.stderr.write(`  failed: ${metrics.error}\n`);
          const key = `${page.url}|${formFactor}|${condition}`;
          if (!groups.has(key)) groups.set(key, { ...page, formFactor, condition, runs: [] });
          groups.get(key).runs.push(metrics);
        }
      }
    }
  });

  const summary = {
    label: opts.label ?? 'run',
    date: new Date().toISOString().slice(0, 10),
    lighthouseVersion,
    runs,
    formFactors: forms,
    pages,
    blocked: opts.block,
    results: [...groups.values()].map((g) => ({ ...g, ...summarize(g.runs) })),
  };
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
  const md = renderSummary(summary);
  fs.writeFileSync(path.join(out, 'summary.md'), `${md}\n`);
  console.log(md);
}

function cmdEmbed(opts) {
  const [report, summaryFile] = opts.positional;
  if (!report || !summaryFile) throw new Error('usage: embed <report.md> <summary.json> [--metrics metrics.json]');
  const lab = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
  if (lab.blocked?.length) throw new Error('that summary is a --block attribution run; embed the normal run instead');
  fs.writeFileSync(report, writeDataBlock(fs.readFileSync(report, 'utf8'), { lab, measures: readMeasures(opts.metrics) ?? [] }));
  console.log(`Data block written to ${report}: ${lab.results.length} result(s), ${(readMeasures(opts.metrics) ?? []).length} measure(s).`);
}

function cmdCompare(opts) {
  const [beforeFile, afterFile] = opts.positional;
  const side = (file, measures) => loadSide({ text: fs.readFileSync(file, 'utf8'), file, measures });
  console.log(renderCompare(side(beforeFile), side(afterFile, readMeasures(opts.metrics))));
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const opts = parseArgs(rest);
  if (cmd === 'run') return cmdRun(opts);
  if (cmd === 'embed') return cmdEmbed(opts);
  if (cmd === 'compare' && opts.positional.length === 2) return cmdCompare(opts);
  if (cmd === 'report' && opts.positional[0]) return console.log(renderSummary(JSON.parse(fs.readFileSync(opts.positional[0], 'utf8'))));
  console.error(
    'usage: lighthouse-runs.mjs run (--urls <file|urls> | --baseline <report.md>) [--runs 3] [--form-factor mobile|desktop|both] [--categories performance,accessibility,best-practices,seo] [--label x] [--out dir] [--block pattern]...\n' +
      '       lighthouse-runs.mjs embed <report.md> <summary.json> [--metrics metrics.json]\n' +
      '       lighthouse-runs.mjs compare <baseline.md|summary.json> <report.md|summary.json> [--metrics metrics.json]\n' +
      '       lighthouse-runs.mjs report <summary.json>',
  );
  process.exitCode = 2;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
