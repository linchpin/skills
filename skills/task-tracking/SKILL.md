---
name: task-tracking
description: Associate every unit of work with a task in Linchpin's task platform (currently ClickUp, via the ClickUp MCP) with the least friction, update it when the work lands, and leave a handoff when stopping mid-flight. Use whenever starting work, creating a TODO, scoping something that will span multiple sessions or PRs, preparing to commit, finishing a change, or pausing work someone else may pick up — and whenever anyone says "create an issue", "create a task", "file a ticket", or "log a bug", all of which mean a ClickUp task unless they name GitHub. If no task exists, confirm NO-TASK and keep working; the commit scope carries the task key (e.g. LINCHPIN-5113) or NO-TASK.
version: 1.4.0
---

# Task tracking (ClickUp)

**Goal: get work into the task system with the least friction, while never blocking the user
from working.** Every unit of work is either tied to a ClickUp task (its commits carry the
task key) or explicitly marked **NO-TASK**. The user always chooses; you make the right thing
the easy thing.

The platform is currently **ClickUp**, driven through the **ClickUp MCP** — keep the ClickUp
specifics in the tool calls, so the workflow below survives a platform change.

## When to use

- Starting any unit of work, before cutting a branch.
- **Anyone asking for an issue, task, ticket, bug, or backlog item to be created** — in any
  wording. See *"Create an issue" means ClickUp* below.
- **Scoping work that won't fit one sitting** — multiple PRs, multiple sessions, or a long
  list of distinct action items. See step 2.
- Opening a local TODO that should exist in the task system too.
- Preparing to commit and needing the scope key.
- Finishing work — the task needs its status and a pointer to the PR.

**Not this skill:** the commit message grammar and release behavior —
[`commit-and-release`](../commit-and-release/SKILL.md). Running checks before you commit —
[`quality-gates`](../quality-gates/SKILL.md). Which space and folder a task belongs in —
[`engagement-types`](../engagement-types/SKILL.md).

## Owns

Canonical for: resolving, creating, and updating the task; how work is split across tasks
and subtasks; the **scope key** that goes in commits; branch naming; and the PR ↔ task link.
Everything about the commit message *other than the scope* belongs to
[`commit-and-release`](../commit-and-release/SKILL.md).

## Preflight

Establish three things before the first ClickUp call. None of them blocks the work:

| Check | How | When it fails |
| --- | --- | --- |
| **Is the ClickUp MCP connected?** | Are `clickup_*` tools present in this session? | **Say so once, out loud** — "no ClickUp MCP in this session, so this is NO-TASK" — then work as NO-TASK |
| **Is the routing pinned?** | `.clickup.json` at the repo root, else a ClickUp section in `CLAUDE.md`/`AGENTS.md` | Fall back to the hierarchy lookup in step 4, then offer to write the file |
| **Which Space?** | Infer from the git remote or repo name (repo `linchpin.com` → Space **Linchpin**) | Widen to a scoped Space picker — never dump the whole hierarchy |

**A missing MCP is a reportable condition, not a silent skip.** A user can act on "I couldn't
reach ClickUp"; they can't act on commits that quietly say `NO-TASK`. Same for a pinned list
id that no longer resolves — say it and re-look-up rather than falling through to the default
list. Orientation beyond ClickUp is [`project-context`](../project-context/SKILL.md), which
defers back here for the Space.

## "Create an issue" means ClickUp

**"Issue", "task", "ticket", "bug", "backlog item" — all of them mean a ClickUp task here.**
Asked to create one, run the creation flow in step 4. Being in a GitHub repo, reviewing a PR,
or reading `gh` output does not make "create an issue" mean a GitHub issue. Which space,
folder, and (for multi-site clients) which site it lands in is
[`engagement-types`](../engagement-types/SKILL.md)'s call.

**A GitHub issue only when GitHub is named** — "open a *GitHub* issue", "`gh issue create`".
Use `gh issue create`; if it's work Linchpin will do, create the ClickUp task too and
cross-link them (issue body → `app.clickup.com/t/<KEY>`; `clickup_create_comment` → issue
URL). ClickUp stays the system of record. For the genuinely ambiguous — a public repo where
issues *are* the tracker — ask once with `AskUserQuestion`, recommending ClickUp.

## Vocabulary

- **Task key / issue key** — ClickUp's *custom ID*, e.g. `LINCHPIN-5113`. Space-scoped, so
  prefixes differ per space. This is what goes in commits — **not** the internal id
  (`86badg2te`), though `clickup_get_task` accepts either.
- **NO-TASK** — the sentinel used in the commit scope when work has no associated task.

## Workflow

### 1. Resolve the task (at the start of a unit of work)

Try these in order; stop at the first that succeeds:

1. **User gave a reference** (a custom ID like `LINCHPIN-5113`, an internal id, or an
   `app.clickup.com/t/...` URL) → `clickup_get_task` to confirm it exists. Capture its
   `custom_id`, `name`, and `status`. Done.
2. **No reference given → search before asking.** Derive keywords from the work and
   `clickup_search` (or `clickup_filter_tasks`), narrowed to the Space you established in
   Preflight so you don't trawl the whole workspace. Prefer open/active statuses. If there
   are plausible matches, present the top few and let the user pick or reject.
3. **Still nothing → ask, don't assume.** `AskUserQuestion` with three ways out: **work as
   NO-TASK** (recommended for quick/throwaway work), **create a task now** (the flow in step
   4), or paste a key they had in mind.

**Never block work.** NO-TASK is a first-class, always-available choice.

Record the resolved key (or `NO-TASK`) and reuse it for every commit in this unit of work.
When you open a local TODO with `TaskCreate`, put the key in the task text so the local list
and ClickUp stay aligned.

### 2. Right-size the tracking (before cutting the branch)

One task is the default and usually right. But when scoping reveals work that will

- **span more than one session**, or plausibly **exhaust this context window**, or
- need **more than one PR**, or
- carry **a large number of distinct action items**,

then one task can't hold the state, and a plan that lives only in the chat dies with the
session. Confirm the shape with the user — once, with `AskUserQuestion`:

| Shape | Use when | How |
| --- | --- | --- |
| **One task** | Multi-step, but one sitting and one PR | The default; nothing extra to do |
| **Parent + a subtask per step** | Steps land in separate commits or PRs, or someone else may pick one up | Create the parent, then each subtask via `clickup_create_task`'s `parent` |
| **Keep the plan local** | Exploratory work whose shape will change | `TaskCreate` only — revisit if it grows |

- **Every item carries its own "done when"** in its description. A subtask named "Fix the
  thing" with no acceptance line is a reminder, not a handoff.
- **The scope key is the parent's**, unless a subtask genuinely owns its own PR — then that
  subtask's key scopes those commits and the parent tracks the whole.
- **Splitting late is fine.** If one task turns out bigger than it looked, come back here.

### 3. Before committing, if NO-TASK — offer to create one

When the work is complete and you're about to commit a NO-TASK change, ask once (via
`AskUserQuestion`): **"Create a ClickUp task for this before committing?"** No → commit with
`NO-TASK`. Yes → run the creation flow, then commit with the new key. One prompt at commit
time; don't nag.

### 4. Creation flow (least friction)

Reached three ways: from step 2 (splitting a larger endeavor), from step 3 (a NO-TASK change
about to be committed), or directly, when someone just says *"create an issue/task for X"* —
a standalone request needing no commit or branch behind it.

`clickup_create_task` requires a `list_id` and `name`. Resolve the list with the cheapest
path that works:

1. **Use the routing you found in Preflight.** `.clickup.json` pins the Space, a default
   list, and often a source-directory → list map — confirm the destination in one line
   ("Create in *Mantle › Modules › Security*?") rather than making the user navigate.
2. **Otherwise build a scoped picker** from `clickup_get_workspace_hierarchy` — see
   [`references/clickup-json.md`](references/clickup-json.md) for both paths.
3. **Name + details:** default `name` to the commit subject / work summary and confirm.
   Optionally `assignees: ["me"]` (via `clickup_resolve_assignees`), a `priority`, and a
   `markdown_description` — which is where the "done when" line goes.
4. `clickup_create_task`, then **read the key back with `clickup_get_task`.** The create
   response carries `custom_id` inconsistently — often `null`, because the key is assigned
   after the task exists. `null` means "not yet", never "this space has no keys", so don't
   fall back to the internal id as your commit scope.

### 5. Update the task when the work lands

A task that never moves is worse than no task — it makes the board lie. Once the change is
committed and the PR is open, close the loop in ClickUp:

1. **Comment with the pointer.** `clickup_create_comment` with the PR URL and a one-line
   summary. This is what makes the task useful to whoever picks it up next — do it even if
   you can't move the status.
2. **Move the status, but read the valid ones first** (`expand_statuses: true`, or
   `clickup_get_list`). They're per-Space/List and there can be dozens. If none obviously
   matches the state ("PR open, awaiting review"), ask rather than guess.
3. **Don't close what you can't verify.** An open PR is *in review*, not done — terminal
   statuses need the user's word or a deploy you observed.
4. **Subtasks close as they land; the parent closes last.** Moving a parent while its
   subtasks are open is the same lie as never moving anything.
5. **Time tracking is opt-in** — `clickup_add_time_entry` only when asked.

For `NO-TASK` work there's nothing to update — skip this step silently.

### 6. Session handoff (when you stop mid-flight)

When work pauses unfinished, the state belongs on the task — not in a local file and not in
the chat. Post one `clickup_create_comment` covering **done / in progress / open decisions /
where (branch, PR, environment) / next step**, written for someone who wasn't here, and
commit or stash first so it points at something real.

Template and the rules that make it actionable: [`references/handoff.md`](references/handoff.md).

## Scope, branch & PR

**Scope = the task key or `NO-TASK`.** That is this skill's half of the commit message:

```
feat(LINCHPIN-5113): Add cloudflare email sending on launch
```

Everything else — allowed types, sentence case, punctuation limits, breaking changes, release
commits — is [`commit-and-release`](../commit-and-release/SKILL.md). One note about the *key*
rather than the grammar: a trailing PR number (`… (#758)`) is appended by the PR/release flow,
not by hand.

Work happens on a dedicated branch opened as a PR against the base branch (usually `main`) —
never commit straight to `main`.

- **Branch naming**, cut from an up-to-date `main`: **`issue/<custom_id>`** — the ClickUp
  custom ID verbatim (`issue/LINCHPIN-5113`), never the internal id and never a slug. Without
  a task, **`no-task/<short-kebab-slug>`**, since a bare `issue/no-task` would collide. Created
  a task after starting NO-TASK? `git branch -m issue/<custom_id>`.
- **The PR body links the ClickUp task** — paste `https://app.clickup.com/t/<custom_id>` and
  the key so GitHub ↔ ClickUp stay connected; for NO-TASK, note there's no task. The title
  follows the commit convention, whose grammar is `commit-and-release`'s.
- Keep every commit on the branch using the same scope.

## Reducing friction

- **Pin the routing per project in `.clickup.json`** — the Space, a default list, and (where
  the board mirrors the code) a directory → list map, so creation is a one-line confirm
  instead of navigation. Schema, worked example, and packaging notes:
  [`references/clickup-json.md`](references/clickup-json.md). The ids live in that project's
  repo, never in this shared library.
- **Write the file when you had to look it up.** Resolving a list the slow way is the moment
  to offer to pin it — otherwise the next agent pays the same cost.
- **Remember the last-used list** within a session and reuse it.
- **Batch the questions** — task-vs-NO-TASK, the split shape, and the list in as few
  `AskUserQuestion` prompts as possible.

Call signatures for every step: [`references/clickup-mcp-tools.md`](references/clickup-mcp-tools.md).

## Guardrails

- **Never open a GitHub issue in place of a ClickUp task.** "Create an issue" means ClickUp;
  `gh issue create` needs the user to have said *GitHub*.
- **Never invent a task key**, and never fall back to the internal id (`86badg2te`) because
  the create call returned `custom_id: null` — read it back. Unresolvable means `NO-TASK`.
- **Never assume the custom-ID prefix** — it's Space-specific; read it off the task rather
  than reaching for `LINCHPIN-` on non-Linchpin work.
- **Never claim a task exists that you didn't create.** A missing MCP or a failed call gets
  said out loud, not treated as though the board was updated.
- **Never block the user** waiting for a task decision. NO-TASK is always available and is
  not a failure state; offer creation, accept "no", move on.
- **Never mark a task complete** on your own judgment, and **never guess a status name** —
  they're Space-specific. An open PR is at most "in review".
- **Never create a duplicate task** — search first; an open one usually exists.
- **Never dump the full workspace hierarchy** into a prompt; scope `space_ids` and
  `max_depth`.
- Don't log time unless asked.

## Done

- [ ] Preflight ran: MCP availability, routing, and Space established — and any failure was
      **said out loud** rather than silently downgraded.
- [ ] Any "create an issue/task/ticket" request produced a **ClickUp** task — or a GitHub
      issue only because the user named GitHub, in which case the two are cross-linked.
- [ ] The unit of work has a resolved task key or an explicit, user-accepted `NO-TASK`, read
      back from `custom_id` rather than taken from an internal id.
- [ ] Work spanning sessions, contexts, or PRs was split deliberately with the user, and
      every task or subtask carries a "done when".
- [ ] The branch matches the key (`issue/<custom_id>` or `no-task/<slug>`), every commit on it
      carries the same scope, and the PR body links `app.clickup.com/t/<custom_id>`.
- [ ] For task-backed work: a comment with the PR link exists, and the status reflects
      reality without over-claiming completion.
- [ ] If work is pausing unfinished, a handoff comment exists that a teammate could act on
      cold, and nothing is left uncommitted.
