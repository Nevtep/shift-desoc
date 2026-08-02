#!/usr/bin/env bash
set -euo pipefail

export HERMES_HOME="${HERMES_HOME:-/opt/data}"
export HOME="${HOME:-$HERMES_HOME/home}"
REPO="${SHIFT_REPO_DIR:-/workspace/shift}"

fail=0
check() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then
    printf 'PASS  %s\n' "$label"
  else
    printf 'FAIL  %s\n' "$label"
    fail=1
  fi
}

check hermes hermes --version
check codex codex --version
check gentle gentle-ai --version
check gga gga --version
check engram engram version
check github gh repo view "${SHIFT_REPO_FULL_NAME:-Nevtep/shift-desoc}"
check repo test -d "$REPO/.git"
check agents test -f "$REPO/AGENTS.md"
check supervisor-skill test -f "$HERMES_HOME/skills/shift-autonomous-development/SKILL.md"
check repo-skills test -f "$REPO/.github/skills/linear-development-readiness/SKILL.md"
check linear bash -lc "codex mcp list | grep -q linear"
check cron hermes cron status

echo
if [[ "$fail" -eq 0 ]]; then
  echo READY
else
  echo NOT_READY
fi
exit "$fail"
