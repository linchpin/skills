---
title: wp-plugin-standards
---

A plugin repo is conformant when its CI *is* the shared pipeline rather than a local copy of it — a distinction invisible in a file listing, since a repo with its own `plugin-check.yml` and a repo calling `plugin-check.yml@v4` have the same filename. This skill makes that difference legible. It reports; it never fixes, and it never sequences.

## When to reach for it

- Standing up a new Linchpin-owned plugin repo, or reviewing one someone else set up.
- Asked what a plugin repo is missing, or why it doesn't match `mantle`.
- A caller workflow fails at startup, or on a composer script that isn't defined.
- A plugin repo still pins `@v3`, `@main`, or `@master`.
- Before a plugin's first release on a new distribution channel.

Things you might say that load it: "is this plugin set up right", "what's this repo missing", "does it need readme.txt or a build script".

## Where it stops

> **Not this skill:** running a gate, reading its output, or deciding a finding's fate — [`quality-gates`](quality-gates.md) owns which gates exist, how to run them, and the entire Plugin Check story. This skill asks only whether the repo *declares* the gate and wires it to the reusable workflow; it never runs one. Auditing a running **site** for performance or accessibility — [`wp-audit`](wp-audit.md). Creating the repo and its deploy wiring — [`github-repo-setup`](github-repo-setup.md). Generating a new plugin tree from the standard — `linchpin plugin scaffold` in `@linchpinagency/cli`. Writing the plugin's code — upstream [`wp-plugin-development`](../upstream.md). Closing the gaps in stages on a shipped plugin — [`wp-plugin-modernization`](wp-plugin-modernization.md). Building its admin screen — [`wp-plugin-admin-ui`](wp-plugin-admin-ui.md).

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Classify the repo and channel","content":"<p>Confirm it's a plugin, then establish the distribution channel — wp.org, self-hosted, or private — since the channel decides which rows are failures.</p>"},{"title":"Inventory against the checklist","content":"<p>Walk the conformance checklist once, giving every row one of four verdicts: present, missing, wrong-shape, or not-applicable for this channel.</p>"},{"title":"Score the plugin header","content":"<p>Read each header field's actual value, anchoring greps on the colon so a field like License doesn't also match License URI.</p>"},{"title":"Check the caller contract","content":"<p>Read composer.json scripts against what each reusable workflow requires, so a recommendation doesn't turn CI red on arrival.</p>"},{"title":"Classify every workflow file","content":"<p>Label each file in .github/workflows/ as calling a v4 reusable, calling a v3 reusable, reimplementing one locally, or legitimately local — flagging any local reimplementation first.</p>"},{"title":"Check every pin","content":"<p>Confirm every linchpin/actions reference is pinned @v4, and every third-party action is tagged or SHA-pinned, never floating.</p>"},{"title":"Write the report","content":"<p>Produce a report with a severity and a one-sentence fix per finding, with counts per severity and no proposed ordering.</p>"},{"title":"Hand off to one skill","content":"<p>Name exactly one next skill: quality-gates to run a gate, wp-plugin-modernization to sequence the fixes, github-repo-setup for a new repo, or nothing when there's nothing to do.</p>"}]} /-->

Severity, used on every row:

| Severity | Means |
| --- | --- |
| Blocking | CI or a release cannot work |
| Standard | The house shape; its absence costs something concrete |
| Drift | Real but low-cost inconsistency |

## What it checks first

General project identification runs through [`project-context`](project-context.md) first; this skill adds the plugin-specific checks:

- A root `.php` file carrying a `Plugin Name:` header — confirms it's a plugin repo at all, not a theme or site-shaped repo.
- `readme.txt` with `Stable tag:` and `.wordpress-org/`, a self-hosted `Update URI`, or a private `composer.json` listing — establishes the distribution channel, asked rather than guessed.
- `.github/workflows/` filenames and every `uses: linchpin/actions/…` line — the migration axis, and whether a reusable is actually called versus reimplemented locally.
- `composer.json` → `scripts.php-lint`, `.phpstan`, `.check-branch-cs` — whether `php-checks.yml@v4` can even be called.
- `phpcs.xml.dist` (the exact filename), a `build.sh`, and `.distignore`.

## What it owns

Canonical for: what a Linchpin-owned WordPress plugin repository must contain — its plugin-header fields, the composer scripts its CI callers require, its build and distribution artifacts, which `linchpin/actions@v4` reusable workflows it calls, and the conformance audit that compares a repo against that list. One rule governs every row: this skill owns that the row exists; the skill named beside it owns the row's value. It defers running any gate to [`quality-gates`](quality-gates.md), closing the gaps in stages to [`wp-plugin-modernization`](wp-plugin-modernization.md), creating the repo and its secrets to [`github-repo-setup`](github-repo-setup.md), and how to write the plugin itself to upstream `wp-plugin-development`.

## Guardrails

- Never fix findings while auditing — the report is the deliverable; remediation is a separate, approved change.
- Never restate a reusable workflow's inputs here — the `linchpin/actions` README is canonical and versioned with the workflows.
- Never recommend a workflow whose caller contract the repo cannot meet.
- Never report a row the channel exempts — an inapplicable row is omitted, never reported as passing.
- Never pin a plugin repo at `@v3` — it has no `php-checks.yml`, `plugin-check.yml`, or `wp-version-checker.yml`.
- Never treat a green badge or a clean local `phpcs` as evidence the plugin passes.
- Never touch environments, secrets, or variables during an audit.
- Never edit `CHANGELOG.md`, a version, or a lockfile — release-please owns them.
- If the repo isn't a plugin, or the channel can't be established, stop and say which rather than auditing against the wrong list.

## Done when

- [ ] The distribution channel was named before auditing; exempt rows are marked not-applicable, not failed.
- [ ] Every checklist row has one of the four verdicts.
- [ ] Every plugin-header field was scored against its actual value, with the colon anchored.
- [ ] Every `.github/workflows/` file is classified, and any local reimplementation of a v4 reusable is flagged first.
- [ ] Every `linchpin/actions` `uses:` checked for `@v4`; every third-party `uses:` checked for a pin.
- [ ] For each recommended reusable, its caller-side composer scripts and build script are named present or missing.
- [ ] The report carries severities and sequences nothing.
- [ ] Nothing in the repo changed, and the report's last line names exactly one next skill.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/wp-plugin-standards/SKILL.md) is the skill.
- [`references/conformance-checklist.md`](https://github.com/linchpin/skills/blob/main/skills/wp-plugin-standards/references/conformance-checklist.md) — the full row-by-row checklist (plugin header fields, PHP/JS toolchain, CI callers, build/distribution, metadata/release) with severities, channel exemptions, and the report template.
- [`references/README.md`](https://github.com/linchpin/skills/blob/main/skills/wp-plugin-standards/references/README.md) — a placeholder note for this directory, describing it as detail promoted out of `SKILL.md`.
- [`references/workflow-callers.md`](https://github.com/linchpin/skills/blob/main/skills/wp-plugin-standards/references/workflow-callers.md) — the caller YAML and caller-side contract for each `linchpin/actions@v4` reusable (`php-checks`, `plugin-check`, `wp-version-checker`, `update-readme`, `check-overrides`), plus which workflows are known gaps to hand-roll instead.

`allowed-tools` pre-approves reading and searching files, plus `git ls-files`, `gh search code`, and read-only `gh api` calls against `repos/*` — the lookups this skill uses to classify a repo's workflows and pins. Anything that writes still asks.

## Related skills

- [`quality-gates`](quality-gates.md) — owns running any gate, reading its output, and deciding a finding's fate, including the whole Plugin Check story.
- [`wp-audit`](wp-audit.md) — owns auditing a running site for performance or accessibility.
- [`github-repo-setup`](github-repo-setup.md) — owns creating the repo and its environments, secrets, and deploy wiring.
- [`wp-plugin-modernization`](wp-plugin-modernization.md) — owns sequencing this audit's findings, in stages, on a shipped plugin.
- [`wp-plugin-admin-ui`](wp-plugin-admin-ui.md) — owns the shape of a plugin's admin screen; this skill's checklist only asks that it follows it.
- [`wp-plugin-development`](../upstream.md) (upstream) — owns how to write the plugin itself: hooks, activation, Settings API, security, packaging.
- [`commit-and-release`](commit-and-release.md) — owns commit, PR, and release grammar, and the CHANGELOG/version files this skill never touches.
- [`dependency-updates`](dependency-updates.md) — owns Renovate and dependency policy.
- [`docspress-publish`](docspress-publish.md) — owns publishing the plugin's docs.
- [`task-tracking`](task-tracking.md) — owns the task and branch this work happens under.
- [`project-context`](project-context.md) — the general project identification this skill's Preflight builds on.
