---
name: wp-implementation-choice
description: Decide which WordPress abstraction a request should become — theme/template work, a custom block, a functionality plugin, existing core blocks and patterns, or an off-the-shelf plugin — before any code is written. Use when a WordPress request could be built more than one way, when someone proposes a custom plugin or block, when scoping a new feature, or when reviewing an approach that feels heavier than the problem. Not for how to build the thing once chosen.
version: 1.1.0
---

# Choosing the WordPress implementation

Most expensive WordPress mistakes are made before the first line of code: a plugin written
for something a theme template handles, a custom block that duplicates a core block, a
bespoke build of what WooCommerce already ships. **Pick the smallest abstraction that
cleanly solves the request** — smaller means less to maintain, less to upgrade, and less to
hand to the next developer.

## When to use

- A request could reasonably be a theme change, a block, or a plugin.
- Someone proposes building something custom and you're not sure it's warranted.
- Scoping new work, or reviewing an approach that feels heavy for the problem.

**Not this skill:** how to build each thing once chosen — see the routing table below.

## Owns

Canonical for: the choice itself and the reasons behind it. Every "how" belongs to the skill
this routes to.

## Preflight — what already exists?

Answer these before designing anything custom; each "yes" removes work:

1. **Does a core block or pattern do it?** Check the site's registered patterns and template
   parts first — [`wordpress-blocks`](../wordpress-blocks/SKILL.md) covers reuse-before-build.
   Check what core actually ships *on this version* rather than from memory: core has absorbed
   a lot recently, and a block library that was the right answer two releases ago may now be
   duplicating core. Accordions are the current example — `core/accordion` +
   `accordion-item` / `accordion-heading` / `accordion-panel` landed in **6.9**, with
   `autoclose`, real heading levels and the Interactivity API. On 6.9+ that beats both
   `core/details` and any bundled accordion block. Verify with `list_registered_blocks`.
2. **Does the shared block library already have it?** `linchpin/linchpin-blocks` ships
   accordion, tabs, cards, slider, counter, and more. Prefer core when core has caught up —
   a plugin dependency for something core does is a maintenance cost with no upside.
3. **Does a well-known plugin own this problem?** Ecommerce is WooCommerce; forms, SEO, and
   membership all have mature answers. Building a lesser version is a liability you maintain
   forever.
4. **Does the project's functionality plugin already have a hook or module for it?**

## The routing table

| The deliverable is really… | Build it as | Then use |
| --- | --- | --- |
| A whole new theme for a site or property | **A baseline decision** — child theme, fresh, or fork | [`wp-theme-baseline`](../wp-theme-baseline/SKILL.md) |
| Color, type, spacing, or shadow values | **Token work** in `theme.json` | [`wp-design-tokens`](../wp-design-tokens/SKILL.md) |
| Layout, templates, parts, a visual redesign | **Theme work** | Upstream `wp-block-themes` |
| Page/post content composed from existing blocks | **Content**, not code | [`wordpress-blocks`](../wordpress-blocks/SKILL.md) |
| An editor-insertable content component that core can't express | **Custom block** | [`wp-block-conventions`](../wp-block-conventions/SKILL.md) |
| Reusable behavior that must survive a theme change — admin UI, settings, REST endpoints, cron, integrations, post types | **Functionality plugin** | Upstream `wp-plugin-development` |
| Data exposed to a frontend or third party | **REST endpoint** in the plugin | Upstream `wp-rest-api` |
| Performance, accessibility, or QA review of what's there | **An audit**, not a build | [`wp-audit`](../wp-audit/SKILL.md) |

## Decision rules

- **Presentation is never a plugin.** If the deliverable is how something looks, it belongs
  in the theme or a block, not in PHP that outputs markup.
- **Reusable backend behavior is never a theme.** Anything that must survive a redesign —
  post types, endpoints, scheduled jobs, integrations — goes in the functionality plugin.
  Business logic in `functions.php` dies with the next theme.
- **A block is for content editors.** If nobody will ever insert it in the editor, it isn't a
  block; it's a template part or plugin code.
- **Shared vs project** matters as much as which abstraction: a block or module useful to
  every client belongs in the shared library, a client-specific one in that project. See
  [`wp-block-conventions`](../wp-block-conventions/SKILL.md).
- **Configuration beats code.** A core block with the right `supports` and theme.json tokens
  beats a custom block that hardcodes the same result.
- **When two options both fit cleanly, take the smaller one** — and say why in the PR, so the
  choice is reviewable rather than assumed.

## Guardrails

- **Never build what a well-established plugin already does** without an explicit reason the
  user has accepted (licensing, a hard requirement it can't meet, unacceptable bloat).
- **Never introduce a custom block that duplicates a core block** with different styling —
  that's a block style variation or theme.json work.
- **Never put business logic in a theme** because it's the file you happen to be editing.
- **Never scope a plugin's boundaries around "everything this client asked for"** — a
  functionality plugin is for behavior, not a junk drawer.
- If the right answer is "this shouldn't be built," say so before designing it.

## Done

- [ ] Existing core blocks, patterns, shared library blocks, and off-the-shelf plugins were
      checked before designing anything custom.
- [ ] The chosen abstraction is the smallest that cleanly solves the request.
- [ ] Presentation and behavior are on the correct sides of the theme/plugin line.
- [ ] Shared vs project-specific placement decided deliberately.
- [ ] The reasoning is written down where a reviewer will see it.
- [ ] Execution handed to the skill that owns the "how".
