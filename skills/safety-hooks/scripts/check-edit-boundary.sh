#!/usr/bin/env bash
# PreToolUse hook for Edit/Write: block edits outside an allowed directory.
#
# Reads the tool-call JSON on stdin and denies the operation when the target file
# is outside the boundary recorded in the state file. With no state file, every
# edit is allowed — the boundary is opt-in per session.
#
# State file: $LINCHPIN_SAFETY_DIR/edit-boundary.txt (default ~/.claude/.linchpin-safety/)
#
# Fails OPEN: if parsing breaks, the edit proceeds. This prevents accidental edits
# to unrelated code; it is not a security boundary, since Bash can still write
# anywhere.

set -uo pipefail

STATE_DIR="${LINCHPIN_SAFETY_DIR:-$HOME/.claude/.linchpin-safety}"
BOUNDARY_FILE="$STATE_DIR/edit-boundary.txt"

[ -f "$BOUNDARY_FILE" ] || exit 0
BOUNDARY=$(cat "$BOUNDARY_FILE" 2>/dev/null || true)
[ -z "$BOUNDARY" ] && exit 0
# Trailing slash keeps /src from matching /src-old.
BOUNDARY="${BOUNDARY%/}/"

INPUT=$(cat 2>/dev/null || true)
[ -z "$INPUT" ] && exit 0
command -v python3 >/dev/null 2>&1 || exit 0

FILE_PATH=$(printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
print((data.get("tool_input") or {}).get("file_path", ""))
' 2>/dev/null || true)

[ -z "$FILE_PATH" ] && exit 0

# Resolve relative paths against the working directory so the comparison is fair.
case "$FILE_PATH" in
  /*) ABS="$FILE_PATH" ;;
  *)  ABS="$PWD/$FILE_PATH" ;;
esac

case "$ABS" in
  "$BOUNDARY"*) exit 0 ;;
esac

python3 -c '
import json, sys
path, boundary = sys.argv[1], sys.argv[2]
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": (
            "Edit boundary active: edits are restricted to " + boundary +
            " but this targets " + path +
            ". Run /safety-hooks to change or clear the boundary if this edit is intended."
        )
    }
}))
' "$ABS" "$BOUNDARY"
exit 0
