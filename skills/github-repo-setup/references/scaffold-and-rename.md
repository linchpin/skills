# Populating the repo, and scrubbing the source project out of it

## Choosing the source

**There is no default — always ask the user which repo to populate from**, and confirm the
answer before creating anything. Find candidates first so the question has real options:

```bash
gh search code --owner linchpin "actions/.github/workflows/deploy.yml@v4" \
  --limit 30 --json repository,path --jq '.[].repository.nameWithOwner' | sort -u
```

Three routes:

### A) `linchpin/deploy-scaffold` — the tooling baseline only

It is a GitHub **template repo**, so creation and population are one step — but it is
stale, so pick it only because the user asked for it:

```bash
gh repo create linchpin/<name> --private --template linchpin/deploy-scaffold \
  --description "<one line>"
gh repo clone linchpin/<name> "$DEST"     # $DEST from step 5 — never the current directory
```

It ships the tooling baseline (composer.json, phpcs, phplint, commitlint, release-please,
renovate, `.distignore`, `index.php`) **and the generator that produced it** — a `plop` CLI
(`npm install && npm run create-wp-install`) filling Handlebars templates from prompts.

Two things to know before using it:

- **`--template` copies the generator into your repo.** Delete it on the working branch:
  `plopfile.js`, `prompts.js`, `prompts/`, `actions/`, `scaffold/`, `install-package.json`,
  `wiki/` — plus `CHANGELOG.md` and the lockfiles, which are regenerated for this project.
- **Its deploy workflows are unusable.** The root has none; the generator writes into
  `output/` and emits only per-host callers that predate v3 (`deploy-wpengine-*`,
  `deploy-cloudways-*`) pinned to `@main`, which no longer resolves — and there is **no
  Pressable template at all**. Take the callers below instead.

Also rename `phpcs.xml` → `phpcs.xml.dist`, which is what the house tooling detects.

### B) Another repo the user names — usually the better answer

A sibling already deploying on v4 with the same host gives you working callers and a layout
that matches how we build now. Also the route when this isn't a WordPress site repo at all.

```bash
# If it is a template repo
gh repo create linchpin/<name> --private --template linchpin/<source>

# Otherwise: copy the tree, not the history.
# $DEST is the location agreed in step 5 — outside every existing checkout.
gh repo create linchpin/<name> --private --description "<one line>"
git clone --depth 1 git@github.com:linchpin/<source>.git "$DEST"
cd "$DEST" && rm -rf .git && git init -b main
git remote add origin git@github.com:linchpin/<name>.git

# Land the source tree on main UNCHANGED, so the rename is a reviewable diff
git add -A && git commit -m "chore(<TASK-KEY>): scaffold from <source>"
git push -u origin main

# Then do every edit on the working branch
git switch -c issue/<TASK-KEY>
```

Pushing the untouched tree first mirrors what `--template` does on route A, so both routes
reach the same place: a `main` holding only the scaffold, and one PR that turns it into
this project.

**Never push another project's history into a new client repo.** It carries their commit
messages, author emails, and any secret ever committed and later removed.

### C) Nothing

`gh repo create linchpin/<name> --private` and configure from step 6 of the skill.

## Verify the pipeline pin

```bash
grep -rn "linchpin/actions/.github/workflows" .github/workflows/
```

| What you see | Meaning |
| --- | --- |
| `deploy.yml@v4` / `@v4.x.y` | Correct — the current line |
| `deploy.yml@v3` | An older repo on the maintained `v3` branch. Leave it; say so |
| `deploy-wpengine.yml@main`, `deploy-cloudways.yml@main`, `build.yml@main` | **Broken** — those files were removed from `main` when it became v4; the run fails at startup |
| `…@main` (anything) | Unpinned against the moving tip — repin to `@v4` |
| Nothing | Add the callers below |

A v4 site repo carries five callers. Two are dispatched **by file name** — api.linchpin.com
dispatches `deploy-production-continue.yml`, Sisyphus dispatches `deploy-dev.yml` — so keep
the names. All of them pass `secrets: inherit` and grant `contents: write` and
`deployments: write`, because the shared build job attaches `release.zip` and a called
workflow cannot exceed its caller's grant.

### v4 caller — `deploy-production.yml` (release-triggered)

```yaml
name: Deploy to Production

on:
  release:
    types: [published] # Only run when a release is published via release-please

concurrency:
  group: deploy-production
  cancel-in-progress: false

permissions:
  contents: write
  deployments: write

jobs:
  preflight:
    name: Preflight
    uses: linchpin/actions/.github/workflows/validate-composer.yml@v4
    secrets: inherit

  deploy:
    name: Deploy to Production
    needs: [preflight]
    uses: linchpin/actions/.github/workflows/deploy.yml@v4
    secrets: inherit
    with:
      environment: production
      build_for_release: ${{ github.event.release.tag_name }}
      do_backup: true
```

`do_backup: true` has api.linchpin.com back the site up first and then dispatch the continue
workflow, which deploys the build the first run made.

### v4 caller — `deploy-production-continue.yml` (dispatched by api.linchpin.com)

```yaml
name: Continue Deploy to Production

on:
  workflow_dispatch:
    inputs:
      deployment_id:
        description: "GitHub deployment ID from the original deploy run"
        required: true
        type: string
      workflow_run_id:
        description: "Run ID of the original deploy (source of the release artifact)"
        required: true
        type: string
      release_tag:
        description: "Set when the original deploy used a release asset (e.g. v1.2.0)"
        required: false
        default: ""
        type: string

concurrency:
  group: deploy-production
  cancel-in-progress: false

permissions:
  contents: read
  deployments: write
  actions: read

jobs:
  deploy:
    name: Continue Deploy to Production
    uses: linchpin/actions/.github/workflows/deploy-continue.yml@v4
    secrets: inherit
    with:
      environment: production
      deployment_id: ${{ inputs.deployment_id }}
      workflow_run_id: ${{ inputs.workflow_run_id }}
      release_tag: ${{ inputs.release_tag }}
```

### v4 caller — `deploy-staging.yml` (branch-triggered)

```yaml
name: Deploy to Staging

on:
  push:
    branches:
      - staging

concurrency:
  group: deploy-staging
  cancel-in-progress: false

permissions:
  contents: write
  deployments: write

jobs:
  deploy:
    name: Deploy to Staging
    uses: linchpin/actions/.github/workflows/deploy.yml@v4
    secrets: inherit
    with:
      environment: staging
```

### v4 caller — `deploy-dev.yml` (dispatched by Sisyphus)

`bin/convert-repo` in linchpin/actions writes this one, from
`templates/rolling-maintenance/deploy-dev.yml`, together with `maintenance.yml` and
`snapshots.yml`; prefer running it over hand-copying. The shape, so you recognise it:

```yaml
name: Deploy to Dev

# Sisyphus finds its dispatch by the correlation_id in the name.
run-name: Deploy ${{ github.ref_name }} to dev ${{ inputs.correlation_id }}

on:
  workflow_dispatch:          # never on push — a push would land mid-sync
    inputs:
      correlation_id:
        description: "Set by Sisyphus to find this run; leave it empty"
        type: string
        required: false

concurrency:
  group: deploy-dev
  cancel-in-progress: false

permissions:
  contents: write
  deployments: write

jobs:
  deploy:
    name: Deploy to Dev
    uses: linchpin/actions/.github/workflows/deploy.yml@v4
    secrets: inherit
    with:
      environment: development
      correlation_id: ${{ inputs.correlation_id }}
      safety_net: true
```

`safety_net: true` installs Linchpin's Safety Net as an mu-plugin and fails the deploy unless
the production data the nightly sync copied onto dev is scrubbed. It is refused for any
other `environment`, and on a server whose `WP_ENVIRONMENT_TYPE` is not `development`.

### v4 caller — `rollback.yml` (manual)

```yaml
name: Rollback

on:
  workflow_dispatch:
    inputs:
      release_tag:
        description: "Release tag to redeploy (e.g. v1.1.0)"
        required: true
        type: string
      environment:
        description: "Environment to roll back"
        required: true
        type: choice
        options:
          - staging
          - production
        default: staging

concurrency:
  group: deploy-${{ inputs.environment }}
  cancel-in-progress: false

permissions:
  contents: write
  deployments: write

jobs:
  deploy:
    name: Roll back ${{ inputs.environment }} to ${{ inputs.release_tag }}
    uses: linchpin/actions/.github/workflows/deploy.yml@v4
    secrets: inherit
    with:
      environment: ${{ inputs.environment }}
      release_tag: ${{ inputs.release_tag }}
```

A rollback redeploys the `release.zip` attached to an earlier release, without a backup.
Dev is not in the list on purpose: it is rebuilt from production every night.

### One repo, several sites

When a repo deploys more than one site, each site is its own environment and its own
`deploy.yml` job, and the `<stage>-<slug>` naming from v3 is the one to keep so the names
stay distinct — `production-insurance`, `production-financial`. v4 has no `inherit_build`;
each job builds. Each environment carries its own `SITE_ID`, `SITE_URL` and `BRANCH`.

### v4 caller inputs

`environment` (the only one that matters), `build_for_release`, `release_tag`, `do_backup`,
`maintenance_mode`, `health_check` (default `true`), `protected_paths`,
`preserve_symlinks`, `runner`, `build_runner`, `correlation_id`, `safety_net`,
`safety_net_version`, `continue_workflow`, `build_commands`, `post_deploy_command`.
`skip_lint` and `inherit_build` are v3 inputs and fail validation on a v4 caller.

The `environment:` value in each caller **must** name an environment that exists on the
repo. Check the whole set at once:

```bash
grep -rhn "environment:" .github/workflows/ | sed 's/^ *//' | sort -u
gh api repos/linchpin/<name>/environments --jq '.environments[].name'
```

## The rename pass

Run this on the `issue/<task-key>` branch, never on `main`.

A templated repo is full of the source project's identity. Find it before you edit it —
the slug appears in forms that a single find-and-replace will miss (`my-project`,
`My_Project`, `MyProject`, `MY_PROJECT`, `my_project`).

```bash
OLD=<source-slug>; NEW=<new-slug>
grep -rniI --exclude-dir={.git,vendor,node_modules,build,dist} \
  -e "$OLD" -e "${OLD//-/_}" -e "$(echo "$OLD" | tr -d '-')" . | cut -d: -f1 | sort | uniq -c | sort -rn
```

### Inventory — where the old identity hides

| File | What to change |
| --- | --- |
| Generator leftovers | Delete `plopfile.js`, `prompts.js`, `prompts/`, `actions/`, `scaffold/`, `install-package.json`, `wiki/` — scaffold route only |
| `composer.json` | `name`, `description`, `autoload` PSR-4 namespace, `installer-paths` |
| `package.json` / `package-lock.json` | `name`, `description`, `repository` |
| `README.md` | Title, description, **CI badge URLs** (they silently point at the old repo) |
| `.github/workflows/*.yml` | `environment:` values, any hardcoded URL, install name, or site id left in a workflow file |
| `release-please-config.json`, `.release-please-manifest.json` | Component/package names and paths |
| `CHANGELOG.md` | Delete it — release-please writes a new one from this repo's commits |
| `commitlint.config.*` | Scope allow-lists that name the old project |
| `themes/<old>/` | Directory name, `style.css` header (`Theme Name`, `Text Domain`), `theme.json`, enqueued handles |
| `plugins/<old>-functionality/` | Directory and bootstrap filename, plugin header, `Text Domain` |
| PHP source | Namespaces, class prefixes, function prefixes, constants, text domains, hook/filter prefixes, option keys |
| `.distignore`, `phpcs.xml.dist`, `phpstan.dist.neon` | Paths that name the old theme/plugin directories |
| `.linchpin.json` | Local environment names and paths ([`project-context`](../../project-context/SKILL.md)) |
| `docs/`, wiki pages | Project name, site URLs |

### Two that are easy to miss

- **Text domains and hook prefixes.** Renaming the directory but not the text domain leaves
  translations loading from a domain nothing registers — no error, just untranslated strings.
- **README badge URLs.** They render fine while pointing at the source project's Actions,
  so the new repo appears to have passing CI it never ran.

### Verify

```bash
grep -rniI --exclude-dir={.git,vendor,node_modules,build,dist} "$OLD" . || echo "clean"
composer validate --no-check-publish
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))" && echo "package.json ok"
```

Anything left should be a deliberate keep (a genuine reference to the other project), and
worth saying out loud in the handoff rather than leaving for someone to find.
