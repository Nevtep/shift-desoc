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

# One run at a time: overlapping ticks (a slow gh) must not open two PRs or
# delete each other's worktree. A lock older than 30 minutes is stale.
RUN_LOCK="$STATE_DIR/skill-persist.lock"
tmp_index=""; wt=""; branch=""
on_exit() {
  if [[ -n "$tmp_index" ]]; then rm -f "$tmp_index"; fi
  if [[ -n "$wt" ]]; then git worktree remove --force "$wt" 2>/dev/null || true; fi
  if [[ -n "$branch" ]]; then git branch -D "$branch" >/dev/null 2>&1 || true; fi
  rmdir "$RUN_LOCK" 2>/dev/null || true
}
if ! mkdir "$RUN_LOCK" 2>/dev/null; then
  (( $(date +%s) - $(mtime "$RUN_LOCK") > 1800 )) || exit 0
  rmdir "$RUN_LOCK" 2>/dev/null || true
  mkdir "$RUN_LOCK" 2>/dev/null || exit 0
fi
trap on_exit EXIT

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
snapshot() {  # print the current skill changes as one patch; every step must succeed
  cp "$(git rev-parse --git-path index)" "$tmp_index" || return 1
  GIT_INDEX_FILE="$tmp_index" git add -A -- "${PATHS[@]}" || return 1
  GIT_INDEX_FILE="$tmp_index" git diff --cached --binary HEAD -- "${PATHS[@]}" || return 1
}
patch_tmp="$(mktemp "$OUT_DIR/patch.XXXXXX")"
# From here on $tmp_index is the frozen snapshot: it is never rebuilt, and the
# restore compares every live file against it.
snapshot >"$patch_tmp" || { rm -f "$patch_tmp"; say "FAILED snapshot failed"; exit 0; }
[[ -s "$patch_tmp" ]] || { rm -f "$patch_tmp"; exit 0; }
hash="$(sha <"$patch_tmp" | cut -c1-64)"; h12="${hash:0:12}"
patch="$OUT_DIR/$h12.patch"
mv "$patch_tmp" "$patch"; chmod 600 "$patch"   # the backup exists before anything else happens

# blob id of a path in the frozen snapshot (empty when the snapshot has no such file)
snap_blob() { GIT_INDEX_FILE="$tmp_index" git rev-parse -q --verify ":$1" 2>/dev/null || true; }

# Recreate $1 with its HEAD content, never overwriting a file that appeared
# meanwhile (ln fails when the target exists, atomically).
restore_head() {
  local f="$1" tmp="$1.persist-new.$$" mode rc
  git cat-file blob "HEAD:$f" >"$tmp" 2>/dev/null || { rm -f "$tmp"; return 1; }
  mode="$(git ls-tree HEAD -- "$f" | cut -c1-6)"
  if [[ "$mode" == 100755 ]]; then chmod 755 "$tmp"; else chmod 644 "$tmp"; fi
  if ln -- "$tmp" "$f" 2>/dev/null; then rc=0; else rc=1; fi
  rm -f "$tmp"
  return $rc
}

# Put one file back to HEAD without ever deleting content that is not in the
# snapshot. The live file is first moved aside (an atomic rename: a writer that
# already has it open keeps writing to the moved file, and one that opens it
# later creates a new file), compared with the snapshot, and dropped only when
# identical. Anything else is kept in place. Returns 1 when live content was kept.
restore_one() {  # $1 path, $2 tracked|fresh
  local f="$1" kind="$2" bak="" snap cur
  snap="$(snap_blob "$f")"
  if [[ -e "$f" || -L "$f" ]]; then
    bak="$f.persist-bak.$$"
    mv -- "$f" "$bak" || return 1
    cur="$(git hash-object -- "$bak" 2>/dev/null || true)"
    if [[ -z "$snap" || "$cur" != "$snap" ]]; then   # edited since the snapshot, or unreadable
      mv -n -- "$bak" "$f" 2>/dev/null || true       # never clobber a file that appeared meanwhile
      return 1
    fi
  elif [[ -n "$snap" ]]; then
    return 1   # the snapshot had this file and it is gone now: it changed since
  fi
  if [[ "$kind" == tracked ]] && ! restore_head "$f"; then
    if [[ -n "$bak" ]]; then mv -n -- "$bak" "$f" 2>/dev/null || true; fi
    return 1
  fi
  if [[ -n "$bak" ]]; then rm -f -- "$bak"; fi
  return 0
}

restore_checkout() (  # returns 1 when any file was kept because it changed since the snapshot
  umask 022   # restored files are written with the process umask: keep them readable
  rc=0
  git reset -q HEAD -- "${PATHS[@]}" 2>/dev/null || true
  for f in ${tracked[@]+"${tracked[@]}"}; do restore_one "$f" tracked || rc=1; done
  for f in ${fresh[@]+"${fresh[@]}"}; do
    if restore_one "$f" fresh; then
      d="$(dirname "$f")"   # drop the now-empty directories, never the skill roots
      while [[ "$d" != "." && "$d" != "hermes-bootstrap/skills" && "$d" != ".github/skills" ]]; do
        rmdir "$d" 2>/dev/null || break
        d="$(dirname "$d")"
      done
    else rc=1; fi
  done
  return $rc
)

marker="$OUT_DIR/$h12.pr"
if [[ -f "$marker" ]]; then
  restore_checkout || true   # a file changed since the snapshot is kept, and its new content is captured next tick
  say "ALREADY_PROPOSED #$(cat "$marker")"
  exit 0
fi

branch="chore/hermes-self-update/skill-edit-$h12"
wt="$OUT_DIR/wt-$h12"
failed() { say "FAILED $1"; exit 0; }   # on_exit removes the worktree and the local branch

git fetch -q origin main || failed "fetch failed"
git worktree remove --force "$wt" 2>/dev/null || true
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

# The patch was taken before the fetch, push and gh round trip. An edit made in
# the meantime is in neither the backup nor the PR: restore_checkout keeps every
# file that no longer matches the snapshot. The next cycle captures the new
# content (a new hash) as its own PR.
restore_checkout || failed "checkout changed while capturing PR #$num; files changed since the snapshot were left in place"
say "PR_OPENED #$num files=$count"
