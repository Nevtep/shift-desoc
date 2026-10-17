#!/usr/bin/env bash
# Hermes cron MONITOR script for the "Shift merge watcher" job.
#
# Hermes hashes this script's stdout on every tick and only wakes the agent
# when the output changes, so the output must be stable (no timestamps).
# It prints the merged PRs that have not been handed to the agent yet and
# marks them as handed over in a state file, so each merge wakes the agent
# exactly once (the following tick prints an empty NEW list, which the agent
# answers with [SILENT]).
#
# State: /opt/data/shift/merged-prs.seen  (one PR number per line)
# Prime it with every already-merged PR on install so history is not
# "learned" retroactively (install-loop.sh does this).
set -euo pipefail
export HOME="${HOME:-/opt/data}"
REPO="${SHIFT_REPO_FULL_NAME:-Nevtep/shift-desoc}"
STATE_DIR=/opt/data/shift
SEEN="$STATE_DIR/merged-prs.seen"
mkdir -p "$STATE_DIR"
touch "$SEEN"

if ! merged="$(gh pr list --repo "$REPO" --state merged --limit 30 \
      --json number,title,headRefName,mergeCommit,mergedAt \
      --jq 'sort_by(.number)[] | "\(.number)\t\(.mergeCommit.oid[0:7])\t\(.headRefName)\t\(.title)"' 2>/dev/null)"; then
  echo "STATUS=ERROR"
  echo "REASON=gh pr list failed (auth or network); nothing handed over"
  exit 0
fi

echo "STATUS=OK"
echo "NEW_MERGED_PRS:"
new_numbers=()
while IFS=$'\t' read -r number sha branch title; do
  [[ -n "$number" ]] || continue
  if ! grep -qx "$number" "$SEEN"; then
    echo "- #$number $sha $branch — $title"
    new_numbers+=("$number")
  fi
done <<<"$merged"
if [[ ${#new_numbers[@]} -eq 0 ]]; then
  echo "- (none)"
else
  printf '%s\n' "${new_numbers[@]}" >> "$SEEN"
  # Sync the main checkout before the agent session starts: Hermes loads the
  # development skills from it, so a merged skills PR is live for this run.
  repo_dir="${SHIFT_REPO_DIR:-/workspace/shift}"
  if [[ -d "$repo_dir/.git" ]] && [[ -z "$(git -C "$repo_dir" status --porcelain 2>/dev/null)" ]]; then
    git -C "$repo_dir" fetch -q origin --prune 2>/dev/null \
      && git -C "$repo_dir" switch -q main 2>/dev/null \
      && git -C "$repo_dir" reset -q --hard origin/main 2>/dev/null || true
  fi
fi
