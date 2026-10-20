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
import os
if os.environ.get("MUTATIONS"):
    rec["mutations"] = json.loads(os.environ["MUTATIONS"])
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

# 2b. Shapes that hide from a scan of the JSON text or need context.
mn="abandon ability able about above absent absorb abstract absurd abuse access accident"
for content in 'password: "Zx9Qw3Er7Ty1Ui5Op2As8"' "deployer key $(printf 'b%.0s' {1..64})" \
               "deployer:$(printf 'd%.0s' {1..64})" "mnemonic: $mn"; do
  make_store "$WORK/q" qqqq0000 "$content" "fine"
  set +e; python3 "$SANITIZE" --src "$WORK/q/.engram" --out "$WORK/q-out" >"$WORK/q.log" 2>&1; rc=$?; set -e
  check "blocks ${content:0:24}…" test "$rc" -eq 2
  rm -rf "$WORK/q" "$WORK/q-out"
done
make_store "$WORK/h" hhhh0000 "review target sha256:$(printf 'c%.0s' {1..64}) approved" "fine"
set +e; python3 "$SANITIZE" --src "$WORK/h/.engram" --out "$WORK/h-out" >"$WORK/h.log" 2>&1; rc=$?; set -e
check "sha256:<hex> digests are not flagged" test "$rc" -eq 0

# 2c. Mutations: prompt mutations dropped, session paths blanked, relations kept.
MUTATIONS='[{"entity":"prompt","entity_key":"prompt-9","op":"upsert","payload":"{\"content\":\"secret prompt text\"}"},
 {"entity":"session","entity_key":"s1","op":"upsert","payload":"{\"id\":\"s1\",\"directory\":\"/Users/someone/Code/shift\"}"},
 {"entity":"relation","entity_key":"rel-f08931f2509fff87","op":"upsert","payload":"{\"source_id\":\"obs-1\"}"}]' \
  make_store "$WORK/m" mmmm0000 "learning" "p"
set +e; python3 "$SANITIZE" --src "$WORK/m/.engram" --out "$WORK/m-out" >"$WORK/m.log" 2>&1; rc=$?; set -e
check "chunk with mutations exits 0" test "$rc" -eq 0
check "prompt mutation dropped" payload_lacks "$WORK/m-out" "secret prompt text"
check "session mutation directory blanked" payload_lacks "$WORK/m-out" "/Users/someone"
check "relation mutation kept" payload_has "$WORK/m-out" "rel-f08931f2509fff87"

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

# 4a. An existing --out directory is refused, so cleanup can never delete it.
make_store "$WORK/o" oooo0000 "learning" "p"
mkdir -p "$WORK/o-out" && echo keep >"$WORK/o-out/unrelated.txt"
set +e; python3 "$SANITIZE" --src "$WORK/o/.engram" --out "$WORK/o-out" >"$WORK/o.log" 2>&1; rc=$?; set -e
check "existing --out is refused" test "$rc" -eq 1
check "existing --out content untouched" test -f "$WORK/o-out/unrelated.txt"

# 4a'. Manifest and config metadata are scanned and rebuilt from known fields.
jwt2="eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJtZXRhZGF0YSJ9.c2lnbmF0dXJlLXNpZ25hdHVyZQ"
make_store "$WORK/t" tttt0000 "learning" "p"
python3 - "$WORK/t/.engram/manifest.json" "$jwt2" <<'PY'
import json, sys
m = json.load(open(sys.argv[1])); m["chunks"][0]["created_by"] = sys.argv[2]; json.dump(m, open(sys.argv[1], "w"))
PY
set +e; python3 "$SANITIZE" --src "$WORK/t/.engram" --out "$WORK/t-out" >"$WORK/t.log" 2>&1; rc=$?; set -e
check "secret in manifest metadata exits 2" test "$rc" -eq 2
make_store "$WORK/u" uuuu0000 "learning" "p"
python3 - "$WORK/u/.engram/config.json" "$jwt2" <<'PY'
import json, sys
json.dump({"project_name": "shift-desoc", "extra": sys.argv[2]}, open(sys.argv[1], "w"))
PY
set +e; python3 "$SANITIZE" --src "$WORK/u/.engram" --out "$WORK/u-out" >"$WORK/u.log" 2>&1; rc=$?; set -e
check "secret in config exits 2" test "$rc" -eq 2
make_store "$WORK/v" vvvv0000 "learning" "p"
python3 - "$WORK/v/.engram/config.json" <<'PY'
import json, sys
json.dump({"project_name": "shift-desoc", "unknown_field": "x"}, open(sys.argv[1], "w"))
PY
python3 "$SANITIZE" --src "$WORK/v/.engram" --out "$WORK/v-out" >"$WORK/v.log" 2>&1
check "config rebuilt with project_name only" bash -c "python3 -c 'import json,sys; sys.exit(0 if json.load(open(sys.argv[1]))==dict(project_name=\"shift-desoc\") else 1)' '$WORK/v-out/.engram/config.json'"
check "metadata included in gitleaks input" bash -c "grep -q shift-desoc '$WORK'/v-out/decoded/*metadata*"

# 4b. A flagged chunk can be discarded locally so later syncs are not blocked.
make_store "$WORK/x" xxxx0000 "leak AKIAABCDEFGHIJKLMNOP" "p"
python3 "$SANITIZE" --src "$WORK/x/.engram" --discard xxxx0000 >"$WORK/x.log" 2>&1
check "discard removes the chunk file" test ! -e "$WORK/x/.engram/chunks/xxxx0000.jsonl.gz"
check "discard removes the manifest entry" bash -c "! grep -q xxxx0000 '$WORK/x/.engram/manifest.json'"
set +e; python3 "$SANITIZE" --src "$WORK/x/.engram" --out "$WORK/x-out" >"$WORK/x2.log" 2>&1; rc=$?; set -e
check "after discard nothing is left to send" test "$rc" -eq 3

# 5. gitleaks (when installed) with the bundle config: Engram's own relation ids
#    are not flagged, a real-looking key still is.
if command -v gitleaks >/dev/null; then
  GL_CONFIG="$HERE/engram-gitleaks.toml"
  mkdir -p "$WORK/gl-ok" "$WORK/gl-bad"
  printf '{"mutations":[{"entity":"relation","entity_key":"rel-f08931f2509fff87","op":"upsert"}]}\n' >"$WORK/gl-ok/c.jsonl"
  printf '{"observations":[{"content":"token ghp_8fK2mQ9xLp4ZrT6vW1yB3nC7dE5gH0jA2sUi"}]}\n' >"$WORK/gl-bad/c.jsonl"
  check "gitleaks config exists" test -f "$GL_CONFIG"
  check "gitleaks config loads" bash -c "gitleaks detect --no-git --no-banner --config '$GL_CONFIG' --source '$WORK/gl-ok' >/dev/null 2>&1"
  check "gitleaks ignores Engram relation ids" \
    gitleaks detect --no-git --no-banner --config "$GL_CONFIG" --source "$WORK/gl-ok" --exit-code 1
  check "gitleaks still flags a GitHub token" \
    bash -c "! gitleaks detect --no-git --no-banner --config '$GL_CONFIG' --source '$WORK/gl-bad' --exit-code 1 >/dev/null 2>&1"
else
  echo "skip - gitleaks checks (gitleaks not installed)"
fi

# 6. Optional end-to-end: the sanitized bundle imports with no prompts.
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
