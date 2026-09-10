---
name: write-a-linchpin-skill
description: Author or review a skill in the Linchpin skills library (github.com/linchpin/skills) so it matches the house standard — right-sized tier, required frontmatter, the fixed section skeleton, and the four house rules. Use when adding a new skill, reviewing a skill PR, migrating an existing skill to the standard, or deciding whether something belongs in this library at all versus a project's own CLAUDE.md.
version: 1.1.0
allowed-tools: Read Grep Glob Bash(node scripts/validate-skills.mjs*) Bash(npm run validate)
---

# Write a Linchpin skill

A skill buys **predictability**: the same *process* every run, from any agent, on any
Linchpin project. It is not a prompt snippet and not documentation — it is the instruction
set an agent follows when it has no other context.

Two things make a skill good here: it **fires at the right moment** (the `description` is
the only thing an agent reads before deciding), and it **matches the project it lands in**
(our repos differ, so skills detect rather than assume).

## When to use

- Adding a new skill to `skills/`.
- Reviewing a skill PR, or migrating an older skill to this standard.
- Deciding *where* knowledge belongs — this library, upstream, or a project repo.

**Not this skill:** writing a project's own `CLAUDE.md`/`AGENTS.md` conventions. Those are
project layer — see the placement test below.

## Owns

This skill is canonical for: the tier model, required frontmatter, the section skeleton,
the four house rules, naming, and the ship checklist. Other skills should **link here**
rather than restate any of it.

## Step 1 — Does it belong here at all?

Three tiers of knowledge, one question:

> **Would this be true on a different client's project of the same kind?**

| Answer | Where it goes |
| --- | --- |
| True everywhere, but generic to the technology | **Upstream** (`WordPress/agent-skills`) — contribute it there, don't fork it here |
| True on every *Linchpin* project of this kind | **This repo** — `skills/<name>/` |
| True on one project | That project's `CLAUDE.md` / `AGENTS.md` |

A skill that names one client's colors, block slugs, list IDs, or file paths has failed
this test. Parameterize it (read the value at runtime) or move it to the project.

## Step 2 — Right-size the package (tier)

**Do not default to Tier C.** Files are a cost — every extra file is another thing that
goes stale. Earn them.

| Tier | Package | When |
| --- | --- | --- |
| **A — Lean** | `SKILL.md` only | Procedure fits in one legible file; judgment work; no fragile detail |
| **B — Disclosed** | `+ references/*.md` | Long command matrices, schemas, per-tool detail, recipes — anything that would bloat `SKILL.md` past readability |
| **C — Executable** | `+ scripts/*.mjs` (and fixtures) | A deterministic transform or validation the agent otherwise re-derives (and gets wrong) every run |

**Over-engineering check:** choosing C means naming the failure it prevents ("agents
hand-roll this parse and drift"). If you can't name one, drop to B.

Most skills here are **A or B**. `wordpress-blocks` is the reference B (recipes and grammar
live in `references/`); this library's own `scripts/validate-skills.mjs` is the C pattern.

**What the validator checks:** a body over **200 lines with no `references/` at all** warns —
that combination is Tier B content held in Tier A. Length alone is never the fault;
`wordpress-blocks` runs 877 lines across its package and passes, because the
reference-shaped parts were promoted. **Don't compress prose to clear this warning** —
promote the templates, command matrices, and schemas. That's the only fix that improves the
skill rather than just the number.

## Step 3 — Write `SKILL.md`

### Frontmatter

```yaml
---
name: wp-quality-gates          # required; kebab-case; MUST equal the directory name
description: <capability>. Use when <trigger>, <trigger>, <trigger>.   # required
when_to_use: <extra phrasings that wouldn't fit in description>        # optional
version: 1.0.0                  # required here; semver, bump when behavior changes
allowed-tools: Read Grep Glob Bash(composer run lint)                  # optional
---
```

Only these five, plus `license` and `compatibility` where they genuinely apply. The
validator rejects anything else, because **every runtime silently drops frontmatter keys it
doesn't recognize** — an unrecognized key isn't a warning, it's a no-op that reads like
configuration. `triggers:` is the trap worth naming: it appears in other libraries, no
runtime reads it, and putting trigger phrases there instead of in `description` means they
are never matched against.

| Key | Read by | Notes |
| --- | --- | --- |
| `name`, `description` | every agent | The only two the Agent Skills spec requires. |
| `allowed-tools` | every agent (in the spec) | A **pre-approval**, not a restriction — see below. |
| `license`, `compatibility` | every agent (in the spec) | Use when a skill is derived from licensed work, or genuinely can't work everywhere. |
| `when_to_use` | **Claude Code only** | Appended to `description`; 1,536 chars for the two combined. |
| `version` | nobody | Ours, not the harness's. The spec's home for it is `metadata.version`; top-level is a tolerated convenience, and our release tooling reads it there. |

**`when_to_use` is additive, never a relocation.** `description` must still stand alone and
pass every check by itself — it is the only field Copilot, Codex, and Cursor read. Moving
trigger phrases out of it to tidy it up makes the skill *less* findable on three of the four
agents we support. Use `when_to_use` for the overflow: the extra phrasings a user might say
that wouldn't fit. The validator enforces this, so it can't decay by accident.

### `allowed-tools` — grant the reads, never the writes

`allowed-tools` **pre-approves** tools so a skill's own commands don't stop for a permission
prompt mid-procedure. It does **not** restrict anything: every tool stays callable, so a
missing entry costs one prompt and nothing else.

That asymmetry is the whole policy. **Under-granting is free; over-granting silently
pre-approves.** So:

- **Grant the read-only commands** a skill actually runs — the inspection it does constantly.
  `Bash(git status*)`, `Bash(composer run phpcs*)`, `Bash(gh pr view*)`.
- **Never grant a command that writes**, even when the skill runs it: `composer run phpcbf`
  rewrites files, `git branch -m` renames, `gh repo create` creates, `npm audit fix` is not
  `npm audit`. Those *should* stop and ask. Pin them with an exact pattern when the wildcard
  would catch the mutating sibling — `Bash(npm audit)` grants the audit, not `audit fix`.
- **Never bare `Bash`.** It pre-approves every shell command the turn can reach. The
  validator treats it as an error.
- **Only grant commands the skill names.** A grant for something the file never runs is a
  standing pre-approval nobody reviewed.
- **Don't chase MCP tool names.** Server prefixes differ per install — the same machine can
  expose `mcp__clickup__*` and `mcp__claude_ai_ClickUp__*` — so a grant that looks right is
  install-specific. Let them prompt.

`Read Grep Glob` don't prompt in the first place, so listing them buys nothing mechanically.
They're worth stating anyway on a judgment-only skill: it's the frontmatter saying *this
skill only reads*, which is exactly the claim a reviewer wants to check.

**Grants do not weaken hooks.** A `PreToolUse` hook still fires on a pre-approved call and
can still block it — verified against Claude Code 2.1.267, with a control proving the grant
was live. So [`safety-hooks`](../safety-hooks/SKILL.md) keeps its teeth regardless of what
any skill grants.

**The `description` is the whole retrieval surface.** An agent sees only this before
deciding whether to open the skill; a thin description means the skill silently never
loads and the user gets a generic answer with no error.

- Lead with the **capability**, then `Use when …` with **two or more distinct triggers**.
- Write the **user's** words, not yours. Ask: *would someone who didn't write this skill
  say it differently?* ("deps are out of date", "renovate PR is failing", "bump packages").
- End with the boundary when it collides with a sibling ("Not for … — use `<skill>`").
- Aim 200–600 characters. Under ~80 it won't match; over ~1000 it's a body, not a trigger.

### Section skeleton (in this order)

| Section | Required | Contents |
| --- | --- | --- |
| `# Title` + 1–3 line purpose | ✓ | What this buys the user, in plain terms |
| `## When to use` | ✓ | Triggers, plus a bold **Not this skill:** boundary naming the sibling |
| `## Owns` | recommended | What this skill is canonical for; what it defers to another skill |
| `## Preflight` | when it touches a project | The detection step — what to read before acting |
| `## Procedure` / workflow | recommended | Numbered steps, each ending in a **checkable** result |
| `## Guardrails` | ✓ | What to never do, and the escape hatch when blocked |
| `## Done` | ✓ | Checklist the agent can self-verify against |

Copy `references/template.md` to start. Extra sections are fine (`## Gotchas`,
`## Quick reference` — both earn their place); these are the anchors that must exist so any
agent knows where to look.

## The four house rules

**1. Detect, don't assume.** Our repos are not uniform: `mantle` runs wp-env *and* LocalWP,
`linchpin.com` runs wp-env, other projects run Studio; commitlint's allowed types differ per
repo; PHPCS exists only where `phpcs.xml.dist` does. Any skill that touches a project reads
its actual config first — `.linchpin.json`, `composer.json` scripts, `package.json` scripts,
the presence of a config file — and says so out loud when a tool is missing instead of
silently skipping the step.

**2. One owner per concern.** Every fact lives in exactly one skill. Link, never restate —
duplicated instructions drift apart and then contradict each other. Declare ownership in
`## Owns` and defer explicitly ("commit message format → `commit-and-release`").

**3. Every unit of work routes through ClickUp.** Resolve the task, or create one, or record
`NO-TASK`; update the task when the work lands. `task-tracking` owns that workflow — skills
that end in a commit, PR, or deploy hand off to it rather than reimplementing it.

**4. Guardrails are mandatory, not decorative.** Name the destructive edges explicitly:
production, databases, `--no-verify`, `--force`, generated files (`CHANGELOG.md`, lockfiles,
`vendor/`). An agent that doesn't know the edge will find it.

## Step 4 — Name it

Directory names are **globally unique once installed**, so prefix by domain:

| Prefix | Domain |
| --- | --- |
| `wp-` | WordPress — themes, blocks, WP-CLI, Studio, Pressable, plugins |
| `react-` | React / frontend |
| `cf-` | Cloudflare Workers / edge |
| `seo-`, `design-` | Marketing and design workflows |
| *(none)* | Cross-cutting workflow, true regardless of stack — `task-tracking`, `quality-gates`, `commit-and-release` |

A skill that *detects* the stack is cross-cutting, not stack-specific: `quality-gates` runs
PHPCS on WordPress repos and ESLint on Workers repos, so it takes no prefix.

Before naming, grep sibling `description:` lines for **trigger collision** — two skills
that fire on the same phrase means neither is reliable. Split by intent or merge them.

## Step 5 — Ship

```bash
node scripts/validate-skills.mjs              # all skills; CI runs this on every PR
node scripts/validate-skills.mjs <name> …     # just the ones you touched
```

Checklist:

1. `node scripts/validate-skills.mjs` passes.
2. The **Available skills** table in `README.md` has a row for the skill.
3. `version` bumped if you changed an existing skill's behavior.
4. Committed per `commit-and-release`, with the task key from `task-tracking` in the scope.

**Publishing is automated — never run `npm version` or `npm publish`.** release-please keeps
a rolling release PR from the conventional commits on `main`; merging it bumps
`package.json`, writes `CHANGELOG.md`, tags, and triggers the publish job. The version you
bump by hand is the **skill's** `version` in frontmatter, never the package's. See
[`commit-and-release`](../commit-and-release/SKILL.md).

## Failure modes

Diagnose before adding files; most fixes are edits, not new artifacts.

| Symptom | Cause | Fix |
| --- | --- | --- |
| Skill never loads | Thin or mismatched `description` | Add real user phrasing; grep siblings for collision |
| Agent stops halfway | Steps have no checkable end state | Make each step end in an observable result |
| Agent invents a path/command | Missing `## Preflight` | Add the detection step and a "tool missing" branch |
| Two skills disagree | Duplicated instruction | Delete one; link to the owner |
| Works on one repo only | Baked-in project specifics | Parameterize, or move it to that project |
| `SKILL.md` unreadable | Sprawl | Promote detail to `references/` (Tier B) |
| Fixes the same rule every run | Deterministic work done by prose | Extract to `scripts/*.mjs` (Tier C) |

## Guardrails

- **Never** put client-specific values (domains, list IDs, color slugs, absolute paths like
  `/Users/…`) in a skill — that's the project layer, and the validator rejects host paths.
- **Never** duplicate upstream `WordPress/agent-skills` content here; contribute it upstream
  and reference it. House rules win only where we deliberately differ — say so explicitly.
- **Never** hand-edit skills in a consuming project's `.claude/skills/` — the installer
  overwrites them. Change them here and re-run the installer.
- Don't bump `upstream.json`'s pinned `ref` as a side effect of unrelated work; it changes
  agent behavior silently and needs its own re-test.

## Done

- [ ] Placement test answered — it's true on any Linchpin project of this kind.
- [ ] Tier chosen deliberately; Tier C justified by a named failure mode.
- [ ] Frontmatter: `name` matches the directory, `description` leads with capability + ≥2
      triggers, `version` set.
- [ ] `## When to use` (with a boundary), `## Guardrails`, and `## Done` all present.
- [ ] Detection step exists for anything that touches a project.
- [ ] No duplicated instructions — ownership declared, siblings linked.
- [ ] `node scripts/validate-skills.mjs` passes and `README.md` lists the skill.
