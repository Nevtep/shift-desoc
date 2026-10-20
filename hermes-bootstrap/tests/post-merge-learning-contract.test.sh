#!/usr/bin/env bash
# Contract checks for the shift-post-merge-learning skill and the runtime it
# relies on. The skill is instructions for the autonomous agent, so these
# assert the guarantees in its text plus the bootstrap/config they depend on.
#
#   bash hermes-bootstrap/tests/post-merge-learning-contract.test.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SKILL="$ROOT/hermes-bootstrap/skills/shift-post-merge-learning/SKILL.md"
failures=0
pass() { echo "ok   - $1"; }
fail() { echo "FAIL - $1" >&2; failures=$((failures + 1)); }
check() { local name="$1"; shift; if "$@"; then pass "$name"; else fail "$name"; fi; }
# Match against the file with line breaks (and backslash continuations) folded
# into spaces, so a requirement may span lines in the markdown.
flat() { tr '\n' ' ' <"$1" | sed -e 's/\\ */ /g' -e 's/  */ /g'; }
has() { flat "$1" | grep -qiE -- "$2"; }
lacks() { ! flat "$1" | grep -qiE -- "$2"; }

# Lessons go to Engram through the CLI, with the project, and are verified.
check "lessons are saved with the engram CLI" has "$SKILL" 'engram save '
check "engram saves name the shift-desoc project" has "$SKILL" 'engram save[^`]*--project shift-desoc'
check "saved lessons are verified with engram search" has "$SKILL" 'engram search '
check "engram is invoked with HOME=/opt/data" has "$SKILL" 'HOME=/opt/data'

# The shared Hermes memory is not a per-PR lesson log and is never pruned.
check "no per-PR lesson entries in Hermes memory" lacks "$SKILL" 'lessons in Hermes memory \(one entry per lesson'
check "never remove or shorten existing memory entries" has "$SKILL" 'never (remove|delete), (shorten|truncate)'
check "a full memory is reported, not pruned" has "$SKILL" 'memory is full'

# The dev-loop trigger does not depend on hermes being on PATH, and the PR is
# acknowledged only after the trigger is confirmed.
check "trigger uses the absolute hermes path" has "$SKILL" '/opt/hermes/\.venv/bin/hermes cron run'
check "trigger is confirmed before acknowledging" has "$SKILL" 'Triggered job'
check "acknowledge requires a confirmed trigger" has "$SKILL" 'only after .*(confirmed|verified)'

# Runtime: hermes is reachable from cron (PATH has /opt/data/bin) and the
# shared memory budget leaves room for the jobs that do use it.
check "bootstrap links hermes into /opt/data/bin" has "$ROOT/scripts/bootstrap.sh" 'ln -sfn /opt/hermes/\.venv/bin/hermes "\$HERMES_HOME/bin/hermes"'
check "managed config raises memory_char_limit" has "$ROOT/hermes-bootstrap/managed-keys.yaml" 'memory_char_limit: *[4-9][0-9]{3}'

[[ $failures -eq 0 ]] && echo "all passed" || { echo "$failures failed" >&2; exit 1; }
