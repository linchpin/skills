# Session handoff

What to post on a task when work pauses unfinished — end of day, a context switch, running
low on context, or handing to someone else. Step 6 of [`../SKILL.md`](../SKILL.md).

The task is where the state belongs. Not a local file, not the chat: the task is what a
teammate opens.

## The comment

One `clickup_create_comment`, these five things, nothing else:

```markdown
**Handoff — <date>**
- **Done:** <what actually works now, and where it's committed or pushed>
- **In progress:** <what's half-built, and which files>
- **Open decisions:** <what needs an answer before continuing, and the options>
- **Where:** branch `<branch>`, PR <link or "none yet">, environment <local|staging|prod>
- **Next step:** <the single next action, concrete enough to start from cold>
```

## Rules that keep it useful

- **Write it for someone who wasn't here.** No "as discussed", no pronouns pointing at chat
  history, no "the file we changed".
- **Be honest about what's unfinished.** A handoff that overstates progress costs more than
  no handoff — the next person trusts it and builds on sand.
- **One handoff per pause, not a running log.** Supersede the previous one by posting a fresh
  comment rather than editing history, so the newest comment is always current.
- **Uncommitted work is not a handoff.** Commit or stash first and say which, per
  [`commit-and-release`](../../commit-and-release/SKILL.md). A handoff pointing at a dirty
  working tree on someone else's machine is not actionable.
- **On a parent + subtasks split, the handoff goes on the parent** and names the subtask in
  flight — so one comment still answers "where is this?" without opening every child.

## Why the "Next step" line carries the most weight

Everything above it is context; that line is the only part that gets someone moving. "Finish
the migration" fails the test. "Run `npm run validate` — it fails on `wp-audit`'s missing
README row; add the row and re-run" passes: the next person starts without rereading anything.
