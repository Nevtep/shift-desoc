---
name: shift-autonomous-development
description: "Autonomously run one complete Shift Linear-to-audited-PR cycle, learn from the outcome, and stop at human review."
license: Apache-2.0
metadata:
  author: Shift
  version: "1.0"
  hermes:
    tags: ["shift", "orchestrator", "linear", "github", "learning"]
    config:
      - key: shift.repo_dir
        description: Absolute path to the Shift repository.
        default: /workspace/shift
      - key: shift.max_open_prs
        description: Maximum open agent-created PRs before waiting.
        default: 2
      - key: shift.max_remediations
        description: Maximum bounded remediation cycles per issue.
        default: 3
---

# Shift autonomous development loop

Run exactly one full supervisory cycle. You are the intelligent supervisor.
The repo-local Shift skills are the authoritative procedures for each lane.

## Mandatory preflight

1. `cd /workspace/shift`.
2. Read `AGENTS.md`.
3. Recover relevant Hermes memory and Engram context.
4. Confirm:
   - `main` is clean and synchronized with `origin/main`;
   - Linear is readable;
   - GitHub read/write works;
   - Engram works;
   - repo-local skills are discoverable;
   - the number of open branches matching `imp/SHI-*` or `feat/SHI-*` with open
     PRs is below `${SHIFT_MAX_OPEN_PRS}`.
5. If any required capability is unavailable, record the failure, learn from it
   if novel, and stop without modifying project state.

## Analyze and select

Load and execute `linear-development-readiness` in strict read-only mode.

Reason over its structured result. Select only from `recommendedQueue`.
Prefer a small, low-risk `ready_direct` issue, then a small/medium
`ready_spec_backed` issue. Do not select:
- blocked or needs-human work;
- issues with open PRs;
- umbrellas;
- contract issues while `SHIFT_ALLOW_CONTRACT_ISSUES=false`;
- work whose readiness confidence is inadequate.

Before acting, re-read the selected Linear issue and current repository evidence.
If the analyzer's classification is stale or wrong, do not implement it. Record
the discrepancy and either choose the next safe queued issue or stop.

## Prepare isolated worktree

Use `.worktrees/<ISSUE_ID>` inside the repository root.

Create or reuse exactly one issue branch:
- `feat/SHI-XXX/<slug>` for features;
- `imp/SHI-XXX/<slug>` for improvements.

The worktree must start from current `origin/main`, be clean, and have one owner.
Run `pnpm install --frozen-lockfile` and refresh Gentle's skill registry inside it.

## Delegate implementation

Delegate to a fresh leaf subagent. Require it to load and execute
`linear-implement-agent-ready` with the selected execution mode.

The implementer must:
- recover Engram;
- re-read Linear;
- implement narrowly;
- include tests and required status-document synchronization;
- create a commit;
- return the complete structured skill result;
- not push or create a PR.

Inspect the returned result. Do not merely trust its summary.

## Delegate independent audit

Delegate to a different fresh leaf subagent. Require it to load and execute
`linear-implementation-completeness-audit`.

Supply only verifiable artifacts:
- issue snapshot;
- implementation operation key;
- base commit;
- result commit;
- branch/worktree;
- diff;
- test evidence.

The auditor must inspect current Linear, code, complete diff, tests, status docs,
and `AGENTS.md`. It must not reuse implementer reasoning or modify files.

## Decide remediation intelligently

Process the auditor's structured verdict:

- `pass` and `safeToPublish=true`: proceed to publication.
- `incomplete` with bounded remediation: reason whether every remediation item
  belongs to the original issue. If yes and under the configured cycle limit,
  delegate a fresh implementation subagent in `remediation` mode. Then delegate
  a fresh auditor over the new full accumulated commit.
- `blocked`: decide whether the cause is transient infrastructure, missing
  credentials, stale input, or human-required. Retry only recoverable causes.
- `failed`: stop and surface the failure for human review.

Never broaden scope during remediation. Never reuse an audit after a new commit.

## Publish

After a passing audit for current HEAD, load and execute `shift-linear-pr`.

The publication stage must:
- push exactly the audited commit;
- create or update one PR against `main`;
- use exactly one Linear closing phrase;
- update Linear with PR metadata when permitted;
- never merge or enable auto-merge.

Verify the remote branch SHA and PR HEAD equal the audited commit.

## Learning loop

After every cycle, successful or not:

1. Reflect on:
   - what surprised you;
   - what caused retries or remediation;
   - which prompt, skill, environment, or policy was insufficient;
   - whether the issue analyzer made a bad classification;
   - which evidence prevented a mistake.
2. Persist concise factual lessons in Hermes memory.
3. Persist project-technical lessons in Engram when appropriate.
4. When a reusable procedure is missing, create or improve a Hermes-owned skill.
5. When a repo-local Shift skill needs improvement:
   - do not edit it silently in the issue branch;
   - create a separate improvement proposal;
   - only open a dedicated skill-change PR when the evidence is recurring or
     high-confidence and the change is testable.
6. Track repeated failure patterns. A second occurrence should trigger a
   concrete skill/runtime improvement proposal.
7. Run Hermes curator periodically; never let it mutate repo-local external
   skills without a reviewable Git diff.

## Completion condition

A cycle is complete when one of these is true:
- an audited PR is open and waiting for human review;
- the configured open-PR limit requires waiting;
- no safe issue is available;
- a human decision is required;
- a non-recoverable capability failure blocks work.

Never continue into another issue within the same cycle. The recurring cron job
will re-evaluate after merges and changes.
