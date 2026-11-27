#!/usr/bin/env bash
# Lists the owner's instructions that do not arrive through a merge, so the
# merge watcher can hand them to the agent:
#   comment:<id>  a comment or review that mentions @shift-mycelia-bot
#   closed:<n>    a PR closed WITHOUT merging that has human feedback
# Both are acknowledged with shift-merge-ack.sh <key> once handled.
#
# The output must be stable between ticks (Hermes only wakes the agent when it
# changes), and it is empty when there is nothing to do or when gh fails, so a
# partial read can never wake the agent. Bodies are untrusted data: they are
# truncated to one line and the agent must never run them.
#
# State (SHIFT_STATE_DIR, default /opt/data/shift): merged-prs.seen holds the
# acknowledged keys, one per line, next to the acknowledged PR numbers.
set -euo pipefail
REPO="${SHIFT_REPO_FULL_NAME:-Nevtep/shift-desoc}"
STATE_DIR="${SHIFT_STATE_DIR:-/opt/data/shift}"
SEEN="$STATE_DIR/merged-prs.seen"
WINDOW_DAYS="${SHIFT_REVIEW_REQUEST_DAYS:-14}"
MENTION="${SHIFT_BOT_MENTION:-@shift-mycelia-bot}"
mkdir -p "$STATE_DIR"; touch "$SEEN"

# Only CODEOWNERS may instruct the bot: anyone can comment on a PR, so a mention
# from anyone else is ignored. The list comes from main on GitHub, never from a
# checkout, so a PR cannot add itself. If it cannot be read, nobody is trusted
# and nothing is handed over.
owners_b64="$(gh api "repos/$REPO/contents/.github/CODEOWNERS?ref=main" --jq .content 2>/dev/null)" || exit 0
owners="$(printf '%s' "$owners_b64" | base64 -d 2>/dev/null \
  | sed 's/#.*//' | tr -s ' \t' '\n\n' | grep -E '^@[A-Za-z0-9-]+$' | tr 'A-Z' 'a-z' | sed 's/^@//' | sort -u)"
[[ -n "$owners" ]] || exit 0
is_owner() { grep -qx "$(tr 'A-Z' 'a-z' <<<"$1")" <<<"$owners"; }

prs="$(gh pr list --repo "$REPO" --state all --limit 30 --search 'sort:updated-desc' \
  --json number,state,title,closedAt 2>/dev/null)" || exit 0
cutoff="$(date -u -d "$WINDOW_DAYS days ago" +%s)"

lines=()
while IFS=$'\t' read -r number state title closed_at; do
  [[ -n "$number" ]] || continue
  # One flat list of human-written bodies for the PR: id, kind, login, text.
  items="$( { gh api "repos/$REPO/issues/$number/comments" --paginate 2>/dev/null || exit 3
              gh api "repos/$REPO/pulls/$number/comments" --paginate 2>/dev/null || exit 3
              gh api "repos/$REPO/pulls/$number/reviews" --paginate 2>/dev/null || exit 3; } \
    | jq -rs '[.[][] | select(.user.type == "User" and ((.body // "") | length) > 0)]
              | .[] | [.id, .user.login, ((.body | gsub("[\\r\\n\\t]+"; " ")) )] | @tsv')" || exit 0

  # Feedback that counts toward a rejection: only from CODEOWNERS.
  owner_feedback=""
  while IFS=$'\t' read -r id login body; do
    [[ -n "$id" ]] && is_owner "$login" && owner_feedback=1
  done <<<"$items"

  while IFS=$'\t' read -r id login body; do
    [[ -n "$id" ]] || continue
    is_owner "$login" || continue
    shopt -s nocasematch
    [[ "$body" == *"$MENTION"* ]] || { shopt -u nocasematch; continue; }
    shopt -u nocasematch
    key="comment:$id"
    grep -qx "$key" "$SEEN" && continue
    lines+=("- $key #$number $login: ${body:0:240}")
  done <<<"$items"

  if [[ "$state" == "CLOSED" && -n "$closed_at" && "$closed_at" != "null" ]]; then
    closed_epoch="$(date -u -d "$closed_at" +%s 2>/dev/null || echo 0)"
    key="closed:$number"
    if (( closed_epoch >= cutoff )) && [[ -n "$owner_feedback" ]] && ! grep -qx "$key" "$SEEN"; then
      lines+=("- $key #$number closed without merging — $title")
    fi
  fi
done < <(jq -r '.[] | [.number, .state, .title, (.closedAt // "")] | @tsv' <<<"$prs")

[[ ${#lines[@]} -gt 0 ]] || exit 0
echo "REVIEW_REQUESTS:"
printf '%s\n' "${lines[@]}" | sort -t' ' -k2,2V
