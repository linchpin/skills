# QA checklist, severity, and report format

## Severity

Severity is about **user impact**, not how hard it is to fix.

| Severity | Means | Examples |
| --- | --- | --- |
| **Critical** | Blocks a core task, loses data, or exposes something it shouldn't | Checkout fails, form submits nothing, 500 on a key page, private content public, fatal PHP error |
| **High** | A primary flow is broken or badly degraded, no reasonable workaround | Nav broken on mobile, search returns nothing, images 404, admin screen unusable |
| **Medium** | Works but wrong or awkward; a workaround exists | Validation message never clears, wrong date format, layout breaks at one width, confusing empty state |
| **Low** | Cosmetic or minor polish | Spacing inconsistency, a typo, a hover state that doesn't match its neighbors |

Two rules that keep reports honest:

- **A judgment call is not a defect.** "I'd have used more spacing here" is design feedback —
  label it as such, don't file it as a bug.
- **Uncertain severity rounds down**, and say why. Inflating severity to force a fix wastes
  the tier system.

## What to exercise

### Every project

- **Primary flows first** — whatever the site exists to do: contact, apply, donate, buy,
  search, read.
- **Forms**: submit valid, submit empty, submit invalid. Check the error messages, the
  success state, and that the submission actually arrived somewhere.
- **States**: empty, loading, error, and "lots of content". Empty and error states are where
  most bugs hide because nobody looks at them.
- **Mobile width** — not just a narrow desktop window; check tap targets and any nav drawer.
- **Console and network**: JS errors, 404s, failed requests, mixed content.
- **Back/forward and refresh** mid-flow — state that only works forwards is a real bug.

### WordPress

- **Logged out vs logged in.** The admin bar shifts layout, and capability-gated UI only
  appears for some roles. Test both.
- **`/wp-admin`**: the screens this work touches — post lists, editors, settings pages,
  custom post types, taxonomies.
- **Block editor**: insert the block, edit its attributes, save, reload, and confirm no
  "unexpected or invalid content" ([`wordpress-blocks`](../../wordpress-blocks/SKILL.md);
  `validate_blocks` via [`wp-studio-cli`](../../wp-studio-cli/SKILL.md)).
- **Content edge cases**: a very long title, a missing featured image, an unset optional
  field, a post with no terms.
- **Permalinks and 404s** — a template change can quietly break the 404 or archive views.
- **Caching** — on a hosted environment, flush object and page cache before concluding a fix
  didn't work.

### Cloudflare Workers / API projects

- Route behavior and status codes, error payload shape, auth boundaries, and what happens on
  a cold start. The browser matters less; the responses matter more.

## Diff-aware mode

On a feature branch with no URL given, scope from the change itself:

```bash
git diff --name-only $(git merge-base HEAD origin/main)...HEAD
```

Map files to surfaces before exploring:

| Changed | Test |
| --- | --- |
| `themes/*/templates/*`, `parts/*` | The pages using that template or part, logged out and in |
| `blocks/src/<block>/*` | Insert and edit the block, save, reload, then view it on the front end |
| `plugins/*/includes/*` | The admin screens and endpoints that code backs |
| `theme.json`, `style.scss` | Visual regression across a few representative pages |
| REST or API code | The endpoints directly, plus whatever consumes them |

## Report format

```markdown
## QA report — <scope> (<environment>)

**Tested:** <areas, URLs, viewports> · **Tier:** <quick|standard|exhaustive|report-only>

### Findings

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | Critical | Contact form submits but sends no email | Fixed — <commit> |
| 2 | Medium   | Validation error persists after correcting the field | Fixed — <commit> |
| 3 | Low      | Footer spacing differs from header | Not fixed (below tier) |

### 1. Contact form submits but sends no email
**Steps:** … **Expected:** … **Actual:** …
**Evidence:** <screenshot>, console error, failed request
**Cause:** … **Fix:** <commit> **Verified:** re-submitted, message received

### Not tested
- Member dashboard — no test account available
```

Always include the **Not tested** section, even when empty. An unreachable area silently
omitted reads as an area that passed.
