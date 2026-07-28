# Tool contract — the live site interface

The static knowledge in this skill is generic. The **dynamic** half — *this* site's synced
patterns, registered patterns, template parts, registered blocks, and theme tokens — lives in
WordPress and changes per site and over time. It can't be a markdown file; the host (the Mantle
plugin) must expose it as **tools** the model calls at request time.

Design goals:
- **Index, then fetch.** `search_patterns` returns lightweight rows (title/slug/categories/
  excerpt) so the model can choose cheaply; `get_pattern` pulls full markup only for the one
  it picks. Never dump every pattern's full markup into the prompt.
- **Function-calling friendly.** Schemas below are JSON Schema, usable directly as OpenAI
  `tools[].function.parameters`.

Implementation notes (host side): synced patterns come from the `wp_block` CPT; registered
patterns from `WP_Block_Patterns_Registry`; registered blocks from `WP_Block_Type_Registry`;
template parts from the `wp_template_part` source; tokens from the active theme's `theme.json`
(`wp_get_global_settings()`).

---

## `search_patterns`

> Search the site's reusable assets (synced + registered patterns and template parts). Call
> this FIRST for any layout/section request, before composing core blocks.

```json
{
  "name": "search_patterns",
  "description": "Search the site's synced patterns, registered patterns, and template parts by keyword. Returns lightweight matches; call get_pattern to retrieve full markup.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Keywords from the user's intent, e.g. 'pricing plans tiers'." },
      "types": {
        "type": "array",
        "items": { "type": "string", "enum": ["synced", "registered", "template_part"] },
        "description": "Optional filter. Default: all three."
      },
      "limit": { "type": "integer", "minimum": 1, "maximum": 25, "default": 8 }
    },
    "required": ["query"]
  }
}
```

**Returns:** `{ "matches": Match[] }`
```json
{
  "matches": [
    {
      "title": "Pricing — 3 column",
      "type": "synced",
      "ref": 451,
      "slug": null,
      "categories": ["pricing", "featured"],
      "excerpt": "Three plan cards with monthly price and CTA.",
      "score": 0.92
    },
    {
      "title": "Pricing table (registered)",
      "type": "registered",
      "ref": null,
      "slug": "linchpin/pricing-3col",
      "categories": ["pricing"],
      "excerpt": "Theme-provided 3-tier layout.",
      "score": 0.78
    }
  ]
}
```
- `ref` is set for `synced` (the `wp_block` post ID → emit `wp:block {"ref":…}`).
- `slug` is set for `registered` and `template_part`.

## `get_pattern`

> Fetch the full block markup for one match. For synced patterns prefer emitting the
> reference block; only fetch expanded markup when detaching/editing a single instance.

```json
{
  "name": "get_pattern",
  "description": "Return the full block markup for one pattern or template part, by ref or slug.",
  "parameters": {
    "type": "object",
    "properties": {
      "ref": { "type": "integer", "description": "wp_block post ID for a synced pattern." },
      "slug": { "type": "string", "description": "Slug for a registered pattern or template part." }
    },
    "oneOf": [{ "required": ["ref"] }, { "required": ["slug"] }]
  }
}
```
**Returns:** `{ "title": string, "type": "synced"|"registered"|"template_part", "block_markup": string, "ref": int|null, "slug": string|null }`

## `list_template_parts`

```json
{
  "name": "list_template_parts",
  "description": "List the active block theme's template parts (FSE). For template editing, not post body.",
  "parameters": { "type": "object", "properties": {} }
}
```
**Returns:** `{ "parts": [{ "slug": string, "title": string, "area": "header"|"footer"|"uncategorized"|string, "theme": string }] }`

## `list_registered_blocks`

> Confirm a non-core block actually exists on this install before referencing it.

```json
{
  "name": "list_registered_blocks",
  "description": "List blocks registered on this site. Filter by namespace to check availability of a specific block.",
  "parameters": {
    "type": "object",
    "properties": {
      "namespace": { "type": "string", "description": "e.g. 'linchpin' or 'core'. Omit for all." }
    }
  }
}
```
**Returns:** `{ "blocks": [{ "name": string, "title": string, "category": string, "supports_inner_blocks": boolean }] }`

## `get_theme_tokens`

> Pull theme.json design tokens so generated markup matches the site's design system.

```json
{
  "name": "get_theme_tokens",
  "description": "Return the active theme's design tokens (colors, gradients, font sizes, spacing, layout widths) from theme.json.",
  "parameters": { "type": "object", "properties": {} }
}
```
**Returns:**
```json
{
  "colors": [{ "slug": "primary", "name": "Primary", "color": "#0b5fff" }],
  "gradients": [{ "slug": "brand", "name": "Brand", "gradient": "linear-gradient(...)" }],
  "font_sizes": [{ "slug": "large", "name": "Large", "size": "1.5rem" }],
  "spacing": { "spacingSizes": [{ "slug": "40", "name": "Large", "size": "2rem" }] },
  "layout": { "contentSize": "840px", "wideSize": "1200px" }
}
```

## `validate_blocks` (required before insert)

```json
{
  "name": "validate_blocks",
  "description": "Parse block markup the way the editor does and report validity. Optionally return a normalized/repaired version.",
  "parameters": {
    "type": "object",
    "properties": {
      "block_markup": { "type": "string" },
      "autofix": { "type": "boolean", "default": true, "description": "Return a normalized version with corrected wrappers/classes where possible." }
    },
    "required": ["block_markup"]
  }
}
```
**Returns:** `{ "valid": boolean, "issues": [{ "block": string, "message": string }], "fixed_markup": string|null }`

> The host already has block validators available (e.g. the WordPress Studio MCP
> `validate_and_fix_blocks` / `validate_html_blocks` tools) — wire `validate_blocks` to one of
> those rather than reimplementing the parser.
