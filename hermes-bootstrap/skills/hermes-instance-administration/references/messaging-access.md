# Messaging access (Telegram first)

Status: steps 1 and 2 have been done. Steps 3–5 are taken from `authz_mixin.py`, the `hermes pairing` CLI help and the Telegram docs page, and haven't been run end to end. On the first real run, confirm the output of `hermes pairing list` (does it show the username?) and the exact syntax of `approve`, then correct this file.

## Steps
1. **Name the bot.** Check whether the username is free with `GET https://t.me/<Username>` (send a browser User-Agent). If the page contains `tgme_page_title`, the name is taken. If it doesn't, the name is probably free; Telegram only confirms it when BotFather creates the bot. Short generic `<Word>Bot` names are usually taken, while `<Project><Word>Bot` names usually aren't.
2. **Create the bot (the user does this).** In @BotFather: `/newbot`, then a display name, then a username ending in `bot`. Also offer a ready-made `/setdescription` text that matches the persona.
3. **Load the token without it touching chat.** Use the dashboard (port 9119) → Messaging → Telegram, or have the user run `hermes gateway setup` in their terminal. Either one writes `TELEGRAM_BOT_TOKEN` to `.env` and restarts the gateway. The dashboard's "Create with QR" flow also detects the scanner's numeric ID.
4. **Authorize people.** `TELEGRAM_ALLOWED_USERS` matches numeric user IDs only. The gateway resolves usernames only for Discord. To authorize people you only know by @handle:
   - Leave the allowlist empty at first. With no allowlist and no `unauthorized_dm_behavior` override, unknown DMs get a pairing code. As soon as ANY allowlist is set, the default changes to "ignore".
   - Each person DMs the bot. Run `hermes pairing list`, check the usernames against the expected handles, then `hermes pairing approve telegram <code>`.
   - Write the approved numeric IDs to `TELEGRAM_ALLOWED_USERS` (comma-separated) so the bot stays closed to everyone else.
   - **Adding a person after the allowlist exists:** pairing will NOT work (unknown DMs are ignored silently, so the person sees no reply and no code is ever created; `hermes pairing list` stays empty). Get the numeric ID from the gateway log instead: `grep "Blocked unauthorized user" /opt/data/logs/agent.log` after they write to the bot, confirm with the person it is theirs, append it to `TELEGRAM_ALLOWED_USERS` in the operator's local `.env.hermes`, then `infra/aws/hermes/put-secrets.sh` and `update.sh` (minutes of downtime). The alternative, `unauthorized_dm_behavior: pair`, opens the bot to every stranger.
   - Authorization is binary and per platform: everyone allowed gets the same toolset (`platform_toolsets` is per platform, not per user). A restricted public tier needs a separate bot token and profile, not a flag on the same bot.
   - Approved pairings live in `<HERMES_HOME>/platforms/pairing/telegram-approved.json`, on the data volume, so they survive restarts and image updates; the env allowlist is re-injected from `.env.hermes` on each update.
5. **Optional.** Use `/sethome` in the chat where cron results should arrive. Delivery only happens if the job's `deliver` targets telegram.

## Where the code lives (when you need to check behavior)
- Authorization: `/opt/hermes/gateway/authz_mixin.py` (`_principal_matches_allowlist`, `_get_unauthorized_dm_behavior`)
- Dashboard onboarding API: `/opt/hermes/hermes_cli/web_routers/messaging.py` (`/api/messaging/telegram/onboarding/*`)
- Docs: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/telegram
