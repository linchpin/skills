---
title: wp-implementation-choice
---

Most expensive WordPress mistakes are made before the first line of code — a plugin written for something a theme template handles, a custom block that duplicates a core block, a bespoke build of what WooCommerce already ships. This skill picks the smallest abstraction that cleanly solves a request, before any code is written.

## When to reach for it

- A request could reasonably be a theme change, a block, or a plugin.
- Someone proposes building something custom and you're not sure it's warranted.
- Scoping new work, or reviewing an approach that feels heavy for the problem.

## Where it stops

> **Not this skill:** how to build each thing once chosen — see the routing table below. The choice between modernizing an existing plugin in place and replacing it is here; the *staging* of that modernization is [`wp-plugin-modernization`](wp-plugin-modernization.md), and the repo shape it aims at is [`wp-plugin-standards`](wp-plugin-standards.md).

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Check what already exists","content":"<p>Work through core blocks and patterns already registered on this version, the shared block library, well-known plugins that already own the problem (ecommerce, forms, SEO, membership), and the project's own functionality plugin. Each yes removes work.</p>"},{"title":"Route by what the deliverable really is","content":"<p>Match the request against the routing table — a whole theme, token values, layout, page content, an editor component, reusable backend behavior, a REST endpoint, or an audit — to find which skill owns the how.</p>"},{"title":"Apply the decision rules","content":"<p>Presentation never becomes a plugin, reusable behavior never lives in the theme, and a block only exists if an editor will actually insert it. Configuration beats a custom build of the same result.</p>"},{"title":"Write the reasoning down","content":"<p>When two options both fit cleanly, take the smaller one and say why in the PR, so the choice is reviewable rather than assumed.</p>"}]} /-->

## What it checks first

Before designing anything custom, it checks what already exists: core blocks and patterns registered on this WordPress version (verified with `list_registered_blocks`, since core absorbs more each release), the shared `linchpin-blocks` library, whether a well-established plugin already owns the problem, and whether the project's own functionality plugin already has a hook or module for it.

## What it owns

Canonical for the choice itself and the reasons behind it. Every "how", once the abstraction is picked, belongs to the skill the routing table points to.

## Guardrails

- Never build what a well-established plugin already does without an explicit, accepted reason.
- Never introduce a custom block that duplicates a core block with different styling — that's a block style variation or theme.json work.
- Never put business logic in a theme because it's the file you happen to be editing.
- Never scope a plugin's boundaries around "everything this client asked for" — a functionality plugin is for behavior, not a junk drawer.
- If the right answer is "this shouldn't be built," say so before designing it.

## Done when

- [ ] Existing core blocks, patterns, shared library blocks, and off-the-shelf plugins were checked before designing anything custom.
- [ ] The chosen abstraction is the smallest that cleanly solves the request.
- [ ] Presentation and behavior are on the correct sides of the theme/plugin line.
- [ ] Shared vs project-specific placement decided deliberately.
- [ ] The reasoning is written down where a reviewer will see it.
- [ ] Execution handed to the skill that owns the "how".

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/wp-implementation-choice/SKILL.md) is the whole skill. It has no `references/` or `scripts/`.

Pre-approved, so the agent can run them without a prompt: reading and searching files. Everything else still asks.

## Related skills

- [`wp-plugin-modernization`](wp-plugin-modernization.md) — owns the staging of modernizing an existing plugin in place versus replacing it.
- [`wp-plugin-standards`](wp-plugin-standards.md) — owns the repo shape a functionality plugin aims at.
- [`wordpress-blocks`](wordpress-blocks.md) — covers reuse-before-build for page and post content.
- [`wp-theme-baseline`](wp-theme-baseline.md) — owns the baseline decision for a whole new theme.
- [`wp-design-tokens`](wp-design-tokens.md) — owns color, type, and spacing values in `theme.json`.
- [`wp-block-themes`](../upstream.md) — owns layout, templates, parts, and visual redesign work.
- [`wp-block-conventions`](wp-block-conventions.md) — owns building an editor-insertable custom block once that's the right call.
- [`wp-plugin-development`](../upstream.md) — owns reusable backend behavior: admin UI, settings, REST endpoints, cron, integrations, post types.
- [`wp-rest-api`](../upstream.md) — owns exposing data to a frontend or third party as a REST endpoint.
- [`wp-audit`](wp-audit.md) — owns performance, accessibility, or QA review of what's already there.
