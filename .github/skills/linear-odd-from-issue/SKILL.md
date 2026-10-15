---
name: linear-odd-from-issue
description: "Trigger: Linear issue, workflow:needs-spec, ODD feature document required, concrete child issue. Turn one Shift Linear issue into a repo-grounded ODD feature document plus Engram mirror."
license: Apache-2.0
metadata:
  author: GitHub Copilot
  version: "2.0"
---

## Activation Contract

Use this skill when a concrete Shift child issue is labeled `workflow:needs-spec` or explicitly requires planning before implementation, and the next step is a repo-grounded ODD feature document.

Do not use it for umbrellas, broad issues, direct implementation, PR creation, small tasks ODD handles inline, or issues missing concrete outcome/evidence/acceptance details.

This skill replaces `linear-sdd-from-issue`; gentle-ai v4 removed the SDD commands it depended on. The Linear label `workflow:needs-spec` keeps its name: "spec" now means the ODD feature document.

## Preconditions

- Required capability: Linear access, Engram (read and write), and repo read/write access to `odd/tasks/`. If unavailable, return blocked with evidence.
- Read the issue, `AGENTS.md`, and Engram project context for `shift-desoc` before suitability decisions.
- Resolve the document before writing: the locator is `odd/tasks/<feature-name>.md` with `<feature-name>` = `shi-<number>-<short-slug>`, mirrored in Engram (project `shift-desoc`) under topic `odd/<feature-name>/tasks`. Look for an existing document by issue prefix (`odd/tasks/shi-<number>-*.md`) and an existing Engram topic for the same issue, and reuse it when found.
- If more than one document or topic matches the issue, or the repo file and the Engram mirror disagree, return blocked with evidence instead of choosing one.

## Hard Rules

- Treat the Linear issue as primary planning input, then verify only referenced repo surfaces.
- Do not implement code, update unrelated issues, branch, commit, push, create PRs, or create child issues unless the target proves too broad. Writing the ODD document in the working tree and its Engram mirror are the only repo/memory writes; the implementer commits the document with its first work unit.
- If too broad or under-specified, stop and recommend `.github/skills/linear-issue-refiner/SKILL.md`.
- Preserve Shift authority, treasury, ParamController, indexer, and Manager invariants from `AGENTS.md`.
- Idempotency: reuse/update the existing ODD document and Engram topic for the same issue when present; never create a second document for one issue, and keep `<feature-name>` stable once chosen.
- No-side-effect results must include `sideEffects: [{"effect":"none","target":"none","status":"none","summary":"No external side effects were performed."}]`.
- Codex non-interactive mode: do not open browser-only flows; return blocked when required Linear/Engram tools are unavailable.

## Decision Gates

| Situation | Action |
| --- | --- |
| Umbrella or multiple delivery seams | Stop; recommend `linear-issue-refiner` |
| Missing outcome, evidence, paths, or acceptance criteria | Stop; report missing inputs |
| Existing ODD document or Engram topic for issue | Reuse/update it idempotently |
| Multiple matching documents/topics, or file and mirror disagree | Block with evidence |
| Concrete and planning-required | Write/update the ODD document and Engram mirror |
| Blocking questions appear | Record them in the document's open questions and `## Log`, and in the Linear update |

## Execution Steps

1. Read issue labels, parent, status, description, acceptance criteria, dependencies, and updated timestamp.
2. Read repo guidance and recover relevant Engram memories.
3. Resolve the ODD locator and any existing document/topic for the same issue.
4. Confirm the issue is concrete, planning-required, and evidence-backed.
5. Gather only referenced docs, contracts, tests, web/indexer paths, status docs, and memories.
6. Write or update `odd/tasks/<feature-name>.md` using the Linear issue as source of truth. It must contain: a locator line, objective, problem, current evidence (`path:line`), scope, non-goals, Spec items `S1..Sn` covering target behavior, requirements, data/read models, authority/permissions, and UX/error states, tasks `T1..Tn` that each cite their `S#` and affected paths, checks (narrowest validating commands from `AGENTS.md`), open questions, a forecast `Risk:` tier, and a `## Log` entry for this run.
7. Mirror the same content to Engram under topic `odd/<feature-name>/tasks` (project `shift-desoc`).
8. Update the same Linear issue with the document path, Engram topic, summary, blockers, and next status recommendation only when allowed.

## Output Contract

Return a short human summary plus JSON matching `../_shared/shift-agent-skill-result.schema.json` with `schemaVersion: "shift-agent-skill-result.v1"`. Use `operationKey: "linear-odd-from-issue:SHI-123:<issue-updated-at>"`. Include required root fields: `schemaVersion`, `operationKey`, `status`, `summary`, `evidence`, `warnings`, `errors`, `nextAction`, and `sideEffects`. Report the document as an `artifacts` entry with `kind: "odd_document"`, and the file and Engram writes as `sideEffects` (`file_write` and `other`).

Put skill-specific fields under `details`:

```json
{
  "issueId": "SHI-123",
  "artifactStore": "odd",
  "artifactId": "odd/shi-123-example/tasks",
  "artifactPath": "odd/tasks/shi-123-example.md",
  "featureName": "shi-123-example",
  "suitability": {
    "concrete": true,
    "specRequired": true,
    "evidenceBacked": true
  },
  "specItems": ["S1", "S2"],
  "tasks": ["T1", "T2"],
  "riskTier": "high",
  "implementationReady": false,
  "openQuestions": []
}
```

`artifactStore` is always `"odd"`, `artifactId` is the Engram topic, and `artifactPath` is the repo document. The output must be consumable by `linear-implement-agent-ready` in `spec-backed` mode via `details.artifactStore`, `details.artifactId`, `details.artifactPath`, `details.implementationReady`, and evidence entries.

## References

- `AGENTS.md`
- `.github/copilot-instructions.md`
- `.github/project-management/STATUS_REVIEW.md`
- `.github/project-management/IMPLEMENTATION_STATUS.md`
- `.github/skills/linear-issue-refiner/SKILL.md`
- `.github/skills/linear-implement-agent-ready/SKILL.md`
- `.github/skills/_shared/shift-agent-skill-result.schema.json`
