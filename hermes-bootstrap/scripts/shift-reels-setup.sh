#!/usr/bin/env bash
# Install the Remotion reel template (hermes-bootstrap/shift-reels) into
# $HERMES_HOME/shift-reels, where the daily content job and the
# shift-reels-publishing skill expect it. Idempotent, runs on every boot, and
# warns instead of failing: reels must never block a boot.
#
# Only template files are copied over (and never over a server-side edit, see
# below); per-reel state that lives next to them (specs/, public/reels/,
# examples/<slug>/, public/music/*.mp3, node_modules) is left alone.
# Dependencies are installed with npm when package.json changed.
#
# Music is not versioned (Suno tracks, the repo is public): put track-a.mp3 and
# track-b.mp3 (see public/music/tracks.json) in $HERMES_HOME/shift-reels/public/music.
set -uo pipefail
sha() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$@"; else shasum -a 256 "$@"; fi; }

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${SHIFT_REELS_SRC:-$HERE/shift-reels}"
HERMES_HOME="${HERMES_HOME:-/opt/data}"
DST="${SHIFT_REELS_DIR:-$HERMES_HOME/shift-reels}"
NPM="${SHIFT_NPM:-npm}"
warn() { echo "WARNING: reels setup: $*" >&2; }

[[ -d "$SRC" ]] || { warn "template source $SRC not found"; exit 0; }
mkdir -p "$DST" || { warn "cannot create $DST"; exit 0; }
# Copy template files, but never clobber a file edited on the server since the
# last install (the drift job turns those into a PR). The baseline records the
# repo hash of every file as installed; a file equal to its baseline, or missing,
# is refreshed. On a volume with no baseline yet, differing files are kept.
BASELINE="$DST/.shift-template-baseline"
touch "$BASELINE" 2>/dev/null || { warn "cannot write $BASELINE"; exit 0; }
new_baseline="$(mktemp)"
while IFS= read -r f; do
  rel="${f#"$SRC"/}"
  target="$DST/$rel"
  rh="$(sha "$f" | cut -d' ' -f1)"
  bh="$(awk -v p="$rel" '{ h=$1; $1=""; sub(/^ /,""); if ($0==p) print h }' "$BASELINE")"
  if [[ ! -e "$target" ]]; then
    mkdir -p "$(dirname "$target")" && cp -a "$f" "$target" && printf '%s %s\n' "$rh" "$rel" >>"$new_baseline"
    continue
  fi
  th="$(sha "$target" | cut -d' ' -f1)"
  if [[ "$th" == "$rh" ]]; then
    printf '%s %s\n' "$rh" "$rel" >>"$new_baseline"
  elif [[ -n "$bh" && "$th" == "$bh" ]]; then
    cp -a "$f" "$target" && printf '%s %s\n' "$rh" "$rel" >>"$new_baseline"
  else
    [[ -n "$bh" ]] && printf '%s %s\n' "$bh" "$rel" >>"$new_baseline"
    warn "$rel was edited on the server; kept (the drift job will propose it)"
  fi
done < <(find "$SRC" -type f | sort)
cp "$new_baseline" "$BASELINE"; rm -f "$new_baseline"

marker="$DST/node_modules/.shift-package-json.md5"
want="$(md5sum "$DST/package.json" | cut -d' ' -f1)"
if [[ "$(cat "$marker" 2>/dev/null)" != "$want" ]]; then
  if (cd "$DST" && "$NPM" install --no-audit --no-fund --silent); then
    printf '%s\n' "$want" >"$marker"
  else
    warn "npm install failed; reels cannot render until fixed"
  fi
fi

for track in track-a track-b; do
  [[ -f "$DST/public/music/$track.mp3" ]] || warn "missing public/music/$track.mp3 (not versioned); reels will have no music"
done
exit 0
