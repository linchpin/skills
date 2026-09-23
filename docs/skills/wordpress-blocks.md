---
title: wordpress-blocks
---

Use this skill when editing WordPress content — a page, post, or other block-based content — through a chat interface, when the Mantle plugin asks to add a pricing table, build a hero, insert an FAQ, or make a section two columns. The output for a content region is WordPress block markup, not Markdown or plain HTML, and getting the comment-delimiter grammar right — plus reusing the site's own design assets before composing anything new — is the whole job.

## When to reach for it

- A request means adding or changing content on a page or post — a hero, pricing table, FAQ, CTA, columns, or any section.
- Existing content needs restructuring into different blocks.
- Deciding whether a layout should reuse a site pattern or be composed fresh.

## Where it stops

> **Not this skill:** building blocks, plugins, or themes (PHP `block.json`, `render.php`, registering patterns in a theme) — use the upstream WordPress skills [`wp-block-development`](https://github.com/WordPress/agent-skills) and [`wp-block-themes`](https://github.com/WordPress/agent-skills). One site's specific block and pattern conventions belong in that project's own `CLAUDE.md`/`AGENTS.md`.

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Classify the intent","content":"<p>Read what's being asked and extract search keywords, e.g. 'pricing table' becomes <code>pricing</code>, <code>plans</code>, <code>tiers</code>.</p>"},{"title":"Search the live site first","content":"<p>Call the host's pattern search before writing any markup — it covers synced patterns, registered patterns, and template parts together.</p>"},{"title":"Reuse a strong match","content":"<p>Emit a reference to a synced pattern rather than inlining it, insert a registered pattern's markup adapted to the request, or use a template part only when editing a template.</p>"},{"title":"Compose from core blocks","content":"<p>When nothing matches, pull a recipe or apply the core-block reference, pulling color and size values from the site's own design tokens instead of hardcoding them, and confirming any non-core block is actually registered first.</p>"},{"title":"Validate before returning","content":"<p>Run the markup through the host's block validator and repair on failure. Malformed delimiters silently break the editor, so nothing goes back unvalidated.</p>"}]} /-->

## What it checks first

Before composing anything, it treats the site as already holding reusable design assets rather than a blank canvas: it searches synced patterns, registered patterns, and template parts, reads the theme's design tokens, and confirms any non-core block is actually registered on the install. That state is dynamic per site and can't live in a static file, so the host plugin has to expose it as callable tools.

## What it owns

Canonical for authoring and editing page or post content as Gutenberg block markup, the pattern-first procedure, the block-markup grammar rules, and validating markup before it's inserted. It defers building blocks, plugins, or themes to the upstream WordPress skills and `wp-block-conventions`, the color/type/spacing vocabulary to `wp-design-tokens`, and running WP-CLI locally to `wp-studio-cli`.

## Guardrails

<!-- wp:docspress/callout {"tone":"warning","title":"Never inline a synced pattern's markup to make an edit","content":"<p>That silently detaches it from every other place it's used. Detach deliberately, or edit the pattern itself.</p>","collapsible":false} /-->

- Never return unvalidated block markup — malformed delimiters produce an "unexpected or invalid content" block and the user loses their layout.
- Never replace content the user didn't ask you to change — return the changed blocks in context and preserve everything else exactly.
- Never reference a block that isn't registered on the install.
- Never hardcode colors, sizes, or widths when the theme exposes a matching token slug.
- Don't wrap output in Markdown fences or mix commentary into it — the host inserts the output verbatim.

## Done when

- [ ] The site was searched for an existing pattern/part before composing anything new.
- [ ] Output is block markup only — no fences, no commentary.
- [ ] Design tokens used wherever the theme exposes a matching slug.
- [ ] Every non-core block referenced is confirmed registered.
- [ ] `validate_blocks` (or the host validator) passes on the final markup.
- [ ] Untouched blocks are byte-for-byte preserved.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/wordpress-blocks/SKILL.md) is the skill's main file.
- [`references/block-grammar.md`](https://github.com/linchpin/skills/blob/main/skills/wordpress-blocks/references/block-grammar.md) — the HTML-comment delimiter contract for correct block markup, and the top causes of "invalid block".
- [`references/core-blocks.md`](https://github.com/linchpin/skills/blob/main/skills/wordpress-blocks/references/core-blocks.md) — copy-paste-correct markup for the common core blocks.
- [`references/patterns-and-parts.md`](https://github.com/linchpin/skills/blob/main/skills/wordpress-blocks/references/patterns-and-parts.md) — the contract for synced patterns, registered patterns, and template parts, and when each is appropriate.
- [`references/tool-contract.md`](https://github.com/linchpin/skills/blob/main/skills/wordpress-blocks/references/tool-contract.md) — JSON Schemas for the live tools the host (Mantle) plugin must expose.
- [`references/validation.md`](https://github.com/linchpin/skills/blob/main/skills/wordpress-blocks/references/validation.md) — the validate-before-insert contract and repair loop.
- [`references/recipes/faq.md`](https://github.com/linchpin/skills/blob/main/skills/wordpress-blocks/references/recipes/faq.md) — fallback FAQ composition for when no pattern match exists.
- [`references/recipes/hero.md`](https://github.com/linchpin/skills/blob/main/skills/wordpress-blocks/references/recipes/hero.md) — fallback hero/header composition, in two variants.
- [`references/recipes/pricing-table.md`](https://github.com/linchpin/skills/blob/main/skills/wordpress-blocks/references/recipes/pricing-table.md) — fallback three-tier pricing table composed from core blocks.

Pre-approved, so the agent can run them without a prompt: reading and searching files. Anything that writes still asks.

## Related skills

- [`wp-block-development`](../upstream.md) — owns building blocks in PHP (`block.json`, `render.php`), not authoring content with them.
- [`wp-block-themes`](../upstream.md) — owns registering patterns and building the theme itself, not editing page content.
- [`wp-block-conventions`](wp-block-conventions.md) — owns building custom blocks, plugins, or themes on the Linchpin side.
- [`wp-design-tokens`](wp-design-tokens.md) — owns the color, type, and spacing vocabulary a block should use.
- [`wp-studio-cli`](wp-studio-cli.md) — owns running WP-CLI against a local site.
