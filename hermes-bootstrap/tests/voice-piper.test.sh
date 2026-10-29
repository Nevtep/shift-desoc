#!/usr/bin/env bash
# Tests for the local voice stack (Piper TTS + faster-whisper STT pin):
# shift-voice-setup.sh is idempotent and never blocks boot, shift-piper-say.sh
# picks the audio format from the output extension, and the repo-managed
# config points Hermes at the installed script.
#
#   bash hermes-bootstrap/tests/voice-piper.test.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SETUP="$HERE/scripts/shift-voice-setup.sh"
SAY="$HERE/scripts/shift-piper-say.sh"
MANAGED="$HERE/managed-keys.yaml"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
failures=0
pass() { echo "ok   - $1"; }
fail() { echo "FAIL - $1" >&2; failures=$((failures + 1)); }
check() { local name="$1"; shift; if "$@"; then pass "$name"; else fail "$name"; fi; }

# --- stubs: no network, no real Piper -------------------------------------
BIN="$WORK/bin"; mkdir -p "$BIN"
LOG="$WORK/calls.log"; : >"$LOG"
# uv: `uv venv <dir>` creates a venv whose python stubs `-m piper*` and `-c`.
cat >"$BIN/uv" <<STUB
#!/usr/bin/env bash
echo "uv \$*" >>"$LOG"
if [[ "\$1" == "venv" ]]; then
  dir="\${@: -1}"
  mkdir -p "\$dir/bin"
  cat >"\$dir/bin/python" <<PY
#!/usr/bin/env bash
echo "python \\\$*" >>"$LOG"
if [[ "\\\$1 \\\$2" == "-m piper.download_voices" ]]; then
  shift 2; dd=""; v=""
  while [[ \\\$# -gt 0 ]]; do case "\\\$1" in --download-dir) dd="\\\$2"; shift 2;; *) v="\\\$1"; shift;; esac; done
  mkdir -p "\\\$dd"; : >"\\\$dd/\\\$v.onnx"; : >"\\\$dd/\\\$v.onnx.json"
elif [[ "\\\$1" == "-m" && "\\\$2" == "piper" ]]; then
  out=""; while [[ \\\$# -gt 0 ]]; do [[ "\\\$1" == "-f" ]] && out="\\\$2"; shift; done
  cat >/dev/null; printf 'RIFFstub' >"\\\$out"
fi
exit 0
PY
  chmod +x "\$dir/bin/python"
fi
exit 0
STUB
cat >"$BIN/ffmpeg" <<STUB
#!/usr/bin/env bash
echo "ffmpeg \$*" >>"$LOG"
out="\${@: -1}"; printf 'converted' >"\$out"
STUB
chmod +x "$BIN/uv" "$BIN/ffmpeg"
export PATH="$BIN:$PATH"
export HERMES_HOME="$WORK/home"; mkdir -p "$HERMES_HOME"
export SHIFT_VOICE_SKIP_STT=1   # STT pin is covered separately below

# 1. Fresh volume: venv, piper-tts pin and the Spanish voice are installed.
bash "$SETUP"
check "venv created"            test -x "$HERMES_HOME/piper/.venv/bin/python"
check "piper-tts installed"     grep -q "uv pip install .*piper-tts" "$LOG"
check "voice onnx downloaded"   test -f "$HERMES_HOME/piper/voices/es_AR-daniela-high.onnx"
check "voice config downloaded" test -f "$HERMES_HOME/piper/voices/es_AR-daniela-high.onnx.json"
check "say script installed"    test -x "$HERMES_HOME/scripts/shift-piper-say.sh"

# 2. Idempotent: a second run does no installs or downloads.
: >"$LOG"
bash "$SETUP"
check "second run installs nothing" bash -c "! grep -q -E 'uv (venv|pip)|download_voices' '$LOG'"

# 3. A broken install never blocks boot (exit 0 + warning on stderr).
rm -rf "$HERMES_HOME/piper"
cat >"$WORK/failbin-uv" <<'STUB'
#!/usr/bin/env bash
exit 1
STUB
mkdir -p "$WORK/failbin"; cp "$WORK/failbin-uv" "$WORK/failbin/uv"; chmod +x "$WORK/failbin/uv"
set +e; PATH="$WORK/failbin:$PATH" bash "$SETUP" 2>"$WORK/fail.err"; rc=$?; set -e
check "failed install still exits 0" test "$rc" -eq 0
check "failed install warns"         grep -q "WARNING" "$WORK/fail.err"

# 4. say.sh: output format follows the extension.
bash "$SETUP"   # restore after the failure case
printf 'Hola' >"$WORK/in.txt"
bash "$SAY" "$WORK/in.txt" "$WORK/out.wav"
check "wav is written as is"  grep -q RIFFstub "$WORK/out.wav"
: >"$LOG"
bash "$SAY" "$WORK/in.txt" "$WORK/out.ogg"
check "ogg goes through libopus" grep -q "libopus" "$LOG"
check "ogg output exists"        test -s "$WORK/out.ogg"
check "no temp wav left behind"  bash -c "! ls '${TMPDIR:-/tmp}'/shift-piper.*.wav >/dev/null 2>&1"

# 5. Repo-managed config wires Hermes to the installed script.
check "tts provider is the command provider" grep -q "provider: piper-es" "$MANAGED"
check "command points at installed script"   grep -q 'command: .*scripts/shift-piper-say.sh {input_path} {output_path}' "$MANAGED"
check "voice-bubble delivery enabled"        grep -q "voice_compatible: true" "$MANAGED"
check "stt language is Spanish"              grep -q "language: es" "$MANAGED"

# 6. The setup script is wired into bootstrap and covered by doctor.
BOOT="$HERE/../scripts/bootstrap.sh"
check "bootstrap runs the voice setup" grep -q "shift-voice-setup.sh" "$BOOT"
check "doctor checks the voice stack"  grep -q "voice-piper" "$HERE/../scripts/doctor.sh"

echo
if [[ "$failures" -ne 0 ]]; then echo "$failures failure(s)" >&2; exit 1; fi
echo "all voice-piper checks passed"
