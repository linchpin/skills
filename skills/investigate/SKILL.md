---
name: investigate
description: Find the root cause of a bug before changing anything — reproduce it reliably, read the actual error, bisect to the responsible layer, and confirm the mechanism, with WordPress-specific first checks (debug log, plugin conflict, template hierarchy, cache, DB overrides). Use when something is broken, erroring, or behaving differently than expected, when a fix didn't hold, or when the cause isn't obvious. Not for finding unknown bugs by exploration — use `web-qa`.
version: 1.0.0
---

# Investigate

The expensive failure mode isn't a hard bug — it's a plausible guess applied as a fix. It
looks resolved, ships, and comes back next week with the real cause untouched.

**Reproduce, then explain the mechanism, then fix.** If you can't say *why* the bug happens,
you haven't found it yet.

## When to use

- Something errors, breaks, or behaves differently than expected.
- A previous fix didn't hold, or the bug came back.
- "It works locally but not on production."
- A test or CI job fails for reasons that aren't obvious from the output.

**Not this skill:** systematically hunting for unknown bugs — [`web-qa`](../web-qa/SKILL.md).
Slowness and accessibility as a measured audit — [`wp-audit`](../wp-audit/SKILL.md).

## Owns

Canonical for: the reproduce → isolate → explain → fix → verify discipline, and the
WordPress-specific first checks. Fixing and shipping belong to the skills that own those.

## Procedure

1. **Reproduce it, exactly.** Get the precise steps, environment, user role, and data. A bug
   you can't reproduce is a bug you can't verify fixed. If it won't reproduce, that *is* the
   finding — chase the difference between environments instead.
   → You can trigger it on demand.
2. **Read the real error.** Not the symptom the user described — the actual log line, stack
   trace, console error, or failed request. See the first checks below.
   → You have the literal error text and where it came from.
3. **Isolate the layer** before reading code broadly. Which of these is it: browser/JS, PHP
   runtime, database content, server/host config, build output, or third-party service? Each
   has a different cheapest test. → One layer named, the others ruled out with evidence.
4. **Bisect toward the cause.** Narrow by disabling, reverting, or halving — plugin conflict
   tests, `git bisect`, commenting out a filter, testing with a default theme. Prefer a
   binary split over reading everything. → A specific file, function, hook, or record.
5. **Explain the mechanism** in one or two sentences before writing a fix: what runs, in what
   order, and why that produces this output. → If you can't, keep going; don't start editing.
6. **Fix at the cause, not the symptom.** Suppressing a warning, adding a null check around a
   value that should never be null, or forcing a cache flush are treatments, not cures — and
   if you choose one deliberately, say so and note what the real fix would be.
   → The change follows from the mechanism.
7. **Verify by re-running the original reproduction**, then check whatever the fix could
   plausibly have broken. → The exact failing case now passes.

## WordPress first checks

Run these before deep code reading — they resolve most reports in minutes:

| Symptom | First check |
| --- | --- |
| White screen / 500 | `WP_DEBUG` + `WP_DEBUG_LOG`, then read `debug.log`; check PHP error log on the host |
| Works local, not production | Deployed version vs repo, then DB template overrides shadowing theme files ([`wp-pressable`](../wp-pressable/SKILL.md)) |
| Change doesn't appear | Object cache, page/edge cache, and the browser — flush in that order before debugging code |
| Wrong template renders | Template hierarchy, and whether a DB `wp_template` override exists |
| Broke after an update | Plugin conflict test: deactivate all, reactivate one at a time; then a default theme |
| Block shows "invalid content" | Saved markup vs what the block now outputs ([`wordpress-blocks`](../wordpress-blocks/SKILL.md)) |
| Block missing from inserter | Whether it was built, then registration ([`wp-block-conventions`](../wp-block-conventions/SKILL.md)) |
| Behavior differs per user | Role and capability checks; test logged out, subscriber, editor, admin |
| Slow, not broken | Measure before theorizing — [`wp-audit`](../wp-audit/SKILL.md) |

Run WP-CLI checks through [`wp-studio-cli`](../wp-studio-cli/SKILL.md) locally, or
read-only via [`wp-pressable`](../wp-pressable/SKILL.md) on a server.

## Guardrails

- **Never fix what you haven't reproduced.** Without a failing case there's nothing to verify
  against, and "it seems better" is not a result.
- **Never change several things at once** while diagnosing — you lose the signal about which
  one mattered.
- **Never leave debugging artifacts behind**: `var_dump`, `error_log`, `console.log`,
  `WP_DEBUG_DISPLAY`, a disabled plugin, or a commented-out block.
- **Never debug by mutating production data.** Read-only diagnostics; reproduce locally.
- **Never present a hypothesis as a finding.** Say "likely" when it's likely, and say what
  would confirm it.
- If the cause turns out to be a deliberate decision rather than a defect, stop and surface
  that instead of engineering around it.

## Done

- [ ] Reproduction steps written down and confirmed working before the fix.
- [ ] The actual error text located and quoted, not paraphrased from the symptom.
- [ ] Layer isolated, with the alternatives ruled out on evidence.
- [ ] Mechanism stated in a sentence or two.
- [ ] Fix addresses the cause, or a deliberate stopgap is labeled as one.
- [ ] Original reproduction re-run and now passes; nearby behavior checked.
- [ ] Debugging artifacts removed; findings recorded on the ClickUp task.
