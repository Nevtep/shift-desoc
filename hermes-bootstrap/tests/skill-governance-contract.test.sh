#!/usr/bin/env bash
# Contract checks for how Hermes changes and syncs its own skills: edits go
# through an issue, a worktree and a PR; the live checkout stays clean; the
# post-merge sync never destroys uncommitted work; audit nits are tracked once.
# The skills are instructions for the autonomous agent, so these assert the
# guarantees in their text.
#
#   bash hermes-bootstrap/tests/skill-governance-contract.test.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SKILLS="$ROOT/hermes-bootstrap/skills"
GOVERNANCE="$SKILLS/shift-learning-governance/SKILL.md"
POST_MERGE="$SKILLS/shift-post-merge-learning/SKILL.md"
AUTONOMOUS="$SKILLS/shift-autonomous-development/SKILL.md"
RUNTIME_TOOLS="$SKILLS/shift-runtime-tools/SKILL.md"
failures=0
pass() { echo "ok   - $1"; }
fail() { echo "FAIL - $1" >&2; failures=$((failures + 1)); }
check() { local name="$1"; shift; if "$@"; then pass "$name"; else fail "$name"; fi; }
# Match against the file with line breaks folded into spaces, so a requirement
# may span lines in the markdown.
flat() { tr '\n' ' ' <"$1" | sed -e 's/\\ */ /g' -e 's/  */ /g'; }
has() { flat "$1" | grep -qiE -- "$2"; }
# section <file> <heading> : the markdown section from "## <heading>" up to the
# next "## " heading, folded like flat().
section() { awk -v h="## $2" 'index($0, h) == 1 {on = 1; print; next} on && /^## / {exit} on {print}' "$1" \
  | tr '\n' ' ' | sed -e 's/\\ */ /g' -e 's/  */ /g'; }
sec_has() { section "$1" "$2" | grep -qiE -- "$3"; }

# 1. Skill changes never happen in the live checkout and are tracked in Linear.
check "governance forbids editing the live checkout" has "$GOVERNANCE" 'never edit[^.]*/workspace/shift'
check "governance keeps the live checkout clean for the sync" has "$GOVERNANCE" 'checkout must stay clean'
check "every change is made in a worktree" has "$GOVERNANCE" 'worktree'
check "a Linear issue exists before the first edit" has "$GOVERNANCE" 'Linear issue[^.]*before the first edit'
check "operator directives given in chat are not an exception" has "$GOVERNANCE" 'operator[^.]*chat[^.]*(exception|same)'
check "an uncommitted change in the live checkout is saved as a patch" has "$GOVERNANCE" 'uncommitted[^.]*git diff[^.]*patch'

# 2. The post-merge sync never resets a dirty checkout.
check "post-merge checks the working tree before the reset" sec_has "$POST_MERGE" "1. Sync the runtime" 'git status --porcelain'
check "post-merge does not reset a dirty checkout" sec_has "$POST_MERGE" "1. Sync the runtime" 'do not (run )?(the )?(git )?reset'
check "post-merge saves the diff as a patch first" sec_has "$POST_MERGE" "1. Sync the runtime" '/opt/data/shift/dirty-checkout-'
check "post-merge reports that skills may be stale" sec_has "$POST_MERGE" "1. Sync the runtime" 'skills may be stale'

# 3. Audit nits are tracked once and never start remediation or a re-audit.
check "nit and advisory findings do not trigger remediation" has "$AUTONOMOUS" 'nit[^.]*advisory[^.]*(never|not)[^.]*(trigger|start)[^.]*remediation'
check "nits are collected in one Linear issue per audited PR" has "$AUTONOMOUS" '(one|single) Linear issue per audited PR'
check "nits never force a re-audit" has "$AUTONOMOUS" 'nit[^.]*(never|not)[^.]*re-audit'

# 4. The operator directives are versioned in the runtime tools skill.
check "runtime tools: web bundle refresh rule" has "$RUNTIME_TOOLS" 'Bundle is stale for'
check "runtime tools: pre-mainnet policy" has "$RUNTIME_TOOLS" 'Pre-mainnet policy'
check "runtime tools: open PRs on the same files block an issue" has "$RUNTIME_TOOLS" 'open PR touching the same files'
check "runtime tools: contract changes and their consumers" has "$RUNTIME_TOOLS" 'Contract changes and their consumers'
check "runtime tools: a Feature keeps its consumers in the same issue and PR" has "$RUNTIME_TOOLS" 'Feature.{0,90}consumers are part of the same issue and PR'
check "runtime tools: no consumer is left neither implemented nor tracked" has "$RUNTIME_TOOLS" 'neither implemented nor tracked'

[[ $failures -eq 0 ]] && echo "all passed" || { echo "$failures failed" >&2; exit 1; }
