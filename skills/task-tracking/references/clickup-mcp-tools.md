# ClickUp MCP — call signatures

The tool for each step of the workflow in [`../SKILL.md`](../SKILL.md). Names are the ClickUp
MCP's; if these tools aren't in the session, the workflow's Preflight says what to do instead.

| Step | Tool |
| --- | --- |
| Confirm a given key/URL | `clickup_get_task` (accepts `LINCHPIN-5113` or `86badg2te`) |
| Find an existing task | `clickup_search` / `clickup_filter_tasks` (scope to the Space) |
| Build a Space/List picker | `clickup_get_workspace_hierarchy` (`space_ids`, `max_depth: 2`) |
| Resolve "me"/assignees | `clickup_resolve_assignees` |
| Create the task | `clickup_create_task` (`list_id` + `name` required) |
| Create a subtask | `clickup_create_task` with `parent: <parent task id>` |
| Read the key back | `clickup_get_task` → `custom_id` |
| List valid statuses | `clickup_get_task` with `expand_statuses: true`, or `clickup_get_list` |
| Branch the work | `git switch -c issue/LINCHPIN-#### main` (or `no-task/<slug>`) |
| Commit | `type(LINCHPIN-#### \| NO-TASK): subject` |
| Open the PR | `gh pr create` — title `type(KEY): …`, body links `app.clickup.com/t/<KEY>` |
| Comment on the task | `clickup_create_comment` (PR URL + one-line summary) |
| Move the status | `clickup_update_task` (valid statuses come from the List) |
| Is a timer running? | `clickup_get_current_time_entry` → stop it with `clickup_stop_time_tracking` |
| Has any time been logged? | `clickup_get_task` → `time_spent` (ms, every user) |
| Session evidence | `node <skill-dir>/scripts/session-time.mjs <KEY>…` |
| Log confirmed time | `clickup_add_time_entry` (`task_id`, `start`, `duration`) |
| List existing entries | `clickup_get_time_entries` (`task_id`, `start_date`, `end_date`, `assignee: ["any"]`) |
| Close | `clickup_update_task` with the list's `closed`-type status |
| Hand off mid-flight | `clickup_create_comment` with the five-line handoff block |

## Three that bite

**`custom_id` is assigned after creation.** `clickup_create_task` returns `custom_id: null`
much of the time — the key exists moments later. Always `clickup_get_task` before using a key
as a commit scope, and never read `null` as "this space doesn't use custom IDs".

**Statuses are per-Space/List and there are often dozens** — a single Linchpin list carries
open, unstarted, custom, done, and closed variants (`needs estimate`, `needs peer/code
review`, `in qa/testing`, `blocked by client`, `resolved`, `complete`, …). Read them; never
guess a name, and never assume `complete` is the only terminal one. Each status carries a
`type` (`open`, `unstarted`, `custom`, `done`, `closed`), which is stable across lists.

**`clickup_get_time_entries` looks narrower than it is.** Without `start_date`/`end_date` it
returns only recent entries, and without `assignee: ["any"]` it returns only yours — so an
old entry, or a teammate's, looks missing. To ask "is there any time on this task?", read
`time_spent` from `clickup_get_task` instead.

## Escaping note for editors of this file

The pipe in the commit row is escaped (`\|`). GFM splits table cells on pipes **even inside
code spans**, so an unescaped one silently truncates the cell.
