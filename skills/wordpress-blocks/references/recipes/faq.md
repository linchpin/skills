# Recipe: FAQ section (fallback)

Use after `search_patterns("faq questions accordion")` finds no good match.

## Preferred — Details block (native accordion, no plugin)

Core `wp:details` renders an expand/collapse `<details>` natively. Each Q is its own block.

```html
<!-- wp:group {"layout":{"type":"constrained"}} -->
<div class="wp-block-group">
<!-- wp:heading -->
<h2 class="wp-block-heading">Frequently asked questions</h2>
<!-- /wp:heading -->

<!-- wp:details -->
<details class="wp-block-details"><summary>How does billing work?</summary>
<!-- wp:paragraph -->
<p>You're billed monthly and can cancel anytime.</p>
<!-- /wp:paragraph -->
</details>
<!-- /wp:details -->

<!-- wp:details -->
<details class="wp-block-details"><summary>Do you offer support?</summary>
<!-- wp:paragraph -->
<p>Yes — email support on every plan.</p>
<!-- /wp:paragraph -->
</details>
<!-- /wp:details -->
</div>
<!-- /wp:group -->
```

Set `{"showContent":true}` on a `wp:details` to render it open by default.

## Simpler — heading + paragraph pairs (no interactivity)

If `wp:details` isn't registered on the site (`list_registered_blocks`), or the user wants a
flat list, alternate headings and paragraphs:

```html
<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">How does billing work?</h3>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>You're billed monthly and can cancel anytime.</p>
<!-- /wp:paragraph -->
```

## Adapt

- Generate one `wp:details` (or heading/paragraph pair) per Q&A from the user's content.
- Don't reach for a third-party accordion block unless the user names one and
  `list_registered_blocks` confirms it's installed — `wp:details` covers most needs.
