---
name: linear-development-readiness
description: "Trigger: Linear backlog readiness, execution queue, workable Shift issues, backlog reanalysis. Produce a read-only prioritized issue report."
license: Apache-2.0
metadata:
  author: GitHub Copilot
  version: "1.0"
---

## Activation Contract

Use this skill when a supervisor needs to analyze open Shift Linear issues, identify workable issues, order an execution queue, re-evaluate backlog after merges or issue/PR changes, or emit a read-only readiness report.

Do not use it for one issue already selected for refinement, SDD, implementation, audit, or PR publication. Use the focused repo-local skill for that lane instead.

## Hard Rules

- Required capabilities: Linear read, Git read, GitHub PR/check read, Engram read, and repo status-doc read. If any needed capability is unavailable, return `blocked` with evidence.
- Do not modify Linear, GitHub, Engram, branches, repository files, specs, PRs, comments, or labels while running the analysis; Engram access is read-only.
- Read relevant open issues: status, priority, labels, parent/children, blockers/dependencies, comments, acceptance criteria, linked specs, linked PRs, timestamps, and recent changes.
- Check overlapping open PRs and code reality only for candidate verification; do not exhaustively audit the repo per issue.
- Assign exactly one classification per issue: `ready_direct`, `ready_spec_backed`, `needs_spec`, `needs_refinement`, `blocked`, `in_progress_or_pr_open`, `done_or_obsolete`, or `needs_human`.
- Never let high Linear priority override incompleteness, blockers, open PRs, unresolved decisions, umbrella scope, or missing spec approval.
- Do not invent dependencies, treat historical docs above code, use unapproved specs as implementation authorization, recommend conflicting issues in parallel, or hide uncertainty.

## Decision Gates

| Issue evidence | Classification / next skill |
| --- | --- |
| Concrete, verifiable, unblocked, no pending architecture/SDD need, one-PR scope, no PR conflict | `ready_direct` / `linear-implement-agent-ready` |
| `workflow:agent-ready`, approved/localizable spec, criteria and validations sufficient, dependencies resolved, no PR | `ready_spec_backed` / `linear-implement-agent-ready` |
| Concrete but design, contract, data, permission, UX, or cross-surface behavior is unresolved | `needs_spec` / `linear-sdd-from-issue` |
| Umbrella, multiple seams, too broad, or incomplete criteria | `needs_refinement` / `linear-issue-refiner` |
| Dependency, blocker, unavailable infra, active conflicting PR, or explicit blocked status | `blocked` |
| Active work or linked/open PR exists | `in_progress_or_pr_open` |
| Already merged/done, stale, duplicate, or superseded by code/status evidence | `done_or_obsolete` |
| Contradictory evidence, political priority/scope, high unresolved risk, or unsafe insufficiency | `needs_human` |

## Execution Steps

1. Recover Engram context for `shift-desoc`; read `AGENTS.md`, `.github/copilot-instructions.md`, status docs, and existing repo-local workflow skills.
2. Capture Linear snapshot identity, relevant open issues, statuses, workflow labels, priorities, dependencies, comments, specs, and linked PRs.
3. Capture Git main commit and read open GitHub PR/check state that may overlap candidates.
4. Classify every analyzed issue once, recording evidence and uncertainty.
5. Rank executable work by readiness/blocking first, then Linear priority, estimated complexity (`xs|s|m|l|xl|unknown`), risk, dependency depth, parallel conflict risk, value/urgency, and confidence.
6. Build `recommendedQueue` up to the configurable candidate limit; `recommendedQueue.length` must not exceed `details.candidateLimit`. Prefer small `ready_direct`, then small/medium `ready_spec_backed`, other low-risk direct work, spec creation for important concrete issues, then refinement. Keep blocked/human items outside the executable queue unless explicitly requested.
7. Report reanalysis triggers: main merge or advance, PR opened/closed, issue created, status/dependency/priority/spec/comment changed, or other requirement-altering update.

## Output Contract

Return a short human summary plus JSON matching `../_shared/shift-agent-skill-result.schema.json` and validating `linear-development-readiness-result.schema.json`. Use `operationKey: "linear-development-readiness:<linear-snapshot-id>:<main-commit>"`; derive `linear-snapshot-id` from the Linear workspace/project, analyzed issue IDs, issue count, and latest issue update timestamp.

Put all skill-specific data under `details`; do not add custom root fields. Use this exact side effect item:

```json
[{"effect":"none","target":"Linear, GitHub, and repository","status":"none","summary":"Read-only readiness analysis; no external state was changed."}]
```

## References

- `AGENTS.md`
- `.github/copilot-instructions.md`
- `docs/agentic-development-workflow.md`
- `.github/project-management/STATUS_REVIEW.md`
- `.github/project-management/IMPLEMENTATION_STATUS.md`
- `.github/skills/_shared/shift-agent-skill-result.schema.json`
- `.github/skills/linear-development-readiness/linear-development-readiness-result.schema.json`
- `.github/skills/linear-issue-refiner/SKILL.md`
- `.github/skills/linear-sdd-from-issue/SKILL.md`
- `.github/skills/linear-implement-agent-ready/SKILL.md`
- `.github/skills/shift-linear-pr/SKILL.md`
