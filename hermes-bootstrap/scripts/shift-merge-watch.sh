#!/usr/bin/env bash
# Hermes cron MONITOR script for the "Shift merge watcher" job.
#
# Hermes hashes this script's stdout on every tick and only wakes the agent
# when the output changes, so the output must be stable between ticks.
#
# A merged PR is handed to the agent as PENDING and stays pending until the
# learning skill acknowledges it with shift-merge-ack.sh at the very end of
# its work (after the dev loop was triggered). If the agent run fails or is
# interrupted, the PR is NOT lost: the output gains a RETRY_ROUND that
# advances once per hour while the oldest pending PR is unacknowledged, which
# wakes the agent again. After MAX_ROUNDS the output switches (once) to
# RETRY_EXHAUSTED=1 so the agent reports it to a human instead of looping.
#
# State (STATE_DIR, default /opt/data/shift):
#   merged-prs.seen     acknowledged PR numbers, one per line
#   merged-prs.pending  "<number>\t<first-seen-epoch>" for unacknowledged PRs
set -euo pipefail
export HOME="${HOME:-/opt/data}"
REPO="${SHIFT_REPO_FULL_NAME:-Nevtep/shift-desoc}"
STATE_DIR="${SHIFT_STATE_DIR:-/opt/data/shift}"
SEEN="$STATE_DIR/merged-prs.seen"
PENDING="$STATE_DIR/merged-prs.pending"
MAX_ROUNDS="${SHIFT_MERGE_RETRY_ROUNDS:-6}"
mkdir -p "$STATE_DIR"
touch "$SEEN" "$PENDING"

# Only PRs merged into main, most recently updated first. A merge always
# bumps updatedAt, so a long-open PR that merges now is at the top of this
# window no matter how old its creation date is; 100 covers any downtime.
if ! merged="$(gh pr list --repo "$REPO" --state merged --base main --limit 100 \
      --search 'sort:updated-desc' \
      --json number,title,headRefName,mergeCommit \
      --jq '.[] | "\(.number)\t\(.mergeCommit.oid[0:7])\t\(.headRefName)\t\(.title)"' 2>/dev/null)"; then
  echo "STATUS=ERROR"
  echo "REASON=gh pr list failed (auth or network); nothing handed over"
  exit 0
fi

now="$(date +%s)"
new_lines=()
while IFS=$'\t' read -r number sha branch title; do
  [[ -n "$number" ]] || continue
  grep -qx "$number" "$SEEN" && continue
  if ! grep -q "^${number}"$'\t' "$PENDING"; then
    printf '%s\t%s\n' "$number" "$now" >> "$PENDING"
  fi
  new_lines+=("$number"$'\t'"$sha"$'\t'"$branch"$'\t'"$title")
done <<<"$merged"

echo "STATUS=OK"
echo "PENDING_MERGED_PRS:"
if [[ ${#new_lines[@]} -eq 0 ]]; then
  echo "- (none)"
  exit 0
fi
printf '%s\n' "${new_lines[@]}" | sort -n | while IFS=$'\t' read -r number sha branch title; do
  echo "- #$number $sha $branch — $title"
done

oldest="$(sort -n -k2 "$PENDING" | head -1 | cut -f2)"
round=$(( (now - oldest) / 3600 ))
if (( round >= MAX_ROUNDS )); then
  echo "RETRY_EXHAUSTED=1"
else
  echo "RETRY_ROUND=$round"
fi

# Keep timestamped copies of the shared Hermes memory from before each agent
# session and log entries that disappeared since the previous copy, so a prune
# by a learning run can be noticed and restored (never fails the hand-over).
bash "$(dirname "${BASH_SOURCE[0]}")/shift-memory-snapshot.sh" \
  "${HERMES_HOME:-/opt/data}/memories/MEMORY.md" "$STATE_DIR" >/dev/null 2>&1 || true

# Sync the main checkout before the agent session starts: Hermes loads the
# development skills from it, so a merged skills PR is live for this run.
repo_dir="${SHIFT_REPO_DIR:-/workspace/shift}"
if [[ -d "$repo_dir/.git" ]] && [[ -z "$(git -C "$repo_dir" status --porcelain 2>/dev/null)" ]]; then
  git -C "$repo_dir" fetch -q origin --prune 2>/dev/null \
    && git -C "$repo_dir" switch -q main 2>/dev/null \
    && git -C "$repo_dir" reset -q --hard origin/main 2>/dev/null || true
fi
