---
title: wp-block-conventions
---

Linchpin blocks are dynamic, Interactivity-API blocks built with `wp-scripts` inside a nested `blocks/` workspace. The structure is consistent across the shared block library and project functionality plugins, so a block written to these conventions can move between them. This is the house layer; generic "how blocks work" is the upstream `wp-block-development` skill.

## When to reach for it

- Creating a new custom block, or extending an existing one.
- Deciding where a block belongs — shared library vs one project.
- Reviewing block code for house consistency.
- A block builds but doesn't register, or the editor shows it as invalid.

## Where it stops

> **Not this skill:** composing page/post content out of existing blocks — [`wordpress-blocks`](wordpress-blocks.md). Choosing whether the request even needs a block — [`wp-implementation-choice`](wp-implementation-choice.md). Block theme templates and `theme.json` — upstream [`wp-block-themes`](../upstream.md).

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Lay out the block","content":"<p>Scaffold <code>blocks/src/&lt;slug&gt;/</code> with <code>block.json</code>, <code>index.js</code>, and <code>edit.js</code> always present; add <code>render.php</code>, <code>view.js</code>, styles, controls, and a store only when the block actually needs them.</p>"},{"title":"Follow the house rules","content":"<p>apiVersion 3 under the linchpin/ namespace, dynamic rendering in render.php with save.js usually just InnerBlocks.Content, frontend behavior through the Interactivity API, parent/child data through namespaced block context, and PHP logic kept in a Model/Helper class rather than inline.</p>"},{"title":"Build and register it","content":"<p>Build from the blocks/ workspace with <code>--blocks-manifest --webpack-copy-php --experimental-modules</code> — each flag is load-bearing, and a block missing from the editor is usually unbuilt rather than misregistered.</p>"}]} /-->

## What it checks first

Before writing a block, it works out which home the block belongs in rather than assuming the shared library:

| Question | Home |
| --- | --- |
| Reusable across clients (accordion, tabs, cards, slider, counter)? | The shared `linchpin/linchpin-blocks` plugin |
| Specific to one site's content model or design? | That project's own functionality plugin |
| Could core or an installed plugin already do it? | Neither — see [`wp-implementation-choice`](wp-implementation-choice.md) |

Putting a client-specific block in the shared library is the costly mistake — every other project inherits it. It also confirms the build workspace: blocks build from a nested `blocks/package.json`, not the repo root.

## What it owns

Canonical for: where blocks live, the file layout, house `block.json` fields, the dynamic-render + Interactivity pattern, parent/child context, and the build/registration chain. It defers block semantics to upstream and content authoring to [`wordpress-blocks`](wordpress-blocks.md).

## Guardrails

<!-- wp:docspress/callout {"tone":"warning","title":"Changing saved markup breaks live content","content":"<p>Never change a dynamic block's <code>save.js</code> output casually — changing saved markup invalidates every existing instance of the block already in the database. Prefer <code>render.php</code> changes, and provide a deprecation when saved output must change.</p>","collapsible":false} /-->

- Never edit anything in `build/` — it's generated, and the next build discards it.
- Never put a client-specific block in the shared library.
- Never use `core/html` for layout or normal text; emit proper block markup.
- Never hand-bump a `version` field without checking `release-please-config.json`'s `extra-files` — release-please may own it.
- Never add a dependency to the root `package.json` for block code; blocks have their own workspace manifest.
- Don't skip `--webpack-copy-php` or `--experimental-modules` in a one-off build — you'll debug a phantom registration bug instead.

## Done when

- [ ] The block's home (shared library vs project plugin) is a deliberate choice.
- [ ] `block.json` is apiVersion 3, `linchpin/`-namespaced, with `textdomain`, an `example`, and `supports` doing the work custom attributes would otherwise duplicate.
- [ ] Dynamic render in `render.php`; `save.js` doesn't hand-roll markup that PHP owns.
- [ ] Frontend behavior uses the Interactivity API with a namespaced store.
- [ ] Parent/child data passes through namespaced block context, not props or globals.
- [ ] Built from the `blocks/` workspace with all three flags; block appears in the inserter.
- [ ] Markup validates in the editor — no "unexpected or invalid content".
- [ ] `npm run lint:js` and `npm run lint:css` pass in that workspace.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/wp-block-conventions/SKILL.md) is the skill's main instructions.
- [`references/block-anatomy.md`](https://github.com/linchpin/skills/blob/main/skills/wp-block-conventions/references/block-anatomy.md) — field-by-field reference for `block.json`, parent/child context, `render.php`, and `view.js` conventions.

Pre-approved, so the agent can run them without a prompt: reading and searching files, and `npm run lint:js`, `npm run lint:css`, and `npm run build`. Anything else still asks.

## Related skills

- [`wp-block-development`](../upstream.md) — upstream skill for the underlying block APIs this house layer builds on.
- [`wordpress-blocks`](wordpress-blocks.md) — composing page/post content out of existing blocks.
- [`wp-implementation-choice`](wp-implementation-choice.md) — whether a request needs a block at all.
- [`wp-block-themes`](../upstream.md) — upstream skill for block theme templates and `theme.json`.
- [`commit-and-release`](commit-and-release.md) — owns whether release-please controls a block's `version` field.
- [`wp-studio-cli`](wp-studio-cli.md) — `validate_blocks`, used to confirm markup validates in the editor.
- [`quality-gates`](quality-gates.md) — runs the `lint:js`/`lint:css` gates a block must pass.
