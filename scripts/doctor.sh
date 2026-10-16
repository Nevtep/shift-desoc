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
check claude-linear-mcp bash -c "out=\$(claude mcp list 2>/dev/null); grep -q linear <<<\"\$out\""
check gentle gentle-ai --version
check engram engram version
check github gh repo view "${SHIFT_REPO_FULL_NAME:-Nevtep/shift-desoc}"
check repo test -d "$REPO/.git"
check agents test -f "$REPO/AGENTS.md"
# Capture first: with pipefail, `grep -q` closing the pipe early makes the
# producer die of SIGPIPE and the pipeline report failure on a match.
LOADED_SKILLS="$(COLUMNS=250 hermes skills list --source local --enabled-only 2>/dev/null || true)"
hermes_skill_loaded() { grep -qw -- "$1" <<<"$LOADED_SKILLS"; }
check supervisor-skill hermes_skill_loaded shift-autonomous-development
check review-convergence-skill hermes_skill_loaded shift-pr-review-convergence
check repo-skills test -f "$REPO/.github/skills/linear-development-readiness/SKILL.md"
check linear-key test -n "${LINEAR_API_KEY:-}"
check linear-mcp hermes mcp test linear
check content-skill hermes_skill_loaded shift-social-content
check escarlet-mcp-content-skill hermes_skill_loaded escarlet-mcp-content
check escarlet-config bash -c "test -n \"\${ESCARLET_MCP_URL:-}\" -a -n \"\${ESCARLET_MCP_TOKEN:-}\""
check escarlet-mcp hermes mcp test escarlet
check terminal-home bash -c "grep -q 'home_mode: real' \"\$HERMES_HOME/config.yaml\""
check main-clean bash -c "cd '$REPO' && test -z \"\$(git status --porcelain)\""
check cron hermes cron status

echo
if [[ "$fail" -eq 0 ]]; then
  echo READY
else
  echo NOT_READY
fi
exit "$fail"
