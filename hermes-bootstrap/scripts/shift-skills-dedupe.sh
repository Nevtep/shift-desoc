#!/usr/bin/env bash
# Retire server-local copies of skills that the repo now ships.
#
# Hermes (or an operator) may have created a skill under $HERMES_HOME/skills
# before it was versioned in hermes-bootstrap. Once the repo ships a skill with
# the same name (content-skills in the image, skills in the checkout), the
# local copy is a duplicate and may shadow the reviewed version. Move it aside
# (never delete) to $HERMES_HOME/skills-superseded/<timestamp>/ so it can be
# restored by hand. Idempotent; warns instead of failing so boot is never blocked.
#
#   shift-skills-dedupe.sh <repo-skills-dir>...
set -uo pipefail
HERMES_HOME="${HERMES_HOME:-/opt/data}"
LOCAL="${SHIFT_LOCAL_SKILLS_DIR:-$HERMES_HOME/skills}"
STAMP="$(date +%Y%m%d-%H%M%S)"
ASIDE="${SHIFT_SKILLS_ASIDE_DIR:-$HERMES_HOME/skills-superseded}/$STAMP"

[[ -d "$LOCAL" ]] || exit 0
for root in "$@"; do
  [[ -d "$root" ]] || continue
  for dir in "$root"/*/; do
    [[ -f "$dir/SKILL.md" ]] || continue
    name="$(basename "$dir")"
    # Local copies sit at any depth (category/name); skip hidden dirs (.hub).
    while IFS= read -r dup; do
      [[ -n "$dup" ]] || continue
      mkdir -p "$ASIDE" || { echo "WARNING: skills dedupe: cannot create $ASIDE" >&2; exit 0; }
      rel="${dup#"$LOCAL"/}"
      mkdir -p "$ASIDE/$(dirname "$rel")"
      mv "$dup" "$ASIDE/$rel" && echo "skills dedupe: moved local $rel aside (repo ships $name)"
    done < <(find "$LOCAL" -mindepth 1 -maxdepth 3 -type d -name "$name" -not -path "*/.*" -exec test -f '{}/SKILL.md' ';' -print)
  done
done
exit 0
