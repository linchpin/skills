# Checks by area

One section per area of the audit, in report order. Each says what the area answers, how to
measure it in each access mode ([`access.md`](access.md)), and what goes in the report.
Commands are **reads**. `<prefix>` is the table prefix from `wp db prefix`. `<paths>` is the
custom code only (the theme and Linchpin or client plugins), never `vendor/`, `node_modules/`
or third-party plugins.

Core Web Vitals bands and evidence labels come from [`wp-audit`](../../wp-audit/SKILL.md).
Profiling technique (`wp profile`, Query Monitor headless, Server-Timing) is in the upstream
`wp-performance` skill's references. This file says what an audit collects and how to report
it, not how to tune.

---

## PageSpeed and Lighthouse

**Answers:** how fast the key pages load for a visitor, on mobile and desktop, in the lab and
for real users.

**Pages.** The homepage at minimum, plus the templates that matter for this kind of site:

| Site type | Add |
| --- | --- |
| Ecommerce | Category or catalog, product, cart, checkout (uncached, so the truest server number), search |
| Higher-ed | Program or department hubs, news, events, apply or request-info form |
| Publisher or resources | Article, archive or listing, search, the heaviest landing page |
| Lead generation | Main landing pages, the contact or demo form page |

Add the slowest page anyone has complained about, and the heaviest **content** page: embedded
story builders (Shorthand and similar), iframes, video or maps. Content can drag a page down
as much as any template. Write the list to a `urls.txt` (`Name | URL` per line). It's chosen once, at the baseline: a comparison reuses the baseline's pages from its
data block (`run --baseline`), so the numbers compare.

**Lab runs: always the skill's script.** It uses the same engine and presets as PageSpeed,
but it pins the Lighthouse version, reduces every audit the same way, and produces the
summary that the data block and every later comparison depend on:

```bash
node <skill-dir>/scripts/lighthouse-runs.mjs run --urls urls.txt --label production --out <scratch>/lh/production
```

It does 3 runs per page per form factor and reports the median-scoring run, with TBT as the
median of all runs. It writes `summary.md` tables ready for the report, plus raw JSON for
digging. State that local runs differ from PageSpeed's machine and network. TBT is the most
sensitive to that, and so is the machine itself, so record which computer ran it. A comparison
should run on the same one when possible. Treat moves of **8+ score points or several seconds
of FCP/LCP** as real, and anything smaller as noise.

Never put PageSpeed Insights lab scores in the results tables. Google updates its Lighthouse
version without notice, so those scores can't be compared run to run. Quote one only as a
labelled cross-check ("PageSpeed Insights, Google's servers, <date>").

**The other three Lighthouse scores.** The same runs record Accessibility, Best Practices and
SEO, and `summary.md` has a table of them with the site-wide average. Report them as
Lighthouse's automated checks. For each category below 90, list the failing audits from the
raw JSON with the pages they fail on. Common ones are iframes without a title, low contrast,
touch targets too small or close, no `<main>` landmark, and missing meta descriptions. Say
whose each one is: usually the theme, sometimes content. **An Accessibility score is not an
accessibility audit and never supports a WCAG claim** (see `wp-audit`).

**Field data.** CrUX p75 for real Chrome users decides whether Core Web Vitals pass. The lab
only diagnoses. Get URL-level and origin-level data from the PSI API response
(`loadingExperience`, `originLoadingExperience`) or the PageSpeed web UI. Low-traffic URLs
have none. Say so rather than leaving a blank. INP exists only in field data. With
`PSI_API_KEY` set, one mobile call per page returns both levels:

```bash
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=<url>&strategy=mobile&category=performance&key=$PSI_API_KEY"
```

The keyless quota runs out within one audit, so don't plan on it. Without a key, read the
numbers from the PageSpeed web UI, or record field data as not retrieved.

**Deep dive** on the homepage or the worst page: a Chrome DevTools performance trace through
[`browser-automation`](../../browser-automation/SKILL.md). Record:

- the LCP element and its breakdown (TTFB, load delay, load duration, render delay)
- the render-blocking requests
- main-thread time per third party

The trace's insights (LCP breakdown, LCP discovery, render blocking, third parties, document
latency) give these directly.

**Attribution tests.** When a cost might belong to tags or a vendor, measure it rather than
assert it. Alternate runs with the suspect blocked:

```bash
node <skill-dir>/scripts/lighthouse-runs.mjs run --urls urls.txt --runs 2 --block '*googletagmanager.com*' --out <scratch>/lh/gtm
```

The paired TBT table is the evidence for "about half the blocking time is tags". The same
alternating method isolates any one change: two conditions, same machine and hour, only one
variable different.

**Common WordPress causes to check before anything exotic:**

- The LCP image is lazy-loaded (core, or an image plugin's JS lazy-loader), or `fetchpriority="high"` sits on a different image.
- A hero set as a CSS background, which the browser discovers only after the stylesheets load. Preload it.
- `<head>` scripts with no `'strategy' => 'defer'` and not in the footer.
- Images uploaded outside the media library (in a plugin or theme folder), so there's no `srcset` and phones get the full file.
- Background or hero video that downloads on phones, or a player set to `preload: auto`.
- Production bundles built with source maps or dev settings (`devtool: 'eval-source-map'`, unminified builds committed).
- Page-specific libraries (sliders, forms, charts, video players) and plugin CSS loaded sitewide.
- An icon font with `font-display: auto`, and legacy transpilation shipping polyfills to modern browsers.
- Third-party tags, both through GTM and inline in the page from settings fields.

**Report:** mobile and desktop tables, a field data table, the deep-dive numbers, and, when
mobile is far below desktop, the "why mobile scores are lower" explainer from the template.

---

## Hosting and caching

**Answers:** whether the host and cache layers serve pages and assets quickly and correctly.

From the URL (everyone can do this):

```bash
curl -sSI https://<site>/                       # twice: the second should be a cache HIT
curl -s -o /dev/null -w 'ttfb %{time_starttransfer}s total %{time_total}s http %{http_version}\n' https://<site>/
curl -sSI -H 'Accept-Encoding: br, gzip' https://<site>/<a-theme-css-url> | grep -iE '^(content-encoding|cache-control|age|cf-cache-status|x-cache):'
```

- Page cache: HIT on a repeat anonymous request, and `cache-control` on HTML. A request with an unseen query string (`?audit=<random>`) shows whether the cache key includes query strings. If it doesn't, `?ver=` cache-busting can't work.
- Static assets: long `max-age`, compression (br or gzip), HTTP/2 or later.
- **Stale assets at the edge.** For each theme CSS and JS file on the page, compare what anonymous visitors get with the deployed version in git:

  ```bash
  curl -s '<asset-url>' | shasum
  git show <deployed-tag>:<path-in-repo> | shasum
  ```

  A mismatch means visitors run old code. Logged-in users often bypass the cache and never see it, so check from a private window or plain curl. Then check how the theme versions its assets: a hand-maintained version constant that wasn't bumped is the usual cause.
- **Cache exclusions.** Pages with personal or per-visitor content must not come from the page cache: cart, checkout, account, ticket or event registration, membership, and forms carrying a nonce. Request each twice anonymously. A cached HIT with an `age` header on one of them is a finding: visitors see someone else's state, or forms fail once the cached nonce expires. Then check the host's or caching plugin's exclusion list for the plugin that owns the page.

With server access:

| Check | Command |
| --- | --- |
| PHP version | `wp eval 'echo PHP_VERSION;'`. Compare with php.net's supported versions on the audit date, not from memory |
| WordPress version | `wp core version` |
| Object cache | `wp cache type`, plus whether `wp-content/object-cache.php` exists |
| Cron | `wp config get DISABLE_WP_CRON`, and `wp cron event list --fields=hook,next_run_gmt,recurrence` for events whose next run is in the past |
| Memory limit | `wp eval 'echo WP_MEMORY_LIMIT;'` |

Host dashboard numbers (WP Engine, Pressable) come from the user, as in access.md. House
targets: page cache hit ratio **≥ 70%** acceptable, **≥ 85%** goal. Object cache hit ratio
**≥ 90%**. Error rate **≤ 0.3%**. Average page latency **< 800 ms**. TTFB per wp-audit.

**Error rate above target: read the logs behind it.** A dashboard percentage is a symptom.
Group the access and error logs by status (404, 410, 429, 500, 502, 504) and by URL pattern,
then rank by frequency, because the fix depends on which ones dominate. A wall of 404s from bots
is a crawl problem, and 429s mean rate limiting is already firing. **Collect logs on day one**:
WP Engine keeps about two days of access logs and its last 1,500 errors. Download them from the
User Portal at the start, and ask the host's support for older logs when needed. Also read the
PHP error log (`wp-content/debug.log` or the host's error log), reading only, and leave any
secrets out of the report.

**Ongoing monitoring.** Note what's in place, if anything: the host's performance page, uptime
checks, a scheduled PageSpeed or CrUX check. When nothing reviews these numbers regularly,
recommend it, with the metrics, targets and cadence, typically monthly. Without monitoring,
the gains from an audit erode unnoticed.

---

## Crawling and bot traffic

**Answers:** how much of the server's work goes to bots, and which URLs they spend it on.
On sites with events, search, translations or filters, bots crawling endless URL variations
can use most of the server's capacity. They also drag down the cache hit ratio and push up
the error rate.

From the URL:

```bash
curl -s https://<site>/robots.txt
curl -s 'https://<site>/?s=audit' | grep -io '<meta name="robots"[^>]*>'
curl -sSI 'https://<site>/?s=audit' | grep -i '^x-robots-tag:'
```

- **Endless URL spaces:** site search (`?s=`), calendar views and pagination (month, day and list views running years ahead), translation copies of every page, faceted filters and sort parameters. For each one, check whether robots.txt disallows it, whether the pages carry `noindex`, and whether links into it carry `rel="nofollow"`.
- **robots.txt:** check that it exists, lists the sitemap, and blocks those spaces. `Crawl-delay` slows Bing and others but **Google ignores it**, so it's never the whole fix.

With logs (as under Hosting):

```bash
awk -F'"' '{print $6}' access.log | sort | uniq -c | sort -rn | head -20     # top user agents
grep -iE 'bot|crawl|spider|slurp' access.log | awk '{print $7}' | sed 's/[?].*//' | sort | uniq -c | sort -rn | head -20
```

Log formats differ by host, so adjust the fields to match. Report the share of requests from
bots, the top bot user agents, and the URL patterns they hit most. If the user has Search
Console access, its Pages report (indexed vs. not, and why) and Crawl stats (requests per day,
by response) confirm what the logs show.

**Report:** the bot share, the URL spaces being crawled, and the controls missing for each:
- robots.txt rules
- `noindex` or `nofollow` on the URL space
- host or CDN bot rules (WP Engine Web Rules, Cloudflare WAF)
- rate limiting

The search engines' own bots are owned by nobody, but the crawl rules are Linchpin's or the
host's. Record `bots.share` in `metrics.json`.

---

## Plugin footprint

**Answers:** what each plugin costs, whether it's maintained, and what should go.

```bash
wp plugin list --fields=name,title,status,version,update_version,auto_update --format=csv
wp plugin list --status=must-use --fields=name,version
wp plugin list --status=dropin --fields=name,title
wp plugin verify-checksums --all     # wordpress.org plugins only. Flags modified (forked) copies
```

- **Maintenance:** for each wordpress.org plugin, `curl -s 'https://api.wordpress.org/plugins/info/1.2/?action=plugin_information&request[slug]=<slug>'` gives `last_updated` and `tested`. A `closed` error means it was pulled from the directory. Over two years without an update is "not actively supported". For premium or custom plugins, use the vendor's changelog or the repo's last commit.
- **Front-end cost:** in the raw Lighthouse JSON, requests under `/wp-content/plugins/<slug>/` on pages that don't use the feature, and the unused-CSS and unused-JS audits.
- **Server cost:** Query Monitor's per-component breakdown, or `wp profile`, on local or staging. See upstream `wp-performance`.
- **Overlap:** two plugins doing one job (SEO, caching, forms, redirects, sliders). Also inactive plugins (remove) and plugins not under version control when the repo manages the rest.

**Report:** a table with columns `Plugin | Version | Status | Last updated | Impact | Verdict`.
Verdict is Keep, Configure, Replace or Remove, and Impact runs from Very low to High. Keep clean plugins
in the table marked "no action needed", because they show the review was complete. Write a
short card for each plugin with Medium or higher impact: what it does, the evidence and the
recommendation. List custom plugins first.

---

## Theme footprint

**Answers:** how much the theme ships, what blocks rendering, and how much of it is dead.

- **Shape:** `wp theme list` (active and parent), block or classic (`wp eval 'echo wp_is_block_theme() ? "block" : "classic";'`), and any page builder from the plugin list. A child theme's issues may be inherited from the parent, so say which.
- **Assets:** raw and compressed size of each theme CSS and JS file the page loads (`curl -s <url> | wc -c` and `curl -s <url> | gzip -9 | wc -c`), whether each blocks rendering, and the unused share from Lighthouse's unused-CSS and unused-JS audits for that page. Unused on one page isn't dead sitewide, so say which page.
- **Enqueues:** `git grep -nE "wp_enqueue_script|wp_register_script" -- <paths>`. Flag scripts loaded in `<head>` with no `'strategy' => 'defer'`, and assets enqueued on every page for one template.
- **Versioning:** how `?ver=` is set (a hand-bumped constant, `filemtime()`, or a build hash). Tie it to the stale-asset check above.
- **Build:** `git grep -n "sourceMappingURL" -- '*.js'` in built files, `devtool` in webpack configs, and dev builds or `.map` files committed. Unminified CSS or JS in production shows in Lighthouse's minification audits in the raw JSON.
- **Leftover themes:** `wp theme list --status=inactive`. Every inactive theme except one default fallback is a removal candidate: it's code that still gets updates and security advisories.
- **Templates in use:**

  ```bash
  wp db query "SELECT meta_value, COUNT(*) FROM <prefix>postmeta WHERE meta_key='_wp_page_template' GROUP BY meta_value"
  ```

  Compare with the template files present. Unused ones are removal candidates.
- **Image sizes:** `wp media image-size --format=csv`. Many registered sizes multiply every upload.

---

## Expensive queries

**Answers:** which code makes the database work hardest, and on which pages.

Measure where it's safe: Query Monitor or `SAVEQUERIES` on local or staging, `wp profile`
if the package is installed, and the host's slow-query log or APM (New Relic) if offered.
Never install profilers on production without approval.

Then inspect the custom code. These patterns are where past audits found the cost:

```bash
git grep -nE "posts_per_page['\"]?\s*=>\s*(-1|[0-9]{3,})|'nopaging'\s*=>\s*true" -- <paths>
git grep -nE "query_posts\(|'orderby'\s*=>\s*'rand'|__not_in'|'compare'\s*=>\s*'!='" -- <paths>
git grep -nE "meta_query|tax_query" -- <paths>            # review each: unindexed meta_value compares
git grep -nE "flush_rewrite_rules|get_terms\(|wp_remote_(get|post)\(" -- <paths>
git grep -nE "switch_to_blog\(" -- <paths>              # multisite loops
```

Also check for queries in loops (N+1), and for `WP_Query` calls that need no pagination but
lack `no_found_rows => true`, `fields => 'ids'`, or `update_post_meta_cache => false`. Look for
remote calls and expensive term lookups with no transient or object cache around them.

**Indexes.** Sites that lean on post meta (ACF especially) query it on every uncached page.
Check what's there:

```bash
wp db query "SHOW INDEX FROM <prefix>postmeta"
```

Core ships only `meta_id`, `post_id` and `meta_key`. A composite index (for example
`meta_key(32), meta_value(32), post_id`) is a common fix, but it's a schema change. Recommend
it only when the slow queries point at it, and never add it during the audit.

**Report:** one card per issue: `File:line`, function, a short snippet, Impact,
Risk (High / Medium / Low), Fix, and whether it runs on the front end, in the admin, or both.
Group by type (unbounded, large LIMIT, complex JOIN or meta query, uncached, N+1).

---

## wp_options, autoload and leftover tables

**Answers:** how much loads on every request before any page logic runs, and what plugins
left behind.

```bash
wp db query "SELECT COUNT(*) AS options, ROUND(SUM(LENGTH(option_value))/1024) AS kb FROM <prefix>options WHERE autoload IN ('yes','on','auto-on','auto')"
wp db query "SELECT option_name, LENGTH(option_value) AS bytes FROM <prefix>options WHERE autoload IN ('yes','on','auto-on','auto') ORDER BY bytes DESC LIMIT 20"
wp db query "SELECT COUNT(*) FROM <prefix>options WHERE option_name LIKE '\_transient\_timeout\_%' AND option_value < UNIX_TIMESTAMP()"
wp db tables --all-tables-with-prefix --format=csv
wp db size --tables
```

- Autoload over **800 KB** is the point where WordPress Site Health warns. Report the total and the top offenders.
- **Derelict options:** map the largest names to their plugin or theme. Flag those whose owner is no longer installed.
- **Leftover tables:** tables that belong to neither core nor an active plugin. Map them by name and list them with their size.
- Expired transients in the options table mean there's no persistent object cache, or cleanup isn't running.

On a Studio copy (SQLite), `wp db size` and some SQL differ. Use the most recent copy of the
production database you can get, and say which. Upstream `wp-performance` has the deep dive
on autoload.

---

## Content metrics

**Answers:** how much content the site holds and where the volume or bloat is. It's the
context for every query and storage finding.

```bash
wp post-type list --fields=name,public --format=csv
for t in $(wp post-type list --field=name); do echo "$t,$(wp post list --post_type=$t --post_status=any --format=count)"; done
wp post list --post_type=revision --post_status=inherit --format=count
wp post list --post_type=attachment --post_status=inherit --format=count
for x in $(wp taxonomy list --field=name); do echo "$x,$(wp term list $x --format=count)"; done
wp user list --format=count
wp comment count
wp db query "SELECT COUNT(*) FROM <prefix>postmeta pm LEFT JOIN <prefix>posts p ON p.ID = pm.post_id WHERE p.ID IS NULL"
wp db size --human-readable
```

Add `du -sh wp-content/uploads` where there's a shell, and `wp site list --format=count` on
multisite (then repeat per site with `--url`). In the report, give a table of post types with
counts, then revisions, media, terms, users, orphaned postmeta and database size, each with a
one-line reading ("12 revisions per post on average: cap `WP_POST_REVISIONS`").

---

## Code standards (WPCS)

**Answers:** how the custom code measures against the WordPress Coding Standards, with
attention on the security-relevant rules.

- If the repo has `phpcs.xml` or `phpcs.xml.dist`, run its own configuration the way [`quality-gates`](../../quality-gates/SKILL.md) detects it, in **report mode only**.
- Otherwise run the WordPress standard against `<paths>`. That needs `phpcs` with WPCS 3 installed. Installing it globally is a change to the user's machine, so ask first:

  ```bash
  phpcs --standard=WordPress --report=summary <paths>
  phpcs --standard=WordPress --sniffs=WordPress.Security.EscapeOutput,WordPress.Security.NonceVerification,WordPress.Security.ValidatedSanitizedInput,WordPress.DB.PreparedSQL,WordPress.DB.PreparedSQLPlaceholders --report=summary <paths>
  phpcs --standard=PHPCompatibilityWP --runtime-set testVersion <target-php>- --report=summary <paths>
  ```

**Report:** errors and warnings per component, the security sniffs called out separately,
and PHP-compatibility blockers for the next PHP upgrade. Formatting counts get one line, not
a table. **Never run `phpcbf`** during an audit.

---

## Security

**Answers:** what's exposed or out of date. This is a **passive review**, never a penetration
test. Never send attack payloads, brute-force, or run active scanners against a live site
without written authorization.

With server access:

- Updates: `wp core check-update`, `wp plugin list --update=available --fields=name,version,update_version`, `wp theme list --update=available`.
- Integrity: `wp core verify-checksums` and `wp plugin verify-checksums --all`.
- Known vulnerabilities: check versions against a vulnerability database the team has access to (WPScan API, Patchstack, Wordfence Intelligence). Without one, list the versions and mark the area "not checked against a vulnerability database".
- Administrators: `wp user list --role=administrator --format=count`. Report the count, never login names.
- Config, one constant at a time: `DISALLOW_FILE_EDIT`, `WP_DEBUG`, `WP_DEBUG_DISPLAY`, `SCRIPT_DEBUG`.
- Dependency advisories in the repo: `npm audit` and `composer audit`, report only. Fixing them belongs to [`security-updates`](../../security-updates/SKILL.md).

From the URL:

- `/xmlrpc.php` answers "XML-RPC server accepts POST requests only." when it's enabled.
- `/wp-json/wp/v2/users` lists users publicly (user enumeration).
- `/readme.html`, a generator `<meta>` tag, and `?ver=` on core assets leak the WordPress version.
- `/wp-content/debug.log` is publicly readable (critical if present).
- Directory listing on `/wp-content/uploads/`.
- Security headers on the HTML response: `strict-transport-security`, `content-security-policy` (enforced, or only `-report-only`), `x-content-type-options`, `x-frame-options` or `frame-ancestors`, `referrer-policy`, `permissions-policy`.
- **Code stored in the admin.** Inline `<script>` blocks in the rendered HTML that aren't in git come from settings fields (header/footer script plugins, theme options, custom fields). Report them as unreviewed code with no version control. They are often also the performance owner of record.
- Front-end library versions (jQuery and bundled libraries) with known advisories.

---

## Broken links

**Answers:** which links on the site lead nowhere.

```bash
npx linkinator https://<site>/ --recurse --concurrency 4 --timeout 15000 --format csv > <scratch>/links.csv
```

A crawl is real load on production. Keep concurrency low, run off-peak, and tell the user
first. A WAF answering 429 or 403 is a result to report, not to work around. On large sites,
pass the sitemap's URLs instead of `--recurse`. If the user has Google Search Console access,
its "Not found (404)" report adds links from outside the site.

**Report:** a table with columns `Broken link | Status | Found on`. Internal links come first, then
external. Redirect chains of three or more hops get one line.

---

## Site background

**Answers:** who built the site, when, and what that left behind. It's context for every
finding. Sources: the user and the client's team, the team's ClickUp docs for the client,
`git log --reverse --format='%ad %an %s' --date=short | head`, the theme header's Author, and
plugins from a previous vendor. If none is available, write one line saying it wasn't
available and ask the user to fill it in. Never invent history.
