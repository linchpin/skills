---
title: project-context
---

Linchpin projects aren't uniform — WordPress plugin repos, `wp-content`-shaped site repos, and Cloudflare Workers services share conventions but expose different tools, environments, and hosts. Guessing wrong is the most common way an agent wastes a session. This is the one place that answers "what am I working in?" — other skills reference it from their Preflight rather than re-deriving it.

## When to reach for it

- Starting work on a repo you haven't touched this session.
- Before any command that assumes an environment, host, or toolchain.
- A skill's Preflight needs the project's shape.
- Something behaves unexpectedly and the environment is a suspect.

Things you might say that load it: "what is this repo", "what am I working with", "where does this deploy", "which environment am I on". It also applies before running any command that assumes a local environment or host.

## Where it stops

> **Not this skill:** running lint or tests — [`quality-gates`](quality-gates.md). Operating the local site — [`wp-studio-cli`](wp-studio-cli.md). Operating the server — [`wp-pressable`](wp-pressable.md).

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Run the orientation pass","content":"<p>Run cheap, read-only git and file-existence checks once per session, not per command: repo root, branch, remote, and which config files exist.</p>"},{"title":"Read what each signal means","content":"<p>Match what's present — <code>.linchpin.json</code>, a site-repo shape, <code>wrangler.toml</code>, deploy workflows — against the detection table to decide the project's shape, environment, host, and release model.</p>"},{"title":"Check the capability surface","content":"<p>Compare what the agent itself loaded — skills, MCP servers — against the project's actual shape, and flag a mismatch once rather than working around it silently.</p>"},{"title":"Report the shape","content":"<p>State the shape back to the user in a line or two before doing any work, so a wrong assumption gets corrected before it costs anything, then carry it for the rest of the session.</p>"}]} /-->

## What it checks first

Runs a cheap, read-only pass — `git rev-parse`, `git branch --show-current`, `git remote get-url origin`, and a listing of `.linchpin.json`, `composer.json`, `package.json`, `phpcs.xml.dist`, `.wp-env.json`, `wrangler.toml` — then reads what exists against this table:

| Signal | What it tells you |
| --- | --- |
| `.linchpin.json` | House metadata — plugin slug, declared local environments, preferred agent |
| `themes/` + `plugins/` at the root, no core | A site repo — the repo *is* `wp-content` |
| A single plugin bootstrap file + `includes/` | A plugin/product repo |
| `wrangler.toml` | A Cloudflare Workers service — no PHP toolchain at all |
| Site registered in Studio | Local env is Studio, the default |
| `.wp-env.json` / `.linchpin.json` environments | Legacy wp-env or LocalWP — confirm before using |
| `composer.json` scripts, `phpcs.xml.dist`, `phpstan.neon` | Which PHP gates exist |
| Nested `blocks/package.json`, `themes/*/package.json` | Builds run in that workspace, not the root |
| `release-please-config.json` | Versions and `CHANGELOG.md` are machine-owned |
| `commitlint.config.js` | This repo's allowed commit types |
| Deploy workflows referencing Pressable | Hosted on Pressable |
| Git remote name | Infers the ClickUp space |
| `.mcp.json` | The MCP servers this repo declares it needs |

## What it owns

Canonical for: what to read to identify a project, and what each signal means. Every other skill's Preflight should link here rather than restate the detection table.

## Guardrails

- Never assume the environment from a config file's presence alone. A leftover `.wp-env.json` in a Studio project is history, not intent — when two exist, ask.
- Never infer the host from the repo name. Read the deploy workflows.
- Never run an environment-changing command (starting containers, creating sites) as part of orientation. This pass is read-only.
- Never carry stale context across a branch switch — base branch, gates, and task key can all change.
- If a signal is missing and the answer matters, say what's missing rather than picking the most likely option silently.

## Done when

- [ ] Repo root, branch, and remote identified.
- [ ] Project shape known: site repo, plugin/product repo, or Workers service.
- [ ] Local environment identified, and ambiguity resolved with the user rather than guessed.
- [ ] Host and release model known before anything is shipped or deployed.
- [ ] The shape was stated back to the user in a line or two.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/project-context/SKILL.md) is the whole skill. It has no `references/` or `scripts/`.

Pre-approved, so the agent can run them without a prompt: reading and searching files, and read-only git commands — `branch --show-current`, `remote get-url`, `rev-parse`, and `status`. Anything that writes still asks.

## Related skills

- [`quality-gates`](quality-gates.md) — runs lint, PHPCS, and PHPStan once this skill has told it which gates exist.
- [`wp-studio-cli`](wp-studio-cli.md) — operates the local Studio environment this skill only identifies.
- [`wp-pressable`](wp-pressable.md) — operates the server this skill only identifies.
- [`wp-local-setup`](wp-local-setup.md) — where a detected site repo (`themes/` + `plugins/`, no core) came from.
- [`commit-and-release`](commit-and-release.md) — owns versions and `CHANGELOG.md` once `release-please-config.json` is detected.
- [`task-tracking`](task-tracking.md) — the ClickUp space this skill infers from the git remote name.
- [`agent-capabilities`](agent-capabilities.md) — owns fixing a mismatch between the project's shape and what the agent loaded.
