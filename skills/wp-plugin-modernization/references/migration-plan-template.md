# Migration plan template

Copy to `docs/<version>-MIGRATION-PLAN.md` in the plugin's own repo. It lives in the repo, not
in the tracker, for one reason: **it has to be edited in the same PR as the code it
describes.** A plan in a separate system drifts the first time someone is in a hurry.

Two rules make it work:

1. **This file is canonical; the tracker is a snapshot.** Lists and tasks mirror the stages —
   they do not define them.
2. **A decision that changes is edited here, in the PR that changes it**, attributed and
   dated. The revision number bumps when the *shape* changes, not on every edit.

---

```markdown
# <Plugin> <version> — Migration Plan

> **Revision N.** <What changed since the last revision, and why. If a previous revision's
> claim turned out to be wrong, correct it inline and mark it **[corrected]** rather than
> deleting it — the wrong version is why someone made a decision.>
>
> Tracked in <tracker>: space **<Space>** → folder **<Folder>**. When a decision recorded
> here changes during implementation, update this file in the same PR.

## Context

<What is architecturally stranded, in evidence rather than adjectives. Name files and line
numbers. "The block editor is explicitly turned off — `disable_block_editor()` returns false
for `use_block_editor_for_post_type`, the CPT is `show_in_rest => false`" beats "the plugin is
old".>

<Then: where it ships, roughly how many installs, and who else depends on it. This is the
blast radius, and it is what makes the rest of the document readable by someone who did not
write it.>

**Intended outcome:** <one sentence — version, slug, floors, and the shape of the result.>

### Decisions locked in

| Question | Decision |
| --- | --- |
| Release | <in-place major on the same slug / new slug / other> |
| Floor | <WP x.y+ / PHP x.y+, up from …> |
| Compatibility | <what upgraded installs get, versus fresh ones> |
| <Question a reviewer would otherwise reopen> | <Decision> (<who>, <date>) |

<Every row that was genuinely contested gets an attribution and a date. A decision with a name
on it does not get relitigated every fortnight; one without a name does.>

## Consumers of this plugin's surface

| Consumer | What it hooks | Verified how |
| --- | --- | --- |
| <plugin / theme / client site> | <hooks, filters, REST routes> | <asked whom, or found where> |

<If this table is empty because nobody hooks it, say that explicitly — "no consumers; checked
X and Y" — rather than leaving it out. An absent table reads as an unasked question.>

## Target architecture

<What it looks like when done. Short. The stages below are the path; this is the destination,
and it is what a reviewer checks a stage against.>

## Stages

### Stage 0 — Safety net

- [ ] <what lands>

**Exit:** <the observable test>

### Stage 1 — Repo conformance

Closes these rows from the conformance report: <row ids>.

- [ ] <what lands, one line per PR>

**Exit:** CI green on `main`, running the shared workflows; behavior unchanged.

### Stage N — <one seam, describable without "and">

- [ ] <what lands>

**Kept unreleased by:** <the flag or compatibility default>

**Exit:** <the observable test>

## Verification

<Per-stage gates, plus the upgrade rehearsal: install the shipped version, configure it,
upgrade in place, and assert separately that (a) the existing install is unchanged and (b) a
fresh install gets the new behavior.>

## Tracker

| Stage | List | Notes |
| --- | --- | --- |
| 0 | <list id> | |

<Cross-cutting work that does not belong to one stage goes outside the folder. A HANDOFF task
records where things stand if this is paused — see `task-tracking`.>

## Out-of-band fixes

<Anything shipped from `main` on the old line while this migration was in flight, and where it
will conflict.>
```

---

## What makes a plan like this actually get used

**A revision header that admits error.** The strongest version of this document in practice
carries lines like *"two rev-1 claims were wrong and are corrected inline"*. A plan that only
ever accumulates confident statements stops being trusted the first time reality contradicts it.

**Decisions with names and dates.** Not for blame — so the question stays closed. An
unattributed decision gets reopened by the next person who disagrees with it.

**Evidence, not adjectives, in the Context section.** File and line references make the case
checkable. "It is a mess" is not something a reviewer can agree or disagree with.

**Stages that map 1:1 onto tracker lists.** When they diverge, people stop believing either.

**One thing this template deliberately does not carry:** the target state. What a conforming
plugin repo must contain lives in
[`wp-plugin-standards`](../../wp-plugin-standards/SKILL.md). Stage 1 cites row ids from its
report; it does not copy them, because a copy would disagree with the original within a
release.
