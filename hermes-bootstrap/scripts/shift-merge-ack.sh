#!/usr/bin/env bash
# Acknowledge merged PRs after shift-post-merge-learning finished learning from
# them and triggered the development loop. Moves them from pending to seen so
# the merge watcher stops handing them over.
#
# Also acknowledges review requests by key (`comment:<id>` or `closed:<n>`).
#
# Usage: shift-merge-ack.sh <pr-number | comment:<id> | closed:<n>>...
set -euo pipefail
STATE_DIR="${SHIFT_STATE_DIR:-/opt/data/shift}"
SEEN="$STATE_DIR/merged-prs.seen"
PENDING="$STATE_DIR/merged-prs.pending"
mkdir -p "$STATE_DIR"
touch "$SEEN" "$PENDING"
[[ $# -gt 0 ]] || { echo "usage: $0 <pr-number>..." >&2; exit 1; }

for number in "$@"; do
  # Review requests from shift-review-requests.sh are acknowledged by key.
  if [[ "$number" =~ ^(comment|closed):[0-9]+$ ]]; then
    grep -qx "$number" "$SEEN" || echo "$number" >> "$SEEN"
    echo "acknowledged $number"
    continue
  fi
  [[ "$number" =~ ^[0-9]+$ ]] || { echo "not a PR number or request key: $number" >&2; exit 1; }
  grep -qx "$number" "$SEEN" || echo "$number" >> "$SEEN"
  tmp="$(mktemp)"
  grep -v "^${number}"$'\t' "$PENDING" > "$tmp" || true
  mv "$tmp" "$PENDING"
  echo "acknowledged #$number"
done
