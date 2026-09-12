# The stage ladder, expanded

Each rung: what lands, what must **not** land alongside it, and the exit test. The ordering
constraint is the whole point — every rung exists because doing it later costs more than
doing it now.

The target rows referenced throughout are
[`wp-plugin-standards`](../../wp-plugin-standards/SKILL.md)'s. They are never restated here.

## The rule that shapes everything

> **Mergeable, not releasable.** Stages accumulate on `main` behind a flag or a compatibility
> default. Only the release stage ships.

A migration kept on a long-lived branch stops merging. A migration that ships halfway breaks
users. The escape from both is that every stage is safe to have on `main` and invisible until
the release stage flips the default.

## Stage 0 — Safety net

**Lands:** a test suite that actually runs; a contract test per identified consumer; a
PHPStan baseline; a dead-code inventory (a list, not deletions).

**Must not land alongside:** any behavior change at all. Stage 0 is its own PR, and it does
not merge into another stage.

**Exit test:** the project's detected test command exits 0 on unchanged code, and at least one
contract test fails when you deliberately change a hook's argument shape. A suite that cannot
fail is not a safety net.

**Why first.** Every later stage's claim of "nothing broke" is only as good as this. On a
plugin with real installs it is also the only evidence you will have when someone reports a
regression three stages later.

**The contract test is the non-obvious part.** Assert hook *arity and argument shape*, not
just presence. A refactor that quietly changes what an `apply_filters` passes will keep firing
and silently hand a dependent the wrong thing.

**On baselines:** record what exists, then only shrink it. A baseline that grows to make a
stage pass has converted a gate into a formality — [`quality-gates`](../../quality-gates/SKILL.md)
owns that rule; this ladder just enforces the ordering.

## Stage 1 — Repo conformance

**Lands:** the Blocking and Standard rows from the conformance report, in this internal order,
because each unblocks the next:

1. The composer scripts the v4 callers require — the prerequisite for everything below.
2. `phpcs.xml.dist`, the coding-standards dependency, the PHPStan config.
3. Floors made consistent across *every* file that declares them — the main plugin header,
   `composer.json`, `readme.txt`, and any CI matrix. Legacy plugins routinely declare three
   different PHP floors.
4. The v4 callers themselves, replacing the split legacy workflows.
5. Docs: `wiki.yml` → `docs/` + [`docspress-publish`](../../docspress-publish/SKILL.md).

One PR per concern. Five small PRs review in an afternoon; one big one does not get reviewed.

**Must not land alongside:** product code. This whole stage is invisible to users, which is
what makes it safe to move fast on.

**Exit test:** CI on `main` is green and running the v4 reusables. The plugin behaves exactly
as it did before the stage started.

**Why before behavior.** Stage 2 onward is judged by CI. Changing code while CI is still the
old hand-rolled pipeline means every failure has two candidate causes.

## Stage 2+ — Behavior, one seam at a time

**Lands:** one architectural seam per stage, in the plan's dependency order, each behind a
flag or a compatibility default.

**Must not land alongside:** another seam. The temptation is always to fix the adjacent thing
while you are in there; that is what makes a stage unreviewable and unrevertable.

**Exit test:** the stage's PR is green on Stage 1's gates, **and** the currently shipped
version still works — which you check by running it, not by reasoning about it.

**Sizing rule.** If a stage cannot be described in one sentence without "and", it is two
stages. If it cannot be reverted by reverting one PR, it is too big.

## The release stage

**Lands:** the compatibility decision, the upgrade rehearsal, then the major.

**The upgrade rehearsal is the rung people skip.** Install the *shipped* version clean,
configure it the way a real site would, then upgrade in place. Assert two things separately:

- an existing install is unchanged — including that any new default did **not** apply to it;
- a fresh install gets the new behavior.

Those are different assertions and a migration that only checks the second is how upgraded
sites silently change behavior.

Then hand to [`commit-and-release`](../../commit-and-release/SKILL.md), which owns the major
itself.

## Cross-cutting rules

**Out-of-band fixes branch from `main`.** A security or urgent fix for the shipped line never
goes onto the migration branch — it ships from `main` on the old version. Record in the plan
that the fix now exists in two places and will conflict; a conflict you predicted is
bookkeeping, one you did not is an incident.

**Floors are a coordinated change, not an edit.** Raising `Requires PHP` or
`Requires at least` means sites below the new floor stop receiving updates — silently, from
their point of view. That needs a major version, an upgrade note, and for a paid or client
plugin, a heads-up before the release rather than after.

**A dependent plugin is part of the blast radius.** If a sibling declares
`Requires Plugins: <this plugin>`, it is pinned to this plugin's surface. Modernizing the base
while the dependent ships against the old contract means doing the work twice — sequence the
base first, and tell whoever owns the dependent.

**When a stage reveals the plan was wrong**, edit the plan in the same PR, with the date and
who decided. A plan that only ever gets appended to stops being read.
