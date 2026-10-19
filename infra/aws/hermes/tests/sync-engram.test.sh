#!/usr/bin/env bash
# Tests for infra/aws/hermes/sync-engram.sh with stubbed engram, gitleaks and
# ssh: nothing is recorded as sent unless the confirmed import succeeded.
# The script only reads its confirmation from a real terminal, so each run goes
# through `expect` on a pseudo-terminal (skipped when expect is missing).
#
#   bash infra/aws/hermes/tests/sync-engram.test.sh
set -euo pipefail
command -v expect >/dev/null || { echo "skip - sync-engram tests (expect not installed)"; exit 0; }
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
failures=0

pass() { echo "ok   - $1"; }
fail() { echo "FAIL - $1" >&2; failures=$((failures + 1)); }
check() { local name="$1"; shift; if "$@"; then pass "$name"; else fail "$name"; fi; }

# Fake repo with the real scripts and a one-chunk local Engram store.
REPO="$WORK/repo"
mkdir -p "$REPO/infra/aws/hermes" "$REPO/.engram/chunks" "$WORK/bin"
cp "$HERE/sync-engram.sh" "$HERE/engram-sanitize.py" "$HERE/engram-gitleaks.toml" "$REPO/infra/aws/hermes/"
python3 - "$REPO" <<'EOF'
import gzip, json, sys
d = sys.argv[1]
rec = {"sessions": [{"id": "s1", "project": "shift-desoc", "directory": "/x", "started_at": "t"}],
       "observations": [{"id": 1, "sync_id": "obs-1", "session_id": "s1", "type": "decision",
                         "title": "A learning", "content": "clean", "project": "shift-desoc"}],
       "prompts": []}
with gzip.open(f"{d}/.engram/chunks/ffff0000.jsonl.gz", "wt") as f:
    f.write(json.dumps(rec) + "\n")
json.dump({"version": 2, "chunks": [{"id": "ffff0000", "created_by": "t", "created_at": "t",
           "sessions": 1, "memories": 1, "prompts": 0}]}, open(f"{d}/.engram/manifest.json", "w"))
json.dump({"project_name": "shift-desoc"}, open(f"{d}/.engram/config.json", "w"))
EOF

cat >"$WORK/bin/engram" <<'EOF'
#!/usr/bin/env bash
echo "Nothing new to sync"
EOF
cat >"$WORK/bin/gitleaks" <<'EOF'
#!/usr/bin/env bash
exit "${GITLEAKS_RC:-0}"
EOF
cat >"$WORK/bin/ssh" <<EOF
#!/usr/bin/env bash
cat >/dev/null
touch "$WORK/ssh-called"
exit "\${SSH_RC:-0}"
EOF
chmod +x "$WORK/bin/"*

pushed="$REPO/.engram/.pushed-to-hermes"
run_sync() { # <answer> -> exit code in $rc
  rm -f "$WORK/ssh-called"
  set +e
  PATH="$WORK/bin:$PATH" ANSWER="$1" SCRIPT="$REPO/infra/aws/hermes/sync-engram.sh" expect -c '
    set timeout 60
    spawn bash $env(SCRIPT)
    expect {
      "Send these learnings to Hermes?" { send "$env(ANSWER)\r"; exp_continue }
      eof
    }
    catch wait result
    exit [lindex $result 3]
  ' >"$WORK/out.log" 2>&1 </dev/null
  rc=$?
  set -e
}

# Stdin is never accepted as the confirmation, even when it says yes.
rm -f "$WORK/ssh-called"
set +e
printf 'y\n' | PATH="$WORK/bin:$PATH" bash "$REPO/infra/aws/hermes/sync-engram.sh" >"$WORK/stdin.log" 2>&1
rc=$?
set -e
check "piped yes without a terminal is refused" test "$rc" -ne 0
check "piped yes never calls ssh" test ! -e "$WORK/ssh-called"
check "no override variable is honoured" bash -c "! grep -q SYNC_ENGRAM_TTY '$REPO/infra/aws/hermes/sync-engram.sh'"

run_sync n
check "declining exits non-zero" test "$rc" -ne 0
check "declining never calls ssh" test ! -e "$WORK/ssh-called"
check "declining records nothing" test ! -s "$pushed"

GITLEAKS_RC=1 run_sync y
check "gitleaks finding exits non-zero" test "$rc" -ne 0
check "gitleaks finding never calls ssh" test ! -e "$WORK/ssh-called"
check "gitleaks finding is what stopped it" grep -q "gitleaks flagged the payload" "$WORK/out.log"
check "gitleaks finding records nothing" test ! -s "$pushed"

SSH_RC=1 run_sync y
check "failed import exits non-zero" test "$rc" -ne 0
check "failed import did reach ssh" test -e "$WORK/ssh-called"
check "failed import records nothing" test ! -s "$pushed"

run_sync y
check "confirmed import exits 0" test "$rc" -eq 0
check "confirmed import calls ssh" test -e "$WORK/ssh-called"
check "confirmed import records the chunk" grep -qx ffff0000 "$pushed"

run_sync y
check "nothing new exits 0" test "$rc" -eq 0
check "nothing new never calls ssh" test ! -e "$WORK/ssh-called"

[[ $failures -eq 0 ]] && echo "all passed" || { echo "$failures failed" >&2; exit 1; }
