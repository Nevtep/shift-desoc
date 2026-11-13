#!/usr/bin/env bash
# Tests for shift-reels-setup.sh: copies the template, keeps per-reel state,
# runs npm install only when package.json changes, never fails the boot.
#
#   bash hermes-bootstrap/tests/reels-setup.test.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SETUP="$HERE/scripts/shift-reels-setup.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
pass=0; fail=0
check() { local n="$1"; shift; if "$@" >/dev/null 2>&1; then pass=$((pass+1)); echo "ok   $n"; else fail=$((fail+1)); echo "FAIL $n"; fi; }

cat >"$WORK/npm" <<'STUB'
#!/usr/bin/env bash
echo run >>"$NPM_LOG"; mkdir -p node_modules
STUB
chmod +x "$WORK/npm"
export NPM_LOG="$WORK/npm.log" SHIFT_NPM="$WORK/npm" SHIFT_REELS_DIR="$WORK/dst"

mkdir -p "$WORK/dst/specs/old" "$WORK/dst/public/reels/x"
echo keep >"$WORK/dst/specs/old/spec.json"
bash "$SETUP" 2>/dev/null
check "copies the template" test -f "$WORK/dst/src/Reel.tsx" -a -f "$WORK/dst/scripts/make_reel.py"
check "keeps per-reel specs" grep -q keep "$WORK/dst/specs/old/spec.json"
check "keeps per-reel public/reels" test -d "$WORK/dst/public/reels/x"
check "npm install ran once" test "$(grep -c run "$NPM_LOG")" = 1
bash "$SETUP" 2>/dev/null
check "second run does not reinstall" test "$(grep -c run "$NPM_LOG")" = 1
SHIFT_NPM=/bin/false SHIFT_REELS_DIR="$WORK/dst2" bash "$SETUP" 2>/dev/null
check "failing npm does not fail the boot" test -f "$WORK/dst2/package.json"
SHIFT_REELS_SRC="$WORK/missing" bash "$SETUP" 2>/dev/null
check "missing source does not fail the boot" true
out="$(SHIFT_REELS_DIR="$WORK/dst" bash "$SETUP" 2>&1 || true)"
check "warns about missing music" grep -q "track-a.mp3" <<<"$out"
# Server-side edits survive a boot; untouched files are refreshed from the repo.
SRC2="$WORK/src2"; mkdir -p "$SRC2/src"; echo v1 >"$SRC2/src/a.tsx"; echo v1 >"$SRC2/src/b.tsx"; echo '{}' >"$SRC2/package.json"
export SHIFT_REELS_SRC="$SRC2" SHIFT_REELS_DIR="$WORK/dst3"
bash "$SETUP" 2>/dev/null
echo mine >"$WORK/dst3/src/a.tsx"
echo v2 >"$SRC2/src/a.tsx"; echo v2 >"$SRC2/src/b.tsx"
out="$(bash "$SETUP" 2>&1 || true)"
check "warns about a kept server edit"     grep -q "a.tsx was edited" <<<"$out"
check "server edit is not overwritten"     grep -q mine "$WORK/dst3/src/a.tsx"
check "untouched file is refreshed"        grep -q v2 "$WORK/dst3/src/b.tsx"
check "baseline keeps the installed hash of the edited file" grep -q " src/a.tsx" "$WORK/dst3/.shift-template-baseline"
unset SHIFT_REELS_SRC
echo "$pass passed, $fail failed"; [[ "$fail" -eq 0 ]]
