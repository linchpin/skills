---
title: task-tracking
---

Every unit of work is tied to a ClickUp task, whose key rides in the commit, or is explicitly marked `NO-TASK` — the user always chooses, and the goal is to make the right thing the easy thing. The platform is currently ClickUp, driven through the ClickUp MCP, with the ClickUp specifics kept in the tool calls so the workflow survives a platform change.

## When to reach for it

- Starting any unit of work, before cutting a branch.
- Anyone asking for an issue, task, ticket, bug, or backlog item to be created — in any wording.
- Scoping work that won't fit one sitting — multiple PRs, multiple sessions, or a long list of distinct action items.
- Opening a local TODO that should exist in the task system too.
- Preparing to commit and needing the scope key.
- Finishing work — the task needs its status and a pointer to the PR.

Things you might say that load it: "create an issue", "file a ticket", "log a bug", "make a task", "what's the task number" — or stopping mid-flight when the state needs handing over.

## Where it stops

> **Not this skill:** the commit message grammar and release behavior — [`commit-and-release`](commit-and-release.md). Running checks before you commit — [`quality-gates`](quality-gates.md). Which space and folder a task belongs in — [`engagement-types`](engagement-types.md).

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Resolve the task","content":"<p>Confirm a given reference, search the Space before asking, or ask the user to choose NO-TASK, create a task now, or paste a key. NO-TASK never blocks the work.</p>"},{"title":"Right-size the tracking","content":"<p>Decide whether one task is enough, or the work needs a parent task with a subtask per step, or should just stay a local plan — confirmed with the user once.</p>"},{"title":"Offer to create a task before committing","content":"<p>If the work is still NO-TASK and about to be committed, ask once whether to create a ClickUp task first.</p>"},{"title":"Create the task","content":"<p>Resolve the list from the project's pinned routing or a scoped picker, set the name and details, create it, then read the assigned key back — the create response often returns a null custom_id.</p>"},{"title":"Update the task when the work lands","content":"<p>Comment with the PR pointer, move the status to one read from the list's real options, and close subtasks before the parent.</p>"},{"title":"Hand off mid-flight","content":"<p>Post one comment covering done, in progress, open decisions, where, and the single next step, after committing or stashing so it points at something real.</p>"}]} /-->

## What it checks first

Before the first ClickUp call, it establishes three things, none of which blocks the work:

| Checks | Tells you |
| --- | --- |
| Are `clickup_*` tools present in this session? | Whether the ClickUp MCP is connected — if not, say so and work as NO-TASK |
| `.clickup.json` at the repo root, or a ClickUp section in `CLAUDE.md`/`AGENTS.md` | Whether the routing is already pinned |
| The git remote or repo name | Which Space the work belongs to |

Orientation beyond ClickUp is [`project-context`](project-context.md), which defers back here for the Space.

## What it owns

Canonical for: resolving, creating, and updating the task; how work is split across tasks and subtasks; the scope key that goes in commits; branch naming; and the PR ↔ task link. Everything about the commit message other than the scope belongs to [`commit-and-release`](commit-and-release.md).

## Guardrails

- Never open a GitHub issue in place of a ClickUp task — "create an issue" means ClickUp unless GitHub is named.
- Never invent a task key, and never fall back to the internal id because the create call returned `custom_id: null` — read it back.
- Never assume the custom-ID prefix; it's Space-specific.
- Never claim a task exists that you didn't create.
- Never block the user waiting for a task decision — NO-TASK is always available.
- Never mark a task complete on your own judgment, and never guess a status name.
- Never create a duplicate task — search first.
- Never dump the full workspace hierarchy into a prompt; scope `space_ids` and `max_depth`.
- Don't log time unless asked.

## Done when

- [ ] Preflight ran: MCP availability, routing, and Space established, and any failure was said out loud.
- [ ] Any "create an issue/task/ticket" request produced a ClickUp task, or a GitHub issue only because the user named GitHub, cross-linked.
- [ ] The unit of work has a resolved task key or an explicit, user-accepted `NO-TASK`, read back from `custom_id`.
- [ ] Work spanning sessions, contexts, or PRs was split deliberately with the user, and every task or subtask carries a "done when".
- [ ] The branch matches the key, every commit carries the same scope, and the PR body links the task.
- [ ] For task-backed work: a comment with the PR link exists, and the status reflects reality.
- [ ] If work is pausing unfinished, a handoff comment exists and nothing is left uncommitted.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/task-tracking/SKILL.md) is the skill's main instructions.
- [`references/clickup-json.md`](https://github.com/linchpin/skills/blob/main/skills/task-tracking/references/clickup-json.md) — schema and worked example for `.clickup.json`, the per-project file that pins where a repo's tasks live.
- [`references/clickup-mcp-tools.md`](https://github.com/linchpin/skills/blob/main/skills/task-tracking/references/clickup-mcp-tools.md) — the ClickUp MCP tool call for each step of the workflow.
- [`references/handoff.md`](https://github.com/linchpin/skills/blob/main/skills/task-tracking/references/handoff.md) — template and rules for the session-handoff comment posted when work pauses unfinished.

Pre-approved, so the agent can run them without a prompt: reading and searching files, `git status`, `git branch --show-current`, and `git log`. Anything that writes to ClickUp or git still asks.

## Related skills

- [`commit-and-release`](commit-and-release.md) — owns the commit message grammar; this skill only supplies the scope.
- [`quality-gates`](quality-gates.md) — runs before you commit, ahead of updating the task.
- [`engagement-types`](engagement-types.md) — decides which space and folder a task belongs in.
- [`project-context`](project-context.md) — orientation beyond ClickUp, defers back here for the Space.
