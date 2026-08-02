# `.clickup.json` — per-project ClickUp routing

A small file at a project's repo root that pins **where this project's tasks live**, so
creating one is a single confirmation instead of a workspace-hierarchy crawl across dozens of
spaces.

The **convention** is portable and lives here. The **IDs** are project-specific and live in
that project's repo — never in this library.

## Why it exists

Without it, every "create a task for X" starts the same way: call
`clickup_get_workspace_hierarchy`, guess the Space from the repo name, page through folders,
and rediscover the same handful of list IDs that were found last week. That's slow, it burns
context, and it produces inconsistent placement when the guess is wrong.

With it, the flow is: read the file, confirm the list in one line, create.

## Where to look

Check in this order, and stop at the first hit:

1. `.clickup.json` at the repo root
2. A ClickUp section in the project's `CLAUDE.md` / `AGENTS.md`
3. Nothing pinned → fall back to the hierarchy lookup in the main skill, and **offer to write
   `.clickup.json`** once the list has been resolved, so the next agent doesn't repeat the work

## Schema

Every field is optional except `space` and `defaultList` — a two-key file is already useful.

| Key | Type | Purpose |
| --- | --- | --- |
| `space` | object | `id`, `name`, and `customIdPrefix` (e.g. `MANTLE` — the prefix on custom IDs, used to sanity-check a key before putting it in a commit scope) |
| `defaultList` | object | `id`, `name`, `path`, and a `use` string saying what belongs there. The fallback for anything that doesn't route elsewhere |
| `lists` | object | Human list name → list id. Flat map; use `›` in the name for nesting when two lists share a name |
| `folders` | object | Human folder name → folder id. Only needed when a tool call wants a folder rather than a list |
| `moduleRouting` | object | Source directory → list **name** (a key in `lists`). For repos whose board mirrors their code structure |
| `unmapped` | object | Deliberate code↔board mismatches, recorded so they read as intentional rather than as failed lookups |

Two rules that matter more than the shape:

- **IDs are the contract; names are for humans.** ClickUp list names get renamed freely and
  the id survives it. Route on the id, show the name.
- **`moduleRouting` points at names, not ids** — so a renamed list is a one-line fix in
  `lists` rather than a find-and-replace through the routing map.

## Example

Trimmed from a real plugin repo whose ClickUp board has one list per code module:

```json
{
  "$comment": "ClickUp routing for this repo. IDs are workspace-stable; names are for humans.",
  "space": {
    "id": "90140515528",
    "name": "Mantle",
    "customIdPrefix": "MANTLE"
  },
  "defaultList": {
    "id": "901401607739",
    "name": "Product Roadmap",
    "path": "Mantle › Product Roadmap",
    "use": "Cross-cutting work, new modules, and anything that doesn't map to a single existing module."
  },
  "lists": {
    "Product Roadmap": "901401607739",
    "Housekeeping": "901414301271",
    "Optimizations": "901413938412",
    "Security": "901413938417",
    "Declutter": "901413954051"
  },
  "folders": {
    "Modules": "90147467026"
  },
  "moduleRouting": {
    "$comment": "includes/Modules/<Dir> → list name. Fall back to defaultList.",
    "Optimizations": "Optimizations",
    "Security": "Security"
  },
  "unmapped": {
    "modulesWithoutList": [
      "Maintenance — no dedicated list; use Product Roadmap"
    ],
    "listsWithoutModule": [
      "Declutter — intended home for admin-menu tidying; no module exists yet"
    ]
  }
}
```

`$comment` keys are ignored by every JSON parser and are the only way to annotate JSON —
use them, since this file is read by people as often as by agents.

## `unmapped` is the part people skip

A board and a codebase drift apart. A list gets created for work that was never built; a
module ships without anyone adding a list for it. An agent that finds no route for
`includes/Modules/Maintenance` can't tell "nobody added it" from "I looked in the wrong
place", so it either asks a pointless question or files the task somewhere wrong.

Recording the mismatch converts a lookup failure into a documented decision. Keep it honest
and prune it when the gap closes.

## Packaging

Projects that build a distributable — WordPress plugins and themes especially — should
exclude the file from the build:

- `.distignore` for `wp dist-archive` / plugin zips
- `.npmignore` or a `files` allowlist for npm packages

It's dev-time metadata with no runtime meaning. It contains no secrets — workspace, folder,
and list IDs are not credentials, and the ClickUp API still requires a token — so it can be
committed to a private repo without concern. Treat it the same as any other project config
in a public repo: harmless, but pointless to publish.

## Keeping it current

- A renamed list keeps its id — nothing to do.
- A **new** list, or one that gets retired, needs the map updated. Cheapest moment is when
  you notice the drift while creating a task; fix it in the same PR.
- If a lookup by the pinned id fails, the list was deleted or moved out of the space. Re-run
  the hierarchy lookup, correct the file, and say so — don't silently fall back to the
  default list, or tasks quietly pile up in the wrong place.
