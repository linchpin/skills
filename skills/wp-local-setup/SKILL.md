---
name: wp-local-setup
description: Stand up the Linchpin baseline WordPress local environment — scaffold a new wp-content-shaped project repo (Composer-managed plugins from wpackagist.org + packagist.linchpin.com, release-please deploys) and/or wire a project repo into a WordPress Studio site by symlinking the repo in as the site's wp-content while preserving Studio's SQLite runtime pieces. Use when starting a new Linchpin WordPress project or setting up local development for an existing one. Not for choosing or building the theme itself — use `wp-theme-baseline`.
version: 1.1.0
---

# WordPress local setup (Linchpin baseline)

Every Linchpin WordPress project follows the same baseline, driven by three facts:

1. **The project repo IS `wp-content`.** The repo root contains `themes/`, `plugins/`
   (and sometimes `mu-plugins/`) plus tooling — not a full WordPress install. WordPress
   core is never committed.
2. **Local dev runs on [WordPress Studio](https://developer.wordpress.com/studio/).**
   The Studio site's `wp-content` directory is replaced with a **symlink to the repo
   checkout**, so edits in the repo are live on the local site instantly.
3. **Plugins and themes are Composer dependencies**, resolved from
   [wpackagist.org](https://wpackagist.org) (wordpress.org mirrors) and
   `https://packagist.linchpin.com` (private/premium packages, `linchpin/<slug>`).
   Only project-specific code — the project theme and a client-functionality plugin —
   is committed; everything else is gitignored and installed.

## When to use

**Use this when** you're starting a new WordPress project (scaffold the repo) or
setting up local development for an existing one (wire it into Studio).

**Not this for:**

- **Choosing or building the project theme** (child theme vs fresh vs fork, `theme.json`) →
  `wp-theme-baseline`.
- **Operating a running Studio site** (WP-CLI, credentials, `eval`) → `wp-studio-cli`.
- **Live servers** (Pressable prod/staging, deploy pipeline detail) → `wp-pressable`.
- **Seeding local content/database** → out of scope; follow that project's own docs.
- **One site's specific blocks/conventions** → that project's `AGENTS.md`/`CLAUDE.md`.

## Part 1 — Scaffold a new project repo

Target shape (the repo root doubles as `wp-content`):

```
<project>/
  themes/<project>/            # committed — the project theme (see wp-theme-baseline)
  plugins/<project>-functionality/  # committed — client-functionality plugin (if needed)
  composer.json                # plugin/theme dependencies + PHP QA tooling
  package.json                 # JS tooling (theme builds via @wordpress/scripts)
  index.php                    # "Silence is golden."
  phpcs.xml.dist               # WordPress coding standards config
  release-please-config.json   # automated releases (see wp-pressable for the pipeline)
  renovate.json                # dependency automation
  .gitignore                   # allowlist pattern — see below
```

### composer.json and .gitignore baselines

Both templates, the package-name conventions for each dependency source, and the allowlist
trap: [`references/scaffold-baselines.md`](references/scaffold-baselines.md).

Two things worth knowing before you open it: **which plugins a project needs is
project-specific** — don't copy another site's list — and the `.gitignore` is an *allowlist*,
so every committed plugin needs its own re-include pair or git silently ignores it.

### The project theme

The theme lives in `themes/<project>/` and is committed. **Which baseline it starts from is a
decision, not a default** — child theme, fresh block theme, or fork — and
[`wp-theme-baseline`](../wp-theme-baseline/SKILL.md) owns it. **Do not clone
`base-wp-theme-2026`**; earlier versions of this skill said to, and it was never launched.

If the theme has a build (`package.json` with `@wordpress/scripts` — a child theme often has
none): `cd themes/<project> && npm install && npm run build` (`npm start` to watch).

## Part 2 — Wire the repo into a Studio site

Prereq: the `studio` CLI on `PATH` (Studio app → **Settings → General → Studio CLI**),
and the repo cloned somewhere like `~/GitHub/<project>` — **not** inside `~/Studio`.

1. **Create a Studio site** for the project. Convention: site path `~/Studio/<project>`.
   ```bash
   studio create --path ~/Studio/<project> --name "<Project>"
   ```
   (The Studio app's **Add site** or the Studio MCP `site_create` work too.)
2. **Stop the site** before touching its filesystem:
   ```bash
   studio stop --path ~/Studio/<project>
   ```
3. **Rescue Studio's SQLite runtime pieces** from the freshly provisioned
   `wp-content` into the repo checkout (they're gitignored, so this is safe):
   ```bash
   SITE=~/Studio/<project>; REPO=~/GitHub/<project>
   mkdir -p "$REPO/mu-plugins"
   cp    "$SITE/wp-content/db.php"         "$REPO/"
   cp -R "$SITE/wp-content/mu-plugins/."   "$REPO/mu-plugins/"   # sqlite-database-integration
   cp -R "$SITE/wp-content/database"       "$REPO/"              # .ht.sqlite lives here
   ```
   (The trailing `/.` merges into an existing committed `mu-plugins/` dir instead of
   nesting a second one inside it.)
   Without these three the site cannot boot — Studio has no MySQL; the `db.php`
   drop-in + SQLite mu-plugin **are** the database layer.
4. **Symlink the repo in as `wp-content`:**
   ```bash
   mv "$SITE/wp-content" "$SITE/wp-content-studio-default"   # keep as fallback
   ln -s "$REPO" "$SITE/wp-content"
   ```
5. **Install dependencies and build:**
   ```bash
   cd "$REPO" && composer install
   cd themes/<project> && npm install && npm run build
   ```
6. **Start and activate:**
   ```bash
   studio start --skip-browser --path ~/Studio/<project>
   studio wp theme activate <project> --path ~/Studio/<project>
   studio config set --debug-log --path ~/Studio/<project>   # baseline: log to wp-content/debug.log
   ```

   If the started site can't read the symlinked files (blank page, file-not-found
   errors), allow PHP to follow the symlink out of the site directory:
   `studio config set --file-access all-files --path ~/Studio/<project>`. The default
   `site-directory` mode normally follows the symlink fine — this is a fallback only.

### Verify

```bash
studio site status --path ~/Studio/<project> --format json   # URL + admin credentials
studio wp theme list --status=active --path ~/Studio/<project>
studio wp plugin list --path ~/Studio/<project>               # Composer-installed plugins visible
studio wp eval 'echo ABSPATH;' --path ~/Studio/<project>      # runtime answers
```

Then load the site URL — a booted front page on the project theme means the wiring is
correct. From here, day-to-day operation is `wp-studio-cli`.

## Gotchas

- **`--path` targets the SITE, not the repo.** `studio` commands take
  `~/Studio/<project>` (or run from that directory). The repo path only appears in the
  symlink.
- **`wp-config.php` lives in the site root**, above `wp-content` — never in the repo.
  Studio strips the MySQL `DB_*` constants; don't add them back, and don't reference
  them in code (SQLite handles the connection via `db.php`).
- **Composer writes into `plugins/` and `themes/`** (via `installer-paths`) and those
  paths are gitignored — that's by design. CI runs `composer install` at deploy time;
  a plugin "missing from git" is usually just Composer-managed.
- **The symlink cuts both ways:** edits in the repo are live immediately, but
  `wp plugin update`/`wp plugin install` run against the live site also **write into
  your repo checkout**. Manage plugin versions through `composer.json`, not the admin
  or WP-CLI, or the next `composer install` reverts them.
- **Media isn't in git** (`/uploads/` is ignored). Getting real content/uploads locally
  is per-project — check that project's docs.


## Guardrails

- **Never commit WordPress core, `wp-config.php`, or Studio's SQLite runtime**
  (`db.php`, `/database`, `mu-plugins/sqlite-database-integration`) — on a real host they
  shadow the live MySQL setup.
- **Never delete the Studio runtime pieces locally** either; the site dies without them.
- **Never move `wp-content` without preserving the original.** Rename it
  (`wp-content-studio-default`) before symlinking, so the site can be restored.
- **Never manage plugin versions through the admin or `wp plugin update`** when the repo is
  symlinked in — those writes land in your checkout and get reverted by the next
  `composer install`. Versions change in `composer.json`.
- **Never commit Composer-installed plugins/themes** — `installer-paths` writes into
  gitignored directories by design.
- Don't hand-edit versions or `CHANGELOG.md` in a scaffolded repo — release-please owns
  them ([`commit-and-release`](../commit-and-release/SKILL.md)), and tie the setup work to a
  task before committing ([`task-tracking`](../task-tracking/SKILL.md)).

## Done

- [ ] Repo root is `wp-content`-shaped (`themes/`, `plugins/`, tooling) with no core files.
- [ ] `composer install` resolves all plugins from wpackagist / packagist.linchpin.com.
- [ ] The Studio site's `wp-content` is a symlink to the repo, with the original preserved
      and the SQLite runtime pieces intact.
- [ ] The site loads, the project theme is active, and the admin URL/credentials are known.
- [ ] `.gitignore` allowlists only project code; `git status` is clean of vendored plugins.
