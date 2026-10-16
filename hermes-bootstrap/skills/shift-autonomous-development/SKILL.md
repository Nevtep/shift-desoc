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

## Repo-local skill resolution

The repo-local Shift skills are NOT Hermes skills: Hermes excludes `.github`
path segments from skill scans, so `skill_view <name>` will not find them.
Whenever this skill (or a delegated child) must "load" a repo-local skill,
read the file directly from the checkout the work runs in:

| Skill | Path (relative to repo or worktree root) |
| --- | --- |
| `linear-development-readiness` | `.github/skills/linear-development-readiness/SKILL.md` |
| `linear-issue-refiner` | `.github/skills/linear-issue-refiner/SKILL.md` |
| `linear-sdd-from-issue` | `.github/skills/linear-sdd-from-issue/SKILL.md` |
| `linear-implement-agent-ready` | `.github/skills/linear-implement-agent-ready/SKILL.md` |
| `linear-implementation-completeness-audit` | `.github/skills/linear-implementation-completeness-audit/SKILL.md` |
| `shift-linear-pr` | `.github/skills/shift-linear-pr/SKILL.md` |

Shared result schema: `.github/skills/_shared/shift-agent-skill-result.schema.json`.
When delegating, pass the absolute path in the child's task text; children do
not inherit this table.

Runtime mapping for those skills when executed under Hermes:
- "separate Codex session/thread" means a separate, fresh Claude Code
  invocation (see "Coding agent" below). Never `--resume` or `--continue` an
  implementer session for an audit; the implementer and auditor must be
  different Claude Code sessions.
- "Linear access" means the `linear` MCP server (configured for both Hermes
  and Claude Code).
- "GitHub connector first" means `gh` with `GH_TOKEN`; it is the only GitHub
  surface available in this runtime.

## Coding agent: Claude Code

Hermes supervises; Claude Code writes and audits code. Run every lane that
reads or changes code as a non-interactive Claude Code session from the issue
worktree (load the bundled `claude-code` skill for CLI details):

```bash
cd /workspace/shift/.worktrees/<ISSUE_ID>
claude -p "<lane prompt>" \
  --output-format json \
  --dangerously-skip-permissions \
  --disallowedTools "Bash(git push:*)" "Bash(gh pr:*)" "Bash(gh api:*)" \
  --max-budget-usd "${SHIFT_CLAUDE_MAX_BUDGET_USD:-20}" \
  > /opt/data/cache/shift/<ISSUE_ID>-<lane>-<n>.json
```

- The container is the sandbox, which is why permission prompts are skipped;
  pushing and PR mutation stay blocked for implementer and auditor sessions.
  Only the publication stage (`shift-linear-pr`), run by you, may push.
- The lane prompt must name the absolute repo-local skill path to follow, the
  execution mode, the issue ID, and the exact artifacts it may rely on. It
  must require the skill's structured JSON result as the final message.
- Record each result's `session_id`, `subtype`, `num_turns` and
  `total_cost_usd`. Treat `error_max_turns`, `error_budget` or a missing
  structured result as `blocked`, not as success.
- Claude Code sessions also load Gentle AI's global ODD/RDD instructions
  (`~/.claude/CLAUDE.md`). The repository `AGENTS.md` and the lane's
  repo-local skill decide scope, artifacts and stop conditions; an RDD native
  review run by the implementer is extra evidence for the auditor, never a
  substitute for the independent completeness audit.
- Use a Hermes `delegate_task` child only for supervision work that does not
  edit code (e.g. summarising evidence); it never replaces the Claude Code
  implementer or auditor.

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

Start a fresh Claude Code session (see "Coding agent"). Require it to read and
execute `.github/skills/linear-implement-agent-ready/SKILL.md` with the
selected execution mode.

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

Start a different fresh Claude Code session (never resumed from the
implementer). Require it to read and execute
`.github/skills/linear-implementation-completeness-audit/SKILL.md`, and add
`--disallowedTools "Edit" "Write" "NotebookEdit"` so it cannot modify files.

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
  start a fresh Claude Code implementation session in `remediation` mode. Then
  start a fresh Claude Code audit session over the new full accumulated commit.
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
