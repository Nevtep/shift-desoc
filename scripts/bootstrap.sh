#!/usr/bin/env bash
set -euo pipefail

export HERMES_HOME="${HERMES_HOME:-/opt/data}"
export HOME="${HOME:-$HERMES_HOME/home}"
REPO_DIR="${SHIFT_REPO_DIR:-/workspace/shift}"
REPO_URL="${SHIFT_REPO_URL:?SHIFT_REPO_URL is required}"
BOOTSTRAP=/opt/shift-hermes/bootstrap

mkdir -p "$HERMES_HOME" "$HOME" "$HERMES_HOME/skills" /workspace
chmod 700 "$HERMES_HOME" "$HOME" || true

# Seed configuration once. Preserve Hermes learning and user changes thereafter.
if [[ ! -f "$HERMES_HOME/config.yaml" ]]; then
  cp "$BOOTSTRAP/config.yaml" "$HERMES_HOME/config.yaml"
fi
if [[ ! -f "$HERMES_HOME/SOUL.md" ]]; then
  cp "$BOOTSTRAP/SOUL.md" "$HERMES_HOME/SOUL.md"
fi

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

# Clone once into the persistent workspace volume.
if [[ ! -d "$REPO_DIR/.git" ]]; then
  git clone "$REPO_URL" "$REPO_DIR"
fi

cd "$REPO_DIR"
git config --global user.name "Shift Hermes Agent"
git config --global user.email "shift-hermes-agent@users.noreply.github.com"
git config --global --add safe.directory "$REPO_DIR"

git fetch origin --prune
git switch main
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: persistent main checkout is dirty; refusing bootstrap." >&2
  exit 1
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

# Engram and Codex use the profile HOME persisted in /opt/data/home.
engram setup codex || true

# Initialize Hermes Kanban for durable task/handoff history.
hermes kanban init || true

echo "Verifying Hermes workflow skills from repo-managed source..."

for skill in \
  shift-autonomous-development \
  shift-runtime-tools \
  shift-learning-governance \
  shift-pr-review-convergence
do
  hermes skills inspect "$skill" >/dev/null
done

hermes skills list | grep -E \
  'shift-autonomous-development|shift-runtime-tools|shift-learning-governance|shift-pr-review-convergence'
  
echo
echo "Bootstrap complete."
echo "Next: authenticate Hermes model provider and Linear MCP if not already done."
echo "Then run: /opt/shift-hermes/scripts/install-loop.sh"
