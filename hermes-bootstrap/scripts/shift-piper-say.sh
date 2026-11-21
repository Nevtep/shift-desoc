#!/usr/bin/env bash
# Local Spanish text-to-speech for Hermes (command TTS provider "piper-es").
# Hermes calls:  shift-piper-say.sh {input_path} {output_path}
# The output format follows the extension (.wav as is, .ogg/.opus via libopus
# for Telegram voice bubbles, anything else through ffmpeg).
set -euo pipefail

HERMES_HOME="${HERMES_HOME:-/opt/data}"
PIPER_DIR="${SHIFT_PIPER_DIR:-$HERMES_HOME/piper}"
VOICE="${SHIFT_PIPER_VOICE:-es_AR-daniela-high}"
usage="usage: shift-piper-say.sh <input.txt> <output.wav|ogg|opus|mp3>"
input="${1:?$usage}"
output="${2:?$usage}"

tmp="$(mktemp --suffix=.wav "${TMPDIR:-/tmp}/shift-piper.XXXXXX")"
trap 'rm -f "$tmp"' EXIT

"$PIPER_DIR/.venv/bin/python" -m piper \
  -m "$PIPER_DIR/voices/$VOICE.onnx" -f "$tmp" <"$input" >/dev/null 2>&1

case "$output" in
  *.wav) cp "$tmp" "$output" ;;
  *.ogg | *.opus) ffmpeg -y -loglevel error -i "$tmp" -c:a libopus -b:a 48k "$output" ;;
  *) ffmpeg -y -loglevel error -i "$tmp" "$output" ;;
esac
