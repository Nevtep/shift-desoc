# Feature Specification: Engagements Rich Lifecycle UX

**Feature Branch**: `[013-engagements-lifecycle-ux]`  
**Created**: 2026-04-12  
**Status**: Draft  
**Input**: User description: "Engagements: Rich Lifecycle UX"

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

### User Story 1 - Submit Real Engagement On-Chain (Priority: P1)

As a community member, I can open a community-scoped Engagement creation flow, choose an active Valuable Action from that same community, provide required evidence, and execute the real transaction so my engagement actually exists on-chain.

**Why this priority**: This is the minimum functional value of the feature. Without a successful on-chain submit path, Engagement UX remains a placeholder.

**Independent Test**: Can be fully tested by creating one engagement from start to finish on the target network and confirming an on-chain engagement ID is created with `Pending` lifecycle state.

**Acceptance Scenarios**:

1. **Given** a user is in community A create flow, **When** they open the Valuable Action selector, **Then** only active Valuable Actions for community A are selectable.
2. **Given** a selected active Valuable Action requires structured evidence fields, **When** the user completes required fields and submits, **Then** the app prepares evidence payload according to that Valuable Action evidence spec and executes the real submit transaction path.
3. **Given** wallet confirmation succeeds and transaction is finalized, **When** submit completes, **Then** the app shows confirmed engagement creation with canonical engagement identifier and routes to deterministic post-submit state.
4. **Given** wallet rejection, wrong chain, or contract revert occurs, **When** submission fails, **Then** no local shadow engagement is created and the failure reason is shown with corrective guidance.

---

### User Story 2 - View Lifecycle Truthfully After Submit (Priority: P2)

As a submitter or operator, I can see community-scoped engagement list/detail surfaces that truthfully represent canonical and projected lifecycle state after submission.

**Why this priority**: Users need confidence that submitted engagements are visible, scoped correctly, and not misrepresented during projection lag.

**Independent Test**: Can be tested independently by loading list/detail after a successful submit and verifying status visibility, readiness indicators, and no cross-community leakage.

**Acceptance Scenarios**:

1. **Given** a confirmed engagement submission, **When** the user lands on list/detail, **Then** engagement appears in the selected community with status `Pending` until canonical resolution signals occur.
2. **Given** projection/indexed state is lagging, **When** the user views list/detail, **Then** readiness is explicit and UI distinguishes confirmed on-chain submit from delayed projection enrichment.
3. **Given** a route includes a community ID that does not own the engagement, **When** detail is requested, **Then** access is blocked or redirected with explicit community mismatch messaging.

---

### User Story 3 - Understand Multi-Step Submission States (Priority: P3)

As a user, I can understand each step of the transaction-capable submission process (preparation, wallet prompt, chain confirmation, and finalized result) and what happens next in the Engagement lifecycle.

**Why this priority**: Clarity around transaction and lifecycle states reduces false assumptions, duplicate submits, and support load.

**Independent Test**: Can be tested independently by forcing each submission state path (prepare, wallet reject, revert, success) and validating user-facing state transitions and messaging.

**Acceptance Scenarios**:

1. **Given** user is ready to submit, **When** they initiate submit, **Then** UI presents explicit step-by-step transaction progress that maps to real wallet/network events.
2. **Given** transaction confirms, **When** user is routed to detail, **Then** lifecycle explanation indicates engagement is submitted and pending verifier outcomes.
3. **Given** transaction reverts with a known contract condition (inactive action, cooldown, max concurrent, community mismatch), **When** failure occurs, **Then** UI maps failure to plain-language reason and does not claim submission success.

---

### Edge Cases

- User starts submission on one chain and wallet is connected to a different chain at confirmation time.
- Selected Valuable Action becomes inactive between form load and transaction submission.
- User hits cooldown or max concurrent limits enforced by Engagements submit path.
- Juror selection fails because verifier panel cannot satisfy required minimum jurors.
- Transaction is mined but projection is delayed; list may not immediately show enriched record fields.
- User refreshes during pending wallet or pending confirmation states.
- User deep-links into an engagement detail that belongs to another community.
- Evidence spec requires structured sections but user submits incomplete required fields.
- Evidence payload upload succeeds but transaction fails, or vice versa.
- Duplicate clicks on submit while first transaction is pending.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a community-scoped Engagement list and detail surface where each engagement is strictly bound to the selected community context.
- **FR-002**: System MUST provide an Engagement create flow that allows submission only against Valuable Actions that are active for the selected community.
- **FR-003**: System MUST consume existing Valuable Action identifiers and catalog state directly, without introducing alternative identifier systems.
- **FR-004**: System MUST enforce exact community boundary checks for read and write flows and block cross-community engagement mutation.
- **FR-005**: System MUST capture evidence input according to the selected Valuable Action structured evidence spec and require all mandatory evidence fields before transaction initiation.
- **FR-006**: System MUST produce a canonical evidence payload for the selected Valuable Action and use that payload in the real engagement submit transaction path.
- **FR-007**: System MUST execute the actual deployed write path for engagement submission and MUST NOT implement placeholder save, draft-only substitute, or simulated success.
- **FR-008**: If engagement submission requires multiple user-visible steps (for example payload preparation and wallet-confirmed transaction), system MUST model and display those steps explicitly.
- **FR-009**: Transaction-capable flows MUST handle wallet rejection, wrong chain, dropped transaction, and contract revert outcomes with user-comprehensible remediation.
- **FR-010**: System MUST NOT represent an engagement as created until the real transaction path succeeds and returns canonical confirmation.
- **FR-011**: After successful submit, system MUST route deterministically to a community-scoped post-submit destination with canonical engagement identity and truthful state messaging.
- **FR-012**: Post-submit lifecycle state visibility MUST reflect actual on-chain and projected truths, including explicit readiness/pending indicators when projection lag exists.
- **FR-013**: System MUST display initial engagement lifecycle state as pending verification until canonical state transitions indicate approved/rejected/revoked.
- **FR-014**: System MUST preserve Valuable Action semantics as shared foundations (Engagements, Positions, Credentials, Investments) and MUST NOT collapse Valuable Action meaning into engagement-only assumptions.
- **FR-015**: System MUST expose known protocol-capability limits that affect a complete Engagement slice, instead of masking gaps with speculative UX.

### Screen Contract

- **SCN-001 Engagement List (Community Scope)**: Displays community-filtered engagement rows with engagement ID, submitter, Valuable Action reference, created time, lifecycle status, and readiness signal.
- **SCN-002 Engagement Detail (Community Scope)**: Displays canonical engagement identity, community ID, linked Valuable Action, evidence reference, verification deadline visibility, lifecycle state, and status explanation.
- **SCN-003 Engagement Create Entry**: Provides entry point from selected community context and blocks access when community context is missing or invalid.
- **SCN-004 Valuable Action Picker**: Shows only active Valuable Actions in selected community and shows why actions are unavailable when inactive or mismatched.
- **SCN-005 Evidence Builder**: Renders structured evidence input aligned to selected Valuable Action evidence spec, validates required fields, and previews resulting evidence payload.
- **SCN-006 Submit Transaction Panel**: Shows explicit submission steps, current step state, wallet/chain requirements, confirm action, and error states mapped to real outcomes.
- **SCN-007 Post-Submit Result State**: On success, routes to deterministic detail/list destination with canonical engagement identifier; on failure, remains in flow with no created-record claim.
- **SCN-008 Readiness And Truth Banner**: Communicates projection recency and clarifies whether shown data is canonical confirmation or projected enrichment.
- **SCN-009 Community Boundary Guard**: Intercepts community mismatches in URL, form payload, or loaded data and prevents display/mutation outside selected community.

### Acceptance Criteria

- **AC-001**: A real user can complete create-submit flow on target network and obtain a confirmed engagement ID in selected community.
- **AC-002**: New submissions are blocked when selected Valuable Action is not active for the selected community.
- **AC-003**: Required evidence fields derived from Valuable Action evidence spec are enforced before submit.
- **AC-004**: Submit path invokes real wallet transaction flow and never uses local placeholder persistence.
- **AC-005**: Engagement is not shown as created if wallet is rejected or transaction reverts/fails.
- **AC-006**: On successful submit, deterministic routing leads to community-scoped lifecycle visibility within list/detail surfaces.
- **AC-007**: List/detail views present truthful lifecycle and readiness states during projection lag.
- **AC-008**: Cross-community access attempts for engagement detail/mutation are blocked with explicit messaging.
- **AC-009**: Failure reasons for known contract constraints (inactive action, cooldown, max concurrent, community mismatch, insufficient jurors) are surfaced clearly.
- **AC-010**: Feature behavior remains within deployed authority and protocol capabilities; any blocker is explicitly surfaced.

### Explicit Out Of Scope

- Protocol redesign for Engagements, VerifierElection, or broader governance modules.
- New verifier election mechanics unrelated to current Engagement submission lifecycle.
- New UX slices for Credentials, Positions, or Investments beyond compatibility-safe Valuable Action consumption.
- Speculative moderation, reward orchestration, or lifecycle extensions not required for a complete first functional Engagement submission slice.
- Any flow that implies authority bypass outside Governor/Timelock and deployed contract permissions.

### Known Protocol Blockers And Constraints

- No hard blocker identified for a complete first functional submission slice: the deployed engagement submission write path supports real create flow.
- Engagement creation is single write transaction after evidence payload preparation; there is no deployed pre-create reservation or draft transaction.
- Lifecycle beyond submission (verifier voting, final resolution) depends on juror actions and verification windows; UX must represent this as pending verification and not instant completion.
- If juror selection cannot satisfy minimum panel constraints at submit time, submission fails at contract level and must be surfaced as a true blocker state for that attempt.

### Monorepo Impact Requirements *(mandatory)*

- **MR-001**: Feature spec MUST identify impact across contracts, indexer,
  Manager app, tests, and documentation.
- **MR-002**: If contract interfaces or event schemas change, spec MUST define
  compatibility expectations and migration/versioning requirements for the
  indexer and downstream dApps.
- **MR-003**: Spec MUST state how derived/indexed state maps back to canonical
  on-chain state and events without introducing shadow authority.
- **MR-004**: Spec MUST define role/authority implications for privileged flows
  and confirm Governor/Timelock governance path expectations.
- **MR-005**: Manager UI requirements MUST map to actual implemented contract
  capabilities and MUST NOT rely on aspirational protocol behavior.
- **MR-006**: Spec MUST define expected updates in `apps/web` Manager routes/components for community-scoped Engagement list/detail/create/submit and transaction-state UX.
- **MR-007**: Spec MUST define expected indexer/query requirements in `apps/indexer` to support list/detail lifecycle visibility and readiness indicators using existing canonical events unless change is justified.
- **MR-008**: Spec MUST define contract touch policy: prefer zero ABI/event changes; if changes become necessary, they MUST be justified with explicit compatibility and migration requirements.
- **MR-009**: Spec MUST define test impact across `apps/web` unit/integration tests, indexer synchronization tests, and contract-level verification of submit preconditions used by UX messaging.
- **MR-010**: Any derived state shown in Manager MUST map back to canonical engagement and valuable action state without creating shadow authority.

### Compatibility And Migration Requirements *(mandatory when applicable)*

- **CM-001**: Breaking changes MUST be explicitly marked and justified.
- **CM-002**: Required migration/replay/backfill steps MUST be defined for
  indexer and app consumers.
- **CM-003**: Event and ABI change impact on downstream niche dApps MUST be
  documented.
- **CM-004**: Default expectation for this feature is no breaking contract ABI/event change; if retained, no migration/backfill is required beyond normal indexing continuation.
- **CM-005**: If indexer shape for engagement list/detail readiness is expanded, replay/backfill requirements MUST be explicitly defined before ship.
- **CM-006**: Existing Valuable Action IDs and activation semantics MUST remain compatible with current catalog/admin surfaces and future shared-module consumers.

### Documentation And Terminology Requirements *(mandatory)*

- **DT-001**: `neuromancer/SHIFT_SYSTEM.md` and `contracts/FEATURES.md` MUST be
  updated when shipped behavior changes.
- **DT-002**: Specs MUST use current Shift terminology (Engagements,
  ValuableActionSBT, VPS, PositionManager, RevenueRouter, RequestHub, Drafts,
  Governor/Timelock, Target ROI).
- **DT-003**: If implementation status, drift risks, backlog priorities,
  architecture expectations, or workflow requirements change, specs MUST include
  synchronized update requirements for
  `.github/project-management/IMPLEMENTATION_STATUS.md` and
  `.github/project-management/STATUS_REVIEW.md`.
- **DT-004**: If shipped behavior changes Engagement lifecycle UX, documentation under `docs/EN/` for Architecture, Verification Layer, and Manager workflows MUST be synchronized with actual submission and lifecycle visibility behavior.
- **DT-005**: Terminology in UI and docs MUST preserve distinction between Engagement lifecycle, Valuable Action definition, and commerce dispute flows.

### Assumptions

- Selected community context is already resolved before entering Engagement create/list/detail flows.
- Valuable Action catalog/admin/readiness slice from previous roadmap items is available and provides active Valuable Action selection inputs.
- Evidence payload can be structured and stored using existing metadata/evidence upload conventions used by Valuable Action authoring flows.
- Wallet-connected users on target network can execute direct submit writes for Engagement creation; no additional governance proposal path is required for standard submit.

### Key Entities *(include if feature involves data)*

- **Community Engagement Record**: Canonical work verification submission scoped to one community and one Valuable Action, with lifecycle state and verification deadline.
- **Valuable Action Reference**: Shared canonical action identity used to validate activity status, community ownership, and evidence requirements for submission.
- **Evidence Payload**: Structured user-provided evidence assembled to satisfy Valuable Action evidence spec and anchored via canonical evidence reference used in submission.
- **Submission Transaction State**: User-visible progression from pre-submit validation through wallet interaction to on-chain confirmation or failure.
- **Readiness State**: Indicator describing whether displayed engagement lifecycle data is canonical, projected and current, or projected and lagging.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of successful Engagement submissions result from real wallet-confirmed transactions and produce canonical engagement IDs.
- **SC-002**: 100% of Engagement create flows enforce active Valuable Action and exact community boundary constraints before write submission.
- **SC-003**: 100% of failed submit attempts (wallet reject, wrong chain, revert) avoid created-record claims and show actionable next-step guidance.
- **SC-004**: 100% of post-submit routes land on deterministic community-scoped list/detail surfaces with truthful initial lifecycle state visibility.
- **SC-005**: 0 unresolved contract/indexer/app drift items exist for Engagement fields required by list/detail/create-submit surfaces at merge time.
- **SC-006**: If ABI/event/schema changes are introduced, all defined compatibility and replay/backfill steps are validated in staging before release; otherwise this feature ships with no migration requirement.
