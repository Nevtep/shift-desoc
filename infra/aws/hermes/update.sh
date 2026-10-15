#!/usr/bin/env bash
# Pull a git ref on the host, re-sync secrets, rebuild and restart.
# Usage: update.sh [git-ref]   (defaults to the ref the host is on)
source "$(dirname "$0")/common.sh"
INSTANCE_ID="$(stack_output InstanceId)"
cmd="/usr/local/bin/shift-hermes-update ${1:-}"
id="$(aws ssm send-command --instance-ids "$INSTANCE_ID" --document-name AWS-RunShellScript \
  --comment "shift-hermes update ${1:-current}" --timeout-seconds 3600 \
  --parameters "$(jq -n --arg c "$cmd" '{commands:[$c], executionTimeout:["3600"]}')" \
  --query Command.CommandId --output text)"
echo "SSM command $id sent; waiting..."
aws ssm wait command-executed --command-id "$id" --instance-id "$INSTANCE_ID" || true
aws ssm get-command-invocation --command-id "$id" --instance-id "$INSTANCE_ID" \
  --query '{status:Status, out:StandardOutputContent, err:StandardErrorContent}' --output yaml
