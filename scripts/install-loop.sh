#!/usr/bin/env bash
# Create or update the two Shift cron jobs deterministically (idempotent):
#
#   Shift autonomous development loop  — daily 06:00, monitor-script preflight
#       (shift-dev-monitor.sh): zero-token STOP on open-PR limit / auth / lock;
#       re-armed by a new day or a new origin/main.
#   Shift merge watcher                — every 5 minutes, monitor-script
#       (shift-merge-watch.sh): wakes the agent only when a PR merged; the
#       agent runs shift-post-merge-learning and then triggers the dev loop.
#
# Job ids are written to /opt/data/shift/jobs.env for the skills.
set -euo pipefail

export HERMES_HOME="${HERMES_HOME:-/opt/data}"
export HOME="${HOME:-$HERMES_HOME}"
REPO="${SHIFT_REPO_FULL_NAME:-Nevtep/shift-desoc}"
REPO_DIR="${SHIFT_REPO_DIR:-/workspace/shift}"
STATE_DIR="$HERMES_HOME/shift"
SCRIPTS_SRC=/opt/shift-hermes/bootstrap/scripts
SCRIPTS_DST="$HERMES_HOME/scripts"
DEV_SCHEDULE="${SHIFT_DEV_LOOP_SCHEDULE:-0 6 * * *}"
WATCH_SCHEDULE="${SHIFT_MERGE_WATCH_SCHEDULE:-*/5 * * * *}"
DELIVER="${SHIFT_CRON_DELIVER:-telegram}"
[[ -n "${TELEGRAM_BOT_TOKEN:-}" ]] || DELIVER=local

cd "$REPO_DIR"

# Validate core capabilities before scheduling.
hermes status >/dev/null
test -n "${LINEAR_API_KEY:-}" || { echo "LINEAR_API_KEY is required" >&2; exit 1; }
gh repo view "$REPO" >/dev/null

mkdir -p "$STATE_DIR" "$SCRIPTS_DST"
install -m 0755 "$SCRIPTS_SRC"/shift-*.sh "$SCRIPTS_DST"/

# Prime the merge watcher so already-merged PRs are not "learned" retroactively.
if [[ ! -s "$STATE_DIR/merged-prs.seen" ]]; then
  gh pr list --repo "$REPO" --state merged --limit 100 --json number --jq '.[].number' \
    | sort -n > "$STATE_DIR/merged-prs.seen"
  echo "Primed merged-prs.seen with $(wc -l < "$STATE_DIR/merged-prs.seen") PRs"
fi
rm -f "$STATE_DIR/dev-loop.lock"

job_id_by_name() {
  /opt/hermes/.venv/bin/python - "$1" <<'PY'
import json, sys, os
path = os.path.join(os.environ.get("HERMES_HOME", "/opt/data"), "cron", "jobs.json")
try:
    data = json.load(open(path))
except FileNotFoundError:
    sys.exit(0)
jobs = data if isinstance(data, list) else data.get("jobs", data)
if isinstance(jobs, dict):
    jobs = list(jobs.values())
for job in jobs:
    if job.get("name") == sys.argv[1]:
        print(job["id"]); break
PY
}

DEV_PROMPT='Run one complete Shift autonomous development cycle now. The MONITOR block above is the preflight: if it says PREFLIGHT=STOP, reply exactly [SILENT] and do nothing else. Otherwise stop after opening one audited PR, waiting because of the open-PR limit, finding no safe issue, or requiring human input.'
WATCH_PROMPT='PRs merged into main are listed under NEW_MERGED_PRS in the MONITOR block. If that list is "(none)" or STATUS=ERROR, reply exactly [SILENT] and do nothing else. Otherwise follow shift-post-merge-learning for exactly those PRs: sync the checkout, learn from the reviews and post-audit fixes, persist the lessons, and trigger the development loop job as your last step.'

upsert() {
  local name="$1" schedule="$2" monitor="$3" prompt="$4"; shift 4
  local id; id="$(job_id_by_name "$name")"
  if [[ -n "$id" ]]; then
    hermes cron edit "$id" --schedule "$schedule" --prompt "$prompt" \
      --monitor-script "$monitor" --workdir "$REPO_DIR" --deliver "$DELIVER" "$@" >/dev/null
    echo "updated $name ($id)"
  else
    hermes cron create "$schedule" "$prompt" --name "$name" --monitor-script "$monitor" \
      --workdir "$REPO_DIR" --deliver "$DELIVER" "$@" >/dev/null
    id="$(job_id_by_name "$name")"
    echo "created $name ($id)"
  fi
  printf '%s' "$id"
}

loaded_skills="$(COLUMNS=250 hermes skills list --source local --enabled-only 2>/dev/null || true)"
skill_args() { # emit --skill <name> for each loaded skill; warn for the rest
  local out=()
  for s in "$@"; do
    if grep -qw -- "$s" <<<"$loaded_skills"; then out+=(--skill "$s")
    else echo "WARNING: skill $s not loaded yet (not in main?); attach it by re-running install-loop.sh after it merges." >&2; fi
  done
  printf '%s\n' "${out[@]}"
}

model_args=()
[[ -n "${SHIFT_DEV_LOOP_MODEL:-}" ]] && model_args=(--model "$SHIFT_DEV_LOOP_MODEL" --provider "${SHIFT_DEV_LOOP_PROVIDER:-openrouter}")

mapfile -t dev_skills < <(skill_args shift-autonomous-development shift-runtime-tools shift-learning-governance)
mapfile -t watch_skills < <(skill_args shift-post-merge-learning shift-learning-governance shift-runtime-tools)
dev_id="$(upsert "Shift autonomous development loop" "$DEV_SCHEDULE" shift-dev-monitor.sh "$DEV_PROMPT" \
  "${dev_skills[@]}" "${model_args[@]}" | tail -c 12)"
watch_id="$(upsert "Shift merge watcher" "$WATCH_SCHEDULE" shift-merge-watch.sh "$WATCH_PROMPT" \
  "${watch_skills[@]}" | tail -c 12)"

cat > "$STATE_DIR/jobs.env" <<EOF
DEV_LOOP_JOB_ID=$dev_id
MERGE_WATCH_JOB_ID=$watch_id
EOF
echo "jobs.env: DEV_LOOP_JOB_ID=$dev_id MERGE_WATCH_JOB_ID=$watch_id"

hermes cron list
