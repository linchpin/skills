// Tests for inventory.mjs. Pure functions only — no network, no gh.
//
//   node --test skills/maintenance-window/scripts/
//
// Fixtures are synthetic (example/* repos), shaped like fetchData()'s output. They reproduce
// the backlog patterns measured on real Linchpin repos in September 2026: a direct-to-main
// repo with strict checks and stale red PRs, and a windowed repo whose windows never closed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classify,
  render,
  normalizeChecks,
  normalizeLogin,
  parseRenovateTable,
  routingOf,
} from './inventory.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const load = (name) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', name), 'utf8'));
const NOW = new Date('2026-09-15T12:00:00Z');
const ids = (r) => r.findings.map((f) => f.id);
const step = (r, re) => r.queue.find((q) => re.test(q.action));
const pr = (r, n) => r.prs.find((p) => p.number === n);

test('normalizeLogin folds the three spellings of a bot', () => {
  assert.equal(normalizeLogin('app/renovate'), 'renovate');
  assert.equal(normalizeLogin('renovate[bot]'), 'renovate');
  assert.equal(normalizeLogin('Dependabot'), 'dependabot');
});

test('normalizeChecks keeps the latest run per name and reads both check kinds', () => {
  const checks = normalizeChecks([
    { __typename: 'CheckRun', name: 'Lint', status: 'COMPLETED', conclusion: 'FAILURE', completedAt: '2026-09-01T00:00:00Z' },
    { __typename: 'CheckRun', name: 'Lint', status: 'COMPLETED', conclusion: 'SUCCESS', completedAt: '2026-09-02T00:00:00Z' },
    { __typename: 'CheckRun', name: 'E2E', status: 'IN_PROGRESS', conclusion: '' },
    { __typename: 'StatusContext', context: 'ci/legacy', state: 'ERROR' },
  ]);
  assert.deepEqual(checks, [
    { name: 'Lint', state: 'SUCCESS' },
    { name: 'E2E', state: 'IN_PROGRESS' },
    { name: 'ci/legacy', state: 'ERROR' },
  ]);
});

test('parseRenovateTable reads names and targets, with either arrow', () => {
  const body = [
    '| Package | Change | Age |',
    '|---|---|---|',
    '| [@wordpress/env](https://x) ([source](https://y)) | [`^11.15.0` → `^11.16.0`](https://z) | ![age](a) |',
    '| plain-name | `1.0.0` -> `1.1.0` | |',
  ].join('\n');
  assert.deepEqual(parseRenovateTable(body), [
    { name: '@wordpress/env', from: '^11.15.0', to: '^11.16.0' },
    { name: 'plain-name', from: '1.0.0', to: '1.1.0' },
  ]);
});

test('routingOf tells the three models apart', () => {
  const preset = 'github>linchpin/renovatebot-config';
  assert.equal(routingOf(null, 'main').mode, 'none');
  assert.equal(routingOf({ config: { extends: [preset] } }, 'main').mode, 'window');
  assert.equal(routingOf({ config: { extends: [preset], baseBranchPatterns: ['main'] } }, 'main').mode, 'direct');
  assert.equal(
    routingOf({ config: { extends: [preset], baseBranchPatterns: ['$default', '/^maintenance\\/\\d{4}-\\d{2}$/'] } }, 'main').mode,
    'hybrid',
  );
  assert.equal(routingOf({ path: 'renovate.json5', error: 'JSON5' }, 'main').mode, 'unknown');
});

test('direct mode: every PR lands in exactly one bucket', () => {
  const r = classify(load('direct-backlog.json'), { now: NOW });
  assert.equal(r.routing.mode, 'direct');
  assert.equal(pr(r, 101).bucket, 'renovate:non-major');
  assert.equal(pr(r, 103).bucket, 'renovate:major');
  assert.equal(pr(r, 104).bucket, 'renovate:non-major');
  assert.equal(pr(r, 105).bucket, 'renovate:lockfile');
  assert.equal(pr(r, 106).bucket, 'renovate:security');
  assert.equal(pr(r, 107).bucket, 'release-please');
  assert.equal(pr(r, 108).bucket, 'human');
  assert.equal(Object.values(r.counts).reduce((a, b) => a + b, 0), r.prs.length);
});

test('direct mode: strict checks with rebaseWhen conflicted is reported as the stall', () => {
  const r = classify(load('direct-backlog.json'), { now: NOW });
  assert.ok(ids(r).includes('strict-conflicted'));
  assert.ok(ids(r).includes('stale-results'));
  assert.ok(ids(r).includes('dependabot-security-prs'));
  assert.ok(ids(r).includes('orphaned-windows'));
  assert.ok(!ids(r).includes('multiple-windows'), 'windows Renovate ignores are orphans, not multipliers');
  assert.match(r.windowMergeMethod, /^rebase/);
});

test('direct mode: a failure shared by stale PRs is re-checked after a rebase, not fixed blind', () => {
  const r = classify(load('direct-backlog.json'), { now: NOW });
  assert.deepEqual(r.sharedFailures.map((f) => f.check).sort(), ['E2E', 'Lint']);
  assert.ok(step(r, /^re-check "Lint" after the rebase/));
  assert.ok(!step(r, /^fix "Lint"/));
});

test('direct mode: two PRs moving one dependency are landed together', () => {
  const r = classify(load('direct-backlog.json'), { now: NOW });
  assert.deepEqual(r.coMoving, [{ base: 'main', prs: [101, 102], deps: ['left-pad 1.3.1'] }]);
  assert.deepEqual(step(r, /^land together/).prs, [101, 102]);
});

test('direct mode: a human commit on a Renovate branch is flagged and kept out of the rebase step', () => {
  const r = classify(load('direct-backlog.json'), { now: NOW });
  assert.deepEqual(pr(r, 103).humanEdited, ['a-developer']);
  assert.deepEqual(step(r, /^take ownership/).prs, [103]);
  assert.deepEqual(step(r, /^request a Renovate rebase/).prs, [101, 102]);
});

test('direct mode: queue drains WordPress packages first, lock files last, majors after', () => {
  const r = classify(load('direct-backlog.json'), { now: NOW });
  const order = r.queue.map((q) => q.action);
  assert.deepEqual(step(r, /^drain non-majors into main/).prs, [104, 109, 101, 102], 'WordPress, then Composer by files, then npm');
  assert.ok(order.indexOf('ship security fixes ahead of the batch') < order.findIndex((a) => a.startsWith('drain')));
  assert.ok(order.findIndex((a) => a.startsWith('lock-file')) > order.findIndex((a) => a.startsWith('drain')));
  assert.deepEqual(step(r, /^majors/).prs, [103]);
  assert.ok(!r.queue.some((q) => q.prs.includes(107) || q.prs.includes(108)), 'release and human PRs are never queued');
});

test('window mode: stale windows, stranded security fixes and duplicates are found', () => {
  const r = classify(load('window-backlog.json'), { now: NOW });
  assert.equal(r.routing.mode, 'window');
  const byName = Object.fromEntries(r.windows.map((w) => [w.name, w]));
  assert.equal(byName['maintenance/2026-07'].stale, true);
  assert.equal(byName['maintenance/2026-09'].current, true);
  assert.equal(byName['maintenance/2026-09'].unmergedCommits, 0, 'the anchor commit is not work');
  assert.equal(byName['maintenance/2026-09-2'].standardName, false);
  assert.deepEqual(byName['maintenance/2026-08'].strandedSecurity, ['build(npm): Update dependency postcss to v8.5.23 [SECURITY] (#51)']);
  assert.deepEqual(r.duplicates, [{ topic: 'major-wordpress-monorepo', keep: 63, close: [61, 62] }]);
  for (const id of [
    'multiple-windows', 'window-without-pr', 'window-title', 'window-name', 'stranded-security',
    'duplicate-topics', 'window-takes-majors', 'deprecated-preset', 'two-bots', 'auto-merge-off',
    'window-workflow-copied', 'auto-approve-missing', 'window-merger-missing', 'window-unchecked',
  ]) {
    assert.ok(ids(r).includes(id), `missing finding ${id}`);
  }
});

test('window mode: the queue lands stranded fixes first and merges the window last', () => {
  const r = classify(load('window-backlog.json'), { now: NOW });
  assert.match(r.queue[0].action, /^land stranded security fixes on main first/);
  assert.deepEqual(step(r, /^collapse stale windows/).prs, [61, 62]);
  assert.deepEqual(step(r, /^check, then close, lockfile-only/).prs, [65]);
  assert.deepEqual(step(r, /^hand Dependabot manifest bumps/).prs, [66]);
  assert.deepEqual(step(r, /^drain non-majors into maintenance\/2026-09/).prs, [64]);
  assert.ok(pr(r, 63).flags.includes('major inside a window'));
  const last = r.queue[r.queue.length - 1];
  assert.equal(last.action, 'verify and merge the window');
  assert.deepEqual(last.prs, [60]);
  assert.match(last.note, /^merge commit/);
});

test('squash-only repos are blocked from merging a window', () => {
  const data = load('window-backlog.json');
  data.settings.allowMergeCommit = false;
  data.settings.allowRebaseMerge = false;
  const r = classify(data, { now: NOW });
  assert.ok(ids(r).includes('squash-only'));
  assert.match(r.windowMergeMethod, /^blocked/);
});

test('hybrid routing without the major guard is reported', () => {
  const data = load('direct-backlog.json');
  data.renovateConfig.config.baseBranchPatterns = ['main', '/^maintenance\\/\\d{4}-\\d{2}$/'];
  assert.ok(ids(classify(data, { now: NOW })).includes('hybrid-unguarded'));
  data.renovateConfig.config.packageRules = [
    { matchBaseBranches: ['/^maintenance\\//'], matchUpdateTypes: ['major'], enabled: false },
  ];
  assert.ok(!ids(classify(data, { now: NOW })).includes('hybrid-unguarded'));
});

test('render produces every section without throwing', () => {
  for (const name of ['direct-backlog.json', 'window-backlog.json']) {
    const out = render(classify(load(name), { now: NOW }));
    for (const heading of ['# Maintenance inventory', '## Backlog', '## Pipeline findings', '## Proposed queue']) {
      assert.ok(out.includes(heading), `${name}: missing ${heading}`);
    }
  }
});

test('a window Renovate merges into itself needs no merger workflow', () => {
  const data = load('window-backlog.json');
  assert.ok(ids(classify(data, { now: NOW })).includes('window-merger-missing'));
  data.renovateConfig.config.extends = ['github>linchpin/renovatebot-config:automerge'];
  data.renovateConfig.config.ignoreTests = true;
  assert.ok(!ids(classify(data, { now: NOW })).includes('window-merger-missing'));
});

test('an auto-approve caller filtered to the default branch does not count', () => {
  const data = load('window-backlog.json');
  data.workflows.autoApprove = true;
  data.workflows.autoApproveTriggersWindow = false;
  assert.match(classify(data, { now: NOW }).findings.find((f) => f.id === 'auto-approve-missing').detail, /does not trigger/);
  data.workflows.autoApproveTriggersWindow = true;
  assert.ok(!ids(classify(data, { now: NOW })).includes('auto-approve-missing'));
});

test('a required check red on two up-to-date PRs is a shared failure, ranked first', () => {
  const r = classify(load('direct-backlog.json'), { now: NOW });
  const e2e = r.sharedFailures[0];
  assert.equal(e2e.check, 'E2E');
  assert.equal(e2e.required, true);
  assert.equal(e2e.behind, 0);
  assert.ok(step(r, /^fix "E2E" once, on the base/), 'current results are fixed on the base, not re-checked');
  assert.deepEqual(pr(r, 104).failingRequired, ['E2E']);
});

test('armed auto-merge, open alerts, orphaned branches, and closed window PRs are surfaced', () => {
  const r = classify(load('direct-backlog.json'), { now: NOW });
  assert.ok(pr(r, 109).flags.some((f) => f.startsWith('auto-merge armed')));
  assert.equal(r.findings.find((f) => f.id === 'open-alerts').severity, 'blocks');
  assert.match(step(r, /^ship security fixes/).note, /1 high\/critical runtime alert/);
  assert.match(r.findings.find((f) => f.id === 'orphaned-renovate-branches').detail, /^1 renovate/);
  assert.ok(ids(r).includes('window-pr-closed'));
  assert.ok(ids(r).includes('review-per-pr'));
  assert.ok(ids(r).includes('split-group'));
  assert.match(render(r), /none \(#90 closed\)/);
});

test('edited Renovate PRs are never sent to be closed', () => {
  const r = classify(load('direct-backlog.json'), { now: NOW });
  assert.match(step(r, /^take ownership/).note, /never by closing/);
  assert.match(r.findings.find((f) => f.id === 'human-edited-branch').detail, /Closing it makes Renovate ignore/);
});
