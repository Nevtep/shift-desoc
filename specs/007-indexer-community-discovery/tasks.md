# Tasks: Indexer Dynamic Multi-Community Discovery

**Input**: Design documents from `/specs/007-indexer-community-discovery/`
**Prerequisites**: `plan.md`, `spec.md`, `requirements.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/discovery-attribution-contract.md`

**Tests**: Indexer integration tests are REQUIRED and MUST include exactly these four suites: discovery-first-ingestion, proposal-vote-attribution, rotation-windows, replay-idempotency.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Align indexer-only implementation boundaries and test harness before feature coding.

- [X] T001 Confirm indexer-only scope boundaries and no contract/app changes in `specs/007-indexer-community-discovery/spec.md` and `specs/007-indexer-community-discovery/requirements.md`.
- [X] T002 Build implementation checklist from `specs/007-indexer-community-discovery/plan.md` and `specs/007-indexer-community-discovery/quickstart.md` for `apps/indexer/**`.
- [X] T003 [P] Create integration test directory structure for feature suites in `apps/indexer/test/integration/`.
- [X] T004 [P] Add shared deterministic fixture helpers for registry/module logs in `apps/indexer/test/integration/fixtures/community-registry-fixtures.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core discovery/attribution primitives that all user stories depend on.

**CRITICAL**: No user story implementation starts until this phase is complete.

- [X] T005 Add module key constants and normalization helpers in `apps/indexer/src/discovery/module-keys.ts`.
- [X] T006 Add explicit moduleKey allowlists per contract type in `apps/indexer/src/discovery/module-key-allowlists.ts`.
- [X] T007 [P] Add emitter mapping window table and indexes in `apps/indexer/ponder.schema.ts`.
- [X] T008 [P] Add active emitter projection table and indexes in `apps/indexer/ponder.schema.ts`.
- [X] T009 [P] Add unmapped emitter telemetry table with idempotent keys in `apps/indexer/ponder.schema.ts`.
- [X] T010 Implement canonical resolver `resolveCommunityFromEmitter({ emitterAddress, blockNumber, expectedModuleKeys? })` in `apps/indexer/src/discovery/resolve-community-from-emitter.ts`.
- [X] T011 Implement helper for deterministic close/open mapping windows in `apps/indexer/src/discovery/mapping-windows.ts`.
- [X] T012 Add shared unmapped-emitter telemetry writer and structured logger in `apps/indexer/src/discovery/unmapped-emitter-telemetry.ts`.

**Checkpoint**: Foundational discovery and attribution primitives are ready.

---

## Phase 3: User Story 1 - Startup With Deterministic Discovery Config (Priority: P1)

**Goal**: Enforce env fail-fast and registry-rooted indexer startup.

**Independent Test**: Start indexer with valid and invalid env combinations and verify fail-fast before indexing when invalid.

### Implementation for User Story 1

- [X] T013 [US1] Remove deployment JSON dependency for registry discovery inputs in `apps/indexer/ponder.config.ts`.
- [X] T014 [US1] Read `COMMUNITY_REGISTRY_ADDRESS` and `COMMUNITY_REGISTRY_START_BLOCK` from env in `apps/indexer/ponder.config.ts`.
- [X] T015 [US1] Enforce fail-fast validation for missing/invalid env values in `apps/indexer/ponder.config.ts`.
- [X] T016 [US1] Add registry-address usability check (contract code exists) before indexing in `apps/indexer/ponder.config.ts`.
- [X] T017 [US1] Wire static CommunityRegistry source from env in `apps/indexer/ponder.config.ts`.
- [X] T018 [US1] Add startup validation coverage for env fail-fast behavior in `apps/indexer/test/unit/startup-env-fail-fast.test.ts`.

**Checkpoint**: Indexer starts only with valid registry env configuration.

---

## Phase 4: User Story 2 - Dynamic Module Discovery Across All Communities (Priority: P1)

**Goal**: Discover and monitor module contracts dynamically from CommunityRegistry events using factory sources.

**Independent Test**: Emit CommunityRegistered + ModuleAddressUpdated and ingest first request from discovered RequestHub address.

### Tests for User Story 2

- [X] T019 [P] [US2] Add integration suite 1 (`discovery-first-ingestion`) in `apps/indexer/test/integration/discovery-first-ingestion.test.ts`.

### Implementation for User Story 2

- [X] T020 [US2] Add CommunityRegistry `ModuleAddressUpdated` handler to persist mapping windows in `apps/indexer/src/index.ts`.
- [X] T021 [US2] Persist all moduleKey updates (wide-net) into mapping window tables in `apps/indexer/src/index.ts`.
- [X] T022 [US2] Configure factory source for `RequestHub` using CommunityRegistry module updates in `apps/indexer/ponder.config.ts`.
- [X] T023 [P] [US2] Configure factory source for `DraftsManager` in `apps/indexer/ponder.config.ts`.
- [X] T024 [P] [US2] Configure factory sources for governance contracts (`ShiftGovernor`, `CountingMultiChoice`) in `apps/indexer/ponder.config.ts`.
- [X] T025 [P] [US2] Configure factory sources for verification contracts (`Engagements`, `VerifierManager`, `ValuableActionRegistry`) in `apps/indexer/ponder.config.ts`.
- [X] T026 [P] [US2] Configure factory sources for economy contracts (`RevenueRouter`, `TreasuryAdapter`, `CohortRegistry`, `InvestmentCohortManager`, `PositionManager`, `CredentialManager`) in `apps/indexer/ponder.config.ts`.
- [X] T027 [P] [US2] Configure factory sources for commerce contracts (`Marketplace`, `HousingManager`, `CommerceDisputes`, `ProjectFactory`) in `apps/indexer/ponder.config.ts`.
- [X] T028 [US2] Ensure factory design remains single-level and non-nested in `apps/indexer/ponder.config.ts`.

**Checkpoint**: Dynamic module monitoring is active for all targeted module contract types.

---

## Phase 5: User Story 3 - Correct Community Attribution And Rotation Safety (Priority: P1)

**Goal**: Enforce resolver-first attribution and rotation-safe windows across all module handlers.

**Independent Test**: Verify proposal/vote attribution by community and correct before/after rotation attribution.

### Tests for User Story 3

- [X] T029 [P] [US3] Add integration suite 2 (`proposal-vote-attribution`) in `apps/indexer/test/integration/proposal-vote-attribution.test.ts`.
- [X] T030 [P] [US3] Add integration suite 3 (`rotation-windows`) in `apps/indexer/test/integration/rotation-windows.test.ts`.

### Implementation for User Story 3

- [X] T031 [US3] Refactor RequestHub handlers to resolver-first attribution with `expectedModuleKeys` gating in `apps/indexer/src/index.ts`.
- [X] T032 [US3] Refactor DraftsManager handlers to resolver-first attribution with `expectedModuleKeys` gating in `apps/indexer/src/index.ts`.
- [X] T033 [US3] Refactor Engagements/Verifier/ValuableAction handlers to resolver-first attribution with `expectedModuleKeys` gating in `apps/indexer/src/index.ts`.
- [X] T034 [US3] Refactor ShiftGovernor and CountingMultiChoice handlers to resolver-first attribution with `expectedModuleKeys` gating in `apps/indexer/src/index.ts`.
- [X] T035 [US3] Remove remaining static `defaultCommunityId` attribution where resolver mapping applies in `apps/indexer/src/index.ts`.
- [X] T036 [US3] Implement proposalId-to-community linkage from governor emitter mapping + proposal row reuse in `apps/indexer/src/index.ts`.
- [X] T037 [US3] Implement rotation rules (close old, open new, zero-address deactivation) with same-block deterministic behavior in `apps/indexer/src/index.ts` and `apps/indexer/src/discovery/mapping-windows.ts`.
- [X] T038 [US3] Emit unmapped-emitter telemetry rows and structured logs, and skip guessed writes in `apps/indexer/src/index.ts`.

**Checkpoint**: All module handlers are resolver-first, allowlist-gated, and rotation-safe.

---

## Phase 6: User Story 4 - Replay, Backfill, And Idempotent Recovery (Priority: P2)

**Goal**: Ensure replay from startBlock reconstructs mappings and remains idempotent.

**Independent Test**: Replay from registry start block twice and verify no duplicate mappings/entities.

### Tests for User Story 4

- [X] T039 [P] [US4] Add integration suite 4 (`replay-idempotency`) in `apps/indexer/test/integration/replay-idempotency.test.ts`.

### Implementation for User Story 4

- [X] T040 [US4] Implement replay-safe mapping reconstruction flow from `COMMUNITY_REGISTRY_START_BLOCK` in `apps/indexer/src/index.ts`.
- [X] T041 [US4] Add deterministic upsert/conflict rules for mapping windows, active projection, and telemetry in `apps/indexer/src/index.ts`.
- [X] T042 [US4] Validate idempotent behavior for business entities under replay in `apps/indexer/src/index.ts`.

**Checkpoint**: Replay/backfill behavior is deterministic and idempotent.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Operational readiness, docs, and final validation.

- [X] T043 [P] Add discovery health query helpers/endpoints for mapped emitters and unmapped counts in `apps/indexer/src/index.ts`.
- [X] T044 [P] Update runbook with required env vars, start-block guidance, replay commands, and discovery health checks in `apps/indexer/README.md`.
- [X] T045 Run feature validation commands from `specs/007-indexer-community-discovery/quickstart.md` and resolve failures in `apps/indexer/**`.
- [ ] T046 [P] If implementation status/risk posture changed, sync `.github/project-management/IMPLEMENTATION_STATUS.md` and `.github/project-management/STATUS_REVIEW.md` together.

---

## Phase 8: Compliance Gates (Constitution + Compatibility)

**Purpose**: Add explicit resilience and compatibility gates without expanding feature scope.

- [X] T047 Add/verify deterministic log-based IDs (`chainId + txHash + logIndex` or equivalent) for mapping windows, unmapped emitter telemetry rows, and major indexed entities created by handlers in `apps/indexer/src/index.ts` and `apps/indexer/ponder.schema.ts`.
- [X] T048 Add replay/reorg safety verification in `apps/indexer/test/integration/replay-idempotency.test.ts`: implement reorg simulation if supported; otherwise add replay-based invariants proving no duplicates and stable attribution with log-based IDs, and document the limitation in `apps/indexer/README.md`.
- [X] T049 Validate ABIs referenced by `apps/indexer/ponder.config.ts` include all handler-referenced events by adding an automated compatibility check in `apps/indexer/test/unit/abi-event-compatibility.test.ts`.
- [X] T050 [P] Add lightweight local check script for missing event signatures in `apps/indexer/scripts/check-handler-event-signatures.ts` and wire it into indexer validation workflow.
- [X] T051 Add downstream compatibility smoke checks in `apps/indexer/test/integration/schema-compatibility-smoke.test.ts` to ensure schema/build passes and existing query surfaces (or introspection snapshot) remain non-breaking.
- [X] T052 [P] Document compatibility checks (ABI/event and schema/query smoke) in `apps/indexer/README.md` and `specs/007-indexer-community-discovery/quickstart.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): starts immediately.
- Phase 2 (Foundational): depends on Phase 1 and blocks all user stories.
- Phase 3 (US1), Phase 4 (US2), Phase 5 (US3), Phase 6 (US4): start after Phase 2.
- Phase 7 (Polish): starts after target user stories are complete.

### User Story Dependencies

- US1 (P1): depends only on Foundational tasks.
- US2 (P1): depends on US1 env/root config plus Foundational tasks.
- US3 (P1): depends on US2 discovery + Foundational tasks.
- US4 (P2): depends on US2 and US3.

### Required Integration Suites (exact set)

- Suite 1: `discovery-first-ingestion`.
- Suite 2: `proposal-vote-attribution`.
- Suite 3: `rotation-windows`.
- Suite 4: `replay-idempotency`.

---

## Parallel Execution Examples

### US2 Parallel Example

- `T023`, `T024`, `T025`, `T026`, and `T027` can run in parallel once `T022` has established the factory pattern.

### US3 Parallel Example

- `T029` and `T030` can run in parallel while `T031`-`T038` attribution refactor is in progress.

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Setup and Foundational phases.
2. Deliver US1 fail-fast env startup.
3. Deliver US2 dynamic factory discovery and first-ingestion coverage.
4. Validate discovery works before attribution refactor.

### Incremental Delivery

1. Add US3 resolver-first attribution, moduleKey allowlist gating, and rotation handling.
2. Add US4 replay/backfill idempotency hardening.
3. Finish observability/runbook and final validation.

### Scope Guardrails

- Indexer-only changes under `apps/indexer/**`.
- No contract changes.
- No manager/frontend changes.
- No silent community fallback attribution when resolver mapping is unavailable.
