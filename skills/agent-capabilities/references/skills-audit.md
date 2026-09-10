# Skills audit — scopes, duplicates, and the session hook

Detection is owned by the installer (`npx @linchpinagency/skills --check`). This file
explains what it reports and what to do about it.

## Why duplicates happen

Agents load **every** skills directory they can see and **do not dedupe by name**. Two
copies of `task-tracking` means two entries in the skills list and two copies of its
description in the context window, every session, forever.

Nothing warns you. The installer is happy to write into any directory you point it at, and
until v0.2 neither install knew the other existed.

## The three colliding scopes

| Scope | Path | How it happens |
| --- | --- | --- |
| **User-global** | `~/.claude/skills` | `--global` — loaded in *every* project |
| **Project** | `<repo>/.claude/skills` | The default — loaded in that repo |
| **Ancestor** | `<parent-of-repo>/.claude/skills` | Running the installer from a checkouts folder (`~/GitHub`) instead of inside a repo |

The ancestor case is the sneaky one: it looks like a project install, sits above every
sibling checkout, and is easy to create by pressing enter in the wrong terminal.

## Per-agent directories

Each agent reads its own directories, which is why the installer fans out. Only the
directories for the agent you are *running* cost that agent context — a `.codex/skills` copy
is invisible to Claude Code, and vice versa.

| Agent | Project | Global |
| --- | --- | --- |
| Claude Code | `.claude/skills` | `~/.claude/skills` |
| GitHub Copilot | `.agents/skills`, `.github/skills` | `~/.copilot/skills` |
| Codex | `.codex/skills` | `~/.codex/skills` |
| Cursor | `.cursor/skills` | `~/.cursor/skills` |

So a repo carrying all four agents' copies is not wasting Claude's context — it is just
using disk. Don't "clean up" another agent's directory to save context that was never spent.

## Auditing

```bash
npx @linchpinagency/skills --check                    # Claude Code, this project
npx @linchpinagency/skills --check --agent codex      # a different agent
npx @linchpinagency/skills --check --global           # from the global scope's point of view
```

Reports every directory the agent reads, its skill count, its install stamp, and the exact
overlapping skill names. Exits `1` when duplicates exist, so it composes into CI or a hook.

## Fixing an overlap

Decide which scope should own each duplicated skill, then remove the *other copy only*:

```bash
cd ~/.claude/skills && rm -rf task-tracking wp-studio-cli   # …the names --check printed
```

`--check` prints this command with the names filled in. **Never remove the whole
directory** — it holds skills from several sources (upstream WordPress, Cloudflare, Figma),
and the overlap is usually a subset.

Then re-install into the scope you chose. The installer refuses a colliding install:

```
Refusing to install: 22 of these skills are already installed at another scope.
```

`--force` overrides it, for the rare case where you genuinely want both.

## Choosing the scope

| Install at | What belongs there |
| --- | --- |
| User-global | Only skills true on *every* repo — `task-tracking`, `commit-and-release`, `project-context` |
| Project | Everything stack-specific — the `wp-*` set on WordPress repos, and nowhere else |

Global feels convenient and is how the sprawl starts: a WordPress skill installed globally
is loaded on every Workers repo you open. Project scope also means the skill set travels
with the repo, so a teammate cloning it gets the right tools without being told.

## SessionStart hook

Surfaces duplicates on their own rather than when someone happens to notice. In
`.claude/settings.json` (project) or `~/.claude/settings.json` (all projects):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx -y @linchpinagency/skills --check | tail -3"
          }
        ]
      }
    ]
  }
}
```

**The honest tradeoff:** this spends a subprocess on every session to catch a rare,
one-time misconfiguration. It earns its place on a machine where installs drift — several
repos, several agents, more than one person running the installer. On a stable single-repo
setup, run `--check` by hand when onboarding and skip the hook.

`npx` resolves from cache after the first run. If session startup latency matters more than
freshness, install once (`npm i -g @linchpinagency/skills`) and call `skills --check`.

Hook mechanics and the destructive-command guard are owned by
[`safety-hooks`](../../safety-hooks/SKILL.md) — this is one more `SessionStart` entry
alongside it, not a competing configuration.
