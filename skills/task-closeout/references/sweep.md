# Sweep — queries, dating, and templates

The detail behind the procedure in [`../SKILL.md`](../SKILL.md). Rules about a single task —
evidence, confirmation, the deploy check, when to close — live in `task-tracking`'s
[`time-and-closing.md`](../../task-tracking/references/time-and-closing.md). This file only
covers running those rules across a board.

## Candidate statuses (step 2)

Read each list's statuses and pick by `type` first, then by name. The names below are the
ones in use across Linchpin's Spaces today. Match on the pattern, because a list can rename
them.

| Group | `type` | Name pattern | Examples |
| --- | --- | --- | --- |
| Review | `custom` | `… review` (not `client review`) | `needs peer/code review`, `in peer/code review` |
| Deploy-waiting | `custom` | `needs … deploy`, `needs release build` | `needs dev deploy`, `needs staging deploy`, `needs prod deploy` |
| QA | `custom` | `… qa/testing` | `needs qa/testing`, `in qa/testing` |
| Done, not closed | `done` | any | `in client review`, `resolved`, `wont do` |

Review statuses are on the list because a task can stall *before* deploy. Once its PR has
merged, review is over, whatever the status says.

## Discovery (steps 3 and 4)

**ClickUp first; GitHub per key or per author.** An org-wide search for merged PRs runs into
GitHub's 1,000-result cap within weeks, because bots (Renovate, release bots) dominate it.

```text
clickup_filter_tasks   space_ids: [<space>], statuses: [<candidate names>], order_by: updated, page: 0, 1, …
clickup_filter_tasks   assignees: [<me>], include_closed: true, date_closed_from: <window start>, space_ids: [<space>]
clickup_get_task       <id>  → time_spent (ms, every user), time_estimate, status, list
```

- **The window is enforced by paging, not by the filter.** `clickup_filter_tasks` can filter
  by due and closed dates, but not by updated date. Sort by `updated` (newest first) and
  stop paging once a page's tasks fall before the window start. One Space can hold
  hundreds of candidates going back years, and most of them are stale portfolio or
  planning entries with no code behind them.
- **`time_spent` isn't in the filter results.** Read each candidate with `clickup_get_task`.
  That's one call per task, which is fine for dozens. If there are hundreds, tell the
  person and narrow the scope.
- **One task, several repos.** A task's PRs often span repos — a site and a plugin, say —
  and each one ships its own way (a production deploy for one, a release tag for the
  other). Check every PR, and close the task only once all of them have shipped.

```bash
# A task's PRs. The key is in the title, so --match title leaves out the release PR that only mentions it.
gh search prs <KEY> --owner <org> --match title --state closed --json repository,number,title,url

# Your own merged work in the window: catches tasks you worked but aren't assigned to.
gh search prs --owner <org> --author @me --merged --merged-at ">=<window start>" \
  --limit 1000 --json repository,number,title,closedAt
```

- **Key from a title:** `^\w+\(([A-Z][A-Z0-9]*-\d+)\)`. Titles scoped `NO-TASK` have no
  task to update.
- **`<org>`** is the owner in the repo's git remote — `linchpin` for our own repos.
- **Exactly `--limit` results means the list was cut off.** Halve the window and run it
  again.
- **The search API allows about 30 requests a minute.** On a rate-limit error, wait a minute
  rather than skipping keys. A skipped key looks just like a task with no PRs.

## Dating backfilled entries (step 7)

Use the convention the person chose in step 1, applied to the evidence available for each
task:

| Convention | Evidence available | Entry |
| --- | --- | --- |
| When it happened | Session days from the script | One entry per day, using that day's `start` |
| When it happened | Git only | One entry on the last commit's day, ending at that commit |
| When it happened | Neither | Ask the person which day. Don't guess |
| Today | any | One entry today, ending now |

**A task closed today gets today's close date.** `date_closed` can't be backdated through
the MCP, so the closing comment records when the change actually shipped.

## The proposal (step 6)

One table, so the person sees everything before anything happens:

```markdown
**Close-out — <Space>, <window>, entries dated <when it happened | today>**

| # | Task | Status → proposed | Shipped? | Time evidence | Log |
| --- | --- | --- | --- | --- | --- |
| 1 | [LINCHPIN-5769](<task url>) Add a wp-plugin-dependency-audit skill | needs peer/code review → **complete** | #60 in v1.6.0 | none on its branch; PR open 3m; worked from issue/MANTLE-515 on 2 Oct | **ask** |
| 2 | … | needs staging deploy → **needs prod deploy** | #812 on staging, not prod | 1h 10m active (span 2h 40m), 2 days | **1h 10m** |

Reply with the rows to apply ("all", "1-4, 6"), any figures to change ("2 → 1h 30m"),
and any to strike.
```

- **"ask" is a valid suggestion.** When there's no strong evidence, say so in the row rather
  than filling in the estimate.
- **Weak session mentions go in the evidence column as pointers,** like row 1's "worked
  from issue/MANTLE-515". They help the person remember. They are never a figure.
- **Teammates' tasks don't go in this table.** They go in the report.

## The report (step 8)

```markdown
**Close-out report — <Space>, <window>**
- **Closed:** <n> — <keys>
- **Moved on:** <n> — <key: from → to>
- **Time logged:** <total> across <n> tasks — <key: duration (days)>
- **Skipped:** <key: why — not shipped / struck / no evidence and declined>
- **For others:** <person: keys with no time logged — ask them to log their own>
- **Gaps:** <e.g. Time in Status ClickApp off; no session logs for work done outside Claude Code; search truncated at …>
```
