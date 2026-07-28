---
name: wp-local-setup
description: Stand up the Linchpin baseline WordPress local environment — scaffold a new wp-content-shaped project repo (Composer-managed plugins from wpackagist.org + packagist.linchpin.com, a theme started from base-wp-theme-2026, release-please deploys) and/or wire a project repo into a WordPress Studio site by symlinking the repo in as the site's wp-content while preserving Studio's SQLite runtime pieces. Use when starting a new Linchpin WordPress project or setting up local development for an existing one.
version: 1.0.0
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

- **Operating a running Studio site** (WP-CLI, credentials, `eval`) → `wp-studio-cli`.
- **Live servers** (Pressable prod/staging, deploy pipeline detail) → `wp-pressable`.
- **Seeding local content/database** → out of scope; follow that project's own docs.
- **One site's specific blocks/conventions** → that project's `AGENTS.md`/`CLAUDE.md`.

## Part 1 — Scaffold a new project repo

Target shape (the repo root doubles as `wp-content`):

```
<project>/
  themes/<project>/            # committed — the project theme (from base-wp-theme-2026)
  plugins/<project>-functionality/  # committed — client-functionality plugin (if needed)
  composer.json                # plugin/theme dependencies + PHP QA tooling
  package.json                 # JS tooling (theme builds via @wordpress/scripts)
  index.php                    # "Silence is golden."
  phpcs.xml.dist               # WordPress coding standards config
  release-please-config.json   # automated releases (see wp-pressable for the pipeline)
  renovate.json                # dependency automation
  .gitignore                   # allowlist pattern — see below
```

### composer.json baseline

```json
{
  "name": "linchpin/<project>",
  "repositories": [
    { "type": "composer", "url": "https://wpackagist.org" },
    { "type": "composer", "url": "https://packagist.linchpin.com" }
  ],
  "require": {
    "php": ">=8.2"
  },
  "require-dev": {
    "composer/installers": "^2"
  },
  "extra": {
    "installer-paths": {
      "plugins/{$name}/": ["type:wordpress-plugin"],
      "themes/{$name}/": ["type:wordpress-theme"]
    }
  }
}
```

- wordpress.org plugins/themes → `wpackagist-plugin/<slug>` / `wpackagist-theme/<slug>`.
- Premium or shared-private packages → `linchpin/<slug>` from packagist.linchpin.com.
- A plugin built **only for this client** is committed to `plugins/` instead (and
  allowlisted in `.gitignore`).
- Which plugins a project needs is project-specific — don't copy another site's list.
- Mature projects add the PHP QA stack to `require-dev` (`wp-coding-standards/wpcs`,
  `phpstan/phpstan` + `szepeviktor/phpstan-wordpress`, `php-parallel-lint/php-parallel-lint`,
  `friendsofphp/php-cs-fixer`) — mirror `linchpin/linchpin.com` when setting that up.

### .gitignore baseline (allowlist pattern)

Ignore everything Composer or the runtime writes; explicitly re-include what's ours:

```gitignore
# Plugins/themes are Composer-installed — commit only project code
/plugins/*
!plugins/<project>-functionality/
!plugins/<project>-functionality/**
/themes/*
!themes/<project>/
!themes/<project>/**
/vendor
node_modules

# WordPress runtime
debug.log
/uploads/
/upgrade/

# WordPress Studio runtime (SQLite) — never commit these
db.php
/database
/mu-plugins/sqlite-database-integration
mu-plugins/99-studio-loader.php
```

Adding a new **committed** plugin later requires a new `!plugins/<name>/` pair —
otherwise the `/plugins/*` rule silently keeps it out of git.

### The project theme

Start from the baseline theme, don't build from scratch:

```bash
git clone https://github.com/linchpin/base-wp-theme-2026.git themes/<project>
rm -rf themes/<project>/.git
```

Then rebrand: update `style.css` (`Theme Name`, `Theme URI`, `Description`,
`Text Domain`) and `package.json` (`name`), and search-replace the text domain in PHP
files. It's a block theme (`theme.json`, `templates/`, `parts/`, `patterns/`) built
with `@wordpress/scripts`:

```bash
cd themes/<project> && npm install && npm run build   # npm start = watch mode
```

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
- **Never commit the Studio runtime pieces** (`db.php`, `/database`,
  `mu-plugins/sqlite-database-integration`). They're local-only; on a Pressable deploy
  they would shadow the host's real MySQL setup.
- **Never delete them locally either** — the site dies without its database layer.
- **Composer writes into `plugins/` and `themes/`** (via `installer-paths`) and those
  paths are gitignored — that's by design. CI runs `composer install` at deploy time;
  a plugin "missing from git" is usually just Composer-managed.
- **The symlink cuts both ways:** edits in the repo are live immediately, but
  `wp plugin update`/`wp plugin install` run against the live site also **write into
  your repo checkout**. Manage plugin versions through `composer.json`, not the admin
  or WP-CLI, or the next `composer install` reverts them.
- **Media isn't in git** (`/uploads/` is ignored). Getting real content/uploads locally
  is per-project — check that project's docs.

## Quick reference

| Task | Command |
| --- | --- |
| Clone base theme | `git clone https://github.com/linchpin/base-wp-theme-2026.git themes/<project>` (then `rm -rf .git`, rebrand) |
| Install plugins | `composer install` (repo root) |
| Add a wordpress.org plugin | `composer require wpackagist-plugin/<slug>` |
| Add a premium/shared plugin | `composer require linchpin/<slug>` (packagist.linchpin.com) |
| Build the theme | `npm run build` in `themes/<project>` (`npm start` to watch) |
| Symlink repo into Studio | `mv <site>/wp-content <site>/wp-content-studio-default && ln -s <repo> <site>/wp-content` |
| Start the site | `studio start --skip-browser --path ~/Studio/<project>` |
| Activate the theme | `studio wp theme activate <project> --path ~/Studio/<project>` |
| Site URL + credentials | `studio site status --path ~/Studio/<project> --format json` |

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
  them ([`commit-and-release`](../commit-and-release/SKILL.md)).

## Done

- [ ] Repo root is `wp-content`-shaped (`themes/`, `plugins/`, tooling) with no core files.
- [ ] `composer install` resolves all plugins from wpackagist / packagist.linchpin.com.
- [ ] The Studio site's `wp-content` is a symlink to the repo, with the original preserved
      and the SQLite runtime pieces intact.
- [ ] The site loads, the project theme is active, and the admin URL/credentials are known.
- [ ] `.gitignore` allowlists only project code; `git status` is clean of vendored plugins.

## Related skills

- [`wp-studio-cli`](../wp-studio-cli/SKILL.md) — operating the running Studio site (WP-CLI
  passthrough, `eval`, the PHP-WASM `ABSPATH` rule).
- [`wp-pressable`](../wp-pressable/SKILL.md) — the hosted environments this baseline deploys
  to, and the release-please → `linchpin/actions` pipeline.
- [`task-tracking`](../task-tracking/SKILL.md) — tie the setup work to a ClickUp task before
  committing.
