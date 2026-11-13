#!/usr/bin/env bash
# Install the Remotion reel template (hermes-bootstrap/shift-reels) into
# $HERMES_HOME/shift-reels, where the daily content job and the
# shift-reels-publishing skill expect it. Idempotent, runs on every boot, and
# warns instead of failing: reels must never block a boot.
#
# Only template files are copied over; per-reel state that lives next to them
# (specs/, public/reels/, public/music/*.mp3, node_modules) is left alone.
# Dependencies are installed with npm when package.json changed.
#
# Music is not versioned (Suno tracks, the repo is public): put track-a.mp3 and
# track-b.mp3 (see public/music/tracks.json) in $HERMES_HOME/shift-reels/public/music.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${SHIFT_REELS_SRC:-$HERE/shift-reels}"
HERMES_HOME="${HERMES_HOME:-/opt/data}"
DST="${SHIFT_REELS_DIR:-$HERMES_HOME/shift-reels}"
NPM="${SHIFT_NPM:-npm}"
warn() { echo "WARNING: reels setup: $*" >&2; }

[[ -d "$SRC" ]] || { warn "template source $SRC not found"; exit 0; }
mkdir -p "$DST" || { warn "cannot create $DST"; exit 0; }
cp -a "$SRC/." "$DST/" || { warn "could not copy the template"; exit 0; }

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
