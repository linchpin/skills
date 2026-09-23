---
title: docspress-publish
---

DocsPress does not write documentation. It is a sync action: it reads Markdown out of `docs/` and creates or updates WordPress Pages from it. Content comes from the upstream generator; this skill owns where it lands. Every project publishes into one shared page tree on docs.linchpin.com, so a misconfigured sync can treat another project's pages as removed documentation and trash them.

## When to reach for it

- A project has no published documentation, or docs that live only in the repo.
- Someone asks to "set up docspress", "publish the docs", "get these on the docs site".
- A sync-docs run fails, publishes to the wrong place, or trashes pages it does not own.
- You are adding a second (third, tenth) repo to the shared docs site.

## Where it stops

> **Not this skill:**
>
> - **Writing the docs** → upstream `generate-docs-from-source` (see [What it checks first](#what-it-checks-first)).
> - **Committing and opening the PR** → [`commit-and-release`](commit-and-release.md) and [`task-tracking`](task-tracking.md).
> - **Operating the docs site itself** (its theme, its database) → [`wp-pressable`](wp-pressable.md). `docs.linchpin.com` is a subsite of the Linchpin multisite; this skill never touches it directly, only pushes to it.

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Confirm the generator is present","content":"<p>Check that generate-docs-from-source, vendored from the linchpin/docspress fork, is installed, and fetch it if it's missing. The fork matters because it reads the per-repo brief that upstream's generator ignores.</p>"},{"title":"Shape the tree","content":"<p>Put the repo's docs under a subdirectory named for the repo, since anything else under docs/ publishes too.</p>"},{"title":"Generate the content","content":"<p>Hand off to generate-docs-from-source, after writing .docspress/brief.md so it knows this repo's shape, required pages, and acceptance checks.</p>"},{"title":"Add the workflow","content":"<p>Copy the sync-docs.yml template in and set managed-path to scope deletion to this repo alone, not the whole shared root.</p>"},{"title":"The token","content":"<p>WP_ACCESS_TOKEN is an organisation secret, already available. There is normally nothing to provision, and its absence from a repo secret listing proves nothing.</p>"},{"title":"Verify locally","content":"<p>Before any run, check that blocks parse as JSON, links and anchors resolve, and the pinned converter round-trips the tree cleanly.</p>"},{"title":"Promote one rung at a time","content":"<p>Dry run, then real writes as drafts, then publish, then, only later, the push trigger — reviewing the Actions summary before each step.</p>"}]} /-->

| Rung | Change | Confirms |
| --- | --- | --- |
| 1 | Run as-is (dry run, draft) | Planned create/update/delete counts |
| 2 | Turn off dry run | Pages exist as drafts; the tree is right |
| 3 | Set status to publish | Content and hierarchy are public |
| 4 | Add the push trigger | Ongoing sync, only once approved |

## What it checks first

Reads the git remote to get the repo slug, `docs/` to see what already exists, whether `.github/workflows/sync-docs.yml` is already wired, and `.docspress/brief.md` for what this repo's docs must contain. A `gh secret list --repo` only shows repository-level overrides — it says nothing about `WP_ACCESS_TOKEN`, which is an organisation secret and normally already there. It doesn't call `project-context`; it derives repo identity itself from the git remote.

## What it owns

Canonical for: the docs.linchpin.com target configuration, the pinned fork and why it is not upstream, `managed-path` ownership scoping, how `WP_ACCESS_TOKEN` is scoped, the per-repo `.docspress/brief.md` contract, and the promotion ladder. Defers documentation content and block selection to `generate-docs-from-source`, and commits, PRs, branch, and task to `commit-and-release` and `task-tracking`.

## Guardrails

- Never SHA-pin `linchpin/docspress`. It is our own fork, behind branch protection — use `@v1`, which moves forward as fixes land.
- Never add, mint, or move `WP_ACCESS_TOKEN` yourself. Report its absence and let the repo owner provision it.

<!-- wp:docspress/callout {"tone":"warning","title":"First run can trash another project's pages","content":"<p>Never enable a push trigger, turn off dry-run, or set status to publish in the same change that adds the workflow. Never widen managed-path to root-slug — that hands this repo ownership of every sibling project's pages. If a dry run reports deletions you cannot account for, stop and report rather than writing.</p>","collapsible":false} /-->

<!-- wp:docspress/callout {"tone":"warning","title":"Reconcile mode needs sign-off","content":"<p>Never enable mode: reconcile without explicit sign-off and a loop guard. Merging the action's own sync branch produces a push that syncs back forever.</p>","collapsible":false} /-->

## Done when

- [ ] `.docspress/brief.md` exists, outside `docs/`, and every acceptance check in it was reported as met.
- [ ] Docs live under `docs/<repo-slug>/`; nothing publishable sits at the root of `docs/`.
- [ ] Every page has a frontmatter `title:` and no H1 in the body.
- [ ] `.github/workflows/sync-docs.yml` exists, `actions/checkout` SHA-pinned and `linchpin/docspress@v1`, inputs validated against that revision's `action.yml`.
- [ ] `managed-path` is `<root-slug>/<repo-slug>` and matches the directory on disk.
- [ ] Local verification passes: blocks parse, links resolve, converter round-trips clean.
- [ ] Workflow is still `workflow_dispatch`-only with `dry-run: true` and `status: draft`.
- [ ] First dry run reviewed — delete count accounted for.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/docspress-publish/SKILL.md) is the whole skill's entry point.
- [`references/sync-docs-workflow.md`](https://github.com/linchpin/skills/blob/main/skills/docspress-publish/references/sync-docs-workflow.md) — the `sync-docs.yml` template to copy in, plus the push-trigger and reconcile-mode add-ons and how to verify the pins.
- [`references/vendoring.md`](https://github.com/linchpin/skills/blob/main/skills/docspress-publish/references/vendoring.md) — why `generate-docs-from-source` is vendored and `docspress-install` is not, and how to fetch either directly.
- [`references/verification.md`](https://github.com/linchpin/skills/blob/main/skills/docspress-publish/references/verification.md) — three read-only checks, block JSON, links and anchors, and the converter round-trip, to run before the first dry run.

Pre-approved, so the agent can run them without a prompt: reading and searching files, `git remote get-url`, and `gh secret list`. Anything that writes — including the workflow run itself — still asks.

## Related skills

- [`../upstream.md`](../upstream.md) (`generate-docs-from-source`) — writes the actual documentation content this skill publishes.
- [`commit-and-release`](commit-and-release.md) — commits the docs and opens the PR.
- [`task-tracking`](task-tracking.md) — the branch and task this work is tied to.
- [`wp-pressable`](wp-pressable.md) — operates docs.linchpin.com itself, since this skill only pushes to it.
