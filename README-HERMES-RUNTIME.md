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

## 4. Install the cron jobs

```bash
docker compose --env-file .env.hermes -f docker-compose.hermes.yml run --rm \
  --entrypoint /bin/bash gateway /opt/shift-hermes/scripts/install-loop.sh
```

Creates or updates two jobs (idempotent, ids written to `/opt/data/shift/jobs.env`):

| Job | Schedule | Monitor script (no LLM) | Agent runs when |
| --- | --- | --- | --- |
| Shift autonomous development loop | daily 06:00 | `shift-dev-monitor.sh`: gh auth, Linear key, cycle lock, open agent PRs `< SHIFT_MAX_OPEN_PRS` (with feature and bug lanes, see below), `origin/main` | guard says GO and the day or `origin/main` changed; repeated STOP costs nothing |
| Shift merge watcher | every 5 min | `shift-merge-watch.sh`: PRs merged into `main` and not yet acknowledged (a PR stays pending until the learning skill runs `shift-merge-ack.sh`; retried hourly, 6 rounds max) | a PR merged → `shift-post-merge-learning` (sync checkout, prune worktrees, learn from reviews and post-audit fixes, persist to memory/Engram) → triggers the dev loop |

So the human loop is: review → merge on GitHub → within 5 minutes Hermes
learns from the merge and starts the next feature, which stops by itself when
`SHIFT_MAX_OPEN_PRS` agent PRs are already open.

The open-PR limit has lanes, because review capacity (one human reviewer) is
the real bottleneck and a single cap let feature PRs starve the bug fixes that
unblock them:

| Variable | Default | Meaning |
| --- | --- | --- |
| `SHIFT_MAX_OPEN_PRS` | `3` | Total open agent PRs (`feat/`, `imp/` and `fix/` branches named `SHI-<n>/...`). |
| `SHIFT_MAX_FEATURE_PRS` | `2` | Most feature PRs (`feat/`, `imp/`) open at once, clamped to the total. The rest of the total (`SHIFT_MAX_OPEN_PRS - SHIFT_MAX_FEATURE_PRS`) is reserved for bug PRs (`fix/`); features never take it. |

The defaults (`SHIFT_MAX_OPEN_PRS=3` and `SHIFT_MAX_FEATURE_PRS=2`) give two
features plus one reserved bug slot. Keep the total at least one above the
feature cap, otherwise the bug lane is empty. A server `.env.hermes` that still
sets `SHIFT_MAX_OPEN_PRS` overrides the default. The monitor
prints `LANES=feature,bug`, `LANES=bug` or stops when none is open, and the
supervisor selects only an issue of an open lane. Branch conflicts between
two PRs on the same flow are not detected by the guard.

### Skill edits made in place

Hermes loads its skills from the live checkout, and its own skill editing
writes there. So that an edit is neither lost at the next reset nor live
without review, the merge watcher also runs `shift-skill-persist.sh` on every
tick. When the live checkout holds uncommitted changes under
`hermes-bootstrap/skills` or `.github/skills`, and no development cycle is
running, and the newest change is older than `SHIFT_SKILL_PERSIST_QUIET_MIN`
minutes (default `10`, so a half-finished edit is left alone), it:

1. saves a backup patch under `/opt/data/shift/skill-persist/` (mode 600);
2. applies the change on a fresh worktree from `origin/main`, commits it, pushes
   `chore/hermes-self-update/skill-edit-<hash>` and opens a PR (never merges);
3. only then restores the checkout.

Any failure leaves the checkout untouched. The monitor prints one
`SKILL_PERSIST=PR_OPENED #<n> files=<k>`, `ALREADY_PROPOSED #<n>` or
`FAILED <reason>` line, which wakes the agent: it creates the Linear issue the
PR must cite (`shift-post-merge-learning` step 0). Nothing is captured outside
those two directories.

The cron job prompt of the merge watcher also handles these lines, and the job
stores its prompt: after deploying this change (`update.sh`), re-run
`install-loop.sh` (idempotent) so the installed cron prompt is refreshed.
Without that, the old prompt tells the agent to reply `[SILENT]` on an empty
list and a captured edit would never get its Linear issue.

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

Job ids are in `/opt/data/shift/jobs.env` (or `hermes cron list`), then:

```bash
docker compose --env-file .env.hermes -f docker-compose.hermes.yml exec gateway \
  hermes cron run <JOB_ID>
```

## Behavior

Each development-loop run starts a fresh Hermes agent session with the
supervisor skill loaded, after the monitor script's guard passed. Hermes:
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
