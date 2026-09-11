# `sync-docs.yml` template

Copy to `.github/workflows/sync-docs.yml` and replace `<repo-slug>` with the repository
name — the same string as the directory under `docs/`.

Ships inert on purpose: manual trigger, dry run, drafts, trash. Promote it one rung at a
time (the ladder is in `SKILL.md`).

```yaml
name: Sync docs to WordPress

# Publishes docs/ to the Linchpin documentation site via DocsPress.
#
# SAFETY POSTURE — this workflow is intentionally inert on first commit:
#   * manual trigger only (no push trigger)
#   * dry-run: true      — plans every operation, writes nothing
#   * status: draft      — created pages are drafts, not public
#   * delete-mode: trash — removals go to Trash, never hard-deleted
#
# Promote in this order, confirming the Actions summary at each step:
#   1. Run manually as-is. Review the planned create/update/delete counts.
#   2. Set dry-run: false. Pages are created as drafts. Review the page tree.
#   3. Set status: publish once the content and hierarchy look right.
#   4. Only then add the push trigger commented out at the bottom.
#
# actions/checkout is pinned to an immutable commit SHA: it is third party, and
# this job is exposed to a WordPress token. linchpin/docspress is not pinned —
# it is our own fork, in our own organisation, behind branch protection, so a
# SHA pin defends against nothing here while guaranteeing we miss its fixes.
# See its README for the v1 contract.

on:
  workflow_dispatch:
    inputs:
      dry-run:
        description: "Plan only, write nothing"
        type: boolean
        default: true
      status:
        description: "Status for created or updated pages"
        type: choice
        options:
          - draft
          - publish
        default: draft

permissions:
  contents: read

concurrency:
  group: docspress-sync
  cancel-in-progress: false

jobs:
  sync:
    name: Sync
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      # actions/checkout v7
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1

      # v1 moves forward as fixes land; a breaking change becomes v2.
      - uses: linchpin/docspress@v1
        with:
          mode: publish

          # Self-hosted target. Do not append /wp-json — DocsPress does that.
          # docs.linchpin.com is a subsite of the Linchpin multisite.
          wordpress-url: https://docs.linchpin.com
          wordpress-site: docs.linchpin.com
          wordpress-access-token: ${{ secrets.WP_ACCESS_TOKEN }}

          docs-dir: docs

          # These docs live under /<repo-slug>/ so the site can host other
          # projects' documentation alongside them. managed-path scopes
          # deletion to this branch, so a sync from this repository never
          # treats a sibling project's pages as removed documentation.
          root-slug: wordpress-plugins
          root-title: WordPress Plugins
          managed-path: wordpress-plugins/<repo-slug>

          # The DocsPress theme renders the page title itself, so do not let
          # the action inject a duplicate H1 block.
          create-h1: false

          # Rewrite relative Markdown links to the generated page URLs.
          rewrite-links: true

          status: ${{ inputs.status || 'draft' }}
          delete-mode: trash
          dry-run: ${{ inputs.dry-run == false && 'false' || 'true' }}
```

## Rung 4 — the push trigger

Add only after the manual lifecycle has succeeded and ongoing publication is approved.
Detect the default branch rather than assuming `main`.

```yaml
on:
  push:
    branches: [main]
    paths:
      - "docs/**/*.md"
      - "docs/**/*.markdown"
      - ".github/workflows/sync-docs.yml"
  workflow_dispatch:
```

## Optional — reverse sync

`mode: reconcile` turns WordPress edits into pull requests against the repo. This
authorises ongoing writes to **both** systems; get explicit sign-off first.

It needs wider permissions:

```yaml
permissions:
  contents: write
  pull-requests: write
```

…and it **requires a loop guard**. The action maintains its own
`docspress/wordpress-sync` branch; merging that branch produces a push whose commits
already contain the WordPress changes, so syncing it back loops indefinitely.

```yaml
if: >-
  github.event_name != 'push' ||
  !contains(
    github.event.head_commit.message,
    format('from {0}/docspress/wordpress-sync', github.repository_owner)
  )
```

Upstream also runs a `schedule:` (cron `3/5 * * * *`) to pick up WordPress edits, since
only a repo push would otherwise trigger a run. Weigh that against five-minute Actions
usage before copying it.

Reference: `Automattic/docspress` `.github/workflows/sync-docs.yml` at tag
`wordpress-0.10.1` is their own dogfood config and is fully promoted (reconcile,
`status: publish`, `dry-run: false`). **Do not copy it wholesale.**

## Verifying the pins

Resolve a tag to the SHA you are about to pin, for `actions/checkout`:

```bash
gh api repos/actions/checkout/git/ref/tags/v7 --jq '.object.sha'
```

`linchpin/docspress` is deliberately **not** SHA-pinned — see the header comment in the
template. Confirm `@v1` still carries the inputs the workflow passes:

```bash
gh api repos/linchpin/docspress/contents/action.yml -H 'Accept: application/vnd.github.raw' \
  --method GET -f ref=v1 | grep -E '^  [a-z0-9-]+:'
```

Validate every `with:` key against that list before the first run — an unknown input is
silently ignored, which for `managed-path` means unscoped deletion.
