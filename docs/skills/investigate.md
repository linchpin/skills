---
title: investigate
---

Finds the root cause of a bug before anything changes. The expensive failure isn't a hard bug. It's a plausible guess applied as a fix, which looks resolved, ships, and comes back next week. The rule is: reproduce, then explain the mechanism, then fix. If you can't say *why* the bug happens, you haven't found it yet.

## When to reach for it

- Something errors, breaks, or behaves differently than expected.
- A previous fix didn't hold, or the bug came back.
- It works locally but not on production.
- A test or CI job fails for reasons that aren't obvious from the output.

Things you might say that load it: "why is this happening", "it worked yesterday", "the fix didn't stick", "check the debug log". It also applies before changing code to fix something whose cause isn't yet proven.

## Where it stops

> **Not this skill:** systematically hunting for unknown bugs — [`web-qa`](web-qa.md). Slowness and accessibility as a measured audit — [`wp-audit`](wp-audit.md).

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Reproduce it, exactly","content":"<p>Pin down the steps, environment, user role and data until the bug triggers on demand. If it won't reproduce, the difference between environments becomes the finding.</p>"},{"title":"Read the real error","content":"<p>Find the literal log line, stack trace, console error or failed request, not the symptom as reported.</p>"},{"title":"Isolate the layer","content":"<p>Name one layer (browser, PHP, database content, host config, build output or a third party) and rule the others out with evidence before reading code broadly.</p>"},{"title":"Bisect toward the cause","content":"<p>Narrow by disabling, reverting or halving, such as plugin conflict tests or <code>git bisect</code>, until one file, hook or record is left.</p>"},{"title":"Explain the mechanism","content":"<p>State in a sentence or two what runs, in what order, and why that produces this output. No edits until this is possible.</p>"},{"title":"Fix at the cause","content":"<p>Change what the mechanism points to. A deliberate stopgap, such as suppressing a warning or flushing a cache, is labeled as one, with the real fix noted.</p>"},{"title":"Verify","content":"<p>Re-run the original reproduction, then check whatever the fix could plausibly have broken.</p>"}]} /-->

## What it checks first

Before reading code in depth, it works through a table of WordPress first checks that resolve most reports in minutes:

| Symptom | First check |
| --- | --- |
| White screen or 500 | `WP_DEBUG` and `WP_DEBUG_LOG`, then `debug.log` and the host's PHP error log |
| Works locally, not on production | Deployed version against the repo, then database template overrides shadowing theme files |
| Change doesn't appear | Object cache, page or edge cache, then the browser, flushed in that order |
| Wrong template renders | Template hierarchy, and whether a database `wp_template` override exists |
| Broke after an update | Plugin conflict test, then a default theme |
| Block shows "invalid content" | Saved markup against what the block now outputs |
| Block missing from the inserter | Whether it was built, then its registration |
| Behavior differs per user | Role and capability checks across logged out, subscriber, editor and admin |
| Slow, not broken | Measure before theorizing, with `wp-audit` |

## What it owns

The reproduce → isolate → explain → fix → verify discipline, and the WordPress-specific first checks. Fixing and shipping belong to the skills that own those.

## Guardrails

- Never fix what you haven't reproduced.
- Never change several things at once while diagnosing.
- Never leave debugging artifacts behind: `var_dump`, `error_log`, `console.log`, `WP_DEBUG_DISPLAY`, a disabled plugin, or a commented-out block.
- Never present a hypothesis as a finding. Say "likely", and say what would confirm it.
- If the cause turns out to be a deliberate decision rather than a defect, stop and surface it instead of engineering around it.

<!-- wp:docspress/callout {"tone":"warning","title":"Read-only on production","content":"<p>Never debug by mutating production data. Run read-only diagnostics and reproduce locally.</p>","collapsible":false} /-->

## Done when

- [ ] Reproduction steps are written down and confirmed working before the fix.
- [ ] The actual error text is located and quoted, not paraphrased.
- [ ] The layer is isolated, with alternatives ruled out on evidence.
- [ ] The mechanism is stated in a sentence or two.
- [ ] The fix addresses the cause, or a deliberate stopgap is labeled as one.
- [ ] The original reproduction passes, and nearby behavior is checked.
- [ ] Debugging artifacts are removed and findings are recorded on the ClickUp task.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/investigate/SKILL.md) is the whole skill. It has no `references/` or `scripts/`.

Pre-approved, so the agent can run them without a prompt: reading and searching files, `git log`, `git diff`, `git status`, and `tail`. Anything that writes still asks.

## Related skills

- [`web-qa`](web-qa.md) — use instead to hunt for bugs nobody has reported yet.
- [`wp-audit`](wp-audit.md) — use instead when the problem is speed or accessibility.
- [`wp-pressable`](wp-pressable.md) — the "works locally, not on production" check and read-only WP-CLI on a server.
- [`wp-studio-cli`](wp-studio-cli.md) — runs WP-CLI checks locally.
- [`wordpress-blocks`](wordpress-blocks.md) — diagnosing "invalid content" blocks.
- [`wp-block-conventions`](wp-block-conventions.md) — diagnosing a block missing from the inserter.
