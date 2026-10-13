---
name: task-closeout
description: Sweep a ClickUp board for finished work that never closed or never had its time logged — tasks whose PRs merged and shipped but still sit in review, deploy (needs dev/staging/prod deploy, needs release build) or done statuses, and tasks that took hours but show none. Verifies each deploy, closes what really shipped, and backfills time from session and git evidence, with the person confirming every figure. Use when tasks are stuck in "needs deployment", when asked to close out deployed tasks, to backfill time, or to find tasks with no time logged. Not for the one task you just finished — use `task-tracking`.
when_to_use: Also when someone says "clean up the board", "we never logged time on these", "log my time for last month", "what's still sitting in needs prod deploy", "close out the sprint", "timesheet backfill", or before invoicing a period.
version: 0.1.0
allowed-tools: Read Grep Glob Bash(node *scripts/session-time.mjs*) Bash(gh auth status*) Bash(gh search prs*) Bash(gh pr view*) Bash(gh release list*) Bash(gh api repos/*/compare/*)
---

# Task closeout

Finished work leaves two gaps on a ClickUp board: tasks that shipped but never closed, and
tasks that took hours but have none logged. Neither one throws an error, so both pile up
until the board shows work as open that isn't, and invoices miss hours that were worked.
This sweep finds both, checks what actually shipped, and gets each person's confirmed time
onto the right task and the right day.

## When to use

- The board is full of tasks in `needs … deploy`, `needs release build`, `resolved`,
  `in client review`, or a review status, and their PRs merged long ago.
- Worked tasks show `0` time, and the hours need backfilling for a month, a client, or a
  project.
- A recurring close-out: end of a sprint, end of a month, before invoicing.

**Not this skill:** the task you just finished. Step 5 of
[`task-tracking`](../task-tracking/SKILL.md) logs its time and closes it. Not for deciding
whether work is billable or in scope either — that's
[`engagement-types`](../engagement-types/SKILL.md).

## Owns

Canonical for: finding stale and untracked tasks across a board, batching their evidence
into one proposal, and the per-run choice of how backfilled entries are dated.

Defers: every per-task rule → [`task-tracking`](../task-tracking/SKILL.md). That covers how
time is evidenced, confirmed and logged, when a task may close, and how a deploy is verified,
all in [`time-and-closing.md`](../task-tracking/references/time-and-closing.md).
ClickUp call signatures →
[`clickup-mcp-tools.md`](../task-tracking/references/clickup-mcp-tools.md). This
skill runs those rules over many tasks at once. It doesn't restate them.

## Preflight

| Check | How | When it fails |
| --- | --- | --- |
| ClickUp MCP connected | `clickup_*` tools present | **Stop and say so.** There's nothing to sweep without it |
| Who you are | `clickup_resolve_assignees` with `["me"]` | You need the id to separate your time from everyone else's |
| GitHub reachable | `gh auth status` | Deploys can't be verified, so every close becomes a question for the person. Say so up front |
| Session logs | the evidence script (step 5) runs | No session evidence on this machine. Time suggestions fall back to git and the person. Say so |
| Time in Status ClickApp | one `clickup_get_task_time_in_status` call | Note it in the report as a workspace fix, then carry on without it |

## Procedure

1. **Agree the scope.** Ask once, in a single `AskUserQuestion`:
   - **Which Space or Spaces.** Default to the current repo's Space, per `task-tracking`'s
     Preflight.
   - **The window**, e.g. the last 90 days.
   - **How backfilled entries are dated:** *when the work happened*, so reports show the
     right month but months already invoiced can change, or *today*, which leaves past
     periods alone.

   → A stated scope and dating convention, both chosen by the person.
2. **Read each list's statuses** as you reach it (`expand_statuses: true`), and mark the
   candidate statuses: review, deploy-waiting, QA, and every `done`-type status. Patterns
   are in [`references/sweep.md`](references/sweep.md). → A list of candidate status names
   for each list.
3. **Find what should close.** `clickup_filter_tasks` on the scope and candidate statuses,
   reading every page. Find each task's PRs and run the deploy check from `task-tracking`.
   Then sort each task into one of five groups:
   - **shipped:** close it.
   - **partly shipped:** move it to the next deploy status.
   - **not shipped:** leave it.
   - **waiting on a person:** list it for them.
   - **no PR:** ask.

   → Every candidate in exactly one group.
4. **Find untracked time.** Two sources:
   - Tasks in scope that you worked on: closed in the window, or candidates from step 3.
   - Keys from your own merged PRs. These catch tasks you worked but aren't assigned to.

   Read `time_spent` for each (`clickup_get_task`; the filter doesn't return it) and keep
   the zeros. Tasks with zero time that someone else worked go on that person's list.
   → A list of your tasks with no time logged, and a list for each other person.
5. **Gather time evidence in one pass.** Run
   `node <skills-dir>/task-tracking/scripts/session-time.mjs <KEY>… --since <window start>`
   once for all keys. Add the PR dates you already have and the estimates, then suggest a
   figure per task using `task-tracking`'s rules. → One proposal row per task, each with
   its evidence.
6. **Present one proposal and get it confirmed.** Use the table in
   [`references/sweep.md`](references/sweep.md): each task's current → proposed status,
   the proof it shipped, the time evidence, and the suggested figure. The person approves,
   edits, or strikes each row. With more than a handful of rows, a reply in chat works
   better than `AskUserQuestion`'s four options. → Every row approved, edited, or struck
   by the person.
7. **Apply the approved rows, time first.**
   1. Log each confirmed entry, one per day worked, dated by step 1's convention.
   2. Move the task's status.
   3. On each task you close, comment with its PRs and the deploy that shipped them.

   Logging before closing means nothing closes with `0` time. Read each change back.
   → `time_spent` has grown by the confirmed figure, the status has changed, and the
   comment exists.
8. **Report** using the template in [`references/sweep.md`](references/sweep.md): what
   closed, what moved, the hours logged per task, what was skipped and why, each other
   person's untracked tasks, and any data gaps. If a ClickUp task tracks the sweep (a
   recurring close-out task, say), post the report there too. → A report the person can
   act on without re-running anything.

## Guardrails

- **Never close or log anything outside an approved row.** Approval covers the rows the
  person saw. A row added afterwards needs its own approval.
- **Never log another person's time, and don't comment on their tasks unasked.** Entries
  go in as the signed-in user. List their tasks for the person running the sweep to pass on.
- **Never close by status alone.** `resolved` or `needs prod deploy` with no verified
  deploy is a question for the person, not a close.
- **Never backdate without step 1's choice.** Never edit or delete existing time entries:
  this sweep only adds.
- **Never sweep the whole workspace unasked.** It holds every client's work; scope it to
  the Spaces the person named.
- **A search that returns exactly its `--limit` has been cut off.** Narrow the window or
  the author and run it again, rather than treating the list as complete.
- **If a call fails partway through step 7, stop.** Report what has already been applied,
  and read the state back before retrying. A blind retry logs the same time twice.

## Done

- [ ] The person chose the scope and the dating convention.
- [ ] Every closed task had all its PRs verified in the final environment (or the person's
      word), and carries a comment with that evidence.
- [ ] Every time entry matches an approved row, was logged as the signed-in user, and is
      dated by the run's convention. `time_spent` was read back afterwards.
- [ ] Other people's untracked tasks are listed for them, not logged.
- [ ] The report was delivered, including data gaps (missing session logs, the Time in
      Status ClickApp, truncated searches).
