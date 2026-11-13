#!/usr/bin/env bash
# Tests for shift-drift-monitor.sh against a fake volume, a fake checkout and a
# fake gh: reports unversioned skills and changed reel-template files, ignores
# bundled skills and per-reel state, withholds secrets, stays quiet when a drift
# PR is open, and prints stable output.
#
#   bash hermes-bootstrap/tests/drift-monitor.test.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MON="$HERE/scripts/shift-drift-monitor.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
pass=0; fail=0
check() { local n="$1"; shift; if "$@" >/dev/null 2>&1; then pass=$((pass+1)); echo "ok   $n"; else fail=$((fail+1)); echo "FAIL $n"; fi; }

V="$WORK/vol" R="$WORK/repo/hermes-bootstrap"
mkdir -p "$V/skills/creative/bundled-one" "$V/skills/misc/mine" "$V/skills/misc/leaky" "$V/skills/misc/shipped" \
         "$V/shift-reels/src" "$V/shift-reels/specs/x" "$V/shift-reels/node_modules/m" "$V/shift-reels/public/reels/r" \
         "$R/skills/shipped" "$R/shift-reels/src" "$WORK/bin"
echo "bundled-one:abc" >"$V/skills/.bundled_manifest"
for d in creative/bundled-one misc/mine misc/leaky misc/shipped; do echo "# s" >"$V/skills/$d/SKILL.md"; done
echo "# s" >"$R/skills/shipped/SKILL.md"
echo "token = sk-abcdefghijklmnopqrstuvwxyz123456" >"$V/skills/misc/leaky/notes.md"
echo same >"$V/shift-reels/src/a.tsx"; echo same >"$R/shift-reels/src/a.tsx"
echo new  >"$V/shift-reels/src/b.tsx"
echo old  >"$R/shift-reels/src/c.tsx"; echo changed >"$V/shift-reels/src/c.tsx"
echo junk >"$V/shift-reels/specs/x/spec.json"; echo junk >"$V/shift-reels/node_modules/m/i.js"; echo junk >"$V/shift-reels/public/reels/r/bg0.jpg"

cat >"$WORK/bin/gh" <<'FAKE'
#!/usr/bin/env bash
[[ -n "${FAKE_GH_FAIL:-}" ]] && exit 1
[[ -n "${FAKE_OPEN_PR:-}" ]] && echo "$FAKE_OPEN_PR"
exit 0
FAKE
chmod +x "$WORK/bin/gh"
export PATH="$WORK/bin:$PATH" SHIFT_STATE_DIR="$WORK/state" HERMES_HOME="$V" SHIFT_REPO_DIR="$WORK/repo" SHIFT_REELS_DIR="$V/shift-reels"

echo "ESCARLET_MCP_TOKEN=opaquecredential1234567890" >"$V/skills/misc/leaky/env.txt"
mkdir -p "$V/shift-reels/examples/post-x"; echo gen >"$V/shift-reels/examples/post-x/spec.json"
out1="$(bash "$MON")"; out2="$(bash "$MON")"
check "reports unversioned skill"        grep -q "skill misc/mine/SKILL.md" <<<"$out1"
check "ignores bundled skill"            bash -c '! grep -q bundled-one <<<"$0"' "$out1"
check "ignores skill the repo ships"     bash -c '! grep -q "misc/shipped" <<<"$0"' "$out1"
check "reports new reel template file"   grep -q "reel-template shift-reels/src/b.tsx" <<<"$out1"
check "reports changed reel file"        grep -q "reel-template shift-reels/src/c.tsx" <<<"$out1"
check "ignores identical reel file"      bash -c '! grep -q "src/a.tsx" <<<"$0"' "$out1"
check "ignores per-reel state"           bash -c '! grep -qE "specs/|node_modules|public/reels" <<<"$0"' "$out1"
check "withholds secret-looking file"    bash -c 'grep -q "SKIPPED" <<<"$0" && ! grep -q "^- skill misc/leaky/notes.md" <<<"$0"' "$out1"
check "output is stable between ticks"   test "$out1" = "$out2"
check "uppercase credentials are withheld" bash -c '! grep -q "^- skill misc/leaky/env.txt" <<<"$0"' "$out1"
check "per-post examples are not template" bash -c '! grep -q "examples/" <<<"$0"' "$out1"
check "first sighting is retry round 0"  grep -q "RETRY_ROUND=0" <<<"$out1"
check "gh failure hands nothing over"    grep -q "STATUS=ERROR" <<<"$(FAKE_GH_FAIL=1 bash "$MON")"
check "gh failure leaks no files"        bash -c '! grep -q "reel-template" <<<"$0"' "$(FAKE_GH_FAIL=1 bash "$MON")"
printf 'deadbeef\t1\n' >/dev/null
sig_line="$(cut -f1 "$WORK/state/drift.sig")"; printf '%s\t%s\n' "$sig_line" "$(( $(date +%s) - 3*21600 ))" >"$WORK/state/drift.sig"
check "retry round advances per tick"    grep -q "RETRY_ROUND=3" <<<"$(bash "$MON")"
printf '%s\t%s\n' "$sig_line" "$(( $(date +%s) - 5*21600 ))" >"$WORK/state/drift.sig"
check "retry exhausts after max rounds"  grep -q "RETRY_EXHAUSTED=1" <<<"$(bash "$MON")"
out3="$(FAKE_OPEN_PR=7 bash "$MON")"
check "quiet while a drift PR is open"   grep -q "DRIFT: (none)" <<<"$out3"
# Baseline: an untouched older copy is not drift; a server edit is; a repo change on top is a conflict.
echo v1 >"$V/shift-reels/src/d.tsx"; echo v2 >"$R/shift-reels/src/d.tsx"
echo "$(sha256sum "$V/shift-reels/src/d.tsx" 2>/dev/null | cut -d' ' -f1 || true)" >/dev/null
h1="$(printf 'v1\n' | (sha256sum 2>/dev/null || shasum -a 256) | cut -d' ' -f1)"
echo "$h1 src/d.tsx" >"$V/shift-reels/.shift-template-baseline"
check "untouched older copy is not drift" bash -c '! grep -q "src/d.tsx" <<<"$0"' "$(bash "$MON")"
echo edited >"$V/shift-reels/src/d.tsx"
check "server edit with newer repo is a conflict" grep -q "reel-template-conflict shift-reels/src/d.tsx" <<<"$(bash "$MON")"
rm -f "$V/shift-reels/.shift-template-baseline" "$V/shift-reels/src/d.tsx" "$R/shift-reels/src/d.tsx"
rm -rf "$V/shift-reels/examples" "$V/skills/misc/mine" "$V/skills/misc/leaky" "$V/shift-reels/src/b.tsx"; echo old >"$V/shift-reels/src/c.tsx"
check "no drift reports (none)"          grep -q -- "- (none)" <<<"$(bash "$MON")"
check "missing checkout is an error"     grep -q "STATUS=ERROR" <<<"$(SHIFT_REPO_DIR="$WORK/none" bash "$MON")"
echo "$pass passed, $fail failed"; [[ "$fail" -eq 0 ]]
