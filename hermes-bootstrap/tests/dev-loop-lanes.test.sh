#!/usr/bin/env bash
# Runs shift-dev-monitor.sh against a fake gh/git and checks the open-PR lanes:
# a total cap (SHIFT_MAX_OPEN_PRS), a feature cap (SHIFT_MAX_FEATURE_PRS) and a
# bug lane (fix/SHI-*) that features can never take.
#
#   bash hermes-bootstrap/tests/dev-loop-lanes.test.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MONITOR="$ROOT/hermes-bootstrap/scripts/shift-dev-monitor.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
failures=0
pass() { echo "ok   - $1"; }
fail() { echo "FAIL - $1" >&2; failures=$((failures + 1)); }

mkdir -p "$WORK/bin" "$WORK/repo/.git"

# Fake gh: `auth status` succeeds, `pr list` prints "<number> <branch>" lines
# from $WORK/prs (the monitor's --jq filter is not evaluated here).
cat >"$WORK/bin/gh" <<FAKE
#!/usr/bin/env bash
case "\$1 \$2" in
  "auth status") exit 0;;
  "pr list") [[ -e "$WORK/gh-down" ]] && exit 1; cat "$WORK/prs"; exit 0;;
esac
exit 0
FAKE
# Fake git: fetch succeeds, rev-parse returns a fixed SHA.
cat >"$WORK/bin/git" <<'FAKE'
#!/usr/bin/env bash
case " $* " in
  *" rev-parse "*) echo abc123def456;;
esac
exit 0
FAKE
chmod +x "$WORK/bin/gh" "$WORK/bin/git"

# run_monitor <env assignments...>; PR lines come from stdin.
run_monitor() {
  cat >"$WORK/prs"
  out="$(env -i PATH="$WORK/bin:$PATH" HOME="$WORK" LINEAR_API_KEY=test \
    SHIFT_REPO_DIR="$WORK/repo" "$@" bash "$MONITOR" 2>&1)"
}

has() { grep -qxF -- "$1" <<<"$out"; }

# 1. Two feature PRs fill the feature lane; the reserved slot stays open for bugs.
run_monitor SHIFT_MAX_OPEN_PRS=3 SHIFT_MAX_FEATURE_PRS=2 <<'PRS'
10 feat/SHI-1/a
11 imp/SHI-2/b
PRS
if has "PREFLIGHT=GO" && has "LANES=bug"; then pass "2 features open: GO with only the bug lane"
else fail "2 features open: $out"; fi

# 2. One feature PR leaves both lanes open.
run_monitor SHIFT_MAX_OPEN_PRS=3 SHIFT_MAX_FEATURE_PRS=2 <<'PRS'
10 feat/SHI-1/a
PRS
if has "PREFLIGHT=GO" && has "LANES=feature,bug"; then pass "1 feature open: GO with both lanes"
else fail "1 feature open: $out"; fi

# 3. One bug PR leaves both lanes open.
run_monitor SHIFT_MAX_OPEN_PRS=3 SHIFT_MAX_FEATURE_PRS=2 <<'PRS'
20 fix/SHI-9/x
PRS
if has "PREFLIGHT=GO" && has "LANES=feature,bug"; then pass "1 bug open: GO with both lanes"
else fail "1 bug open: $out"; fi

# 4. Two features plus one bug fill the total cap: STOP naming the counts.
run_monitor SHIFT_MAX_OPEN_PRS=3 SHIFT_MAX_FEATURE_PRS=2 <<'PRS'
10 feat/SHI-1/a
11 imp/SHI-2/b
20 fix/SHI-9/x
PRS
if has "PREFLIGHT=STOP" && grep -q "^REASON=.*features 2/2.*bugs 1.*3/3" <<<"$out"; then
  pass "2 features + 1 bug: STOP naming the counts"
else fail "full: $out"; fi

# 5. Bug PRs count toward the total even when a feature slot is free.
run_monitor SHIFT_MAX_OPEN_PRS=3 SHIFT_MAX_FEATURE_PRS=2 <<'PRS'
10 feat/SHI-1/a
20 fix/SHI-9/x
21 fix/SHI-8/y
PRS
has "PREFLIGHT=STOP" && pass "fix/ PRs count toward the total cap" \
  || fail "fix PRs not counted: $out"

# 6. Branches that are not agent branches never count.
run_monitor SHIFT_MAX_OPEN_PRS=3 SHIFT_MAX_FEATURE_PRS=2 <<'PRS'
30 dependabot/npm/foo
31 fix/hermes-anthropic-provider-only
32 feature/SHI-1/not-an-agent-prefix
PRS
if has "PREFLIGHT=GO" && has "LANES=feature,bug" && grep -q "^OPEN_AGENT_PRS=0/3" <<<"$out"; then
  pass "non-agent branches are ignored"
else fail "non-agent branches: $out"; fi

# 7. Output is stable for the same state (a repeated STOP must cost zero tokens).
run_monitor SHIFT_MAX_OPEN_PRS=3 SHIFT_MAX_FEATURE_PRS=2 <<'PRS'
10 feat/SHI-1/a
PRS
first="$out"
run_monitor SHIFT_MAX_OPEN_PRS=3 SHIFT_MAX_FEATURE_PRS=2 <<'PRS'
10 feat/SHI-1/a
PRS
[[ "$first" == "$out" ]] && pass "output is identical across runs for the same state" \
  || fail "unstable output"

# 8. A feature cap above the total cap is clamped to the total: no bug reserve.
run_monitor SHIFT_MAX_OPEN_PRS=2 SHIFT_MAX_FEATURE_PRS=5 <<'PRS'
10 feat/SHI-1/a
11 imp/SHI-2/b
PRS
has "PREFLIGHT=STOP" && pass "feature cap is clamped to the total cap" \
  || fail "clamp: $out"

# 9. Defaults keep the previous behavior: total 2, two features => STOP.
run_monitor <<'PRS'
10 feat/SHI-1/a
11 imp/SHI-2/b
PRS
has "PREFLIGHT=STOP" && pass "defaults: 2 open agent PRs stop the loop" \
  || fail "defaults: $out"

# 10. A failing gh pr list stops the loop instead of reading zero PRs.
touch "$WORK/gh-down"
run_monitor SHIFT_MAX_OPEN_PRS=3 SHIFT_MAX_FEATURE_PRS=2 <<'PRS'
PRS
rm -f "$WORK/gh-down"
if has "PREFLIGHT=STOP" && grep -q "^REASON=gh pr list failed" <<<"$out"; then
  pass "gh pr list failure stops the loop"
else fail "gh failure: $out"; fi

[[ $failures -eq 0 ]] && echo "all passed" || { echo "$failures failed" >&2; exit 1; }
