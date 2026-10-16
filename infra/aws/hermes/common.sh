#!/usr/bin/env bash
# Shared settings for the Shift Hermes AWS helpers. Override via env vars.
set -euo pipefail

export AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
STACK_NAME="${STACK_NAME:-shift-hermes}"
PARAM_PATH="${PARAM_PATH:-/shift/hermes}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../../.." && pwd)"

stack_output() {
  aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

# Run one shell script on the host via SSM RunCommand and print its stdout.
# Unlike `aws ssm wait command-executed` alone, this keeps polling until the
# invocation reaches a terminal status and returns non-zero (with the status
# and the remote stderr on our stderr) unless that status is Success.
# Usage: ssm_run <comment> <script> [execution-timeout-seconds]   (needs INSTANCE_ID)
ssm_run() {
  local comment="$1" script="$2" timeout="${3:-600}" id status deadline
  id="$(aws ssm send-command --instance-ids "$INSTANCE_ID" --document-name AWS-RunShellScript \
    --comment "$comment" --timeout-seconds "$timeout" \
    --parameters "$(jq -n --arg c "$script" --arg t "$timeout" '{commands:[$c], executionTimeout:[$t]}')" \
    --query Command.CommandId --output text)"
  # The waiter errors on a non-Success status and gives up after ~20 polls; both
  # cases are handled below, so its exit code is deliberately ignored.
  aws ssm wait command-executed --command-id "$id" --instance-id "$INSTANCE_ID" >/dev/null 2>&1 || true
  deadline=$((SECONDS + timeout + 120))
  while :; do
    # The invocation can take a few seconds to exist after send-command.
    status="$(aws ssm get-command-invocation --command-id "$id" --instance-id "$INSTANCE_ID" \
      --query Status --output text 2>/dev/null || echo Pending)"
    case "$status" in
      Pending|InProgress|Delayed|Cancelling)
        (( SECONDS < deadline )) || { echo "SSM command $id still $status after ${timeout}s; giving up" >&2; return 1; }
        sleep 5 ;;
      *) break ;;
    esac
  done
  aws ssm get-command-invocation --command-id "$id" --instance-id "$INSTANCE_ID" \
    --query StandardOutputContent --output text
  if [[ "$status" != Success ]]; then
    {
      echo "SSM command $id finished with status $status"
      aws ssm get-command-invocation --command-id "$id" --instance-id "$INSTANCE_ID" \
        --query StandardErrorContent --output text
    } >&2
    return 1
  fi
}
