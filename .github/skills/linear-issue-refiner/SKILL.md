---
name: linear-issue-refiner
description: "Trigger: Linear issue refinement, specify issue split, workflow:needs-spec, broad backlog issue. Refine one Shift Linear issue into evidence-backed child issues for gentle SDD."
license: Apache-2.0
metadata:
  author: GitHub Copilot
  version: "1.0"
---

## Activation Contract

Use this skill when one Shift Linear issue is too broad for one PR, mixes multiple product or code surfaces, is labeled `workflow:needs-spec`, or is titled like `Specify ...`.

Do not use this skill to create a roadmap, audit the whole repo, implement code, create specs, modify repo files as part of issue refinement, or generate unrelated backlog items.

## Hard Rules

- Read the target Linear issue before touching child issues.
- Read `AGENTS.md` and follow the repo truth hierarchy.
- Recover Engram context for project `shift-desoc` before making backlog decisions.
- Inspect only issue-relevant surfaces across docs, status docs, contracts, tests, deploy scripts, indexer, and web.
- Preserve phase labels and parent-child structure.
- Prefer taxonomy labels such as `type:feature` or `type:improvement` when editing affected issues; do not invent labels that do not exist.
- Do not close issues without explicit user approval.
- Keep evidence tied to concrete repo paths, not product aspirations alone.

## Decision Gates

| Situation | Action |
| --- | --- |
| Issue is valid umbrella for a later spec | Keep as parent and split children |
| Issue mixes multiple contracts, routes, or subsystems | Split into child issues |
| Issue is already narrow and executable | Mark agent-ready |
| Issue still lacks product or architecture clarity | Leave `workflow:needs-spec` |
| Issue duplicates another active issue | Ask before closing; otherwise link and stop |

## Execution Steps

1. Read the target Linear issue and current labels, parent, status, and description.
2. Read `AGENTS.md`.
3. Recover relevant Engram context for `shift-desoc`.
4. Read only the repo surfaces required to verify scope and current implementation reality.
5. Classify the target issue as keep, rewrite, split, agent-ready, needs-spec, or possible duplicate.
6. If splitting, create or update child issues directly with:
   - product outcome
   - source evidence
   - affected repo paths
   - scope and non-goals
   - acceptance criteria
   - validation approach
   - dependencies
   - phase
   - whether gentle SDD spec is required
7. Update the parent issue so it accurately reflects umbrella scope and links the child structure.
8. Recommend the next issue to refine or the next issue ready for gentle SDD.

## Output Contract

Return:
- target issue reviewed
- issues updated
- issues created
- resulting parent-child structure
- recommended next refinement or pickup issue

## References

- `AGENTS.md`
- `.github/project-management/STATUS_REVIEW.md`
- `.github/project-management/IMPLEMENTATION_STATUS.md`
- `.github/copilot-instructions.md`