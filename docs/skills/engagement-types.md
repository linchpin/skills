---
title: engagement-types
---

The same technical change is run completely differently depending on the engagement it sits in. A CSS fix is a 20-minute support ticket on one client and a line item in a scoped redesign on another. Getting the type wrong is how work gets done off-budget, tracked in the wrong place, or shipped without the right approvals. This is a baseline map of how the team works today, expected to sharpen over time.

## When to reach for it

- Picking up work on a client you don't know well.
- Deciding where a task belongs in ClickUp before creating it.
- A request may exceed what a retainer or support agreement covers.
- Planning work for a client with several sites.
- The same change needs to reach many clients (a shared plugin or block).

## Where it stops

> **Not this skill:** the mechanics of resolving, creating, and updating a task — [`task-tracking`](task-tracking.md). Running a support request — [`support-triage`](support-triage.md). Choosing a technical approach — [`wp-implementation-choice`](wp-implementation-choice.md).

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"See how the workspace is shaped","content":"<p>A ClickUp space is a client or a product; a folder is an engagement within it — Support Requests, Site Maintenance, Tasks &amp; Projects. Multi-site clients get a maintenance folder per site, and templates exist for the common shapes.</p>"},{"title":"Name the type","content":"<p>Support, maintenance, project, product/plugin, and pre-sales each have their own home, planning cadence, and definition of done.</p>"},{"title":"See what changes with the type","content":"<p>Support is about scope; maintenance is about regression risk on a live site; a project is bounded by its SOW; product/plugin work has a blast radius across every client using it; pre-sales estimates are not commitments.</p>"},{"title":"Place the work","content":"<p>Work out the space from the client or product, the folder from the engagement type, and the list within it. Ask rather than invent a folder when nothing fits, then hand off to task-tracking to resolve or create the task.</p>"}]} /-->

| Type | Looks like | Lives in | Done when |
| --- | --- | --- | --- |
| Support request | Reactive, small, "this is broken / please change this" | Client space → `Support Requests` | Fixed, verified, requester told |
| Site maintenance | Recurring, planned — updates, backups, monitoring | Client space → `<Site> Site Maintenance` | The period's work is complete and reported |
| Project | Scoped, has a start and end — redesign, migration | Client space → dated `Tasks & Projects` | Scope delivered and accepted |
| Product / plugin | Versioned code shipped to many clients | Product space → `Sprint Folder` | Released via release-please and adopted |
| Pre-sales | Estimating work not yet sold | `Prospects` / `Scope of Work` | Proposal delivered |

## What it checks first

The repo or client account, to infer the ClickUp space — confirmed rather than assumed on multi-brand accounts. On a client with several sites, which site is a required question, never an inference.

## What it owns

Canonical for: the engagement taxonomy, where each type lives, and how each is planned and closed. Task mechanics belong to [`task-tracking`](task-tracking.md).

## Guardrails

- Never start substantial work without knowing which engagement pays for it — "it's only 20 minutes" is how retainers quietly become unlimited.
- Never let a support request grow into a project silently; stop and say so when the fix turns out to be structural.
- Never put client-specific behavior into shared product code to close a support ticket faster — it becomes everyone's maintenance burden.
- Never assume which site on a multi-site client. Ask, and put it in the task title.
- Never create folders or lists to fit one task — the structure is shared across the team.
- Never treat pre-sales estimates as scope. Sold scope lives in the SOW.

## Done when

- [ ] Engagement type named, and it matches how the work will actually be run.
- [ ] Space, folder, and site identified — confirmed, not inferred, on multi-site clients.
- [ ] Scope checked against the agreement; anything beyond it raised before work started.
- [ ] For shared product code, the effect on other clients was considered before shipping.
- [ ] The task lives in the right place per [`task-tracking`](task-tracking.md).

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/engagement-types/SKILL.md) is the whole skill. It has no `references/` or `scripts/`.

Pre-approved, so the agent can run them without a prompt: reading, searching, and browsing files. Anything else still asks.

## Related skills

- [`task-tracking`](task-tracking.md) — resolves, creates, and updates the task once the engagement type places it.
- [`support-triage`](support-triage.md) — runs a support request end to end.
- [`wp-implementation-choice`](wp-implementation-choice.md) — chooses the technical approach once the engagement is known.
- [`dependency-updates`](dependency-updates.md) — how maintenance updates land through the normal pipeline.
- [`web-qa`](web-qa.md) — QA for maintenance updates before they land.
- [`wp-block-conventions`](wp-block-conventions.md) — house conventions for shared product/plugin block code.
- [`commit-and-release`](commit-and-release.md) — version bump through the normal release process rather than a hand-edit, for shared code.
