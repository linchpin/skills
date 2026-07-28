# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

`@linchpinagency/skills` — Linchpin's shared library of **AI agent skills** (Agent Skills
format: one directory per skill, each with a `SKILL.md`), plus a zero-dependency Node
installer that copies them into a coding agent's skills directory.

**The skills are the product; the installer is ~200 lines of plumbing.** Most work here is
writing/editing Markdown that another agent will later follow as instructions. There is no
build step and no runtime dependencies — the only automated check is the skill validator.

## Commands

```bash
npm run validate                          # node scripts/validate-skills.mjs — CI runs this on every PR
node scripts/validate-skills.mjs <name>   # just one skill
node scripts/validate-skills.mjs --strict # warnings fail too
node bin/install.mjs --list               # or: npm run list
node bin/install.mjs --help
```

Verify the installer end-to-end without touching your real skills dirs — it writes to
`$CWD/.claude/skills`, so run it from a throwaway directory:

```bash
mkdir -p /tmp/skills-test && cd /tmp/skills-test
node <repo>/bin/install.mjs --skip-upstream          # Linchpin skills only, offline-safe
node <repo>/bin/install.mjs --skip-upstream --agent all   # all four agent directories
node <repo>/bin/install.mjs                          # also fetches the pinned upstream tarball
```

Never test with `--global` — that overwrites `~/.claude/skills`.

Publishing (maintainers, from `main`): `npm version patch|minor|major && npm publish`. The
package ships only `bin/`, `skills/`, `upstream.json`, `README.md` (`files` in
`package.json`) — a new top-level file will NOT be published unless added there.

## Architecture

### Three tiers — the boundary that governs every content decision

| Tier | Lives in | Owns |
| --- | --- | --- |
| Base layer | `WordPress/agent-skills` upstream, pinned in `upstream.json`, fetched at install time (never committed here) | Generic "how WordPress works" |
| **Linchpin tooling — this repo** | `skills/` | Portable, cross-project agency practice |
| Project layer | each project's own `AGENTS.md`/`CLAUDE.md` | One site's blocks, palette, paths, quirks |

The gating test for any content added here: **would it be true on a different client's
project?** If not, it belongs in that project's repo. Generic WordPress knowledge belongs
upstream, not here — this overlay exists to say what the *agency* does. House rules win
where they conflict with the base layer.

### How the pieces connect

- `bin/install.mjs` — **auto-discovers** skills: any `skills/<name>/SKILL.md` is installable.
  No registry to update. Copies whole skill directories (`rmSync` then `cpSync`), so
  re-running is the update path and supporting files (`references/`, etc.) come along.
  Install targets live in the `AGENTS` map, where every entry is a **list** of directories
  (Copilot reads both `.agents/skills` and `.github/skills`); `--agent all` fans out to
  every agent. Skills are loaded by the **harness**, not the model — each agent needs its
  own copy, which is why the fan-out exists rather than a per-project mirror script.
- `scripts/validate-skills.mjs` — enforces the authoring standard (frontmatter, required
  sections, portability, referenced files, README catalog row). Repo tooling, deliberately
  **not** in `package.json` `files` — it doesn't ship to consumers.
- `upstream.json` — pinned commit SHA plus the curated list of upstream skill names.
  Upstream has no releases; bumping `ref` changes agent behavior silently, so bump
  deliberately and re-test. Upstream fetch is **best-effort**: any failure (offline, no
  `tar`, renamed skill) warns and still installs the Linchpin skills.
- `README.md` — the human-facing index. Its **Available skills** table is maintained by
  hand; adding a skill directory without adding its row is the usual miss.

## Authoring skills

**`skills/write-a-linchpin-skill/SKILL.md` is the authority** — load it before adding or
reviewing a skill. It owns the placement test, tier model, frontmatter, section skeleton,
naming, and the four house rules. Don't restate its content here or in the README; one
owner per concern is itself one of the rules.

What the validator enforces mechanically: `name` matches the directory, `description`
carries a "Use when …" trigger (80–1000 chars), semver `version`, the three required
sections (`## When to use`, `## Guardrails`, `## Done`), no machine-specific absolute
paths, referenced files exist, and a README catalog row.

The four house rules, in one line each, since they shape every skill in the library:
**detect don't assume** (our repos differ — read their config), **one owner per concern**
(link, never restate), **route work through ClickUp** (`task-tracking`), and **guardrails
are mandatory**.

Beyond the validator, a skill is only verifiable by reading it and running it against a
real project — the checks catch structure, not correctness.

## Conventions

- Conventional commits with the ClickUp task key as the scope: `feat(LINCHPIN-5164): …`,
  `docs(LINCHPIN-5163): …`, or `NO-TASK` when there's no ticket. This repo eats its own
  cooking: `task-tracking` owns the key, `commit-and-release` owns the message grammar.
- Branches: `feat/<slug>` or `issue/<TASK-KEY>`; work lands on `main` via PR.
- Unlike the projects that consume it, this repo has no commitlint, husky, release-please,
  or Renovate — it's a plain npm package published by hand. Skills describe the *consuming*
  projects' automation, which is why they must be verified against those repos, not this one.
