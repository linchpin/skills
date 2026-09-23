---
title: How skills work
sidebar_position: 2
---

What happens between you asking for something and a skill shaping the answer, and how to read a skill's page on this site.

## From request to skill

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"The harness lists every skill","content":"<p>At session start, the agent sees each installed skill's <code>name</code> and <code>description</code>, and nothing else. In Claude Code, <code>when_to_use</code> is appended to the description.</p>"},{"title":"Your request is matched","content":"<p>When what you ask for matches a description, the agent loads that skill. You rarely need to name it, but you can (\"use the wp-audit skill\") when a task straddles two skills.</p>"},{"title":"The body loads","content":"<p>The full <code>SKILL.md</code> is read into context: when it applies, what it checks first, its procedure, its guardrails and its done checklist.</p>"},{"title":"References load on demand","content":"<p>Files under <code>references/</code> are opened only when a step needs them, so a long command matrix costs nothing until it is used.</p>"},{"title":"Commands run","content":"<p>Commands listed in the skill's <code>allowed-tools</code> run without a permission prompt. Anything else, including every command that writes, still asks.</p>"}]} /-->

Three consequences follow:

- **A thin description means the skill never loads.** Nothing reports an error; you just get a generic answer. That's why the validator sets a minimum and maximum length for `description` and requires it to say when to use the skill.
- **`allowed-tools` pre-approves; it doesn't restrict.** Every tool stays available. The list only removes prompts for the read-only commands a skill runs constantly, and hooks such as [`safety-hooks`](skills/safety-hooks.md) still fire on a pre-approved call.
- **Skills are loaded by the harness, not the model.** Claude Code, Copilot, Codex and Cursor each read their own directory. Switching models changes nothing; switching tools means installing into that tool's directory too. See [Installation](installation.md#choose-an-agent).

## What a skill is made of

<!-- wp:docspress/file-tree {"root":"skills/","tree":"investigate/\n  SKILL.md\ntask-tracking/\n  SKILL.md\n  references/\n    clickup-json.md\n    clickup-mcp-tools.md\n    handoff.md","caption":"A Tier A skill (SKILL.md only) beside a Tier B skill with references."} /-->

Every skill is a directory with a `SKILL.md`. Its frontmatter decides when it loads. Its body follows a fixed skeleton, so any agent knows where to look:

| Section | What it tells the agent |
| --- | --- |
| `## When to use` | The situations it applies to, and the sibling to use instead |
| `## Owns` | What it is the single source for, and what it defers |
| `## Preflight` or `## Procedure` | What to read before acting, then numbered steps that each end in a checkable result |
| `## Guardrails` | What never to do, and what to do when blocked |
| `## Done` | A checklist the agent verifies itself against |

## Three tiers of knowledge

| Tier | Where it lives | What it owns |
| --- | --- | --- |
| Base layer | Vendored from upstream, pinned in `upstream.json` | Generic WordPress practice. See [Base layer](upstream.md) |
| Linchpin | This library | How the agency works, true on every Linchpin project |
| Project | That repo's own `CLAUDE.md` or `AGENTS.md` | One site's blocks, palette, paths and quirks |

Where a Linchpin skill conflicts with the base layer, the Linchpin skill wins. Anything true on only one project belongs in that project's repo, not here.

## Reading a skill page

Each page under [Skills](skills/index.md) is generated from the skill's own files, in the same order every time:

| Section on the page | Comes from |
| --- | --- |
| When to reach for it | `## When to use` and `when_to_use` |
| Where it stops | The **Not this skill:** line |
| How it works | `## Preflight`, `## Procedure`, or the skill's own stages, summarized |
| What it checks first | What the skill reads before acting |
| What it owns | `## Owns` |
| Guardrails | `## Guardrails`, with destructive edges called out |
| Done when | `## Done` |
| Files | `SKILL.md`, `references/`, `scripts/` and `allowed-tools` |
| Related skills | Every other skill it names |

The page summarizes the skill; the `SKILL.md` is the authority. When they disagree, the skill is right and the page is stale.
