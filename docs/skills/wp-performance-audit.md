---
title: wp-performance-audit
---

An audit is a deliverable, not a diagnosis. The client reads it from the top, decides what to fund from the first page, and asks a few months later whether the money worked. This skill makes the baseline and the follow-up come out in the same shape, whoever runs them and whatever access they have. The baseline file carries its own data, so the follow-up measures exactly the same things.

## When to reach for it

- A client needs a performance or site audit. That's a baseline.
- Changes have shipped since a baseline, and the question is what improved. That's a comparison.
- Measuring two code versions side by side ("did the release help?").
- Turning a reviewed audit into ClickUp tasks.
- "Audit the site for the client", "did the fixes work", "follow-up audit", "measure against the baseline", "how did the release do on PageSpeed", "turn the audit into tickets".

## Where it stops

> **Not this skill:** a quick "why is this page slow", a Lighthouse spot check, accessibility or visual QA. Use [`wp-audit`](wp-audit.md) for those. It also owns the thresholds and evidence rules this skill applies. Fixing what an audit finds is ordinary work, tracked through [`task-tracking`](task-tracking.md).

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Scope and access","content":"<p>Picks the pages and reads the host from the site's headers. For each area, decides whether it can be reached from a local copy, Pressable, WP Engine, SSH, or the public URL alone. Anything out of reach is marked Not checked, with the reason.</p>"},{"title":"Measure the front end","content":"<p>Runs Lighthouse three times per page on mobile and desktop, reports the median-scoring run with its accessibility, best practices and SEO scores, and gets real-user data. Where a cost might belong to tags or a vendor, alternates runs with it blocked to prove whose it is.</p>"},{"title":"Work through the other areas","content":"<p>Hosting and caching (including cache exclusions and the logs behind the error rate, collected first because some hosts keep only days), crawling and bot traffic, plugins, theme, expensive queries, autoloaded options and leftover tables, content metrics, coding standards, security and broken links, all read-only.</p>"},{"title":"Findings and positives","content":"<p>Turns each symptom into a finding with its cause, where it lives, whose it is and the evidence. Collects strengths to the same evidence standard.</p>"},{"title":"Write the baseline","content":"<p>Buckets the recommendations into Critical, Medium and Advanced, then writes the report with what's working well near the top. Ends the file with a hidden data block holding the results.</p>"},{"title":"Compare later","content":"<p>Reads the baseline's data block and re-runs the same pages the same way, with the same Lighthouse version. Marks each page Improved, Worse or Within noise, and re-checks every recommendation against its ClickUp task. Writes what improved first.</p>"},{"title":"Make tasks, if asked","content":"<p>After the user has reviewed the report: searches the client's space for open tasks that already cover each fix, proposes a parent task and one subtask per new item Linchpin owns, confirms the list and the selection, creates them, and writes the keys back into the report.</p>"}]} /-->

## What it checks first

- The site, client and mode, plus any scope the client already approved.
- The host, read from response headers. Then the access available per area: a local copy via [`wp-studio-cli`](wp-studio-cli.md), Pressable via [`wp-pressable`](wp-pressable.md), WP Engine's SSH gateway, other SSH, or the URL alone.
- Whether the project repo is present and which commit is deployed, via [`project-context`](project-context.md).
- Node 18+ and Chrome for the Lighthouse script, a PageSpeed Insights API key if set, and the ClickUp MCP for task statuses and task creation.
- Where the report goes: the root of the site's repo when run inside one, otherwise `~/Documents/Performance-Audits/<site>/`, which it creates itself. Raw evidence goes to a temp directory.
- For a comparison, which baseline to use: the file given, or for a site address, the newest baseline in that site's folder, confirmed with the user first. Then whether the file ends in its data block. Without one, the script reads the baseline's own result tables instead.

## What it owns

Canonical for: the baseline and comparison reports and their order (positives first), what each area checks and reports, running an audit without a local copy (including WP Engine's SSH gateway), the Critical / Medium / Advanced buckets, the Lighthouse run-and-reduce method and the data block, the noise rule for "improved", and turning an audit into tasks. Core Web Vitals bands, evidence labels and "no fixes during an audit" come from [`wp-audit`](wp-audit.md).

## Guardrails

- Never present local numbers as production, or compare across environments or Lighthouse versions without saying so.
- A change inside the noise rule is reported as within noise, never as an improvement.
- Never claim a check ran when it didn't. Write "Not checked" with the reason.
- Never invent positives, history, causes or estimates.
- Never edit the data block by hand.
- Never fix anything during the audit. It's the baseline the fixes get measured against.
- Raw evidence (Lighthouse JSON, crawl output, traces) stays out of the repo.
- Nothing leaves the session unreviewed: no report goes to the client, and no task gets created, before the user has read it and confirmed the destination.
- Existing ClickUp work is read-only: no edits, status moves, comments or deletions on anything the skill didn't create.
- An accessibility score is Lighthouse's automated checks, never an accessibility audit or a WCAG claim.

<!-- wp:docspress/callout {"tone":"warning","title":"Read-only on live sites","content":"<p>Every command against staging or production is a read. No installs, updates, deletes, cache flushes or settings changes, and never <code>wp config list</code>, which prints secrets. Crawls run at low concurrency, after telling the user, and a firewall block is reported rather than worked around.</p>","collapsible":false} /-->

## Done when

- [ ] Mode, site, pages and environment are stated, and every area has results or "Not checked" with a reason.
- [ ] Lab numbers come from the script: 3 runs per page per form factor, reusing the baseline's settings in a comparison.
- [ ] Every finding has its effect, cause, location, owner, evidence, fix, and impact and effort.
- [ ] Positives come first: "What's working well" in a baseline, "What improved" in a comparison.
- [ ] In a comparison, every baseline recommendation has a re-checked status.
- [ ] The report ends with a data block and has no placeholders, secrets or internal notes.
- [ ] The user reviewed the report before anything left the session.
- [ ] Any tasks are in the confirmed list, with their keys in the report.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/wp-performance-audit/SKILL.md) is the skill's main instructions.
- [`references/access.md`](https://github.com/linchpin/skills/blob/main/skills/wp-performance-audit/references/access.md) — how to reach the site in each mode (local, Pressable, WP Engine, SSH, URL only), and what's read-only.
- [`references/checks.md`](https://github.com/linchpin/skills/blob/main/skills/wp-performance-audit/references/checks.md) — what each audit area answers, how to measure it, and what goes in the report.
- [`references/report-template.md`](https://github.com/linchpin/skills/blob/main/skills/wp-performance-audit/references/report-template.md) — the baseline and comparison templates, the buckets, the client-writing rules and the data block's measures.
- [`scripts/lighthouse-runs.mjs`](https://github.com/linchpin/skills/blob/main/skills/wp-performance-audit/scripts/lighthouse-runs.mjs) — repeated Lighthouse runs reduced to report tables, plus embedding the data block and comparing against a baseline. Zero dependencies; needs Node 18+ and Chrome.
- [`scripts/lighthouse-runs.test.mjs`](https://github.com/linchpin/skills/blob/main/skills/wp-performance-audit/scripts/lighthouse-runs.test.mjs) — tests for the reduction, the data block, the table fallback and the noise rule, with no network access.

Pre-approved, so the agent can run them without a prompt: reading and searching files, the Lighthouse script, `curl -sSI`, `git grep`/`log`/`show`, and the WP-CLI reads `wp core version`, `wp plugin list`, `wp theme list`, `wp post list`, `wp db size` and `wp cache type`. Crawls, database queries and anything that writes still ask.

## Related skills

- [`wp-audit`](wp-audit.md) — the quick in-session check; owns the thresholds and evidence rules this skill applies.
- [`task-tracking`](task-tracking.md) — creates the tasks, routes them to a list and reads back their keys.
- [`task-closeout`](task-closeout.md) — closes tasks; a comparison only reads their status.
- [`engagement-types`](engagement-types.md) — decides which space and folder follow-up work belongs in.
- [`browser-automation`](browser-automation.md) — the DevTools trace for the deep dive on the worst page.
- [`wp-pressable`](wp-pressable.md) — server access on Pressable.
- [`wp-studio-cli`](wp-studio-cli.md) — server access on a local Studio copy.
- [`project-context`](project-context.md) — the repo's shape and what's deployed.
- [`quality-gates`](quality-gates.md) — runs a repo's own PHPCS configuration when it has one.
- [`security-updates`](security-updates.md) — fixes the dependency advisories an audit reports.
- [`../upstream.md`](../upstream.md) (`wp-performance`) — owns profiling technique for queries and autoload.
