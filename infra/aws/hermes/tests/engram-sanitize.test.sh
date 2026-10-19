#!/usr/bin/env bash
# Tests for infra/aws/hermes/engram-sanitize.py (used by sync-engram.sh).
#
#   bash infra/aws/hermes/tests/engram-sanitize.test.sh
#
# Set ENGRAM_BIN to a real engram binary (the release pinned by ENGRAM_VERSION
# in docker/Dockerfile.hermes) to also import the sanitized bundle into a
# throwaway Engram store.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SANITIZE="$HERE/engram-sanitize.py"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
failures=0

pass() { echo "ok   - $1"; }
fail() { echo "FAIL - $1" >&2; failures=$((failures + 1)); }
check() { local name="$1"; shift; if "$@"; then pass "$name"; else fail "$name"; fi; }

# --- fixtures ---------------------------------------------------------------

# make_store <dir> <chunk-id> <observation-content> <prompt-content>
make_store() {
  local dir="$1" id="$2" obs="$3" prompt="$4"
  mkdir -p "$dir/.engram/chunks"
  python3 - "$dir" "$id" "$obs" "$prompt" <<'EOF'
import gzip, json, sys
d, cid, obs, prompt = sys.argv[1:]
rec = {
  "sessions": [{"id": "s1", "project": "shift-desoc", "ownership_mode": "shared",
                "directory": "/Users/someone/Code/shift", "started_at": "2026-10-19 10:00:00"}],
  "observations": [{"id": 1, "sync_id": "obs-1", "session_id": "s1", "type": "decision",
                    "title": "A learning", "content": obs, "project": "shift-desoc", "scope": "project",
                    "topic_key": None, "duplicate_count": 1, "revision_count": 1,
                    "created_at": "2026-10-19 10:00:00", "updated_at": "2026-10-19 10:00:00",
                    "last_seen_at": None, "review_after": None}],
  "prompts": [{"id": 1, "sync_id": "prompt-1", "session_id": "s1", "content": prompt,
               "project": "shift-desoc", "created_at": "2026-10-19 10:00:00"}],
}
with gzip.open(f"{d}/.engram/chunks/{cid}.jsonl.gz", "wt") as f:
    f.write(json.dumps(rec) + "\n")
json.dump({"version": 2, "chunks": [{"id": cid, "created_by": "someone",
           "created_at": "2026-10-19T10:00:00Z", "sessions": 1, "memories": 1, "prompts": 1}]},
          open(f"{d}/.engram/manifest.json", "w"))
json.dump({"project_name": "shift-desoc"}, open(f"{d}/.engram/config.json", "w"))
EOF
}

# payload_has <out-dir> <text> / payload_lacks <out-dir> <text>: both fail when
# no sanitized chunk was produced, so a missing bundle never passes a check.
payload() { compgen -G "$1/.engram/chunks/*.jsonl.gz" >/dev/null && gzip -dc "$1"/.engram/chunks/*.jsonl.gz; }
payload_has() { local p; p="$(payload "$1")" || return 1; grep -qF -- "$2" <<<"$p"; }
payload_lacks() { local p; p="$(payload "$1")" || return 1; ! grep -qF -- "$2" <<<"$p"; }

# --- cases ------------------------------------------------------------------

# 1. Clean store: prompts and local paths are dropped, observations kept.
make_store "$WORK/a" aaaa1111 "Ponder needs a step floor" "my prompt mentioning /Users/someone"
set +e; python3 "$SANITIZE" --src "$WORK/a/.engram" --out "$WORK/a-out" >"$WORK/a.log" 2>&1; rc=$?; set -e
check "clean store exits 0" test "$rc" -eq 0
check "prompts removed from payload" payload_lacks "$WORK/a-out" "my prompt"
check "session directory blanked" payload_lacks "$WORK/a-out" "/Users/someone"
check "observation kept" payload_has "$WORK/a-out" "Ponder needs a step floor"
check "manifest reports zero prompts" bash -c "python3 -c 'import json,sys; m=json.load(open(sys.argv[1])); sys.exit(0 if all(c[\"prompts\"]==0 for c in m[\"chunks\"]) else 1)' '$WORK/a-out/.engram/manifest.json'"
check "decoded copy written for gitleaks" bash -c "ls '$WORK'/a-out/decoded/*.jsonl >/dev/null"
check "summary lists observation titles" grep -q "A learning" "$WORK/a.log"

# 2. A secret in an observation blocks the bundle and is never echoed in full.
jwt="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PSR5"
make_store "$WORK/b" bbbb2222 "pinata token $jwt here" "fine"
set +e; python3 "$SANITIZE" --src "$WORK/b/.engram" --out "$WORK/b-out" >"$WORK/b.log" 2>&1; rc=$?; set -e
check "secret in observation exits 2" test "$rc" -eq 2
check "finding names the detector" grep -qi "jwt" "$WORK/b.log"
check "secret value not printed in full" bash -c "! grep -qF '$jwt' '$WORK/b.log'"

for secret in "AKIAABCDEFGHIJKLMNOP" "-----BEGIN OPENSSH PRIVATE KEY-----" \
              "https://base-sepolia.infura.io/v3/0123456789abcdef0123456789abcdef" \
              "postgresql://postgres:hunter2pass@db.example.com:5432/railway" \
              "0x$(printf 'a%.0s' {1..64})"; do
  make_store "$WORK/c" cccc3333 "leak: $secret" "fine"
  set +e; python3 "$SANITIZE" --src "$WORK/c/.engram" --out "$WORK/c-out" >"$WORK/c.log" 2>&1; rc=$?; set -e
  check "blocks ${secret:0:24}…" test "$rc" -eq 2
  rm -rf "$WORK/c" "$WORK/c-out"
done

# 3. A secret only in a prompt is dropped with the prompt, not shipped.
make_store "$WORK/d" dddd4444 "harmless learning" "here is my key AKIAABCDEFGHIJKLMNOP"
set +e; python3 "$SANITIZE" --src "$WORK/d/.engram" --out "$WORK/d-out" >"$WORK/d.log" 2>&1; rc=$?; set -e
check "secret only in prompt exits 0" test "$rc" -eq 0
check "prompt secret not in payload" payload_lacks "$WORK/d-out" "AKIA"

# 4. Already-pushed chunks are skipped; nothing new exits 3.
make_store "$WORK/e" eeee5555 "learning" "p"
echo eeee5555 > "$WORK/e/pushed"
set +e; python3 "$SANITIZE" --src "$WORK/e/.engram" --out "$WORK/e-out" --pushed "$WORK/e/pushed" >"$WORK/e.log" 2>&1; rc=$?; set -e
check "nothing new exits 3" test "$rc" -eq 3

# 5. Optional end-to-end: the sanitized bundle imports with no prompts.
if [[ -n "${ENGRAM_BIN:-}" ]]; then
  mkdir -p "$WORK/home"
  if ! (cd "$WORK/a-out" && HOME="$WORK/home" "$ENGRAM_BIN" sync --import >"$WORK/import.log" 2>&1); then
    fail "real engram import ran"; cat "$WORK/import.log" >&2
  fi
  stats="$(HOME="$WORK/home" "$ENGRAM_BIN" stats --project shift-desoc 2>&1)"
  check "real engram imports 1 observation" grep -qE "Observations: +1" <<<"$stats"
  check "real engram imports 0 prompts" grep -qE "Prompts: +0" <<<"$stats"
else
  echo "skip - real engram import (set ENGRAM_BIN)"
fi

[[ $failures -eq 0 ]] && echo "all passed" || { echo "$failures failed" >&2; exit 1; }
