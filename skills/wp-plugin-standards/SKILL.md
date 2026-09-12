---
name: wp-plugin-standards
description: The canonical shape of a Linchpin-owned WordPress plugin repo — the files and plugin-header fields it must carry, the composer scripts its CI depends on, and which `linchpin/actions@v4` reusable workflows it should call — plus the audit that reports where a repo falls short. Use when setting up a new plugin repo, when asked "is this plugin set up right" or "what is this repo missing", when a repo hand-rolls a workflow linchpin/actions already provides, when CI fails because `php-lint` or `check-branch-cs` is not defined, or when a plugin repo is still pinned to @v3. Not for running the gates — use `quality-gates`.
when_to_use: Also when someone says a plugin repo is inconsistent with mantle, asks which workflows a plugin needs, asks whether it needs readme.txt, .distignore, or a build script, or asks what changes when a plugin ships to WordPress.org versus packagist.linchpin.com.
version: 1.0.0
allowed-tools: Read Grep Glob Bash(git ls-files*) Bash(gh search code*) Bash(gh api repos/*)
---

# Linchpin plugin repo standard

A plugin repo is conformant when its CI **is** the shared pipeline rather than a local copy
of it. That distinction is invisible in every listing — a repo with its own
`plugin-check.yml` and a repo calling `plugin-check.yml@v4` have the same filename — which
is why shallow adoption survives for years. This skill makes the difference legible.

It reports. It never fixes, and it never sequences.

## When to use

- Standing up a new Linchpin-owned plugin repo, or reviewing one someone else set up.
- Asked what a plugin repo is missing, or why it doesn't match `mantle`.
- A caller workflow fails at startup, or on a composer script that isn't defined.
- A plugin repo still pins `@v3`, `@main`, or `@master`.
- Before a plugin's first release on a new distribution channel.

**Not this skill:** running a gate, reading its output, or deciding a finding's fate —
[`quality-gates`](../quality-gates/SKILL.md) owns which gates exist, how to run them, and
the entire Plugin Check story. This skill asks only whether the repo *declares* the gate and
wires it to the reusable workflow; it never runs one. Auditing a running **site** for
performance or accessibility — [`wp-audit`](../wp-audit/SKILL.md). Creating the repo and its
deploy wiring — [`github-repo-setup`](../github-repo-setup/SKILL.md). Writing the plugin's
code — upstream `wp-plugin-development`. Closing the gaps in stages on a shipped plugin —
[`wp-plugin-modernization`](../wp-plugin-modernization/SKILL.md).

## Owns

Canonical for: **what a Linchpin-owned WordPress plugin repository must contain** — its
plugin-header fields, the composer scripts its CI callers require, its build and
distribution artifacts — **which `linchpin/actions@v4` reusable workflows it calls and the
caller-side contract each one imposes**, and **the conformance audit** that compares a repo
against that list and reports the deltas.

One rule governs every row: **this skill owns that the row exists; the skill named beside it
owns the row's value.** A second copy of a value here would drift from the first.

Defers:

- Running any gate, reading its output, or deciding a finding's fate →
  [`quality-gates`](../quality-gates/SKILL.md).
- What a reusable workflow's *inputs* mean → the
  [`linchpin/actions`](https://github.com/linchpin/actions) README, which is canonical and
  versioned with the workflows.
- Closing the deltas in stages on a shipped plugin →
  [`wp-plugin-modernization`](../wp-plugin-modernization/SKILL.md).
- Creating the repo, its environments, secrets and variables →
  [`github-repo-setup`](../github-repo-setup/SKILL.md).
- How to *write* the plugin — hooks, activation, Settings API, security, packaging →
  upstream `wp-plugin-development`.
- Commit, PR and release grammar → [`commit-and-release`](../commit-and-release/SKILL.md).
  Renovate and dependency policy → [`dependency-updates`](../dependency-updates/SKILL.md).
  Publishing docs → [`docspress-publish`](../docspress-publish/SKILL.md).
  The task and branch → [`task-tracking`](../task-tracking/SKILL.md).

## Preflight — classify before you audit

General project identification is [`project-context`](../project-context/SKILL.md); these
are the plugin-specific additions. **The distribution channel decides which rows are
failures**, so establish it first — the same missing `readme.txt` is a blocking failure on
one channel and correct on another.

| Look for | Tells you | If missing |
| --- | --- | --- |
| A root `.php` file with a `Plugin Name:` header | It is a plugin repo, and that file is where every header row is audited | **Not a plugin.** A theme or `wp-content`-shaped repo runs `lint.yml`/`build.yml`, not this standard. Say so and stop |
| `readme.txt` with `Stable tag:` **and** `.wordpress-org/` | Ships to WordPress.org → the wp.org rows apply and `Update URI` is **forbidden** | Not a wp.org plugin — mark those rows not-applicable rather than failing them |
| Plugin header `Update URI:` | Self-hosted updates → Plugin Check's `plugin_updater` findings are expected, and wp.org is ruled out | No self-updater; the channel is decided by the rows above |
| `composer.json` `name`/`type`, a packagist.linchpin.com or SatisPress listing | Private distribution → no `readme.txt`, no `Update URI` required | **Ask which channel.** Never guess |
| `.github/workflows/` **filenames** | The migration axis. `php.yml` / `js.yml` / `plugin-check.yml` is the current shape; `phpcs.yml` + `phpcbf.yml` + `phplint.yml` + `wiki.yml` is pre-v4 | No workflows at all — every CI row is a gap |
| `uses: linchpin/actions/…` across `.github/workflows/` | Which reusables are actually called, and at what pin | Zero hits means **check for local reimplementation next** — an absent call is not an absent file |
| A repo-local workflow whose filename matches a v4 reusable | The reimplementation anti-pattern — conformant-looking, unmaintained | — |
| `composer.json` → `scripts.php-lint`, `.phpstan`, `.check-branch-cs` | Whether `php-checks.yml@v4` can be called **at all** | Missing → this is the prerequisite row. Recommending the workflow first makes CI red on arrival |
| `phpcs.xml.dist` (exact filename) | The PHPCS row. A bare `phpcs.xml` reads as *absent* to `quality-gates` and `project-context`, and silently wins over `.dist` | No standard configured — report it; never invent one |
| A `build.sh` build script **and** `.distignore` | Whether a distributable can be produced — `plugin-check.yml@v4` and every release asset need it | Missing → `plugin-check.yml@v4` cannot be called, whatever its inputs say |
| `.nvmrc`, or an explicit `node_version` in the plugin-check caller, plus `package-lock.json` | How Node resolves in CI. Without a lockfile, Node setup is skipped entirely | Report only when the build needs Node |
| `.linchpin.json` | Project metadata → [`project-context`](../project-context/SKILL.md) | A conformance row, not a blocker |

## Procedure — audit, report, stop

1. **Classify the repo and the channel.** Run the Preflight table; state the slug, the
   channel, and which row groups are exempt. → You can say *"this is a
   packagist.linchpin.com plugin; the wp.org rows do not apply"* before reading a checklist row.
2. **Inventory against [`references/conformance-checklist.md`](references/conformance-checklist.md)**,
   one pass. → Every row carries one of four verdicts: present / missing / wrong-shape /
   not-applicable-because-*channel*.
3. **Score the plugin header field by field**, reading actual values. Anchor the grep on the
   colon — `License` matches `License URI` and will report a field you do not have. → A field
   table with real values, every missing field named individually, never "headers incomplete".
4. **Check the caller contract before the caller.** Read `composer.json` scripts against
   [`references/workflow-callers.md`](references/workflow-callers.md). → For each reusable you
   intend to recommend, you can say the contract is met, or name the exact missing script.
5. **Classify every file in `.github/workflows/`** into exactly one of: calls a v4 reusable /
   calls a v3 reusable / **reimplements a reusable locally** / legitimately local
   (release-please, `sync-docs.yml`, a repo-specific job). Use
   `gh search code --owner linchpin "php-checks.yml@v4"` when you need a current reference
   implementation rather than a remembered one. → One labelled row per workflow file, with
   every local file whose name collides with a v4 reusable flagged at the top of the report.
6. **Check every pin.** `linchpin/actions` at `@v4`; third-party actions tagged or
   SHA-pinned, never `@master`/`@main`. → A list of every stale or floating `uses:`, with file
   and line.
7. **Write the report** to the template in the checklist reference — severity per finding, a
   one-sentence fix per finding, **no ordering**. → A report readable without opening the
   repo, with counts per severity and an explicit not-applicable section.
8. **Hand off to exactly one skill.** Nothing, or trivia → done. Needs sequencing on a
   shipped plugin → [`wp-plugin-modernization`](../wp-plugin-modernization/SKILL.md). A gate
   that should actually be *run* → [`quality-gates`](../quality-gates/SKILL.md). New repo with
   no wiring → [`github-repo-setup`](../github-repo-setup/SKILL.md). → The report's last line
   names one skill.

## Plugin Check appears in two skills on purpose

The row here is satisfied by a `plugin-check.yml` that calls
`linchpin/actions/.github/workflows/plugin-check.yml@v4` with a `build_dir` and
`build_command` that actually produce the distributable, plus a local
`composer run plugin-check`. Whether the plugin *passes*, what a warning means, whether a
finding may be excluded, and the rule that a green badge is not a passing check are all
[`quality-gates`](../quality-gates/SKILL.md). **A conformance audit never runs the check** —
it reports that the repo can.

The test, if you are unsure which side a question falls on:

> **If the answer changes when you run a command, it is `quality-gates`. If the answer
> changes when you edit a committed file, it is this skill.**

## Guardrails

- **Never fix findings while auditing.** The report is the deliverable; remediation is a
  separate, approved change.
- **Never restate a reusable workflow's inputs here.** The `linchpin/actions` README ships
  with the workflows and is canonical. A copy in this file is how `@v3` documentation
  outlived `@v3`.
- **Never recommend a workflow whose caller contract the repo cannot meet.** Adding
  `php-checks.yml@v4` to a repo with no `php-lint` script turns CI red on the first PR.
- **Never report a row the channel exempts** — `readme.txt` on a private plugin, or
  `Update URI` on a WordPress.org plugin, which wp.org forbids outright.
- **Never pin a plugin repo at `@v3`.** v3 is the site fleet's line: `php-checks.yml`,
  `plugin-check.yml` and `wp-version-checker.yml` **do not exist there**. `github-repo-setup`'s
  `@v3` default is a *site* default, and is correct for what it covers.
- **Never treat a green badge or a clean local `phpcs` as evidence the plugin passes** —
  [`quality-gates`](../quality-gates/SKILL.md) owns both rules.
- **Never touch environments, secrets, or variables** during an audit —
  [`github-repo-setup`](../github-repo-setup/SKILL.md).
- **Never edit `CHANGELOG.md`, a version, or a lockfile** — release-please owns the first two
  ([`commit-and-release`](../commit-and-release/SKILL.md)).
- If the repo isn't a plugin, or the channel can't be established, **stop and say which**
  rather than auditing against the wrong list.

## Done

- [ ] The distribution channel was named *before* auditing; exempt rows are marked
      not-applicable, not failed.
- [ ] Every checklist row has one of the four verdicts.
- [ ] Every plugin-header field was scored against its actual value, with the colon anchored.
- [ ] Every `.github/workflows/` file is classified, and any local reimplementation of a v4
      reusable is flagged first.
- [ ] Every `linchpin/actions` `uses:` checked for `@v4`; every third-party `uses:` checked
      for a pin.
- [ ] For each recommended reusable, its caller-side composer scripts and build script are
      named present or missing.
- [ ] The report carries severities and sequences nothing.
- [ ] Nothing in the repo changed.
- [ ] The report's last line names exactly one next skill.
