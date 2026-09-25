---
title: Linchpin Skills
sidebar_position: 1
---

A shared library of AI agent skills for the kinds of projects Linchpin builds: WordPress, React and Cloudflare Workers. The same files work in Claude Code, GitHub Copilot, Codex and Cursor.

## What a skill is

A skill is a Markdown file of instructions that your coding agent loads **when your request matches its description**. It is how an agent works like a Linchpin developer rather than a generic one. It knows we run WordPress Studio, that PHPCS applies only where `phpcs.xml.dist` exists, that release-please owns `CHANGELOG.md`, and that every commit carries a ClickUp key. You rarely invoke one by name. Ask for what you want and the matching skill loads. [How skills work](how-skills-work.md) covers the rest.

<!-- wp:docspress/audience-paths {"eyebrow":"Start here","title":"What do you need?","description":"","paths":[{"title":"Install the skills","description":"One command, once per machine, and every project picks them up.","url":"/skills/installation/","cta":"Install","icon":"code","accent":"blue","newTab":false},{"title":"Find the right skill","description":"Every skill, what it does, when to use it, and where it stops.","url":"/skills/skills/","cta":"Browse skills","icon":"api","accent":"gold","newTab":false},{"title":"Write a new skill","description":"The house standard, the scaffolder, and what the validator checks.","url":"/skills/contributing/","cta":"Contribute","icon":"code","accent":"green","newTab":false}],"columns":3,"tone":"theme","textAlign":"left","compact":false,"showNumbers":false} /-->

## Install

<!-- wp:docspress/terminal-session {"title":"Install for every project on this machine","shell":"bash","prompt":"$","command":"npx @linchpinagency/skills --global","output":""} /-->

Re-run the same command to update. [Installation](installation.md) covers project scope, other agents, and previewing changes.

## Your first day

The fastest way to learn the library is to run one loop end to end.

| You want to… | Ask for it naturally | Skill that fires |
| --- | --- | --- |
| Understand a repo you just cloned | "what am I working with here?" | [`project-context`](skills/project-context.md) |
| Find out why something's broken | "the hero image 404s on mobile" | [`investigate`](skills/investigate.md) |
| Test a site like a user, and fix what's found | "QA the checkout flow" | [`web-qa`](skills/web-qa.md) |
| File work for later | "create an issue for the broken footer link" | [`task-tracking`](skills/task-tracking.md) |
| Check it's ready to commit | "is this ready to commit?" | [`quality-gates`](skills/quality-gates.md) |
| Commit and open the PR properly | "commit this and open a PR" | [`commit-and-release`](skills/commit-and-release.md) and [`task-tracking`](skills/task-tracking.md) |
| Handle a client support ticket | "the client says their contact form isn't sending" | [`support-triage`](skills/support-triage.md) |
| Do a site's monthly dependency maintenance | "run this month's maintenance — the bot PRs won't merge" | [`maintenance-window`](skills/maintenance-window.md) |
| Add guardrails before touching prod | "careful mode — I'm on production" | [`safety-hooks`](skills/safety-hooks.md) |
| Get the newest version of these skills | "update the skills" | [`skill-updates`](skills/skill-updates.md) |
| Keep a change small and actually verified | "don't over-engineer this" | [`engineering-discipline`](skills/engineering-discipline.md) |

The [skills index](skills/index.md) lists every skill. The installer also adds a pinned set of generic WordPress skills that we don't maintain; see [Base layer](upstream.md).

## Propose a skill

Skills encode how we work, so they go stale when that changes. If a skill tells the agent something outdated, open a pull request on [`linchpin/skills`](https://github.com/linchpin/skills), or an issue if you'd rather someone else write it. [Contributing a skill](contributing.md) has the standard.
