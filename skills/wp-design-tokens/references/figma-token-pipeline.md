# Figma → theme.json

Linchpin maintains `figma-to-wordpress-theme-json-exporter` (a fork of 10up's plugin,
re-architected in-house). Read this before promising a design-to-token pipeline, because its
shape constrains what's possible.

## What it is, and the honest limitation

**It is a Figma plugin a human clicks through — not a CLI, not a script, not an API client.**
An agent cannot run it. There is no headless or CI path: someone opens the Figma file, picks
collections, and downloads the output.

- Version 1.3.0, branch `develop`, **self-described Beta** ("be cautious using this in
  production").
- Four menu commands: **Export** to `theme.json`, **Import** from `theme.json` (creates Figma
  variables), **Create from schema**, and **Apply CSS Variable Syntax**.
- Input: the open Figma document's local **variable collections**, **text styles**, and **paint
  styles** — plus an optional uploaded base `theme.json` to merge into. No node IDs, no token.

**It has never been run against `themes/linchpin`.** There's no trace of its output shape in
that theme (no `styles/section-*.json`, no camelCase `settings.custom` in its idiom). So treat
anything it produces as a **starting point to reconcile against the existing palette**, not a
source of truth. The current pipeline from design to tokens is a human reading Figma and
matching values onto the 4px grid.

## Output

A full v3 `theme.json` (with `$schema`), optionally as a zip:

```
wordpress-theme-files.zip
├── theme.json
└── styles/
    ├── section-{mode}.json      # one per Figma color mode
    └── button-{variant}.json    # one per non-primary button variant
```

## The naming contract

Routing is **by collection name**. Get these wrong and everything lands in `settings.custom`
instead of real WordPress settings:

| Figma collection | Lands in |
| --- | --- |
| `Primitives` | `settings.custom` (unnamespaced, always emitted first) |
| `wp.settings.color` / `wp.settings.colors` | `settings.color.palette` — deliberately *not* `settings.custom` |
| `wp.settings.typography` / `.spacing` / `.layout` / `.shadow` | the matching `settings.*` |
| `wp.settings.background` / `.border` / `.dimensions` / `.position` | the matching v3 settings |
| `wp.styles` | body-level `styles.*` |
| `wp.elements.<element>` | `styles.elements.<element>` |
| `wp.blocks.<namespace/block>` | `styles.blocks.<namespace/block>` |
| anything else | `settings.custom`, under a sanitized name |

Slug generation differs by domain, which is a real footgun:

- **Color** — the whole variable name is slugified, so `color/brand/primary` → slug
  `color-brand-primary`. The human label comes from the matching *paint style* name.
- **Spacing** — only the **last** path segment, with camelCase split: `spacing/scale/xLarge`
  → `x-large`. A `24_16` pattern becomes a fluid pair labeled `Fluid (16 → 24)`.
- **Typography** — the last segment of the *text style* name.
- **`settings.custom`** — Figma names are camelCased on the way in, and WordPress renders them
  back to kebab CSS vars: `settings.custom.colorPalette.brandAccent` becomes
  `--wp--custom--color-palette--brand-accent`.

Other behaviors worth knowing: `px` is auto-appended for `spacing|font|size|grid|radius|width|height`;
px→rem conversion at a 16px base is optional; a two-mode `Desktop`/`Mobile` collection becomes
`{ fluid: "true", min, max }` (the string `"true"`, intentionally); `120%` line height becomes
`1.2`; pseudo-selector prefixes like `:hover/color/background` are supported for elements and
blocks.

## What it does not do

- **No `fontFace` / `src` emission** — self-hosted fonts (Mozaic) stay a manual step, including
  the file copy. See rule 5 and the child-theme font rule in
  [`../../wp-theme-baseline/SKILL.md`](../../wp-theme-baseline/SKILL.md).
- **No components, frames, layout, patterns, or templates** — variables and styles only.
- **No round-trip sync or diffing** against a live theme. Merging is one-way into an uploaded
  base file.
- **Spacing detection is keyword-based** (`spacing|gap|margin|padding|size`), so an oddly-named
  scale is silently skipped.
- Colors in `wp.settings.color` are excluded from `settings.custom` by design.

## If you use it

1. Name the Figma collections to the contract above **before** exporting.
2. Upload the theme's current `theme.json` as the merge base, so nothing existing is lost.
3. Diff the output against the current palette by **slug**, and reconcile by hand — remember
   preset arrays replace rather than merge.
4. Re-add `fontFace` blocks and copy the font files in.
5. Verify per the flush-and-check step in [`../SKILL.md`](../SKILL.md).
