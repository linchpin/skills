---
name: browser-automation
description: Drive a browser for QA, screenshots, and dogfooding — Chrome DevTools MCP against real Chrome first, Playwright headless as the scripted fallback, with auth and cookie handling. Use when a task needs to load a page, click through a flow, capture screenshots, read console errors or network failures, or test a local site in a browser. Not for deciding what to test — use `web-qa`.
version: 1.0.0
---

# Browser automation

One decision, made once: **real Chrome via the Chrome DevTools MCP is the default**, because
it carries your actual sessions, extensions, and cookies — which is what makes local
dogfooding realistic. Headless Playwright is the fallback for scripted, repeatable, or
parallel runs.

Skills that need a browser ([`web-qa`](../web-qa/SKILL.md),
[`wp-audit`](../wp-audit/SKILL.md), [`design-previews`](../design-previews/SKILL.md))
reference this rather than each choosing their own way in.

## When to use

- Loading a page, clicking a flow, or filling a form as part of a task.
- Capturing screenshots at one or more viewports.
- Reading console errors, failed requests, or network timings.
- Verifying a change in a real browser rather than from the code.

**Not this skill:** what to test and how to judge it — [`web-qa`](../web-qa/SKILL.md).
Performance and accessibility measurement — [`wp-audit`](../wp-audit/SKILL.md).

## Owns

Canonical for: which browser tool to reach for, in what order, and how to handle auth. Other
skills state *what* to do in the browser; this states *how to get one*.

## The ladder

| Order | Tool | Use when | Cost |
| --- | --- | --- | --- |
| 1 | **Chrome DevTools MCP** (`new_page`, `navigate_page`, `click`, `fill_form`, `take_screenshot`, `list_console_messages`, `list_network_requests`, `emulate`, `resize_page`) | Default. Real Chrome, real sessions, already-authenticated apps, local sites, visual checks | Uses the user's browser — visible, and shares their state |
| 2 | **Playwright MCP / CLI** | Scripted or repeatable runs, parallel pages, CI-shaped work, or when Chrome isn't available | Clean profile — auth must be handled explicitly |
| 3 | **Ask** | Neither is available | — |

Both `mantle` and `linchpin.com` already have Playwright configured with e2e suites, so a
scripted fallback usually has an existing harness to slot into.

Do **not** reach for `claude-in-chrome` tools — they conflict with the Chrome DevTools MCP
session and are not part of this ladder.

## Procedure

1. **Resolve the target URL** through [`project-context`](../project-context/SKILL.md) — a
   Studio local URL, a wp-env port, a staging host, or production. Never assume
   `localhost:3000`. → You can state the exact URL and which environment it is.
2. **Confirm the site responds** before driving a browser at it; a failed page load
   misdiagnosed as a broken feature wastes the whole session. → HTTP 200, or a known reason.
3. **Pick the rung** from the ladder and say which one you're on. → The user knows whether
   their real browser is about to be used.
4. **Handle auth explicitly.** Real Chrome usually has the session already. Playwright does
   not — use a stored auth state, a login step, or imported cookies, and never hardcode
   credentials into a script. → Authenticated pages actually render authenticated.
5. **Capture evidence as you go** — screenshots at desktop and mobile widths, plus console
   and network output when diagnosing. → Findings are anchored to artifacts, not memory.
6. **Clean up.** Close pages you opened; leave the user's browser as you found it.

## WordPress specifics

- Check **both** the front end and `/wp-admin` — a change that looks fine anonymously can
  break for logged-in users (admin bar, block editor, capability-gated UI).
- The **block editor** is a React app inside an iframe. Prefer editor-level assertions over
  deep DOM selectors, which change between WordPress releases.
- **Caching hides fixes.** On Pressable, flush object and page cache before concluding that a
  change didn't work ([`wp-pressable`](../wp-pressable/SKILL.md)).
- Studio runs **PHP-WASM with SQLite** — a browser result there is not a production result.

## Guardrails

- **Never drive a browser against production** to test a change without explicit
  confirmation. Real sessions can submit real forms, send real email, and write real data.
- **Never submit destructive UI actions** speculatively — deletes, bulk actions, payments,
  "send now". Read-only exploration first.
- **Never trigger JavaScript dialogs** (`alert`, `confirm`, `prompt`) — they block the
  automation session until dismissed by hand.
- **Never store credentials, cookies, or auth state in the repo.** Use the browser's existing
  session or a gitignored auth file.
- **Never navigate anywhere the task didn't call for.** Stay on the target application.
- If the browser tooling fails twice in a row, stop and report it rather than cycling through
  variations of the same call.

## Done

- [ ] Target URL resolved from actual project config, with its environment named.
- [ ] The rung used is stated, and the user knew if their real browser was driven.
- [ ] Authentication genuinely applied where the flow required it.
- [ ] Evidence captured — screenshots, console, network — for anything reported.
- [ ] No destructive UI actions taken without confirmation; pages cleaned up.
