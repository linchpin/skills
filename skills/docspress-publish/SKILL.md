---
name: docspress-publish
description: Publish a repo's Markdown docs to docs.linchpin.com with DocsPress — the shared page tree, the pinned linchpin/docspress fork that scopes deletion per repo, the WP_ACCESS_TOKEN secret, and the dry-run to draft to publish promotion ladder. Use when a project needs documentation published, when asked to "set up docspress" or "get these docs on the docs site", when a sync-docs workflow fails or deletes another repo's pages, or when docs exist in the repo but nowhere else. Not for writing the docs themselves — that's `generate-docs-from-source`, vendored from the same fork.
version: 1.2.0
allowed-tools: Read Grep Glob Bash(git remote get-url*) Bash(gh secret list*)
---

# Publish docs with DocsPress

DocsPress does not write documentation. It is a **sync action**: it reads Markdown out of
`docs/` and creates or updates WordPress Pages from it. Two halves, and only the second one
is ours — content comes from the upstream generator, and this skill owns where it lands.

The part that is genuinely Linchpin-specific is small but unguessable: every project
publishes into **one shared page tree** on `docs.linchpin.com`, which means a
misconfigured sync will treat every *other* project's pages as removed documentation and
trash them.

## When to use

- A project has no published documentation, or docs that live only in the repo.
- Someone asks to "set up docspress", "publish the docs", "get these on the docs site".
- A `sync-docs` run fails, publishes to the wrong place, or trashes pages it does not own.
- You are adding a second (third, tenth) repo to the shared docs site.

**Not this skill:**

- **Writing the docs** → upstream `generate-docs-from-source` (see [Preflight](#preflight)).
- **Committing and opening the PR** → [`commit-and-release`](../commit-and-release/SKILL.md)
  and [`task-tracking`](../task-tracking/SKILL.md).
- **Operating the docs site itself** (its theme, its database) →
  [`wp-pressable`](../wp-pressable/SKILL.md). `docs.linchpin.com` is a subsite of the
  Linchpin multisite; this skill never touches it directly, only pushes to it.

## Owns

Canonical for: the `docs.linchpin.com` target configuration, the pinned fork and why it is
not upstream, `managed-path` ownership scoping, how `WP_ACCESS_TOKEN` is scoped, the per-repo
`.docspress/brief.md` contract, and the promotion ladder.

Defers: documentation content and block selection → `generate-docs-from-source`, vendored
from the same fork; commits and PRs → `commit-and-release`; branch and task →
`task-tracking`.

## Preflight

Read before acting. Never assume a repo's shape.

| Look for | Tells you | If missing |
| --- | --- | --- |
| `git remote get-url origin` | The repo slug — this becomes the page-tree segment | Ask; do not guess from the directory name |
| `docs/` contents | Whether content exists, and whether anything there should *not* be published | Nothing to sync yet — generate first |
| `.github/workflows/sync-docs.yml` | Already wired; you are debugging, not installing | Install it from `references/sync-docs-workflow.md` |
| `gh secret list --repo <owner>/<repo>` | Only whether a **repo-level** override exists | Nothing — `WP_ACCESS_TOKEN` is an org secret and will not appear here. See step 5 |
| `.docspress/brief.md` | What this repo's docs must contain and the checks they must pass | Write one before generating — step 3 |
| `generate-docs-from-source` in the skill list | The generator is installed (it ships vendored) | Fetch it (step 1) before writing any page |

## Step 1 — Confirm the generator is present

Content generation is deliberately not duplicated here. `generate-docs-from-source` ships
**vendored with this library** from
[`linchpin/docspress`](https://github.com/linchpin/docspress), our fork of
`Automattic/docspress`, pinned to a reviewed SHA — so it is normally already installed
alongside this skill.

The fork is load-bearing, not a convenience copy: it is the version that reads the per-repo
`.docspress/brief.md` in step 3. Upstream's generator ignores that file, so the two are not
interchangeable.

If it is missing — an older install, or `--skip-upstream` — fetch it directly:

```bash
npx skills add linchpin/docspress --all --full-depth
```

That also brings `docspress-install`, the generic non-Linchpin setup path. It is
intentionally **not** vendored: it targets an arbitrary WordPress site and knows nothing
about the shared page tree or `managed-path`. Reach for it only when publishing to a
client's own site instead of `docs.linchpin.com`. See
[`references/vendoring.md`](references/vendoring.md).

→ **Checkable:** `generate-docs-from-source` appears in the agent's skill list.

## Step 2 — Shape the tree

Every Linchpin project publishes under one root page, so the repo's docs must sit in a
**subdirectory named for the repo**, not at the root of `docs/`.

```text
docs/
  <repo-slug>/
    index.md
    getting-started/
    guides/
    reference/
    troubleshooting.md
```

`docs-dir` stays `docs`, so **anything else under `docs/` is published too**. Internal
planning notes, status logs and open-questions files are a common accident — move them out
of `docs/` (`dev/planning/` is the established home) rather than hoping nobody reads them.

→ **Checkable:** `find docs -maxdepth 1 -type f` returns nothing.

## Step 3 — Generate the content

Hand off to `generate-docs-from-source`. What it cannot know is what *this* repository's
docs are supposed to contain — so write that down first, in `.docspress/brief.md`. The
generator reads it before inventorying anything and treats it as the contract:

- **Shape** — library, application, catalog, or monorepo. Say it explicitly. A catalog repo
  (one unit per skill, per block, per package) has no exports or CLI flags to enumerate, so
  without this it produces one thin overview page instead of a page per unit.
- **Required pages** and **non-goals**, so the tree neither misses a section nor grows one
  nobody asked for.
- **Acceptance checks** — countable assertions, reported back as met or unmet. "Every unit
  has a page and an index row" is a check; "cover everything" is a wish.

Two constraints belong in **every** Linchpin brief:

- **No H1 in the body.** The theme renders the page title, so pages carry a frontmatter
  `title:` and start at `##`. The workflow sets `create-h1: false` to match.
- **Pages live under `docs/<repo-slug>/`** (step 2), so relative links resolve inside the
  subtree this repo owns.

Keep the brief **outside** `docs/`. The collector globs `**/*.md` below `docs-dir` with
`dot: false`, so a brief at `docs/BRIEF.md` would publish itself as a page; a dot-directory
is skipped.

Seeding beats describing. The generator preserves existing pages and updates them in place,
so committing an index stub with the exact headings you want steers it harder than any
sentence in the brief.

→ **Checkable:** `.docspress/brief.md` exists, every page has frontmatter `title:` and no
`# ` heading, and the generator reported each acceptance check as met.

## Step 4 — Add the workflow

Copy the template from
[`references/sync-docs-workflow.md`](references/sync-docs-workflow.md) to
`.github/workflows/sync-docs.yml` and substitute the repo slug. The inputs that matter:

| Input | Value | Why |
| --- | --- | --- |
| `wordpress-url` | `https://docs.linchpin.com` | Self-hosted target. **Do not append `/wp-json`** — the action does that |
| `wordpress-site` | `docs.linchpin.com` | The site identifier, not a WordPress.com ID |
| `docs-dir` | `docs` | The whole directory, hence step 2 |
| `root-slug` | `wordpress-plugins` | The shared root page these repos publish under |
| `managed-path` | `wordpress-plugins/<repo-slug>` | **The one that prevents data loss** — see below |
| `create-h1` | `false` | The theme already renders the title |
| `rewrite-links` | `true` | Relative Markdown links become page URLs |
| `delete-mode` | `trash` | Removals are recoverable |

`root-slug` groups WordPress **plugin** projects. A different class of project needs a
different root — agree one rather than filing it under plugins, and use it consistently in
both `root-slug` and `managed-path`.

→ **Checkable:** every `with:` key exists in the pinned revision's `action.yml`.

### Why `managed-path` is not optional

`root-slug` alone serves as both the URL prefix **and** the ownership boundary that scopes
deletion. With several repos publishing below one shared parent page, each one treats the
others' pages as removed documentation and trashes them on its first non-dry-run.

`managed-path` narrows ownership to one branch below the root, so a sync only cleans up its
own removed docs. It is **not in upstream `Automattic/docspress`** — which is the entire
reason the workflow pins the `linchpin/docspress` fork. Verify the pin before trusting it:

```bash
gh api repos/linchpin/docspress/commits/<sha> --jq '.files[].filename'
```

`dist/index.js` in that list means the input is compiled into the bundle the action
actually runs, not just declared in `action.yml`.

→ **Checkable:** `managed-path` names this repo's segment and nothing broader.

## Step 5 — The token

`WP_ACCESS_TOKEN` is an **organisation secret**, available to every repo in `linchpin`.
There is normally nothing to provision, and nothing to check.

**Do not report it as a blocker on a `gh secret list` miss.** That command lists only
*repository* secrets, so an org secret never appears in it. Reading absence there as "the
token is missing" produces a confident false blocker on every repo:

```bash
# Lists repo-level secrets ONLY — an empty result proves nothing about the org secret.
gh secret list --repo <owner>/<repo>
```

Enumerating org secrets needs the `admin:org` scope, which an agent normally will not have,
so treat "cannot verify" as the expected state rather than a problem.

The real signal is the first dry run: a token that is missing or unauthorised fails there
with a 401 or 403 from WordPress, and that is a workflow-run result, not something to
predict beforehand.

→ **Checkable:** nothing to do unless a run has actually failed on auth.

## Step 6 — Verify locally, before any run

Cheapest checks first. Runnable snippets are in
[`references/verification.md`](references/verification.md).

1. **Block JSON parses** — every `wp:docspress/*` comment is valid compact JSON with
   allowed enum values. → all blocks parse
2. **Links and anchors resolve** — every relative link and `#fragment` resolves from the
   file containing it. → zero unresolved
3. **Converter round-trip** — run the pinned action's own `markdownToBlocks` over the tree.
   → zero conversion failures, and every block semantically identical

Byte-for-byte comparison on step 3 produces false alarms. DocsPress deliberately normalizes
HTML-sensitive attribute characters to WordPress-safe Unicode escapes — `<` becomes
`\u003c` and `>` becomes `\u003e` — so most blocks come back altered and none of it is a defect. **Parse
both sides and compare the attribute objects**, not the raw strings.

## Step 7 — Promote, one rung at a time

The workflow ships inert. Confirm the Actions summary at each rung before the next.

| Rung | Change | Confirms |
| --- | --- | --- |
| 1 | Run as-is (`dry-run: true`, `status: draft`) | The planned create/update/**delete** counts. A non-zero delete count on a first run means `managed-path` is wrong — stop |
| 2 | `dry-run: false` | Pages exist as drafts; the page tree is right |
| 3 | `status: publish` | Content and hierarchy are public |
| 4 | Add the `push` trigger | Ongoing sync, only once someone has approved it |

Reverse sync (`mode: reconcile`, WordPress edits becoming pull requests) is a separate
decision that authorises writes to **both** systems and needs a loop guard. Get explicit
sign-off; the template documents it but leaves it commented out.

→ **Checkable:** each rung's Actions summary reviewed before the next is enabled.

## Block catalog

At the pinned SHA the generator's table matches the `docspress-blocks` plugin: **17**
blocks, `hero`, `audience-paths`, `version-notice` and `version-switcher` included. A
project's root `index.md` reads as unfinished without the first two, so plan them in.
(`docspress/was-this-helpful` is an eighteenth name you will meet; it is theme-owned and
belongs in the Page template, not in Markdown.)

When a target site runs a different plugin revision, that revision's source is the
authority — `blocks/<name>/block.php`, where each `docspress_blocks_allowed_value()` call
names the valid values for one attribute — rather than the skill table or an existing page.

## Guardrails

- **Never enable a push trigger, `dry-run: false`, or `status: publish` in the same change
  that adds the workflow.** The ladder exists because the first run is the one that can
  trash another project's pages.
- **Never widen `managed-path` to `root-slug`.** That hands this repo ownership of every
  sibling project's pages.
- **Never SHA-pin `linchpin/docspress`.** It is our own fork, in our own organisation,
  behind branch protection, so a SHA pin defends against nothing while guaranteeing the
  workflow misses its fixes. Use `@v1` — it moves forward as fixes land, and a breaking
  change becomes `v2`. `actions/checkout` **is** third party and stays SHA-pinned, because
  this job is exposed to a WordPress token.
- **Never add, mint, or move `WP_ACCESS_TOKEN` yourself** — report its absence and let the
  repo owner provision it.
- **Never enable `mode: reconcile`** without explicit sign-off and the loop guard; merging
  the action's own sync branch produces a push that syncs back forever.
- If a dry run reports deletions you cannot account for, **stop and report** rather than
  proceeding to a write.

## Done

- [ ] `.docspress/brief.md` exists, outside `docs/`, and every acceptance check in it was
      reported as met.
- [ ] Docs live under `docs/<repo-slug>/`; nothing publishable sits at the root of `docs/`.
- [ ] Every page has a frontmatter `title:` and no H1 in the body.
- [ ] `.github/workflows/sync-docs.yml` exists, `actions/checkout` SHA-pinned and
      `linchpin/docspress@v1`, inputs validated against that revision's `action.yml`.
- [ ] `managed-path` is `<root-slug>/<repo-slug>` and matches the directory on disk.
- [ ] Local verification passes: blocks parse, links resolve, converter round-trips clean.
- [ ] Workflow is still `workflow_dispatch`-only with `dry-run: true` and `status: draft`.
- [ ] First dry run reviewed — delete count accounted for.
