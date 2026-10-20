#!/usr/bin/env bash
# Runs the dev-loop trigger snippet from the post-merge learning skill against
# a fake hermes CLI. The trigger counts only when a new manual (source=direct)
# execution of the dev-loop job appears, not when `hermes cron run` prints its
# completion banner (it runs synchronously, so that comes after the whole
# development cycle).
#
#   bash hermes-bootstrap/tests/dev-loop-trigger.test.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SKILL="$ROOT/hermes-bootstrap/skills/shift-post-merge-learning/SKILL.md"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
failures=0
pass() { echo "ok   - $1"; }
fail() { echo "FAIL - $1" >&2; failures=$((failures + 1)); }

# The first bash block of the hand-over section, with host paths pointed at WORK.
awk '/^## 3\. Hand over/ {on = 1} on && /^```bash$/ {grab = 1; next} grab && /^```$/ {exit} grab {print}' "$SKILL" \
  | sed -e "s#/opt/data/shift#$WORK/state#g" -e "s#/opt/hermes/.venv/bin/hermes#$WORK/hermes#g" >"$WORK/trigger.sh"
[[ -s "$WORK/trigger.sh" ]] || { echo "no trigger snippet found in $SKILL" >&2; exit 1; }

# Fake hermes. `cron runs <job> --limit 1` prints the newest row of $WORK/runs
# (format of hermes_cli/cron.py cron_runs); `cron run` follows $WORK/mode.
cat >"$WORK/hermes" <<FAKE
#!/usr/bin/env bash
runs="$WORK/runs"
if [[ "\$1 \$2" == "cron runs" ]]; then
  [[ -e "$WORK/ledger-down" ]] && { echo "database is locked" >&2; exit 1; }
  [[ -s "\$runs" ]] && tail -n 1 "\$runs" || echo "No cron execution attempts recorded."
  exit 0
fi
mode="\$(cat "$WORK/mode")"
echo invoked >>"$WORK/run-calls"
case "\$mode" in
  long)      sleep 1; echo "bbbb1111  running    job=dev  source=direct  2026-10-20T03:00:01" >>"\$runs"; sleep 30
             echo "Triggered job: dev (dev)";;
  skipped)   echo "Triggered job: dev (dev)"; echo "  Already being fired by the scheduler; not run again.";;
  builtin)   echo "cccc2222  running    job=dev  source=builtin  2026-10-20T03:00:01" >>"\$runs"
             echo "Triggered job: dev (dev)"; echo "  Already being fired by the scheduler; not run again.";;
  failed)    echo "dddd3333  failed     job=dev  source=direct  2026-10-20T03:00:01" >>"\$runs"
             echo "Triggered job: dev (dev)"; echo "  Ran now: failed.";;
  error)     echo "Failed to run job: Job is paused/disabled; resume it before running."; exit 1;;
esac
FAKE
chmod +x "$WORK/hermes"
mkdir -p "$WORK/state"
echo "DEV_LOOP_JOB_ID=dev" >"$WORK/state/jobs.env"

run_case() {  # <mode> <with previous row: yes|no>
  echo "$1" >"$WORK/mode"
  if [[ "$2" == yes ]]; then
    echo "aaaa0000  completed  job=dev  source=direct  2026-10-19T03:00:00" >"$WORK/runs"
  else
    : >"$WORK/runs"
  fi
  local start=$SECONDS
  out="$(bash "$WORK/trigger.sh" 2>&1)"
  took=$((SECONDS - start))
}

run_case long yes
if grep -q "dev loop triggered: execution bbbb1111" <<<"$out" && (( took < 15 )); then
  pass "a long dev cycle is confirmed as soon as its execution is claimed (${took}s)"
else fail "long dev cycle not confirmed promptly (${took}s): $out"; fi

run_case long no
grep -q "dev loop triggered: execution bbbb1111" <<<"$out" && pass "confirmed with no earlier executions" \
  || fail "first-ever execution not confirmed: $out"

for m in skipped builtin failed error; do
  run_case "$m" yes
  if grep -q "dev loop not triggered" <<<"$out" && ! grep -q "dev loop triggered" <<<"$out"; then
    pass "not confirmed when the run is $m, even if the banner is printed"
  else fail "wrongly confirmed for $m: $out"; fi
done

run_case skipped yes
grep -q "Already being fired" <<<"$out" && pass "an unconfirmed trigger shows the CLI log" \
  || fail "log not shown on failure: $out"

# An unreadable ledger before the trigger must not let an older run count.
: >"$WORK/run-calls"; touch "$WORK/ledger-down"
run_case long yes
rm -f "$WORK/ledger-down"
if grep -q "dev loop not triggered" <<<"$out" && [[ ! -s "$WORK/run-calls" ]]; then
  pass "no trigger and no confirmation when the ledger cannot be read first"
else fail "unreadable ledger: $out (run calls: $(wc -l <"$WORK/run-calls"))"; fi

[[ $failures -eq 0 ]] && echo "all passed" || { echo "$failures failed" >&2; exit 1; }
