# Editor extensions

Templates for JavaScript that changes the editor without being a block of its own: a control
added to a core block, a block style that needs a setting, a toolbar button, a sidebar
plugin, a format type. The house rules are in [`SKILL.md`](../SKILL.md#editor-extensions);
this is the lookup you open while writing the files.

## Layout

Extensions live in the same `blocks/` workspace as the project's blocks, beside them under
`src/editor/`, one folder per extension:

```
blocks/
├── webpack.config.js          # adds each extension as an entry (below)
├── src/
│   ├── <block-slug>/          # blocks, found from their block.json
│   └── editor/
│       └── <extension>/
│           ├── index.js       # registers the filter / plugin — nothing else
│           ├── controls.js    # the Inspector or toolbar UI
│           └── utils.js       # pure helpers, testable without the editor
└── build/
    └── editor/
        ├── <extension>.js
        └── <extension>.asset.php   # dependencies + version, generated
```

## Adding the entry

The default `@wordpress/scripts` config only finds blocks (through `block.json`). An extension
has no `block.json`, so it is added as an extra entry. Spread the default rather than
replacing it, so block discovery keeps working.

With `--experimental-modules` (the house block build) the default config is an **array** —
a classic-script config and a script-module config. The extension is a classic editor
script, so it goes on the first one:

```js
// blocks/webpack.config.js
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

const editorEntries = {
	'editor/<extension>': './src/editor/<extension>/index.js',
};

const addEntries = ( config ) => ( {
	...config,
	entry: async () => ( {
		...( await config.entry() ),
		...editorEntries,
	} ),
} );

module.exports = Array.isArray( defaultConfig )
	? [ addEntries( defaultConfig[ 0 ] ), ...defaultConfig.slice( 1 ) ]
	: addEntries( defaultConfig );
```

`config.entry` is a function in current `@wordpress/scripts`; awaiting it keeps working if it
returns a promise. After `npm run build`, confirm `build/editor/<extension>.asset.php` exists
and that the existing blocks' `build/` output did not change.

## The module

Import from the packages; the build turns each import into the right `wp-*` dependency in
`.asset.php`:

```js
// src/editor/<extension>/index.js
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';

import Controls from './controls';

const withControls = createHigherOrderComponent(
	( BlockEdit ) => ( props ) => {
		if ( 'core/quote' !== props.name || ! props.isSelected ) {
			return <BlockEdit { ...props } />;
		}

		return (
			<>
				<BlockEdit { ...props } />
				<Controls { ...props } />
			</>
		);
	},
	'withControls'
);

addFilter( 'editor.BlockEdit', '<namespace>/<extension>', withControls );
```

Return the unwrapped `BlockEdit` for every block the extension doesn't touch, and keep hooks
inside the child component (`Controls`), not in the filter, so hook order never depends on
which block is selected.

## Enqueueing

Enqueue from the generated asset file. Never type the dependency list by hand: it is how a
missing `wp-i18n` or a stale version string ships.

```php
add_action( 'enqueue_block_editor_assets', function () {
	$asset_file = <BLOCKS_PATH> . '/build/editor/<extension>.asset.php';

	if ( ! file_exists( $asset_file ) ) {
		return; // unbuilt: lose the control, keep the site
	}

	$asset = require $asset_file;

	wp_enqueue_script(
		'<namespace>-<extension>',
		<BLOCKS_URL> . '/build/editor/<extension>.js',
		$asset['dependencies'],
		$asset['version'],
		true
	);

	wp_set_script_translations( '<namespace>-<extension>', '<textdomain>' );
} );
```

Put this where the project registers its other editor code. In a functionality plugin built
on controllers, that is a controller of its own. Use the plugin's existing path and URL
constants for `<BLOCKS_PATH>` and `<BLOCKS_URL>`.

## Storing what the editor picks

When the control saves a value on a core block, decide where it lives, and say which and why
in the PR:

| Store it as | Good for | Cost |
| --- | --- | --- |
| A core `supports` value or `style` attribute | Anything core already has a control for | None. Use this first |
| A class in `className` (e.g. `has-<thing>-<slug>`) | A choice from a fixed set the CSS maps (palette slugs) | Only fixed sets; the CSS needs one rule per value |
| A registered attribute (`blocks.registerBlockType` filter, plus `register_block_type_args` in PHP) | Free values, or anything PHP or REST must read | Saved markup depends on the extension. Removing it later needs a deprecation |

A class in `className` keeps saved markup valid even where the script never loads, which is
usually what you want for a presentational choice.
