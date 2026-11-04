# Shift Agent Workflow

This repository uses **gentle-ai ODD** (Organic Driven Development) with **RDD** (receipt-driven native review) as the active workflow for new work. gentle-ai v4 retired SDD and all of its commands; do not plan around them.

## Workflow Authority

Source-of-truth hierarchy for planning and delivery:

1. Smart contract behavior and emitted events
2. Module wiring, deploy scripts, and access-role configuration
3. `.github/project-management/STATUS_REVIEW.md` and `.github/project-management/IMPLEMENTATION_STATUS.md`
4. Active repo guidance in `.github/copilot-instructions.md` and this file
5. Selected Linear issues refined through ODD feature documents and execution
6. `docs/EN/**` and historical specs as reference only unless cross-checked against the layers above

## Active Planning Workflow

- Linear is the backlog and prioritization system.
- Repo-local skill `.github/skills/linear-development-readiness/SKILL.md` is the read-only workflow for ranking open Shift issues and selecting the next safe execution queue without mutating Linear.
- Selected Linear issues are planned through ODD before implementation: small tasks go inline with no artifacts; large tasks (including every `workflow:needs-spec` issue) get an ODD feature document.
- Repo-local skill `.github/skills/linear-issue-refiner/SKILL.md` is the focused workflow for reshaping one broad Shift Linear issue into evidence-backed vertical Feature issues (see "Backlog Shape").
- Repo-local skill `.github/skills/linear-odd-from-issue/SKILL.md` is the focused workflow for turning one concrete `workflow:needs-spec` Linear issue into a repo-grounded ODD feature document `odd/tasks/<feature-name>.md` plus its Engram mirror.
- Repo-local skill `.github/skills/linear-implement-agent-ready/SKILL.md` is the focused workflow for implementing one concrete Linear issue through branch, code changes, validation, and audit handoff; PR creation waits for an independent completeness audit in a separate session/thread.
- Repo-local skill `.github/skills/linear-implementation-completeness-audit/SKILL.md` is the read-only, separate-session workflow for auditing implementation completeness against Linear/ODD document/result/diff/code/tests before PR publication.
- Repo-local skill `.github/skills/shift-linear-pr/SKILL.md` is the focused workflow for creating or updating Shift GitHub PRs only after an independent separate-session audit passes for the same commit, using Linear as the internal source of truth and Linear's native GitHub integration for linking and closing.
- Hermes-native supervisor skills are versioned under `hermes-bootstrap/skills/` and loaded by Hermes from that repo path; do not treat `.github/skills/` as a Hermes skill root.
- Engram stores durable project memory, testing capabilities, ODD feature-document mirrors, and lessons.
- Agents must recover Engram context before planning or editing architecture-sensitive surfaces.
- New work should follow ODD + RDD rather than repo-local SpecKit flows or the retired gentle SDD flow.
- SpecKit artifacts in `.specify/`, `.github/prompts/speckit.*`, `.github/agents/speckit.*`, and related playbooks are legacy/reference only unless a task explicitly requires historical context.
- Future audit targets must be grounded in real repo architecture and implemented module groups. Do not invent new vertical taxonomy from product vision alone.

## Backlog Shape (Linear projects "Shift Manager" and "Shift Protocol")

- Team SHI holds one project per surface: **Shift Protocol** (Solidity, wiring, roles, deploys; every `domain:contracts` issue), **Shift Manager** (Manager app and indexer), **Shift Marketing** (website) and one `App: <name>` project per ecosystem app. The readiness skill ranks Shift Manager and Shift Protocol.

- Milestones are the roadmap phases (Phase 0 → 6). Agents work the lowest open phase first; within a phase, Linear priority ranks the work. Every open issue has a milestone and a priority.
- **One issue = one testable feature.** A `Feature` is one contract capability delivered as a vertical slice: contract calls → indexer projection/endpoints → Manager route or wizard → a `QA: how to test (Base Sepolia)` section an admin can run. Projections, read models, schemas and hooks are tasks inside the Feature that needs them (ODD `T#` items), never issues of their own. `Improvement` adjusts an existing feature; `Bug` is a defect.
- Labels: type (`Feature` | `Improvement` | `Bug`), readiness (`workflow:agent-ready` small and directly implementable | `workflow:needs-spec` medium/large, ODD document first | `workflow:backlog` not yet refined), and `domain:contracts` for anything that changes Solidity (skipped by the autonomous loop unless `SHIFT_ALLOW_CONTRACT_ISSUES=true`). `type:*`, `area:*` and `phase:*` are retired.
- Delivery is one Feature per branch and PR (`feat/SHI-XXX/...` or `imp/SHI-XXX/...`), implemented as work-unit commits from the ODD document when one exists. Issues are not bundled into one PR; a PR that is too small to be a feature means the issue was split wrong — fix the issue, not the PR policy.

## ODD Feature Documents

- Locator: `odd/tasks/<feature-name>.md`, mirrored in Engram (project `shift-desoc`) under topic `odd/<feature-name>/tasks`. For Linear work, `<feature-name>` is `shi-<number>-<short-slug>` so one issue maps to exactly one document.
- Structure: objective, problem, scope, non-goals, Spec items `S1..Sn` (testable requirements and acceptance criteria), tasks `T1..Tn` that cite the Spec items they satisfy, checks (validation commands), open questions, and an append-only `## Log` of decisions, progress, and verification evidence.
- The repo file and the Engram mirror must say the same thing; update both together. If they disagree, stop and reconcile before planning or implementing.
- Implementation lands as work-unit commits: each commit is one coherent, validated task (or tightly coupled task group) and is recorded against its `T#` in the `## Log`.
- Every change closes with a `Risk:` line (tier plus the reason). An independent ODD verifier runs when a high-risk item fires; in Shift, contracts, authority/role wiring, ParamController policy, treasury paths, deploy flows, and indexer event compatibility are always high-risk.
- The ODD verifier and native review never replace the mandatory separate-session `linear-implementation-completeness-audit` before PR publication.

## Native Review (RDD)

- Native review runs through `gentle-ai review assess|start|status`; it is on by default.
- Review mode is user-owned: only the user toggles it with `gentle-ai review mode enable|disable|status`. Agents may read `gentle-ai review mode status` but must not enable or disable it.
- Implementers record the review outcome (or that review mode is off) as evidence in their result; reviewer findings are fixed in scope before the result commit is marked audit-ready.

## Strict TDD And Validation

Strict TDD is active (test-first is the gentle-ai v4 default): write or update the failing test before the change, then make it pass.

Known validation map:

- Contracts: `pnpm forge:test`, `pnpm forge:cov`, `pnpm cov:gate`
- Web unit: `pnpm --filter @shift/web test:unit`
- Web e2e scaffold: `pnpm --filter @shift/web test:e2e`
- Indexer unit: `pnpm --filter @shift/indexer run test:unit`
- Indexer integration: `pnpm --filter @shift/indexer run test:integration`
- Indexer compatibility: `pnpm --filter @shift/indexer run check:events`, `pnpm --filter @shift/indexer run check:compat`

Agents must choose the narrowest validating command for the surface they change and run it before widening scope.

## Safety Rules

- Preserve governance and treasury invariants: staged authority lifecycle, ParamController as policy source, no verifier staking/bonding, TreasuryAdapter guardrails, and separation of commerce disputes from work verification.
- Do not flatten Shift into always timelock-only or always deployer-admin; preserve admin-managed staging and governance-managed handoff as distinct lifecycle phases.
- When authority details matter, preserve the real GovernorTimelockAccess plus AccessManager wiring instead of simplifying to generic owner-only or timelock-only language.
- Treat ParamController as shared multi-community policy infrastructure keyed by `communityId`; do not introduce module-local shadow config unless explicitly justified.
- Preserve current Shift terminology and keep contracts, indexer projections, Manager UX, tests, and docs synchronized when behavior changes.
- Do not bypass contract authority with indexer or app-side shadow logic.
- Do not edit application code, contracts, indexer mappings, or deploy flows without recovering current Engram context first.
- Treat the Manager app and indexer as derived operational layers over canonical on-chain behavior.
- Missing UI buttons, placeholder pages, hooks, route existence, or indexer tables do not prove or disprove on-chain capability.
- Treat old scripts, docs, generated assets, and legacy specs as non-canonical until verified against live contracts, tests, and deploy wiring.
- RevenueRouter is pull-based accounting and allocation, not automatic push distribution.
- TreasuryAdapter validates policy and builds Safe-ready payloads; it is not a treasury wallet or spend executor.
- Never commit secrets, private keys, or hardcoded deployment addresses.

## Legacy Policy

SpecKit and gentle SDD are no longer the active workflow for new work in this repository.
Legacy SpecKit files remain for historical and technical reference, and may still help explain prior specs, but they must not be treated as the default operating path for new planning or implementation.
