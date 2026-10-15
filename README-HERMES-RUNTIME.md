# Shift Hermes autonomous runtime

Hermes is the supervisor, learning system, scheduler, memory owner, and
orchestrator. Claude Code (`claude -p`) is the coding agent it delegates
implementation and audits to. There is no custom Python workflow state machine.

The official Hermes image persists all state under `/opt/data`, including
sessions, memories, skills, cron jobs, logs, profile HOME, and Kanban state.
The Shift repository and `.worktrees/` live in a separate persistent volume.

## 1. Configure secrets

```bash
cp .env.hermes.example .env.hermes
chmod 600 .env.hermes
```

Fill `GITHUB_TOKEN`, `LINEAR_API_KEY`, one supervisor model provider
(preferably `OPENROUTER_API_KEY`), Claude Code auth (`ANTHROPIC_API_KEY`, or
`CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token` for a Pro/Max plan) and
`HERMES_DASHBOARD_PASSWORD`. The dashboard refuses to
start on a non-loopback bind without an auth provider, so the password is
required.

## 2. Build and bootstrap

```bash
docker compose --env-file .env.hermes -f docker-compose.hermes.yml build
docker compose --env-file .env.hermes -f docker-compose.hermes.yml run --rm init
```

## 3. One-time authentication

Open a shell using the persistent Hermes data volume:

```bash
docker compose --env-file .env.hermes -f docker-compose.hermes.yml run --rm -it \
  --entrypoint bash gateway
```

Inside:

```bash
hermes model            # only to change the seeded provider/model
hermes mcp test linear  # Linear MCP via LINEAR_API_KEY (no browser OAuth)
claude -p "Reply OK"    # Claude Code auth works
claude mcp list         # linear (and engram plugin) available to Claude Code
gh auth status
hermes status --deep
exit
```

## 4. Install the intelligent recurring loop

```bash
docker compose --env-file .env.hermes -f docker-compose.hermes.yml run --rm \
  --entrypoint /bin/bash gateway /opt/shift-hermes/scripts/install-loop.sh
```

Hermes itself creates the recurring cron job through its `cronjob` tool.

## 5. Start

```bash
docker compose --env-file .env.hermes -f docker-compose.hermes.yml up -d gateway
docker compose --env-file .env.hermes -f docker-compose.hermes.yml logs -f gateway
```

Dashboard: http://127.0.0.1:9119 (basic auth: `HERMES_DASHBOARD_USERNAME` /
`HERMES_DASHBOARD_PASSWORD`).

## 6. Verify

```bash
docker compose --env-file .env.hermes -f docker-compose.hermes.yml exec gateway \
  /opt/shift-hermes/scripts/doctor.sh

docker compose --env-file .env.hermes -f docker-compose.hermes.yml exec gateway \
  hermes cron list

docker compose --env-file .env.hermes -f docker-compose.hermes.yml exec gateway \
  hermes journey
```

## 7. Trigger immediately

Get the job id from `hermes cron list` (step 6), then:

```bash
docker compose --env-file .env.hermes -f docker-compose.hermes.yml exec gateway \
  hermes cron run <JOB_ID>
```

## Behavior

Each cron invocation starts a fresh Hermes agent session with the supervisor
skill loaded. Hermes:
- runs the Linear readiness skill;
- reasons over the queue;
- creates a repo-local worktree;
- delegates implementation and independent audit to separate fresh Claude Code sessions (`claude -p`);
- decides whether bounded remediation is appropriate;
- publishes the exact audited commit through `shift-linear-pr`;
- records memories and reusable procedural learning;
- proposes repo-skill improvements separately;
- stops after one PR or a safe wait condition.

Humans review and merge. The next cron run sees updated GitHub/Linear state and
re-evaluates the backlog.

## Configuration ownership

- `hermes-bootstrap/config.yaml` and `SOUL.md` are seeded into the
  `hermes_data` volume only on first bootstrap; afterwards Hermes owns them.
- `hermes-bootstrap/managed-keys.yaml` is deep-merged on every bootstrap
  (skill dirs, Linear MCP, cron concurrency), so reviewed changes there reach
  existing deployments.
- Hermes-native skills load from `hermes-bootstrap/skills/` in the persistent
  `main` checkout, so skill changes go live only after merge to `main` and the
  next bootstrap/sync. Repo-local `.github/skills/` are read by path (Hermes
  excludes `.github` from skill scans); see `shift-autonomous-development`.
- If the persistent `main` checkout is dirty, bootstrap stashes the changes
  (`git stash list` shows `hermes-bootstrap-autosave-*`) instead of failing.

## AWS

See `infra/aws/hermes/README.md` to run this stack on EC2 with SSM access.

## Stop without deleting state

```bash
docker compose --env-file .env.hermes -f docker-compose.hermes.yml stop
```

## Upgrade Hermes

```bash
docker compose --env-file .env.hermes -f docker-compose.hermes.yml build --pull
docker compose --env-file .env.hermes -f docker-compose.hermes.yml up -d
```

The `hermes_data` and `shift_workspace` volumes are retained.
