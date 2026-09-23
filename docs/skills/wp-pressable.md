---
title: wp-pressable
---

Pressable is Automattic's managed WordPress host. Code reaches it only through the deploy pipeline, while the database lives only on the server — change code by deploying, never by editing files on the server, and change content or templates by operating directly on the server's database, because deploys never touch it. Most "I shipped it but it's not on prod" tickets are a collision of those two facts.

## When to reach for it

- Inspecting or changing a live Pressable environment — production or staging — its database, templates or parts, caches, users, or runtime state, via the Pressable MCP or SSH+WP-CLI.

Things you might say that load it: "the deploy is stuck", "clear the cache on staging", "I need database access", or "the site is slow on Pressable".

## Where it stops

> **Not this for:**
>
> - **Local development** → use `wp-studio-cli` (Studio / PHP-WASM).
> - **Shipping code** → code reaches Pressable only through the deploy pipeline; never edit theme/plugin files on the server (the next deploy overwrites them).
> - **Task tracking / commits** → that's `task-tracking`.

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Connect","content":"<p>Reach the site through the Pressable MCP when it's connected, or fall back to SSH and WP-CLI. Both land on the same <code>wp</code> commands, so a fix scripted one way works the other.</p>"},{"title":"Diagnose read-only","content":"<p>Confirm the code is actually deployed — plugin version, block registration — before assuming a database problem, then list which templates and template parts have a database override that could be shadowing the deployed theme files.</p>"},{"title":"Fix at the cause","content":"<p>Delete the database override to cleanly revert to the deployed file, or edit it surgically when production has intentional Site Editor changes worth keeping, then flush the object and page caches.</p>"},{"title":"Know what deploy and rollback mean here","content":"<p>A code fix isn't live until a release is published and deployed. A content or template fix is applied directly on the server and is independent of any deploy.</p>"}]} /-->

## What it checks first

Before touching anything, it checks whether the deployed code is actually current — the plugin version and whether a block is registered — then lists the `wp_template` and `wp_template_part` overrides in the database that could be shadowing the theme's files, since a Full-Site-Editing template edited once in the Site Editor permanently shadows the file version from then on.

## What it owns

Eleven skills defer to this one. Canonical for reaching a Pressable site at all, the "shows locally but not on production" diagnosis, and what deploy and rollback mean on Pressable. It defers a local Studio site to `wp-studio-cli`, performance and accessibility audits to `wp-audit`, the general method for finding a root cause to `investigate`, driving a real browser to `browser-automation`, and the commit, PR, and release that produce a deploy to `commit-and-release`.

## Guardrails

<!-- wp:docspress/callout {"tone":"warning","title":"This is production","content":"<p>Confirm with the user before any mutating action on a live site, lead with read-only diagnostics, and back up before any database change with <code>wp db export</code>.</p>","collapsible":false} /-->

- Read before write — list and inspect first, mutate only after confirming the cause.
- Never edit theme or plugin files on the server — the next deploy overwrites them; file changes go through the repo and deploy pipeline.
- Flush caches after content or database changes — Pressable runs object and edge caches, and a stale cache makes a correct fix look like it didn't work.

## Done when

- [ ] The environment you touched (production vs staging) is stated explicitly.
- [ ] Diagnosis ran read-only first, and the cause is named — deploy gap vs DB override.
- [ ] Any DB change was preceded by `wp db export` and confirmed with the user.
- [ ] No theme or plugin file was edited on the server.
- [ ] Object and page caches flushed, and the fix verified on the live URL.
- [ ] If the fix belongs in code, it's tracked back to the repo and the deploy pipeline — the server change is not the permanent fix.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/wp-pressable/SKILL.md) is the whole skill. It has no `references/` or `scripts/`.

Pre-approved, so the agent can run them without a prompt: reading and searching files. Connecting to the site, running WP-CLI, and any change still asks.

## Related skills

- [`wp-studio-cli`](wp-studio-cli.md) — owns local development on Studio / PHP-WASM, as opposed to the live server.
- [`wp-audit`](wp-audit.md) — owns performance and accessibility audits.
- [`investigate`](investigate.md) — owns the general method for finding a root cause.
- [`browser-automation`](browser-automation.md) — owns driving a real browser against the site.
- [`commit-and-release`](commit-and-release.md) — owns the commit, PR, and release that actually produce a deploy.
- [`task-tracking`](task-tracking.md) — owns task tracking and commits.
