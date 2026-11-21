#!/usr/bin/env bash
# Runs shift-skill-persist.sh against a real git sandbox (bare origin, a clone
# playing the live Hermes checkout) and a fake gh. The monitor turns uncommitted
# skill edits in the live checkout into a pushed branch plus a PR, and only then
# restores the checkout; any failure must leave the checkout untouched.
#
#   bash hermes-bootstrap/tests/skill-persist.test.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PERSIST="$ROOT/hermes-bootstrap/scripts/shift-skill-persist.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
failures=0
pass() { echo "ok   - $1"; }
fail() { echo "FAIL - $1" >&2; failures=$((failures + 1)); }

export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null

SKILL=hermes-bootstrap/skills/demo/SKILL.md
GHSKILL=.github/skills/other/SKILL.md

# setup <name>: a fresh origin, live checkout, state dir and fake gh.
setup() {
  S="$WORK/$1"; mkdir -p "$S/bin" "$S/state"
  git init -q --bare -b main "$S/origin.git"
  git clone -q "$S/origin.git" "$S/seed" 2>/dev/null
  mkdir -p "$S/seed/hermes-bootstrap/skills/demo" "$S/seed/.github/skills/other"
  printf 'line one\nline two\n' >"$S/seed/$SKILL"
  printf 'other one\n' >"$S/seed/$GHSKILL"
  printf 'readme\n' >"$S/seed/README.md"
  git -C "$S/seed" add -A && git -C "$S/seed" commit -q -m seed && git -C "$S/seed" push -q origin HEAD:main
  git clone -q "$S/origin.git" "$S/live"
  cat >"$S/bin/gh" <<FAKE
#!/usr/bin/env bash
echo "\$*" >>"$S/gh.log"
[[ -e "$S/gh-fail" ]] && { echo "gh: boom" >&2; exit 1; }
if [[ "\$1 \$2" == "pr create" ]]; then echo "https://github.com/x/y/pull/77"; fi
FAKE
  chmod +x "$S/bin/gh"
}

# persist [env assignments...]: run the monitor on the live checkout.
persist() {
  out="$(env -i PATH="$S/bin:$PATH" HOME="$S" GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null \
    GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com \
    GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com \
    SHIFT_REPO_DIR="$S/live" SHIFT_STATE_DIR="$S/state" SHIFT_SKILL_PERSIST_QUIET_MIN=0 \
    "$@" bash "$PERSIST" 2>&1)" || true
}
has() { grep -qxF -- "$1" <<<"$out"; }
branches() { git -C "$S/origin.git" for-each-ref --format='%(refname:short)' 'refs/heads/chore/hermes-self-update/skill-edit-*'; }
dirty() { git -C "$S/live" status --porcelain; }
creates() { grep -c '^pr create' "$S/gh.log" 2>/dev/null || true; }

# 1. A clean checkout: no output, no branch, no gh call.
setup clean
persist
if [[ -z "$out" && -z "$(branches)" && ! -e "$S/gh.log" ]]; then pass "a clean checkout does nothing"
else fail "clean: out=[$out] branches=[$(branches)]"; fi

# 2. A modified tracked skill becomes a pushed branch and a PR, then the
#    checkout is restored and a 600 backup exists.
setup modified
printf 'edited by hermes\n' >>"$S/live/$SKILL"
persist
b="$(branches)"
if has "SKILL_PERSIST=PR_OPENED #77 files=1" && [[ "$b" == chore/hermes-self-update/skill-edit-* ]] \
  && git -C "$S/origin.git" show "$b:$SKILL" | grep -qx 'edited by hermes'; then
  pass "a modified skill is pushed on a chore/hermes-self-update branch"
else fail "modified: out=[$out] branches=[$b]"; fi
if grep -q -- "pr create" "$S/gh.log" && grep -q -- "--base main" "$S/gh.log" && grep -q -- "--head $b" "$S/gh.log"; then
  pass "the PR is created against main from that branch"
else fail "gh log: $(cat "$S/gh.log" 2>/dev/null)"; fi
if [[ -z "$(dirty)" ]] && ! grep -q 'edited by hermes' "$S/live/$SKILL"; then pass "the live checkout is restored after the push"
else fail "checkout not restored: $(dirty)"; fi
backup="$(find "$S/state/skill-persist" -name '*.patch' 2>/dev/null | head -1)"
if [[ -n "$backup" && "$(ls -l "$backup" | cut -c1-10)" == "-rw-------" ]] && grep -q 'edited by hermes' "$backup"; then
  pass "a 600 backup patch keeps the edit"
else fail "backup: [$backup]"; fi
if git -C "$S/origin.git" log -1 --format=%B "$b" | grep -q '^Risk:'; then pass "the commit message carries a Risk line"
else fail "no Risk line in the commit message"; fi

# 3. A new untracked skill is captured and removed from the checkout.
setup untracked
mkdir -p "$S/live/hermes-bootstrap/skills/newone"
printf 'brand new skill\n' >"$S/live/hermes-bootstrap/skills/newone/SKILL.md"
persist
b="$(branches)"
if has "SKILL_PERSIST=PR_OPENED #77 files=1" \
  && git -C "$S/origin.git" show "$b:hermes-bootstrap/skills/newone/SKILL.md" | grep -qx 'brand new skill' \
  && [[ -z "$(dirty)" && ! -e "$S/live/hermes-bootstrap/skills/newone/SKILL.md" ]]; then
  pass "a new skill file is captured and removed from the checkout"
else fail "untracked: out=[$out] dirty=[$(dirty)]"; fi

# 4. A deleted tracked skill is captured as a deletion and the file comes back.
setup deleted
rm "$S/live/$GHSKILL"
persist
b="$(branches)"
if has "SKILL_PERSIST=PR_OPENED #77 files=1" && ! git -C "$S/origin.git" cat-file -e "$b:$GHSKILL" 2>/dev/null \
  && [[ -z "$(dirty)" && -e "$S/live/$GHSKILL" ]]; then pass "a deleted skill is captured and the checkout restored"
else fail "deleted: out=[$out] dirty=[$(dirty)]"; fi

# 5. Changes outside the skill directories are ignored and left untouched.
setup unrelated
printf 'local note\n' >>"$S/live/README.md"
persist
if [[ -z "$out" && -z "$(branches)" && "$(dirty)" == " M README.md" ]]; then pass "changes outside the skills are ignored"
else fail "unrelated: out=[$out] dirty=[$(dirty)]"; fi
printf 'edited by hermes\n' >>"$S/live/$SKILL"
persist
if has "SKILL_PERSIST=PR_OPENED #77 files=1" && [[ "$(dirty)" == " M README.md" ]]; then pass "only the skill files are captured next to unrelated changes"
else fail "mixed: out=[$out] dirty=[$(dirty)]"; fi

# 6. A recent edit is left alone until it settles.
setup recent
printf 'half-finished\n' >>"$S/live/$SKILL"
persist SHIFT_SKILL_PERSIST_QUIET_MIN=60
if [[ -z "$out" && -z "$(branches)" && -n "$(dirty)" ]]; then pass "an edit younger than the quiet period is not captured"
else fail "recent: out=[$out] dirty=[$(dirty)]"; fi

# 7. A dev cycle holding the lock blocks the capture.
setup locked
printf 'edited\n' >>"$S/live/$SKILL"
date -u +%FT%TZ >"$S/state/dev-loop.lock"
persist
if [[ -z "$out" && -z "$(branches)" && -n "$(dirty)" ]]; then pass "a held dev-loop lock blocks the capture"
else fail "locked: out=[$out] dirty=[$(dirty)]"; fi

# 8. The same content never opens a second PR.
setup again
printf 'edited by hermes\n' >>"$S/live/$SKILL"
persist
printf 'edited by hermes\n' >>"$S/live/$SKILL"
persist
if has "SKILL_PERSIST=ALREADY_PROPOSED #77" && [[ "$(creates)" == 1 && -z "$(dirty)" ]]; then pass "the same edit is not proposed twice"
else fail "again: out=[$out] creates=$(creates)"; fi

# 9. A push failure leaves the checkout and the backup intact.
setup pushfail
printf 'edited by hermes\n' >>"$S/live/$SKILL"
git -C "$S/live" remote set-url origin "$S/does-not-exist.git"
persist
if grep -q '^SKILL_PERSIST=FAILED' <<<"$out" && grep -q 'edited by hermes' "$S/live/$SKILL" \
  && [[ -n "$(find "$S/state/skill-persist" -name '*.patch' 2>/dev/null)" ]]; then
  pass "a push failure reports FAILED, keeps the edit and the backup"
else fail "pushfail: out=[$out] dirty=[$(dirty)]"; fi

# 10. A gh failure leaves the checkout intact.
setup ghfail
printf 'edited by hermes\n' >>"$S/live/$SKILL"
touch "$S/gh-fail"
persist
if grep -q '^SKILL_PERSIST=FAILED' <<<"$out" && grep -q 'edited by hermes' "$S/live/$SKILL"; then pass "a gh failure reports FAILED and keeps the edit"
else fail "ghfail: out=[$out] dirty=[$(dirty)]"; fi

# 11. A conflict with a newer origin/main leaves the checkout intact.
setup conflict
printf 'line one CHANGED UPSTREAM\nline two\n' >"$S/seed/$SKILL"
git -C "$S/seed" commit -q -am upstream && git -C "$S/seed" push -q origin HEAD:main
printf 'line one MINE\nline two\n' >"$S/live/$SKILL"
persist
if grep -q '^SKILL_PERSIST=FAILED' <<<"$out" && grep -q 'MINE' "$S/live/$SKILL" && [[ -z "$(branches)" ]]; then
  pass "a conflict with a newer main reports FAILED and keeps the edit"
else fail "conflict: out=[$out] branches=[$(branches)]"; fi

# 12. After a gh failure the branch is already on origin; the next cycle must
#     recover (push over its own bot branch) instead of failing forever.
setup retry
printf 'edited by hermes\n' >>"$S/live/$SKILL"
touch "$S/gh-fail"
persist
first="$out"
rm -f "$S/gh-fail"
persist
if grep -q '^SKILL_PERSIST=FAILED' <<<"$first" && has "SKILL_PERSIST=PR_OPENED #77 files=1" && [[ -z "$(dirty)" ]]; then
  pass "a cycle after a gh failure recovers and opens the PR"
else fail "retry: first=[$first] second=[$out] dirty=[$(dirty)]"; fi

# 13. An open PR that already exists for the branch is reused, not duplicated.
setup existing
printf 'edited by hermes\n' >>"$S/live/$SKILL"
cat >"$S/bin/gh" <<FAKE
#!/usr/bin/env bash
echo "\$*" >>"$S/gh.log"
if [[ "\$1 \$2" == "pr list" ]]; then echo 41; exit 0; fi
if [[ "\$1 \$2" == "pr create" ]]; then echo "https://github.com/x/y/pull/99"; fi
FAKE
persist
if has "SKILL_PERSIST=PR_OPENED #41 files=1" && [[ "$(creates)" == 0 && -z "$(dirty)" ]]; then pass "an existing open PR for the branch is reused"
else fail "existing: out=[$out] creates=$(creates)"; fi

# 14. The merge watcher runs the monitor: its output is unchanged while idle and
#     carries the SKILL_PERSIST line, right after STATUS=OK, when an edit is captured.
WATCH="$ROOT/hermes-bootstrap/scripts/shift-merge-watch.sh"
watch() {
  out="$(env -i PATH="$S/bin:$PATH" HOME="$S" GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null \
    GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com \
    GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com \
    SHIFT_REPO_DIR="$S/live" SHIFT_STATE_DIR="$S/state" SHIFT_SKILL_PERSIST_QUIET_MIN=0 \
    bash "$WATCH" 2>&1)" || true
}
setup watcher
watch
idle="$out"
if [[ "$idle" == $'STATUS=OK\nPENDING_MERGED_PRS:\n- (none)' ]]; then pass "the watcher output is unchanged while idle"
else fail "watcher idle: [$idle]"; fi
printf 'edited by hermes\n' >>"$S/live/$SKILL"
watch
if [[ "$(sed -n 1,2p <<<"$out")" == $'STATUS=OK\nSKILL_PERSIST=PR_OPENED #77 files=1' && -z "$(dirty)" ]]; then
  pass "the watcher prints the SKILL_PERSIST line after STATUS=OK"
else fail "watcher capture: [$out]"; fi
watch
if [[ "$out" == "$idle" ]]; then pass "the watcher output returns to the idle shape afterwards"
else fail "watcher after: [$out]"; fi

[[ $failures -eq 0 ]] && echo "all passed" || { echo "$failures failed" >&2; exit 1; }
