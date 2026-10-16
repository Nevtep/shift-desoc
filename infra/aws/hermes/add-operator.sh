#!/usr/bin/env bash
# Admin-only: create (or update) a personal Linux account on the Hermes host
# with sudo and docker access, authorized for the given SSH public key.
# Keys are also stored in SSM (/shift/hermes-operators/<name>) so they can be
# re-applied after an instance replacement with --reapply.
#
# Usage:
#   add-operator.sh <name> <key.pub>     add/update one operator
#   add-operator.sh --reapply            re-create every stored operator
#   add-operator.sh --remove <name>      lock the account and forget the key
#
# The person also needs an IAM user in the stack's operators group
# (see infra/aws/hermes/README.md) and then runs ssh-setup.sh --user <name>.
source "$(dirname "$0")/common.sh"
OPERATORS_PATH="${OPERATORS_PATH:-/shift/hermes-operators}"
INSTANCE_ID="$(stack_output InstanceId)"

run_remote() {
  local id
  id="$(aws ssm send-command --instance-ids "$INSTANCE_ID" --document-name AWS-RunShellScript \
    --comment "shift-hermes operator" \
    --parameters "$(jq -n --arg c "$1" '{commands:[$c]}')" \
    --query Command.CommandId --output text)"
  aws ssm wait command-executed --command-id "$id" --instance-id "$INSTANCE_ID" || true
  aws ssm get-command-invocation --command-id "$id" --instance-id "$INSTANCE_ID" \
    --query '[Status,StandardOutputContent,StandardErrorContent]' --output text
}

valid_name() { [[ "$1" =~ ^[a-z][a-z0-9_-]{1,30}$ && "$1" != ec2-user && "$1" != root ]]; }

apply_operator() {
  local name="$1" key="$2" key_b64
  key_b64="$(printf '%s' "$key" | base64 | tr -d '\n')"
  run_remote "$(cat <<EOF
set -euo pipefail
id -u $name >/dev/null 2>&1 || useradd -m -s /bin/bash $name
usermod -aG docker $name
usermod -U -s /bin/bash $name 2>/dev/null || true
echo '$name ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/90-shift-operator-$name
chmod 440 /etc/sudoers.d/90-shift-operator-$name
visudo -cf /etc/sudoers.d/90-shift-operator-$name >/dev/null
install -d -m 700 -o $name -g $name /home/$name/.ssh
echo '$key_b64' | base64 -d > /home/$name/.ssh/authorized_keys
chown $name:$name /home/$name/.ssh/authorized_keys
chmod 600 /home/$name/.ssh/authorized_keys
echo "operator $name ready"
EOF
)"
}

case "${1:-}" in
  --reapply)
    aws ssm get-parameters-by-path --path "$OPERATORS_PATH" --output json \
      | jq -r '.Parameters[] | "\(.Name | split("/") | last)\t\(.Value)"' \
      | while IFS=$'\t' read -r name key; do apply_operator "$name" "$key"; done
    ;;
  --remove)
    name="${2:?usage: add-operator.sh --remove <name>}"
    valid_name "$name" || { echo "invalid name: $name" >&2; exit 1; }
    run_remote "set -e; rm -f /etc/sudoers.d/90-shift-operator-$name; if id -u $name >/dev/null 2>&1; then usermod -L -s /sbin/nologin $name; gpasswd -d $name docker || true; : > /home/$name/.ssh/authorized_keys; fi; echo removed $name"
    aws ssm delete-parameter --name "$OPERATORS_PATH/$name" 2>/dev/null || true
    ;;
  ""|-h|--help)
    sed -n '2,15p' "$0"; exit 1 ;;
  *)
    name="$1"; pubkey="${2:?usage: add-operator.sh <name> <key.pub>}"
    valid_name "$name" || { echo "invalid name: $name (lowercase, 2-31 chars, not ec2-user/root)" >&2; exit 1; }
    key="$(head -n1 "$pubkey")"
    [[ "$key" =~ ^(ssh-ed25519|ssh-rsa|ecdsa-sha2-[a-z0-9-]+|sk-[a-z0-9@.-]+)\ [A-Za-z0-9+/=]+ ]] \
      || { echo "$pubkey does not look like an SSH public key" >&2; exit 1; }
    aws ssm put-parameter --name "$OPERATORS_PATH/$name" --type String --value "$key" --overwrite >/dev/null
    apply_operator "$name" "$key"
    ;;
esac
