---
name: maintenance-onboarding
description: Bring a site onto Sisyphus's nightly rolling maintenance — check its Pressable dev site, environment type, DNS, Cloudflare Access, PR checks, PHP pin, GitHub environments and secrets, enrollment and Ghost Inspector suites against the 19-step onboarding checklist, fix what it can with approval, and run linchpin/actions' convert-repo and onboard-site. Use when onboarding or enrolling a site in nightly maintenance, when a new site's first night fails at Preflight, or when Deploy to Dev refuses to install Safety Net. Not for the monthly maintenance/YYYY-MM pass — use `maintenance-window`.
when_to_use: Also when someone says "roll out nightly maintenance to the next client", "convert this repo to rolling maintenance", "get this site on Sisyphus", "is this site ready for nightly runs", "Safety Net won't install on dev", or "Preflight timed out" on a site that has never passed a night — and at the start of a task made from the onboarding template.
version: 0.2.0
allowed-tools: Read Grep Glob Bash(gh auth status*) Bash(gh repo view*) Bash(gh variable list*) Bash(gh variable get*) Bash(gh secret list*) Bash(gh pr list*) Bash(gh pr view*) Bash(gh pr checks*) Bash(gh run list*) Bash(gh run view*) Bash(gh issue list*) Bash(git ls-remote*) Bash(dig +short*)
---

# Onboard a site to rolling maintenance

A site's first nights fail on setup, not on the pipeline. A dev site that says it is
production, a GitHub environment with the wrong name, a hostname with no DNS: each one
stops Preflight or Deploy to Dev, and the message rarely names the cause. This skill checks
every setup step before anything is written, then makes the fixes in an order that never
leaves a night half set up.

## When to use

- Starting a site's onboarding task, usually one made from the ClickUp onboarding template.
- Checking every site in a cohort before any of them is converted.
- A site that has never passed a night fails at Preflight, or Deploy to Dev refuses Safety
  Net ("installed on development only").

**Not this skill:** the monthly `maintenance/YYYY-MM` pass on a site that is not enrolled —
use [`maintenance-window`](../maintenance-window/SKILL.md). Creating a repository and its
deploy environments from nothing — use [`github-repo-setup`](../github-repo-setup/SKILL.md).
A client with no dev or staging site yet, or one missing from api.linchpin.com — use
[`wp-hosting-environments`](../wp-hosting-environments/SKILL.md), which creates and
registers it. A failed night on a site that has passed before — Sisyphus's own *Triage a
failed night* page on docs.linchpin.com.

## Owns

Canonical for: the 19-step onboarding checklist, the order of its four phases, and the
checks that prove a site is ready for its first night. The ClickUp onboarding tasks and the
team's guide on docs.linchpin.com (*Onboarding Pressable Clients to Rolling Maintenance*)
follow the same numbering, so a check posted on a task lines up with its checkboxes.

Defers:
- What dev and staging are — Pressable site type, `WP_ENVIRONMENT_TYPE`, hostname,
  GitHub environment name, and their rows in api.linchpin.com →
  [`wp-hosting-environments`](../wp-hosting-environments/SKILL.md).
- Which variables and secrets go at which scope, and which Pressable login `SSH_USER` holds →
  [`github-repo-setup`](../github-repo-setup/SKILL.md).
- The task, its status, and the scope key in commits →
  [`task-tracking`](../task-tracking/SKILL.md).
- Operating a Pressable site, and WP-CLI there → [`wp-pressable`](../wp-pressable/SKILL.md).
- Merging a monthly window that holds people's commits →
  [`maintenance-window`](../maintenance-window/SKILL.md).

## Preflight

Read all of these before the first check. Never assume what the scripts accept: they
change, and the check has to follow them.

| Look for | Tells you | If missing |
| --- | --- | --- |
| The site's ClickUp task, with its **Fill in first** block | Where to post the check and tick steps; the repository and the three Pressable sites | `task-tracking`: create it from the onboarding template, or work as `NO-TASK` |
| `vars.HOST` on the repository (`gh variable list --repo <repo>`) | The host. Only `pressable` can be enrolled today | Stop. The nightly sync refuses any other host |
| A checkout of linchpin/actions at the `v4` tag, with `bin/convert-repo` and `bin/onboard-site` | The two scripts this skill drives | Clone it, `git checkout v4`. Say so if either script is missing |
| `gh auth status`, with admin on the repository | Whether environments, secrets and rulesets can be read and written | Stop: an admin has to run phase 2 |
| The production branch's name (`gh repo view <repo> --json defaultBranchRef`) | `main`, or a `master` to rename before the conversion | — |
| Production's PHP (`get_site_status`) and the repository's `PHP_VERSION` | The pin the prep PR sets, and whether the variable is stale | — |
| The Pressable MCP (`get_site_status`, `run_site_wpcli_commands`, `get_ftp_account_details`) | Site type, environment type, Mantle, and each SFTP login's account | Say so. A person reads them in MyPressable, and every Pressable row stays `?` |
| The Cloudflare API, with Access edit | Whether the status-route application can be added for a person, after a yes | Print its settings (checks.md, step 5) for a person to add |
| `linchpin hosting audit <client>` | Whether production, dev and staging are registered in api.linchpin.com, which `onboard-site` reads to enroll | Install `@linchpinagency/cli` per [`wp-hosting-environments`](../wp-hosting-environments/SKILL.md). Until then, step 1 stays `?` |
| `SISYPHUS_AUTH`: a WordPress application password on packagist.linchpin.com | Whether `onboard-site` can enroll | Enroll with `wp sisyphus enroll` through WP-CLI on packagist.linchpin.com instead (checks.md, step 11) |

## Procedure

Every check, with its command and what ✓ means, is in
[references/checks.md](references/checks.md).

1. **Check, writing nothing.** Run all 19 checks. Print them as one table: step, ✓ / ✗ / ?,
   and the next action for each ✗ or what blocked each `?`. Post the table as a comment
   on the site's task. → A 19-row table on the task, with no row left blank.
2. **Settle the choices with a person.**
    - Which site is dev, when more than one could be. Never one that deploys `develop` or
      any other feature work, because the nightly sync overwrites it.
    - Staging, and where snapshots promote (`staging` or `main`). A staging Pressable lists
      as live-type can't be enrolled: promote into `main` until it is converted.
    - The run time: 30 minutes from every other enrolled site.
    - Whether a `master` production branch is renamed to `main` first (checks.md, step 10).

    → The task's **Fill in first** block is complete.
3. **Hosting (phase 1, steps 1–5).** After a yes:
    - Set dev's environment type through Pressable's `update_site_wp_environment_type`
      (`development`), and staging's (`staging`).
    - Define Mantle's clone constant on dev when production runs Mantle (checks.md, step 3).
    - Print the exact DNS records for a person to add.
    - Add the status-route Access application, or print its settings when the Cloudflare API
      isn't available (checks.md, step 5).

    → Checks 1–5 are ✓ on a second run.
4. **Repository (phase 2, steps 6–10).**
    - **The prep PR** for steps 7 and 8, before anything else in the repository (checks.md):
      `PHP_VERSION` first, then `ci.yml`, the pin and the coding standards. A person merges
      it. Rename `master` now if that was settled.
    - **Plan the conversion.** Run `bin/convert-repo <repo>` with `--dev-site-id`,
      `--dev-url`, `--promotion-target`, `--task`, and **`--dev-environment development`**
      every time. Left out, `convert-repo` reuses whichever environment already deploys
      dev's site, whatever its name, and Safety Net refuses any name but `development`.
    - **`--dev-ssh-user`** is the deploy account's login on dev (checks.md, step 10).
    - **`--ci-workflow CI`** while the prep PR isn't merged yet. Otherwise `convert-repo`
      detects the old workflows that never run, and Rolling Maintenance waits on those.
    - **`--close-windows`** only when every window holds Renovate's commits alone.
    - Read the plan: a line starting `!` needs a person. Then, after a yes, run it again
      with `--apply`.
    - List what it leaves for a person to remove: `deploy-maintenance.yml`, the
      `site-maintenance` branch, its environment.

    → A second plan run shows no ✗ and no `!`. The conversion PR is open for a person to
    merge.
5. **Sisyphus (phase 3, steps 11–15).** Once the conversion PR is merged:
    - **Enroll paused and map.** `bin/onboard-site` can't pass `--dev-environment` or
      `--dev-ssh-user` to `convert-repo`, so run it only once the old dev environment is
      gone. Otherwise enroll with `wp sisyphus enroll` (checks.md, step 11). Check the
      environments' roles in api.linchpin.com (step 12), and map the suites (step 14).
    - **Deploy to Dev:** `gh workflow run deploy-dev.yml -R <repo> --ref maintenance`.
      `maintenance` must already hold `deploy-dev.yml`; Rolling Maintenance brings it in when
      the conversion merges.
    - **Turn it on:** once the status route answers `"active":true` and
      `"environment":"development"`, run `sisyphus enroll <production> --enable`, then
      `sisyphus run <production>`.

    → One run has passed.
6. **Prove it (phase 4, steps 16–19).** Re-run checks 16–19 when asked, or at each stop of
   the task, ticking steps as they pass. → Every step is ticked, or the task says which step
   is waiting and on what.

## Guardrails

- **Never write to production.** Never change production's environment type, enroll it as
  dev or staging, or deploy to it. Running `wp eval` reads on production is the limit.
- **Never choose dev when there is a choice.** A person picks. Never pick a site that another
  enrolled site, or any feature work, deploys to.
- **Never give dev's GitHub environment any name but `development`** (any case). GitHub
  can't rename an environment: `convert-repo` creates `development`, and a person deletes
  the one it replaces. The repository's other environments keep their names here; moving
  them to plain role names is [`github-repo-setup`](../github-repo-setup/SKILL.md)'s task.
- **Never merge the prep or conversion PR**, never close a window holding people's commits,
  never rename a production branch without a yes, and never delete a branch or an
  environment, even an empty or merged one. Those belong to a person.
- **Never copy an organisation secret into a repository.** `gh secret list` shows repository
  and environment secrets only, so an organisation secret missing from it proves nothing.
  Pressable deploys by key, so never store `SSH_PASS` for it
  ([secrets and variables](../github-repo-setup/references/secrets-and-variables.md)).
- **Never turn on Run nightly before Deploy to Dev has passed.** Preflight refuses a dev
  without Safety Net, and the night fails.
- **DNS records are a person's:** print them, don't add them. The only Access change this
  skill makes is the status-route application with the reusable Safety Net Status policy,
  after a yes. Never add a bypass to a client's own application or widen its path.
- No force push, no `--no-verify`. When a check is blocked by missing access, report `?`
  with what it needs, rather than working around it.

## Done

- [ ] The 19-row check is on the site's task, and every row is ✓, or says what it waits on.
- [ ] Dev is a Pressable staging site reporting `development`, and its status route answers
      `"active":true` without a login.
- [ ] A `convert-repo` plan run shows no ✗ and no `!`.
- [ ] `wp sisyphus sites` lists the site with Run nightly on, and one run has passed.
- [ ] Ghost Inspector, five unattended nights and one snapshot to production are each ticked,
      or the task says which one is still waiting.
