---
name: hermes-instance-administration
description: "Use when changing Hermes models, profiles, persona, or bots."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [hermes, profiles, models, reasoning, telegram, gateway, pairing, soul, cron]
    related_skills: [hermes-agent]
---

# Hermes Instance Administration

This skill covers operator work on this Docker-installed Hermes (home `/opt/data`, install `/opt/hermes`): changing models and reasoning effort, creating tiered profiles, setting the agent persona, and giving people access through messaging platforms. Load the bundled `hermes-agent` skill too; it has the general CLI reference. Sections 0–6 have been run on this host and their results checked. The messaging procedure in section 7 comes from the gateway source code and docs, and hasn't been run end to end yet.

## When to Use
- Switching the main model or reasoning effort, or splitting usage into cost tiers (default, dev, premium).
- Creating, renaming or cloning profiles.
- Defining or rewriting the agent persona (SOUL.md).
- Connecting a messaging bot and authorizing specific people.

## 0. Preflight
- The `hermes` binary is not on PATH in agent terminals. Start every terminal call with `export PATH=/opt/hermes/.venv/bin:$PATH`.
- Back up before you edit: `cp /opt/data/{config.yaml,SOUL.md} /opt/data/backups/<name>.bak-<date>`.
- Anything that must outlive a day (a pinned Node version, tool installs) goes under `/opt/data/cache/<project>/`, not `/opt/data/cache/scratch`: scratch entries idle for 24h are pruned, and a tool installed there vanishes silently between sessions. An `export PATH=...` does not reliably carry between terminal calls; run `env PATH=<dir>:$PATH <cmd>` and print the version in the same call.
- The terminal session keeps its last `cwd`. If you remove a git worktree you were `cd`'d into, every later terminal call fails with exit 126 (`cd: ...: No such file or directory`) even for unrelated commands; pass `workdir=` (an existing path such as the main checkout) on the next call to reset it.
- Look at what is already running before you change the main model: `hermes profile list`, `hermes cron list`, and `ps aux | grep hermes` (the gateway and dashboard run under s6).

## 1. Model IDs and prices: look them up, don't guess
- Get the exact model IDs and prices from the local caches: `/opt/data/provider_models_cache.json` (IDs for each provider) and `/opt/data/models_dev_cache.json` (cost, context, release date). Walk the JSON for `id` plus `cost`.
- When the user names a model version, check whether a newer point release exists at the same price (for example 5 vs 5.1). If so, recommend the newer one and give the price/date evidence. Let the user choose with `clarify`.
- When you recommend a tier, don't make "premium" the same model as another tier with only more reasoning effort. Users can already raise effort on the fly with `/reasoning high`. Say plainly when you have no benchmark data.

## 2. Set model and reasoning on a profile
```bash
hermes [-p <profile>] config set model.default <provider-model-id> --force
hermes [-p <profile>] config set agent.reasoning_effort <none|low|medium|high> --force
```
- `agent.reasoning_effort` does get read: the CLI and gateway use it. The `not a recognized config key` warning is a validator false positive. Use `--force` to silence it.
- To switch tiers inside one chat (useful on Telegram, where only one profile serves the bot), add aliases on the profile that runs the gateway: `hermes config set model.aliases.<name> openrouter/<model-id>`. Users then send `/model <name>`.

## 3. Create tier profiles
```bash
hermes profile create <name> --clone-from default --description "<what it is for>"
hermes profile rename default <DisplayName>   # only sets the display name; the id stays 'default'
```
- `--clone` copies config, `.env`, SOUL.md and skills. It doesn't copy bot tokens or allowlists, so two profiles never fight over one bot.
- The post-create warning `This profile has no API keys yet` can appear even when `.env` was copied. Check `grep -oE '^[A-Z_]+' /opt/data/profiles/<name>/.env` before you believe it.
- Write SOUL.md BEFORE you clone if the persona should apply to every tier.

## 4. Verify for real, not from config
Run a one-shot query against each profile, then read the model and effort that were actually used from that profile's session store:
```bash
hermes -p <name> chat -Q -q "Respond only with your name."   # prints session_id
```
```python
sqlite3.connect('/opt/data/profiles/<name>/state.db').execute(
  "select model, model_config from sessions where id=?", (sid,)).fetchall()
# model_config.reasoning_config.effort shows the effort that was applied
```
The default profile's store is `/opt/data/state.db`.

## 5. Changing the main model affects cron
A cron job without a pin follows the main model. Before you downgrade the default (say, to a cheaper model), pin the jobs that need a stronger model:
`hermes cron edit <job_id> --model <id> --provider openrouter --reasoning-effort <level>`. Check that the pin landed in `/opt/data/cron/jobs.json`, because `cron list` doesn't show model pins.

## 5b. A cron job reported ok but nothing happened
- Read the run's own report: `/opt/data/cron/output/<job_id>/<timestamp>.md` (prompt + final response) and `/opt/data/cron/jobs.json` (`last_status`, `last_error`, `last_dispatch`). `last_status: ok` only means the agent finished, not that the side effect landed.
- Then check the real state in the target system (e.g. list the post/record by ID). A response saying "scheduled" can later flip to `failed` asynchronously, so compare the system's `status`/`lastError` and `updatedAt` against what the job claimed.
- Report to the user: what the job did, the real final state with the error string, why the job missed it (no terminal-state re-check), and what the owner of the target system should look at. Don't retry or republish external actions without the user's explicit confirmation.

## 6. Persona (SOUL.md)
- SOUL.md replaces the default identity line, so carry the user's style rules into the new persona (directness, length that fits the ask, honesty about what isn't verified). If you drop them, the tone silently drifts.
- Ground a project persona in the project's canonical docs and invariants (AGENTS.md hierarchy, whitepaper vision). Never let the persona promise capabilities the code doesn't have.
- `write_file` refuses to overwrite SOUL.md until you've `read_file`'d it in this session.
- When the user wants to choose a name, run quick availability probes first (see `references/messaging-access.md`). Give 2-3 options with the concept behind each, in one `clarify` call, along with any other independent decision (for example the model tier).

## 7b. Voice (TTS/STT)
See `references/voice-tts-local.md` for the local Piper setup, the Edge 403 symptom, and the read-only venv constraint.

## 7. Messaging access
See `references/messaging-access.md`. The short version: Telegram allowlists take numeric IDs, not @usernames. Onboard people through pairing, approve them after checking their usernames, then lock the allowlist to those numeric IDs. Bot tokens are credentials: the user enters them through the dashboard or `hermes gateway setup`, never in chat. The first time you run this flow, check each step against the live gateway and correct the reference wherever reality differs.
