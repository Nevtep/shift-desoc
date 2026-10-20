#!/usr/bin/env bash
# Tests for shift-memory-snapshot.sh: timestamped copies of Hermes memory taken
# before each merge-learning hand-over, with removed entries reported.
#
#   bash hermes-bootstrap/tests/memory-snapshot.test.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SNAP="$HERE/scripts/shift-memory-snapshot.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
failures=0
pass() { echo "ok   - $1"; }
fail() { echo "FAIL - $1" >&2; failures=$((failures + 1)); }
check() { local name="$1"; shift; if "$@"; then pass "$name"; else fail "$name"; fi; }

mem="$WORK/MEMORY.md"
state="$WORK/state"
printf 'Runtime fact A\n§\nSocial topics: 10-19, 10-18\n§\nPersona B' >"$mem"

# 1. First run keeps a timestamped copy and reports nothing.
bash "$SNAP" "$mem" "$state"
check "first snapshot written" bash -c "ls '$state'/memory-snapshots/MEMORY-*.md >/dev/null 2>&1"
check "no prune reported on first run" test ! -s "$state/memory-pruned.log"

# 2. An entry removed and one rewritten since the last snapshot are reported,
#    and the pre-damage snapshot is kept.
sleep 1
printf 'Runtime fact A\n§\nPersona B, shortened' >"$mem"
bash "$SNAP" "$mem" "$state"
check "removed entry reported" grep -q "Social topics: 10-19, 10-18" "$state/memory-pruned.log"
check "rewritten entry reported" grep -q "^Persona B$" "$state/memory-pruned.log"
check "unchanged entry not reported" bash -c "! grep -q 'Runtime fact A' '$state/memory-pruned.log'"
check "pre-damage snapshot kept" bash -c "grep -l 'Social topics' '$state'/memory-snapshots/MEMORY-*.md >/dev/null"
check "two snapshots kept" test "$(ls "$state"/memory-snapshots/MEMORY-*.md | wc -l)" -eq 2

# 3. Unchanged memory: no new snapshot, nothing new reported.
lines_before="$(wc -l <"$state/memory-pruned.log")"
bash "$SNAP" "$mem" "$state"
check "unchanged memory adds no snapshot" test "$(ls "$state"/memory-snapshots/MEMORY-*.md | wc -l)" -eq 2
check "unchanged memory reports nothing new" test "$(wc -l <"$state/memory-pruned.log")" -eq "$lines_before"

# 4. Only the newest 10 snapshots are kept.
for i in $(seq 1 12); do
  printf 'Runtime fact A\n§\nVersion %s' "$i" >"$mem"
  touch -t "2026010100$(printf '%02d' "$i")" "$mem" 2>/dev/null || true
  SHIFT_SNAPSHOT_STAMP="test-$(printf '%02d' "$i")" bash "$SNAP" "$mem" "$state"
done
check "at most 10 snapshots kept" test "$(ls "$state"/memory-snapshots/MEMORY-*.md | wc -l)" -le 10

# 5. Missing memory file is a no-op that never fails.
check "missing memory is a no-op" bash "$SNAP" "$WORK/nope.md" "$state"

[[ $failures -eq 0 ]] && echo "all passed" || { echo "$failures failed" >&2; exit 1; }
