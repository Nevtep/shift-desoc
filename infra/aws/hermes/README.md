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
ssh shift-hermes                        # after ssh-setup.sh (see Operators)
infra/aws/hermes/update.sh [git-ref]    # pull, re-sync secrets, rebuild, restart
                                        # (a deleted ref falls back to main)
```

Inside the container, finish the one-time steps from `README-HERMES-RUNTIME.md`
(check `hermes mcp test linear`, run `install-loop.sh`, then `doctor.sh`).

Rotate a secret: re-run `put-secrets.sh` (or `aws ssm put-parameter --overwrite`),
then `update.sh`.

## Engram memory sync

Hermes imports every Engram chunk merged into `.engram/` on `main`: the merge
watcher syncs its checkout and runs `shift-engram-import.sh` (idempotent,
from a temp copy, log in `/opt/data/shift/engram-import.log`), and
`shift-post-merge-learning` runs it again. So sharing local learnings with
the agent needs no SSH, only a PR:

```bash
engram sync                   # exports new shift-desoc memories as .engram/chunks/<id>.jsonl.gz
gzip -dc .engram/chunks/<id>.jsonl.gz | jq .   # review: the repo is public
git add .engram && git commit -m "chore(engram): sync memories"
```

Review the chunk before pushing: no secrets, private keys, tokens, wallet
material, personal data or deployment addresses (redact them in Engram and
re-export if needed). Only project `shift-desoc` is exported (`.engram/config.json`).
Open a PR (alone or with the feature it belongs to); once it merges, Hermes
imports the chunk within one merge-watcher tick.

Operators with SSH can push immediately instead: `infra/aws/hermes/sync-engram.sh`
exports and imports straight into the agent's Engram on the host (same
idempotent import; other local projects are never sent). Commit `.engram/`
afterwards anyway so future bootstraps and teammates have it.

Hermes pins engram 1.20.0 (`docker/Dockerfile.hermes`); it imports chunks
exported by engram 3.x (verified with 3.4.0), so local engram can be newer.

## Operators (SSH with sudo)

Each person gets an IAM user in the stack's operators group (SSM/SSH to this
instance only, plus reading the dashboard password) and a personal Linux
account with sudo and docker. SSH rides on SSM: no port 22 is open.

Admin, once per person (needs their **public** key):

```bash
GROUP=$(aws cloudformation describe-stacks --stack-name shift-hermes \
  --query "Stacks[0].Outputs[?OutputKey=='OperatorsGroupName'].OutputValue" --output text)
aws iam create-user --user-name carlos
aws iam add-user-to-group --group-name "$GROUP" --user-name carlos
# Console password so they can use `aws login` (or create an access key):
aws iam create-login-profile --user-name carlos --password '<temporary>' --password-reset-required
infra/aws/hermes/add-operator.sh carlos carlos.pub
```

Operator, on their machine (repo checkout, AWS CLI, session-manager-plugin):

```bash
aws login                                     # as their IAM user, region us-east-1
infra/aws/hermes/ssh-setup.sh --user carlos   # writes ~/.ssh/config
ssh shift-hermes
sudo shift-hermes exec -u hermes gateway bash # act as the agent user
```

Remove access: `add-operator.sh --remove carlos` and remove the IAM user.
After an instance replacement: `add-operator.sh --reapply`.
`ec2-user` stays as the admin break-glass account (`ssh-setup.sh` without `--user`).

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
