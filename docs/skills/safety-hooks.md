---
title: safety-hooks
---

Every other skill in this library asks an agent not to do something dangerous. This one enforces it, by registering a `PreToolUse` hook that inspects each command before it runs and makes the destructive ones require confirmation. That matters most where our work is riskiest: client databases, production WordPress, and `wp search-replace` — a single command that rewrites a live database in place.

## When to reach for it

- About to touch production or staging, or any client database.
- Debugging a live site, or working in a repo you don't know well.
- Handing a session to someone less familiar with the project.
- Asked for "careful mode", "safety mode", or "only edit this folder".

## Where it stops

> **Not this skill:** the prose rules about what's safe on a server — [`wp-pressable`](wp-pressable.md). Pre-commit checks — [`quality-gates`](quality-gates.md). Care about *scope* — keeping a diff small and verifying it actually works, rather than blocking destructive commands — [`engineering-discipline`](engineering-discipline.md).

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Claude Code only","content":"<p>Hooks are a Claude Code feature, so on Copilot, Codex and Cursor the skill degrades to documentation. It is the one deliberate exception in this library.</p>"},{"title":"Turn it on","content":"<p>Invoking the skill registers the hooks for the session. To make it permanent, copy the same PreToolUse entries into the project's or the global .claude/settings.json.</p>"},{"title":"Set an edit boundary (optional)","content":"<p>Off by default. Scope edits to one directory by writing its resolved path to a state file; ask the user which directory rather than guessing, and confirm the absolute path back to them.</p>"}]} /-->

What actually triggers a confirmation:

| Area | Examples |
| --- | --- |
| WordPress | `wp db drop`/`reset`/`import`, `wp search-replace` without `--dry-run`, `wp site empty`, content deletes, changing `home`/`siteurl` |
| Databases | `DROP TABLE`/`DATABASE`, `TRUNCATE`, `DELETE FROM` with no `WHERE` |
| Git | `push --force`, `reset --hard`, `checkout .`/`restore .`, `clean -fd`, `branch -D` |
| Filesystem & infra | `rm -rf`, `kubectl delete`, `docker rm -f`/`system prune`, `ssh` running `wp`/`mysql` remotely |

Allowed without prompting: removing `node_modules`, `vendor`, `dist`, `build`, and similar build directories, plus any `search-replace` carrying `--dry-run`.

## What it owns

Canonical for: the enforced guardrail mechanism, the destructive-command list, and the edit boundary. Other skills state judgment rules; this one blocks actions.

## Guardrails

- This is a speed bump, not a sandbox — it fails open if `python3` is missing or parsing fails, and Bash can still write anywhere via `sed` or redirects. Never describe it as a security control.

<!-- wp:docspress/callout {"tone":"warning","title":"Don't disable the hook to get a command through","content":"<p>Confirm the command deliberately, or change the command instead. Disabling the hook removes the only enforced check on a destructive command actually running.</p>","collapsible":false} /-->

- Never widen the safe-exception list to silence a prompt you found annoying — that list is why the prompts stay meaningful.
- Never set an edit boundary without telling the user what it is; a blocked edit is confusing when the reason is invisible.
- A confirmation prompt is a moment to re-read the command, especially the environment it points at. Approving reflexively is the failure this exists to prevent.

## Done when

- [ ] Hooks registered — session-scoped, or written into settings for permanence.
- [ ] The user knows which protections are active and how to clear them.
- [ ] Edit boundary, if set, was chosen by the user and echoed back as an absolute path.
- [ ] No hook was bypassed or weakened to let a specific command through.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/safety-hooks/SKILL.md) is the skill.
- [`scripts/check-destructive.sh`](https://github.com/linchpin/skills/blob/main/skills/safety-hooks/scripts/check-destructive.sh) — the `PreToolUse` hook for Bash; matches a command against the destructive-pattern list and asks for confirmation before it runs. Fails open if parsing breaks.
- [`scripts/check-edit-boundary.sh`](https://github.com/linchpin/skills/blob/main/skills/safety-hooks/scripts/check-edit-boundary.sh) — the `PreToolUse` hook for Edit/Write; denies a write outside the boundary recorded in the state file, when one is set. Allows everything when no boundary is set.

`allowed-tools` pre-approves only reading and searching files (`Read Grep Glob`). The two hook scripts above run through the hook mechanism itself, not as agent-invoked commands, so they aren't part of that grant.

## Related skills

- [`wp-pressable`](wp-pressable.md) — owns the prose rules for what's safe to run on a server.
- [`quality-gates`](quality-gates.md) — owns pre-commit checks.
- [`engineering-discipline`](engineering-discipline.md) — owns care about scope: a small diff that's actually verified, as opposed to blocking destructive commands.
- [`write-a-linchpin-skill`](write-a-linchpin-skill.md) — records that a grant in `allowed-tools` doesn't weaken these hooks; a `PreToolUse` hook still fires on a pre-approved call and can still block it.
