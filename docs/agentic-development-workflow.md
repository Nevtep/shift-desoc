# Shift Agentic Development Workflow

This document defines the incremental path from Shift's current Linear plus GitHub workflow to a Hermes-style agentic delivery system. The short answer is: keep planning and implementation intelligence in repo-local skills, let Linear's native GitHub integration handle basic PR-to-issue linking and closing, use an external orchestrator only for cross-system work that native integrations do not already solve, keep CI and merge/deploy enforcement in GitHub Actions, and keep merge and release human-gated until governance-to-artifact linkage is stronger.

## Current Reality

Shift already has strong on-chain governance for protocol state, but it does not yet have automation that links Linear issues, Git branches, GitHub PRs, governance approvals, and deploy actions into one controlled pipeline.

Current repo evidence:

- On-chain governance exists through `ShiftGovernor -> Timelock` and governs privileged protocol actions.
- Deploy and authority-mode handling already distinguish `admin-managed` and `governance-managed` staging outcomes.
- Repo-local workflows now exist for backlog readiness analysis, issue refinement, issue-to-SDD, implementation of agent-ready/spec-backed/remediation issues, and audited PR publication.
- Linear's native GitHub integration can already link PRs through branch name, PR title, and PR body wording, and can move linked Linear issues through configured PR automations on merge.
- Repo-defined PR validation now starts with `.github/workflows/agentic-pr-checks.yml`; it covers install/lockfile, contract tests, web unit tests, and indexer unit tests without replacing external deployment checks.
- There is no direct repo evidence of PR-to-governance, issue-to-governance, or merge-to-governance linkage.
- GitHub Issues may be used as community-facing intake or discussion, while Linear remains the internal planning and implementation source of truth.


## Local Audit Snapshot

This section records a local audit snapshot for `/Users/core/Code/shift` on this machine. It is diagnostic evidence, not universal repo policy or a permanent health guarantee. Re-verify before changing automation.

| Tool or surface | Local snapshot / policy |
|---|---|
| `gentle-ai` | Installed at `/opt/homebrew/bin/gentle-ai`, version `2.2.4`. Treat the stack as **degraded**, not failed, while `doctor` still reports issues. |
| `gga` | Earlier audit evidence found `/opt/homebrew/bin/gga` version `2.10.0` with a script syntax error; later same-day terminal evidence reported `2.10.1`. In managed Codex sandboxes, `/opt/homebrew` may be unreadable. Do not patch `/opt` files. |
| `engram` | `/opt/homebrew/bin/engram`, version `1.20.0`. Engram remains the durable memory surface for project context and SDD recovery. |
| Codex CLI | Canonical automation Codex is `/Users/core/.local/bin/codex`. Do not remove or replace the VS Code extension Codex binary. |
| VS Code CLI | `code` is not in `PATH`; the app CLI exists at `/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code`. Do not create a symlink as part of repo remediation. |
| GitHub | `gh` exists at `/opt/homebrew/bin/gh`, but the Codex sandbox cannot read `~/.config/gh/hosts.yml`. Prefer the GitHub connector when available; treat local `gh` as context-dependent. |
| Linear | Linear MCP is configured in Codex and has been verified readable in sessions that expose Linear tools. If a session lacks Linear tools, treat it as a session discovery/auth limitation rather than proof Linear is down. |
| GitHub Actions | `.github/workflows/agentic-pr-checks.yml` is the repo-local minimum PR validation baseline. Vercel/Railway external statuses do not replace it and it does not duplicate deployments. |

## Orchestrator Invocation Policy

- Prefer `/Users/core/.local/bin/codex` for Codex automation launched by local orchestrators.
- Do not use or patch `/opt/homebrew/bin/gga` until the syntax error and Homebrew upgrade path are resolved outside the repo.
- Treat `gentle-ai` availability as degraded while `doctor` reports issues; do not repeat the earlier incorrect diagnosis that `gentle-ai` is missing.
- Use the GitHub connector as the primary GitHub integration in Codex sessions where sandboxed `gh` cannot access its auth host file.
- Keep OpenSpec artifacts and Engram memory separate pending confirmation: `gentle-ai sdd-status` currently reports `artifactStore: openspec` with no active changes, while `openspec/` is absent; legacy specs live under `specs/` and SpecKit assets under `.specify/`. Do not infer Engram-backed active SDD changes from OpenSpec status output.

## Design Decision

Use four layers of automation, each with a narrow responsibility:

| Layer | Responsibility | Why |
|---|---|---|
| Repo-local skills | reasoning-heavy work inside the repo | they encode Shift-specific implementation discipline |
| External orchestrator such as `n8n` | notifications, retries, audit logs, cross-system coordination, and future governance metadata | this is where event choreography belongs after native integrations are exhausted |
| GitHub Actions | deterministic checks, policy enforcement, merge gating, deploy gating | GitHub is the execution authority for PR status and branch protection |
| Humans and governance | approval at risk boundaries | prevents premature full autonomy on architecture, merge, and release |

## Target Workflow

1. Intake agent captures requirements.
2. Agent creates or updates Linear issues.
3. Human reviews and marks each issue `workflow:needs-spec` or `workflow:agent-ready`.
4. `workflow:needs-spec` issues run through `linear-sdd-from-issue`.
5. `workflow:agent-ready` issues run through `linear-implement-agent-ready`.
6. Implementation agent creates/reuses a branch, code changes, validation evidence, and an identifiable result commit, then hands off to an independent completeness audit.
7. If the audit fails, remediation addresses only audited gaps and then runs a new audit.
8. Only after a passing audit for the same commit does `shift-linear-pr` create or update the PR.
9. Humans review the PR.
10. Later, Shift governance approves whether the change may be merged or released.
11. After governance approval plus passing checks, an automation may merge and deploy.
12. Once contracts are mostly frozen, the default automation target becomes app, indexer, docs, ops, and workflow changes rather than frequent contract mutation.

## What Should Live Where

### Repo-local Skills

Skills should own the reasoning-heavy repo workflows:

| Skill | Purpose |
|---|---|
| `linear-development-readiness` | analyze open Linear issues and produce a read-only prioritized execution queue |
| `linear-issue-refiner` | split broad or mixed Linear issues into evidence-backed child issues |
| `linear-sdd-from-issue` | convert one concrete `workflow:needs-spec` issue into a repo-grounded gentle SDD path |
| `linear-implement-agent-ready` | implement one concrete issue in `direct`, `spec-backed`, or `remediation` mode, then hand off for independent audit |
| `linear-implementation-completeness-audit` | independently audit implementation completeness against the issue/spec/result/diff/code/tests before PR publication |
| `shift-linear-pr` | create or update a Shift GitHub PR only after a passing independent audit for the same commit |
| future `governance-release-prep` | prepare release evidence bundle for human and governance review |

Skills should not own cross-system scheduling, webhook handling, secret brokerage, or merge/deploy triggers.

### GitHub Actions

GitHub Actions should own deterministic enforcement:

| Action role | Purpose |
|---|---|
| PR validation | run focused test, lint, type, and compatibility checks |
| branch policy | block merge without issue reference, required labels, and passing checks |
| release gate | verify governance approval record exists before merge or deploy |
| deploy gate | require environment approval, artifact integrity, and successful checks |
| audit trail | emit machine-readable metadata about PR, commit SHA, deploy artifact, and approval state |

GitHub Actions should not decide scope, rewrite issue meaning, or create architecture changes without a human-authored or skill-authored input artifact.

### n8n Or Another Orchestrator

The orchestrator should own event choreography between systems:

| Orchestrator role | Purpose |
|---|---|
| intake routing | receive requirement intake from Hermes or another agent |
| Linear sync | create issues, update comments, attach validation summaries, and map community intake into Linear when native issue sync is insufficient |
| GitHub sync | request reviews, add auxiliary metadata, and coordinate non-native PR automation only where Linear and GitHub do not already cover it |
| approval sync | copy governance approval metadata into GitHub and Linear |
| release coordination | call merge or deploy automation only after all gates are satisfied |

Do not use `n8n` or Hermes to duplicate native Linear/GitHub PR linking or closing. Use them for notifications, retries, audit logs, intake mapping, and future approval choreography that native integrations do not solve.

### Human Gates

The following should remain human-gated in the minimal path:

- classifying issues as `workflow:needs-spec` or `workflow:agent-ready`
- approving spec quality before implementation for high-risk work
- reviewing every PR
- approving any contract change for merge
- approving release to staging or production-like environments
- interpreting governance intent until PR-governance linkage is explicit and trustworthy

### Hermes Or Another Intake Agent

Hermes is best used incrementally:

| Stage | Hermes role |
|---|---|
| MVP | requirement intake and draft Linear issue creation |
| Mid-stage | suggest labels, parents, acceptance criteria, and likely workflow lane |
| Later | create linked issue bundles, trigger the right repo-local skill, and prepare release evidence |
| Future | participate in governance evidence packaging, but not become the final approval authority |

## Required Linear Workflow

Minimal required labels and statuses:

### Labels

- `workflow:needs-spec`
- `workflow:agent-ready`
- phase labels already used in the repo
- `type:feature` or `type:improvement`
- area and domain labels where relevant

### Status expectations

Use existing Linear statuses; do not invent repo-local semantics that Linear cannot represent cleanly.

Recommended semantic flow:

| Status shape | Meaning |
|---|---|
| Backlog | issue exists but is not being actively processed |
| In progress | human or agent is actively refining, specifying, or implementing |
| In review | PR or spec is ready for human review |
| Done | merged, validated, and reflected in docs or release records as required |

Rule: one issue should map to one active implementation run. Do not let one automation take multiple issues in the same execution unless the parent issue explicitly defined a bundled slice.

## Required Branch Naming Rules

Adopt the same convention already encoded in `linear-implement-agent-ready`:

- `feat/SHI-XXX/short-description` for feature issues
- `imp/SHI-XXX/short-description` for improvement issues

Additional rules:

- branch name must include exactly one primary Linear issue ID
- PR title must include the same issue ID
- commit history should keep that issue ID in the subject line or body for traceability

## Required PR Checks

Every PR should prove four things: scope, validation, ownership, and release readiness.

### Always required

- issue ID present in branch name and PR title
- passing required checks
- changed files consistent with issue scope
- summary of tests run
- summary of known blockers or follow-ups

### Surface-specific required checks

| Surface | Required checks |
|---|---|
| Contracts | focused `forge:test`; broader contract suite or coverage gate for high-risk changes |
| Web | focused web unit checks; type or lint checks when touched surface warrants it |
| Indexer | focused unit, integration, or compatibility checks |
| Docs or workflow only | markdown or structural validation if present; otherwise lightweight policy checks |

### Future required policy checks in GitHub Actions

- block PRs without a Linear issue reference
- block PRs that change contract files without contract test evidence
- block PRs that change deploy or authority flow without explicit reviewer approval
- block PRs that modify docs affecting workflow without synchronized status document updates when required

## Mapping PRs To Linear Issues

Use metadata redundancy on top of Linear's native GitHub integration instead of replacing it with custom orchestration.

Required linkage fields:

- branch name contains `SHI-XXX`
- PR title starts with or includes `SHI-XXX`
- PR body includes a dedicated `Linear issue` field, audit evidence, and an explicit closing or non-closing phrase
- Linear issue comment includes PR URL, branch name, files changed, and tests run

GitHub community issues are separate:

- they may be referenced in the PR body as community-facing intake or discussion
- they should not be treated as the internal implementation source of truth
- they should not use GitHub closing words unless intentionally being closed

Recommended PR body template:

```md
## Linear issue
- Issue: `SHI-XXX`

## Closing phrase
- `Completes SHI-XXX` only after a passing audit for the same commit

## Community GitHub issues
- Related GitHub issues: none

## Scope
[single issue scope]

## Files changed
- path

## Tests run
- command

## Risks
- note
```

This gives Linear's native GitHub integration, GitHub Actions, and any future orchestrator multiple ways to verify the link without duplicating authority.

## Mapping Governance Proposals To PRs

There is already repo evidence for proposal composition and timelock-aware action surfaces, but not for PR linkage.

What exists now:

- `ShiftGovernor` and timelock execution for protocol changes
- deploy and authority-mode verification artifacts
- proposal composition and allowlist surfaces in the web app

What does not exist now:

- canonical mapping from proposal ID to PR number
- canonical mapping from proposal ID to git commit SHA
- canonical mapping from governance approval to merge or deploy record

Minimal mapping approach without new contracts:

- store proposal ID in PR body and labels once a governance action exists
- store PR URL and merge commit SHA back in the Linear issue
- store deployment artifact SHA and proposal ID in release comments or release metadata
- let GitHub Actions or the orchestrator verify that all three references exist before merge/deploy

This is sufficient for an operational system, but it is not trust-minimized.

## Do We Need A New Smart Contract?

Not for the minimal viable automation path.

Reason:

- GitHub Actions and an orchestrator can safely enforce process checks such as issue linkage, PR checks, human review, and deploy sequencing.
- The repo already has on-chain governance for protocol state and off-chain operational control for source-code workflow.
- Introducing a new contract too early would add operational complexity before the social and workflow contract is stable.

### When A New Contract Becomes Justified

A new minimal contract becomes justified only when Shift wants governance approval to authorize a specific software artifact, not just a human intention to merge or release.

The smallest useful future contract would be a release approval registry, not a general PR registry.

Possible minimal responsibility:

- record `proposalId -> repo, PR number, merge commit SHA, artifact digest, environment, approval state`
- emit events when a specific artifact digest is governance-approved for merge or deploy
- allow GitHub Actions or the orchestrator to prove that the released artifact matches the approved digest

Why Actions and `n8n` alone cannot fully replace that future contract:

- they can correlate metadata, but they cannot create an on-chain canonical, replayable approval record for a specific git or build artifact
- they are operationally trusted systems, not governance-truth systems

Recommendation: do not build this contract until contract development is mostly frozen and governance really needs artifact-level release approval.

## Minimal Viable Automation Path

Phase 1 should avoid any new contract and avoid autonomous merge or deploy.

### MVP sequence

1. Hermes or another intake agent drafts Linear issues.
2. Human reviews and assigns `workflow:needs-spec` or `workflow:agent-ready`.
3. Orchestrator launches either `linear-sdd-from-issue` or `linear-implement-agent-ready`.
4. Implementation agent creates/reuses a branch, makes code changes, runs tests, and produces an identifiable result commit.
5. Independent completeness audit runs in a separate Codex session/thread and reviews the implementation result against the same issue/spec and commit.
6. Remediation runs only for audited gaps, followed by a new audit when needed.
7. `shift-linear-pr` creates or updates the PR only after the audit passes for the current HEAD.
8. GitHub Actions run required validation checks.
9. Human reviews PR and decides whether it is acceptable.
10. Human merges manually.
11. Human runs or approves deploy manually.

### MVP automation ownership

| Step | Owner |
|---|---|
| Intake and issue drafting | Hermes or orchestrator |
| Lane assignment | human |
| Spec or implementation execution | repo-local skill |
| Independent completeness audit | `linear-implementation-completeness-audit` repo-local skill |
| PR checks | GitHub Actions |
| Merge | human |
| Deploy | human |

This path is realistic now and requires no new contract work.

## Full Future Automation Path

After the manual path is stable, Shift can expand automation in stages.

### Stage 2

- orchestrator auto-updates Linear on PR creation and review state
- GitHub Actions enforce issue linkage and surface-specific validation policies
- human review remains mandatory

### Stage 3

- governance approval becomes a required input for merge on selected branches or repos
- orchestrator syncs proposal IDs and release metadata into GitHub and Linear
- deploy remains approval-gated

### Stage 4

- for app, indexer, docs, and ops changes, merge can become automated after human review plus policy checks
- for contract changes, merge stays explicitly human-controlled unless a future artifact-approval registry exists

### Stage 5

- optional on-chain release approval registry binds proposal IDs to artifact hashes for governance-authorized merges or deploys
- deploy automation verifies artifact hash equality before execution

## Required GitHub Permissions And Safety Boundaries

Use separate credentials per automation role.

### Intake or Linear sync bot

- no repo write required unless it comments on PRs
- should not have merge or deployment rights

### Implementation bot

- `contents:write` when commits are allowed
- `metadata:read`
- no PR publication permission in normal implementation mode

Must not have:

- admin rights
- environment approval bypass
- secret management rights

### Merge or release bot

- `contents:write` for merge
- `pull_requests:write`
- `actions:read`
- `deployments:write` only if GitHub deploy environments are used
- `id-token:write` only if cloud deploy auth requires OIDC

Must be isolated from the implementation bot.

### Safety boundaries

- protect main and release branches
- require human review on all PRs
- require passing checks before merge
- require environment approval before deploy
- forbid direct pushes to protected branches by bots
- log every automated state transition back to Linear or GitHub comments

## Security Risks And Mitigations

| Risk | Why it matters | Mitigation |
|---|---|---|
| Over-privileged bot token | one compromise can push, merge, and deploy | separate credentials by role; least privilege |
| Wrong issue classification | agent implements something that needed spec or human design review | keep human lane assignment mandatory in early stages |
| Scope drift during implementation | agent touches unrelated surfaces | use single-issue workflow skills and PR diff review |
| False green validation | automation runs the wrong checks or too-broad checks are skipped | encode surface-specific required checks in Actions |
| PR-governance mismatch | governance approves an idea, but a different artifact gets merged | keep merge human-gated until metadata linkage is reliable; later use artifact-level registry if needed |
| Contract churn under automation | repeated autonomous contract changes create governance or security regressions | treat contract work as high-friction, high-review, mostly frozen after launch |
| Orchestrator replay or duplicate triggers | duplicate PRs, duplicate issue updates, or conflicting state | require idempotent run keys based on issue ID plus workflow stage |
| Silent failure between Linear and GitHub | issue and PR state drift apart | orchestrator should reconcile both systems and emit visible failure comments |

## Recommended Increment Order

1. Document the workflow and adopt the repo-local workflow skills as the reasoning layer.
2. Add GitHub Actions for validation and PR policy enforcement.
3. Use `linear-implementation-completeness-audit` as the PR publication gate; the readiness analyzer now exists as `linear-development-readiness`.
4. Add orchestrator flows for Linear status sync and PR metadata sync.
5. Keep merge and deploy human-gated.
6. Later add governance approval metadata to release flow.
7. Only after the release process is stable, consider a minimal release approval registry contract.

## Repo Evidence Used For This Plan

- `AGENTS.md` — active repo workflow, strict TDD map, and safety rules
- `.github/skills/linear-development-readiness/SKILL.md` — read-only backlog readiness and execution-queue workflow
- `.github/skills/linear-issue-refiner/SKILL.md` — issue refinement workflow
- `.github/skills/linear-sdd-from-issue/SKILL.md` — issue-to-spec workflow
- `.github/skills/linear-implement-agent-ready/SKILL.md` — issue-to-implementation workflow
- `.github/skills/linear-implementation-completeness-audit/SKILL.md` — independent implementation completeness audit workflow
- `.github/project-management/IMPLEMENTATION_STATUS.md` — tactical backlog and definition-of-done expectations
- `.github/project-management/STATUS_REVIEW.md` — strategic governance, authority, and workflow baseline
- `docs/permission-matrix.md` — authority-mode and timelock-surface evidence
- `contracts/core/ShiftGovernor.sol` — on-chain proposal execution authority
- `apps/web/lib/deploy/factory-step-executor.ts` — deploy and authority-mode orchestration surface

## Immediate Next Step

Do not automate merge or deploy first. The safest next implementation step is to add GitHub Actions for deterministic PR checks and basic issue-to-PR policy enforcement, while keeping the repo-local skills and human lane assignment as the source of decision quality.
