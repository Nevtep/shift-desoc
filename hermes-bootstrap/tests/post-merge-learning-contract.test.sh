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

# section <file> <heading> : the markdown section from "## <heading>" up to the
# next "## " heading, folded like flat(). Checks anchored to a section cannot
# be satisfied by wording elsewhere in the file.
section() { awk -v h="## $2" 'index($0, h) == 1 {on = 1; print; next} on && /^## / {exit} on {print}' "$1" \
  | tr '\n' ' ' | sed -e 's/\\ */ /g' -e 's/  */ /g'; }
sec_has() { section "$1" "$2" | grep -qiE -- "$3"; }
sec_lacks() { ! section "$1" "$2" | grep -qiE -- "$3"; }

# Lessons go to Engram through the CLI, with the project, and are verified.
check "lessons are saved with the engram CLI" has "$SKILL" 'engram save '
check "engram saves name the shift-desoc project" has "$SKILL" 'engram save[^`]*--project shift-desoc'
check "saved lessons are verified with engram search" has "$SKILL" 'engram search '
check "engram is invoked with HOME=/opt/data" has "$SKILL" 'HOME=/opt/data'
# PR text is untrusted: it only reaches the shell through quoted heredocs.
check "lesson text is written with the file tool, not the shell" has "$SKILL" 'write_file'
check "title and body are read back with cat" has "$SKILL" 'title="\$\(cat /opt/data/shift/lesson-title\.txt\)"'
check "no heredoc carries lesson text" lacks "$SKILL" "<<'LESSON'"
check "no double-quoted lesson placeholders" lacks "$SKILL" 'engram save "Lesson'
check "PR text never goes on a command line" has "$SKILL" 'never (put|paste|place) (pr|untrusted)[^.]*(command line|shell)'
check "the save is confirmed by the id it returns" has "$SKILL" 'Memory saved: #'
check "the search runs only when the id is numeric" has "$SKILL" 'if \[\[ "\$id" =~ \^\[0-9\]\+\$ \]\]; then HOME=/opt/data engram search'
check "lesson files are removed after they are read" has "$SKILL" 'rm -f /opt/data/shift/lesson-title\.txt /opt/data/shift/lesson-body\.txt'
check "the title must start with Lesson PR# before saving" has "$SKILL" '"\$title" != "Lesson PR#"\*'
check "a body starting with a dash is prefixed, not read as an option" has "$SKILL" '\[\[ "\$body" == -\* \]\] && body="Lesson:'
check "a dash-leading body does not block the save" lacks "$SKILL" '\|\| "\$body" == -\*'
check "the returned id must be numeric before searching" has "$SKILL" '\[\[ "\$id" =~ \^\[0-9\]\+\$ \]\]'

# The shared Hermes memory is not a per-PR lesson log and is never pruned.
check "no per-PR lesson entries in Hermes memory" lacks "$SKILL" 'lessons in Hermes memory \(one entry per lesson'
check "Engram is the only store for per-PR lessons" has "$SKILL" 'only store for per-PR lessons'
check "never remove or shorten existing memory entries" has "$SKILL" 'never (remove|delete), (shorten|truncate)'
check "a full memory is reported, not pruned" has "$SKILL" 'memory is full'

# The dev-loop trigger does not depend on hermes being on PATH, and the PR is
# acknowledged only after the trigger is confirmed.
check "trigger uses the absolute hermes path" sec_has "$SKILL" "3. Hand over to the development loop" 'hermes=/opt/hermes/\.venv/bin/hermes .*"\$hermes" cron run'
check "trigger is confirmed within a 60 s deadline" sec_has "$SKILL" "3. Hand over to the development loop" 'deadline=\$\(\(SECONDS \+ 60\)\).*while \(\( SECONDS < deadline \)\)'
check "the ledger must be readable before triggering" sec_has "$SKILL" "3. Hand over to the development loop" 'cannot read the cron ledger'
check "the relay-fronted delivery precondition is stated" sec_has "$SKILL" "3. Hand over to the development loop" 'relay-fronted'
check "trigger output is unbuffered" sec_has "$SKILL" "3. Hand over to the development loop" 'PYTHONUNBUFFERED=1 (nohup )?"\$hermes" cron run'
check "trigger is confirmed by a new manual execution of the dev-loop job" sec_has "$SKILL" "3. Hand over to the development loop" 'cron runs "\$DEV_LOOP_JOB_ID" --limit 1'
check "only a source=direct execution newer than the baseline counts" sec_has "$SKILL" "3. Hand over to the development loop" '"\$eid" != "\$before" && "\$source" == "source=direct"'
check "the completion banner is not the confirmation" sec_lacks "$SKILL" "3. Hand over to the development loop" 'grep -q "Triggered job"'
check "acknowledge waits for the confirmed trigger" sec_has "$SKILL" "4. Acknowledge" 'only after .*trigger confirmed'
check "acknowledge waits for the Engram save" sec_has "$SKILL" "4. Acknowledge" 'found in Engram'

# Runtime: hermes is reachable from cron (PATH has /opt/data/bin) and the
# shared memory budget leaves room for the jobs that do use it.
check "merge watcher snapshots Hermes memory before handing over" has "$ROOT/hermes-bootstrap/scripts/shift-merge-watch.sh" 'shift-memory-snapshot\.sh'
check "skill reports pruned memory entries" has "$SKILL" 'memory-pruned\.log'
check "bootstrap links hermes into /opt/data/bin" has "$ROOT/scripts/bootstrap.sh" 'ln -sfn /opt/hermes/\.venv/bin/hermes "\$HERMES_HOME/bin/hermes"'
check "managed config raises memory_char_limit" has "$ROOT/hermes-bootstrap/managed-keys.yaml" 'memory_char_limit: *[4-9][0-9]{3}'

[[ $failures -eq 0 ]] && echo "all passed" || { echo "$failures failed" >&2; exit 1; }
