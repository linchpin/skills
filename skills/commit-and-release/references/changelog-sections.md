# Type → changelog behavior

Configured per repo; the common shape:

| Types | Effect |
| --- | --- |
| `feat`, `feature` | Features section; minor bump (pre-1.0 config may bump patch) |
| `fix` | Bug Fixes section; patch bump |
| `improve`, `tweak`, `refactor` | "Changes to Existing Features" section |
| `docs`, `build`, `ci` | Usually hidden from the changelog |
| `chore`, `style`, `test`, `perf`, `revert` | Their own sections |
| any type with `!` or `BREAKING CHANGE:` | Major bump |

A type missing from `changelog-sections` still commits fine but may never surface in a
release note — pick the type that reflects what actually changed.
