---
name: linear-sdd-from-issue
description: "Trigger: Linear issue, workflow:needs-spec, gentle SDD spec required, concrete child issue. Prepare one Shift Linear issue for repo-grounded /sdd-new spec creation."
license: Apache-2.0
metadata:
  author: GitHub Copilot
  version: "1.2"
---

## Activation Contract

Use this skill when a concrete Shift child issue is labeled `workflow:needs-spec` or explicitly requires a gentle SDD spec, and the next step is repo-grounded `/sdd-new` planning.

Do not use it for umbrellas, broad issues, direct implementation, PR creation, or issues missing concrete outcome/evidence/acceptance details.

## Preconditions

- Required capability: Linear access, Engram, repo read access, and gentle SDD status/config access. If unavailable, return blocked with evidence.
- Read the issue, `AGENTS.md`, and Engram project context for `shift-desoc` before suitability decisions.
- Resolve artifact storage before writing: consult effective repo config, consult `gentle-ai sdd-status`, reuse an existing artifact for the same issue when found, and proceed only when the active store is unequivocal.
- If store signals are contradictory or unknown, return blocked instead of inventing where to write.

## Hard Rules

- Treat the Linear issue as primary planning input, then verify only referenced repo surfaces.
- Do not implement code, update unrelated issues, branch, commit, push, create PRs, or create child issues unless the target proves too broad.
- If too broad or under-specified, stop and recommend `.github/skills/linear-issue-refiner/SKILL.md`.
- Preserve Shift authority, treasury, ParamController, indexer, and Manager invariants from `AGENTS.md`.
- Idempotency: reuse/update the existing SDD artifact for the same issue/change when present; do not create duplicate specs.
- No-side-effect results must include `sideEffects: [{"effect":"none","target":"none","status":"none","summary":"No external side effects were performed."}]`.
- Codex non-interactive mode: do not open browser-only flows; return blocked when required Linear/SDD tools are unavailable.

## Decision Gates

| Situation | Action |
| --- | --- |
| Umbrella or multiple delivery seams | Stop; recommend `linear-issue-refiner` |
| Missing outcome, evidence, paths, or acceptance criteria | Stop; report missing inputs |
| Existing SDD artifact for issue | Reuse/update it idempotently |
| Contradictory or unknown artifact store | Block with evidence |
| Concrete and spec-required | Prepare/run `/sdd-new` |
| Blocking questions appear | Record them in SDD output and Linear update |

## Execution Steps

1. Read issue labels, parent, status, description, acceptance criteria, dependencies, and updated timestamp.
2. Read repo guidance and recover relevant Engram memories.
3. Resolve the active artifact store from effective repo config plus `gentle-ai sdd-status`; identify any existing artifact for the same issue.
4. Confirm the issue is concrete, spec-required, and evidence-backed.
5. Gather only referenced docs, contracts, tests, web/indexer paths, status docs, and memories.
6. Invoke/follow `/sdd-new` using the Linear issue as source of truth and the resolved artifact store.
7. Ensure the spec captures problem, goal, current evidence, target behavior, non-goals, requirements, data/read models, authority/permissions, UX/error states, affected paths, validation, and open questions.
8. Update the same Linear issue with spec path/link, summary, blockers, and next status recommendation only when allowed.

## Output Contract

Return a short human summary plus JSON matching `../_shared/shift-agent-skill-result.schema.json` with `schemaVersion: "shift-agent-skill-result.v1"`. Use `operationKey: "linear-sdd-from-issue:SHI-123:<issue-updated-at>"`. Include required root fields: `schemaVersion`, `operationKey`, `status`, `summary`, `evidence`, `warnings`, `errors`, `nextAction`, and `sideEffects`.

Put skill-specific fields under `details`:

```json
{
  "issueId": "SHI-123",
  "artifactStore": "openspec",
  "artifactId": "",
  "artifactPath": "",
  "suitability": {
    "concrete": true,
    "specRequired": true,
    "evidenceBacked": true
  },
  "implementationReady": false,
  "openQuestions": []
}
```

The output must be consumable by `linear-implement-agent-ready` in `spec-backed` mode via `details.artifactStore`, `details.artifactId`, `details.artifactPath`, `details.implementationReady`, and evidence entries.

## References

- `AGENTS.md`
- `.github/copilot-instructions.md`
- `.github/project-management/STATUS_REVIEW.md`
- `.github/project-management/IMPLEMENTATION_STATUS.md`
- `.github/skills/linear-issue-refiner/SKILL.md`
- `.github/skills/linear-implement-agent-ready/SKILL.md`
- `.github/skills/_shared/shift-agent-skill-result.schema.json`
