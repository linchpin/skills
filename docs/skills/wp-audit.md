---
title: wp-audit
---

An audit is only worth what its evidence is worth. The job is to measure what can be measured, inspect what can't, and never blur the line between them — implying a tool ran when a model eyeballed a screenshot is worse than no report. Start with the smallest audit that answers the question actually asked.

## When to reach for it

- "Why is the site slow?", Core Web Vitals, Lighthouse, or page-weight questions.
- Accessibility questions — contrast, focus states, readability, WCAG.
- Frontend QA or a polish pass before handing work back to a client.
- Verifying that a fix actually improved things (before/after).

## Where it stops

> **Not this skill:** lint, PHPCS, PHPStan, or tests — [`quality-gates`](quality-gates.md). Performance *techniques* (caching, asset strategy) — the upstream `wp-performance` skill. Operating the local site — [`wp-studio-cli`](wp-studio-cli.md). Operating a live server — [`wp-pressable`](wp-pressable.md). Auditing a plugin **repo** against the house standard — files, headers, workflows — [`wp-plugin-standards`](wp-plugin-standards.md); this skill audits a running **site**.

## How it works

<!-- wp:docspress/flow {"start":1,"steps":[{"title":"Pick the scope","content":"<p>Performance, accessibility, visual QA, or a named combination. Say which one was chosen when the request was ambiguous.</p>"},{"title":"Measure","content":"<p>Use whatever tools the environment offers, and screenshot anything visual so findings are anchored to evidence rather than recalled.</p>"},{"title":"Interpret against the thresholds","content":"<p>Grade every finding Good, Needs improvement, or Poor against the measured value, not by feel.</p>"},{"title":"Diagnose in WordPress terms","content":"<p>Inspect the theme, plugins, and block markup to get from a number to a probable cause and where it lives.</p>"},{"title":"Prioritize ruthlessly","content":"<p>Order a short list by impact-per-effort; summarize the long tail rather than enumerating it.</p>"},{"title":"Re-measure after fixes","content":"<p>Same environment and path, reporting what moved, what didn't, and any tradeoff taken.</p>"}]} /-->

| Metric | Good | Needs improvement | Poor |
| --- | --- | --- | --- |
| TTFB | < 800 ms | 800–1800 ms | > 1800 ms |
| FCP | < 1800 ms | 1800–3000 ms | > 3000 ms |
| LCP | < 2500 ms | 2500–4000 ms | > 4000 ms |
| CLS | < 0.1 | 0.1–0.25 | > 0.25 |

## What it checks first

Resolves which environment and which URL path are in scope before measuring anything, and states both in the report — an audit without them isn't reproducible:

| Target | How | Caveat |
| --- | --- | --- |
| Local Studio site | `wp-studio-cli`'s `need_for_speed`, `take_screenshot`, `inspect_design` | Synthetic — PHP-WASM + SQLite, no CDN, no production cache |
| Production / staging | A real browser via `browser-automation` against the live URL; server state read-only via `wp-pressable` | The only numbers you can quote to a client as real |
| Legacy local (wp-env / LocalWP) | `browser-automation` against the local URL | Studio MCP tools won't apply |

## What it owns

Canonical for: audit scope selection, the measurement loop, the thresholds, evidence honesty, and the before/after comparison. Defers the fixes themselves to the skill that owns the code being changed.

## Guardrails

- Never present synthetic local numbers as production performance. Label the environment on every number reported.
- Never claim a check ran that didn't. Say when a conclusion came from a screenshot or reading code.
- Never assert WCAG conformance from this pass.
- Never change code during an audit unless the user asked for fixes too — an audit that quietly edits things can't be trusted as a baseline.
- Don't over-optimize one dimension silently. When performance, accessibility, and design conflict, surface the tradeoff and let the user choose.
- Don't pad the report. A short list of real problems beats an exhaustive list of nitpicks.

<!-- wp:docspress/callout {"tone":"warning","title":"Read-only on production","content":"<p>Never run mutating commands against production to gather evidence. Use read-only diagnostics via wp-pressable, and confirm before anything else.</p>","collapsible":false} /-->

## Done when

- [ ] Environment and URL path stated, and the environment's limits noted.
- [ ] Scope stated, and it matches what was asked.
- [ ] Every metric reported with its measured value and threshold band.
- [ ] Every finding has a probable cause and a location, not just a symptom.
- [ ] Evidence source labeled per finding — measured, inspected, or observed visually.
- [ ] No WCAG conformance claim; accessibility limits stated plainly.
- [ ] Findings ordered by impact; the top fixes are actionable as written.
- [ ] If fixes were made, before/after numbers from the same environment and path.

## Files

- [`SKILL.md`](https://github.com/linchpin/skills/blob/main/skills/wp-audit/SKILL.md) is the whole skill. It has no `references/` or `scripts/`.

Pre-approved, so the agent can run them without a prompt: reading and searching files. Anything that writes, or any command against production, still asks.

## Related skills

- [`quality-gates`](quality-gates.md) — runs lint, PHPCS, PHPStan, and tests, which this skill explicitly is not.
- [`../upstream.md`](../upstream.md) (`wp-performance`) — owns performance techniques like caching and asset strategy; this skill only measures and diagnoses.
- [`wp-studio-cli`](wp-studio-cli.md) — supplies `need_for_speed`, `take_screenshot`, and `inspect_design` for the local Studio target.
- [`wp-pressable`](wp-pressable.md) — read-only commands for production and staging server state.
- [`wp-plugin-standards`](wp-plugin-standards.md) — audits a plugin repo against the house standard; this skill audits a running site instead.
- [`browser-automation`](browser-automation.md) — the real browser this skill drives against production or staging.
- [`wp-design-tokens`](wp-design-tokens.md) — where a contrast finding actually gets fixed, as a token change.
