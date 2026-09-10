# Linchpin Skills

A shared library of **AI agent skills** for the kinds of projects Linchpin builds —
**WordPress**, **React**, and **Cloudflare Workers**. Skills are agent-agnostic
instruction sets ([Agent Skills](https://agentskills.io) format) that work in Claude Code,
GitHub Copilot, and other compatible coding agents.

[![npm](https://img.shields.io/npm/v/@linchpinagency/skills?logo=npm&color=CB3837)](https://www.npmjs.com/package/@linchpinagency/skills)
![License GPL-2.0-or-later](https://img.shields.io/badge/License-GPL--2.0--or--later-blue)
![Format: Agent Skills](https://img.shields.io/badge/Format-Agent%20Skills-6E56CF)
![Node 18+](https://img.shields.io/badge/Node-18%2B-5FA04E?logo=nodedotjs&logoColor=white)
![Zero dependencies](https://img.shields.io/badge/Dependencies-0-brightgreen)

<!-- x-release-please-start-version -->
### Latest release: 0.1.14
<!-- x-release-please-end -->

| Release | Skill standard | Install |
| --- | --- | --- |
| [![Release](https://github.com/linchpin/skills/actions/workflows/release-please.yml/badge.svg)](https://github.com/linchpin/skills/actions/workflows/release-please.yml) | [![Validate skills](https://github.com/linchpin/skills/actions/workflows/validate-skills.yml/badge.svg?event=pull_request)](https://github.com/linchpin/skills/actions/workflows/validate-skills.yml) | `npx @linchpinagency/skills --global` |

**Releases are automated.** Merge conventional commits to `main` → release-please maintains a
rolling **:gem: Automated Release** PR → merging it tags, writes `CHANGELOG.md`, and publishes
to npm via Trusted Publishing. Every PR runs the skill validator and a commit-convention
check. Details: [How releases work](#how-releases-work).

---

## Getting started

### What a skill actually is

A skill is a markdown file of instructions that your coding agent loads **when your request
matches its description**. It's how we make an agent behave like a Linchpin developer
instead of a generic one: it knows we run WordPress Studio, that PHPCS only applies where
`phpcs.xml.dist` exists, that release-please owns `CHANGELOG.md`, and that every commit
carries a ClickUp key.

Three things worth knowing up front:

- **You mostly don't invoke skills.** Ask for what you want — "this page is broken on
  mobile", "get this ready to commit" — and the agent loads the matching skill on its own.
- **Skills are loaded by the tool, not the model.** Claude, GPT, or anything else running
  inside Claude Code all read the same `.claude/skills` directory. Switching models changes
  nothing about which skills exist; switching *tools* does.
- **They are just files.** Nothing is hosted, nothing phones home. You can read every one of
  them in `skills/`.

### Install (2 minutes)

Install once, globally, and every project you open gets them:

```bash
npx @linchpinagency/skills --global
```

Verify:

```bash
npx @linchpinagency/skills --list
```

No GitHub access or npm login needed — it's a public package.

Then start a new session in your project and ask for something real — "what kind of project
is this?" should pull in `project-context` and get you a summary of the repo shape, local
environment, and host.

**Re-run the same command to update.** There's no upgrade command — the installer diffs each
skill's version against what you have, shows what would change, and asks before applying it.
A run with nothing to change exits immediately, so re-running costs nothing. Do it every few
weeks, or when someone announces a new skill.

Full flag reference: [Install options](#install-options).

### Your first day

The fastest way to understand the library is to run one loop end to end:

| You want to… | Ask for it naturally | Skill that fires |
| --- | --- | --- |
| Understand a repo you just cloned | "what am I working with here?" | `project-context` |
| Find out why something's broken | "the hero image 404s on mobile" | `investigate` |
| Test a site like a user, and fix what's found | "QA the checkout flow" | `web-qa` |
| File work for later | "create an issue for the broken footer link" | `task-tracking` |
| Check it's ready to commit | "is this ready to commit?" | `quality-gates` |
| Commit and open the PR properly | "commit this and open a PR" | `commit-and-release` + `task-tracking` |
| Handle a client support ticket | "the client says their contact form isn't sending" | `support-triage` |
| Add guardrails before touching prod | "careful mode — I'm on production" | `safety-hooks` |
| Get the newest version of these skills | "update the skills" | `skill-updates` |

The full list is in [Available skills](#available-skills) — 25 of them, each with a
`When to use` section that says exactly when it applies and which skill to use instead.

**When you want to be explicit**, name the skill: *"use the wp-audit skill on the homepage."*
Worth doing when a task straddles two skills, or when you want a specific procedure followed.

### Working in Conductor

Conductor runs each workspace in its own **git worktree** — a separate checkout of the repo.
A project-level install (`./.claude/skills/`) therefore exists only in the workspace where
you ran it, and disappears the moment you create a new one.

**So for Conductor, install globally** (`--global`). `~/.claude/skills/` is outside the
worktree, so every workspace picks it up automatically with no per-workspace setup.

Two other things to expect: interactive prompts can behave differently than in a terminal
session — if a skill seems to be waiting on you, just answer in the chat — and because
workspaces are independent checkouts, a skill that reports on git state is describing *that*
workspace only.

### Other tools and models

Claude Code is our primary. If you use something else, install into its directory too:

```bash
npx @linchpinagency/skills --global --agent all   # Claude Code, Copilot, Codex, Cursor
```

Skills are read by the **harness**, so Copilot running a Claude model still needs them in
Copilot's own folder. Everything here is plain markdown with no Claude-specific syntax.

Two deliberate exceptions, both additive — nothing is *removed* from what the other agents
read:

- **`safety-hooks`** uses Claude Code hooks to *enforce* confirmation on destructive
  commands, and degrades to documentation elsewhere. Its `compatibility:` field says so.
- **`when_to_use:`** is a Claude Code field that appends extra trigger phrasings to a skill's
  `description`. Every skill's `description` still stands on its own and carries its own
  triggers — the validator enforces that — so the other three agents lose nothing; Claude
  Code just gets a wider net.

`allowed-tools:` is in the Agent Skills spec, so it works everywhere. It **pre-approves** a
skill's own read-only commands so a procedure doesn't stop for a permission prompt halfway
through; it never restricts anything, and it never weakens hooks — a `PreToolUse` hook still
fires on a pre-approved call and can still block it. Commands that *write* are deliberately
left to prompt.

### When a skill is wrong

These encode how we work, so they go stale when how we work changes. If a skill tells the
agent something outdated, that's a bug worth fixing — open a PR, or an issue if you'd rather
someone else write it. [`write-a-linchpin-skill`](skills/write-a-linchpin-skill/SKILL.md) is
the standard, and `npm run validate` checks your work.

---

## Three tiers — and what belongs here

Knowledge about building WordPress lives at three altitudes. This repo owns **only the
middle one**:

| Tier | Where it lives | What it owns |
| --- | --- | --- |
| **Base layer** (upstream) | [`WordPress/agent-skills`](https://github.com/WordPress/agent-skills) and [`linchpin/docspress`](https://github.com/linchpin/docspress) (our fork of [`Automattic/docspress`](https://github.com/Automattic/docspress)), vendored + pinned via [`upstream.json`](upstream.json) | Generic "how WordPress works" — block.json, theme.json mechanics, the Interactivity API, performance, WP-CLI ops — plus generating docs from a source tree. |
| **Linchpin tooling** (**this repo**) | `skills/` | **Portable, cross-project** ways the agency works — operating Studio/Pressable, tying work to ClickUp. Things true on *every* Linchpin project. |
| **Project layer** (per-repo) | that project's own `AGENTS.md` / `CLAUDE.md` | One project's specific blocks, theme conventions, file paths, and quirks. |

> **Project-specific conventions do NOT go here.** A given site's block/theme conventions
> (e.g. linchpin.com's color slugs, spacing scale, custom blocks, pattern structure) belong
> in **that project's repo** — next to the code, in its `AGENTS.md`/`CLAUDE.md` — not in the
> shared library. The test for "does it belong in this repo?" is: *would it be true on a
> different client's WordPress project?* If not, it's project layer.

Each base-layer source is pinned to a commit SHA in [`upstream.json`](upstream.json)
(neither upstream publishes releases) and fetched at install time. Bump a `ref` there
deliberately and re-test; don't float it, or agent behavior changes silently. New
**generic** WordPress knowledge should be contributed **upstream**, not added here.

A source may set `path` to say where skills live inside its repo — `WordPress/agent-skills`
uses `skills/`, DocsPress keeps a copy in both `.agents/skills/` and `.claude/skills/` and
we vendor `.agents/` because upstream lets the other one fall behind. It defaults to
`skills`, and a value that would escape the fetched tarball is refused.

## Install options

Skills install via our own zero-dependency CLI, run straight from this repo with `npx`.
Run it from a project root:

```bash
# Install every skill into this project's Claude Code skills dir (./.claude/skills)
npx @linchpinagency/skills

# Install a specific skill
npx @linchpinagency/skills wp-studio-cli

# List what's available
npx @linchpinagency/skills --list

# Install for GitHub Copilot instead (-> ./.agents/skills + ./.github/skills)
npx @linchpinagency/skills --agent github-copilot

# Install into every agent's directory at once (Claude Code, Copilot, Codex, Cursor)
npx @linchpinagency/skills --agent all

# Install to your user-global dir (-> ~/.claude/skills) instead of the project
npx @linchpinagency/skills --global

# Install the Linchpin skills only, without the upstream base layer
npx @linchpinagency/skills --skip-upstream

# Audit every scope for duplicate installs; install nothing
npx @linchpinagency/skills --check
```

> Pin a version when you need reproducibility — `npx @linchpinagency/skills@0.1.1` — or omit
> it to take the latest. Versions come from release-please, so they line up with the git tags
> and GitHub Releases.

> By default the installer also vendors the pinned upstream base layer (see
> [Three tiers](#three-tiers--and-what-belongs-here)) into the same directory. It needs
> network access and a system `tar`; if either is missing it warns and still installs the
> Linchpin skills. Pass `--skip-upstream` to install the Linchpin skills alone.

**Updating:** re-run the same command — that *is* the update path. Rather than overwriting
silently, the installer compares each skill's own `version` against what is installed,
prints the diff, and asks before touching anything:

```
@linchpinagency/skills v0.2.0 — Claude Code

  task-tracking        v1.3.0 -> v1.4.0   update
  agent-capabilities            -> v1.0.0   new
  quality-gates        v1.0.0             local edits will be lost
  (20 unchanged)

3 change(s): 1 update, 1 new, 1 modified

Apply? [y/N]
```

A run with nothing to change says so and exits without prompting, so re-running is cheap
and safe. `--dry-run` shows the diff and writes nothing; `--yes` skips the prompt;
`--force` reinstalls everything regardless.

> A **non-interactive** run — piped stdin, CI, a script — proceeds without prompting, so
> existing automation keeps working. Use `--dry-run` when you want a preview rather than an
> install.

Three statuses are worth knowing:

- **local edits will be lost** — the installed copy was hand-edited. Skills are owned by
  this package; change them here and re-install rather than editing an install in place.
- **DOWNGRADE** — the package you invoked is *older* than what is installed. Usually a
  pinned `npx @linchpinagency/skills@0.1.1` you meant to drop.
- **new** — the skill did not exist in your installed version.

### Keeping skills current

Installed skills are a snapshot — nothing about a copy in `.claude/skills/` knows a newer
release exists, and a stale copy doesn't look wrong. It just quietly gives last month's
answer. So every install writes a stamp beside the skills, in
`<skills-dir>/.linchpin-skills/`: `version.json` (the version, the date, the agent, the exact
command that produced the install, what it installed, and what it pruned), a self-contained
copy of the update checker, and `CHANGELOG.md` so "what changed?" is answerable later.

**The one thing worth doing per project**, so nobody has to remember any of this:

```bash
npx @linchpinagency/skills --with-hook
```

That installs, then merges a `SessionStart` hook into `.claude/settings.json` — idempotently,
leaving any hooks and permissions already there alone. At project scope that file is
committable, which is the point: one person adds it and everyone who clones the repo gets
told when their skills go stale. `SessionStart` stdout becomes session context, so the agent
sees the notice too, and asking it to **"update the skills"** runs the
[`skill-updates`](skills/skill-updates/SKILL.md) skill: find every install, apply the command
each one recorded, verify, and summarize what changed.

Hooks are a Claude Code feature. Under Copilot, Codex, or Cursor the same check works, just
when you ask for it.

```bash
# Is this install behind? One line if yes, nothing if no.
node .claude/skills/.linchpin-skills/update-check.mjs

# Every install this machine has, across agents and scopes, with each one's update command
node .claude/skills/.linchpin-skills/update-check.mjs --scan

# Preferences, so an agent never has to hand-edit config
node .claude/skills/.linchpin-skills/update-check.mjs --enable-auto   # apply without asking
node .claude/skills/.linchpin-skills/update-check.mjs --snooze        # 24h, then 48h, then a week
node .claude/skills/.linchpin-skills/update-check.mjs --disable       # stop checking
```

`--scan` exists because **most machines have more than one install** — a global copy plus a
project copy, or Copilot's two directories. Updating only the one that printed the notice is
how a stale skill survives an "update".

The check is deliberately unobtrusive: it queries the npm registry at most once a day (a
known-newer version keeps surfacing from cache in between), stays silent when it can't reach
the network, honors a snooze, and always exits 0 — a session never fails to start because of
it. It reports; it never installs anything. `LINCHPIN_SKILLS_UPDATE_CHECK=0` switches it off,
and it skips itself whenever `CI` is set. Preferences live in
`${XDG_CONFIG_HOME:-~/.config}/linchpin-skills/config.json`.

**Retired skills get removed.** A full re-run also deletes skills the package no longer ships
— dropped from it, listed in [`retired.json`](retired.json), or curated out of
`upstream.json` — so a deleted skill stops loading instead of lingering forever. It only ever
touches directories the installer has stamped, and never during a partial run that names
specific skills (there, everything you didn't name would look like a removal). `--dry-run`
shows the whole plan, removals included, and writes nothing.

### Where skills land

| Agent (`--agent`) | Project scope | Global scope (`--global`) |
| --- | --- | --- |
| `claude-code` (default) | `./.claude/skills/` | `~/.claude/skills/` |
| `github-copilot` | `./.agents/skills/` + `./.github/skills/` | `~/.copilot/skills/` |
| `codex` | `./.codex/skills/` | `~/.codex/skills/` |
| `cursor` | `./.cursor/skills/` | `~/.cursor/skills/` |
| `all` | every directory above | every directory above |

A project that wants skills in more than one agent's directory should run
`--agent all` rather than copying directories around by hand.

### One scope per skill

Agents load **every** skills directory they find and **do not dedupe by name**. A skill
installed both globally and in a project is listed twice, and its `description` is loaded
twice in every session before any work starts.

So the installer refuses to create the second copy:

```
Refusing to install: 22 of these skills are already installed at another scope.
```

It reports which directory, what would be duplicated, and the command to remove just the
overlapping skills — never the whole directory, which usually holds skills from other
sources too. `--force` overrides it for the rare case where you want both.

```bash
npx @linchpinagency/skills --check                  # audit; exits 1 if duplicates exist
npx @linchpinagency/skills --check --agent codex    # a different agent's directories
```

`--check` also catches the accident that is easiest to miss: an install in a *parent* of the
repo (running the installer from `~/GitHub` rather than inside a checkout), which shadows
nothing and duplicates everything below it.

Choosing a scope, the MCP-server equivalent of the same problem, and how to record the
decision are covered by [`agent-capabilities`](skills/agent-capabilities/SKILL.md).

> Skills are loaded by the **agent/harness**, not the model — so "Copilot running Claude"
> still needs the skill installed in Copilot's own directory. The installer handles that.

## Available skills

### Linchpin tooling (this repo)

| Skill | Domain | What it does |
| --- | --- | --- |
| `wp-local-setup` | WordPress | Stand up the Linchpin baseline local environment — scaffold a new wp-content-shaped project repo (Composer plugins from wpackagist + packagist.linchpin.com) and/or wire a repo into a WordPress Studio site by symlinking it in as `wp-content`. |
| `wp-theme-baseline` | WordPress | Choose and stand up the baseline for a new theme — a child theme of a parent that owns behavior, a fresh block theme, or (last resort) a fork — with the token-coverage check that decides it and the precedents that close the recurring questions. |
| `wp-design-tokens` | WordPress | Make `theme.json` the source of truth for color, type, spacing, and shadow — the slug vocabulary, the theme.json-vs-SCSS precedence rules that make an edit appear to do nothing, and where the Linchpin brand values live. |
| `wp-studio-cli` | WordPress | Operate a local WordPress Studio site — the wordpress-studio MCP first (`wp_cli`, `validate_blocks`, `take_screenshot`), the `studio` CLI as fallback — including the PHP-WASM `ABSPATH` rule. |
| `wp-audit` | WordPress | Audit a site for performance, accessibility, and visible frontend quality against Core Web Vitals thresholds; prioritized findings with labeled evidence, and before/after re-measurement. |
| `wp-pressable` | WordPress | Operate a Pressable-hosted site (prod/staging) via the Pressable MCP or SSH+WP-CLI; safely diagnose and fix the "renders locally but not on prod" FSE bug where DB template overrides shadow deployed theme files. |
| `wordpress-blocks` | WordPress | Author and edit page/post content as valid Gutenberg block markup from a chat interface — pattern-first (reuse the site's synced/registered patterns before composing core blocks), with the grammar rules and the validate-before-insert contract. |
| `wp-block-conventions` | WordPress | Build custom blocks the Linchpin way — apiVersion 3 under `linchpin/`, dynamic `render.php` + Interactivity API `view.js`, parent/child block context, and the `wp-scripts` build/registration chain shared by `linchpin-blocks` and project functionality plugins. |
| `wp-implementation-choice` | WordPress | Decide what a request should become — theme work, content, a custom block, a functionality plugin, or an existing plugin — before any code is written. |
| `design-previews` | Design | Generate three genuinely different visual directions as self-contained HTML previews, screenshot them at desktop and mobile via the Chrome DevTools MCP (or Playwright), and get a pick before theme or block work starts. |
| `docspress-publish` | Workflow | Publish a repo's Markdown docs to `docs.linchpin.com` via DocsPress — the shared page tree, the pinned fork whose `managed-path` stops one repo trashing another's pages, the per-repo token, and the dry-run → draft → publish ladder. Wraps upstream `generate-docs-from-source`, which writes the content. |
| `github-repo-setup` | Workflow | Create a repo under the `linchpin` org and wire it for deployments — name-collision check, populated from a source repo the user is always asked to name, all changes on `issue/<task-key>`, then `<stage>-<slug>` environments and the `linchpin/actions` **v3** secrets and variables at the right scope, with the scaffold→project rename pass. |
| `project-context` | Workflow | Orient before acting — repo shape, local environment, host, ClickUp space, and release model, read from the project's own config rather than assumed. Referenced by other skills' Preflight. |
| `agent-capabilities` | Workflow | Right-size what a project loads — audit skill installs for cross-scope duplicates (`--check`), decide which MCP servers the repo actually needs, and scope them so every session stops paying for all of them. |
| `quality-gates` | Workflow | Run a project's own lint, PHPCS, PHPStan, and test gates before committing — detected from `composer.json`, `package.json`, `phpcs.xml.dist`, and `lint-staged`, never assumed. |
| `web-qa` | Workflow | QA like a real user and fix what you find — front end, wp-admin, and block editor, with severity, evidence, one atomic commit per fix, and a report-only mode. |
| `investigate` | Workflow | Root-cause a bug before changing anything — reproduce, read the real error, isolate the layer, explain the mechanism, with WordPress first checks. |
| `browser-automation` | Workflow | The browser ladder, owned once: Chrome DevTools MCP against real Chrome first, Playwright headless as fallback, plus auth handling and WordPress specifics. |
| `safety-hooks` | Workflow | Enforced guardrails — a `PreToolUse` hook that makes destructive commands (`wp db drop`, `search-replace` without `--dry-run`, force-push, `rm -rf`) require confirmation, plus an optional edit boundary. Claude Code only. |
| `engagement-types` | Project mgmt | Tell support, site maintenance, projects, product/plugin work, and pre-sales apart — each lives somewhere different in ClickUp and is planned and closed differently. |
| `support-triage` | Project mgmt | Run a client support request end to end — clarify the real need, reproduce, judge urgency and scope, fix in the right layer, verify, and close the loop with the requester. |
| `dependency-updates` | Workflow | Handle the dependency work Renovate can't automerge — majors, breaking changes, failing or conflicted bot PRs, security advisories, `@wordpress/*` package sets. |
| `skill-updates` | Workflow | Bring this library's installed skills current — find every install across agents and scopes with `--scan`, apply the command each one recorded, verify, and summarize what changed from the shipped changelog. |
| `commit-and-release` | Workflow | Write commit messages and PR titles that satisfy the repo's own commitlint rules, and stay out of release-please's way (it owns versions and `CHANGELOG.md`). Branch naming lives in `task-tracking`. |
| `task-tracking` | Workflow | Tie every unit of work to a ClickUp task (or explicit `NO-TASK`) with minimal friction via the ClickUp MCP — resolve/search a task, create one on request ("create an issue" means ClickUp, not GitHub), split work that spans sessions or PRs into parent + subtasks, name the branch, update the task when the work lands, and carry the task key in the commit scope. |
| `write-a-linchpin-skill` | Meta | The house standard for authoring skills in this library — placement test, tier model, required frontmatter, the section skeleton, and the four house rules. Enforced by `scripts/validate-skills.mjs`. |

_(More WordPress, React, Cloudflare Workers, marketing, and design skills to come.)_

### Base layer (vendored from upstream, pinned)

Fetched at install time at the SHAs pinned in [`upstream.json`](upstream.json). Curate the
set there.

| Source | Licence | Skills |
| --- | --- | --- |
| [`WordPress/agent-skills`](https://github.com/WordPress/agent-skills) | GPL-2.0-or-later | `wp-block-development`, `wp-block-themes`, `wp-interactivity-api`, `wp-performance`, `wp-wpcli-and-ops`, `wp-plugin-development`, `wp-rest-api` |
| [`linchpin/docspress`](https://github.com/linchpin/docspress) — our fork of [`Automattic/docspress`](https://github.com/Automattic/docspress) | GPL-3.0-or-later | `generate-docs-from-source` — wrapped by `docspress-publish`, which owns the `docs.linchpin.com` target. The fork adds the per-repo `.docspress/brief.md` contract that wrapper depends on |

## Adding a skill

**The standard lives in [`skills/write-a-linchpin-skill/`](skills/write-a-linchpin-skill/SKILL.md)** —
load that skill and follow it. It owns the placement test, the tier model (A: `SKILL.md`
only → B: `+ references/` → C: `+ scripts/`), required frontmatter, the section skeleton,
and the four house rules. It isn't restated here on purpose: one owner per concern.

**Start with the scaffolder** — it creates the directory from the house template, wires up
the tier you asked for, and adds a draft catalog row (the row the validator would otherwise
fail you for forgetting):

```bash
npm run new-skill -- wp-thing --tier b
```

It leaves placeholders on purpose, and the validator **rejects** them — a half-written skill
should never look valid. Fill in the `description` first; it's the whole retrieval surface.

The shape it produces:

```
skills/
  <name>/
    SKILL.md            # required — frontmatter: name, description, version, allowed-tools
    references/*.md     # Tier B — detail promoted out of SKILL.md
    scripts/*.mjs       # Tier C — only when determinism is genuinely needed
```

- Directory name = frontmatter `name`, and names are **globally unique once installed**.
  Prefix by domain — `wp-`, `react-`, `cf-`, `seo-`, `design-` — and leave cross-cutting
  workflow skills (`task-tracking`, `quality-gates`) un-prefixed.
- Every `SKILL.md` needs `## When to use`, `## Guardrails`, and `## Done`.
- `allowed-tools` grants the **read-only** commands the skill actually runs. Never bare
  `Bash` — the validator treats it as an error.

Then validate — CI runs both of these on every PR:

```bash
npm run validate                          # every skill
node scripts/validate-skills.mjs <name>   # just the one you touched
npm run version-gate                      # every skill you changed has a version bump
```

**Bump the `version` of any skill you change.** It's the only signal a consuming project
gets: the installer compares versions to decide what to offer as an update, so an edit
shipped on an unbumped version lands as "unchanged" and nobody re-reads it. CI enforces it.

> **Keep it portable.** Every skill here must be true on *any* Linchpin project of its kind
> — don't bake in one site's blocks, palette, or file paths. Project-specific conventions
> belong in that project's own `AGENTS.md`/`CLAUDE.md` (see
> [Three tiers](#three-tiers--and-what-belongs-here)).

## For maintainers — publishing

This repo is private; the npm package is **public**, so the whole team (and anyone else) can
`npx` it without credentials.

> **Public means public.** These skills describe how we run client work — engagement and
> support workflows, hosting and deploy specifics, our conventions. Keep client-identifying
> detail out of them: names, ClickUp ids, hostnames, credentials. That belongs in project
> repos regardless of publishing, and the portability rule in
> [`write-a-linchpin-skill`](skills/write-a-linchpin-skill/SKILL.md) already forbids it.

### How releases work

Releases follow the house convention — **release-please**, same as every other Linchpin repo:

1. Merge conventional commits to `main`. `release-please.yml` keeps a rolling
   **:gem: Automated Release** PR up to date, with the changelog it would write.
2. Merge that PR when you want to cut a release. It bumps `package.json`, writes
   `CHANGELOG.md`, tags `vX.Y.Z`, and publishes a GitHub Release.
3. That release flips `release_created`, which triggers the `publish` job:
   `npm run validate`, then `npm publish --access public`. No `--provenance` flag is
   needed — Trusted Publishing generates provenance automatically.

**Never hand-edit `package.json`'s version or `CHANGELOG.md`** — release-please owns both
(see [`commit-and-release`](skills/commit-and-release/SKILL.md)).

### One-time setup

Done: the package exists (published by hand to create it), and release-please is wired.
Remaining:

1. **Register Trusted Publishing.** On npmjs.com → the package → Settings → Trusted
   Publisher, add:
   - Repository: `linchpin/skills`
   - Workflow: `.github/workflows/release-please.yml`

   That's it — no stored secret, nothing to rotate, and provenance is automatic. The publish
   job runs npm 11.x explicitly, because OIDC auth needs npm ≥ 11.5.1 and older runner
   images would silently fall back to token auth.

Until that's registered the `publish` job fails rather than skipping, so a release never
looks published when it isn't. To fall back to a token instead, add an `NPM_TOKEN` automation
token to Actions secrets and restore the `NODE_AUTH_TOKEN` env line in the publish step.

Also worth knowing:

- **Installing without npm still works** — `npx -y github:linchpin/skills` runs straight from
  the repo, and `#v0.1.1` pins to a tag. Useful for testing an unreleased branch.
- **Scope migration.** If the `@linchpin` npm scope is ever acquired, prefer it and deprecate
  the old name with `npm deprecate @linchpinagency/skills "moved to @linchpin/skills"`.

The package would ship only `bin/`, `skills/`, `upstream.json`, and `README.md` (see `files`
in `package.json`).

## License & attribution

- **This repo (overlay + installer):** **GPL-2.0-or-later** — see [`LICENSE`](LICENSE).
  Chosen to match the WordPress ecosystem we work in, the upstream base layer this overlay
  builds on, and our own `@linchpinagency/worktree-utils`. Derivative distributions stay
  open, which is the point.
- **Base layer:** the upstream skills are **not stored in this repo** — the installer
  fetches them at the pinned SHA, onto the user's machine, at install time.
  - [`WordPress/agent-skills`](https://github.com/WordPress/agent-skills) —
    **GPL-2.0-or-later**, © WordPress Contributors. Credit to that project for the generic
    WordPress expertise our overlay builds on. (Upstream is v1 and AI-authored then
    human-reviewed — treat it as a strong baseline, which is exactly why house rules win on
    conflict.)
  - [`linchpin/docspress`](https://github.com/linchpin/docspress) —
    **GPL-3.0-or-later**, © Fatih Kadir Akin, **modified by Linchpin**. Our fork of
    [`Automattic/docspress`](https://github.com/Automattic/docspress); the modifications
    (a per-repo `.docspress/brief.md` contract and catalog-shaped repository support) are
    marked as such in that repository's history, as GPL-3 requires. Provides
    `generate-docs-from-source`, which
    [`docspress-publish`](skills/docspress-publish/SKILL.md) wraps rather than duplicates.
    Fetched to the user's machine, never redistributed by this package, so the two licences
    do not mix in anything we ship.

## Status

**Actively maintained** by [Linchpin](https://linchpin.com). Bugs and feature requests:
open a GitHub issue. Internally, work is tracked in ClickUp — see
[`task-tracking`](skills/task-tracking/SKILL.md).

[![Linchpin an award winning digital agency building immersive, high performing web experiences](https://assets.linchpin.com/github/linchpin-github-repo-banner.jpg)](https://linchpin.com)
