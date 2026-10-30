# Access modes

An audit can be run by a developer with a local copy, by someone with host access only, or by
someone with nothing but the URL. Decide per **area**, not once for the whole audit. The usual
best mix is front-end measurement against production plus server checks wherever WP-CLI can
reach. Record the mode for every area in the report's Scope table.

## 1. Identify the host from the outside

Works for everyone, so do it first:

```bash
curl -sSI https://<site>/ | grep -iE '^(server|x-powered-by|x-cache|x-ac|x-nananana|x-pass-why|x-cacheable|cf-cache-status|x-kinsta-cache|via|age|cache-control):'
```

| Header | Usually means |
| --- | --- |
| `x-powered-by: WP Engine`, `x-cacheable`, `x-pass-why` | WP Engine |
| `x-ac`, `x-nananana: Batcache-…` | Pressable (Automattic edge cache and Batcache) |
| `cf-cache-status`, `server: cloudflare` | Cloudflare in front, whatever the origin is |
| `x-kinsta-cache` | Kinsta |

Cloudflare in front of another host is common: report both layers. Then ask the user to
confirm rather than trusting headers alone. A project's `.linchpin.json` may record the host
too ([`project-context`](../../project-context/SKILL.md)).

## 2. Pick the mode per area

| Mode | Run WP-CLI as | Front-end numbers are | Use for |
| --- | --- | --- | --- |
| **Local Studio** | wordpress-studio MCP `wp_cli`, or the `studio` CLI ([`wp-studio-cli`](../../wp-studio-cli/SKILL.md)) | Synthetic: PHP-WASM, SQLite, no CDN | Code review, content metrics on a recent DB copy, branch comparisons |
| **Local wp-env / LocalWP** | `npx wp-env run cli wp …`, or the LocalWP site shell | Synthetic: no CDN or host cache | Same |
| **Pressable** | Pressable MCP or SSH + WP-CLI ([`wp-pressable`](../../wp-pressable/SKILL.md)) | Real | All server areas, read-only |
| **WP Engine** | SSH gateway (below) | Real | All server areas, read-only |
| **Other host with SSH** | `ssh` then `wp` from the WordPress root | Real | All server areas, read-only |
| **URL only** | none | Real | PageSpeed, field data, hosting headers, public security surface, broken links |

A local copy's database is a snapshot. Record its date, and treat content metrics and
autoload numbers from it as "as of" that date.

## 3. WP Engine SSH gateway

No Linchpin skill owns WP Engine yet, so the minimum is here:

1. The user's public SSH key must be added in the WP Engine User Portal (Profile → SSH keys).
   If it isn't, stop and ask. Don't work around it.
2. Connect with the install name, the environment's short name in the portal:

   ```bash
   ssh <install>@<install>.ssh.wpengine.net
   ```

3. The gateway opens in a home directory. The install's files are under `sites/<install>`.
   Run `wp` from there. Production, staging and development are separate installs with
   separate names.
4. Host metrics (page latency, cache hit ratio, error rate, top 404s) live in the User Portal
   and not in WP-CLI. Ask the user for numbers or screenshots, and label them "from the WP Engine
   dashboard, <date range>".

## 4. Read-only on any live environment

Every command an audit runs against staging or production must be a read. Allowed:
`list`, `get` for a single named value, `count`, `size`, `verify-checksums`, `check-update`,
`cache type`, and `wp db query` with a **SELECT** only.

Never, without the user's explicit go-ahead for that one command:

- `install`, `activate`, `deactivate`, `update`, `delete`, or anything that changes plugins or themes. Query Monitor and WP-CLI packages are included: install them on local or staging instead.
- `option update`, `transient delete`, `cache flush`, `cron event run`, `rewrite flush`, `search-replace`.
- `wp db query` with anything but SELECT, and `wp db export` to a public path.

**Secrets never reach the transcript or the report.** `wp config list` prints the database
password and salts, so never run it. Read single constants by name
(`wp config get WP_DEBUG`). If a command prints a key or credential anyway, leave it out of
every note and say so.

## 5. When there is no server access

Run the URL-only areas and mark every other area in the Scope table as
**"Not checked: needs server access (WP-CLI or host dashboard)"**. Name the access that would
close the gap. A report with honest gaps is still deliverable. A report that guesses isn't.
