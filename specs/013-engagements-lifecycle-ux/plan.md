# Implementation Plan: Engagements Rich Lifecycle UX

**Branch**: `[013-engagements-lifecycle-ux]` | **Date**: 2026-04-12 | **Spec**: /Users/core/Code/shift/specs/013-engagements-lifecycle-ux/spec.md
**Input**: Feature specification from /Users/core/Code/shift/specs/013-engagements-lifecycle-ux/spec.md

## Summary

Deliver a complete transaction-capable Engagement vertical slice in Manager with strict community scoping, active Valuable Action enforcement, structured evidence capture, real on-chain submission, deterministic post-submit routing, and truthful lifecycle/readiness visibility. The submit flow uses the deployed Engagements write surface with no placeholder persistence and no shadow authority. Default delivery path is no contract ABI/event changes.

## Technical Context

**Language/Version**: TypeScript (apps/web, apps/indexer), Solidity ^0.8.24 (reference-only unless blocker), Node 22  
**Primary Dependencies**: Next.js 16, React 19, wagmi + viem, Ponder 0.7.17, GraphQL, OpenZeppelin 5.x ABIs already synced in web/indexer  
**Storage**: Canonical on-chain state + projected indexer state + IPFS evidence payloads  
**Testing**: Vitest (web), Ponder/indexer integration tests, Foundry tests only if contract touch is unavoidable  
**Target Platform**: Base Sepolia staging with community module address resolution from deployed registry/modules
**Project Type**: Monorepo vertical slice (Manager + indexer + docs; contracts conditional)  
**Performance Goals**: Submit state transition feedback within one wallet round-trip; list/detail load under 2s p95 on healthy projection  
**Constraints**: No shadow engagement creation; exact community boundary enforcement; active Valuable Action only; no authority bypass; no speculative protocol behavior  
**Scale/Scope**: Community-scoped Engagement list/detail/create for first complete functional slice, compatible with shared Valuable Action semantics

## Constitution Check (Pre-Research)

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Protocol infrastructure first: **PASS**. No engagement-specific policy is moved into protocol; UX consumes existing primitives.
- Contract-first authority: **PASS**. Submit path is direct contract write only; indexer/UI remain derived/read orchestration.
- Security/invariant preservation: **PASS**. Timelock and role model unchanged; submit constraints come from deployed contract checks.
- Event/indexer discipline: **PASS**. No ABI/event changes planned; projection relies on existing Engagement events.
- Monorepo vertical-slice scope: **PASS**. Plan includes web submit/list/detail, indexer projection/readiness, tests, docs sync.
- Project-management docs sync: **PASS**. Requires synchronized updates when shipped behavior changes status/risk/workflow statements.
- Compatibility discipline: **PASS**. Default additive app/indexer changes; no breaking interface/event changes expected.

## Project Structure

### Documentation (this feature)

```text
specs/013-engagements-lifecycle-ux/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── engagements-lifecycle.graphql
│   └── engagements-lifecycle.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
contracts/modules/
apps/indexer/src/
apps/indexer/schema/
apps/web/app/engagements/
apps/web/components/engagements/
apps/web/hooks/
apps/web/lib/graphql/
apps/web/lib/valuable-actions/
apps/web/tests/unit/
docs/EN/
.github/project-management/
```

**Structure Decision**: Implement as no-ABI first using existing Engagements and ValuableActionRegistry interfaces. Apply most changes in apps/web and apps/indexer, with contract changes gated behind proven blocker only.

## Monorepo Impact Matrix

| Layer | Impacted? | Paths | Contract / Event / API Compatibility Notes |
|-------|-----------|-------|--------------------------------------------|
| Protocol Contracts | Conditional | contracts/modules/Engagements.sol, contracts/modules/ValuableActionRegistry.sol, test/*.t.sol | Default no changes. Contract touch only if blocker proven. |
| Indexer (Ponder) | Yes | apps/indexer/src/index.ts, apps/indexer/schema/engagements.ts, apps/indexer/ponder.schema.ts | Consume existing EngagementSubmitted/JurorsAssigned/EngagementResolved events; may add additive readiness endpoints for engagements. |
| Manager App (Next.js) | Yes | apps/web/app/engagements/**, apps/web/components/engagements/**, apps/web/lib/graphql/queries.ts, apps/web/lib/valuable-actions/** | Replace placeholder inputs with active-VA constrained flow; preserve real tx path and deterministic routing. |
| Downstream dApp Surface | Yes | GraphQL query additions and indexer REST additive endpoints | Additive only; avoid breaking existing claim/engagement consumers. |
| Documentation | Yes | docs/EN/**, contracts/FEATURES.md, neuromancer/SHIFT_SYSTEM.md, .github/project-management/** | Required if shipped behavior/readiness semantics change from current docs. |

## Design Anchors And Expected Touched Files

- Existing submit UI anchor: apps/web/components/engagements/engagement-submit-form.tsx
- Existing list/detail anchors: apps/web/components/engagements/engagement-list.tsx and apps/web/components/engagements/engagement-detail.tsx
- Existing route anchors: apps/web/app/engagements/page.tsx and apps/web/app/engagements/[engagementId]/page.tsx
- Existing Valuable Action compatibility helper: apps/web/lib/valuable-actions/engagement-compat.ts
- Existing Engagement projection/event handlers: apps/indexer/src/index.ts and apps/indexer/schema/engagements.ts
- Existing query contract anchor: apps/web/lib/graphql/queries.ts

## Data Model And Transaction State Model

- Data entities and lifecycle transitions are defined in data-model.md.
- Transaction state model is explicit and finite:
  - draft: user editing evidence payload inputs
  - payload_ready: structured evidence validated and CID available
  - awaiting_wallet: wallet prompt open, no hash yet
  - hash_received: tx hash available, confirmation pending
  - confirmed_identity_resolved: receipt confirmed and engagementId decoded
  - confirmed_identity_pending: receipt confirmed but engagementId not yet decoded (retry recovery only)
  - failed_wallet: user rejected or wallet failure
  - failed_chain: wrong network or switch rejected
  - failed_revert: on-chain revert returned

## Exact Submit Write-Path Design

- Canonical write call: Engagements submit with payload (typeId, evidenceCID) on community-scoped engagements module address.
- Deployed function target: Engagements.submit(uint256 typeId, string evidenceCID).
- Step model:
  1. Pre-transaction evidence build and upload (off-chain preparation, not persistence of engagement).
  2. Single on-chain write transaction calling submit.
- Transaction count for Engagement creation: one on-chain transaction.
- No draft/create placeholder record is persisted before tx success.
- Active Valuable Action and community constraints are checked pre-submit in UI and enforced again by contract at write time.

## Engagement Identity Recovery Strategy

- Primary strategy (deterministic): decode EngagementSubmitted from transaction receipt logs using Engagements ABI and module address.
- Extracted canonical identity: engagementId plus typeId/participant/evidenceCID from the emitted event.
- Verification step: optional immediate read of getEngagement(engagementId) to confirm existence and expected values before routing.
- Route target on success: community-scoped detail route with engagementId.
- Recovery fallback:
  - retry receipt-log decode from public client for same tx hash,
  - if still unresolved, keep user on explicit identity-recovery state with tx hash and retry action,
  - do not create optimistic/local engagement ID.

## Post-Submit Truth Model (Chain vs Projection)

- Immediate canonical truths from chain (same session): tx hash, block number, decoded engagementId, initial submitted status.
- Projected truths from indexer (eventually consistent): list visibility, juror assignments, resolved/revoked status updates, enriched timestamps.
- UI representation rules:
  - if chain-confirmed and indexer lagging, show chain-confirmed submission with readiness warning,
  - do not claim indexer-derived fields until available,
  - keep lifecycle label truthful: pending verification until resolved/revoked events are indexed.

## List/Detail/Readiness Strategy

- List:
  - filter by selected community only,
  - include engagement ID, valuableActionId, participant, status, submittedAt, readiness signal.
- Detail:
  - requires community boundary validation,
  - shows canonical identifiers and evidence reference immediately after submit,
  - merges projected juror/resolution data when available.
- Readiness:
  - expose engagement-readiness state aligned with existing valuable-action readiness pattern,
  - statuses: healthy, lagging, unavailable,
  - used to explain projection delays without masking confirmed chain success.

## Failure-Mode Mapping Strategy

- Wallet rejected / user canceled -> failed_wallet with resubmit option.
- Wrong chain / switch denied -> failed_chain with required chain guidance.
- Contract revert invalid action active state -> blocked_by_inactive_action.
- Contract revert community mismatch -> blocked_by_community_boundary.
- Contract revert cooldown -> blocked_by_cooldown with retry timing guidance.
- Contract revert max concurrent -> blocked_by_max_concurrent.
- Contract revert insufficient jurors selected -> blocked_by_verifier_capacity.
- IPFS upload failure before tx -> payload_build_failed; no tx attempted.
- Receipt confirmed but identity not decoded -> identity_pending_recovery; no fake route.

## Test Strategy

- Web unit/integration:
  - active Valuable Action picker and community-boundary guard,
  - transaction state machine transitions,
  - revert/wallet/wrong-chain mapping to user-facing states,
  - deterministic route after decoded engagement identity.
- Indexer tests:
  - EngagementSubmitted projection creation and community keying,
  - lifecycle updates from EngagementResolved/EngagementRevoked,
  - readiness response in healthy/lagging/unavailable conditions.
- Contract tests (conditional only):
  - only if contract changes become necessary after blocker proof.

## Compatibility And Migration Notes

- Default path: no ABI/event changes, no migration required.
- If indexer schema/query shape expands, changes must be additive and replay-safe.
- If any ABI/event change is forced by blocker, include explicit replay/backfill and downstream compatibility section before implementation starts.

## Documentation And Status Sync Rules

- If shipped behavior changes Engagement submission/lifecycle UX:
  - update docs/EN Architecture and Verification layer docs,
  - update contracts/FEATURES.md and neuromancer/SHIFT_SYSTEM.md.
- If implementation status/risk/workflow expectations change:
  - update .github/project-management/IMPLEMENTATION_STATUS.md and
  - update .github/project-management/STATUS_REVIEW.md
  in the same change set.

## Phase 0: Research Plan

Research decisions captured in research.md:

1. Exact deployed submit path and transaction count.
2. Deterministic engagement identity recovery strategy.
3. Chain truth vs projection truth and readiness policy.
4. Failure-mode normalization for wallet/chain/revert conditions.
5. No-ABI-first compatibility strategy.

## Phase 1: Design Outputs

1. data-model.md
2. contracts/engagements-lifecycle.graphql
3. contracts/engagements-lifecycle.openapi.yaml
4. quickstart.md

## Agent Context Update

Run after design outputs:

```bash
.specify/scripts/bash/update-agent-context.sh copilot
```

## Constitution Check (Post-Design)

- Protocol infrastructure first: **PASS**. Design remains a consumer-layer implementation over deployed Engagement and Valuable Action protocol primitives.
- Contract-first authority: **PASS**. Submit/identity source is chain events; indexer and UI remain non-authoritative.
- Security/invariant preservation: **PASS**. No new privileged path or authority bypass introduced.
- Event/indexer discipline: **PASS**. Existing events are sufficient for first functional slice; additive projection only.
- Monorepo vertical-slice scope: **PASS**. Contracts (conditional), indexer, app, tests, docs are explicitly planned.
- Project-management docs sync: **PASS**. Included as delivery gate.
- Compatibility discipline: **PASS**. No breaking interface required in default path.

## Complexity Tracking

No constitution violations require exception handling for this planning phase.
