---
name: linear-implement-agent-ready
description: "Trigger: Linear issue, workflow:agent-ready, implementation, tests, remediation. Implement one Shift issue in direct, spec-backed, or audit-remediation mode."
license: Apache-2.0
metadata:
  author: GitHub Copilot
  version: "1.2"
---

## Activation Contract

Use this skill to implement one concrete Shift Linear issue in exactly one execution mode: `direct`, `spec-backed`, or `remediation`.

Do not use it for umbrellas, unresolved smart-contract architecture decisions, PR creation/update, pushing, moving Linear to review, final completeness claims, or closing phrases.

## Preconditions

- Required capability: Linear read access, git, package/test tooling, and Engram. If unavailable, return blocked with evidence.
- Before code changes, identify `executionMode`, verify the branch belongs to the issue, verify an isolated worktree, recover Engram, confirm no other process owns the worktree, and re-check dependencies.
- `direct`: issue is concrete, unblocked, has verifiable criteria, and is explicitly authorized for implementation without a spec.
- `spec-backed`: issue is `workflow:agent-ready`, has an approved/localizable SDD artifact from `linear-sdd-from-issue`, has no blocking questions, and dependencies are resolved.
- `remediation`: inputs include issue, audited commit, audit result, partial/missing criteria, scope limits, and existing worktree/branch; do not reinterpret the whole issue or expand scope.

## Hard Rules

- Inspect and edit only files tied to issue evidence, spec requirements, audit findings, and acceptance criteria.
- Read the SDD artifact before `spec-backed` work; read the audit result before `remediation` work.
- Normal execution may create/reuse a branch, write files, run validations, and create commits only when supervisor policy allows.
- Normal execution must not push, open/update PRs, move Linear to review, use closing phrases, or claim the issue is definitively complete.
- The completeness audit must run in a separate Codex session/thread from the implementer; same-session self-audit is invalid.
- Branch policy: use/reuse `feat/SHI-XXX/short-description` for features or `imp/SHI-XXX/short-description` for improvements; stop if ownership is ambiguous.
- Validation policy: add/update required tests, run the narrowest relevant command, and widen only when evidence requires it.
- No-side-effect results must include `sideEffects: [{"effect":"none","target":"none","status":"none","summary":"No external side effects were performed."}]`.
- Codex non-interactive mode: avoid prompts/browser waits; if auth, permissions, installs, or conflicts block progress, return blocked with evidence.

## Decision Gates

| Situation | Action |
| --- | --- |
| Direct issue meets explicit no-spec gates | Implement in `direct` mode |
| Approved SDD artifact is available | Implement in `spec-backed` mode |
| Audit result requests bounded fixes | Implement only those fixes in `remediation` mode |
| Needs spec | Stop; recommend `linear-sdd-from-issue` |
| Needs splitting | Stop; recommend `linear-issue-refiner` |
| Dirty/ambiguous worktree or unresolved owner | Stop or isolate only with explicit permission |

## Execution Steps

1. Read issue labels, status, parent, dependencies, acceptance criteria, validation notes, updated timestamp, and mode-specific inputs.
2. Read repo guidance and recover relevant Engram memories.
3. Verify mode preconditions; stop on any failed gate.
4. Check branch and working tree; protect others' edits.
5. Create/reuse the issue branch only when needed and allowed.
6. Read issue/spec/audit-relevant paths, implement narrowly, and update tests.
7. Run focused validation; fix in scope or stop with blocker evidence.
8. Create a commit only when policy permits; do not push or create/update PRs.
9. Return `nextAction.type: "handoff"` with `nextAction.description: "Run the independent completeness audit in a separate session/thread."`.

## Output Contract

Return a short human summary plus JSON matching `../_shared/shift-agent-skill-result.schema.json` with `schemaVersion: "shift-agent-skill-result.v1"`. Use `operationKey: "linear-implement-agent-ready:SHI-123:<execution-mode>:<base-commit>"`. Include required root fields: `schemaVersion`, `operationKey`, `status`, `summary`, `evidence`, `warnings`, `errors`, `nextAction`, and `sideEffects`.

Put skill-specific fields under `details`:

```json
{
  "issueId": "SHI-123",
  "executionMode": "direct",
  "branch": "imp/SHI-123/example",
  "baseCommit": "",
  "resultCommit": "",
  "spec": {
    "required": false,
    "artifactId": "",
    "artifactPath": ""
  },
  "remediationSource": {
    "auditOperationKey": "",
    "auditedCommit": ""
  },
  "changedFiles": [],
  "acceptanceCriteriaAddressed": [],
  "testsRun": [],
  "knownLimitations": [],
  "auditReady": true
}
```

`details.auditReady` may be `true` only when there is an identifiable commit or stable diff, required validations ran, no known implementer errors remain, and evidence is sufficient for the future independent completeness auditor.

## References

- `AGENTS.md`
- `.github/copilot-instructions.md`
- `.github/project-management/STATUS_REVIEW.md`
- `.github/project-management/IMPLEMENTATION_STATUS.md`
- `.github/skills/linear-sdd-from-issue/SKILL.md`
- `.github/skills/linear-issue-refiner/SKILL.md`
- `.github/skills/shift-linear-pr/SKILL.md`
- `.github/skills/_shared/shift-agent-skill-result.schema.json`
- Future missing skill: `completeness auditor`
