# Transitive advisories — the recipe

The procedure behind `SKILL.md`'s *Transitive advisories* section: refresh first, override
second. Most advisories on a Linchpin repo are **transitive** — the vulnerable package sits
three levels down and nothing in `package.json` names it — and there are only two ways to move
one. Trying them out of order is what produces the endless bot PRs.

**1. Let the lock file refresh reach it.** This works whenever the parent's range already
allows the patched version — the majority of cases. Renovate's `lockFileMaintenance` does it
on a schedule; `npm update --package-lock-only` does it locally. Measured on `mantle` in
September 2026, a plain refresh took the root workspace from 21 advisories to 14.

**A lockfile-only PR can never do more than this.** That is why Dependabot's *security
updates* are switched off on repos Renovate owns: they edit `package-lock.json`, the one file
`lockFileMaintenance` already rewrites, so they land stale and sit open. Of the ten open on
`mantle`, eight were already moot: seven proposed a version `main` had, and one targeted a
package no longer in the tree. The two that were real were both reachable by a plain
refresh. Dependabot **alerts stay on** — Renovate's
`vulnerabilityAlerts` and `osvVulnerabilityAlerts` read the same GitHub advisory feed, so no
coverage is lost. Disable only the PR opener:

```bash
gh api -X DELETE repos/linchpin/<repo>/automated-security-fixes   # alerts unaffected
```

**2. Override the one package that is stuck.** Only when a parent's range *pins* the
vulnerable version can no refresh reach it. Then add a **scoped** entry to `package.json`:

```json
"overrides": {
	"express": { "qs": "^6.16.0" }
}
```

What keeps it surgical rather than blunt:

- **Name the parent.** A bare `"qs": "^6.16.0"` rewrites every copy of `qs` in the tree,
  including ones that were never vulnerable. The nested form touches only the stuck one.
- **Aim at whichever package is actually stuck — sometimes that is the parent itself.**
  `markdownlint-cli` pinned both an old `minimatch` and an old `markdown-it`; overriding
  `markdownlint-cli` to `^0.49.1` cleared three advisories in one entry and landed on a
  combination upstream actually ships. Reaching inside it fixed the same advisory but emitted
  a lock file `npm ci` rejected.
- **Use a range, not a pin** — `^6.16.0`, never `6.16.0`. A hard pin blocks Renovate's own
  updates later and is a documented cause of stuck security PRs.
- **Minimum version that clears the advisory**, not latest. The entry then documents itself.
- **One entry per advisory, in every workspace the repo has** — a second `package.json`
  (`blocks/`) needs its own copy.

Renovate extracts nested overrides **recursively** and tracks each as a real dependency, so
an entry stays current on its own and **never needs reapplying after a build**. Give them a
`packageRules` group that does **not** automerge — bumping an override can break the parent
that pinned it, so each one earns a changelog read.

**Verify, because both failure modes are silent:**

```bash
npm ci      # a bad override desyncs the lock file (EUSAGE) — otherwise CI finds it, not you
npm audit   # confirms the override actually took
```

npm does **not** re-resolve an already-locked nested entry on `npm install`, so a newly added
override can quietly do nothing. On `mantle`'s `blocks/` workspace four of five took and one
silently didn't. Regenerating the lock file is the fix.

**An override is a liability, not a fix.** Each one is a promise to re-check the parent. When
the parent ships the fix itself, **delete the entry** rather than bumping it — `npm audit`
staying clean after removal is the proof.

## Composer has no `overrides`

The root `composer.json` already wins over any transitive constraint, so the equivalent is a
root `conflict` entry banning the vulnerable range:

```json
"conflict": { "vendor/pkg": "<1.2.3" }
```

Prefer this to adding the package to `require`: it claims no direct dependency, and it is a
floor rather than a pin, so the solver takes any newer version and there is nothing for
Renovate to bump. It is the mechanism `roave/security-advisories` is built entirely from.
