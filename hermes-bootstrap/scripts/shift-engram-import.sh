#!/usr/bin/env bash
# Import the Engram memory chunks committed to the Shift checkout (.engram/)
# into the agent's Engram store, so learnings that teammates merge into main
# reach Hermes without SSH (see infra/aws/hermes/README.md).
#
# Idempotent: engram skips chunks it already imported. The import runs from a
# temp copy, never inside the checkout, so the agent's main checkout is not
# mutated. Called by shift-merge-watch.sh after it syncs the checkout and by
# the shift-post-merge-learning skill.
#
# Usage: shift-engram-import.sh [<repo-dir>]   (default: $SHIFT_REPO_DIR)
# Prints ENGRAM_IMPORT=OK|SKIPPED|ERROR as the last line; exits non-zero on ERROR.
set -euo pipefail
export HOME="${HOME:-/opt/data}"
repo_dir="${1:-${SHIFT_REPO_DIR:-/workspace/shift}}"
src="$repo_dir/.engram"

if [[ ! -f "$src/manifest.json" ]]; then
  echo "ENGRAM_IMPORT=SKIPPED (no .engram/manifest.json in $repo_dir)"
  exit 0
fi
if ! command -v engram >/dev/null 2>&1; then
  echo "ENGRAM_IMPORT=ERROR (engram is not installed)"
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/.engram"
cp "$src/manifest.json" "$tmp/.engram/"
[[ -f "$src/config.json" ]] && cp "$src/config.json" "$tmp/.engram/"
[[ -d "$src/chunks" ]] && cp -R "$src/chunks" "$tmp/.engram/"

# Capture before filtering so a failed import is not masked by grep's status.
if ! out="$(cd "$tmp" && engram sync --import 2>&1)"; then
  printf '%s\n' "$out"
  echo "ENGRAM_IMPORT=ERROR (engram sync --import failed)"
  exit 1
fi
grep -vE 'Update available|brew|go install|To update|^$' <<<"$out" || true
echo "ENGRAM_IMPORT=OK"
