// Tests for session-time.mjs. Builds a throwaway log directory shaped like Claude Code's
// (<project>/<session>.jsonl, <project>/<session>/subagents/agent-*.jsonl) — no real logs read.
//
//   node --test skills/task-tracking/scripts/session-time.test.mjs

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { keyRegex, classify, measure, build, scan, sessionContext, fmt, render } from './session-time.mjs';

// Local dates and times are part of the output, so pin the zone.
process.env.TZ = 'UTC';

const at = (hhmm, day = '2026-09-01') => `${day}T${hhmm}:00.000Z`;
const entry = (sessionId, gitBranch, timestamp, text = 'working') =>
  JSON.stringify({ type: 'assistant', sessionId, gitBranch, cwd: '/work/repo-a', timestamp, message: { content: text } });

let dir;
before(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-time-'));
  const write = (rel, lines) => {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, lines.join('\n') + '\n');
  };
  // s1 scopes on main first, then works ABC-12 with a 50-minute break in the middle.
  write('-work-repo-a/s1.jsonl', [
    entry('s1', 'main', at('08:30')),
    entry('s1', 'main', at('08:40')),
    entry('s1', 'main', at('08:50')),
    entry('s1', 'issue/ABC-12', at('09:00')),
    entry('s1', 'issue/ABC-12', at('09:05')),
    entry('s1', 'issue/ABC-12', at('09:10')),
    entry('s1', 'issue/ABC-12', at('10:00')),
    entry('s1', 'issue/ABC-12', at('10:05')),
    '{not json',
    JSON.stringify({ type: 'mode', sessionId: 's1', gitBranch: 'issue/ABC-12' }), // no timestamp
  ]);
  // s2 runs in parallel on the same branch, and briefly on ABC-123, which must not count.
  write('-work-repo-a/s2.jsonl', [
    entry('s2', 'issue/ABC-12', at('09:02')),
    entry('s2', 'issue/ABC-12', at('09:07')),
    entry('s2', 'issue/ABC-123', at('09:03')),
  ]);
  // s3 is on main and only talks about ABC-12; its subagent, next day, is on the branch.
  write('-work-repo-b/s3.jsonl', [
    entry('s3', 'main', at('11:00'), 'see ABC-12 for context'),
    entry('s3', 'main', at('11:01'), 'and abc-12 again'),
    entry('s3', 'main', at('11:02'), 'unrelated'),
  ]);
  write('-work-repo-b/s3/subagents/agent-1.jsonl', [
    entry('s3-sub', 'issue/ABC-12', at('13:00', '2026-09-02')),
    entry('s3-sub', 'issue/ABC-12', at('13:20', '2026-09-02')),
    entry('s3-sub', 'issue/ABC-12', at('13:25', '2026-09-02')),
  ]);
  // The session running the sweep mentions the key too.
  write('-work-repo-c/now.jsonl', [entry('now', 'main', at('15:00', '2026-09-03'), 'checking ABC-12')]);
});
after(() => fs.rmSync(dir, { recursive: true, force: true }));

test('keyRegex matches the key as a whole token, case-blind', () => {
  const re = keyRegex(['ABC-12']);
  assert.ok(re.test('issue/ABC-12'));
  assert.ok(re.test('issue/abc-12'));
  assert.ok(re.test('feat(ABC-12): thing'));
  assert.ok(!re.test('issue/ABC-123'));
  assert.ok(!re.test('XABC-12'));
});

test('classify: branch match is strong, a mention elsewhere is weak, no timestamp is nothing', () => {
  const strong = { gitBranch: 'issue/ABC-12', timestamp: at('09:00') };
  const weak = { gitBranch: 'main', timestamp: at('09:00') };
  assert.deepEqual(classify(strong, JSON.stringify(strong), ['ABC-12']), [{ key: 'ABC-12', strength: 'strong' }]);
  assert.deepEqual(classify(weak, '"ABC-12 mentioned"', ['ABC-12']), [{ key: 'ABC-12', strength: 'weak' }]);
  assert.deepEqual(classify({ gitBranch: 'issue/ABC-12' }, 'issue/ABC-12', ['ABC-12']), []);
});

test('measure drops idle gaps and splits by day', () => {
  const t = ['09:00', '09:05', '09:10', '10:00', '10:05'].map((h) => Date.parse(at(h)));
  const m = measure(t, 15);
  assert.equal(m.activeMs, 15 * 60e3);
  assert.equal(m.spanMs, 65 * 60e3);
  assert.deepEqual(m.days, [{ date: '2026-09-01', start: '09:00', activeMs: 15 * 60e3 }]);
  assert.equal(measure(t, 60).activeMs, 65 * 60e3); // a longer threshold counts the break
  assert.equal(measure([], 15), null);
});

test('fmt renders minutes and hours', () => {
  assert.equal(fmt(25 * 60e3), '25m');
  assert.equal(fmt(65 * 60e3), '1h 05m');
  assert.equal(fmt(0), '0m');
});

test('scan + build: parallel sessions count once, subagents count, ABC-123 does not', async () => {
  const { hits, filesScanned } = await scan(dir, ['ABC-12']);
  assert.equal(filesScanned, 5);
  const r = build(['ABC-12'], hits, 15)['ABC-12'];
  // Day 1: s1 + s2 merged → 09:00 :02 :05 :07 :10 = 10m, break, 10:00→10:05 = 5m. Day 2: 13:20→13:25.
  assert.equal(r.strong.activeMs, 20 * 60e3);
  assert.deepEqual(
    r.strong.days.map((d) => [d.date, d.start, d.activeMs / 60e3]),
    [['2026-09-01', '09:00', 15], ['2026-09-02', '13:00', 5]],
  );
  assert.equal(r.strongSessions, 3); // s1, s2, s3-sub
  assert.deepEqual(r.weak.map((w) => [w.sessionId, w.branch, w.mentions]), [['s3', 'main', 2], ['now', 'main', 1]]);
});

test('build drops the current session\'s weak mentions but keeps its strong entries', async () => {
  const { hits } = await scan(dir, ['ABC-12']);
  assert.deepEqual(build(['ABC-12'], hits, 15, 'now')['ABC-12'].weak.map((w) => w.sessionId), ['s3']);
  assert.equal(build(['ABC-12'], hits, 15, 's1')['ABC-12'].strong.activeMs, 20 * 60e3);
});

test('lead-in: a strong session\'s time on other branches is reported apart, never summed', async () => {
  const { hits } = await scan(dir, ['ABC-12']);
  const files = [...new Set(hits.filter((h) => h.strength === 'strong').map((h) => h.file))];
  const r = build(['ABC-12'], hits, 15, null, await sessionContext(files))['ABC-12'];
  assert.equal(r.strong.activeMs, 20 * 60e3); // unchanged by the lead-in
  // s1's 08:30 → 09:00 on main up to the switch. s2's ABC-123 entry at 09:03 falls inside
  // time already counted as strong, so it adds nothing — measured alone, it would add 13m.
  assert.equal(r.leadIn.activeMs, 30 * 60e3);
  assert.deepEqual(r.leadIn.branches.sort(), ['issue/ABC-123', 'main']);
  assert.match(render({ 'ABC-12': r }, { filesScanned: 5, idleMinutes: 15 }), /lead-in .*30m more active on/);
});

test('scan honours --since by entry time', async () => {
  const { hits } = await scan(dir, ['ABC-12'], { sinceMs: Date.parse('2026-09-02T00:00:00Z') });
  const r = build(['ABC-12'], hits, 15)['ABC-12'];
  assert.equal(r.strong.activeMs, 5 * 60e3);
});

test('a key with no evidence says so rather than reporting zero time', async () => {
  const { hits, filesScanned } = await scan(dir, ['ZZZ-1']);
  const report = build(['ZZZ-1'], hits, 15);
  assert.equal(report['ZZZ-1'].strong, null);
  assert.match(render(report, { filesScanned, idleMinutes: 15 }), /strong {2}none/);
});
