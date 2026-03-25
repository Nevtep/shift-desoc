# Implementation Plan: Indexer Dynamic Multi-Community Discovery

**Branch**: `007-indexer-community-discovery` | **Date**: 2026-03-25 | **Spec**: `/Users/core/Code/shift/specs/007-indexer-community-discovery/spec.md`
**Input**: Feature specification from `/Users/core/Code/shift/specs/007-indexer-community-discovery/spec.md`

## Summary

Refactor `apps/indexer` from static single-stack contract addresses to CommunityRegistry-driven dynamic discovery across all community module contracts using Ponder `factory()` sources. Add deterministic emitter-to-community attribution windows, rotation-safe mapping, replay/idempotency guarantees, unmapped-emitter telemetry, and integration tests proving discovery, attribution, and replay correctness.

## Technical Context

**Language/Version**: TypeScript (Node 22 runtime)  
**Primary Dependencies**: `@ponder/core@0.7.17`, `viem`, `pg`, `hono`  
**Storage**: PostgreSQL (Ponder onchain schema tables)  
**Testing**: Indexer integration tests in `apps/indexer` using deterministic event fixtures/replay runs  
**Target Platform**: Base Sepolia and Base indexing environments  
**Project Type**: Monorepo indexer service (`apps/indexer`)  
**Performance Goals**: Deterministic indexing under replay with no attribution drift and bounded lookup overhead for emitter resolution  
**Constraints**: On-chain discovery only; no contract/frontend changes; fail-fast env validation before indexing; no static default community fallback where mapping exists  
**Scale/Scope**: Multi-community support for RequestHub, DraftsManager, ShiftGovernor, CountingMultiChoice, Engagements, VerifierManager, ValuableActionRegistry, PositionManager, CredentialManager, RevenueRouter, TreasuryAdapter, CohortRegistry, InvestmentCohortManager, Marketplace, HousingManager, CommerceDisputes, ProjectFactory (plus additional CommunityRegistry-known module keys)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Protocol infrastructure first: PASS. Work is indexer projection only; no product-only protocol behavior introduced.
- Contract-first authority: PASS. Discovery and attribution are derived exclusively from canonical on-chain CommunityRegistry events and module emitters.
- Security/invariant preservation: PASS. No privileged mutation path changed; governance attribution logic avoids synthetic authority assumptions.
- Event/indexer discipline: PASS. No ABI/event changes; replay/backfill and idempotency are first-class in scope.
- Monorepo vertical-slice scope: PASS. Indexer + tests + README touched; no contract or app changes required.
- Project-management docs sync: CONDITIONAL PASS. If implementation materially changes risk/status, update both status files in same change set.
- Compatibility discipline: PASS. Non-breaking for downstream consumers; existing entity schema retained with additive mapping tables.

## Phase 0 Research Findings

1. **Factory strategy decision (single-level, no nesting)**
   - Use **hybrid approach C**:
     - Register one `factory()` source per module contract type.
     - Each factory derives candidate addresses from CommunityRegistry `ModuleAddressUpdated.newAddress` (single-level source).
     - Perform module-type validation via mapping table (`moduleKey`) in handlers/resolver before writing business entities.
   - Rationale:
     - `ModuleAddressUpdated` carries one address parameter for all module types.
     - Avoids nested dynamic registration and respects single-level factory constraint.
     - Keeps module routing deterministic with explicit registry-derived mapping windows.

2. **Community attribution decision**
   - Introduce canonical resolver `resolveCommunityFromEmitter({ emitterAddress, blockNumber })` that reads mapping windows and returns `{ communityId, moduleKey } | null`.
   - Remove all `defaultCommunityId` attribution in event handlers where mapping applies.

3. **Governor/proposals decision**
   - Resolve proposal community from governor emitter mapping at proposal creation time.
   - For votes and lifecycle events, resolve community through existing proposal row and validate against emitter mapping where available.

4. **Unmapped emitter policy decision**
   - Record unmapped emitter events in dedicated telemetry table and structured logs.
   - Do not persist business entities with guessed community IDs.

## Project Structure

### Documentation (this feature)

```text
specs/007-indexer-community-discovery/
├── plan.md
├── requirements.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── discovery-attribution-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/indexer/
├── ponder.config.ts
├── ponder.schema.ts
├── src/index.ts
├── README.md
└── [integration tests]
```

**Structure Decision**: Keep implementation strictly inside `apps/indexer`. Add additive schema tables and resolver utilities in `src/index.ts` (or split helper module if needed), convert contract source config in `ponder.config.ts` to env-driven CommunityRegistry + factory-discovered module addresses, and add indexer integration tests for dynamic discovery + attribution.

## Monorepo Impact Matrix

| Layer | Impacted? | Paths | Contract / Event / API Compatibility Notes |
|-------|-----------|-------|--------------------------------------------|
| Protocol Contracts | No | `contracts/**` (read-only) | No ABI/event changes |
| Indexer (Ponder) | Yes | `apps/indexer/ponder.config.ts`, `apps/indexer/ponder.schema.ts`, `apps/indexer/src/index.ts`, indexer tests | Discovery/attribution refactor; additive tables; no contract interface break |
| Manager App (Next.js) | No | N/A | Existing API shape preserved |
| Downstream dApp Surface | No (behavioral improvement) | Existing GraphQL/REST endpoints | Community attribution becomes correct for multi-community data |
| Documentation | Yes | `apps/indexer/README.md` (+ status docs if needed) | Add env/runbook/replay health guidance |

## Implementation Design

### 1) Env Fail-Fast Boot Contract

- In `apps/indexer/ponder.config.ts`:
  - Require `COMMUNITY_REGISTRY_ADDRESS` and `COMMUNITY_REGISTRY_START_BLOCK`.
  - Validate:
    - address is `0x`-prefixed and checksum/length valid via `viem` address parser.
    - start block parses to non-negative integer.
  - Optional usability check: query bytecode at registry address and fail if `0x`.
  - Abort config creation before any contract indexing starts when invalid.

### 2) Factory Configuration Strategy (Single-Level)

- Keep `CommunityRegistry` as static root source from env values.
- For each module contract type, define Ponder `factory()` source that derives addresses from `CommunityRegistry:ModuleAddressUpdated` `newAddress` argument.
- Module type handling:
  - Because event emits shared `newAddress` for all module keys, factories consume same address stream.
  - Event handlers gate writes through emitter resolver and expected module keys.
  - This is the hybrid strategy (broad factory address ingestion + strict moduleKey attribution guard).
- Explicitly avoid nested factory/dependent factory chains.

### 3) Schema Changes (`ponder.schema.ts`)

- Add `emitter_mapping_windows`:
  - `id` (text pk, deterministic), `emitterAddress`, `communityId`, `moduleKey`, `activeFromBlock`, `activeToBlock`, `discoveredAt`, `closedAt`.
- Add `emitter_mapping_active` projection:
  - `emitterAddress` (pk), `communityId`, `moduleKey`, `activeFromBlock`, `updatedAt`.
- Add `unmapped_emitter_alerts`:
  - `id` (text pk), `emitterAddress`, `blockNumber`, `eventName`, `txHash`, `logIndex`, `observedAt`.
- Add uniqueness/index strategy:
  - unique `(communityId, moduleKey, activeFromBlock)`.
  - index `(emitterAddress, activeFromBlock, activeToBlock)` for resolver lookups.
  - unique `(txHash, logIndex)` for alert idempotency.

### 4) Discovery Handlers (`src/index.ts`)

- Keep `CommunityRegistered` upsert behavior.
- Add `CommunityRegistry:ModuleAddressUpdated` handler:
  - Decode/normalize `moduleKey`.
  - If `oldAddress != 0x0`, close old window for `(communityId, moduleKey)` at current block.
  - If `newAddress != 0x0`, open new window from current block.
  - Update active projection table.
  - Handle same-block multiple updates deterministically by ordering with `(blockNumber, logIndex)`; last log in block wins active projection.
  - If `newAddress == 0x0`, treat as deactivation only.
- Idempotency:
  - all writes via deterministic IDs/upsert rules keyed by event identity and window start.

### 5) Attribution Refactor

- Implement helper:
  - `resolveCommunityFromEmitter({ emitterAddress, blockNumber, expectedModuleKeys? })`.
  - Query active window at block or fallback to interval search.
- Refactor all module handlers to use resolver-first attribution.
- If resolver returns null:
  - write unmapped-emitter alert row + structured log.
  - skip business-entity write/update for that event.
- Remove `defaultCommunityId` usage from:
  - proposals, engagements, and any other fallback paths currently static.

### 6) Governor/Proposal Attribution

- Proposal creation events (`ShiftGovernor:*ProposalCreated`):
  - resolve community from governor emitter mapping and persist on proposal row.
- Vote/lifecycle events:
  - resolve proposal by `proposalId`; use stored community.
  - optional consistency check with emitter mapping when available.
- `DraftsManager:ProposalEscalated`:
  - populate proposal-community relation from draft community + resolver consistency.

### 7) Backfill/Replay and Idempotency

- Replay source is `COMMUNITY_REGISTRY_START_BLOCK`.
- During replay:
  - registry events reconstruct mapping windows first in chain order.
  - factory-discovered module events ingest with resolver by block window.
- Idempotency guarantees:
  - deterministic primary keys and upsert conflict targets on mapping + entities.
  - no append-only duplicates on repeated replay.

### 8) Testing Strategy (Integration)

- Add four required suites under `apps/indexer` integration tests:
  1. **Discovery + first request ingestion**
     - emit CommunityRegistry registration/module update logs
     - emit RequestHub request event from discovered address
     - assert request persisted with correct communityId
  2. **Proposal/vote attribution by community**
     - governor + counting events from community-specific emitters
     - assert proposal/votes linked to correct community
  3. **Module rotation windows**
     - old address events before rotation attributed to old window
     - new address events after rotation attributed to new window
  4. **Replay idempotency**
     - replay same fixture twice
     - assert no duplicate mappings/entities
- Harness approach:
  - deterministic local fixture logs/replay pipeline consistent with current indexer CI flow.

### 9) Observability / Runbook

- Update `apps/indexer/README.md` with:
  - required env vars
  - selecting registry start block
  - replay commands
  - discovery health checks (mapped emitters, active windows, unmapped alerts)
  - unmapped emitter alert interpretation and remediation path

## Post-Design Constitution Re-Check

- Protocol infrastructure first: PASS.
- Contract-first authority: PASS.
- Security/invariant preservation: PASS.
- Event/indexer discipline: PASS.
- Monorepo vertical-slice scope: PASS.
- Project-management docs sync: CONDITIONAL PASS.
- Compatibility discipline: PASS.

## Complexity Tracking

No constitution violations requiring exceptional complexity approval.
