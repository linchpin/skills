---
name: github-repo-setup
description: Create a GitHub repo under the linchpin org and wire it for deployments — populated from a source repo you always ask the user to name, with the environments plus the repository and environment secrets and variables that linchpin/actions v3 reads. Use when starting a new client site or product repo, when asked to "create the repo", "set it up for deploys", or "add the deploy secrets/variables" — including when the repo already exists and only needs wiring — when the repo name is already taken, when a deploy fails because HOST or ENVIRONMENT is empty, or when workflows point at `@main` and no longer resolve. Not for the repo contents or local Studio wiring — use `wp-local-setup`.
version: 2.6.0
allowed-tools: Read Grep Glob Bash(gh auth status*) Bash(gh repo view*) Bash(gh secret list*) Bash(gh variable list*) Bash(gh search code*)
---

# New GitHub repo, ready to deploy

A Linchpin project deploys through [`linchpin/actions`](https://github.com/linchpin/actions):
thin caller workflows in the project repo call the shared `deploy.yml`, which fans out by
`vars.HOST` to the per-host deploy workflow. **Every site-specific value comes from GitHub
variables and secrets**, not from the workflow file. A repo is "ready to deploy" when the
callers are pinned correctly, the environments exist with the exact names the callers pass,
and each environment resolves a complete set of `vars` and `secrets`.

**Pin `@v3`.** `v3` is a maintained *branch* of `linchpin/actions` and is what the fleet
runs — `LCB`, `birth23`, `cando`, `malcosaw`, `mitsts`, `montycloud`, `acvo`, `cgs`, `neit`
and others. `v4` exists (a floating tag plus `v4.x.y` releases) and `linchpin.com` runs it,
but it is not the default for a new repo. Set a repo up on v3 unless the user says
otherwise, and never migrate an existing repo across the line as a side effect of this
skill.

The failure this skill prevents: a repo that looks finished, whose first release deploy
fans out to nothing — because `vars.HOST` was never set — or records its deployment against
an empty environment, because `vars.ENVIRONMENT` was.

## When to use

- Standing up a **new** client site or product repo under the `linchpin` org.
- Wiring up a repo **someone already created** — empty, or already holding its code.
- Adding deploy wiring (environments, secrets, variables) to a repo that has none.
- Repinning a repo whose workflows point at `@main` and no longer resolve.
- A deploy fails on a missing/empty variable, secret, or environment.

**Not this skill:**

- **The repo's contents and local dev** (wp-content shape, Composer, Studio symlink) →
  [`wp-local-setup`](../wp-local-setup/SKILL.md).
- **Operating the live server** after a deploy → [`wp-pressable`](../wp-pressable/SKILL.md).
- **Commit/PR grammar and release-please** → [`commit-and-release`](../commit-and-release/SKILL.md).
- **The `WP_ACCESS_TOKEN` docs secret** → [`docspress-publish`](../docspress-publish/SKILL.md).
- **Which reusable workflows exist and what each input does** → the `linchpin/actions`
  README, which is canonical. This skill owns *provisioning*, not the pipeline.

## Owns

Canonical for: creating the GitHub repo, choosing and confirming what populates it, the
scaffold→project rename pass, and the **scope decision** for every secret and variable
(org / repository / environment).

Deferred: the pipeline itself (`linchpin/actions`), the repo's file layout
(`wp-local-setup`), the task key and branch (`task-tracking`).

## Preflight

Detect, don't assume — read before you create anything:

```bash
gh auth status                       # authenticated, and scoped to the linchpin org
gh api user --jq .login
```

| Check | Why it matters |
| --- | --- |
| `gh` authenticated with org access | Everything below is `gh`; without it, stop and say so |
| A ClickUp task key, or an explicit `NO-TASK` | The working branch is named after it — resolve it in step 1, before anything else |
| Host is decided (`pressable` / `wpengine` / `cloudways`) | Chooses the required secret set; **ask, never guess** |
| Whether production/staging installs already exist | You cannot fill `SITE_ID`/`INSTALL_NAME`/`SSH_*` before the host does |

If the host or the install isn't provisioned yet, **create the repo and set what you know**,
then stop and report exactly which variables and secrets are still missing. A half-configured
environment that fails loudly beats a guessed value that deploys to the wrong site.

## Procedure

**The repo may already exist.** Creation is one step, not a prerequisite — find your row,
run those steps, skip the rest:

| What you have | Run | Skip |
| --- | --- | --- |
| No repo yet | All of it, 1 → 11 | — |
| A repo you created, still **empty** (no commits) | 1, 3, 5–11 | 2 (creation), 4 |
| A repo that **already has its code** | 1, 5–11 | 2–4, and step 7's rename if it's already this project's own code |
| A repo that already deploys; one value is wrong | 1, 8–10 | the rest |

Two steps are never skipped once any file changes: **step 1** (the task key names the
branch) and **step 5** (nothing lands on `main` directly). Steps 8–10 are settings, not
files, so they apply to an existing repo exactly as they do to a new one — under step 9 and
10's check-before-write rule, which matters far more on a repo that is already live.

### 1. Resolve the task key — the branch name depends on it

Ask before touching GitHub: **does a task already exist for this?**

- **Yes** → take the ClickUp custom ID verbatim (`LINCHPIN-5164`), never the internal id.
- **No** → offer to create one, and ask **where**. A repo that doesn't exist yet has no
  `.clickup.json` to route from, so the Space, Folder, and List have to come from the user;
  confirm the destination in one line before creating.
  [`task-tracking`](../task-tracking/SKILL.md) owns the creation flow — including reading
  the key back afterwards, because the create response often returns `custom_id: null`.
  [`engagement-types`](../engagement-types/SKILL.md) is the map of which Space a new client
  project belongs in.
- **Neither** → the branch is `no-task/<short-kebab-slug>` and the commit scope is
  `NO-TASK`. Say so now, so it isn't a surprise at commit time.

Result: a key like `LINCHPIN-5164`, or an explicit `NO-TASK`.

### 2. Name the repo — and check the name is free

Ask the user for the repo name. Convention: the project slug, lowercase and hyphenated —
the same slug used for the theme, the functionality plugin, and the ClickUp space
(`hari`, `onedigital`, `linchpin.com`).

**Check it before proposing it.** Reusing an existing project slug is the common case, not
the edge case:

```bash
# Command substitution keeps GitHub's 404 body out of the output
if found=$(gh api repos/linchpin/<name> --jq \
  '"\(.full_name) — \(if .private then "private" else "public" end)\(if .archived then ", ARCHIVED" else "" end), pushed \(.pushed_at[0:10]) — \(.html_url)"' 2>/dev/null); then
  echo "TAKEN: $found"
else
  echo "no repo visible at linchpin/<name>"
fi
```

If it exists, **stop and tell the user what's already there** — full name, visibility,
archived or not, last push, and the URL — then ask which they want:

| They want | Do this |
| --- | --- |
| A different name | Re-check the new name from the top of this step |
| To use the existing repo | Skip creation — pick the matching row in the entry table above (step 5 onward if it has code, step 3 first if it's empty) |
| The old one gone or renamed | **They** do it, in the GitHub UI. Never delete or rename a repo on their behalf |

A 404 is *not* proof the name is free — a private repo your token can't see 404s too.
`gh repo create` refuses with `Name already exists on this account`, and **that error is
authoritative**: surface it to the user, never work around it by appending `-2`, `-new`,
or a year.

Then confirm the full target back to them — **owner, name, and visibility** — before
running anything. Default owner `linchpin`, default visibility **private**; a public repo
is a deliberate, stated choice.

### 3. Ask what populates it — there is no default

**Always ask. Never pick a source on your own.** The old default,
`linchpin/deploy-scaffold`, is stale enough that using it unasked costs more than it saves
(see below), and no other single repo is right for every project.

Offer real candidates rather than an open question. The best source is usually a sibling
repo already deploying on v3 with the same host, so go find some:

```bash
# Repos whose workflows already call the v3 pipeline
gh search code --owner linchpin "actions/.github/workflows/deploy.yml@v3" \
  --limit 30 --json repository,path --jq '.[].repository.nameWithOwner' | sort -u
```

Then present the options with their trade-offs and let the user choose:

| Source | What you get | Cost |
| --- | --- | --- |
| A sibling repo already on v3, same host | Working v3 callers, a proven `composer.json`, a theme/plugin layout that matches how we build now | A full rename pass (step 7), and you must not carry its git history |
| `linchpin/deploy-scaffold` | The tooling baseline — `composer.json`, `phpcs`, `phplint`, `commitlint`, `release-please`, `renovate`, `.distignore`, `index.php` | It is a **generator**, not a project: `--template` also copies `plopfile.js`, `prompts/`, `scaffold/`, `actions/`, `wiki/`, all of which you delete in step 7. Its root has **no deploy workflows**, and what its generator emits is pre-v3, pinned to a `@main` that no longer resolves, with **no Pressable option at all** |
| Nothing | An empty repo you populate yourself | You write the tooling baseline too |

Whatever they pick, the deploy workflows come from
[`references/scaffold-and-rename.md`](references/scaffold-and-rename.md) — never from the
scaffold's generator.

**Confirm the choice out loud before creating.** It determines everything the repo starts
with, and undoing it means recreating the repo.

### 4. Create the repo

```bash
gh repo create linchpin/<name> --private --template linchpin/<source-they-chose> \
  --description "<one line>"
```

Result: the repo exists, with the source's contents on `main`, untouched.

### 5. Cut the working branch — nothing lands on `main` directly

**Clone it somewhere of its own first.** You are almost certainly sitting in an unrelated
checkout — the skills library, another client project — and a bare `gh repo clone` drops the
new project *inside* it. Ask where the user keeps their repos (`~/GitHub/<name>` is the usual
shape; a project that has a `.linchpin.json` records the house base path as `agentBasePath`),
then refuse to clone anywhere inside an existing working tree:

```bash
DEST="$HOME/GitHub/<name>"            # confirm this with the user
PARENT="$(dirname "$DEST")"; mkdir -p "$PARENT"

if git -C "$PARENT" rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "REFUSE: $PARENT is inside $(git -C "$PARENT" rev-parse --show-toplevel)"
  echo "Pick a location outside any checkout."
else
  gh repo clone linchpin/<name> "$DEST" && cd "$DEST"
fi

git switch -c issue/<TASK-KEY>        # or no-task/<short-kebab-slug>
```

**Keep `$DEST` and `$PARENT` quoted in every command that touches them.** Repo folders often
sit under a directory with a space in its name (`~/Only Repos`, `~/Documents/GitHub Projects`),
and an unquoted `cd $DEST` or `gh repo clone … $DEST` splits it into two arguments — which
fails in the confusing way, by creating or acting on the wrong path rather than erroring.
Every snippet here is already quoted; keep it that way when you adapt them.

Everything after this runs in `$DEST`. If a command later in this skill seems to be acting on
the wrong repo, check `git rev-parse --show-toplevel` before anything else.

**If the repo is empty, `main` does not exist yet** — a repo with no commits has an unborn
branch, so there is nothing to base a PR on and `git clone` says so ("you appear to have
cloned an empty repository"). Land the starting contents on `main` first, then branch:

```bash
git switch -c main                                  # or: git checkout -B main
# ... put the scaffold contents in place (step 3) ...
git add -A && git commit -m "chore(<TASK-KEY>): scaffold from <source>"
git push -u origin main
git switch -c issue/<TASK-KEY>
```

**Every code change from here — the workflow pins, the rename pass, `.linchpin.json` —
is committed on that branch and reaches `main` by PR.** Leaving `main` exactly as the
scaffold created it makes the PR diff the entire "make this ours" change, reviewable in one
pass, and revertable as one commit if the wrong source repo was chosen.

Steps 8–10 are the exception, and not by choice: environments, variables, and secrets are
**repository settings, not files**. They apply the moment you set them, on no branch, and
are not part of the PR. Say that in the handoff.

Result: `git rev-parse --show-toplevel` is the new project's own directory,
`git branch --show-current` is `issue/<TASK-KEY>`, and `main` is untouched.

### 6. Check what the scaffold gave you, and pin `@v3`

Whatever the source was, its pins are the source's, not yours. Check what you actually got:

```bash
grep -rn "linchpin/actions/.github/workflows" .github/workflows/ 2>/dev/null
```

| What you find | What it means | Do |
| --- | --- | --- |
| `deploy.yml@v3` | Correct — the fleet standard | Keep |
| `deploy-wpengine.yml@main`, `deploy-cloudways.yml@main`, `build.yml@main` | **Broken.** Those files no longer exist on `main`; the run fails at startup with *unable to find reusable workflow* | Replace with the v3 callers in [`references/scaffold-and-rename.md`](references/scaffold-and-rename.md) |
| Anything else `@main` | Unpinned against a branch that has moved on to v4 | Repin to `@v3` |
| `deploy.yml@v4` or `@v4.x.y` | The newer line. Not wrong, but not the default | **Ask** — don't silently downgrade a repo someone deliberately put on v4 |
| Nothing | No deploy workflows | Add the v3 callers from the same file |

Retired v3-era secret names in a workflow — `PRIVATE_KEY`, `CLOUDWAYS_SSH_KEY`,
`MANTLE_SECRET` — mark a template old enough to predate v3 itself. The current names are
`SSH_KEY` / `SSH_USER` / `SSH_HOST` and `MANTLE_API_BEARER`; a repo may still carry a
`PRIVATE_KEY` secret from years ago that nothing reads.

**Never mix lines.** A caller on `@v3` with `@v4`-only inputs (`build_for_release`,
`release_tag`, `health_check`, `protected_paths`) fails validation; a `@v4` caller passing
`skip_lint` does too.

Result: every deploy workflow pins `@v3`, passes `secrets: inherit`, and uses only v3 inputs.

### 7. Make it this project's own — strip the generator, then rename

**If the user chose `linchpin/deploy-scaffold`, delete its generator first.** None of it
belongs in a client repo, and left in place it makes `package.json` describe the scaffold
rather than the project:

```bash
git rm -r --cached -q plopfile.js prompts.js prompts actions scaffold \
  install-package.json wiki 2>/dev/null
rm -rf plopfile.js prompts.js prompts actions scaffold install-package.json wiki
rm -f CHANGELOG.md package-lock.json composer.lock   # regenerated for this project
```

`CHANGELOG.md` goes because release-please writes a fresh one from this repo's commits;
the lockfiles go because they resolve the scaffold's dependency set, not the project's.
Keep `composer.json`, `package.json` (rewritten in the rename), `phpcs.xml`,
`.phplint.yml`, `commitlint.config.cjs`, `release-please-config.json`, `renovate.json`,
`.distignore`, `.editorconfig`, `.gitignore`, and `index.php`.

Then sweep out the source project's identity — slug, namespaces, URLs.
[`references/scaffold-and-rename.md`](references/scaffold-and-rename.md) has the inventory
(composer/package names, theme and plugin slugs, text domains, PHP namespaces and function
prefixes, release-please config, README badges, workflow URLs) and the grep-driven
verification.

One house-fit detail worth fixing while you are here: the scaffold ships `phpcs.xml`, while
[`quality-gates`](../quality-gates/SKILL.md) and [`project-context`](../project-context/SKILL.md)
detect `phpcs.xml.dist`. Rename it, or the project's PHPCS gate reads as absent.

Result: no generator files remain, and
`grep -ri "<old-slug>" . --exclude-dir={.git,vendor,node_modules}` returns nothing you
didn't deliberately keep.

### 8. Create the environments — names must match exactly

v3 environments are named **`<stage>-<project-slug>`**, not bare `production`/`staging` —
`production-malcosaw`, `staging-insurance`. The suffix is what lets one repo deploy several
sites (`cando` runs `production-insurance` and `production-financial` off one build).
Confirm the slug with the user, then:

```bash
gh api -X PUT repos/linchpin/<name>/environments/production-<slug>
gh api -X PUT repos/linchpin/<name>/environments/staging-<slug>
gh api repos/linchpin/<name>/environments --jq '.environments[].name'
```

The name must match the string the caller passes as `environment:` (matching is
case-insensitive, so `Production` and `production` are the same environment — but
`production` and `production-<slug>` are not). **A name that matches nothing is silently
created empty at deploy time**, and the deploy then runs with no variables at all. That is
the failure in the opening paragraph.

Result: the environment list matches the `environment:` values in `.github/workflows/`.

### 9. Set variables — repository scope for what is true everywhere

**`gh variable set` overwrites silently.** There is no "already exists" error and no
confirmation prompt — it creates or replaces, and prints the same success line either way.
So read the current state before writing anything.

```bash
ENV=production-<slug>

# What the org already provides (do not duplicate these)
gh api repos/linchpin/<name>/actions/organization-variables --jq '.variables[].name'

# What this repo and this environment already hold, with values
gh variable list --repo linchpin/<name>            --json name,value,updatedAt \
  --jq '.[] | "repo  \(.name) = \(.value)   (updated \(.updatedAt[0:10]))"'
gh variable list --repo linchpin/<name> --env "$ENV" --json name,value,updatedAt \
  --jq '.[] | "env   \(.name) = \(.value)   (updated \(.updatedAt[0:10]))"'
```

Then handle each key by what that inventory showed:

| State | Do |
| --- | --- |
| **Absent** | Set it. No confirmation needed — this is the normal path on a new repo |
| **Present, same value** | Skip it. Don't rewrite a variable to the value it already has; it only moves the timestamp and hides the real change |
| **Present, different value** | **Stop. Tell the user**, showing `NAME: <current> → <proposed>` and when it was last updated, and wait for an explicit yes before writing |

Guard each write, so an existing value can't be clobbered by a stray re-run:

```bash
if current=$(gh variable get SITE_ID --repo linchpin/<name> --env "$ENV" 2>/dev/null); then
  echo "EXISTS  SITE_ID = $current   — compare with the intended value, ask before changing"
else
  gh variable set SITE_ID --repo linchpin/<name> --env "$ENV" --body "<pressable-site-id>"
fi
```

The rest, once each has cleared that check. Repository scope for values identical across
environments, environment scope for anything that differs per install:

```bash
gh variable set HOST        --repo linchpin/<name> --body "pressable"
gh variable set THEMES      --repo linchpin/<name> --body '["<theme-slug>"]'
gh variable set ENVIRONMENT --repo linchpin/<name> --env "$ENV" --body "$ENV"
gh variable set SITE_URL    --repo linchpin/<name> --env "$ENV" --body "https://<domain>"
gh variable set BRANCH      --repo linchpin/<name> --env "$ENV" --body "main"
```

This matters most on a repo you **adopted** rather than created (step 2): its environment
variables already point at a live site, and overwriting `SITE_ID` or `SITE_URL` there
redirects a working pipeline.

**`ENVIRONMENT` is v3-only and easy to miss** — it must equal the environment's own name.
v3 uses it for every GitHub deployment API call, so leaving it unset records the deploy
against an empty environment: the Deployments tab shows nothing, and the previous
deployment is never superseded. v4 dropped it, so v4 examples won't show it.

The full matrix — which variable belongs at which scope, per host, and what each one does —
is [`references/secrets-and-variables.md`](references/secrets-and-variables.md).

#### `SITE_ID` and `SITE_URL` — confirm these with the user, every time

**Do not set either from memory, from another project, or from a value that "looks right".**
Read them back to the user, per environment, and get an explicit yes before moving on.

They are not two names for the same thing, and neither one is the deploy target. Three
different values steer three different parts of the deploy, and a mismatch between them
fails in ways that look like success:

| Value | What it actually controls | If it's wrong |
| --- | --- | --- |
| `SSH_HOST` / `SSH_USER` / `SSH_KEY` | Where the files are written | **Code lands on someone else's site.** The worst case, and nothing in the run will say so |
| `SITE_ID` | The Pressable API calls — the on-demand backup — and the site id reported to Mantle | The intended site deploys **with no backup**, while an unrelated site is backed up and reported as deployed |
| `SITE_URL` | The GitHub deployment's `environment_url` (the clickable link) and the Mantle payload | The deployment links to a site this run never touched, so the link "looks right" no matter where the code went |

**v3 has no post-deploy health check.** Success means rsync exited 0 — nothing verifies the
site afterwards, and nothing cross-checks these three against each other. So a green run,
a working deployment link, and a release sitting on the wrong install are all compatible.
Only your confirmation catches it.

Before setting them:

1. **Get the pair from the host, together** — the Pressable dashboard (or the Pressable
   MCP, see [`wp-pressable`](../wp-pressable/SKILL.md)) shows the site id alongside its
   domain. Take both from the same row.
2. **Check production against staging.** Identical `SITE_ID`s across two environments is
   almost always a copy-paste, and it means a staging push deploys to production.
3. **Echo them back:** *"production-<slug> → site id 1234567, https://<domain>.
   staging-<slug> → site id 7654321, https://staging.<domain>. Correct?"*
4. If the user cannot confirm, **leave them unset and report it.** A missing variable fails
   the deploy immediately and harmlessly; a wrong one overwrites a live site.

Result: `gh variable list --repo … --env production-<slug>` shows a complete set for the
host, and `SITE_ID`/`SITE_URL` were confirmed aloud for each environment.

### 10. Set secrets — org first, repo second, environment for what differs

```bash
gh api repos/linchpin/<name>/actions/organization-secrets --jq '.secrets[].name'
```

Whatever that lists is **already available to this repo** — `PACKAGIST_COMPOSER_AUTH_JSON`,
the Pressable API pair, `MANTLE_API_BEARER` and friends normally are. Do not copy an org
secret into the repo; a per-repo copy goes stale the next time the org value rotates. If an
expected org secret is *absent* from that list, the repo is outside its visibility list —
ask an org admin to add it.

What remains is per-site SSH access. **Check what is already there first** — `gh secret set`
replaces an existing secret silently, exactly like variables do:

```bash
gh secret list --repo linchpin/<name>             --json name,updatedAt \
  --jq '.[] | "repo  \(.name)   (updated \(.updatedAt[0:10]))"'
gh secret list --repo linchpin/<name> --env "$ENV" --json name,updatedAt \
  --jq '.[] | "env   \(.name)   (updated \(.updatedAt[0:10]))"'
```

Secrets differ from variables in one way that makes this stricter: **the stored value cannot
be read back.** "Is it already correct?" is unanswerable, so there is no same-value skip —
any existing secret you were about to write is a decision for the user, not for you.

| State | Do |
| --- | --- |
| **Absent** | Set it |
| **Present** | **Stop. Tell the user** the name, the scope, and when it was last updated, and say you cannot verify its value. Overwrite only on an explicit yes |

```bash
if gh secret list --repo linchpin/<name> --env "$ENV" --json name --jq '.[].name' \
     | grep -qx SSH_USER; then
  echo "EXISTS  SSH_USER (env $ENV) — value not readable; ask before overwriting"
else
  gh secret set SSH_USER --repo linchpin/<name> --env "$ENV"     # prompts on stdin
fi
```

Never type a secret value into the transcript or a command line — pipe it from a file or the
team password manager:

```bash
gh secret set SSH_KEY --repo linchpin/<name> < /path/to/deploy-key    # then shred the file
```

An existing `SSH_KEY` deserves particular care: the same deploy key is often shared across
environments, and sometimes across repos, so replacing it can break deploys well outside the
repo you're working in.

Result: `gh secret list --repo …` and `… --env "$ENV"` cover the host's required set, and
nothing that already existed was replaced without the user saying so.

### 11. Open the PR, then verify

Commit on the branch and open the PR against `main`, with the task key in the scope
([`commit-and-release`](../commit-and-release/SKILL.md) owns the message grammar,
[`task-tracking`](../task-tracking/SKILL.md) the key and the task update):

```bash
git add -A && git commit -m "feat(<TASK-KEY>): scaffold <name> from <source>"
git push -u origin issue/<TASK-KEY>
gh pr create --fill --base main
```

Then check the wiring:

```bash
gh workflow list --repo linchpin/<name>
gh variable list --repo linchpin/<name>; gh variable list --repo linchpin/<name> --env "$ENV"
gh secret   list --repo linchpin/<name>; gh secret   list --repo linchpin/<name> --env "$ENV"
```

Cross-check each `vars.*` and `secrets.*` the v3 workflow reads for the chosen host against
those lists. The real proof is a staging deploy — so after the PR merges, create the
`staging` branch (`git switch main && git pull && git switch -c staging && git push -u
origin staging`) and watch that run. **Do not cut a release just to test the wiring**;
production is the release-triggered path and deploys to a live site.

## Gotchas

- **A green deploy is not proof it went to the right site.** `SSH_*` decides where files
  land, `SITE_ID` drives the Pressable API, `SITE_URL` drives the health check — they are
  independent, and only agreement between them makes the run's success meaningful.
- **`gh variable set` and `gh secret set` are upserts.** Neither warns that something was
  already there, and both print the same success line whether they created or replaced —
  so "it worked" is not evidence you didn't overwrite a live value.
- **A secret's value can never be read back**, so a wrong overwrite is unrecoverable from
  GitHub's side: the old value is gone and must be re-fetched from wherever it came from.
- **`secrets: inherit` hides nothing.** It passes org + repo + environment secrets, so a
  missing one surfaces as an empty string deep in the deploy, not as a clear error.
- **Environment secrets only resolve in a job that declares that environment.** The shared
  `deploy.yml` does; a caller-side step does not. Put per-install values at environment
  scope, not repository scope, or staging will deploy with production's.
- **Templating from another *client's* repo copies their variables' shape, not their
  values** — GitHub never copies secrets, variables, or environments. Every value in
  steps 6–8 is manual, every time.
- **`deploy-scaffold` is a generator, not a starter project.** `--template` copies the
  generator too, and its emitted deploy workflows are pre-v3 and broken. Take the tooling
  baseline from it; write the deploy workflows from this skill's reference.
- **It has no Pressable workflow**, in its root or in its templates — and Pressable is the
  house host. Nothing you copy from it will deploy a Pressable site.
- **`@main` on `linchpin/actions` is not a version — it is v4.** Old repos pinned to
  `deploy-wpengine.yml@main` are already broken: that file no longer exists there. `v3` is a
  branch that is still maintained; pin it by name.
- **Most v4 documentation does not apply to a v3 repo.** The `linchpin/actions` README
  describes v4. `docs/MIGRATION-v3-to-v4.md` is the map between them, and the honest source
  for what v3 actually does.
- **Repo settings ignore your branch.** Environments, variables, and secrets take effect
  immediately and appear in no diff — the PR reviewer cannot see them, so list them in the
  PR body.
- **The template's first commit is already on `main`.** Cutting the branch after creation
  (not before) is what keeps the scaffold and your changes to it separable.
- **Version and CHANGELOG in a fresh repo belong to release-please** — don't hand-set them
  ([`commit-and-release`](../commit-and-release/SKILL.md)).

## Guardrails

- **Never assume a source repo.** Ask which repo to populate from, every time; the old
  scaffold default is stale and picking it unasked costs more than it saves.
- **Never create the repo before checking the name and confirming owner, name, and
  visibility with the user.** Deleting a repo to rename it destroys any issue, PR, or CI
  history already attached.
- **Never delete, rename, or archive an existing repo** whose name you want — report what
  is there and let the user decide. Never sidestep a name collision by inventing a variant
  (`-2`, `-new`, `-2026`).
- **Never clone the new repo into the directory you happen to be in.** It nests a client
  project inside an unrelated checkout, and the first `git add -A` there commits it to the
  wrong repo. Confirm a location outside every working tree.
- **Never commit the rename or workflow changes straight to `main`.** They belong on
  `issue/<task-key>` and reach `main` by PR.
- **Never migrate a repo between v3 and v4 as a side effect of setting it up.** If a repo
  is already on v4, leave it there and say so; moving lines changes inputs, environment
  variables, and deploy behavior, and is its own task.
- **Never make a client repo public** unless the user says so explicitly, in those words.
- **Never invent or copy a `SITE_ID`, `SITE_URL`, `INSTALL_NAME`, or SSH value.** Take them
  from the host, for that environment, and confirm them with the user before setting them.
  A wrong one writes a release onto a real, live, wrong site — and the run still goes green.
  **Missing is safe; guessed is not.**
- **Never reuse production's `SITE_ID` or `SITE_URL` for staging.** Identical values across
  environments mean every staging push deploys to production.
- **Never paste a secret value into the transcript, a shell argument, or a committed
  file.** Pipe from stdin or a file, then remove the file. Values come from the team
  password manager, not from another repo's config.
- **Never overwrite an existing variable or secret without showing the user what is there
  and getting an explicit yes.** For variables, show `current → proposed`; for secrets, say
  plainly that the value cannot be read and name the scope and last-updated date. Setting a
  value that is already correct is not harmless either — it hides the real change.
- **Never duplicate an org-level secret at repo scope** to work around a visibility gap —
  it silently survives the next rotation and breaks deploys weeks later.
- **Never point a new repo's production environment at an existing site** you have not
  confirmed with the user — the first deploy overwrites `wp-content` on that install.
- **Never delete or rename an environment on a repo that already deploys** — in-flight
  deployments and the deployment history reference it.
- Route the work through a task and commit per house convention
  ([`task-tracking`](../task-tracking/SKILL.md), [`commit-and-release`](../commit-and-release/SKILL.md)).

## Done

- [ ] A task key was resolved (or `NO-TASK` agreed) before anything was created.
- [ ] The name was checked for collision, and any existing repo was reported to the user.
- [ ] Repo exists under the confirmed owner/name/visibility, and is cloned to its own
      directory outside any other checkout.
- [ ] Work happened on `issue/<task-key>` (or `no-task/<slug>`); `main` holds only the
      initial source commit until the PR merges.
- [ ] The user was **asked** which repo to populate from — no source was assumed — and
      confirmed the choice before creation.
- [ ] Every deploy workflow calls `linchpin/actions/.github/workflows/deploy.yml@v3`,
      with v3 inputs only — or the repo was already on v4 and that was raised, not changed.
- [ ] No references to the source project's slug, namespace, or URLs remain.
- [ ] Environments exist as `<stage>-<slug>`, matching the callers' `environment:` values.
- [ ] Existing variables and secrets were listed **before** any write, at both repo and
      environment scope.
- [ ] Nothing pre-existing was overwritten without the user seeing it and confirming.
- [ ] Repository variables set; environment variables set per environment, **including
      v3's `ENVIRONMENT`** set to the environment's own name.
- [ ] `SITE_ID` and `SITE_URL` read back to the user and confirmed **per environment**, from
      the host's own record — and production's differ from staging's.
- [ ] Org-provided secrets confirmed visible to the repo; per-site `SSH_*` set at the
      right scope; nothing duplicated from org scope.
- [ ] Anything still unknown is reported explicitly as a blocker, not guessed.
- [ ] PR opened against `main`, with the settings changed outside the diff listed in its body.
- [ ] A staging deploy has run green, or the reason it cannot yet is stated.
