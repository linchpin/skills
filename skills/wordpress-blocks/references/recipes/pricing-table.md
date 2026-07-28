# Recipe: pricing table (fallback)

Use this **only after** `search_patterns("pricing plans tiers")` finds no good synced/registered
pattern. This is a three-tier table composed from core blocks. Pull color/font slugs from
`get_theme_tokens()` and swap them in; `validate_blocks` the result.

## Structure

A constrained `group` (section heading) followed by a `columns` block — one `column` per plan,
each a bordered `group` holding: plan name (`heading`), price (`heading`), feature `list`, and a
`buttons` CTA.

```html
<!-- wp:group {"layout":{"type":"constrained"}} -->
<div class="wp-block-group">
<!-- wp:heading {"textAlign":"center"} -->
<h2 class="wp-block-heading has-text-align-center">Simple, transparent pricing</h2>
<!-- /wp:heading -->

<!-- wp:columns {"align":"wide"} -->
<div class="wp-block-columns alignwide"><!-- wp:column -->
<div class="wp-block-column">
<!-- wp:group {"style":{"border":{"width":"1px","radius":"8px"},"spacing":{"padding":{"top":"2rem","right":"2rem","bottom":"2rem","left":"2rem"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group" style="border-width:1px;border-radius:8px;padding-top:2rem;padding-right:2rem;padding-bottom:2rem;padding-left:2rem">
<!-- wp:heading {"level":3,"textAlign":"center"} -->
<h3 class="wp-block-heading has-text-align-center">Starter</h3>
<!-- /wp:heading -->

<!-- wp:heading {"textAlign":"center","fontSize":"x-large"} -->
<h2 class="wp-block-heading has-text-align-center has-x-large-font-size">$19<span>/mo</span></h2>
<!-- /wp:heading -->

<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li>1 site</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>Community support</li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->

<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->
<div class="wp-block-buttons"><!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="#">Choose Starter</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:column -->

<!-- wp:column -->
<div class="wp-block-column">
<!-- duplicate the bordered group; vary name/price/features (e.g. "Pro", "$49/mo") -->
</div>
<!-- /wp:column -->

<!-- wp:column -->
<div class="wp-block-column">
<!-- third plan (e.g. "Business", "$99/mo") -->
</div>
<!-- /wp:column --></div>
<!-- /wp:columns -->
</div>
<!-- /wp:group -->
```

## Adapt

- Fill real plan names, prices, and features from the user's request.
- Highlight a "most popular" tier with a token background: add
  `{"backgroundColor":"primary","textColor":"white"}` to that column's inner `group` (and the
  matching `has-…` classes — let `validate_blocks` reconcile them).
- 2 plans → two columns; 4 → consider two rows of `columns` or narrower columns.
- Replace inline border/padding `style` with theme spacing/border tokens when
  `get_theme_tokens()` exposes them.
