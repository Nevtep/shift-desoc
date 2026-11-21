#!/usr/bin/env bash
# Persist uncommitted skill edits from the live Hermes checkout as a PR.
#
# Hermes loads its skills from the live checkout (skills.external_dirs), and its
# own skill editing writes there, so an edit can sit uncommitted: lost at the
# next reset, or live without review. This monitor, called from the merge
# watcher, turns such an edit into a reviewable PR and then restores the
# checkout. It never merges and never restores before the push is verified.
#
# Output (stdout, stable, nothing when idle):
#   SKILL_PERSIST=PR_OPENED #<n> files=<k>
#   SKILL_PERSIST=ALREADY_PROPOSED #<n>
#   SKILL_PERSIST=FAILED <reason>      (the checkout is left untouched)
# Everything else goes to $STATE_DIR/skill-persist.log.
set -euo pipefail
export HOME="${HOME:-/opt/data}"
REPO_DIR="${SHIFT_REPO_DIR:-/workspace/shift}"
STATE_DIR="${SHIFT_STATE_DIR:-/opt/data/shift}"
QUIET_MIN="${SHIFT_SKILL_PERSIST_QUIET_MIN:-10}"
[[ "$QUIET_MIN" =~ ^[0-9]+$ ]] || QUIET_MIN=10
PATHS=(hermes-bootstrap/skills .github/skills)
OUT_DIR="$STATE_DIR/skill-persist"
LOCK="$STATE_DIR/dev-loop.lock"

mkdir -p "$STATE_DIR"
exec 2>>"$STATE_DIR/skill-persist.log"
umask 077

say() { echo "SKILL_PERSIST=$*"; }
mtime() { stat -c %Y "$1" 2>/dev/null || stat -f %m "$1"; }
sha() { if command -v sha256sum >/dev/null 2>&1; then sha256sum; else shasum -a 256; fi; }

[[ -d "$REPO_DIR/.git" || -f "$REPO_DIR/.git" ]] || exit 0
cd "$REPO_DIR"

# A development cycle is running: it owns the checkout. A lock older than 4 h
# is stale (same rule as the dev loop monitor).
if [[ -f "$LOCK" ]]; then
  (( $(date +%s) - $(mtime "$LOCK") < 4 * 3600 )) && exit 0
fi

tracked=(); fresh=()
while IFS= read -r -d '' f; do tracked+=("$f"); done < <(git diff HEAD --name-only -z -- "${PATHS[@]}")
while IFS= read -r -d '' f; do fresh+=("$f"); done < <(git ls-files --others --exclude-standard -z -- "${PATHS[@]}")
count=$(( ${#tracked[@]} + ${#fresh[@]} ))
(( count > 0 )) || exit 0

# Leave a half-finished edit alone until it has settled.
now="$(date +%s)"; newest=0
for f in ${tracked[@]+"${tracked[@]}"} ${fresh[@]+"${fresh[@]}"}; do
  [[ -e "$f" ]] || continue
  t="$(mtime "$f")"; (( t > newest )) && newest="$t"
done
(( newest == 0 || now - newest >= QUIET_MIN * 60 )) || exit 0

# One patch (modified, deleted and new files) built with a throwaway index, so
# the live index is never touched.
mkdir -p "$OUT_DIR"
tmp_index="$(mktemp "$OUT_DIR/index.XXXXXX")"
trap 'rm -f "$tmp_index"' EXIT
cp "$(git rev-parse --git-path index)" "$tmp_index"
GIT_INDEX_FILE="$tmp_index" git add -A -- "${PATHS[@]}"
patch_tmp="$(mktemp "$OUT_DIR/patch.XXXXXX")"
GIT_INDEX_FILE="$tmp_index" git diff --cached --binary HEAD -- "${PATHS[@]}" >"$patch_tmp"
[[ -s "$patch_tmp" ]] || { rm -f "$patch_tmp"; exit 0; }
hash="$(sha <"$patch_tmp" | cut -c1-64)"; h12="${hash:0:12}"
patch="$OUT_DIR/$h12.patch"
mv "$patch_tmp" "$patch"; chmod 600 "$patch"   # the backup exists before anything else happens

restore_checkout() {
  git reset -q HEAD -- "${PATHS[@]}" 2>/dev/null || true
  for f in ${tracked[@]+"${tracked[@]}"}; do git checkout -q HEAD -- "$f"; done
  for f in ${fresh[@]+"${fresh[@]}"}; do rm -f -- "$f"; rmdir "$(dirname "$f")" 2>/dev/null || true; done
}

marker="$OUT_DIR/$h12.pr"
if [[ -f "$marker" ]]; then
  restore_checkout
  say "ALREADY_PROPOSED #$(cat "$marker")"
  exit 0
fi

branch="chore/hermes-self-update/skill-edit-$h12"
wt="$OUT_DIR/wt-$h12"
cleanup_wt() { git worktree remove --force "$wt" 2>/dev/null || true; }
failed() { cleanup_wt; say "FAILED $1"; exit 0; }
trap 'rm -f "$tmp_index"; cleanup_wt' EXIT

git fetch -q origin main || failed "fetch failed"
cleanup_wt
git worktree add -q -B "$branch" "$wt" origin/main || failed "worktree failed"
git -C "$wt" apply --index "$patch" || failed "patch does not apply to origin/main"

files="$(git -C "$wt" diff --cached --name-only | sed 's/^/- /')"
git -C "$wt" commit -q -m "chore(hermes): persist in-place skill edits

Captured automatically from uncommitted changes in the live Hermes checkout.

$files

Risk: low (skill text only; reviewed through this PR before it goes live)" || failed "commit failed"
# The branch name is derived from the content hash and owned by this monitor, so
# a retry after a later failure may overwrite its own earlier push.
git -C "$wt" push -q --force origin "$branch" || failed "push failed"
[[ "$(git -C "$wt" ls-remote origin "refs/heads/$branch" | cut -f1)" == "$(git -C "$wt" rev-parse HEAD)" ]] \
  || failed "remote branch does not match the commit"

body="$OUT_DIR/$h12.body"
cat >"$body" <<EOF
## What

Uncommitted skill changes found in the live Hermes checkout were captured automatically by \`shift-skill-persist.sh\` and restored out of the checkout, so they are reviewed before they go live. Nothing was merged.

Files:

$files

## Needs

- A Linear issue (project Automation) cited here, as \`shift-learning-governance\` requires; Hermes creates it when it reads the \`SKILL_PERSIST\` line.
- Human review. The previous content of the checkout is backed up on the Hermes host under \`/opt/data/shift/skill-persist/$h12.patch\`.
EOF
repo_args=(); [[ -n "${SHIFT_REPO_FULL_NAME:-}" ]] && repo_args=(--repo "$SHIFT_REPO_FULL_NAME")
# Reuse an open PR for this branch (an earlier run may have created it before it
# could write its marker) instead of opening a duplicate.
num="$(cd "$wt" && gh pr list --head "$branch" --state open --json number --jq '.[0].number // empty' \
  ${repo_args[@]+"${repo_args[@]}"} 2>/dev/null || true)"
if [[ ! "$num" =~ ^[0-9]+$ ]]; then
  url="$(cd "$wt" && gh pr create --base main --head "$branch" \
    --title "chore(hermes): persist in-place skill edits ($count files)" --body-file "$body" \
    ${repo_args[@]+"${repo_args[@]}"})" || failed "gh pr create failed"
  num="${url##*/}"; [[ "$num" =~ ^[0-9]+$ ]] || num="?"
fi
echo "$num" >"$marker"

restore_checkout
say "PR_OPENED #$num files=$count"
