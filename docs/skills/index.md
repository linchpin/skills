---
title: Skills
sidebar_position: 4
---

Every skill in the library, alphabetical. You rarely need to name one: ask for what you want and the matching skill loads. Use this table when two skills look close and you want to know which will fire. Generic WordPress skills we vendor but don't maintain are listed under [Base layer](../upstream.md).

| Skill | What it does | Reach for it when | Defers to |
| --- | --- | --- | --- |
| [`agent-capabilities`](agent-capabilities.md) | Right-sizes what an agent loads: duplicate skill installs and which MCP servers a repo needs | Context feels full before work starts, or a skill appears twice | `write-a-linchpin-skill` for writing a skill |
| [`browser-automation`](browser-automation.md) | Drives a browser: Chrome DevTools MCP first, Playwright headless as fallback | A task needs to load a page, click a flow, screenshot, or read console errors | `web-qa` for what to test |
| [`commit-and-release`](commit-and-release.md) | Writes commit messages and PR titles that pass the repo's commitlint, and stays out of release-please's way | Composing a commit, a hook rejects one, or opening a PR | `quality-gates` for lint and tests; `task-tracking` for the branch and task key |
| [`dependency-updates`](dependency-updates.md) | Handles the npm and Composer work Renovate can't automerge | A Renovate PR is red or conflicted, a major bump, or a security advisory | `quality-gates` for lint failures |
| [`design-previews`](design-previews.md) | Builds three different visual directions as HTML previews and gets a pick | Kicking off a design, or a brief is too vague to build from | `wp-audit` for auditing an existing design |
| [`docspress-publish`](docspress-publish.md) | Publishes a repo's Markdown docs to docs.linchpin.com with DocsPress | A project needs its docs published, or a sync-docs workflow fails | `generate-docs-from-source` for writing the docs |
| [`engagement-types`](engagement-types.md) | Works out whether a request is support, maintenance, a project, product work, or pre-sales | Picking up unfamiliar work, or deciding where a task belongs in ClickUp | `task-tracking` for the task itself |
| [`engineering-discipline`](engineering-discipline.md) | Keeps a change honest and small: surface assumptions, minimum code, define "working" | A task is ambiguous, or a diff is growing past what was asked | `quality-gates` and `investigate` |
| [`github-repo-setup`](github-repo-setup.md) | Creates a linchpin org repo and wires its environments, secrets and variables for deploys | Starting a new site or product repo, or a deploy fails on an empty variable | `wp-local-setup` for repo contents and local wiring |
| [`investigate`](investigate.md) | Finds the root cause of a bug before anything changes | Something is broken, or a fix didn't hold | `web-qa` for hunting unknown bugs; `wp-audit` for speed |
| [`project-context`](project-context.md) | Orients on a repo: environment, host, ClickUp space and release model | Starting work on an unfamiliar repo, or before a command that assumes an environment | `quality-gates` for running the checks |
| [`quality-gates`](quality-gates.md) | Runs the project's own lint, standards, static analysis, tests and Plugin Check | Before committing, or when CI lint or a pre-commit hook fails | `commit-and-release` for the message |
| [`safety-hooks`](safety-hooks.md) | Turns on a hook that makes destructive commands require confirmation, plus an optional edit boundary | Touching production or a client database, or asked for careful mode | `wp-pressable` for operating the live site |
| [`skill-updates`](skill-updates.md) | Brings every installed copy of these skills up to the published release | A session says skills are behind, or "update the skills" | `dependency-updates` for npm and Composer packages |
| [`support-triage`](support-triage.md) | Runs a client support request from clarifying through closing the loop | Handling a ticket, or a client reports something broken | `engagement-types`, `investigate` |
| [`task-tracking`](task-tracking.md) | Ties every unit of work to a ClickUp task, or an explicit `NO-TASK` | Starting work, filing a ticket, committing, or handing off | `commit-and-release` for the message grammar |
| [`web-qa`](web-qa.md) | QAs a site like a real user and fixes what it finds, one commit per fix | Asked to QA or test a flow, or before handing work to a client | `quality-gates` for lint and unit tests |
| [`wordpress-blocks`](wordpress-blocks.md) | Authors page and post content as valid block markup, pattern-first | Adding or changing content: a hero, FAQ, CTA or pricing table | `wp-block-development` for building blocks |
| [`wp-audit`](wp-audit.md) | Audits performance, accessibility and visible frontend quality, then re-measures | "Why is the site slow", Core Web Vitals, WCAG, or before a handover | `quality-gates` for lint and tests |
| [`wp-block-conventions`](wp-block-conventions.md) | Builds custom blocks the Linchpin way: apiVersion 3, `render.php`, Interactivity API | Creating, editing or reviewing a custom block | `wordpress-blocks` for authoring content |
| [`wp-design-tokens`](wp-design-tokens.md) | Makes `theme.json` the single source of truth for color, type, spacing and shadow | Changing a brand color, or an edit to styles seems to do nothing | `wp-theme-baseline` for choosing a theme |
| [`wp-implementation-choice`](wp-implementation-choice.md) | Decides whether a request becomes theme work, a block, a plugin, or existing features | A request could be built more than one way, or a custom plugin is proposed | The skill for whatever gets chosen |
| [`wp-local-setup`](wp-local-setup.md) | Stands up the baseline local environment and wires a repo into WordPress Studio | Starting a new project or setting up local development | `wp-theme-baseline`, `github-repo-setup` |
| [`wp-plugin-modernization`](wp-plugin-modernization.md) | Brings a legacy plugin onto the standard in stages without breaking it | Taking over an old plugin, or a migration has stalled | `wp-plugin-standards` for the target state |
| [`wp-plugin-standards`](wp-plugin-standards.md) | Defines the shape of a Linchpin plugin repo and audits where one falls short | Setting up a plugin repo, or asking what one is missing | `quality-gates` for running the gates |
| [`wp-plugin-testing`](wp-plugin-testing.md) | Splits a plugin's PHP tests into a WordPress-free unit layer and an integration layer that runs locally on SQLite | PHP tests need MySQL or Docker, CI is slow, or deciding whether a test needs WordPress | `quality-gates` for running them |
| [`wp-pressable`](wp-pressable.md) | Operates a Pressable-hosted site read-first, including the "renders locally, not on prod" fix | You need to inspect or change the live server, not just the repo | `wp-studio-cli` for local development |
| [`wp-studio-cli`](wp-studio-cli.md) | Operates a local WordPress Studio site, MCP first and the `studio` CLI as fallback | Running WP-CLI locally, validating blocks, or screenshotting a local site | `wp-local-setup` for setting the site up |
| [`wp-theme-baseline`](wp-theme-baseline.md) | Chooses and stands up a new theme: child theme, fresh block theme, or a fork | Starting the theme for a new site | `wp-local-setup` for the repo and local site |
| [`write-a-linchpin-skill`](write-a-linchpin-skill.md) | The house standard for writing and reviewing a skill in this library | Adding or reviewing a skill, or deciding whether one belongs here | A project's own `CLAUDE.md` for project conventions |
