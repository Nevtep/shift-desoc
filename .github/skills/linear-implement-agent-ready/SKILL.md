---
name: linear-implement-agent-ready
description: "Trigger: Linear issue, workflow:agent-ready, implementation, tests, cleanup. Implement one Shift Linear issue that is ready to execute without gentle SDD spec work."
license: Apache-2.0
metadata:
  author: GitHub Copilot
  version: "1.1"
---

## Activation Contract

Use this skill when one Shift Linear issue is labeled `workflow:agent-ready`, unblocked, spec-free, concrete, and ready for implementation.

Do not use it for umbrellas, `workflow:needs-spec`, blocked issues, broad work, or unresolved smart-contract architecture decisions.

## Preconditions

- Required capability: Linear, git, GitHub, package/test tooling, and Engram. If unavailable, return blocked with evidence.
- Read target issue, `AGENTS.md`, and Engram project context for `shift-desoc` before code or git changes.
- Worktree must be clean except intentional user/other-agent edits; never revert or overwrite others.

## Hard Rules

- Inspect and edit only files tied to issue evidence and acceptance criteria.
- Do not create specs, merge PRs, deploy, edit unrelated Linear issues, or change smart-contract architecture unless the issue requires it.
- Branch policy: use/reuse `feat/SHI-XXX/short-description` for features or `imp/SHI-XXX/short-description` for improvements; stop if current branch/worktree ownership is ambiguous.
- Validation policy: add/update required tests, run the narrowest relevant command, and widen only when evidence requires it.
- PR policy: use `.github/skills/shift-linear-pr/SKILL.md`; include exactly one supported Linear closing phrase for a complete implementation.
- Idempotency: reuse existing branch/PR/comments when they match the issue; do not duplicate side effects.
- Codex non-interactive mode: avoid prompts/browser waits; if auth, permissions, installs, or conflicts block progress, return blocked with evidence.

## Decision Gates

| Situation | Action |
| --- | --- |
| Agent-ready, unblocked, concrete, spec-free | Implement |
| Umbrella, blocked, broad, or missing acceptance criteria | Stop; report failed gate |
| Needs spec | Stop; recommend `linear-sdd-from-issue` |
| Needs splitting | Stop; recommend `linear-issue-refiner` |
| Dirty/ambiguous worktree | Stop or isolate only with explicit permission |

## Execution Steps

1. Read issue labels, status, parent, dependencies, acceptance criteria, and validation notes.
2. Read repo guidance and recover relevant Engram memories.
3. Verify suitability; stop on any failed gate.
4. Check branch and working tree; protect others' edits.
5. Create/reuse the issue branch and move Linear to the existing implementation status.
6. Read issue-relevant paths, implement narrowly, and update tests.
7. Run focused validation; fix in scope or stop with blocker evidence.
8. Commit, push, and create/update the PR via `shift-linear-pr` only when user policy allows those side effects.
9. Update the same Linear issue with branch, PR, files changed, tests, result, and blockers; move to review only when ready.

## PR Linking Contract

- Branch, PR title, and PR body preserve the same primary Linear issue ID.
- Closing phrases include `Closes SHI-XXX`, `Fixes SHI-XXX`, `Resolves SHI-XXX`, or `Completes SHI-XXX`.
- Partial/preparatory work uses non-closing phrases like `Related to SHI-XXX`, `Refs SHI-XXX`, or `Part of SHI-XXX`.
- Keep GitHub community issues separate and non-closing unless explicitly requested.

## Output Contract

Return a short human summary plus JSON matching `../_shared/shift-agent-skill-result.schema.json` with `schemaVersion: "shift-agent-skill-result.v1"`. `operationKey` and `sideEffects` are required; `sideEffects` must list `none`, `attempted`, or `applied` effects. Include issue, branch/PR, files changed, commits if allowed, side effects, tests run, validation evidence, Linear update, and blockers.

## References

- `AGENTS.md`
- `.github/copilot-instructions.md`
- `.github/project-management/STATUS_REVIEW.md`
- `.github/project-management/IMPLEMENTATION_STATUS.md`
- `.github/skills/shift-linear-pr/SKILL.md`
- `.github/skills/linear-issue-refiner/SKILL.md`
- `.github/skills/linear-sdd-from-issue/SKILL.md`
- `.github/skills/_shared/shift-agent-skill-result.schema.json`
