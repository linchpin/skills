# Scaffold baselines — `composer.json` and `.gitignore`

The two file templates a new Linchpin WordPress project repo starts from. Copy, substitute
`<project>`, then follow Part 1 of [`../SKILL.md`](../SKILL.md).

Both encode the same premise: **the repo is `wp-content`**, plugins and themes arrive via
Composer, and only project-specific code is committed.

## `composer.json`

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

Where dependencies come from:

| Source | Package name | Command |
| --- | --- | --- |
| wordpress.org plugin | `wpackagist-plugin/<slug>` | `composer require wpackagist-plugin/<slug>` |
| wordpress.org theme | `wpackagist-theme/<slug>` | `composer require wpackagist-theme/<slug>` |
| Premium / shared-private | `linchpin/<slug>` | `composer require linchpin/<slug>` |
| Built only for this client | *not a dependency* | Commit it to `plugins/` and allowlist it below |

- **Which plugins a project needs is project-specific** — don't copy another site's list.
- `installer-paths` writes into `plugins/` and `themes/`, which are gitignored. That's by
  design; CI runs `composer install` at deploy time.
- Mature projects add the PHP QA stack to `require-dev`: `wp-coding-standards/wpcs`,
  `phpstan/phpstan` + `szepeviktor/phpstan-wordpress`, `php-parallel-lint/php-parallel-lint`,
  `friendsofphp/php-cs-fixer`. Mirror an existing repo that already has it configured rather
  than assembling the versions from scratch.

## `.gitignore` (allowlist pattern)

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

**The allowlist is the part that bites.** Adding a new *committed* plugin later requires its
own `!plugins/<name>/` **and** `!plugins/<name>/**` pair — without both, the `/plugins/*` rule
silently keeps it out of git and the omission usually surfaces at deploy.

The Studio block matters just as much in the other direction: those four paths are the local
SQLite database layer. Committing them ships a `db.php` drop-in that shadows a real host's
MySQL configuration.
