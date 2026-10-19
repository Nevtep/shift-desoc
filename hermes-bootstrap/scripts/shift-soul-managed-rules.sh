#!/usr/bin/env bash
# Keep the repo-managed rules of SOUL.md current on an existing Hermes volume.
#
#   shift-soul-managed-rules.sh <seed SOUL.md> <persistent SOUL.md>
#
# The persistent SOUL.md belongs to Hermes and the operator, so it is only
# seeded when missing. The block between the managed-rules markers is owned by
# the repository: it is appended when absent and replaced in place when the
# seed changes; everything outside it is left untouched. Idempotent.
#
# Exit codes: 0 ok (changed or already current), 1 bad seed/usage,
# 2 the persistent file has malformed markers (left untouched; fix by hand).
set -euo pipefail
seed="${1:?usage: shift-soul-managed-rules.sh <seed> <target>}"
target="${2:?usage: shift-soul-managed-rules.sh <seed> <target>}"
start='<!-- shift:managed-rules:start -->'
end='<!-- shift:managed-rules:end -->'

# Never follow links or write through anything but a regular file: bootstrap
# may run as root inside a directory the agent user can write.
if [[ -L "$target" ]] || { [[ -e "$target" ]] && [[ ! -f "$target" ]]; }; then
  echo "$target is a symlink or not a regular file; left untouched" >&2
  exit 2
fi
if [[ ! -e "$target" ]]; then
  cp "$seed" "$target"
  exit 0
fi

block="$(tr -d '\r' <"$seed" | sed -n "/^${start}\$/,/^${end}\$/p")"
[[ -n "$block" ]] || { echo "no managed-rules block in $seed" >&2; exit 1; }

# Validate the target's markers (CR-tolerant): either none, or exactly one
# start line followed by exactly one end line.
read -r starts ends well_formed < <(awk -v s="$start" -v e="$end" '
  { line = $0; sub(/\r$/, "", line) }
  line == s { ns++; if (open) bad = 1; open = 1 }
  line == e { ne++; if (!open) bad = 1; open = 0 }
  END { print ns + 0, ne + 0, (bad || open) ? 0 : 1 }
' "$target")

tmp="$(mktemp "${target}.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
if [[ "$starts" -eq 0 && "$ends" -eq 0 ]]; then
  { cat "$target"; printf '\n%s\n' "$block"; } >"$tmp"
elif [[ "$starts" -eq 1 && "$ends" -eq 1 && "$well_formed" -eq 1 ]]; then
  # Replace the block in place, keeping the file's line endings for it.
  # The block reaches awk through the environment (no escape processing and
  # no extra file on the volume).
  SHIFT_MANAGED_BLOCK="$block" awk -v s="$start" -v e="$end" '
    BEGIN { n = split(ENVIRON["SHIFT_MANAGED_BLOCK"], blk, "\n") }
    { line = $0; cr = sub(/\r$/, "", line) }
    line == s { for (i = 1; i <= n; i++) print blk[i] (cr ? "\r" : ""); skip = 1; next }
    line == e { skip = 0; next }
    !skip { print }
  ' "$target" >"$tmp"
else
  echo "malformed managed-rules markers in $target (start=$starts end=$ends); left untouched" >&2
  exit 2
fi

if cmp -s "$tmp" "$target"; then
  exit 0
fi
# Atomic replace that keeps the file's mode and owner (bootstrap may run as
# root on a file owned by the agent user).
mode="$(stat -c %a "$target" 2>/dev/null || stat -f %Lp "$target")"
owner="$(stat -c %u:%g "$target" 2>/dev/null || stat -f %u:%g "$target")"
chmod "$mode" "$tmp"
chown "$owner" "$tmp" 2>/dev/null || true
mv -f "$tmp" "$target"
