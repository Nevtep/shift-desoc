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

engram sync | grep -vE 'Update available|brew|go install' || true

COPYFILE_DISABLE=1 tar --no-xattrs -czf - .engram/manifest.json .engram/config.json .engram/chunks 2>/dev/null \
  | ssh shift-hermes '
    set -e
    tmp=$(mktemp -d)
    tar -xzf - -C "$tmp"
    sudo docker exec shift-hermes rm -rf /tmp/engram-sync
    sudo docker cp "$tmp" shift-hermes:/tmp/engram-sync
    sudo docker exec -u 0 shift-hermes chown -R hermes:hermes /tmp/engram-sync
    sudo docker exec -u hermes -e HOME=/opt/data -w /tmp/engram-sync shift-hermes \
      bash -c "engram sync --import; engram projects list; rm -rf /tmp/engram-sync" \
      | grep -vE "Update available|brew|go install|To update"
    rm -rf "$tmp"'

echo
git status --short .engram
echo "Review the new chunk(s), then: git add .engram && git commit -m 'chore(engram): sync memories'"
