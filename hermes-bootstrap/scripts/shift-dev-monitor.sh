#!/usr/bin/env bash
# Hermes cron MONITOR script for the "Shift autonomous development loop" job.
#
# Fail-fast guardrails evaluated without the LLM. Hermes only wakes the agent
# when this output changes, so:
#   - a repeated STOP (same reason) costs zero tokens;
#   - GO includes the local date and the main SHA, so the loop runs at most
#     once per day per state of main (a merge that advances main re-arms it);
#   - a STOP -> GO transition re-arms it immediately.
# Output must be stable (no timestamps other than the date).
set -euo pipefail
export HOME="${HOME:-/opt/data}"
REPO="${SHIFT_REPO_FULL_NAME:-Nevtep/shift-desoc}"
REPO_DIR="${SHIFT_REPO_DIR:-/workspace/shift}"
MAX_OPEN="${SHIFT_MAX_OPEN_PRS:-3}"
MAX_FEATURE="${SHIFT_MAX_FEATURE_PRS:-2}"
LOCK=/opt/data/shift/dev-loop.lock

stop() { echo "PREFLIGHT=STOP"; echo "REASON=$1"; exit 0; }

# Another cycle still running: the supervisor writes this file at the start of
# a cycle and removes it at the end. A lock older than 4 hours is stale.
if [[ -f "$LOCK" ]]; then
  age=$(( $(date +%s) - $(stat -c %Y "$LOCK") ))
  if (( age < 4*3600 )); then
    stop "a development cycle is already running (lock $(cat "$LOCK" 2>/dev/null | head -c 60))"
  fi
fi

gh auth status --hostname github.com >/dev/null 2>&1 \
  || stop "gh is not authenticated for github.com"

[[ -n "${LINEAR_API_KEY:-}" ]] || stop "LINEAR_API_KEY is not set"

pr_lines="$(gh pr list --repo "$REPO" --state open --limit 50 \
  --json number,headRefName \
  --jq '.[] | "\(.number) \(.headRefName)"' 2>/dev/null)" \
  || stop "gh pr list failed"

# Classify open agent PRs by branch prefix: feat/ and imp/ are the feature
# lane, fix/ is the bug lane. Anything else (dependabot, hand-made branches)
# never counts. Numbers are sorted so the output is stable.
feature_nums=(); bug_nums=()
while read -r num branch; do
  [[ -n "${num:-}" ]] || continue
  if [[ "$branch" =~ ^(feat|imp)/SHI-[0-9]+/ ]]; then
    feature_nums+=("$num")
  elif [[ "$branch" =~ ^fix/SHI-[0-9]+/ ]]; then
    bug_nums+=("$num")
  fi
done < <(sort -n <<<"$pr_lines")
feature_count=${#feature_nums[@]}
bug_count=${#bug_nums[@]}
count=$(( feature_count + bug_count ))
open_agent_prs="$(printf '%s\n' "${feature_nums[@]:-}" "${bug_nums[@]:-}" | sed '/^$/d' | sort -n | paste -sd, -)"

# Lanes: the total cap is MAX_OPEN. Features may hold at most MAX_FEATURE of it
# (clamped to the total), so the remainder is reserved for bug fixes and a
# feature can never take it. Bugs may use any free slot below the total.
(( MAX_FEATURE > MAX_OPEN )) && MAX_FEATURE=$MAX_OPEN
lanes=()
if (( count < MAX_OPEN )); then
  (( feature_count < MAX_FEATURE )) && lanes+=(feature)
  lanes+=(bug)
fi
if (( ${#lanes[@]} == 0 )); then
  stop "$count agent PR(s) open (#$open_agent_prs): features $feature_count/$MAX_FEATURE, bugs $bug_count, total $count/$MAX_OPEN (SHIFT_MAX_OPEN_PRS, SHIFT_MAX_FEATURE_PRS); waiting for review/merge"
fi
lanes_csv="$(IFS=,; echo "${lanes[*]}")"

if [[ -d "$REPO_DIR/.git" ]]; then
  git -C "$REPO_DIR" fetch -q origin --prune 2>/dev/null || stop "git fetch origin failed"
  main_sha="$(git -C "$REPO_DIR" rev-parse --short=12 origin/main)"
else
  stop "repository checkout missing at $REPO_DIR"
fi

echo "PREFLIGHT=GO"
echo "DATE=$(date +%Y-%m-%d)"
echo "ORIGIN_MAIN=$main_sha"
echo "OPEN_AGENT_PRS=$count/$MAX_OPEN${open_agent_prs:+ (#$open_agent_prs)}"
echo "FEATURE_PRS=$feature_count/$MAX_FEATURE"
echo "BUG_PRS=$bug_count"
echo "LANES=$lanes_csv"
