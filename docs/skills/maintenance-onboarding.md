---
title: maintenance-onboarding
---

A site's first nights on rolling maintenance fail on setup, not on the pipeline. Something small stops Preflight or Deploy to Dev, and the message rarely names the cause: a dev site that says it is production, a GitHub environment with the wrong name, a hostname with no DNS, a PR check that never runs. This skill checks all 19 onboarding steps before anything is written. Then it makes the fixes in an order that never leaves a night half set up, and asks a person at every step that writes.

The team's step-by-step guide for people is [Onboarding Pressable Clients to Rolling Maintenance](https://docs.linchpin.com/onboarding-pressable-clients/). It uses the same 19 numbers, as do the ClickUp onboarding tasks, so the check this skill posts lines up with a task's checkboxes.

## When to reach for it

- Starting a client's onboarding task in Sisyphus › Maintenance.
- Checking every site in a group before any of them is converted.
- A site that has never passed a night fails at Preflight, or Deploy to Dev refuses to install Safety Net.

Things you might say that load it: "roll out nightly maintenance to the next client", "convert this repo to rolling maintenance", "get this site on Sisyphus", "is this site ready for nightly runs", "Safety Net won't install on dev", or "Preflight timed out".

## Where it stops

> **Not this skill:** the monthly `maintenance/YYYY-MM` pass on a site that isn't enrolled. Use [`maintenance-window`](maintenance-window.md). Creating a repository and its deploy environments from nothing is [`github-repo-setup`](github-repo-setup.md). A failed night on a site that has passed before is Sisyphus's own *Triage a failed night* page.

## How it works

<!-- wp:docspress/flow {"start": 1, "steps": [{"title": "Check, writing nothing", "content": "<p>Runs all 19 checks and posts one table on the site's task: each step ✓, ✗ or ?, with the next action or what blocked it.</p>"}, {"title": "Settle the choices", "content": "<p>A person picks dev, staging, where snapshots go, the run time, and whether a <code>master</code> branch becomes <code>main</code>.</p>"}, {"title": "Hosting", "content": "<p>After a yes: dev's environment type, Mantle's clone constant, the Access application that lets Sisyphus read Safety Net's status, and a cloned dev with its two DNS records when one is missing.</p>"}, {"title": "Repository", "content": "<p>A prep PR with a CI workflow that really runs and Composer pinned to production's PHP. Then <code>bin/convert-repo</code>, with dev's environment named <code>development</code> and the deploy account's SSH login. A person merges both PRs.</p>"}, {"title": "Sisyphus", "content": "<p>Enrolls the site paused, checks its environments in api.linchpin.com, maps its Ghost Inspector suites, runs Deploy to Dev, then turns on the nightly run and starts one.</p>"}, {"title": "Prove it", "content": "<p>Re-checks at each stop of the task until five unattended nights have passed and a snapshot has reached production.</p>"}]} /-->

## What it checks first

| Look for | Tells you |
| --- | --- |
| The site's ClickUp task | The repository and the three Pressable sites, and where to post |
| The repository's `HOST` variable | Only `pressable` can be enrolled today |
| The production branch's name | `main`, or a `master` to rename before the conversion |
| Production's PHP and the repository's `PHP_VERSION` | The pin the prep PR sets |
| A checkout of linchpin/actions at `v4` | `bin/convert-repo` and `bin/onboard-site` |
| The Pressable MCP | Site types, environment types, Mantle, and each SFTP login's account |
| The Cloudflare API | Whether it can add the status-route Access application for you, after a yes |

## What it owns

Canonical for the 19-step onboarding checklist, the order of its four phases, and the checks that prove a site is ready for its first night. It defers the meaning of dev and staging to [`wp-hosting-environments`](https://github.com/linchpin/skills/blob/main/skills/wp-hosting-environments/SKILL.md), secrets and the deploy account's SSH login to [`github-repo-setup`](github-repo-setup.md), and operating a Pressable site to [`wp-pressable`](wp-pressable.md).

## Guardrails

- Never writes to production. Reads there stop at `wp eval`.
- Never picks dev when there's a choice, and never one that takes `develop` or other feature work.
- Never names dev's GitHub environment anything but `development`.
- Never merges a PR, renames a production branch, closes a window holding people's commits, or deletes a branch or an environment: those are a person's.
- Only adds DNS records for dev's own `linchpin.build` hostname, after a yes, and never in a client's zone. Its only Access change is adding dev's status route, by its exact hostname, to the shared Safety Net Status application, after a yes.
- Proposes `staging` for snapshots only when the `staging` branch holds nothing the production branch lacks.
- Never turns on the nightly run before Deploy to Dev has passed.

## Done when

- [ ] The 19-row check is on the site's task, and every row is ✓ or says what it waits on.
- [ ] Dev is a Pressable staging site reporting `development`, and its status route answers `"active":true` without a login.
- [ ] A `convert-repo` plan run shows no ✗ and no `!`.
- [ ] The site is enabled in Sisyphus, and one run has passed.
- [ ] Ghost Inspector, five unattended nights and one snapshot to production are each ticked, or the task says which one is waiting.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/maintenance-onboarding/SKILL.md) is the skill's main instructions.
- [`references/checks.md`](https://github.com/linchpin/skills/blob/main/skills/maintenance-onboarding/references/checks.md) — every check with the read that proves it, plus the recipes that write: cloning a dev, the status-route Access application, the prep PR, renaming `master`, where snapshots promote, enrolling from WP-CLI, mapping suites and making a dev suite.

Pre-approved, so the agent can run them without a prompt: reading and searching files, `gh` reads (variables, secrets, PRs, checks, runs, issues), `git ls-remote` and `dig`. Everything that writes still asks.

## Related skills

- [`github-repo-setup`](github-repo-setup.md) — owns environment secrets and which Pressable login `SSH_USER` holds.
- [`wp-hosting-environments`](https://github.com/linchpin/skills/blob/main/skills/wp-hosting-environments/SKILL.md) — creates a missing dev or staging site and registers it.
- [`wp-pressable`](wp-pressable.md) — operating the Pressable sites the checks read.
- [`maintenance-window`](maintenance-window.md) — the monthly pass this replaces.
- [`task-tracking`](task-tracking.md) — the onboarding task, its status, and the commit scope.
