# Shift Hermes autonomous runtime

Hermes is the supervisor, learning system, scheduler, memory owner, and
subagent orchestrator. There is no custom Python workflow state machine.

The official Hermes image persists all state under `/opt/data`, including
sessions, memories, skills, cron jobs, logs, profile HOME, and Kanban state.
The Shift repository and `.worktrees/` live in a separate persistent volume.

## 1. Configure secrets

```bash
cp .env.hermes.example .env.hermes
chmod 600 .env.hermes
```

Fill `GITHUB_TOKEN` and one model provider, preferably `OPENROUTER_API_KEY`.

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
hermes model
codex mcp login linear
codex mcp list
gh auth status
hermes status --deep
exit
```

When using an API-key provider already present in `.env.hermes`, `hermes model`
only needs to select the provider/model.

## 4. Install the intelligent recurring loop

```bash
docker compose --env-file .env.hermes -f docker-compose.hermes.yml run --rm \
  --entrypoint /bin/bash gateway /opt/shift-hermes/scripts/install-loop.sh
```

Hermes itself creates the recurring cron job through its `cronjob` tool.

## 5. Start

```bash
docker compose --env-file .env.hermes -f docker-compose.hermes.yml up -d gateway dashboard
docker compose --env-file .env.hermes -f docker-compose.hermes.yml logs -f gateway
```

Dashboard: http://127.0.0.1:9119

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

```bash
docker compose --env-file .env.hermes -f docker-compose.hermes.yml exec gateway \
  hermes cron list
```

Copy the job id, then:

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
- delegates implementation and independent audit to different subagents;
- decides whether bounded remediation is appropriate;
- publishes the exact audited commit through `shift-linear-pr`;
- records memories and reusable procedural learning;
- proposes repo-skill improvements separately;
- stops after one PR or a safe wait condition.

Humans review and merge. The next cron run sees updated GitHub/Linear state and
re-evaluates the backlog.

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
