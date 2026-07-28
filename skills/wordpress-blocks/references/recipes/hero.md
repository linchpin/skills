# Recipe: hero / header section (fallback)

Use after `search_patterns("hero banner header")` finds no good match. Two variants.

## Variant A — Cover (background image + overlay)

Best when the user wants an image or color behind the headline. `dimRatio` is overlay
strength (0–100). Inner blocks: heading, paragraph, buttons.

```html
<!-- wp:cover {"url":"https://example.com/hero.jpg","dimRatio":50,"minHeight":520,"align":"full"} -->
<div class="wp-block-cover alignfull" style="min-height:520px"><span aria-hidden="true" class="wp-block-cover__background has-background-dim"></span><img class="wp-block-cover__image-background" src="https://example.com/hero.jpg" alt=""/><div class="wp-block-cover__inner-container">
<!-- wp:heading {"textAlign":"center","level":1,"fontSize":"xx-large"} -->
<h1 class="wp-block-heading has-text-align-center has-xx-large-font-size">Build faster with Linchpin</h1>
<!-- /wp:heading -->

<!-- wp:paragraph {"align":"center"} -->
<p class="has-text-align-center">A short, punchy subhead that explains the value in one line.</p>
<!-- /wp:paragraph -->

<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->
<div class="wp-block-buttons"><!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="/contact">Get started</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->
</div></div>
<!-- /wp:cover -->
```

## Variant B — Group + columns (text left, image right, no overlay)

Best for a clean split layout.

```html
<!-- wp:group {"align":"wide","layout":{"type":"constrained"}} -->
<div class="wp-block-group alignwide">
<!-- wp:columns {"verticalAlignment":"center"} -->
<div class="wp-block-columns are-vertically-aligned-center"><!-- wp:column {"verticalAlignment":"center"} -->
<div class="wp-block-column is-vertically-aligned-center">
<!-- wp:heading {"level":1,"fontSize":"xx-large"} -->
<h1 class="wp-block-heading has-xx-large-font-size">A headline that sells</h1>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>One or two sentences of supporting copy.</p>
<!-- /wp:paragraph -->

<!-- wp:buttons -->
<div class="wp-block-buttons"><!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="/contact">Get started</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->
</div>
<!-- /wp:column -->

<!-- wp:column {"verticalAlignment":"center"} -->
<div class="wp-block-column is-vertically-aligned-center">
<!-- wp:image {"sizeSlug":"large"} -->
<figure class="wp-block-image size-large"><img src="https://example.com/hero.jpg" alt=""/></figure>
<!-- /wp:image -->
</div>
<!-- /wp:column --></div>
<!-- /wp:columns -->
</div>
<!-- /wp:group -->
```

## Adapt

- Use `level:1` for the headline only if this is the page's main hero; otherwise `level:2`.
- Swap colors/sizes for `get_theme_tokens()` slugs. For a solid-color background instead of an
  image, drop the `url`/`img` and add `{"customOverlayColor":"…"}` or a `backgroundColor` token.
- `align:"full"` / `align:"wide"` only render edge-to-edge if the theme supports those widths
  (`get_theme_tokens().layout`).
