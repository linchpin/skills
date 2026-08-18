---
name: agent-capabilities
description: Right-size what an agent loads on a project — audit skill installs for cross-scope duplicates, work out which MCP servers this repo actually needs, and scope them so every session stops paying for all of them. Use when context feels full before any work starts, when the same skill appears twice in the skills list, when deciding whether an MCP server belongs globally or in one repo, when onboarding a repo, or when someone asks which skills or servers a project should have. Not for writing a skill — use `write-a-linchpin-skill`.
version: 1.0.0
---

# Agent capabilities

Skills and MCP servers are loaded by the **harness, not the model**, and they are loaded
*before* the first message. Every installed skill spends its `description` on every session;
every connected MCP server spends its full tool schemas. Neither is free, and neither asks
permission.

That cost is invisible until you look for it, which is why it drifts. The failure mode is
not one bad skill — it is thirty fine skills installed at two scopes and nine MCP servers
where a repo needed two.

**The rule this skill enforces:** a project loads what it uses, once.

## When to use

- Context feels consumed before you have typed anything.
- A skill appears **twice** in the skills list — a real symptom with a real cause.
- Deciding where a new MCP server belongs: this repo, or every repo.
- Onboarding a repo, or handing one to someone else.
- Someone asks "which skills/servers should this project have?"

**Not this skill:** authoring or reviewing a skill's content —
[`write-a-linchpin-skill`](../write-a-linchpin-skill/SKILL.md). Identifying the project's
shape — [`project-context`](../project-context/SKILL.md), whose orientation pass this
extends.

## Owns

Canonical for: **which** capabilities a project should load and **at what scope**, and the
MCP-server-per-project decision.

Deliberately **not** owned here:

- *Detecting* duplicate skill installs — the installer owns that (`--check`, below). This
  skill decides what to do about the answer.
- What any individual skill or server *does* — that's its own skill.

## Preflight

Orient first ([`project-context`](../project-context/SKILL.md)) — the right capability set
follows from the project's shape, not its name. Then read what is actually loaded:

```bash
npx @linchpinagency/skills --check   # every skills dir this agent reads, and any duplicates
claude mcp list                      # configured servers and their scope
```

`--check` installs nothing and exits non-zero when duplicates exist, so it also works as a
CI or hook check.

## Procedure

### 1. Audit the skill installs

Agents load **every** skills directory they find and **do not dedupe by name**. The same
skill at two scopes is listed twice and billed twice, every session.

`--check` reports each directory, its scope, and the overlap. Three scopes collide in
practice — user-global, project, and a stray install in a *parent* directory (running the
installer from a checkouts folder instead of inside a repo). Details, per-agent directory
map, and the remediation commands: [`references/skills-audit.md`](references/skills-audit.md).

Resolve to **one scope per skill**. The installer now refuses a colliding install rather
than silently creating the second copy.

### 2. Decide the skill set for this project

Global is the wrong default for anything stack-specific. A WordPress skill installed
globally is loaded on every Workers repo you open, forever.

| Install at | What belongs there |
| --- | --- |
| **User-global** | Only what is true on *every* repo you touch — `task-tracking`, `commit-and-release`, `project-context` |
| **Project** | Everything stack-specific — the `wp-*` set on WordPress repos, and nowhere else |

If a skill would never fire in this repo, it should not be installed in this repo.

### 3. Decide the MCP servers for this project

Server schemas cost substantially more than skill descriptions — this is usually the larger
half of the problem. Derive the set from the work, not from what is already configured.

The skill→server dependency map, the scope table, and the per-project-shape recipes live in
[`references/mcp-scoping.md`](references/mcp-scoping.md). The short version:

| Tier | Servers |
| --- | --- |
| Baseline, user scope | `clickup` — every unit of work routes through it |
| Per project | The one or two the repo's actual work needs |
| Never global | Anything stack-specific (`wordpress-studio`, `pressable`, `shopify-dev-mcp`, `shadcn`) |

**Prefer project scope (`.mcp.json`, committed).** It travels with the repo, so the next
person gets the right set without being told, and it disappears when they leave the repo.

### 4. Make the decision stick

A decision nobody re-reads decays. Record it in the project, three complementary ways:

1. **`.mcp.json`, committed** — the servers this repo needs, as config rather than prose.
2. **A line in the project's `CLAUDE.md`/`AGENTS.md`** naming the intended capability set,
   so a human or agent adding a server knows there was an intent to violate.
3. **A `SessionStart` hook** running `npx @linchpinagency/skills --check` when you want
   duplicates to surface on their own rather than when someone notices.

The hook snippet and the honest tradeoff (it costs a subprocess on every session to catch a
rare, sticky misconfiguration) are in
[`references/skills-audit.md`](references/skills-audit.md).

## Guardrails

- **Never `rm -rf` a whole skills directory to fix an overlap.** Those directories hold
  skills from several sources — remove the specific duplicated skill directories. `--check`
  prints the exact list.
- **Never hand-edit skills inside a consuming project's `.claude/skills/`** — the installer
  overwrites them. Change them in this library and re-install.
- **Never add an MCP server at user scope to solve a one-repo problem.** That is how nine
  servers happen. Use `-s project` or `-s local`.
- **Never remove a server or skill someone else's workflow depends on without saying so** —
  scope is a shared decision on a shared repo.
- Removing a server can silently disable a skill that needs it (`task-tracking` without
  `clickup`). Check the dependency map before pruning.
- If you cannot tell whether a capability is used, leave it and say so. Under-loading is a
  cheaper mistake than a broken workflow, but a *silent* prune is worse than either.

## Done

- [ ] `--check` reports no cross-scope duplicates, or the remaining ones are deliberate.
- [ ] Every installed skill could plausibly fire in this repo.
- [ ] Stack-specific skills are at project scope, not user scope.
- [ ] The MCP server set was derived from the repo's work, not inherited.
- [ ] Project-scoped servers are in a committed `.mcp.json`.
- [ ] The intended set is recorded where the next person will see it.
- [ ] Nothing was pruned that a skill still depends on.
