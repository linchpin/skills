# Skill template

Copy the block below to `skills/<name>/SKILL.md` and replace every `<…>`. Delete sections
that don't apply **except** `## When to use`, `## Guardrails`, and `## Done` — those are
required and the validator enforces them.

---

```markdown
---
name: <kebab-case-name-matching-the-directory>
description: <What this does, capability first>. Use when <trigger in the user's words>, <a second, differently-worded trigger>, or <a third>. <Optional: Not for X — use `<sibling-skill>`.>
version: 0.1.0
---

# <Title>

<One to three lines: what this buys the user and why it's non-obvious. Not a restatement
of the description.>

## When to use

- <Concrete situation>
- <Concrete situation>

**Not this skill:** <adjacent job> — use [`<sibling>`](../<sibling>/SKILL.md).

## Owns

Canonical for: <the facts only this skill states>.
Defers: <concern> → [`<sibling>`](../<sibling>/SKILL.md).

## Preflight

Read before acting; never assume a project's shape.

| Look for | Tells you | If missing |
| --- | --- | --- |
| `<file or command>` | `<what it decides>` | `<the fallback, or say so and stop>` |

## Procedure

1. **<Step>** — <what to do>. → <checkable result: the observable thing that proves it worked>
2. **<Step>** — <what to do>. → <checkable result>

## Guardrails

- **Never** <destructive action> — <why, and what to do instead>.
- **Never** <bypass, e.g. `--no-verify`, `--force`, editing a generated file>.
- If <blocker>, stop and report it rather than working around it.

## Done

- [ ] <Observable end state>
- [ ] <Observable end state>
```

---

## Writing the steps

Each step ends in something an agent can **observe**, not a feeling of completion:

| Weak | Checkable |
| --- | --- |
| "Make sure linting passes" | "`composer run lint` exits 0" |
| "Review the changes" | "Every file in `git diff --name-only` is accounted for in the summary" |
| "Update the task" | "`clickup_get_task` shows the new status" |

## Writing the description

Three passes, in order:

1. **Capability** — what it does, in one clause.
2. **Triggers** — `Use when …` with at least two phrasings a user would actually type.
   Include the symptom, not just the task ("CI lint is failing", not only "run lint").
3. **Boundary** — name the sibling skill when triggers could collide.

Then grep the library for collisions before you commit:

```bash
grep -h '^description:' skills/*/SKILL.md
```
