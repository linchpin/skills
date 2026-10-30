---
name: maintenance-onboarding
description: Bring a site onto Sisyphus's nightly rolling maintenance — check its repository, GitHub environments and secrets, Pressable dev site, environment type, DNS, Cloudflare Access, enrollment and Ghost Inspector suite against the 17-step onboarding checklist, fix what it can with approval, and run linchpin/actions' convert-repo and onboard-site. Use when onboarding or enrolling a site in nightly maintenance, when a new site's first night fails at Preflight, or when Deploy to Dev refuses to install Safety Net. Not for the monthly maintenance/YYYY-MM pass — use `maintenance-window`.
when_to_use: Also when someone says "roll out nightly maintenance to the next client", "convert this repo to rolling maintenance", "get this site on Sisyphus", "is this site ready for nightly runs", "Safety Net won't install on dev", or "Preflight timed out" on a site that has never passed a night — and at the start of a task made from the onboarding template.
version: 0.1.0
allowed-tools: Read Grep Glob Bash(gh auth status*) Bash(gh repo view*) Bash(gh variable list*) Bash(gh secret list*) Bash(gh pr list*) Bash(gh pr view*) Bash(gh pr checks*) Bash(gh run list*) Bash(gh run view*) Bash(git ls-remote*) Bash(dig +short*)
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
A failed night on a site that has passed before — Sisyphus's own *Triage a failed night*
page on docs.linchpin.com.

## Owns

Canonical for: the 17-step onboarding checklist, the order of its four phases, and what dev
has to be for Sisyphus — a Pressable staging site that nothing else uses, reporting
`development`, reachable on its status route, and deployed from an environment Safety Net
accepts.

Defers:
- Environment naming beyond dev, and which variables and secrets go at which scope →
  [`github-repo-setup`](../github-repo-setup/SKILL.md).
- The task, its status, and the scope key in commits →
  [`task-tracking`](../task-tracking/SKILL.md).
- Operating a Pressable site, and WP-CLI there → [`wp-pressable`](../wp-pressable/SKILL.md).
- Merging a monthly window that holds people's commits →
  [`maintenance-window`](../maintenance-window/SKILL.md).

## Preflight

Read all of these before the first check. Never assume what the scripts or the Safety Net
action accept: they change, and the check has to follow them.

| Look for | Tells you | If missing |
| --- | --- | --- |
| The site's ClickUp task, with its **Fill in first** block | Where to post the check and tick steps; the repository and the three Pressable sites | `task-tracking`: create it from the onboarding template, or work as `NO-TASK` |
| `vars.HOST` on the repository (`gh variable list --repo <repo>`) | The host. Only `pressable` can be enrolled today | Stop. The nightly sync refuses any other host |
| A checkout of linchpin/actions at the `v4` tag, with `bin/convert-repo` and `bin/onboard-site` | The two scripts this skill drives | Clone it, `git checkout v4`. Say so if either script is missing |
| `gh auth status`, with admin on the repository | Whether environments, secrets and rulesets can be read and written | Stop: an admin has to run phase 2 |
| The Pressable MCP (`get_site_status`, `run_site_wpcli_commands`) | Site type, environment type, Mantle, SFTP users | Say so. A person reads them in MyPressable, and every Pressable row stays `?` |
| What Safety Net accepts: [references/checks.md](references/checks.md#what-safety-net-accepts) | The name dev's GitHub environment must have | Don't guess. Use `development`, which every version accepts |
| `SISYPHUS_AUTH`: a WordPress application password on packagist.linchpin.com | Whether `onboard-site` can enroll | Phase 3 waits for a person to make one. Read the enrollment with `wp sisyphus sites` instead |

## Procedure

Every check, with its command and what ✓ means, is in
[references/checks.md](references/checks.md).

1. **Check, writing nothing.** Run all 17 checks. Print them as one table: step, ✓ / ✗ / ?,
   and the next action for each ✗ or what blocked each `?`. Post the table as a comment
   on the site's task. → A 17-row table on the task, with no row left blank.
2. **Settle the choices with a person.** Which site is dev, when more than one could be.
   Never one that deploys `develop` or any other feature work, because the nightly sync
   overwrites it. Then staging, where snapshots promote (`staging` or `main`), and the
   run time. → The task's **Fill in first** block is complete.
3. **Hosting (phase 1, steps 1–5).**
    - After a yes, set dev's environment type through Pressable's
      `update_site_wp_environment_type` (`development`), and staging's (`staging`).
    - Ask a person to define `MANTLE_AUTO_RESOLVE_CLONE` on dev when Mantle is active.
    - Print the exact DNS records, and any Access bypass, for a person to add.

    → Checks 1–5 are ✓ on a second run.
4. **Repository (phase 2, steps 6–10).**
    - Plan first. Run `bin/convert-repo <repo>` with `--dev-site-id`, `--dev-url`, `--task`, and
      **`--dev-environment <the name Safety Net accepts>`** every time. Left out,
      `convert-repo` reuses whichever environment already deploys dev's site, whatever its
      name.
    - Give `--dev-ssh-user` the SFTP username a person confirms (checks.md, step 7). Add
      `--close-windows` only when every window holds Renovate's commits alone.
    - Read the plan: a line starting `!` needs a person. Then, after a yes, run it again
      with `--apply`.
    - List what it leaves for a person to remove: `deploy-maintenance.yml`, the
      `site-maintenance` branch, its environment. Say so when no PR check runs on Renovate's
      PRs, because each one then counts as green at once.

    → A second plan run shows no ✗ and no `!`. The conversion PR is open for a person to
    merge.
5. **Sisyphus (phase 3, steps 11–14).** Once the conversion PR is merged, run
   `bin/onboard-site` with the settled choices. It enrolls paused, starts Deploy to Dev, then
   turns on Run nightly and one Run now. Run it again after each stop. → Dev's status
   route answers `"active":true` and `"environment":"development"`, and one run has passed.
6. **Prove it (phase 4, steps 15–17).** Report whether a Ghost Inspector suite is mapped.
   Then re-run checks 16 and 17 when asked, or at each stop of the task, ticking steps as
   they pass. → Every step is ticked, or the task says which step is waiting and on what.

## Guardrails

- **Never write to production.** Never change production's environment type, enroll it as
  dev or staging, or deploy to it. Running `wp eval` reads on production is the limit.
- **Never choose dev when there is a choice.** A person picks. Never pick a site that another
  enrolled site, or any feature work, deploys to.
- **Never name a feature-work environment so that it starts with `development`.** GitHub
  can't rename an environment: create the new one, and let a person delete the old one.
- **Never merge the conversion PR**, never close a window holding people's commits, and never
  delete a branch or an environment. Those belong to a person.
- **Never copy an organisation secret into a repository.** `gh secret list` shows repository
  and environment secrets only, so an organisation secret missing from it proves nothing.
  Never store `SSH_PASS` for a Pressable site.
- **Never turn on Run nightly before Deploy to Dev has passed.** Preflight refuses a dev
  without Safety Net, and the night fails.
- DNS and Cloudflare Access changes are a person's. Print the records; don't add them.
- No force push, no `--no-verify`. When a check is blocked by missing access, report `?`
  with what it needs, rather than working around it.

## Done

- [ ] The 17-row check is on the site's task, and every row is ✓, or says what it waits on.
- [ ] Dev is a Pressable staging site reporting `development`, and its status route answers
      `"active":true` without a login.
- [ ] A `convert-repo` plan run shows no ✗ and no `!`.
- [ ] `wp sisyphus sites` lists the site with Run nightly on, and one run has passed.
- [ ] Ghost Inspector, five unattended nights and one snapshot to production are each ticked,
      or the task says which one is still waiting.
