---
title: Writing a skill
sidebar_position: 3
---

A new skill is accepted when the validator passes and the skill earns its place in an agent's context. The validator enforces the mechanical half; the rest is judgement.

## Anatomy

Every skill is a directory under `skills/` whose name matches its frontmatter `name`. Reference-shaped material — templates, command matrices, schemas — moves into a `references/` subdirectory rather than bloating the body.

<!-- wp:docspress/colorful-code {"language":"markdown","filename":"skills/example-skill/SKILL.md","code":"---\nname: example-skill\ndescription: One or two sentences that say what this covers and when to reach for it. Use when …\nversion: 1.0.0\n---\n\n# Example skill\n\n## When to use\n\n## Guardrails\n\n## Done","highlightedLines":"2-4","showLineNumbers":true,"caption":"The three required frontmatter keys and the three required sections."} /-->

## Required frontmatter

<!-- wp:docspress/fields {"title":"SKILL.md frontmatter","description":"Every key here is enforced by scripts/validate-skills.mjs. A missing or malformed value is an error, not a warning.","fields":[{"name":"name","type":"string","required":true,"defaultValue":"","description":"Kebab-case, and must equal the directory name exactly.","values":"","deprecated":false},{"name":"description","type":"string","required":true,"defaultValue":"","description":"80–1000 characters, and must state when to reach for the skill. Over 700 characters warns. This is the only thing an agent reads before loading the body.","values":"","deprecated":false},{"name":"version","type":"string","required":true,"defaultValue":"","description":"Semver, optionally with a prerelease suffix.","values":"","deprecated":false}],"searchable":false,"compact":false} /-->

The description must match the trigger pattern — it has to contain *Use when*, *Use whenever*, *Use for*, *Use before*, *Use after*, or *Use during*. A description that only says what the skill covers, never when to reach for it, fails.

## Required sections

Three `##` headings must be present so any agent knows where to look:

- `## When to use`
- `## Guardrails`
- `## Done`

## Portability

<!-- wp:docspress/callout {"tone":"danger","title":"No machine-specific paths","content":"<p>An absolute path under <code>/Users/</code>, <code>/home/</code>, or a Windows drive letter fails validation — a skill that only works on one laptop is not a shared skill. Placeholder users such as <code>me</code>, <code>you</code>, <code>user</code>, <code>username</code> and <code>your-user</code> are allowed, so a skill can still show a host path as a counter-example.</p>","collapsible":false} /-->

Every file a skill references must exist, and the skill must be listed in the README's *Available skills* table. Both are validation errors, not warnings.

## Length

A body over 200 lines warns. The check is about undisclosed sprawl rather than length: the warning clears when the reference-shaped parts have been promoted into `references/`. Gating on that presence rather than a line ceiling keeps the check from being satisfiable by compressing prose, which would cost the clarity the rule exists to protect.

## Validate before opening a pull request

<!-- wp:docspress/terminal-session {"title":"Validate every skill","shell":"bash","prompt":"$","command":"npm run validate","output":""} /-->

Validate a subset by name, or promote warnings to failures:

<!-- wp:docspress/code-tabs {"tabs":[{"label":"One skill","language":"bash","filename":"Terminal","code":"node scripts/validate-skills.mjs wp-pressable"},{"label":"Several","language":"bash","filename":"Terminal","code":"node scripts/validate-skills.mjs wp-pressable task-tracking"},{"label":"Strict","language":"bash","filename":"Terminal","code":"node scripts/validate-skills.mjs --strict"}],"showLineNumbers":false,"caption":"The validator exits 1 on any error, or on any warning under --strict."} /-->

Every pull request runs the validator and a commit-convention check, so a skill that fails locally will fail in CI.

## How releases work

Releases are automated. There is nothing to bump by hand.

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Merge conventional commits","content":"<p>Land work on <code>main</code> with conventional commit messages.</p>"},{"title":"release-please opens a PR","content":"<p>A rolling <strong>Automated Release</strong> pull request accumulates the changelog.</p>"},{"title":"Merge that PR","content":"<p>Merging tags the release, writes <code>CHANGELOG.md</code>, and publishes to npm via Trusted Publishing.</p>"}]} /-->

<!-- wp:docspress/callout {"tone":"warning","title":"Do not hand-edit generated files","content":"<p><code>CHANGELOG.md</code>, <code>.release-please-manifest.json</code> and the version in <code>package.json</code> are machine-owned. Editing them puts the repository into a state its next release pull request fights with.</p>","collapsible":false} /-->
