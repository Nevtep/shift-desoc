#!/usr/bin/env bash
# SSH into the Hermes host through SSM (no inbound port 22).
# Authorizes your public key for ec2-user (sudo) on the instance and adds a
# `shift-hermes` entry to ~/.ssh/config. Re-run after the instance is replaced.
#
# Usage: ssh-setup.sh [path/to/key.pub]   (default: first of ~/.ssh/id_ed25519.pub,
#                                          ~/.ssh/id_rsa.pub, ~/.ssh/*.pub)
source "$(dirname "$0")/common.sh"

PUBKEY="${1:-}"
if [[ -z "$PUBKEY" ]]; then
  for candidate in ~/.ssh/id_ed25519.pub ~/.ssh/id_rsa.pub ~/.ssh/*.pub; do
    [[ -f "$candidate" ]] && { PUBKEY="$candidate"; break; }
  done
fi
[[ -f "$PUBKEY" ]] || { echo "No public key found; pass one or run ssh-keygen -t ed25519" >&2; exit 1; }
PRIVKEY="${PUBKEY%.pub}"
[[ -f "$PRIVKEY" ]] || { echo "Private key $PRIVKEY not found next to $PUBKEY" >&2; exit 1; }

INSTANCE_ID="$(stack_output InstanceId)"
key_line="$(head -n1 "$PUBKEY")"
[[ "$key_line" =~ ^(ssh-|ecdsa-) ]] || { echo "$PUBKEY does not look like an SSH public key" >&2; exit 1; }

# Idempotently append the key to ec2-user's authorized_keys.
remote_cmd="$(cat <<EOF
set -euo pipefail
install -d -m 700 -o ec2-user -g ec2-user /home/ec2-user/.ssh
f=/home/ec2-user/.ssh/authorized_keys
touch "\$f"; chown ec2-user:ec2-user "\$f"; chmod 600 "\$f"
grep -qxF '$key_line' "\$f" || echo '$key_line' >> "\$f"
echo authorized
EOF
)"
id="$(aws ssm send-command --instance-ids "$INSTANCE_ID" --document-name AWS-RunShellScript \
  --comment "shift-hermes ssh key" \
  --parameters "$(jq -n --arg c "$remote_cmd" '{commands:[$c]}')" \
  --query Command.CommandId --output text)"
aws ssm wait command-executed --command-id "$id" --instance-id "$INSTANCE_ID"
aws ssm get-command-invocation --command-id "$id" --instance-id "$INSTANCE_ID" \
  --query StandardOutputContent --output text

# ~/.ssh/config entry (replaced if present).
mkdir -p ~/.ssh && chmod 700 ~/.ssh
touch ~/.ssh/config && chmod 600 ~/.ssh/config
begin="# >>> shift-hermes (managed by infra/aws/hermes/ssh-setup.sh)"
end="# <<< shift-hermes"
tmp="$(mktemp)"
awk -v b="$begin" -v e="$end" '$0==b{skip=1} !skip{print} $0==e{skip=0}' ~/.ssh/config > "$tmp"
cat >> "$tmp" <<EOF
$begin
Host shift-hermes
  HostName $INSTANCE_ID
  User ec2-user
  IdentityFile $PRIVKEY
  IdentitiesOnly yes
  ServerAliveInterval 30
  ProxyCommand sh -c "aws ssm start-session --region $AWS_REGION --target %h --document-name AWS-StartSSHSession --parameters portNumber=%p"
$end
EOF
mv "$tmp" ~/.ssh/config

echo
echo "Ready: ssh shift-hermes"
echo "  sudo shift-hermes ps|logs -f|exec -u hermes gateway bash"
