# Secrets and variables for a `linchpin/actions` v3 deploy

New repos pin **`@v3`** (see the skill). The names and levels below are **the same in v3 and
v4** — the migration doc says so explicitly — with two differences, both flagged in the
tables: `ENVIRONMENT` is required in v3 and unread in v4, and `PROTECTED_PATHS` is v4-only.

The [`linchpin/actions` README](https://github.com/linchpin/actions#github-secrets-and-variables)
lists every key the shared workflows read, but **describes v4** — read
[`docs/MIGRATION-v3-to-v4.md`](https://github.com/linchpin/actions/blob/main/docs/MIGRATION-v3-to-v4.md)
alongside it for what v3 actually does. This file adds what neither covers: *which scope*
each key belongs at, and what a complete set looks like per host.

## Scope: the decision that actually matters

GitHub resolves in one direction — **environment overrides repository overrides
organization**. Put a value at the narrowest scope where it is still true.

| Scope | Holds | Set with |
| --- | --- | --- |
| **Organization** | Agency-wide credentials shared by every project | An org admin, once — not you, per repo |
| **Repository** | True for every environment of this project | `gh variable set X --repo <o>/<r>` |
| **Environment** | Differs between production and staging | `gh variable set X --repo <o>/<r> --env production` |

### What the org already gives you

Ask the repo, don't assume — this endpoint lists what is **visible to that repo**:

```bash
gh api repos/<owner>/<repo>/actions/organization-secrets   --jq '.secrets[].name'
gh api repos/<owner>/<repo>/actions/organization-variables --jq '.variables[].name'
```

Typically inherited (verify, don't trust this list): `PACKAGIST_COMPOSER_AUTH_JSON`,
`PRESSABLE_API_CLIENT_ID`, `PRESSABLE_API_CLIENT_SECRET`, `MANTLE_API_BEARER`,
`GH_BOT_TOKEN`, `SATISPRESS_USER`, `SATISPRESS_PASSWORD`; variables `PHP_VERSION`,
`NODE_VERSION`, `REMOTE_PLUGIN_INSTALL`.

An org secret **missing** from that output means this repo is not in its visibility list.
The fix is an org admin adding the repo — not a per-repo copy of the value.

## Variables

| Key | Scope | Notes |
| --- | --- | --- |
| `HOST` | repo (env if it differs) | `pressable` \| `wpengine` \| `cloudways`. Anything else fails the deploy outright |
| `SITE_URL` | **environment** | Full URL including `https://`. In v3 this drives the GitHub deployment's `environment_url` and the Mantle payload only — **not** where files land, and v3 has no health check. Confirm per environment |
| `SITE_ID` | **environment** | Pressable site id. Drives the API calls only — the on-demand backup — and the id reported to Mantle. Confirm per environment; never shared between production and staging |
| `INSTALL_NAME` | **environment** | WP Engine install name; also derives the SSH host and `wp-path` |
| `BRANCH` | **environment** | Branch this environment tracks — `main` (or `master`) for production, `staging` for staging. Default `staging` |
| `ENVIRONMENT` | **environment** | **v3 only, and required.** Must equal the environment's own name (`production-<slug>`). v3 uses it for every GitHub deployment API call; unset, deploys record against an empty environment. v4 does not read it |
| `DEPLOYMENT_AUTH_TYPE` | environment | Cloudways only: `key` (default) or `pass` (Cloudways Autonomous) |
| `THEMES` | repo | JSON array, e.g. `["<theme-slug>"]` |
| `PLUGINS` | repo | JSON array, e.g. `["<project>-functionality"]` |
| `THEME_USES_COMPOSER` | repo | Default `false` |
| `PLUGIN_USES_COMPOSER` | repo | Default `true` |
| `REMOTE_PLUGIN_INSTALL` | repo or env | `true` installs third-party plugins on the server from `composer.lock` instead of shipping them |
| `PROTECTED_PATHS` | repo or env | **v4 only** — no effect on a v3 deploy. Paths, relative to `wp-content`, a deploy must never overwrite |
| `PHP_VERSION`, `NODE_VERSION` | org, override at repo | Build/lint runtimes |

`DEPLOYMENT_PATH` is legacy in both lines — v4 ignores it, and v3 takes the deployment
path as a workflow input with per-host defaults. Leave it unset.

## Secrets

| Key | Scope | Hosts |
| --- | --- | --- |
| `SSH_HOST` | repo, or env when hosts differ | all |
| `SSH_USER` | **environment** (differs per install) | all |
| `SSH_KEY` | repo or environment | all (key auth) |
| `SSH_PASS` | environment | Cloudways Autonomous only, with `DEPLOYMENT_AUTH_TYPE=pass` |
| `PACKAGIST_COMPOSER_AUTH_JSON` | org | all — `auth.json` contents for `packagist.linchpin.com` |
| `PRESSABLE_API_CLIENT_ID` / `_SECRET` | org | Pressable — maintenance mode, on-demand backups |
| `MANTLE_API_BEARER` | org | Pressable backup-and-continue flow |
| `SATISPRESS_USER` / `SATISPRESS_PASSWORD` | org | only when `REMOTE_PLUGIN_INSTALL=true` |
| `GH_BOT_TOKEN` | org | README updates, maintenance PRs |
| `QA_API_TOKEN`, `QA_SCHEMA_TOKEN` | repo | only if the project uses the QA workflows |
| `WP_ACCESS_TOKEN` | repo | docs publishing — owned by [`docspress-publish`](../../docspress-publish/SKILL.md) |

Retired v3 names — if you see them in a workflow, the workflow is stale, not the repo:
`PRIVATE_KEY`, `CLOUDWAYS_SSH_KEY`, `MANTLE_SECRET`.

## Minimum complete set, per host

Assuming the org secrets above are visible, a **production** environment needs:

| Host | Environment variables | Environment/repo secrets |
| --- | --- | --- |
| Pressable | `ENVIRONMENT`, `SITE_URL`, `SITE_ID`, `BRANCH` (+ repo `HOST=pressable`) | `SSH_HOST`, `SSH_USER`, `SSH_KEY` |
| WP Engine | `ENVIRONMENT`, `SITE_URL`, `INSTALL_NAME`, `BRANCH` (+ repo `HOST=wpengine`) | `SSH_KEY` (host/user derive from `INSTALL_NAME`) |
| Cloudways | `ENVIRONMENT`, `SITE_URL`, `BRANCH`, `DEPLOYMENT_AUTH_TYPE` (+ repo `HOST=cloudways`) | `SSH_HOST`, `SSH_USER`, then `SSH_KEY` or `SSH_PASS` |

Staging is the same set with staging's values, `BRANCH=staging`, and `ENVIRONMENT` set to
the staging environment's own name.

### Which value actually chooses the target

`SSH_HOST` / `SSH_USER` / `SSH_KEY` decide where the release is written. `SITE_ID` decides
what gets backed up and what Mantle is told was deployed. `SITE_URL` only labels the GitHub
deployment. Nothing cross-checks them, and **v3 runs no health check** — success is rsync
exiting 0 — so all three have to describe the *same* install or a green run can mean a
release on the wrong site, a backup taken of an unrelated one, and a deployment link that
points somewhere the deploy never reached. Confirm the set with the user, per environment,
before setting any of them.

## Setting values without leaking them

```bash
# From a file (preferred for keys) — then remove the file
gh secret set SSH_KEY --repo <owner>/<repo> < ./deploy-key
rm -P ./deploy-key 2>/dev/null || rm ./deploy-key

# From stdin, no shell history, no transcript
gh secret set SSH_USER --repo <owner>/<repo> --env production-<slug>

# Variables are not secret — inline is fine
gh variable set SITE_URL --repo <owner>/<repo> --env production-<slug> --body "https://<domain>"
```

Never `--body "<the actual secret>"`: it lands in shell history, in the agent transcript,
and in any process listing on the machine.

## Check before you write

Both `gh variable set` and `gh secret set` are **upserts**: they create or replace with no
warning and an identical success line. Inventory both scopes first, and treat anything that
already exists as the user's decision, not yours.

```bash
ENV=production-<slug>
gh variable list --repo <owner>/<repo>             --json name,value,updatedAt \
  --jq '.[] | "repo  \(.name) = \(.value)   (\(.updatedAt[0:10]))"'
gh variable list --repo <owner>/<repo> --env "$ENV" --json name,value,updatedAt \
  --jq '.[] | "env   \(.name) = \(.value)   (\(.updatedAt[0:10]))"'
gh secret   list --repo <owner>/<repo>             --json name,updatedAt \
  --jq '.[] | "repo  \(.name)   (\(.updatedAt[0:10]))"'
gh secret   list --repo <owner>/<repo> --env "$ENV" --json name,updatedAt \
  --jq '.[] | "env   \(.name)   (\(.updatedAt[0:10]))"'
```

| | Absent | Present, same value | Present, different value |
| --- | --- | --- | --- |
| **Variable** | Set it | Skip — a no-op write only moves the timestamp | Show `current → proposed`; write only on an explicit yes |
| **Secret** | Set it | *Unknowable* — values never read back | Show name, scope, last-updated; say the value can't be verified; write only on an explicit yes |

Single-key guards:

```bash
# Variable — value is readable, so compare
if current=$(gh variable get SITE_ID --repo <owner>/<repo> --env "$ENV" 2>/dev/null); then
  echo "EXISTS  SITE_ID = $current"
else
  gh variable set SITE_ID --repo <owner>/<repo> --env "$ENV" --body "<value>"
fi

# Secret — existence is all you get
if gh secret list --repo <owner>/<repo> --env "$ENV" --json name --jq '.[].name' \
     | grep -qx SSH_USER; then
  echo "EXISTS  SSH_USER (env $ENV) — value not readable"
else
  gh secret set SSH_USER --repo <owner>/<repo> --env "$ENV"
fi
```

## Reading back

```bash
gh variable list --repo <owner>/<repo>
gh variable list --repo <owner>/<repo> --env production-<slug>
gh secret   list --repo <owner>/<repo>
gh secret   list --repo <owner>/<repo> --env production-<slug>
gh api repos/<owner>/<repo>/environments --jq '.environments[].name'
```

Secret **values** are never readable back — only names and timestamps. If a value's
correctness is in doubt, rotate it rather than trying to verify it.
