---
name: linear-implementation-completeness-audit
description: "Trigger: implementation audit, auditReady, remediation complete, PR gate, partial completion. Independently audit Shift issue completeness."
license: Apache-2.0
metadata:
  author: GitHub Copilot
  version: "1.0"
---

## Activation Contract

Use this skill when a Shift implementation is `auditReady`, remediation ended, a commit must be cleared for `shift-linear-pr`, or partial issue completion must be checked.

Do not use it before implementation, for generic style review, post-PR Copilot review, requirement redefinition, code completion, PR creation, Linear updates, commits, pushes, or repository edits.

## Hard Rules

- Run only in a different agent session/thread from the implementer; same-session self-audit is invalid for PR publication.
- Do not receive or reuse implementer conversational reasoning. Accept only verifiable artifacts: issue ID/snapshot, spec/artifact when present, implementation operation key/result, base commit, result commit, branch/worktree, diff, declared tests, and evidence.
- Require the implementer result to provide an identifiable `resultCommit`; stable uncommitted diffs are not valid audit or PR-gate inputs.
- Read Linear, final code, diff against base, validations, relevant status docs, and `AGENTS.md`; never trust implementer completion claims alone.
- Return `blocked` when Linear is unreadable, issue is stale, the implementer result has no identifiable result commit, commits do not exist, branch HEAD is inconsistent, diff is unavailable, implementer result is invalid, required spec is not localizable, or post-result unaudited changes exist.
- Every criterion finding needs concrete evidence: file, symbol, test, command, event, route, or observable behavior. File existence, commit names, Linear comments, and summaries alone are insufficient.
- Do not soften missing criteria, broaden requirements, approve by test count, demand unrelated surfaces, mix style review with completeness, fix code, publish PRs, change Linear, or mutate Engram.

## Decision Gates

| Evidence | Verdict |
| --- | --- |
| All applicable criteria satisfied, mandatory validations passed, no material gaps, `auditedCommit = branchHead = implementation.resultCommit` | `pass`, `safeToPublish: true` |
| Partial/missing criteria are fixable in scope | `incomplete`, remediation required |
| Access, evidence, environment, spec, commit, or diff precondition prevents judgment | `blocked` |
| Contradiction, severe regression, unauthorized architecture, wrong issue diff, contamination, or dangerous out-of-scope change | `failed` |

Classify each criterion as `satisfied`, `partial`, `missing`, `not_applicable`, or `unverifiable`; distinguish not applicable from not proven.

## Execution Steps

1. Verify independence and inputs, then compute `operationKey: "linear-implementation-completeness-audit:SHI-123:<audited-commit>"`.
2. Check preconditions and commit binding before assessing completeness.
3. Audit only relevant dimensions: functional completeness, AC, spec/requirements, scope/non-goals, tests, errors, permissions/authority, contracts/events, indexer/read models, Manager/UI, required status docs, regressions, unintended scope, migrations/deploy impact, and `AGENTS.md` contradictions.
4. Record evidence per criterion and validation; mark unverifiable instead of guessing.
5. For `incomplete`, emit remediation items compatible with `linear-implement-agent-ready` remediation mode: `criterionId`, `problem`, `requiredChange`, `evidence`, `allowedScope`, and `requiredValidation`.
6. Recommend maximum remediation cycles: 3; after that, set next action to `human_input`.
7. Return JSON that validates both the shared Shift result schema and this skill schema.

## Output Contract

Return a short human summary plus JSON matching `../_shared/shift-agent-skill-result.schema.json` and `linear-implementation-completeness-audit-result.schema.json`. Put skill-specific data under `details`; do not add custom root fields. Include PR-gate compatibility fields `implementationOperationKey`, `auditOperationKey`, `auditedCommit`, `auditVerdict`, and `safeToPublish`, plus remediation fields compatible with `linear-implement-agent-ready`.

Use this exact no-side-effect entry:

```json
[{"effect":"none","target":"Repository, Linear, and GitHub","status":"none","summary":"Independent read-only audit; no external state was changed."}]
```

`pass` must hand off to `shift-linear-pr` using unchanged `auditedCommit`; `incomplete` must hand off to `linear-implement-agent-ready` remediation mode; `blocked` must name the failed precondition; `failed` must stop publication.

## References

- `AGENTS.md`
- `.github/copilot-instructions.md`
- `docs/agentic-development-workflow.md`
- `.github/project-management/STATUS_REVIEW.md`
- `.github/project-management/IMPLEMENTATION_STATUS.md`
- `.github/skills/_shared/shift-agent-skill-result.schema.json`
- `.github/skills/linear-implementation-completeness-audit/linear-implementation-completeness-audit-result.schema.json`
- `.github/skills/linear-implementation-completeness-audit/assets/result-pass.example.json`
- `.github/skills/linear-implementation-completeness-audit/assets/result-incomplete.example.json`
- `.github/skills/linear-implementation-completeness-audit/assets/result-blocked.example.json`
- `.github/skills/linear-implementation-completeness-audit/assets/result-failed.example.json`
- `.github/skills/linear-implement-agent-ready/SKILL.md`
- `.github/skills/shift-linear-pr/SKILL.md`
