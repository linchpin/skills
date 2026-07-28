---
name: support-triage
description: Run a client support request end to end — clarify what was actually asked, reproduce it, judge urgency and whether it fits the support agreement, fix and verify it, then close the loop with the requester in their language. Use when handling a support ticket, when a client reports something broken, when triaging a support queue, or when a request might be out of scope. Baseline workflow, refined with the team over time.
version: 0.1.0
---

# Support triage

Support work is judged on two things clients actually notice: **was it understood, and were
they told what happened.** The technical fix is usually the easy part.

The two failure modes to design against: fixing the wrong thing because the report was taken
literally, and doing three hours of unscoped work because nobody stopped to ask whether it
was covered.

## When to use

- A client support request needs handling.
- Something broke on a live client site.
- Triaging a queue of open support requests.
- A request looks like it might exceed the support agreement.

**Not this skill:** deciding what kind of engagement the work belongs to —
[`engagement-types`](../engagement-types/SKILL.md). Root-causing a stubborn bug —
[`investigate`](../investigate/SKILL.md). Server operations —
[`wp-pressable`](../wp-pressable/SKILL.md).

## Owns

Canonical for: support intake, urgency assessment, the in-scope decision, and closing the
loop with the requester.

## Procedure

1. **Read the request for the underlying need.** Clients describe symptoms and often propose
   solutions ("can you make the button bigger" may mean "nobody is finding the form"). Restate
   what you think they want and what outcome would count as fixed.
   → You can state the actual problem, not just the requested change.
2. **Identify the site and environment.** On multi-site accounts this is required, never
   inferred ([`engagement-types`](../engagement-types/SKILL.md)). Confirm production URL
   versus staging. → The exact target is named in the task.
3. **Reproduce it** before theorizing — same page, same role, same browser where it matters.
   If it doesn't reproduce, that's information: ask for a screenshot, the URL, the browser,
   or the account used. → Confirmed reproduction, or a specific question back to the client.
4. **Assess urgency honestly**, from user impact rather than from the tone of the request:

   | Level | Means | Response |
   | --- | --- | --- |
   | **Site down / data at risk** | Nobody can use it, or something is leaking | Drop other work, tell the client you're on it now |
   | **Blocking** | A core task is impossible, no workaround | Same or next business day |
   | **Degraded** | Works with a workaround, or affects some users | Scheduled into the queue |
   | **Request** | Change, addition, or question | Queued and estimated |

   → A stated level the client would recognize as fair.
5. **Decide in-scope or not — before doing the work.** If it fits the agreement, proceed. If
   it's really a small project, say so *now*, with a rough estimate, and let the client decide.
   → Either work has started, or a scoping question is with the client.
6. **Fix it properly.** Code changes go through the repo and the deploy pipeline; content and
   template overrides are server-side database work
   ([`wp-pressable`](../wp-pressable/SKILL.md)). Never patch files directly on a server —
   the next deploy erases it and the bug returns looking like a regression.
   → Fix is in the right layer and will survive a deploy.
7. **Verify on the environment the client saw it on**, flushing caches first. Screenshot the
   result. → Evidence the specific reported case now works.
8. **Close the loop in the client's language.** What was wrong, what you did, anything they
   should know or do. No jargon, no commit hashes. Then update the task
   ([`task-tracking`](../task-tracking/SKILL.md)) with the technical detail for the team.
   → The client knows it's resolved; the task carries the internal record.

## Recurring symptoms

| Report | Check first |
| --- | --- |
| "The site is down" | Is it actually down, or slow, or DNS/SSL? Confirm before escalating |
| "My change didn't save" or "isn't showing" | Caching first — object, page, browser — then the edit itself |
| "It broke and we didn't change anything" | Recent deploy, plugin auto-update, or an expiring credential or certificate |
| "It looks wrong" | Get a screenshot and their browser; often browser-specific or a stale cache |
| "Emails aren't arriving" | Deliverability and the sending service before the form code |
| "Can you just quickly…" | Scope check — quick to describe is not quick to build |

## Guardrails

- **Never work outside the agreement without approval.** Doing unbilled work "to be nice"
  sets an expectation the whole team inherits.
- **Never make an undiscussed change while you're in there.** Unrequested improvements on a
  client site are unreviewed changes.
- **Never edit files directly on the server** — it's overwritten by the next deploy.
- **Never change production data without a backup** and explicit confirmation
  ([`safety-hooks`](../safety-hooks/SKILL.md) will prompt on the dangerous commands).
- **Never guess at what a client meant** on anything ambiguous and destructive — ask.
- **Never report it fixed without verifying on their environment**, cache cleared.
- **Never leave a request silent.** Even "I'm looking at it, here's what I know" is a
  response; silence is the complaint clients actually make.

## Done

- [ ] Underlying need restated and confirmed, not just the literal request.
- [ ] Site and environment identified explicitly.
- [ ] Reproduced, or a specific clarifying question sent.
- [ ] Urgency assessed on impact, and scope decided before the work began.
- [ ] Fix in the correct layer, surviving the next deploy.
- [ ] Verified on the client's environment with caches cleared, with evidence.
- [ ] Client told what happened in plain language; task updated with the technical record.
