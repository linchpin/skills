# Vendoring the upstream DocsPress skills

`docspress-publish` is a wrapper. It owns the Linchpin target and deliberately does not
restate content generation, which lives in
[`linchpin/docspress`](https://github.com/linchpin/docspress) — our fork of
`Automattic/docspress`:

| Upstream skill | What it does | Do we wrap it? |
| --- | --- | --- |
| `generate-docs-from-source` | Derives a docs tree from a repository's own source, with the DocsPress block catalog and a verification pass | Yes — this is the half we call |
| `docspress-install` | The generic setup path: configure the action, pick a WordPress target, authenticate | Superseded by `docspress-publish` for Linchpin targets; still useful for a client's own site |

## Getting them

`generate-docs-from-source` is **vendored by this library**. `npx @linchpinagency/skills`
installs it alongside the Linchpin skills, pinned to a reviewed SHA in
[`upstream.json`](../../../upstream.json) — the same treatment `WordPress/agent-skills`
gets. Nothing extra to run.

```json
{
  "name": "linchpin/docspress",
  "repo": "linchpin/docspress",
  "ref": "0f251db8cd9e4e31a5d51e1cbc7aacaa46d4780e",
  "path": ".agents/skills",
  "license": "GPL-3.0-or-later",
  "skills": ["generate-docs-from-source"]
}
```

`path` exists because upstreams disagree about where skills live:
`WordPress/agent-skills` uses `skills/`, DocsPress keeps two copies. It defaults to
`skills`, so sources that predate it need no change, and a value that escapes the tarball
(`..`, an absolute path) is refused rather than followed.

**Point it at `.agents/skills`, not `.claude/skills`.** DocsPress ships the same two skills
in both directories, and upstream updates `.agents/` while letting `.claude/` fall behind —
`6c3421a` did exactly that, leaving the `.claude/` generator documenting 13 blocks when the
plugin registered 17. Vendoring `.agents/` is self-healing against that.

If the installer is not available — a non-Linchpin machine, or you want the pair without
this library — fetch them directly:

```bash
npx skills add linchpin/docspress --all --full-depth
```

## Why the fork and not upstream

`linchpin/docspress` is not just a pinned copy. The fork's `generate-docs-from-source`
reads a per-repo [`.docspress/brief.md`](../SKILL.md#step-3--generate-the-content) —
audience, shape, required pages, non-goals, and countable acceptance checks — and reports
each check as met or unmet. It also names catalog repositories as a shape, so a repo whose
surface is a set of repeated unit files gets a page per unit and an index listing all of
them instead of one thin overview.

`docspress-publish` depends on that contract, so upstream's generator is **not** a drop-in
substitute. This was a deliberate decision not to send the change to Automattic.

## Why only one of the two is vendored

`docspress-install` is deliberately **left out**. It covers the same ground as
`docspress-publish` — configure the action, choose a target, authenticate — but for an
arbitrary WordPress site, and it does not know about the shared page tree or
`managed-path`. Shipping both would put two skills in front of "set up docspress" with
different answers, and the generic one gives up the guard that stops one repo trashing
another's pages.

Install it deliberately (`npx skills add`) when the target is a **client's own** WordPress
site rather than `docs.linchpin.com`. That is the case `docspress-publish` does not cover.

## Pinning

Whichever route, pin a reviewed SHA rather than tracking a branch. Upstream ships no
releases, so a branch pin means the generator's block catalog and verification rules can
change under a run with no signal.

```bash
gh api repos/linchpin/docspress/commits/main --jq '.sha'
```

The fork tracks upstream, so check it is current before bumping:

```bash
gh api repos/linchpin/docspress/compare/Automattic:main...main --jq '.behind_by'
```

Bumping a pinned `ref` changes agent behaviour silently and deserves its own change and its
own re-test — never as a side effect of unrelated work.

## The block catalog

At the pinned SHA the generator's block table and the `docspress-blocks` plugin agree:
**17** blocks, including `hero`, `audience-paths`, `version-notice`, and
`version-switcher`. (`docspress/was-this-helpful` is an eighteenth name you will meet, but
it is theme-owned and belongs in the Page template, not in Markdown.)

They agreed at the previous pin too — the apparent gap of four was an artifact of vendoring
`.claude/skills`, which upstream had left behind. Vendoring `.agents/skills` closed it.

When a target site runs a different plugin revision, the plugin source for **that** revision
is the authority: `blocks/<name>/block.php`, where each `docspress_blocks_allowed_value()`
call enumerates one attribute's valid values.
