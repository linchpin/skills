# Triaging the inventory

`scripts/audit-deps.mjs` prints one section per decision. Work through them in this order.
Every row needs a decision (remove, declare, replace, keep) and a reason in the PR.

Confirm any removal first:

```bash
git grep -n '<package>' -- ':!*lock*' ':!CHANGELOG.md'   # any mention outside lockfiles
npm ls <package>                                         # who else installs it, at what version
composer why <vendor/package>                            # who else requires it
```

## npm sections

| Section | Means | Check before acting | Usual decision |
| --- | --- | --- | --- |
| **No reference found** | Declared, but no import, config string, CLI use, peer, or convention names it | `git grep`; reusable workflows (`uses: linchpin/actions/…`); docs that tell people to run it | Remove |
| **Provided by another dependency, never referenced directly** | Something we already depend on installs it | `npm ls <pkg>` shows the provider's copy; the provider's range is one you are happy with | Remove; the provider owns the version |
| **Needed only as a CLI or a peer, and another dependency already provides it** | We run its binary or a package names it as a peer, and a provider installs it anyway | Whether you rely on a specific major (a config format, a CLI flag) | Remove when the provider's version is fine; keep and say why when it isn't |
| **Imported but not declared** | Code imports it but it only resolves through hoisting, a parent root, or not at all | The *Installed* column: `transitively` and `via …/node_modules` work by accident; **not installed** works only because the build externalizes it, and fails in tests and lint | Declare it at the range already installed (`npm install <pkg>@^<installed>`); externalized ones cost nothing |
| **Imports that make WordPress enqueue a heavy core script** | `lodash`, `moment` or `jquery` imported in shipping code | What the code actually uses from it | Replace (see `replacements.md`) |
| **Bundled into the build** | Third-party code that ships in the zip | Each one against `replacements.md` — WordPress may already ship an equivalent | Review; replace where WordPress covers it |
| **Overrides** | An override npm will refuse (`EOVERRIDE`) | — | Change the value to `"$<pkg>"` |
| `jest-on-retired-preset` | Jest stack on wp-scripts 36+ | — | Migrate, in its own commit: `jest-to-vitest.md` |
| `test-unit-js-before-36` | `test-unit-js` silently becomes Vitest at 36 | — | Plan the migration with the wp-scripts upgrade |
| `alias-into-node-modules` | A webpack alias to a path inside `node_modules` | Why it was added (`git log -S`); whether the duplicate it worked around still exists (`npm ls <pkg>`) | Delete it, rebuild, compare bundle sizes |

**Kept** is collapsed, with the reason each package stayed. Skim it for reasons that look
wrong. A package kept only because a config string mentions it may be a stale config entry.

## Composer sections

| Section | Means | Check before acting | Usual decision |
| --- | --- | --- | --- |
| **No reference found** | No namespace use, `vendor/<pkg>` path, CLI, tool config or convention | `git grep`; `.wp-env.json` and Playground blueprints that map `vendor/…` plugins; CI steps | Remove |
| **Provided by another dependency** | Another declared package requires it and nothing uses it directly | `composer why <pkg>` | Remove |
| **Used only as a CLI or tool another dependency already requires** | We run its binary, and a shared standard or extension requires it anyway | Whether you depend on its major (`phpstan` levels, PHPUnit versions) | Remove the duplicates a shared standard owns; keep the tool you configure directly |
| **Runtime packages that execute on load** | `require` packages whose `autoload.files` run on every request, and WP-CLI packages | **Read the file.** What does it register: commands, hooks, globals? | Keep only what the plugin means to ship. A bundled WP-CLI package registers its commands on every client site |
| **Locked release older than N years, or abandoned** | The locked version's release date (offline) | Run `--registry`: is there a newer release? | Stale is not the same as unsafe; see below |

## Registry section (`--registry`)

`npm view` and Packagist report the **latest** release, deprecation and abandonment. For a
stale package:

1. Is it **finished** or **dead**? Some small, stable packages simply don't change. Count the
   open issues and maintainers, and check whether it breaks on current Node, PHP or WordPress.
2. Does WordPress or an existing dependency already cover the need? See `replacements.md`.
3. If neither, keep it and record why in the PR. Don't port it into the plugin; that only
   moves the maintenance onto us.

A `deprecated` npm message or Packagist `abandoned` flag usually names its replacement. Use it.
