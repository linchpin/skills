---
title: write-a-linchpin-skill
---

A skill buys predictability: the same process every run, from any agent, on any Linchpin project. It is not a prompt snippet and not documentation — it is the instruction set an agent follows when it has no other context. Two things make a skill good here: it fires at the right moment, and it matches the project it lands in.

## When to reach for it

- Adding a new skill to `skills/`.
- Reviewing a skill PR, or migrating an older skill to this standard.
- Deciding where knowledge belongs — this library, upstream, or a project repo.

## Where it stops

> **Not this skill:** writing a project's own `CLAUDE.md`/`AGENTS.md` conventions. Those are project layer — see the placement test below.

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Does it belong here at all?","content":"<p>Apply the placement test: true on a different client's project of this kind, it belongs here; generic to the technology, it belongs upstream; true on one project only, it belongs in that project's CLAUDE.md.</p>"},{"title":"Right-size the tier","content":"<p>Default to Tier A, SKILL.md only. Promote long command matrices or schemas to Tier B (references/). Reach for Tier C (scripts/) only when you can name the failure a deterministic script prevents.</p>"},{"title":"Write SKILL.md","content":"<p>Fill the fixed frontmatter and section skeleton, lead the description with the capability and at least two real triggers, and grant allowed-tools only for the read-only commands the skill actually runs.</p>"},{"title":"Name it","content":"<p>Prefix the directory by domain (wp-, react-, cf-, or none for a cross-cutting workflow), and grep sibling descriptions for a trigger collision before committing to the name.</p>"},{"title":"Ship","content":"<p>Run the validator, add the skill's row to README.md's Available skills table, bump its version if it changed, and commit through commit-and-release with the task key from task-tracking.</p>"}]} /-->

A few failure modes worth recognizing before adding files, since most fixes are edits, not new artifacts:

| Symptom | Cause | Fix |
| --- | --- | --- |
| Skill never loads | Thin or mismatched `description` | Add real user phrasing; grep siblings for collision |
| Agent stops halfway | Steps have no checkable end state | Make each step end in an observable result |
| Agent invents a path or command | Missing `## Preflight` | Add the detection step and a "tool missing" branch |
| Two skills disagree | Duplicated instruction | Delete one; link to the owner |
| Works on one repo only | Baked-in project specifics | Parameterize, or move it to that project |

## What it owns

Canonical for: the tier model, required frontmatter, the section skeleton, the four house rules, naming, and the ship checklist. Other skills should link here rather than restate any of it.

## Guardrails

- Never put client-specific values (domains, list IDs, color slugs, absolute paths) in a skill — that's the project layer, and the validator rejects host paths.
- Never duplicate upstream `WordPress/agent-skills` content here — contribute it upstream and reference it.

<!-- wp:docspress/callout {"tone":"warning","title":"Don't hand-edit installed skills","content":"<p>A consuming project's .claude/skills/ is overwritten by the installer. Change the skill here in this repo and re-run the installer instead — a local edit there is silently lost.</p>","collapsible":false} /-->

- Don't bump `upstream.json`'s pinned `ref` as a side effect of unrelated work — it changes agent behavior silently and needs its own re-test.

## Done when

- [ ] Placement test answered — it's true on any Linchpin project of this kind.
- [ ] Tier chosen deliberately; Tier C justified by a named failure mode.
- [ ] Frontmatter: `name` matches the directory, `description` leads with capability plus two or more triggers, `version` set.
- [ ] `## When to use` (with a boundary), `## Guardrails`, and `## Done` all present.
- [ ] Detection step exists for anything that touches a project.
- [ ] No duplicated instructions — ownership declared, siblings linked.
- [ ] The validator passes and `README.md` lists the skill.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/write-a-linchpin-skill/SKILL.md) is the skill.
- [`references/template.md`](https://github.com/linchpin/skills/blob/main/skills/write-a-linchpin-skill/references/template.md) — the copy-paste `SKILL.md` scaffold, plus guidance on writing checkable steps, the three-pass description, and choosing `allowed-tools`.

`allowed-tools` pre-approves reading and searching files, plus running the skill validator (`node scripts/validate-skills.mjs`) and `npm run validate`. Anything that writes still asks.

## Related skills

- [`safety-hooks`](safety-hooks.md) — its grants don't weaken its hooks: a `PreToolUse` hook still fires on a pre-approved call and can still block it, which this skill records as the proof behind its `allowed-tools` policy.
- [`task-tracking`](task-tracking.md) — owns routing every unit of work through ClickUp, one of the four house rules.
- [`commit-and-release`](commit-and-release.md) — owns the commit message grammar a finished skill ships through.
- [`wordpress-blocks`](wordpress-blocks.md) — cited as the reference Tier B skill package, where recipes and grammar are promoted to `references/`.
