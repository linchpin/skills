---
name: skill-updates
description: Bring a project's installed Linchpin skills up to the published release — find every install across agents and scopes, apply the update each one recorded, and report what changed. Use when a session opens saying skills are behind, when asked "are my skills up to date", "update the skills", or "upgrade the skills", when a skill's instructions don't match how this repo actually works, or after someone adds a skill to the library. Not for npm or Composer packages — use `dependency-updates`.
when_to_use: Also when someone asks "am I on the latest skills", says their skills look out of date, asks to re-run the installer, or when a session opened with a line saying a newer release is available.
version: 1.1.0
allowed-tools: Read Grep Glob
---

# Keep installed skills current

Installed skills are a **snapshot**. A copy in `.claude/skills/` has no idea a newer release
exists, and nothing about a stale copy looks wrong — it just quietly gives last month's
answer. This skill closes that loop: find every install, update it, say what changed.

The thing people get wrong is assuming there's one install. There is usually more than one —
a user-global copy plus a project copy, or Copilot's two directories — and updating the one
that happened to print the nudge leaves the others stale.

## When to use

- A session opened with a line like `Linchpin skills 0.1.14 → 0.2.0 available`.
- Anyone asks whether the skills are current, or asks to update or upgrade them.
- A skill's instructions contradict how the repo actually works — it may just be old.
- Someone added or changed a skill in the library and the team needs it.
- Setting a project up so it *tells* people when skills go stale (the hook, step 6).

**Not this skill:** npm and Composer dependencies — use
[`dependency-updates`](../dependency-updates/SKILL.md). Writing or editing a skill —
[`write-a-linchpin-skill`](../write-a-linchpin-skill/SKILL.md). Deciding which skills and MCP
servers a project should carry at all — [`agent-capabilities`](../agent-capabilities/SKILL.md).

## Owns

Canonical for: locating every install, the ask/auto/snooze decision, running the update, and
reporting what changed.

Defers: authoring and the skill standard →
[`write-a-linchpin-skill`](../write-a-linchpin-skill/SKILL.md); which skills belong on a
project → [`agent-capabilities`](../agent-capabilities/SKILL.md); commit and PR grammar →
[`commit-and-release`](../commit-and-release/SKILL.md).

## Preflight

Find the update checker. Every install carries its own copy, and **any one of them can report
on all of them** — so take the first that exists:

```bash
for f in .claude/skills/.linchpin-skills/update-check.mjs \
         "$HOME/.claude/skills/.linchpin-skills/update-check.mjs" \
         .agents/skills/.linchpin-skills/update-check.mjs \
         .codex/skills/.linchpin-skills/update-check.mjs \
         .cursor/skills/.linchpin-skills/update-check.mjs \
         "$HOME/.copilot/skills/.linchpin-skills/update-check.mjs"; do
  [ -f "$f" ] && CHECK="$f" && break
done
echo "CHECK=${CHECK:-none}"
```

| Result | Means | Do |
| --- | --- | --- |
| `CHECK=<path>` | At least one stamped install exists | Go to step 1 |
| `CHECK=none`, but skill directories exist | Copied by hand, or by a pre-0.2 installer — no stamp, so no version is knowable | Say so, then offer a fresh `npx @linchpinagency/skills` to establish one |
| `CHECK=none` and no skill directories | Nothing installed here | Offer to install; this skill has nothing to update |

**Never guess the update command.** Each install records the one that produced it, flags and
all — a `--global --skip-upstream` install must be updated the same way, or the run rewrites
someone's setup into a shape they didn't choose.

## Procedure

### 1. Scan every install

```bash
node "$CHECK" --scan --json
```

→ JSON with `latest`, `autoUpdate`, `updateCheck`, and an `installs` array: `dir`, `scope`,
`agent`, `version`, `behind`, and `updateCommand` per install.

If `latest` is `null` the registry was unreachable — say so and stop. Offline is not
up-to-date, and reporting it as such is the one genuinely misleading outcome here.

If no install has `behind: true`, say which version everything is on and stop.

### 2. Decide, once

If `autoUpdate` is `true`, skip straight to step 3 and mention it's applying automatically.

Otherwise ask with `AskUserQuestion`, naming the versions and how many installs are affected.
Map the answers straight onto the flags — don't hand-edit the config file:

| Answer | Command | Then |
| --- | --- | --- |
| Update now | — | Step 3 |
| Always keep me up to date | `node "$CHECK" --enable-auto` | Step 3 |
| Not now | `node "$CHECK" --snooze` | Report the deferral (24h, then 48h, then 1 week on repeat) and carry on with the original task |
| Stop asking | `node "$CHECK" --disable` | Say how to re-enable (`--enable`), then carry on |

### 3. Preview, then apply

With **more than one** install behind, preview first — the run also removes skills the package
no longer ships, and that list is worth seeing before it happens:

```bash
npx @linchpinagency/skills --dry-run   # plus that install's own recorded flags
```

→ a per-skill plan (`new` / `update` / `local edits will be lost` / `remove`) and a change
count. Then run each install's recorded `updateCommand`, adding `--yes` for a non-interactive
apply.

Two lines in that plan need reporting rather than silence:

- **`local edits will be lost`** — someone edited an installed skill in place. It gets
  overwritten. Say which, and that the fix is to change it in the library, not the install.
- **`DOWNGRADE`** — the package being run is older than what's installed, usually a pinned
  version in the command. Stop and check before continuing.

### 4. Verify

```bash
node "$CHECK" --scan
```

→ every install reports the new version and `current`. An install still showing `BEHIND` was
missed — usually a scope whose `updateCommand` wasn't run.

### 5. Report what changed

Read `CHANGELOG.md` from the stamp directory beside the skills (the installer ships it there;
the package itself lives in the npx cache and is gone by the next session). Summarize the
entries **between the old and new version** as 3–6 bullets, grouped by theme. Name the skills
that changed. Skip release-plumbing churn — nobody needs "chore(main): release 0.1.13".

If `CHANGELOG.md` isn't there, say the versions moved and that the changelog wasn't shipped
with that install, rather than inventing what changed.

### 6. Offer the hook, if it isn't wired up

A project where nothing runs the check goes stale silently again. If
`.claude/settings.json` has no `SessionStart` entry mentioning `update-check.mjs`:

```bash
npx @linchpinagency/skills --with-hook   # plus that install's recorded flags
```

→ the hook is merged into `.claude/settings.json`, idempotently, leaving existing hooks and
permissions alone. At project scope that file is **committable**, which is the point: one
person adds it and everyone who clones the repo gets told when their skills go stale.

### 7. Continue

The update is done. Go back to whatever the user actually asked for.

## Guardrails

- **Never hand-edit an installed skill.** The installer overwrites it on the next run. Change
  it in the library and re-run — see
  [`write-a-linchpin-skill`](../write-a-linchpin-skill/SKILL.md).
- **Never invent an update command.** Use the `updateCommand` each install recorded. Dropping
  `--global` or `--skip-upstream` silently reshapes someone's setup.
- **Never delete a skill directory by hand** to "clean up". Pruning is the installer's job and
  it only touches directories it has stamped; a manual `rm -rf` in a skills directory can take
  out another library's skills.
- **Never report an unreachable registry as up to date.** `latest: null` means unknown.
- **Never claim a version moved without re-scanning.** Step 4 is the evidence.
- **Never write preferences by editing the config file.** Use the flags in step 2, so the
  shape stays whatever the script expects.
- If an install is behind but carries **no stamp**, stop and ask. A hand-copied directory has
  no recorded command, and guessing one is how a project loses its chosen scope.

## Done

- [ ] Every install was found via `--scan`, not assumed — including other scopes and agents.
- [ ] `latest` was actually known; an unreachable registry was reported as unknown.
- [ ] The user chose (or `autoUpdate` had already chosen), and any deferral was recorded with
      `--snooze` / `--disable` rather than by editing config.
- [ ] Each behind install was updated with **its own** recorded command.
- [ ] Overwritten local edits and any `DOWNGRADE` were reported, not passed over.
- [ ] A re-scan shows every install current.
- [ ] What changed was summarized from the shipped `CHANGELOG.md`, or its absence was stated.
- [ ] The `SessionStart` hook exists, or was offered.
