#!/usr/bin/env bash
# Upload .env.hermes keys to SSM Parameter Store as SecureString.
# Only keys that are new or whose value changed are written; the rest are
# reported as unchanged. Values are never printed, except the old and new
# value of non-secret settings (SHIFT_*, versions, TZ).
# Usage: infra/aws/hermes/put-secrets.sh [--dry-run] [path/to/.env.hermes]
source "$(dirname "$0")/common.sh"

DRY_RUN=0; ENV_FILE=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -*) echo "unknown option: $arg" >&2; exit 1 ;;
    *) ENV_FILE="$arg" ;;
  esac
done
ENV_FILE="${ENV_FILE:-$REPO_ROOT/.env.hermes}"
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }

# Only keys consumed by docker-compose.hermes.yml are uploaded.
ALLOWED='^(SHIFT_[A-Z_]+|GITHUB_TOKEN|LINEAR_API_KEY|OPENROUTER_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|ESCARLET_[A-Z_]+|TELEGRAM_[A-Z_]+|CLAUDE_CODE_OAUTH_TOKEN|HERMES_DASHBOARD_[A-Z_]+|HERMES_IMAGE_TAG|CLAUDE_CODE_VERSION|PNPM_VERSION|ENGRAM_VERSION|GENTLE_AI_VERSION|TZ)$'
# Settings whose old/new value is safe to show.
NONSECRET='^(SHIFT_[A-Z_]+|HERMES_IMAGE_TAG|[A-Z_]+_VERSION|TZ)$'
SECRETISH='(TOKEN|KEY|SECRET|PASSWORD)'

umask 077
work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
tmp="$work/put.json"; vfile="$work/value"; current="$work/current.json"

# Current SSM values, kept in a 0600 file inside a 0700 directory.
aws ssm get-parameters-by-path --path "$PARAM_PATH" --with-decryption --output json \
  | jq '[.Parameters[] | {n: .Name, v: .Value}]' > "$current"

put() {
  # The value reaches jq on stdin (printf is a shell builtin) and reaches the
  # AWS CLI through a 0600 file, so it never appears in any process's argv.
  printf '%s' "$2" | jq -Rs --arg n "$PARAM_PATH/$1" \
    '{Name:$n, Value:., Type:"SecureString", Overwrite:true}' > "$tmp"
  aws ssm put-parameter --cli-input-json "file://$tmp" >/dev/null
}
current_has() { jq -e --arg n "$PARAM_PATH/$1" 'any(.[]; .n == $n)' "$current" >/dev/null; }
current_equals() {
  printf '%s' "$2" > "$vfile"
  jq -e --arg n "$PARAM_PATH/$1" --rawfile v "$vfile" 'any(.[]; .n == $n and .v == $v)' "$current" >/dev/null
}
current_value() { jq -r --arg n "$PARAM_PATH/$1" '.[] | select(.n == $n) | .v' "$current"; }

n_created=0; n_updated=0; n_same=0
seen=" "   # keys handled from the env file; `current` is a snapshot from before the run

sync_param() {
  local key="$1" value="$2" action detail=""
  if ! current_has "$key"; then
    action="create"; n_created=$((n_created + 1))
    if [[ "$key" =~ $NONSECRET && ! "$key" =~ $SECRETISH ]]; then detail=" (= $value)"; fi
  elif current_equals "$key" "$value"; then
    n_same=$((n_same + 1)); printf '  unchanged  %s\n' "$key"; return
  else
    action="update"; n_updated=$((n_updated + 1))
    if [[ "$key" =~ $NONSECRET && ! "$key" =~ $SECRETISH ]]; then
      detail=" ($(current_value "$key") -> $value)"
    fi
  fi
  if (( DRY_RUN )); then
    printf '  would %-6s %s%s\n' "$action" "$key" "$detail"
  else
    put "$key" "$value"
    printf '  %-9s  %s%s\n' "${action}d" "$key" "$detail"
  fi
}

echo "SSM path: $PARAM_PATH ($AWS_REGION)$( (( DRY_RUN )) && echo ' [dry run, nothing is written]')"
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^[[:space:]]*# || "$line" != *=* ]] && continue
  key="${line%%=*}"; value="${line#*=}"
  [[ "$key" =~ $ALLOWED && -n "$value" ]] || continue
  sync_param "$key" "$value"
  seen="$seen$key "
done < "$ENV_FILE"

# Generate dashboard credentials once if neither the file nor SSM has them.
generate() {
  [[ "$seen" == *" $1 "* ]] && return
  current_has "$1" && return
  if (( DRY_RUN )); then echo "  would create  $1 (generated)"; return; fi
  put "$1" "$2"; echo "  created    $1 (generated)"
}
generate HERMES_DASHBOARD_USERNAME shift
generate HERMES_DASHBOARD_PASSWORD "$(openssl rand -base64 24 | tr -d '/+=')"
generate HERMES_DASHBOARD_SESSION_SECRET "$(openssl rand -hex 32)"

echo
echo "created: $n_created, updated: $n_updated, unchanged: $n_same"
if (( ! DRY_RUN )); then
  echo "Dashboard password: aws ssm get-parameter --region $AWS_REGION --with-decryption --name $PARAM_PATH/HERMES_DASHBOARD_PASSWORD --query Parameter.Value --output text"
fi
