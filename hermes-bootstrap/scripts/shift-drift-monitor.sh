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
#
# Reel template files are compared against the baseline that
# shift-reels-setup.sh recorded when it installed them (.shift-template-baseline):
# a file still equal to its baseline is an untouched older copy (the next boot
# refreshes it, so it is not drift); a file that differs is a server-side edit.
# When the repo also changed that file since the baseline, it is reported as
# reel-template-conflict so the PR does not silently revert the approved version.
# Per-post material (examples/<slug>/, specs, backgrounds) is never template.
#
# If the same drift stays unpublished, RETRY_ROUND advances once per schedule
# tick (6 h) so the agent is woken again; after MAX_ROUNDS the output switches
# to RETRY_EXHAUSTED=1 so the agent reports it to a human instead of looping.
# State: STATE_DIR/drift.sig = "<signature>\t<first-seen-epoch>".
set -euo pipefail
sha() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$@"; else shasum -a 256 "$@"; fi; }
export HOME="${HOME:-/opt/data}"
HERMES_HOME="${HERMES_HOME:-/opt/data}"
REPO="${SHIFT_REPO_FULL_NAME:-Nevtep/shift-desoc}"
REPO_DIR="${SHIFT_REPO_DIR:-/workspace/shift}"
SKILLS="$HERMES_HOME/skills"
REELS="${SHIFT_REELS_DIR:-$HERMES_HOME/shift-reels}"
REPO_BOOT="$REPO_DIR/hermes-bootstrap"
MAX_BYTES="${SHIFT_DRIFT_MAX_BYTES:-1048576}"
STATE_DIR="${SHIFT_STATE_DIR:-$HERMES_HOME/shift}"
TICK_SECONDS="${SHIFT_DRIFT_TICK_SECONDS:-21600}"
MAX_ROUNDS="${SHIFT_DRIFT_RETRY_ROUNDS:-4}"
SECRET_RE='sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|[0-9]{8,}:[A-Za-z0-9_-]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY|(password|passwd|secret|token|api[_-]?key)["'"'"' ]*[:=]["'"'"' ]*[A-Za-z0-9/+_-]{16,}'

short() { sha "$1" | cut -c1-8; }
drift=(); skipped=()

consider() { # <kind> <label> <file>
  local kind="$1" label="$2" file="$3"
  if [[ "$(wc -c <"$file" | tr -d ' ')" -gt "$MAX_BYTES" ]]; then skipped+=("$label (larger than $MAX_BYTES bytes)"); return; fi
  if grep -qIiE "$SECRET_RE" "$file" 2>/dev/null; then skipped+=("$label (looks like it contains a secret)"); return; fi
  drift+=("$kind $label $(short "$file")")
}

if [[ ! -d "$REPO_BOOT" ]]; then
  echo "STATUS=ERROR"; echo "REASON=main checkout $REPO_BOOT not found; nothing compared"; exit 0
fi

# An open drift PR means the work is already on its way: stay quiet. If the
# query itself fails the guard cannot be evaluated, so hand nothing over.
if ! open_pr="$(gh pr list --repo "$REPO" --state open --search 'head:chore/drift-' \
      --json number,headRefName --jq '[.[]|select(.headRefName|startswith("chore/drift-"))][0].number // empty' 2>/dev/null)"; then
  echo "STATUS=ERROR"; echo "REASON=gh pr list failed (auth or network); drift not handed over"; exit 0
fi
mkdir -p "$STATE_DIR"
if [[ -n "$open_pr" ]]; then
  rm -f "$STATE_DIR/drift.sig"
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
BASELINE="$REELS/.shift-template-baseline"
if [[ -d "$REELS" ]]; then
  while IFS= read -r f; do
    rel="${f#"$REELS"/}"
    case "$rel" in
      node_modules/*|specs/*|public/reels/*|outputs/*|examples/*|.shift-template-baseline|package-lock.json|.last_intro_style|public/music/*.mp3) continue ;;
    esac
    vh="$(sha "$f" | cut -d' ' -f1)"
    rh=""; [[ -f "$REPO_BOOT/shift-reels/$rel" ]] && rh="$(sha "$REPO_BOOT/shift-reels/$rel" | cut -d' ' -f1)"
    bh=""; [[ -f "$BASELINE" ]] && bh="$(awk -v p="$rel" '{ h=$1; $1=""; sub(/^ /,""); if ($0==p) print h }' "$BASELINE")"
    [[ -n "$rh" && "$vh" == "$rh" ]] && continue          # identical to the repo
    [[ -n "$bh" && "$vh" == "$bh" ]] && continue          # untouched older copy
    kind=reel-template
    [[ -n "$bh" && -n "$rh" && "$rh" != "$bh" ]] && kind=reel-template-conflict
    consider "$kind" "shift-reels/$rel" "$f"
  done < <(find "$REELS" -type f | sort)
fi

echo "STATUS=OK"
echo "DRIFT:"
if [[ ${#drift[@]} -eq 0 ]]; then
  echo "- (none)"
  rm -f "$STATE_DIR/drift.sig"
else
  printf -- '- %s\n' "${drift[@]}"
fi
if [[ ${#skipped[@]} -gt 0 ]]; then echo "SKIPPED:"; printf -- '- %s\n' "${skipped[@]}"; fi
if [[ ${#drift[@]} -gt 0 ]]; then
  sig="$(printf '%s\n' "${drift[@]}" | sha | cut -c1-16)"
  now="$(date +%s)"; first="$now"
  if [[ -f "$STATE_DIR/drift.sig" ]] && [[ "$(cut -f1 "$STATE_DIR/drift.sig")" == "$sig" ]]; then
    first="$(cut -f2 "$STATE_DIR/drift.sig")"
  else
    printf '%s\t%s\n' "$sig" "$now" >"$STATE_DIR/drift.sig"
  fi
  round=$(( (now - first) / TICK_SECONDS ))
  if (( round >= MAX_ROUNDS )); then echo "RETRY_EXHAUSTED=1"; else echo "RETRY_ROUND=$round"; fi
fi
exit 0
