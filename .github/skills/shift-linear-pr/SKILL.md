---
name: shift-linear-pr
description: "Trigger: Shift PR creation, Shift PR update, Linear-linked GitHub PR, audited implementation, review-ready PR. Create/update Shift PRs only after an independent audit passes."
license: Apache-2.0
metadata:
  author: GitHub Copilot
  version: "1.2"
---

## Activation Contract

Use this skill when a Shift implementation branch has a passing independent completeness audit for the same HEAD commit and needs GitHub PR creation/update or PR title/body linkage cleanup.

Do not use it to implement code, audit completeness, merge, deploy, bypass human review, manually close Linear issues handled by native GitHub integration, or treat GitHub Issues as internal planning truth.

## Preconditions

- Inputs must include issue ID, branch, current commit, implementation result, independent audit result from a separate Codex session/thread, validation commands, and check status.
- Read the target Linear issue, `AGENTS.md`, and Engram project context for `shift-desoc` before PR metadata changes.
- Required capability: GitHub connector first; use `gh` only as fallback in non-interactive mode. If unavailable, return blocked with evidence.
- Audit gate: `auditVerdict = pass`, `safeToPublish = true`, `auditedCommit = current branch HEAD`, and the audit references the implementation `operationKey`.
- Same-session self-audit is invalid; block PR publication when the audit was produced by the implementer session/thread.

## Hard Rules

- Treat Linear as internal source of truth and GitHub community issues as separate public context.
- Do not use global `branch-pr` for Shift Linear issue PRs.
- Verify branch name has exactly one primary issue ID: `feat/SHI-XXX/short-description` or `imp/SHI-XXX/short-description`.
- Verify PR title and body preserve the same primary Linear issue ID.
- Block if the branch changed after audit, the auditor reviewed another commit, audit is `incomplete`/`blocked`/`failed`, remediation happened after audit, required tests are missing, `main` conflicts exist, or multiple primary issues are present.
- Use a Linear closing phrase only after the audit proves complete work is safe to publish; never manually close that Linear issue afterward.
- Do not merge, deploy, force-push, edit code, or auto-merge. Human review remains mandatory.
- Preserve idempotency: update an existing PR for the branch before creating a new one; reuse prior comments when possible.
- No-side-effect results must include `sideEffects: [{"effect":"none","target":"none","status":"none","summary":"No external side effects were performed."}]`.
- Codex non-interactive mode: do not rely on browser prompts; stop on missing auth, ambiguous linkage, or unavailable template.

## Decision Gates

| Situation | Action |
| --- | --- |
| Audit passed for current HEAD and one Linear issue | Create/update PR |
| Branch changed or audited commit differs | Block; require re-audit |
| Post-audit remediation exists | Block; require re-audit |
| Required validation/checks missing | Block unless human policy explicitly accepts |
| No issue ID or multiple primary IDs | Stop; report mismatch |
| Partial/preparatory PR | Use non-closing phrase |
| Complete audited implementation | Use closing phrase |

## Execution Steps

1. Read target Linear issue and repo guidance; recover Engram memories.
2. Inspect branch, HEAD commit, diff summary, existing PR, checks, and `.github/PULL_REQUEST_TEMPLATE.md`.
3. Verify the audit result and implementation result refer to the same issue and current commit.
4. Verify one primary Linear issue ID across branch, title, and body.
5. Generate/update PR body with scope, files changed, tests, audit result, risks, contract/deploy impact, migration impact, and review notes.
6. Add dedicated `Linear issue`, `Audit`, and `Closing phrase` sections using `Completes SHI-XXX` only for complete audited work or `Related to SHI-XXX` for partial work.
7. Keep GitHub community issue references in a separate non-closing section unless explicitly requested.
8. Create/update the PR, then comment/update Linear with PR URL, branch, tests, audit operation, and closing/non-closing phrase only when allowed.

## Output Contract

Return a short human summary plus JSON matching `../_shared/shift-agent-skill-result.schema.json` with `schemaVersion: "shift-agent-skill-result.v1"`. Use `operationKey: "shift-linear-pr:SHI-123:<head-commit>"`. Include required root fields: `schemaVersion`, `operationKey`, `status`, `summary`, `evidence`, `warnings`, `errors`, `nextAction`, and `sideEffects`.

Put skill-specific fields under `details`:

```json
{
  "issueId": "SHI-123",
  "branch": "",
  "headCommit": "",
  "implementationOperationKey": "",
  "auditOperationKey": "",
  "auditedCommit": "",
  "auditVerdict": "pass",
  "safeToPublish": true,
  "pr": {
    "number": null,
    "url": "",
    "state": ""
  },
  "closingPhrase": "",
  "checks": []
}
```

## References

- `AGENTS.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/copilot-instructions.md`
- `.github/project-management/STATUS_REVIEW.md`
- `.github/project-management/IMPLEMENTATION_STATUS.md`
- `.github/skills/linear-implement-agent-ready/SKILL.md`
- `.github/skills/_shared/shift-agent-skill-result.schema.json`
- `.github/skills/linear-implementation-completeness-audit/SKILL.md`
