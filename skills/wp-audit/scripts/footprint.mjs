#!/usr/bin/env node
// Measure what a set of WordPress pages costs to load, the same way every time.
// Zero dependencies: Node >= 18 (global fetch, zlib).
//
//   node footprint.mjs https://example.com/ https://example.com/about/
//   node footprint.mjs --rest https://example.com              # every published page, via REST
//   node footprint.mjs --ua mobile --json before.json <urls>   # also write the raw results
//   node footprint.mjs --compare before.json after.json        # what moved, page by page
//
// READ-ONLY. It sends GET requests to the pages and the assets they reference, and writes a
// file only when given --json. It never logs in, posts a form or purges a cache.
//
// Why a script and not prose: a hand-rolled page-weight check differs every run (which
// assets were counted, decoded or gzipped, whether inline CSS and SVG were included,
// whether the page was served from cache), so before and after never compare. This one
// fetches each page three times to show the cache filling, counts the same things every
// run, and flags the loading mistakes that cost the most on a WordPress site.
//
// `analyzeHtml()`, `flagPage()`, `compare()` and `render()` are pure and exported for
// footprint.test.mjs. Only `measure()` touches the network.

import { gzipSync } from 'node:zlib';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const USER_AGENTS = {
  desktop:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 wp-audit-footprint',
  // Lighthouse's mobile device. Page caches that key on a phone user agent (Batcache does)
  // keep a separate copy for it, so a mobile audit must warm and measure with this one.
  mobile:
    'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36 wp-audit-footprint',
};

// Libraries that should never load twice on one page. Matched on the file's basename.
const SINGLETON_LIBS =
  /^(gsap|scrolltrigger|swiper|svg|lottie|lottie_light|three|jquery|react|react-dom)(\.module)?(\.min)?\.js$/i;

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return m ? m[2] : null;
};
const hasAttr = (tag, name) => new RegExp(`\\s${name}(\\s|=|>|/)`, 'i').test(tag);
const basename = (url) => url.split('?')[0].split('/').pop();

/** Everything about a page that can be read from its HTML alone. Pure. */
export function analyzeHtml(html, pageUrl) {
  const headEnd = html.search(/<\/head>/i);
  const inHead = (index) => headEnd === -1 || index < headEnd;
  const abs = (u) => {
    try {
      return new URL(u.replace(/&#0?38;|&amp;/g, '&'), pageUrl).href;
    } catch {
      return u;
    }
  };

  const scripts = [];
  let inlineJs = 0;
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const tag = `<script${m[1]}>`;
    const src = attr(tag, 'src');
    const type = (attr(tag, 'type') || '').toLowerCase();
    if (!src) {
      // JSON data islands and templates are bytes, not code, but they are still HTML weight.
      inlineJs += m[2].length;
      continue;
    }
    scripts.push({
      url: abs(src),
      head: inHead(m.index),
      module: type === 'module',
      defer: hasAttr(tag, 'defer'),
      async: hasAttr(tag, 'async'),
    });
  }

  const styles = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = (attr(m[0], 'rel') || '').toLowerCase();
    if (rel === 'stylesheet') {
      styles.push({ url: abs(attr(m[0], 'href') || ''), media: attr(m[0], 'media') || 'all' });
    }
  }
  const preloads = [...html.matchAll(/<link\b[^>]*rel=["'](?:preload|modulepreload)["'][^>]*>/gi)].map((m) =>
    abs(attr(m[0], 'href') || ''),
  );

  const inlineCss = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].reduce(
    (n, m) => n + m[1].length,
    0,
  );
  const inlineSvg = [...html.matchAll(/<svg\b[\s\S]*?<\/svg>/gi)].reduce((n, m) => n + m[0].length, 0);
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const importmap = html.match(/<script[^>]*type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/i);
  let imports = 0;
  try {
    imports = importmap ? Object.keys(JSON.parse(importmap[1]).imports || {}).length : 0;
  } catch {
    imports = 0;
  }

  return {
    htmlBytes: html.length,
    inlineCss,
    inlineJs,
    inlineSvg,
    scripts,
    styles,
    preloads,
    imports,
    images: imgs.length,
    imagesLazy: imgs.filter((t) => /loading=["']lazy/i.test(t)).length,
    imagesUnsized: imgs.filter((t) => !hasAttr(t, 'width') || !hasAttr(t, 'height')).length,
  };
}

/** The loading mistakes worth a finding. Pure. */
export function flagPage(page) {
  const flags = [];
  for (const s of page.scripts) {
    const name = basename(s.url);
    if (s.module || s.async || s.defer) {
      continue;
    }
    flags.push(
      s.head
        ? `render-blocking in <head>: ${name}`
        : `footer script without defer (still blocks the first paint): ${name}`,
    );
  }
  const seen = new Map();
  for (const s of page.scripts) {
    const name = basename(s.url).toLowerCase();
    if (!SINGLETON_LIBS.test(name)) {
      continue;
    }
    if (seen.has(name) && seen.get(name) !== s.url) {
      flags.push(`${name} loaded twice: ${seen.get(name)} and ${s.url}`);
    }
    seen.set(name, s.url);
  }
  if (page.imagesUnsized) {
    flags.push(`${page.imagesUnsized} <img> without width and height (layout shift)`);
  }
  const cache = page.fetches.map((f) => f.cache).join(' → ');
  if (page.fetches.every((f) => f.ttfb > 800)) {
    flags.push(`every fetch took over 800 ms to first byte; cache never answered (${cache})`);
  }
  return flags;
}

/** One line of cache state per fetch, from whichever cache headers the stack sends. */
function cacheState(h) {
  const parts = [];
  if (h.get('cf-cache-status')) {
    parts.push(`cf:${h.get('cf-cache-status')}`);
  }
  if (h.get('x-nananana')) {
    parts.push(h.get('x-nananana').replace('Batcache-', 'batcache:'));
  }
  if (h.get('x-ac')) {
    parts.push(`edge:${h.get('x-ac').split(' ').pop()}`);
  }
  if (h.get('age')) {
    parts.push(`age:${h.get('age')}`);
  }
  return parts.join(' ') || 'no cache headers';
}

async function timedFetch(url, ua) {
  const start = performance.now();
  const res = await fetch(url, {
    headers: { 'user-agent': ua, accept: 'text/html,*/*' },
    redirect: 'follow',
  });
  const ttfb = performance.now() - start;
  const body = Buffer.from(await res.arrayBuffer());
  return { res, ttfb, body };
}

/** Fetch each page three times, then every asset it references once. */
export async function measure(urls, { ua = 'desktop' } = {}) {
  const agent = USER_AGENTS[ua] || USER_AGENTS.desktop;
  const assets = new Map();
  const asset = async (url) => {
    if (!assets.has(url)) {
      assets.set(
        url,
        (async () => {
          try {
            const { res, body } = await timedFetch(url, agent);
            return {
              bytes: body.length,
              gzip: gzipSync(body).length,
              status: res.status,
              cacheControl: res.headers.get('cache-control') || '',
              cache: cacheState(res.headers),
            };
          } catch (err) {
            return { bytes: 0, gzip: 0, status: 0, cacheControl: '', cache: `error: ${err.message}` };
          }
        })(),
      );
    }
    return assets.get(url);
  };

  const pages = [];
  for (const url of urls) {
    const fetches = [];
    let last;
    try {
      for (let i = 0; i < 3; i++) {
        last = await timedFetch(url, agent);
        fetches.push({
          status: last.res.status,
          ttfb: Math.round(last.ttfb),
          cache: cacheState(last.res.headers),
          originMs: Number((last.res.headers.get('server-timing') || '').match(/dur=([\d.]+)/)?.[1] ?? NaN),
        });
      }
    } catch (err) {
      pages.push({ url, error: err.message });
      continue;
    }
    const html = last.body.toString('utf8');
    const page = {
      url,
      fetches,
      linkHeaders: (last.res.headers.get('link') || '')
        .split(/,(?=\s*<)/)
        .filter((l) => /rel="?(preload|preconnect|modulepreload)/.test(l))
        .map((l) => l.trim()),
      htmlGzip: gzipSync(last.body).length,
      ...analyzeHtml(html, url),
    };
    const js = await Promise.all(page.scripts.map((s) => asset(s.url)));
    const css = await Promise.all(page.styles.map((s) => asset(s.url)));
    page.jsBytes = js.reduce((n, a) => n + a.bytes, 0);
    page.jsGzip = js.reduce((n, a) => n + a.gzip, 0);
    page.cssBytes = css.reduce((n, a) => n + a.bytes, 0);
    page.cssGzip = css.reduce((n, a) => n + a.gzip, 0);
    page.flags = flagPage(page);
    pages.push(page);
  }

  const assetList = await Promise.all(
    [...assets].map(async ([url, p]) => ({
      url,
      ...(await p),
      pages: pages.filter((pg) => !pg.error && [...pg.scripts, ...pg.styles].some((s) => s.url === url))
        .length,
    })),
  );
  return {
    measuredAt: new Date().toISOString(),
    ua,
    pages,
    assets: assetList.sort((a, b) => b.bytes - a.bytes),
  };
}

const kb = (n) => `${Math.round(n / 1024)}K`;
const pathOf = (url) => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

/** A plain-text report. Pure. */
export function render(result) {
  const lines = [`Footprint (${result.ua} user agent), ${result.measuredAt}`, ''];
  lines.push(
    'page                                       ttfb ms (3 fetches)  html  inline css/js/svg  js (gzip)        css (gzip)       scripts styles',
  );
  for (const p of result.pages) {
    if (p.error) {
      lines.push(`${pathOf(p.url).padEnd(42)} ERROR ${p.error}`);
      continue;
    }
    lines.push(
      [
        pathOf(p.url).slice(0, 42).padEnd(42),
        p.fetches
          .map((f) => f.ttfb)
          .join('/')
          .padEnd(21),
        kb(p.htmlBytes).padStart(5),
        `${kb(p.inlineCss)}/${kb(p.inlineJs)}/${kb(p.inlineSvg)}`.padStart(18),
        `${kb(p.jsBytes)} (${kb(p.jsGzip)})`.padStart(16),
        `${kb(p.cssBytes)} (${kb(p.cssGzip)})`.padStart(16),
        String(p.scripts.length).padStart(7),
        String(p.styles.length).padStart(6),
      ].join(' '),
    );
  }
  lines.push('', 'Cache, fetch by fetch:');
  for (const p of result.pages.filter((pg) => !pg.error)) {
    lines.push(
      `  ${pathOf(p.url)}: ${p.fetches.map((f) => f.cache).join(' → ')}${p.linkHeaders.length ? `  | Link preloads: ${p.linkHeaders.length}` : ''}`,
    );
  }
  lines.push('', 'Heaviest assets (decoded, gzip, pages):');
  for (const a of result.assets.slice(0, 15)) {
    lines.push(
      `  ${kb(a.bytes).padStart(6)} ${kb(a.gzip).padStart(5)} ${String(a.pages).padStart(3)}  ${a.cache.padEnd(20)} ${pathOf(a.url)}`,
    );
  }
  const flagged = result.pages.filter((p) => p.flags?.length);
  if (flagged.length) {
    lines.push('', 'Flags:');
    for (const p of flagged) {
      lines.push(`  ${pathOf(p.url)}`);
      for (const f of p.flags) {
        lines.push(`    - ${f}`);
      }
    }
  }
  return lines.join('\n');
}

/** Page-by-page deltas between two --json results. Pure. */
export function compare(before, after) {
  const lines = [`Compare: ${before.measuredAt} → ${after.measuredAt}`, ''];
  const fields = [
    ['warm ttfb ms', (p) => p.fetches.at(-1).ttfb],
    ['html KB', (p) => p.htmlBytes / 1024],
    ['js gzip KB', (p) => p.jsGzip / 1024],
    ['css gzip KB', (p) => p.cssGzip / 1024],
    ['scripts', (p) => p.scripts.length],
    ['blocking scripts', (p) => p.scripts.filter((s) => !s.module && !s.async && !s.defer).length],
  ];
  const byPath = new Map(before.pages.filter((p) => !p.error).map((p) => [pathOf(p.url), p]));
  for (const a of after.pages.filter((p) => !p.error)) {
    const b = byPath.get(pathOf(a.url));
    if (!b) {
      continue;
    }
    const cells = fields.map(([label, get]) => {
      const x = get(b);
      const y = get(a);
      const d = y - x;
      return `${label} ${Math.round(x)}→${Math.round(y)}${d ? ` (${d > 0 ? '+' : ''}${Math.round(d)})` : ''}`;
    });
    lines.push(`${pathOf(a.url)}`, `  ${cells.join(' · ')}`);
  }
  return lines.join('\n');
}

async function restPages(origin) {
  const urls = [];
  for (let page = 1; page < 20; page++) {
    const res = await fetch(
      `${origin.replace(/\/$/, '')}/wp-json/wp/v2/pages?per_page=100&page=${page}&_fields=link`,
    );
    if (!res.ok) {
      break;
    }
    const items = await res.json();
    urls.push(...items.map((i) => i.link));
    if (items.length < 100) {
      break;
    }
  }
  return urls;
}

async function main(argv) {
  const args = [...argv];
  const take = (flag) => {
    const i = args.indexOf(flag);
    return i === -1 ? null : args.splice(i, 2)[1];
  };
  if (args[0] === '--compare') {
    const [, a, b] = args;
    console.log(compare(JSON.parse(fs.readFileSync(a, 'utf8')), JSON.parse(fs.readFileSync(b, 'utf8'))));
    return;
  }
  const ua = take('--ua') || 'desktop';
  const out = take('--json');
  const rest = take('--rest');
  const urls = [...(rest ? await restPages(rest) : []), ...args];
  if (!urls.length) {
    console.error(
      'Usage: footprint.mjs [--ua mobile] [--json out.json] [--rest https://site] <url>…\n       footprint.mjs --compare before.json after.json',
    );
    process.exitCode = 2;
    return;
  }
  const result = await measure(urls, { ua });
  if (out) {
    fs.writeFileSync(out, JSON.stringify(result, null, 1));
  }
  console.log(render(result));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
