// Tests for lighthouse-runs.mjs. Pure functions only — no Chrome, no network.
//
//   node --test skills/wp-performance-audit/scripts/lighthouse-runs.test.mjs
//
// The inputs are trimmed Lighthouse 12 reports. The numbers reproduce the October 2026 audits
// this skill was written from: TBT swinging by more than a second between runs of one page, a
// run that failed outright, a GTM-blocked comparison that halved blocking time, and a release
// comparison where one page gained 26 points and another only moved its LCP.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  baselineOptions,
  extractMetrics,
  loadSide,
  median,
  pageLabel,
  parseReportTables,
  parseUrlList,
  parseValue,
  pickMedianRun,
  readDataBlock,
  renderCompare,
  renderMeasures,
  renderSummary,
  summarize,
  verdict,
  writeDataBlock,
} from './lighthouse-runs.mjs';

const lhr = ({ score, fcp, lcp, tbt, si = fcp, cls = 0.02, bytes = 3_400_000, thirdParties = [] }) => ({
  lighthouseVersion: '12.8.2',
  categories: { performance: { score: score / 100 } },
  audits: {
    'first-contentful-paint': { numericValue: fcp },
    'largest-contentful-paint': { numericValue: lcp },
    'total-blocking-time': { numericValue: tbt },
    'speed-index': { numericValue: si },
    'cumulative-layout-shift': { numericValue: cls },
    'total-byte-weight': { numericValue: bytes },
    'bootup-time': { numericValue: 2000 },
    'third-party-summary': { details: { items: thirdParties } },
  },
});

const result = (url, name, formFactor, condition, score, tbt, extra = {}) => ({
  url, name, formFactor, condition,
  representative: { score, fcp: 3600, lcp: 6200, tbt, si: 3700, cls: 0.03, bytes: 1_300_000, ...extra },
  tbtMedian: tbt, scores: [score, score, score], failed: 0,
});

const summaryOf = (label, results, extra = {}) => ({
  label, date: '2026-10-30', lighthouseVersion: '12.8.2', runs: 3, formFactors: ['mobile', 'desktop'], blocked: [], results, ...extra,
});

// --- Parsing ----------------------------------------------------------------------------

test('parseUrlList takes named lines, bare URLs, comments and comma lists', () => {
  const pages = parseUrlList(`
    # key templates
    Homepage | https://example.com/
    https://example.com/contact/

    Search | https://example.com/?s=a|b
  `);
  assert.deepEqual(pages, [
    { name: 'Homepage', url: 'https://example.com/' },
    { name: '', url: 'https://example.com/contact/' },
    { name: 'Search', url: 'https://example.com/?s=a|b' },
  ]);
  assert.deepEqual(parseUrlList('https://a.test/, https://b.test/x/').map((p) => p.url), ['https://a.test/', 'https://b.test/x/']);
  assert.throws(() => parseUrlList('Homepage | example.com'), /not a URL/);
});

test('extractMetrics reads Lighthouse 12 audits and ranks third parties by main-thread time', () => {
  const m = extractMetrics(lhr({
    score: 52, fcp: 6700, lcp: 16100, tbt: 318,
    thirdParties: [
      { entity: 'Swiper', mainThreadTime: 400, transferSize: 43_000 },
      { entity: { text: 'Google Tag Manager' }, mainThreadTime: 600, blockingTime: 300, transferSize: 852_000 },
    ],
  }));
  assert.equal(m.score, 52);
  assert.equal(m.lcp, 16100);
  assert.deepEqual(m.thirdParties.map((t) => t.entity), ['Google Tag Manager', 'Swiper']);
  assert.equal(m.error, null);
});

test('extractMetrics reads all four category scores, and leaves skipped categories null', () => {
  const full = lhr({ score: 79, fcp: 1800, lcp: 2600, tbt: 150 });
  Object.assign(full.categories, { accessibility: { score: 0.84 }, 'best-practices': { score: 0.73 }, seo: { score: 0.9 } });
  const m = extractMetrics(full);
  assert.deepEqual([m.score, m.a11y, m.bestPractices, m.seo], [79, 84, 73, 90]);
  const perfOnly = extractMetrics(lhr({ score: 79, fcp: 1800, lcp: 2600, tbt: 150 }));
  assert.deepEqual([perfOnly.a11y, perfOnly.bestPractices, perfOnly.seo], [null, null, null]);
});

test('extractMetrics returns nulls, not a throw, when an audit is missing', () => {
  const m = extractMetrics({ categories: {}, audits: {}, runtimeError: { code: 'NO_FCP' } });
  assert.equal(m.score, null);
  assert.equal(m.fcp, null);
  assert.equal(m.error, 'NO_FCP');
});

test('parseValue reads the units the tables print', () => {
  assert.equal(parseValue('6.7 s'), 6700);
  assert.equal(parseValue('2,233 ms'), 2233);
  assert.equal(parseValue('512 KB'), 512 * 1024);
  assert.equal(parseValue('7.1 MB'), 7.1 * 1024 * 1024);
  assert.equal(parseValue('0.024'), 0.024);
  assert.equal(parseValue('n/a'), null);
});

// --- Reduction --------------------------------------------------------------------------

test('median handles odd, even, empty and null-padded input', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1456, 2476]), 1966);
  assert.equal(median([]), null);
  assert.equal(median([null, 5]), 5);
});

test('the representative run is the median-scoring one, not the best', () => {
  const runs = [32, 36, 33].map((score, i) => ({ score, tbt: [2476, 1456, 1956][i], error: null }));
  assert.equal(pickMedianRun(runs).score, 33);
});

test('summarize takes TBT as the median of all runs, independent of the representative run', () => {
  // Homepage, October: scores 32/33/36, TBT 1,456–2,476 ms across the three runs.
  const runs = [
    { score: 36, tbt: 1456, error: null },
    { score: 33, tbt: 2476, error: null },
    { score: 32, tbt: 1956, error: null },
  ];
  const s = summarize(runs);
  assert.equal(s.representative.score, 33);
  assert.equal(s.representative.tbt, 2476);
  assert.equal(s.tbtMedian, 1956);
});

test('failed runs are reported and kept out of the medians', () => {
  const s = summarize([
    { score: 29, tbt: 2062, error: null },
    { score: null, error: 'NO_FCP' },
    { score: 50, tbt: 559, error: null },
  ]);
  assert.equal(s.failed, 1);
  assert.deepEqual(s.scores, [29, 'error:NO_FCP', 50]);
  assert.equal(s.tbtMedian, (2062 + 559) / 2);
});

test('verdict separates real changes from run-to-run noise', () => {
  // Buyer's Journey Landing: 33 → 59.
  assert.equal(verdict({ score: 33, lcp: 38000 }, { score: 59, lcp: 21500 }), 'Improved');
  // Here's Why: +2 points, but LCP 14.3 → 8.8 s.
  assert.equal(verdict({ score: 55, lcp: 14300 }, { score: 57, lcp: 8800 }), 'Improved');
  // Products: +1 point, LCP 8.0 → 8.7 s.
  assert.equal(verdict({ score: 62, lcp: 8000 }, { score: 63, lcp: 8700 }), 'Within noise');
  // Buyer's Journey Segment in October: 42 → 26.
  assert.equal(verdict({ score: 42, lcp: 23500 }, { score: 26, lcp: 27300 }), 'Worse');
  assert.equal(verdict({ score: 40, lcp: 5000 }, { score: 49, lcp: 7000 }), 'Mixed');
});

// --- Rendering --------------------------------------------------------------------------

test('pageLabel shows the name with the path, or the path alone', () => {
  assert.equal(pageLabel({ name: 'Homepage', url: 'https://example.com/' }), 'Homepage `/`');
  assert.equal(pageLabel({ name: '', url: 'https://example.com/about-us/' }), '`/about-us/`');
  assert.equal(pageLabel({ name: 'Search', path: '/?s=x' }), 'Search `/?s=x`');
});

test('renderSummary prints one table per form factor and the paired TBT table when blocking', () => {
  const md = renderSummary(summaryOf('gtm-test', [
    result('https://example.com/', 'Homepage', 'mobile', 'normal', 36, 3544),
    result('https://example.com/', 'Homepage', 'mobile', 'blocked', 44, 1190),
  ], { runs: 2, blocked: ['*googletagmanager.com*'] }));
  assert.match(md, /### Mobile\n/);
  assert.match(md, /### Mobile \(blocked\)/);
  assert.match(md, /\| Homepage `\/` \| 36 \| 3\.6 s \| 6\.2 s \| 3,544 ms \|/);
  assert.match(md, /\| Homepage `\/` \| mobile \| 3,544 ms \| 1,190 ms \| -66% \| 36 → 44 \|/);
});

test('renderSummary lists the top third parties per page from the representative run', () => {
  const md = renderSummary(summaryOf('production', [result('https://example.com/', 'Homepage', 'mobile', 'normal', 33, 1956, {
    thirdParties: [
      { entity: 'Audience 360', mainThreadMs: 2219 },
      { entity: 'Google Tag Manager', mainThreadMs: 1055 },
      { entity: 'Clarity', mainThreadMs: 251 },
      { entity: 'Optimizely', mainThreadMs: 109 },
    ],
  })]));
  assert.match(md, /- Homepage `\/`, mobile: Audience 360 2,219 ms, Google Tag Manager 1,055 ms, Clarity 251 ms\n?/);
  assert.doesNotMatch(md, /Optimizely/);
});

test('renderSummary adds a category table with the site-wide average, only when categories ran', () => {
  // The kind of averages the Vinfen audit reported: Performance 79, Accessibility 84, Best Practices 73, SEO 90.
  const md = renderSummary(summaryOf('production', [
    result('https://example.org/', 'Homepage', 'mobile', 'normal', 86, 200, { a11y: 88, bestPractices: 77, seo: 92 }),
    result('https://example.org/the-voice/', 'Newsletter', 'mobile', 'normal', 52, 900, { a11y: 80, bestPractices: 69, seo: 88 }),
  ]));
  assert.match(md, /### Lighthouse category scores, mobile/);
  assert.match(md, /\| Newsletter `\/the-voice\/` \| 52 \| 80 \| 69 \| 88 \|/);
  assert.match(md, /\| \*\*Average\*\* \| 69 \| 84 \| 73 \| 90 \|/);
  const perfOnly = renderSummary(summaryOf('production', [result('https://example.org/', 'Homepage', 'mobile', 'normal', 86, 200)]));
  assert.doesNotMatch(perfOnly, /category scores/);
});

test('renderCompare adds before → after category scores only when both sides have them', () => {
  const page = 'https://example.org/';
  const before = { label: 'baseline', results: [result(page, 'Homepage', 'mobile', 'normal', 70, 600, { a11y: 84, bestPractices: 73, seo: 90 })] };
  const after = { label: 'now', results: [result(page, 'Homepage', 'mobile', 'normal', 80, 300, { a11y: 95, bestPractices: 92, seo: 100 })] };
  const md = renderCompare(before, after);
  assert.match(md, /### Lighthouse category scores, mobile \(baseline → now\)/);
  assert.match(md, /\| Homepage `\/` \| 70 → 80 \| 84 → 95 \| 73 → 92 \| 90 → 100 \|/);
  const oldBaseline = { label: 'baseline', results: [result(page, 'Homepage', 'mobile', 'normal', 70, 600)] };
  assert.doesNotMatch(renderCompare(oldBaseline, after), /category scores/);
});

test('renderMeasures shows baseline → now with direction, and gaps as not measured', () => {
  const md = renderMeasures(
    [
      { key: 'autoload.kb', label: 'Autoloaded options', value: 912, unit: 'KB', better: 'lower' },
      { key: 'plugins.active', label: 'Active plugins', value: 41, better: 'lower' },
      { key: 'field.inp:/', label: 'Homepage INP, real users', value: 281, unit: 'ms', better: 'lower' },
    ],
    [
      { key: 'autoload.kb', label: 'Autoloaded options', value: 640, unit: 'KB', better: 'lower' },
      { key: 'plugins.active', label: 'Active plugins', value: 43, better: 'lower' },
      { key: 'links.broken', label: 'Broken links', value: 12, better: 'lower' },
    ],
  );
  assert.match(md, /\| Autoloaded options \| 912 KB \| 640 KB \| −272 KB \(better\) \|/);
  assert.match(md, /\| Active plugins \| 41 \| 43 \| \+2 \(worse\) \|/);
  assert.match(md, /\| Homepage INP, real users \| 281 ms \| not measured \| n\/a \|/);
  assert.match(md, /\| Broken links \| not measured \| 12 \| n\/a \|/);
  assert.equal(renderMeasures([], []), '');
});

test('renderCompare tallies verdicts per form factor and warns on a Lighthouse version mismatch', () => {
  const page = "https://example.com/buyers-journey/";
  const before = { label: 'release-2.63', lighthouseVersion: '12.8.2', results: [result(page, "Buyer's Journey Landing", 'mobile', 'normal', 33, 2233)] };
  const after = { label: 'TT-1322', lighthouseVersion: '12.8.2', results: [result(page, "Buyer's Journey Landing", 'mobile', 'normal', 59, 294)] };
  const md = renderCompare(before, after);
  assert.match(md, /- Mobile: improved on 1 of 1 pages, within noise on 0\./);
  assert.match(md, /### Mobile \(release-2\.63 → TT-1322\)/);
  assert.match(md, /\| 33 → 59 \| 3\.6 s → 3\.6 s \| 6\.2 s → 6\.2 s \| 2,233 ms → 294 ms \| 3\.7 s → 3\.7 s \| Improved \|/);
  assert.doesNotMatch(md, /Warning/);
  assert.match(renderCompare(before, { ...after, lighthouseVersion: '13.0.0' }), /not comparable/);
});

// --- The data block and baselines -------------------------------------------------------

const report = '# Example performance audit\n\n## Executive summary\n\nText.\n';
const baselineLab = summaryOf('production', [
  result('https://example.com/', 'Homepage', 'mobile', 'normal', 45, 531),
  result('https://example.com/', 'Homepage', 'desktop', 'normal', 90, 0),
  result('https://example.com/a-->b/', 'Odd path', 'mobile', 'normal', 60, 300),
], { pages: [{ name: 'Homepage', url: 'https://example.com/' }, { name: 'Odd path', url: 'https://example.com/a-->b/' }] });

test('the data block round-trips, survives "-->" in a URL, and is replaced rather than duplicated', () => {
  const once = writeDataBlock(report, { lab: baselineLab, measures: [{ key: 'autoload.kb', value: 912 }] });
  assert.ok(once.startsWith(report.trimEnd()));
  assert.equal((once.match(/-->/g) || []).length, 1, 'only the comment terminator');
  const data = readDataBlock(once);
  assert.equal(data.schema, 1);
  assert.equal(data.lab.pages[1].url, 'https://example.com/a-->b/');
  const twice = writeDataBlock(once, { lab: { ...baselineLab, label: 'second' }, measures: [] });
  assert.equal((twice.match(/wp-performance-audit:data/g) || []).length, 1);
  assert.equal(readDataBlock(twice).lab.label, 'second');
  assert.equal(readDataBlock(report), null);
});

test('baselineOptions reuses the pages, runs and form factors, and pins the exact Lighthouse version', () => {
  const opts = baselineOptions(writeDataBlock(report, { lab: baselineLab, measures: [] }));
  assert.equal(opts.lighthouse, 'lighthouse@12.8.2');
  assert.equal(opts.runs, 3);
  assert.deepEqual(opts.formFactors, ['mobile', 'desktop']);
  assert.deepEqual(opts.pages.map((p) => p.name), ['Homepage', 'Odd path']);
  assert.throws(() => baselineOptions(report), /no wp-performance-audit data block/);
});

test('loadSide prefers the data block, then falls back to the tables this script wrote', () => {
  const withBlock = writeDataBlock(`${report}\n${renderSummary(baselineLab)}\n`, { lab: baselineLab, measures: [{ key: 'autoload.kb', value: 912 }] });
  const fromBlock = loadSide({ text: withBlock, file: 'PERFORMANCE-AUDIT-2026-10-30.md' });
  assert.equal(fromBlock.lighthouseVersion, '12.8.2');
  assert.equal(fromBlock.measures.length, 1);

  // Someone pasted the report through an editor that dropped HTML comments.
  const stripped = withBlock.replace(/<!-- wp-performance-audit:data[\s\S]*-->\n?/, '');
  const fromTables = loadSide({ text: stripped, file: 'PERFORMANCE-AUDIT-2026-10-30.md' });
  assert.equal(fromTables.parsed, true);
  assert.equal(fromTables.lighthouseVersion, null);
  assert.deepEqual(fromTables.results.map((r) => `${r.path} ${r.formFactor} ${r.representative.score} ${r.tbtMedian}`), [
    // URL() percent-encodes the ">"; both sides normalize the same way, so pages still match.
    '/ mobile 45 531', '/a--%3Eb/ mobile 60 300', '/ desktop 90 0',
  ]);
  assert.throws(() => loadSide({ text: report, file: 'empty.md' }), /no data block and no result tables/);
});

test('parseReportTables skips blocked tables and before → after tables', () => {
  const md = [
    '### Mobile (blocked)', '',
    '| Page | Score | FCP | LCP | TBT | Speed Index | CLS | Page weight |', '| --- | --- | --- | --- | --- | --- | --- | --- |',
    '| Homepage `/` | 44 | 3.6 s | 6.2 s | 1,190 ms | 3.7 s | 0.030 | 1.2 MB |', '',
    '### Mobile (release-2.63 → TT-1322)', '',
    '| Page | Score | FCP | LCP | TBT | Speed Index | Change |', '| --- | --- | --- | --- | --- | --- | --- |',
    '| Homepage `/` | 45 → 52 | 6.3 s → 6.7 s | 16.2 s → 16.1 s | 531 ms → 318 ms | 6.8 s → 6.7 s | Within noise |',
  ].join('\n');
  assert.deepEqual(parseReportTables(md), []);
});

test('a stripped baseline still compares against a fresh run, matched by path', () => {
  const stripped = `${report}\n${renderSummary(baselineLab)}\n`;
  const before = loadSide({ text: stripped, file: 'PERFORMANCE-AUDIT-2026-10-30.md' });
  const after = loadSide({
    text: JSON.stringify(summaryOf('production', [result('https://example.com/', 'Homepage', 'mobile', 'normal', 58, 300)], { date: '2026-12-15' })),
    file: 'summary.json',
    measures: [{ key: 'autoload.kb', label: 'Autoloaded options', value: 640, unit: 'KB', better: 'lower' }],
  });
  const md = renderCompare(before, after);
  assert.match(md, /no data block/);
  assert.match(md, /\| Homepage `\/` \| 45 → 58 \|.*\| Improved \|/);
  assert.match(md, /\| Odd path `\/a--%3Eb\/` \| missing on one side \|/);
  assert.match(md, /\| Autoloaded options \| not measured \| 640 KB \| n\/a \|/);
});
