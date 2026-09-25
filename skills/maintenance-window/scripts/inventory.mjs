#!/usr/bin/env node
// Inventory a repository's dependency-maintenance backlog for the maintenance-window skill.
// Zero dependencies — Node >= 18 plus an authenticated `gh`.
//
//   node inventory.mjs                        # the repo in the current directory
//   node inventory.mjs --repo owner/name      # any repo gh can read
//   node inventory.mjs --json                 # machine-readable, same data
//
// READ-ONLY. It only runs `gh repo view`, `gh pr list` and `gh api` GETs. It never merges,
// closes, labels, comments or deletes; the skill decides what to do with what it reports.
//
// Why a script and not prose: the failures it flags are the ones agents miss when they
// hand-roll `gh | jq` every run. The same Renovate topic open against several stale windows,
// two PRs that each move half of one dependency and can't pass alone, and a check that is red
// on every PR because they are all stale behind a base that has since been fixed.
//
// `classify()` and `render()` are pure and exported for scripts/inventory.test.mjs. Only
// `fetchData()` touches the network.

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// --- Shapes -------------------------------------------------------------------------------

// A monthly window as linchpin/actions' maintenance.yml names it. The suffix admits
// hand-made variants (maintenance/2026-09-2) so they are reported rather than missed.
export const WINDOW_RE = /^maintenance\/(\d{4})-(\d{2})(?:-[\w.-]+)?$/;
// The empty commit a window opens with: the shared workflow's and an older copied form.
const ANCHOR_RE = /open (the )?(maintenance\/)?\d{4}-\d{2} maintenance window/i;
const LOCKFILE_RE = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|composer\.lock)$/;
const CONVENTIONAL_RE = /^[a-z]+(\([^)]+\))?!?: \S/;
const FAILING = new Set(['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE']);
const PENDING = new Set(['PENDING', 'QUEUED', 'IN_PROGRESS', 'WAITING', 'REQUESTED', 'EXPECTED']);
const RENOVATE_CONFIG_PATHS = [
  'renovate.json',
  '.github/renovate.json',
  '.renovaterc.json',
  '.renovaterc',
  'renovate.json5',
  '.github/renovate.json5',
];

/** `app/renovate`, `renovate[bot]` and `renovate` are the same actor. */
export function normalizeLogin(login = '') {
  return String(login).replace(/^app\//, '').replace(/\[bot\]$/, '').toLowerCase();
}

/** One entry per check name, latest run wins; state is FAILURE / PENDING / SUCCESS / … */
export function normalizeChecks(rollup = []) {
  const byName = new Map();
  for (const c of rollup || []) {
    const name = c.name || c.context;
    if (!name) continue;
    const state =
      c.__typename === 'StatusContext' || c.state
        ? String(c.state || '').toUpperCase()
        : c.status && c.status !== 'COMPLETED'
          ? String(c.status).toUpperCase()
          : String(c.conclusion || '').toUpperCase();
    const at = c.completedAt || c.startedAt || c.createdAt || '';
    const prev = byName.get(name);
    if (!prev || at >= prev.at) byName.set(name, { name, state, at });
  }
  return [...byName.values()].map(({ name, state }) => ({ name, state }));
}

/** Rows of Renovate's "Package | … | Change" table: dependency name and target value. */
export function parseRenovateTable(body = '') {
  const deps = [];
  for (const line of String(body).split('\n')) {
    if (!line.startsWith('| ') || line.startsWith('| Package') || line.startsWith('|---')) continue;
    const first = line.split('|')[1] || '';
    const name = (first.match(/\[([^\]]+)\]/) || [null, first])[1].trim();
    const change = line.match(/`([^`]+)`\s*(?:→|->)\s*`([^`]+)`/);
    if (!name || !change) continue;
    deps.push({ name, from: change[1], to: change[2] });
  }
  return deps;
}

function majorOf(value) {
  const m = String(value).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

/** Major per Renovate's own markers, then per the version table as a fallback. */
export function isMajorUpdate(pr, deps) {
  const labels = pr.labels || [];
  if (labels.includes('major')) return true;
  if (/\(major\)|- Major\b/i.test(pr.title)) return true;
  // Renovate's default subject names a bare major for a major bump: "… to v7".
  if (/\bto v\d+(?:\s|$|\()/.test(pr.title)) return true;
  return deps.some((d) => {
    const from = majorOf(d.from);
    const to = majorOf(d.to);
    return from !== null && to !== null && to > from;
  });
}

function actorOf(pr) {
  const login = normalizeLogin(pr.author);
  if (login === 'renovate') return 'renovate';
  if (login === 'dependabot') return 'dependabot';
  if (pr.headRefName.startsWith('release-please--')) return 'release-please';
  if (/bot$|\[bot\]$/.test(login) || login.startsWith('linchpin-') || login === 'github-actions') return 'other-bot';
  return 'human';
}

/** Which category of work a PR is. Every PR gets exactly one bucket. */
export function bucketOf(pr, deps) {
  const actor = actorOf(pr);
  if (actor === 'renovate') {
    if (/lock-file-maintenance/.test(pr.headRefName) || /lock file maintenance/i.test(pr.title)) {
      return 'renovate:lockfile';
    }
    if (/\[SECURITY\]/i.test(pr.title) || (pr.labels || []).includes('security')) return 'renovate:security';
    if (isMajorUpdate(pr, deps)) return 'renovate:major';
    return 'renovate:non-major';
  }
  if (actor === 'dependabot') {
    const files = pr.files || [];
    return files.length && files.every((f) => LOCKFILE_RE.test(f))
      ? 'dependabot:lockfile-only'
      : 'dependabot:manifest';
  }
  return actor;
}

/** Drain order for non-majors: WordPress packages, Composer, npm, the rest. */
function drainRank(pr) {
  const files = pr.files || [];
  if (/^update\((wp-plugin|wp-theme)\)/.test(pr.title) || /wordpress-org|packagist/.test(pr.head)) return 1;
  if (files.some((f) => /(^|\/)composer\.(json|lock)$/.test(f)) || (pr.labels || []).includes('composer')) return 2;
  if (files.some((f) => /(^|\/)package(-lock)?\.json$/.test(f)) || (pr.labels || []).includes('npm')) return 3;
  return 4;
}

function monthIndex(year, month) {
  return Number(year) * 12 + Number(month) - 1;
}

// --- Routing ------------------------------------------------------------------------------

/**
 * Which model the repo's Renovate config routes updates by:
 * `hybrid` (non-majors → window, majors → default), `window` (everything → window),
 * `direct` (everything → default), or `none` (no Renovate config found).
 */
export function routingOf(renovateConfig, defaultBranch) {
  if (!renovateConfig) return { mode: 'none', why: 'no Renovate config found at the usual paths' };
  if (renovateConfig.error) return { mode: 'unknown', why: `could not parse ${renovateConfig.path}: ${renovateConfig.error}` };
  const cfg = renovateConfig.config || {};
  const ext = [].concat(cfg.extends || []);
  const linchpinPreset = ext.some((e) => /^github>linchpin\/renovatebot-(automerge-)?config/.test(e));
  const patterns = cfg.baseBranchPatterns || cfg.baseBranches || null;
  if (patterns) {
    const hasWindow = patterns.some((p) => /maintenance/.test(p));
    const hasDefault = patterns.some((p) => p === defaultBranch || p === '$default');
    if (hasWindow && hasDefault) return { mode: 'hybrid', why: `baseBranchPatterns ${JSON.stringify(patterns)}` };
    if (hasWindow) return { mode: 'window', why: `baseBranchPatterns ${JSON.stringify(patterns)}` };
    return { mode: 'direct', why: `baseBranchPatterns ${JSON.stringify(patterns)} overrides the preset` };
  }
  if (linchpinPreset) return { mode: 'window', why: 'inherits /^maintenance\\/.*/ from the Linchpin preset' };
  return { mode: 'direct', why: 'no baseBranchPatterns — Renovate targets the default branch' };
}

function hasHybridGuards(cfg = {}) {
  const rules = cfg.packageRules || [];
  const onWindow = (r) => [].concat(r.matchBaseBranches || []).some((b) => /maintenance/.test(b));
  return rules.some((r) => onWindow(r) && [].concat(r.matchUpdateTypes || []).includes('major') && r.enabled === false);
}

// --- Classification (pure) ----------------------------------------------------------------

export function classify(data, { now = new Date() } = {}) {
  const def = data.settings.defaultBranch;
  const nowIdx = monthIndex(now.getUTCFullYear(), now.getUTCMonth() + 1);
  const routing = routingOf(data.renovateConfig, def);
  const cfg = data.renovateConfig?.config || {};

  const prs = data.prs.map((pr) => {
    const deps = actorOf(pr) === 'renovate' ? parseRenovateTable(pr.body) : [];
    const checks = pr.checks || [];
    const failing = checks.filter((c) => FAILING.has(c.state)).map((c) => c.name);
    const required = new Set(data.protection?.requiredChecks || []);
    const pending = checks.filter((c) => PENDING.has(c.state)).map((c) => c.name);
    const win = pr.baseRefName.match(WINDOW_RE);
    const humanCommits =
      actorOf(pr) === 'renovate'
        ? (pr.commitAuthors || []).filter((a) => normalizeLogin(a) !== 'renovate')
        : [];
    return {
      number: pr.number,
      title: pr.title,
      base: pr.baseRefName,
      head: pr.headRefName,
      labels: pr.labels || [],
      files: pr.files || [],
      bucket: bucketOf(pr, deps),
      deps,
      ageDays: Math.floor((now - new Date(pr.createdAt)) / 86400000),
      mergeState: pr.mergeStateStatus || 'UNKNOWN',
      conflicted: pr.mergeable === 'CONFLICTING' || pr.mergeStateStatus === 'DIRTY',
      behindBy: pr.behindBy ?? null,
      failing,
      failingRequired: failing.filter((n) => required.has(n)),
      pending,
      noChecks: checks.length === 0,
      autoMerge: !!pr.autoMerge,
      isDraft: !!pr.isDraft,
      onWindow: !!win,
      staleWindow: !!win && monthIndex(win[1], win[2]) < nowIdx,
      humanEdited: [...new Set(humanCommits)],
      flags: [],
    };
  });

  const byNumber = new Map(prs.map((p) => [p.number, p]));
  const botPrs = prs.filter((p) => p.bucket.startsWith('renovate') || p.bucket.startsWith('dependabot'));
  const windowPr = (name) => prs.find((p) => p.head === name && p.base === def);

  // Windows: every maintenance/* branch, with what it holds that the default branch lacks.
  const windows = (data.windows || []).map((w) => {
    const m = w.name.match(WINDOW_RE);
    const idx = m ? monthIndex(m[1], m[2]) : null;
    const unmerged = (w.aheadCommits || []).filter((c) => !ANCHOR_RE.test(c.message));
    const pr = windowPr(w.name);
    return {
      name: w.name,
      standardName: /^maintenance\/\d{4}-\d{2}$/.test(w.name),
      current: idx === nowIdx,
      stale: idx !== null && idx < nowIdx,
      unmergedCommits: unmerged.length,
      // Security fixes merged into a window are not on the site until the window merges.
      strandedSecurity: unmerged.filter((c) => /\[SECURITY\]/i.test(c.message)).map((c) => c.message.split('\n')[0]),
      behindBy: w.behindBy ?? null,
      pr: pr ? pr.number : null,
      closedPr: w.closedPr ?? null,
      prTitleConventional: pr ? CONVENTIONAL_RE.test(pr.title) : null,
      stackedPrs: prs.filter((p) => p.base === w.name).map((p) => p.number),
    };
  });

  // The same Renovate topic open against more than one base branch. Keep the copy on the
  // newest base — the default branch, else the latest window — and close the rest.
  const baseRank = (base) => {
    if (base === def) return Infinity;
    const m = base.match(WINDOW_RE);
    return m ? monthIndex(m[1], m[2]) : -Infinity;
  };
  const topics = new Map();
  for (const p of prs.filter((x) => x.bucket.startsWith('renovate'))) {
    const topic = p.head.replace(/^renovate\//, '').replace(`${p.base}-`, '');
    if (!topics.has(topic)) topics.set(topic, []);
    topics.get(topic).push(p);
  }
  const duplicates = [...topics.entries()]
    .filter(([, list]) => new Set(list.map((p) => p.base)).size > 1)
    .map(([topic, list]) => {
      const keep = [...list].sort((a, b) => baseRank(b.base) - baseRank(a.base) || b.number - a.number)[0];
      // Every copy on a stale window: none survives. Renovate re-raises the topic on the
      // current window once the stale branches are gone.
      if (keep.staleWindow) {
        for (const p of list) p.flags.push('duplicated across stale windows');
        return { topic, keep: null, close: list.map((p) => p.number) };
      }
      for (const p of list) if (p !== keep) p.flags.push(`duplicate of #${keep.number}`);
      return { topic, keep: keep.number, close: list.filter((p) => p !== keep).map((p) => p.number) };
    });

  // One dependency moving to one version in several PRs on the same base.
  const moves = new Map();
  for (const p of prs) {
    for (const d of p.deps) {
      const key = `${p.base}\u0000${d.name}\u0000${d.to.replace(/^[\^~>=v\s]+/, '')}`;
      if (!moves.has(key)) moves.set(key, new Set());
      moves.get(key).add(p.number);
    }
  }
  const coMoving = [];
  for (const [key, set] of moves) {
    if (set.size < 2) continue;
    const [base, dep, to] = key.split('\u0000');
    const numbers = [...set].sort((a, b) => a - b);
    const id = `${base}|${numbers.join(',')}`;
    const existing = coMoving.find((c) => c.id === id);
    if (existing) existing.deps.push(`${dep} ${to}`);
    else coMoving.push({ id, base, prs: numbers, deps: [`${dep} ${to}`] });
  }
  for (const c of coMoving) for (const n of c.prs) byNumber.get(n).flags.push(`moves with #${c.prs.filter((x) => x !== n).join(', #')}`);

  // Checks red on many bot PRs at once point at the base branch, not the PRs.
  const withChecks = botPrs.filter((p) => !p.noChecks);
  const failCount = new Map();
  for (const p of withChecks) for (const name of p.failing) failCount.set(name, (failCount.get(name) || []).concat(p.number));
  // Two up-to-date PRs failing the same check is a strong signal on its own: their results
  // are current, so the ratio test would under-count it on a busy backlog.
  const upToDate = (n) => byNumber.get(n).behindBy === 0;
  const requiredSet = new Set(data.protection?.requiredChecks || []);
  const sharedFailures = [...failCount.entries()]
    .filter(
      ([, list]) =>
        list.length >= 3 ||
        (list.length >= 2 && list.length / Math.max(withChecks.length, 1) >= 0.5) ||
        list.filter(upToDate).length >= 2,
    )
    .map(([check, list]) => ({
      check,
      required: requiredSet.has(check),
      prs: list,
      behind: list.filter((n) => (byNumber.get(n).behindBy || 0) > 0).length,
    }))
    .sort((a, b) => b.required - a.required || a.behind - b.behind || b.prs.length - a.prs.length);

  for (const p of prs) {
    if (p.conflicted) p.flags.push('conflicted');
    if (p.behindBy > 0) p.flags.push(`behind ${p.behindBy}`);
    if (p.humanEdited.length) p.flags.push(`edited by ${p.humanEdited.join(', ')} — Renovate no longer maintains it`);
    if (p.staleWindow) p.flags.push('on a stale window');
    if (p.bucket === 'renovate:major' && p.onWindow) p.flags.push('major inside a window');
    if (p.autoMerge) p.flags.push('auto-merge armed — the next approval merges it');
  }

  // --- Pipeline findings ------------------------------------------------------------------
  const findings = [];
  const add = (id, severity, detail) => findings.push({ id, severity, detail });
  const renovatePresent = !!data.renovateConfig || prs.some((p) => p.bucket.startsWith('renovate'));

  const windowed = ['window', 'hybrid'].includes(routing.mode);
  if (windowed) {
    if (windows.length > 1) {
      add('multiple-windows', 'blocks', `${windows.length} maintenance branches are open (${windows.map((w) => w.name).join(', ')}); Renovate opens every update against each one.`);
    }
    const noPr = windows.filter((w) => !w.pr).map((w) => w.name);
    if (noPr.length) add('window-without-pr', 'blocks', `${noPr.join(', ')} ${noPr.length === 1 ? 'has' : 'have'} no open PR into ${def}, so nothing reviews or merges the batch.`);
    for (const w of windows) {
      if (w.pr && w.prTitleConventional === false) add('window-title', 'blocks', `Window PR #${w.pr} has a non-conventional title; a commit-message check that lints PR titles fails it.`);
      if (!w.standardName) add('window-name', 'wastes', `${w.name} does not match maintenance/YYYY-MM; linchpin/actions' auto-merge-maintenance ignores it.`);
    }
  } else if (windows.length) {
    add('orphaned-windows', 'wastes', `${windows.length} maintenance branch(es) exist (${windows.map((w) => w.name).join(', ')}) but Renovate does not target them. Either adopt the hybrid routing or stop opening windows.`);
  }
  const stranded = windows.filter((w) => w.strandedSecurity.length);
  if (stranded.length) {
    add('stranded-security', 'blocks', `Security fixes are merged into windows that never reached ${def}: ${stranded.map((w) => `${w.name} (${w.strandedSecurity.length})`).join(', ')}. The site does not have them.`);
  }
  if (duplicates.length) {
    add('duplicate-topics', 'wastes', `${duplicates.length} Renovate topic(s) are open against more than one base branch.`);
  }
  if (data.protection?.strict && cfg.rebaseWhen === 'conflicted' && ['direct', 'hybrid'].includes(routing.mode)) {
    add('strict-conflicted', 'blocks', `${def} requires branches to be up to date, but rebaseWhen is "conflicted": a PR that falls behind never rebases, so automerge stalls. Renovate's docs recommend against this pairing.`);
  }
  const stalledBehind = botPrs.filter((p) => p.base === def && p.behindBy > 0 && p.failing.length);
  if (stalledBehind.length >= 2) {
    add('stale-results', 'blocks', `${stalledBehind.length} red bot PRs are behind ${def}; their checks ran against an older base. Rebase them before diagnosing.`);
  }
  if (routing.mode === 'hybrid' && !hasHybridGuards(cfg)) {
    add('hybrid-unguarded', 'blocks', 'Renovate targets both the default branch and windows, but no packageRule disables majors on the windows.');
  }
  if (routing.mode === 'window') {
    add('window-takes-majors', 'wastes', 'Every update, majors included, targets the window, so one breaking major can strand the whole batch. The hybrid routing sends majors to their own PRs.');
  }
  if (routing.mode === 'direct' && renovatePresent) {
    add('direct-routing', 'info', `Renovate targets ${def} directly: every PR needs its own review and its own up-to-date run.`);
  }
  if ([].concat(cfg.extends || []).some((e) => /renovatebot-automerge-config/.test(e))) {
    add('deprecated-preset', 'wastes', 'Extends the deprecated github>linchpin/renovatebot-automerge-config; point it at github>linchpin/renovatebot-config:automerge.');
  }
  if (data.securityUpdates?.enabled && !data.securityUpdates?.paused && renovatePresent) {
    add('dependabot-security-prs', 'wastes', 'Dependabot security-update PRs are switched on beside Renovate; they edit only lockfiles and duplicate lockFileMaintenance.');
  }
  const dependabotOpen = prs.filter((p) => p.bucket.startsWith('dependabot'));
  if (dependabotOpen.length && renovatePresent) {
    add('two-bots', 'wastes', `${dependabotOpen.length} Dependabot PR(s) are open on a Renovate repo.`);
  }
  if (!data.settings.allowMergeCommit && !data.settings.allowRebaseMerge) {
    add('squash-only', 'blocks', 'Only squash merges are allowed: a window cannot land as one commit per group. Enable merge commits or rebase merges before merging a window.');
  }
  if (!data.settings.allowAutoMerge) {
    add('auto-merge-off', 'wastes', '"Allow auto-merge" is off, so Renovate and GitHub automerge cannot merge anything.');
  }
  if (windowed && data.workflows) {
    const wf = data.workflows;
    if (!wf.maintenance) add('window-workflow-missing', 'blocks', 'No maintenance.yml opens the monthly window.');
    else if (!wf.maintenanceCallsShared) add('window-workflow-copied', 'wastes', `${wf.maintenance} does not call linchpin/actions' maintenance.yml@v4; copies push a bare branch and open no PR.`);
    // Renovate automerges into the window itself only with the automerge preset and
    // ignoreTests, since nothing runs checks there; otherwise the shared workflow must.
    const renovateMerges = [].concat(cfg.extends || []).some((e) => /automerge/.test(e)) && cfg.ignoreTests === true;
    if (!wf.autoMerge && !renovateMerges) {
      add('window-merger-missing', 'wastes', 'Nothing merges PRs into the window: no caller of linchpin/actions auto-merge-maintenance.yml, and Renovate is not set to automerge there (automerge preset + ignoreTests).');
    }
    if (data.windowRules?.approvals > 0 && !(wf.autoApprove && wf.autoApproveTriggersWindow)) {
      add('auto-approve-missing', 'wastes', wf.autoApprove
        ? 'Reviews are required on window branches, and the auto-approve caller does not trigger on PRs into maintenance/**.'
        : 'Reviews are required on window branches, and no workflow calls linchpin/actions auto-approve-maintenance.yml.');
    }
  }
  const uncheckedWindowPrs = prs.filter((p) => p.onWindow && p.bucket.startsWith('renovate') && p.noChecks);
  if (uncheckedWindowPrs.length) {
    add('window-unchecked', 'info', `${uncheckedWindowPrs.length} PR(s) into a window ran no checks; the batch is verified only at the window PR.`);
  }
  for (const p of prs.filter((x) => x.humanEdited.length)) {
    add('human-edited-branch', 'wastes', `#${p.number} has commits from ${p.humanEdited.join(', ')}; Renovate will not rebase it again. Take ownership and merge it, or discard the extra commits from the Dependency Dashboard's "PR Edited (Blocked)" list. Closing it makes Renovate ignore the update.`);
  }
  if (routing.mode === 'direct' && data.protection?.approvals > 0 && botPrs.some((p) => p.base === def)) {
    add('review-per-pr', 'blocks', `Every bot PR into ${def} needs ${data.protection.approvals} approval(s)${data.protection.lastPushApproval ? ', and last-push approval means each Renovate rebase needs a fresh one — from someone who did not push to it' : ''}. Nothing automerges until someone approves each PR.`);
  }
  const splitGroups = coMoving.filter((c) => !c.prs.some((n) => byNumber.get(n).bucket === 'renovate:major'));
  if (splitGroups.length) {
    add('split-group', 'wastes', `${splitGroups.length} set(s) of non-major PRs move the same dependency (${splitGroups.map((c) => c.prs.map((n) => `#${n}`).join(' + ')).join('; ')}). If a required check guards consistency, none can merge alone. Usually a later packageRule's groupName splits the group.`);
  }
  if (data.alerts) {
    const a = data.alerts;
    const sev = Object.entries(a.bySeverity).map(([k, v]) => `${v} ${k}`).join(', ');
    add('open-alerts', a.runtimeHighOrCritical > 0 ? 'blocks' : 'info', `${a.count}${a.truncated ? '+' : ''} open Dependabot alert(s) on ${def} (${sev}); ${a.runtimeHighOrCritical} high or critical in runtime dependencies.`);
  }
  if (data.renovateBranches) {
    const open = new Set(prs.map((p) => p.head));
    const orphans = data.renovateBranches.filter((b) => !open.has(b));
    if (orphans.length) add('orphaned-renovate-branches', 'wastes', `${orphans.length} renovate/* branch(es) have no open PR (e.g. ${orphans.slice(0, 3).join(', ')}). Stale-window leftovers can be deleted once their window is retired.`);
  }
  for (const w of windows.filter((x) => !x.pr && x.closedPr)) {
    add('window-pr-closed', 'info', `${w.name}'s window PR #${w.closedPr} was closed unmerged; check its closing comment before retiring the branch.`);
  }

  // --- Proposed queue ---------------------------------------------------------------------
  const current = windows.find((w) => w.current && w.standardName) || null;
  const target = routing.mode === 'hybrid' || routing.mode === 'window' ? current?.name || '(open this month\'s window)' : def;
  const queue = [];
  const step = (action, numbers, note) => queue.push({ action, prs: numbers, note });
  const numbersOf = (list) => list.map((p) => p.number);

  const staleWindowPrs = prs.filter((p) => p.staleWindow);
  // Copies on stale windows close with their window; only live duplicates need their own step.
  const closeDupes = duplicates.flatMap((d) => d.close).filter((n) => !byNumber.get(n).staleWindow);
  const lockOnly = prs.filter((p) => p.bucket === 'dependabot:lockfile-only');
  if (stranded.length) {
    step(
      `land stranded security fixes on ${def} first`,
      [],
      stranded.map((w) => `${w.name}: ${w.strandedSecurity.join(' / ')}`).join('; '),
    );
  }
  const retiring = windowed ? windows.filter((w) => w.stale) : windows;
  if (retiring.length) {
    step(
      windowed ? 'collapse stale windows' : 'retire orphaned windows',
      numbersOf(staleWindowPrs),
      [
        ...retiring.map((w) => `${w.name}: ${w.unmergedCommits} commit(s) not on ${def}${w.strandedSecurity.length ? `, ${w.strandedSecurity.length} of them security fixes` : ''}`),
        windowed && staleWindowPrs.length ? 'Renovate re-raises open topics on the current window once the stale branches are gone' : null,
      ].filter(Boolean).join('; '),
    );
  }
  if (closeDupes.length) step('close duplicates', closeDupes, 'superseded by the copy on the newest base');
  if (lockOnly.length) step('check, then close, lockfile-only Dependabot PRs', numbersOf(lockOnly), 'close each one the base already satisfies (npm ls <pkg>)');
  const dependabotManifest = prs.filter((p) => p.bucket === 'dependabot:manifest');
  if (dependabotManifest.length) {
    step('hand Dependabot manifest bumps to Renovate', numbersOf(dependabotManifest), 'close each one Renovate already carries; a security fix it has not raised ships via dependency-updates');
  }
  const security = prs.filter((p) => p.bucket === 'renovate:security');
  const alertNote = data.alerts?.runtimeHighOrCritical ? `; ${data.alerts.runtimeHighOrCritical} high/critical runtime alert(s) open on ${def}` : '';
  if (security.length || alertNote) step('ship security fixes ahead of the batch', numbersOf(security), `each on its own, via dependency-updates${alertNote}`);
  const edited = prs.filter((p) => p.humanEdited.length && !closeDupes.includes(p.number));
  if (edited.length) step('take ownership, or discard the extra commits', numbersOf(edited), 'Renovate will not rebase these again; discard from the Dependency Dashboard, never by closing');
  const rebase = botPrs.filter((p) => p.behindBy > 0 && p.failing.length && !p.humanEdited.length && !closeDupes.includes(p.number));
  if (rebase.length) step('request a Renovate rebase', numbersOf(rebase), 'add the `rebase` label, or tick rebase-all on the Dependency Dashboard; re-read the checks after it runs');
  for (const f of sharedFailures) {
    const allStale = f.behind === f.prs.length;
    step(
      allStale ? `re-check "${f.check}" after the rebase` : `fix "${f.check}" once, on the base`,
      f.prs,
      allStale ? 'every red PR is behind its base; fix it on the base only if it stays red' : `${f.behind} of ${f.prs.length} are behind their base`,
    );
  }
  const isMajorPr = (n) => byNumber.get(n).bucket === 'renovate:major';
  for (const c of coMoving.filter((x) => !x.prs.some(isMajorPr))) {
    step('land together', c.prs, `${c.deps.join(', ')}; if a required check fails each alone, combine them into one PR`);
  }
  const nonMajors = prs
    .filter((p) => p.bucket === 'renovate:non-major' && !p.staleWindow && !closeDupes.includes(p.number))
    .sort((a, b) => drainRank(a) - drainRank(b) || a.number - b.number);
  if (nonMajors.length) step(`drain non-majors into ${target}`, numbersOf(nonMajors), 'WordPress packages, then Composer, then npm');
  const lockMaint = prs.filter((p) => p.bucket === 'renovate:lockfile' && !p.staleWindow);
  if (lockMaint.length) step('lock-file maintenance last', numbersOf(lockMaint), 'it rewrites every lock; let it recreate after the rest land');
  const majors = prs.filter((p) => p.bucket === 'renovate:major' && !p.staleWindow && !closeDupes.includes(p.number));
  const majorSets = coMoving.filter((x) => x.prs.some(isMajorPr)).map((c) => `${c.prs.map((n) => `#${n}`).join(' + ')} move ${c.deps.join(', ')} together`);
  if (majors.length) {
    step(`majors, one PR each, to ${def}`, numbersOf(majors), ['each through dependency-updates; hold what is not ready', ...majorSets].join('; '));
  }
  if (current?.pr) step('verify and merge the window', [current.pr], mergeMethod(data.settings));

  return {
    repo: data.repo,
    fetchedAt: data.fetchedAt,
    defaultBranch: def,
    routing,
    rebaseWhen: cfg.rebaseWhen ?? null,
    protection: data.protection,
    windowMergeMethod: mergeMethod(data.settings),
    securityUpdates: data.securityUpdates,
    alerts: data.alerts ?? null,
    counts: countBy(prs, (p) => p.bucket),
    windows,
    prs,
    duplicates,
    coMoving: coMoving.map(({ id, ...rest }) => rest),
    sharedFailures,
    findings,
    queue,
  };
}

function mergeMethod(settings) {
  if (settings.allowMergeCommit) return 'merge commit (never squash)';
  if (settings.allowRebaseMerge) return 'rebase merge (merge commits are disabled; never squash)';
  return 'blocked: only squash is allowed';
}

function countBy(list, fn) {
  const out = {};
  for (const x of list) out[fn(x)] = (out[fn(x)] || 0) + 1;
  return out;
}

// --- Rendering (pure) ---------------------------------------------------------------------

export function render(r) {
  const lines = [];
  const p = (s = '') => lines.push(s);
  const refs = (list) => (list.length ? list.map((n) => `#${n}`).join(', ') : '—');

  p(`# Maintenance inventory — ${r.repo}`);
  p();
  p(`Fetched ${r.fetchedAt}. Read-only: nothing was changed.`);
  p();
  p('| | |');
  p('| --- | --- |');
  p(`| Default branch | \`${r.defaultBranch}\` |`);
  p(`| Routing | **${r.routing.mode}** — ${r.routing.why} |`);
  p(`| rebaseWhen | ${r.rebaseWhen ? `\`${r.rebaseWhen}\`` : 'not set in the repo config'} |`);
  if (r.protection) {
    p(`| Merge rules | ${r.protection.approvals} approval(s)${r.protection.lastPushApproval ? ' + last-push approval' : ''}, ${r.protection.requiredChecks.length} required check(s), strict ${r.protection.strict ? 'on' : 'off'} |`);
  } else {
    p('| Merge rules | none found (or not readable with this token) |');
  }
  p(`| Window merge method | ${r.windowMergeMethod} |`);
  p(`| Open alerts on ${r.defaultBranch} | ${r.alerts ? `${r.alerts.count}${r.alerts.truncated ? '+' : ''} (${Object.entries(r.alerts.bySeverity).map(([k, v]) => `${v} ${k}`).join(', ') || 'none'}; ${r.alerts.runtimeHighOrCritical} high/critical runtime)` : 'unknown (token cannot read alerts)'} |`);
  p(`| Dependabot security PRs | ${r.securityUpdates ? (r.securityUpdates.enabled ? (r.securityUpdates.paused ? 'on, paused' : 'on') : 'off') : 'unknown'} |`);
  p(`| Open PRs | ${Object.entries(r.counts).map(([k, v]) => `${k} ${v}`).join(' · ') || 'none'} |`);
  p();

  if (r.windows.length) {
    p('## Windows');
    p();
    p('_Commits are counted by SHA with the empty "open the window" commit left out. A squash-merged window still lists every commit, so check versions on the default branch before salvaging anything._');
    p();
    p('| Branch | State | Window PR | Stacked PRs | Commits not on default | Behind |');
    p('| --- | --- | --- | --- | --- | --- |');
    for (const w of r.windows) {
      const state = w.current ? 'current' : w.stale ? '**stale**' : 'future';
      p(`| \`${w.name}\` | ${state} | ${w.pr ? `#${w.pr}` : w.closedPr ? `none (#${w.closedPr} closed)` : '**none**'} | ${refs(w.stackedPrs)} | ${w.unmergedCommits} | ${w.behindBy ?? '?'} |`);
    }
    p();
  }

  p('## Backlog');
  p();
  const rows = r.prs.filter((x) => x.bucket !== 'human');
  if (!rows.length) p('No bot PRs are open.');
  else {
    p('| PR | Bucket | Base | Age | State | Failing checks | Flags |');
    p('| --- | --- | --- | --- | --- | --- | --- |');
    for (const x of rows) {
      const fail = x.failing.length
        ? x.failing.map((n) => (x.failingRequired.includes(n) ? `${n} (required)` : n)).join('; ')
        : x.pending.length ? 'pending' : x.noChecks ? 'no checks' : '—';
      p(`| #${x.number} ${escapeCell(x.title)} | ${x.bucket} | \`${x.base}\` | ${x.ageDays}d | ${x.mergeState} | ${escapeCell(fail)} | ${escapeCell(x.flags.join('; ')) || '—'} |`);
    }
  }
  const humans = r.prs.filter((x) => x.bucket === 'human').length;
  if (humans) p(`\n_${humans} human-authored PR(s) are open and are not part of the queue._`);
  p();

  if (r.sharedFailures.length) {
    p('## Shared failures');
    p();
    for (const f of r.sharedFailures) {
      p(`- **${f.check}**${f.required ? ' (required)' : ''} — red on ${refs(f.prs)}; ${f.behind} of ${f.prs.length} are behind their base.`);
    }
    p();
  }
  if (r.coMoving.length) {
    p('## Co-moving PRs');
    p();
    for (const c of r.coMoving) p(`- ${refs(c.prs)} on \`${c.base}\` all move ${c.deps.join(', ')}.`);
    p();
  }
  if (r.duplicates.length) {
    p('## Duplicates across windows');
    p();
    for (const d of r.duplicates) {
      p(d.keep ? `- \`${d.topic}\`: keep #${d.keep}, close ${refs(d.close)}.` : `- \`${d.topic}\`: every copy (${refs(d.close)}) is on a stale window.`);
    }
    p();
  }
  p('## Pipeline findings');
  p();
  if (!r.findings.length) p('None.');
  for (const f of r.findings) p(`- **${f.id}** (${f.severity}) — ${f.detail}`);
  p();
  p('## Proposed queue');
  p();
  if (!r.queue.length) p('Nothing to do.');
  r.queue.forEach((q, i) => p(`${i + 1}. **${q.action}**${q.prs.length ? ` — ${refs(q.prs)}` : ''}${q.note ? `. ${q.note}` : ''}`));
  p();
  return lines.join('\n');
}

function escapeCell(s) {
  return String(s).replace(/\|/g, '\\|');
}

// --- Fetching (gh, read-only) -------------------------------------------------------------

function gh(args, { allowFail = false } = {}) {
  try {
    return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    if (allowFail) return null;
    throw new Error(`gh ${args.join(' ')} failed: ${(err.stderr || err.message).toString().trim()}`);
  }
}

function ghJson(args, opts) {
  const out = gh(args, opts);
  if (out === null) return null;
  try {
    return JSON.parse(out);
  } catch {
    return null;
  }
}

function ghRaw(repo, path, ref) {
  return gh(['api', `repos/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`, '-H', 'Accept: application/vnd.github.raw'], { allowFail: true });
}

export function fetchData(repo) {
  const meta = ghJson(['api', `repos/${repo}`]);
  const settings = {
    defaultBranch: meta.default_branch,
    allowMergeCommit: !!meta.allow_merge_commit,
    allowRebaseMerge: !!meta.allow_rebase_merge,
    allowSquashMerge: !!meta.allow_squash_merge,
    allowAutoMerge: !!meta.allow_auto_merge,
  };
  const def = settings.defaultBranch;

  // Effective rules (rulesets, including org-level ones) plus classic protection.
  const protection = { strict: false, requiredChecks: [], approvals: 0, lastPushApproval: false };
  let found = false;
  for (const rule of ghJson(['api', `repos/${repo}/rules/branches/${encodeURIComponent(def)}`], { allowFail: true }) || []) {
    if (rule.type === 'required_status_checks') {
      found = true;
      protection.strict ||= !!rule.parameters?.strict_required_status_checks_policy;
      protection.requiredChecks.push(...(rule.parameters?.required_status_checks || []).map((c) => c.context));
    }
    if (rule.type === 'pull_request') {
      found = true;
      protection.approvals = Math.max(protection.approvals, rule.parameters?.required_approving_review_count || 0);
      protection.lastPushApproval ||= !!rule.parameters?.require_last_push_approval;
    }
  }
  const classic = ghJson(['api', `repos/${repo}/branches/${encodeURIComponent(def)}/protection`], { allowFail: true });
  if (classic?.url) {
    found = true;
    protection.strict ||= !!classic.required_status_checks?.strict;
    protection.requiredChecks.push(...(classic.required_status_checks?.contexts || []));
    protection.approvals = Math.max(protection.approvals, classic.required_pull_request_reviews?.required_approving_review_count || 0);
  }
  protection.requiredChecks = [...new Set(protection.requiredChecks)];

  let renovateConfig = null;
  for (const path of RENOVATE_CONFIG_PATHS) {
    const raw = ghRaw(repo, path, def);
    if (raw === null) continue;
    try {
      renovateConfig = { path, config: JSON.parse(raw) };
    } catch (err) {
      renovateConfig = { path, error: path.endsWith('5') ? 'JSON5 is not parsed; read it by hand' : err.message };
    }
    break;
  }

  const listing = ghJson(['api', `repos/${repo}/contents/.github/workflows?ref=${encodeURIComponent(def)}`], { allowFail: true });
  let workflows = null;
  if (Array.isArray(listing)) {
    workflows = { maintenance: null, maintenanceCallsShared: false, autoApprove: false, autoApproveTriggersWindow: false, autoMerge: false };
    for (const f of listing.filter((x) => /\.ya?ml$/.test(x.name))) {
      if (!/mainten|approve|merge|depend/i.test(f.name)) continue;
      const body = ghRaw(repo, f.path, def) || '';
      if (/linchpin\/actions\/\.github\/workflows\/maintenance\.yml@/.test(body)) {
        workflows.maintenance = f.path;
        workflows.maintenanceCallsShared = true;
      } else if (/^maintenance\.ya?ml$/.test(f.name) && !workflows.maintenance) {
        workflows.maintenance = f.path;
      }
      if (/linchpin\/actions\/\.github\/workflows\/auto-approve-maintenance\.yml@/.test(body)) {
        workflows.autoApprove = true;
        // The shared job acts on PRs *into* maintenance/*; a caller filtered to main never runs for them.
        const triggers = body.split(/^jobs:/m)[0];
        workflows.autoApproveTriggersWindow = !/branches:/.test(triggers) || /maintenance/.test(triggers);
      }
      if (/linchpin\/actions\/\.github\/workflows\/auto-merge-maintenance\.yml@/.test(body)) workflows.autoMerge = true;
    }
  }

  const securityUpdates = ghJson(['api', `repos/${repo}/automated-security-fixes`], { allowFail: true });

  const fields = [
    'number', 'title', 'author', 'baseRefName', 'headRefName', 'headRefOid', 'labels', 'isDraft',
    'mergeable', 'mergeStateStatus', 'createdAt', 'updatedAt', 'statusCheckRollup', 'body', 'files', 'autoMergeRequest',
  ].join(',');
  // `commits` is left out on purpose: with authors it exceeds GraphQL's node limit on a busy
  // repo. The compare call below returns the same commits for the PRs that need them.
  const rawPrs = ghJson(['pr', 'list', '--repo', repo, '--state', 'open', '--limit', '100', '--json', fields]) || [];

  // How far a bot PR's head lags its base, and who authored the commits it adds.
  const compare = (base, oid) =>
    ghJson(
      ['api', `repos/${repo}/compare/${encodeURIComponent(base)}...${oid}`, '--jq',
        '{behind_by, authors: [.commits[] | (.author.login // .commit.author.name // "")]}'],
      { allowFail: true },
    );

  const prs = rawPrs.map((pr) => {
    const author = pr.author?.login || '';
    const isBot = /renovate|dependabot/.test(normalizeLogin(author));
    const cmp = isBot ? compare(pr.baseRefName, pr.headRefOid) : null;
    return {
      number: pr.number,
      title: pr.title,
      author,
      baseRefName: pr.baseRefName,
      headRefName: pr.headRefName,
      labels: (pr.labels || []).map((l) => l.name),
      isDraft: pr.isDraft,
      mergeable: pr.mergeable,
      mergeStateStatus: pr.mergeStateStatus,
      createdAt: pr.createdAt,
      updatedAt: pr.updatedAt,
      checks: normalizeChecks(pr.statusCheckRollup),
      body: isBot ? pr.body : '',
      files: (pr.files || []).map((f) => f.path),
      autoMerge: !!pr.autoMergeRequest,
      commitAuthors: cmp ? cmp.authors : [],
      behindBy: cmp ? cmp.behind_by : null,
    };
  });

  const refs = ghJson(['api', `repos/${repo}/git/matching-refs/heads/maintenance/`], { allowFail: true }) || [];
  const windows = refs.map((ref) => {
    const name = ref.ref.replace(/^refs\/heads\//, '');
    const cmp = ghJson(['api', `repos/${repo}/compare/${encodeURIComponent(def)}...${encodeURIComponent(name)}`], { allowFail: true });
    const closed = ghJson(['pr', 'list', '--repo', repo, '--state', 'closed', '--head', name, '--limit', '1', '--json', 'number'], { allowFail: true });
    return {
      name,
      closedPr: closed?.[0]?.number ?? null,
      behindBy: cmp ? cmp.behind_by : null,
      aheadCommits: cmp ? (cmp.commits || []).map((c) => ({ oid: c.sha, message: c.commit?.message || '' })) : [],
    };
  });

  // Open Dependabot alerts on the default branch: needs a token that can read them.
  const rawAlerts = ghJson(['api', `repos/${repo}/dependabot/alerts?state=open&per_page=100`], { allowFail: true });
  let alerts = null;
  if (Array.isArray(rawAlerts)) {
    const bySeverity = {};
    let runtimeHighOrCritical = 0;
    for (const a of rawAlerts) {
      const sev = a.security_advisory?.severity || 'unknown';
      bySeverity[sev] = (bySeverity[sev] || 0) + 1;
      if (['high', 'critical'].includes(sev) && a.dependency?.scope === 'runtime') runtimeHighOrCritical++;
    }
    alerts = { count: rawAlerts.length, truncated: rawAlerts.length === 100, bySeverity, runtimeHighOrCritical };
  }

  const renovateRefs = ghJson(['api', `repos/${repo}/git/matching-refs/heads/renovate/`], { allowFail: true });
  const renovateBranches = Array.isArray(renovateRefs) ? renovateRefs.map((r) => r.ref.replace(/^refs\/heads\//, '')) : null;

  // Whether anything guards the window branches themselves (reviews there need auto-approve).
  const current = windows.map((w) => w.name).sort().pop();
  let windowRules = null;
  if (current) {
    const rules = ghJson(['api', `repos/${repo}/rules/branches/${encodeURIComponent(current)}`], { allowFail: true }) || [];
    const pull = rules.find((r) => r.type === 'pull_request');
    windowRules = { branch: current, approvals: pull?.parameters?.required_approving_review_count || 0 };
  }

  return {
    repo,
    fetchedAt: new Date().toISOString(),
    windowRules,
    alerts,
    renovateBranches,
    settings,
    protection: found ? protection : null,
    securityUpdates: securityUpdates && typeof securityUpdates.enabled === 'boolean' ? securityUpdates : null,
    renovateConfig,
    workflows,
    windows,
    prs,
  };
}

// --- CLI ----------------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { repo: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--repo') args.repo = argv[++i];
    else if (a.startsWith('--repo=')) args.repo = a.slice(7);
    else if (a === '--json') args.json = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return args;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
  if (args.help) {
    console.log('Usage: node inventory.mjs [--repo owner/name] [--json]\nRead-only inventory of the dependency-maintenance backlog.');
    return;
  }
  const repo = args.repo || ghJson(['repo', 'view', '--json', 'nameWithOwner'], { allowFail: true })?.nameWithOwner;
  if (!repo) {
    console.error('No repository: pass --repo owner/name, or run inside a clone gh can resolve.');
    process.exit(2);
  }
  const result = classify(fetchData(repo));
  process.stdout.write(args.json ? `${JSON.stringify(result, null, 2)}\n` : `${render(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
