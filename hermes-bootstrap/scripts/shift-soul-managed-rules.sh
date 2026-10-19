#!/usr/bin/env bash
# Keep the repo-managed rules of SOUL.md current on an existing Hermes volume.
#
#   shift-soul-managed-rules.sh <seed SOUL.md> <persistent SOUL.md>
#
# The persistent SOUL.md belongs to Hermes and the operator, so it is only
# seeded when missing. The block between the managed-rules markers is owned by
# the repository: it is appended when absent and replaced in place when the
# seed changes; everything outside it is left untouched. Idempotent.
set -euo pipefail
seed="${1:?usage: shift-soul-managed-rules.sh <seed> <target>}"
target="${2:?usage: shift-soul-managed-rules.sh <seed> <target>}"
start='<!-- shift:managed-rules:start -->'
end='<!-- shift:managed-rules:end -->'

if [[ ! -f "$target" ]]; then
  cp "$seed" "$target"
  exit 0
fi

block="$(sed -n "/^${start}\$/,/^${end}\$/p" "$seed")"
[[ -n "$block" ]] || { echo "no managed-rules block in $seed" >&2; exit 1; }

tmp="$(mktemp "${target}.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
if grep -qxF "$start" "$target"; then
  # Replace the existing block in place.
  awk -v s="$start" -v e="$end" -v blockfile=<(printf '%s\n' "$block") '
    $0 == s { while ((getline line < blockfile) > 0) print line; skip = 1; next }
    $0 == e { skip = 0; next }
    !skip { print }
  ' "$target" >"$tmp"
else
  { cat "$target"; printf '\n%s\n' "$block"; } >"$tmp"
fi

if cmp -s "$tmp" "$target"; then
  exit 0
fi
cat "$tmp" >"$target"
