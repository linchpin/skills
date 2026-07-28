# Patterns and template parts — what to reuse, and how

The site already holds reusable design assets. Reusing them beats hand-composing core blocks:
it matches the designer's intent, stays on-brand, and (for synced patterns) keeps content
updatable in one place. Three distinct things get confused — here's the contract for each.

## 1. Synced patterns (`wp_block` custom post type)

The successor to "reusable blocks." A saved block stored once and **linked** wherever it's
used — edit it in one place, every instance updates.

- **Find:** `search_patterns(query)` returns synced patterns with a numeric `ref` (the
  `wp_block` post ID).
- **Emit:** a void reference block — do **not** inline its markup:
  ```html
  <!-- wp:block {"ref":451} /-->
  ```
- **Edit one instance only:** the user must *detach* it (turns it into normal blocks). If
  they ask to "change just this one," fetch the expanded markup via `get_pattern(ref:451)`,
  insert that instead of the reference, and tell them it's now detached.
- **Best for:** repeated, centrally-managed content — a standard CTA band, a contact block,
  a promo the client updates site-wide.

## 2. Registered patterns (theme- or plugin-provided)

Reusable **layout templates** registered in code (theme `patterns/*.php`, a plugin, or the
Pattern Directory). Inserting one drops a **one-time copy** of its blocks — no live link.

- **Find:** `search_patterns(query)` returns them with a `slug` and `type:"registered"`.
- **Emit:** fetch and inline the expanded blocks, adapting the copy to the request:
  ```
  const { block_markup } = get_pattern(slug: "linchpin/pricing-3col")
  // insert block_markup, then swap in the user's plan names/prices
  ```
  (Some hosts also accept the overlay form `<!-- wp:pattern {"slug":"…"} /-->`, but inlining
  the expanded markup is the portable, editable choice.)
- **Best for:** starting a section from a designed layout the user will then customize.

## 3. Template parts (`wp_template_part` — block themes / FSE)

Header, footer, and reusable section parts of a **block theme**. These belong to *templates*,
not to a page/post body.

- **Find:** `list_template_parts()` → `{slug, title, area, theme}`.
- **Emit (templates only):**
  ```html
  <!-- wp:template-part {"slug":"footer","theme":"linchpin","tagName":"footer"} /-->
  ```
- **Do not** insert a template part into post/page content. If the user wants a footer-like
  block *inside* a page, use a synced pattern or compose blocks instead.

## How this maps to the pattern-first procedure

```
request → search_patterns(keywords)
  ├─ synced match?      → <!-- wp:block {"ref":ID} /-->
  ├─ registered match?  → get_pattern(slug) → insert expanded markup, adapt copy
  ├─ template part?     → only if editing a template → wp:template-part
  └─ no match           → compose core blocks (recipes/ + core-blocks.md) using get_theme_tokens()
→ validate_blocks → insert
```

Prefer a **good** match over a forced one. A weak pattern match that needs heavy rewriting is
worse than a clean core-block composition. Use judgment: does the matched asset actually serve
what the user asked for, or just share a keyword?

Upstream concepts: synced patterns
<https://wordpress.org/documentation/article/reusable-blocks/>,
theme patterns <https://developer.wordpress.org/themes/patterns/>,
template parts <https://developer.wordpress.org/themes/block-themes/template-parts/>.
