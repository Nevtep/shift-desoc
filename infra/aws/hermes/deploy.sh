#!/usr/bin/env bash
# Create/update the CloudFormation stack. Usage: deploy.sh [git-ref]
source "$(dirname "$0")/common.sh"
GIT_REF="${1:-${GIT_REF:-main}}"

aws ssm get-parameter --name "$PARAM_PATH/HERMES_DASHBOARD_PASSWORD" >/dev/null 2>&1 || {
  echo "Secrets not found under $PARAM_PATH. Run put-secrets.sh first." >&2; exit 1; }

aws cloudformation deploy \
  --stack-name "$STACK_NAME" \
  --template-file "$HERE/template.yaml" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides "GitRef=$GIT_REF" "ParameterPath=$PARAM_PATH" \
  ${INSTANCE_TYPE:+"InstanceType=$INSTANCE_TYPE"} \
  --tags Project=shift Component=hermes

aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs' --output table
echo "First boot builds the image (~10-15 min). Follow it with: $(dirname "$0")/connect.sh logs"
