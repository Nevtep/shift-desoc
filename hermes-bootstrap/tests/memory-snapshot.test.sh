#!/usr/bin/env bash
# Tests for shift-memory-snapshot.sh: timestamped copies of Hermes memory taken
# before each merge-learning hand-over, with removed entries reported.
#
#   bash hermes-bootstrap/tests/memory-snapshot.test.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SNAP="${SNAP_OVERRIDE:-$HERE/scripts/shift-memory-snapshot.sh}"
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
check "exactly the newest 10 snapshots kept" test "$(ls "$state"/memory-snapshots/MEMORY-*.md | wc -l)" -eq 10
check "oldest snapshots rotated out" test ! -e "$state/memory-snapshots/MEMORY-test-01.md"
check "newest snapshot kept" test -e "$state/memory-snapshots/MEMORY-test-12.md"

# 5. Missing memory file is a no-op that never fails.
check "missing memory is a no-op" bash "$SNAP" "$WORK/nope.md" "$state"

# 6. An empty previous snapshot does not report the current entries as removed.
s6="$WORK/s6"; : >"$WORK/m6.md"
bash "$SNAP" "$WORK/m6.md" "$s6"
printf 'One\n§\nTwo\n§\nThree' >"$WORK/m6.md"
bash "$SNAP" "$WORK/m6.md" "$s6"
check "empty previous snapshot reports nothing" test ! -s "$s6/memory-pruned.log"

# 6b. A wiped memory reports every previous entry, including the last one.
s6b="$WORK/s6b"; printf 'First\n§\nLast entry' >"$WORK/m6b.md"
bash "$SNAP" "$WORK/m6b.md" "$s6b"; : >"$WORK/m6b.md"
bash "$SNAP" "$WORK/m6b.md" "$s6b"
check "wiped memory reports the first entry" grep -q '^First$' "$s6b/memory-pruned.log"
check "wiped memory reports the last entry" grep -q '^Last entry$' "$s6b/memory-pruned.log"

# 7. Links planted in the state dir are never written or deleted through.
outside="$WORK/outside"; mkdir -p "$outside"
printf 'keep me' >"$outside/MEMORY-x.md"
s7="$WORK/s7"; mkdir -p "$s7"; ln -s "$outside" "$s7/memory-snapshots"
check "symlinked snapshot dir is a no-op" bash "$SNAP" "$mem" "$s7"
check "nothing written through a symlinked snapshot dir" test "$(ls "$outside" | wc -l | tr -d ' ')" -eq 1

s8="$WORK/s8"; mkdir -p "$s8/memory-snapshots"; printf 'secret' >"$outside/target"
ln -s "$outside/target" "$s8/memory-snapshots/MEMORY-planted.md"
SHIFT_SNAPSHOT_STAMP=planted bash "$SNAP" "$mem" "$s8"
check "planted link at the snapshot name is not written through" test "$(cat "$outside/target")" = secret

s9="$WORK/s9"; mkdir -p "$s9/memory-snapshots"; printf 'A\n§\nB' >"$WORK/m9.md"
bash "$SNAP" "$WORK/m9.md" "$s9"
ln -s "$outside/target" "$s9/memory-pruned.log"; printf 'A' >"$WORK/m9.md"
bash "$SNAP" "$WORK/m9.md" "$s9"
check "symlinked pruned log is not appended through" test "$(cat "$outside/target")" = secret

# 8. A planted name with a newline cannot make rotation delete outside the dir.
s10="$WORK/s10"; mkdir -p "$s10/memory-snapshots" "$WORK/cwd"; printf 'victim' >"$WORK/cwd/-victim.md"
for i in $(seq 1 11); do printf 'V %s' "$i" >"$WORK/m10.md"; SHIFT_SNAPSHOT_STAMP="t-$(printf '%02d' "$i")" bash "$SNAP" "$WORK/m10.md" "$s10"; done
check "rotation never deletes outside the snapshot dir" bash -c "cd '$WORK/cwd' && touch '$s10/memory-snapshots/MEMORY-0'\$'\\n''-victim.md' && printf 'V new' >'$WORK/m10.md' && SHIFT_SNAPSHOT_STAMP=t-99 bash '$SNAP' '$WORK/m10.md' '$s10'; test -e '$WORK/cwd/-victim.md'"

[[ $failures -eq 0 ]] && echo "all passed" || { echo "$failures failed" >&2; exit 1; }
