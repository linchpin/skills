---
name: wp-studio-cli
description: Operate a local WordPress Studio site — preferring the wordpress-studio MCP (site_list, site_start, wp_cli, validate_blocks, take_screenshot, inspect_design) and falling back to the `studio` CLI when MCP isn't connected. Use whenever working against a Linchpin local dev install, running WP-CLI locally, reading admin credentials, validating block markup, or screenshotting a local site. Studio runs PHP-WASM, so file paths inside `wp eval` must use ABSPATH (resolves to /wordpress/), never host filesystem paths.
version: 1.1.0
---

# WordPress Studio

[WordPress Studio](https://developer.wordpress.com/studio/) is **Linchpin's default local
environment**, running each site in a **PHP-WASM** runtime. Older projects still on wp-env
or LocalWP predate that switch — new work is Studio.

Two interfaces reach the same site: the **wordpress-studio MCP** (structured tools, richer
capabilities) and the **`studio` CLI** (always present with the app). Prefer MCP; the CLI is
the fallback and the scripting route.

## When to use

- Running WP-CLI, inspecting options/posts, or evaluating PHP against a local Studio site.
- Needing the site's admin URL or credentials.
- Validating serialized block markup, or screenshotting a local page.
- Reproducing a bug locally before touching a server.

**Not this skill:** creating the site or symlinking a repo into it —
[`wp-local-setup`](../wp-local-setup/SKILL.md). Live servers —
[`wp-pressable`](../wp-pressable/SKILL.md). Performance/accessibility audits —
[`wp-audit`](../wp-audit/SKILL.md). A legacy project on wp-env or LocalWP — use that
project's tooling ([`quality-gates`](../quality-gates/SKILL.md) detects which).

`take_screenshot` and `inspect_design` below are **Studio's own**, rendering PHP-WASM rather
than driving a browser — enough for markup and layout checks. When you need a *real* browser
against the Studio URL (actual session state, extensions, console and network behaviour), get
one via [`browser-automation`](../browser-automation/SKILL.md).

## Preflight — pick the interface

1. **Try MCP first.** A cheap call like `site_list` confirms it's connected.
2. **Fall back to the CLI** when MCP is absent, erroring, or you need something scriptable
   in a shell pipeline: `studio site list`.
3. **If neither works**, say so — Studio isn't installed or the CLI isn't enabled. Don't
   guess at site paths.

Whichever you use, **resolve the target site explicitly**. Never assume the current
directory is the site.

## MCP tools (preferred)

| Need | Tool |
| --- | --- |
| List sites, find paths/URLs | `site_list` |
| Site detail, admin credentials | `site_info` |
| Start / stop a site | `site_start`, `site_stop` |
| Run any WP-CLI command | `wp_cli` |
| Validate serialized block markup | `validate_blocks` |
| Screenshot a page | `take_screenshot` |
| Inspect rendered DOM / computed styles | `inspect_design` |
| Push/pull against a connected remote | `site_push`, `site_pull` |

`wp_cli` is the general-purpose escape hatch — anything the CLI can do, it can do. Reach for
a shell only when you need to pipe output into other commands.

**`site_push` / `site_pull` move real data.** Treat them like a deploy: confirm the direction
and the target with the user first, and never push to a production-connected site from here.

## CLI fallback

Every `studio` command takes a global `--path` pointing at the site's WordPress files. It
**defaults to the current directory**, so `cd` in or pass `--path`. Running outside a
registered site path fails with "The specified directory is not added to Studio."

```bash
studio site list                                   # names, paths, URLs, online status
studio site start --path ~/Studio/<site>           # a site must be Online for `wp`
studio site status --path ~/Studio/<site> --format json   # adminUsername/adminPassword/URL
studio wp <args> --path ~/Studio/<site>            # full WP-CLI passthrough
```

## Eval PHP — and the ABSPATH rule

This applies to **both** interfaces — MCP `wp_cli` and `studio wp` run in the same runtime.

> **The PHP-WASM runtime cannot see your host filesystem.** Inside `eval`, file paths must
> be WASM paths. Use the `ABSPATH` constant, which resolves to `/wordpress/` — not
> `/Users/...` host paths.

```bash
# ✅ correct — ABSPATH-relative path inside the WASM FS
studio wp eval 'echo ABSPATH;' --path ~/Studio/<site>
# -> /wordpress/

# ✅ read/render a theme file from inside the site
studio wp eval 'echo file_get_contents(ABSPATH . "wp-content/themes/<theme>/style.css");' \
  --path ~/Studio/<site>

# ❌ wrong — a host path is invisible to PHP-WASM and returns nothing/false
studio wp eval 'echo file_get_contents("/Users/me/Documents/GitHub/<repo>/themes/<theme>/style.css");' \
  --path ~/Studio/<site>
```

Even when Studio **hardlinks** `wp-content/themes/<x>` and `wp-content/plugins/<x>` from a
host repo (so editor changes show up live), the PHP runtime still resolves them only via
WASM/`ABSPATH` paths.

To operate on host files (grep, list, edit), use ordinary shell tools against the **repo
path**; switch to `eval` + `ABSPATH` only when the running site must read or execute them.

## Common recipes

```bash
# Render a block pattern's PHP to inspect its output
studio wp eval 'ob_start(); include ABSPATH . "wp-content/themes/<theme>/patterns/<name>.php"; echo ob_get_clean();' \
  --path ~/Studio/<site>

# Flush rewrite rules / caches after changes
studio wp rewrite flush --path ~/Studio/<site>
studio wp cache flush --path ~/Studio/<site>

# Search-replace a URL across the DB (dry run first!)
studio wp search-replace 'http://old.test' 'https://new.test' --dry-run --path ~/Studio/<site>
```

## Gotchas

- **Deprecation noise:** Studio's WP-CLI may print `Deprecated: Case statements followed
  by a semicolon …` lines (from a bundled dependency). They're benign — the real result is
  still on stdout. When scripting, parse stdout and ignore stderr (`2>/dev/null`), and be
  ready to strip a stray leading/trailing deprecation line.
- **`--path` is required** on the CLI unless you `cd` into the site directory first.
- **Site must be Online** before `wp` — `site_start` or `studio site start`.
- **Block markup gets validated, not eyeballed.** When you write serialized block markup
  into templates or content, run `validate_blocks` and repair until clean — see
  [`wordpress-blocks`](../wordpress-blocks/SKILL.md).

## Quick reference

| Task | MCP | CLI fallback |
| --- | --- | --- |
| List sites + paths | `site_list` | `studio site list` |
| Start a site | `site_start` | `studio site start --path ~/Studio/<site>` |
| Admin user/pass | `site_info` | `studio site status --path … --format json` |
| Run WP-CLI | `wp_cli` | `studio wp <args> --path ~/Studio/<site>` |
| Eval PHP | `wp_cli` (`eval`, use `ABSPATH`) | `studio wp eval '<php>' --path …` |
| Validate blocks | `validate_blocks` | — |
| Screenshot | `take_screenshot` | — |

## Guardrails

- **Never use host paths inside `eval`** — PHP-WASM can't see them and returns `false`
  rather than an error, which reads as "the file is empty" and sends you debugging the wrong
  thing. Always build paths from `ABSPATH`.
- **`--dry-run` first** on anything that rewrites the database (`search-replace`, bulk
  `wp post` operations). A local site is cheap to break but expensive to re-seed.
- **Never `site_push`** without explicit confirmation of direction and target — it writes to
  a remote site.
- **Don't edit files through the site directory** when `wp-content` is a symlink to a repo
  checkout — edit the repo, which is the same files with git history attached.
- **Don't treat a green local result as a production result.** Studio runs SQLite and
  PHP-WASM; MySQL-specific behavior and server caches differ. Verify on the server via
  [`wp-pressable`](../wp-pressable/SKILL.md) when it matters.
- Don't fabricate output when a command prints deprecation noise — parse stdout, and say so
  if a command produced nothing.

## Done

- [ ] Interface chosen deliberately — MCP tried first, CLI fallback only if needed.
- [ ] The target site was resolved explicitly, not assumed from the working directory.
- [ ] The site was Online before running `wp`.
- [ ] Any `eval` path is `ABSPATH`-relative.
- [ ] Destructive DB commands were dry-run first; no unconfirmed `site_push`.
- [ ] Reported output is what the command actually returned, deprecation noise excluded.
