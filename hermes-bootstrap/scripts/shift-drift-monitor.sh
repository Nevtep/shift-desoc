#!/usr/bin/env bash
# Hermes cron MONITOR script for the "Shift drift to PR" job.
#
# Finds durable work that Hermes created on the server (the persistent volume)
# but that is not versioned in the repository, so it would be lost on a server
# migration:
#   - skills created under $HERMES_HOME/skills that the repo does not ship
#     (Hermes bundled and hub skills are ignored)
#   - Remotion reel template files under $HERMES_HOME/shift-reels that are new
#     or changed compared with hermes-bootstrap/shift-reels in the main checkout
#
# Hermes hashes stdout on every tick and only wakes the agent when it changes,
# so the output is stable: each drifted file carries a short content hash.
# Files that look like secrets or are large are reported as SKIPPED and never
# handed over (the repository is public). While a drift PR is open the monitor
# stays quiet so only one is ever pending.
set -euo pipefail
export HOME="${HOME:-/opt/data}"
HERMES_HOME="${HERMES_HOME:-/opt/data}"
REPO="${SHIFT_REPO_FULL_NAME:-Nevtep/shift-desoc}"
REPO_DIR="${SHIFT_REPO_DIR:-/workspace/shift}"
SKILLS="$HERMES_HOME/skills"
REELS="${SHIFT_REELS_DIR:-$HERMES_HOME/shift-reels}"
REPO_BOOT="$REPO_DIR/hermes-bootstrap"
MAX_BYTES="${SHIFT_DRIFT_MAX_BYTES:-1048576}"
SECRET_RE='sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|[0-9]{8,}:[A-Za-z0-9_-]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY|(password|passwd|secret|token|api[_-]?key)["'"'"' ]*[:=]["'"'"' ]*[A-Za-z0-9/+_-]{16,}'

short() { shasum -a 256 "$1" | cut -c1-8; }
drift=(); skipped=()

consider() { # <kind> <label> <file>
  local kind="$1" label="$2" file="$3"
  if [[ "$(wc -c <"$file" | tr -d ' ')" -gt "$MAX_BYTES" ]]; then skipped+=("$label (larger than $MAX_BYTES bytes)"); return; fi
  if grep -qIE "$SECRET_RE" "$file" 2>/dev/null; then skipped+=("$label (looks like it contains a secret)"); return; fi
  drift+=("$kind $label $(short "$file")")
}

if [[ ! -d "$REPO_BOOT" ]]; then
  echo "STATUS=ERROR"; echo "REASON=main checkout $REPO_BOOT not found; nothing compared"; exit 0
fi

# An open drift PR means the work is already on its way: stay quiet.
if open_pr="$(gh pr list --repo "$REPO" --state open --search 'head:chore/drift-' \
      --json number,headRefName --jq '[.[]|select(.headRefName|startswith("chore/drift-"))][0].number // empty' 2>/dev/null)" \
   && [[ -n "$open_pr" ]]; then
  echo "STATUS=OK"; echo "DRIFT: (none)"; echo "NOTE=drift PR #$open_pr already open"; exit 0
fi

# --- skills ---------------------------------------------------------------
bundled=""
[[ -f "$SKILLS/.bundled_manifest" ]] && bundled="$(cut -d: -f1 "$SKILLS/.bundled_manifest")"
if [[ -d "$SKILLS" ]]; then
  while IFS= read -r sk; do
    name="$(basename "$sk")"
    grep -qx -- "$name" <<<"$bundled" && continue
    [[ -f "$REPO_BOOT/skills/$name/SKILL.md" || -f "$REPO_BOOT/content-skills/$name/SKILL.md" ]] && continue
    while IFS= read -r f; do
      consider skill "${f#"$SKILLS"/}" "$f"
    done < <(find "$sk" -type f | sort)
  done < <(find "$SKILLS" -mindepth 1 -maxdepth 3 -type d -not -path "*/.*" -exec test -f '{}/SKILL.md' ';' -print | sort)
fi

# --- reel template --------------------------------------------------------
if [[ -d "$REELS" ]]; then
  while IFS= read -r f; do
    rel="${f#"$REELS"/}"
    case "$rel" in
      node_modules/*|specs/*|public/reels/*|outputs/*|package-lock.json|.last_intro_style|public/music/*.mp3) continue ;;
    esac
    if [[ -f "$REPO_BOOT/shift-reels/$rel" ]] && cmp -s "$f" "$REPO_BOOT/shift-reels/$rel"; then continue; fi
    consider reel-template "shift-reels/$rel" "$f"
  done < <(find "$REELS" -type f | sort)
fi

echo "STATUS=OK"
echo "DRIFT:"
if [[ ${#drift[@]} -eq 0 ]]; then echo "- (none)"; else printf -- '- %s\n' "${drift[@]}"; fi
if [[ ${#skipped[@]} -gt 0 ]]; then echo "SKIPPED:"; printf -- '- %s\n' "${skipped[@]}"; fi
exit 0
