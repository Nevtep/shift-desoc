#!/usr/bin/env bash
# Upload .env.hermes keys to SSM Parameter Store as SecureString.
# Usage: infra/aws/hermes/put-secrets.sh [path/to/.env.hermes]
source "$(dirname "$0")/common.sh"
ENV_FILE="${1:-$REPO_ROOT/.env.hermes}"
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }

# Only keys consumed by docker-compose.hermes.yml are uploaded.
ALLOWED='^(SHIFT_[A-Z_]+|GITHUB_TOKEN|LINEAR_API_KEY|OPENROUTER_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|ESCARLET_[A-Z_]+|CLAUDE_CODE_OAUTH_TOKEN|HERMES_DASHBOARD_[A-Z_]+|HERMES_IMAGE_TAG|CLAUDE_CODE_VERSION|PNPM_VERSION|ENGRAM_VERSION|GENTLE_AI_VERSION|TZ)$'

tmp="$(mktemp)"; chmod 600 "$tmp"; trap 'rm -f "$tmp"' EXIT
put() {
  # Pass the value through a 0600 file so it never appears in argv.
  jq -n --arg n "$PARAM_PATH/$1" --arg v "$2" \
    '{Name:$n, Value:$v, Type:"SecureString", Overwrite:true}' > "$tmp"
  aws ssm put-parameter --cli-input-json "file://$tmp" >/dev/null
  echo "stored $PARAM_PATH/$1"
}
exists() { aws ssm get-parameter --name "$PARAM_PATH/$1" >/dev/null 2>&1; }

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^[[:space:]]*# || "$line" != *=* ]] && continue
  key="${line%%=*}"; value="${line#*=}"
  [[ "$key" =~ $ALLOWED && -n "$value" ]] || continue
  put "$key" "$value"
done < "$ENV_FILE"

# Generate dashboard credentials once if neither the file nor SSM has them.
exists HERMES_DASHBOARD_USERNAME || put HERMES_DASHBOARD_USERNAME shift
exists HERMES_DASHBOARD_PASSWORD || put HERMES_DASHBOARD_PASSWORD "$(openssl rand -base64 24 | tr -d '/+=')"
exists HERMES_DASHBOARD_SESSION_SECRET || put HERMES_DASHBOARD_SESSION_SECRET "$(openssl rand -hex 32)"

echo
echo "Dashboard password: aws ssm get-parameter --region $AWS_REGION --with-decryption --name $PARAM_PATH/HERMES_DASHBOARD_PASSWORD --query Parameter.Value --output text"
