#!/usr/bin/env bash
# Tests for shift-engram-import.sh and its use by shift-merge-watch.sh.
#
#   hermes-bootstrap/tests/engram-import.test.sh
#
# By default `engram` is a stub that records where it ran and what it saw.
# Set ENGRAM_BIN to a real engram binary (e.g. the 1.20.0 release pinned in
# docker/Dockerfile.hermes) to also run the end-to-end import case against a
# real, throwaway Engram store.
set -euo pipefail
SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")/../scripts" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
failures=0

pass() { echo "ok   - $1"; }
fail() { echo "FAIL - $1" >&2; failures=$((failures + 1)); }
check() { local name="$1"; shift; if "$@"; then pass "$name"; else fail "$name"; fi; }

# --- fixtures ---------------------------------------------------------------

make_chunk() { # <dir> <id>
  mkdir -p "$1/.engram/chunks"
  printf '{"sessions":[],"observations":[],"prompts":[]}\n' | gzip > "$1/.engram/chunks/$2.jsonl.gz"
}

write_manifest() { # <dir> <id>...
  local dir="$1"; shift
  {
    printf '{"version":2,"chunks":['
    local first=1 id
    for id in "$@"; do
      (( first )) || printf ','
      first=0
      printf '{"id":"%s","created_by":"test","created_at":"2026-10-19T00:00:00Z","sessions":0,"memories":0,"prompts":0}' "$id"
    done
    printf ']}\n'
  } > "$dir/.engram/manifest.json"
  printf '{"project_name":"shift-desoc"}\n' > "$dir/.engram/config.json"
}

# Stub engram: records the cwd and the chunks it was offered, then succeeds.
STUB_BIN="$WORK/stub-bin"
mkdir -p "$STUB_BIN"
cat > "$STUB_BIN/engram" <<'SH'
#!/usr/bin/env bash
{
  echo "args=$*"
  echo "cwd=$PWD"
  echo "chunks=$(ls .engram/chunks 2>/dev/null | tr '\n' ' ')"
} >> "$ENGRAM_STUB_LOG"
echo "Update available: 1.20.0 -> 3.4.0"
echo "Imported N new chunk(s) from .engram/"
SH
chmod +x "$STUB_BIN/engram"

# Stub gh: one merged PR.
cat > "$STUB_BIN/gh" <<'SH'
#!/usr/bin/env bash
printf '42\tabc1234\timp/SHI-1/x\tAdd a memory chunk\n'
SH
chmod +x "$STUB_BIN/gh"

tree_digest() { (cd "$1" && find . -path ./.git -prune -o -type f -print | sort | xargs shasum) ; }

# --- shift-engram-import.sh -------------------------------------------------

# 1. Imports from a temp copy, never inside the checkout, and leaves it intact.
repo="$WORK/repo1"
mkdir -p "$repo"
make_chunk "$repo" aaaa1111
make_chunk "$repo" bbbb2222
write_manifest "$repo" aaaa1111 bbbb2222
before="$(tree_digest "$repo")"
export ENGRAM_STUB_LOG="$WORK/stub1.log"
out="$(PATH="$STUB_BIN:$PATH" HOME="$WORK/home" bash "$SCRIPTS/shift-engram-import.sh" "$repo")"
check "import runs engram sync --import" grep -q '^args=sync --import$' "$ENGRAM_STUB_LOG"
ran_in="$(sed -n 's/^cwd=//p' "$ENGRAM_STUB_LOG")"
check "import runs outside the checkout" test "${ran_in#"$repo"}" = "$ran_in"
check "import sees every committed chunk" grep -q '^chunks=aaaa1111.jsonl.gz bbbb2222.jsonl.gz $' "$ENGRAM_STUB_LOG"
check "temp copy is removed afterwards" test ! -e "$ran_in"
check "checkout is not mutated" test "$before" = "$(tree_digest "$repo")"
check "reports ENGRAM_IMPORT=OK" grep -q '^ENGRAM_IMPORT=OK$' <<<"$out"
check "filters the update banner" bash -c '! grep -q "Update available" <<<"$1"' _ "$out"

# 2. No manifest: skipped, success, engram never called.
repo="$WORK/repo2"
mkdir -p "$repo"
export ENGRAM_STUB_LOG="$WORK/stub2.log"
out="$(PATH="$STUB_BIN:$PATH" bash "$SCRIPTS/shift-engram-import.sh" "$repo")"
check "no manifest is skipped" grep -q '^ENGRAM_IMPORT=SKIPPED' <<<"$out"
check "no manifest does not call engram" test ! -e "$ENGRAM_STUB_LOG"

# 3. engram missing: fails with a clear status. The script needs no external
# command before its engram check, so an empty PATH is deterministic.
repo="$WORK/repo1"
mkdir -p "$WORK/empty-bin"
if out="$(PATH="$WORK/empty-bin" /bin/bash "$SCRIPTS/shift-engram-import.sh" "$repo" 2>&1)"; then
  fail "missing engram fails"
else
  check "missing engram fails with ENGRAM_IMPORT=ERROR" grep -q '^ENGRAM_IMPORT=ERROR' <<<"$out"
fi

# 4. engram import fails: non-zero exit and the output is shown.
cat > "$WORK/failing-engram" <<'SH'
#!/usr/bin/env bash
echo "chunk corrupt" ; exit 3
SH
mkdir -p "$WORK/fail-bin"; mv "$WORK/failing-engram" "$WORK/fail-bin/engram"; chmod +x "$WORK/fail-bin/engram"
if out="$(PATH="$WORK/fail-bin:$PATH" bash "$SCRIPTS/shift-engram-import.sh" "$repo" 2>&1)"; then
  fail "failed import exits non-zero"
else
  check "failed import reports the engram output" grep -q 'chunk corrupt' <<<"$out"
  check "failed import reports ENGRAM_IMPORT=ERROR" grep -q '^ENGRAM_IMPORT=ERROR' <<<"$out"
fi

# --- shift-merge-watch.sh: a merged chunk reaches the agent's store ----------

origin="$WORK/origin.git"
seed="$WORK/seed"
git init -q --bare -b main "$origin"
git init -q -b main "$seed"
make_chunk "$seed" aaaa1111
write_manifest "$seed" aaaa1111
git -C "$seed" add -A
git -C "$seed" -c user.name=t -c user.email=t@t commit -qm seed
git -C "$seed" push -q "$origin" main
agent="$WORK/agent-checkout"
git clone -q "$origin" "$agent"

# A teammate's PR adding a new chunk merges into main.
make_chunk "$seed" cccc3333
write_manifest "$seed" aaaa1111 cccc3333
git -C "$seed" add -A
git -C "$seed" -c user.name=t -c user.email=t@t commit -qm "chore(engram): sync memories"
git -C "$seed" push -q "$origin" main

watch_env=(PATH="$STUB_BIN:$PATH" HOME="$WORK/home" SHIFT_STATE_DIR="$WORK/state" SHIFT_REPO_DIR="$agent")
export ENGRAM_STUB_LOG="$WORK/stub-watch.log"
out1="$(env "${watch_env[@]}" bash "$SCRIPTS/shift-merge-watch.sh")"
check "watcher syncs the checkout to the merged main" \
  test "$(git -C "$agent" rev-parse HEAD)" = "$(git -C "$seed" rev-parse HEAD)"
check "watcher imports the merged chunk" grep -q 'cccc3333.jsonl.gz' "$ENGRAM_STUB_LOG"
check "watcher writes the import log" grep -q '^ENGRAM_IMPORT=OK$' "$WORK/state/engram-import.log"
check "watcher stdout stays free of import output" bash -c '! grep -q ENGRAM_IMPORT <<<"$1"' _ "$out1"
check "watcher leaves the checkout clean" test -z "$(git -C "$agent" status --porcelain)"
out2="$(env "${watch_env[@]}" bash "$SCRIPTS/shift-merge-watch.sh")"
check "watcher output is stable across ticks" test "$out1" = "$out2"

# A failing import never breaks the monitor.
out3="$(env PATH="$WORK/fail-bin:$STUB_BIN:$PATH" HOME="$WORK/home" SHIFT_STATE_DIR="$WORK/state" \
  SHIFT_REPO_DIR="$agent" bash "$SCRIPTS/shift-merge-watch.sh")"
check "failing import keeps the monitor output" test "$out1" = "$out3"
check "failing import is logged" grep -q '^ENGRAM_IMPORT=ERROR' "$WORK/state/engram-import.log"

# The watcher finds the import in $HERMES_HOME/scripts when it runs without
# its sibling (e.g. launched from a copy).
mkdir -p "$WORK/lone" "$WORK/hermes-home/scripts"
cp "$SCRIPTS/shift-merge-watch.sh" "$WORK/lone/"
cp "$SCRIPTS/shift-engram-import.sh" "$WORK/hermes-home/scripts/"
rm -f "$WORK/state/engram-import.log"
env "${watch_env[@]}" HERMES_HOME="$WORK/hermes-home" bash "$WORK/lone/shift-merge-watch.sh" >/dev/null
check "watcher falls back to \$HERMES_HOME/scripts" grep -q '^ENGRAM_IMPORT=OK$' "$WORK/state/engram-import.log"

# --- optional: real engram end to end ---------------------------------------

if [[ -n "${ENGRAM_BIN:-}" ]]; then
  real_bin="$WORK/real-bin"; mkdir -p "$real_bin"; ln -s "$ENGRAM_BIN" "$real_bin/engram"
  real_repo="$WORK/real-repo"
  mkdir -p "$real_repo"
  cp -R "${ENGRAM_FIXTURE:-$SCRIPTS/../../.engram}" "$real_repo/.engram"
  n="$(ls "$real_repo/.engram/chunks" | wc -l | tr -d ' ')"
  out="$(PATH="$real_bin:$PATH" HOME="$WORK/real-home" bash "$SCRIPTS/shift-engram-import.sh" "$real_repo")"
  check "real engram imports all $n chunks" grep -q "Imported $n new chunk" <<<"$out"
  out="$(PATH="$real_bin:$PATH" HOME="$WORK/real-home" bash "$SCRIPTS/shift-engram-import.sh" "$real_repo")"
  check "real engram re-run is a no-op" grep -q "No new chunks to import" <<<"$out"
  check "real engram store has the project" bash -c \
    'HOME="$1" "$2" projects list 2>/dev/null | grep -q shift-desoc' _ "$WORK/real-home" "$ENGRAM_BIN"
fi

echo
if (( failures )); then echo "$failures failure(s)"; exit 1; fi
echo "all passed"
