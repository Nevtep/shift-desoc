# Feature Specification: Manager Home Deploy Wizard And Communities Index

**Feature Branch**: `003-manager-home-deploy`  
**Created**: 2026-03-06  
**Status**: Draft  
**Input**: User description: "Feature: Manager Home — Community Deploy Wizard + Communities Index"

## Clarifications

### Session 2026-03-06

- Q: Which transaction authority model should the wizard use (server signer vs user-signed vs hybrid)? → A: User-signed on-chain flow.
- Q: How should shared infrastructure be handled by the wizard? → A: Wizard supports per-community stack only; shared infra is a hard precondition.
- Q: How should resume targeting/authorization work for multi-community deployments? → A: Resume is only allowed for unfinished deployments started by the same deployer wallet for that community/session.
- Q: What should define verification pass/fail scope? → A: Match current deterministic `verifyCommunityDeployment` checks with per-check pass/fail reasons.

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

### User Story 1 - Launch A Community Stack (Priority: P1)

As a community operator on the Manager home page, I can run a guided deploy wizard that explains the multi-transaction process, checks prerequisites, and executes the full deploy/configure/wire/verify sequence with visible progress so I can launch a new community confidently.

**Why this priority**: Without this flow, onboarding a new community requires manual script usage and fragmented operational knowledge, which blocks the primary onboarding value of the Manager home page.

**Independent Test**: Can be tested by connecting a wallet, passing preflight checks, completing all wizard steps, and observing that the community is actually registered and configured on-chain with a successful verification summary.

**Acceptance Scenarios**:

1. **Given** a connected wallet on a supported network with sufficient native token balance, **When** the operator starts the wizard, **Then** the UI shows sequential deployment steps with per-step purpose, expected transaction count, and live confirmation progress.
2. **Given** a step transaction is rejected or fails, **When** failure occurs, **Then** the wizard stops at that step, preserves completed steps, and shows actionable recovery guidance.
3. **Given** all required steps succeed, **When** the wizard reaches verification, **Then** the UI reports pass/fail for each verification check and only marks the community as created after successful registration and configuration checks.

---

### User Story 2 - Resume Interrupted Deployment (Priority: P2)

As a community operator whose deployment was interrupted, I can resume from the next missing step without redeploying already completed parts, using on-chain state as the source of truth once the community is registered.

**Why this priority**: Multi-transaction deploy flows are interruption-prone; lack of resume would increase operator cost, error risk, and abandonment.

**Independent Test**: Can be tested by intentionally stopping after a subset of steps, reloading the page, invoking Resume deploy, and confirming the wizard starts from the first incomplete step and finishes without repeating completed on-chain actions.

**Acceptance Scenarios**:

1. **Given** an interrupted deployment before community registration, **When** the operator chooses Resume deploy, **Then** the wizard uses stored temporary session state only for pre-registration progress and continues from the first incomplete step.
2. **Given** a community already registered on-chain, **When** Resume deploy is invoked, **Then** the wizard derives module/configuration completion from CommunityRegistry and related on-chain checks rather than local deployment JSON files.
3. **Given** all on-chain checks indicate deployment completion, **When** Resume deploy is invoked, **Then** the wizard reports completion and verification status instead of executing new deploy steps.

---

### User Story 3 - Browse Communities From Home (Priority: P3)

As a Manager user, I can view a communities list directly below the wizard, including loading/empty/error states, and open a community detail page in one click.

**Why this priority**: Home page onboarding is incomplete if users cannot immediately discover existing communities after or instead of deployment.

**Independent Test**: Can be tested by rendering the home page against mocked data states (loading, empty, error, populated) and confirming each community row links to `/communities/[communityId]`.

**Acceptance Scenarios**:

1. **Given** communities are available, **When** the list renders, **Then** each item shows at minimum communityId and display name (if available) and links to `/communities/[communityId]`.
2. **Given** no communities are available, **When** the list renders, **Then** the UI shows a clear empty state explaining that no communities are indexed yet.
3. **Given** list retrieval fails, **When** the home page renders, **Then** the UI shows a clear error state with retry guidance while keeping the wizard section visible.

---

### Assumptions

- The Manager already has or can invoke an existing deployment implementation that performs deploy stack, role wiring, and verification in protocol-correct order.
- Shared infrastructure (`accessManager`, `paramController`, `communityRegistry`) is already deployed on the target network before wizard start.
- The supported network set is finite and known by existing Manager network configuration.
- Community display name may be absent for some records; communityId is always present.
- Verification checks can be represented as deterministic pass/fail conditions mapped to on-chain registration and module pointer/configuration expectations.

### Edge Cases

- Wallet disconnects while wizard is mid-step after one or more successful transactions.
- Operator starts on an unsupported network and declines network switch.
- Preflight balance is near threshold and gas price volatility causes balance to become insufficient mid-flow.
- Shared infrastructure already exists while per-community stack does not.
- Community is partially configured (registered but missing one or more module pointers).
- Session state exists locally but conflicts with on-chain state after page reload.
- Communities list is available from one source but delayed/unavailable from another source used by the UI.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Manager home page MUST present the community deploy wizard section above the communities index section.
- **FR-002**: The wizard MUST require a connected wallet before enabling deployment start.
- **FR-003**: The wizard MUST present an upfront explanation covering multi-contract deployment/configuration, multiple user signatures, prerequisites, and expected cost context.
- **FR-004**: Before deployment start, the wizard MUST estimate required native-token funds for the full flow and compare against current wallet balance.
- **FR-005**: The wizard MUST block deployment start when funds are insufficient and display required amount, current balance, and recommended safety buffer.
- **FR-006**: The wizard MUST detect unsupported or incorrect network and provide clear guidance to switch to a supported network before proceeding.
- **FR-006a**: The wizard MUST preflight-check for required shared infrastructure addresses/contracts on the connected network and block start with clear remediation guidance if missing.
- **FR-007**: The wizard MUST execute only per-community deployment phases (deploy community stack, wire roles/configuration, verify) as a defined sequence of named steps that match existing real deployment behavior in-repo.
- **FR-008**: Each wizard step MUST display its purpose, expected transaction count, and live transaction progress based on confirmation outcomes.
- **FR-009**: The wizard MUST submit deployment/configuration/wiring transactions from the connected operator wallet (user-signed flow) and update progress only after confirmation or terminal failure.
- **FR-009a**: The wizard MUST NOT require a backend deployer key for contract deployment or privileged configuration transactions in this flow.
- **FR-010**: On transaction or step failure, the wizard MUST stop forward execution, preserve completed progress, and show actionable next actions.
- **FR-011**: The wizard MUST provide Resume deploy when prior progress exists.
- **FR-012**: Resume logic MUST infer completion from on-chain state for registered communities and MUST derive module addresses from CommunityRegistry pointers.
- **FR-013**: Resume logic MUST NOT rely on local deployment JSON as authoritative state for already registered communities.
- **FR-014**: The system MAY use local session state only for pre-registration progress and MUST reconcile it against on-chain state when available.
- **FR-015**: Resume MUST identify and continue from the next missing step without re-running already completed on-chain operations.
- **FR-015a**: Resume MUST be explicitly scoped to a target unfinished deployment (registered `communityId` or pre-registration local session identifier).
- **FR-015b**: Resume MUST be authorized only when the connected wallet matches the deployer wallet that initiated the target unfinished deployment.
- **FR-015c**: The wizard MUST NOT allow a wallet to resume unfinished deployments initiated by other wallets.
- **FR-016**: After deployment completion, the wizard MUST execute verification checks equivalent to the existing deterministic `verifyCommunityDeployment` script scope and display per-check pass/fail outcomes with explicit failure reasons.
- **FR-017**: A community MUST be shown as created only after registration and required configuration checks pass; partial progress MUST NOT be represented as completed creation.
- **FR-018**: The home page MUST always render a communities index area below the wizard.
- **FR-019**: Communities index entries MUST include at minimum communityId and display name when available.
- **FR-020**: Each communities index item MUST link to `/communities/[communityId]`.
- **FR-021**: Communities index MUST provide explicit loading, empty, and error states, including an empty-state message that no communities are indexed yet.
- **FR-022**: The feature MUST support multiple communities without hidden single-community assumptions in flow state, list rendering, or routing.
- **FR-023**: Home page terminology MUST use canonical Shift language (community, requests, drafts, proposals, engagements), while preserving commerce-specific claims terminology only for marketplace dispute/claim contexts.

### Monorepo Impact Requirements *(mandatory)*

- **MR-001**: Manager app home route MUST be updated to include deploy wizard and communities index behaviors defined by this spec.
- **MR-002**: Contracts are not modified by this feature; wizard orchestration MUST consume existing protocol capabilities and deployment flows only.
- **MR-003**: Indexer/queries used for communities listing and verification display MUST map to canonical on-chain registration/module state; they MUST NOT introduce a shadow source of truth.
- **MR-004**: Resume and verification logic MUST prioritize CommunityRegistry and related on-chain module/configuration checks once a community is registered.
- **MR-005**: Test coverage MUST include deterministic wizard state-machine tests, preflight failure tests, and communities navigation behavior on the Manager app.

### Compatibility And Migration Requirements *(mandatory when applicable)*

- **CM-001**: No contract ABI or event schema breaking changes are introduced by this feature.
- **CM-002**: Existing home route behavior changes are intentional UX changes; legacy assumptions that home is list-only MUST be updated in tests and docs.
- **CM-003**: If communities list retrieval depends on indexed data freshness, deployment completion messaging MUST remain truthful by validating canonical on-chain checks for completion.

### Documentation And Terminology Requirements *(mandatory)*

- **DT-001**: Manager home onboarding and deploy-flow behavior changes MUST be documented in product/architecture docs that describe Manager user flows.
- **DT-002**: Documentation and UI copy MUST use canonical Shift terminology, including explicit distinction between engagement verification and marketplace claims.
- **DT-003**: Status tracking docs in `.github/project-management/STATUS_REVIEW.md` and `.github/project-management/IMPLEMENTATION_STATUS.md` MUST be synchronized for meaningful behavior/status updates introduced by this feature.

### Key Entities *(include if feature involves data)*

- **Deployment Wizard Session**: Represents one operator-initiated deployment attempt on Manager home, including connected wallet context, network context, ordered step states, per-step tx progress, and resumability metadata.
- **Deployment Step State**: Represents a single deploy/configure/wire/verify phase with attributes for name, purpose, expected tx count, completed tx count, terminal status, and failure guidance.
- **Preflight Assessment**: Represents funds/network prerequisite evaluation before start, including estimated required funds, recommended buffer, current wallet balance, and support status for selected network.
- **Community Registration Snapshot**: Represents authoritative on-chain state for a community (communityId and module pointer/configuration completeness), derived from CommunityRegistry and related contract reads.
- **Communities Index Item**: Represents a row in the home list with communityId, optional display name, and navigation target for community detail.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A wallet-connected operator can complete the full deploy workflow from home with step-by-step progress visibility and explicit verification summary in a single guided session.
- **SC-002**: In deterministic interruption tests, Resume deploy continues from the first incomplete step and completes without repeating already completed on-chain steps.
- **SC-003**: Deployment start is blocked in 100% of insufficient-funds preflight test cases with clear required-versus-available balance messaging and buffer guidance.
- **SC-004**: Wrong-network preflight path consistently prevents start and provides actionable network-switch guidance in all tested unsupported-network scenarios.
- **SC-005**: Communities index displays correct loading, empty, error, and populated states in test coverage, and populated items navigate to `/communities/[communityId]` in one click.
- **SC-006**: No regressions are introduced to existing Manager routes and existing canonical route naming remains consistent with current terminology constraints.
