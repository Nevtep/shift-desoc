#!/usr/bin/env bash
# SSH into the Hermes host through SSM (no inbound port 22): adds a
# `shift-hermes` entry to ~/.ssh/config for your Linux user on the host.
#
# Operators (personal account created by an admin with add-operator.sh):
#   ssh-setup.sh --user <name> [path/to/key.pub]
# Admin bootstrap (authorizes the key for ec2-user via SSM RunCommand):
#   ssh-setup.sh [path/to/key.pub]
# Default key: first of ~/.ssh/id_ed25519.pub, ~/.ssh/id_rsa.pub, ~/.ssh/*.pub
source "$(dirname "$0")/common.sh"

SSH_USER=ec2-user
if [[ "${1:-}" == "--user" ]]; then
  SSH_USER="${2:?usage: ssh-setup.sh --user <name> [key.pub]}"
  shift 2
fi
PUBKEY="${1:-}"
if [[ -z "$PUBKEY" ]]; then
  for candidate in ~/.ssh/id_ed25519.pub ~/.ssh/id_rsa.pub ~/.ssh/*.pub; do
    [[ -f "$candidate" ]] && { PUBKEY="$candidate"; break; }
  done
fi
[[ -f "$PUBKEY" ]] || { echo "No public key found; pass one or run ssh-keygen -t ed25519" >&2; exit 1; }
PRIVKEY="${PUBKEY%.pub}"
[[ -f "$PRIVKEY" ]] || { echo "Private key $PRIVKEY not found next to $PUBKEY" >&2; exit 1; }

key_line="$(head -n1 "$PUBKEY")"
[[ "$key_line" =~ ^(ssh-ed25519|ssh-rsa|ecdsa-sha2-[a-z0-9-]+|sk-[a-z0-9@.-]+)\ [A-Za-z0-9+/=]+ ]] \
  || { echo "$PUBKEY does not look like an SSH public key" >&2; exit 1; }
INSTANCE_ID="$(stack_output InstanceId)"

if [[ "$SSH_USER" == ec2-user ]]; then
# Idempotently append the key to ec2-user's authorized_keys. The key (whose
# comment is free text) travels base64-encoded so it is never interpolated
# into the remote shell script. Fails if the remote step does not succeed.
key_b64="$(printf '%s' "$key_line" | base64 | tr -d '\n')"
ssm_run "shift-hermes ssh key" "$(cat <<EOF
set -euo pipefail
install -d -m 700 -o ec2-user -g ec2-user /home/ec2-user/.ssh
f=/home/ec2-user/.ssh/authorized_keys
touch "\$f"; chown ec2-user:ec2-user "\$f"; chmod 600 "\$f"
k="\$(echo '$key_b64' | base64 -d)"
grep -qxF -- "\$k" "\$f" || printf '%s\n' "\$k" >> "\$f"
echo authorized
EOF
)"
fi

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
  User $SSH_USER
  IdentityFile $PRIVKEY
  IdentitiesOnly yes
  ServerAliveInterval 30
  ProxyCommand sh -c "aws ssm start-session --region $AWS_REGION --target %h --document-name AWS-StartSSHSession --parameters portNumber=%p"
$end
EOF
mv "$tmp" ~/.ssh/config

echo
echo "Ready: ssh shift-hermes   (as $SSH_USER)"
echo "  sudo shift-hermes ps | logs -f gateway | exec -u hermes gateway bash"
