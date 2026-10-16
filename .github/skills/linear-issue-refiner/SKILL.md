---
name: linear-issue-refiner
description: "Trigger: Linear issue refinement, specify issue split, workflow:needs-spec, broad backlog issue. Refine one Shift Linear issue into evidence-backed child issues for ODD planning."
license: Apache-2.0
metadata:
  author: GitHub Copilot
  version: "1.4"
---

## Activation Contract

Use this skill when one Shift Linear issue is too broad for one PR, mixes multiple product/code surfaces, is labeled `workflow:needs-spec`, or is titled like `Specify ...`.

Do not use it to create roadmaps, globally rank the backlog, audit the whole repo, implement code, create specs, modify repo files, or invent unrelated backlog.

## Preconditions

- Required capability: Linear access and target issue ID. If unavailable, return blocked with evidence.
- Read `AGENTS.md` and recover Engram project context for `shift-desoc` before backlog decisions.
- If a tool or issue state is unavailable, stop with a blocked result; do not guess.

## Hard Rules

- Treat Linear as backlog truth and repo evidence as verification truth.
- Inspect only issue-relevant surfaces: status docs, contracts, tests, deploy scripts, indexer, web, and referenced docs.
- Preserve the project milestone (roadmap phase), parent-child structure, the label taxonomy, and author intent. Taxonomy: type `Feature` | `Improvement` | `Bug`; readiness `workflow:agent-ready` | `workflow:needs-spec` | `workflow:backlog`; `domain:contracts` on anything that changes Solidity (other `domain:*` labels are optional). `type:*`, `area:*` and `phase:*` are retired; never add them.
- **Split vertically, never by layer.** Each child is one contract capability delivered end to end: contract calls → indexer projection/endpoints → Manager route or wizard → a QA check. Never create a separate issue for a projection, read model, schema, hook, or "foundation"; those are tasks inside the Feature that needs them (they become `T#` items of its ODD document). If one capability currently spans several layer-issues, recommend merging them into one Feature.
- Every Feature or Improvement you create or rewrite carries these sections: `Outcome` (what the admin can do afterwards), `Why`, `Layers (vertical slice)`, `QA: how to test (Base Sepolia)` with numbered admin-runnable steps, `Out of scope`, `Dependencies`. Set the milestone, a priority (High/Medium/Low), and `workflow:needs-spec` for medium/large or `workflow:agent-ready` for small, directly implementable work.
- Do not close issues, create repo files, commit, push, branch, or edit unrelated issues.
- Do not mark or recommend an issue as implementation-ready from description text alone; first contrast it with repo evidence and dependencies.
- Do not perform global backlog analysis or cross-backlog ranking; classify only the target issue and directly related children/duplicates.
- Use idempotent updates: update existing matching children before creating new ones; include stable issue IDs in the result.
- No-side-effect results must include `sideEffects: [{"effect":"none","target":"none","status":"none","summary":"No external side effects were performed."}]`.
- Non-interactive mode: never wait for browser prompts; report missing credentials, permissions, or ambiguous duplicates as blocked.

## Decision Gates

| Situation | Action |
| --- | --- |
| Several independent contract capabilities in one issue | One `Feature` per capability, each a full vertical slice; the original becomes a duplicate of the first or is rewritten as one of them (no umbrella issue — the milestone is the grouping) |
| One capability split across layer issues (projection / surface / foundation) | Merge into one `Feature`; mark the others as duplicates of it |
| Already narrow, evidence-backed, unblocked, executable, and carrying a QA section | Recommend `workflow:agent-ready` |
| Requires design/product clarification | Recommend `workflow:needs-spec` and `linear-odd-from-issue` |
| Duplicates another active issue | Link evidence and stop; ask before closing |

## Execution Steps

1. Read target issue labels, parent, status, description, dependencies, updated timestamp, and existing children.
2. Read repo guidance and recover relevant Engram memories.
3. Verify current implementation reality from issue-relevant paths only.
4. Classify the issue: keep, rewrite, split, agent-ready, needs-spec, or duplicate.
5. Create/update Feature issues with the mandatory sections (`Outcome`, `Why`, `Layers (vertical slice)`, `QA: how to test (Base Sepolia)`, `Out of scope`, `Dependencies`), evidence paths, milestone, priority, and `workflow:needs-spec` (ODD feature document required) or `workflow:agent-ready`.
6. Update the parent summary and child links without changing unrelated backlog.
7. Recommend either `linear-odd-from-issue` or `linear-implement-agent-ready` as the next workflow.

## Output Contract

Return a short human summary plus JSON matching `../_shared/shift-agent-skill-result.schema.json` with `schemaVersion: "shift-agent-skill-result.v1"`. Use `operationKey: "linear-issue-refiner:SHI-123:<issue-updated-at>"`. Include required root fields: `schemaVersion`, `operationKey`, `status`, `summary`, `evidence`, `warnings`, `errors`, `nextAction`, and `sideEffects`.

Put skill-specific fields under `details`:

```json
{
  "classification": "split",
  "issuesCreated": [],
  "issuesUpdated": [],
  "recommendedWorkflow": "linear-odd-from-issue"
}
```

## References

- `AGENTS.md`
- `.github/project-management/STATUS_REVIEW.md`
- `.github/project-management/IMPLEMENTATION_STATUS.md`
- `.github/copilot-instructions.md`
- `.github/skills/linear-odd-from-issue/SKILL.md`
- `.github/skills/linear-implement-agent-ready/SKILL.md`
- `.github/skills/_shared/shift-agent-skill-result.schema.json`
