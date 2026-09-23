---
title: Contributing a skill
sidebar_position: 5
---

A new skill is accepted when the validator passes and the skill earns its place in an agent's context. The validator handles the mechanical checks. The rest is judgment, and [`write-a-linchpin-skill`](skills/write-a-linchpin-skill.md) owns it. Load that skill when you write or review one.

## Does it belong here?

Ask one question: **would this be true on a different client's project of the same kind?**

| Answer | Where it goes |
| --- | --- |
| True everywhere, but generic to the technology | Upstream, in [`WordPress/agent-skills`](upstream.md) |
| True on every Linchpin project of this kind | This library, as `skills/<name>/` |
| True on one project | That project's own `CLAUDE.md` or `AGENTS.md` |

## Start from the scaffolder

<!-- wp:docspress/terminal-session {"title":"Scaffold a Tier B skill","shell":"bash","prompt":"$","command":"npm run new-skill -- wp-thing --tier b","output":""} /-->

The scaffolder creates the directory from the house template and adds a draft row to the README catalog. It leaves placeholders on purpose, and the validator rejects them, so a half-written skill never looks valid. Fill in the `description` first, since it is the only thing an agent reads before deciding whether to load the skill.

## Pick a tier

| Tier | Package | When |
| --- | --- | --- |
| A — Lean | `SKILL.md` only | The procedure fits in one legible file |
| B — Disclosed | Plus `references/*.md` | Command matrices, schemas or recipes would bloat `SKILL.md` |
| C — Executable | Plus `scripts/*.mjs` | A deterministic transform the agent would otherwise re-derive, and get wrong, every run |

Choosing C means naming the failure it prevents. If you can't name one, use B.

## Frontmatter

<!-- wp:docspress/fields {"title":"SKILL.md frontmatter","description":"Any other key is a validation error, because every runtime silently ignores keys it does not recognize.","fields":[{"name":"name","type":"string","required":true,"defaultValue":"","description":"Kebab-case, and must equal the directory name.","values":"","deprecated":false},{"name":"description","type":"string","required":true,"defaultValue":"","description":"80–1000 characters, and must say when to reach for the skill (\"Use when …\"). Over 700 warns. The only field Copilot, Codex and Cursor read, so it must stand alone.","values":"","deprecated":false},{"name":"version","type":"string","required":true,"defaultValue":"","description":"Semver. Bump it whenever you change the skill's package — it is how installs learn there is an update.","values":"","deprecated":false},{"name":"when_to_use","type":"string","required":false,"defaultValue":"","description":"Claude Code only. Extra trigger phrasings appended to description; the two together may not exceed 1,536 characters.","values":"","deprecated":false},{"name":"allowed-tools","type":"string","required":false,"defaultValue":"","description":"Pre-approves read-only commands the skill runs. Never grant a command that writes. A bare Bash grant is an error.","values":"","deprecated":false},{"name":"license","type":"string","required":false,"defaultValue":"","description":"When the skill is derived from licensed work.","values":"","deprecated":false},{"name":"compatibility","type":"string","required":false,"defaultValue":"","description":"When the skill genuinely cannot work on every agent.","values":"","deprecated":false},{"name":"metadata","type":"object","required":false,"defaultValue":"","description":"Your own bookkeeping.","values":"","deprecated":false}],"searchable":false,"compact":false} /-->

`triggers:` is a common trap. It appears in other libraries, but no runtime reads it, so phrases put there are never matched. They belong in `description`.

## Section skeleton

| Section | Required | Contents |
| --- | --- | --- |
| `# Title` and a 1–3 line purpose | Yes | What the skill buys the user |
| `## When to use` | Yes | Triggers, plus a bold **Not this skill:** line naming the sibling |
| `## Owns` | Warns if missing | What the skill is canonical for and what it defers |
| `## Preflight` | When it touches a project | What to read before acting |
| `## Procedure` | Recommended | Numbered steps, each ending in a checkable result |
| `## Guardrails` | Yes | What never to do, and the escape hatch when blocked |
| `## Done` | Yes | A checklist the agent can verify itself against |

These sections also produce the skill's page on this site. See [How skills work](how-skills-work.md#reading-a-skill-page).

## The four house rules

1. **Detect, don't assume.** Our repos differ. A skill reads the project's actual config before acting, and says so when a tool is missing.
2. **One owner per concern.** Every fact lives in one skill. Link to it; never restate it.
3. **Route work through ClickUp.** Resolve or create a task, or record `NO-TASK`. [`task-tracking`](skills/task-tracking.md) owns this.
4. **Guardrails are mandatory.** Name the destructive edges explicitly: production, databases, `--force`, and generated files.

## Validate

<!-- wp:docspress/code-tabs {"tabs":[{"label":"All skills","language":"bash","filename":"Terminal","code":"npm run validate"},{"label":"One skill","language":"bash","filename":"Terminal","code":"node scripts/validate-skills.mjs wp-thing"},{"label":"Strict","language":"bash","filename":"Terminal","code":"node scripts/validate-skills.mjs --strict"},{"label":"Version bump","language":"bash","filename":"Terminal","code":"npm run version-gate"}],"showLineNumbers":false,"caption":"CI runs the validator and the version gate on every pull request."} /-->

| Errors — the pull request fails | Warnings — it passes, `--strict` fails |
| --- | --- |
| Missing frontmatter, `name`, `description` or `version` | `description` over 700 characters |
| `name` doesn't match the directory | No `## Owns` section |
| `description` under 80 or over 1000 characters, or no "Use when" | Body over 200 lines with no `references/` |
| `description` plus `when_to_use` over 1,536 characters | No `# Title` heading |
| Unknown frontmatter key, a leftover placeholder, or a bare `Bash` grant | |
| Missing `## When to use`, `## Guardrails` or `## Done` | |
| A machine-specific absolute path, or a referenced file that doesn't exist | |
| No README catalog row, or a row for a skill that no longer exists | |

The 200-line warning is about undisclosed sprawl, not length. Clear it by moving templates and command matrices into `references/`, never by compressing prose.

<!-- wp:docspress/callout {"tone":"warning","title":"Bump the skill, not the package","content":"<p>Change a skill's frontmatter <code>version</code> whenever you change its files. Never edit the version in <code>package.json</code> or <code>CHANGELOG.md</code>: release-please owns both and publishes on merge.</p>","collapsible":false} /-->
