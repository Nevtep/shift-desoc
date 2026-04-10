# Implementation Plan: Direct Proposal Creation

**Branch**: `011-direct-proposal-creation` | **Date**: 2026-04-10 | **Spec**: /Users/core/Code/shift/specs/011-direct-proposal-creation/spec.md
**Input**: Feature specification from /Users/core/Code/shift/specs/011-direct-proposal-creation/spec.md

## Summary

Add a direct proposal creation path in community governance that submits composer-produced action bundles straight to `ShiftGovernor` (`propose` / `proposeMultiChoice`) without using `DraftsManager.escalateToProposal`. Reuse existing allowlist-gated guided/expert composer logic, enforce exact community-to-governor scoping, recover `proposalId` from transaction outcomes deterministically, and route users to proposal detail or list fallback under indexer lag while keeping draft escalation unchanged.

## Technical Context

**Language/Version**: TypeScript (Node 22), React 19 + Next.js 16 app layer  
**Primary Dependencies**: wagmi, viem (`encodeFunctionData`, `decodeEventLog`), existing community module hooks, GraphQL query hooks, existing action composer libs  
**Storage**: N/A (on-chain writes + GraphQL/indexer reads; no new persistent storage)  
**Testing**: Vitest + Testing Library + MSW unit tests in `apps/web/tests/unit/**`  
**Target Platform**: Web Manager app (`apps/web`) with Base Sepolia-oriented staging network defaults  
**Project Type**: Monorepo web feature (contracts/indexer primarily compatibility-validated)  
**Performance Goals**: UI submit flow remains interactive and deterministic; post-submit routing resolves within existing UX tolerances (single tx confirmation cycle)  
**Constraints**: No contract source edits unless hard blocker; strict allowlist/no heuristic widening; exact community-governor context; preserve draft escalation behavior; indexer-first with safe chain fallback  
**Scale/Scope**: Community-scoped governance submit flow plus related routes/components/tests/docs in `apps/web`

## Constitution Check (Pre-Phase 0)

Gate status: PASS

- Protocol infrastructure first: PASS. No protocol primitive redesign; feature is Manager UX/write-path integration over existing governor APIs.
- Contract-first authority: PASS. Authority remains on-chain (`ShiftGovernor` / Timelock); app validates and submits but never asserts shadow permissions.
- Security/invariant preservation: PASS. No bypass of Governor -> Timelock model; allowlist and community-governor binding are explicit pre-submit guards.
- Event/indexer discipline: PASS. No contract/event changes expected; proposal detail/list handling includes indexer lag fallback and no replay migration.
- Monorepo vertical-slice scope: PASS. Plan includes Manager write/read path, tests, and docs sync checks; contracts/indexer compatibility reviewed.
- Project-management docs sync: CONDITIONAL. If shipped behavior/status wording changes, sync both `.github/project-management/IMPLEMENTATION_STATUS.md` and `.github/project-management/STATUS_REVIEW.md`.
- Compatibility discipline: PASS. Existing proposal list/detail and draft escalation remain backward compatible; no ABI/event breaking changes targeted.

## Concrete Design Anchors

### A) Existing Submit/Recovery Patterns To Reuse

- Draft escalation tx + receipt parsing + routing fallback:
  - `apps/web/components/drafts/draft-detail.tsx`
- Proposal list/detail routes and community scoping:
  - `apps/web/app/communities/[communityId]/governance/proposals/page.tsx`
  - `apps/web/app/communities/[communityId]/governance/proposals/[proposalId]/page.tsx`
- Proposal read UI + indexer/readiness fallback conventions:
  - `apps/web/components/governance/proposal-list.tsx`
  - `apps/web/components/governance/proposal-detail.tsx`

### B) Composer Source Of Truth

- Reuse existing guided/expert allowlist-constrained action bundle logic from:
  - `apps/web/components/drafts/draft-create-form.tsx`
  - `apps/web/lib/actions/allowlist.ts`
  - `apps/web/lib/actions/guided-templates.ts`
  - `apps/web/lib/actions/expert-functions.ts`
  - `apps/web/lib/actions/target-resolution.ts`
  - `apps/web/lib/actions/registry.ts`

No parallel composer implementation is allowed; new direct-proposal UI composes from the same canonical payload model (targets, values, calldatas, description).

### C) Governance Context Resolution

- Resolve modules by community through existing registry/module hooks.
- Hard gate submit if:
  - communityId invalid,
  - governor module absent,
  - chain/network mismatched,
  - action bundle fails allowlist checks,
  - UI context/governor context drift detected.

### D) Proposal Write Path

- Binary proposal path: `ShiftGovernor.propose(targets, values, calldatas, description)`.
- Multi-choice path (when selected): `ShiftGovernor.proposeMultiChoice(targets, values, calldatas, description, numOptions)`.
- Block duplicate submits with pending-state lock and idempotent UI behavior.

### E) proposalId Recovery Strategy

Ordered strategy after tx confirmation:
1. Parse `ProposalCreated` / `MultiChoiceProposalCreated` logs from governor ABI.
2. If unavailable, compute deterministically via `getProposalId`/`hashProposal` using submitted payload and description hash (read call).
3. If still unresolved, store tx hash and route with lag context to community proposals list.

### F) Routing Fallback Strategy

- Primary: `/communities/[communityId]/governance/proposals/[proposalId]`.
- Secondary: `/communities/[communityId]/governance/proposals?indexLag=1&txHash=...`.
- Never route outside selected community scope.
- Preserve success context text so user can safely retry navigation without resubmission.

### G) Community Overview Activation

- Enable proposals create CTA in overview activity model once route exists.
- Keep exact route contract (`/communities/[id]/governance/proposals/new`) from existing routing allowlist tests.

### H) Touched Files (Planned)

- New route page for direct creation:
  - `apps/web/app/communities/[communityId]/governance/proposals/new/page.tsx`
- New or extracted reusable proposal composer/submit component(s):
  - likely under `apps/web/components/governance/`
- Shared submit helpers:
  - likely under `apps/web/lib/governance/`
- Overview activity enablement:
  - `apps/web/hooks/useCommunityOverviewActivity.ts`
- Tests:
  - `apps/web/tests/unit/components/governance/**`
  - `apps/web/tests/unit/routes/**`
  - `apps/web/tests/unit/community-overview/**`

## Project Structure

### Documentation (this feature)

```text
specs/011-direct-proposal-creation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── direct-proposal-intent.schema.json
│   ├── proposal-creation-result.schema.json
│   └── proposal-routing-state.schema.json
└── tasks.md  # generated later by /speckit.tasks
```

### Source Code (repository root)

```text
apps/web/app/communities/[communityId]/governance/proposals/
apps/web/components/governance/
apps/web/hooks/
apps/web/lib/actions/
apps/web/lib/governance/
apps/web/tests/unit/components/governance/
apps/web/tests/unit/routes/
apps/web/tests/unit/community-overview/
docs/
neuromancer/
contracts/FEATURES.md
```

**Structure Decision**: Implement as a Manager vertical slice using existing composer + governance read/write primitives. No protocol/indexer schema modifications are planned; compatibility is enforced through tests and routing behavior.

## Monorepo Impact Matrix

| Layer | Impacted? | Paths | Contract / Event / API Compatibility Notes |
|-------|-----------|-------|--------------------------------------------|
| Protocol Contracts | No (expected) | `contracts/**` | No source/interface/event change unless explicit hard blocker is documented |
| Indexer (Ponder) | No (expected) | `apps/indexer/**` | Reuse existing proposal projections; lag handled in app routing |
| Manager App (Next.js) | Yes | `apps/web/app/**`, `apps/web/components/**`, `apps/web/hooks/**`, `apps/web/lib/**` | Adds direct governor submit path; preserves existing draft escalation path |
| Downstream dApp Surface | Yes (read UX) | governance route contract under `apps/web/app/communities/**` | Community-scoped proposal routes preserved; no new external API contract required |
| Documentation | Yes (conditional) | `docs/**`, `neuromancer/SHIFT_SYSTEM.md`, `contracts/FEATURES.md`, project-management status docs | Update only if shipped behavior/status text changes |

## Phase 0: Research Plan

Research tasks (resolved in `research.md`):
1. Direct proposal method selection (`propose` vs `proposeMultiChoice`) under current composer output.
2. Canonical proposalId recovery order from tx receipt + deterministic read fallback.
3. Resilient post-submit routing behavior under indexer lag without duplicate submission.
4. Pre-submit guard model for exact community/governor context and allowlist conformance.
5. Duplicate-submit prevention and state preservation strategy for reject/revert outcomes.

## Phase 1: Design Plan

Design outputs:
1. `data-model.md` entity/state model for direct proposal flow.
2. JSON schemas in `contracts/` for intent/result/routing contracts.
3. `quickstart.md` implementation and validation sequence.

Design commitments:
- Reuse existing action composer bundle semantics unchanged.
- Keep indexer-first reads with chain fallback only for routing/recovery.
- Preserve and regression-test draft escalation UX and behavior.

## Phase 2: Implementation Planning (for /speckit.tasks)

Planned work packages:
1. Add community-scoped proposal create route and page shell.
2. Extract/reuse composer logic for direct-governor submission.
3. Implement governor submit helper + proposalId recovery chain.
4. Implement routing fallback and success/error messaging model.
5. Enable community overview proposals create CTA.
6. Add/refresh unit tests for success, lag fallback, reject, revert, mismatch, and duplicate submit lock.
7. Run regression tests for draft escalation unchanged behavior.
8. Update docs/status files conditionally per DT-001/DT-003.

## Constitution Check (Post-Phase 1 Design)

Gate status: PASS

- Protocol infrastructure first: PASS. All behavior remains in Manager layer; protocol untouched.
- Contract-first authority: PASS. Submit path is direct governor call with no app-side authority override.
- Security/invariant preservation: PASS. Governance pathway and allowlist constraints preserved; no timelock bypass.
- Event/indexer discipline: PASS. No event mutations; lag fallback explicitly designed.
- Monorepo vertical-slice scope: PASS. App + tests + docs + compatibility checks included.
- Project-management docs sync: PASS with conditional sync rule retained.
- Compatibility discipline: PASS. Existing routes and draft escalation remain supported.

## Complexity Tracking

No constitution violations requiring justification.
