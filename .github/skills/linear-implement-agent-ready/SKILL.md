---
name: linear-implement-agent-ready
description: "Trigger: Linear issue, workflow:agent-ready, implementation, tests, remediation. Implement one Shift issue in direct, spec-backed, or audit-remediation mode."
license: Apache-2.0
metadata:
  author: GitHub Copilot
  version: "1.3"
---

## Activation Contract

Use this skill to implement one concrete Shift Linear issue in exactly one execution mode: `direct`, `spec-backed`, or `remediation`.

Do not use it for umbrellas, unresolved smart-contract architecture decisions, PR creation/update, pushing, moving Linear to review, final completeness claims, or closing phrases.

## Preconditions

- Required capability: Linear read access, git, package/test tooling, and Engram. If unavailable, return blocked with evidence.
- Before code changes, identify `executionMode`, verify the branch belongs to the issue, verify an isolated worktree, recover Engram, confirm no other process owns the worktree, and re-check dependencies.
- `direct`: issue is concrete, unblocked, has verifiable criteria, and is explicitly authorized for implementation without a spec.
- `spec-backed`: issue is `workflow:agent-ready`, has an approved/localizable ODD feature document from `linear-odd-from-issue` (`odd/tasks/<feature-name>.md` matching its Engram mirror `odd/<feature-name>/tasks`), has no blocking questions, and dependencies are resolved.
- `remediation`: inputs include issue, audited commit, audit result, partial/missing criteria, scope limits, and existing worktree/branch; do not reinterpret the whole issue or expand scope.

## Hard Rules

- Inspect and edit only files tied to issue evidence, spec requirements, audit findings, and acceptance criteria.
- Read the ODD feature document before `spec-backed` work; read the audit result before `remediation` work.
- `spec-backed` work follows the document's tasks: commit the document with the first work unit if it is not yet in the branch, make one work-unit commit per task (or tightly coupled task group), and append each commit and its validation evidence to the document's `## Log` and Engram mirror. `direct` work stays inline with no ODD artifacts.
- Strict TDD: write or update the failing test before the implementation change, and record RED and GREEN evidence.
- Native review (RDD): before marking audit-ready, run `gentle-ai review assess` and, when it calls for review, `gentle-ai review start` on the result candidate; fix findings in scope. Read `gentle-ai review mode status` but never enable or disable review mode; if it is off, record that as evidence. Native review and the ODD verifier never replace the separate-session completeness audit.
- Close the result with a `Risk:` line (tier and reason). Contracts, authority/role wiring, ParamController policy, treasury paths, deploy flows, and indexer event compatibility are always high-risk and require the independent ODD verifier before audit handoff.
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
| Approved ODD feature document is available | Implement in `spec-backed` mode |
| Audit result requests bounded fixes | Implement only those fixes in `remediation` mode |
| Needs ODD feature document | Stop; recommend `linear-odd-from-issue` |
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
8. Create work-unit commits only when policy permits; do not push or create/update PRs.
9. Run native review on the result candidate when review mode is on, and the independent ODD verifier when a high-risk item fires; fix findings in scope and re-validate.
10. Set `details.auditReady: true` only when `details.resultCommit` is populated with the commit that contains the implementation result.
11. Return `nextAction.type: "handoff"` with `nextAction.description: "Run the independent completeness audit in a separate session/thread for resultCommit <sha>."`.

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
    "artifactStore": "odd",
    "artifactId": "",
    "artifactPath": ""
  },
  "nativeReview": {
    "mode": "on",
    "reviewId": "",
    "outcome": ""
  },
  "riskTier": "low",
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

`details.auditReady` may be `true` only when `details.resultCommit` is an identifiable commit containing the implementation result, required validations ran, native review findings (when review mode is on) and any required ODD verifier findings are resolved, no known implementer errors remain, and evidence is sufficient for the independent `linear-implementation-completeness-audit` auditor. Stable uncommitted diffs are not audit-ready and must not be handed to the audit or PR gate.

## References

- `AGENTS.md`
- `.github/copilot-instructions.md`
- `.github/project-management/STATUS_REVIEW.md`
- `.github/project-management/IMPLEMENTATION_STATUS.md`
- `.github/skills/linear-odd-from-issue/SKILL.md`
- `.github/skills/linear-issue-refiner/SKILL.md`
- `.github/skills/shift-linear-pr/SKILL.md`
- `.github/skills/_shared/shift-agent-skill-result.schema.json`
- `.github/skills/linear-implementation-completeness-audit/SKILL.md`
