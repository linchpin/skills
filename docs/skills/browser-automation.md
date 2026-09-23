---
title: browser-automation
---

One decision, made once: real Chrome via the Chrome DevTools MCP is the default, because it carries your actual sessions, extensions, and cookies, which is what makes local dogfooding realistic. Headless Playwright is the fallback for scripted, repeatable, or parallel runs. Skills that need a browser reference this rather than each choosing their own way in.

## When to reach for it

- Loading a page, clicking a flow, or filling a form as part of a task.
- Capturing screenshots at one or more viewports.
- Reading console errors, failed requests, or network timings.
- Verifying a change in a real browser rather than from the code.

## Where it stops

> **Not this skill:** what to test and how to judge it — [`web-qa`](web-qa.md). Performance and accessibility measurement — [`wp-audit`](wp-audit.md).

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Resolve the target URL","content":"<p>Get the exact URL and environment through <code>project-context</code> — a Studio local URL, a wp-env port, staging, or production. Never assume <code>localhost:3000</code>.</p>"},{"title":"Confirm the site responds","content":"<p>Check for HTTP 200 before driving a browser at it. A failed page load misread as a broken feature wastes the whole session.</p>"},{"title":"Pick the rung","content":"<p>Choose Chrome DevTools MCP or the Playwright fallback from the ladder, and say which one is in use so the user knows if their real browser is about to be driven.</p>"},{"title":"Handle auth explicitly","content":"<p>Real Chrome usually already has the session. Playwright does not — use a stored auth state, a login step, or imported cookies, never hardcoded credentials.</p>"},{"title":"Capture evidence","content":"<p>Screenshot desktop and mobile widths, and capture console and network output when diagnosing, so findings are anchored to artifacts rather than memory.</p>"},{"title":"Clean up","content":"<p>Close any pages opened, and leave the user's browser exactly as found.</p>"}]} /-->

| Order | Tool | Use when |
| --- | --- | --- |
| 1 | Chrome DevTools MCP | Default — real Chrome, real sessions, local sites, visual checks |
| 2 | Playwright MCP / CLI | Scripted or repeatable runs, parallel pages, CI-shaped work |
| 3 | Ask | Neither is available |

## What it checks first

Resolves the target URL and its environment through `project-context` before driving anything — a Studio local URL, a wp-env port, a staging host, or production, never an assumed `localhost:3000`. Confirms the site actually responds before pointing a browser at it, since a failed page load misdiagnosed as a broken feature wastes the whole session.

## What it owns

Canonical for: which browser tool to reach for, in what order, and how to handle auth. Other skills state *what* to do in the browser; this states *how to get one*.

## Guardrails

- Never submit destructive UI actions speculatively — deletes, bulk actions, payments, "send now". Read-only exploration first.
- Never trigger JavaScript dialogs (`alert`, `confirm`, `prompt`) — they block the automation session until dismissed by hand.
- Never store credentials, cookies, or auth state in the repo. Use the browser's existing session or a gitignored auth file.
- Never navigate anywhere the task didn't call for. Stay on the target application.
- Never reach for `claude-in-chrome` tools. They fight the Chrome DevTools MCP for the same browser session.
- If the browser tooling fails twice in a row, stop and report rather than cycling through variations of the same call.

<!-- wp:docspress/callout {"tone":"warning","title":"Never drive a browser against production without confirmation","content":"<p>Real sessions can submit real forms, send real email, and write real data. Get explicit confirmation before testing a change against production.</p>","collapsible":false} /-->

## Done when

- [ ] Target URL resolved from actual project config, with its environment named.
- [ ] The rung used is stated, and the user knew if their real browser was driven.
- [ ] Authentication genuinely applied where the flow required it.
- [ ] Evidence captured — screenshots, console, network — for anything reported.
- [ ] No destructive UI actions taken without confirmation; pages cleaned up.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/browser-automation/SKILL.md) is the whole skill. It has no `references/` or `scripts/`.

Pre-approved, so the agent can run them without a prompt: reading and searching files. Anything that writes, or drives the browser itself, still asks.

## Related skills

- [`web-qa`](web-qa.md) — decides what to test and how to judge it; this skill only gets a browser open.
- [`wp-audit`](wp-audit.md) — owns performance and accessibility measurement, driving this skill's browser against the numbers.
- [`design-previews`](design-previews.md) — screenshots the visual directions it generates through this skill's ladder.
- [`project-context`](project-context.md) — resolves the target URL and environment before this skill drives anything at it.
- [`wp-pressable`](wp-pressable.md) — flush object and page cache on Pressable before concluding a change didn't work.
- [`wp-studio-cli`](wp-studio-cli.md) — the one exception: Studio's own `take_screenshot` and `inspect_design` render PHP-WASM directly and don't come through this ladder.
