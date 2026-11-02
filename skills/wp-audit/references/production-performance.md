# Production performance

How to measure a live WordPress site on Linchpin's usual stack (Pressable, Batcache, Cloudflare
in front) and get from a number to a cause. Read it when the audit's environment is production
or staging. Plan availability for Cloudflare features changes; confirm in Cloudflare's docs
before you quote one.

## 1. Read the cache stack before anything else

The largest cost on a WordPress site is usually the render no cache answered, not the front
end. Find out which layer answers each request first, because it decides what every later
number means.

```bash
for i in 1 2 3; do
  curl -s -o /dev/null -D - "$URL" | grep -iE 'cf-cache-status|x-nananana|x-ac|server-timing|cache-control|^age|speculation-rules|^link'
  echo ---
done
```

`scripts/footprint.mjs` does this for every page and prints the progression per fetch.

| Header | Layer | Reading it |
| --- | --- | --- |
| `cf-cache-status` | Cloudflare | `HIT` answered at the edge. `MISS`/`EXPIRED` cacheable, fetched. `DYNAMIC` not eligible: on a `.css` or `.js` file that means a Cache Rule or Page Rule is bypassing the cache, because Cloudflare caches those extensions by default. `BYPASS` eligible but the response refused (`Set-Cookie`, `private`, `no-store`). |
| `x-nananana` | Batcache (Pressable) | No header: not stored yet. `Batcache-Set`: stored by this request. `Batcache-Hit`: served without running WordPress. |
| `x-ac` | Pressable / WP Cloud edge | Last word is the edge cache's verdict; `BYPASS` throughout means it is off for the site (confirm with the Pressable MCP's `get_site_status`, field `edge_cache`). |
| `server-timing` | Origin | `dur=` is the origin's time in ms: about 30 on a Batcache hit, the full render on a miss. |
| `speculation-rules` | Cloudflare Speed Brain | On. It serves prefetches only from Cloudflare's cache, so with HTML uncached it does nothing. |
| `link` | Origin | Any `rel=preload` or `preconnect` here is what Cloudflare Early Hints replays as a `103`. None means Early Hints has nothing to send. |

**Batcache's defaults bite low-traffic sites.** It stores a page only after its second request
inside 120 seconds and keeps it 300 seconds, and it keys phone user agents separately. A page
that gets a visitor every few minutes is almost never stored, so nearly every visitor waits for
the full render. Warm mobile runs with a phone user agent (`scripts/lighthouse.mjs` does).

## 2. Measure

```bash
node <skill-dir>/scripts/footprint.mjs --rest https://site.example --json before.json
node <skill-dir>/scripts/footprint.mjs --ua mobile https://site.example/ https://site.example/contact/
node <skill-dir>/scripts/lighthouse.mjs --out lh-before https://site.example/ https://site.example/contact/
# after the fix ships:
node <skill-dir>/scripts/footprint.mjs --rest https://site.example --json after.json
node <skill-dir>/scripts/footprint.mjs --compare before.json after.json
node <skill-dir>/scripts/lighthouse.mjs --out lh-after <same urls>
```

- **The DevTools MCP's `lighthouse_audit` has no Performance category.** Use the script for
  scores; use `performance_start_trace` and `performance_analyze_insight` (`LCPBreakdown`,
  `RenderBlocking`, `DocumentLatency`) when you need the why behind one page.
- **A site behind Cloudflare Access** answers a headless browser with the sign-in page. The
  Lighthouse summary warns when a run ended on another host; measure that site through a real
  Chrome with a session ([`browser-automation`](../../browser-automation/SKILL.md)).
- Pick key pages by template, not by count: home, a landing page, a long content page, the
  blog index, a post, any page with a form, and one plain text page as the floor.

## 3. Server time: read-only checks

Run these through [`wp-pressable`](../../wp-pressable/SKILL.md) as `wp eval` commands that only
print. Each has cost a real site hundreds of milliseconds or gigabytes:

| Check | Why | Evidence |
| --- | --- | --- |
| `WP_DEBUG`, `WP_DEBUG_LOG` in production | Every deprecation and notice is written to `wp-content/debug.log` on every uncached request; plugins bundling old libraries raise hundreds per request on new PHP. | The constants, and `filesize( WP_CONTENT_DIR . '/debug.log' )` |
| Code that purges a cache "while debugging" | A theme that calls `delete_pattern_cache()` when `WP_DEBUG` is on re-reads every pattern file per request once debug is on in production. `WP_DEVELOPMENT_MODE` is core's switch for that. | `grep` the theme and plugins for `delete_pattern_cache`, `wp_cache_flush`, `delete_transient` outside save hooks |
| Content parsed to decide an enqueue | `parse_blocks()` of the queried post, its patterns and synced blocks on every request, to decide whether to load one script. | `grep` for `parse_blocks(` / `has_block(` in `wp_enqueue_scripts` callbacks |
| Autoloaded options | Read on every request; large serialized blobs slow every page. | `SELECT SUM(LENGTH(option_value)) … autoload IN ('yes','on','auto-on','auto')` |

Deeper profiling (`wp profile`, Query Monitor, object cache) is the upstream `wp-performance`
skill's ground.

## 4. Front-end causes, and how to confirm each

| Cause | Confirm with | Fix belongs to |
| --- | --- | --- |
| Footer classic script without `defer` | footprint flag; Lighthouse `render-blocking-insight` lists footer scripts too, because they block the first paint when the HTML arrives in one piece | The plugin that registers it ([`wp-block-conventions`](../../wp-block-conventions/SKILL.md) for ours) |
| Registered with `defer` but printed without it | An `id="<handle>-js-after"` inline script follows it. WordPress will not defer a handle with an `after` inline script. | Same |
| A library on pages that never use it | footprint's asset list: pages loading it versus pages rendering the block that needs it | Same: enqueue at render, not globally |
| The same library twice | footprint flag (`gsap.min.js loaded twice`) | Pick one owner; the other steps aside when it is on the page |
| React and `wp-*` packages on the front end | A front-end script's `.asset.php` lists `wp-data`, `wp-element` or `wp-api-fetch` | The script's author: view code must not import editor packages |
| Editor-only CSS on the front end | A stylesheet whose handle or file names `editor` on a front-end page | The plugin that enqueues it |
| Body font too heavy or late | The font's size; whether it is preloaded with `crossorigin`; `font-display` | Theme: subset to the scripts the site writes, keep the rest behind `unicode-range`, preload the subset |
| No `Link` preload headers | footprint's "Link preloads" column is empty | Theme: send `Link` headers for the stylesheet and body font, matching the page's URLs exactly |
| Inline global styles too large | footprint's inline CSS; count `--wp--preset--*` and `.has-*` rules | Theme: prune unused presets (check stored content first) |
| Forms plugin CSS framework | Its stylesheet sizes on form pages | Plugin settings: form theme off, styled by the theme |

## 5. Cloudflare

Read the zone before recommending anything. These are GET requests through the Cloudflare MCP:
`/zones` (plan per zone), `/zones/{id}/settings`,
`/zones/{id}/rulesets/phases/http_request_cache_settings/entrypoint` (Cache Rules),
`/zones/{id}/pagerules`, `/zones/{id}/cache/tiered_cache_smart_topology_enable`.

| Feature | Plan | What to know |
| --- | --- | --- |
| Cache Rules | All (10 on Free, 25 on Pro) | A rule whose expression is `true` with `cache: false` disables caching for the whole zone, static files included. |
| HTML caching | Cache Rule on all plans; APO included on Pro, an add-on on Free | APO caches HTML, bypasses on login, comment and WooCommerce cookies, and purges on publish through the Cloudflare WordPress plugin. A Cache Rule needs the same cookie bypass written out, and a purge on publish or a short edge TTL. |
| Smart Tiered Cache | All, free | Funnels misses through one upper tier, which raises the hit rate of a low-traffic site. |
| Early Hints | All | Needs `Link: rel=preload` headers in the origin's response. |
| Speed Brain | All | Prefetches from Cloudflare's cache only; useless until HTML is cached. |
| Polish | Pro and up | Lossless or lossy, optional WebP, for raster images served through the zone. |
| HTTP/3, 0-RTT | All | Often off on older zones. |
| Rocket Loader | All | Keep off: it rewrites script order, which breaks deferred scripts and script modules that rely on it. |
| Web Analytics | All | The `beacon.min.js` on every page; it is the field-data (real visitor) source for Core Web Vitals. |

Every change here is a production change. Propose it with the exact rule expression and
setting, and apply it only once the user approves.
