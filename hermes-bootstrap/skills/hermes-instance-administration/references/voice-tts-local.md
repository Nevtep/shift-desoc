# Voice: local TTS (Piper) and STT on this host

Use when the user wants voice replies/notes on Telegram without paid services.

## Diagnose first
- `stt:` in `/opt/data/config.yaml` (local faster-whisper by default). Set `stt.language` to the user's language (default is `en`).
- Probe TTS with the `text_to_speech` tool before changing anything. The default Edge provider can fail with HTTP 403 from the server's network; that is a provider block, not a config bug.
- Hermes' own venv (`/opt/hermes/.venv`) is root-owned: `uv pip install` into it fails with permission denied. Do not retry with `-U`/sudo workarounds.

## Piper via a command provider (no root, no cost)
1. Private venv: `uv venv --python 3.13 /opt/data/piper/.venv && uv pip install --python /opt/data/piper/.venv/bin/python piper-tts`.
2. Voice: `cd /opt/data/piper && .venv/bin/python -m piper.download_voices es_AR-daniela-high` (other Spanish: es_ES, es_MX; list in the piper1-gpl VOICES.md).
3. Wrapper `say.sh <input_txt> <output_audio>`: run `python -m piper -m <voice path without .onnx> -f tmp.wav < input`, then pick the container by output extension with ffmpeg (`-c:a libopus -b:a 48k` for `.ogg`).
4. Register it (nested keys need `--force`; the name must not collide with a built-in like `piper`):
   ```bash
   hermes config set tts.provider piper-es
   for kv in "type command" "command /opt/data/piper/say.sh {input_path} {output_path}" "output_format ogg" "voice_compatible true" "timeout 90"; do hermes config set --force "tts.providers.piper-es.${kv%% *}" "${kv#* }"; done
   hermes config set stt.language es
   ```
   `voice_compatible: true` + OGG/Opus makes Telegram render a voice bubble.
5. Verify with `text_to_speech`; the result must show `provider: piper-es`, `voice_compatible: true`. Cost is ~6 s per short clip on this CPU.
6. User side: `/voice on` (reply by voice to voice notes), `/voice tts` (always voice), `/voice off`. STT language changes may need `/restart`. Confirm STT end-to-end only with a real voice note from the user.

## STT: voice notes arrive as "could not be transcribed"
Check `/opt/data/logs/errors.log`. `open() got an unexpected keyword argument 'metadata_errors'` means faster-whisper (lazy-installed in `/opt/data/lazy-packages`) got PyAV 17+, which its audio decoder doesn't support. Fix: `uv pip install --python /opt/hermes/.venv/bin/python --target /opt/data/lazy-packages "faster-whisper>=1.1,<2" "av>=11,<17"` (the target dir is writable even though the venv is not). Test directly with `PYTHONPATH=/opt/data/lazy-packages /opt/hermes/.venv/bin/python` and `WhisperModel("base", device="cpu", compute_type="int8").transcribe(<ogg>, language="es")` on the saved voice note, then ask for `/restart` so the gateway reloads it.

## Voice-only chat on Telegram (hide the working detail)
Voice replies still arrive with tool steps, interim messages and reasoning around them. Per-platform display keys hide that (nested keys need `--force`):
```bash
for kv in "tool_progress off" "interim_assistant_messages false" "show_reasoning false"; do hermes config set --force "display.platforms.telegram.${kv%% *}" "${kv#* }"; done
```
With `/voice` mode `all` the final text is attached as the voice message caption when short; there is no switch that drops the text entirely. These need a gateway `/restart`.

## STT/TTS quality is a separate class of work
The `base` faster-whisper model with a forced `stt.language` gives run-on text, missing `¿?`, and English terms decoded with Spanish phonetics; Piper is flat and reads English terms with Spanish phonetics. Do not tune these inside a plumbing change: file them as their own issues (benchmark set of real notes first, then model/`initial_prompt`/pronunciation-dictionary options measured for latency on the CPU-only host).

## Making it survive rebuilds (Shift repo)
The manual steps above live only on the `/opt/data` volume. In the Shift repo they are codified so fresh volumes and image upgrades converge: `hermes-bootstrap/scripts/shift-voice-setup.sh` (idempotent, warns instead of failing boot; installs the Piper venv, pinned `piper-tts`, the voice into `$HERMES_HOME/piper/voices`, and the `av<17` pin), `shift-piper-say.sh` (installed to `$HERMES_HOME/scripts`), and `tts`/`stt.language` in `hermes-bootstrap/managed-keys.yaml`. Changes go through a worktree/branch like any repo change; test with `hermes-bootstrap/tests/voice-piper.test.sh` using stubbed `uv`/`ffmpeg`. Shell pitfall: never put `}` inside the message of `${1:?msg}` (e.g. `{wav,ogg}`): the expansion ends at the first `}`.

Rules the repo version had to learn (each caught in review; keep them when changing the setup):
- Bootstrap merges managed keys into every profile, and a profile's `HERMES_HOME` is `/opt/data/profiles/<name>`. Pin the shared install in the managed command (`SHIFT_PIPER_DIR=/opt/data/piper /opt/data/scripts/shift-piper-say.sh {input_path} {output_path}`) instead of deriving it from `HERMES_HOME`.
- Pin `stt.provider: local` as well as the language: an existing cloud provider selection otherwise keeps winning over the local install.
- Delete the version marker together with the venv before rebuilding; a surviving marker makes the next boot treat a half-built venv as installed.
- Before installing into `lazy-packages`, call Hermes' own `tools.lazy_deps._ensure_target_ready(Path)` (with `PYTHONPATH=/opt/hermes`): it wipes packages built for another Python ABI and re-stamps the dir, otherwise the next lazy install sees a stale stamp and deletes the pin.
- The gateway keeps the old PyAV in memory after the on-disk fix; voice notes keep failing until `/restart`.

Without the repo wiring, the Piper venv and voice files under `/opt/data/piper` must be reinstalled if the volume is recreated.
