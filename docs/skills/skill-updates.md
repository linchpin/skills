---
title: skill-updates
---

Installed skills are a snapshot — a copy in `.claude/skills/` has no idea a newer release exists, and a stale copy quietly gives last month's answer without looking wrong. This skill closes the loop: find every install, update it, say what changed. The thing people get wrong is assuming there's one install, when it's usually a user-global copy plus a project copy, or two Copilot directories, and updating only the one that printed the nudge leaves the others stale.

## When to reach for it

- A session opened with a line like `Linchpin skills 0.1.14 → 0.2.0 available`.
- Anyone asks whether the skills are current, or asks to update or upgrade them.
- A skill's instructions contradict how the repo actually works — it may just be old.
- Someone added or changed a skill in the library and the team needs it.
- Setting a project up so it tells people when skills go stale.

Things you might say that load it: "am I on the latest skills", "my skills look out of date", "re-run the installer" — or a session opening with a line saying a newer release is available.

## Where it stops

> **Not this skill:** npm and Composer dependencies — use [`dependency-updates`](dependency-updates.md). Writing or editing a skill — [`write-a-linchpin-skill`](write-a-linchpin-skill.md). Deciding which skills and MCP servers a project should carry at all — [`agent-capabilities`](agent-capabilities.md).

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Scan every install","content":"<p>Run the update checker's <code>--scan --json</code> to get every install's directory, scope, agent, version, and whether it's behind. An unreachable registry is reported as unknown, never as up to date.</p>"},{"title":"Decide, once","content":"<p>If auto-update is on, apply automatically. Otherwise ask the user to update now, always keep current, snooze, or stop asking, and map the answer onto the checker's flags rather than hand-editing config.</p>"},{"title":"Preview, then apply","content":"<p>With more than one install behind, preview the plan first — new, update, local edits will be lost, or remove — then run each install's own recorded update command.</p>"},{"title":"Verify","content":"<p>Re-scan so every install reports the new version as current; one still showing behind means its update command was never run.</p>"},{"title":"Report what changed","content":"<p>Summarize the shipped <code>CHANGELOG.md</code> between the old and new version as a few grouped bullets, naming the skills that changed and skipping release-plumbing churn.</p>"},{"title":"Offer the hook","content":"<p>If no <code>SessionStart</code> hook already checks for updates, offer to wire one into <code>.claude/settings.json</code> so the project tells the next person when it goes stale.</p>"},{"title":"Continue","content":"<p>The update is done — return to whatever the user actually asked for.</p>"}]} /-->

## What it checks first

It looks for the update checker itself before anything else — any one installed copy of `update-check.mjs` can report on all of them, so it takes the first one found across the user-global, project, and other agent directories. No stamped install at all means there's no version to know, and it says so rather than guessing.

## What it owns

Canonical for locating every install, the ask/auto/snooze decision, running the update, and reporting what changed. It defers authoring and the skill standard to `write-a-linchpin-skill`, which skills belong on a project to `agent-capabilities`, and commit and PR grammar to `commit-and-release`.

## Guardrails

<!-- wp:docspress/callout {"tone":"warning","title":"Never delete a skill directory by hand","content":"<p>Pruning is the installer's job, and it only touches directories it has stamped. A manual rm -rf in a skills directory can take out another library's skills.</p>","collapsible":false} /-->

- Never hand-edit an installed skill — the installer overwrites it on the next run; change it in the library and re-run.
- Never invent an update command — use the `updateCommand` each install recorded; dropping a flag silently reshapes someone's setup.
- Never report an unreachable registry as up to date — `latest: null` means unknown.
- Never claim a version moved without re-scanning.
- Never write preferences by editing the config file — use the flags instead.
- If an install is behind but carries no stamp, stop and ask rather than guessing its command.

## Done when

- [ ] Every install was found via `--scan`, not assumed — including other scopes and agents.
- [ ] `latest` was actually known; an unreachable registry was reported as unknown.
- [ ] The user chose (or `autoUpdate` had already chosen), and any deferral was recorded with `--snooze` / `--disable` rather than by editing config.
- [ ] Each behind install was updated with its own recorded command.
- [ ] Overwritten local edits and any downgrade were reported, not passed over.
- [ ] A re-scan shows every install current.
- [ ] What changed was summarized from the shipped `CHANGELOG.md`, or its absence was stated.
- [ ] The `SessionStart` hook exists, or was offered.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/skill-updates/SKILL.md) is the whole skill. It has no `references/` or `scripts/`.

Pre-approved, so the agent can run them without a prompt: reading and searching files. Running the update checker or the installer still asks.

## Related skills

- [`dependency-updates`](dependency-updates.md) — owns npm and Composer dependency updates, not the skills library itself.
- [`write-a-linchpin-skill`](write-a-linchpin-skill.md) — owns authoring a skill and the standard it must follow.
- [`agent-capabilities`](agent-capabilities.md) — owns deciding which skills and MCP servers a project should carry at all.
- [`commit-and-release`](commit-and-release.md) — owns commit and PR grammar for any change this work produces.
