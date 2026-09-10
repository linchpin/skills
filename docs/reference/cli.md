---
title: CLI
sidebar_position: 1
---

The installer is the package's only binary, exposed as `skills` and normally run through `npx`. Every flag below is read by `parseArgs` in `bin/install.mjs`; an unrecognized option exits with an error rather than being ignored.

## Options

<!-- wp:docspress/fields {"title":"Installer flags","description":"Short and long forms are equivalent. --agent also accepts the --agent=<id> form.","fields":[{"name":"--global, -g","type":"boolean","required":false,"defaultValue":"false","description":"Install to the user-global skills directory instead of the current project.","values":"","deprecated":false},{"name":"--agent <id>","type":"enum","required":false,"defaultValue":"claude-code","description":"Which agent's directories to write to. Pass all to install for every supported agent.","values":"claude-code, github-copilot, codex, cursor, all","deprecated":false},{"name":"--list, -l","type":"boolean","required":false,"defaultValue":"false","description":"List available skills, Linchpin plus the pinned base layer, then exit.","values":"","deprecated":false},{"name":"--check","type":"boolean","required":false,"defaultValue":"false","description":"Audit every scope this agent reads for duplicate skills. Installs nothing.","values":"","deprecated":false},{"name":"--dry-run, -n","type":"boolean","required":false,"defaultValue":"false","description":"Show what would change and exit without writing anything.","values":"","deprecated":false},{"name":"--force, -f","type":"boolean","required":false,"defaultValue":"false","description":"Reinstall everything, and install even when these skills already exist in the opposite scope.","values":"","deprecated":false},{"name":"--yes, -y","type":"boolean","required":false,"defaultValue":"false","description":"Skip the confirmation prompt. Implied when the process is not attached to a terminal.","values":"","deprecated":false},{"name":"--skip-upstream","type":"boolean","required":false,"defaultValue":"false","description":"Install only the Linchpin skills; do not vendor the upstream base layer.","values":"","deprecated":false},{"name":"--help, -h","type":"boolean","required":false,"defaultValue":"false","description":"Show the built-in help and exit.","values":"","deprecated":false}],"searchable":true,"compact":false} /-->

## Install targets

Scope and agent together decide the directories written. An agent reads both its project and global scope, which is why installing into both duplicates every skill.

| Agent | Project scope | Global scope |
| --- | --- | --- |
| `claude-code` | `.claude/skills` | `.claude/skills` |
| `github-copilot` | `.agents/skills`, `.github/skills` | `.copilot/skills` |
| `codex` | `.codex/skills` | `.codex/skills` |
| `cursor` | `.cursor/skills` | `.cursor/skills` |

Project scope resolves against the current working directory; global scope against the home directory.

## Examples

<!-- wp:docspress/code-tabs {"tabs":[{"label":"Audit","language":"bash","filename":"Terminal","code":"npx @linchpinagency/skills --check"},{"label":"Preview","language":"bash","filename":"Terminal","code":"npx @linchpinagency/skills --dry-run"},{"label":"Unattended","language":"bash","filename":"Terminal","code":"npx @linchpinagency/skills --yes"},{"label":"Another agent","language":"bash","filename":"Terminal","code":"npx @linchpinagency/skills --agent github-copilot"}],"showLineNumbers":false,"caption":"Taken from the installer's own help output."} /-->

## Package scripts

| Script | Runs |
| --- | --- |
| `npm run list` | `node bin/install.mjs --list` |
| `npm run validate` | `node scripts/validate-skills.mjs` |
| `npm test` | The validator, so `test` and `validate` are the same check |
| `prepublishOnly` | The validator again, so a failing skill cannot be published |

## Requirements

Node 18 or newer, and no runtime dependencies — the installer and validator are plain Node.
