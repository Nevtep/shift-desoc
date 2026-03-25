# Feature Specification: Indexer Dynamic Multi-Community Discovery

**Feature Branch**: `007-indexer-community-discovery`  
**Created**: 2026-03-25  
**Status**: Draft  
**Input**: User description: "Feature: Indexer — Dynamic Multi-Community Discovery (CommunityRegistry-driven, env-configured)"

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Startup With Deterministic Discovery Config (Priority: P1)

As an operator, I need the indexer to start only when registry discovery inputs are present and valid so indexing behavior is deterministic across environments.

**Why this priority**: Invalid or missing discovery configuration creates silent indexing drift and false confidence in indexed data.

**Independent Test**: Start indexer with valid and invalid env combinations and verify explicit fail-fast behavior before indexing begins.

**Acceptance Scenarios**:

1. **Given** `COMMUNITY_REGISTRY_ADDRESS` and `COMMUNITY_REGISTRY_START_BLOCK` are valid, **When** the indexer starts, **Then** it initializes discovery using those values and proceeds.
2. **Given** either required env var is missing or invalid, **When** the indexer starts, **Then** startup fails immediately with actionable error output and no indexing begins.

---

### User Story 2 - Dynamic Module Discovery Across All Communities (Priority: P1)

As a protocol operator, I need the indexer to discover and monitor module contracts for every community through CommunityRegistry events so no newly deployed community modules are missed.

**Why this priority**: This is the core behavior change and directly addresses missed RequestHub/DraftsManager/Governor indexing for non-default communities.

**Independent Test**: Create a new community and module wiring events, then verify module emitters are added to monitoring automatically without static address edits.

**Acceptance Scenarios**:

1. **Given** CommunityRegistry emits `CommunityRegistered` and `ModuleAddressUpdated`, **When** discovery processes logs, **Then** module addresses are added to dynamic monitoring for their contract type.
2. **Given** multiple communities emit module lifecycle events, **When** indexing runs, **Then** all discovered module addresses are monitored concurrently.
3. **Given** indexer config files contain no static module addresses, **When** indexer starts with required env vars, **Then** discovery still functions for all communities.

---

### User Story 3 - Correct Community Attribution And Rotation Safety (Priority: P1)

As a data consumer, I need every indexed event to be attributed by community using emitter address windows so records remain correct during module rotations and replay.

**Why this priority**: Incorrect community attribution breaks governance, coordination, and reporting correctness.

**Independent Test**: Reproduce module rotation and proposal/vote flows and verify pre/post-rotation events map to the correct community.

**Acceptance Scenarios**:

1. **Given** a module emitter address has an active mapping window, **When** an event is ingested from that emitter at block N, **Then** the event is attributed to the mapped community for block N.
2. **Given** `ModuleAddressUpdated` changes a module address, **When** indexing reaches that block, **Then** the previous mapping window closes and the new one opens at that block.
3. **Given** proposal and vote lifecycle events are emitted, **When** they are indexed, **Then** proposal and vote records are attributed by community without static default community fallback.

---

### User Story 4 - Replay, Backfill, And Idempotent Recovery (Priority: P2)

As an operator, I need replay from registry start block to reconstruct discovery and ingest historical events for all communities without duplicates.

**Why this priority**: Existing deployments must be recovered without data corruption.

**Independent Test**: Replay from `COMMUNITY_REGISTRY_START_BLOCK` multiple times and verify stable counts and no duplicate mappings/entities.

**Acceptance Scenarios**:

1. **Given** historical registry/module logs exist, **When** replay starts from registry start block, **Then** the mapping history is reconstructed and historical module events are indexed.
2. **Given** replay is run repeatedly from the same start block, **When** ingestion completes, **Then** mappings and indexed entities remain deduplicated and consistent.
3. **Given** an event arrives from an unmapped emitter, **When** attribution is attempted, **Then** the indexer emits an unmapped-emitter alert and does not silently attribute to a default community.

---

### Edge Cases

- `COMMUNITY_REGISTRY_ADDRESS` is syntactically valid but points to a non-contract address: startup must fail fast.
- `COMMUNITY_REGISTRY_START_BLOCK` is lower than chain history retention on the connected RPC: runbook must document fallback and expected behavior.
- Multiple `ModuleAddressUpdated` events for the same `(communityId, moduleKey)` in one block: mapping windows must remain deterministic and non-overlapping.
- Module address set to zero address to deactivate a module: active window must close without opening a new active mapping.
- Proposal/vote event is processed before proposal-community association is available in local state due to ordering/replay timing: handler must resolve deterministically or surface unresolved attribution alert.
- Duplicate/replayed logs from restart: upserts must prevent duplicate mapping rows and duplicate business entities.
- Event from unknown emitter contract type discovered in registry flow: discovery should persist mapping and emit unsupported-module telemetry until handler coverage exists.

### Reorg resilience and replay safety

- All persisted entities and mappings MUST use deterministic IDs derived from log identity (`chainId + txHash + logIndex`, or an equivalent stable log-based identity).
- Mapping windows MUST be derived strictly from on-chain logs; under reorg/replay they remain correct when log-derived IDs are used.
- Attribution resolution MUST NOT rely on unqualified "latest state" reads; mapping resolution requires explicit block context.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: Indexer startup MUST require `COMMUNITY_REGISTRY_ADDRESS` and `COMMUNITY_REGISTRY_START_BLOCK` from environment variables.
- **FR-002**: Indexer startup MUST fail fast with explicit error output if either required env variable is missing, malformed, or unusable (`COMMUNITY_REGISTRY_ADDRESS` invalid format, wrong chain, no bytecode at address, or required registry read fails; `COMMUNITY_REGISTRY_START_BLOCK` invalid or out of supported range).
- **FR-003**: CommunityRegistry contract source MUST be configured from environment values, not deployment JSON static module addresses.
- **FR-004**: Dynamic module discovery MUST be derived from on-chain CommunityRegistry lifecycle events (`CommunityRegistered`, `ModuleAddressUpdated`).
- **FR-005**: Ponder contract sources for module contracts MUST be factory-discovered from CommunityRegistry-driven address discovery.
- **FR-006**: Discovery coverage MUST include these in-scope module contracts for full rollout: Coordination (`RequestHub`, `DraftsManager`), Governance (`ShiftGovernor`, `CountingMultiChoice`), Verification (`Engagements`, `VerifierManager`, `ValuableActionRegistry`), Economy (`RevenueRouter`, `TreasuryAdapter`, `CohortRegistry`, `InvestmentCohortManager`, `PositionManager`, `CredentialManager`), and Commerce (`Marketplace`, `HousingManager`, `CommerceDisputes`, `ProjectFactory`).
- **FR-007**: Indexer MUST persist an emitter-to-community mapping history with block windows (`activeFromBlock`, `activeToBlock`) and module identifier.
- **FR-008**: Every indexed module event MUST resolve community attribution using emitter mapping window at the event block number.
- **FR-009**: Static default community attribution MUST be removed wherever deterministic mapping is available.
- **FR-010**: On module rotation (`ModuleAddressUpdated`), indexer MUST close prior active window and open a new active window at the update block.
- **FR-011**: Replay from `COMMUNITY_REGISTRY_START_BLOCK` MUST reconstruct mapping history and ingest historical events for discovered module addresses.
- **FR-012**: Replay behavior MUST be idempotent across repeated runs from the same start block.
- **FR-013**: Proposal and vote lifecycle attribution MUST be community-correct using emitter mapping and registry-derived proposal relationships.
- **FR-014**: If an event emitter has no active mapping window, indexer MUST emit unmapped-emitter telemetry and MUST NOT silently assign a default community.
- **FR-015**: Runbook/README MUST document required env vars, replay procedure, start-block selection guidance, and discovery health validation checks.

### Monorepo Impact Requirements *(mandatory)*

- **MR-001**: Impact is indexer-only (`apps/indexer`), with no contract changes and no Manager app changes.
- **MR-002**: No ABI or event schema changes are introduced; indexer compatibility must be preserved for existing contract interfaces.
- **MR-003**: Derived discovery state MUST remain anchored to canonical on-chain CommunityRegistry events and must not become shadow authority.
- **MR-004**: Governance attribution logic MUST preserve Governor/Timelock flow semantics and avoid synthetic community assumptions.
- **MR-005**: Integration test coverage under indexer scope MUST verify multi-community ingestion across module groups.

### Compatibility And Migration Requirements *(mandatory when applicable)*

- **CM-001**: This feature is non-breaking to contract interfaces and downstream event schemas.
- **CM-002**: Migration requires replay/backfill from `COMMUNITY_REGISTRY_START_BLOCK`; procedure MUST be documented and validated.
- **CM-003**: Existing API consumers MUST continue receiving community-attributed entities with no schema-breaking field removals.

### Documentation And Terminology Requirements *(mandatory)*

- **DT-001**: `apps/indexer/README.md` runbook MUST be updated with env, replay, and discovery health guidance.
- **DT-002**: Specification MUST use Shift terminology including RequestHub, DraftsManager, Governor, CountingMultiChoice, Engagements, VerifierManager, ValuableActionRegistry, RevenueRouter, TreasuryAdapter, and Commerce modules.
- **DT-003**: If implementation materially changes status or risk posture, synchronized updates to `.github/project-management/IMPLEMENTATION_STATUS.md` and `.github/project-management/STATUS_REVIEW.md` are required.

### Key Entities *(include if feature involves data)*

- **CommunityModuleEmitterMapping**: Historical mapping record linking emitter address to `(communityId, moduleKey)` with active block window.
- **CommunityModuleEmitterState**: Active mapping projection for fast attribution lookup by emitter address at current block.
- **ModuleDiscoveryEventRecord**: Normalized record of CommunityRegistry lifecycle events used to drive discovery.
- **CommunityAttributedRequest**: Request entity attributed through emitter mapping and stored with deterministic communityId.
- **CommunityAttributedProposal**: Proposal lifecycle entity with community attribution derived from emitter mapping and related draft/governor context.
- **UnmappedEmitterAlert**: Operational signal emitted when an event is observed for an address without active mapping.

### Assumptions

- CommunityRegistry emits complete and ordered lifecycle signals (`CommunityRegistered`, `ModuleAddressUpdated`) for all community module wiring changes.
- Existing module event ABIs remain compatible with current indexer handlers and do not require contract-side schema changes for this feature.
- Replay from `COMMUNITY_REGISTRY_START_BLOCK` has access to required historical logs on the chosen RPC provider.
- Required module coverage includes currently deployed major modules and can be expanded without changing discovery source-of-truth semantics.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: Indexer startup with missing/invalid required env vars fails 100% of the time before ingestion begins.
- **SC-002**: In staging replay from `COMMUNITY_REGISTRY_START_BLOCK`, events from at least two distinct community RequestHub emitters are indexed and attributed correctly.
- **SC-003**: Proposal/vote integration tests show 100% correct community attribution with zero reliance on static default community fallbacks.
- **SC-004**: Module rotation test confirms 100% correct attribution before and after rotation boundary block.
- **SC-005**: Replay idempotency test shows zero duplicate mapping rows and zero duplicate business entities across repeated replays.
- **SC-006**: Unmapped emitter telemetry count is visible in logs/metrics and unresolved emitters are never silently attributed.
