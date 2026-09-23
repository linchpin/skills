---
title: wp-plugin-modernization
---

The product is already shipped, so the constraint isn't *reach the standard* — it's never be broken on the way there. That single difference is why the safety net and CI conformance both land before a line of product code changes, and why an intermediate stage is mergeable but not releasable.

## When to reach for it

- Taking over a plugin nobody has modernized, only maintained.
- Planning a major version in place on the same slug.
- A migration is in flight and stalled, or being handed between people.
- Weighing modernize-in-place against a rewrite.

Things you might say that load it: "this plugin is stranded", "nobody wants to touch this", "let's plan a major version on the same slug", "a paid plugin depends on these hooks", "the migration phases need a plan and tracker lists".

## Where it stops

> **Not this skill:** what "on the standard" actually means — every required file, header and workflow lives in [`wp-plugin-standards`](wp-plugin-standards.md) and is never restated here. Running the gates a stage must pass — [`quality-gates`](quality-gates.md). Deciding the thing should be replaced rather than modernized — [`wp-implementation-choice`](wp-implementation-choice.md). Routine dependency bumps and advisories — [`dependency-updates`](dependency-updates.md). Cutting the major itself — [`commit-and-release`](commit-and-release.md).

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Agree the outcome and the floor","content":"<p>Get a single sentence the user has said yes to — version, slug, and the PHP/WordPress floors.</p>"},{"title":"Write the plan","content":"<p>Commit docs/&lt;version&gt;-MIGRATION-PLAN.md from the house template, revision 1, in a PR that changes nothing else.</p>"},{"title":"Create the tracker shape","content":"<p>One folder for the migration and one list per stage through task-tracking, with real list ids recorded in the plan.</p>"},{"title":"Stage 0 — safety net","content":"<p>Land tests that actually run, a contract test per consumer asserting hook arity and argument shape, a recorded PHPStan baseline, and a dead-code inventory — zero behavior change.</p>"},{"title":"Stage 1 — repo conformance","content":"<p>Close the Blocking and Standard rows from the conformance report: composer scripts, phpcs.xml.dist, consistent floors, the shared workflow callers, and docs — still zero behavior change, one PR per concern.</p>"},{"title":"Stage 2+ — behavior, one seam at a time","content":"<p>Land each architectural seam behind a flag or compatibility default, in the plan's dependency order, without breaking the currently shipped version.</p>"},{"title":"Keep the plan honest","content":"<p>Edit the plan in the same PR that changes a decision, attributed and dated, bumping the revision when the shape changes.</p>"},{"title":"Route out-of-band fixes through main","content":"<p>A security or urgent fix for the shipped line branches from main, never from the migration branch, and the plan records that it now exists twice.</p>"},{"title":"Release stage","content":"<p>Install the shipped version, configure it, upgrade in place, and assert separately that existing installs are unchanged and fresh installs get the new behavior, before handing to commit-and-release for the major.</p>"}]} /-->

## What it checks first

Before proposing anything, it reads what already exists rather than assuming a clean slate:

| Reads | Tells you |
| --- | --- |
| A conformance report from `wp-plugin-standards` | The delta list every stage consumes — missing one, stop and produce it first |
| `tests/` and a real `phpunit.xml` target | Whether any safety net exists at all |
| `phpstan.neon` level and baseline size | How much accepted debt there is |
| `do_action`/`apply_filters` call sites, asked about, not assumed | The hook contract that must not break |
| `Requires Plugins` in this plugin and its siblings | Whether a dependent ships against this plugin's surface |
| `docs/*MIGRATION*.md` on any branch | Whether a migration is already in flight |
| `git branch -r` and `git log` by year | Where an out-of-band fix would branch from, and the codebase's era |

Orientation on the project's tracker space comes from [`task-tracking`](task-tracking.md).

## What it owns

Canonical for: the staging strategy that takes a legacy or inherited Linchpin plugin onto the standard without breaking a shipped product — the safety net, the stage order, the repo-committed migration-plan document, the tracker shape, and the mergeable-not-releasable rule. It defers the target state to [`wp-plugin-standards`](wp-plugin-standards.md), gates to [`quality-gates`](quality-gates.md), dependency majors to [`dependency-updates`](dependency-updates.md), and the release itself to [`commit-and-release`](commit-and-release.md).

## Guardrails

<!-- wp:docspress/callout {"tone":"warning","title":"Don't reslug, and don't raise the floor quietly","content":"<p>Never rename or re-slug a shipped plugin as modernization — a new slug is a new plugin with zero installs and no update path. Never raise <code>Requires PHP</code> or <code>Requires at least</code> without a major version and an upgrade note — sites below the new floor stop receiving updates silently.</p>","collapsible":false} /-->

- Never change behavior before the safety net exists — Stage 0 does not merge into another stage.
- Never grow a PHPStan baseline to pass a stage; it records debt, it does not absorb it.
- Never fold a security fix for the shipped line into the migration branch — it ships from `main`.
- Never restate the target state here; a second copy will disagree with the original within a release.
- Never break a hook a downstream or paid plugin consumes without a version handshake and a coordinated release.
- Never let the migration branch run long enough to stop merging — rebase or land a stage.
- Never mark a stage done because the code landed — done means its gates are green and its surfaces verified.
- If the honest answer is "this should be rewritten or replaced", say so and route to [`wp-implementation-choice`](wp-implementation-choice.md).

## Done when

- [ ] A conformance report existed before the plan, and the stages reference its rows rather than restating them.
- [ ] The outcome sentence — version, slug, floors — was agreed and is in the plan.
- [ ] `docs/<version>-MIGRATION-PLAN.md` is committed, revision-numbered, with a filled "Decisions locked in" table.
- [ ] Every consumer of this plugin's hooks was identified by asking, not assuming, and is named in the plan.
- [ ] One tracker list per stage exists, with ids recorded in the plan.
- [ ] Stage 0 landed alone; tests run, contract tests exist, the baseline is recorded.
- [ ] Stage 1 landed before any behavior change; CI now runs the shared workflows green.
- [ ] Every later stage states which flag or default keeps it unreleased.
- [ ] The plan was edited in the same PRs that changed the decisions it records.
- [ ] The upgrade path was exercised from the shipped version, not asserted.
- [ ] Out-of-band fixes shipped from `main`.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/wp-plugin-modernization/SKILL.md) is the skill's main instructions.
- [`references/README.md`](https://github.com/linchpin/skills/blob/main/skills/wp-plugin-modernization/references/README.md) — a stub noting this folder holds no additional promoted detail beyond the two files below.
- [`references/migration-plan-template.md`](https://github.com/linchpin/skills/blob/main/skills/wp-plugin-modernization/references/migration-plan-template.md) — the copy-paste migration-plan document template, and the two rules that keep it trustworthy.
- [`references/staged-ladder.md`](https://github.com/linchpin/skills/blob/main/skills/wp-plugin-modernization/references/staged-ladder.md) — stage-by-stage detail: what lands, what must not land alongside it, and the exit test for each rung.

Pre-approved, so the agent can run them without a prompt: reading and searching files, `git log`, `git branch -r`, `git shortlog`, and `gh api repos/*`. Anything that writes still asks.

## Related skills

- [`wp-plugin-standards`](wp-plugin-standards.md) — owns the target state every stage's rows come from.
- [`quality-gates`](quality-gates.md) — runs the gates a stage must pass, and owns the PHPStan-baseline rule.
- [`wp-implementation-choice`](wp-implementation-choice.md) — decides whether the plugin should be replaced rather than modernized.
- [`dependency-updates`](dependency-updates.md) — owns dependency majors, PHP floor bumps, and advisories.
- [`commit-and-release`](commit-and-release.md) — owns the commit and PR grammar, and cutting the major.
- [`task-tracking`](task-tracking.md) — creates the folder, lists, and keys for the migration's tracker.
- [`engagement-types`](engagement-types.md) — decides which space the migration's tracker belongs in.
- [`docspress-publish`](docspress-publish.md) — where Stage 1's docs migration (`wiki.yml` → `docs/`) publishes to.
- [`wp-plugin-development`](../upstream.md) — upstream skill for how the new code itself is written.
- [`wp-block-conventions`](wp-block-conventions.md) — how new block code is written once modernization reaches it.
