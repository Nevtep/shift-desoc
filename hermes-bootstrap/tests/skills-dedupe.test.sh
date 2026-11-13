#!/usr/bin/env bash
# Tests for shift-skills-dedupe.sh: a server-local skill that the repo also
# ships is moved aside (not deleted); unrelated skills stay; idempotent.
#
#   bash hermes-bootstrap/tests/skills-dedupe.test.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$HERE/scripts/shift-skills-dedupe.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
pass=0; fail=0
check() { local n="$1"; shift; if "$@" >/dev/null 2>&1; then pass=$((pass+1)); echo "ok   $n"; else fail=$((fail+1)); echo "FAIL $n"; fi; }

mkdir -p "$WORK/repo/shift-reels-publishing" "$WORK/local/shift-social-content/shift-reels-publishing" \
         "$WORK/local/creative/unrelated" "$WORK/local/.hub/shift-reels-publishing"
for f in "$WORK/repo/shift-reels-publishing" "$WORK/local/shift-social-content/shift-reels-publishing" \
         "$WORK/local/creative/unrelated" "$WORK/local/.hub/shift-reels-publishing"; do echo x >"$f/SKILL.md"; done
export SHIFT_LOCAL_SKILLS_DIR="$WORK/local" SHIFT_SKILLS_ASIDE_DIR="$WORK/aside"

bash "$SCRIPT" "$WORK/repo" >/dev/null 2>&1
check "local duplicate moved out"  test ! -d "$WORK/local/shift-social-content/shift-reels-publishing"
check "moved aside, not deleted"   test -n "$(find "$WORK/aside" -name SKILL.md)"
check "unrelated skill untouched"  test -f "$WORK/local/creative/unrelated/SKILL.md"
check "hidden dirs untouched"      test -f "$WORK/local/.hub/shift-reels-publishing/SKILL.md"
check "repo copy untouched"        test -f "$WORK/repo/shift-reels-publishing/SKILL.md"
bash "$SCRIPT" "$WORK/repo" >/dev/null 2>&1
check "second run is a no-op"      test "$(find "$WORK/aside" -name SKILL.md | wc -l | tr -d ' ')" = 1
SHIFT_LOCAL_SKILLS_DIR="$WORK/none" bash "$SCRIPT" "$WORK/repo" >/dev/null 2>&1
check "missing local dir is fine"  true
echo "$pass passed, $fail failed"; [[ "$fail" -eq 0 ]]
