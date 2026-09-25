---
title: maintenance-window
---

Renovate raises updates faster than anyone can merge them one PR at a time, so a repo's backlog grows until nothing merges at all. This skill runs the pass that drains it. The non-majors land together in one monthly window with one review. Each major gets its own PR. The pipeline problems that caused the pile-up get reported, so the backlog doesn't come back.

## When to reach for it

- The recurring maintenance task for a site or plugin repo. The window opens on the 1st, and this pass closes it.
- Bot PRs are red, stale, conflicted, or arriving faster than they merge.
- A `maintenance/YYYY-MM` branch exists, has gone stale, or is ready to merge.
- Someone asks why dependency PRs won't merge, or how to make them easier to merge.

Things you might say that load it: "clear the Renovate backlog", "there are 30 dependency PRs", "why won't the bot PRs merge", "merge the maintenance PR", "close out the maintenance window", "run the monthly maintenance". It also applies at the start of a recurring task in a client's Site Maintenance folder.

## Where it stops

> **Not this skill:** a single update, i.e. one major, one failing Renovate PR, an advisory, a lockfile repair, or a hold. Use [`dependency-updates`](dependency-updates.md); this pass hands each of those there. Lint or test failures that aren't caused by a version change belong to [`quality-gates`](quality-gates.md). Which ClickUp folder the maintenance task lives in is [`engagement-types`](engagement-types.md).

## How it works

The model is a **hybrid window**:

| Update | Goes to | Merged by |
| --- | --- | --- |
| Non-majors: minor, patch, pin, digest, lock-file maintenance | The one open `maintenance/YYYY-MM` window | Automerged into the window, then **one** human review of the window PR |
| Majors | Their own PR to the default branch | A human, through `dependency-updates` |
| Security fixes | The default branch, ahead of the batch | A human, through `dependency-updates` |

Three rules keep it working:

1. Exactly one window is open at a time.
2. The window merges with a merge commit or a rebase merge, never a squash, so every group stays in the changelog and can be reverted on its own.
3. The window's branch is deleted once it merges.

<!-- wp:docspress/flow {"start": 1, "steps": [{"title": "Resolve the task", "content": "<p>Find or create the period's maintenance task, placed in the client's Site Maintenance folder.</p>"}, {"title": "Take inventory", "content": "<p>Run the read-only inventory script. It puts every open bot PR in exactly one bucket and proposes a merge queue.</p>"}, {"title": "Report the pipeline", "content": "<p>Record each pipeline finding with its fix. Fix the ones that block this pass first, and put the rest in their own follow-up PR, never in the batch.</p>"}, {"title": "Land stranded security fixes", "content": "<p>If a window holds security fixes that never reached the default branch, or the default branch has open high or critical runtime alerts, ship those fixes to the default branch before anything is closed.</p>"}, {"title": "Collapse to one window", "content": "<p>Check what each stale window holds that the default branch lacks, version by version, since a squash-merged window still lists every commit. Retire the ones with nothing missing, and salvage the non-majors from the rest.</p>"}, {"title": "Close the moot", "content": "<p>Close cross-window duplicates and Dependabot PRs that the default branch or Renovate already covers. Each close gets a comment naming what supersedes it.</p>"}, {"title": "Rebase, then diagnose", "content": "<p>Ask Renovate to rebase red PRs that are behind their base, and read their checks again. A check that's still red on several unrelated PRs, or red on two up-to-date ones, gets fixed once on the base branch. Edited PRs are handed back through the Dependency Dashboard, never closed.</p>"}, {"title": "Drain in order", "content": "<p>Co-moving PRs land in one merge. If a required check fails each one alone, they're combined into one PR. Then drain the non-majors: WordPress packages, then Composer, then npm, then lock-file maintenance last. The repo's own Renovate rules win where they say a package goes alone.</p>"}, {"title": "Route the majors", "content": "<p>Each major gets its own PR to the default branch through dependency-updates. One that isn't ready is held, with the reason recorded.</p>"}, {"title": "Verify, merge, close", "content": "<p>Run the gates, the build, and the smoke tests on the window head. Revert any bad group alone, merge the window with a merge commit or a rebase merge (never a squash), then delete the branch.</p>"}, {"title": "Report", "content": "<p>Post the period's updates, holds, closures and pipeline findings on the maintenance task.</p>"}]} /-->

Some repos have Renovate target the default branch directly. For those, the pass runs the same order, but it retires every window as an orphan, verifies the default branch after the drain, and has no window to merge. The routing is reported as a finding.

## What it checks first

It runs its inventory script, which reads the following and changes nothing:

| Look for | Tells you |
| --- | --- |
| `renovate.json`: `extends` and `baseBranchPatterns` | Whether the repo routes hybrid, window, or direct |
| `maintenance/*` branches | Each one's PR, and any commits (security fixes included) the default branch doesn't have |
| Rulesets and branch protection | Approvals, last-push approval, required checks, and whether PRs must be up to date |
| Repo merge settings | Whether the window can merge with a merge commit or a rebase merge |
| `maintenance.yml` and the auto-approve and auto-merge callers | Whether the window opens, gets fed, and gets merged |
| Dependabot's security-update setting, open Dependabot PRs, and open alerts on the default branch | Whether a second bot is duplicating Renovate, and whether the site is unpatched now |

It also reads the repo's own `CLAUDE.md` or `AGENTS.md` for drift guards, smoke tests and holds. Where those differ from the skill's defaults, the repo's files win.

## What it owns

Canonical for:
- the window lifecycle: open → stack → drain → verify → merge → close
- the hybrid routing model
- backlog triage and merge order
- how the window PR merges
- the pass report
- the inventory script

## Guardrails

<!-- wp:docspress/callout {"tone": "warning", "title": "Never merge past a required check or review", "content": "<p>Don't use <code>gh pr merge --admin</code> or a ruleset bypass unless the user says so for that specific PR. The queue exists so nothing needs one.</p>", "collapsible": false} /-->

<!-- wp:docspress/callout {"tone": "warning", "title": "Never squash-merge a window", "content": "<p>A squash collapses the month into one non-conventional commit. The changelog loses every update, and a bad group can't be reverted on its own.</p>", "collapsible": false} /-->

<!-- wp:docspress/callout {"tone": "warning", "title": "Never delete a window without checking what it holds", "content": "<p>Stranded work and stranded security fixes look exactly like an empty branch in the PR list. Check each version against the default branch first.</p>", "collapsible": false} /-->

- Never close a Renovate PR to get it recreated. Renovate ignores a closed update; discard edits from the Dependency Dashboard instead.
- Never let a major ride in the batch.
- Never replace the bot's batch with a wholesale `composer update` or `npm update`.
- Never push to a `renovate/*` branch from a workflow or a bot.
- Never close a PR without a comment naming what supersedes it.
- Never fold pipeline fixes into the batch. They go in their own PR.
- Never deploy by hand. The merge reaches production through the repo's release pipeline.
- Confirm each listed batch of merges, closes, labels, and branch deletions before running it.

## Done when

- [ ] The task is resolved and the inventory was run. Its output is attached to the report.
- [ ] Every pipeline finding is fixed or recorded in its own follow-up PR or task.
- [ ] No security fix is sitting in a window that hasn't reached the default branch.
- [ ] Exactly one window is open, or none in direct mode, and every retired window was checked for versions the default branch lacks.
- [ ] Every closed PR has a comment naming what supersedes it.
- [ ] No red PR was diagnosed while it was still behind its base.
- [ ] Every non-major is merged, or accounted for in the report with a reason.
- [ ] Every major is merged on its own PR, or held with a recorded reason.
- [ ] The gates are green on the window head, and staging was QA'd where the repo has one.
- [ ] The window merged with a merge commit or a rebase merge, not a squash, and its branch is deleted.
- [ ] The task has the report comment, and its status doesn't claim more than has been observed.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/maintenance-window/SKILL.md) is the skill's main instructions.
- [`references/pipeline-health.md`](https://github.com/linchpin/skills/blob/main/skills/maintenance-window/references/pipeline-health.md) — every finding the inventory reports, with its fix and where that fix lives, plus the repo-level hybrid routing config.
- [`references/report-template.md`](https://github.com/linchpin/skills/blob/main/skills/maintenance-window/references/report-template.md) — the comment the pass posts on the maintenance task.
- [`scripts/inventory.mjs`](https://github.com/linchpin/skills/blob/main/skills/maintenance-window/scripts/inventory.mjs) — the read-only inventory of a repo's dependency-maintenance backlog. Zero dependencies; needs Node 18+ and `gh`.
- [`scripts/inventory.test.mjs`](https://github.com/linchpin/skills/blob/main/skills/maintenance-window/scripts/inventory.test.mjs) — tests for the inventory's classification, with no network access.
- [`scripts/fixtures/direct-backlog.json`](https://github.com/linchpin/skills/blob/main/skills/maintenance-window/scripts/fixtures/direct-backlog.json) — a synthetic direct-to-main backlog: strict checks, stale red PRs, and co-moving PRs.
- [`scripts/fixtures/window-backlog.json`](https://github.com/linchpin/skills/blob/main/skills/maintenance-window/scripts/fixtures/window-backlog.json) — a synthetic windowed backlog: stale windows, stranded security fixes, and duplicates.

Pre-approved, so the agent can run them without a prompt: reading and searching files, the inventory script, `npm audit`, `composer audit`, `gh pr list`/`view`/`checks`, `gh run list`/`view`, and `git ls-remote`/`log`/`status`/`diff`. Merging, closing, labelling and deleting branches still ask.

## Related skills

- [`dependency-updates`](dependency-updates.md) — takes each single update the pass hands off: majors, failing PRs, advisories, holds.
- [`quality-gates`](quality-gates.md) — runs the gates on the base branch and the window head.
- [`engagement-types`](engagement-types.md) — decides where the maintenance task lives.
- [`task-tracking`](task-tracking.md) — resolves the task and posts the report.
- [`commit-and-release`](commit-and-release.md) — owns the window PR's title, and how the merge reaches production.
- [`web-qa`](web-qa.md) — QAs the staging site before the window merges.
- [`project-context`](project-context.md) — owns the environment.
