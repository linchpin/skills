#!/usr/bin/env bash
# PreToolUse hook for Bash: warn before destructive commands.
#
# Reads the tool-call JSON on stdin and, when the command matches a destructive
# pattern, returns permissionDecision "ask" so the user confirms before it runs.
# Anything else produces no output, which lets the command proceed normally.
#
# Fails OPEN by design: this is a safety net, not a security boundary. If parsing
# breaks or python3 is missing, work continues rather than the session wedging.
# Bash can always modify files another way (sed, redirects), so treat this as a
# speed bump on autopilot, not a sandbox.

set -uo pipefail

INPUT=$(cat 2>/dev/null || true)
[ -z "$INPUT" ] && exit 0
command -v python3 >/dev/null 2>&1 || exit 0

CMD=$(printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
print((data.get("tool_input") or {}).get("command", ""))
' 2>/dev/null || true)

[ -z "$CMD" ] && exit 0

# Build artifacts and dependency directories are safe to blow away.
if printf '%s' "$CMD" | grep -qE 'rm +(-[a-zA-Z]+ +)*(node_modules|vendor|dist|build|build-tools|\.next|\.turbo|\.cache|coverage|__pycache__)/?( |$)'; then
  exit 0
fi
# An explicit dry run is the safe form of search-replace.
if printf '%s' "$CMD" | grep -q 'search-replace' && printf '%s' "$CMD" | grep -q -- '--dry-run'; then
  exit 0
fi

REASON=""
match() { printf '%s' "$CMD" | grep -qiE "$1"; }

# --- WordPress / WP-CLI ------------------------------------------------------
if   match 'wp +db +(drop|reset)';            then REASON="\`wp db drop/reset\` destroys the entire database."
elif match 'wp +db +import';                  then REASON="\`wp db import\` overwrites the current database."
elif match 'wp +search-replace';              then REASON="\`wp search-replace\` rewrites the database in place. Run it with --dry-run first."
elif match 'wp +site +empty';                 then REASON="\`wp site empty\` deletes all site content."
elif match 'wp +(post|user|term|comment) +delete'; then REASON="This deletes content permanently, especially with --force."
elif match 'wp +plugin +uninstall';           then REASON="\`wp plugin uninstall\` removes the plugin and its data."
elif match 'wp +option +(delete|update) +(home|siteurl)'; then REASON="Changing home/siteurl can take the site offline."
# --- Databases ---------------------------------------------------------------
elif match 'drop +(table|database)';          then REASON="DROP removes the table or database and its data."
elif match 'truncate +(table +)?[a-z_]';      then REASON="TRUNCATE empties the table irreversibly."
elif match 'delete +from +[a-z_]+ *(;|$)';    then REASON="DELETE FROM with no WHERE clause removes every row."
# --- Git ---------------------------------------------------------------------
elif match 'git +push +.*(--force|-f)( |$)';  then REASON="Force-push rewrites remote history and can destroy others' commits. Prefer --force-with-lease."
elif match 'git +reset +--hard';              then REASON="\`git reset --hard\` discards uncommitted work permanently."
elif match 'git +(checkout|restore) +\.( |$)';then REASON="This discards all uncommitted changes in the working tree."
elif match 'git +clean +-[a-z]*[fd]';         then REASON="\`git clean\` deletes untracked files, including ones never committed."
elif match 'git +branch +-D';                 then REASON="Force-deleting a branch can lose unmerged commits."
# --- Filesystem / infra ------------------------------------------------------
elif match 'rm +(-[a-zA-Z]+ +)*-?[a-zA-Z]*r[a-zA-Z]*f|rm +-rf|rm +-fr'; then REASON="Recursive force delete."
elif match 'kubectl +delete';                 then REASON="This removes live Kubernetes resources."
elif match 'docker +(rm +-f|system +prune)';  then REASON="This removes containers, images, or volumes."
elif match 'ssh .*(wp |mysql )';              then REASON="This runs a data-affecting command on a remote server."
fi

[ -z "$REASON" ] && exit 0

python3 -c '
import json, sys
reason = sys.argv[1]
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "ask",
        "permissionDecisionReason": "Destructive command: " + reason + " Confirm you intend to run this, and that it is pointed at the environment you think it is."
    }
}))
' "$REASON"
exit 0
