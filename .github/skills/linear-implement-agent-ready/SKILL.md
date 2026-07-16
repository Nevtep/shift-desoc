---
name: linear-implement-agent-ready
description: "Trigger: Linear issue, workflow:agent-ready, implementation, tests, cleanup. Implement one Shift Linear issue that is ready to execute without gentle SDD spec work."
license: Apache-2.0
metadata:
  author: GitHub Copilot
  version: "1.0"
---

## Activation Contract

Use this skill when one Shift Linear issue is already labeled `workflow:agent-ready`, is not blocked, does not require a gentle SDD spec, and the next step is implementation rather than planning.

Do not use this skill for phase umbrellas, `workflow:needs-spec` issues, blocked issues, issues that are still too broad, or issues that require unresolved smart-contract architecture decisions.

## Hard Rules

- Read the target Linear issue before touching code, git state, or Linear status.
- Read `AGENTS.md` and follow the repo truth hierarchy.
- Recover Engram context for project `shift-desoc` before deciding suitability.
- Confirm the issue is concrete, unblocked, and explicitly ready for implementation.
- Inspect only files tied to the issue evidence and affected paths.
- Keep the implementation scoped to one issue and do not create specs.
- Do not modify unrelated files, do not merge the PR, and do not deploy.
- When opening the PR, include the Linear issue ID with a supported closing phrase in the PR title or description so Linear moves the issue on merge.
- Use `.github/skills/shift-linear-pr/SKILL.md` for PR creation or PR metadata updates instead of the global `branch-pr` skill.
- Preserve Shift architecture invariants; do not change smart-contract architecture unless the issue explicitly requires it.
- Use the narrowest validation for the affected surface: Foundry for contracts, focused web checks for web, focused indexer checks for indexer.

## Decision Gates

| Situation | Action |
| --- | --- |
| Issue is `workflow:agent-ready`, unblocked, concrete, and spec-free | Proceed with implementation |
| Issue is an umbrella, blocked, too broad, or missing acceptance criteria | Stop and report the exact reason |
| Issue is `workflow:needs-spec` or says spec is required | Stop and recommend `linear-sdd-from-issue` |
| Issue needs further splitting before a safe PR exists | Stop and recommend `linear-issue-refiner` |

## Execution Steps

1. Read the target Linear issue, labels, status, parent, dependencies, acceptance criteria, and validation notes.
2. Read `AGENTS.md`.
3. Recover relevant Engram context for `shift-desoc`.
4. Verify suitability: `workflow:agent-ready`, not blocked, concrete acceptance criteria, no gentle SDD spec required.
5. If unsuitable, stop and report the exact gate that failed.
6. Check the current git branch and working tree.
7. If not already on an issue branch, create one using `feat/SHI-XXX/short-description` for feature issues or `imp/SHI-XXX/short-description` for improvement issues.
8. Move the Linear issue to the existing active implementation status; do not invent a new status.
9. Read only the issue-relevant repo paths referenced by the issue evidence.
10. Implement the issue without widening scope.
11. Add or update the tests required by the issue.
12. Run the relevant validation commands for the touched surface.
13. If validation fails, fix within scope or stop and report the blocker clearly.
14. Commit the finished changes with a message that references the Linear issue.
15. Push the branch.
16. Create or update the PR through `.github/skills/shift-linear-pr/SKILL.md`.
17. Update the same Linear issue with branch name, PR link, files changed, tests run, result, and known blockers if any.
18. Move the Linear issue to the existing review or PR-ready status.

## PR Linking Contract

- Use the Linear issue ID in the branch name, for example `feat/SHI-61/baseline-pr-validation`.
- Put one supported closing phrase in the PR title or description for the primary issue.
- Supported closing phrases include `close*`, `fix*`, `resolve*`, and `complete*` forms, such as `Closes SHI-61`, `Fixes SHI-61`, `Resolves SHI-61`, or `Completes SHI-61`.
- If the PR should link without closing on merge, use a non-closing phrase such as `ref SHI-61`, `related to SHI-61`, or `part of SHI-61` instead.
- Prefer exactly one closing phrase for the primary issue in implementation PRs created by this skill.
- Keep GitHub community issue references separate and non-closing unless the user explicitly wants a GitHub issue closed.

## Output Contract

Return:
- target issue
- branch created or reused
- files changed
- tests run
- PR created
- Linear status update
- remaining blockers, if any

## References

- `AGENTS.md`
- `.github/copilot-instructions.md`
- `.github/project-management/STATUS_REVIEW.md`
- `.github/project-management/IMPLEMENTATION_STATUS.md`
- `.github/skills/shift-linear-pr/SKILL.md`
- `.github/skills/linear-issue-refiner/SKILL.md`
- `.github/skills/linear-sdd-from-issue/SKILL.md`