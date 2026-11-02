---
name: wp-hosting-environments
description: Stand up and audit a client's hosting environments — production plus at least one copy, with staging and development both expected, each registered in api.linchpin.com with its role; on Pressable a copy is a staging-type site (never a sandbox) whose WP_ENVIRONMENT_TYPE names its role so Safety Net runs there. Use when onboarding a client or site to hosting, when asked "does this client have a dev or staging site", "spin up a dev environment", "what environments does X have", or "why isn't Safety Net running on dev". Not for the repo's deploy wiring — use `github-repo-setup`; not for operating an existing site — use `wp-pressable`.
when_to_use: Also when inventorying what a client has on Pressable, WP Engine, Cloudways or Pantheon, when a Pressable site's type (live, staging, sandbox) looks wrong, when a staging site is missing from api.linchpin.com, when `linchpin hosting audit` reports a gap, or when Sisyphus refuses a dev target.
version: 0.1.0
allowed-tools: Read Grep Glob Bash(linchpin hosting ls*) Bash(linchpin hosting audit*)
---

# Hosting environments

Linchpin runs every client site as at least two environments and normally three, and three
systems depend on the layout being declared the same way everywhere: Safety Net reads `WP_ENVIRONMENT_TYPE` to
decide whether it may scrub data, Sisyphus reads api.linchpin.com to find a site's dev and
staging, and linchpin/actions deploys each environment from its own branch. A copy that
exists on the host but is typed or registered wrong is invisible to all three. This skill
is the layout, how it maps onto each host, and the audit that finds the gaps.

## When to use

- Onboarding a client or a new site: deciding what to create on the host and in what order.
- "Does ITCA have a staging site?", "what does this client have on Pressable?", "is dev set
  up right?" — an inventory or an audit.
- A gap: `linchpin hosting audit` exits 3, Sisyphus will not take a site, Safety Net shows
  its production notice on a site that is meant to be dev.
- Deciding whether a Pressable site should be live, staging or sandbox type.

**Not this skill:** creating the GitHub repo or its environment secrets and variables — use
[`github-repo-setup`](../github-repo-setup/SKILL.md). Inspecting or fixing a site that
already exists — use [`wp-pressable`](../wp-pressable/SKILL.md). Enrolling a site in
nightly maintenance — that is linchpin/actions' `bin/onboard-site`, which this skill hands
off to.

## Owns

Canonical for: the expected layout (roles, host site types, `WP_ENVIRONMENT_TYPE`, branch
and GitHub-environment names), the Pressable mapping in
[`references/pressable.md`](references/pressable.md), the hostname convention for copies,
registering an environment in api.linchpin.com, and the audit.

Defers: GitHub environments and secrets → [`github-repo-setup`](../github-repo-setup/SKILL.md).
Touching a live site → [`wp-pressable`](../wp-pressable/SKILL.md). Sisyphus enrollment and
the `maintenance` branch → linchpin/actions `bin/onboard-site` and `bin/convert-repo`.
The task → [`task-tracking`](../task-tracking/SKILL.md).

## The layout

One row per role. The host site type and the constant are two different things, and both
have to be right: Pressable's type decides billing and what the dashboard allows, the
constant decides what WordPress and every plugin believe.

| Role | Purpose | Pressable site type | `WP_ENVIRONMENT_TYPE` | GitHub environment | Deploys from |
| --- | --- | --- | --- | --- | --- |
| `production` | The live site | live | `production` | `Production` | `main`, on a published release |
| `staging` | Client review before release | **staging** | `staging` | `Staging` | `staging` branch |
| `development` | Nightly maintenance and dependency runs, Safety Net on | **staging** | `development` | `Development` | `maintenance` branch, dispatched by Sisyphus |

- **Development is a staging-type site, never a sandbox.** Pressable password-protects a
  sandbox with an mu-plugin, which turns Safety Net's status route and the deploy health
  check into a 401; and WordPress core maps an unknown type such as `sandbox` to
  `production`, so linchpin/actions refuses to install Safety Net there. The role comes
  from the constant, not from Pressable's type — set it with
  `update_site_wp_environment_type`.
- **Hostnames:** copies live on Linchpin's own zones, `<slug>stg.linchpin.build` and
  `<slug>dev.linchpin.build`, until the client points a subdomain at them. Production
  starts life on `<slug>.linchpin.site` and moves to the client's domain at launch.
- **At least two, three expected, more allowed.** Production plus one copy is the floor:
  below it nothing can be reviewed or maintained off the live site, and the audit reports
  it as a gap. Staging and development are both expected; a missing one is a warning, so a
  client that promotes snapshots straight to production (`bin/onboard-site` offers "none")
  is recorded as a decision on the task, never assumed. A second staging, a UAT copy or a
  per-market production are all fine — they are listed and never reported.
- **The register of record is api.linchpin.com**, one `environments` row per install, with
  `role`, `provider`, `provider_ref` (the Pressable site id) and, for a copy,
  `production_environment_id`. packagist.linchpin.com's Sites screen and Sisyphus both read
  it; a site that only exists on the host does not exist to them.

## Preflight

Read before acting; never assume what a client has.

| Look for | Tells you | If missing |
| --- | --- | --- |
| `linchpin hosting audit <client>` | Every environment registered for the client, joined to Pressable's view, and the gaps | Install `@linchpinagency/cli` ≥ 1.4; without it, read `GET /environments` and the Pressable MCP's `list_sites` by hand and say you did |
| `LINCHPIN_API_CLIENT_ID` / `_SECRET` (or `LINCHPIN_API_TOKEN`) in the environment | The CLI can reach api.linchpin.com | Exit code 4. Ask for an application client with `sites:read`; do not borrow another tool's credential |
| The client in api.linchpin.com (`GET /clients`) | Environments can be registered against it | Clients sync nightly from Jetpack CRM; a brand-new client has to exist there first — stop and say so |
| The Pressable MCP (`search_sites`, `get_site_details`) | What actually exists on the host, including unregistered installs | Only the api's cached view is available; say the host was not asked directly |
| The repo's `.github/workflows/deploy-*.yml` | Which environments the pipeline already knows and which branch each deploys from | A copy with no workflow is created on the host but never deployed to — hand off to `github-repo-setup` |

## Procedure

### A. Audit

1. **Inventory** — `linchpin hosting ls <client>`. → One row per environment, production
   first, with host, site type and `WP_ENVIRONMENT_TYPE`; `--unregistered` adds Pressable
   installs no client owns.
2. **Audit** — `linchpin hosting audit <client>`. → Exit 0 and `0 gaps`, or exit 3 with one
   line per finding and a remedy under each. Gaps are `below-minimum`,
   `copy-without-production` and `environment-type-mismatch`; warnings are
   `missing-role`, `sandbox-install`, `live-type-copy`, `production-on-staging-type` and
   `install-not-live`.
3. **Report before fixing.** → The user has seen the list and said which gaps to close.
   An audit is a read; nothing in it changes a host.

### B. Close a gap on Pressable

Each step is in [`references/pressable.md`](references/pressable.md) with the MCP operation
and its parameters. In order:

1. **Confirm the plan with the user** — client, role, site name, and whether to clone
   production or create empty. → They have said yes to a named site and its monthly cost.
2. **Check capacity and the name** — `get_account_site_counts`, `validate_site_name`. →
   Capacity for the type, and the name is free.
3. **Create the copy as a staging-type site** — `clone_site` from production with
   `staging: true` (or `create_site` with `staging: true`). → `get_site_status` reports
   `live`.
4. **Type it** — `update_site_wp_environment_type` to the role. → `get_site_details` shows
   `wp_environment_type` equal to the role.
5. **Name and tag it** — display name `<Client> - <Role>`, a tag with the client's name. →
   The site is findable in MyPressable and `search_sites` by client.
6. **Hostname** — `add_site_domain` for `<slug>stg.linchpin.build` or
   `<slug>dev.linchpin.build`; the DNS records are a person's step. → `list_site_domains`
   lists it and `https://<hostname>/` answers.
7. **Register it** — `POST /environments` with `client_id`, `role`, `hostname`,
   `provider: pressable`, `provider_ref`, `production_environment_id`. → `linchpin hosting
   ls <client>` shows the row.
8. **Re-audit** — `linchpin hosting audit <client>`. → Exit 0 for that production.
9. **Hand off** — the GitHub environment and its `SITE_ID`/`SITE_URL`/`SSH_*` →
   `github-repo-setup`; nightly maintenance → `bin/onboard-site` in linchpin/actions, which
   reads the rows you just registered. Record it on the task → `task-tracking`.

### C. Other hosts

WP Engine, Cloudways and Pantheon have the same three roles. api.linchpin.com holds their
environments with `provider` set to the host slug, and the audit applies the same
expectations. The api has no site-creation integration for them yet, so steps B.2–B.6 are a
person's work in the host's dashboard; B.7–B.9 are the same.

## Guardrails

- **Never create a sandbox** for any role, and never convert production's site type.
- **Never change production's `WP_ENVIRONMENT_TYPE`.** Setting it to anything but
  `production` arms Safety Net on the live site.
- **Never delete, disable or convert a site** to close a gap. Report the extra or mistyped
  site and let a person decide; `delete_site` and `convert_site_type` are not remedies.
- **Never register a copy against another client's production**, and never register one
  production twice — `provider_ref` is unique in the api and the second write fails for a
  reason.
- **Never create a live-type site** without the user confirming capacity and cost; a copy is
  always staging-type.
- **Never run `bin/onboard-site --apply` or `bin/convert-repo --apply`** on the user's
  behalf; plan mode is theirs to review.
- If the client is not in api.linchpin.com, or the Pressable account has no capacity, stop
  and say so — do not work around either.

## Done

- [ ] `linchpin hosting audit <client>` exits 0, and every remaining warning is one the user
      chose to keep (a client with no staging by design) and the task says so.
- [ ] Every copy is a staging-type site whose `WP_ENVIRONMENT_TYPE` equals its role.
- [ ] Every environment is a row in api.linchpin.com with the right `role`, `provider_ref`
      and `production_environment_id`.
- [ ] Each copy answers on its `linchpin.build` hostname.
- [ ] Hand-offs made: GitHub environment wiring, Sisyphus enrollment, the ClickUp task.
