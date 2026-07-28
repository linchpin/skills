---
name: web-qa
description: QA a site or app like a real user and fix what you find — explore the front end, wp-admin, and the block editor in a browser, record findings with severity and evidence, then fix each bug in its own atomic commit and re-verify. Use when asked to QA, test, or "make sure this works", after shipping a feature to a branch, before handing work to a client, or when you want a bug report without fixes (report-only mode). Not for lint or unit tests — use `quality-gates`.
version: 1.0.0
---

# Web QA

You are the QA engineer *and* the fix engineer. Click everything, fill every form, check
every state — then fix what's broken, one atomic commit at a time, and prove it with
before/after evidence.

The discipline that makes this useful rather than noise: **scope it, evidence it, fix it in
isolation, re-verify it.** A QA pass that ends in one giant commit is not reviewable, and a
finding without evidence is an opinion.

## When to use

- "QA this", "test this", "make sure this works", "does this actually run?"
- After shipping a feature to a branch, before opening or merging the PR.
- Before handing work back to a client.
- When you want findings only, no code changes — say so, and it runs report-only.

**Not this skill:** lint, PHPCS, static analysis, unit tests —
[`quality-gates`](../quality-gates/SKILL.md). Performance and accessibility measurement —
[`wp-audit`](../wp-audit/SKILL.md). Root-causing one specific bug —
[`investigate`](../investigate/SKILL.md).

## Owns

Canonical for: QA scope and tiers, the explore → triage → fix → verify loop, severity, and
the report format. Browser mechanics belong to
[`browser-automation`](../browser-automation/SKILL.md); commits to
[`commit-and-release`](../commit-and-release/SKILL.md).

## Preflight

1. **Orient** via [`project-context`](../project-context/SKILL.md) — repo shape, environment,
   URL, host.
2. **Require a clean working tree.** `git status --porcelain` must be empty, so each fix
   lands as its own reviewable commit. If it isn't, stop and offer: commit the current work,
   stash it, or abort. Never QA on top of uncommitted changes.
3. **Resolve scope**, in this order:
   - The user named a URL or area → use it.
   - On a feature branch with no URL → **diff-aware mode**: `git diff --name-only` against
     the merge base, and test what those files affect. This is the common case.
   - Otherwise → the whole app, front end and admin.
4. **Set the tier** — it decides what gets fixed, not what gets reported:

| Tier | Fixes | Use for |
| --- | --- | --- |
| Quick | Critical + high | A fast pre-PR check |
| **Standard** (default) | + medium | Normal QA |
| Exhaustive | + low/cosmetic | Pre-client-handoff polish |
| Report-only | nothing | You want the findings, not the changes |

## Procedure

1. **Explore like a user, not like a developer.** Front end *and* `/wp-admin` *and* the block
   editor where content is involved; primary flows first, then forms, empty states, error
   states, and mobile width. See
   [`references/qa-checklist.md`](references/qa-checklist.md).
   → Every area in scope has been visited, not assumed.
2. **Record each finding with evidence** — what you did, what happened, what should have
   happened, plus a screenshot and any console or network error. No evidence, no finding.
   → A reader could reproduce it without you.
3. **Assign severity** from the table in
   [`references/qa-checklist.md`](references/qa-checklist.md), and say plainly when something
   is a judgment call rather than a defect. → Each finding is critical/high/medium/low.
4. **Triage against the tier.** List what you're fixing and what you're leaving, before
   touching code. → The user can redirect before any commits exist.
5. **Fix loop — one bug at a time.** Fix in the source (never in the database or on the
   server), run [`quality-gates`](../quality-gates/SKILL.md), re-test that specific flow, then
   commit that single fix per
   [`commit-and-release`](../commit-and-release/SKILL.md). → One bug, one commit, one
   verification.
6. **Final pass.** Re-run the primary flows end to end to catch anything the fixes broke.
   → Green, or a new finding that goes back through triage.
7. **Report** — what was tested, findings by severity with before/after evidence, what was
   fixed, what was deliberately left, and what couldn't be tested. Then update the ClickUp
   task ([`task-tracking`](../task-tracking/SKILL.md)).

## Guardrails

- **Never start on a dirty tree.** Mixing QA fixes with in-flight work makes both unreviewable.
- **Never batch unrelated fixes into one commit** — a single bad fix then can't be reverted
  without taking the good ones with it.
- **Never fix a bug by changing the database or editing files on the server.** Code fixes go
  through the repo and the deploy pipeline ([`wp-pressable`](../wp-pressable/SKILL.md)).
- **Never QA destructively against production.** Deletes, bulk actions, payments, and "send"
  buttons are real there. Test locally or on staging; if production is the only option, it's
  read-only and confirmed first.
- **Never claim a fix works without re-testing the exact flow that failed.** "Should work now"
  is not verification.
- **Never expand scope silently.** A refactor discovered mid-QA is a finding, not a fix.
- **Never report a clean pass for an area you couldn't reach** — auth walls, missing test
  data, and unreachable states get listed as untested, not as passing.

## Done

- [ ] Started from a clean tree; scope and tier stated up front.
- [ ] Every in-scope area actually exercised in a browser, including admin where relevant.
- [ ] Findings carry reproduction steps, severity, and evidence.
- [ ] Triage shown to the user before fixes began.
- [ ] Each fix is its own commit, gates green, and the specific flow re-tested.
- [ ] Final end-to-end pass run after the last fix.
- [ ] Report lists fixed, deliberately-not-fixed, and untested areas.
- [ ] ClickUp task updated with the outcome.
