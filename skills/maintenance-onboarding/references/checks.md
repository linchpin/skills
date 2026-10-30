# The 17 checks

Each step of the onboarding checklist, with the read that proves it. Every command here
reads; the fixes are in `SKILL.md`. `<repo>` is `linchpin/<name>`, and `<dev>`, `<staging>`
and `<production>` are hostnames, with `<dev-id>` and so on as their Pressable site ids.

## Reading a Pressable site

WP-CLI on Pressable runs asynchronously: `run_site_wpcli_commands` returns a `job_id`, and
`get_site_wordpress_operation` with that id returns the output once `status` is `complete`.

- Pressable keeps only 500 characters of output, and WP-CLI's own PHP deprecations can fill
  them. Start every `eval` with `error_reporting(E_ALL & ~E_DEPRECATED);`.
- Commands are passed without the leading `wp `.

One command answers steps 2 and 3 for a site:

```text
eval 'error_reporting(E_ALL & ~E_DEPRECATED); echo "ENV=" . wp_get_environment_type() . " defined=" . (defined("WP_ENVIRONMENT_TYPE") ? "yes" : "no") . " mantle=" . (is_plugin_active("mantle/mantle.php") ? "yes" : "no") . " clone=" . (defined("MANTLE_AUTO_RESOLVE_CLONE") ? MANTLE_AUTO_RESOLVE_CLONE : "none") . " safetynet=" . (file_exists(WPMU_PLUGIN_DIR . "/safety-net-loader.php") ? "yes" : "no");'
```

Sisyphus's own reads run the same way on the Pressable site that serves
packagist.linchpin.com: `sisyphus sites --format=csv` lists every enrolled site with its dev,
staging, repository, run time and promotion target, and `sisyphus list --format=csv
--limit=50` lists recent runs.

## What Safety Net accepts

Two checks guard Safety Net, and dev's GitHub environment has to pass both. Read them at the
`v4` tag every time rather than trusting this page:

```bash
gh api 'repos/linchpin/actions/contents/actions/safety-net/action.yml?ref=v4' --jq .content \
  | base64 -d | sed -n '/Refuse anything but development/,/^$/p'
gh api 'repos/linchpin/actions/contents/.github/workflows/deploy.yml?ref=v4' --jq .content \
  | base64 -d | grep -n 'Refuse Safety Net' -A2
```

At v4.21.0 both compare the whole name, in any case, with `development`: `Development`
passes, and `development-<slug>` and `site-maintenance-<slug>` are refused. When both accept
a `development` prefix, name dev's environment the way the repository names the others.

## Phase 1: hosting

| Step | Read | ✓ when |
| --- | --- | --- |
| 1. Dev is a staging site no one else uses | `get_site_status` on `<dev-id>`; `sisyphus sites`; the repository's environments (step 7) | `staging: true` and `sandbox: false`. No other enrolled site lists `<dev-id>`, and no environment deploys a branch other than `maintenance` to it |
| 2. Environment types | The eval above, on dev and on staging | `ENV=development` on dev, and `ENV=staging` on staging |
| 3. Mantle | The eval above, on dev | `mantle=no`, or `clone=connected` |
| 4. DNS and certificate | `dig +short <dev> A`, then `curl -s "https://<dev>/wp-json/safety-net/v1/status?cb=$RANDOM"` | `dig` prints addresses, and curl returns JSON. `rest_no_route` is fine until step 13 |
| 5. Cloudflare Access | `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n'` on the same URL | No redirect to `*.cloudflareaccess.com` and no `401` |

The answers for step 4:

| curl says | Means | Next action |
| --- | --- | --- |
| `Could not resolve host` | No DNS record | Print two A records for `<dev>`, pointing at the IPs `get_site_status` lists, DNS only |
| A certificate error | Pressable hasn't issued the certificate yet | Wait, then check again. Pressable's certificates carry the hostname in the SANs, not the subject |
| A redirect to `*.cloudflareaccess.com` | Access covers dev (step 5) | Print an Access application for `<dev>/wp-json/safety-net/v1/status` alone, with a Bypass policy |
| `{"code":"rest_no_route", …}` | WordPress answers, and Safety Net isn't on yet | Nothing until step 13 |

## Phase 2: the repository

| Step | Read | ✓ when |
| --- | --- | --- |
| 6. Monthly windows | `git ls-remote --heads https://github.com/<repo> 'maintenance/*'` | Nothing is listed. For each window, `gh api repos/<repo>/compare/<production branch>...<window> --jq '[.commits[].author.login] \| unique'` decides: `renovate[bot]` alone means `--close-windows`, anyone else means a person merges it |
| 7. Environments and secrets | `gh api repos/<repo>/environments --jq '.environments[].name'`, then `gh variable list --repo <repo> --env <env>` and `gh secret list --repo <repo> --env <env>` for each one | Dev's environment has the name Safety Net accepts, with `BRANCH=maintenance`, `SITE_ID=<dev-id>`, `SITE_URL=https://<dev>`, `ENVIRONMENT` set to its own name, and an `SSH_USER` secret. The repository holds `HOST`, `SSH_HOST` and `SSH_KEY` |
| 8. The monthly process is retired | `gh api repos/<repo>/contents/.github/workflows --jq '.[].name'`; `git ls-remote --heads https://github.com/<repo> site-maintenance` | None of `auto-approve-maintenance.yml`, `combine-dependency-prs.yml`, `combine-dependency-prs-schedule.yml` or `deploy-maintenance.yml`, and no `site-maintenance` branch |
| 9. The conversion PR is merged | The same workflow listing | `maintenance.yml`, `snapshots.yml` and `deploy-dev.yml` are on the production branch |
| 10. The ruleset, and PR checks that run | `gh api repos/<repo>/rulesets --jq '.[].name'`; for an open Renovate PR into `maintenance`, `gh api repos/<repo>/commits/<head sha>/check-runs --jq .total_count` | "Green checks into maintenance" is listed, and the count is above 0 |

**Dev's SSH user (step 7).** `list_site_ftp_accounts` on `<dev-id>` lists the site's SFTP
logins. The API doesn't say which login carries the repository's `SSH_KEY`, because
`ssh_key_label` is usually null. A person confirms the username before `--dev-ssh-user`
stores it. Never store `SSH_PASS`, or an environment-level `SSH_HOST`, for Pressable.

**A PR check that never runs (step 10).** With no check runs on a commit, rolling maintenance
counts the PR as green and merges it. Two filters cause this:
- a `pull_request.branches` list that holds only `!` patterns, which matches no base branch;
- a `paths` filter such as `'**.php'`, which skips Renovate's manifest and lockfile changes.

`gh run list -R <repo> -w <file> -L 1` printing nothing means the workflow has never run.

## Phase 3: Sisyphus

| Step | Read | ✓ when |
| --- | --- | --- |
| 11. Enrolled | `sisyphus sites --format=csv` | A row for `<production>`, with `<dev-id>`, `<staging-id>`, `<repo>` and a run time no other row has |
| 12. The map | The same row's `promotes` column, and the site's page under Maintenance › Sites | It names the target the task settled (`snapshots into staging` or `into main`) |
| 13. Deploy to Dev | `gh run list -R <repo> -w deploy-dev.yml -L 1 --json conclusion,url`, then the status curl from step 4 | `success`, then `"active":true` and `"environment":"development"` |
| 14. Running | `sisyphus sites` (`enabled`) and `sisyphus list` | `enabled` is `yes`, and a run for the site is `passed` |

## Phase 4: proving it

| Step | Read | ✓ when |
| --- | --- | --- |
| 15. Ghost Inspector | api.linchpin.com's Ghost Inspector suite list, which names the site each suite is mapped to. It needs the `tests:write` scope or an admin token | At least one suite is mapped to the site. Without access, report `?` and ask: until a suite is mapped, the test step passes with nothing run |
| 16. Five unattended nights | `sisyphus list`, compared with the run time in `sisyphus sites` | The site's last five runs passed, each starting at its run time rather than when someone pressed Run now |
| 17. A snapshot reaches production | `gh pr list -R <repo> --state merged --json headRefName,baseRefName,mergedAt --jq '[.[] \| select(.headRefName \| startswith("snapshot/"))]'` | A snapshot PR merged into the promotion target after the site was enrolled, and its commit released to production with no hand fix |
