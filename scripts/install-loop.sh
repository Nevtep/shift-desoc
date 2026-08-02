#!/usr/bin/env bash
set -euo pipefail

export HERMES_HOME="${HERMES_HOME:-/opt/data}"
export HOME="${HOME:-$HERMES_HOME/home}"
MINUTES="${SHIFT_LOOP_MINUTES:-5}"

cd "${SHIFT_REPO_DIR:-/workspace/shift}"

# Validate core capabilities before scheduling.
hermes status --deep
codex mcp list | grep -q linear
gh repo view "${SHIFT_REPO_FULL_NAME:-Nevtep/shift-desoc}" >/dev/null

# Ask Hermes itself to create/manage the recurring agentic job. This uses the
# built-in cronjob tool and preserves the job in /opt/data/cron.
hermes chat --yolo --skills shift-autonomous-development,shift-runtime-tools,shift-learning-governance \
  -q "Create or update exactly one recurring cron job named 'Shift autonomous development loop'. Run it every ${MINUTES} minutes in a fresh agent session. Attach the skills shift-autonomous-development, shift-runtime-tools, and shift-learning-governance. The prompt must be: 'Run one complete Shift autonomous development cycle now. Stop after opening one audited PR, waiting because of the open-PR limit, finding no safe issue, or requiring human input.' If a matching job already exists, update it rather than duplicating it. Then report the job id and next run time."

hermes cron list
