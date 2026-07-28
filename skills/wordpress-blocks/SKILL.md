---
name: wordpress-blocks
description: Author and edit WordPress content as valid Gutenberg block markup from a chat interface (Mantle). Use whenever a request means adding or changing page/post/content — a section, hero, pricing table, FAQ, CTA, columns, etc. Encodes the pattern-first procedure (reuse the site's synced patterns / template parts / registered patterns BEFORE composing from core blocks), the block-markup grammar models get wrong, and the live tool contract the host plugin must expose. Always validate generated block markup before inserting — invalid comment delimiters silently break the editor.
version: 0.1.0
---

# WordPress Blocks (content authoring)

Use this skill when you are **editing WordPress content** (a page, post, or other
block-based content) through a chat interface — i.e. the Mantle plugin asks you to
"add a pricing table," "build a hero," "insert an FAQ," "make this two columns," etc.

Your output for a content region is **WordPress block markup** (Gutenberg "block grammar"),
not Markdown and not plain HTML. Block markup is HTML wrapped in `<!-- wp:… -->` comment
delimiters; if those delimiters are malformed, the editor flags the content as an
**"unexpected or invalid"** block and the user loses the layout. Getting the grammar right,
and reusing the site's own design assets, is the whole job.

## When to use

- A request means adding or changing content on a page or post — a hero, pricing table,
  FAQ, CTA, columns, or any section.
- Existing content needs restructuring into different blocks.
- You need to know whether a layout should reuse a site pattern or be composed fresh.

**Not this skill:** building blocks, plugins, or themes (PHP `block.json`, `render.php`,
registering patterns in a theme) — use the upstream WordPress skills
[`wp-block-development`](https://github.com/WordPress/agent-skills) and
[`wp-block-themes`](https://github.com/WordPress/agent-skills). One site's specific block
and pattern conventions belong in that project's own `CLAUDE.md`/`AGENTS.md`.

## The core principle: reuse before you build

A site is not a blank canvas. It already ships design assets the user (or their designer)
made, and reusing them is almost always better than hand-composing core blocks:

| Asset | What it is | How you emit it |
| --- | --- | --- |
| **Synced pattern** (`wp_block` CPT) | A saved, *linked* block — edits propagate everywhere it's used | `<!-- wp:block {"ref":ID} /-->` |
| **Registered pattern** (theme/plugin) | A reusable layout *template*, inserted as a one-time copy | Its expanded block markup (fetch via `get_pattern`) |
| **Template part** (FSE) | Header/footer/section parts of a block theme | `<!-- wp:template-part {"slug":"…","theme":"…"} /-->` (templates, not post body) |
| **Core / registered blocks** | The block library primitives | Composed markup — the **fallback** |

See `references/patterns-and-parts.md` for the distinctions and when each is appropriate.

## Procedure (pattern-first)

When a request means "add/build/change a layout or section":

1. **Classify the intent** and extract search keywords (e.g. "pricing table" → `pricing`,
   `plans`, `tiers`).
2. **Search the live site first.** Call `search_patterns(query)` (it covers synced +
   registered patterns and template parts). Do this *before* writing any markup.
3. **If there's a strong match**, reuse it:
   - **Synced pattern** → emit `<!-- wp:block {"ref":ID} /-->`. Don't inline its markup — keep it synced. If the user wants edits to *this instance only*, detach (see `references/patterns-and-parts.md`).
   - **Registered pattern** → `get_pattern(slug)` and insert its `block_markup`, adapting the copy/text to the request.
   - **Template part** → only when editing a template (not post body).
4. **If no good match**, compose from core blocks:
   - Pull the recipe from `references/recipes/` when one exists (`pricing-table.md`, `hero.md`, `faq.md`); otherwise apply `references/core-blocks.md`.
   - Use the site's **design tokens** (color slugs, font-size slugs, `contentSize`/`wideSize`) from `get_theme_tokens()` instead of hardcoded hex/px, so content matches the design system.
   - If you reference a **non-core** block, confirm it's actually registered on this install via `list_registered_blocks()` first.
5. **Validate before returning.** Run the markup through `validate_blocks` (or the host's
   block validator) and repair/simplify on failure. See `references/validation.md`. Never
   hand back content you haven't validated.

## Output rules

- Emit **only** block markup for the content region — no Markdown fences, no commentary
  mixed in. The plugin inserts your output verbatim.
- **Preserve** existing blocks unless the user asked to replace them. When editing, return
  the changed block(s) in context, not the whole document, unless asked.
- **Prefer the fewest blocks** that achieve the layout. Don't wrap everything in nested
  groups "just in case."
- Prefer **token references** (`{"textColor":"primary"}`, `{"fontSize":"large"}`) over raw
  values when `get_theme_tokens()` exposes a matching slug.
- Core blocks drop the namespace: `wp:paragraph`, **not** `wp:core/paragraph`.

## Reference files (load as needed)

- `references/block-grammar.md` — the delimiter grammar and the top causes of "invalid block."
- `references/core-blocks.md` — copy-paste-correct markup for the common core blocks.
- `references/patterns-and-parts.md` — synced vs registered patterns vs template parts.
- `references/tool-contract.md` — JSON Schemas for the live tools the host plugin must expose.
- `references/validation.md` — the validate-before-insert contract and repair loop.
- `references/recipes/` — fallback compositions (`pricing-table.md`, `hero.md`, `faq.md`).

## Guardrails

- **Never return unvalidated block markup.** Malformed `<!-- wp:… -->` delimiters produce an
  "unexpected or invalid content" block and the user loses their layout — validate, repair,
  and only then hand it back.
- **Never inline a synced pattern's markup** to make an edit. That silently detaches it from
  every other place it's used; detach deliberately or edit the pattern itself.
- **Never replace content the user didn't ask you to change.** Return the changed blocks in
  context; preserve everything else exactly.
- **Never reference a block that isn't registered on the install** — confirm with
  `list_registered_blocks()` before using anything outside core.
- **Never hardcode colors, sizes, or widths** when `get_theme_tokens()` exposes a matching
  slug; raw values break the site's design system on theme changes.
- Don't wrap output in Markdown fences or mix commentary into it — the host inserts your
  output verbatim.

## Done

- [ ] The site was searched for an existing pattern/part before composing anything new.
- [ ] Output is block markup only — no fences, no commentary.
- [ ] Design tokens used wherever the theme exposes a matching slug.
- [ ] Every non-core block referenced is confirmed registered.
- [ ] `validate_blocks` (or the host validator) passes on the final markup.
- [ ] Untouched blocks are byte-for-byte preserved.
