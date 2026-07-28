---
name: wp-block-conventions
description: Build and edit custom Gutenberg blocks the way Linchpin structures them — apiVersion 3 under the `linchpin/` namespace, dynamic `render.php` plus Interactivity API `view.js`, parent/child blocks wired through block context, and the shared wp-scripts build with `--blocks-manifest --webpack-copy-php --experimental-modules`. Use when creating a custom block, editing an existing one, deciding whether a block belongs in the shared linchpin-blocks plugin or a project's functionality plugin, or reviewing block code. Not for authoring page content from blocks — use `wordpress-blocks`.
version: 1.0.0
---

# Linchpin block conventions

Linchpin blocks are **dynamic, Interactivity-API blocks** built with `wp-scripts` inside a
nested `blocks/` workspace. The structure is consistent across the shared block library and
project functionality plugins, so a block written to these conventions can move between them.

This skill is the house layer. Generic "how blocks work" is the upstream
`wp-block-development` skill — don't restate it here; read it for the underlying APIs.

## When to use

- Creating a new custom block, or extending an existing one.
- Deciding where a block belongs — shared library vs one project.
- Reviewing block code for house consistency.
- A block builds but doesn't register, or the editor shows it as invalid.

**Not this skill:** composing page/post content out of existing blocks —
[`wordpress-blocks`](../wordpress-blocks/SKILL.md). Choosing whether the request even needs
a block — [`wp-implementation-choice`](../wp-implementation-choice/SKILL.md). Block theme
templates and `theme.json` — upstream `wp-block-themes`.

## Owns

Canonical for: where blocks live, the file layout, house `block.json` fields, the
dynamic-render + Interactivity pattern, parent/child context, and the build/registration
chain. Defers block *semantics* to upstream and content authoring to `wordpress-blocks`.

## Preflight — which home does this block belong in?

| Question | Home |
| --- | --- |
| Reusable across clients (accordion, tabs, cards, slider, counter)? | **`linchpin/linchpin-blocks`** — the shared plugin, `blocks/src/<slug>/` |
| Specific to one site's content model or design (a client grid, a bespoke hero)? | That project's functionality plugin — `plugins/<project>-functionality/blocks/src/<slug>/` |
| Could core or an installed plugin already do it? | Neither — see [`wp-implementation-choice`](../wp-implementation-choice/SKILL.md) |

Putting a client-specific block in the shared library is the mistake that costs later: every
other project inherits it, and it can't be changed without regression-testing all of them.

Then confirm the workspace: blocks build from a **nested `blocks/package.json`**, not the
repo root. Lint and build there.

## The shape of a block

```
blocks/src/<slug>/
├── block.json      # metadata — the source of truth for registration
├── index.js        # registerBlockType, wires edit/save/icon/transforms
├── edit.js         # editor component
├── save.js         # usually InnerBlocks.Content only (dynamic blocks render in PHP)
├── render.php      # server render — copied to build/ by --webpack-copy-php
├── view.js         # frontend behavior via @wordpress/interactivity (script module)
├── style.scss      # front + editor styles
├── edit.scss       # editor-only styles
├── icon.js         # block icon
├── controls.js     # inspector/toolbar controls (or controls/ when it grows)
├── store.js        # editor-side data store, when the block needs one
└── transforms.js   # block transforms, when offered
```

Only `block.json`, `index.js`, and `edit.js` are always present. Add the rest when the block
actually needs them — see [`references/block-anatomy.md`](references/block-anatomy.md) for
the field-by-field detail, the parent/child context pattern, and `render.php` conventions.

## House rules

- **`apiVersion: 3`** and the `linchpin/` namespace on every block.
- **Dynamic by default.** Real markup lives in `render.php`; `save.js` typically returns just
  `<InnerBlocks.Content />`. This avoids the block-validation invalidation that static markup
  causes whenever output changes.
- **Frontend behavior is the Interactivity API** — `viewScriptModule: file:./view.js`,
  `store('linchpin/<block>', { state, actions, callbacks })`, and `data-wp-*` directives
  emitted from `get_block_wrapper_attributes()`. Not jQuery, not a bespoke bundle.
- **Parent → child data flows through block context**, namespaced
  `linchpin/<parent>/<key>` via `providesContext` / `usesContext`. Families
  (accordion + accordion-pane, tabs + tabs-pane, cards + card) are built this way.
- **Ship an `example`** with representative `innerBlocks` so the inserter preview isn't blank.
- **Lean on `supports`** (color, spacing, typography, layout, `anchor`) before inventing
  custom attributes — you get the core UI and theme.json integration for free.
- **PHP logic belongs in a Model/Helper class**, not inline in `render.php`. Keep render
  files to composing wrapper attributes and echoing markup.

## Build and registration

From the `blocks/` workspace:

```bash
npm run build     # wp-scripts build --blocks-manifest --webpack-copy-php --experimental-modules …
npm run start     # same, watching
```

Each flag matters: `--blocks-manifest` emits `build/blocks-manifest.php`,
`--webpack-copy-php` copies `render.php` into `build/`, and `--experimental-modules` is what
makes `viewScriptModule` work. Dropping one silently breaks registration or frontend behavior.

Registration reads the built output, not `src/`: WordPress 6.8+ on a block theme registers
the whole set at once with `wp_register_block_types_from_metadata_collection( build,
build/blocks-manifest.php )`, with a per-block `register_block_type()` loop as the fallback.
**A block that doesn't appear in the editor is usually unbuilt, not misregistered** — build
first, then debug.

## Guardrails

- **Never edit anything in `build/`** — it's generated, and the next build discards it.
- **Never put a client-specific block in the shared library** (see Preflight).
- **Never use `core/html`** for layout or normal text; emit proper block markup.
- **Never change a dynamic block's `save.js` output casually** — changing saved markup
  invalidates every existing instance in the database. Prefer `render.php` changes, and when
  saved output must change, provide a deprecation.
- **Never hand-bump a `version` field** without checking `release-please-config.json`
  `extra-files` — release-please may own it ([`commit-and-release`](../commit-and-release/SKILL.md)).
- **Never add a dependency to the root `package.json`** for block code; blocks have their own
  workspace manifest.
- Don't skip `--webpack-copy-php` or `--experimental-modules` in a one-off build to "go
  faster" — you'll debug a phantom registration bug instead.

## Done

- [ ] The block's home (shared library vs project plugin) is a deliberate choice.
- [ ] `block.json` is apiVersion 3, `linchpin/`-namespaced, with `textdomain`, an `example`,
      and `supports` doing the work custom attributes would otherwise duplicate.
- [ ] Dynamic render in `render.php`; `save.js` doesn't hand-roll markup that PHP owns.
- [ ] Frontend behavior uses the Interactivity API with a namespaced store.
- [ ] Parent/child data passes through namespaced block context, not props or globals.
- [ ] Built from the `blocks/` workspace with all three flags; block appears in the inserter.
- [ ] Markup validates in the editor — no "unexpected or invalid content"
      ([`wp-studio-cli`](../wp-studio-cli/SKILL.md) `validate_blocks`).
- [ ] `npm run lint:js` and `npm run lint:css` pass in that workspace
      ([`quality-gates`](../quality-gates/SKILL.md)).
