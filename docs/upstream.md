---
title: Base layer
sidebar_position: 6
---

The installer also puts in skills that Linchpin doesn't write. They cover generic WordPress practice, plus generating docs from a source tree. Each source is pinned to a commit in [`upstream.json`](https://github.com/linchpin/skills/blob/main/upstream.json) and fetched at install time. Neither source publishes releases, so a pin changes only when someone bumps it deliberately. Pass `--skip-upstream` to install without them.

This site documents only the Linchpin skills. Each entry below links to the skill's source at the pinned commit. Where a Linchpin skill conflicts with one of these, the Linchpin skill wins.

## WordPress/agent-skills

[`WordPress/agent-skills`](https://github.com/WordPress/agent-skills), GPL-2.0-or-later, pinned at `aa735ea`.

| Skill | Use when | Linchpin skills that defer to it |
| --- | --- | --- |
| [`wordpress-router`](https://github.com/WordPress/agent-skills/blob/aa735ea7111c7924ee988306bcef70439e17dec9/skills/wordpress-router/SKILL.md) | Classifying a WordPress codebase and routing to the right workflow | — |
| [`wp-abilities-api`](https://github.com/WordPress/agent-skills/blob/aa735ea7111c7924ee988306bcef70439e17dec9/skills/wp-abilities-api/SKILL.md) | Working with the Abilities API: registering abilities and categories, REST exposure, permissions | — |
| [`wp-block-development`](https://github.com/WordPress/agent-skills/blob/aa735ea7111c7924ee988306bcef70439e17dec9/skills/wp-block-development/SKILL.md) | Developing Gutenberg blocks: `block.json`, attributes, dynamic rendering, deprecations, the `@wordpress/scripts` build | [`wordpress-blocks`](skills/wordpress-blocks.md), [`wp-block-conventions`](skills/wp-block-conventions.md) |
| [`wp-block-themes`](https://github.com/WordPress/agent-skills/blob/aa735ea7111c7924ee988306bcef70439e17dec9/skills/wp-block-themes/SKILL.md) | Developing block themes: `theme.json`, templates and parts, patterns, style variations, Site Editor troubleshooting | [`wordpress-blocks`](skills/wordpress-blocks.md), [`wp-block-conventions`](skills/wp-block-conventions.md), [`wp-design-tokens`](skills/wp-design-tokens.md), [`wp-implementation-choice`](skills/wp-implementation-choice.md), [`wp-theme-baseline`](skills/wp-theme-baseline.md) |
| [`wp-interactivity-api`](https://github.com/WordPress/agent-skills/blob/aa735ea7111c7924ee988306bcef70439e17dec9/skills/wp-interactivity-api/SKILL.md) | Building or debugging Interactivity API features: `data-wp-*` directives, stores, hydration | — |
| [`wp-performance`](https://github.com/WordPress/agent-skills/blob/aa735ea7111c7924ee988306bcef70439e17dec9/skills/wp-performance/SKILL.md) | Backend performance: profiling, queries, autoloaded options, object caching, cron | [`wp-audit`](skills/wp-audit.md) |
| [`wp-phpstan`](https://github.com/WordPress/agent-skills/blob/aa735ea7111c7924ee988306bcef70439e17dec9/skills/wp-phpstan/SKILL.md) | Configuring, running or fixing PHPStan in a WordPress project | — |
| [`wp-playground`](https://github.com/WordPress/agent-skills/blob/aa735ea7111c7924ee988306bcef70439e17dec9/skills/wp-playground/SKILL.md) | Disposable WordPress Playground instances, blueprints, and version switching | — |
| [`wp-plugin-development`](https://github.com/WordPress/agent-skills/blob/aa735ea7111c7924ee988306bcef70439e17dec9/skills/wp-plugin-development/SKILL.md) | Plugin architecture, hooks, lifecycle, Settings API, security, release packaging | [`wp-implementation-choice`](skills/wp-implementation-choice.md), [`wp-plugin-modernization`](skills/wp-plugin-modernization.md), [`wp-plugin-standards`](skills/wp-plugin-standards.md) |
| [`wp-project-triage`](https://github.com/WordPress/agent-skills/blob/aa735ea7111c7924ee988306bcef70439e17dec9/skills/wp-project-triage/SKILL.md) | A deterministic inspection of a WordPress repository, reported as JSON | — |
| [`wp-rest-api`](https://github.com/WordPress/agent-skills/blob/aa735ea7111c7924ee988306bcef70439e17dec9/skills/wp-rest-api/SKILL.md) | Building or debugging REST endpoints: routes, controllers, schema, permission callbacks | [`wp-implementation-choice`](skills/wp-implementation-choice.md) |
| [`wp-wpcli-and-ops`](https://github.com/WordPress/agent-skills/blob/aa735ea7111c7924ee988306bcef70439e17dec9/skills/wp-wpcli-and-ops/SKILL.md) | WP-CLI operations: safe search-replace, database export and import, cache, cron, multisite | — |

## linchpin/docspress

[`linchpin/docspress`](https://github.com/linchpin/docspress) is our fork of [`Automattic/docspress`](https://github.com/Automattic/docspress). It is GPL-3.0-or-later, pinned at `0f251db`. The fork adds support for the per-repo `.docspress/brief.md` contract and for catalog-shaped repositories, so upstream's generator is not a drop-in substitute.

| Skill | Use when | Linchpin skills that defer to it |
| --- | --- | --- |
| [`generate-docs-from-source`](https://github.com/linchpin/docspress/blob/0f251db8cd9e4e31a5d51e1cbc7aacaa46d4780e/.agents/skills/generate-docs-from-source/SKILL.md) | Deriving a DocsPress Markdown docs tree from a repository's own source | [`docspress-publish`](skills/docspress-publish.md) |
