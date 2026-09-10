---
title: Installation
sidebar_position: 2
---

The installer is a zero-dependency Node script published as `@linchpinagency/skills`. It requires Node 18 or newer and needs no global install of its own.

## Install into a project

Run it from the repository you want the skills available in.

<!-- wp:docspress/terminal-session {"title":"Install into the current project","shell":"bash","prompt":"$","command":"npx @linchpinagency/skills","output":""} /-->

By default this targets Claude Code and writes to `.claude/skills` in the current directory, alongside the vendored base layer.

## Install globally

<!-- wp:docspress/terminal-session {"title":"Install for every project on this machine","shell":"bash","prompt":"$","command":"npx @linchpinagency/skills --global","output":""} /-->

## Choose an agent

`--agent` selects which directories the installer writes to. Pass `all` to install for every supported agent at once.

| Agent | `--agent` | Project scope | Global scope |
| --- | --- | --- | --- |
| Claude Code | `claude-code` *(default)* | `.claude/skills` | `.claude/skills` |
| GitHub Copilot | `github-copilot` | `.agents/skills`, `.github/skills` | `.copilot/skills` |
| Codex | `codex` | `.codex/skills` | `.codex/skills` |
| Cursor | `cursor` | `.cursor/skills` | `.cursor/skills` |

<!-- wp:docspress/code-tabs {"tabs":[{"label":"Claude Code","language":"bash","filename":"Terminal","code":"npx @linchpinagency/skills"},{"label":"GitHub Copilot","language":"bash","filename":"Terminal","code":"npx @linchpinagency/skills --agent github-copilot"},{"label":"Codex","language":"bash","filename":"Terminal","code":"npx @linchpinagency/skills --agent codex"},{"label":"Cursor","language":"bash","filename":"Terminal","code":"npx @linchpinagency/skills --agent cursor"}],"showLineNumbers":false,"caption":"The same library, written to whichever directories that agent reads."} /-->

## Project and global scope collide

An agent reads both scopes. A skill installed in both is listed twice in every session, and its `description` is paid for twice in the agent's context.

<!-- wp:docspress/callout {"tone":"warning","title":"Installing over another scope aborts","content":"<p>If the skills already exist in the opposite scope, the installer stops rather than creating duplicates. Pass <code>--force</code> to override, or run <code>--check</code> first to see what is installed where.</p>","collapsible":false} /-->

<!-- wp:docspress/terminal-session {"title":"Audit every scope this agent reads","shell":"bash","prompt":"$","command":"npx @linchpinagency/skills --check","output":""} /-->

## Update safely

Re-running the installer plans an update: it compares installed versions against the package and shows what would change. Nothing to change exits early.

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Preview","content":"<p>Run with <code>--dry-run</code> to see the diff and write nothing.</p>"},{"title":"Apply","content":"<p>Re-run without the flag and confirm at the prompt, or pass <code>--yes</code> to skip it.</p>"},{"title":"Verify","content":"<p>Run <code>--list</code> to confirm the installed set and versions.</p>"}]} /-->

The confirmation prompt is implied when the process is not attached to a terminal, so CI does not hang.

## Offline and air-gapped installs

The base layer is fetched from GitHub at install time. If that fetch fails, the Linchpin skills still install and the installer warns. Re-run when online, or pass `--skip-upstream` to silence it and install the Linchpin layer only.
