# Theme baseline precedents

Why the routes in `SKILL.md` are ordered the way they are. Two of our own themes settle it.
Read this when someone proposes forking, or proposes a baseline that has already been tried.

---

## The lineage: Ollie → base-wp-theme-2026 → themes/linchpin

`base-wp-theme-2026` is a de-branded **fork of [Ollie](https://olliewp.com)**, and
`themes/linchpin` (in `linchpin.com`) is that fork evolved. The fork is visible in the files:

| Ollie artifact | Still present in `base-wp-theme-2026` |
| --- | --- |
| The slug vocabulary — `primary`, `primary-accent`, `secondary`, `tertiary`, `base`, `main`, `main-accent`, `border-light`, `border-dark` | Same slug names (values were re-branded: Ollie's `border-light` is `#E3E3F0`, ours `#DADEE3`) |
| Spacing slugs `none`…`xxxx-large` and font-size slugs `x-small`…`xx-large` | Same sets |
| `settings.custom.fontWeight` / `.lineHeight` maps, including `regular: 425` | Verbatim |
| 8 bundled variable woff2 fonts | 7 of 8 (only `geist` dropped) |
| One-line templates delegating to `patterns/template-*.php` | Yes — Ollie's design, not ours |
| `remove_theme_support( 'core-block-patterns' )` | `includes/class-setup.php` |
| A `sidebar` area via `default_wp_template_part_areas` | `includes/class-setup.php` |
| Pattern categories registered at priority 9 | `includes/class-blocks.php` |
| `.ollie-row-stack` / `.ollie-flex-start` | Compiled into `css/refresh.css` |
| Ollie Pro mega-menu selector | `assets/scss/components/_navigation.scss` |

Ollie is still Composer-installed in `linchpin.com` (`wp-theme/ollie`, untracked, not active),
but only to satisfy Ollie Pro's parent-theme check — which
`plugins/linchpin-functionality/…/Ollie_Pro.php` then deliberately removes.

**Consequence:** "let's start from Ollie" is a loop. We already forked it. Starting there again
means redoing that work minus everything layered on since.

### What the fork regressed — and why it matters

Measured across the three themes (counts verified against the files):

| | Ollie | `base-wp-theme-2026` | `themes/linchpin` |
| --- | --- | --- | --- |
| Palette entries | **11**, all role-named — `primary`, `main`, `base`, `tertiary`, `border-light`… | **34** (33 distinct — `base` is declared twice); Ollie's 11 kept, plus ~23 paint names bolted on | 23 — Ollie's structural core, plus a ~10-slug paint tail |
| Style variations | **27** (5 full presets, 7 color, 10 typography, 5 button) | 23 — most of Ollie's kept | **2** — only `styles/block/` |
| Build | None. Hand-written CSS, clone-and-go | `wp-scripts` + webpack + SCSS | same |

Measured against the 265 pattern and part files in `themes/linchpin` — 1,813 slug
references in total — the damage is narrower than the palette size suggests:

- **96% of usage already flows through Ollie's structural slugs.** The top six are `base`
  (557), `primary` (277), `border-light` (236), `main-accent` (203), `secondary` (178) and
  `main` (143).
- **The paint tail is 73 references, about 4%** — `true-black` 35, `white-25` 11, `green` 5,
  `gray` 4, `medium-gray` 4, `warm` 4, `black-10` 4, `yellow` 2, `accent` 2, `almost-black` 2.

So the fork did not throw the vocabulary away; it kept the structural core and appended paint
names alongside. That tail is still what makes a color style variation impractical — a
variation has to redeclare every slug a pattern might carry — but retiring it is **not** a
mechanical rename. Every slug in the palette is a distinct value (there are no duplicates), so
each remap is a visual change, and dropping a slug also breaks saved post content carrying
`has-<slug>-background-color`. Treat it as design work with a content audit, not a find and
replace.

The two regressions happened at different stages, and the order is the point:

1. **`base-wp-theme-2026` swapped the palette** from 11 role names to 34 paint names, while
   still carrying 23 style variations.
2. **`themes/linchpin` then dropped the variations to 2.** That follows from step 1 — once slugs
   name paint instead of roles, a color variation can't swap them without breaking every pattern
   that hardcoded `has-proposal-green-background-color`. The variations became unmaintainable, so
   they went.

Role names are why Ollie ships 27 variations without touching a single pattern: a variation
re-declares the same 11 slugs with different values. This is also the problem
`themes/linchpin/_audits/PLAN.md` is now working through ("theme.json slugs only — never hex").

**Take from Ollie: the role vocabulary and the `styles/` variation architecture. Don't take the
theme.**

### `base-wp-theme-2026` was never launched

It is the culmination of an evaluation — nothing shipped on it. Treat it as a reference, not a
starting point. It also carries defects that make it actively misleading as a token source:

- `theme.json` declares its `primary` font family as `file:./assets/fonts/Mozaic-GEO-Variable.ttf`
  — **that file is not in the repo**, so a clone renders in fallback `sans-serif` with no error.
- A duplicate `base` palette slug, and `dark-gray-1` / `med-gray-2` / `lgt-gray-2` duplicating
  three other slugs' hexes.
- `styles.elements.button` references a `white` color slug and `caption` a `normal` font size;
  neither exists.
- `core/post-title` h1 at `fontSize: "10px"`; `core/read-more` with `200px` link margins;
  `xx-large` smaller than `x-large`.
- `parts/sidebar.html` is declared in `templateParts` but does not exist.
- 12 pattern categories are used by patterns but never registered.
- `LINCHPIN_BASE_THEME_DEBUG` is hard-coded `true`, so `delete_pattern_cache()` runs on every
  request against ~239 patterns.
- `README.md` is still a copy of the Frost theme's, documenting `composer` commands that don't
  exist (there is no `composer.json`).

Its palette is also **stale relative to the brand**: `green` is `#8fca52` there against
`#BFD200` in `linchpin.com`, and it lacks `accent`, `primary-dark`, `zebra-dark`, `warm`,
`border.radiusSizes`, the `flare` shadow presets, and the logo `dimensions.aspectRatios`.

---

## The worked example: themes/docspress-linchpin

Shipped 2026-07-29 (`linchpin.com` PR #921) — our only shipped Linchpin-branded property theme,
and the model Route A is written from.

**Nine files.** `style.css` (~94 lines), `theme.json` (~209), `functions.php` (20),
`includes/enqueue.php` (29), four Mozaic font files, one `parts/footer.html`. No templates, no
patterns, no build tooling.

**Parent:** `linchpin/docspress` (a private mirror of Automattic's DocsPress),
Composer-installed and untracked.

### Why child, not fork

The parent is an application, not a skin: ~1,940 lines of PHP across `functions.php`,
`inc/blocks.php`, `inc/llms.php`, `inc/performance.php`, plus a ~4,255-line `style.css`. It
released `0.9.10 → 0.9.19` in short order. A fork means re-reconciling all of that on every
release.

### Why it works with almost no CSS

The parent keeps its own `--dp-*` token layer and feeds it from WordPress presets. Measured
against `themes/docspress/style.css` (4,255 lines):

| | Count |
| --- | --- |
| Distinct `--dp-*` tokens defined | 32 |
| `--dp-*` definitions whose value is a `var(--wp--preset--*)` / `var(--wp--custom--*)` | 41 (some defined twice — light and dark) |
| `var(--dp-*)` usages across the stylesheet | 383 |
| Hardcoded hex values remaining | 40 |

So re-declaring the preset slugs reaches 383 usages through a 41-definition seam, and only 40
hexes sit outside it. It also references just two font-family slugs in its styles — `ui` and
`mono` — so pointing `ui` at Mozaic GEO covers body copy, headings, and buttons at once.

**This ratio is the check that decides Route A** — see the preset-coverage command in
[`../SKILL.md`](../SKILL.md). Run it on any candidate parent before committing to a child theme.

### The three traps it hit

1. **`get_stylesheet_uri()`.** DocsPress enqueues its CSS with that function, which resolves to
   the *active* theme — so with the child active it pointed at the child's near-empty
   `style.css` and the parent's 4,255 lines, `@font-face` rules included, never loaded. Fixed
   with `add_action( 'wp_enqueue_scripts', 'linchpin_docs_enqueue_parent_style', 5 )`; priority
   5 puts the parent ahead of the parent's own priority-10 enqueue, so child overrides win at
   equal specificity without `!important`.
2. **Preset arrays replace, they don't merge.** A partial palette or font list drops the
   parent's remaining entries — hence all 25 colors and all 7 font families are declared in
   full, including the parent's `inter`, `mono`, and three others carried over unchanged.
3. **Fonts are copied, not referenced.** The Mozaic files are byte-identical duplicates of the
   ones in `themes/linchpin`, because `file:./` resolves against the active theme and the child
   must not depend on a sibling theme being installed.

One more, from the uncommitted follow-up work: don't reach for `font-variation-settings` to
normalize a variable font's weights — it inherits and outranks `font-weight`, so setting it on
`body` pins every heading and button to the body weight.

### What it borrowed vs. invented

The role vocabulary — `accent`, `accent-strong`, `accent-soft`, `highlight`, `paper`, `canvas`,
`ink`, `copy`, `muted`, `line`, `code`, plus a parallel `dark-*` set — is **DocsPress's**. The
child kept the parent's slug names and swapped the values. Linchpin's contribution was the
*mapping*: which brand paint fills which role, with contrast math behind the non-mechanical
calls (`accent-strong` → `#1B4475` for body-copy links at 9.86:1; `muted` → `#444B57` at 8.79:1
because `medium-gray` `#8e949a` measures 3.06:1 and fails AA).

Four slugs are derived rather than fixed, using CSS `color-mix()` — e.g.
`accent-soft: color-mix(in srgb, #3fc1d0 14%, #ffffff)`. This mirrors the parent's own approach.

**Open item:** the role vocabulary is still the parent's, not ours. Until Linchpin owns a role
vocabulary (with aliases in `themes/linchpin`), each new property child inherits *its* parent's
names and the properties keep diverging. See [`wp-design-tokens`](../../wp-design-tokens/SKILL.md).
