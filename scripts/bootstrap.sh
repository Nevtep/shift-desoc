#!/usr/bin/env bash
set -euo pipefail

export HERMES_HOME="${HERMES_HOME:-/opt/data}"
# The image's main-wrapper exports HOME=/opt/data before running this script.
export HOME="${HOME:-$HERMES_HOME}"
REPO_DIR="${SHIFT_REPO_DIR:-/workspace/shift}"
REPO_URL="${SHIFT_REPO_URL:?SHIFT_REPO_URL is required}"
BOOTSTRAP=/opt/shift-hermes/bootstrap

mkdir -p "$HERMES_HOME" "$HOME" "$HERMES_HOME/skills" /workspace
chmod 700 "$HERMES_HOME" "$HOME" || true

# Seed configuration once. The image's stage2 hook has already written a
# default config.yaml by now, so a marker (not file existence) decides whether
# the Shift baseline still has to be merged in. Afterwards Hermes and the
# operator own the file.
SEED_MARKER="$HERMES_HOME/.shift-config-seeded"
touch "$HERMES_HOME/config.yaml"
if [[ ! -f "$HERMES_HOME/SOUL.md" ]]; then
  cp "$BOOTSTRAP/SOUL.md" "$HERMES_HOME/SOUL.md"
fi

# Re-assert repo-managed keys (skills dirs, MCP servers, cron limits) on every
# bootstrap so reviewed changes reach existing volumes, and stamp the config
# version so Hermes does not treat the seeded file as an unmigratable legacy
# config.
seed_layer=""
[[ -f "$SEED_MARKER" ]] || seed_layer="$BOOTSTRAP/config.yaml"
/opt/hermes/.venv/bin/python - "$HERMES_HOME/config.yaml" "$BOOTSTRAP/managed-keys.yaml" "$seed_layer" <<'PY'
import sys, yaml
from hermes_cli.config import DEFAULT_CONFIG

config_path, managed_path, seed_path = sys.argv[1], sys.argv[2], sys.argv[3]
with open(config_path) as fh:
    config = yaml.safe_load(fh) or {}
layers = [seed_path] if seed_path else []
layers.append(managed_path)

def merge(dst, src):
    for key, value in src.items():
        if isinstance(value, dict) and isinstance(dst.get(key), dict):
            merge(dst[key], value)
        else:
            dst[key] = value

for layer in layers:
    with open(layer) as fh:
        merge(config, yaml.safe_load(fh) or {})
config.setdefault("_config_version", DEFAULT_CONFIG.get("_config_version"))
with open(config_path, "w") as fh:
    yaml.safe_dump(config, fh, sort_keys=False)
PY
touch "$SEED_MARKER"

# Hermes profiles (created with `hermes profile create`, e.g. for other models)
# copy config.yaml at creation time and are never updated by Hermes afterwards.
# Re-assert the repo-managed keys in each of them too, otherwise a cron job that
# runs under a profile gets terminal.home_mode=profile (HOME under the profile
# dir, so gh/git/Claude Code look unauthenticated) and loses the skill dirs and
# MCP servers.
for profile_cfg in "$HERMES_HOME"/profiles/*/config.yaml; do
  [[ -f "$profile_cfg" ]] || continue
  /opt/hermes/.venv/bin/python - "$profile_cfg" "$BOOTSTRAP/managed-keys.yaml" <<'PY'
import sys, yaml
from hermes_cli.config import DEFAULT_CONFIG

config_path, managed_path = sys.argv[1], sys.argv[2]
with open(config_path) as fh:
    config = yaml.safe_load(fh) or {}
with open(managed_path) as fh:
    managed = yaml.safe_load(fh) or {}

def merge(dst, src):
    for key, value in src.items():
        if isinstance(value, dict) and isinstance(dst.get(key), dict):
            merge(dst[key], value)
        else:
            dst[key] = value

merge(config, managed)
config.setdefault("_config_version", DEFAULT_CONFIG.get("_config_version"))
with open(config_path, "w") as fh:
    yaml.safe_dump(config, fh, sort_keys=False)
print(f"managed keys applied to {config_path}")
PY
done

# Secrets are supplied through Compose and copied into Hermes' persistent env.
touch "$HERMES_HOME/.env"
chmod 600 "$HERMES_HOME/.env"
write_secret() {
  local key="$1" value="${2:-}"
  [[ -z "$value" ]] && return 0
  grep -v "^${key}=" "$HERMES_HOME/.env" > "$HERMES_HOME/.env.next" || true
  printf '%s=%s\n' "$key" "$value" >> "$HERMES_HOME/.env.next"
  mv "$HERMES_HOME/.env.next" "$HERMES_HOME/.env"
}
write_secret GITHUB_TOKEN "${GITHUB_TOKEN:-}"
write_secret GH_TOKEN "${GITHUB_TOKEN:-}"
write_secret OPENROUTER_API_KEY "${OPENROUTER_API_KEY:-}"
write_secret OPENAI_API_KEY "${OPENAI_API_KEY:-}"
write_secret LINEAR_API_KEY "${LINEAR_API_KEY:-}"
write_secret ANTHROPIC_API_KEY "${ANTHROPIC_API_KEY:-}"
write_secret CLAUDE_CODE_OAUTH_TOKEN "${CLAUDE_CODE_OAUTH_TOKEN:-}"
write_secret ESCARLET_MCP_URL "${ESCARLET_MCP_URL:-}"
write_secret ESCARLET_MCP_TOKEN "${ESCARLET_MCP_TOKEN:-}"
write_secret TELEGRAM_BOT_TOKEN "${TELEGRAM_BOT_TOKEN:-}"
write_secret TELEGRAM_ALLOWED_USERS "${TELEGRAM_ALLOWED_USERS:-}"
write_secret TELEGRAM_HOME_CHANNEL "${TELEGRAM_HOME_CHANNEL:-}"

# One-time migration: terminal sessions used to run with HOME=/opt/data/home
# (terminal.home_mode: profile), so Engram memories the agent saved there are
# merged into the main store at /opt/data/.engram; the old store is kept
# renamed as a backup.
if [[ -d "$HERMES_HOME/home/.engram" && ! -e "$HERMES_HOME/.shift-engram-home-migrated" ]]; then
  export_file="$(mktemp "$HERMES_HOME/engram-home-export.XXXXXX.json")"
  HOME="$HERMES_HOME/home" engram export "$export_file"
  HOME="$HERMES_HOME" engram import "$export_file"
  mv "$HERMES_HOME/home/.engram" "$HERMES_HOME/home/.engram.migrated-$(date -u +%Y%m%d)"
  rm -f "$export_file"
  touch "$HERMES_HOME/.shift-engram-home-migrated"
fi

# Belt and braces for any code path that still runs tools with
# HOME=$HERMES_HOME/home (Hermes `auto` home mode in containers): expose the
# tool configs that live in the real HOME there too. Idempotent; an existing
# non-empty directory is moved aside, never merged.
PROFILE_HOME="$HERMES_HOME/home"
mkdir -p "$PROFILE_HOME"
link_into_profile_home() {
  local name="$1" src="$HERMES_HOME/$1" dst="$PROFILE_HOME/$1"
  [[ -e "$src" ]] || return 0
  if [[ -L "$dst" ]]; then ln -sfn "$src" "$dst"; return 0; fi
  if [[ -e "$dst" ]]; then
    if [[ -d "$dst" && -z "$(ls -A "$dst")" ]]; then rmdir "$dst"
    else mv "$dst" "$dst.pre-link-$(date -u +%Y%m%d%H%M%S)"; fi
  fi
  ln -sfn "$src" "$dst"
}
for name in .gitconfig .config .claude .claude.json .engram .gentle-ai; do
  link_into_profile_home "$name"
done

# Clone once into the persistent workspace volume.
if [[ ! -d "$REPO_DIR/.git" ]]; then
  git clone "$REPO_URL" "$REPO_DIR"
fi

cd "$REPO_DIR"
# Commit identity = the GitHub account behind GITHUB_TOKEN (a dedicated machine
# user), using its noreply address so commits are attributed to that account.
# This keeps the agent's PRs authored by the bot, so a human can be the
# required reviewer, and satisfies the "no unattributed changes" branch rule.
if [[ -n "${GH_TOKEN:-}" ]] && bot_json="$(env -u GH_TOKEN -u GITHUB_TOKEN GH_TOKEN="$GH_TOKEN" gh api user 2>/dev/null)"; then
  bot_login="$(jq -r .login <<<"$bot_json")"
  bot_id="$(jq -r .id <<<"$bot_json")"
  git config --global user.name "$bot_login"
  git config --global user.email "${bot_id}+${bot_login}@users.noreply.github.com"
  echo "git identity: $bot_login <${bot_id}+${bot_login}@users.noreply.github.com>"
else
  git config --global user.name "Shift Hermes Agent"
  git config --global user.email "shift-hermes-agent@users.noreply.github.com"
fi
git config --global --add safe.directory "$REPO_DIR"
# Let git push over HTTPS with GH_TOKEN (only the publication stage pushes).
# Hermes hard-blocks GH_TOKEN/GITHUB_TOKEN from the agent's terminal (they
# double as model-provider credentials), so the login is persisted to
# ~/.config/gh/hosts.yml instead; re-done every boot so token rotation applies.
if [[ -n "${GH_TOKEN:-}" ]]; then
  # Written directly instead of `gh auth login --with-token`: that command
  # insists on the read:org scope for classic tokens, which the agent does not
  # need (fine-grained tokens skip the check, classic ones do not).
  gh_login="${bot_login:-$(env -u GH_TOKEN -u GITHUB_TOKEN GH_TOKEN="$GH_TOKEN" gh api user --jq .login)}"
  mkdir -p "$HOME/.config/gh"
  umask 077
  cat > "$HOME/.config/gh/hosts.yml" <<YAML
github.com:
    users:
        ${gh_login}:
            oauth_token: ${GH_TOKEN}
    git_protocol: https
    oauth_token: ${GH_TOKEN}
    user: ${gh_login}
YAML
  chmod 600 "$HOME/.config/gh/hosts.yml"
  env -u GH_TOKEN -u GITHUB_TOKEN gh auth setup-git
  env -u GH_TOKEN -u GITHUB_TOKEN gh auth status --hostname github.com >/dev/null
else
  echo "WARNING: GITHUB_TOKEN not set; GitHub reads/pushes will fail." >&2
fi

git fetch origin --prune
git switch main
if [[ -n "$(git status --porcelain)" ]]; then
  # The main checkout must stay pristine (work happens in .worktrees/), but a
  # stray edit must not brick every future boot either. Preserve it in a
  # stash for human review, then continue.
  stash_msg="hermes-bootstrap-autosave-$(date -u +%Y%m%dT%H%M%SZ)"
  echo "WARNING: persistent main checkout is dirty; preserving it as stash '$stash_msg':" >&2
  git status --short >&2
  git stash push --include-untracked -m "$stash_msg"
fi
git reset --hard origin/main
if [[ -f .engram/manifest.json ]]; then
  echo "Importing Git-synced Engram memories..."
  engram sync --import
fi
mkdir -p .worktrees

grep -qxF '.worktrees/' .gitignore || {
  echo "ERROR: repository must version .worktrees/ in .gitignore." >&2
  exit 1
}

pnpm config set store-dir "$HERMES_HOME/pnpm-store"
pnpm install --frozen-lockfile
gentle-ai skill-registry refresh --cwd "$REPO_DIR" --quiet

# Claude Code is the coding agent. Its config (~/.claude, ~/.claude.json)
# lives in the persistent HOME (/opt/data).
# Gentle AI (v4+): ODD orchestrator prompt, RDD native-review agents, skills
# and Engram wiring for Claude Code. Re-applied whenever the pinned gentle-ai
# version changes; install is idempotent and converges with sync. The image
# sets GENTLE_AI_ENGRAM_BIN so gentle-ai reuses the pinned engram binary
# instead of `go install`-ing another one into the data volume.
gentle_version="$(gentle-ai --version | awk '{print $NF}')"
gentle_marker="$HERMES_HOME/.shift-gentle-claude-code"
if [[ "$(cat "$gentle_marker" 2>/dev/null)" != "$gentle_version" ]]; then
  gentle-ai install --agents claude-code --components engram,permissions,skills --scope global </dev/null
  printf '%s\n' "$gentle_version" > "$gentle_marker"
fi
# gentle-ai enables the Engram plugin in ~/.claude/settings.json; install it
# explicitly so headless `claude -p` sessions have it. (`engram setup
# claude-code` is not used: it waits on stdin in a non-interactive container.)
installed_plugins="$(claude plugin list </dev/null 2>/dev/null || true)"
if ! grep -q 'engram@engram' <<<"$installed_plugins"; then
  claude plugin marketplace add Gentleman-Programming/engram </dev/null || true
  claude plugin install engram@engram </dev/null
fi

# Linear MCP for Claude Code children (user scope, refreshed every boot so a
# rotated key takes effect).
if [[ -n "${LINEAR_API_KEY:-}" ]]; then
  claude mcp remove --scope user linear >/dev/null 2>&1 || true
  claude mcp add --scope user --transport http linear https://mcp.linear.app/mcp \
    --header "Authorization: Bearer ${LINEAR_API_KEY}"
fi

# Cron monitor scripts (fail-fast preflight, merge watcher) live under
# $HERMES_HOME/scripts as Hermes requires; refreshed on every boot.
mkdir -p "$HERMES_HOME/scripts" "$HERMES_HOME/shift" "$HERMES_HOME/cache/shift"
install -m 0755 "$BOOTSTRAP"/scripts/shift-*.sh "$HERMES_HOME/scripts/"

# Initialize Hermes Kanban for durable task/handoff history.
hermes kanban init || true

echo "Verifying Hermes workflow skills from repo-managed source..."
# `hermes skills inspect` queries remote registries (and exits 0 on a miss),
# so check the locally loaded skill set instead. COLUMNS avoids truncation.
# Development skills come from the main checkout, content skills from the
# image; verify exactly what those trees contain, and only warn about skills
# the runtime expects but main does not have yet (e.g. before a skills PR
# merges) so a deploy never fails on a skill that lives on another branch.
loaded="$(COLUMNS=250 hermes skills list --source local --enabled-only 2>/dev/null)"
for dir in "$REPO_DIR"/hermes-bootstrap/skills/*/ "$BOOTSTRAP"/content-skills/*/; do
  [[ -f "$dir/SKILL.md" ]] || continue
  skill="$(basename "$dir")"
  grep -qw -- "$skill" <<<"$loaded" || { echo "ERROR: Hermes skill present but not loaded: $skill" >&2; exit 1; }
  echo "  ok $skill"
done
for skill in shift-autonomous-development shift-runtime-tools shift-learning-governance shift-post-merge-learning; do
  grep -qw -- "$skill" <<<"$loaded" || echo "WARNING: skill $skill is not in main yet; cron jobs that need it work once it merges." >&2
done

echo
echo "Bootstrap complete."
echo "Next: verify with /opt/shift-hermes/scripts/doctor.sh"
echo "Then run: /opt/shift-hermes/scripts/install-loop.sh"
