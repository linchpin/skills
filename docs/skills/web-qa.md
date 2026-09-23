---
title: web-qa
---

You are the QA engineer *and* the fix engineer: click everything, fill every form, check every state — then fix what's broken, one atomic commit at a time, and prove it with before/after evidence. The discipline that makes this useful rather than noise: scope it, evidence it, fix it in isolation, re-verify it.

## When to reach for it

- "QA this", "test this", "make sure this works", "does this actually run?"
- After shipping a feature to a branch, before opening or merging the PR.
- Before handing work back to a client.
- When you want findings only, no code changes — say so, and it runs report-only.

Things you might say that load it: "click through the site", "does the form actually work", "test it like a user would".

## Where it stops

> **Not this skill:** lint, PHPCS, static analysis, unit tests — [`quality-gates`](quality-gates.md). Performance and accessibility measurement — [`wp-audit`](wp-audit.md). Root-causing one specific bug — [`investigate`](investigate.md).

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Explore like a user","content":"<p>Work the front end, /wp-admin, and the block editor where content is involved — primary flows first, then forms, empty states, error states, and mobile width.</p>"},{"title":"Record each finding with evidence","content":"<p>Capture what you did, what happened, and what should have happened, with a screenshot and any console or network error. No evidence, no finding.</p>"},{"title":"Assign severity","content":"<p>Rate each finding critical, high, medium, or low by user impact, and say plainly when something is a judgment call rather than a defect.</p>"},{"title":"Triage against the tier","content":"<p>List what you're fixing and what you're leaving before touching any code, so the user can redirect before a commit exists.</p>"},{"title":"Fix loop, one bug at a time","content":"<p>Fix in the source, run quality gates, re-test that specific flow, then commit the single fix.</p>"},{"title":"Final pass","content":"<p>Re-run the primary flows end to end to catch anything the fixes themselves broke.</p>"},{"title":"Report","content":"<p>List what was tested, findings by severity with before/after evidence, what was fixed and deliberately left, and what couldn't be tested, then update the ClickUp task.</p>"}]} /-->

Severity is about user impact, not how hard a finding is to fix:

| Severity | Means |
| --- | --- |
| Critical | Blocks a core task, loses data, or exposes something it shouldn't |
| High | A primary flow is broken or badly degraded, no reasonable workaround |
| Medium | Works but wrong or awkward; a workaround exists |
| Low | Cosmetic or minor polish |

## What it checks first

Orientation runs through [`project-context`](project-context.md) first — repo shape, environment, URL, host. Beyond that, this skill's own Preflight:

- Requires a clean working tree (`git status --porcelain` empty), so each fix lands as its own reviewable commit.
- Resolves scope: a URL or area the user named, diff-aware mode against the merge base on a feature branch with none given, or the whole app otherwise.
- Sets the tier — quick, standard, exhaustive, or report-only — which decides what gets fixed, not what gets reported.

## What it owns

Canonical for: QA scope and tiers, the explore → triage → fix → verify loop, severity, and the report format. Browser mechanics belong to [`browser-automation`](browser-automation.md); commits to [`commit-and-release`](commit-and-release.md).

## Guardrails

- Never start on a dirty tree — mixing QA fixes with in-flight work makes both unreviewable.
- Never batch unrelated fixes into one commit — a single bad fix then can't be reverted without taking the good ones with it.
- Never fix a bug by changing the database or editing files on the server — code fixes go through the repo and the deploy pipeline.
- Never claim a fix works without re-testing the exact flow that failed.
- Never expand scope silently — a refactor discovered mid-QA is a finding, not a fix.
- Never report a clean pass for an area you couldn't reach — list it as untested instead.

<!-- wp:docspress/callout {"tone":"warning","title":"No destructive testing on production","content":"<p>Deletes, bulk actions, payments, and send buttons are real in production. Test locally or on staging; if production is the only option, it's read-only and confirmed first.</p>","collapsible":false} /-->

## Done when

- [ ] Started from a clean tree; scope and tier stated up front.
- [ ] Every in-scope area actually exercised in a browser, including admin where relevant.
- [ ] Findings carry reproduction steps, severity, and evidence.
- [ ] Triage shown to the user before fixes began.
- [ ] Each fix is its own commit, gates green, and the specific flow re-tested.
- [ ] Final end-to-end pass run after the last fix.
- [ ] Report lists fixed, deliberately-not-fixed, and untested areas.
- [ ] ClickUp task updated with the outcome.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/web-qa/SKILL.md) is the skill.
- [`references/qa-checklist.md`](https://github.com/linchpin/skills/blob/main/skills/web-qa/references/qa-checklist.md) — the severity table, what to exercise per project type (general, WordPress, Cloudflare Workers/API), diff-aware scoping, and the report template.

`allowed-tools` pre-approves reading and searching files, plus `git status --porcelain` and `git diff --name-only` — the read-only commands this skill uses to require a clean tree and resolve diff-aware scope. Anything that writes still asks.

## Related skills

- [`quality-gates`](quality-gates.md) — owns lint, PHPCS, static analysis, and unit tests.
- [`wp-audit`](wp-audit.md) — owns performance and accessibility measurement.
- [`investigate`](investigate.md) — owns root-causing one specific bug.
- [`browser-automation`](browser-automation.md) — owns the browser mechanics this skill drives.
- [`commit-and-release`](commit-and-release.md) — owns the commit for each fix.
- [`project-context`](project-context.md) — the orientation step this skill runs first.
- [`wordpress-blocks`](wordpress-blocks.md) — where a block editor "invalid content" finding gets diagnosed.
- [`wp-studio-cli`](wp-studio-cli.md) — runs `validate_blocks` locally.
- [`wp-pressable`](wp-pressable.md) — owns the deploy pipeline a code fix goes through.
- [`task-tracking`](task-tracking.md) — the ClickUp task this skill updates when a pass finishes.
