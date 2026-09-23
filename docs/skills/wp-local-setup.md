---
title: wp-local-setup
---

Every Linchpin WordPress project follows the same baseline: the project repo is `wp-content` itself, local development runs on WordPress Studio with its `wp-content` directory symlinked to the repo checkout, and plugins and themes arrive as Composer dependencies from wpackagist.org and packagist.linchpin.com rather than being committed.

## When to reach for it

- Starting a new WordPress project — scaffold the repo.
- Setting up local development for an existing project — wire it into Studio.

## Where it stops

> **Not this for:**
>
> - **Choosing or building the project theme** (child theme vs fresh vs fork, `theme.json`) → `wp-theme-baseline`.
> - **Operating a running Studio site** (WP-CLI, credentials, `eval`) → `wp-studio-cli`.
> - **Live servers** (Pressable prod/staging, deploy pipeline detail) → `wp-pressable`.
> - **Creating the GitHub repo and its deploy wiring** (repo creation, scaffold population, environments, secrets/variables) → [`github-repo-setup`](github-repo-setup.md).
> - **Seeding local content/database** → out of scope; follow that project's own docs.
> - **One site's specific blocks/conventions** → that project's `AGENTS.md`/`CLAUDE.md`.

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Scaffold the project repo","content":"<p>Set up composer.json (wpackagist.org + packagist.linchpin.com, a project-specific plugin list) and the allowlist .gitignore, then decide the project theme's baseline rather than cloning a retired starter.</p>"},{"title":"Wire the repo into a new Studio site","content":"<p>Create and stop a Studio site, then rescue its SQLite runtime pieces (db.php, mu-plugins, database) into the repo checkout before replacing wp-content with a symlink to the repo, keeping the original as a fallback.</p>"},{"title":"Install, build, and verify","content":"<p>Run composer install and the theme's npm build, start the site and activate the theme, then confirm via site status, WP-CLI plugin/theme lists, and a loaded front page that the wiring is correct.</p>"}]} /-->

## What it checks first

Before wiring a repo in, confirms the `studio` CLI is on `PATH` and that the repo is cloned outside `~/Studio` (for example `~/GitHub/<project>`). Before scaffolding, treats the plugin list and theme baseline as project-specific rather than copying another site's. It doesn't call `project-context` itself — the relationship runs the other way: `project-context` recognizes a repo this skill has scaffolded by its shape (`themes/` + `plugins/` at the root, no core).

## What it owns

Canonical for: scaffolding a new `wp-content`-shaped project repo (the Composer baseline against wpackagist.org and packagist.linchpin.com, `.gitignore`, the project theme), and wiring an existing repo into a Studio site by symlinking it in as `wp-content` while preserving Studio's SQLite runtime pieces. The split with `wp-studio-cli` is the one worth remembering: this skill creates and wires; that one drives.

## Guardrails

- Never manage plugin versions through the admin or `wp plugin update` when the repo is symlinked in — versions change in `composer.json`, or the next `composer install` reverts them.
- Never commit Composer-installed plugins/themes — `installer-paths` writes into gitignored directories by design.
- Don't hand-edit versions or `CHANGELOG.md` in a scaffolded repo — release-please owns them, and tie the setup work to a task before committing.

<!-- wp:docspress/callout {"tone":"warning","title":"Never touch the Studio runtime pieces carelessly","content":"<p>Never commit WordPress core, wp-config.php, or Studio's SQLite runtime (db.php, /database, mu-plugins/sqlite-database-integration) — on a real host they shadow the live MySQL setup. Never delete them locally either; the site dies without them. Never move wp-content without preserving the original — rename it before symlinking, so the site can be restored.</p>","collapsible":false} /-->

## Done when

- [ ] Repo root is `wp-content`-shaped (`themes/`, `plugins/`, tooling) with no core files.
- [ ] `composer install` resolves all plugins from wpackagist / packagist.linchpin.com.
- [ ] The Studio site's `wp-content` is a symlink to the repo, with the original preserved and the SQLite runtime pieces intact.
- [ ] The site loads, the project theme is active, and the admin URL/credentials are known.
- [ ] `.gitignore` allowlists only project code; `git status` is clean of vendored plugins.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/wp-local-setup/SKILL.md) is the whole skill.
- [`references/scaffold-baselines.md`](https://github.com/linchpin/skills/blob/main/skills/wp-local-setup/references/scaffold-baselines.md) — the `composer.json` and `.gitignore` templates a new project repo starts from, plus the allowlist pitfall and where each dependency source's package name comes from.

Pre-approved, so the agent can run them without a prompt: reading and searching files, `git status`, and `studio site status`. Anything that creates a site, writes files, or runs `composer`/`npm` still asks.

## Related skills

- [`wp-theme-baseline`](wp-theme-baseline.md) — decides and stands up the project theme itself, once this skill has scaffolded the repo around it.
- [`wp-studio-cli`](wp-studio-cli.md) — drives the Studio site day to day once this skill has created and wired it.
- [`wp-pressable`](wp-pressable.md) — live servers and the deploy pipeline this skill's local setup feeds into.
- [`github-repo-setup`](github-repo-setup.md) — creates the GitHub repo and its deploy wiring, which this skill assumes already exists.
- [`commit-and-release`](commit-and-release.md) — owns versions and `CHANGELOG.md` in a scaffolded repo, never hand-edited here.
- [`task-tracking`](task-tracking.md) — ties the setup work to a task before committing.
