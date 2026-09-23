---
title: commit-and-release
---

Two pieces of automation own this pipeline, and both bite when you guess: commitlint rejects a malformed message at the pre-commit hook, and release-please derives the version, `CHANGELOG.md`, and every version string embedded in the repo from commit history. Edit any of those by hand and the next release PR fights you.

## When to reach for it

- Composing a commit message or PR title.
- A commit gets rejected by commitlint or a husky hook.
- Deciding how a change reaches staging or production.
- Anything is about to touch a version number or `CHANGELOG.md`.
- Reviewing or merging a release PR.

Things you might say that load it: "commitlint rejected my commit", "why did the PR title check fail", "what version will this cut", "how does this get deployed". It also applies before touching a version number or `CHANGELOG.md` by hand.

## Where it stops

> **Not this skill:** running lint/tests before the commit — [`quality-gates`](quality-gates.md). Naming the branch, and finding or creating the task whose key goes in the scope — [`task-tracking`](task-tracking.md).

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Resolve the scope key","content":"<p>Get the ClickUp task key, or an accepted <code>NO-TASK</code>, from <code>task-tracking</code> before composing anything.</p>"},{"title":"Verify the change","content":"<p>Run the project's own gates via <code>quality-gates</code> so the commit represents work that actually passes.</p>"},{"title":"Compose the message","content":"<p>Write <code>type(SCOPE): Subject</code> against this repo's own <code>type-enum</code>, one logical change per commit, sentence case, no trailing period.</p>"},{"title":"Commit normally","content":"<p>Let husky and commitlint run. If the hook rejects the message, fix it — the error names the failed rule. Never <code>--no-verify</code>.</p>"},{"title":"Push and open the PR","content":"<p>Give the PR the same convention as the commit, since squash merges turn the title into the release commit. Lint the title on its own, since the husky hook never sees it and CI checks it separately.</p>"},{"title":"Let release-please release it","content":"<p>Merging to <code>main</code> opens or updates a release PR that bumps versions and writes <code>CHANGELOG.md</code>; merging that PR tags the release deploy workflows fire from.</p>"}]} /-->

## What it checks first

Before composing anything, it reads the repo's own automation config rather than porting a rule from another repo — the allowed types, the header pattern, and what's machine-owned all differ per repo.

| Reads | Tells you |
| --- | --- |
| `commitlint.config.js` → `type-enum` | The types this repo accepts |
| `commitlint.config.js` → `parserOpts.headerPattern` | The exact header regex and which scopes count |
| `commitlint.config.js` → `extends` | Inherited rules never written down locally, such as `header-max-length` |
| `.github/workflows/` | Whether CI also lints the PR title, and whether release/deploy are automated |
| `release-please-config.json` → `changelog-sections` | Which types surface in the changelog |
| `release-please-config.json` → `extra-files` | Every file whose version string is machine-owned |
| `.release-please-manifest.json` | The current version, also machine-owned |

## What it owns

Canonical for: commit message grammar, PR-title rules, and the boundary between what you write and what release-please generates. It defers task resolution and branch naming to [`task-tracking`](task-tracking.md), and verification to [`quality-gates`](quality-gates.md).

## Guardrails

<!-- wp:docspress/callout {"tone":"warning","title":"Let release-please own the release","content":"<p>Never hand-edit <code>CHANGELOG.md</code>, <code>.release-please-manifest.json</code>, or a version string listed under <code>extra-files</code>. Never create git tags or GitHub releases by hand — tags are what deploys fire on. Never commit directly to <code>main</code> or force-push a shared branch.</p>","collapsible":false} /-->

- Never commit with `--no-verify`, and never loosen `commitlint.config.js` to make a message pass.
- Never invent a task key. `NO-TASK` is a legitimate answer; a fabricated key is not.
- Don't bundle unrelated changes into one commit — release notes are generated from these messages, and a mixed commit lands in the wrong section.

## Done when

- [ ] Scope key is a real task key or an accepted `NO-TASK`.
- [ ] Type is in this repo's `type-enum`; subject is sentence case with no trailing period or mid-subject punctuation.
- [ ] Commit passed the husky/commitlint hook without `--no-verify`.
- [ ] Header is under 100 characters, with no apostrophe, em dash, or other punctuation outside `[\w\d\s,\-]`.
- [ ] PR title follows the same convention, was linted in its own right, and the body links the ClickUp task.
- [ ] No version string, `CHANGELOG.md`, manifest, or tag was written by hand.
- [ ] The resulting release PR shows the change under the expected section.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/commit-and-release/SKILL.md) is the whole skill. It has no `references/` or `scripts/`.

Pre-approved, so the agent can run them without a prompt: reading and searching files, `git status`, `git log`, `git diff`, `gh pr view`, `gh pr checks`, and `npx commitlint`. Anything that writes still asks.

## Related skills

- [`quality-gates`](quality-gates.md) — runs the gates that verify the change before it's committed.
- [`task-tracking`](task-tracking.md) — resolves the task key that becomes the commit scope, and owns branch naming.
