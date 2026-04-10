# Feature Specification: Direct Proposal Creation

**Feature Branch**: `011-direct-proposal-creation`  
**Created**: 2026-04-09  
**Status**: Draft  
**Input**: User description: "Allow governance users to create proposals directly through ShiftGovernor from the Manager using existing action bundle composer output without depending on DraftsManager.escalateToProposal"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Submit Direct Proposal (Priority: P1)

As a community governance user, I can create a proposal directly from the community Governance UI using the existing allowlist-constrained composer output, without creating or escalating a draft.

**Why this priority**: This is the core unblocker for governance authoring when DraftsManager escalation is not desired or not available.

**Independent Test**: In a community with a resolved governor address and valid composer output, submit a direct proposal and confirm a proposal ID is recovered and navigation proceeds to a proposal destination.

**Acceptance Scenarios**:

1. **Given** a selected community with an exact governor mapping and valid composer action bundle (targets, values, calldatas, description), **When** user submits direct proposal creation, **Then** the Manager submits directly to ShiftGovernor proposal creation and shows pending/confirmed transaction state.
2. **Given** successful transaction confirmation, **When** proposal creation result is parsed, **Then** the Manager resolves proposalId and navigates to community-scoped proposal detail when available.

---

### User Story 2 - Resilient Post-Submit Navigation (Priority: P2)

As a governance user, I receive predictable navigation after submit even when indexer data is delayed.

**Why this priority**: Governance UX must remain robust under real-world indexing delay while preserving confidence that proposal creation succeeded.

**Independent Test**: Force indexer lag conditions after a successful proposal transaction and confirm fallback behavior lands user in the community proposals list with contextual success guidance.

**Acceptance Scenarios**:

1. **Given** proposal transaction succeeded but detail data is not yet indexer-visible, **When** post-submit routing runs, **Then** Manager falls back to community proposals list and preserves proposal tracking context.
2. **Given** proposal detail becomes available shortly after submit, **When** lookup retry/refresh occurs, **Then** user can reach detail without creating a duplicate proposal.

---

### User Story 3 - Fail-Safe Error Handling (Priority: P3)

As a governance user, I receive clear, actionable outcomes for rejected signatures, transaction reverts, or invalid governance context, and no invalid direct proposal is attempted.

**Why this priority**: Prevents unsafe or confusing governance actions and aligns with strict allowlist and exact community-governor scoping constraints.

**Independent Test**: Simulate wallet rejection, contract revert, and mismatched governor/community context and verify no silent failure, no unintended submission, and accurate error states.

**Acceptance Scenarios**:

1. **Given** user rejects wallet signature, **When** submit is attempted, **Then** flow exits cleanly with no proposal side effects and clear retry messaging.
2. **Given** on-chain proposal call reverts, **When** submit is attempted, **Then** error state exposes revert outcome and keeps editable composer state.
3. **Given** selected community context does not match resolved governor context, **When** submit is attempted, **Then** submission is blocked before transaction prompt.

## Screen Contract

### Governance Screen Scope

- The feature adds direct proposal creation entry and submit flow within the existing community-scoped Governance area.
- It reuses existing composer state and action bundle output; it does not introduce a parallel action authoring surface.

### Required Inputs

- Community context: exact communityId and resolved governor address for that community.
- Composer payload: targets, values, calldatas, and proposal description/metadata payload currently supported by governance UX.
- Allowlist context: the same deterministic allowlist/composer gating already enforced in expert and guided flows.

### Submit Behavior

- Submit path calls ShiftGovernor direct proposal creation using the existing composer output payload.
- No payload mutation or heuristic widening of targets/functions is permitted during submit.
- Pre-submit validation must confirm governor/community scoping and allowlist compliance of the action bundle.

### Post-Submit Routing

- Primary route: community proposal detail for recovered proposalId.
- Fallback route: community proposals list when detail cannot be resolved immediately (indexer lag or temporary read gap).
- User-facing outcome should include confirmation context sufficient to locate proposal later.

## Edge Cases

- Wallet signature rejected before transaction broadcast.
- Transaction submitted but reverted on-chain (including role/authority reverts).
- Transaction confirmed but proposal detail unavailable due to indexer lag.
- Community context changed during composition (stale governor resolution).
- Action bundle references function/target no longer allowed by current allowlist snapshot.
- Duplicate submit attempts while prior transaction is pending.
- Chain/provider mismatch between UI network and community deployment network.

## Out Of Scope

- Removing, replacing, or rewriting DraftsManager escalation flows.
- Introducing new on-chain governance contracts or modifying ShiftGovernor behavior unless a hard blocker is proven.
- Expanding allowlist surface, adding heuristic target/function discovery, or bypassing current composer gating policy.
- New governance voting/execution UX beyond direct proposal creation and immediate post-submit routing behavior.
- Indexer schema redesign not strictly required for existing proposal read patterns.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Manager MUST provide a direct proposal creation path in community-scoped Governance UI that uses the existing composer action bundle output.
- **FR-002**: Direct proposal creation MUST submit through ShiftGovernor proposal creation flow and MUST NOT depend on DraftsManager.escalateToProposal.
- **FR-003**: Submission payload MUST include exactly the composer-generated targets, values, calldatas, and description/metadata fields required by existing governance flow.
- **FR-004**: Direct proposal creation MUST enforce existing allowlist/composer constraints at pre-submit time; only currently permitted actions may be submitted.
- **FR-005**: System MUST NOT mutate or widen the composer-produced payload (targets, values, calldatas, description) heuristically at submit time.
- **FR-006**: Community scoping and governor resolution MUST be exact; submission MUST be blocked when community/governor context is mismatched.
- **FR-007**: After successful submit confirmation, system MUST recover proposalId using this ordered strategy: (1) decode governor creation events from receipt logs, (2) deterministic read fallback (`getProposalId`/`hashProposal`) from the submitted payload, (3) unresolved fallback route to community proposals list with txHash context.
- **FR-008**: When proposal detail is immediately resolvable, system MUST navigate to community proposal detail.
- **FR-009**: When proposal detail is not immediately resolvable, system MUST navigate to community proposals list with resilient success context and non-error fallback messaging.
- **FR-010**: Wallet rejection MUST produce non-destructive failure handling with editable composer state preserved.
- **FR-011**: Revert/failure outcomes MUST be surfaced to user with clear status and without clearing the composed bundle.
- **FR-012**: Existing draft escalation flow MUST remain available and behaviorally unchanged.
- **FR-013**: Read-path policy MUST stay indexer-first with safe chain fallback, consistent with existing governance UX patterns.
- **FR-014**: Feature MUST rely on current deployed authority model and MUST NOT assume unimplemented or aspirational protocol capabilities.
- **FR-015**: Contract source changes are disallowed unless implementation proves a hard blocker; any such blocker must be explicitly documented before scope expansion.

### Monorepo Impact Requirements *(mandatory)*

- **MR-001**: Feature spec MUST identify impact across contracts, indexer, Manager app, tests, and documentation.
- **MR-002**: If contract interfaces or events change (not expected), spec MUST define compatibility expectations and migration requirements for indexer and downstream consumers.
- **MR-003**: Proposal read/write state in Manager and indexer MUST map to canonical on-chain proposal state without introducing shadow authority.
- **MR-004**: Role/authority model MUST remain Governor -> Timelock controlled execution path; direct proposal creation MUST not bypass governance authority boundaries.
- **MR-005**: Community-governor resolution and scoping logic in Manager MUST reflect actual deployed module wiring and community registry data.
- **MR-006**: Test impact MUST include unit and integration coverage for direct submit, proposalId recovery, fallback routing, and failure conditions.

### Compatibility And Migration Requirements *(mandatory when applicable)*

- **CM-001**: Existing draft escalation UX and routes MUST remain backward compatible.
- **CM-002**: Existing proposal detail/list consumers MUST remain compatible with direct-created proposals; no proposal source-type partitioning may break reads.
- **CM-003**: If any indexer query behavior changes, required replay/backfill or rollout notes MUST be documented before release.
- **CM-004**: No breaking governance contract ABI/event assumptions are expected for this feature.

### Documentation And Terminology Requirements *(mandatory)*

- **DT-001**: `neuromancer/SHIFT_SYSTEM.md` and `contracts/FEATURES.md` MUST be updated if shipped behavior changes user-visible governance authoring capabilities.
- **DT-002**: Spec and implementation artifacts MUST use current Shift terminology (RequestHub, DraftsManager, ShiftGovernor, Timelock, Engagements, ValuableActionSBT, VPS, RevenueRouter, PositionManager).
- **DT-003**: If feature delivery updates current status/risk/priority/workflow assumptions, `.github/project-management/IMPLEMENTATION_STATUS.md` and `.github/project-management/STATUS_REVIEW.md` MUST be synchronized.

### Feature Impact Map

- **Contracts**: No contract source changes expected.
- **Manager/Web app**: Governance UI direct-proposal submit flow, governor/community resolution checks, post-submit routing, error handling.
- **Indexer**: Existing proposal list/detail reads reused; verify no source-of-proposal filtering assumptions break direct path.
- **Tests**: Add/refresh coverage for direct submit path, proposalId recovery, fallback list route, wallet reject/revert/mismatch handling.
- **Documentation**: Governance UX docs and shipped behavior notes updated if direct creation becomes user-facing default/option.

### Assumptions

- Composer output from features 008/010 is already constrained to deterministic allowlist-permitted actions.
- Governance hub foundations from feature 009 already provide proposal list/detail surfaces and routing patterns.
- Runtime admin handoff on Base Sepolia is complete and no longer blocks timelock/governance authority alignment.

### Key Entities *(include if feature involves data)*

- **DirectProposalIntent**: Community-scoped request to submit a governance proposal directly, containing composer-generated action bundle and description payload.
- **CommunityGovernorContext**: Exact community-to-governor resolution object used to validate submit destination.
- **ProposalCreationResult**: Transaction-derived submit outcome with resolved proposalId (when available), transaction hash, and routing decision.
- **ProposalRoutingState**: Post-submit navigation state indicating detail route or list fallback with success context.
- **ProposalSubmitErrorState**: Structured user-visible failure outcome for wallet rejection, revert, context mismatch, or unavailable reads.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of successful direct proposal submissions produce either immediate detail navigation or deterministic fallback to proposals list with success context.
- **SC-002**: 100% of direct submission attempts that violate allowlist or community/governor scoping are blocked before transaction prompt.
- **SC-003**: 100% of wallet rejection and revert outcomes preserve composer state and provide actionable non-ambiguous user feedback.
- **SC-004**: Direct-created proposals appear in existing community proposal list/detail flows without requiring manual data repair.
- **SC-005**: Existing draft escalation flow remains functional and unchanged in behavior after release.
- **SC-006**: No contract interface/event changes are introduced for this feature unless an explicit blocker is documented and approved.
