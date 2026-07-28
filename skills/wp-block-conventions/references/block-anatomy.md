# Block anatomy

Field-level detail for a Linchpin block. The house patterns are in `SKILL.md`; this is the
lookup you open while writing the files.

## `block.json`

```jsonc
{
  "$schema": "https://schemas.wp.org/trunk/block.json",
  "apiVersion": 3,
  "name": "linchpin/accordion",
  "version": "1.5.7",
  "title": "Accordion",
  "category": "design",
  "keywords": ["linchpin", "accordion", "collapse", "expand"],
  "description": "Controls a group of accordion blocks.",
  "textdomain": "linchpin-blocks",

  "attributes": { /* only what `supports` can't express */ },
  "supports":   { /* prefer these over custom attributes */ },
  "providesContext": { "linchpin/accordion/autoClose": "autoClose" },
  "styles":     [ { "name": "grouped", "label": "Grouped", "isDefault": true } ],
  "example":    { "attributes": {}, "innerBlocks": [ /* … */ ], "viewportWidth": 640 },

  "editorScript":     "file:./index.js",
  "editorStyle":      "file:./index.css",
  "style":            "file:./style-index.css",
  "render":           "file:./render.php",
  "viewScriptModule": "file:./view.js"
}
```

Notes:

- **`category`** — use an existing core category (`design`, `media`, `text`, `widgets`)
  unless the project registers its own.
- **`keywords`** are the inserter's search surface. Include `linchpin` plus the words an
  editor would actually type, including synonyms the title doesn't contain.
- **`styles`** give editors variations without new blocks. One `isDefault: true`.
- **`viewScriptModule`** (not `viewScript`) is what pairs with `--experimental-modules` and
  the Interactivity API. Using `viewScript` loads a classic script instead and the
  `data-wp-*` directives will do nothing.
- **`example`** without `innerBlocks` renders an empty inserter preview for container blocks.

## `supports` before attributes

Reach for these first — they wire into theme.json, give editors the standard UI, and keep
styling in the design system:

| Need | `supports` key |
| --- | --- |
| Text/background/link color | `color` (`{ "text": …, "background": …, "link": … }`) |
| Padding, margin, gap | `spacing` (scope with `sides` / `blockGap`) |
| Font size and family | `typography` |
| Borders | `__experimentalBorder` |
| HTML anchor | `anchor` |
| Inner layout (flex/grid, orientation) | `layout` — set `allowEditing: false` to lock it |
| Interactivity API directives | `interactivity: true` |
| Suppress the "Edit as HTML" escape hatch | `html: false` |

A custom attribute is the right answer only when it carries data (a term ID, an interval, a
mode enum), not presentation.

## Parent / child families

Container and item blocks are separate blocks joined by **block context**, namespaced by the
parent:

```jsonc
// parent — accordion/block.json
"providesContext": {
  "linchpin/accordion/autoClose":  "autoClose",
  "linchpin/accordion/activeUUID": "activeUUID"
}

// child — accordion-pane/block.json
"usesContext": [ "linchpin/accordion/autoClose", "linchpin/accordion/activeUUID" ]
```

Rules:

- Namespace every context key `linchpin/<parent>/<key>` — bare keys collide across plugins.
- Constrain the family with `parent` (child only insertable inside its container) or
  `allowedBlocks` on the parent, so editors can't build invalid trees.
- Context flows **down only**. A child that needs to change parent state does it through the
  Interactivity store, not by mutating context.

## `render.php`

```php
<?php
/**
 * Server-side rendering of the `linchpin/accordion` block.
 *
 * @package linchpin-blocks
 *
 * @var array     $attributes Array of Block Attributes
 * @var string    $content    Block Content
 * @var \WP_Block $block      WP_Block object.
 */

namespace Linchpin_Blocks\Blocks;

use Linchpin_Blocks\Model\Blocks\Accordion;
use function \Linchpin_Blocks\Helper\Block_Utils\classNames;

$block_wrapper_attrs = get_block_wrapper_attributes( [
    'data-wp-interactive' => wp_json_encode( [ 'namespace' => 'linchpin/accordion' ] ),
    'data-wp-context'     => wp_json_encode( $model->get_initial_context( $block, $attributes ) ),
    'data-wp-init'        => 'callbacks.onAccordionInit',
    'class'               => classNames( [ 'has-block-gap' => /* … */ ] ),
] );
```

- Always emit the wrapper through **`get_block_wrapper_attributes()`** — it carries the
  `supports`-generated classes and inline styles. Hand-writing the wrapper drops them.
- `$attributes`, `$content`, `$block` are provided; document them in the docblock.
- **Escape on output** (`esc_html`, `esc_attr`, `wp_kses_post`) and pass structured data
  through `wp_json_encode` for directives.
- Non-trivial logic goes in a `Model\Blocks\<Block>` class; helpers like `classNames()` and
  block-gap resolution live in `Helper\Block_Utils`.

## `view.js` — Interactivity API

```js
import { store, getContext, getElement } from '@wordpress/interactivity';

const { state } = store( 'linchpin/accordion', {
    state: {
        get isOpen() {
            const { isOpen, uuid } = getContext();
            return isOpen.includes( uuid );
        },
    },
    actions: { toggle: () => { /* mutate context */ } },
    callbacks: { onAccordionInit: () => { /* run on init */ } },
} );
```

- The store namespace **must match** `data-wp-interactive`'s namespace in `render.php`.
- Derived values are getters on `state`; user interactions are `actions`; lifecycle hooks are
  `callbacks` referenced by `data-wp-init` / `data-wp-watch`.
- Mutate `context`, not the DOM. Directives (`data-wp-bind--*`, `data-wp-class--*`,
  `data-wp-on--*`) re-render from state.
- Keep `view.js` plain module JavaScript — no JSX, no editor packages.

## Full-width section layout

When a block renders a full-bleed section, the alignment is Gutenberg's job, not CSS's:

- Outer section: `core/group` with `{"align":"full","layout":{"type":"default"}}`.
- Immediate inner shell: `core/group` with `align:"wide"` — readable text and grids live
  here, not on the full-width outer block.
- No intermediate constrained groups between the full-width section and the content shell
  unless the design deliberately wants a narrow measure.
- Keep `theme.json` `contentSize` / `wideSize` aligned with the design.

**Debug order when a section still looks boxed:** wrapper alignment → serialized block
markup → template layout → `theme.json`. Custom breakout CSS is the last resort, and usually
a sign one of the four is wrong.

## Theme-side gotcha that bites block work

Block themes do **not** automatically load `style.css` on the front end. It must be enqueued
explicitly:

```php
add_action( 'wp_enqueue_scripts', function () {
    wp_enqueue_style( '<slug>-style', get_stylesheet_uri() );
} );
```

Missing this makes block styles look broken in a way that resembles a build problem. Enqueue
editor styles too, so the editor resembles the front end.
