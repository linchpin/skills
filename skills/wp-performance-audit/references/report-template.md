# Report templates

Two deliverables:
- **Baseline audit:** covers every area and records the starting point.
- **Comparison:** re-measures later against a baseline and shows what improved. The same template, cut down to its lab sections, also serves the `versions` mode, which compares two code versions side by side.

Copy the one you need and replace every `<…>`. A section with nothing to say keeps its heading
with one line explaining why, so the reader can tell "fine" from "not checked". Both reports
end with a hidden data block (see [The data block](#the-data-block)), which is what makes the
next comparison possible.

The order follows the audits Linchpin has delivered (executive summary, positives, scope,
findings, recommendations, plan, measuring success), with the per-area detail moved after the
action plan. A client reads from the top and stops when they have enough. So **what's working
comes first**, then what to do, and the evidence comes last for whoever wants it.

## Writing for the client

- **Lead with what's good, and earn it.** Every positive carries a number or a fact, the same as a finding: "Layout shift is 0.02 for real users, well inside Google's 'good' limit", not "the site is well built". Fewer, real positives beat padded ones. Positives also lead the executive summary.
- **Plain words, defined once.** FCP, LCP, TBT, Speed Index, CLS, INP and TTFB are defined in Scope and methodology, then used freely. Each number gets a unit, and each table names its environment.
- **Say whose each problem is**: Linchpin (in or out of the approved scope), the client, a named third party, the host, or the content owner. Owners are roles (BE, FE, DevOps, Content), never people.
- **Credit honestly.** When numbers improved across several releases or teams, say so. Don't hand everything to the latest Linchpin change.
- **Label every claim's evidence**: measured, inspected or observed, per [`wp-audit`](../../wp-audit/SKILL.md).
- **No internal notes.** Pricing, blame and "we should upsell" stay out. The report goes to the client as written.
- Sentence-case headings, no emoji status icons, and no section numbers that can drift. If the `humanizer` skill is installed, run it over the prose last.

## Buckets

Each recommendation gets an **Impact** (High / Medium / Low: the effect on visitors or the
business) and an **Effort** (Low / Medium / High). The bucket follows from both:

| Bucket | Rule | Shown in the executive summary as |
| --- | --- | --- |
| **Critical** | High impact at low or medium effort, or anything broken, insecure or serving wrong code. Low-effort items here are the quick wins, each about an hour or less | Critical (weeks 1–2) |
| **Medium** | Medium impact, or high impact at medium effort that depends on a Critical item | Medium (weeks 3–4) |
| **Advanced** | High effort: rebuilds, architecture, platform or vendor changes, whatever its impact | Advanced |

## The data block

The last thing in every report is an HTML comment written by the script. It doesn't show
when the Markdown is rendered, and a later comparison reads it to reuse the baseline's pages,
run count, form factors and exact Lighthouse version. Never write or edit it by hand:

```bash
node <skill-dir>/scripts/lighthouse-runs.mjs embed <report.md> <scratch>/lh/<label>/summary.json --metrics <scratch>/metrics.json
```

Embed the normal run, never a `--block` attribution run. `metrics.json` holds everything else
the audit measured that a comparison should track:

```json
{ "measures": [
  { "key": "autoload.kb", "label": "Autoloaded options", "value": 912, "unit": "KB", "better": "lower" }
] }
```

`key` is what the comparison matches on, so a follow-up must reuse the baseline's keys
exactly. Record whichever of these the audit actually measured. Leave out the rest, because
a missing key reads as "not measured", which is honest:

| Key | Measure | Better |
| --- | --- | --- |
| `field.lcp:<path>`, `field.inp:<path>`, `field.cls:<path>`, `field.ttfb:<path>` | Real-user p75 for a page, mobile (`<path>` is `/`, `/contact/`, …; `origin` for origin-level) | lower |
| `cache.hit_ratio` | Page cache hit ratio from the host dashboard, % | higher |
| `errors.rate`, `latency.avg_ms` | Error rate (%) and average page latency (ms) from the host dashboard | lower |
| `bots.share` | Share of requests from bots in the access logs, % | lower |
| `ttfb.cold_ms` | TTFB of an uncached request, ms | lower |
| `plugins.active`, `plugins.updates` | Active plugins, plugins with updates pending | lower |
| `autoload.kb`, `transients.expired` | Autoloaded options size, expired transients | lower |
| `tables.leftover` | Tables belonging to no active plugin | lower |
| `db.mb`, `revisions` | Database size, revision count | lower |
| `wpcs.errors`, `wpcs.security` | WPCS errors, of which security sniffs | lower |
| `security.headers_missing` | Recommended security headers missing | lower |
| `links.broken` | Broken links found | lower |

---

## Baseline audit

File it as `PERFORMANCE-AUDIT-<YYYY-MM-DD>.md`.

````markdown
# <Site name> performance audit

- Prepared for: <client>
- Prepared by: Linchpin
- Date: <YYYY-MM-DD>
- Site: <production URL> (<host>, <CDN if any>)
- Measured on: <production | staging | local copy of production, DB from YYYY-MM-DD>
- Code reviewed: <repo>, <tag or branch> at `<short sha>` | not available
- Previous audit: <title, date> | none

## Executive summary

<Written last. One paragraph of 4–6 sentences. Start with what the site does well (the
strongest two positives), then the main reasons it's slow and whose they are, then what the
Critical items should achieve, stated as a measurable target.>

**Top recommendations at a glance**

- **Critical (weeks 1–2):** <2–4 items, plain words>
- **Medium (weeks 3–4):** <2–4 items>
- **Advanced:** <larger initiatives, or "none needed">

## What's working well

- **<Bold lead phrase>.** <The evidence: number, source, environment.>
- **<…>.** <…>
- **<…>.** <…>

<3–6 bullets. Cover strengths from different areas: real-user metrics that pass, hosting and
caching that work, a maintained plugin set, clean code, sound information architecture, and
on a re-audit, gains since last time.>

## Site background

<Who built the site and when, the stack (theme type, builder, key plugins), how Linchpin came
to it, and the technical debt that came with it. One or two paragraphs.>

## Scope and methodology

| Area | Checked | How | Notes |
| --- | --- | --- | --- |
| PageSpeed and Lighthouse | Yes | Lighthouse <version> locally, 3 runs per page, mobile and desktop: performance, plus accessibility, best practices and SEO scores | <…> |
| Real-user data (CrUX) | <Yes / Partly / No> | <PSI API / PageSpeed UI> | <URLs without data> |
| Hosting and caching | <…> | <headers from the URL; WP-CLI over SSH; host dashboard; logs> | <…> |
| Crawling and bot traffic | <…> | <robots.txt and URL spaces from the URL; access logs; Search Console> | <…> |
| Plugin footprint | <…> | <…> | <…> |
| Theme footprint | <…> | <…> | <…> |
| Expensive queries | <…> | <…> | <…> |
| Options, autoload and leftover tables | <…> | <…> | <…> |
| Content metrics | <…> | <…> | <…> |
| Code standards (WPCS) | <…> | <…> | <…> |
| Security (passive review) | <…> | <…> | <…> |
| Broken links | <…> | <…> | <…> |

<For any "No": "Not checked: <reason, and the access that would close it>".>

**Pages measured**

| Page | URL | Why it's included |
| --- | --- | --- |
| Homepage | `/` | Most visited |
| <…> | <…> | <template, uncached, slowest reported, …> |

**Terms used in this report.** FCP (First Contentful Paint) is when the first content
appears. LCP (Largest Contentful Paint) is when the main content, usually the hero image, has
loaded. TBT (Total Blocking Time) is how long scripts stop the page from responding during
load. Speed Index is how quickly the visible page fills in. CLS (Cumulative Layout Shift) is
how much the layout jumps. INP (Interaction to Next Paint) is how quickly the page responds to
a tap or click, for real users. TTFB (Time to First Byte) is how long the server takes to
start answering. "Lab" numbers come from a simulated device. "Field" numbers are real Chrome
users over the last 28 days.

<Environment notes: what differs from production, and that lab TBT varies run to run.>

## Key findings

<Numbered, highest impact first. 5–10 findings. The long tail goes in Detailed results.>

### 1. <What's wrong, in plain words>

- **Effect:** <what visitors or editors experience, with the measured number>
- **Cause:** <the mechanism>
- **Where it lives:** <`file:line`, plugin and setting, third-party account, host setting>
- **Whose:** <Linchpin, in scope | Linchpin, outside the approved scope | Client | Third party: <vendor> | Host | Content owner>
- **Evidence:** <Measured | Inspected | Observed>: <tool, page, date>
- **Fix:** <the concrete change>
- **Impact / Effort:** <High / Low>

## Recommendations by effort and impact

| # | Recommendation | Impact | Effort | Owner | Whose | Bucket | Task |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | <imperative: "Defer the theme scripts in `<head>`"> | High | Low | FE | Linchpin, in scope | Critical | <key, once created> |

<Quick wins (Critical, low effort) first, then the rest of Critical, Medium and Advanced. The
Task column stays empty unless tasks were created.>

## Implementation plan

| Phase | Weeks | Items | Done when |
| --- | --- | --- | --- |
| Critical | 1–2 | <# from the table> | <re-measured result, e.g. "mobile LCP on the homepage under 4 s in the lab"> |
| Medium | 3–4 | <…> | <…> |
| Advanced | <5+> | <…> | <…> |

<Leave this section out of a re-audit when the client approved only a subset. Say which
subset in Scope instead.>

## Measuring success

| Metric | Now | Target | Measured with |
| --- | --- | --- | --- |
| Mobile LCP (field, p75) | <…> | ≤ 2.5 s | CrUX |
| Mobile INP (field, p75) | <…> | ≤ 200 ms | CrUX |
| CLS (field, p75) | <…> | ≤ 0.1 | CrUX |
| Lab score, key pages | <range> | <target> | Lighthouse, same pages and method as this report |
| <server target, e.g. page cache hit ratio> | <…> | <≥ 85%> | <host dashboard> |
| <Lighthouse category average, e.g. Accessibility> | <…> | ≥ 90 | Lighthouse, same method |

**Ongoing monitoring.** <What reviews these numbers today, if anything, and what to set up:
which metrics, targets, who looks and how often, typically monthly.>

<Re-measure with the same pages, the same script and the same environment. Field data moves
over 28 days, so check it a month after deploys.>

## Detailed results

### PageSpeed and Lighthouse

<Mobile table, then desktop table, from `summary.md`. One line on how the representative run
was chosen. Then the field data table:>

| Page | LCP | INP | CLS | TTFB | Core Web Vitals |
| --- | --- | --- | --- | --- | --- |
| <…> | <…> | <…> | <…> | <…> | <Pass / Fails on …> |

<Deep dive on the homepage or worst page: LCP element, LCP breakdown, render-blocking
requests, top third parties by main-thread time.>

<The Lighthouse category scores table (with its average) from `summary.md`. Then, for each
category under 90, the failing audits with the pages they fail on and whose they are. One
line saying these are automated checks, not an accessibility audit.>

<Include the next block only when mobile is far below desktop:>

**Why mobile scores are so much lower.** The pages are identical on both tests. What changes
is the device Lighthouse simulates:

| Setting | Mobile test | Desktop test |
| --- | --- | --- |
| Processor | 4× slower (a mid-range phone) | Full speed |
| Download speed | 1.6 Mbps (slow 4G) | 10 Mbps |
| Delay per request | 150 ms | 40 ms |
| Screen width | 412 px | 1,350 px |

At 1.6 Mbps each megabyte takes about 5 seconds, and each second of script work on desktop
takes about 4 on mobile, so anything heavy on desktop becomes the main cost on mobile. Real
phones usually do better than this stress test, which is why the field data above matters
more.

### Hosting and caching

<Host and CDN, cache behavior (HIT/MISS, cache key and query strings), cache exclusions for
personal pages, TTFB cold and warm, compression, PHP and WordPress versions, object cache,
cron, stale assets at the edge, host dashboard numbers with their date range. If the error rate
is over target, the breakdown by status and URL pattern from the logs.>

### Crawling and bot traffic

<The share of requests from bots, the top bot user agents, the URL spaces they crawl (search,
calendars, translations, filters), and which controls each one lacks: robots.txt, noindex or
nofollow, host or CDN bot rules, rate limiting. Search Console's indexing and crawl numbers
where available.>

### Plugins

| Plugin | Version | Status | Last updated | Impact | Verdict |
| --- | --- | --- | --- | --- | --- |
| <…> | <…> | <Active / Inactive / Must-use> | <date, or "closed on wordpress.org"> | <Very low … High> | <Keep / Configure / Replace / Remove> |

<Custom plugins first. Then a short card for each plugin with Medium or higher impact.>

### Theme

<Shape, assets with raw and compressed sizes, render-blocking files, unused share and on
which page, enqueue and versioning problems, build problems, unused templates.>

### Expensive queries

#### <Short name>

- **Where:** `<file:line>`, `<function()>`. Runs on <front end / admin / both>.
- **What it does:** <one line, plus a 3–8 line snippet if it helps>
- **Impact:** <…> · **Risk:** <High / Medium / Low>
- **Fix:** <…>

### Options, autoload and leftover tables

<Autoloaded total in KB against the 800 KB Site Health threshold, the top options and their
owners, derelict options, expired transients, leftover tables with their sizes.>

### Content metrics

| Content | Count | Reading |
| --- | --- | --- |
| <post type> | <…> | <…> |
| Revisions | <…> | <…> |
| Media | <count, uploads size> | <…> |
| Orphaned post meta | <…> | <…> |
| Database size | <…> | <…> |

### Code standards (WPCS)

<Errors and warnings per component, security sniffs separately, PHP-compatibility blockers.>

### Security

<Updates pending, integrity checks, the vulnerability database used (or "not checked
against one"), administrator count, public surface, security headers, code stored in the
admin. Passive review only. Say so.>

### Broken links

| Broken link | Status | Found on |
| --- | --- | --- |
| <…> | <404> | <page> |

## Risks and dependencies

<Changes that need the client, a vendor or the host. Changes that could break something, and
how they'll be tested and rolled back.>

## What this audit didn't cover

- <Areas not checked and why, templates not measured, single runs vs medians, data not retrieved.>

<The data block comes last, written by `embed`.>
````

---

## Comparison against a baseline

File it as `PERFORMANCE-COMPARISON-<YYYY-MM-DD>.md`. The client wants to know whether the work
paid off, so **what improved comes first**, then what's left. "Within noise" is said plainly,
never dressed up as a gain.

````markdown
# <Site name> performance comparison: <baseline date> → <today>

- Prepared for: <client>
- Prepared by: Linchpin
- Date: <YYYY-MM-DD>
- Baseline: <PERFORMANCE-AUDIT-YYYY-MM-DD.md>, measured <date>
- Measured on: <the same environment as the baseline, or the difference stated plainly>
- Changes since the baseline: <releases, PRs, tasks completed, and changes by others: tags, host, content>

## Summary

<4–6 bullets. The clearest gains first, with numbers ("Homepage mobile LCP 16.2 → 8.4 s").
Then how many pages held steady within noise. Then anything that got worse. Last, the biggest
item still open.>

## What improved

- **<Bold lead phrase>.** <Before → after, which change caused it, evidence.>

<Every bullet ties a measured gain to a change. A gain with no change behind it is reported as
unexplained, and a gain caused by someone else's change is credited to them.>

## Results

### Lab (Lighthouse)

<The tally lines and tables from `lighthouse-runs.mjs compare`, with its definition of
"Improved". Then one line defining FCP, LCP, TBT and Speed Index.>

### Real users (CrUX)

<From the "Other measures" rows with `field.*` keys, as a table: page, metric, baseline,
now. Field data is a 28-day window, so say when a change shipped too recently to show in it
fully.>

### Other measures

<The rest of the "Other measures" table: autoload, plugins, database, broken links and so on.>

## Recommendations from the baseline

| # | Recommendation | Task | Task status | Status now | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | <from the baseline's table> | <key, or none> | <ClickUp status, read-only> | <Done / Done, not live / Partly done / Not started / Can't tell> | <the re-check that shows it> |

<Status comes from re-checking the finding, not from the task. When a task is marked complete
but the fix isn't live, say so: that's a finding in its own right.>

## What's left

<The open recommendations, in the baseline's bucket order, updated with anything learned
since. Mark each "in scope" or say whose it is.>

## New since the baseline

<Regressions and new problems noticed during this run, each with the same fields as a
baseline finding. "None found" is a valid answer, but this isn't a full re-audit. If a lot has
changed, recommend a new baseline.>

## How this was measured

<Same pages, runs, presets and Lighthouse version as the baseline (pinned from its data
block), or each difference stated. What differs from production, if it's a local copy.
Anything that couldn't be re-measured, and why.>

<The data block comes last, written by `embed`, so this report can serve as a comparison
point too.>
````

**`versions` mode** (two code versions on one environment, lab only). Use the same template
with Summary, What improved, the Lab results, "What's still slow" (causes, numbered) and Next
steps. Drop the baseline, task and real-user sections. File it as
`PAGE-SPEED-<YYYY-MM-DD>-<before>-vs-<after>.md`. When mobile is far below desktop, add the
"Why mobile scores are so much lower" block from the baseline template, plus a per-page table:
LCP mobile / desktop, script time mobile / desktop, page weight.
