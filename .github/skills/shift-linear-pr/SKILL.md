---
name: shift-linear-pr
description: "Trigger: Shift PR creation, Shift PR update, Linear-linked GitHub PR, PR template cleanup, review-ready PR. Create or update GitHub PRs for Shift using Linear as the internal source of truth and Linear's native GitHub integration for issue linking and closing."
license: Apache-2.0
metadata:
  author: GitHub Copilot
  version: "1.1"
---

## Activation Contract

Use this skill when a Shift implementation branch is ready for PR creation/update, a Linear issue branch needs a GitHub PR, or PR title/body linkage needs cleanup before review.

Do not use it to implement code, merge, deploy, bypass human review, manually close Linear issues handled by native GitHub integration, or treat GitHub Issues as internal planning truth.

## Preconditions

- Linear issue ID, GitHub branch, and PR intent are known.
- Read the target Linear issue, `AGENTS.md`, and Engram project context for `shift-desoc` before PR metadata changes.
- Required capability: GitHub CLI/app access in non-interactive mode. If unavailable, return blocked with evidence.

## Hard Rules

- Treat Linear as internal source of truth and GitHub community issues as separate public context.
- Do not use global `branch-pr` for Shift Linear issue PRs.
- Verify branch name has exactly one primary issue ID: `feat/SHI-XXX/short-description` or `imp/SHI-XXX/short-description`.
- Verify PR title and body preserve the same primary Linear issue ID.
- Use a Linear closing phrase only when the PR fully satisfies the issue; never manually close that Linear issue afterward.
- Do not merge, deploy, force-push, edit code, or advance Linear status unless the PR is review-ready.
- Idempotency: update an existing PR for the branch before creating a new one; reuse prior comments when possible.
- Codex non-interactive mode: do not rely on browser prompts; stop on missing auth, ambiguous linkage, or unavailable template.

## Decision Gates

| Situation | Action |
| --- | --- |
| Branch/PR map to one Linear issue | Proceed |
| No issue ID or multiple primary IDs | Stop; report mismatch |
| Partial/preparatory PR | Use non-closing phrase |
| Complete implementation | Use closing phrase |
| GitHub community issue should remain open | Reference without closing wording |
| Human explicitly wants GitHub issue closed | Use explicit GitHub closing wording only for that issue |

## Execution Steps

1. Read target Linear issue and repo guidance; recover Engram memories.
2. Inspect branch, diff summary, existing PR, and `.github/PULL_REQUEST_TEMPLATE.md`.
3. Verify one primary Linear issue ID across branch, title, and body.
4. Generate/update PR body with scope, files changed, tests, risks, contract/deploy impact, migration impact, and review notes.
5. Add dedicated `Linear issue` and `Closing phrase` sections using `Completes SHI-XXX` for complete work or `Related to SHI-XXX` for partial work.
6. Keep GitHub community issue references in a separate non-closing section unless explicitly requested.
7. Create/update the PR, then comment/update Linear with PR URL, branch, tests, and closing/non-closing phrase.
8. Move Linear to review only when the PR is ready for human review.

## PR Contract

- Branch name, PR title, and PR body use the same primary Linear issue ID.
- Prefer exactly one primary Linear closing or non-closing phrase per PR.
- If not review-ready, update metadata but do not advance Linear status.
- All external side effects must be listed in the result.

## Output Contract

Return a short human summary plus JSON matching `../_shared/shift-agent-skill-result.schema.json` with `schemaVersion: "shift-agent-skill-result.v1"`. `operationKey` and `sideEffects` are required; `sideEffects` must list `none`, `attempted`, or `applied` effects. Include PR URL/state, Linear issue, closing phrase, community issue refs, side effects, tests summarized, validation checks, and blockers.

## References

- `AGENTS.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/copilot-instructions.md`
- `.github/project-management/STATUS_REVIEW.md`
- `.github/project-management/IMPLEMENTATION_STATUS.md`
- `.github/skills/linear-implement-agent-ready/SKILL.md`
- `.github/skills/_shared/shift-agent-skill-result.schema.json`
