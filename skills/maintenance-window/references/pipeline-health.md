# Pipeline health — what the inventory reports, and the fix for each

Every finding from `scripts/inventory.mjs` is listed here by its id. Two severities:

- **blocks** — the finding stops the pass, or makes it produce something wrong. Fix it first,
  or use the workaround given.
- **wastes** — the finding costs time on every pass. Record it and fix it in its own PR.

Fixes never go inside the batch (see the Guardrails in `../SKILL.md`).

"Where the fix lives" matters, because two of these repos are shared:

- **`renovatebot-config`** is consumed live off `main` by about 40 repos, with no pinning.
- **`linchpin/actions`** is pinned by major tag (`@v4`).

A fix to either one reaches every repo on its next run. So when a problem shows up in one
repo, fix it in that repo's own config first, and propose the shared change separately.

## What stops the pass

Most `blocks` findings have a procedure step that works around them for this month. Fix
those in the follow-up. Fix these ones before the step named, because no step works around
them:

| Finding | Fix before | Because |
| --- | --- | --- |
| `stranded-security`, `open-alerts` (high or critical runtime) | anything else (step 4) | The site is unpatched until the fix reaches the default branch |
| `hybrid-unguarded` | step 10 | Each update lands on both bases |
| `window-workflow-missing` (window or hybrid mode) | step 10 | There's no window to drain into. Dispatch the workflow or open the window |
| `window-without-pr`, `window-title`, `squash-only` | step 13 | The window can't merge, or can't merge correctly |

Worked around this month, fixed in the follow-up:

| Finding | Worked around by |
| --- | --- |
| `multiple-windows` | Step 5 |
| `strict-conflicted`, `stale-results` | Step 7 |
| `review-per-pr` | Requesting a review on each PR |

## Findings

### Windows

| id | Severity | Means | Fix | Lives in |
| --- | --- | --- | --- | --- |
| `multiple-windows` | blocks | More than one `maintenance/*` branch is open. Renovate raises every update against each one | Procedure step 5: compare by tree, salvage, retire, until one is left | Repo (branches) |
| `window-without-pr` | blocks | A window has no PR into the default branch, so nothing reviews or merges it | Open the PR. For the current month, re-run `maintenance.yml` with `workflow_dispatch`, which is idempotent | Repo; see `window-workflow-copied` |
| `window-title` | blocks | The window PR's title isn't a conventional commit, and a PR-title check rejects it | Retitle it per [`commit-and-release`](../../commit-and-release/SKILL.md) before merging | Repo (this PR). Shared follow-up: `linchpin/actions` `maintenance.yml` titles it `Maintenance/YYYY-MM` |
| `window-name` | wastes | A branch like `maintenance/2026-09-2` doesn't match `maintenance/YYYY-MM` | Fold its PRs into the real window, then delete it. `auto-merge-maintenance` ignores any other shape | Repo |
| `orphaned-windows` | wastes | Windows exist, but Renovate doesn't target them (direct mode) | Adopt the hybrid routing below, or stop the workflow opening windows. Don't leave both half-on | Repo |
| `stranded-security` | blocks | A window holds `[SECURITY]` commits that never reached the default branch, so the site is unpatched | Procedure step 4, before anything is closed | Repo |
| `duplicate-topics` | wastes | The same Renovate topic is open against several bases | Closes with its stale window (step 5). If it's live on two bases, the routing is wrong; see `hybrid-unguarded` | Repo |
| `window-pr-closed` | info | A window's PR was closed unmerged | Read the closing comment. It may say why the window was abandoned, or name the PR that salvaged it | — |
| `orphaned-renovate-branches` | wastes | `renovate/*` branches with no open PR, usually left over from retired windows | Delete them once their window is retired. Don't delete one whose PR is open | Repo (branches) |
| `window-unchecked` | info | PRs into the window run no checks, so the batch is verified only at the window PR | Expected under this model. Step 12 is where verification happens, so don't skip it | — |

### Routing

| id | Severity | Means | Fix | Lives in |
| --- | --- | --- | --- | --- |
| `window-takes-majors` | wastes | Everything, majors included, targets the window | Hybrid routing, below | Repo now; preset later |
| `hybrid-unguarded` | blocks | Renovate targets both the default branch and the window, but nothing keeps majors off the window, so each update lands twice | Add both `matchBaseBranches` rules from the snippet below | Repo |
| `direct-routing` | info | Renovate targets the default branch, so every PR needs its own review and its own up-to-date run | Hybrid routing, when the team is ready. The pass runs either way | Repo |
| `deprecated-preset` | wastes | The repo extends `github>linchpin/renovatebot-automerge-config` | Extend `github>linchpin/renovatebot-config:automerge` instead | Repo |

### Merging

| id | Severity | Means | Fix | Lives in |
| --- | --- | --- | --- | --- |
| `strict-conflicted` | blocks | The default branch requires PRs to be up to date, and `rebaseWhen` is `conflicted`. A PR that falls behind is never rebased, so automerge never fires | Remove the repo-level `rebaseWhen` (the default is `auto`) or set it to `behind-base-branch`. Until then, rebase through step 7 | Repo `renovate.json` |
| `stale-results` | blocks | Several red bot PRs are behind their base, so their checks ran against old code | Procedure step 7 before step 8 | — |
| `human-edited-branch` | wastes | Someone pushed to a Renovate branch, often by merging `main` in, and Renovate won't rebase it again | Take ownership and merge promptly. Or tick its entry under the Dependency Dashboard's *PR Edited (Blocked)* heading, which discards the extra commits and rebuilds the branch. **Don't close it**: Renovate ignores a closed update, and only grouped "immortal" PRs come back | — |
| `review-per-pr` | blocks | Direct mode with required reviews: every bot PR needs an approval. With last-push approval on, each rebase resets it, and whoever pushed can't approve | Hybrid routing, which moves the review to one window PR a month. Until then, request a review on each PR | Repo |
| `split-group` | wastes | Non-major PRs move the same dependency in different files. A required consistency check fails on each one alone | Fix the grouping on the default branch: a later `packageRules` entry's `groupName` usually overrides the earlier group. Procedure step 9 has the workaround | Repo `renovate.json` |
| `squash-only` | blocks | The repo allows only squash merges, so a window can't land one commit per group | Allow merge commits, or rebase merges, in the repo settings before merging a window | Repo settings |
| `auto-merge-off` | wastes | "Allow auto-merge" is off, so neither Renovate nor GitHub can merge anything automatically | Turn it on in Settings → General | Repo settings |

### Workflows

The caller YAML for all three shared workflows is in the
[`linchpin/actions` README](https://github.com/linchpin/actions#readme), which owns it. It isn't
restated here.

| id | Severity | Means | Fix | Lives in |
| --- | --- | --- | --- | --- |
| `window-workflow-missing` | blocks | Nothing opens the monthly window | Add the `maintenance.yml` caller | Repo |
| `window-workflow-copied` | wastes | `maintenance.yml` is a local copy. Most copies push a bare branch and open no PR | Replace it with the caller of `linchpin/actions/.github/workflows/maintenance.yml@v4` | Repo |
| `window-merger-missing` | wastes | Nothing merges green PRs into the window. Renovate won't automerge where no checks run unless `ignoreTests` is set | Add the scheduled `auto-merge-maintenance.yml@v4` caller. It merges only into `maintenance/YYYY-MM`, never the default branch, and skips anything labelled `major` | Repo |
| `auto-approve-missing` | wastes | Window branches require a review, and nothing approves the bot PRs, or the caller only triggers on PRs into `main` | Point the `auto-approve-maintenance.yml` caller's `pull_request.branches` at `maintenance/**`. The shared job ignores any other base | Repo |

### Bots

| id | Severity | Means | Fix | Lives in |
| --- | --- | --- | --- | --- |
| `dependabot-security-prs` | wastes | Dependabot's security-update PRs are on beside Renovate. They edit only lockfiles, and duplicate `lockFileMaintenance` | Switch off the PR opener and keep the alerts. The command and the reasoning belong to [`dependency-updates`](../../dependency-updates/SKILL.md) | Repo settings |
| `open-alerts` | blocks if high or critical runtime, else info | Dependabot alerts open on the default branch | Runtime high or critical: procedure step 4. Development-only: the batch or `lockFileMaintenance` usually clears them. Re-read after the drain | — |
| `two-bots` | wastes | Dependabot PRs are open on a Renovate repo | Procedure step 6, then `dependabot-security-prs` | — |

## Hybrid routing — the repo-level config

This is interim. It belongs in `renovatebot-config` as a preset. Until that ships, add it to
the repo's own `renovate.json`, with `main` replaced by the repo's actual default branch.
Renovate reads its config **only from the default branch**, so the change has to land there
before it does anything.

```json
{
  "baseBranchPatterns": ["$default", "/^maintenance\\/\\d{4}-\\d{2}$/"],
  "packageRules": [
    {
      "description": "Majors never ride in the window: each is its own reviewed PR to the default branch, so one breaking major cannot strand the batch.",
      "matchBaseBranches": ["/^maintenance\\//"],
      "matchUpdateTypes": ["major"],
      "enabled": false
    },
    {
      "description": "Non-majors and lock-file maintenance stack on the window, where one review merges the month, not on the default branch.",
      "matchBaseBranches": ["main"],
      "matchUpdateTypes": ["minor", "patch", "pin", "digest", "pinDigest", "lockFileMaintenance"],
      "enabled": false
    }
  ]
}
```

What each piece relies on, all checked against Renovate's configuration docs in September 2026:

- **`baseBranchPatterns`** accepts `$default` and `/regex/`. Renovate processes each matching
  branch independently, which is why a stale window collects its own copy of every update. The
  anchored `\d{4}-\d{2}$` keeps `maintenance/2026-09-2` out.
- **`matchBaseBranches`** plus **`enabled: false`** is Renovate's documented way to switch
  updates off for one base branch. The `$default` keyword is documented for
  `baseBranchPatterns`, but not for `matchBaseBranches`, which is why the second rule names the
  branch.
- **`lockFileMaintenance`** is an update type, so `matchUpdateTypes` can route it.
- **Repo rules run after preset rules**, so these win over the preset's groups. Keep them
  **after** any repo rule that could re-enable a package.
- **Security fixes.** Renovate raises them per base branch like any other update. Its docs
  don't say whether an `enabled: false` rule suppresses them on the default branch. After the
  first run, check the Dependency Dashboard. Either way, procedure step 4 and
  `dependency-updates`' security case ship them ahead of the batch.
- **Between windows** — after one merges and before the 1st — non-majors pause. That's
  intended: the next window collects them.

Validate before merging it:
`npx --yes --package renovate -- renovate-config-validator --no-global renovate.json`.
Then confirm on the Dependency Dashboard after Renovate's next run: majors listed against
the default branch, non-majors against the window, and nothing against both.
