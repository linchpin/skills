# Secrets and variables for a `linchpin/actions` v4 deploy

New repos pin **`@v4`** (see the skill). The names and levels below are **the same in v3 and
v4** — the migration doc says so explicitly — with two differences, both flagged in the
tables: `ENVIRONMENT` is required in v3 and unread in v4, and `PROTECTED_PATHS` is v4-only.

The [`linchpin/actions` README](https://github.com/linchpin/actions#github-secrets-and-variables)
lists every key the shared workflows read and describes v4; a repo still on v3 is covered by
[`docs/MIGRATION-v3-to-v4.md`](https://github.com/linchpin/actions/blob/main/docs/MIGRATION-v3-to-v4.md).
This file adds what neither covers: *which scope* each key belongs at, and what a complete
set looks like per host across the three environments.

## Scope: the decision that actually matters

GitHub resolves in one direction — **environment overrides repository overrides
organization**. Put a value at the narrowest scope where it is still true.

| Scope | Holds | Set with |
| --- | --- | --- |
| **Organization** | Agency-wide credentials shared by every project | An org admin, once — not you, per repo |
| **Repository** | True for every environment of this project | `gh variable set X --repo <o>/<r>` |
| **Environment** | Differs between production, staging and development | `gh variable set X --repo <o>/<r> --env production` |

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
| `SITE_URL` | **environment** | Full URL including `https://`. Drives the GitHub deployment's `environment_url`, the deployment log, and v4's post-deploy health check (which passes on any status below 500) — **not** where files land. Confirm per environment |
| `SITE_ID` | **environment** | Pressable site id. Drives the API calls — the on-demand backup, maintenance mode — and the id reported to api.linchpin.com. Confirm per environment; never shared between two environments |
| `INSTALL_NAME` | **environment** | WP Engine install name; also derives the SSH host and `wp-path` |
| `BRANCH` | **environment** | Branch this environment tracks — `main` (or `master`) for production, `staging` for staging, `maintenance` for development. Default `staging` |
| `ENVIRONMENT` | environment | **v3 only.** v4 does not read it; the caller's `environment:` input names the deployment. Harmless if present (`bin/convert-repo` still writes it on `development`), unnecessary on a new repo |
| `DEPLOYMENT_AUTH_TYPE` | environment | Cloudways only: `key` (default) or `pass` (Cloudways Autonomous) |
| `THEMES` | repo | JSON array, e.g. `["<theme-slug>"]` |
| `PLUGINS` | repo | JSON array, e.g. `["<project>-functionality"]` |
| `THEME_USES_COMPOSER` | repo | Default `false` |
| `PLUGIN_USES_COMPOSER` | repo | Default `true` |
| `REMOTE_PLUGIN_INSTALL` | repo or env | `true` installs third-party plugins on the server from `composer.lock` instead of shipping them |
| `PROTECTED_PATHS` | repo or env | **v4 only** — no effect on a v3 deploy. Paths, relative to `wp-content`, a deploy must never overwrite |
| `RUNNER` | repo | **v4 only.** Runner label for every shared job, e.g. `blacksmith-2vcpu-ubuntu-2404`; default `ubuntu-latest` |
| `PHP_VERSION`, `NODE_VERSION` | org, override at repo | Build/lint runtimes — set them at repo scope to match the host's PHP (`8.5`) and the build's Node (`24`) |

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
| `DEPLOYMENTS_API_CLIENT_ID` / `_SECRET` | org | v4 reports every deploy to api.linchpin.com's deployment log with it |
| `NPM_READ_TOKEN` | org | Read-only npm token, so a build can install private `@linchpinagency` packages |
| `SATISPRESS_USER` / `SATISPRESS_PASSWORD` | org | only when `REMOTE_PLUGIN_INSTALL=true` |
| `GH_BOT_TOKEN` | org | README updates, maintenance PRs |
| `QA_API_TOKEN`, `QA_SCHEMA_TOKEN` | repo | only if the project uses the QA workflows |
| `WP_ACCESS_TOKEN` | repo | docs publishing — owned by [`docspress-publish`](../../docspress-publish/SKILL.md) |

Retired v3 names — if you see them in a workflow, the workflow is stale, not the repo:
`PRIVATE_KEY`, `CLOUDWAYS_SSH_KEY`, `MANTLE_SECRET`.

## Minimum complete set, per host

Assuming the org secrets above are visible, each environment needs:

| Host | Environment variables | Environment/repo secrets |
| --- | --- | --- |
| Pressable | `SITE_URL`, `SITE_ID`, `BRANCH` (+ repo `HOST=pressable`) | `SSH_HOST`, `SSH_USER`, `SSH_KEY` |
| WP Engine | `SITE_URL`, `INSTALL_NAME`, `BRANCH` (+ repo `HOST=wpengine`) | `SSH_KEY` (host/user derive from `INSTALL_NAME`) |
| Cloudways | `SITE_URL`, `BRANCH`, `DEPLOYMENT_AUTH_TYPE` (+ repo `HOST=cloudways`) | `SSH_HOST`, `SSH_USER`, then `SSH_KEY` or `SSH_PASS` |

The three environments carry the same keys with their own values:

| Environment | `BRANCH` | `SITE_URL` on Pressable | `SSH_USER` |
| --- | --- | --- | --- |
| `production` | `main` | the client's domain, or `https://<slug>.linchpin.site` before launch | production's |
| `staging` | `staging` | `https://<slug>stg.linchpin.build` | staging's |
| `development` | `maintenance` | `https://<slug>dev.linchpin.build` | dev's — `bin/convert-repo --dev-ssh-user` sets it |

`SSH_HOST` and `SSH_KEY` are usually one deploy key at repo scope on Pressable, since every
site on the account answers at `sftp.pressable.com`; `SSH_USER` is the per-site value and
always lives at environment scope.

### Which value actually chooses the target

`SSH_HOST` / `SSH_USER` / `SSH_KEY` decide where the release is written. `SITE_ID` decides
what gets backed up and what api.linchpin.com is told was deployed. `SITE_URL` labels the
GitHub deployment and is what the health check requests — and that check passes on any
status below 500, so an auth wall, a redirect or a 404 is green. Nothing cross-checks the
three, so all of them have to describe the *same* install or a green run can mean a release
on the wrong site, a backup taken of an unrelated one, and a deployment link that points
somewhere the deploy never reached. Confirm the set with the user, per environment, before
setting any of them.

## Setting values without leaking them

```bash
# From a file (preferred for keys) — then remove the file
gh secret set SSH_KEY --repo <owner>/<repo> < ./deploy-key
rm -P ./deploy-key 2>/dev/null || rm ./deploy-key

# From stdin, no shell history, no transcript
gh secret set SSH_USER --repo <owner>/<repo> --env production

# Variables are not secret — inline is fine
gh variable set SITE_URL --repo <owner>/<repo> --env production --body "https://<domain>"
```

Never `--body "<the actual secret>"`: it lands in shell history, in the agent transcript,
and in any process listing on the machine.

## Check before you write

Both `gh variable set` and `gh secret set` are **upserts**: they create or replace with no
warning and an identical success line. Inventory both scopes first, and treat anything that
already exists as the user's decision, not yours.

```bash
ENV=production            # then staging, then development
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
gh variable list --repo <owner>/<repo> --env production
gh secret   list --repo <owner>/<repo>
gh secret   list --repo <owner>/<repo> --env production
gh api repos/<owner>/<repo>/environments --jq '.environments[].name'
```

Secret **values** are never readable back — only names and timestamps. If a value's
correctness is in doubt, rotate it rather than trying to verify it.
