---
title: wp-plugin-admin-ui
---

Every Linchpin plugin grew the same admin screen — a brand bar, a page header with section tabs, cards, a help column, an About Linchpin page — and each built its own copy until [`@linchpinagency/ui`](https://github.com/linchpin/ui) became that arrangement, once. The library owns the chrome. This skill owns everything around it: where the page registers, how the app loads and gets its data, how the views are written, and how it builds. The reference implementation is [psst](https://github.com/linchpin/psst).

## When to reach for it

- Adding a settings page, admin screen, status or dashboard page, or tools page to a Linchpin plugin, including a "small" read-only one.
- Reviewing a plugin's admin screen, or asked why it doesn't look like psst or mantle.
- A plugin renders its screen in PHP, uses Settings API forms, or hand-rolls chrome the library provides.
- Moving a screen onto a new `@linchpinagency/ui` release.

Things you might say that load it: "add a settings page to this plugin", "make it look like psst", "use linchpin/ui", "our admin pages all look different".

## Where it stops

> **Not this skill:** what a component renders and what its props mean — linchpin/ui's own docs, canonical and versioned with the package. The plugin repo's required files, CI callers and build artifacts — [`wp-plugin-standards`](wp-plugin-standards.md). Blocks — [`wp-block-conventions`](wp-block-conventions.md). Running lint and builds — [`quality-gates`](quality-gates.md). Clicking through the finished screen as a user — [`web-qa`](web-qa.md).

It deliberately differs from upstream [`wp-plugin-development`](../upstream.md), which builds settings pages with the Settings API. A Linchpin screen is a React app on `@linchpinagency/ui` that reads and writes over REST; `register_setting()` may still store an option, but no screen is a Settings API form.

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Register the page","content":"<p>An Admin_Page controller adds the page under Mantle's Linchpin menu when Mantle is active, otherwise under Settings, and renders nothing but one mount div.</p>"},{"title":"Load the app on that page only","content":"<p>Gate the enqueue on the page's hook suffix, read the asset manifest, set translations, load the stylesheet after wp-components, and hand the app its REST root and nonce.</p>"},{"title":"Serve the data over REST","content":"<p>A REST_Base under {slug}/v1 with an administrator permission check and no-store headers, and one controller per concern under /admin/*.</p>"},{"title":"Compose the chrome","content":"<p>Frame, top bar, page with section navigation, notices, the two-column layout with the help sidebar, the view, and the footer, all from the library.</p>"},{"title":"Write the views to the house patterns","content":"<p>Settings cards, facts as definition lists, DataViews for tables, actions that report through snackbars, and a loading and an error state for every view.</p>"},{"title":"Style with tokens","content":"<p>BEM classes under {slug}-admin, every colour a design-system token, and DataViews' stylesheet pulled in through Sass when a view uses it.</p>"},{"title":"Build it","content":"<p>A webpack admin entry, the library and its peers as devDependencies, and the release build checking for the admin bundle.</p>"},{"title":"Exercise it in a browser","content":"<p>Open every section and run every action with the console open, then hand a full pass to web-qa.</p>"}]} /-->

## What it checks first

- `package.json` for `@linchpinagency/ui`, against the current release on npm.
- Where the screen registers today, and whether its render callback prints a mount div or markup.
- Any `settings_fields()` or `do_settings_sections()` — a Settings API form to replace.
- `src/admin/`, an `admin` webpack entry, and a `REST_Base` — what exists and what to scaffold.
- The plugin's slug, which every name in the screen is built from.
- psst's current `src/admin/index.js`, when the skill and psst disagree.

## What it owns

Canonical for: how a Linchpin plugin hosts an admin screen — its menu placement, the PHP controller that mounts it, how its assets load and what boot data reaches JavaScript, the REST namespace and permission shape it reads from, the `src/admin` layout, how the library's chrome is composed, and the house patterns for loading, errors, actions, tables and styles. It defers component APIs and the brand contract to linchpin/ui's docs, the repo's files and scripts to [`wp-plugin-standards`](wp-plugin-standards.md), and running lint and builds to [`quality-gates`](quality-gates.md).

## Guardrails

- Never render a Linchpin plugin's admin screen in PHP, or build it with Settings API forms.
- Never hand-roll what the library ships; add what every plugin needs to linchpin/ui instead.
- Never restate linchpin/ui's component docs in a plugin or a skill.
- Never put a hex colour in a plugin's admin styles.
- Never add `@wordpress/*` packages as dependencies of `@linchpinagency/ui`.
- Never mount a second frame on a page, or wrap one in a `ThemeProvider`.
- Never enqueue the admin bundle on every admin page.
- Never send a secret, token or key in the boot object or a REST response.
- Never test for Mantle with `class_exists( 'Mantle' )` — it is always false.

## Done when

- [ ] Preflight ran, and the library version is current or the reason it isn't is stated.
- [ ] The page registers under Mantle or Settings, renders one mount div, and has a Settings link on the plugins screen.
- [ ] Assets load only on that page, translations are set, and the stylesheet depends on `wp-components`.
- [ ] The screen reads and writes only through `{slug}/v1/admin/*` routes with administrator permissions and no-store headers.
- [ ] The chrome is the library's; the plugin's files hold only its sections, copy, views and brand.
- [ ] Every view has loading, error and loaded states, and every action reports through a snackbar.
- [ ] No hex colour in the plugin's admin styles, and DataViews' stylesheet is pulled in when a view uses it.
- [ ] Lint, the build and the release build pass, and every section was exercised in a browser with a clean console.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/wp-plugin-admin-ui/SKILL.md) is the skill.
- [`references/scaffold.md`](https://github.com/linchpin/skills/blob/main/skills/wp-plugin-admin-ui/references/scaffold.md) — skeletons for every file the screen needs, from `Admin_Page.php` and `REST_Base.php` to `src/admin/index.js`, a view, the SCSS and the webpack entry, derived from psst.

`allowed-tools` pre-approves reading and searching files, `npm view @linchpinagency/ui` to check the current release, read-only `gh api` calls against `repos/linchpin/*` to read psst's current source, and `git ls-files`. Anything that writes still asks.

## Related skills

- [`wp-plugin-standards`](wp-plugin-standards.md) — owns the repo's files, scripts and CI callers, including the row that says a plugin's admin screen follows this skill.
- [`wp-block-conventions`](wp-block-conventions.md) — owns custom blocks.
- [`quality-gates`](quality-gates.md) — owns running lint and builds.
- [`web-qa`](web-qa.md) — owns the full browser pass on the finished screen.
- [`wp-plugin-development`](../upstream.md) (upstream) — plugin architecture and hooks; this skill overrides its Settings API advice for admin screens.
- [`commit-and-release`](commit-and-release.md) and [`task-tracking`](task-tracking.md) — the commit, PR and task the work lands under.
