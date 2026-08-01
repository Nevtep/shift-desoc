---
name: linear-issue-refiner
description: "Trigger: Linear issue refinement, specify issue split, workflow:needs-spec, broad backlog issue. Refine one Shift Linear issue into evidence-backed child issues for gentle SDD."
license: Apache-2.0
metadata:
  author: GitHub Copilot
  version: "1.1"
---

## Activation Contract

Use this skill when one Shift Linear issue is too broad for one PR, mixes multiple product/code surfaces, is labeled `workflow:needs-spec`, or is titled like `Specify ...`.

Do not use it to create roadmaps, audit the whole repo, implement code, create specs, modify repo files, or invent unrelated backlog.

## Preconditions

- Required capability: Linear access and target issue ID. If unavailable, return blocked with evidence.
- Read `AGENTS.md` and recover Engram project context for `shift-desoc` before backlog decisions.
- If a tool or issue state is unavailable, stop with a blocked result; do not guess.

## Hard Rules

- Treat Linear as backlog truth and repo evidence as verification truth.
- Inspect only issue-relevant surfaces: status docs, contracts, tests, deploy scripts, indexer, web, and referenced docs.
- Preserve phase labels, parent-child structure, existing label taxonomy, and author intent.
- Do not close issues, create repo files, commit, push, branch, or edit unrelated issues.
- Use idempotent updates: update existing matching children before creating new ones; include stable issue IDs in the result.
- Codex non-interactive mode: never wait for browser prompts; report missing credentials, permissions, or ambiguous duplicates as blocked.

## Decision Gates

| Situation | Action |
| --- | --- |
| Valid umbrella for later spec | Keep parent and split/update children |
| Multiple contracts, routes, or subsystems | Split into child issues |
| Already narrow and executable | Mark/recommend `workflow:agent-ready` |
| Lacks product or architecture clarity | Keep/recommend `workflow:needs-spec` |
| Duplicates another active issue | Link evidence and stop; ask before closing |

## Execution Steps

1. Read target issue labels, parent, status, description, dependencies, and existing children.
2. Read repo guidance and recover relevant Engram memories.
3. Verify current implementation reality from issue-relevant paths only.
4. Classify the issue: keep, rewrite, split, agent-ready, needs-spec, or duplicate.
5. Create/update child issues with product outcome, evidence paths, scope/non-goals, acceptance criteria, validation, dependencies, phase, and SDD requirement.
6. Update the parent summary and child links without changing unrelated backlog.
7. Recommend the next refinement or pickup issue.

## Output Contract

Return a short human summary plus JSON matching `../_shared/shift-agent-skill-result.schema.json` with `schemaVersion: "shift-agent-skill-result.v1"`. `operationKey` and `sideEffects` are required; `sideEffects` must list `none`, `attempted`, or `applied` effects. Include target issue, issues created/updated, parent-child structure, side effects, validation/evidence checks, blockers, and next recommendation.

## References

- `AGENTS.md`
- `.github/project-management/STATUS_REVIEW.md`
- `.github/project-management/IMPLEMENTATION_STATUS.md`
- `.github/copilot-instructions.md`
- `.github/skills/_shared/shift-agent-skill-result.schema.json`
