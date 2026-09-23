---
title: wp-theme-baseline
---

Most of the cost of a theme is decided before the first commit, by one question: how much code is being taken on. Re-declaring tokens beats porting code, and a fork is a standing debt that falls further behind with every parent release. Child theme first, fresh second, fork last.

## When to reach for it

- Starting the theme for a new Linchpin property — a microsite, product, or docs site.
- A third-party theme needs a Linchpin-branded version.
- Deciding whether to child-theme, fork, or start clean.
- Working out where an existing block theme's page layouts actually live (they are often not in `templates/`).

## Where it stops

> **Not this skill:**
>
> - The project repo and the local site → [`wp-local-setup`](wp-local-setup.md).
> - Palette, type, and spacing values once a baseline exists → [`wp-design-tokens`](wp-design-tokens.md).
> - Whether the request is theme work at all → [`wp-implementation-choice`](wp-implementation-choice.md).
> - Generic block-theme mechanics (template hierarchy, the style cascade) → upstream [`wp-block-themes`](../upstream.md).

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Choose the route","content":"<p>Read the candidate parent's preset-coverage ratio to decide: a parent that owns behavior and tokenizes its CSS gets a child theme, nothing suitable gets a fresh block theme, and only a parent whose behavior must change structurally gets forked. State the route and the reason back to the user before building.</p>"},{"title":"Build the child theme","content":"<p>Composer-install the parent, set the Template: header, declare complete preset arrays rather than partial ones, copy fonts into the child, fix the stylesheet enqueue if the parent uses get_stylesheet_uri(), and keep declarations in includes/.</p>"},{"title":"Or start fresh","content":"<p>Build small — style.css, theme.json, templates, parts, patterns, functions.php — with role-named slugs instead of paint names, and record whether templates delegate to patterns.</p>"},{"title":"Verify","content":"<p>Confirm the active theme and its parent, flush the theme.json cache, then load the front page, an inner page, and wp-admin in a browser — on a child theme, confirm the parent's stylesheet is enqueued and no font 404s.</p>"}]} /-->

## What it checks first

Before recommending a route, it reads the candidate parent rather than assuming:

| Reads | Tells you |
| --- | --- |
| Whether a credible parent owns behavior (docs, commerce, membership) | A child theme is likely |
| Preset coverage in the parent's CSS — a ratio, not a threshold | Whether its styling actually flows from WP presets or hardcoded values |
| Line count and release cadence of the parent's PHP | The cost of forking it |
| `get_stylesheet_uri()` usage in the parent | Whether the child needs the enqueue fix |
| Line count of `templates/*.html` | Whether layouts are real markup or one-line pattern delegations |

## What it owns

Canonical for: the baseline decision, the child-theme procedure, and the closed questions about which of our themes to start from. It defers token values to [`wp-design-tokens`](wp-design-tokens.md) and custom blocks to [`wp-block-conventions`](wp-block-conventions.md).

## Guardrails

- Never fork a theme that owns behavior when re-declaring tokens would do — you inherit every future release as manual work.
- Never declare a partial preset array on a child theme; arrays replace, not merge, and omitted slugs vanish while the parent's CSS breaks quietly.
- Never point `theme.json` at a font file that isn't in this theme — a missing file falls back silently and the page just looks wrong.
- Never leave a child's `style.css` as the only enqueued sheet when the parent uses `get_stylesheet_uri()`.
- Never commit a Composer-installed parent theme — the `.gitignore` allowlist covers project code only.
- If the parent turns out not to tokenize its CSS, stop and re-decide the route rather than writing override CSS to compensate.

## Done when

- [ ] The route is stated, with the reason, and the token-coverage check that supports it.
- [ ] On a child theme: `Template:` header set, parent Composer-installed and untracked, preset arrays complete, fonts copied in, parent stylesheet enqueued if needed.
- [ ] `theme.json` references no file outside this theme.
- [ ] Front page, an inner page, and `/wp-admin` render on the new theme with no 404s.
- [ ] Token values handed to [`wp-design-tokens`](wp-design-tokens.md).
- [ ] Any baseline decision worth remembering is recorded in the project's `CLAUDE.md`, and the work is tied to a task.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/wp-theme-baseline/SKILL.md) is the skill's main instructions.
- [`references/theme-baseline-precedents.md`](https://github.com/linchpin/skills/blob/main/skills/wp-theme-baseline/references/theme-baseline-precedents.md) — case studies (the Ollie → base-wp-theme-2026 → themes/linchpin lineage, and the docspress-linchpin child theme) that justify the route ordering.

Pre-approved, so the agent can run them without a prompt: reading and searching files, and `git status`. Anything that writes still asks.

## Related skills

- [`wp-local-setup`](wp-local-setup.md) — owns the project repo and the local site the theme is built into.
- [`wp-design-tokens`](wp-design-tokens.md) — owns palette, type, and spacing values once a baseline exists.
- [`wp-implementation-choice`](wp-implementation-choice.md) — decides whether the request is theme work at all.
- [`wp-block-themes`](../upstream.md) — upstream skill for generic block-theme mechanics.
- [`wp-studio-cli`](wp-studio-cli.md) — runs the `wp theme` and `wp eval` verification commands.
- [`browser-automation`](browser-automation.md) — loads the front page, an inner page, and wp-admin to verify.
- [`task-tracking`](task-tracking.md) — ties the baseline decision to a task.
