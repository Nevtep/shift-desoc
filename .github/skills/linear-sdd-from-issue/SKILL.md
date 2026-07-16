---
name: linear-sdd-from-issue
description: "Trigger: Linear issue, workflow:needs-spec, gentle SDD spec required, concrete child issue. Prepare one Shift Linear issue for repo-grounded /sdd-new spec creation."
license: Apache-2.0
metadata:
  author: GitHub Copilot
  version: "1.0"
---

## Activation Contract

Use this skill when a Shift Linear issue is a concrete child issue, is labeled `workflow:needs-spec` or explicitly requires a gentle SDD spec, and the next step is spec creation rather than implementation.

Do not use this skill for phase umbrellas, issues that are still too broad, issues already labeled `workflow:agent-ready`, implementation requests, or issues missing concrete outcome/evidence/acceptance details.

## Hard Rules

- Read the target Linear issue before any spec work.
- Read `AGENTS.md` and follow the repo truth hierarchy.
- Recover Engram context for project `shift-desoc` before deciding suitability.
- Treat the Linear issue as the primary source of truth, then verify only the referenced repo surfaces.
- Do not implement code, modify unrelated issues, or create child issues unless the target proves too broad.
- If the issue is too broad or under-specified, stop and recommend `.github/skills/linear-issue-refiner/SKILL.md` instead.

## Decision Gates

| Situation | Action |
| --- | --- |
| Issue is an umbrella or mixes multiple delivery seams | Stop and recommend `linear-issue-refiner` |
| Issue lacks product outcome, source evidence, affected paths, or acceptance criteria | Stop and report missing inputs |
| Issue says spec is required and is concrete enough | Proceed into `/sdd-new` preparation |
| Blocking open questions appear during evidence gathering | Record them in the spec and update Linear |

## Execution Steps

1. Read the target Linear issue, labels, parent, status, and description.
2. Read `AGENTS.md`.
3. Recover relevant Engram context for `shift-desoc`.
4. Confirm the issue is not an umbrella and includes product outcome, source evidence, affected repo paths, acceptance criteria, and explicit gentle SDD spec guidance.
5. Gather only the issue-relevant repo context: referenced docs, contracts, tests, web/indexer files, status docs, and relevant Engram memories.
6. If the issue is too broad, stop and recommend `/linear-issue-refiner` instead of creating a spec.
7. If suitable, invoke or follow the existing `/sdd-new` workflow using the Linear issue as the primary source of truth.
8. Create the spec in the repo's existing gentle SDD convention with: problem statement, user/admin goal, current evidence, target behavior, non-goals, functional requirements, data/read-model requirements, authority/permission model, UX states, error/failure states, affected files, implementation plan outline, validation strategy, and blocking open questions only when necessary.
9. Update the same Linear issue with the spec path/link, a short spec summary, any blockers or open questions, and the recommended next status.

## Output Contract

Return:
- target issue reviewed
- spec created
- spec path
- Linear issue updated
- whether implementation can start
- recommended next command or issue

## References

- `AGENTS.md`
- `.github/copilot-instructions.md`
- `.github/project-management/STATUS_REVIEW.md`
- `.github/project-management/IMPLEMENTATION_STATUS.md`
- `.github/skills/linear-issue-refiner/SKILL.md`