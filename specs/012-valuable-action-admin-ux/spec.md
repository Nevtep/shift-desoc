# Feature Specification: ValuableAction Registry Admin UX + Projection Readiness

**Feature Branch**: `[012-valuable-action-admin-ux]`  
**Created**: 2026-04-10  
**Status**: Draft  
**Input**: User description: "ValuableAction Registry Admin UX + Projection Readiness"

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

### User Story 1 - Browse Canonical Action Catalog (Priority: P1)

As a community governance operator, I can open a community-scoped Valuable Action catalog and inspect action definitions, activation status, and governance-relevant metadata so I know the canonical work types that Engagements will later depend on.

**Why this priority**: Later Engagement UX is blocked without a trustworthy, visible action catalog per community.

**Independent Test**: Can be fully tested by opening one community and validating list/detail data matches canonical projected/on-chain state for that community only.

**Acceptance Scenarios**:

1. **Given** a valid community context, **When** the operator opens Valuable Actions, **Then** only actions for that community are shown.
2. **Given** at least one action exists, **When** the operator opens action detail, **Then** all operator-relevant metadata/rules and active/inactive status are visible.
3. **Given** the read model is behind or unavailable, **When** the operator loads the view, **Then** readiness state is explicit and no stale data is presented as authoritative.

---

### User Story 2 - Create And Edit Action Definitions (Priority: P2)

As an authorized community operator, I can initiate create/edit updates for Valuable Action definitions through the authority model that is actually deployed (direct write if allowed, governance proposal if governed), so catalog changes are valid and auditable.

**Why this priority**: Catalog quality depends on safe, explicit definition management aligned with actual authority constraints.

**Independent Test**: Can be tested independently by creating or editing an action and confirming the resulting state change path matches the contract authority model.

**Acceptance Scenarios**:

1. **Given** an operator with required authority path, **When** they submit a create request, **Then** the system uses the allowed write mechanism and shows resulting state transition.
2. **Given** updates are governance-controlled, **When** an operator attempts to edit, **Then** the UX routes them into proposal authoring instead of implying direct-admin write authority.
3. **Given** a successful change, **When** projection catches up, **Then** list/detail views reflect the updated canonical definition.

---

### User Story 3 - Manage Activation State Safely (Priority: P3)

As a governance operator, I can enable or disable a Valuable Action definition using the permitted authority path, so downstream Engagement submission can rely on a valid active set without protocol-side ambiguity.

**Why this priority**: Activation management is needed to keep a clean action surface for later Engagement flows.

**Independent Test**: Can be tested independently by toggling an action state and confirming both authority checks and projected readiness behavior.

**Acceptance Scenarios**:

1. **Given** an existing action, **When** operator disables it through allowed authority path, **Then** it appears inactive in catalog views.
2. **Given** an inactive action, **When** operator re-enables it via allowed path, **Then** it reappears as active after projection readiness.
3. **Given** a user without required authority, **When** they attempt activation changes, **Then** action controls are blocked and the reason is explicit.

---

### User Story 4 - Projection Readiness Transparency (Priority: P3)

As an operator, I can see projection readiness status for Valuable Action data so I can distinguish confirmed catalog state from pending/lagging projection state.

**Why this priority**: Prevents operational mistakes caused by hidden indexing lag.

**Independent Test**: Can be tested independently by simulating lag or stale projection and verifying explicit readiness indicators and fallback behavior.

**Acceptance Scenarios**:

1. **Given** projection lag, **When** operator opens catalog, **Then** readiness status is shown with deterministic guidance.
2. **Given** readiness is healthy, **When** operator opens catalog/detail, **Then** data is marked current with no ambiguous stale indicators.

### Edge Cases

- Operator opens community A but manually navigates to an action ID from community B.
- Projection returns partial action fields due to lag/backfill in progress.
- Activation update transaction/proposal succeeds on-chain but projection has not yet caught up.
- Governance-controlled communities where direct write controls are unavailable must not display direct-admin affordances.
- Empty registry for a newly deployed community.
- Action metadata/rules exist on-chain but enriched descriptive fields are absent.
- Duplicate semantic definitions (same business intent with different labels) are proposed; UX must still represent canonical entries without local shadow merge logic.
- Projection outage or degraded health during operator editing session.
- Contract-side rejection for invalid definition parameters.

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST provide a community-scoped Valuable Action catalog list view that only includes actions belonging to the active community context.
- **FR-002**: System MUST provide action detail view including canonical status, governance-relevant rule fields, and metadata required by operators to understand action semantics.
- **FR-003**: System MUST provide create/edit flows for action definitions that align with currently deployed authority paths for the target community.
- **FR-004**: When action writes are governance-controlled, system MUST route users through proposal authoring/approval UX and MUST NOT imply direct-admin write authority.
- **FR-005**: System MUST support activation state management (enable/disable) through the same authority constraints as deployed contracts.
- **FR-006**: System MUST display projection/read-model readiness state for catalog/detail views and clearly indicate when data may be delayed.
- **FR-007**: System MUST preserve deterministic mapping from displayed action data to canonical on-chain and projected sources, with no shadow authority or local override state.
- **FR-008**: System MUST expose action payload/parameters in operator-readable form before write submission or governance proposal creation.
- **FR-009**: System MUST provide explicit authorization feedback for blocked operations (insufficient role/authority path).
- **FR-010**: System MUST provide deterministic handling for empty-state communities (no actions defined yet).
- **FR-011**: System MUST remain compatible with later Engagement flows by representing action IDs/state in a form consumable by Engagement submission UX.
- **FR-012**: System MUST avoid introducing protocol redesign unless a hard blocker is proven and documented.

### Screen Contract

- **SCN-001 Valuable Action List (Community Scope)**: Shows only actions for selected community, each with action identifier, name/title, activation status, last change indicator, and readiness badge.
- **SCN-002 Valuable Action Detail**: Shows canonical definition fields, operator-facing rule metadata, activation status, authority mode (direct write vs governance-required), and projection readiness state.
- **SCN-003 Action Definition Create/Edit**: Captures definition fields and validations, shows expected write path, and presents explicit execution mode message (direct transaction or governance proposal flow).
- **SCN-004 Activation Management Surface**: Allows enable/disable request only when authority allows; otherwise presents disabled control with clear governance/role explanation.
- **SCN-005 Projection Readiness Banner/Panel**: Displays healthy/lagging/unavailable status, data recency signal, and operator guidance on whether changes are fully projected.
- **SCN-006 Community Boundary Guard**: If route or payload mismatches community context, UI must block cross-community mutation and show corrective navigation.

### Explicit Out Of Scope

- Full Engagement submission/review/resolution lifecycle UX.
- Juror assignment or verifier voting UX.
- Credential issuance flows.
- Position lifecycle flows.
- Protocol redesign not required to unblock this feature.

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
- **MR-006**: Spec MUST identify required changes, if any, across `contracts/`,
  `apps/indexer/`, `apps/web/` (Manager), and `test/` plus unit/integration
  tests; each affected area MUST define verification expectations.
- **MR-007**: If indexer schema changes are not required, spec MUST explicitly
  keep existing schema and define how the feature consumes current projections.

### Compatibility And Migration Requirements *(mandatory when applicable)*

- **CM-001**: Breaking changes MUST be explicitly marked and justified.
- **CM-002**: Required migration/replay/backfill steps MUST be defined for
  indexer and app consumers.
- **CM-003**: Event and ABI change impact on downstream niche dApps MUST be
  documented.
- **CM-004**: If no contract ABI/event changes are required, spec MUST state
  no migration/backfill requirement and preserve existing consumer compatibility.
- **CM-005**: Valuable Action identifiers used by Manager MUST remain stable for
  later Engagement flow integration.

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
- **DT-004**: If shipped behavior changes for Valuable Action admin/readiness
  flows, docs under `docs/EN/` covering architecture, governance, and
  verification surfaces MUST be synchronized.

### Assumptions

- Community context is already resolved in Manager routes and available to all relevant screens.
- Current deployed contracts and authority model are source-of-truth; UX adapts to that model rather than extending privileges.
- Current indexer projections for Valuable Actions do not yet cover full lifecycle catalog/detail requirements and MUST be extended in this feature using existing events on a strict no-ABI path.
- Governance proposal authoring path already exists and can be reused when direct admin writes are not allowed.

### Key Entities *(include if feature involves data)*

- **Valuable Action Definition**: Canonical community-scoped definition of a valid work/action type, including identifier, status (active/inactive), and operator-visible rule metadata.
- **Action Authority Mode**: Community+operation-level constraint describing whether updates are direct-admin or governance-controlled.
- **Projection Readiness State**: Operational indicator for whether displayed Valuable Action data is current, lagging, or unavailable relative to canonical state.
- **Community Scope Context**: Active community identity used to constrain reads/writes and prevent cross-community mutation.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: 100% of Valuable Action list/detail views in Manager remain strictly community-scoped with zero cross-community leakage in acceptance testing.
- **SC-002**: 100% of action create/edit/activate/deactivate operations expose the correct authority path (direct vs governance) for the target community in UAT.
- **SC-003**: 100% of blocked operations for unauthorized users show explicit, actionable authority feedback.
- **SC-004**: Projection readiness state is present on all catalog/detail screens and verified in healthy and lagging scenarios.
- **SC-005**: 0 unresolved contract/indexer/app drift items for Valuable Action fields used in Manager by merge time.
- **SC-006**: Later Engagement flow consumers can resolve active Valuable Action catalog from this feature without additional identifier translation.
