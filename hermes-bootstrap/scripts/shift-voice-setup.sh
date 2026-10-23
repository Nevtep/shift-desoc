#!/usr/bin/env bash
# Installs the local voice stack on the persistent Hermes volume, idempotently:
#   - TTS: Piper (own venv under $HERMES_HOME/piper, because Hermes' venv is
#     read-only for the agent user) + a Spanish voice, wired in through the
#     repo-managed `tts.providers.piper-es` command provider.
#   - STT: faster-whisper with PyAV < 17. Hermes lazy-installs faster-whisper
#     into $HERMES_HOME/lazy-packages, and an unpinned PyAV 17+ breaks its
#     audio decoding ("open() got an unexpected keyword argument
#     'metadata_errors'"), so voice notes arrive untranscribed.
# Voice is a convenience: any failure here warns and exits 0 so it can never
# block a boot.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HERMES_HOME="${HERMES_HOME:-/opt/data}"
PIPER_DIR="${SHIFT_PIPER_DIR:-$HERMES_HOME/piper}"
VOICE="${SHIFT_PIPER_VOICE:-es_AR-daniela-high}"
PIPER_VERSION="${SHIFT_PIPER_VERSION:-1.8.0}"
HERMES_PY="${SHIFT_HERMES_PYTHON:-/opt/hermes/.venv/bin/python}"
LAZY_DIR="$HERMES_HOME/lazy-packages"
warn() { echo "WARNING: voice setup: $*" >&2; }

install_say_script() {
  mkdir -p "$HERMES_HOME/scripts"
  install -m 0755 "$HERE/shift-piper-say.sh" "$HERMES_HOME/scripts/shift-piper-say.sh"
}

setup_piper() {
  local marker="$PIPER_DIR/.piper-tts-version"
  local voice_file="$PIPER_DIR/voices/$VOICE.onnx"
  if [[ -x "$PIPER_DIR/.venv/bin/python" && "$(cat "$marker" 2>/dev/null)" == "$PIPER_VERSION" ]]; then
    :   # venv and pinned piper-tts already in place
  else
    rm -rf "$PIPER_DIR/.venv"
    mkdir -p "$PIPER_DIR"
    local venv_args=()
    [[ -x "$HERMES_PY" ]] && venv_args=(--python "$HERMES_PY")
    uv venv "${venv_args[@]}" "$PIPER_DIR/.venv" >/dev/null || return 1
    uv pip install --python "$PIPER_DIR/.venv/bin/python" "piper-tts==$PIPER_VERSION" --quiet || return 1
    printf '%s\n' "$PIPER_VERSION" >"$marker"
  fi
  if [[ ! -f "$voice_file" || ! -f "$voice_file.json" ]]; then
    mkdir -p "$PIPER_DIR/voices"
    "$PIPER_DIR/.venv/bin/python" -m piper.download_voices \
      --download-dir "$PIPER_DIR/voices" "$VOICE" >/dev/null 2>&1 || return 1
  fi
}

setup_stt() {
  [[ -x "$HERMES_PY" ]] || return 0
  if PYTHONPATH="$LAZY_DIR" "$HERMES_PY" -c \
    'import av, faster_whisper; assert int(av.__version__.split(".")[0]) < 17' \
    >/dev/null 2>&1; then
    return 0
  fi
  uv pip install --python "$HERMES_PY" --target "$LAZY_DIR" \
    "faster-whisper>=1.1,<2" "av>=11,<17" --quiet
}

install_say_script || warn "could not install shift-piper-say.sh"
setup_piper || warn "Piper (TTS) is not available; voice replies will fail until fixed"
if [[ -z "${SHIFT_VOICE_SKIP_STT:-}" ]]; then
  setup_stt || warn "faster-whisper (STT) is not available; voice notes will not be transcribed"
fi
exit 0
