#!/usr/bin/env bash
# Acknowledge merged PRs after shift-post-merge-learning finished learning from
# them and triggered the development loop. Moves them from pending to seen so
# the merge watcher stops handing them over.
#
# Usage: shift-merge-ack.sh <pr-number> [<pr-number>...]
set -euo pipefail
STATE_DIR="${SHIFT_STATE_DIR:-/opt/data/shift}"
SEEN="$STATE_DIR/merged-prs.seen"
PENDING="$STATE_DIR/merged-prs.pending"
mkdir -p "$STATE_DIR"
touch "$SEEN" "$PENDING"
[[ $# -gt 0 ]] || { echo "usage: $0 <pr-number>..." >&2; exit 1; }

for number in "$@"; do
  [[ "$number" =~ ^[0-9]+$ ]] || { echo "not a PR number: $number" >&2; exit 1; }
  grep -qx "$number" "$SEEN" || echo "$number" >> "$SEEN"
  tmp="$(mktemp)"
  grep -v "^${number}"$'\t' "$PENDING" > "$tmp" || true
  mv "$tmp" "$PENDING"
  echo "acknowledged #$number"
done
