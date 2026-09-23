---
title: wp-studio-cli
---

WordPress Studio is Linchpin's default local environment, running each site in a PHP-WASM runtime — older projects on wp-env or LocalWP predate the switch. Two interfaces reach the same site: the wordpress-studio MCP (structured tools, richer capabilities) and the `studio` CLI (always present, the fallback and scripting route). Prefer MCP.

## When to reach for it

- Running WP-CLI, inspecting options/posts, or evaluating PHP against a local Studio site.
- Needing the site's admin URL or credentials.
- Validating serialized block markup, or screenshotting a local page.
- Reproducing a bug locally before touching a server.

## Where it stops

> **Not this skill:** creating the site or symlinking a repo into it — [`wp-local-setup`](wp-local-setup.md). Live servers — [`wp-pressable`](wp-pressable.md). Performance/accessibility audits — [`wp-audit`](wp-audit.md). A legacy project on wp-env or LocalWP — use that project's tooling ([`quality-gates`](quality-gates.md) detects which).

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Try MCP first","content":"<p>A cheap call like <code>site_list</code> confirms it's connected.</p>"},{"title":"Fall back to the CLI","content":"<p>When MCP is absent, erroring, or the work needs to run in a shell pipeline: <code>studio site list</code>.</p>"},{"title":"Say so if neither works","content":"<p>Studio isn't installed or the CLI isn't enabled. Don't guess at site paths.</p>"},{"title":"Resolve the target site explicitly","content":"<p>Whichever interface is used, never assume the current directory is the site.</p>"}]} /-->

| Task | MCP | CLI fallback |
| --- | --- | --- |
| List sites | `site_list` | `studio site list` |
| Start a site | `site_start` | `studio site start --path …` |
| Admin user/pass | `site_info` | `studio site status --path … --format json` |
| Run WP-CLI | `wp_cli` | `studio wp <args> --path …` |
| Validate blocks | `validate_blocks` | — |
| Screenshot | `take_screenshot` | — |

## What it checks first

Resolves the target site explicitly before running anything, never the current directory, and confirms it's Online before `wp` — an offline site fails every command. It doesn't call `project-context` for this; the target site is resolved directly through `site_list` or `studio site list`.

## What it owns

Canonical for: choosing between the Studio MCP and the `studio` CLI for a site that already exists, the ABSPATH rule for `wp eval` under PHP-WASM, and the local WP-CLI recipes.

## Guardrails

- Never use host paths inside `eval` — PHP-WASM can't see them and returns `false` rather than an error, which reads as "the file is empty." Always build paths from `ABSPATH`.
- Don't edit files through the site directory when `wp-content` is a symlink to a repo checkout — edit the repo, which is the same files with git history attached.
- Don't treat a green local result as a production result — Studio runs SQLite and PHP-WASM; verify on the server via `wp-pressable` when it matters.
- Don't fabricate output when a command prints deprecation noise — parse stdout, and say so if a command produced nothing.

<!-- wp:docspress/callout {"tone":"warning","title":"Confirm before anything that writes","content":"<p>Always dry-run first on anything that rewrites the database, such as search-replace or bulk wp post operations — a local site is cheap to break but expensive to re-seed. Never site_push without explicit confirmation of direction and target; it writes to a remote site.</p>","collapsible":false} /-->

## Done when

- [ ] Interface chosen deliberately — MCP tried first, CLI fallback only if needed.
- [ ] The target site was resolved explicitly, not assumed from the working directory.
- [ ] The site was Online before running `wp`.
- [ ] Any `eval` path is `ABSPATH`-relative.
- [ ] Destructive DB commands were dry-run first; no unconfirmed `site_push`.
- [ ] Reported output is what the command actually returned, deprecation noise excluded.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/wp-studio-cli/SKILL.md) is the whole skill. It has no `references/` or `scripts/`.

Pre-approved, so the agent can run them without a prompt: reading and searching files. Anything that runs WP-CLI, writes, or pushes still asks.

## Related skills

- [`wp-local-setup`](wp-local-setup.md) — creates the site and symlinks the repo in; this skill only drives what already exists.
- [`wp-pressable`](wp-pressable.md) — anything on a live server, and where to verify a result Studio's SQLite and PHP-WASM can't confirm.
- [`wp-audit`](wp-audit.md) — performance and accessibility audits, using this skill's `need_for_speed`, `take_screenshot`, and `inspect_design` as local measurement tools.
- [`browser-automation`](browser-automation.md) — a real browser against the Studio URL, for actual session state, extensions, console and network behaviour.
- [`quality-gates`](quality-gates.md) — detects which tooling a legacy wp-env or LocalWP project uses instead.
- [`wordpress-blocks`](wordpress-blocks.md) — where serialized block markup gets repaired after `validate_blocks` flags it invalid.
