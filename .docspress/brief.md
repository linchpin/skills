---
title: Documentation brief
---

Read by `$generate-docs-from-source` before it inventories anything. This file sets scope and
shape; the repository still sets facts. Publishing configuration is **not** in scope here —
that belongs to the `docspress-publish` skill.

## Shape

Catalog. The documented surface is the set of Linchpin skills under `skills/*/SKILL.md`, not
the installer that copies them and not the release tooling.

The vendored base-layer skills (`upstream.json`) are **referenced, never documented**: one
page lists them and links to their source, and a Linchpin skill page names an upstream skill
where it defers to one. No upstream skill gets a page of its own.

## Audience

Linchpin engineers choosing which skill to invoke, and clients who want to see how we work.
Assume the reader knows what Claude Code is. Define an agent skill in one paragraph on the
docs root; `docs/how-skills-work.md` owns the longer explanation, and no other page repeats
either.

## Collection

- Source glob: `skills/*/SKILL.md`
- One page per match at `docs/skills/<directory-name>.md`
- Page title: frontmatter `name`

Each page has these sections, in this order. Omit a section only when its source is absent,
and never pad one from outside the skill's own directory.

1. **Opening paragraph** — the skill's own one-to-three-line purpose line, below its `# Title`.
2. **`## When to reach for it`** — triggers from `## When to use`, plus the extra phrasings in
   frontmatter `when_to_use` rendered as things a reader might actually say.
3. **`## Where it stops`** — quote the bold **Not this skill:** line verbatim, or the
   "Not for … — use `x`" clause in `description` when there is no bold line. It is how a
   reader picks between siblings such as `investigate` and `web-qa`.
4. **`## How it works`** — the skill's procedure, summarized. Source: its `## Preflight`,
   `## Procedure` or `## Workflow` section when present, otherwise its non-required `##`
   sections in document order. One `docspress/flow` step per stage: the stage's name and a
   one-or-two-sentence summary of what the agent does there and what it decides. Summarize
   the stages; never transcribe their commands.
5. **`## What it checks first`** — the files, config and state the skill reads before acting
   (the "detect, don't assume" rule made concrete), and the skill it calls for orientation,
   usually `project-context`.
6. **`## What it owns`** — from `## Owns`.
7. **`## Guardrails`** — the rules from `## Guardrails`, each shortened to one line. A rule
   that stops a destructive or irreversible action goes in a `docspress/callout` with
   `tone: warning`.
8. **`## Done when`** — the self-check from `## Done`, as a checklist.
9. **`## Files`** — link to the `SKILL.md` on GitHub, then every file under the skill's
   `references/` and `scripts/` with a one-line purpose taken from that file's own opening,
   then the `allowed-tools` pre-approvals if any, stated as what the agent may run without a
   prompt.
10. **`## Related skills`** — every other skill the `SKILL.md` names, linked: Linchpin skills
    to their page, upstream skills to `upstream.md`. Say in a few words why each is related,
    using the skill's own wording.

GitHub links use `https://github.com/linchpin/skills/blob/main/skills/<name>/<path>`.

Do not paste a whole `SKILL.md` into a page. The SKILL.md is instructions for an agent; the
page is for a person deciding whether to use it and wanting to know what it will do.

## Required pages

- `docs/index.md` — what the library is, a one-paragraph definition of an agent skill, how to
  install it (`npx @linchpinagency/skills --global`), and how to propose a new one. Include
  the "you want to… / ask for it naturally / skill that fires" routing table from `README.md`.
- `docs/how-skills-work.md` — what happens between a request and a skill running: the
  description as the only thing read up front, `when_to_use` as a Claude Code-only addition,
  the body loading on a match, `references/` loading on demand, `allowed-tools` as a
  pre-approval rather than a restriction, and skills being loaded by the harness rather than
  the model. Then the three tiers (base layer, Linchpin, project) and how to read a skill
  page on this site. Sources: `README.md`, `CLAUDE.md`, `skills/write-a-linchpin-skill/`.
- `docs/installation.md` — installing, updating, scope, agents, and the flags someone
  getting started actually uses (`--global`, `--list`, `--dry-run`, `--agent`, `--check`,
  `--skip-upstream`). Not a complete flag reference.
- `docs/skills/index.md` — a table of **every** skill: linked name, one-line purpose, when to
  reach for it, and the sibling it defers to. Alphabetical by directory name. No omissions,
  no "and others".
- `docs/skills/<name>.md` — one per skill, per the Collection rules above.
- `docs/upstream.md` — the base layer: each source in `upstream.json` with its repo, licence
  and pinned ref, and every skill it vendors with a link to that skill's `SKILL.md` at the
  pinned ref. One line per skill, taken from its upstream `description`, and the Linchpin
  skills that defer to it. Nothing more.
- `docs/contributing.md` — the house standard for writing a skill, derived from
  `skills/write-a-linchpin-skill/SKILL.md` and `scripts/validate-skills.mjs`: required
  frontmatter, the section skeleton, the four house rules, the scaffolder, and the validator
  command, including what errors and what only warns.

## Non-goals

- No page for installer internals, `bin/install.mjs`, CI, release-please, or npm publishing.
- No complete CLI flag reference and no standalone validation-rules reference; the useful
  parts live in `installation.md` and `contributing.md`.
- No API reference. There is no public API.
- No per-skill changelog. `CHANGELOG.md` covers the package.
- No page for an upstream skill.
- No page transcribing a skill's full procedure or its commands. Summarize and link.

## Block plan

- `docspress/terminal-session` for the install command on the docs root.
- `docspress/audience-paths` on the docs root for the two or three main entry points.
- `docspress/flow` for every skill page's `## How it works`, and for the request-to-skill
  sequence on `how-skills-work.md`.
- `docspress/callout` with `tone: warning` for a skill's destructive edges, drawn only from
  its own `## Guardrails`.
- `docspress/fields` on the contributing page for frontmatter.
- Ordinary Markdown tables everywhere else. The skills index is a table, not a block.

## Voice

Direct, second person, present tense. Say what the skill does and where it stops. No
marketing adjectives, no "powerful" or "seamless", no exclamation marks. Match the voice
already in the SKILL.md files.

## Acceptance checks

1. Pages under `docs/skills/` other than `index.md` equals the count of `skills/*/SKILL.md`.
   Count it; do not trust any number written down.
2. Rows in the `docs/skills/index.md` table equals that same count.
3. Every row links to a page that exists, and every page is linked from exactly one row.
4. The set of documented skill names equals the set listed in the README "Available skills"
   Linchpin table, which `npm run validate` already enforces against `skills/`.
5. Every skill page names at least one trigger from its own `## When to use` and at least one
   rule from its own `## Guardrails`.
6. Every skill page whose SKILL.md carries a **Not this skill:** line reproduces that
   boundary.
7. Every skill page has a `## How it works` section containing one `docspress/flow` block
   with at least two steps.
8. Every skill page's `## Files` section lists exactly the files in that skill's
   `references/` and `scripts/` directories.
9. `docs/upstream.md` lists exactly the skills in `upstream.json`, and no upstream skill has
   a page under `docs/skills/`.
10. No page documents a skill that does not exist in `skills/` or `upstream.json`.
11. Every `wp:docspress/*` block parses as JSON and uses only catalog attributes and values.
12. `npm run validate` still passes; generating docs must not edit any `SKILL.md`.
