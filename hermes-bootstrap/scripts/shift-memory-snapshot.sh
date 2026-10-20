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
log="$state/memory-pruned.log"
# The state dir is writable by the agent: never write, append or delete
# through a link planted there.
[[ -L "$snapdir" || -L "$log" ]] && exit 0
mkdir -p "$snapdir" || exit 0
[[ -d "$snapdir" && ! -L "$snapdir" ]] || exit 0
shopt -s nullglob
snaps=("$snapdir"/MEMORY-*.md)   # glob order is sorted; stamps are fixed-width
last=""
for (( i = ${#snaps[@]} - 1; i >= 0; i-- )); do
  [[ -f "${snaps[i]}" && ! -L "${snaps[i]}" ]] && { last="${snaps[i]}"; break; }
done

if [[ -n "$last" ]]; then
  cmp -s "$last" "$mem" && exit 0
  # Entries are separated by a line holding only "§". Report every entry of
  # the previous copy that is not present verbatim any more. Files are told
  # apart by name and the pending entry is flushed by the file of the last
  # line read, so an empty previous copy or a wiped memory is handled too.
  removed="$(awk -v first="$last" '
    function flush(arr) { if (cur != "") arr[cur] = 1; cur = "" }
    { infirst = (FILENAME == first) }
    FNR == 1 && !infirst { flush(prev) }
    $0 == "§" { if (infirst) flush(prev); else flush(now); next }
    { cur = (cur == "" ? $0 : cur "\n" $0) }
    END { if (infirst) flush(prev); else flush(now); for (e in prev) if (!(e in now)) printf "%s\n---\n", e }
  ' "$last" "$mem")"
  if [[ -n "$removed" ]]; then
    {
      echo "== $(date -u +%Y-%m-%dT%H:%M:%SZ): entries removed or rewritten since $(basename "$last")"
      printf '%s\n' "$removed"
    } >>"$log"
  fi
fi

stamp="${SHIFT_SNAPSHOT_STAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"
dest="$snapdir/MEMORY-$stamp.md"
[[ -e "$dest" || -L "$dest" ]] && exit 0
# Copy to a fresh file created by mktemp (O_EXCL), then rename it into place.
tmp="$(mktemp "$snapdir/.snapshot.XXXXXX")" || exit 0
cat "$mem" >"$tmp" && mv -f "$tmp" "$dest" || { rm -f -- "$tmp"; exit 0; }

snaps=("$snapdir"/MEMORY-*.md)
for (( i = 0; i < ${#snaps[@]} - keep; i++ )); do
  [[ -f "${snaps[i]}" && ! -L "${snaps[i]}" ]] && rm -f -- "${snaps[i]}"
done
exit 0
