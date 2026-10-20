# Repo settings — making the standard the default

Five settings decide whether a repo follows the standard without anyone remembering it. Check
all of them whenever this skill runs on a repo, and report every one that differs. Change them
only with the user's go-ahead, because each one changes what a bot does from then on.

| Setting | Expected | Check | Change |
| --- | --- | --- | --- |
| Dependabot alerts (and the dependency graph) | **On** | `gh api repos/<owner>/<repo>/vulnerability-alerts` returns 204. A 404 means off | `gh api -X PUT repos/<owner>/<repo>/vulnerability-alerts` |
| Dependabot security updates (the PR opener) | **Off** | `gh api repos/<owner>/<repo>/automated-security-fixes` returns `"enabled": false` | `gh api -X DELETE repos/<owner>/<repo>/automated-security-fixes` |
| `.github/dependabot.yml` | Absent, or version updates only with `open-pull-requests-limit: 0` | Read it | Remove `applies-to: security-updates` groups and comments claiming the file routes security fixes |
| Renovate's security behaviour | Inherited from the shared preset | `renovate.json` → `extends` names `github>linchpin/renovatebot-config` or `:automerge`, and nothing local undoes it | Move the repo onto the preset; [below](#renovate) |
| A base branch Renovate processes | The default branch is in `baseBranchPatterns` (or `baseBranches`) | The resolved `baseBranchPatterns`, preset included | [below](#base-branches) |

The first two are repository settings, not files, so a repo can't carry them in a PR. If the
organisation has a GitHub **code security configuration** attached to the repo,
`gh api repos/<owner>/<repo>/code-security-configuration` names it; a bare 204 means none is
attached. That is the org-wide way to
enforce both, and the right fix when many repos drift at once. Creating or attaching one needs
an organisation admin or security manager, so report it rather than attempting it.

## Why alerts on and PRs off

**Alerts are the signal, for both bots.** Renovate's `vulnerabilityAlerts` reads GitHub's
Dependabot alerts. It needs the dependency graph and Dependabot alerts enabled, and in app
mode, `read` access to Dependabot alerts. Turning alerts off doesn't quiet Dependabot. It
blinds Renovate too, and the Security tab stops being a list of what's open.

**Dependabot's security PRs only ever edit the lock file.** That is the fix this standard
rejects, so the PRs are noise that sits open and goes stale. Switching off the opener leaves
the alerts exactly as they were.

**`open-pull-requests-limit: 0` does not stop them.** GitHub states that security update PRs
"are subject to a separate, fixed limit of 10 open pull requests, which cannot be configured
using `open-pull-requests-limit`". A `dependabot.yml` that sets the limit to 0 and groups
security updates still gets security PRs if the repo setting is on, so the repo setting is
the switch. A file whose comments say it routes security fixes to Dependabot describes a
split this standard no longer uses.

## Renovate

The shared preset, [`linchpin/renovatebot-config`](https://github.com/linchpin/renovatebot-config),
owns this configuration — its README's *Security fixes* section is the reference, and this
file does not restate its rules. What it gives a repo that extends `github>linchpin/renovatebot-config`
or `github>linchpin/renovatebot-config:automerge`:

- **`vulnerabilityAlerts.rangeStrategy: "bump"`**, so a security fix moves the manifest range
  or the override value. Renovate's own default, `update-lockfile`, edits only the lock file
  whenever the declared range already admits the fix — the same change we switched Dependabot
  off for.
- **Every `overrides` update as its own PR**, labelled `overrides`, never automerged. The
  `automerge` preset restates the rule after its own non-major automerge rule, because
  `packageRules` are applied in order and a later match wins.

Two things a consuming repo can still get wrong:

- **It extends only `config:recommended`.** Then none of the above applies. Moving it onto
  the shared preset is the fix; it also changes grouping and routing, so propose it as its own
  change rather than inside a security fix.
- **Its own `packageRules` undo the preset.** A repo's rules are applied after every preset's,
  so a local rule that automerges all npm minors and patches automerges override bumps again.
  Exclude overrides from that rule, or repeat the preset's `overrides` rule after it. Likewise
  `"vulnerabilityAlerts": { "enabled": false }` switches Renovate's security PRs off entirely.

### Base branches

Renovate's security PRs skip schedules and PR limits, but not base branches. The default preset
targets only `maintenance/*`, so a repo with no open window gets no fixes from Renovate at all.
The preset README explains how the `maintenance-window` add-on interacts with this. Check the
resolved `baseBranchPatterns` before relying on Renovate to raise a fix, and when it can't,
make the fix by hand through the skill's procedure.
