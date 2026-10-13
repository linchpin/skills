# Time entries and closing

The detail behind step 5 of [`../SKILL.md`](../SKILL.md): how much time a finished task took,
how to log it, and how to tell that its change actually shipped before closing it.
[`task-closeout`](../../task-closeout/SKILL.md) uses the same rules across a whole backlog.

## How much time — the evidence

An agent can't know how long a person worked. It can gather evidence, suggest a figure, and
log what the person confirms. These sources run from strongest to weakest:

| Source | How | What it tells you | Caveat |
| --- | --- | --- | --- |
| A running timer | `clickup_get_current_time_entry` | The exact time, if the person was tracking | On this task, stop it (`clickup_stop_time_tracking`) and that *is* the entry. On another task, leave it alone |
| Time already logged | `time_spent` on `clickup_get_task` | The task's total across every user, in ms | `0` is the only "nothing logged" signal you need |
| Agent session logs | `node <skill-dir>/scripts/session-time.mjs <KEY>` | **Active** time on `issue/<KEY>` (a floor) and the wall-clock **span** (a ceiling), split by day. Also the **lead-in**: extra active time the same sessions spent on other branches | Claude Code on this machine only. Lead-in and weak mentions are pointers, never counted |
| Git | `gh search prs <KEY> --owner <org> --match title`, then `gh pr view <n> --repo <o/r> --json createdAt,mergedAt,commits` | *When* the work happened | Rarely *how long*: agent-assisted work commits at the end, so a 3-minute PR can hide hours |
| Time in status | `clickup_get_task_time_in_status` | Wall-clock in active statuses (a ceiling) | Needs the "Total time in Status" ClickApp. Without it the call errors, so say so and move on |
| The estimate | `time_estimate` on the task | What it was *expected* to take | Not evidence of what it did take. Never present it as actual time |
| The person | Ask | The truth | Always the final word |

### Suggesting a figure

Suggest one figure and show what it's based on. Offer the floor and the ceiling as the other
choices, in a single `AskUserQuestion`:

> Log time on LINCHPIN-5769? Session logs show 48m active across a 2h 07m span on 2 Oct.
> → **48m** (active session time) · **2h 07m** (span) · **1h 30m** (estimate) · Other

- **Lead with the strong evidence.** If there's none, say so: "no session or timer evidence;
  the PR was open 3 minutes, which says nothing about effort". Then ask for the figure
  outright rather than dressing the estimate up as a measurement.
- **Lead-in is a question, not a figure.** Scoping usually happens on `main` before the
  task and its branch exist, so the active time on the branch alone runs low. Offer the sum
  as its own choice: "plus 16m on main before the branch was cut — was that scoping this
  task?"
- **Don't round for them.** If the team bills in increments, the person says so, and the
  project's `CLAUDE.md` is where that convention belongs.
- **"Don't log this" is a valid answer.** Record it in your summary and move on.

## Logging it

`clickup_add_time_entry`:

| Field | Value |
| --- | --- |
| `task_id` | The custom ID (`LINCHPIN-5769`) works |
| `start` | `YYYY-MM-DD HH:MM`, the person's local time, **on the day the work happened**. The script prints a `start` per day |
| `duration` | `'1h 30m'` or `'90m'` — the confirmed figure |
| `description` | Short: the PR URL or a one-line summary. Omit rather than pad |
| `billable` | **Omit** — the workspace default applies. Override only when the person says so. Whether work is billable is an engagement question ([`engagement-types`](../../engagement-types/SKILL.md)) |

- **One entry per day worked.** Work that spanned three days gets three entries. A single
  lump on the last day puts hours in the wrong week, or the wrong month.
- **Entries are logged as the signed-in user.** The tool takes no assignee. If someone else
  did the work, don't log it for them: comment on the task with the evidence and ask them to.
  The assignee isn't proof either way, because people log time on tasks assigned to others.
- **Check for an existing entry first.** Call `clickup_get_time_entries` with the `task_id` and
  **explicit `start_date`/`end_date`** covering the work. Without dates, it returns only
  recent entries and an older one looks missing. It returns only your own entries unless
  you pass `assignee: ["any"]`.
- **Read it back.** Afterwards, `time_spent` on the task should have grown by the duration.

## Closing — the status ladder

Status names differ between Spaces and lists. Each status's **`type`** doesn't, so read the
list's statuses (`clickup_get_task` with `expand_statuses: true`) and work from the type:

| `type` | Typical names | Meaning |
| --- | --- | --- |
| `open`, `unstarted` | `unassigned`, `Open`, `needs estimate`, `approved to start` | Not started |
| `custom` | `in progress`, `needs peer/code review`, **`needs dev deploy`**, **`needs staging deploy`**, **`needs prod deploy`**, **`needs release build`**, `needs qa/testing`, `blocked by client` | In flight. The bold ones are waiting on a deploy |
| `done` | `in client review`, `resolved`, `wont do` | Finished, not closed. They pile up here |
| `closed` | `complete` | Closed. A list has exactly one |

The deploy-waiting statuses are the `custom` ones named `needs … deploy` or
`needs release build`. Client sites usually step through dev, then staging, then prod.
Products usually have just `needs release build`. Read the list rather than assuming either.

**When a task may close:** its change is verified in its **final** environment (see below),
nothing is still waiting on a person, and time is logged or explicitly declined. Then move
it to the list's `closed`-type status.

- **One deploy closer isn't closed.** Verified on staging with a prod deploy status still to
  come, the task advances to the next deploy status, not to `closed`. The final environment
  is the last one the repo actually has (`gh api repos/<o/r>/environments`). Not every site
  has all three.
- **Statuses waiting on a person** (`in client review`, `needs qa/testing`,
  `awaiting client team`, `needs client comms`) close on that person's word. A deploy
  doesn't close them.
- **`done` isn't the finish line.** A `resolved` task whose change is verified live moves to
  `closed`. Otherwise "done" tasks sit on the board forever and hide the ones that really
  are open.
- **`wont do` closes as it is.** There's no deploy to verify and usually no time to log,
  so confirm that with the person rather than chasing evidence.

## Verifying the deploy

How a repo releases and deploys is [`commit-and-release`](../../commit-and-release/SKILL.md)'s
subject, and its environments are [`github-repo-setup`](../../github-repo-setup/SKILL.md)'s.
This is only the check that a given change got there:

```bash
# 1. The work PRs. The key is in the title per commit-and-release; the release PR that
#    carried it mentions the key only in its body, so --match title leaves it out.
gh search prs <KEY> --owner <org> --match title --state closed --json repository,number,title,url

# 2. Each PR's merge commit
gh pr view <n> --repo <o/r> --json mergeCommit,mergedAt --jq '{sha: .mergeCommit.oid, mergedAt}'

# 3a. Sites: the latest successful deploy to the final environment (the filter isn't case-sensitive)
gh api "repos/<o/r>/deployments?environment=production&per_page=5" --jq '.[] | {id, sha, ref, created_at}'
gh api "repos/<o/r>/deployments/<id>/statuses" --jq '.[0].state'          # want: success

# 3b. Packages and plugins (no deployments): the latest published release
gh release list --repo <o/r> --limit 1

# 4. Is the merge commit inside what shipped?
gh api repos/<o/r>/compare/<merge-sha>...<deployed-sha-or-tag> --jq .status
```

`ahead` or `identical` means the change shipped. `behind` means it hasn't shipped yet.
`diverged` means the deploy didn't come from that line of history: treat it as unverified
and ask. A task with several PRs, possibly in several repos, closes only when **every** one
of them has shipped.
