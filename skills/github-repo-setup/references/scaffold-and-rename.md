# Populating the repo, and scrubbing the source project out of it

## Choosing the source

**There is no default — always ask the user which repo to populate from**, and confirm the
answer before creating anything. Find candidates first so the question has real options:

```bash
gh search code --owner linchpin "actions/.github/workflows/deploy.yml@v3" \
  --limit 30 --json repository,path --jq '.[].repository.nameWithOwner' | sort -u
```

Three routes:

### A) `linchpin/deploy-scaffold` — the tooling baseline only

It is a GitHub **template repo**, so creation and population are one step — but it is
stale, so pick it only because the user asked for it:

```bash
gh repo create linchpin/<name> --private --template linchpin/deploy-scaffold \
  --description "<one line>"
```

It ships the tooling baseline (composer.json, phpcs, phplint, commitlint, release-please,
renovate, `.distignore`, `index.php`) **and the generator that produced it** — a `plop` CLI
(`npm install && npm run create-wp-install`) filling Handlebars templates from prompts.

Two things to know before using it:

- **`--template` copies the generator into your repo.** Delete it on the working branch:
  `plopfile.js`, `prompts.js`, `prompts/`, `actions/`, `scaffold/`, `install-package.json`,
  `wiki/` — plus `CHANGELOG.md` and the lockfiles, which are regenerated for this project.
- **Its deploy workflows are unusable.** The root has none; the generator writes into
  `output/` and emits only pre-v3 per-host callers (`deploy-wpengine-*`,
  `deploy-cloudways-*`) pinned to `@main`, which no longer resolves — and there is **no
  Pressable template at all**. Take the callers below instead.

Also rename `phpcs.xml` → `phpcs.xml.dist`, which is what the house tooling detects.

### B) Another repo the user names — usually the better answer

A sibling already deploying on v3 with the same host gives you working callers and a layout
that matches how we build now. Also the route when this isn't a WordPress site repo at all.

```bash
# If it is a template repo
gh repo create linchpin/<name> --private --template linchpin/<source>

# Otherwise: copy the tree, not the history
gh repo create linchpin/<name> --private --description "<one line>"
git clone --depth 1 git@github.com:linchpin/<source>.git <name>
cd <name> && rm -rf .git && git init -b main
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
| `deploy.yml@v3` | Correct — `v3` is a maintained branch and the fleet standard |
| `deploy-wpengine.yml@main`, `deploy-cloudways.yml@main`, `build.yml@main` | **Broken** — those files were removed from `main` when it became v4; the run fails at startup |
| `…@main` (anything) | Unpinned against a branch that is now v4 — repin to `@v3` |
| `deploy.yml@v4` / `@v4.x.y` | The newer line. Ask before changing it |
| Nothing | Add the callers below |

### v3 caller — production (release-triggered)

```yaml
name: Deploy to Production

on:
  release:
    types: [published] # Only run when a release is published via release-please

jobs:
  deploy:
    uses: linchpin/actions/.github/workflows/deploy.yml@v3
    secrets: inherit
    with:
      environment: 'production-<slug>'
      skip_lint: false
      do_backup: true
```

### v3 caller — staging (branch-triggered)

```yaml
name: Deploy to Staging

on:
  push:
    branches:
      - 'staging'

jobs:
  deploy:
    uses: linchpin/actions/.github/workflows/deploy.yml@v3
    secrets: inherit
    with:
      environment: 'staging-<slug>'
      skip_lint: false
      do_backup: false   # staging rarely needs an on-demand backup
```

### One repo, several sites

When a repo deploys more than one site, the second job **inherits the first job's build**
instead of rebuilding — the pattern `cando` uses for its two properties:

```yaml
jobs:
  deploy_first:
    uses: linchpin/actions/.github/workflows/deploy.yml@v3
    secrets: inherit
    with:
      environment: 'production-<site-a>'
      skip_lint: false
      do_backup: true

  deploy_second:
    needs: deploy_first        # the inherited build must exist first
    uses: linchpin/actions/.github/workflows/deploy.yml@v3
    secrets: inherit
    with:
      environment: 'production-<site-b>'
      skip_lint: true
      do_backup: true
      inherit_build: true
```

Each environment carries its own `SITE_ID`, `SITE_URL`, `ENVIRONMENT`, and `BRANCH`.

### v3 caller inputs

`environment` (the only one that matters), `skip_lint`, `do_backup`, `inherit_build`,
`build_commands`, `post_deploy_command`. **There is no rollback path in v3** —
`release_tag`, `build_for_release`, `health_check`, `protected_paths` and
`preserve_symlinks` are v4 inputs and fail validation on a v3 caller. A v3 rollback means
re-running the deploy from the previous tag.

v3 callers need no `permissions:` or `concurrency:` block; the shared workflow handles
deployment bookkeeping and supersedes the previous deployment itself.

The `environment:` value in each caller **must** name an environment that exists on the
repo, and that environment must set `ENVIRONMENT` to the same string. Check the whole set
at once:

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
| `.github/workflows/*.yml` | `environment:` values, any hardcoded URL, install name, or site id left in a v3 file |
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
