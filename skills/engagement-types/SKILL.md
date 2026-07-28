---
name: engagement-types
description: Work out what kind of Linchpin work a request is — a support request, recurring site maintenance, a scoped project, product/plugin development, or pre-sales — because each is planned, tracked, and finished differently, and each lives in a different ClickUp space and folder. Use when picking up unfamiliar work, when deciding where a task belongs, when a request may be out of scope for a retainer, or when planning work for a client with multiple sites. Baseline map, refined with the team over time.
version: 0.1.0
---

# Engagement types

The same technical change is run completely differently depending on the engagement it sits
in. A CSS fix is a 20-minute support ticket on one client and a line item in a scoped
redesign on another. **Getting the type wrong is how work gets done off-budget, tracked in
the wrong place, or shipped without the right approvals.**

This is a baseline map of how we actually work today — expect the team to sharpen it.

## When to use

- Picking up work on a client you don't know well.
- Deciding where a task belongs in ClickUp before creating it.
- A request may exceed what a retainer or support agreement covers.
- Planning work for a client with several sites.
- The same change needs to reach many clients (a shared plugin or block).

**Not this skill:** the mechanics of resolving, creating, and updating a task —
[`task-tracking`](../task-tracking/SKILL.md). Running a support request —
[`support-triage`](../support-triage/SKILL.md). Choosing a technical approach —
[`wp-implementation-choice`](../wp-implementation-choice/SKILL.md).

## Owns

Canonical for: the engagement taxonomy, where each type lives, and how each is planned and
closed. Task mechanics belong to `task-tracking`.

## How the workspace is shaped

- **A ClickUp space is a client or a product** — one space per client account, plus product
  spaces for the things we build and ship ourselves, the internal Linchpin space, and a
  pipeline space for prospects.
- **A folder is an engagement** within that client — `Support Requests`,
  `<Site> Site Maintenance`, `Q3/Q4 2026 Tasks & Projects`, `Sprint Folder`.
- **Clients with several sites get a maintenance folder per site.** "Which site?" is a
  required question on those accounts, not a detail to infer.
- Templates exist for the common shapes (support requests, project proposals, site
  redesigns) — start from one rather than inventing structure.

## The five types

| Type | Looks like | Lives in | Planned by | Done when |
| --- | --- | --- | --- | --- |
| **Support request** | Reactive, small, "this is broken / please change this" | Client space → `Support Requests` | Triaged per request against the agreement | Fixed, verified, and the requester is told |
| **Site maintenance** | Recurring, planned — updates, backups, monitoring, small improvements | Client space → `<Site> Site Maintenance`, dated by year | A recurring cadence per site | The period's work is complete and reported |
| **Project** | Scoped, has a start and end — redesign, migration, audit, reorg | Client space → dated `Tasks & Projects` or a named project folder | An SOW or proposal, then phases | Scope delivered and accepted |
| **Product / plugin** | Versioned code we ship to many clients | Product space → `Sprint Folder`, `Backlog Management`, module folders | Sprint and backlog | Released via release-please and adopted |
| **Pre-sales** | Estimating work not yet sold | `Prospects`, or `Scope of Work` / `Digital Proposal` | Discovery | Proposal delivered |

## What changes with the type

**Support** — the crux is *scope*, not difficulty. Before starting, decide whether it fits the
agreement or is really a small project, and say so early. Run it with
[`support-triage`](../support-triage/SKILL.md).

**Maintenance** — the work is predictable and the risk is regression on a live site. Updates
land through the normal pipeline with QA, never by editing the server
([`dependency-updates`](../dependency-updates/SKILL.md),
[`web-qa`](../web-qa/SKILL.md)).

**Project** — the SOW is the boundary. Anything outside it is a change request, not a favor.
Track phases so status is answerable without reading the whole task list.

**Product / plugin — the important one.** A change to a shared plugin or block reaches
**every client using it**, so the blast radius is the whole roster rather than one site.
That means: no client-specific behavior in shared code, real regression thinking before
release, and a version bump through release-please rather than a hand-edit
([`wp-block-conventions`](../wp-block-conventions/SKILL.md),
[`commit-and-release`](../commit-and-release/SKILL.md)).

**Pre-sales** — estimates are not commitments, and discovery work isn't billable delivery.
Keep it out of client delivery folders.

## Placing the work

1. **Space** = the client or product. Infer from the repo, but confirm on multi-brand
   accounts.
2. **Folder** = the engagement type above. For multi-site clients, the *specific site*.
3. **List** = the folder's working list.
4. If nothing fits, ask rather than inventing a folder — structure is shared across the team.

Then hand off to [`task-tracking`](../task-tracking/SKILL.md) to resolve or create the task.

## Guardrails

- **Never start substantial work without knowing which engagement pays for it.** "It's only
  20 minutes" is how retainers quietly become unlimited.
- **Never let a support request grow into a project silently.** When the fix turns out to be
  structural, stop and say so — that's a scoping conversation, not a longer ticket.
- **Never put client-specific behavior into shared product code** to close a support ticket
  faster; it becomes everyone's maintenance burden.
- **Never assume which site** on a multi-site client. Ask, and put it in the task title.
- **Never create folders or lists** to fit one task — the structure is shared.
- **Never treat pre-sales estimates as scope.** Sold scope lives in the SOW.

## Done

- [ ] Engagement type named, and it matches how the work will actually be run.
- [ ] Space, folder, and site identified — confirmed, not inferred, on multi-site clients.
- [ ] Scope checked against the agreement; anything beyond it raised before work started.
- [ ] For shared product code, the effect on other clients was considered before shipping.
- [ ] The task lives in the right place per [`task-tracking`](../task-tracking/SKILL.md).
