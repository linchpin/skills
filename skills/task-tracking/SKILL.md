---
name: task-tracking
description: Associate every unit of work with a task in Linchpin's task platform (currently ClickUp, via the ClickUp MCP) with the least friction, update it when the work lands, and leave a handoff when stopping mid-flight. Use whenever starting work, creating a TODO, preparing to commit, finishing a change, or pausing work someone else may pick up — and whenever anyone says "create an issue", "create a task", "file a ticket", or "log a bug", all of which mean a ClickUp task unless they name GitHub. Resolve a task from an ID/custom-ID/URL or by searching; if none exists, confirm NO-TASK and keep working. The conventional-commit scope carries the task key (e.g. LINCHPIN-5113) or NO-TASK.
version: 1.3.0
---

# Task tracking (ClickUp)

**Goal: get work into the task system with the least friction, while never blocking the
user from working.** Every unit of work is either tied to a ClickUp task (its commits carry
the task key) or explicitly marked **NO-TASK**. The user always chooses; you make the
right thing the easy thing.

The platform is currently **ClickUp**, driven through the **ClickUp MCP**. Keep ClickUp
specifics in the tool calls; the workflow below is what matters and would survive a
platform change.

## When to use

- Starting any unit of work, before cutting a branch.
- **Anyone asking for an issue, task, ticket, bug, or backlog item to be created** — in any
  wording. See *"Create an issue" means ClickUp* below.
- Opening a local TODO that should exist in the task system too.
- Preparing to commit and needing the scope key.
- Finishing work — the task needs its status and a pointer to the PR.

**Not this skill:** the commit message grammar and release rules —
[`commit-and-release`](../commit-and-release/SKILL.md). Running checks before you commit —
[`quality-gates`](../quality-gates/SKILL.md).

## Owns

Canonical for: resolving, creating, and updating the task; the **scope key** that goes in
commits; branch naming; and the PR ↔ task link. Everything about the commit message *other
than the scope* belongs to [`commit-and-release`](../commit-and-release/SKILL.md).

## "Create an issue" means ClickUp

**"Issue", "task", "ticket", "bug", "backlog item" — all of them mean a ClickUp task here.**
Asked to create one, run the creation flow in step 3. Being in a GitHub repo, reviewing a
PR, or reading `gh` output does not make "create an issue" mean a GitHub issue. Which space,
folder, and (for multi-site clients) which site it lands in is
[`engagement-types`](../engagement-types/SKILL.md)'s call.

**A GitHub issue only when GitHub is named** — "open a *GitHub* issue", "file it in the
repo's issues", "`gh issue create`". Open it with `gh issue create`; if it's work Linchpin
will do, create the ClickUp task too and cross-link them (issue body →
`app.clickup.com/t/<KEY>`; `clickup_create_comment` → issue URL). ClickUp stays the system
of record. For the genuinely ambiguous — a public repo where issues *are* the tracker — ask
once with `AskUserQuestion`, recommending ClickUp.

## Vocabulary

- **Task key / issue key** — ClickUp's *custom ID*, e.g. `LINCHPIN-5113`. Space-scoped, so
  prefixes differ per space (`LINCHPIN-…`, etc.). This is what goes in commits. It is **not**
  the internal id (`86badg2te`) — though `clickup_get_task` accepts either.
- **NO-TASK** — the sentinel used in the commit scope when work has no associated task.

## Workflow

### 1. Resolve the task (at the start of a unit of work)

Try these in order; stop at the first that succeeds:

1. **User gave a reference** (a custom ID like `LINCHPIN-5113`, an internal id, or an
   `app.clickup.com/t/...` URL) → `clickup_get_task` to confirm it exists. Capture its
   `custom_id`, `name`, and `status`. Done.
2. **No reference given → search before asking.** Derive keywords from the work and
   `clickup_search` (or `clickup_filter_tasks`), narrowed to the relevant Space/List so you
   don't trawl all 36 spaces — infer the Space from the repo (e.g. repo `linchpin.com` →
   Space **Linchpin**). Prefer open/active statuses. If there are plausible matches, present
   the top few and let the user pick or reject.
3. **Still nothing → ask, don't assume.** Use `AskUserQuestion`:
   - **Work as NO-TASK** (recommended for quick/throwaway work) — proceed now, commits use
     `NO-TASK`.
   - **Create a task now** — run the creation flow below, then use the new key.
   - The user can also paste a key they had in mind.

**Never block work.** NO-TASK is a first-class, always-available choice.

Record the resolved key (or `NO-TASK`) for this unit of work and reuse it for every commit
in it. When you open a local TODO with `TaskCreate`, put the ClickUp key (or `NO-TASK`) in
the task text so the local list and ClickUp stay aligned. Then cut the working branch for
this change — see **Branch & PR**.

### 2. Before committing, if NO-TASK — offer to create one

When the work is complete and you're about to commit a NO-TASK change, ask once (via
`AskUserQuestion`): **"Create a ClickUp task for this before committing?"**

- **No** → commit with `NO-TASK`.
- **Yes** → run the creation flow, then commit with the new key.

Don't ask repeatedly and don't nag — one prompt at commit time.

### 3. Creation flow (least friction)

Reached two ways: from step 2 (a NO-TASK change about to be committed), or directly, when
someone just says *"create an issue/task for X"* — that's a standalone request and doesn't
need a commit or a branch behind it.

`clickup_create_task` requires a `list_id` and `name`. Resolve the list with the cheapest
path that works:

1. **Use a known default if the project has one.** If the project pins a default list
   (see *Reducing friction*), confirm it in one line ("Create in *Linchpin › linchpin.com ›
   Development*?") rather than making the user navigate.
2. **Otherwise present a picker** built from `clickup_get_workspace_hierarchy`:
   - Call it with `max_depth: 2` **scoped to the likely Space** (pass `space_ids`) so you
     return Folders + Lists for one space, not the whole workspace.
   - Offer the candidate Lists via `AskUserQuestion`. Example (Linchpin space):
     `linchpin.com › Development`, `linchpin.com › Deploy`, `Internal Projects › …`.
   - Only widen to a Space picker first if you can't infer the Space.
3. **Name + details:** default the task `name` to the commit subject / work summary; confirm
   or let the user tweak. Optionally set `assignees: ["me"]` (resolve via
   `clickup_resolve_assignees`), a `priority`, and a short `markdown_description`.
4. `clickup_create_task` → read back the new task's **`custom_id`** and use it as the commit
   scope.

### 4. Update the task when the work lands

A task that never moves is worse than no task — it makes the board lie. Once the change is
committed and the PR is open, close the loop in ClickUp:

1. **Comment with the pointer.** `clickup_create_comment` on the task with the PR URL and a
   one-line summary of what changed. This is the step that makes the task useful to whoever
   picks it up next — do it even if you can't move the status.
2. **Move the status** with `clickup_update_task` — but **read the valid statuses first**.
   They're per-Space/List (`in progress`, `review`, `qa`, `complete`, … all vary); take them
   from the task's own status metadata or `clickup_get_list`. If none obviously matches the
   state ("PR open, awaiting review"), ask rather than guess.
3. **Don't close what you can't verify.** Work in an open PR is *in review*, not done. Only
   move a task to a terminal status when the user says it's shipped, or when a deploy you
   can observe has completed.
4. **Time tracking is opt-in.** Only use `clickup_add_time_entry` (or the start/stop tools)
   when the user asked for it.

For `NO-TASK` work there's nothing to update — skip this step silently.

### 5. Session handoff (when you stop mid-flight)

When work pauses unfinished — end of day, a context switch, or handing off — the task is
where the state belongs. Not a local file, not the chat: the task is what a teammate opens.

Post one `clickup_create_comment` with these five things, and nothing else:

```markdown
**Handoff — <date>**
- **Done:** <what actually works now, and where it's committed or pushed>
- **In progress:** <what's half-built, and which files>
- **Open decisions:** <what needs an answer before continuing, and the options>
- **Where:** branch `<branch>`, PR <link or "none yet">, environment <local|staging|prod>
- **Next step:** <the single next action, concrete enough to start from cold>
```

Rules that keep this useful:

- **Write it for someone who wasn't here.** No "as discussed", no pronouns pointing at chat
  history.
- **Be honest about what's unfinished.** A handoff that overstates progress costs more than
  no handoff.
- **One handoff comment per pause**, not a running log — supersede the previous one by
  posting a fresh comment rather than editing history.
- Uncommitted work is not a handoff. Commit or stash it first and say which
  ([`commit-and-release`](../commit-and-release/SKILL.md)).

## Conventional commits

**Scope = the task key or `NO-TASK`.** That is this skill's half of the message:

```
feat(LINCHPIN-5113): Add cloudflare email sending on launch
chore(NO-TASK): Tidy editorconfig and ignore rules
```

Everything else about the message — allowed types (they differ per repo), sentence case,
punctuation limits, breaking changes — lives in
[`commit-and-release`](../commit-and-release/SKILL.md). Two notes that are about the *key*
rather than the grammar:

- A trailing PR number — `… (#758)` — is appended by the PR/release flow; you don't add it
  by hand.
- Reserve `chore(main): …` for release-please release commits — don't reuse `main` as a
  scope for normal work.

## Branch & PR

Work happens on a dedicated branch opened as a PR against the base branch (usually `main`)
— never commit straight to `main`.

- **Branch naming** (cut from an up-to-date `main`):
  - With a task: **`issue/<ISSUE-KEY>`** — the ClickUp custom ID, e.g. `issue/LINCHPIN-5113`.
  - NO-TASK: **`no-task/<short-kebab-slug>`** describing the change (a bare `issue/no-task`
    would collide across changes).
  - Started NO-TASK, then created a task before pushing? Rename the branch to match:
    `git branch -m issue/<ISSUE-KEY>`.
- **Pull request** (head = your branch, base = `main`):
  - Title follows the commit convention: `type(<ISSUE-KEY | NO-TASK>): subject`.
  - Body **links the ClickUp task** — paste `https://app.clickup.com/t/<ISSUE-KEY>` and the
    key so GitHub ↔ ClickUp stay connected. For NO-TASK, note there's no task.
  - Keep every commit on the branch using the same scope.

## Reducing friction

- **Pin a default list per project.** Record the project's usual Space/List (id + path) in
  the project's `CLAUDE.md` or a small `.clickup.json`, so creation becomes a one-line
  confirm instead of navigation — e.g. `<Space> › <Project> › Development` with its
  `list_id`. The id belongs in that project's repo, not in this shared library.
- **Remember the last-used list** within a session and reuse it.
- **Infer the Space from the repo** to scope every search and hierarchy call.
- **Batch the questions**: when you must ask, resolve task-vs-NO-TASK and (if creating) the
  list in as few `AskUserQuestion` prompts as possible.

## Gotchas

- **"Issue" is not a GitHub word here.** Route it to ClickUp unless GitHub was named.
- **Search before creating** — avoid duplicate tasks; an open task often already exists.
- **Don't dump the hierarchy.** 36 spaces is overwhelming; always scope `space_ids` and go
  only as deep as you need (`max_depth`).
- **Use `custom_id` in commits**, never the internal id (`86badg2te`).
- **Custom-ID prefixes are space-specific** — read the prefix off the task; don't assume
  `LINCHPIN-` for non-Linchpin work.
- **NO-TASK is not failure.** Offer task creation, accept "no", and move on.

## Quick reference

| Step | Tool |
| --- | --- |
| Confirm a given key/URL | `clickup_get_task` (accepts `LINCHPIN-5113` or `86badg2te`) |
| Find an existing task | `clickup_search` / `clickup_filter_tasks` (scope to the Space) |
| Build a Space/List picker | `clickup_get_workspace_hierarchy` (`space_ids`, `max_depth: 2`) |
| Resolve "me"/assignees | `clickup_resolve_assignees` |
| Create the task | `clickup_create_task` (`list_id` + `name` required) |
| Branch the work | `git switch -c issue/LINCHPIN-#### main` (or `no-task/<slug>`) |
| Commit | `type(LINCHPIN-#### | NO-TASK): subject` |
| Open the PR | `gh pr create` — title `type(KEY): …`, body links `app.clickup.com/t/<KEY>` |
| Comment on the task | `clickup_create_comment` (PR URL + one-line summary) |
| Move the status | `clickup_update_task` (valid statuses come from the List) |
| Hand off mid-flight | `clickup_create_comment` with the five-line handoff block |

## Guardrails

- **Never open a GitHub issue in place of a ClickUp task.** "Create an issue" means ClickUp;
  `gh issue create` needs the user to have said *GitHub*.
- **Never invent a task key.** If you can't resolve one, `NO-TASK` is the correct answer.
- **Never block the user** waiting for a task decision — NO-TASK is always available.
- **Never mark a task complete** on your own judgment. An open PR is at most "in review";
  terminal statuses need the user's word or an observed deploy.
- **Never guess a status name** — they're Space-specific. Read them, then set them.
- **Never create a duplicate task** — search first; an open one usually exists.
- **Never dump the full workspace hierarchy** into a prompt; scope `space_ids` and
  `max_depth`.
- Don't log time unless asked.

## Done

- [ ] Any "create an issue/task/ticket" request produced a **ClickUp** task — or a GitHub
      issue only because the user named GitHub, in which case the two are cross-linked.
- [ ] The unit of work has a resolved task key or an explicit, user-accepted `NO-TASK`.
- [ ] The branch name matches the key (`issue/<KEY>` or `no-task/<slug>`).
- [ ] Every commit on the branch carries the same scope.
- [ ] The PR body links `app.clickup.com/t/<KEY>` (or notes there is no task).
- [ ] For task-backed work: a comment with the PR link exists, and the status reflects
      reality without over-claiming completion.
- [ ] If work is pausing unfinished, a handoff comment exists that a teammate could act on
      cold, and nothing is left uncommitted.
