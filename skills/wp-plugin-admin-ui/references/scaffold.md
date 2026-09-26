# Admin screen scaffold

Skeletons for every file [`SKILL.md`](../SKILL.md) names, derived from
[`linchpin/psst`](https://github.com/linchpin/psst). They show the shape, not the product: keep
the structure, replace the copy. When psst and this file disagree, read psst and fix this file.

Placeholders:

| Placeholder | Example (psst) | Example (linchpin-docs-ai) |
| --- | --- | --- |
| `{slug}` | `psst` | `linchpin-docs-ai` |
| `{slugCamel}` | `psst` | `linchpinDocsAi` |
| `{Namespace}` | `Linchpin\Psst` | `Linchpin\Docs_AI` |
| `{PREFIX}` | `PSST` | `LINCHPIN_DOCS_AI` |
| `{Name}` | `Psst` | `Docs AI` |

## Files

```text
includes/
  Controller/Admin/Admin_Page.php     registers the page, mounts the app, enqueues it
  Controller/REST/REST_Base.php       namespace, admin permission, no-store headers
  Controller/REST/Admin_<Concern>.php one per concern, under /admin/*
  Helper/Assets.php                   reads build/*.asset.php
src/
  admin/index.js                      the chrome and the section switch
  admin/brand.js                      defineBrand() and linchpinLinks()
  admin/hooks.js                      useRoute()
  admin/components/sidebar.js         the help column
  admin/views/<section>.js            one per section
  scss/admin.scss                     the plugin's own furniture, tokens only
webpack.config.js                     admin entry (plus any others)
```

Controllers under `includes/Controller/` are picked up by the plugin's `Core\Bootstrap` glob in
the house plugin shape. If a plugin registers its controllers by hand, register these too.

## `includes/Controller/Admin/Admin_Page.php`

```php
<?php
/**
 * The admin page that hosts the React app (src/admin).
 *
 * @package {Namespace}\Controller\Admin
 */

namespace {Namespace}\Controller\Admin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use {Namespace}\Controller\Controller_Interface;
use {Namespace}\Controller\REST\REST_Base;
use {Namespace}\Helper\Assets;

class Admin_Page implements Controller_Interface {

	public const SLUG = '{slug}';

	private string $hook = '';

	public function register_actions(): void {
		add_action( 'admin_menu', [ $this, 'add_menu' ] );
		add_action( 'admin_enqueue_scripts', [ $this, 'enqueue' ] );
		add_filter( 'plugin_action_links_' . {PREFIX}_BASENAME, [ $this, 'action_links' ] );
	}

	/**
	 * Under Mantle's Linchpin menu when it is active, otherwise under Settings.
	 * Mantle defines MANTLE_PLUGIN_FILE and has no global `Mantle` class.
	 */
	private static function parent(): string {
		return \defined( 'MANTLE_PLUGIN_FILE' ) ? 'mantle' : 'options-general.php';
	}

	public function add_menu(): void {
		$hook = add_submenu_page(
			self::parent(),
			__( '{Name}', '{slug}' ),
			__( '{Name}', '{slug}' ),
			'manage_options',
			self::SLUG,
			[ $this, 'render' ]
		);

		$this->hook = \is_string( $hook ) ? $hook : '';
	}

	public function render(): void {
		echo '<div id="{slug}-admin" class="{slug}-admin"></div>';
	}

	public function enqueue( $hook ): void {
		if ( '' === $this->hook || $hook !== $this->hook ) {
			return;
		}

		$asset = Assets::read( {PREFIX}_PATH . 'build/admin.asset.php' );

		if ( null === $asset ) {
			return;
		}

		wp_enqueue_script(
			'{slug}-admin',
			{PREFIX}_URL . 'build/admin.js',
			array_merge( $asset['dependencies'], [ 'wp-api-fetch' ] ),
			$asset['version'],
			true
		);

		wp_set_script_translations( '{slug}-admin', '{slug}', {PREFIX}_PATH . 'languages' );

		if ( file_exists( {PREFIX}_PATH . 'build/admin.css' ) ) {
			// The chrome's rules must land after core's.
			$style_dependencies = [ 'wp-components' ];

			if ( wp_style_is( 'wp-theme', 'registered' ) ) {
				$style_dependencies[] = 'wp-theme';
			}

			wp_enqueue_style( '{slug}-admin', {PREFIX}_URL . 'build/admin.css', $style_dependencies, $asset['version'] );
		}

		// Boot data only: no secret, token or key ever goes here.
		wp_add_inline_script(
			'{slug}-admin',
			'window.{slugCamel}Admin = ' . wp_json_encode(
				[
					'restUrl' => esc_url_raw( rest_url( REST_Base::NAMESPACE . '/' ) ),
					'nonce'   => wp_create_nonce( 'wp_rest' ),
					'version' => {PREFIX}_VERSION,
				]
			) . ';',
			'before'
		);
	}

	public function action_links( $links ): array {
		$links   = (array) $links;
		$links[] = sprintf(
			'<a href="%s">%s</a>',
			esc_url( add_query_arg( 'page', self::SLUG, admin_url( 'mantle' === self::parent() ? 'admin.php' : 'options-general.php' ) ) ),
			esc_html__( 'Settings', '{slug}' )
		);

		return $links;
	}
}
```

## `includes/Helper/Assets.php`

```php
final class Assets {

	/**
	 * @return array{dependencies: string[], version: string}|null Null when the build is missing.
	 */
	public static function read( string $file ): ?array {
		if ( ! is_readable( $file ) ) {
			return null;
		}

		$asset = include $file;

		if ( ! is_array( $asset ) ) {
			return null;
		}

		return [
			'dependencies' => array_values( array_filter( (array) ( $asset['dependencies'] ?? [] ), 'is_string' ) ),
			'version'      => (string) ( $asset['version'] ?? {PREFIX}_VERSION ),
		];
	}
}
```

## `includes/Controller/REST/REST_Base.php`

```php
abstract class REST_Base implements Controller_Interface {

	public const NAMESPACE = '{slug}/v1';

	public function register_actions(): void {
		add_action( 'rest_api_init', [ $this, 'register_routes' ] );
		add_filter( 'rest_post_dispatch', [ $this, 'no_store_headers' ], 10, 3 );
	}

	abstract public function register_routes(): void;

	public function get_api_namespace(): string {
		return self::NAMESPACE;
	}

	public function get_admin_permissions( \WP_REST_Request $request ): bool|\WP_Error {
		if ( current_user_can( 'manage_options' ) ) {
			return true;
		}

		return new \WP_Error(
			'{slug}_forbidden',
			__( 'You are not allowed to do that.', '{slug}' ),
			[ 'status' => rest_authorization_required_code() ]
		);
	}

	public function no_store_headers( $result, $server, $request ) {
		if ( 0 !== strpos( (string) $request->get_route(), '/' . self::NAMESPACE ) ) {
			return $result;
		}

		$result->header( 'Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0' );
		$result->header( 'Pragma', 'no-cache' );
		$result->header( 'X-Robots-Tag', 'noindex, nofollow' );

		return $result;
	}
}
```

## `includes/Controller/REST/Admin_Status.php` — a read and an action

```php
class Admin_Status extends REST_Base {

	public function register_routes(): void {
		register_rest_route(
			$this->get_api_namespace(),
			'/admin/status',
			[
				'methods'             => \WP_REST_Server::READABLE,
				'callback'            => [ $this, 'get_status' ],
				'permission_callback' => [ $this, 'get_admin_permissions' ],
				'show_in_index'       => false,
			]
		);

		register_rest_route(
			$this->get_api_namespace(),
			'/admin/sync',
			[
				'methods'             => \WP_REST_Server::CREATABLE,
				'callback'            => [ $this, 'sync' ],
				'permission_callback' => [ $this, 'get_admin_permissions' ],
				'show_in_index'       => false,
			]
		);
	}

	public function get_status(): \WP_REST_Response {
		// Facts only. A secret is reported as set or missing, never sent.
		return new \WP_REST_Response( [ /* … */ ] );
	}

	public function sync(): \WP_REST_Response|\WP_Error {
		// Queue the work (Action Scheduler) rather than doing it in the request.
		return new \WP_REST_Response( [ 'queued' => true ] );
	}
}
```

## `src/admin/index.js`

```jsx
/**
 * WordPress dependencies
 */
import { createRoot } from '@wordpress/element';
import domReady from '@wordpress/dom-ready';
import { __ } from '@wordpress/i18n';
import { Button } from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';

/**
 * External dependencies
 */
import {
	AboutLinchpinPage,
	currentSection,
	LinchpinAdminFooter,
	LinchpinAdminFrame,
	LinchpinAdminLayout,
	LinchpinAdminPage,
	LinchpinAdminTopBar,
	LinchpinNotices,
	sectionNavigation,
} from '@linchpinagency/ui';
import '@linchpinagency/ui/style.css';

/**
 * Internal dependencies
 */
import './../scss/admin.scss';
import { BRAND, LINKS } from './brand';
import Sidebar from './components/sidebar';
import StatusView from './views/status';

const boot = window.{slugCamel}Admin || {};

if ( boot.restUrl ) {
	apiFetch.use( apiFetch.createRootURLMiddleware( boot.restUrl ) );
}

if ( boot.nonce ) {
	apiFetch.use( apiFetch.createNonceMiddleware( boot.nonce ) );
}

const PLUGIN = { name: __( '{Name}', '{slug}' ), slug: '{slug}', version: boot.version };

// Links, not tab state: linkable, bookmarkable, and they survive a reload.
const SECTIONS = [
	{ name: 'status', label: __( 'Status', '{slug}' ) },
	{ name: 'about', label: __( 'About', '{slug}' ) },
];

// Tables and the About page take the full width.
const FULL_WIDTH = [ 'about' ];

function View( { section } ) {
	switch ( section ) {
		case 'about':
			return <AboutLinchpinPage />;
		default:
			return <StatusView />;
	}
}

function App() {
	const section = currentSection( { sections: SECTIONS } );

	return (
		<LinchpinAdminFrame
			plugin={ PLUGIN }
			brand={ BRAND }
			links={ LINKS }
			topBar={ <LinchpinAdminTopBar /> /* pass logo={ <Logo /> } once the plugin has artwork */ }
		>
			<LinchpinAdminPage
				subTitle={ __( 'One sentence on what the plugin does.', '{slug}' ) }
				navigation={ sectionNavigation( { sections: SECTIONS } ) }
				actions={
					<Button
						__next40pxDefaultSize
						variant="secondary"
						href={ LINKS.readme }
						target="_blank"
						rel="noreferrer"
					>
						{ __( 'Documentation', '{slug}' ) }
					</Button>
				}
			>
				<LinchpinNotices />

				<LinchpinAdminLayout
					label={ __( 'About {Name}', '{slug}' ) }
					sidebar={ FULL_WIDTH.includes( section ) ? undefined : <Sidebar /> }
				>
					<View section={ section } />
				</LinchpinAdminLayout>
			</LinchpinAdminPage>

			<LinchpinAdminFooter />
		</LinchpinAdminFrame>
	);
}

domReady( () => {
	const mount = document.getElementById( '{slug}-admin' );

	if ( mount ) {
		// The frame owns ThemeProvider and SlotFillProvider; add neither.
		createRoot( mount ).render( <App /> );
	}
} );
```

## `src/admin/brand.js`

```js
import { defineBrand, linchpinLinks } from '@linchpinagency/ui';

// Colours from the plugin's own artwork; `defineBrand()` with nothing is Linchpin's palette.
export const BRAND = defineBrand( { primary: '#…', deep: '#…', deepEnd: '#…' } );

export const LINKS = linchpinLinks( { plugin: '{slug}' } );
```

## `src/admin/hooks.js`

```js
import { useCallback, useEffect, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';

export function useRoute( path ) {
	const [ data, setData ] = useState( null );
	const [ error, setError ] = useState( null );
	const [ isLoading, setLoading ] = useState( true );
	const [ tick, setTick ] = useState( 0 );

	useEffect( () => {
		let cancelled = false;
		setLoading( true );

		apiFetch( { path } )
			.then( ( result ) => ! cancelled && ( setData( result ), setError( null ) ) )
			.catch( ( err ) => ! cancelled && setError( err ) )
			.finally( () => ! cancelled && setLoading( false ) );

		return () => {
			cancelled = true;
		};
	}, [ path, tick ] );

	const refetch = useCallback( () => setTick( ( t ) => t + 1 ), [] );

	return { data, error, isLoading, refetch };
}
```

## `src/admin/components/sidebar.js`

```jsx
import { AboutLinchpinCard, FeatureListCard, HelpCard } from '@linchpinagency/ui';

// Only the first card carries the plugin's own copy; the other two are the agency's.
export default function Sidebar() {
	return (
		<>
			<FeatureListCard title={ __( 'How it works', '{slug}' ) } items={ HOW_IT_WORKS } />
			<HelpCard />
			<AboutLinchpinCard />
		</>
	);
}
```

## `src/admin/views/status.js` — facts and an action

```jsx
export default function StatusView() {
	const { data, error, isLoading, refetch } = useRoute( '/{slug}/v1/admin/status' );
	const [ isBusy, setBusy ] = useState( false );
	const { createSuccessNotice, createErrorNotice } = useDispatch( noticesStore );

	if ( error ) {
		return (
			<Notice status="error" isDismissible={ false }>
				{ error.message || __( 'The status could not be loaded.', '{slug}' ) }
			</Notice>
		);
	}

	if ( isLoading && ! data ) {
		return (
			<div className="{slug}-admin__loading">
				<Spinner />
				<span>{ __( 'Loading…', '{slug}' ) }</span>
			</div>
		);
	}

	const run = async () => {
		setBusy( true );

		try {
			await apiFetch( { path: '/{slug}/v1/admin/sync', method: 'POST' } );
			createSuccessNotice( __( 'Queued.', '{slug}' ), { type: 'snackbar' } );
			refetch();
		} catch ( err ) {
			createErrorNotice( err?.message || __( 'Nothing was queued.', '{slug}' ), { type: 'snackbar' } );
		} finally {
			setBusy( false );
		}
	};

	return (
		<SettingsCard
			title={ __( 'Status', '{slug}' ) }
			description={ __( 'One sentence on what this section is for.', '{slug}' ) }
			actions={
				<Button __next40pxDefaultSize variant="primary" isBusy={ isBusy } disabled={ isBusy } onClick={ run }>
					{ __( 'Run now', '{slug}' ) }
				</Button>
			}
		>
			<dl className="{slug}-admin__facts">{ /* one <div className="{slug}-admin__row is-ok|is-warn"><dt/><dd/></div> per fact */ }</dl>
		</SettingsCard>
	);
}
```

## A DataViews view — the parts that differ

```jsx
const DEFAULT_VIEW = {
	type: 'table',
	page: 1,
	perPage: 20,
	sort: { field: 'time', direction: 'desc' },
	fields: [ 'title', 'detail', 'time' ],
	layout: { styles: { detail: { width: '55%' } } },
};

// A list that arrives whole: let DataViews sort and page it on the client.
const { data: shown, paginationInfo } = filterSortAndPaginate( items, view, fields );

<DataViews
	data={ shown }
	fields={ fields }
	view={ view }
	onChangeView={ setView }
	actions={ [ { id: 'run', label: __( 'Run', '{slug}' ), isPrimary: true, supportsBulk: true, callback } ] }
	isLoading={ isLoading }
	paginationInfo={ paginationInfo }
	defaultLayouts={ { table: {} } }
	getItemId={ ( item ) => String( item.id ) }
/>
```

A field named as `titleField` renders through DataViews' own primary column, which ignores
`layout.styles` widths and the field's `render`. Make it an ordinary column when it needs a
width or a link.

## `src/scss/admin.scss`

```scss
// Only when a view uses DataViews: WordPress registers no `wp-dataviews` style handle.
@use "@wordpress/dataviews/build-style/style.css";

.{slug}-admin {

	&__loading {
		display: flex;
		align-items: center;
		gap: var(--wpds-dimension-gap-sm);
		padding: 24px 0;
		color: var(--wpds-color-foreground-content-neutral-weak);
	}

	// Every colour a `--wpds-*` token; no hex.
}
```

## `webpack.config.js`

```js
const path = require( 'path' );
const RemoveEmptyScriptsPlugin = require( 'webpack-remove-empty-scripts' );
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

module.exports = {
	...defaultConfig,
	entry: {
		admin: path.resolve( __dirname, 'src/admin/index.js' ),
		// editor: path.resolve( __dirname, 'src/editor/index.js' ),
	},
	output: { ...defaultConfig.output, path: path.resolve( __dirname, 'build' ) },
	plugins: [ ...defaultConfig.plugins, new RemoveEmptyScriptsPlugin() ],
};
```

psst also carries a rule that keeps SVG `viewBox` for a logo imported as a component; copy it
when the top bar gets the plugin's own mark.

## `package.json`

`@linchpinagency/ui` and every peer it names, as **devDependencies**, at the versions psst
uses: `@wordpress/admin-ui`, `@wordpress/components`, `@wordpress/data`,
`@wordpress/element`, `@wordpress/i18n`, `@wordpress/icons`, `@wordpress/notices`,
`@wordpress/theme`, plus what the views import (`@wordpress/api-fetch`,
`@wordpress/dom-ready`, `@wordpress/dataviews`, `@wordpress/date`, `@wordpress/url`), and
`webpack-remove-empty-scripts`. `npm view @linchpinagency/ui peerDependencies` lists the peers
for the release being installed.

## `scripts/build.sh`

Add the admin bundle to the required-files check, beside whatever else the plugin ships:

```bash
	build/admin.js \
	build/admin.asset.php \
	build/admin.css \
```
