#!/usr/bin/env bash
# Keep timestamped copies of the shared Hermes memory before each
# merge-learning hand-over, and report entries that disappeared or were
# rewritten since the previous copy, so a prune can be noticed and undone.
#
#   shift-memory-snapshot.sh <MEMORY.md> <state dir>
#
# Writes <state>/memory-snapshots/MEMORY-<UTC stamp>.md (newest 10 kept) and
# appends removed entries to <state>/memory-pruned.log. Never fails the caller.
set -uo pipefail
mem="${1:?usage: shift-memory-snapshot.sh <MEMORY.md> <state dir>}"
state="${2:?usage: shift-memory-snapshot.sh <MEMORY.md> <state dir>}"
keep=10
[[ -f "$mem" && ! -L "$mem" ]] || exit 0

snapdir="$state/memory-snapshots"
mkdir -p "$snapdir" || exit 0
last="$(ls -1 "$snapdir"/MEMORY-*.md 2>/dev/null | sort | tail -n 1)"

if [[ -n "$last" ]]; then
  cmp -s "$last" "$mem" && exit 0
  # Entries are separated by a line holding only "§". Report every entry of
  # the previous copy that is not present verbatim any more.
  removed="$(awk '
    function flush(arr, i) { if (cur != "") arr[cur] = 1; cur = "" }
    FNR == 1 { if (NR != 1) flush(prev); else cur = "" }
    $0 == "§" { if (NR == FNR) flush(prev); else flush(now); next }
    { cur = (cur == "" ? $0 : cur "\n" $0) }
    END { flush(now); for (e in prev) if (!(e in now)) printf "%s\n---\n", e }
  ' "$last" "$mem")"
  if [[ -n "$removed" ]]; then
    {
      echo "== $(date -u +%Y-%m-%dT%H:%M:%SZ): entries removed or rewritten since $(basename "$last")"
      printf '%s\n' "$removed"
    } >>"$state/memory-pruned.log"
  fi
fi

stamp="${SHIFT_SNAPSHOT_STAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"
cp -p "$mem" "$snapdir/MEMORY-$stamp.md" 2>/dev/null || exit 0
total="$(ls -1 "$snapdir"/MEMORY-*.md 2>/dev/null | wc -l | tr -d ' ')"
if (( total > keep )); then
  ls -1 "$snapdir"/MEMORY-*.md | sort | head -n "$((total - keep))" | while IFS= read -r old; do
    rm -f -- "$old"
  done
fi
exit 0
