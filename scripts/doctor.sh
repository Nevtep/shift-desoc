#!/usr/bin/env bash
set -euo pipefail

export HERMES_HOME="${HERMES_HOME:-/opt/data}"
export HOME="${HOME:-$HERMES_HOME}"
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
check claude-code claude --version
check claude-auth bash -c "test -n \"\${ANTHROPIC_API_KEY:-}\${CLAUDE_CODE_OAUTH_TOKEN:-}\""
check claude-linear-mcp bash -c "claude mcp list 2>/dev/null | grep -q linear"
check gentle gentle-ai --version
check engram engram version
check github gh repo view "${SHIFT_REPO_FULL_NAME:-Nevtep/shift-desoc}"
check repo test -d "$REPO/.git"
check agents test -f "$REPO/AGENTS.md"
hermes_skill_loaded() { COLUMNS=250 hermes skills list --source local --enabled-only 2>/dev/null | grep -qw -- "$1"; }
check supervisor-skill hermes_skill_loaded shift-autonomous-development
check review-convergence-skill hermes_skill_loaded shift-pr-review-convergence
check repo-skills test -f "$REPO/.github/skills/linear-development-readiness/SKILL.md"
check linear-key test -n "${LINEAR_API_KEY:-}"
check linear-mcp hermes mcp test linear
check main-clean bash -c "cd '$REPO' && test -z \"\$(git status --porcelain)\""
check cron hermes cron status

echo
if [[ "$fail" -eq 0 ]]; then
  echo READY
else
  echo NOT_READY
fi
exit "$fail"
