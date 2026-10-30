---
name: wp-performance-audit
description: Produce Linchpin's client-facing WordPress performance audit as Markdown. A baseline audit leads with positives, then findings and an action plan, across PageSpeed, Core Web Vitals, hosting, bot traffic, plugins, theme, queries, autoload, content, WPCS, security and broken links, from a local copy, Pressable, WP Engine or the URL alone. A later comparison re-measures against that baseline file and shows what improved. --tasks turns findings into ClickUp tasks. Use when asked for a performance or site audit, a baseline, a follow-up on what improved after changes, a page speed comparison of two releases, or tasks from an audit. Not for a quick "why is this page slow" check — use `wp-audit`.
when_to_use: Also when someone says "audit the site for the client", "did the fixes work", "follow-up audit", "measure against the baseline", "how did the release do on PageSpeed", "turn the audit into tickets", or picks up a task from a performance audit template list in ClickUp.
version: 0.1.0
allowed-tools: Read Grep Glob Bash(node *scripts/lighthouse-runs.mjs*) Bash(curl -sSI *) Bash(git grep*) Bash(git log*) Bash(git show*) Bash(wp core version*) Bash(wp plugin list*) Bash(wp theme list*) Bash(wp post list*) Bash(wp db size*) Bash(wp cache type*)
---

# WordPress performance audit

An audit is a deliverable, not a diagnosis. The client reads it from the top, decides what to
fund from the first page, and asks a few months later whether the money worked. This skill
makes the baseline and the follow-up come out in the same shape, whoever runs them and
whatever access they have. The baseline file carries its own data, so the follow-up measures
exactly the same things.

## When to use

- A client needs a performance or site audit. That's a baseline.
- Changes have shipped since a baseline, and the question is what improved. That's a comparison.
- Measuring two code versions side by side ("did the release help?"). That's versions mode.
- Turning a reviewed audit into ClickUp tasks (`--tasks`).

**Not this skill:** a quick "why is this page slow", a Lighthouse spot check, accessibility
or visual QA. Use [`wp-audit`](../wp-audit/SKILL.md) for those. It also owns the thresholds and evidence
rules this skill applies. Fixing what an audit finds is ordinary work, tracked through
[`task-tracking`](../task-tracking/SKILL.md).

## Owns

Canonical for: the baseline and comparison reports and their order (positives first), what
each area checks and reports, running an audit without a local copy (including WP Engine's SSH
gateway), the Critical / Medium / Advanced buckets, the Lighthouse run-and-reduce method and
the data block in `scripts/lighthouse-runs.mjs`, the noise rule for "improved", and turning an
audit into tasks.

Defers:
- Core Web Vitals bands, evidence labels, and "no fixes during an audit" → [`wp-audit`](../wp-audit/SKILL.md)
- Traces and screenshots → [`browser-automation`](../browser-automation/SKILL.md)
- Pressable access → [`wp-pressable`](../wp-pressable/SKILL.md)
- Studio → [`wp-studio-cli`](../wp-studio-cli/SKILL.md)
- Repo shape → [`project-context`](../project-context/SKILL.md)
- Profiling technique → upstream `wp-performance`
- A repo's own PHPCS config → [`quality-gates`](../quality-gates/SKILL.md)
- Fixing dependency advisories → [`security-updates`](../security-updates/SKILL.md)
- Creating tasks, routing and key read-back → [`task-tracking`](../task-tracking/SKILL.md)
- Closing tasks → [`task-closeout`](../task-closeout/SKILL.md)
- Which space or folder → [`engagement-types`](../engagement-types/SKILL.md)

## Arguments

| Argument | Does |
| --- | --- |
| *(none)*, `baseline`, or `full` | The baseline audit: every area, ending in a data block |
| `compare <baseline.md \| site URL>` | Re-measures what the baseline measured, re-checks its recommendations, and reports what improved. Given a URL, it uses the newest baseline in that site's output folder |
| `versions <before> <after>` | Two code versions (tags, branches, releases) on one environment, lab only |
| `--tasks` | After the user reviews the report, create ClickUp tasks: from the recommendations (baseline), or for regressions and new issues (compare) |
| `--pages <file>` | Use this URL list (`Name \| URL` per line). Baseline only, because compare reuses the baseline's pages |

Plain requests map onto these: "audit example.com and make tickets" is `baseline --tasks`, and
"what improved on example.com since the October audit?" is `compare https://example.com`.

## Preflight

| Establish | How | If missing |
| --- | --- | --- |
| Site, client, mode | From the request. Otherwise ask once with `AskUserQuestion`, including the pages and any scope the client approved | Don't measure without the production URL |
| Access per area | [`references/access.md`](references/access.md): read the host from headers, then choose local, Pressable, WP Engine, SSH or URL only | Run the URL-only areas and mark the rest "Not checked: <reason>" |
| Code | Is the project repo here? [`project-context`](../project-context/SKILL.md). Which tag or commit is deployed? | Inspect what's deployed over SSH, or mark the code areas "Not checked" |
| Tools | Node ≥ 18 and Chrome for the script. `PSI_API_KEY` for the PageSpeed API. The ClickUp MCP for task statuses and `--tasks` | Say what's missing and what it costs. Local Lighthouse stands in for PSI, and the PageSpeed web UI for field data |
| Output folder | Inside a git repo holding the site's code: its root. Anywhere else: `~/Documents/Performance-Audits/<host>/`, where `<host>` is the domain without `www.`. Create the folder if it's missing, so nobody has to make one first. Evidence goes in a temp directory (`$TMPDIR`, written `<scratch>` below), never in the output folder | If `~/Documents` doesn't exist, ask once where reports should go |
| Baseline (compare) | A path, or for a URL the newest `PERFORMANCE-AUDIT-*.md` in that site's output folder. Confirm the file you found before measuring. Does it end in a `wp-performance-audit:data` block? | Nothing found: ask for the file. No block: the script falls back to its own tables. For a report this skill didn't write, carry the numbers across by hand and say so |

## Procedure: baseline

1. **Scope it.** Write `urls.txt` (the pages, chosen per [`references/checks.md`](references/checks.md)),
   and decide the access mode for each area. With host access, collect the access and error logs
   **now**, because some hosts keep only a few days of them (WP Engine about two). → The Scope
   table is drafted. Every area has a mode or "Not checked: <reason>", and the logs are saved
   or their absence is noted.
2. **Measure the front end.**
   `node <skill-dir>/scripts/lighthouse-runs.mjs run --urls urls.txt --label production --out <scratch>/lh/baseline`.
   Then get field data and a DevTools trace of the homepage or worst page. Run `--block`
   attribution runs, into their own `--out`, wherever ownership of a cost is unclear.
   → `summary.md` exists, and field data is recorded or its absence explained.
3. **Work through the other areas** in [`references/checks.md`](references/checks.md),
   read-only. Put each number a follow-up should track into `metrics.json`, using the keys in
   [`references/report-template.md`](references/report-template.md#the-data-block). → Each area
   has results or a "Not checked" line, and `metrics.json` holds what was measured.
4. **Turn symptoms into findings.** Each one needs Effect, Cause, Where it lives, Whose,
   Evidence, Fix and Impact / Effort. → No finding is missing a field, and every number names
   its environment.
5. **Collect positives as you go**, with the same evidence standard. → 3–6 evidenced
   positives, or a stated reason for fewer.
6. **Bucket the recommendations** into Critical, Medium and Advanced by the template's rules.
   → Every finding has a row with Impact, Effort, Owner, Whose and Bucket.
7. **Write `PERFORMANCE-AUDIT-<YYYY-MM-DD>.md`** in the output folder, from the baseline template. "What's working
   well" goes directly after the executive summary, and the summary is written last. Then embed
   the data:
   `node <skill-dir>/scripts/lighthouse-runs.mjs embed <report> <scratch>/lh/baseline/summary.json --metrics metrics.json`.
   → The report ends with a data block. Running `grep -nE '<(…|[a-z][a-z ,/|.-]*)>' <report>`
   leaves only real markup (such as `<head>`), with no template placeholders.
8. **Hand it to the user**: the path, a five-line summary, and the "Not checked" list. Nothing
   goes to the client or to ClickUp before they've read it. → The user has reviewed it.

## Procedure: compare against a baseline

1. **Read the baseline.** Note its pages, environment, the measure keys in its data block, and
   its recommendations table, including task keys. → You have a list of what to re-measure and
   re-check.
2. **Re-run the lab measurement exactly.**
   `node <skill-dir>/scripts/lighthouse-runs.mjs run --baseline <baseline.md> --label <environment> --out <scratch>/lh/followup`.
   This reuses the baseline's pages, run count and form factors, and pins its exact Lighthouse
   version. Use the baseline's environment. If you can't, say so, and don't present the
   differences as improvements. → `summary.json`, with the stderr line confirming what was reused.
3. **Re-collect every measure** under the same keys, with the same commands from
   [`references/checks.md`](references/checks.md), into a new `metrics.json`. Field data covers
   28 days, so a change shipped more recently shows only partly. → Same keys as the baseline,
   and any missing ones explained.
4. **Re-check each baseline recommendation** by repeating the check that found it (a header,
   an asset hash, a grep, a query). Status is Done, Done but not live, Partly done, Not
   started, or Can't tell. Where the baseline has task keys, read their ClickUp status
   (`clickup_get_task`, read-only) and show it beside the measured status. → Every
   recommendation has a status and evidence.
5. **Compare.**
   `node <skill-dir>/scripts/lighthouse-runs.mjs compare <baseline.md> <scratch>/lh/followup/summary.json --metrics metrics.json`
   → Tallies and tables with Improved, Worse or Within noise per page, and an "Other measures"
   table, with no version warning.
6. **Explain the moves.** Tie each Improved or Worse result to a change shipped since the
   baseline (releases, PRs, tasks), or to someone else's change (tags, host, content). Mark it
   unexplained when you can't. Note any new problem seen along the way. → Each moved page
   has a cause or "unexplained".
7. **Write `PERFORMANCE-COMPARISON-<YYYY-MM-DD>.md`** next to the baseline, from the comparison template, with what
   improved first, then `embed` this run's data into it the same way. → Data block present,
   no placeholders.
8. **Hand off** as in step 8 of the baseline.

## Procedure: versions

1. **Measure both versions the same way**: one environment, one URL list (reuse the last
   audit's list), and one Lighthouse version. For a local copy, check out `<before>`, build
   the assets if compiled output isn't committed, clear caches, and run with `--label <before>`.
   Then do the same for `<after>`. → Two `summary.json` files.
2. `node <skill-dir>/scripts/lighthouse-runs.mjs compare <before>/summary.json <after>/summary.json`
   → Tables with no version warning.
3. **Explain the big moves** from the raw reports or a trace, then write the report as the
   template's `versions` note describes. Hand off for review.

## Making tasks (`--tasks`)

Only after the user has reviewed the report.

1. **ClickUp MCP connected?** If not, say so. The report still stands.
2. **Destination.** Resolve the list through `task-tracking`'s creation flow (`.clickup.json`
   routing, otherwise a scoped picker). Use `engagement-types` for the space: follow-up work is
   usually a scoped project or site maintenance, not the audit template list. Confirm the list by
   name.
3. **Propose.** For a baseline: one parent task, `Performance audit follow-ups: <site> (<date>)`,
   with a subtask per recommendation whose Whose is Linchpin. For a comparison: subtasks only for
   regressions, new issues, and open recommendations that have no task yet, under the existing
   parent. Items owned by the client, a vendor or the host go in the parent's description under
   "Owned by others". Show the proposal as a table (name, bucket, priority), and confirm once:
   all, Critical only, or let me pick.
4. **Don't duplicate open work.** Before proposing, search the client's whole space for open
   tasks that cover the same fix, not just the same name (`clickup_search` with the fix's key
   terms, scoped to the space). Clients often have tasks left from an earlier audit. In the
   proposal, mark each item "covered by <key>" or "new", and create only the new ones.
   Existing tasks are never edited, moved or commented on from here.
5. **Create.** The name is the recommendation, in the imperative. Set priority from Impact
   (High → high, Medium → normal, Low → low). Anything broken, insecure or serving the wrong
   code is urgent. Set `time_estimate` only for quick wins (60 minutes). Never invent other
   estimates. Use this description:

   ```markdown
   **Finding:** <one line> (report: <file>, Key findings #<n>)
   **Evidence:** <measured value, page, environment, date>
   **Where:** <file:line, setting, or account>
   **Fix:** <the change>
   **Done when:** <re-measured result, same method, e.g. "homepage mobile LCP ≤ 4 s across 3 lab runs">
   ```

6. **Read back each key** with `clickup_get_task` and write it into the report's Task column.
   Never change an existing task's status from here. Closing belongs to `task-tracking` and
   `task-closeout`. → Every task you created is in the report with its key.

## Guardrails

- **Read-only on staging and production.** [`references/access.md`](references/access.md) lists
  what's allowed. Never install Query Monitor, profilers or WP-CLI packages on a live site
  without explicit approval for that action.
- **Secrets never reach the transcript or the report.** Never run `wp config list`. Read
  single constants by name.
- **The load is real.** Lighthouse runs one at a time (the script does this). Crawls run at
  low concurrency, off-peak, after telling the user. A WAF block is a result, not an obstacle
  to route around.
- **Comparable or not at all.** Never present local numbers as production, and never compare
  across environments or Lighthouse versions without saying so (the script warns). A move
  inside the noise rule is "within noise", never an improvement.
- **Never claim a check ran when it didn't.** Write "Not checked: <reason>". Never invent
  positives, history, causes or estimates. Fewer evidenced bullets beat padding.
- **Never edit the data block by hand**, and never embed a `--block` attribution run. Only
  `embed` writes it.
- **Never fix anything during the audit.** The audit is the baseline the fixes get measured
  against.
- **Raw evidence stays out of the repo**: Lighthouse JSON, crawl CSVs and traces. Don't commit
  the report to a client repo unless asked.
- **Nothing leaves the session unreviewed.** No report goes to the client, and no task gets
  created, before the user has read it and confirmed the destination.
- **Existing ClickUp work is read-only.** Reading lists, tasks and docs for context is fine.
  Changing them isn't: no edits, status moves, comments or deletions on anything this skill
  didn't create in this session.

## Done

- [ ] Mode, site, pages and environment are stated, and the Scope table (baseline) covers every area, with "Not checked: <reason>" where needed.
- [ ] Lab numbers come from the script: 3 runs per page per form factor, or the reduced count stated. In compare, the run reused the baseline's settings via `--baseline`.
- [ ] Every finding has Effect, Cause, Where it lives, Whose, Evidence, Fix and Impact / Effort.
- [ ] Positives come first: "What's working well" in a baseline, "What improved" in a comparison, and each one is evidenced.
- [ ] In compare, every baseline recommendation has a re-checked status, with task status shown where a task exists.
- [ ] The report ends with a data block written by `embed`. It has no template placeholders, secrets or internal notes.
- [ ] The user reviewed the report before anything left the session.
- [ ] With `--tasks`: the tasks are in the confirmed list, and their keys are read back and in the report.
