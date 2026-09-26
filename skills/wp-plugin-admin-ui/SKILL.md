---
name: wp-plugin-admin-ui
description: Build or review a Linchpin plugin's admin screen the house way — a React app on @linchpinagency/ui (linchpin/ui) in psst's shape, with an Admin_Page controller that mounts one div and hands over the REST root and nonce, REST_Base routes under {slug}/v1/admin/*, views made of SettingsCard, DataViews and snackbar notices, and the build that ships it. Use when adding a settings page, admin screen, status or tools page to a plugin, when asked to build or review a plugin's admin UI, or when a plugin still renders its screen in PHP or with the Settings API. Not for blocks — use `wp-block-conventions`.
when_to_use: Also when someone says "add an options page", "make it look like psst", "use linchpin/ui", "our admin pages all look different", asks where a plugin's settings screen belongs in the menu, or is moving a screen to a new @linchpinagency/ui release.
version: 1.0.0
allowed-tools: Read Grep Glob Bash(npm view @linchpinagency/ui*) Bash(gh api repos/linchpin/*) Bash(git ls-files*)
---

# Linchpin plugin admin UI

Every Linchpin plugin grew the same admin screen — a brand bar, a page header with section
tabs, cards, a help column, an About Linchpin page — and each built its own copy until
[`@linchpinagency/ui`](https://github.com/linchpin/ui) became that arrangement, once. The
library owns the chrome. This skill owns everything around it that makes a plugin's screen
land on the same shape: where the page registers, how the app loads and gets its data, how the
views are written, and how it builds. The reference implementation is
[`linchpin/psst`](https://github.com/linchpin/psst).

## When to use

- Adding a settings page, admin screen, status or dashboard page, or tools page to a Linchpin
  plugin — including a "small" read-only one.
- Reviewing a plugin's admin screen, or asked why it doesn't look like psst or mantle.
- A plugin renders its screen in PHP, uses Settings API forms (`settings_fields()`,
  `do_settings_sections()`), or hand-rolls chrome the library provides.
- Moving a screen onto a new `@linchpinagency/ui` release.

**Not this skill:** what a component renders and what its props mean — linchpin/ui's own docs
(`docs/ui/` in that repo, published to docs.linchpin.com), which are canonical and versioned
with the package. The plugin repo's required files, CI callers and build artifacts —
[`wp-plugin-standards`](../wp-plugin-standards/SKILL.md). Blocks —
[`wp-block-conventions`](../wp-block-conventions/SKILL.md). Running lint and builds —
[`quality-gates`](../quality-gates/SKILL.md). Clicking through the finished screen as a user —
[`web-qa`](../web-qa/SKILL.md).

## Owns

Canonical for: **how a Linchpin plugin hosts an admin screen** — its menu placement, the PHP
controller that mounts it, how its assets load and what boot data reaches JavaScript, the REST
namespace and permission shape it reads from, the `src/admin` layout, how the library's chrome
is composed, and the house patterns for loading, errors, actions, tables and styles.

**This deliberately differs from upstream `wp-plugin-development`**, which builds settings
pages with the Settings API. A Linchpin screen is a React app on `@linchpinagency/ui` that
reads and writes over REST. `register_setting()` may still store an option; no screen is a
Settings API form.

Defers:

- Component APIs, props, the brand contract and the stylesheet name → linchpin/ui's docs.
  Never restate them here or in a plugin; a copy drifts from the release it describes.
- `build.sh`, `.distignore`, package scripts → [`wp-plugin-standards`](../wp-plugin-standards/SKILL.md).
- Lint and builds → [`quality-gates`](../quality-gates/SKILL.md). The browser pass →
  [`web-qa`](../web-qa/SKILL.md). Commit and PR → [`commit-and-release`](../commit-and-release/SKILL.md).
  The task → [`task-tracking`](../task-tracking/SKILL.md).

## Preflight

Read the plugin before writing anything; what exists decides between building and migrating.

| Look for | Tells you | If missing |
| --- | --- | --- |
| `package.json` → `@linchpinagency/ui`, against `npm view @linchpinagency/ui version` | The library is in, and whether it is current | Not adopted: a new screen or a migration |
| `add_menu_page` / `add_submenu_page` / `add_options_page` / `add_management_page` under `includes/` | Where the screen registers today | No screen yet |
| What that page's render callback prints | One mount div means React; markup means PHP-rendered | — |
| `settings_fields(` or `do_settings_sections(` | A Settings API form, to be replaced | — |
| `src/admin/` and an `admin` entry in `webpack.config.js` | The app's source and build entry | Scaffold them |
| `register_rest_route` and a `REST_Base` | Where the screen's data would come from | Add them |
| The plugin's slug in `.linchpin.json` or the main file's `Text Domain` | `{slug}` in every name below | Ask; never guess a slug |
| psst's current `src/admin/index.js` (`gh api repos/linchpin/psst/contents/src/admin/index.js`) | The living reference, when this file and psst disagree | Follow this file |

Every file named below has a skeleton in
[`references/scaffold.md`](references/scaffold.md), derived from psst.

## Procedure

1. **Register the page.** `Controller\Admin\Admin_Page` with a `SLUG` constant. Call
   `add_submenu_page()` under `mantle` when `defined( 'MANTLE_PLUGIN_FILE' )`, otherwise under
   `options-general.php`. Use `manage_options` unless the plugin defines its own capability. The
   render callback echoes only `<div id="{slug}-admin" class="{slug}-admin"></div>`. Add a
   Settings link through `plugin_action_links_{basename}`. → The page opens to an empty mount
   div, under Linchpin beside Mantle and under Settings without it.
2. **Load the app on that page only.** Gate `admin_enqueue_scripts` on the hook suffix
   `add_submenu_page()` returned. Read `build/admin.asset.php` through `Helper\Assets::read()`,
   which returns null when the build is missing. Enqueue script `{slug}-admin` with the
   manifest's dependencies plus `wp-api-fetch`, call `wp_set_script_translations()`, and enqueue
   `build/admin.css` depending on `wp-components` (plus `wp-theme` when it is registered). Pass
   `window.{slug}Admin = { restUrl, nonce, version, … }` in camelCase with
   `wp_add_inline_script( …, 'before' )`. → Script and style load on this page and no other,
   and the boot object is present.
3. **Serve the data over REST.** An abstract `Controller\REST\REST_Base` with
   `NAMESPACE = '{slug}/v1'`, a `get_admin_permissions()` that returns `true` or
   `WP_Error( '{slug}_forbidden', …, [ 'status' => rest_authorization_required_code() ] )`, and
   no-store headers on its namespace. One controller per concern under `/admin/*`, every route
   `'show_in_index' => false`. → Each view's route answers an administrator and refuses anyone
   else with 401 or 403.
4. **Compose the chrome.** `src/admin/index.js` adds apiFetch's root-URL and nonce middleware
   from the boot object, then renders `LinchpinAdminFrame` → `LinchpinAdminPage` (with
   `navigation={ sectionNavigation( … ) }`) → `<LinchpinNotices />` first → `LinchpinAdminLayout`
   with the help sidebar → the section's view, and `<LinchpinAdminFooter />` last. `brand.js`
   calls `defineBrand()` with colours from the plugin's own artwork, or with none for Linchpin's
   palette, and `linchpinLinks( { plugin: '{slug}' } )`. Give it an About section that renders
   `<AboutLinchpinPage />`. Mount with `createRoot` inside `domReady`, and add no
   `ThemeProvider` or `SlotFillProvider` of your own. → Bar, header, tabs, notices and footer
   render, and `?tab=` switches sections.
5. **Write the views to the house patterns** below. → Every view has loading, error and loaded
   states, and every action reports through a snackbar.
6. **Style with tokens.** `src/scss/admin.scss`, imported after `@linchpinagency/ui/style.css`,
   with BEM classes `.{slug}-admin__*` and colours only from `--wpds-*` tokens. When a view
   uses DataViews, add `@use "@wordpress/dataviews/build-style/style.css";` there, because
   WordPress registers no `wp-dataviews` style handle. → `npm run lint:css` passes and no hex
   colour appears in the plugin's admin styles.
7. **Build it.** Point a webpack `admin` entry at `src/admin/index.js`, building into `build/`,
   with any other entry, such as an editor panel, beside it. Add `@linchpinagency/ui` and its
   `@wordpress/*` peers as devDependencies at the versions psst uses, and make `build.sh`
   require `build/admin.js`, `build/admin.asset.php` and `build/admin.css`. → `npm run build`
   and the release build pass. An `admin.js` near 850 KB is expected: `admin-ui`, `dataviews`
   and `icons` are bundled, not externalised.
8. **Exercise it in a browser.** Open every section, run every action, and read the console.
   → Each section renders, each action shows its snackbar, and the console is clean. Hand a
   full pass to [`web-qa`](../web-qa/SKILL.md).

### House patterns for views

| Need | Pattern |
| --- | --- |
| Data | A `useRoute( path )` hook in `hooks.js`, returning `{ data, error, isLoading, refetch }` |
| A section of a screen | `SettingsCard` with a title and one sentence, and its action in `actions` |
| Read-only facts | A `<dl>` of rows inside a `SettingsCard`, each marked ok, warn or info |
| A table | DataViews with `defaultLayouts={ { table: {} } }`, and `filterSortAndPaginate` for a list that arrives whole. Row actions are DataViews actions |
| Run, save, sync | `Button __next40pxDefaultSize variant="primary"` with `isBusy` and `disabled`, then `createSuccessNotice` or `createErrorNotice( …, { type: 'snackbar' } )`, then `refetch()` |
| A view that fails to load | `<Notice status="error" isDismissible={ false }>` with the error's message |
| Loading | A `Spinner` with a short label, in a `{slug}-admin__loading` row |
| Something irreversible | `<DangerZone>`, with the plugin owning any confirmation |
| Copy with a link in it | `createInterpolateElement()` around one translatable sentence |

## Guardrails

- **Never render a Linchpin plugin's admin screen in PHP, or build it with Settings API
  forms** — not even a small status page. That is exactly how the screens drifted apart.
- **Never hand-roll what the library ships**: the top bar, page header, tabs, cards, help and
  About cards, notices, footer or danger zone. When every plugin needs something the library
  lacks, add it to linchpin/ui, not to one plugin.
- **Never restate linchpin/ui's component docs** in a plugin or a skill. Link them.
- **Never put a hex colour in a plugin's admin styles.** Brand through `defineBrand()`,
  everything else through `--wpds-*` tokens.
- **Never add `@wordpress/*` packages as dependencies of `@linchpinagency/ui`.** On a peer
  conflict, fix the plugin's own versions.
- **Never mount a second `LinchpinAdminFrame`** on a page, or wrap one in a `ThemeProvider`.
- **Never enqueue the admin bundle on every admin page.** Gate it on the page's hook suffix.
- **Never send a secret, token or key** in the boot object or a REST response. Report "set" or
  "missing".
- **Never test for Mantle with `class_exists( 'Mantle' )`.** Mantle has no global class, so the
  check is always false. psst and linchpin-blocks both carry it.
- If a screen needs a pattern that is not plugin-specific and the library does not have it,
  stop and raise it against linchpin/ui rather than inventing it locally.

## Done

- [ ] Preflight ran, and the `@linchpinagency/ui` version is the current release or the reason
      it isn't is stated.
- [ ] The page registers under Mantle or Settings, renders one mount div, and has a Settings
      link on the plugins screen.
- [ ] Assets load only on that page, translations are set, and the stylesheet depends on
      `wp-components`.
- [ ] The screen reads and writes only through `{slug}/v1/admin/*` routes with administrator
      permissions and no-store headers.
- [ ] The chrome is the library's; the plugin's own files hold only its sections, copy, views
      and brand.
- [ ] Every view has loading, error and loaded states, and every action reports through a
      snackbar.
- [ ] No hex colour in the plugin's admin styles, and DataViews' stylesheet is pulled in when a
      view uses it.
- [ ] Lint, the build and the release build pass, and every section was exercised in a browser
      with a clean console.
