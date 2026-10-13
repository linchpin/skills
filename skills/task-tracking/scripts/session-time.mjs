#!/usr/bin/env node
// Turn agent session logs into time evidence for ClickUp tasks, for the task-tracking skill.
// Zero dependencies — Node >= 18.
//
//   node session-time.mjs LINCHPIN-5769                         # one task
//   node session-time.mjs LINCHPIN-5769 WC-2298 --since 2026-07-01
//   node session-time.mjs LINCHPIN-5769 --idle 20 --json
//   node session-time.mjs LINCHPIN-5769 --dir <projects dir>     # logs somewhere else
//
// READ-ONLY. It reads Claude Code's session logs (<CLAUDE_CONFIG_DIR or ~/.claude>/projects)
// and prints evidence. It never writes a time entry — a person confirms every figure.
//
// Why a script and not prose: the arithmetic is where hand-rolled estimates go wrong — an idle
// night counted as work, two parallel sessions on one branch added together, LINCHPIN-12
// matched inside LINCHPIN-123, every session that merely mentioned the key credited in full.
//
// Two strengths of evidence:
//   strong — log entries whose gitBranch names the key (issue/<KEY>, per task-tracking).
//            Timestamps from every session and subagent are merged before measuring, so
//            parallel work counts once.
//   weak   — sessions on some other branch whose log mentions the key. Listed as pointers,
//            never summed: their time belongs to whatever that branch was for.
//   lead-in — time the strong sessions spent on other branches, usually scoping on main before
//            the issue/<KEY> branch was cut. Reported on its own line, never summed: it may
//            be this task's groundwork or another task's work.
//
// Only Claude Code sessions on this machine are visible. Work by hand, in another agent, or on
// another machine is not — an empty result means "no evidence here", never "no time spent".
//
// Everything except scan() and the CLI is pure and exported for session-time.test.mjs.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';

export const DEFAULT_IDLE_MINUTES = 15;

// --- Matching ---------------------------------------------------------------------------

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A key as a whole token: LINCHPIN-12 must not match LINCHPIN-123 or XLINCHPIN-12. Case-blind,
// because older branches were sometimes lowercased.
export function keyRegex(keys) {
  const alt = keys.map(escape).join('|');
  return new RegExp(`(?<![A-Za-z0-9])(${alt})(?![0-9])`, 'i');
}

// Which of `keys` an entry belongs to, and how strongly. `line` is the raw JSONL text, used for
// mentions; `entry` is the parsed object.
export function classify(entry, line, keys) {
  const out = [];
  if (!entry || !entry.timestamp) return out;
  for (const key of keys) {
    const re = keyRegex([key]);
    if (entry.gitBranch && re.test(entry.gitBranch)) out.push({ key, strength: 'strong' });
    else if (re.test(line)) out.push({ key, strength: 'weak' });
  }
  return out;
}

// --- Measuring --------------------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');
export const localDate = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const localTime = (ms) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function fmt(ms) {
  const m = Math.round(ms / 60e3);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${pad(m % 60)}m` : `${m}m`;
}

// Active time: the sum of gaps between consecutive entries shorter than the idle threshold.
// A gap at or over it is a break, not work. Each counted gap belongs to the day of the entry
// that ends it. Input need not be sorted or unique.
export function measure(timestamps, idleMinutes = DEFAULT_IDLE_MINUTES) {
  const t = [...new Set(timestamps)].sort((a, b) => a - b);
  if (!t.length) return null;
  const idle = idleMinutes * 60e3;
  const days = new Map();
  const day = (ms) => {
    const k = localDate(ms);
    if (!days.has(k)) days.set(k, { date: k, start: localTime(ms), activeMs: 0 });
    return days.get(k);
  };
  let activeMs = 0;
  day(t[0]);
  for (let i = 1; i < t.length; i++) {
    const gap = t[i] - t[i - 1];
    const d = day(t[i]);
    if (gap < idle) {
      activeMs += gap;
      d.activeMs += gap;
    }
  }
  return {
    first: t[0],
    last: t.at(-1),
    spanMs: t.at(-1) - t[0],
    activeMs,
    // A day with under a minute of activity is a stray entry, not a work session.
    days: [...days.values()].filter((d) => d.activeMs >= 60e3),
  };
}

// Fold scanned hits into the per-key report. `currentSession` is the session running the
// script: a sweep mentions every key it looks at, so its weak hits are noise. Its strong hits
// stay — at finish time, the session on issue/<KEY> *is* the work.
// `context` is every timestamped entry from the files that held strong hits, any branch.
export function build(keys, hits, idleMinutes = DEFAULT_IDLE_MINUTES, currentSession = null, context = []) {
  const report = {};
  for (const key of keys) {
    const re = keyRegex([key]);
    const mine = hits.filter((h) => h.key === key);
    const strong = mine.filter((h) => h.strength === 'strong');
    const weakBySession = new Map();
    for (const h of mine.filter((x) => x.strength === 'weak' && x.sessionId !== currentSession)) {
      const w = weakBySession.get(h.sessionId) ?? {
        sessionId: h.sessionId,
        branch: h.branch || '(unknown)',
        cwd: h.cwd ? path.basename(h.cwd) : '(unknown)',
        first: h.ts,
        mentions: 0,
      };
      w.first = Math.min(w.first, h.ts);
      w.mentions++;
      weakBySession.set(h.sessionId, w);
    }
    // A session that has strong evidence for this key isn't also a weak pointer for it.
    const strongSessions = new Set(strong.map((h) => h.sessionId));
    const strongTs = strong.map((h) => h.ts);
    const strongMeasure = measure(strongTs, idleMinutes);
    // Lead-in is what the same sessions add *beyond* the strong time. Measuring the other-branch
    // entries alone would bridge gaps across time already counted as strong.
    const leadIn = context.filter((c) => strongSessions.has(c.sessionId) && !(c.branch && re.test(c.branch)));
    const leadInMs = strongMeasure
      ? measure([...strongTs, ...leadIn.map((c) => c.ts)], idleMinutes).activeMs - strongMeasure.activeMs
      : 0;
    report[key] = {
      strong: strongMeasure,
      strongSessions: strongSessions.size,
      leadIn: leadInMs >= 60e3
        // System entries carry no branch; name only the branches that did.
        ? { activeMs: leadInMs, branches: [...new Set(leadIn.map((c) => c.branch).filter(Boolean))] }
        : null,
      weak: [...weakBySession.values()]
        .filter((w) => !strongSessions.has(w.sessionId))
        .sort((a, b) => a.first - b.first),
    };
  }
  return report;
}

export function render(report, meta) {
  const lines = [
    `Session evidence from Claude Code logs — ${meta.filesScanned} file(s), gaps of ${meta.idleMinutes}m+ not counted${meta.since ? `, since ${meta.since}` : ''}.`,
    'Only this machine\'s Claude Code sessions are visible: hand work, other agents and other machines are not.',
  ];
  for (const [key, r] of Object.entries(report)) {
    lines.push('', key);
    if (r.strong) {
      lines.push(
        `  strong  ${r.strongSessions} session(s) on its branch, ${localDate(r.strong.first)} ${localTime(r.strong.first)} → ${localDate(r.strong.last)} ${localTime(r.strong.last)}`,
        `          active ${fmt(r.strong.activeMs)}  (wall-clock span ${fmt(r.strong.spanMs)})`,
      );
      for (const d of r.strong.days) lines.push(`          ${d.date}  start ${d.start}  active ${fmt(d.activeMs)}`);
      if (r.leadIn) {
        const on = r.leadIn.branches.length ? ` on ${r.leadIn.branches.join(', ')}` : '';
        lines.push(`  lead-in the same session(s) spent ${fmt(r.leadIn.activeMs)} more active${on} — often scoping before the branch was cut; ask, not counted`);
      }
    } else {
      lines.push('  strong  none — no session ran on a branch naming this key');
    }
    if (r.weak.length) {
      lines.push('  weak    mentioned on other branches — pointers only, not counted:');
      for (const w of r.weak) {
        lines.push(`          ${localDate(w.first)}  ${w.cwd}  branch ${w.branch}  (${w.mentions} mention(s))  session ${w.sessionId.slice(0, 8)}`);
      }
    }
  }
  return lines.join('\n');
}

// --- Reading the logs (the only part that touches disk) ---------------------------------

function* jsonlFiles(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* jsonlFiles(p);
    else if (e.isFile() && e.name.endsWith('.jsonl')) yield p;
  }
}

export async function scan(dir, keys, { sinceMs = 0 } = {}) {
  const pre = keyRegex(keys);
  const hits = [];
  let filesScanned = 0;
  for (const file of jsonlFiles(dir)) {
    // A file last written before the window can't hold entries inside it.
    if (sinceMs && fs.statSync(file).mtimeMs < sinceMs) continue;
    filesScanned++;
    const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
    for await (const line of rl) {
      // Cheap filter first: almost every line names none of the keys, so most are never parsed.
      if (!pre.test(line)) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      const ts = Date.parse(entry.timestamp);
      if (Number.isNaN(ts) || ts < sinceMs) continue;
      for (const c of classify(entry, line, keys)) {
        hits.push({
          ...c,
          ts,
          sessionId: entry.sessionId || path.basename(file, '.jsonl'),
          branch: entry.gitBranch,
          cwd: entry.cwd,
          file,
        });
      }
    }
  }
  return { hits, filesScanned };
}

// Second pass, over only the files that held strong hits: every timestamped entry on any
// branch, so build() can measure the lead-in. A handful of files, so parsing each line is fine.
export async function sessionContext(files, { sinceMs = 0 } = {}) {
  const out = [];
  for (const file of files) {
    const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
    for await (const line of rl) {
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      const ts = Date.parse(entry.timestamp);
      if (Number.isNaN(ts) || ts < sinceMs) continue;
      out.push({ ts, branch: entry.gitBranch, sessionId: entry.sessionId || path.basename(file, '.jsonl') });
    }
  }
  return out;
}

// --- CLI --------------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { keys: [], idle: DEFAULT_IDLE_MINUTES, json: false, since: null, dir: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--idle') opts.idle = Number(argv[++i]);
    else if (a === '--since') opts.since = argv[++i];
    else if (a === '--dir') opts.dir = argv[++i];
    else if (a === '-h' || a === '--help') opts.help = true;
    else if (a.startsWith('-')) throw new Error(`unknown option ${a}`);
    else opts.keys.push(a);
  }
  return opts;
}

const USAGE = 'usage: node session-time.mjs <TASK-KEY>… [--since YYYY-MM-DD] [--idle <minutes>] [--dir <projects dir>] [--json]';

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`${e.message}\n${USAGE}`);
    process.exit(2);
  }
  if (opts.help || !opts.keys.length) {
    console.log(USAGE);
    process.exit(opts.help ? 0 : 2);
  }
  if (!(opts.idle > 0)) {
    console.error('--idle must be a positive number of minutes');
    process.exit(2);
  }
  const sinceMs = opts.since ? Date.parse(`${opts.since}T00:00:00`) : 0;
  if (Number.isNaN(sinceMs)) {
    console.error('--since must be YYYY-MM-DD');
    process.exit(2);
  }
  const base = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const dir = opts.dir || path.join(base, 'projects');
  if (!fs.existsSync(dir)) {
    console.error(`No Claude Code session logs at ${dir} — no session evidence on this machine.`);
    process.exit(1);
  }
  const { hits, filesScanned } = await scan(dir, opts.keys, { sinceMs });
  const strongFiles = [...new Set(hits.filter((h) => h.strength === 'strong').map((h) => h.file))];
  const context = await sessionContext(strongFiles, { sinceMs });
  const report = build(opts.keys, hits, opts.idle, process.env.CLAUDE_CODE_SESSION_ID || null, context);
  const meta = { dir, filesScanned, idleMinutes: opts.idle, since: opts.since };
  console.log(opts.json ? JSON.stringify({ ...meta, keys: report }, null, 2) : render(report, meta));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
