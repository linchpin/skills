# Recipe: FAQ section (fallback)

Use after `search_patterns("faq questions accordion")` finds no good match.

## Preferred — core/accordion (WordPress 6.9+)

Core ships a real accordion: `core/accordion` wrapping `core/accordion-item`, each holding a
`core/accordion-heading` and a `core/accordion-panel`. Use it whenever the site is on 6.9 or
later — confirm with `list_registered_blocks`.

Why it beats the alternatives for a multi-question FAQ:

- **`autoclose`** — only one answer open at a time, which is what most FAQ designs show.
- **`headingLevel` / `level`** — each question is a real heading, so the document outline and
  screen-reader navigation are correct. `core/details` gives you a `<summary>`, which is not.
- **One styled container** — colour, spacing, border, shadow and typography supports sit on the
  item, so every question shares styling instead of being restyled individually.
- Built on the Interactivity API, so no custom JS.

```html
<!-- wp:accordion {"autoclose":true,"iconPosition":"right","headingLevel":3} -->
<div class="wp-block-accordion">
<!-- wp:accordion-item {"openByDefault":true} -->
<div class="wp-block-accordion-item">
<!-- wp:accordion-heading {"level":3} -->
<h3 class="wp-block-accordion-heading">How does billing work?</h3>
<!-- /wp:accordion-heading -->
<!-- wp:accordion-panel -->
<div class="wp-block-accordion-panel">
<!-- wp:paragraph -->
<p>You're billed monthly and can cancel anytime.</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:accordion-panel -->
</div>
<!-- /wp:accordion-item -->

<!-- wp:accordion-item -->
<div class="wp-block-accordion-item">
<!-- wp:accordion-heading {"level":3} -->
<h3 class="wp-block-accordion-heading">Do you offer support?</h3>
<!-- /wp:accordion-heading -->
<!-- wp:accordion-panel -->
<div class="wp-block-accordion-panel">
<!-- wp:paragraph -->
<p>Yes — email support on every plan.</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:accordion-panel -->
</div>
<!-- /wp:accordion-item -->
</div>
<!-- /wp:accordion -->
```

`openByDefault` on an item renders it expanded. `showIcon: false` hides the indicator.
`iconPosition` takes `left` or `right`.

**Generate this markup, don't hand-write it.** Nested parent/child blocks with `allowedBlocks`
constraints are easy to get subtly wrong, and an invalid FAQ shows "Attempt block recovery" on
every insert. Build the tree with `createBlock` and `serialize` in the editor, then use the
serialized result — see "Verify before shipping".

Designs often draw the toggle as **+ / −**; core renders a chevron. That's a block style or a
CSS override on the heading icon, not a reason to pick a different block.

## Fallback — core/details (pre-6.9, or a genuinely independent set)

`wp:details` renders a native `<details>`. Reach for it when `core/accordion` isn't registered,
or when each item is standalone and single-open behaviour would be wrong.

```html
<!-- wp:details -->
<details class="wp-block-details"><summary>How does billing work?</summary>
<!-- wp:paragraph -->
<p>You're billed monthly and can cancel anytime.</p>
<!-- /wp:paragraph -->
</details>
<!-- /wp:details -->
```

Set `{"showContent":true}` to render one open by default. Know the limits: no shared open/close
coordination, and the question is a `<summary>` rather than a heading.

## Last resort — heading + paragraph pairs (no interactivity)

If neither block is registered, or the user explicitly wants a flat list:

```html
<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">How does billing work?</h3>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>You're billed monthly and can cancel anytime.</p>
<!-- /wp:paragraph -->
```

Don't ship this as "an FAQ accordion" — it collapses nothing. If the design shows
expand/collapse and you emit this, say so plainly rather than letting it pass as equivalent.

## Adapt

- Generate one accordion item per Q&A from the user's content; mark only the first
  `openByDefault`.
- Don't reach for a third-party accordion block unless the user names one and
  `list_registered_blocks` confirms it's installed. Core now covers this.

## Verify before shipping

Validate in the site's real editor rather than trusting it by eye:

```
mcp__wordpress-studio__validate_blocks  nameOrPath=<site>  content=<the FAQ markup>
```

Expect every block valid. If a result looks wrong — for example attributes coming back as
defaults — confirm against the editor itself with `wp.blocks.parse( markup )[0]` and check
`isValid` plus the parsed attributes, because a validator running a stale block registration
can report a false failure.
