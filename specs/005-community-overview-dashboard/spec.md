# Feature Specification: Community Detail Dashboard (Overview)

**Feature Branch**: `005-community-overview-dashboard`  
**Created**: 2026-03-24  
**Status**: Draft  
**Input**: User description: "Feature: Community Detail Dashboard (Overview)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Community-Scoped Overview Hub (Priority: P1)

As a community manager, when I open `/communities/[communityId]`, I need a single overview hub that clearly identifies the selected community, shows current system health, and summarizes authoritative configuration so I can immediately understand whether the community is operational and correctly wired.

**Why this priority**: This is the entry point for all community management tasks and must prevent cross-community confusion or incorrect assumptions.

**Independent Test**: Can be fully tested by loading multiple community IDs and verifying header, health, modules, and parameter summaries always reflect the selected `communityId`.

**Acceptance Scenarios**:

1. **Given** a valid `communityId`, **When** the user opens `/communities/[communityId]`, **Then** the header shows `communityId`, display name or fallback `Community #<id>`, network/environment, indexer health, and the Actions area.
2. **Given** chain reads succeed and indexer is unavailable, **When** the overview loads, **Then** modules summary and parameter summary still render from authoritative chain reads while activity previews show indexer failure messaging.
3. **Given** the connected wallet lacks authority, **When** the page renders, **Then** `Edit parameters` is visibly disabled (or otherwise non-actionable) and does not imply privileged mutation access.

---

### User Story 2 - Recent Activity Previews with Honest State (Priority: P2)

As a community member, I need quick previews of Requests, Drafts, and Proposals (latest 3 each) with clear freshness and error states so I can decide where to navigate next without misleading data.

**Why this priority**: Previews drive day-to-day coordination and governance workflows and must remain trustworthy under indexer lag/error conditions.

**Independent Test**: Can be tested by simulating indexer `synced`, `lagging`, `error`, and empty states and validating each panel's row count, CTA visibility, and warning/error behavior.

**Acceptance Scenarios**:

1. **Given** indexer is synced and data exists, **When** overview renders, **Then** each preview panel shows exactly 3 latest items with identifier/title, status, timestamp, and `View all` plus `Create new` CTAs.
2. **Given** indexer is lagging, **When** overview renders, **Then** a lag warning is shown and panels clearly indicate previews may be stale.
3. **Given** indexer errors, **When** overview renders, **Then** panels show error state plus retry affordance while chain-backed configuration sections remain visible if chain reads succeed.

---

### User Story 3 - Community Navigation with Capability Signaling (Priority: P3)

As a user managing one community, I need clear community-scoped section tabs so I can navigate across Coordination, Governance, Verification, Economy, and Commerce from the overview while seeing which areas are not yet available.

**Why this priority**: Discoverability and scope correctness prevent dead-end navigation and reduce confusion about incomplete features.

**Independent Test**: Can be tested by validating tab visibility/order, community-scoped routing targets, and disabled `Coming soon` behavior for unimplemented sections.

**Acceptance Scenarios**:

1. **Given** the overview page, **When** tabs render, **Then** `Overview`, `Coordination`, `Governance`, `Verification`, `Economy`, and `Commerce` are all visible in a consistent order.
2. **Given** an unimplemented section, **When** the user inspects its tab, **Then** the tab is disabled and includes a `Coming soon` affordance without hiding the tab.

### Edge Cases

- `communityId` is syntactically valid but not found on-chain: page shows a not-found or unavailable community state without falling back to any default community.
- Community display name is empty/unset: header falls back to `Community #<id>` while preserving the same `communityId` scope.
- A module pointer exists but points to an address without bytecode: module status is `missing` (not `present`).
- Chain reads partially fail (some module or parameter reads fail): successfully read values remain visible with source indicator; failed values show `unavailable` without blocking the entire section.
- All three preview datasets are empty: each panel renders an empty state plus `Create new` CTA.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST render `/communities/[communityId]` as a community-scoped Overview bound strictly to the route `communityId`, with no default-community leakage.
- **FR-002**: The Overview header MUST display: `communityId`, display name with fallback `Community #<id>`, network/environment indicator, indexer health state (`synced`, `lagging`, `error`, `unknown`), and an Actions area containing `View parameters` and `Edit parameters`.
- **FR-003**: The modules summary MUST list known community module pointers from on-chain source of truth and show, per module, module name, shortened address, and status `present` or `missing` (`missing` when zero address or no bytecode at address).
- **FR-004**: The parameters summary MUST display the deterministic subset defined in `Parameter Subset Mapping (mandatory)`, with value, source marker (`on-chain verified` or `unavailable`), and a `last checked` timestamp derived from client time.
- **FR-005**: The deterministic parameters subset for the Overview MUST be exactly the mapped parameters defined in `Parameter Subset Mapping (mandatory)` and MUST NOT be changed by per-developer interpretation.
- **FR-006**: Activity previews MUST provide three community-scoped panels (`Requests`, `Drafts`, `Proposals`) with latest `N=3` items each, and each row MUST include identifier/title, status, and timestamp.
- **FR-007**: Each activity preview panel MUST include `View all` and `Create new` CTAs that route to the exact community-scoped targets defined in `Routing Contract (mandatory)`.
- **FR-008**: Navigation tabs MUST include `Overview`, `Coordination`, `Governance`, `Verification`, `Economy`, and `Commerce`; tabs for unavailable sections MUST remain visible but disabled and marked `Coming soon`.
- **FR-009**: Authority gating MUST be enforced in the UI for privileged actions: `Edit parameters` and any privileged CTA MUST be disabled or hidden when the connected wallet lacks required permissions.
- **FR-010**: The Overview MUST use a hybrid data strategy: indexer-backed previews for activity lists and chain-backed reads for critical configuration summaries; when chain verification fails, affected values MUST be marked unknown/unavailable rather than inferred.
- **FR-011**: Indexer lag/error states MUST be handled honestly: lagging shows staleness warning; error shows error state with retry; chain-backed configuration sections continue rendering when possible.
- **FR-012**: The Overview MUST NOT render non-community-scoped internal navigation links.
	- Any internal navigation href rendered on the Overview MUST start with `/communities/[communityId]`.
	- The Overview MAY render clearly labeled external help/docs links (for example documentation or support) only when they are visibly marked as external, open in a new tab/window, and do not navigate within the app to non-community-scoped internal routes.
- **FR-013**: The Overview MUST enforce a safety guarantee that prevents unauthorized mutation attempts from this screen: when required authority is absent, privileged actions remain non-actionable and no direct governance/timelock mutation flow is exposed.

## Indexer Health Rule (mandatory)

### Indexer lagging rule

Use a deterministic threshold constant:

- `INDEXER_LAG_THRESHOLD_SECONDS = 600` (10 minutes).

Freshness source for lagging computation MUST be the newest timestamp among preview datasets rendered on the Overview:

- latest Requests item timestamp,
- latest Drafts item timestamp,
- latest Proposals item timestamp.

Computation rule:

- If at least one timestamp is available, compute age from client `now` against the newest timestamp.
- If `ageSeconds > INDEXER_LAG_THRESHOLD_SECONDS`, health state MUST be `lagging`.
- If `ageSeconds <= INDEXER_LAG_THRESHOLD_SECONDS` and health endpoint is healthy, health state MUST be `synced`.
- If all three preview datasets are empty (no timestamps available), lagging cannot be computed and health state MUST be `unknown` (empty-data unknown state).

Lagging UI behavior:

- Show a warning banner indicating previews may be stale.
- Health indicator label MUST display `lagging`.

## Routing Contract (mandatory)

The following route targets are the contract for this feature and are deterministic.
If a destination is not implemented yet, the corresponding tab/link remains visible and disabled with `Coming soon`.
CTAs to unimplemented destinations MUST be disabled and MUST NOT navigate.

- Parameters actions:
	- View parameters -> `/communities/[communityId]/parameters`
	- Edit parameters -> `/communities/[communityId]/parameters/edit`
	- If either destination is not implemented in this feature, the corresponding CTA MUST be disabled with `Coming soon` and MUST NOT navigate.

- Requests preview CTAs:
	- View all -> `/communities/[communityId]/coordination/requests`
	- Create new -> `/communities/[communityId]/coordination/requests/new`
- Drafts preview CTAs:
	- View all -> `/communities/[communityId]/coordination/drafts`
	- Create new -> `/communities/[communityId]/coordination/drafts/new`
- Proposals preview CTAs:
	- View all -> `/communities/[communityId]/governance/proposals`
	- Create new -> `/communities/[communityId]/governance/proposals/new`
- Tabs:
	- Overview -> `/communities/[communityId]`
	- Coordination -> `/communities/[communityId]/coordination`
	- Governance -> `/communities/[communityId]/governance`
	- Verification -> `/communities/[communityId]/verification`
	- Economy -> `/communities/[communityId]/economy`
	- Commerce -> `/communities/[communityId]/commerce`

	### Address Display Contract (mandatory)

	Module address display in the Overview MUST use a deterministic shortened format:

	- `0x` + first 4 hex chars + ellipsis + last 4 hex chars
	- Example: `0x1234...abcd`

	If address is missing/invalid, display `unavailable` and keep module row visible.

### Parameter Subset Mapping (mandatory)

The parameter subset is deterministic and fixed for this Overview.

| UI Parameter | Mapping Type | Mapping Identifier Or Rule | Critical Chain Verification | Display Unit | Formatting Rule |
| --- | --- | --- | --- | --- | --- |
| Governance debate window | A | `governance.debateWindow` | Yes | seconds | Show human duration and raw seconds |
| Governance voting window | A | `governance.votingWindow` | Yes | seconds | Show human duration and raw seconds |
| Execution delay | A | `governance.executionDelay` | Yes | seconds | Show human duration and raw seconds |
| Proposal eligibility threshold | A | `eligibility.proposalThreshold` | Yes | integer threshold | Whole number with no decimals |
| Revenue split workers | A | `economics.revenueSplit.workersBps` | Yes | bps | Convert bps to percentage with up to 2 decimals and include raw bps |
| Revenue split treasury | A | `economics.revenueSplit.treasuryBps` | Yes | bps | Convert bps to percentage with up to 2 decimals and include raw bps |
| Revenue split investors | A | `economics.revenueSplit.investorsBps` | Yes | bps | Convert bps to percentage with up to 2 decimals and include raw bps |
| Verifier panel size | A | `verifier.panelSize` | Yes | integer threshold | Whole number with no decimals |
| Verifier minimum approvals | A | `verifier.minimumApprovals` | Yes | integer threshold | Whole number with no decimals |

If any mapping identifier above cannot be resolved from stable protocol exposure at runtime, use this fallback rule:

- Mapping Type B rule: mark that parameter as `unavailable`, keep the row visible, preserve section rendering, and include a non-blocking note that stable mapping exposure is a future protocol/indexer improvement outside this feature.

A parameter value MUST be shown as `unavailable` when at least one of the following is true:

- The chain read for its mapping fails.
- The mapping identifier cannot be resolved.
- The returned value is missing or invalid for its declared unit.

### Monorepo Impact Requirements *(mandatory)*

- **MR-001**: Contracts layer impact is read-only for this feature; no protocol mechanics changes are required, and canonical authority remains on-chain via CommunityRegistry and ParamController.
- **MR-002**: Indexer impact is limited to preview retrieval and health reporting for Requests, Drafts, and Proposals; no new protocol authority may be introduced in indexed state.
- **MR-003**: Manager app impact includes new overview composition, authority-gated actions, health-aware messaging, and strict community-scoped routing from header, previews, and tabs.
- **MR-004**: Tests MUST cover route scoping, indexer state handling, chain read failure behavior, authority gating, and link correctness for all overview CTAs.
- **MR-005**: Documentation impact MUST include spec-level alignment to canonical Shift terminology and explicit mention of hybrid truth model (indexer for fast lists, chain for authoritative config).

### Compatibility And Migration Requirements *(mandatory when applicable)*

- **CM-001**: This feature introduces no breaking contract interface changes and no protocol migration requirements.
- **CM-002**: If existing indexer projections are insufficient for latest-3 previews or health metadata, additive query/projection changes MAY be introduced without altering existing consumer semantics.
- **CM-003**: Legacy non-community-scoped navigation entry points must not be reused on the Overview path; any retained legacy routes must remain clearly outside this feature scope.

### Documentation And Terminology Requirements *(mandatory)*

- **DT-001**: Specification language MUST use current Shift terminology: Requests, Drafts, Proposals, Engagements, ValuableActionSBT, VPS, Governor/Timelock.
- **DT-002**: If shipped behavior changes the implementation matrix or strategic risk posture, `.github/project-management/IMPLEMENTATION_STATUS.md` and `.github/project-management/STATUS_REVIEW.md` MUST be updated together.
- **DT-003**: `neuromancer/SHIFT_SYSTEM.md`, `contracts/FEATURES.md`, `Flows.md`, and `Layers.md` MUST be updated only if this feature changes protocol behavior, architecture, or flow definitions. Otherwise, required documentation updates are limited to `.github/project-management/IMPLEMENTATION_STATUS.md`, `.github/project-management/STATUS_REVIEW.md`, and relevant `docs/EN/` pages only when they describe this specific screen.

### Key Entities *(include if feature involves data)*

- **CommunityOverviewHeader**: Identity and operational context for one community (`communityId`, display name/fallback, network, indexer health, action availability).
- **ModulePointerSummaryItem**: One module pointer resolved from community registry (`module name`, `address`, `present/missing`, verification outcome).
- **ParameterSummaryItem**: One key governed parameter (`parameter name`, `value`, verification source, `last checked` timestamp).
- **ActivityPreviewItem**: One preview row for requests/drafts/proposals (`identifier/title`, `status`, `timestamp`, community scope).
- **SectionTabState**: Navigation item state (`enabled` or disabled with `Coming soon`) with community-scoped target mapping.

### Assumptions

- The authority check for `Edit parameters` can be determined from currently available role/permission signals already used in Manager permission-gated actions.
- Requests, Drafts, and Proposals list previews are already obtainable from existing indexed data without introducing mandatory breaking schema changes.
- Module pointer verification can evaluate both pointer existence and bytecode presence from chain reads within acceptable page-load behavior.
- This feature delivers only the Overview hub and scoped navigation affordances; full section pages beyond current implemented routes remain out of scope.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In validation runs across at least 3 distinct `communityId` values, 100% of overview renders show data scoped to the route community and 0 cases of default-community leakage.
- **SC-002**: In synced indexer state, each preview panel displays at most 3 latest items and both required CTAs in 100% of tested scenarios.
- **SC-003**: In lagging and error simulations, users receive explicit state messaging in 100% of tested scenarios, and chain-backed configuration summary remains visible whenever chain reads succeed.
- **SC-004**: In permission-gating tests, unauthorized sessions show 0 enabled privileged parameter-edit actions.
- **SC-005**: In chain-read failure simulations for modules/parameters, affected values are labeled `missing` or `unavailable` without false-positive `on-chain verified` labels in 100% of tested scenarios.
- **SC-006**: Usability checks confirm users can reach the correct community-scoped destination from all `View all` and `Create new` actions in one click for each preview panel.

### DoD Evidence

- Screenshot of Overview showing header, configuration summaries, activity previews, and section tabs.
- Screenshot showing `Edit parameters` disabled when the user is unauthorized.
- Screenshot showing indexer error state while configuration summaries still render when chain reads succeed.

No transaction hashes are required for this read-only feature.
