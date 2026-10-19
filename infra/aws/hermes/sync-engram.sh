#!/usr/bin/env bash
# Send important local Engram learnings to the Hermes agent on AWS.
#
# Occasional and manual. Hermes owns its memory store (/opt/data/.engram) and
# learns from every merge by itself (shift-post-merge-learning); use this only
# for a learning that happened outside the dev loop, e.g. a local debugging or
# infrastructure session.
#
# Memories never go through git: .engram/ is local-only (gitignored). Chunks
# carry verbatim prompts and local paths, are gzipped (invisible to PR diffs and
# to the gitleaks pre-commit hook) and would persist in public history.
#
# 1. `engram sync` exports memories not yet exported as a new local chunk in
#    .engram/ (project shift-desoc only).
# 2. engram-sanitize.py builds a bundle of the chunks not yet sent: prompts
#    dropped, session directories blanked, the whole decoded payload scanned.
# 3. gitleaks scans the same decoded payload again.
# 4. You confirm what is about to be sent.
# 5. The bundle is imported into the agent's store over SSM-tunnelled SSH
#    (IAM-authenticated, encrypted, no open ports), from a temp dir in the
#    container. Sent chunk ids are recorded in .engram/.pushed-to-hermes.
#
# Requires: engram, python3, gitleaks, an interactive terminal, and
# `ssh shift-hermes` (ssh-setup.sh).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$HERE/../../.." && pwd)"
cd "$REPO_ROOT"

for tool in engram python3 gitleaks; do
  command -v "$tool" >/dev/null || {
    echo "$tool is required (gitleaks: brew install gitleaks, or see github.com/gitleaks/gitleaks)" >&2
    exit 1
  }
done
[[ -r /dev/tty ]] || { echo "sync-engram.sh needs an interactive terminal to confirm" >&2; exit 1; }

# Capture the export first so a failed `engram sync` stops the script; the
# filter (which may legitimately match nothing) only runs on its output.
export_out="$(engram sync)" || { echo "engram sync (export) failed" >&2; exit 1; }
grep -vE 'Update available|brew|go install|Add to git|git add|git commit' <<<"$export_out" || true

pushed=".engram/.pushed-to-hermes"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

rc=0
python3 "$HERE/engram-sanitize.py" --src .engram --out "$work/bundle" --pushed "$pushed" || rc=$?
case "$rc" in
  0) ;;
  3) exit 0 ;;   # nothing new to send
  *) exit 1 ;;   # possible secret (2) or error: the sanitizer already explained
esac

if ! gitleaks detect --no-git --no-banner --redact --config "$HERE/engram-gitleaks.toml" --source "$work/bundle/decoded" >"$work/gitleaks.log" 2>&1; then
  echo "gitleaks flagged the payload; nothing was sent:" >&2
  cat "$work/gitleaks.log" >&2
  exit 1
fi
echo "gitleaks: no leaks found in the decoded payload."

echo
read -r -p "Send these learnings to Hermes? [y/N] " answer </dev/tty
[[ "$answer" =~ ^[yY]$ ]] || { echo "Aborted; nothing was sent."; exit 1; }

COPYFILE_DISABLE=1 tar --no-xattrs -czf - -C "$work/bundle" .engram \
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

python3 -c 'import json,sys; [print(c["id"]) for c in json.load(open(sys.argv[1]))["chunks"]]' \
  "$work/bundle/.engram/manifest.json" >>"$pushed"
echo "Sent. Recorded in $pushed (local only; .engram/ is never committed)."
