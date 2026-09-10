# MCP scoping — which servers a project needs, and where to put them

An MCP server's cost is its **tool schemas**, loaded before the first message. A handful of
servers outweighs the entire skills library. Servers are also the easier mistake to make:
adding one is a single command, and the default scope makes it apply beyond the repo you
were in.

## Scopes

`claude mcp add` defaults to **`local`** — private to you, tied to the current project.
That default is fine for experiments and wrong for anything a teammate also needs.

| Scope | Stored in | Applies to | Shared? | Use for |
| --- | --- | --- | --- | --- |
| `local` (default) | `~/.claude.json`, under this project | This repo, you only | No | Trying a server out; personal credentials |
| `project` | `.mcp.json` in the repo root | This repo, everyone | **Yes, via git** | The servers the repo's work actually needs |
| `user` | `~/.claude.json`, top level | **Every** repo you open | No | Only genuinely universal servers |

Precedence when a name appears more than once: `local` > `project` > `user`.

```bash
claude mcp list                                  # what is configured, and where
claude mcp get <name>                            # one server's details
claude mcp add <name> -s project -- <command>    # committed, shared with the repo
claude mcp remove <name> -s user                 # prune from the global scope
```

`.mcp.json` servers are approval-gated on first encounter — a repo cannot silently run a
server on someone's machine. Approvals are recorded per project in `~/.claude.json`
(`enabledMcpjsonServers` / `disabledMcpjsonServers`).

**Prefer `project`.** It travels with the repo, documents itself, and disappears when you
leave the directory. `user` scope is where sprawl accumulates, because nothing about
working in an unrelated repo ever reminds you it is there.

## Which skills need which servers

Removing a server can silently disable a skill. Check here before pruning.

| Skill | Needs | Degrades to |
| --- | --- | --- |
| [`task-tracking`](../../task-tracking/SKILL.md) | `clickup` | Manual task lookup; `NO-TASK` scope |
| [`wp-studio-cli`](../../wp-studio-cli/SKILL.md) | `wordpress-studio` | The `studio` CLI |
| [`browser-automation`](../../browser-automation/SKILL.md) | `chrome-devtools` | Playwright headless |
| [`wp-pressable`](../../wp-pressable/SKILL.md) | `pressable`, `1password` | SSH + WP-CLI, manual credentials |
| [`design-previews`](../../design-previews/SKILL.md) | `chrome-devtools` | Playwright headless |
| [`wp-audit`](../../wp-audit/SKILL.md) | `chrome-devtools` | Lighthouse CLI |
| [`web-qa`](../../web-qa/SKILL.md) | via `browser-automation` | as above |

Every one of these has a fallback, which is the point: a missing server is a slower path,
not a broken one. That makes pruning safer than it feels — but say what you pruned.

## Deciding the set

Derive from the work, not from what is already configured. Ask what this repo's tasks
actually touch.

| Server | Include when |
| --- | --- |
| `clickup` | Always — every unit of work routes through it (house rule) |
| `chrome-devtools` | The repo has a UI someone looks at |
| `wordpress-studio` | WordPress site repo with a registered Studio site |
| `pressable` + `1password` | Pressable-hosted, and you operate the server |
| `figma` | There is a Figma file in play for this project |
| `playwright` | Scripted or CI browser runs — not needed alongside `chrome-devtools` for ad-hoc QA |
| `shadcn` | React project using shadcn/ui — never on a WordPress repo |
| `shopify-dev-mcp` | Shopify project |

Then read it back against the repo's shape ([`project-context`](../../project-context/SKILL.md)):

- **WordPress site repo, Pressable-hosted** — `clickup` (user) + `wordpress-studio`,
  `pressable`, `chrome-devtools` (project). `1password` local, since credentials are personal.
- **WordPress plugin/product repo** — `clickup` + `wordpress-studio`. No `pressable`; the
  repo does not own a server.
- **Cloudflare Workers service** — `clickup`, and `chrome-devtools` only if it serves a UI.
  No WordPress servers at all.
- **Design-phase project** — `clickup`, `figma`, `chrome-devtools`. Add the WordPress set
  when build starts, not before.

A server that is not on the list for this repo's shape is one you are paying for in every
session and using in none.

## Migrating a sprawling global set

Servers accumulate at `user` scope because that is where they got added first. Moving them
is mechanical:

1. `claude mcp list` — write down what is at `user` scope.
2. For each, name the repos that actually use it. If it is more than "all of them", it does
   not belong at `user`.
3. `claude mcp remove <name> -s user`, then `claude mcp add <name> -s project -- …` in each
   repo that needs it.
4. Commit each repo's `.mcp.json` so the next person inherits the decision.

Do this per server, verifying as you go — not as one sweep. A server you remove and forget
to re-add somewhere shows up as a skill mysteriously taking the slow path weeks later.
