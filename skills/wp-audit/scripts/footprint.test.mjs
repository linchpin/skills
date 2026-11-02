// node --test skills/wp-audit/scripts/footprint.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeHtml, flagPage, compare } from './footprint.mjs';
import { summarize } from './lighthouse.mjs';

const html = `<!doctype html><html><head>
<script src="/wp-content/plugins/a/gsap.min.js?ver=1"></script>
<script type="module" src="/wp-content/plugins/a/view.js"></script>
<link rel='stylesheet' href='/style.css?ver=2&#038;x=1' media='all' />
<link rel="preload" href="/font.woff2" as="font" crossorigin>
<style id="global-styles-inline-css">body{color:red}</style>
<script type="importmap">{"imports":{"@wordpress/interactivity":"/i.js"}}</script>
</head><body>
<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>
<img src="/a.png" width="10" height="10" loading="lazy"><img src="/b.png">
<script src="/wp-content/plugins/b/gsap.min.js?ver=9"></script>
<script defer src="/core.js"></script>
</body></html>`;

test('analyzeHtml counts scripts by position and strategy, styles, inline weight and images', () => {
  const page = analyzeHtml(html, 'https://example.com/page/');
  assert.equal(page.scripts.length, 4);
  assert.deepEqual(
    page.scripts.map((s) => [s.head, s.module, s.defer]),
    [
      [true, false, false],
      [true, true, false],
      [false, false, false],
      [false, false, true],
    ],
  );
  assert.equal(page.styles[0].url, 'https://example.com/style.css?ver=2&x=1');
  assert.equal(page.preloads.length, 1);
  assert.equal(page.imports, 1);
  assert.equal(page.inlineCss, 'body{color:red}'.length);
  assert.ok(page.inlineSvg > 0);
  assert.equal(page.images, 2);
  assert.equal(page.imagesLazy, 1);
  assert.equal(page.imagesUnsized, 1);
});

test('flagPage names blocking scripts, a library loaded twice, and unsized images', () => {
  const page = {
    ...analyzeHtml(html, 'https://example.com/'),
    fetches: [
      { ttfb: 1200, cache: 'cf:DYNAMIC' },
      { ttfb: 100, cache: 'batcache:Hit' },
    ],
  };
  const flags = flagPage(page).join('\n');
  assert.match(flags, /render-blocking in <head>: gsap\.min\.js/);
  assert.match(flags, /footer script without defer .*gsap\.min\.js/);
  assert.match(flags, /gsap\.min\.js loaded twice/);
  assert.match(flags, /1 <img> without width and height/);
  assert.doesNotMatch(flags, /core\.js/);
  assert.doesNotMatch(flags, /cache never answered/);
});

test('compare reports deltas for pages present in both runs', () => {
  const p = (jsGzip, blocking) => ({
    url: 'https://example.com/',
    fetches: [{ ttfb: 100 }],
    htmlBytes: 2048,
    jsGzip,
    cssGzip: 1024,
    scripts: Array.from({ length: blocking }, () => ({ module: false, async: false, defer: false })),
  });
  const out = compare(
    { measuredAt: 'a', pages: [p(300 * 1024, 5)] },
    { measuredAt: 'b', pages: [p(200 * 1024, 1)] },
  );
  assert.match(out, /js gzip KB 300→200 \(-100\)/);
  assert.match(out, /blocking scripts 5→1 \(-4\)/);
});

test('summarize warns when a run ended somewhere other than the page', () => {
  const report = {
    requestedUrl: 'https://example.com/',
    finalDisplayedUrl: 'https://team.cloudflareaccess.com/login',
    categories: { performance: { score: 0.5 } },
    audits: { 'largest-contentful-paint': { numericValue: 4100 } },
  };
  const out = summarize([{ slug: 'home', form: 'mobile', report }]);
  assert.match(out, /home\/mobile: ended on https:\/\/team\.cloudflareaccess\.com\/login/);
  assert.match(out, /\b50\b/);
});
