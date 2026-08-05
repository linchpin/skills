---
name: wp-audit
description: Audit a WordPress site for performance, accessibility, and visible frontend quality, then report prioritized fixes and re-measure after changes. Use when asked to review, optimize, QA, or "check why the site is slow", when Core Web Vitals or Lighthouse scores come up, when a client asks about accessibility or WCAG, or before handing a build back to a client. Measures locally via the Studio MCP; production numbers require the live site. Not for fixing lint or tests — use `quality-gates`.
version: 1.1.0
---

# WordPress audit

An audit is only worth what its evidence is worth. The job is to **measure what can be
measured, inspect what can't, and never blur the line between them** — an agency report that
implies a tool ran when a model eyeballed a screenshot is worse than no report.

Start with the smallest audit that answers the question actually asked.

## When to use

- "Why is the site slow?", Core Web Vitals, Lighthouse, or page-weight questions.
- Accessibility questions — contrast, focus states, readability, WCAG.
- Frontend QA or a polish pass before handing work back to a client.
- Verifying that a fix actually improved things (before/after).

**Not this skill:** lint, PHPCS, PHPStan, or tests — [`quality-gates`](../quality-gates/SKILL.md).
Performance *techniques* (caching, asset strategy) — the upstream `wp-performance` skill.
Operating the local site — [`wp-studio-cli`](../wp-studio-cli/SKILL.md). Operating a live
server — [`wp-pressable`](../wp-pressable/SKILL.md).

## Owns

Canonical for: audit scope selection, the measurement loop, the thresholds below, evidence
honesty, and the before/after comparison. Defers the fixes themselves to the skill that owns
the code being changed.

## Preflight — what are you actually measuring?

| Target | How | Caveat |
| --- | --- | --- |
| Local Studio site | [`wp-studio-cli`](../wp-studio-cli/SKILL.md) → `need_for_speed`, `take_screenshot`, `inspect_design` | **Synthetic.** PHP-WASM + SQLite, no CDN, no production cache — good for diagnosis and before/after, not a production claim |
| Production / staging | A real browser via [`browser-automation`](../browser-automation/SKILL.md) against the live URL; server state via [`wp-pressable`](../wp-pressable/SKILL.md) read-only commands | The only numbers you can quote to a client as real |
| Legacy local (wp-env / LocalWP) | [`browser-automation`](../browser-automation/SKILL.md) against the local URL | Studio MCP tools won't apply |

Resolve two things before measuring: **which environment**, and **which URL path** (default
`/` if unspecified). State both in the report — an audit without them isn't reproducible.

## Procedure

1. **Pick the scope** — performance, accessibility, visual QA, or a named combination. Say
   which you chose when the request was ambiguous. → The user knows what's being measured.
2. **Measure** with the tools the environment offers. Take a screenshot for anything visual
   so findings are anchored to evidence. → Raw numbers and images captured, not recalled.
3. **Interpret against the thresholds** below rather than by feel. → Every finding is
   Good / Needs improvement / Poor, with the measured value shown.
4. **Diagnose in WordPress terms.** A number is not a finding; "LCP 4.1s because the hero
   image is an unresized 2.4 MB PNG" is. Inspect the theme, plugins, and block markup to get
   from symptom to cause. → Each finding names a probable cause and where it lives.
5. **Prioritize ruthlessly.** A short list ordered by impact-per-effort beats an exhaustive
   one. → Top findings first; the long tail summarized, not enumerated.
6. **Re-measure after fixes**, same environment and path, and report what moved, what didn't,
   and any tradeoff taken. → Before/after pairs for every metric you claimed to improve.

## Thresholds

Google's Core Web Vitals bands — these are the public standard, not house opinion:

| Metric | Good | Needs improvement | Poor |
| --- | --- | --- | --- |
| TTFB | < 800 ms | 800–1800 ms | > 1800 ms |
| FCP | < 1800 ms | 1800–3000 ms | > 3000 ms |
| LCP | < 2500 ms | 2500–4000 ms | > 4000 ms |
| CLS | < 0.1 | 0.1–0.25 | > 0.25 |

Page-composition warning signs: DOM > 1500 elements · page weight > 3 MB · > 80 requests ·
scripts > 20 files or 500 KB · stylesheets > 10 files or 200 KB.

Common WordPress causes worth checking before anything exotic: oversized or unresized
images, heavy or duplicated plugins, render-blocking and duplicated font loads, unused theme
CSS shipped in full, and wrapper-heavy block layouts inflating the DOM.

## Accessibility — say what you actually did

Without a dedicated scanner, this pass is **visual review plus code inspection**, and the
report must say so. Never describe it as a WCAG audit, never assign a conformance level, and
never imply a client is compliant on this basis. When a real conformance claim is needed,
say that a dedicated accessibility audit is required — that's a different engagement.

What this pass reliably catches: low text/background contrast, weak or ambiguous CTA states,
missing or invisible focus states, animation with no `prefers-reduced-motion` fallback,
readability problems from font size / line height / density, and meaning carried by color
alone. Use `inspect_design` for computed styles when it beats reading the CSS.

A contrast finding is fixed as a **token** change — a palette slug or the button tokens in
`theme.json`, per [`wp-design-tokens`](../wp-design-tokens/SKILL.md) — never as an inline
override on the one block where you noticed it. Report the measured ratio for both the current
and proposed pairing so the decision is reviewable.

## Guardrails

- **Never present synthetic local numbers as production performance.** Label the environment
  on every number you report.
- **Never claim a check ran that didn't.** If a conclusion came from looking at a screenshot
  or reading code, say so in the finding.
- **Never assert WCAG conformance** from this pass — see above.
- **Never change code during an audit** unless the user asked for fixes too; an audit that
  quietly edits things can't be trusted as a baseline.
- **Never run mutating commands against production** to gather evidence — read-only
  diagnostics via [`wp-pressable`](../wp-pressable/SKILL.md), and confirm before anything else.
- **Don't over-optimize one dimension silently.** When performance, accessibility, and design
  conflict, surface the tradeoff and let the user choose.
- Don't pad the report. Ten low-impact nitpicks buried around two real problems is a worse
  deliverable than the two real problems.

## Done

- [ ] Environment and URL path stated, and the environment's limits noted.
- [ ] Scope stated, and it matches what was asked.
- [ ] Every metric reported with its measured value and threshold band.
- [ ] Every finding has a probable cause and a location, not just a symptom.
- [ ] Evidence source labeled per finding — measured, inspected, or observed visually.
- [ ] No WCAG conformance claim; accessibility limits stated plainly.
- [ ] Findings ordered by impact; the top fixes are actionable as written.
- [ ] If fixes were made, before/after numbers from the same environment and path.
