---
title: Linchpin Skills
sidebar_position: 1
---

A shared library of AI agent skills for the kinds of projects Linchpin builds — WordPress, React, and Cloudflare Workers. Skills are agent-agnostic instruction sets in the [Agent Skills](https://agentskills.io) format, so the same file works in Claude Code, GitHub Copilot, Codex, and Cursor.

## What a skill is

A skill is a Markdown file your coding agent loads **when your request matches its description**. It is how an agent behaves like a Linchpin developer rather than a generic one: it knows we run WordPress Studio, that PHPCS applies only where `phpcs.xml.dist` exists, that release-please owns `CHANGELOG.md`, and that every commit carries a ClickUp key.

The `description` in a skill's frontmatter is the only thing an agent reads before deciding whether to load the rest. That is why the validator enforces a floor and a ceiling on it, and why it must say *when* to reach for the skill.

<!-- wp:docspress/file-tree {"root":"skills/","tree":"commit-and-release/\n  SKILL.md\ntask-tracking/\n  SKILL.md\n  references/\n    clickup-json.md\n    clickup-mcp-tools.md\n    handoff.md","caption":"Each skill is a directory with a SKILL.md; reference-shaped material moves to references/."} /-->

## Two layers

The package installs two sets of skills side by side.

The **Linchpin layer** is everything in this repository's `skills/` directory — the house conventions: commits and releases, task tracking, quality gates, Pressable and Studio operations, engagement types.

The **base layer** is vendored at install time from `WordPress/agent-skills`, pinned to a commit in `upstream.json`. It covers general WordPress practice — block development, block themes, the Interactivity API, performance, WP-CLI, plugin development, the REST API. Upstream has no releases, so the pin is a SHA that gets bumped deliberately. Skip it with `--skip-upstream`.

## Where to go next

- [Installation](installation.md) — installing, choosing an agent, project versus global scope
- [Writing a skill](writing-a-skill.md) — the house standard and how to get a new skill accepted
- [Reference](reference/index.md) — every CLI flag and every validation rule
