#!/usr/bin/env bash
# Push local Engram memories for Shift to the Hermes agent on AWS.
#
# 1. `engram sync` exports memories not yet synced as a new chunk in .engram/
#    (project shift-desoc only; other local projects are never included).
# 2. The chunks are imported into the agent's store from a temp dir in the
#    container (never the agent's main checkout). Import is idempotent:
#    already-imported chunks are skipped.
# 3. Commit .engram/ afterwards so future bootstraps from main also have them.
#    The repo is public: review new chunks before pushing.
#
# Requires: engram locally, and `ssh shift-hermes` (ssh-setup.sh).
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$REPO_ROOT"

# Capture the export first so a failed `engram sync` stops the script; the
# filter (which may legitimately match nothing) only runs on its output.
export_out="$(engram sync)" || { echo "engram sync (export) failed" >&2; exit 1; }
grep -vE 'Update available|brew|go install' <<<"$export_out" || true

COPYFILE_DISABLE=1 tar --no-xattrs -czf - .engram/manifest.json .engram/config.json .engram/chunks 2>/dev/null \
  | ssh shift-hermes '
    set -euo pipefail
    tmp=$(mktemp -d)
    trap "rm -rf \"$tmp\"" EXIT
    tar -xzf - -C "$tmp"
    sudo docker exec shift-hermes rm -rf /tmp/engram-sync
    sudo docker cp "$tmp" shift-hermes:/tmp/engram-sync
    sudo docker exec -u 0 shift-hermes chown -R hermes:hermes /tmp/engram-sync
    # Fail fast inside the container: a failed import keeps /tmp/engram-sync for
    # inspection. Capture the output before filtering so the pipeline cannot
    # report the grep status instead of the docker one.
    import_out=$(sudo docker exec -u hermes -e HOME=/opt/data -w /tmp/engram-sync shift-hermes \
      bash -c "set -euo pipefail; engram sync --import; engram projects list; rm -rf /tmp/engram-sync")
    grep -vE "Update available|brew|go install|To update" <<<"$import_out" || true'

echo
git status --short .engram
echo "Review the new chunk(s), then: git add .engram && git commit -m 'chore(engram): sync memories'"
