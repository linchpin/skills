---
name: wp-pressable
description: Operate a Pressable-hosted WordPress site (production or staging) from an agent — connect via the Pressable MCP or SSH+WP-CLI, run read-first diagnostics, and safely fix the classic "renders locally but not on production" Full-Site-Editing bug where database template/part overrides shadow the deployed theme files. Use for any WordPress project hosted on Pressable when you need to inspect or change the live server (not just the repo).
version: 1.0.0
---

# WordPress on Pressable (agent operations)

[Pressable](https://pressable.com/) is Automattic's managed WordPress host. Code reaches it
through a deploy pipeline (Linchpin convention: `release-please` → a published GitHub
Release → `linchpin/actions` deploy workflow), while the **database lives only on the
server**. Two facts drive everything in this skill:

1. **Change code by deploying, never by editing files on the server.** The next deploy
   overwrites server files.
2. **Change content/templates by operating on the server database** (MCP or SSH+WP-CLI),
   because **deploys never touch the database**.

Most "I shipped it but it's not on prod" tickets are a collision of those two facts. See
[The signature bug](#the-signature-bug-it-shows-locally-but-not-on-production).

## When to use

**Use this when** you need to inspect or change a **live Pressable environment**
(production or staging) — its database, templates/parts, caches, users, or runtime state —
via the Pressable MCP or SSH+WP-CLI.

**Not this for:**

- **Local development** → use `wp-studio-cli` (Studio / PHP-WASM).
- **Shipping code** → code reaches Pressable only through the deploy pipeline; never edit
  theme/plugin files on the server (the next deploy overwrites them).
- **Task tracking / commits** → that's `task-tracking`.

This skill operates the **server and its database** — nothing else.

## Two ways in

### A) Pressable MCP (preferred when connected)

A remote MCP server at `https://mcp.pressable.com/mcp`, authenticated with a bearer token.

```bash
# Native HTTP transport — cleaner than the mcp-remote wrapper.
claude mcp add --transport http pressable https://mcp.pressable.com/mcp \
  --header "Authorization: Bearer <TOKEN>"
```

- **Quote the whole header as one argument.** A common footgun is
  `--header Authorization:Bearer <TOKEN>` (no space / unquoted) — the shell splits it into
  separate argv tokens and the server gets a malformed header, then fails to connect.
- **Restart to connect.** MCP servers connect at agent **startup**. After adding/rotating,
  restart the session, then confirm with `claude mcp list` → `pressable … ✔ Connected`.
- **`401 Invalid Authorization token` = dead token.** Regenerate it from your Pressable
  account and re-add the server. Verify a token fast without restarting:
  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' -X POST https://mcp.pressable.com/mcp \
    -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"diag","version":"1"}}}'
  # 200 = good, 401 = regenerate the token
  ```
- **Don't leave the raw token in `~/.claude.json`.** Pull it from a secret manager
  (1Password, etc.). The token grants control of the host.

### B) SSH + WP-CLI (always available; the fallback and the scripting route)

When the MCP is down (or you want deterministic, scriptable fixes), use SSH.

- Get SSH/SFTP credentials from the Pressable dashboard (**Sites → <site> → SSH/SFTP**).
- Connect; you land in the site root with `wp` on `PATH`. Confirm: `wp --info`.
- Everything below is plain WP-CLI, so it works identically whether you reach `wp` over SSH
  or through the MCP's WP-CLI tool.

## Guardrails

- **It's production.** Confirm with the user before any mutating action on a live prod
  site; lead with read-only diagnostics and back up first.
- **Read before write.** List and inspect first; mutate only after you've confirmed the
  cause.
- **Back up before any DB change:** `wp db export ~/backup-$(date +%F-%H%M).sql`.
- **Never edit theme/plugin files on the server** — deploys overwrite them. File changes go
  through the repo + deploy pipeline.
- **Flush caches after content/DB changes.** Pressable runs object + edge (page) cache:
  `wp cache flush`, then clear the page cache from the Pressable dashboard (or
  `wp pressable-cache clear` if the helper plugin is present). Stale cache makes a correct
  fix look like it didn't work.

## The signature bug: "it shows locally but not on production"

**Symptom.** A block / pattern / section lives in the theme's template **files** and renders
on your local site, but is missing on the Pressable site — even though the theme and plugin
are deployed.

**Cause.** In block (Full-Site-Editing) themes, the moment a template or template part is
edited in the Site Editor, WordPress writes a copy to the database (a `wp_template` or
`wp_template_part` post) and **that DB copy permanently shadows the theme file**. Deploys
ship files, not the DB — so a block you added to the file never appears, because the server
keeps serving the older DB copy.

**Diagnose (read-only):**

```bash
# 1. Is the code actually deployed? (rules out a stale release)
wp plugin get <plugin-slug> --field=version
wp eval 'var_export( WP_Block_Type_Registry::get_instance()->is_registered("<namespace/block>") );'
#   -> false or an old version => deploy problem, not a DB problem. Ship/redeploy.

# 2. Which templates/parts are DB overrides that shadow the files?
wp post list --post_type=wp_template      --post_status=any --fields=ID,post_name,post_title
wp post list --post_type=wp_template_part --post_status=any --fields=ID,post_name,post_title
#   -> a row for the template that should show the block (e.g. front-page, page, home) is an override.

# 3. Confirm the override is what's hiding it
wp eval 'echo has_block("<namespace/block>", get_post(<ID>)->post_content) ? "HAS" : "MISSING";'
#   -> "MISSING" confirms the stale DB copy is the culprit.
```

**Fix (pick one):**

- **Clean revert to the deployed file** (recommended when templates are version-controlled
  in the repo): delete the DB override so WordPress falls back to the theme file, which
  already has the block in the right place.
  ```bash
  wp post delete <ID> --force      # repeat per template
  ```
  ⚠️ This discards **all** Site-Editor edits to that template, reverting it entirely to the
  repo's file. Admin equivalent: **Appearance → Editor → Templates → ⋯ → Clear
  customizations**.
- **Surgical** (when production has intentional Site-Editor-only edits you must keep): add
  the block in the Site Editor, or `wp post update <ID>` the override's `post_content`,
  instead of deleting.

Then `wp cache flush` and clear the Pressable page cache.

## Deploy & rollback awareness (Linchpin convention)

- `main` → `release-please` opens a release PR → merging it **publishes a GitHub Release** →
  `linchpin/actions` deploy workflow builds and deploys to Pressable (`environment:
  production`), attaching a `release.zip`.
- **Staging** deploys on push to the `staging` branch.
- **Rollback** re-deploys a previous `release.zip` (no rebuild) via the repo's
  `rollback.yml` workflow.
- **Implication:** a **code** fix is not live until a release is published and deployed — a
  merge to `main` alone is not on prod. A **content/template** fix is applied directly on
  the server (MCP/SSH), as above, and is independent of deploys.

## Quick reference

| Task | Command |
| --- | --- |
| Add the MCP | `claude mcp add --transport http pressable https://mcp.pressable.com/mcp --header "Authorization: Bearer <TOKEN>"` |
| Verify MCP connects | `claude mcp list` → `pressable … ✔ Connected` (restart session after adding) |
| SSH in | dashboard **Sites → <site> → SSH/SFTP**, then `wp --info` |
| Back up DB | `wp db export ~/backup-$(date +%F-%H%M).sql` |
| Deployed plugin version | `wp plugin get <plugin> --field=version` |
| Is a block registered | `wp eval 'var_export( WP_Block_Type_Registry::get_instance()->is_registered("<ns/block>") );'` |
| List template overrides | `wp post list --post_type=wp_template --post_status=any --fields=ID,post_name,post_title` |
| List part overrides | `wp post list --post_type=wp_template_part --post_status=any --fields=ID,post_name,post_title` |
| Override has block? | `wp eval 'echo has_block("<ns/block>", get_post(<ID>)->post_content) ? "HAS" : "MISSING";'` |
| Revert template to file | `wp post delete <ID> --force` (wipes that template's Site-Editor edits) |
| Flush caches | `wp cache flush` + clear page cache in the Pressable dashboard |

## Done

- [ ] The environment you touched (production vs staging) is stated explicitly.
- [ ] Diagnosis ran read-only first, and the cause is named — deploy gap vs DB override.
- [ ] Any DB change was preceded by `wp db export` and confirmed with the user.
- [ ] No theme or plugin file was edited on the server.
- [ ] Object and page caches flushed, and the fix verified on the live URL.
- [ ] If the fix belongs in code, it's tracked back to the repo and the deploy pipeline —
      the server change is not the permanent fix.
