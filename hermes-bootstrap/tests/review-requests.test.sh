#!/usr/bin/env bash
# Behaviour tests for shift-review-requests.sh: the watcher hands the agent the
# owner's instructions that do not come from a merge (a comment that mentions the
# bot, or a PR closed without merging that has human feedback).
#
#   bash hermes-bootstrap/tests/review-requests.test.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT/hermes-bootstrap/scripts/shift-review-requests.sh"
ACK="$ROOT/hermes-bootstrap/scripts/shift-merge-ack.sh"
failures=0
pass() { echo "ok   - $1"; }
fail() { echo "FAIL - $1" >&2; failures=$((failures + 1)); }

S="$(mktemp -d)"; trap 'rm -rf "$S"' EXIT
mkdir -p "$S/bin" "$S/state"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
OLD="2020-01-01T00:00:00Z"

# Fake gh: PR list, then the three comment endpoints per PR.
cat >"$S/bin/gh" <<FAKE
#!/usr/bin/env bash
args="\$*"
case "\$args" in
  *"pr list"*)
    cat <<JSON
[{"number":10,"state":"OPEN","title":"open pr","closedAt":null},
 {"number":11,"state":"CLOSED","title":"rejected pr","closedAt":"$NOW"},
 {"number":12,"state":"CLOSED","title":"closed only by bot noise","closedAt":"$NOW"},
 {"number":13,"state":"CLOSED","title":"rejected long ago","closedAt":"$OLD"},
 {"number":14,"state":"MERGED","title":"merged","closedAt":"$NOW"}]
JSON
    ;;
  *"issues/10/comments"*) echo '[{"id":101,"body":"please @Shift-Mycelia-Bot redo this","user":{"login":"owner","type":"User"}},{"id":102,"body":"plain note","user":{"login":"owner","type":"User"}}]';;
  *"pulls/10/comments"*) echo '[]';;
  *"pulls/10/reviews"*) echo '[]';;
  *"pulls/11/comments"*) echo '[{"id":201,"body":"this does not justify its own step","user":{"login":"owner","type":"User"}}]';;
  *"issues/11/comments"*) echo '[]';;
  *"pulls/11/reviews"*) echo '[]';;
  *"pulls/12/comments"*) echo '[{"id":301,"body":"suggestion","user":{"login":"copilot","type":"Bot"}}]';;
  *"issues/12/comments"*) echo '[]';;
  *"pulls/12/reviews"*) echo '[]';;
  *"pulls/13/comments"*) echo '[{"id":401,"body":"old human comment","user":{"login":"owner","type":"User"}}]';;
  *"issues/13/comments"*) echo '[]';;
  *"pulls/13/reviews"*) echo '[]';;
  *"pulls/14/comments"*) echo '[]';;
  *"issues/14/comments"*) echo '[{"id":501,"body":"merged but @shift-mycelia-bot learn this","user":{"login":"owner","type":"User"}}]';;
  *"pulls/14/reviews"*) echo '[{"id":601,"body":"","user":{"login":"owner","type":"User"}}]';;
  *) echo '[]';;
esac
FAKE
chmod +x "$S/bin/gh"

run() { env -i PATH="$S/bin:$PATH" HOME="$S" SHIFT_STATE_DIR="$S/state" bash "$SCRIPT" 2>&1; }

out="$(run)"
grep -q '^- comment:101 #10' <<<"$out" && pass "a comment that mentions the bot is a request (case-insensitive)" || fail "mention: [$out]"
grep -q 'comment:102' <<<"$out" && fail "a comment without the mention must not be a request" || pass "a comment without the mention is ignored"
grep -q '^- closed:11 #11' <<<"$out" && pass "a PR closed unmerged with human feedback is a request" || fail "closed: [$out]"
grep -q 'closed:12' <<<"$out" && fail "bot-only feedback must not count" || pass "a closed PR with only bot comments is ignored"
grep -q 'closed:13' <<<"$out" && fail "an old closure must not count" || pass "a closure older than the window is ignored"
grep -q 'closed:14' <<<"$out" && fail "a merged PR is not a rejection" || pass "a merged PR is not treated as a rejection"
grep -q '^- comment:501 #14' <<<"$out" && pass "a mention on a merged PR is still a request" || fail "merged mention: [$out]"

[[ "$(run)" == "$out" ]] && pass "the output is stable between runs" || fail "unstable output"

SHIFT_STATE_DIR="$S/state" bash "$ACK" comment:101 closed:11 >/dev/null
out2="$(run)"
grep -q 'comment:101\|closed:11' <<<"$out2" && fail "acknowledged keys must disappear: [$out2]" || pass "acknowledged requests are not handed over again"
grep -q 'comment:501' <<<"$out2" && pass "unacknowledged requests remain" || fail "remaining: [$out2]"

if SHIFT_STATE_DIR="$S/state" bash "$ACK" 'comment:1;rm' >/dev/null 2>&1; then fail "a malformed key must be rejected"; else pass "a malformed key is rejected"; fi

# A gh failure prints nothing, so it cannot wake the agent with partial data.
cat >"$S/bin/gh" <<'FAKE'
#!/usr/bin/env bash
exit 1
FAKE
[[ -z "$(run)" ]] && pass "a gh failure prints nothing" || fail "gh failure output"

# --- The watcher prints REVIEW_REQUESTS next to the merged PRs, in both paths.
WATCH="$ROOT/hermes-bootstrap/scripts/shift-merge-watch.sh"
mkdir -p "$S/scripts"
cp "$WATCH" "$SCRIPT" "$S/scripts/"
printf '#!/usr/bin/env bash\nexit 0\n' >"$S/scripts/shift-skill-persist.sh"
printf '#!/usr/bin/env bash\nexit 0\n' >"$S/scripts/shift-memory-snapshot.sh"
cat >"$S/bin/gh" <<FAKE2
#!/usr/bin/env bash
args="\$*"
case "\$args" in
  *"--state merged"*) printf '9\\tabc1234\\tbranch\\tmerged title\\n';;
  *"pr list"*) echo '[{"number":15,"state":"OPEN","title":"p","closedAt":null}]';;
  *"issues/15/comments"*) echo '[{"id":701,"body":"@shift-mycelia-bot do it","user":{"login":"owner","type":"User"}}]';;
  *) echo '[]';;
esac
FAKE2
chmod +x "$S/bin/gh"
rm -rf "$S/state2"; mkdir -p "$S/state2"
w="$(env -i PATH="$S/bin:$PATH" HOME="$S" SHIFT_STATE_DIR="$S/state2" SHIFT_REPO_DIR=/nonexistent bash "$S/scripts/shift-merge-watch.sh" 2>&1)"
grep -q '^REVIEW_REQUESTS:' <<<"$w" && grep -q 'comment:701 #15' <<<"$w" && pass "the watcher hands over review requests with a merged PR pending" || fail "watcher with merged: [$w]"
echo 9 >"$S/state2/merged-prs.seen"
w="$(env -i PATH="$S/bin:$PATH" HOME="$S" SHIFT_STATE_DIR="$S/state2" SHIFT_REPO_DIR=/nonexistent bash "$S/scripts/shift-merge-watch.sh" 2>&1)"
grep -q 'comment:701 #15' <<<"$w" && grep -q -- '- (none)' <<<"$w" && pass "the watcher hands over review requests even with no merged PR" || fail "watcher idle: [$w]"

[[ $failures -eq 0 ]] && echo "all passed" || { echo "$failures failed" >&2; exit 1; }
