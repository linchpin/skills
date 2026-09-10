---
name: engineering-discipline
description: Keep a change honest and small — surface assumptions instead of guessing, write the minimum code that solves the problem, touch only what the request implies, and define what "working" means before starting. Use when a task is non-trivial or ambiguous, when a diff is growing beyond what was asked, when tempted to refactor nearby code, when the requirements could be read more than one way, or when someone says to be careful, keep it minimal, or stop over-engineering.
when_to_use: Also when someone says "don't over-engineer this", "keep the diff small", "just do what I asked", "why did you change that file", "you're guessing", or "make sure it actually works" — and at the start of any change big enough that a wrong assumption would waste the whole attempt.
version: 1.0.0
allowed-tools: Read Grep Glob
license: GPL-2.0-or-later
---

# Engineering discipline

Four habits that prevent the failure modes agents fall into most: guessing instead of
asking, building more than was asked, editing more than was asked, and declaring success
without checking.

These bias toward **caution over speed**. For a typo or a one-line fix, use judgment and move
on — the ceremony would cost more than the mistake.

## When to use

- The task is non-trivial, or the requirements could be read more than one way.
- The diff is growing past what the request implies.
- You're about to refactor, rename, or reformat something you weren't asked to touch.
- You've been told to be careful, keep it minimal, or stop over-engineering.
- You're about to say "done" without having run anything.

**Not this skill:** running a project's lint, standards, and test gates —
[`quality-gates`](../quality-gates/SKILL.md). Finding the cause of a bug —
[`investigate`](../investigate/SKILL.md). Splitting work and recording it —
[`task-tracking`](../task-tracking/SKILL.md). This skill is the *disposition*; those three
are the procedures.

**"Be careful" splits two ways.** Careful about *what a command will destroy* — production,
a database, a force-push — is [`safety-hooks`](../safety-hooks/SKILL.md), which installs
hooks that actually block. Careful about *how much you change and whether it works* is this
skill. One blocks actions; this one restrains them.

## Owns

Canonical for: change discipline — scope, restraint, and what "verified" means before
claiming it.

Defers: which commands actually verify this project → [`quality-gates`](../quality-gates/SKILL.md)
(it detects the toolchain; never assume `npm test` exists); proving a bug's mechanism →
[`investigate`](../investigate/SKILL.md); commit and release grammar →
[`commit-and-release`](../commit-and-release/SKILL.md); how work is split across tasks →
[`task-tracking`](../task-tracking/SKILL.md).

## 1. Think before coding

**Don't guess. Don't hide confusion. Say the tradeoff out loud.**

- State assumptions explicitly. If one is load-bearing and you can't check it, say so *before*
  building on it.
- If a request has two plausible readings, name both. Don't silently pick one and build it.
- If there's a simpler approach than the one you were handed, say so once, then do what was
  asked unless told otherwise.
- If something is unclear, stop and name what's confusing. A question costs a minute; a wrong
  assumption costs the whole attempt.

This is house rule 1 — *detect, don't assume* — applied to the request rather than the repo.
Our projects differ, so "how it's usually done" is not evidence: read the config, then act.

**The cheap discipline:** do everything that doesn't depend on the unknown, then ask about the
part that does. Blocking on a question with nothing delivered is a last resort, for when
proceeding either way would be unsafe or would waste the work.

## 2. Simplicity first

**The minimum that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstraction for a single call site.
- No configurability, options, or extension points nobody requested.
- No error handling for states that can't occur — it reads as though they can.
- If it came out at 200 lines and 50 would do, rewrite it.

The test: **would a senior engineer reviewing this call it overcomplicated?** If yes, simplify
before shipping it.

This is the same judgment the tier model applies to skills themselves — Tier C has to name the
failure it prevents, or it drops to B. Code earns its complexity the same way.

## 3. Surgical changes

**Touch only what the request implies. Clean up only your own mess.**

- Don't "improve" adjacent code, comments, or formatting while you're in the file.
- Don't refactor what isn't broken.
- Match the surrounding style even where you'd write it differently — consistency beats your
  preference.
- Noticed unrelated dead code or a real bug elsewhere? **Mention it. Don't fix it.** Offer to
  file it via [`task-tracking`](../task-tracking/SKILL.md).

When your change orphans something, remove **what your change orphaned** — the import you made
unused, the variable nothing reads now. Not pre-existing dead code.

The test: **every changed line traces to the request.** Read `git diff` before committing and
account for each hunk. A hunk you can't justify is scope you added.

## 4. Goal-driven execution

**Define what "working" means. Then check it.**

Turn the request into something observable before starting:

| Vague | Verifiable |
| --- | --- |
| "Add validation" | "Invalid input is rejected with a message, and a test covers it" |
| "Fix the bug" | "A test reproduces it, then passes" |
| "Refactor X" | "The suite passes before and after, with no behaviour change" |
| "Make it faster" | "This request drops below Nms, measured the same way twice" |

For multi-step work, state the plan with its checks attached, so progress is legible:

```
1. <step> → verify: <observable check>
2. <step> → verify: <observable check>
```

Then **actually run them.** The verification is the project's own commands, detected rather
than assumed — [`quality-gates`](../quality-gates/SKILL.md) owns finding them. "It should
work" is not a check, and neither is a passing build when the claim was about behaviour.

Report what happened, not what you hoped: if tests fail, say so with the output; if you
skipped a step, say which. A confident "done" that hasn't been checked is the expensive
failure here, because it moves the cost onto whoever trusts it.

## Guardrails

- **Never widen scope silently.** Extra work is not a bonus — it's a diff someone has to
  review and a change nobody asked to own. Propose it; don't perform it.
- **Never invent a fact about the project.** A command, path, script, or config key that
  "should" exist gets checked first. Guessing produces confident nonsense.
- **Never claim verification you didn't do.** Say what you ran and what it printed.
- **Never touch generated files by hand** — `CHANGELOG.md`, lockfiles, `vendor/`,
  `package.json` versions. They have owners; see
  [`commit-and-release`](../commit-and-release/SKILL.md).
- **Never delete pre-existing code to make your change tidy.** Different change, different
  review.
- If a request genuinely can't be done as asked, say so plainly in a sentence and offer the
  nearest thing that can — don't quietly substitute a different deliverable.

## Done

- [ ] Assumptions were stated, and anything ambiguous was named rather than guessed.
- [ ] The change is the minimum that solves it — no speculative abstraction or options.
- [ ] `git diff` reviewed, and every hunk traces to the request.
- [ ] Orphans your change created were removed; pre-existing dead code was left alone.
- [ ] Success was defined as something observable, and it was actually run.
- [ ] The report matches what happened, including anything that failed or was skipped.

## Credits

Adapted from [Andrej Karpathy's observations on common LLM coding
mistakes](https://x.com/karpathy/status/2015883857489522876), by way of the MIT-licensed
[`karpathy-guidelines`](https://github.com/multica-ai/andrej-karpathy-skills/blob/main/skills/karpathy-guidelines/SKILL.md)
skill. The four principles are theirs; the wiring into this library's gates, guardrails, and
house rules is ours.
