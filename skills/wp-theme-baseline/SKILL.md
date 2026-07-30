---
name: wp-theme-baseline
description: Choose and stand up the baseline for a new Linchpin property theme — a child theme of a parent that owns behavior, a fresh block theme, or (last resort) a fork — then make it the property's own. Use when starting the theme for a new Linchpin site, when deciding whether something should be a child theme, when a third-party theme needs a Linchpin-branded version, or when working out where a block theme's page layouts actually live. Not for the repo or the local site — use `wp-local-setup`.
version: 0.1.0
---

# Choosing a theme baseline

Most of the cost of a theme is decided before the first commit, by one question: **how much
code are we taking on?** Three facts drive the answer:

1. **Re-declaring tokens beats porting code.** A well-built modern theme maps its CSS custom
   properties to `var(--wp--preset--*)`. If it does, a `theme.json` with the right slugs
   restyles the whole thing and you own almost nothing.
2. **A fork is a standing debt.** Every parent release has to be re-reconciled by hand,
   forever. Forks that started as "we'll just tweak it" are how themes end up two years
   behind.
3. **Our own history proves both.** See [`references/theme-baseline-precedents.md`](references/theme-baseline-precedents.md)
   — the lineage, the regression it caused, and the child theme that got it right.

So: **child theme first, fresh second, fork last.**

## When to use

- Starting the theme for a new Linchpin property — a microsite, product, or docs site.
- A third-party theme needs a Linchpin-branded version.
- Deciding whether to child-theme, fork, or start clean.
- Working out where an existing block theme's page layouts actually live (they are often
  not in `templates/`).

**Not this skill:**

- The project repo and the local site → [`wp-local-setup`](../wp-local-setup/SKILL.md).
- Palette, type, and spacing values once a baseline exists → [`wp-design-tokens`](../wp-design-tokens/SKILL.md).
- Whether the request is theme work at all → [`wp-implementation-choice`](../wp-implementation-choice/SKILL.md).
- Generic block-theme mechanics (template hierarchy, the style cascade) → upstream
  `wp-block-themes`.

## Owns

Canonical for: the baseline decision, the child-theme procedure, and the closed questions
about which of our themes to start from.
Defers: token values → [`wp-design-tokens`](../wp-design-tokens/SKILL.md); custom blocks →
[`wp-block-conventions`](../wp-block-conventions/SKILL.md).

## Preflight — read the candidate parent, don't assume

| Look for | Tells you | If missing |
| --- | --- | --- |
| A credible parent that owns *behavior* (docs, commerce, membership) | Route A is likely | No parent → Route B |
| Preset coverage in the parent's CSS (command below) | **The load-bearing check** — does its styling flow from WP presets, or from hardcoded values? | Mostly hardcoded → `theme.json` can't restyle it; Route A saves much less |
| `wc -l <parent>/functions.php <parent>/inc/*.php` and its release cadence | The cost of Route C | Thin PHP → a fork is cheaper, but still not free |
| `grep -rn 'get_stylesheet_uri' <parent>/` | Whether a child needs the parent-stylesheet fix below | Parent uses `get_template_directory_uri()` → no fix needed |
| `wc -l <parent>/templates/*.html` | Whether templates are real markup or one-line pattern delegations | All `1` → layouts live in `patterns/template-*.php` |

### The preset-coverage check

Run this against the candidate parent's stylesheet. It's a **ratio judgment**, not a
threshold — you're comparing values that flow from `theme.json` against values that don't:

```bash
CSS=<parent>/style.css
grep -oE 'var\(\s*--wp--(preset|custom)' "$CSS" | wc -l          # presets used directly
grep -oE '\-\-[a-z][a-z0-9-]*\s*:\s*var\(\s*--wp--(preset|custom)' "$CSS" | wc -l  # own tokens fed by presets
grep -oE '#[0-9a-fA-F]{3,8}\b' "$CSS" | wc -l                    # hardcoded colors
```

Two shapes both pass, so read the numbers together rather than chasing one:

| Parent | Presets used | Own tokens from presets | Hardcoded hex | Read |
| --- | --- | --- | --- | --- |
| Ollie (255 lines) | 21 | 0 | 1 | Uses presets directly — restylable |
| DocsPress (4,255 lines) | 75 | 41 | 40 | Own token layer fed by presets — restylable |

A parent with hundreds of hexes and a handful of preset references is telling you Route A
won't work; don't write override CSS to force it.

State the route and the reason back to the user in one line before building.

## The routes

| Parent owns… | Route | You own |
| --- | --- | --- |
| Behavior + tokenized CSS | **A — child theme** | `theme.json`, a thin `style.css`, an enqueue shim |
| Nothing suitable exists | **B — fresh block theme** | Everything, deliberately small |
| Behavior you must change structurally | **C — fork** | All of it, and every upstream release |

## Route A — child theme (the default)

1. **Confirm the parent is Composer-installed, not committed.** Add it to `composer.json`
   (our private mirror is `packagist.linchpin.com`) and let `.gitignore`'s theme allowlist
   cover only the child. → `git ls-files themes/<parent>` is empty.
2. **Create the child.** `style.css` needs `Template: <parent-dir>` — that header is what
   makes it a child. Keep the rest of the file for genuine overrides only.
3. **Declare complete preset arrays.** `theme.json` **replaces** a preset array wholesale
   rather than merging it by slug. A partial `color.palette` or `typography.fontFamilies`
   silently *drops* every parent entry you left out — a missing `mono` family is how code
   blocks lose their font. Copy the parent's full list, then change the values you need.
   → every slug the parent's CSS references still resolves.
4. **Copy font files into the child.** `file:./` in `theme.json` resolves against the
   **active** theme, so a child cannot borrow a sibling's fonts. Copy them in; don't depend
   on another theme being installed. → `theme.json` references no path outside this theme.
5. **Fix the stylesheet enqueue if the parent uses `get_stylesheet_uri()`.** That function
   resolves to the *active* theme, so with a child active it points at the child's near-empty
   `style.css` and the parent's stylesheet — `@font-face` rules included — never loads.
   Enqueue the parent explicitly, before the parent's own hook:

   ```php
   add_action( 'wp_enqueue_scripts', 'prefix_enqueue_parent_style', 5 );
   ```

   Priority 5 lands the parent sheet ahead of the parent's own priority-10 enqueue, giving a
   parent → child cascade at equal specificity — so child overrides need no `!important`.
   → the parent's CSS is present in the page source with the child active.
6. **Put declarations in `includes/`, not the bootstrap.** `functions.php` holds a `require`
   and hooks only; function and class declarations live in included files, which keeps
   `PSR1.Files.SideEffects` quiet under a changed-files PHPCS run.
7. **Hand the values to [`wp-design-tokens`](../wp-design-tokens/SKILL.md)** and verify.

## Route B — fresh block theme

Choose this when no parent fits. Start small — `style.css`, `theme.json`, `templates/`,
`parts/`, `patterns/`, `functions.php` — and take two decisions from our history up front:

- **Role-named slugs, not paint names.** `accent` / `ink` / `paper` / `canvas` / `line`, not
  `teal` / `green` / `dark-gray-2`. Role names are what let style variations swap a palette
  with zero pattern edits; paint names force every pattern to carry a specific color.
  [`wp-design-tokens`](../wp-design-tokens/SKILL.md) owns the vocabulary.
- **Decide whether templates delegate.** One-line templates that defer to
  `patterns/template-*.php` buy user-selectable layouts (centered / wide / sidebar) but hide
  the markup from anyone reading `templates/`. Either is fine — record the choice in the
  project's `CLAUDE.md` so the next agent doesn't hunt.

## Route C — fork

Last resort, and only when the parent's *behavior* has to change structurally. Say the cost
out loud in the PR: every upstream release becomes a manual reconciliation. If the reason is
"we need different colors" or "we need our fonts", the answer is Route A.

## Closed questions — don't re-open these

Both come up every time a theme starts. They are settled; the evidence is in
[`references/theme-baseline-precedents.md`](references/theme-baseline-precedents.md).

- **`base-wp-theme-2026` is not a baseline.** It was never launched — it is the residue of
  an evaluation. Read it for reference; don't clone it, and don't take tokens from it.
- **"Start from Ollie" is a loop.** `base-wp-theme-2026` already *is* a fork of Ollie.
  Choosing Ollie means redoing that fork.

## Verify

Via [`wp-studio-cli`](../wp-studio-cli/SKILL.md) and [`browser-automation`](../browser-automation/SKILL.md):

```bash
wp theme list --status=active          # the new theme, and its parent if Route A
wp eval 'echo get_template();'         # parent dir on a child; own dir otherwise
wp eval 'wp_clean_theme_json_cache();' # theme.json is read live — flush after edits
```

Then load the front page, one inner page, and `/wp-admin` in a browser. On Route A, confirm
in the page source that the **parent's** stylesheet is enqueued and that no font request
404s.

## Guardrails

- **Never fork a theme that owns behavior** when re-declaring tokens would do — you inherit
  every future release as manual work.
- **Never declare a partial preset array on a child theme.** Arrays replace, not merge; the
  omitted slugs vanish and the parent's CSS breaks quietly.
- **Never point `theme.json` at a font file that isn't in this theme.** `file:./` resolves
  against the active theme, and a missing file falls back silently — the page just looks
  wrong.
- **Never leave a child's `style.css` as the only enqueued sheet** when the parent uses
  `get_stylesheet_uri()`.
- **Never commit a Composer-installed parent theme** — the allowlist in `.gitignore` covers
  project code only ([`wp-local-setup`](../wp-local-setup/SKILL.md)).
- If the parent turns out not to tokenize its CSS, stop and re-decide the route rather than
  writing override CSS to compensate.

## Done

- [ ] The route is stated, with the reason, and the token-coverage check that supports it.
- [ ] On Route A: `Template:` header set, parent Composer-installed and untracked, preset
      arrays complete, fonts copied in, parent stylesheet enqueued if needed.
- [ ] `theme.json` references no file outside this theme.
- [ ] Front page, an inner page, and `/wp-admin` render on the new theme with no 404s.
- [ ] Token values handed to [`wp-design-tokens`](../wp-design-tokens/SKILL.md).
- [ ] Any baseline decision worth remembering is recorded in the project's `CLAUDE.md`, and
      the work is tied to a task ([`task-tracking`](../task-tracking/SKILL.md)).
