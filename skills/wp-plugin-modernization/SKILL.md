---
name: wp-plugin-modernization
description: A staged strategy for bringing a legacy or inherited Linchpin WordPress plugin onto the current standard without breaking a shipped product — safety net before behavior, CI and tooling before code, and a repo-committed migration plan that records every decision. Use when taking over an old plugin, when asked to modernize, revamp, or "bring this plugin up to date", when a 2019-era plugin needs a major version, when weighing modernize-in-place against a rewrite, or when a migration has stalled and nobody knows which phase it is in. Not for the target state itself — use `wp-plugin-standards`.
when_to_use: Also when a plugin is described as stranded, unmaintained, or "works but nobody wants to touch it", when planning a major version on the same slug, when a paid or client plugin depends on its hooks, or when migration phases need a plan document and tracker lists.
version: 1.0.0
allowed-tools: Read Grep Glob Bash(git log*) Bash(git branch -r) Bash(git shortlog*) Bash(gh api repos/*)
---

# Modernizing an inherited plugin

The product is already shipped, so the constraint is not *reach the standard* — it is
**never be broken on the way there**. That single difference is why the safety net and the CI
conformance both land before a line of product code changes, and why an intermediate stage is
mergeable but not releasable.

## When to use

- Taking over a plugin nobody has modernized, only maintained.
- Planning a major version in place on the same slug.
- A migration is in flight and stalled, or being handed between people.
- Weighing modernize-in-place against a rewrite.

**Not this skill:** what "on the standard" actually means — every required file, header and
workflow lives in [`wp-plugin-standards`](../wp-plugin-standards/SKILL.md) and is never
restated here. Running the gates a stage must pass —
[`quality-gates`](../quality-gates/SKILL.md). Deciding the thing should be replaced rather
than modernized — [`wp-implementation-choice`](../wp-implementation-choice/SKILL.md).
Routine dependency bumps and advisories —
[`dependency-updates`](../dependency-updates/SKILL.md). Cutting the major itself —
[`commit-and-release`](../commit-and-release/SKILL.md).

## Owns

Canonical for: **the staging strategy** that takes a legacy or inherited Linchpin plugin onto
the standard without breaking a shipped product — the safety net that must exist before any
behavior changes, the order the stages run in and why, the **repo-committed migration-plan
document** that records decisions and survives a handoff, the tracker shape that mirrors it,
and the *mergeable-not-releasable* rule for intermediate stages.

Defers:

- **What the target state is** →
  [`wp-plugin-standards`](../wp-plugin-standards/SKILL.md). Every stage below points at rows
  in its report; none are restated here.
- Running the gates, and the PHPStan-baseline rule →
  [`quality-gates`](../quality-gates/SKILL.md).
- Dependency majors, PHP floor bumps, advisories →
  [`dependency-updates`](../dependency-updates/SKILL.md).
- The commit and PR grammar, and cutting the major →
  [`commit-and-release`](../commit-and-release/SKILL.md).
- Creating the folder, lists and keys → [`task-tracking`](../task-tracking/SKILL.md); which
  space they belong in → [`engagement-types`](../engagement-types/SKILL.md).
- Whether the thing should be modernized at all versus replaced →
  [`wp-implementation-choice`](../wp-implementation-choice/SKILL.md).
- How the new code is written → upstream `wp-plugin-development`,
  [`wp-block-conventions`](../wp-block-conventions/SKILL.md).

## Preflight — what am I inheriting, and is there a floor to stand on?

| Look for | Tells you | If missing |
| --- | --- | --- |
| A conformance report from [`wp-plugin-standards`](../wp-plugin-standards/SKILL.md) | The delta list every stage consumes | **Stop and produce one.** Modernizing without the delta list is how a migration becomes a rewrite |
| The repo is actually checked out | Whether anything can be estimated at all | Clone it first. Some legacy plugins exist only on the remote, or only as an unpacked backup |
| `tests/` that exists **and** a `phpunit.xml` whose target directory is real | Whether any safety net exists | No net → Stage 0 is the entire first PR and nothing else starts |
| `phpstan.neon` level, and the size of any baseline | How much accepted debt there is, and whether the level is honest | No PHPStan → Stage 0 adds it at the level the code passes today, then burns down |
| `grep -rn "do_action\|apply_filters"`, then **ask who consumes these** | The contract that must not break — a paid sibling, a client functionality plugin, a theme. This is what turns a refactor into an incident | Never assume nobody is hooking. Ask, and record the answer in the plan |
| `Requires Plugins` in this plugin, and in any sibling that names *it* | Whether a dependent ships against this plugin's surface | A dependent pinned to the old line must be coordinated, not discovered later |
| Where it ships, and roughly how many installs | Whether "in place, same slug" is available, and the blast radius | — |
| `docs/*MIGRATION*.md` on any branch | A migration is already in flight — read it before proposing anything | None → you are writing it in Stage 0 |
| `git branch -r`, and how far a long-lived branch is ahead of `main` | Where an out-of-band security fix would branch from, and how badly it will conflict later | — |
| `git log --format=%ad --date=format:%Y \| sort \| uniq -c` | The era of the codebase, and whether anyone has modernized it before | — |
| The project's space in the tracker | Where the phase lists go → [`task-tracking`](../task-tracking/SKILL.md) | Ask; never invent a space |

## Procedure — the stage ladder

**Stages are mergeable, not releasable.** Intermediate stages accumulate on `main` behind a
flag or a compatibility default; only the final stage is the release. Shipping stage 3 alone
is worse than shipping nothing.

1. **Agree the outcome and the floor in one sentence.** Version, slug, PHP and WordPress
   floors. → A single sentence the user has said yes to — e.g. *"in-place 2.0.0 on the same
   slug, floors WP 6.8 / PHP 8.2."*
2. **Write the plan** at `docs/<version>-MIGRATION-PLAN.md` from
   [`references/migration-plan-template.md`](references/migration-plan-template.md), revision 1.
   → The file exists on the working branch with a filled "Decisions locked in" table and
   numbered stages, in a PR that changes nothing else.
3. **Create the tracker shape** through [`task-tracking`](../task-tracking/SKILL.md) — one
   folder for the migration, one list per stage, cross-cutting work outside it. → The plan's
   stage table carries a real list id per stage.
4. **Stage 0 — safety net, zero behavior change.** Tests that actually run; a contract test
   per consumer found in Preflight, asserting hook arity *and* argument shape; a PHPStan
   baseline recorded and thereafter only shrinking; a dead-code inventory. → The detected test
   command exits 0 on unchanged code, and the contract test fails when an argument shape
   changes.
5. **Stage 1 — conform the repo, still zero behavior change.** Close the Blocking and Standard
   rows from the report: the composer scripts the v4 callers require, `phpcs.xml.dist`, floors
   made consistent across *every* file that declares them, then the v4 callers themselves, and
   `wiki.yml` → `docs/` + [`docspress-publish`](../docspress-publish/SKILL.md). One PR per
   concern. → CI on `main` is green and running the v4 reusables before any product code
   changes.
6. **Stage 2+ — behavior, one seam at a time**, in the plan's dependency order. Each lands
   behind a flag or a compatibility default. → Each stage's PR is green on Stage 1's gates, and
   the version currently shipped still works.
7. **Keep the plan honest.** A decision that changes is edited in the same PR that changes it,
   attributed and dated; the revision number bumps when the shape changes. →
   `git log -- docs/<version>-MIGRATION-PLAN.md` interleaves with the code commits rather than
   showing separate "update plan" commits.
8. **Out-of-band fixes branch from `main`, never from the migration branch.** → The security
   release ships on the old line, and the plan records that the same fix now exists twice and
   will conflict at merge.
9. **Release stage — compatibility, upgrade rehearsal, then the major.** Install the shipped
   version clean, configure it, upgrade in place; assert existing installs are unchanged and
   that any new default applies only to fresh ones. → A written upgrade-path result with
   evidence, then hand to [`commit-and-release`](../commit-and-release/SKILL.md).

Each rung is expanded — what lands, what must *not* land alongside it, the exit test — in
[`references/staged-ladder.md`](references/staged-ladder.md).

## Guardrails

- **Never change behavior before the safety net exists.** Stage 0 does not merge into
  another stage.
- **Never grow a PHPStan baseline to pass a stage.** It records debt; it does not absorb it
  ([`quality-gates`](../quality-gates/SKILL.md)).
- **Never fold a security fix for the shipped line into the migration branch.** It ships from
  `main`.
- **Never restate the target state here.** The rows live in
  [`wp-plugin-standards`](../wp-plugin-standards/SKILL.md); a second copy will disagree with
  the first within one release.
- **Never rename or re-slug a shipped plugin** as modernization. A new slug is a new plugin
  with zero installs and no update path — a different decision entirely
  ([`wp-implementation-choice`](../wp-implementation-choice/SKILL.md)).
- **Never break a hook a downstream or paid plugin consumes** without a version handshake and
  a coordinated release. The contract test is what makes that claim checkable.
- **Never raise `Requires PHP` or `Requires at least` without a major version and an upgrade
  note.** Sites below the new floor stop receiving updates silently.
- **Never let the migration branch run long enough to stop merging.** If `main` has moved,
  rebase or land a stage.
- **Never mark a stage done because the code landed** — done means its gates are green and its
  surfaces verified.
- If the honest answer is *"this should be rewritten or replaced"*, **say so and route to
  [`wp-implementation-choice`](../wp-implementation-choice/SKILL.md)** rather than staging a
  rewrite as a migration.

## Done

- [ ] A conformance report existed before the plan, and the stages reference its rows rather
      than restating them.
- [ ] The outcome sentence — version, slug, floors — was agreed and is in the plan.
- [ ] `docs/<version>-MIGRATION-PLAN.md` is committed, revision-numbered, with a filled
      "Decisions locked in" table.
- [ ] Every consumer of this plugin's hooks was identified by asking, not assuming, and is
      named in the plan.
- [ ] One tracker list per stage exists, with ids recorded in the plan.
- [ ] Stage 0 landed alone; tests run, contract tests exist, the baseline is recorded.
- [ ] Stage 1 landed before any behavior change; CI now runs the v4 reusables green.
- [ ] Every later stage states which flag or default keeps it unreleased.
- [ ] The plan was edited in the same PRs that changed the decisions it records.
- [ ] The upgrade path was **exercised** from the shipped version, not asserted.
- [ ] Out-of-band fixes shipped from `main`.
