# Feature Specification: Governance Hub (Community-scoped) + Draft to Proposal Escalation

**Feature Branch**: `009-governance-hub-escalation`  
**Created**: 2026-04-09  
**Status**: Draft  
**Input**: User description: "Feature: Governance Hub (Community-scoped) + Draft -> Proposal Escalation"

## Clarifications

### Session 2026-04-09

- Q: For multi-choice proposal voting UX, should users cast one option or weighted splits across options? → A: Weighted split allocations across options, and allocations must sum to 100% of the voter's available voting power.
- Q: How should execution readiness be sourced on proposal detail? → A: Use indexer readiness fields first, and perform minimal chain reads only when readiness fields are missing or stale.
- Q: How should proposalId be resolved after draft escalation for navigation? → A: Attempt proposalId derivation from transaction receipt logs/events first; if not derivable, navigate to proposals list and show indexing-lag notice.
- Q: How should weighted allocation totals be validated and displayed in the vote UI? → A: Validate allocations in basis points and require an exact total of 10,000 bps; display values in the UI as percentages with two decimal places.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse Community Governance Proposals (Priority: P1)

A community participant navigates to governance pages and can list and inspect only proposals belonging to the selected community.

**Why this priority**: Community-scoped proposal visibility is the core governance UX and a prerequisite for safe voting.

**Independent Test**: Can be fully tested by loading governance hub, proposals list, and proposal detail for a known community and verifying all displayed proposals belong to that community.

**Acceptance Scenarios**:

1. **Given** a valid community with existing proposals, **When** the user visits `/communities/[communityId]/governance`, **Then** the hub page renders and includes a proposals entry point.
2. **Given** a valid community, **When** the user visits `/communities/[communityId]/governance/proposals`, **Then** the list shows only proposals scoped to that `communityId` and each item links to a community-scoped proposal detail page.
3. **Given** a proposal detail route where the proposal belongs to a different community, **When** the page loads, **Then** a mismatch warning appears with a correction link to the proper community route.

---

### User Story 2 - Vote and Track Proposal Lifecycle (Priority: P2)

A voter opens a proposal detail page, submits a vote, receives clear confirmation or failure feedback, and sees lifecycle state including readiness for timelock execution.

**Why this priority**: Governance participation requires clear voting interaction and transparent lifecycle status.

**Independent Test**: Can be fully tested by opening a proposal detail, submitting a vote in a connected wallet state, and validating UI state transitions and lifecycle indicators.

**Acceptance Scenarios**:

1. **Given** a community multi-choice proposal with voting available, **When** the voter submits weighted allocations, **Then** the UI validates allocations sum to 100% of available voting power before submitting the vote transaction.
2. **Given** a proposal with known lifecycle state, **When** detail data is loaded, **Then** the page displays status labels from available states (Pending, Active, Succeeded, Defeated, Queued, Executed) and execution readiness from indexer fields first.
3. **Given** execution readiness fields are missing or stale in indexed data, **When** detail data is loaded, **Then** the page performs minimal chain reads to resolve queued/executable/executed state.
4. **Given** a valid weighted vote submission, **When** the voter confirms the transaction, **Then** the UI shows pending, submitted, and confirmation/error states without leaving the page in an ambiguous state.
5. **Given** weighted allocations are edited in the vote UI, **When** values are rendered and validated, **Then** users see percentages with two decimal places and submission is blocked unless the internal total equals exactly 10,000 bps.

---

### User Story 3 - Escalate Draft to Proposal (Priority: P1)

A contributor escalates an existing draft action bundle into a governance proposal from draft detail and is guided to where they can track the created proposal.

**Why this priority**: Draft-to-proposal escalation is the key workflow that connects coordination output to governance execution.

**Independent Test**: Can be fully tested by opening a valid draft detail, triggering escalation with required inputs, mocking transaction success, and verifying navigation outcome.

**Acceptance Scenarios**:

1. **Given** a draft in the selected community with a non-empty action bundle and a connected wallet on the correct network, **When** the user submits escalation inputs, **Then** the app invokes the community DraftsManager escalation method and shows transaction progress/result states.
2. **Given** escalation succeeds and a proposal identifier can be derived from transaction receipt logs/events, **When** processing completes, **Then** the user is redirected to `/communities/[communityId]/governance/proposals/[proposalId]`.
3. **Given** escalation succeeds but proposal identifier is not derivable from receipt logs/events or indexed data is delayed, **When** processing completes, **Then** the user is redirected to `/communities/[communityId]/governance/proposals` with a clear note that proposal visibility may lag indexing.

---

### User Story 4 - Access Governance from Community Overview (Priority: P2)

A user on community overview can open proposals directly via enabled CTAs and does not encounter 404 routes.

**Why this priority**: Prevents dead-end navigation and completes governance discoverability from primary community entry points.

**Independent Test**: Can be fully tested by rendering overview and asserting proposals CTAs are enabled and route to the proposals page.

**Acceptance Scenarios**:

1. **Given** the community overview page is rendered, **When** the user selects proposals CTA, **Then** navigation targets `/communities/[communityId]/governance/proposals` and route resolves.
2. **Given** parameters capability is not yet implemented, **When** the overview is rendered, **Then** parameters CTA remains visibly disabled.

### Edge Cases

- Draft escalation is requested for a draft that exists but belongs to another community.
- Draft action bundle is incomplete or empty (`targets`, `values`, `calldatas`, or `actionsHash` missing/invalid).
- Wallet is disconnected, connected to the wrong network, or user rejects the transaction.
- Proposal detail route contains a valid proposal identifier that cannot be found yet due to indexing lag.
- Proposals list has zero proposals for the selected community.
- Lifecycle data contains a status outside expected labels; UI must fall back to a safe unknown-state display.

## Requirements *(mandatory)*

### Assumptions

- Existing contracts, ABI surfaces, and indexer entities already provide proposal and vote data required by current governance pages.
- Existing community module resolution from CommunityRegistry is available to resolve the community DraftsManager address.
- Proposal creation outside draft escalation remains out of scope and must stay disabled.
- Timelock execution behavior is read-only in this feature; no new execution actions are introduced.

### Functional Requirements

- **FR-001**: The system MUST provide accessible routes for:
  - `/communities/[communityId]/governance`
  - `/communities/[communityId]/governance/proposals`
  - `/communities/[communityId]/governance/proposals/[proposalId]`
- **FR-002**: The governance hub page MUST show community context (including community identifier) and a proposals card that links to the community-scoped proposals list.
- **FR-003**: The proposals list page MUST display only proposals associated with the selected `communityId`.
- **FR-004**: Each proposal listed for a community MUST link to its community-scoped detail route.
- **FR-005**: The proposals list and detail pages MUST display proposal lifecycle status using available states: Pending, Active, Succeeded, Defeated, Queued, and Executed.
- **FR-006**: The proposal detail page MUST provide weighted multi-choice vote interaction where users can allocate voting power across options, with internal validation in basis points requiring an exact total of 10,000 before submission.
- **FR-006a**: The proposal detail page MUST display explicit in-progress, success, and failure confirmation states for vote submission.
- **FR-006b**: Weighted allocations MUST be rendered in the UI as percentages with exactly two decimal places.
- **FR-007**: The proposal detail page MUST derive execution readiness from indexer fields first and MAY use minimal chain reads only when readiness data is missing or stale, without altering protocol semantics.
- **FR-008**: If a proposal requested via community-scoped route belongs to a different community, the detail page MUST show a mismatch guard banner and correction link to the proper community route.
- **FR-009**: From community-scoped draft detail, the system MUST expose an "Escalate to proposal" action.
- **FR-010**: Escalation MUST be blocked unless all preconditions are met: wallet connected, correct network, draft exists for selected community, and draft action bundle is non-empty.
- **FR-011**: Escalation input UX MUST support proposal description and multi-choice configuration (`multiChoice`, `numOptions`) with safe defaults.
- **FR-012**: On escalation submit, the system MUST call the community DraftsManager escalation method using module resolution for that community.
- **FR-013**: On successful escalation, the system MUST attempt to derive `proposalId` from transaction receipt logs/events and navigate to proposal detail when derivation succeeds; otherwise it MUST navigate to the proposals list and disclose indexing delay.
- **FR-014**: Community overview proposals CTAs MUST be enabled and MUST navigate to the community-scoped proposals route without 404 behavior.
- **FR-015**: Community overview parameters CTA MUST remain disabled when parameters functionality is not implemented.
- **FR-016**: The feature MUST include tests for route availability, proposal scoping, mismatch guard behavior, escalation flow, and overview CTA navigation.

### Monorepo Impact Requirements *(mandatory)*

- **MR-001**: Impact is limited to `apps/web` governance and community overview UX, route handling, and associated frontend tests.
- **MR-002**: No contract interface changes and no indexer schema/query contract changes are permitted in this feature.
- **MR-003**: Proposal and lifecycle views MUST rely on canonical contract/indexer data and MUST NOT introduce alternate authority or derived state that can conflict with on-chain truth.
- **MR-004**: Privileged governance authority remains unchanged: Governor/Timelock path is informationally surfaced only; this feature introduces no authority mutations.
- **MR-005**: UI behavior for escalation and proposal lifecycle MUST map to currently implemented DraftsManager, Governor, CountingMultiChoice, and Timelock capabilities.

### Compatibility And Migration Requirements *(mandatory when applicable)*

- **CM-001**: This feature MUST be non-breaking for contracts, indexer schema, and existing proposal/vote data consumers.
- **CM-002**: No migration, replay, or backfill is required because data models and protocol surfaces remain unchanged.
- **CM-003**: Any newly added frontend assumptions about existing fields MUST be validated against current indexed data before merge.

### Documentation And Terminology Requirements *(mandatory)*

- **DT-001**: Specification and UI copy MUST use current Shift terminology, including Drafts, Proposals, Governor/Timelock, and community-scoped governance.
- **DT-002**: Documentation updates are required only if shipped behavior meaningfully changes user-facing governance navigation or escalation expectations.
- **DT-003**: If implementation produces governance workflow deltas from current staging status, `.github/project-management/STATUS_REVIEW.md` MUST be updated in the implementation phase.

### Key Entities *(include if feature involves data)*

- **Community Governance Hub**: Community-scoped governance entry view containing navigation cards and governance health/context indicators.
- **Community Proposal Summary**: Lightweight proposal record for list display, including proposal identifier, title/description snippet, status, and community association.
- **Community Proposal Detail**: Full proposal view including metadata, option set (for multi-choice proposals), lifecycle state, execution readiness, and voting controls.
- **Draft Escalation Request**: User-submitted escalation payload derived from a draft action bundle plus governance metadata inputs (`multiChoice`, `numOptions`, proposal description).
- **Escalation Result State**: UI-visible outcome object for pending/success/failure and navigation target determination under potential indexing lag.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of required governance routes resolve for valid community identifiers in automated route tests.
- **SC-002**: In scoped data tests, 100% of proposals rendered on a community proposals page belong to that community.
- **SC-003**: In mismatch tests, 100% of cross-community proposal route attempts display a warning and correction link.
- **SC-004**: In escalation flow tests, users can complete draft-to-proposal escalation and reach a valid governance destination (detail or list fallback) in 95%+ of successful transaction simulations.
- **SC-005**: Community overview proposals CTA tests confirm enabled navigation and zero 404 regressions for community-scoped proposals access.
- **SC-006**: Feature delivery introduces zero contract changes, zero indexer schema changes, and zero voting/timelock semantic changes.
