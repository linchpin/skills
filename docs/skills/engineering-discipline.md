---
title: engineering-discipline
---

Four habits that prevent the failure modes agents fall into most: guessing instead of asking, building more than was asked, editing more than was asked, and declaring success without checking. These bias toward caution over speed — for a typo or a one-line fix, use judgment and move on, since the ceremony would cost more than the mistake.

## When to reach for it

- The task is non-trivial, or the requirements could be read more than one way.
- The diff is growing past what the request implies.
- You're about to refactor, rename, or reformat something you weren't asked to touch.
- You've been told to be careful, keep it minimal, or stop over-engineering.
- You're about to say "done" without having run anything.

Things you might say that load it: "don't over-engineer this", "keep the diff small", "why did you change that file", "you're guessing", "make sure it actually works".

## Where it stops

> **Not this skill:** running a project's lint, standards, and test gates — [`quality-gates`](quality-gates.md). Finding the cause of a bug — [`investigate`](investigate.md). Splitting work and recording it — [`task-tracking`](task-tracking.md). This skill is the *disposition*; those three are the procedures.

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Think before coding","content":"<p>State assumptions out loud, name both readings when a request is ambiguous, and say when something is unclear rather than guessing. Do everything that doesn't depend on the unknown, then ask about the part that does.</p>"},{"title":"Simplicity first","content":"<p>Build the minimum that solves the problem — no speculative abstraction, configurability, or error handling for states that can't occur. If a senior engineer would call it overcomplicated, simplify before shipping.</p>"},{"title":"Surgical changes","content":"<p>Touch only what the request implies. Don't refactor or reformat adjacent code, and remove only what your own change orphaned. Mention a bug you noticed elsewhere — don't fix it.</p>"},{"title":"Goal-driven execution","content":"<p>Turn the request into an observable check before starting, then actually run it and report what happened, including anything that failed or was skipped.</p>"}]} /-->

Turning a request into something observable, before starting:

| Vague | Verifiable |
| --- | --- |
| "Add validation" | "Invalid input is rejected with a message, and a test covers it" |
| "Fix the bug" | "A test reproduces it, then passes" |
| "Refactor X" | "The suite passes before and after, with no behaviour change" |
| "Make it faster" | "This request drops below N ms, measured the same way twice" |

## What it owns

Canonical for: change discipline — scope, restraint, and what "verified" means before claiming it. Defers: which commands actually verify this project → [`quality-gates`](quality-gates.md) (it detects the toolchain; never assume `npm test` exists); proving a bug's mechanism → [`investigate`](investigate.md); commit and release grammar → [`commit-and-release`](commit-and-release.md); how work is split across tasks → [`task-tracking`](task-tracking.md).

## Guardrails

- Never widen scope silently — extra work is a diff someone has to review and a change nobody asked to own; propose it, don't perform it.
- Never invent a fact about the project — a command, path, script, or config key that "should" exist gets checked first.
- Never claim verification you didn't do — say what you ran and what it printed.
- Never touch generated files by hand — `CHANGELOG.md`, lockfiles, `vendor/`, `package.json` versions.
- Never delete pre-existing code to make your change tidy — that's a different change, a different review.
- If a request genuinely can't be done as asked, say so plainly and offer the nearest thing that can — don't quietly substitute a different deliverable.

## Done when

- [ ] Assumptions were stated, and anything ambiguous was named rather than guessed.
- [ ] The change is the minimum that solves it — no speculative abstraction or options.
- [ ] `git diff` reviewed, and every hunk traces to the request.
- [ ] Orphans your change created were removed; pre-existing dead code was left alone.
- [ ] Success was defined as something observable, and it was actually run.
- [ ] The report matches what happened, including anything that failed or was skipped.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/engineering-discipline/SKILL.md) is the whole skill. It has no `references/` or `scripts/`.

`allowed-tools` pre-approves only reading and searching files (`Read Grep Glob`); it runs no commands, so nothing here has a standing pre-approval to write or execute anything.

## Related skills

- [`quality-gates`](quality-gates.md) — owns which commands actually verify a project, detected rather than assumed.
- [`investigate`](investigate.md) — owns proving a bug's mechanism before it's called fixed.
- [`task-tracking`](task-tracking.md) — owns how work is split across tasks, and where to offer a noticed-but-unfixed bug instead of fixing it.
- [`commit-and-release`](commit-and-release.md) — owns commit and release grammar.
- [`safety-hooks`](safety-hooks.md) — the other half of "be careful": it blocks destructive commands; this skill restrains scope and unverified claims.
