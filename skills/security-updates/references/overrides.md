# Overrides and conflict floors — the recipe

The detail behind step 4 of `SKILL.md`: how a transitive fix is written, where it goes, how it
fails, and when it comes out. Most advisories on a Linchpin repo are **transitive**. The
vulnerable package sits three levels down and nothing in `package.json` names it, so the fix
has to name it for the first time.

## Why the manifest and never the lock file

A lockfile-only fix works on the day it lands and then stops being anyone's decision.

- **It is invisible in review.** The change is a few hundred lines of lock churn. Nobody can
  tell from the diff that a security floor exists.
- **The manifest still allows the vulnerable version.** The parent's range admits it. A lock
  taken from the wrong side of a merge conflict, or a dedupe that settles on a shared lower
  version, brings it back with no signal.
- **Both bots produce exactly this by default.** Dependabot's security PRs only ever edit the
  lock file. Measured on `mantle` in September 2026, eight of ten open ones were already moot
  by the time anyone looked. Renovate's `vulnerabilityAlerts` defaults to
  `rangeStrategy: "update-lockfile"`, so its `[SECURITY]` PRs are lockfile-only too whenever
  the range already admits the fix. [`repo-settings.md`](repo-settings.md) sets it to `bump`.

An override or a `conflict` entry is a line in the manifest that says *this version, because of
this advisory*. Renovate then tracks it like any other dependency.

## npm — the scoped override

```json
"overrides": {
	"sockjs": { "uuid": "^11.1.1" }
}
```

What keeps it surgical:

- **Name the parent.** The parent is the package whose own range admits the vulnerable
  version, which `npm explain <pkg>` shows. A bare `"uuid": "^11.1.1"` rewrites every copy in
  the tree, including ones that were never vulnerable and ones on a different major for a
  reason. The nested form touches only that parent's subtree.
- **One entry per parent.** If two parents bring in the vulnerable copy, each gets its own
  nested entry. Don't collapse them into a bare one.
- **A `^` range of the first patched version.** Never a pin, because an exact version stops
  Renovate moving it, and pins are a documented cause of stuck security PRs. Never latest
  either. The advisory for `uuid` (CVE-2026-41907) is fixed in 11.1.1, so the entry is
  `^11.1.1`. Entries written as `^14.0.2` cross three majors past `sockjs`'s own `^8.3.2`
  for no advisory's sake.
- **Sometimes the parent itself is what's stuck.** `markdownlint-cli` pinned an old
  `minimatch` *and* an old `markdown-it`. Overriding `markdownlint-cli` to `^0.49.1` cleared
  three advisories in one entry, on a combination upstream actually ships. Reaching inside it
  (`"markdownlint-cli": { "minimatch": … }`) fixed the same advisory but emitted a lock file
  `npm ci` rejected. When a newer parent release fixes the chain, aim at the parent.
- **A package you also declare directly** has to be referenced as `"$<pkg>"` in the override,
  or npm refuses with `EOVERRIDE`. That rule belongs to
  [`wp-plugin-dependency-audit`](../../wp-plugin-dependency-audit/SKILL.md).

### Where the entry goes

npm reads `overrides` **only from the root `package.json`** of an install. If the repo uses
`workspaces`, every entry goes in the root, and one in a workspace's `package.json` does
nothing. If the repo has a second, separate npm project with its own lock file (a `blocks/`
build, for instance), that project is a root too and needs its own copy. In October 2026,
`linchpin-blocks` carried the `sockjs → uuid` override at the root only, and the `uuid` alert
stayed open against `blocks/package-lock.json`.

### Applying it — and the silent failure

```bash
npm install          # writes the override into the lock
npm ls <pkg>         # every copy under that parent at or above the patched version?
npm ci               # the lock is consistent with package.json (EUSAGE if not)
npm audit            # the advisory is gone
```

npm does **not** re-resolve a nested entry that is already locked, so a newly added override
can do nothing at all. On `mantle`'s `blocks/` project, four of five took and one silently
didn't. If `npm ls` still shows a vulnerable copy, regenerate the lock file for that root with
the tool. Never edit it by hand. Say so in the PR, because the lock diff will be broader than
one package.

### Renovate keeps it current

Renovate's npm manager extracts `overrides` **recursively** and tracks each entry as its own
dependency with `depType: "overrides"` (`lib/modules/manager/npm/extract/common/overrides.ts`
upstream). On `mantle`'s Dependency Dashboard the `sockjs → uuid` entry is listed with its
next update queued. So an override never needs reapplying after a build, and bumps arrive as
ordinary PRs — each its own, never automerged, under the shared preset
([`repo-settings.md`](repo-settings.md)).

**One blind spot.** Renovate reads an override's locked version only from the top-level
`node_modules/<name>` lock entry. When npm nests the overridden copy under its parent, because
another copy of the same package sits at the top level, Renovate assumes the newest version the
override's range allows. It then raises nothing for a fix that range already admits, and the
alert stays open. Don't wait for lock-file maintenance to clear it: raise the override's floor
to the patched version by hand, the same way you added it.

## Composer — the `conflict` floor

Composer has no `overrides`, and doesn't need one: the root `composer.json` already wins over
every transitive constraint. Ban the vulnerable range:

```json
"conflict": { "vendor/pkg": "<1.2.3" }
```

```bash
composer update vendor/pkg --with-all-dependencies
composer audit
```

Prefer this to adding the package to `require`. It claims no direct dependency, and it is a
floor rather than a pin, so the solver takes any newer version and Renovate has nothing to
bump. It is the mechanism `roave/security-advisories` is built from.

If the parent's constraint can't reach the patched version, the update fails to resolve. Then
the parent is what has to move: update it through
[`dependency-updates`](../../dependency-updates/SKILL.md), or stop per the skill's guardrails.

## Retiring an entry

An override comes out when **the parent's own declared range no longer admits the vulnerable
version**, or when the parent has left the tree.

`linchpin/actions`' `check-overrides` reusable workflow finds the candidates: it removes each
entry from a scratch manifest, re-resolves the lock, and reports *still needed*, *redundant*
(the tree already resolves a safe version without it) or *dangling* (the package has left the
tree). *Dangling* can come out. *Redundant* is only a candidate, because a lock file that
happens to resolve high today is exactly what this standard does not rely on. Apply the test
below before removing one.

```bash
npm ls <parent>                                        # still here, and at what version?
npm view <parent>@<installed version> dependencies.<pkg>   # its own range for the package
```

If that range's floor is at or above the patched version, delete the entry, run `npm install`,
then repeat the four checks above. A clean `npm audit` with the entry gone is the proof.

For a Composer floor, `composer why vendor/pkg` lists every constraint on the package. When
none of them admits the vulnerable range any more, the `conflict` entry is redundant and can
go.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| `npm ci` fails with `EUSAGE`, lock out of sync | The override changed resolution and the lock was not regenerated cleanly | Regenerate the lock for that root with the tool |
| `npm audit` still lists the advisory | A locked nested entry wasn't re-resolved, or a second parent brings it in | `npm explain <pkg>`; add the missing parent, or regenerate the lock |
| Alert still open after merge | Another root's lock file (`blocks/`) still has the copy | Add the entry in that root |
| `EOVERRIDE` | The override clashes with a direct dependency's spec | Reference it as `"$<pkg>"` |
| The parent breaks at build or runtime | The override crossed the parent's major | Stop: replace the parent, wait for upstream, or document the risk on the alert |
