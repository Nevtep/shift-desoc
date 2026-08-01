---
name: linear-sdd-from-issue
description: "Trigger: Linear issue, workflow:needs-spec, gentle SDD spec required, concrete child issue. Prepare one Shift Linear issue for repo-grounded /sdd-new spec creation."
license: Apache-2.0
metadata:
  author: GitHub Copilot
  version: "1.1"
---

## Activation Contract

Use this skill when a concrete Shift child issue is labeled `workflow:needs-spec` or explicitly requires a gentle SDD spec, and the next step is repo-grounded `/sdd-new` planning.

Do not use it for umbrellas, broad issues, `workflow:agent-ready` issues, implementation, or issues missing concrete outcome/evidence/acceptance details.

## Preconditions

- Required capability: Linear access and target issue ID. If unavailable, return blocked with evidence.
- Read the issue, `AGENTS.md`, and Engram project context for `shift-desoc` before suitability decisions.
- Use the active gentle SDD artifact store chosen by the orchestrator; if unknown, report blocked instead of inventing one.

## Hard Rules

- Treat the Linear issue as primary planning input, then verify only referenced repo surfaces.
- Do not implement code, update unrelated issues, branch, commit, push, or create child issues unless the target proves too broad.
- If too broad or under-specified, stop and recommend `.github/skills/linear-issue-refiner/SKILL.md`.
- Preserve Shift authority, treasury, ParamController, indexer, and Manager invariants from `AGENTS.md`.
- Idempotency: reuse/update the existing SDD artifact for the same issue/change when present; do not create duplicate specs.
- Codex non-interactive mode: do not open browser-only flows; return blocked when required Linear/SDD tools are unavailable.

## Decision Gates

| Situation | Action |
| --- | --- |
| Umbrella or multiple delivery seams | Stop; recommend `linear-issue-refiner` |
| Missing outcome, evidence, paths, or acceptance criteria | Stop; report missing inputs |
| Concrete and spec-required | Prepare/run `/sdd-new` |
| Blocking questions appear | Record them in SDD output and Linear update |

## Execution Steps

1. Read issue labels, parent, status, description, acceptance criteria, and dependencies.
2. Read repo guidance and recover relevant Engram memories.
3. Confirm the issue is concrete, spec-required, and evidence-backed.
4. Gather only referenced docs, contracts, tests, web/indexer paths, status docs, and memories.
5. Invoke/follow `/sdd-new` using the Linear issue as source of truth.
6. Ensure the spec captures problem, goal, current evidence, target behavior, non-goals, requirements, data/read models, authority/permissions, UX/error states, affected paths, validation, and open questions.
7. Update the same Linear issue with spec path/link, summary, blockers, and next status recommendation.

## Output Contract

Return a short human summary plus JSON matching `../_shared/shift-agent-skill-result.schema.json` with `schemaVersion: "shift-agent-skill-result.v1"`. `operationKey` and `sideEffects` are required; `sideEffects` must list `none`, `attempted`, or `applied` effects. Include target issue, SDD artifact ID/path, Linear update, side effects, suitability/validation checks, implementation readiness, blockers, and next command.

## References

- `AGENTS.md`
- `.github/copilot-instructions.md`
- `.github/project-management/STATUS_REVIEW.md`
- `.github/project-management/IMPLEMENTATION_STATUS.md`
- `.github/skills/linear-issue-refiner/SKILL.md`
- `.github/skills/_shared/shift-agent-skill-result.schema.json`
