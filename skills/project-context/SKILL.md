---
name: project-context
description: Orient before acting on a Linchpin project — identify the repo and branch, the local environment (Studio, wp-env, LocalWP), the host (Pressable or Cloudflare), the ClickUp space, and the release model, from .linchpin.json, composer.json, package.json, and the git remote. Use when starting work on an unfamiliar repo, before running commands that assume an environment, when a skill's Preflight needs the project's shape, or when something behaves differently than expected. Not for running the checks themselves.
version: 1.0.0
---

# Project context

Our projects are not uniform: WordPress plugin repos, `wp-content`-shaped site repos, and
Cloudflare Workers services all live under the same conventions but expose different tools,
environments, and hosts. **Guessing wrong is the most common way an agent wastes a session** —
running `wp-env` on a Studio project, or looking for `phpcs.xml.dist` in a Workers repo.

This is the one place that answers "what am I working in?". Other skills reference it from
their Preflight instead of each re-deriving it.

## When to use

- Starting work on a repo you haven't touched this session.
- Before any command that assumes an environment, host, or toolchain.
- A skill's Preflight needs the project's shape.
- Something behaves unexpectedly and the environment is a suspect.

**Not this skill:** running lint or tests — [`quality-gates`](../quality-gates/SKILL.md).
Operating the local site — [`wp-studio-cli`](../wp-studio-cli/SKILL.md). Operating the
server — [`wp-pressable`](../wp-pressable/SKILL.md).

## Owns

Canonical for: what to read to identify a project, and what each signal means. Every other
skill's Preflight should link here rather than restate the detection table.

## The orientation pass

Cheap, read-only, and worth doing once per session rather than per command:

```bash
git rev-parse --show-toplevel && git branch --show-current && git remote get-url origin
ls .linchpin.json composer.json package.json phpcs.xml.dist .wp-env.json wrangler.toml 2>/dev/null
```

Then read what exists:

| Signal | What it tells you |
| --- | --- |
| `.linchpin.json` | House metadata — plugin slug, declared local environments and their paths, preferred agent |
| Repo root has `themes/` + `plugins/` and no core | A **site repo** — the repo *is* `wp-content` ([`wp-local-setup`](../wp-local-setup/SKILL.md)) |
| A single plugin bootstrap file + `includes/` | A **plugin/product repo** (Mantle, linchpin-blocks) |
| `wrangler.toml` | A **Cloudflare Workers** service — no PHP toolchain at all |
| Site registered in Studio | Local env is **Studio** — the default ([`wp-studio-cli`](../wp-studio-cli/SKILL.md)) |
| `.wp-env.json` / `.linchpin.json` environments | Legacy wp-env or LocalWP; predates the Studio switch — confirm before using |
| `composer.json` scripts, `phpcs.xml.dist`, `phpstan.neon` | Which PHP gates exist ([`quality-gates`](../quality-gates/SKILL.md)) |
| Nested `blocks/package.json`, `themes/*/package.json` | Builds run **in that workspace**, not the root |
| `release-please-config.json` | Versions and `CHANGELOG.md` are machine-owned ([`commit-and-release`](../commit-and-release/SKILL.md)) |
| `commitlint.config.js` | This repo's allowed commit types — they differ between repos |
| Deploy workflows referencing Pressable | Hosted on Pressable ([`wp-pressable`](../wp-pressable/SKILL.md)) |
| Git remote name | Infers the ClickUp space ([`task-tracking`](../task-tracking/SKILL.md)) |

## What to report

State the shape in one or two lines before doing the work, so the user can correct a wrong
assumption before it costs anything:

> `linchpin.com` on `issue/LINCHPIN-5210` — site repo (repo is `wp-content`), Studio local,
> Pressable hosted, release-please. PHP gates: phpcs + phpstan. Nested builds under
> `themes/linchpin` and `plugins/linchpin-functionality`.

Then carry it for the session. Re-check only when the branch changes or something surprises
you — this is orientation, not a per-command ritual.

## Guardrails

- **Never assume the environment from a config file's presence alone.** A leftover
  `.wp-env.json` in a Studio project is history, not intent — when two exist, ask.
- **Never infer the host from the repo name.** Read the deploy workflows.
- **Never run an environment-changing command** (starting containers, creating sites) as part
  of orientation. This pass is read-only.
- **Never carry stale context across a branch switch** — base branch, gates, and task key can
  all change.
- If a signal is missing and the answer matters, say what's missing rather than picking the
  most likely option silently.

## Done

- [ ] Repo root, branch, and remote identified.
- [ ] Project shape known: site repo, plugin/product repo, or Workers service.
- [ ] Local environment identified, and ambiguity resolved with the user rather than guessed.
- [ ] Host and release model known before anything is shipped or deployed.
- [ ] The shape was stated back to the user in a line or two.
