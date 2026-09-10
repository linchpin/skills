---
title: Documentation brief
---

Read by `$generate-docs-from-source` before it inventories anything. This file sets scope and
shape; the repository still sets facts. Publishing configuration is **not** in scope here —
that belongs to the `docspress-publish` skill.

## Shape

Catalog. The documented surface is the set of skills under `skills/*/SKILL.md`, not the
installer that copies them and not the release tooling.

## Audience

Linchpin engineers choosing which skill to invoke, and clients who want to see how we work.
Assume the reader knows what Claude Code is. Explain what an agent skill is exactly once, on
the docs root, and never again.

## Collection

- Source glob: `skills/*/SKILL.md`
- One page per match at `docs/skills/<directory-name>.md`
- Page title: frontmatter `name`
- Opening paragraph: the skill's own one-to-three-line purpose line, below its `# Title`
- Triggers: from `## When to use`
- Boundary: quote the bold **Not this skill:** line verbatim — it is how a reader picks
  between siblings such as `investigate` and `web-qa`
- Ownership: from `## Owns` when present
- Limits: from `## Guardrails`
- Self-check: from `## Done`

Do not paste a whole `SKILL.md` into a page. The SKILL.md is instructions for an agent; the
page is a human deciding whether to reach for it. Link to the source file on GitHub instead.

## Required pages

- `docs/index.md` — what the library is, what an agent skill is, how to install it
  (`npx @linchpinagency/skills --global`), and how to propose a new one. Include the
  "you want to… / ask for it naturally / skill that fires" routing table from `README.md`.
- `docs/skills/index.md` — a table of **every** skill: linked name, one-line purpose, when to
  reach for it, and the sibling it defers to. Alphabetical by directory name. No omissions,
  no "and others".
- `docs/skills/<name>.md` — one per skill, per the Collection rules above.
- `docs/contributing.md` — the house standard for writing a skill, derived from
  `skills/write-a-linchpin-skill/SKILL.md` and `scripts/validate-skills.mjs`: required
  frontmatter, the section skeleton, the four house rules, and the validator command.

## Non-goals

- No page for installer internals, `bin/install.mjs`, CI, release-please, or npm publishing.
- No API reference. There is no public API.
- No per-skill changelog. `CHANGELOG.md` covers the package.
- No page restating a skill's full procedure. Summarize and link.

## Block plan

- `docspress/terminal-session` for the install command on the docs root.
- `docspress/audience-paths` on the docs root for the two or three main entry points.
- `docspress/callout` with `tone: warning` for a skill's destructive edges, drawn only from
  its own `## Guardrails`.
- `docspress/fields` on the contributing page for required frontmatter.
- Ordinary Markdown tables everywhere else. The skills index is a table, not a block.

## Voice

Direct, second person, present tense. Say what the skill does and where it stops. No
marketing adjectives, no "powerful" or "seamless", no exclamation marks. Match the voice
already in the SKILL.md files.

## Acceptance checks

1. Pages under `docs/skills/` equals the count of `skills/*/SKILL.md` (24 at the time of
   writing — count it, do not trust this number).
2. Rows in the `docs/skills/index.md` table equals that same count.
3. Every row links to a page that exists, and every page is linked from exactly one row.
4. The set of documented skill names equals the set listed in the README "Available skills"
   table, which `npm run validate` already enforces against `skills/`.
5. Every skill page names at least one trigger from its own `## When to use` and at least one
   rule from its own `## Guardrails`.
6. Every skill page whose SKILL.md carries a **Not this skill:** line reproduces that
   boundary.
7. No page documents a skill that does not exist in `skills/`.
8. `npm run validate` still passes; generating docs must not edit any `SKILL.md`.
