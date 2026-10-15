# Shift Hermes on AWS

One Graviton EC2 host runs `docker-compose.hermes.yml` unchanged.

- **No inbound ports.** Shell and dashboard go through SSM Session Manager.
- **Secrets** live in SSM Parameter Store (`/shift/hermes/*`, SecureString) and
  are rendered to a root-only `.env.hermes` on each boot/update.
- **State** (Docker data-root: image, `hermes_data`, `shift_workspace`) lives on
  a separate encrypted gp3 volume with daily snapshots (7 kept) and a
  snapshot-on-delete policy, so replacing the instance keeps Hermes memory,
  cron jobs and worktrees.

## Prerequisites (local)

```bash
brew install awscli jq
brew install --cask session-manager-plugin
aws configure sso   # or aws configure
```

Set `AWS_PROFILE` / `AWS_REGION` as needed (default region: `us-east-1`).

## Deploy

```bash
infra/aws/hermes/put-secrets.sh            # uploads .env.hermes; generates dashboard creds
infra/aws/hermes/deploy.sh devops/hermes-aws   # git ref to run; default main
infra/aws/hermes/connect.sh logs           # watch first boot (~10-15 min)
```

## Operate

```bash
infra/aws/hermes/connect.sh hermes      # bash inside the gateway container
infra/aws/hermes/connect.sh dashboard   # http://127.0.0.1:9119
infra/aws/hermes/connect.sh shell       # host shell; `sudo shift-hermes ps|logs|...`
infra/aws/hermes/update.sh [git-ref]    # pull, re-sync secrets, rebuild, restart
```

Inside the container, finish the one-time steps from `README-HERMES-RUNTIME.md`
(check `hermes mcp test linear`, run `install-loop.sh`, then `doctor.sh`).

Rotate a secret: re-run `put-secrets.sh` (or `aws ssm put-parameter --overwrite`),
then `update.sh`.

## Cost (us-east-1, on-demand, approx.)

`t4g.xlarge` ~US$98/month + 130 GiB gp3 ~US$10/month + snapshots. Use
`INSTANCE_TYPE=t4g.large deploy.sh` to halve compute if 8 GiB RAM is enough.
LLM usage is billed separately by the model provider and is usually the
dominant cost: tune `SHIFT_LOOP_MINUTES`.

## Teardown

```bash
aws cloudformation delete-stack --stack-name shift-hermes
```

The data volume is snapshotted before deletion; SSM parameters are kept.
