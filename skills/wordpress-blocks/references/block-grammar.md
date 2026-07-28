# Block grammar — the part models get wrong

WordPress stores block content as HTML annotated with **HTML-comment delimiters**. The
parser ("block grammar") reads those comments to know where each block starts/ends and what
its attributes are. Malformed delimiters → the editor shows *"This block contains unexpected
or invalid content"* and the user loses the layout. This file is the contract for emitting
correct markup.

Upstream: <https://developer.wordpress.org/block-editor/reference-guides/block-api/block-grammar/>
and block attributes: <https://developer.wordpress.org/block-editor/reference-guides/block-api/block-attributes/>

## Anatomy of a block

```
<!-- wp:NAMESPACE/NAME {"attr":"value"} -->
  ...the block's saved HTML...
<!-- /wp:NAMESPACE/NAME -->
```

- **Core blocks omit the namespace**: `wp:paragraph`, `wp:heading`, `wp:columns` — NOT
  `wp:core/paragraph`. Third-party blocks keep theirs: `wp:linchpin/testimonial`.
- The **opening** delimiter may carry a JSON attributes object. The **closing** delimiter
  never does: `<!-- /wp:paragraph -->`.
- The name in the closing delimiter must match the opening one exactly.

## Two block forms

**1. Block with content** (open + close, inner HTML between):

```
<!-- wp:paragraph -->
<p>Hello.</p>
<!-- /wp:paragraph -->
```

**2. Void / self-closing block** (no inner HTML — note the `/-->`):

```
<!-- wp:block {"ref":42} /-->
<!-- wp:spacer {"height":"40px"} /-->          ← (spacer actually has HTML — see note)
<!-- wp:template-part {"slug":"header"} /-->
```

The `/` before `-->` marks a void block. Use it **only** for blocks that save no inner HTML
(synced-pattern reference `wp:block`, `wp:pattern`, `wp:template-part`, `wp:post-content`,
etc.). A `wp:paragraph` is never self-closing. (Spacer *does* render a `<div>`, so it uses
the open/close form — see `core-blocks.md`.)

## Attribute JSON rules

- Attributes are a **single valid JSON object**: double-quoted keys/strings, no trailing
  commas, no comments, no single quotes.
- **Omit attributes that equal the default.** WordPress only serializes non-default
  attributes. Adding `{"level":2}` to a heading (2 is the default) or inventing attributes
  the block doesn't define is a common cause of invalid blocks.
- Numbers/booleans are unquoted: `{"dimRatio":50,"isStackedOnMobile":true}`.
- Many visual attributes map to generated classes/inline styles in the HTML **and** must be
  declared in the JSON — they have to agree. Example: a heading's level lives in `{"level":3}`
  *and* the tag must be `<h3>`. Don't set one without the other.

## The #1 rule: saved HTML must match the block's save output

Each block has a fixed shape it serializes to. If your inner HTML doesn't match what that
block would save (wrong wrapper class, wrong tag, missing element), the editor marks it
invalid even when the delimiters are perfect. Practical consequences:

- A heading saves with `class="wp-block-heading"`: `<h2 class="wp-block-heading">…</h2>`.
- A button saves nested: `wp:buttons` → `.wp-block-buttons` → `wp:button` → `.wp-block-button`
  → `<a class="wp-block-button__link wp-element-button">`.
- A list wraps each item in its own `wp:list-item` block (modern WP), not bare `<li>`.

Because these shapes **drift between WordPress/Gutenberg versions**, do not trust hand-written
markup blindly — always run it through `validate_blocks` (see `validation.md`) and let the
validator/normalizer repair class names and wrappers. Treat the examples in `core-blocks.md`
and `recipes/` as *starting structure*, not byte-perfect truth for every site.

## Top causes of "invalid block"

1. **Void/open mismatch** — `<!-- wp:block {"ref":42} -->` without `/`, or a `/-->` on a
   block that has inner HTML.
2. **Malformed attribute JSON** — trailing comma, single quotes, unescaped quote inside a
   string. Escape inner quotes as `"` if needed.
3. **Inner HTML doesn't match save output** — missing `wp-block-*` class, wrong tag, wrong
   nesting.
4. **Namespaced a core block** — `wp:core/paragraph` instead of `wp:paragraph`.
5. **Mismatched open/close names** — `<!-- wp:group -->` … `<!-- /wp:columns -->`.
6. **Markdown leaking in** — emitting `**bold**` or `- item` instead of `<strong>`/list
   blocks. Block markup is HTML, never Markdown.

## Whitespace

Keep block delimiters on their own lines and put a blank line between sibling blocks for
readability; the parser tolerates this. Inside a parent's wrapper `<div>`, child block
delimiters sit directly inside the div (see the columns example in `core-blocks.md`).
