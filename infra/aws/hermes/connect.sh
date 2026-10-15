#!/usr/bin/env bash
# Usage:
#   connect.sh shell       interactive root shell on the host (SSM)
#   connect.sh hermes      interactive bash inside the gateway container
#   connect.sh dashboard   tunnel http://127.0.0.1:9119 to the Hermes dashboard
#   connect.sh logs        follow first-boot and gateway logs
source "$(dirname "$0")/common.sh"
INSTANCE_ID="$(stack_output InstanceId)"
run() { aws ssm start-session --target "$INSTANCE_ID" --document-name AWS-StartInteractiveCommand \
  --parameters "$(jq -n --arg c "$1" '{command:[$c]}')"; }

case "${1:-shell}" in
  shell) aws ssm start-session --target "$INSTANCE_ID" ;;
  hermes) run "sudo docker exec -it -u hermes -e HOME=/opt/data -w /workspace/shift shift-hermes bash" ;;
  dashboard)
    echo "Dashboard: http://127.0.0.1:${LOCAL_PORT:-9119} (user: shift; password in SSM $PARAM_PATH/HERMES_DASHBOARD_PASSWORD)"
    aws ssm start-session --target "$INSTANCE_ID" --document-name AWS-StartPortForwardingSession \
      --parameters "{\"portNumber\":[\"9119\"],\"localPortNumber\":[\"${LOCAL_PORT:-9119}\"]}" ;;
  logs) run "sudo bash -c 'tail -n 50 /var/log/shift-hermes-bootstrap.log; shift-hermes logs -f --tail 100'" ;;
  *) echo "unknown command: $1" >&2; exit 1 ;;
esac
