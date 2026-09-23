---
title: wp-design-tokens
---

`theme.json` is where a Linchpin theme's design decisions live. Three things about it routinely cost an afternoon: a token edit can appear to do nothing, because WordPress wraps element styles in `:where()` at zero specificity; preset arrays replace rather than merge, so a partial list silently drops every entry left out; and the brand is multi-sourced across `theme.json`, SCSS overrides, and `settings.custom` tokens.

## When to reach for it

- Changing or adding a brand color, font, spacing step, or shadow.
- Setting up the palette and type scale for a theme.
- "Make the headings smaller on mobile."
- A block style variation isn't applying, or a color change didn't take.
- Fixing a contrast finding from [`wp-audit`](wp-audit.md).

## Where it stops

> **Not this skill:**
>
> - Choosing or standing up a theme → [`wp-theme-baseline`](wp-theme-baseline.md).
> - Writing block markup that *uses* tokens → [`wordpress-blocks`](wordpress-blocks.md).
> - Custom block code → [`wp-block-conventions`](wp-block-conventions.md).
> - Generic `theme.json` mechanics (the style cascade, template parts) → upstream [`wp-block-themes`](../upstream.md).

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Locate the governing source","content":"<p>Work out whether the value lives in theme.json, a duplicated SCSS map, or a style variation — see What it checks first below.</p>"},{"title":"Change the declaration, not the usage","content":"<p>A new color goes into the palette first, then gets referenced by slug. Mirror any duplicated SCSS color map, or the two drift apart.</p>"},{"title":"Check every style variation","content":"<p>Confirm every variation in styles/ still declares the slug — a pattern using a slug missing from one variation breaks on a theme switch.</p>"},{"title":"Measure contrast","content":"<p>For any text/background pairing touched, measure every interaction state, not just resting, against WCAG AA.</p>"},{"title":"Flush and verify","content":"<p>Clear the theme.json cache and confirm the emitted --wp--preset--* custom property resolves in the browser, checking mobile type at device emulation rather than a resized window.</p>"}]} /-->

Quick reference for where a change actually lands:

| Change | Edit here |
| --- | --- |
| Any color | a palette slug — never a hex in markup or SCSS |
| Button color or variation | `theme.json` button variations, not `_button.scss` |
| Heading size on mobile | the SCSS heading-size map floor — it wins over `theme.json` |
| A child theme's palette | the complete array — a partial list drops the parent's entries |

## What it checks first

- `themes/*/theme.json` — which theme governs; on a child theme, the parent's is also in play.
- `assets/scss/config/_variables.scss` (SCSS maps) — whether SCSS overrides `theme.json` for this value.
- `settings.custom.*` in `theme.json` — non-preset tokens such as weights, line heights, and button colors.
- `styles/**/*.json` — style variations that re-declare the palette.
- The project's `CLAUDE.md`/`AGENTS.md` — project-specific carve-outs that win over this skill.

## What it owns

Canonical for: the token vocabulary, the `theme.json` ↔ SCSS precedence rules, and where Linchpin's brand values live. Defers: baseline decisions → [`wp-theme-baseline`](wp-theme-baseline.md); measuring contrast and performance → [`wp-audit`](wp-audit.md).

## Guardrails

- Never put a raw hex in pattern markup, block attributes, theme SCSS, or block JS — a palette declaration is the one exception.
- Never set `color`, `background`, or `border` on `.wp-element-button` in SCSS — it out-specifies `theme.json` and kills every button variation.
- Never declare a partial preset array on a child theme.
- Never add a slug to one style variation only — patterns using it break on a theme switch.
- Never claim a token change works without flushing the cache and confirming the emitted custom property.
- Never judge contrast from the resting state alone — measure hover and active too, and never ship a pairing below AA without stating the measured ratio.
- Never treat `base-wp-theme-2026` as a brand source — it was never launched and its palette is stale.

## Done when

- [ ] The value changed in its governing source, not a downstream usage.
- [ ] No raw hex added outside a palette declaration; any duplicated SCSS map updated too.
- [ ] Every style variation still declares the slugs its patterns use.
- [ ] Contrast measured and stated for any text/background pairing touched.
- [ ] Cache flushed, and the emitted `--wp--preset--*` property confirmed in the browser.
- [ ] Mobile type verified at device emulation, if type changed.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/wp-design-tokens/SKILL.md) is the skill.
- [`references/figma-token-pipeline.md`](https://github.com/linchpin/skills/blob/main/skills/wp-design-tokens/references/figma-token-pipeline.md) — what the Figma-to-`theme.json` exporter plugin can and can't do, its collection-naming contract, and the honest limitation that it's a human-operated Figma plugin, not a script or API.

`allowed-tools` pre-approves only reading and searching files (`Read Grep Glob`). It runs no commands.

## Related skills

- [`wp-theme-baseline`](wp-theme-baseline.md) — owns choosing or standing up the theme, and where Linchpin's brand's canonical sources live.
- [`wordpress-blocks`](wordpress-blocks.md) — owns block markup that uses these tokens.
- [`wp-block-conventions`](wp-block-conventions.md) — owns custom block code.
- [`wp-block-themes`](../upstream.md) (upstream) — owns generic `theme.json` mechanics: the style cascade and template parts.
- [`wp-audit`](wp-audit.md) — owns measuring contrast and performance, and is where a contrast finding comes from.
- [`wp-studio-cli`](wp-studio-cli.md) — runs the cache-flush and WP-CLI checks used to verify a token change.
- [`browser-automation`](browser-automation.md) — confirms the emitted custom property in the browser.
