#!/usr/bin/env bash
# Pull a git ref on the host, re-sync secrets, rebuild and restart.
# Usage: update.sh [git-ref]   (defaults to the ref the host is on)
# Exits non-zero if the remote update does not finish with status Success.
source "$(dirname "$0")/common.sh"
INSTANCE_ID="$(stack_output InstanceId)"
echo "Sending update (${1:-current ref}) to $INSTANCE_ID; this can take several minutes..."
ssm_run "shift-hermes update ${1:-current}" "/usr/local/bin/shift-hermes-update ${1:-}" 3600
