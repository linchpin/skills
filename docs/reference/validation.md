---
title: Validation rules
sidebar_position: 2
---

`scripts/validate-skills.mjs` checks every skill against the house standard. It exits `1` when any skill has an error, or — with `--strict` — any warning.

## Errors

An error fails the run and blocks the pull request.

<!-- wp:docspress/fields {"title":"Checks that error","fields":[{"name":"SKILL.md present","type":"any","required":true,"defaultValue":"","description":"The skill directory must contain a SKILL.md.","values":"","deprecated":false},{"name":"frontmatter block","type":"any","required":true,"defaultValue":"","description":"A leading --- block is required.","values":"","deprecated":false},{"name":"name","type":"string","required":true,"defaultValue":"","description":"Required, must equal the directory name, and must be kebab-case.","values":"","deprecated":false},{"name":"description","type":"string","required":true,"defaultValue":"","description":"Required, 80–1000 characters, and must state when to reach for the skill.","values":"","deprecated":false},{"name":"version","type":"string","required":true,"defaultValue":"","description":"Required, and must be semver with an optional prerelease suffix.","values":"","deprecated":false},{"name":"required sections","type":"any","required":true,"defaultValue":"","description":"## When to use, ## Guardrails and ## Done must all be present.","values":"","deprecated":false},{"name":"portable paths","type":"any","required":true,"defaultValue":"","description":"No machine-specific absolute path, except one using a placeholder user.","values":"","deprecated":false},{"name":"referenced files exist","type":"any","required":true,"defaultValue":"","description":"Every file the skill links to must be present in the repository.","values":"","deprecated":false},{"name":"listed in the README","type":"any","required":true,"defaultValue":"","description":"The skill must appear in the README's Available skills table.","values":"","deprecated":false}],"searchable":true,"compact":false} /-->

### Description length

The floor and ceiling exist because the description is the only thing an agent reads before deciding whether to load the skill.

| Length | Result |
| --- | --- |
| Under 80 characters | Error — too thin to match reliably |
| 80 to 700 | Accepted |
| Over 700 | Warning — getting long for a trigger |
| Over 1000 | Error — that is a body, not a trigger |

### Placeholder users

A path such as `/Users/username/Sites` passes, because `username` is a recognized placeholder. The accepted set is `me`, `you`, `user`, `username`, `your-user`, `...` and `…`. Anything else under `/Users/`, `/home/`, or a Windows drive letter is an error.

## Warnings

<!-- wp:docspress/callout {"tone":"note","title":"Body length is about sprawl, not size","content":"<p>A body over 200 lines warns. The warning clears once the reference-shaped parts — templates, command matrices, schemas — are promoted into <code>references/</code>. Gating on that rather than a line count keeps the check from being satisfiable by compressing prose, which would cost the clarity the rule exists to protect.</p>","collapsible":false} /-->

## Running it

<!-- wp:docspress/code-tabs {"tabs":[{"label":"All","language":"bash","filename":"Terminal","code":"node scripts/validate-skills.mjs"},{"label":"By name","language":"bash","filename":"Terminal","code":"node scripts/validate-skills.mjs wp-pressable task-tracking"},{"label":"Strict","language":"bash","filename":"Terminal","code":"node scripts/validate-skills.mjs --strict"}],"showLineNumbers":false,"caption":"Naming an unknown skill is an error rather than a silent no-op."} /-->

Output lists each skill with its errors and warnings, then a summary of how many were checked and how many problems were found.

## The vendored base layer

`upstream.json` pins which generic skills are vendored from `WordPress/agent-skills` and at which commit. Upstream publishes no releases, so the `ref` is a SHA that is bumped deliberately and re-tested. Upstream is GPL-2.0-or-later, so redistribution is fine with attribution.

<!-- wp:docspress/callout {"tone":"tip","title":"Skipping the base layer","content":"<p>Pass <code>--skip-upstream</code> to install only the Linchpin skills. The installer also degrades to this automatically when the upstream fetch fails, warns, and leaves the Linchpin layer installed.</p>","collapsible":false} /-->
