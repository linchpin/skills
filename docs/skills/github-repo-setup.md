---
title: github-repo-setup
---

A Linchpin project deploys through `linchpin/actions`: thin caller workflows in the project repo call the shared `deploy.yml`, which fans out by `vars.HOST` to the per-host deploy workflow, and every site-specific value comes from GitHub variables and secrets rather than the workflow file. A repo is "ready to deploy" when the callers are pinned correctly, the environments exist with the exact names the callers pass, and each environment resolves a complete set of `vars` and `secrets`. This skill exists to prevent the repo that looks finished but whose first release deploy fans out to nothing, or records its deployment against an empty environment.

## When to reach for it

- Standing up a new client site or product repo under the `linchpin` org.
- Wiring up a repo someone already created — empty, or already holding its code.
- Adding deploy wiring (environments, secrets, variables) to a repo that has none.
- Repinning a repo whose workflows point at `@main` and no longer resolve.
- A deploy fails on a missing or empty variable, secret, or environment.

## Where it stops

> **Not this skill:**
>
> - **The repo's contents and local dev** (wp-content shape, Composer, Studio symlink) → [`wp-local-setup`](wp-local-setup.md).
> - **Operating the live server** after a deploy → [`wp-pressable`](wp-pressable.md).
> - **Commit/PR grammar and release-please** → [`commit-and-release`](commit-and-release.md).
> - **The `WP_ACCESS_TOKEN` docs secret** → [`docspress-publish`](docspress-publish.md).
> - **What a plugin repo must contain, and which `linchpin/actions` reusables it calls** → [`wp-plugin-standards`](wp-plugin-standards.md). This skill's `@v3` default is the **site** fleet's line; a plugin repo starts on `@v4`, because `php-checks.yml`, `plugin-check.yml` and `wp-version-checker.yml` do not exist on v3. The file tree for a **new plugin** comes from `linchpin/plugin-scaffold` via `linchpin plugin scaffold`, not from `deploy-scaffold`.
> - **Which reusable workflows exist and what each input does** → the `linchpin/actions` README, which is canonical. This skill owns *provisioning*, not the pipeline.

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Resolve the task key","content":"<p>Ask whether a ClickUp task already exists; take its custom id verbatim, offer to create one and ask where it belongs, or agree on <code>NO-TASK</code>. The branch name depends on the answer, so this runs before anything else.</p>"},{"title":"Name the repo","content":"<p>Ask for the project slug and check whether it's already taken before proposing it — a 404 doesn't prove the name is free, and <code>gh repo create</code>'s collision error is authoritative.</p>"},{"title":"Ask what populates it","content":"<p>Always ask which repo to scaffold from; there is no default. Offer real candidates — a sibling repo already on the v3 pipeline, or <code>plugin-scaffold</code> for a new plugin — and confirm the choice before creating anything.</p>"},{"title":"Create the repo","content":"<p>Create it under the confirmed owner, name, and visibility from the chosen source; its contents land untouched on <code>main</code>.</p>"},{"title":"Cut the working branch","content":"<p>Clone to a directory of its own, outside any existing checkout, and branch off <code>main</code>. Everything from here — pins, rename, settings — is committed on that branch and reaches <code>main</code> by PR.</p>"},{"title":"Check the scaffold's pins","content":"<p>Confirm every deploy workflow calls <code>linchpin/actions</code>'s <code>deploy.yml@v3</code> with v3-only inputs, replacing anything unpinned, broken, or mixed with v4 inputs.</p>"},{"title":"Make it this project's own","content":"<p>Strip the generator files if the source was <code>deploy-scaffold</code>, then sweep the source project's slug, namespaces, and URLs out of the codebase.</p>"},{"title":"Create the environments","content":"<p>Create <code>&lt;stage&gt;-&lt;slug&gt;</code> environments that match the workflow callers' <code>environment:</code> values exactly — a name that matches nothing is silently created empty at deploy time.</p>"},{"title":"Set variables","content":"<p>Read what the repo and environment already hold before writing anything; skip a value that's already correct, and stop to confirm with the user before changing one that differs.</p>"},{"title":"Set secrets","content":"<p>Confirm which secrets the org already provides, then set only the per-site values that remain. An existing secret's value can never be read back, so any overwrite needs the user's explicit yes.</p>"},{"title":"Open the PR, then verify","content":"<p>Commit, open the PR against <code>main</code>, and cross-check the workflow's variables and secrets. The real proof is a green staging deploy, not the PR itself.</p>"}]} /-->

## What it checks first

`gh auth status` and `gh api user` confirm the agent is authenticated with org access before anything else runs. It also checks whether a ClickUp task key exists, whether the host (Pressable, WP Engine, Cloudways) has already been decided, and whether the production and staging installs already exist — because `SITE_ID`, `INSTALL_NAME`, and SSH values can't be filled in before the host has provisioned them.

## What it owns

Canonical for creating the GitHub repo, choosing and confirming what populates it, the scaffold-to-project rename pass, and the scope decision — organization, repository, or environment — for every secret and variable. It defers the pipeline itself to `linchpin/actions`, the repo's file layout to `wp-local-setup`, and the task key and branch to `task-tracking`.

## Guardrails

<!-- wp:docspress/callout {"tone":"warning","title":"Never delete, rename, or archive an existing repo","content":"<p>Report what's already there — full name, visibility, archived state, last push — and let the user decide. Never sidestep a name collision by inventing a variant like -2 or -new.</p>","collapsible":false} /-->

<!-- wp:docspress/callout {"tone":"warning","title":"Confirm SITE_ID, SITE_URL, and SSH values before setting them","content":"<p>Take them from the host, for that environment, and read them back to the user. A wrong value writes a release onto a real, live, wrong site while the run still goes green. Missing is safe; guessed is not.</p>","collapsible":false} /-->

- Never assume a source repo — ask which repo to populate from, every time.
- Never clone the new repo into the directory you happen to be in — it nests a client project inside an unrelated checkout.
- Never commit the rename or workflow changes straight to `main` — they belong on `issue/<task-key>` and reach `main` by PR.
- Never migrate a repo between v3 and v4 as a side effect of setting it up.
- Never make a client repo public unless the user says so explicitly, in those words.
- Never reuse production's `SITE_ID` or `SITE_URL` for staging — identical values mean every staging push deploys to production.
- Never paste a secret value into the transcript, a shell argument, or a committed file — pipe it from a file or the team password manager.
- Never overwrite an existing variable or secret without showing the user what's there and getting an explicit yes.
- Never duplicate an org-level secret at repo scope — it silently survives the next rotation and breaks deploys weeks later.
- Never point a new repo's production environment at an existing site you haven't confirmed — the first deploy overwrites `wp-content` on that install.
- Never delete or rename an environment on a repo that already deploys — in-flight deployments reference it.
- Route the work through a task and commit per house convention.

## Done when

- [ ] A task key was resolved (or `NO-TASK` agreed) before anything was created.
- [ ] The name was checked for collision, and any existing repo was reported to the user.
- [ ] Repo exists under the confirmed owner/name/visibility, and is cloned to its own directory outside any other checkout.
- [ ] Work happened on `issue/<task-key>` (or `no-task/<slug>`); `main` holds only the initial source commit until the PR merges.
- [ ] The user was asked which repo to populate from — no source was assumed — and confirmed the choice before creation.
- [ ] Every deploy workflow calls `linchpin/actions/.github/workflows/deploy.yml@v3` with v3 inputs only — or the repo was already on v4 and that was raised, not changed.
- [ ] No references to the source project's slug, namespace, or URLs remain.
- [ ] Environments exist as `<stage>-<slug>`, matching the callers' `environment:` values.
- [ ] Existing variables and secrets were listed before any write, at both repo and environment scope.
- [ ] Nothing pre-existing was overwritten without the user seeing it and confirming.
- [ ] Repository variables set; environment variables set per environment, including v3's `ENVIRONMENT` set to the environment's own name.
- [ ] `SITE_ID` and `SITE_URL` read back to the user and confirmed per environment, from the host's own record — and production's differ from staging's.
- [ ] Org-provided secrets confirmed visible to the repo; per-site `SSH_*` set at the right scope; nothing duplicated from org scope.
- [ ] Anything still unknown is reported explicitly as a blocker, not guessed.
- [ ] PR opened against `main`, with the settings changed outside the diff listed in its body.
- [ ] A staging deploy has run green, or the reason it cannot yet is stated.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/github-repo-setup/SKILL.md) is the skill's main file.
- [`references/scaffold-and-rename.md`](https://github.com/linchpin/skills/blob/main/skills/github-repo-setup/references/scaffold-and-rename.md) — how to choose a source repo, and how to scrub its identity out afterward.
- [`references/secrets-and-variables.md`](https://github.com/linchpin/skills/blob/main/skills/github-repo-setup/references/secrets-and-variables.md) — which secret or variable belongs at which scope, per host.

Pre-approved, so the agent can run them without a prompt: reading and searching files, `gh auth status`, `gh repo view`, `gh secret list`, `gh variable list`, and `gh search code`. Anything that writes — creating the repo, setting a secret or variable — still asks.

## Related skills

- [`wp-local-setup`](wp-local-setup.md) — owns the repo's contents and local dev wiring: wp-content shape, Composer, the Studio symlink.
- [`wp-pressable`](wp-pressable.md) — operates the live server once a deploy has landed, and is where `SITE_ID`/`SITE_URL` get confirmed from the host.
- [`commit-and-release`](commit-and-release.md) — owns commit and PR message grammar and how release-please cuts a deploy.
- [`docspress-publish`](docspress-publish.md) — owns the `WP_ACCESS_TOKEN` docs secret.
- [`wp-plugin-standards`](wp-plugin-standards.md) — owns what a plugin repo must contain and which `linchpin/actions` reusables it calls, on the v4 line.
- [`task-tracking`](task-tracking.md) — owns resolving the task key and creating one when it doesn't exist yet.
- [`engagement-types`](engagement-types.md) — the map of which ClickUp Space a new client project belongs in.
