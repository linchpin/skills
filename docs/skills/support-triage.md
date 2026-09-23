---
title: support-triage
---

Support work is judged on two things clients actually notice: whether it was understood, and whether they were told what happened — the technical fix is usually the easy part. It designs against two failure modes: fixing the wrong thing because the report was taken literally, and doing hours of unscoped work because nobody asked whether it was covered.

## When to reach for it

- A client support request needs handling.
- Something broke on a live client site.
- Triaging a queue of open support requests.
- A request looks like it might exceed the support agreement.

It also applies when a client has emailed or messaged about something broken, when a request arrives without a task, or when deciding whether something is urgent enough to interrupt planned work.

## Where it stops

> **Not this skill:** deciding what kind of engagement the work belongs to — [`engagement-types`](engagement-types.md). Root-causing a stubborn bug — [`investigate`](investigate.md). Server operations — [`wp-pressable`](wp-pressable.md).

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Read the request for the underlying need","content":"<p>Clients describe symptoms and often propose their own fix. Restate what you think they actually want and what outcome would count as fixed.</p>"},{"title":"Identify the site and environment","content":"<p>On multi-site accounts this is required, never inferred. Confirm production versus staging.</p>"},{"title":"Reproduce it","content":"<p>Before theorizing. If it won't reproduce, that's information — ask for a screenshot, the URL, the browser, or the account used.</p>"},{"title":"Assess urgency","content":"<p>From user impact rather than the tone of the request, against a fixed set of levels from site-down to a scheduled request.</p>"},{"title":"Decide in-scope or not","content":"<p>Before doing the work. If it's really a small project, say so now with a rough estimate and let the client decide.</p>"},{"title":"Fix it properly","content":"<p>Code changes go through the repo and the deploy pipeline; content and template overrides are server-side database work. Never patch files directly on a server.</p>"},{"title":"Verify on the client's environment","content":"<p>Flush caches first, then screenshot the result as evidence the specific reported case now works.</p>"},{"title":"Close the loop","content":"<p>Tell the client what was wrong and what was done, in plain language, then update the task with the technical detail for the team.</p>"}]} /-->

| Level | Means | Response |
| --- | --- | --- |
| Site down / data at risk | Nobody can use it, or something is leaking | Drop other work, tell the client now |
| Blocking | A core task is impossible, no workaround | Same or next business day |
| Degraded | Works with a workaround, or affects some users | Scheduled into the queue |
| Request | Change, addition, or question | Queued and estimated |

## What it checks first

Identifies the exact site and environment explicitly on multi-site accounts, then works through a table of recurring symptoms before deeper diagnosis:

| Report | Check first |
| --- | --- |
| "The site is down" | Whether it's actually down, slow, or a DNS/SSL issue — confirm before escalating |
| "My change didn't save" or "isn't showing" | Caching first — object, page, browser — then the edit itself |
| "It broke and we didn't change anything" | A recent deploy, plugin auto-update, or an expiring credential or certificate |
| "It looks wrong" | A screenshot and their browser — often browser-specific or a stale cache |
| "Emails aren't arriving" | Deliverability and the sending service before the form code |
| "Can you just quickly…" | Scope — quick to describe is not quick to build |

## What it owns

Canonical for: support intake, urgency assessment, the in-scope decision, and closing the loop with the requester.

## Guardrails

- Never work outside the agreement without approval. Doing unbilled work "to be nice" sets an expectation the whole team inherits.
- Never make an undiscussed change while you're in there. Unrequested improvements on a client site are unreviewed changes.
- Never edit files directly on the server — it's overwritten by the next deploy.
- Never guess at what a client meant on anything ambiguous and destructive — ask.
- Never report it fixed without verifying on their environment, cache cleared.
- Never leave a request silent. Even "I'm looking at it, here's what I know" is a response.

<!-- wp:docspress/callout {"tone":"warning","title":"Production data needs a backup and confirmation","content":"<p>Never change production data without a backup and explicit confirmation — safety-hooks will prompt on the dangerous commands.</p>","collapsible":false} /-->

## Done when

- [ ] Underlying need restated and confirmed, not just the literal request.
- [ ] Site and environment identified explicitly.
- [ ] Reproduced, or a specific clarifying question sent.
- [ ] Urgency assessed on impact, and scope decided before the work began.
- [ ] Fix in the correct layer, surviving the next deploy.
- [ ] Verified on the client's environment with caches cleared, with evidence.
- [ ] Client told what happened in plain language; task updated with the technical record.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/support-triage/SKILL.md) is the whole skill. It has no `references/` or `scripts/`.

Pre-approved, so the agent can run them without a prompt: reading and searching files. Anything that writes still asks.

## Related skills

- [`engagement-types`](engagement-types.md) — decides what kind of engagement the work belongs to, and is required, never inferred, for site identification on multi-site accounts.
- [`investigate`](investigate.md) — root-causes a stubborn bug when reproduction alone doesn't explain it.
- [`wp-pressable`](wp-pressable.md) — server operations, and where a template-override fix actually lands.
- [`task-tracking`](task-tracking.md) — carries the internal technical record once the client's been told in plain language.
- [`safety-hooks`](safety-hooks.md) — prompts on the dangerous commands before production data changes.
