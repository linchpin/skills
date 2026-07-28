# Core block cheat sheet

Copy-paste-correct markup for the core blocks you'll compose with most. Shapes drift slightly
by WordPress version — always `validate_blocks` the result (see `validation.md`). Core blocks
omit the `core/` namespace.

## Text

**Paragraph**
```html
<!-- wp:paragraph -->
<p>Body copy goes here.</p>
<!-- /wp:paragraph -->
```

**Heading** (default level is `h2`; set `{"level":N}` AND change the tag together)
```html
<!-- wp:heading -->
<h2 class="wp-block-heading">Section title</h2>
<!-- /wp:heading -->

<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Subsection</h3>
<!-- /wp:heading -->
```

**List** (each item is its own `wp:list-item`)
```html
<!-- wp:list -->
<ul class="wp-block-list"><!-- wp:list-item -->
<li>First</li>
<!-- /wp:list-item -->

<!-- wp:list-item -->
<li>Second</li>
<!-- /wp:list-item --></ul>
<!-- /wp:list -->
```

## Layout containers

**Group** (constrained = respects theme content width; also `"flex"`, `"flow"`)
```html
<!-- wp:group {"layout":{"type":"constrained"}} -->
<div class="wp-block-group">
  <!-- child blocks -->
</div>
<!-- /wp:group -->
```

**Columns** (note nesting: `wp:columns` → `wp:column` → children)
```html
<!-- wp:columns -->
<div class="wp-block-columns"><!-- wp:column -->
<div class="wp-block-column">
  <!-- column 1 children -->
</div>
<!-- /wp:column -->

<!-- wp:column -->
<div class="wp-block-column">
  <!-- column 2 children -->
</div>
<!-- /wp:column --></div>
<!-- /wp:columns -->
```
Set widths with `{"width":"33.33%"}` on each `wp:column`. Stacking on mobile is on by default;
`{"isStackedOnMobile":false}` to disable.

**Spacer** (has inner HTML — NOT self-closing)
```html
<!-- wp:spacer {"height":"40px"} -->
<div style="height:40px" aria-hidden="true" class="wp-block-spacer"></div>
<!-- /wp:spacer -->
```

## Media & actions

**Image** (`id` ties to a real attachment; omit it for external/placeholder `src`)
```html
<!-- wp:image {"id":123,"sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image size-large"><img src="https://example.com/x.jpg" alt="" class="wp-image-123"/></figure>
<!-- /wp:image -->
```

**Buttons** (always wrap a `wp:button` inside `wp:buttons`)
```html
<!-- wp:buttons -->
<div class="wp-block-buttons"><!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="/contact">Get started</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->
```

**Cover** (background image/overlay with inner content; `dimRatio` = overlay opacity)
```html
<!-- wp:cover {"url":"https://example.com/bg.jpg","dimRatio":50,"minHeight":480} -->
<div class="wp-block-cover" style="min-height:480px"><span aria-hidden="true" class="wp-block-cover__background has-background-dim"></span><img class="wp-block-cover__image-background" src="https://example.com/bg.jpg" alt=""/><div class="wp-block-cover__inner-container">
  <!-- inner blocks: heading, paragraph, buttons -->
</div></div>
<!-- /wp:cover -->
```

## Using design tokens

Prefer the site's theme.json slugs over hardcoded values (pull them from `get_theme_tokens()`):

```html
<!-- wp:heading {"textColor":"primary","fontSize":"x-large"} -->
<h2 class="wp-block-heading has-primary-color has-text-color has-x-large-font-size">Title</h2>
<!-- /wp:heading -->
```
The JSON attribute (`"textColor":"primary"`) and the generated classes
(`has-primary-color has-text-color`) must agree — this is why validation matters.

## Reuse references (not composition)

These insert existing assets — see `patterns-and-parts.md`:
```html
<!-- wp:block {"ref":451} /-->                         ← synced pattern (wp_block #451)
<!-- wp:pattern {"slug":"linchpin/pricing-3col"} /-->  ← registered pattern reference
<!-- wp:template-part {"slug":"footer","theme":"linchpin"} /-->
```
