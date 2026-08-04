---
name: commit-and-release
description: Write commit messages and PR titles that satisfy a Linchpin repo's own commitlint rules, and stay out of the way of release-please, which owns versions and CHANGELOG.md. Use when composing a commit message, when commitlint or a husky hook rejects one, when opening a PR, when asked how a change gets released or deployed, or before touching a version number anywhere. Not for running lint or tests — use `quality-gates`. Not for naming the branch or resolving the task key in the scope — use `task-tracking`.
version: 1.1.0
---

# Commit and release

Two pieces of automation own this pipeline, and both bite when you guess:

- **commitlint** rejects malformed messages at the pre-commit hook — and the allowed types
  and header pattern **differ per repo**.
- **release-please** derives the version, the `CHANGELOG.md`, and the version strings inside
  plugin headers, `style.css`, `readme.txt`, `package.json` and `composer.json` from commit
  history. Editing any of those by hand puts the repo into a state its next release PR
  fights with.

## When to use

- Composing a commit message or PR title.
- A commit was rejected by commitlint or a husky hook.
- The user asks how a change reaches staging or production.
- Anything is about to touch a version number or `CHANGELOG.md`.
- Reviewing or merging a release PR.

**Not this skill:** running lint/tests before the commit — [`quality-gates`](../quality-gates/SKILL.md).
Naming the branch, and finding or creating the task whose key goes in the scope —
[`task-tracking`](../task-tracking/SKILL.md).

## Owns

Canonical for: commit message grammar, PR-title rules, and the boundary between what you
write and what release-please generates. Defers task resolution **and branch naming** to
[`task-tracking`](../task-tracking/SKILL.md), verification to [`quality-gates`](../quality-gates/SKILL.md).

## Preflight — the rules are per-repo

| Read | Tells you |
| --- | --- |
| `commitlint.config.js` → `type-enum` | The types **this** repo accepts — they are not the same everywhere |
| `commitlint.config.js` → `parserOpts.headerPattern` | The exact header regex, including which scopes count (`NO-TASK`, sometimes `NO-JIRA`, `#123`) |
| `release-please-config.json` → `changelog-sections` | Which types appear in the changelog, and which are hidden |
| `release-please-config.json` → `extra-files` | **Every file whose version string is machine-owned** — never hand-edit these |
| `.release-please-manifest.json` | The current version (also machine-owned) |
| `.github/workflows/` | Whether release and deploy are automated, and off which branch |

Real variation to expect: one repo accepts `update` and `improve` in the header pattern,
another omits `update`, another also accepts `NO-JIRA`, and another enforces only
sentence-case with no scope pattern at all. **Read the file; don't port a rule between repos.**

## The format

```
type(SCOPE): Subject in sentence case
```

- **type** — from that repo's `type-enum`. The house set is `feat`, `fix`, `perf`,
  `refactor`, `style`, `test`, `docs`, `build`, `ci`, `chore`, `revert`, plus Linchpin's
  `improve` (a small enhancement that isn't clearly a feat or fix) and `update`.
- **SCOPE** — the ClickUp task key (`LINCHPIN-5113`), `NO-TASK`, or a GitHub issue
  (`#758`). Never anything else; the pattern rejects it.
- **Subject** — sentence case, no trailing period.

```
feat(LINCHPIN-5113): Add cloudflare email sending on launch
fix(LINCHPIN-4980): Correct masthead gutter on columns children
improve(NO-TASK): Tidy editorconfig and ignore rules
```

**Punctuation gotcha:** the header pattern accepts only letters, digits, spaces, commas and
hyphens in the subject. Periods, colons, parentheses and slashes cut the parsed subject
short — so `Update wp-scripts to v27.1` parses as `Update wp-scripts to v27`. Keep version
numbers and punctuation out of subjects, or put them in the body.

**Breaking changes:** `feat(KEY)!: …` or a `BREAKING CHANGE: …` footer. This drives a major
version bump, so use it deliberately.

`chore(main): release …` is release-please's own commit. Never write one by hand, and never
use `main` as a scope for normal work.

## Procedure

1. **Resolve the scope key** via [`task-tracking`](../task-tracking/SKILL.md) — an existing
   key, a newly created task, or an accepted `NO-TASK`. → You have the exact string.
2. **Verify the change** with [`quality-gates`](../quality-gates/SKILL.md). → Gates green.
3. **Compose the message** against this repo's `type-enum`, one logical change per commit.
   → Message matches the repo's `headerPattern`.
4. **Commit normally** so husky runs. If commitlint rejects it, fix the message — the error
   names the failed rule. → Commit lands with the hook satisfied.
5. **Push the branch and open the PR.** Title follows the same convention (squash merges use
   the PR title as the commit message, so a malformed title breaks the changelog); body
   links the ClickUp task. → PR open against the base branch, never a push to `main`.
6. **Let release-please do the release.** Merging to `main` opens or updates a release PR
   that bumps versions and writes `CHANGELOG.md`; merging *that* tags the release, which is
   what deploy workflows trigger from. → Confirm the release PR reflects your change under
   the expected changelog section.

## Type → changelog behavior

Configured per repo; the common shape:

| Types | Effect |
| --- | --- |
| `feat`, `feature` | Features section; minor bump (pre-1.0 config may bump patch) |
| `fix` | Bug Fixes section; patch bump |
| `improve`, `tweak`, `refactor` | "Changes to Existing Features" section |
| `docs`, `build`, `ci` | Usually hidden from the changelog |
| `chore`, `style`, `test`, `perf`, `revert` | Their own sections |
| any type with `!` or `BREAKING CHANGE:` | Major bump |

A type missing from `changelog-sections` still commits fine but may never surface in a
release note — pick the type that reflects what actually changed.

## Guardrails

- **Never** hand-edit `CHANGELOG.md`, `.release-please-manifest.json`, or any version string
  in a file listed under `extra-files` (plugin header, `style.css`, `readme.txt`,
  `package.json`, `composer.json`). Release-please rewrites them and the conflict lands on
  whoever merges next.
- **Never** create git tags or GitHub releases by hand — tags are what deploys fire on.
- **Never** commit with `--no-verify`, and never loosen `commitlint.config.js` to make a
  message pass.
- **Never** commit directly to `main` or force-push a shared branch.
- **Never** invent a task key. `NO-TASK` is a legitimate answer; a fabricated key is not.
- Don't bundle unrelated changes into one commit — release notes are generated from these
  messages, and a mixed commit lands in the wrong section.

## Done

- [ ] Scope key is a real task key or an accepted `NO-TASK`.
- [ ] Type is in **this** repo's `type-enum`; subject is sentence case with no trailing
      period or mid-subject punctuation.
- [ ] Commit passed the husky/commitlint hook without `--no-verify`.
- [ ] PR title follows the same convention and the body links the ClickUp task.
- [ ] No version string, `CHANGELOG.md`, manifest, or tag was written by hand.
- [ ] The resulting release PR shows the change under the expected section.
