---
name: shift-linear-pr
description: "Trigger: Shift PR creation, Shift PR update, Linear-linked GitHub PR, PR template cleanup, review-ready PR. Create or update GitHub PRs for Shift using Linear as the internal source of truth and Linear's native GitHub integration for issue linking and closing."
license: Apache-2.0
metadata:
  author: GitHub Copilot
  version: "1.0"
---

## Activation Contract

Use this skill when a Shift implementation branch is ready for PR creation or update, a repo-local agent needs to open a PR from a Linear issue branch, a human wants to standardize PR title and body linkage, or a PR needs Linear linkage cleanup before review.

Do not use this skill to implement code, merge PRs, deploy, bypass human review, close Linear issues manually when the native GitHub integration can handle it, or treat GitHub Issues as the internal source of truth.

## Hard Rules

- Read the target Linear issue before touching PR metadata.
- Read `AGENTS.md` and follow the repo truth hierarchy.
- Recover Engram context for project `shift-desoc` before deciding suitability.
- Treat Linear as the internal source of truth for planning and implementation.
- Do not use the global `branch-pr` skill for Shift Linear issues.
- Verify the branch name contains exactly one primary Linear issue ID using `feat/SHI-XXX/short-description` or `imp/SHI-XXX/short-description`.
- Verify the PR title includes the same Linear issue ID.
- Use a Linear-supported closing phrase such as `Completes SHI-XXX`, `Fixes SHI-XXX`, `Resolves SHI-XXX`, or `Closes SHI-XXX` only when the PR fully satisfies the issue.
- Use a non-closing phrase such as `Related to SHI-XXX` or `Refs SHI-XXX` when the PR is partial or preparatory.
- Never use GitHub closing words for community GitHub issues unless the user explicitly wants the GitHub issue closed.
- Do not merge, deploy, or bypass human review.
- Do not manually close the Linear issue if the PR already uses the correct Linear closing phrase.

## Decision Gates

| Situation | Action |
| --- | --- |
| Branch and PR clearly map to one Linear issue | Proceed |
| Branch contains no Linear issue ID or more than one primary issue ID | Stop and report the exact mismatch |
| PR is partial or preparatory | Use a non-closing Linear phrase |
| PR fully satisfies the Linear issue | Use a closing Linear phrase |
| GitHub community issues are relevant but should remain open | Reference them without closing wording |
| Human wants a GitHub community issue closed too | Use explicit GitHub closing wording only for that issue |

## Procedure

1. Read the target Linear issue.
2. Read `AGENTS.md`.
3. Recover relevant Engram context for `shift-desoc`.
4. Inspect the current branch.
5. Verify the branch name includes exactly one Linear issue ID using `feat/SHI-XXX/short-description` or `imp/SHI-XXX/short-description`.
6. Verify the PR title includes the same issue ID.
7. Generate or update the PR body using `.github/PULL_REQUEST_TEMPLATE.md`.
8. Add a dedicated Linear section using `Completes SHI-XXX` when the PR fully satisfies the issue, or `Related to SHI-XXX` when the PR is partial or preparatory.
9. Add a separate GitHub community issue section using `Related GitHub issues: #123` only when applicable.
10. Include scope, files changed, tests run, risks, contract/deploy impact, migration impact, and review notes.
11. Open or update the GitHub PR.
12. Update the Linear issue comment with PR URL, branch name, tests run, and whether the PR uses a closing or non-closing Linear phrase.
13. Move the Linear issue to review only if the PR is ready for human review.

## PR Contract

- The branch name, PR title, and PR body must all preserve the same primary Linear issue ID.
- The PR body must have a dedicated `Linear issue` section and a dedicated `Closing phrase` section.
- The PR body must keep GitHub community issues in a separate section from Linear linkage.
- Prefer exactly one primary Linear closing or non-closing phrase per PR.
- If the PR is not ready for review, update the PR metadata but do not advance the Linear issue to review.

## Output Contract

Return:
- PR created or updated
- Linear issue linked
- closing phrase used
- GitHub community issues referenced, if any
- tests summarized
- remaining review or deploy blockers

## References

- `AGENTS.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/copilot-instructions.md`
- `.github/project-management/STATUS_REVIEW.md`
- `.github/project-management/IMPLEMENTATION_STATUS.md`
- `.github/skills/linear-implement-agent-ready/SKILL.md`