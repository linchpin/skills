---
name: wp-design-tokens
description: Make theme.json the single source of truth for a theme's color, type, spacing, and shadow — the slug vocabulary, the theme.json-vs-SCSS precedence rules that make an edit appear to do nothing, and where Linchpin's brand values actually live. Use when changing or adding a brand color, when setting up a palette, when headings won't scale down on mobile, when a button style variation isn't applying, or when fixing a contrast finding. Not for choosing or standing up a theme — use `wp-theme-baseline`.
version: 0.1.0
---

# Design tokens in theme.json

`theme.json` is where a Linchpin theme's design decisions live, and three things about it
routinely cost an afternoon:

1. **A token edit can appear to do nothing.** WordPress wraps `theme.json` element styles in
   `:where()`, giving them **zero specificity** — so ordinary SCSS beats them silently. The
   edit was correct; something else was winning.
2. **Preset arrays replace, they don't merge.** A partial list drops every entry you left out.
3. **The brand is multi-sourced.** Values live in `theme.json`, in SCSS maps that
   deliberately override it, and in `settings.custom` tokens that appear in neither palette.
   Knowing which one governs is most of the job.

## When to use

- Changing or adding a brand color, font, spacing step, or shadow.
- Setting up the palette and type scale for a theme.
- "Make the headings smaller on mobile."
- A block style variation isn't applying, or a color change didn't take.
- Fixing a contrast finding from [`wp-audit`](../wp-audit/SKILL.md).

**Not this skill:**

- Choosing or standing up a theme → [`wp-theme-baseline`](../wp-theme-baseline/SKILL.md).
- Writing block markup that *uses* tokens → [`wordpress-blocks`](../wordpress-blocks/SKILL.md).
- Custom block code → [`wp-block-conventions`](../wp-block-conventions/SKILL.md).
- Generic `theme.json` mechanics (the style cascade, template parts) → upstream
  `wp-block-themes`.

## Owns

Canonical for: the token vocabulary, the `theme.json` ↔ SCSS precedence rules, and where
Linchpin's brand values live.
Defers: baseline decisions → [`wp-theme-baseline`](../wp-theme-baseline/SKILL.md); measuring
contrast and performance → [`wp-audit`](../wp-audit/SKILL.md).

## Preflight — find every place the value could live

| Look for | Tells you | If missing |
| --- | --- | --- |
| `themes/*/theme.json` | Which theme governs; on a child, the parent's is also in play | No `theme.json` → not a block theme; stop and re-scope |
| `assets/scss/config/_variables.scss` (SCSS maps) | Whether SCSS **overrides** `theme.json` for this value | No SCSS → `theme.json` is the only lever |
| `settings.custom.*` in `theme.json` | Non-preset tokens (weights, line heights, button colors) | — |
| `styles/**/*.json` | Style variations that re-declare the palette | No variations → one palette only |
| The project's `CLAUDE.md` / `AGENTS.md` | Project-specific carve-outs that win over this skill | — |

## Where the Linchpin brand lives

| Source | Use it for |
| --- | --- |
| `themes/linchpin/theme.json` in `linchpin.com` | The **exhaustive** brand values. Paint-named slugs (`primary`, `secondary`, `tertiary`, `warm`, `zebra-dark`…) |
| `themes/docspress-linchpin/theme.json` in `linchpin.com` | The **role-named** re-cut with a full dark-mode set and `color-mix()` derivations — the better model for a new property |
| `base-wp-theme-2026` | **Nothing.** Never launched, and its palette is stale (`green` `#8fca52` vs `#BFD200`). See [`wp-theme-baseline`](../wp-theme-baseline/SKILL.md) |

### Role names, not paint names

Name a slug for the **job** it does (`accent`, `ink`, `paper`, `canvas`, `copy`, `muted`,
`line`), not the paint in it (`teal`, `green`, `dark-gray-2`). Role names let a style
variation swap an entire palette without touching a pattern; paint names force every pattern
to carry a specific color, so variations can't swap them.

This is a real regression in our own history, and it played out in two steps: Ollie's 11 role
slugs were kept but ~23 paint names were appended alongside them in `base-wp-theme-2026`, and
`themes/linchpin` then dropped its style variations from 23 to 2 — because a variation has to
redeclare every slug a pattern might carry, and paint names make that unmaintainable. Paint
names don't just make variations awkward; they eventually kill them.

### The Linchpin slug vocabulary

Reach for the **structural** slugs — they carry 96% of usage (1,740 of 1,813 references in
`themes/linchpin`) and they are the ones a style variation can swap: `base` (light surface),
`main` (Linchpin black), `primary` / `secondary` / `tertiary` (teal / magenta / navy), their
tints `primary-accent`, `main-accent`, `primary-dark`, `tertiary-dark`, `zebra-dark`, and the
hairlines `border-light` / `border-dark`.

**Legacy paint names — not for new work:** `true-black`, `almost-black`, `gray`,
`medium-gray`, `green`, `yellow`, `warm`, `accent`. ~73 references, and the reason color
variations are impractical. `white-25` and `black-10` are the defensible exceptions — they
express opacity, not hue.

**`accent` is ambiguous across our themes** — purple `#7D58C6` in `themes/linchpin`, teal
`#3fc1d0` in `themes/docspress-linchpin`. Read the palette; never assume.

**Retiring a slug is not a rename.** Every `themes/linchpin` slug holds a distinct value, so
each remap changes appearance — and dropping one stops WordPress emitting its
`--wp--preset--color--*` rule, silently breaking saved content that carries
`has-<slug>-background-color`. Audit live content first, and get the visual change signed off.

**Corollary:** a pattern may only carry slugs that exist in **every** variation it will be
seen under. A slug added to one variation only is a broken pattern waiting for a theme switch.

### The portable token layer

These travel between Linchpin properties unchanged — copy them verbatim into a new theme:

- `settings.custom.fontWeight` — the 9-step map. Note **`regular: 425`**, not 400: it's a
  variable-font optical choice, and "correcting" it to 400 visibly lightens body copy.
- `settings.custom.lineHeight` — `none` 1, `tight` 1.1, `snug` 1.2, `body` 1.5,
  `relaxed` 1.625, `loose` 2.
- `settings.custom.button` — `radius`, `textOnAction`, `textOnLight`, and the hover/pressed
  steps.
- The `flare` / `flare-hover` / `flare-pressed` shadow presets — offset double shadows in
  secondary + primary at 4px / 8px / 4px. These are brand, not decoration.

## The rules

### 1. Never hardcode a hex — except in a palette definition

A raw hex must never appear in **pattern markup, block attributes, theme SCSS, or block JS**.
Patterns and saved blocks travel with the content, so a baked hex keeps the *old* color
forever when the brand moves.

```jsonc
// ✅ slug — follows the palette
{ "backgroundColor": "accent", "textColor": "paper" }
// ❌ baked hex — goes stale silently
{ "style": { "color": { "background": "#3fc1d0", "text": "#ffffff" } } }
```

**The carve-out:** `settings.color.palette` is *where hexes belong* — it is the declaration,
not a usage. A child theme has no access to a sibling theme's presets, so it must declare the
brand values literally. Seeing literal hexes in a `theme.json` palette is correct; flagging
them as a violation and "fixing" them breaks the theme.

A hex that matches no slug → add it to the palette first, then reference the slug. In SCSS and
gradients, use `var(--wp--preset--color--<slug>)`, including inside `linear-gradient()`.

### 2. Button color belongs in theme.json, never in SCSS

The button lives in `settings.custom.button.*`, `styles.elements.button`, and
`styles.blocks.core/button.variations`. A theme's `_button.scss` must **not** set `color`,
`background`, or `border` on `.wp-element-button` — its selectors out-specify WordPress's
`:where()`-wrapped variation CSS, so any color set there silently overrides `theme.json` and
every `is-style-button-*` variation stops working.

SCSS may own shared structure, focus and disabled states, and the non-core controls
`theme.json`'s button element doesn't reach (`.wp-block-search__button`,
`input[type="submit"]`).

### 3. Spacing is a 4px base-4 scale

Spacing, padding, component dimensions, and effect offsets are multiples of 4 (4, 8, 12, 16,
24, 32, 40, 48…). Match design values onto that grid. Hairline borders of 1–2px are exempt.

### 4. Mobile type has two levers, and SCSS wins

Asked to make type scale down on small screens: lower the clamp **floor** and keep the
desktop ceiling, so wide layouts render identically. There are two authoritative levers and
**both** usually need editing:

1. **Headings** → the theme's SCSS `$heading-size-map` (in `assets/scss/config/_variables.scss`
   where present). This **beats** `theme.json`'s `styles.elements.h1`, which is `:where()`-wrapped
   at zero specificity.
2. **Font-size presets** → `theme.json` `settings.typography.fontSizes[].fluid.min` — the
   mobile floor for explicit `.has-<slug>-font-size` usage.

Editing only `theme.json` produces no visible change and reads as a stale cache. It isn't.
Blocks with their own scoped `clamp()` are separate carve-outs — check the project's
`CLAUDE.md`.

### 5. Preset arrays replace, they don't merge

`theme.json` swaps a preset array wholesale instead of merging by slug. On a child theme, a
partial `color.palette` or `typography.fontFamilies` **drops** every parent entry you omitted
— a missing `mono` family is how code blocks lose their font. Declare the parent's full list,
then change the values you need.

### 6. Contrast is part of the token decision

A color pairing is a decision with a measurable outcome. When a palette or button pairing
falls below WCAG AA (4.5:1 for body text, 3:1 for large text and UI), **state the measured
ratio and escalate** — don't quietly substitute a different color, and don't ship it
unremarked either.

Known open item: the button contract `primary` `#3fc1d0` with `#ffffff` text measures
**2.15:1**, below AA. `settings.custom.button.textOnLight` `#0f2051` on the same teal gives
7.25:1. Raised in `linchpin.com` PR #918; no decision recorded. Surface it rather than
assuming it was settled.

## Adding or changing a token

1. **Locate the governing source** via Preflight — `theme.json`, an SCSS map, or a variation.
2. **Change the declaration**, not the usage. New color → palette entry first, then slugs.
3. **Mirror any duplicated map.** Some themes keep a `$colors` map in
   `assets/scss/config/_variables.scss` that repeats the palette; it drifts if left behind.
4. **Check every variation** in `styles/` still declares the slug (rule: role names + the
   corollary above).
5. **Measure contrast** if the change touches a text/background pairing.
6. **Flush and verify** (below). → the emitted `--wp--preset--*` property shows the new value.

## Verify a token change

`theme.json` is read live — there is no build step, but there *is* a cache. Via
[`wp-studio-cli`](../wp-studio-cli/SKILL.md):

```bash
wp eval 'wp_clean_theme_json_cache();'
wp transient delete --all
```

Then in the browser ([`browser-automation`](../browser-automation/SKILL.md)) confirm the
custom property resolves on `:root` — not just that the page "looks right":

```js
getComputedStyle( document.documentElement ).getPropertyValue( '--wp--preset--color--accent' )
```

Test mobile type at **device emulation**, not a resized desktop window — container-query
context and the admin bar differ.

## Quick reference — "I want to change X, where do I edit?"

| Change | Edit here |
| --- | --- |
| Any color | a palette **slug** / `var(--wp--preset--color--<slug>)` — never a hex in markup or SCSS |
| Add a color | `settings.color.palette` (hex belongs here), then reference the slug |
| Button color or variation | `theme.json` `styles.blocks.core/button.variations` — **not** `_button.scss` |
| Any spacing value | a multiple of 4px |
| Heading size on mobile | the SCSS `$heading-size-map` floor (wins over `theme.json`) |
| Preset font size on mobile | `theme.json` `fontSizes[].fluid.min` |
| Font weight / line height | `settings.custom.fontWeight` / `.lineHeight` (`regular` is 425) |
| A child theme's palette | the **complete** array — partial lists drop the parent's entries |
| Tokens from a Figma file | [`references/figma-token-pipeline.md`](references/figma-token-pipeline.md) |

## Guardrails

- **Never put a raw hex in pattern markup, block attributes, theme SCSS, or block JS.** A
  palette declaration is the one exception.
- **Never set `color`, `background`, or `border` on `.wp-element-button` in SCSS** — it
  out-specifies `theme.json` and kills every button variation.
- **Never declare a partial preset array** on a child theme.
- **Never add a slug to one style variation only** — patterns using it break on a theme switch.
- **Never claim a token change works without flushing** `wp_clean_theme_json_cache()` and
  confirming the emitted custom property.
- **Never ship a text/background pairing below AA without stating the measured ratio.**
- **Never treat `base-wp-theme-2026` as a brand source** — it was never launched and its
  palette is stale.
- If a change needs `!important` to land, something out-specifies `theme.json` — find it
  rather than escalating specificity.

## Done

- [ ] The value changed in its **governing** source, not a downstream usage.
- [ ] No raw hex added outside a palette declaration; any duplicated SCSS map updated too.
- [ ] Every style variation still declares the slugs its patterns use.
- [ ] Contrast measured and stated for any text/background pairing touched.
- [ ] Cache flushed, and the emitted `--wp--preset--*` property confirmed in the browser.
- [ ] Mobile type verified at device emulation, if type changed.
