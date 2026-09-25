---
name: maintenance-window
description: Run a Linchpin repo's recurring dependency maintenance pass end to end — inventory the Renovate and Dependabot backlog, collapse stale maintenance/YYYY-MM windows, fix shared failures once, drain non-majors into one window merged by a single review, send each major to its own PR, verify, merge, and report. Use when doing this month's site maintenance, when dependency PRs pile up or won't merge, when a maintenance branch is open, stale, or ready to merge, or when asked to make dependency updates easier to merge. Not for one specific update, major, or advisory — use `dependency-updates`.
when_to_use: Also when someone says "clear the Renovate backlog", "there are 30 dependency PRs", "why won't the bot PRs merge", "merge the maintenance PR", "close out the maintenance window", or "run the monthly maintenance" — and at the start of a recurring task in a client's Site Maintenance folder.
version: 0.1.0
allowed-tools: Read Grep Glob Bash(node *scripts/inventory.mjs*) Bash(npm audit) Bash(composer audit*) Bash(gh pr list*) Bash(gh pr view*) Bash(gh pr checks*) Bash(gh run list*) Bash(gh run view*) Bash(git ls-remote*) Bash(git log*) Bash(git status*) Bash(git diff*)
---

# Maintenance window

Renovate raises updates faster than anyone can merge them one PR at a time, so a repo's
backlog grows until nothing merges at all. This skill runs the pass that drains it. The
non-majors land together in one monthly window with one review. Each major gets its own PR.
The pipeline problems that caused the pile-up get reported, so the backlog doesn't come back.

## When to use

- The recurring maintenance task for a site or plugin repo. The window opens on the 1st, and
  this pass closes it.
- Bot PRs are red, stale, conflicted, or arriving faster than they merge.
- A `maintenance/YYYY-MM` branch exists, has gone stale, or is ready to merge.
- Someone asks why dependency PRs won't merge, or how to make them easier to merge.

**Not this skill:** a single update, i.e. one major, one failing Renovate PR, an advisory, a
lockfile repair, or a hold. Use [`dependency-updates`](../dependency-updates/SKILL.md); this
pass hands each of those there. Lint or test failures that aren't caused by a version change
belong to [`quality-gates`](../quality-gates/SKILL.md). Which ClickUp folder the maintenance
task lives in is [`engagement-types`](../engagement-types/SKILL.md).

## Owns

Canonical for:
- the window lifecycle: open → stack → drain → verify → merge → close
- the hybrid routing model
- backlog triage and merge order
- how the window PR merges
- the pass report
- the inventory script, `scripts/inventory.mjs`

Defers:
- individual updates, overrides, holds, lockfile repair, and switching off Dependabot's
  security PRs → [`dependency-updates`](../dependency-updates/SKILL.md)
- running the gates → [`quality-gates`](../quality-gates/SKILL.md)
- PR titles and commit grammar → [`commit-and-release`](../commit-and-release/SKILL.md)
- the task, the branch, and the PR↔task link → [`task-tracking`](../task-tracking/SKILL.md)
- browser QA → [`web-qa`](../web-qa/SKILL.md)
- the environment → [`project-context`](../project-context/SKILL.md)

## The model — a hybrid window

| Update | Goes to | Merged by | Why |
| --- | --- | --- | --- |
| Non-major: minor, patch, pin, digest, lock-file maintenance | The one open `maintenance/YYYY-MM` window | Automerged into the window; **one** human review of the window PR | One review per month instead of one per PR, and the default branch's strict checks run once |
| Major | Its own PR to the default branch | A human, through `dependency-updates` | A breaking major can't strand the batch |
| Security fix | The default branch, ahead of the batch | A human, through `dependency-updates` | A fix merged into a window isn't on the site until the window merges |

Two failures behind the model, both measured in September 2026:
- **A major stranded a window.** On linchpin.com, `maintenance/2026-07` carried three majors
  and a Babel 8 regression alongside the safe bumps. The safe bumps had to be salvaged by
  hand.
- **Security fixes stranded in windows.** On a client site, the same two security fixes were
  merged into nine windows in a row, and none of them reached `main`.

Three rules keep the model working:

1. **Exactly one open window.** Renovate opens every update against every branch its pattern
   matches, so nine open windows means nine copies of each major.
2. **The window merges with a merge commit or a rebase merge, never a squash.** Either way,
   each group lands as its own conventional commit, so release-please lists it and a bad group
   can be reverted alone. A squash collapses the month into one commit. linchpin.com's July
   window landed as `Maintenance/2026 07 (#781)`, and nothing from it reached the changelog.
3. **The window closes.** Once it's merged, delete the branch so Renovate stops targeting it.
   The next month's workflow opens the next window.

Preflight detects repos that aren't on this model. The pass still runs for them (see *Direct
mode*), and the gap is reported as a pipeline finding. The config that implements the model is
in [`references/pipeline-health.md`](references/pipeline-health.md).

## Preflight

Run the inventory first. It reads everything in the table below in one pass, and it changes
nothing:

```bash
node <skill-dir>/scripts/inventory.mjs                      # inside the repo
node <skill-dir>/scripts/inventory.mjs --repo linchpin/site --json
```

`<skill-dir>` is the directory this `SKILL.md` was loaded from. The script needs Node 18+ and
an authenticated `gh`. If either is missing, say so. Don't fall back to hand-rolled `gh | jq`,
because that's how cross-window duplicates and stale results get missed.

| Look for | Tells you | If missing |
| --- | --- | --- |
| **Routing**: `renovate.json` `extends` + `baseBranchPatterns` | *hybrid*, *window*, or *direct* | No Renovate config means there's nothing to drain. Say so and stop |
| **Windows**: `maintenance/*` branches, each one's PR, commits not on the default branch | Stale windows, stranded work, stranded security fixes | In window or hybrid mode, report that no window is open (`window-workflow-missing`) |
| **Merge rules**: approvals, last-push approval, strict mode, required checks | Who can merge, and whether PRs must be up to date | If the rules can't be read with this token, say so and assume a review is required |
| **Merge methods**: merge commit / rebase / squash | How the window PR can land | Squash-only means the window can't merge correctly. Report it before draining |
| **Workflows**: `maintenance.yml`, and the callers that auto-approve and auto-merge into the window | Whether the window opens, gets fed, and gets merged | Report each gap as a finding |
| **Dependabot**: the security-update PR opener, open Dependabot PRs | Whether a second bot is duplicating Renovate | — |
| The repo's own `CLAUDE.md` / `AGENTS.md` | Drift guards, smoke tests, holds, how many npm/Composer projects it has | These win over this skill's defaults. Read them before step 7 |
| The period's maintenance task | Where the report goes | Resolve or create it via `task-tracking` |

## Procedure

Only step 2 is read-only. Every step after it changes GitHub state, so present each batch of
actions as a list and get a yes before running it. One confirmation per listed batch is
enough.

1. **Resolve the task.** Resolve the period's maintenance task through
   [`task-tracking`](../task-tracking/SKILL.md); where it lives is
   [`engagement-types`](../engagement-types/SKILL.md)' call. → You have a task key, or the
   user accepted `NO-TASK`.
2. **Take inventory.** Run `scripts/inventory.mjs` and keep its output for the report.
   → Every open bot PR is in exactly one bucket, and there is a proposed queue.
3. **Report the pipeline.** Each finding comes with a fix in
   [`references/pipeline-health.md`](references/pipeline-health.md). Findings marked
   `blocks` are fixed first only where no procedure step works around them; the reference's
   *What stops the pass* section lists which those are. Everything else goes into one
   follow-up PR or task, **never into the batch**. → Every finding is either fixed or
   recorded.
4. **Land stranded security fixes first.** A window holding `[SECURITY]` commits that aren't
   on the default branch means the site is unpatched. So do high or critical alerts in runtime
   dependencies, which the inventory reads from the default branch. Ship those fixes to the
   default branch now, through `dependency-updates`' security case, before closing anything.
   → On a clean checkout of the default branch, `npm audit` / `composer audit` no longer lists
   those advisories. Run them locally: many repos audit only on PRs.
5. **Collapse to one window.** For each stale window, list what it holds that the default
   branch lacks: `git log --oneline origin/<default>..origin/<window>`. The inventory reports
   the same count, with the empty "open the window" commit left out. Each remaining commit is
   a Renovate group whose body lists `package old => new`. A squash-merged window lists every
   one of them even though its versions are already on the default branch, so check each
   version against the default branch's lockfile. Don't judge by
   `git diff <default> origin/<window>`: that two-dot diff shows everything the default branch
   gained since the window was cut.
   - If the default branch already has every version, at that version or newer, close the
     window's PRs with a comment and delete the branch.
   - If it lacks some, salvage those **non-majors** onto the current window, name what you
     excluded and why, then retire the stale window.

   → Exactly one `maintenance/*` branch is left. Renovate re-raises the open topics against it
   on its next run.
6. **Close the moot.** That means cross-window duplicates, Dependabot lockfile-only PRs the
   default branch already satisfies (check them the way `dependency-updates` does), and
   Dependabot manifest bumps that Renovate already carries. Every close gets a comment naming
   what supersedes it. → A re-run of the inventory shows no duplicates and no
   `dependabot:lockfile-only` PRs.
7. **Rebase before diagnosing.** Checks on a PR that's behind its base ran against old code.
   Ask Renovate to rebase instead of pushing to its branch: add the `rebase` label, tick the
   rebase box in the PR body, or tick *rebase all open PRs* on the Dependency Dashboard issue.
   Renovate won't rebase a branch a person has already pushed to. For those, either take
   ownership and merge promptly, or tick the PR's entry under the dashboard's *PR Edited
   (Blocked)* heading, which discards the extra commits and rebuilds the branch. **Don't close
   the PR to get it recreated.** Renovate ignores a closed update; only grouped "immortal" PRs
   come back. → After Renovate's next run, those PRs show `behind 0`.
8. **Fix shared red once.** A check that is still red on several unrelated PRs after the
   rebase is failing because of the base branch. Reproduce it on the base head with
   [`quality-gates`](../quality-gates/SKILL.md), fix it in its own PR to the default branch,
   and let Renovate rebase. Example: in LINCHPIN-5669, a PHPStan patch reworded its findings
   and PHP lint failed on every PR; one baseline regeneration on `main` cleared all of them.
   A check red on two or more PRs that are **up to date** is shared on its own evidence. Their
   results are current, so don't wait for a rebase. → The check passes locally on the base
   head (many repos run CI only on PRs) and on the rebased PRs.
9. **Land co-moving non-majors together.** The inventory lists PRs that move the same
   dependency to the same version. If nothing checks consistency, merge them back to back.
   If a **required** check does (for example an overrides drift check), none of them can pass
   alone, and merging them one at a time would need the bypass the Guardrails forbid. They
   have to become one PR:
   - Fix the grouping on the default branch. Usually a later `packageRules` entry's
     `groupName` is splitting the group. Renovate then raises one PR.
   - Or, if this month can't wait, carry both changes in one PR of your own through
     `dependency-updates`, and close the pair with a comment.

   → The dependency lands in one merge, and the guard is green.
10. **Drain the non-majors** in the queue's order: WordPress plugin and theme groups first,
    then Composer, then npm, then lock-file maintenance **last**, because it rewrites every
    lock. Read the descriptions in the repo's `renovate.json` `packageRules` first. A rule
    that says a package goes alone or never automerges wins over the queue. The inventory
    flags PRs whose GitHub auto-merge is armed, and the next approval merges those on the
    spot. After each merge, let Renovate rebase anything that now conflicts. Never resolve a
    lockfile by hand. → Each group is one squash commit on the window, or on the default
    branch in direct mode.
11. **Route the majors.** Each major gets its own PR to the default branch through
    [`dependency-updates`](../dependency-updates/SKILL.md). If one isn't ready this month,
    hold it there and record the reason in the report; an open, red major with no note isn't
    a decision. Majors that move the same dependency still get one PR each. Review them
    together, and merge them back to back when the toolchain has to move as one. In window
    mode a major can only arrive on the window. Review it the same way,
    merge it **last** so a revert leaves the batch intact, and report the routing. → Every
    major is either merged or held with a reason.
12. **Verify the batch** on the window head:
    - a clean install
    - `quality-gates`
    - the build
    - the repo's own E2E or smoke tests
    - where the repo deploys a staging site, a [`web-qa`](../web-qa/SKILL.md) pass over its
      critical paths

    If something is red, each group is one commit, so find the one responsible, `git revert`
    it on the window, and move that update to its own PR or a hold. Never hold the whole batch
    for one group. → The gates are green on the window head.
13. **Merge the window.** Retitle the PR per
    [`commit-and-release`](../commit-and-release/SKILL.md), because the maintenance workflow
    titles it `Maintenance/YYYY-MM` and a PR-title check rejects that. Mark it ready and
    request a human review. Merge it the way the inventory's *Window merge method* line says.
    → The default branch has one conventional commit per group, and release-please's PR lists
    them.
14. **Close the window.** Delete the merged branch. → The inventory shows no stale windows.
15. **Report.** Post a comment on the task using
    [`references/report-template.md`](references/report-template.md), and set the status per
    `task-tracking`. The task stays in review until a deploy has been observed. → The comment
    exists and links every PR it names.

### Direct mode

Some repos have Renovate targeting the default branch itself; linchpin.com has done this since
July 2026. For those, run the same order with three changes:

- **Step 5 retires every window.** Renovate doesn't target them, so they're orphans. Check
  what each one holds the same way before deleting it. `maintenance.yml` opens a new one on
  the 1st regardless, so the orphans come back until the routing finding is settled.
- **Step 12 verifies the default branch** after the drain, rather than a window head.
- **Steps 13 and 14 don't apply.**

Each non-major merges into the default branch on its own, and has to be up to date when it
merges. Two things stall it:

- **Reviews** (`review-per-pr`). Every bot PR needs a human approval. With last-push approval
  on, each Renovate rebase resets that approval, and whoever pushed to a PR can't approve it.
  This is the main reason direct mode never drains. The window moves the review to one PR a
  month, because rulesets usually guard only the default branch.
- **Strict checks with `rebaseWhen: conflicted`** (`strict-conflicted`). A PR that falls behind
  is never rebased, so automerge never fires.

Report both, and report the routing.

## Guardrails

- **Never** merge past a required check or review with `gh pr merge --admin` or a ruleset
  bypass unless the user says so for that specific PR. The queue exists so nothing needs one.
- **Never** squash-merge a window. A squash loses the changelog and makes the batch impossible
  to revert one group at a time.
- **Never** let a major ride in the batch, or merge one as a side effect of merging the window.
- **Never** replace the bot's batch with a wholesale `composer update` or `npm update` to
  "catch up". It buries every change in one diff and fights Renovate's next run. It's how the
  PHPStan drift behind LINCHPIN-5669 arrived.
- **Never** push to a `renovate/*` branch from a workflow or a bot. Renovate stops maintaining
  a branch someone else has pushed to, and the queue jams at its PR limit.
- **Never** delete a window, or close its PRs, before checking what it holds that the default
  branch lacks (step 5). Stranded work and stranded security fixes look exactly like an empty
  branch in the PR list.
- **Never** close a Renovate PR to get it recreated. Renovate ignores a closed update; only
  grouped "immortal" PRs come back. Discard edits from the Dependency Dashboard instead.
- **Never** close a PR without a comment naming what supersedes it.
- **Never** fold pipeline fixes (Renovate config, workflows, repo settings) into the batch. They
  go in their own PR, so the batch stays revertable.
- **Never** deploy by hand. The merge reaches production through the repo's release pipeline
  ([`commit-and-release`](../commit-and-release/SKILL.md)).
- Merging, closing, labelling, and deleting branches all change GitHub state. Confirm each
  listed batch first.
- If the inventory can't run, or it's missing a signal the pass depends on, stop and say
  which one is missing. Guessing a queue is how the backlog built up in the first place.

## Done

- [ ] The task is resolved and the inventory was run. Its output is attached to the report.
- [ ] Every pipeline finding is fixed or recorded in its own follow-up PR or task.
- [ ] No security fix is sitting in a window that hasn't reached the default branch.
- [ ] Exactly one window is open, or none in direct mode, and every retired window was checked
      for versions the default branch lacks.
- [ ] Every closed PR has a comment naming what supersedes it.
- [ ] No red PR was diagnosed while it was still behind its base.
- [ ] Every non-major is merged, or accounted for in the report with a reason.
- [ ] Every major is merged on its own PR, or held with a recorded reason.
- [ ] The gates are green on the window head, and staging was QA'd where the repo has one.
- [ ] The window merged with a merge commit or a rebase merge, not a squash, and its branch is
      deleted.
- [ ] The task has the report comment, and its status doesn't claim more than has been
      observed.
