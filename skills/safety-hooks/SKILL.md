---
name: safety-hooks
description: Turn on enforced guardrails for risky work — a PreToolUse hook that makes destructive commands (wp db drop, search-replace without --dry-run, DROP TABLE, git push --force, rm -rf) require confirmation, and an optional edit boundary that blocks writes outside one directory. Use when touching production or a client database, debugging a live site, working in an unfamiliar repo, or when asked for careful mode, safety mode, or to lock down edits. Claude Code only.
version: 1.0.0
---

# Safety hooks

Every other skill in this library *asks* an agent not to do something dangerous. This one
**enforces it**, by registering a `PreToolUse` hook that inspects each command before it runs
and makes the destructive ones require confirmation.

That matters most where our work is riskiest: client databases, production WordPress, and
`wp search-replace` — a single command that rewrites a live database in place.

## When to use

- About to touch production or staging, or any client database.
- Debugging a live site, or working in a repo you don't know well.
- Handing a session to someone less familiar with the project.
- Asked for "careful mode", "safety mode", or "only edit this folder".

**Not this skill:** the prose rules about what's safe on a server —
[`wp-pressable`](../wp-pressable/SKILL.md). Pre-commit checks —
[`quality-gates`](../quality-gates/SKILL.md).

## Owns

Canonical for: the enforced guardrail mechanism, the destructive-command list, and the edit
boundary. Other skills state judgment rules; this one blocks actions.

## Portability exception

This is the **one deliberately Claude-Code-only skill** in the library. Hooks are a Claude
Code feature; Copilot, Codex, and Cursor ignore the `hooks` frontmatter and the skill
degrades to documentation. That trade is worth making because the protection is real, and
because nothing else here depends on it — see
[`write-a-linchpin-skill`](../write-a-linchpin-skill/SKILL.md).

## Turning it on

**For the session** — invoking this skill registers the hooks below; they last until the
conversation ends.

**Permanently** — copy the same entries into `~/.claude/settings.json` (global) or the
project's `.claude/settings.json`:

```jsonc
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{
          "type": "command",
          "command": "bash -c 'f=.claude/skills/safety-hooks/scripts/check-destructive.sh; [ -f \"$f\" ] || f=$HOME/.claude/skills/safety-hooks/scripts/check-destructive.sh; bash \"$f\"'"
        }]
      },
      {
        "matcher": "Edit|Write",
        "hooks": [{
          "type": "command",
          "command": "bash -c 'f=.claude/skills/safety-hooks/scripts/check-edit-boundary.sh; [ -f \"$f\" ] || f=$HOME/.claude/skills/safety-hooks/scripts/check-edit-boundary.sh; bash \"$f\"'"
        }]
      }
    ]
  }
}
```

## Setting an edit boundary

The boundary is opt-in and off by default. To scope edits to one directory — useful while
debugging, so unrelated code can't be "helpfully" fixed:

```bash
mkdir -p "${LINCHPIN_SAFETY_DIR:-$HOME/.claude/.linchpin-safety}"
cd <directory-to-restrict-to> && pwd > "${LINCHPIN_SAFETY_DIR:-$HOME/.claude/.linchpin-safety}/edit-boundary.txt"
```

To clear it:

```bash
rm -f "${LINCHPIN_SAFETY_DIR:-$HOME/.claude/.linchpin-safety}/edit-boundary.txt"
```

Ask the user which directory rather than guessing, and confirm the resolved absolute path
back to them.

## What triggers a confirmation

| Area | Patterns |
| --- | --- |
| WordPress | `wp db drop`/`reset`/`import`, `wp search-replace` without `--dry-run`, `wp site empty`, `wp post/user/term/comment delete`, `wp plugin uninstall`, changing `home`/`siteurl` |
| Databases | `DROP TABLE`/`DATABASE`, `TRUNCATE`, `DELETE FROM` with no `WHERE` |
| Git | `push --force`, `reset --hard`, `checkout .`/`restore .`, `clean -fd`, `branch -D` |
| Filesystem & infra | `rm -rf`, `kubectl delete`, `docker rm -f`, `docker system prune`, `ssh` running `wp`/`mysql` remotely |

Allowed without prompting: removing `node_modules`, `vendor`, `dist`, `build`, `.next`,
`.turbo`, `.cache`, `coverage`, `__pycache__`, and any `search-replace` carrying `--dry-run`.

## Guardrails

- **This is a speed bump, not a sandbox.** It fails *open* — if `python3` is missing or
  parsing fails, commands proceed. Bash can still write anywhere via `sed` or redirects.
  Never describe it to a client or teammate as a security control.
- **Never disable the hook to get a command through.** Confirm the command deliberately, or
  change the command.
- **Never widen the safe-exception list to silence a prompt** you found annoying — that list
  is why the prompts stay meaningful.
- **Never set an edit boundary without telling the user** what it is; a blocked edit is
  confusing when the reason is invisible.
- A confirmation prompt is a moment to re-read the command, especially the environment it
  points at. Approving reflexively is the failure this exists to prevent.

## Done

- [ ] Hooks registered — session-scoped, or written into settings for permanence.
- [ ] The user knows which protections are active and how to clear them.
- [ ] Edit boundary, if set, was chosen by the user and echoed back as an absolute path.
- [ ] No hook was bypassed or weakened to let a specific command through.
