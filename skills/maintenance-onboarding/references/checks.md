# The 19 checks

Each step of the onboarding checklist, with the read that proves it. Every command here
reads, unless its section says it writes; the order of the fixes is in `SKILL.md`. `<repo>`
is `linchpin/<name>`, and `<dev>`, `<staging>` and `<production>` are hostnames, with
`<dev-id>` and so on as their Pressable site ids. The ClickUp onboarding tasks and the
team's guide on docs.linchpin.com (*Onboarding Pressable Clients to Rolling Maintenance*)
number the same 19 steps.

## Reading a Pressable site

WP-CLI on Pressable runs asynchronously: `run_site_wpcli_commands` returns a `job_id`, and
`get_site_wordpress_operation` with that id returns the output once `status` is `complete`.

- Pressable keeps only 500 characters of output, and WP-CLI's own PHP deprecations can fill
  them. Start every `eval` with `error_reporting(E_ALL & ~E_DEPRECATED);`, and print compact
  rows rather than whole JSON documents.
- Commands are passed without the leading `wp `.

One command answers steps 2 and 3 for a site:

```text
eval 'error_reporting(E_ALL & ~E_DEPRECATED); echo "ENV=" . wp_get_environment_type() . " defined=" . (defined("WP_ENVIRONMENT_TYPE") ? "yes" : "no") . " mantle=" . (is_plugin_active("mantle/mantle.php") ? "yes" : "no") . " clone=" . (defined("MANTLE_AUTO_RESOLVE_CLONE") ? MANTLE_AUTO_RESOLVE_CLONE : "none") . " safetynet=" . (file_exists(WPMU_PLUGIN_DIR . "/safety-net-loader.php") ? "yes" : "no");'
```

Sisyphus's own reads run the same way on the Pressable site that serves
packagist.linchpin.com: `sisyphus sites --format=csv` lists every enrolled site with its dev,
staging, repository, run time and promotion target, and `sisyphus list --format=csv
--limit=50` lists recent runs. Past four or five sites the CSV passes 500 characters, so
print one short row per site instead:

```text
eval 'error_reporting(E_ALL & ~E_DEPRECATED); foreach ( json_decode( WP_CLI::runcommand( "sisyphus sites --format=json", [ "return" => true ] ), true ) as $s ) { echo $s["site"] . "|" . $s["enabled"] . "|" . substr( $s["runs"], 0, 5 ) . "|" . $s["repo"] . "\n"; }'
```

## Dev's GitHub environment

Dev deploys from the `development` environment, in any case: `Development` is the same one.
[`wp-hosting-environments`](../../wp-hosting-environments/SKILL.md) owns the name, and
linchpin/actions refuses Safety Net on any other, so `dev-<slug>`, `development-<slug>` and
`site-maintenance-<slug>` all fail Deploy to Dev. When Deploy to Dev refuses Safety Net,
check this name first.

## Phase 1: hosting

| Step | Read | ✓ when |
| --- | --- | --- |
| 1. Dev is a staging site no one else uses | `get_site_status` on `<dev-id>`; `linchpin hosting audit <client>`; `sisyphus sites`; the repository's environments (step 10) | `staging: true` and `sandbox: false`. No other enrolled site lists `<dev-id>`, and no environment deploys a branch other than `maintenance` to it. A copy that takes `develop` is never dev |
| 2. Environment types | The eval above, on dev and on staging | `ENV=development` on dev, and `ENV=staging` on staging |
| 3. Mantle | The eval above, on dev | `mantle=no`, or `clone=connected` |
| 4. DNS and certificate | `dig +short <dev> A`, then `curl -s "https://<dev>/wp-json/safety-net/v1/status?cb=$RANDOM"` | `dig` prints addresses, and curl returns JSON. `rest_no_route` is fine until step 13 |
| 5. Nothing in front of the status route | `curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n'` on the same URL | No redirect to `*.cloudflareaccess.com` and no `401` |

The answers for steps 4 and 5:

| curl says | Means | Next action |
| --- | --- | --- |
| `Could not resolve host` | No DNS record | Print two A records for `<dev>`, pointing at the IPs `get_site_status` lists |
| A certificate error | Pressable hasn't issued the certificate yet | Wait, then check again. Pressable's certificates carry the hostname in the SANs, not the subject |
| A redirect to `*.cloudflareaccess.com` | The client's Access application covers dev | Add the status-route application below |
| `401` | Pressable's password protection, usually on a `mystagingwebsite.com` address | Use dev's `linchpin.build` hostname, or turn the protection off for dev |
| `{"code":"rest_no_route", …}` | WordPress answers, and Safety Net isn't on yet | Nothing until step 13 |

**Mantle's clone constant (step 3).** It writes, so only after a person's yes:
`config set MANTLE_AUTO_RESOLVE_CLONE connected --type=constant` through
`run_site_wpcli_commands` on `<dev-id>`. Re-run the eval to see `clone=connected`.

**The status-route application (step 5).** It writes, so only after a person's yes, through
the Cloudflare API (`/accounts/<account>/access/...`):

- One shared application holds every dev's status route: **Linchpin Dev/Build - Safety Net
  Status**, with the reusable Bypass policy **Safety Net Status : Dev,Build,Site ONLY**
  (Include: Everyone) and nothing else. Add dev's path, `<dev>/wp-json/safety-net/v1/status`,
  as one more destination on it (an application takes up to 50). Create the application
  only when it's missing, with a 24-hour session and hidden from the App Launcher.
- **Name dev's exact hostname, never a wildcard.** Access picks the application with the more
  specific hostname before it compares paths, so `*.linchpin.build/wp-json/...` loses to a
  client application that names `<dev>` exactly, such as `Linchpin - LCB`, and the route stays
  behind the login. An exact hostname with the path wins for that path only.
- Never add the bypass to a host-wide application, the client's or one made for dev: a
  Bypass policy is evaluated before Allow, so the whole site opens.
- A dev in `*.linchpin.dev` needs no application of its own: the `Linchpin Development
  Environments` wildcard already allows Linchpin and bypasses Ghost Inspector's IPs. One made
  for dev must carry `Ghost Inspector Skip Access` too, or the nightly tests hit the login.
- ✓ when the status curl returns JSON and `https://<dev>/` still redirects to Access.

**A new dev (step 1).** It writes, so only after a person's yes:

- Pressable's `clone_site` with production's id, a name of `<client>-maintenance`, and
  `staging: true`. It refuses with "You do not have permission to clone this site" when the
  seat the MCP uses lacks the Clone site role on production. A client's own Pressable account
  often grants fewer roles: `search_account_collaborators` with `site_id` lists them.
- On Linchpin's own account, Pressable attaches `<name>.linchpin.build` as the clone's
  primary domain. The `linchpin.build` zone is in Cloudflare: add two A records for it,
  proxied, pointing at the IPs `get_site_status` lists for the clone.
- The clone's collaborators are new logins, dev@linchpin.com's included: look up `SSH_USER`
  again (step 10).
- Then step 2 on the clone, and step 3 when production runs Mantle.

## Phase 2: the repository

| Step | Read | ✓ when |
| --- | --- | --- |
| 6. Monthly windows | `git ls-remote --heads https://github.com/<repo> 'maintenance/*' \| grep -v renovate/` | Nothing is listed. For each window, `gh api repos/<repo>/compare/<production branch>...<window> --jq '[.commits[].author.login] \| unique'` decides: `renovate[bot]` alone means `--close-windows`, anyone else means a person merges or closes it |
| 7. A `CI` workflow that runs | `gh api repos/<repo>/contents/.github/workflows --jq '.[].name'`, each workflow's `on.pull_request`, and `gh pr checks <n> -R <repo>` on a recent PR | A workflow named `CI` runs on every pull request, and a PR shows its check runs |
| 8. PHP pin | `config.platform.php` in `composer.json` on the production branch; `gh variable get PHP_VERSION -R <repo>`; production's PHP from `get_site_status` | The pin is production's minor version, written `x.y.0`, and `PHP_VERSION` is `x.y` |
| 9. Plugins outside the repository | On production (read only): `eval 'foreach ( get_option( "active_plugins" ) as $p ) { echo dirname( $p ) . " "; }'`, against `composer.json`'s `require` | Every active plugin is required by Composer or committed. Pressable's own are exempt: Jetpack, Akismet and Jetpack Protect are symlinks into `/wordpress/plugins`, and the Automattic for Agencies client is Pressable's too |
| 10. Converted | `gh api repos/<repo>/environments --jq '.environments[].name'` and dev's variables and secrets; the production branch's workflows; `git ls-remote --heads https://github.com/<repo> site-maintenance`; `gh api repos/<repo>/rulesets --jq '.[].name'` | Dev's environment is `development`, with `BRANCH=maintenance`, `SITE_ID=<dev-id>`, `SITE_URL=https://<dev>` and an `SSH_USER` secret, and the repository holds `HOST`, `SSH_HOST` and `SSH_KEY`. `maintenance.yml`, `snapshots.yml` and `deploy-dev.yml` are on the production branch. None of `auto-approve-maintenance.yml`, `combine-dependency-prs*.yml` or `deploy-maintenance.yml` remains, nor a `site-maintenance` branch or environment. The ruleset is listed when production requires checks |

**A PR check that never runs (step 7).** With no check runs on a commit, rolling maintenance
counts the PR as green and merges it. Two filters cause this:
- a `pull_request.branches` list that holds only `!` patterns, which matches no base branch;
- a `paths` filter such as `'**.php'`, which skips Renovate's manifest and lockfile changes.

`gh run list -R <repo> -w <file> -L 1` printing nothing means the workflow has never run.

**The prep PR (steps 7 and 8).** One PR into the production branch, before the conversion:

1. **`PHP_VERSION` first:** `gh variable set PHP_VERSION -R <repo> --body <x.y>`,
   production's version. `convert-repo` suggests the pin from this variable, so a stale one
   suggests the wrong pin.
2. **`ci.yml`**, named `CI`, copied from a converted client repository: one job calls
   `linchpin/actions/.github/workflows/lint.yml@v4` with `lint_paths` set to the project's
   own themes and plugins, one calls `validate-composer.yml@v4`, and both pass
   `PACKAGIST_COMPOSER_AUTH_JSON`, an organisation secret.
3. **Composer:**
   - `composer config platform.php <x.y>.0`.
   - `composer config allow-plugins.dealerdirect/phpcodesniffer-composer-installer true`.
   - `composer require --dev 'linchpin/coding-standards:^1.3' --no-install`, since
     `lint.yml` runs the repository's own php-parallel-lint and phpcs.
   - With `minimum-stability: dev`, also set `prefer-stable` to `true`, or the lock picks
     dev branches.
4. **Prove no production package moved:** the `.packages[] | "\(.name) \(.version)"` lists of
   the production branch's lock and the new one are identical. Then `composer install
   --dry-run` and `composer validate --no-check-publish` pass.
5. **Fix what the first run finds:**
   - php-parallel-lint reads every file under `lint_paths`. A short open tag (`<? } ?>`) is
     the usual parse error: production allows short tags, CI doesn't. `<?php` behaves the
     same on both.
   - PHPCS reads every PHP file the PR changes, so fixing one file brings in all of its old
     violations. Run `vendor/bin/phpcbf <file>` for the spacing.
   - Then escape output without changing what renders, or annotate with a reason where the
     call already escapes, such as `wp_get_attachment_image()`.

**A prep PR into a branch `convert-repo` will reuse.** `convert-repo --apply` force-pushes
`issue/<task>` from the production branch. Merge the prep PR before applying the conversion,
or the prep PR's commits are dropped from its branch.

**An exact Composer pin packagist no longer serves.** `composer update --lock`, and any
`composer require`, refuses when `composer.json` pins a version the repository no longer
lists, such as `linchpin/gravityforms` `2.9.25`. Don't raise a production package in the prep
PR. Write the new `content-hash` into `composer.lock` with Composer's own function, after
checking it reproduces the committed hash from the committed `composer.json`:

```text
php -r 'Phar::loadPhar("<path to composer>", "composer.phar"); require "phar://composer.phar/vendor/autoload.php"; echo Composer\Package\Locker::getContentHash(file_get_contents($argv[1]));' composer.json
```

Then `composer install --dry-run` says "Nothing to install, update or remove". Renovate
raises the stale pin once rolling maintenance runs.

**Dev's SSH user (step 10).** `SSH_USER` is the deploy account's login on dev. Which account
that is, and how to find its login with the Pressable MCP, is github-repo-setup's
[secrets and variables](../../github-repo-setup/references/secrets-and-variables.md). A new
or re-cloned dev has a new login, so look it up every time. Never reuse another
environment's.

**A production branch called `master` (step 10).** Rename it to `main` before the
conversion, after a person's yes: `gh api -X POST repos/<repo>/branches/master/rename -f
new_name=main`. GitHub moves the default branch and retargets open PRs, but nothing else.

- **In a PR into `main`:** `release-please.yml`'s branch, and, when the conversion already
  merged, `maintenance.yml`'s push branch and `snapshots.yml`'s choices.
- **Variable:** production environment's `BRANCH`, set to `main`.
- **Enrollment:** `sisyphus enroll <production> --production-branch=main`.
- **Release PR:** a person closes the open `chore(master): release …` PR, and release-please
  opens a new one.
- **Local clones:** `git branch -m master main && git fetch origin && git branch -u
  origin/main main && git remote set-head origin -a`.

## Phase 3: Sisyphus

| Step | Read | ✓ when |
| --- | --- | --- |
| 11. Enrolled | `sisyphus sites` (or the compact eval above) | A row for `<production>`, with `<dev-id>`, `<staging-id>`, `<repo>` as GitHub spells it, and a run time 30 minutes from every other row |
| 12. Its environments in api.linchpin.com | `linchpin-governing/v1/environments`, through the REST eval below | Production, dev and staging each have a row, with the roles `production`, `development` and `staging` |
| 13. Deploy to Dev | `gh run list -R <repo> -w deploy-dev.yml -L 1 --json conclusion,url`, then the status curl from step 4 | `success`, then `"active":true` and `"environment":"development"` |
| 14. Suites | `sisyphus/v1/admin/suites/<production>`, through the REST eval below | Dev's suite is mapped with `nightly: true`; staging's and production's are mapped with `nightly: false` |
| 15. Running | `sisyphus sites` (`enabled`) and `sisyphus list` | `enabled` is `yes`, and a run for the site is `passed` |

**Where snapshots promote (step 12).** Before proposing `staging`, list what the `staging`
branch holds that the production branch lacks:

```text
git log --no-merges --cherry-pick --right-only --oneline origin/<production branch>...origin/staging
```

- Nothing listed: `staging` can take snapshots.
- Unreleased work, such as a feature merged from `develop`: promote into `main`. A snapshot
  merged into that `staging` conflicts on `composer.json` and `composer.lock`, and can't
  reach production until the feature ships.
- Old commits only, such as stale lockfile bumps: promote into `main`, or a person resets
  `staging` from the production branch.
- Change an enrolled site's target with `sisyphus enroll <production> --promotion-target=main`.

**Enrolling from WP-CLI (step 11).** It writes, so only after a person settles the choices:

```text
sisyphus enroll <production> --dev=<dev-id> --staging=<staging-id> --repo=<Owner/Name> --maintenance-branch=maintenance --production-branch=<branch> --staging-branch=staging --promotion-target=<main|staging> --run-time=<HH:MM> --timezone=America/New_York
```

- **No `--enable` yet:** that waits for step 13.
- **`--repo` exactly as GitHub spells it** (`gh repo view <repo> --json nameWithOwner`):
  api.linchpin.com matches the repository GitHub's webhooks name, letter case included.
- **Roles:** enrolling registers dev and staging in api.linchpin.com and settles their
  roles, even where a site reported otherwise. That is step 12.

**Sisyphus's admin routes from WP-CLI (steps 12 and 14).** They need an administrator, so an
eval on packagist.linchpin.com sets one first, then calls the route with `rest_do_request`:

```text
eval 'error_reporting(E_ALL & ~E_DEPRECATED); $u = get_users( [ "role" => "administrator", "number" => 1 ] ); wp_set_current_user( $u[0]->ID ); $q = new WP_REST_Request( "GET", "/linchpin-governing/v1/environments" ); $q->set_query_params( [ "per_page" => 100 ] ); foreach ( (array) ( rest_do_request( $q )->get_data()["environments"] ?? [] ) as $e ) { $e = (array) $e; if ( false !== stripos( $e["hostname"], "<client>" ) ) { echo $e["environment_id"] . "|" . $e["role"] . "|" . $e["hostname"] . "\n"; } }'
```

- **Suite ids:** a `GET` on `/sisyphus/v1/admin/suites` lists every suite in the account.
  Match by the house names `<Client> - Site Maintenance` (dev), `<Client> - Staging` and
  `<Client> - Prod`.
- **Mapping a suite** writes: a `POST` on `/sisyphus/v1/admin/suites/<production>/<suite id>`
  with the parameters `environment` (the `environment_id` above) and `nightly` (`true` only
  for dev's suite).
- **Checking:** a `GET` on `/sisyphus/v1/admin/suites/<production>` lists what is mapped.

**A dev suite (step 14).** api.linchpin.com lists, maps, updates and runs suites, but can't
create one. Calling Ghost Inspector's API directly (`https://api.ghostinspector.com/v1`, key
as `?apiKey=`) needs a person's yes, since the api is otherwise its only caller.

- **A staging suite exists:** `POST /suites/<id>/duplicate/`, then rename the copy
  `<Client> - Site Maintenance` and point its `baseUrl` variable at dev, each in its own
  `POST /suites/<copy>/` (`{"name": …}`, then `{"variables.baseUrl": {"value": …}}`).
  Delete from the copy any test that completes a checkout or submits a form: dev is a copy of
  production, and Safety Net doesn't turn payment gateways off.
- **None exists:** `POST /suites/` with `name` and `organization` (from
  `GET /organizations/`), set `baseUrl`, then `POST /suites/<id>/import-test/json` with one
  test whose `startUrl` is `{{baseUrl}}` and whose steps are `assertElementPresent` on
  `body`, `assertElementNotPresent` on `#error-page`, and `assertTextNotPresent` on `body`
  with the value `There has been a critical error`.
- ✓ when `GET /tests/<id>/execute/` passes against dev, and step 14's mapping lists the suite.

## Phase 4: proving it

| Step | Read | ✓ when |
| --- | --- | --- |
| 16. Morning checks | Maintenance › Overview, and the site's events on status.linchpin.com | Each night since enabling is accounted for on the task |
| 17. A snapshot reaches production | `gh pr list -R <repo> --state merged --json headRefName,baseRefName,mergedAt --jq '[.[] \| select(.headRefName \| startswith("snapshot/"))]'` | A snapshot PR merged into the promotion target after the site was enrolled, and its commit released to production with no hand fix |
| 18. No stall | `gh issue list -R <repo> --state open --search 'by hand in:title'`; `gh run list -R <repo> -w maintenance.yml -L 1` | No open "Bring <branch> into maintenance by hand" issue, and the last Rolling Maintenance run passed |
| 19. Five unattended nights | `sisyphus list`, compared with the run time in `sisyphus sites` | The site's last five runs passed, each starting at its run time rather than when someone pressed Run now |
