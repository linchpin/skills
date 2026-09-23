---
title: agent-capabilities
---

Skills and MCP servers are loaded by the harness, not the model, before the first message — every installed skill spends its description on every session, and every connected MCP server spends its full tool schemas. The rule this skill enforces: a project loads what it uses, once.

## When to reach for it

- Context feels consumed before you have typed anything.
- A skill appears twice in the skills list — a real symptom with a real cause.
- Deciding where a new MCP server belongs: this repo, or every repo.
- Onboarding a repo, or handing one to someone else.
- Someone asks "which skills/servers should this project have?"

## Where it stops

> **Not this skill:** authoring or reviewing a skill's content — [`write-a-linchpin-skill`](write-a-linchpin-skill.md). Identifying the project's shape — [`project-context`](project-context.md), whose orientation pass this extends.

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Audit the skill installs","content":"<p>Every skills directory an agent finds gets loaded, with no dedupe by name, so the same skill at two scopes is loaded and billed twice per session. The installer's <code>--check</code> flag reports each directory, its scope, and any overlap.</p>"},{"title":"Decide the skill set for this project","content":"<p>Keep only <code>task-tracking</code>, <code>commit-and-release</code>, and <code>project-context</code> at user-global scope. Anything stack-specific belongs at project scope only, or it loads on every repo forever.</p>"},{"title":"Decide the MCP servers for this project","content":"<p>Server schemas cost more than skill descriptions, so derive the server set from the actual work rather than what happens to be configured, and prefer project scope (<code>.mcp.json</code>, committed) over user scope.</p>"},{"title":"Make the decision stick","content":"<p>Record the intended set three ways: a committed <code>.mcp.json</code>, a line in the project's <code>CLAUDE.md</code>/<code>AGENTS.md</code>, and optionally a <code>SessionStart</code> hook that reruns <code>--check</code> automatically.</p>"}]} /-->

## What it checks first

Before deciding anything, it orients with `project-context`, then reads what's actually loaded: `npx @linchpinagency/skills --check` (every skills directory this agent reads, and any duplicates) and `claude mcp list` (configured servers and their scope).

## What it owns

Canonical for which capabilities a project should load and at what scope, and the MCP-server-per-project decision. It deliberately does not own detecting duplicate skill installs — the installer's `--check` does that — or what any individual skill or server does.

## Guardrails

<!-- wp:docspress/callout {"tone":"warning","title":"Never rm -rf a whole skills directory","content":"<p>Those directories hold skills from several sources. Remove the specific duplicated skill directories instead — <code>--check</code> prints the exact list.</p>","collapsible":false} /-->

- Never hand-edit skills inside a consuming project's `.claude/skills/` — the installer overwrites them; change them in this library and re-install.
- Never add an MCP server at user scope to solve a one-repo problem — use `-s project` or `-s local`.
- Never remove a server or skill someone else's workflow depends on without saying so.
- Removing a server can silently disable a skill that needs it — check the dependency map before pruning.
- If you cannot tell whether a capability is used, leave it and say so; a silent prune is worse than an under-load.

## Done when

- [ ] `--check` reports no cross-scope duplicates, or the remaining ones are deliberate.
- [ ] Every installed skill could plausibly fire in this repo.
- [ ] Stack-specific skills are at project scope, not user scope.
- [ ] The MCP server set was derived from the repo's work, not inherited.
- [ ] Project-scoped servers are in a committed `.mcp.json`.
- [ ] The intended set is recorded where the next person will see it.
- [ ] Nothing was pruned that a skill still depends on.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/agent-capabilities/SKILL.md) is the skill's main file.
- [`references/mcp-scoping.md`](https://github.com/linchpin/skills/blob/main/skills/agent-capabilities/references/mcp-scoping.md) — which MCP servers a project needs, the three scopes an install can live at, and where each one belongs.
- [`references/skills-audit.md`](https://github.com/linchpin/skills/blob/main/skills/agent-capabilities/references/skills-audit.md) — why skill installs collide across scopes, and the session hook that surfaces it.

Pre-approved, so the agent can run it without a prompt: reading and searching files, and `npx @linchpinagency/skills --check`. Anything else still asks.

## Related skills

- [`write-a-linchpin-skill`](write-a-linchpin-skill.md) — owns authoring or reviewing a skill's content, not deciding whether it should be loaded.
- [`project-context`](project-context.md) — the orientation pass this skill extends; identifies the project's shape first.
- [`task-tracking`](task-tracking.md) — one of the few skills that belongs at user-global scope, and one that can silently break if `clickup` is removed.
- [`commit-and-release`](commit-and-release.md) — named alongside `task-tracking` and `project-context` as universal, user-global skills.
