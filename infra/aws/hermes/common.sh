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
  local comment="$1" script="$2" timeout="${3:-600}" id status deadline grace errf
  id="$(aws ssm send-command --instance-ids "$INSTANCE_ID" --document-name AWS-RunShellScript \
    --comment "$comment" --timeout-seconds "$timeout" \
    --parameters "$(jq -n --arg c "$script" --arg t "$timeout" '{commands:[$c], executionTimeout:[$t]}')" \
    --query Command.CommandId --output text)"
  # The waiter errors on a non-Success status and gives up after ~20 polls; both
  # cases are handled below, so its exit code is deliberately ignored.
  aws ssm wait command-executed --command-id "$id" --instance-id "$INSTANCE_ID" >/dev/null 2>&1 || true
  deadline=$((SECONDS + timeout + 120))
  grace=$((SECONDS + 60))
  errf="$(mktemp)"
  while :; do
    # The invocation can take a few seconds to exist after send-command, so
    # InvocationDoesNotExist is retried for a short grace period. Every other
    # lookup error (AccessDenied, expired credentials, throttling, network)
    # is reported with its own message and fails immediately instead of being
    # disguised as a Pending timeout.
    if ! status="$(aws ssm get-command-invocation --command-id "$id" --instance-id "$INSTANCE_ID" \
        --query Status --output text 2>"$errf")"; then
      if grep -q 'InvocationDoesNotExist' "$errf" && (( SECONDS < grace )); then
        status=Pending
      else
        echo "SSM lookup for command $id failed:" >&2
        cat "$errf" >&2
        rm -f "${errf:?}"
        return 1
      fi
    fi
    case "$status" in
      Pending|InProgress|Delayed|Cancelling)
        (( SECONDS < deadline )) || { echo "SSM command $id still $status after ${timeout}s; giving up" >&2; rm -f "${errf:?}"; return 1; }
        sleep "${SSM_POLL_SECONDS:-5}" ;;
      *) break ;;
    esac
  done
  rm -f "${errf:?}"
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
