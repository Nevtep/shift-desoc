# Coordination Layer

## 1. Overview

The Coordination Layer wires every community-facing surface of Shift together. It models communities as on-chain entities, captures the full lifecycle from ideas to executable drafts, and provides a governed registry of parameters that downstream modules consume. Sitting between the Governance Core (Governor + Timelock) and functional domains (verification, marketplace, housing, treasury), it ensures that configuration, discussions, and proposal preparation remain synchronized and auditable.

- **CommunityRegistry** anchors each community’s identity, module wiring, and lifecycle state.
- **RequestHub** offers a structured forum for capturing community needs, linking to work incentives, and building the narrative context behind proposals.
- **DraftsManager** turns requests into versioned action bundles ready for governance escalation while preserving review history.
- **ParamController** is the single source of truth for governed parameters, exposing read APIs to dependent contracts and enforcing that updates originate from the Governor/Timelock path.

Because these contracts form the root of on-chain coordination, most mutations are triggered, authorized, or constrained by governance decisions executed through the Timelock.

## 2. Components

### 2.1 CommunityRegistry

- **Purpose**: Register and index communities, store descriptive metadata, wire module addresses, and manage cross-community relationships.
- **Responsibilities**:
  - Assign sequential community IDs and initialize default governance/economic parameters.
  - Track active vs archived communities, creation timestamps, parent-child federations, and alliance lists.
  - Maintain pointers to governance, verification, and economic contracts (Governor, Timelock, RequestHub, DraftsManager, Claims, ValuableActionRegistry, Verifier stack, CommunityToken, TreasuryAdapter, etc.).
  - Enforce role-based permissions for community admins, moderators, and curators.
- **Important Fields**:
  - Identity: `name`, `description`, `metadataURI`, `communityId`, `createdAt`, `active`.
  - Governance timing & eligibility: windows, thresholds, seniority rules, SBT requirements.
  - Economics: `revenueSplit` `[workers%, treasury%, investors%]`, `feeOnWithdraw`, `backingAssets`.
  - Linked modules: addresses for all core contracts that compose a community.
- **Access Control**: Community admins (or global admins) create and update modules; federation relationships validated to avoid cycles; revenue splits validated to sum to 100%.

### 2.2 RequestHub

- **Purpose**: On-chain registry of community requests that drive discussion, bounties, and ValuableAction linkage.
- **Responsibilities**:
  - Create request records scoped to a community, storing author, title, IPFS CID, tags, status, timestamps, and engagement metrics.
  - Manage hierarchical comments with rate limiting and moderator-controlled visibility.
  - Link requests to ValuableActions or bounties to align discussion with work verification.
  - Emit events (`RequestCreated`, `CommentPosted`, etc.) for indexing frontends.
- **Representation**:
  - Authors and commenters stored as addresses; moderation flagged via `isModerated`.
  - Status enum tracks `OPEN_DEBATE`, `FROZEN`, or `ARCHIVED` for lifecycle management.
  - Anti-spam state stores per-community post counts and last post times.
- **Access & Roles**: Moderators (from CommunityRegistry roles) can freeze threads or hide comments; request authors retain special permissions for linking ValuableActions.

### 2.3 DraftsManager

- **Purpose**: Manage collaborative, versioned drafts associated with requests and prepare action bundles for governance proposals.
- **Responsibilities**:
  - Create drafts tied to a community (and optionally a RequestHub request), capturing author, contributors, action bundle targets/values/calldata, status, timestamps, and IPFS version list.
  - Handle contributor management, version snapshots, and review submissions that track support/oppose/neutral/change requests.
  - Gate workflow transitions (`DRAFTING → REVIEW → FINALIZED → ESCALATED → WON/LOST`) with time and consensus thresholds.
  - Escalate drafts to proposals by calling Governor interfaces (binary or multi-choice) and store the returned `proposalId`.
- **Content Model**:
  - Off-chain content stored via IPFS hashes (`versionCIDs`, `reasonCID`); on-chain structures capture pointers and state machine metadata.
  - `ActionBundle` keeps deterministic hash of action payload for verification.
- **Constraints & TODOs**:
  - Future work includes enforcing CommunityRegistry/RequestHub existence checks and hardening admin functions (e.g., `updateGovernor`, `updateConfiguration`, `updateProposalOutcome`) with governance authorization.

### 2.4 ParamController

- **Purpose**: Central storage for governed configuration (timing, eligibility, economic parameters) across communities.
- **Responsibilities**:
  - Store `GovernanceParams`, `EligibilityParams`, and `EconomicParams` per community, all queryable by dependent contracts.
  - Accept parameter update proposals that schedule changes, then apply them once the Timelock executes `executeParameterUpdate`.
  - Provide eligibility helpers (`checkEligibility`) and convenience getters (`getVoteWindow`, `getRevenueSplit`, etc.).
- **Parameter Addressing**:
  - Parameters referenced by hashed names or structured getters; pending updates recorded with `parameterKey`, `newValue`, `effectiveTime`, `executed` flag, and proposer metadata.
- **Access Control**:
  - Only governance-authorized callers (Governor via Timelock or emergency roles) can schedule or execute writes; validation checks enforce ranges (e.g., vote window bounds, revenue split totals, proposal threshold caps).

## 3. Data Structures & State

- **CommunityRegistry**:
  - `Community` struct aggregates identity data, governance timing, eligibility rules, economic settings, module addresses, status flags, and relationship lists.
  - Mappings: `communityId → Community`, secondary indexes for community admins/roles, alliance arrays, and parent-child pointers.
- **RequestHub**:
  - `Request` struct captures community linkage, author, content metadata, status, activity metrics, optional bounty amount, and linked ValuableAction ID.
  - `Comment` struct tracks nested discussions with parent references and moderation flag.
  - Mappings maintain auto-incremented IDs, per-community request lists, per-request comment arrays, and rate-limiting state keyed by community + user.
- **DraftsManager**:
  - `Draft` struct stores community/request linkage, author, contributor list, action bundle, version CIDs, status timestamps, proposal linkage, and embedded `ReviewState` with vote counts.
  - `ActionBundle` arrays define target addresses, ETH values, calldata, and hash; `ReviewState` maps reviewer address to review record while tracking aggregate counts.
  - Storage uses dynamic array of drafts with internal mappings for contributor flags and review details.
- **ParamController**:
  - Per-community structs (`GovernanceParams`, `EligibilityParams`, `EconomicParams`) persisted in dedicated mappings.
  - `ParameterUpdate` entries capture pending changes, keyed by sequential update IDs, including community scope, parameter key, scheduled activation time, and execution flag.
  - Additional state includes emergency role assignments, optional parameter schedules, and template references (if enabled).

## 4. Core Flows

### 4.1 Community Lifecycle

- **Creation**:
  - Authorized deployer (e.g., API backend or CommunityFactory) calls `registerCommunity` with metadata and optional parent ID.
  - Registry assigns new community ID, validates uniqueness and default parameter bounds, stores module placeholders, and emits `CommunityRegistered`.
  - Initial admin role granted to creator; governance/timing/economic defaults recorded.
- **Configuration**:
  - Admins (often the Timelock executing governance decisions) call `setModuleAddress` to wire governor, timelock, request hub, drafts manager, verification stack, and economic adapters once deployed.
  - `updateParameters` allows adjusting select governance/economic values when authorized; revenue splits and asset lists enforced to remain consistent with invariants.
- **Lifecycle Changes**:
  - `setCommunityStatus` toggles `active`, enabling soft suspension/archival while preserving history.
  - Parent/ally relationships managed with validation to prevent cycles; active status required for participation.
  - Invariants require a valid governor/timelock pairing before marking a community as operational.

### 4.2 Requests & Drafts Lifecycle

- **Idea Capture**:
  - Community member invokes `createRequest` with community ID, title, content CID, and tags. Rate limits ensure max 10 posts/day and 60-second spacing.
  - Request enters `OPEN_DEBATE`, events emitted for off-chain discovery; comments appended via `postComment` with parent-child threading.
- **Context Linking**:
  - Authors or admins can attach ValuableActions or bounties to requests, bridging discussion with work verification and incentives.
- **Draft Development**:
  - Contributors call `createDraft`, referencing community and optionally request ID, plus initial action bundle and version CID.
  - Additional contributors added via `addContributor`; new versions stored with `snapshotVersion` to maintain immutable IPFS history.
- **Review & Escalation**:
  - Draft enters `REVIEW` via dedicated function; reviewers submit support/oppose/neutral/change requests with reasoning.
  - `finalizeForProposal` enforces minimum review duration and support thresholds (basis points), advancing draft to `FINALIZED`.
  - `escalateToProposal` submits action bundle to Governor (binary or multi-choice). Timelock-managed execution follows governance result; draft status updated to `WON` or `LOST` once outcome known.
- **Data Integrity Requirements**:
  - Draft must reference a valid community; requests linked must exist in RequestHub.
  - Every draft maintains linkage back to originating request (when provided) for traceability; actions hashed to guard against tampering.

### 4.3 Parameter Management

- **Reading**:
  - Downstream modules call typed getters (`getVoteWindow`, `getRevenueSplit`, `checkEligibility`) to retrieve current community configuration at runtime.
- **Updating**:
  - Parameter change proposals originate from community members via DraftsManager → Governor pipeline.
  - Upon successful vote, Timelock queues `executeParameterUpdate` (or batched setter) to apply new values in ParamController.
  - Range validation and revenue split sum checks occur before persistence; emergency role can invoke `emergencyParameterReset` to restore safe defaults.
- **Versioning**:
  - `ParameterUpdate` records persist change history with proposer metadata and effective time, enabling audit trails and delayed activation if desired.
  - Communities can schedule gradual transitions via parameter schedules/templates when enabled.

## 5. Security & Invariants

- **Access Control**:
  - Community creation and module wiring restricted to admins; role assignments enforced via CommunityRegistry hierarchies.
  - Request creation open to members but bounded by rate limits; moderation limited to moderator roles or admins.
  - Draft edits limited to author/contributors; review submission open to community members; escalation should be gated by governance once admin TODOs are resolved.
  - ParamController writes restricted to Governor/Timelock or emergency roles; eligibility queries read-only.
- **Consistency Invariants**:
  - Active community must reference valid module addresses before functional modules rely on it.
  - Every request references an active community; drafts reference valid communities and (if provided) existing requests.
  - Revenue splits always sum to 10,000 basis points; fee percentages stay within configured caps.
  - Parameter snapshot at scheduling time cannot be altered except through authorized execution.
- **Griefing & DoS Mitigations**:
  - RequestHub rate limiting limits spam; moderators can freeze threads or hide toxic content.
  - Large content stored off-chain via IPFS CIDs to avoid on-chain bloating.
  - Community creation may be gated by off-chain policy or economic checks to prevent registry abuse.
- **Upgrade / Migration Notes**:
  - Adding new parameters or module references should be handled via versioned structs and default fallbacks to avoid breaking existing communities.
  - DraftsManager’s TODO admin functions must be hardened before production; current deployments should route configuration changes through governance-controlled wrappers.

## 6. Integration Points

| External Module | Interaction with Coordination Layer | Key Functions | Ordering Assumptions |
|-----------------|--------------------------------------|---------------|----------------------|
| Governance Core (Governor/Timelock) | Executes parameter updates, sets module addresses via admin proposals | `executeParameterUpdate`, `setModuleAddress`, `updateParameters` | Community must exist before governance references it; Timelock delay precedes state changes |
| Verification Layer (Claims, ValuableActionRegistry, Verifier stack) | Reads community config, links requests to ValuableActions, mints governance tokens upon approvals | `linkValuableAction`, Registry getters, ParamController eligibility checks | Community & RequestHub entries must pre-exist; Claims expects ParamController to reflect latest eligibility |
| Economic Modules (RevenueRouter, TreasuryAdapter, CommunityToken) | Pull revenue splits, withdrawal fees, backing asset lists | `getRevenueSplit`, `getEconomicParameters`, module address lookups | CommunityRegistry must expose correct module addresses before usage |
| Marketplace / Housing / ProjectFactory | Use community IDs, parameters, and module references to scope operations | Registry getters for module addresses, ParamController configuration | Communities must be active and configured; functional modules rely on parameter consistency |
| Frontend / Indexers | Subscribe to coordination events for UI state and analytics | `RequestCreated`, `DraftCreated`, `CommunityRegistered`, parameter update events | Event-driven workflows rely on immutable IDs and timestamps |

Cross-module invariants require the governor address stored in CommunityRegistry to match the Governor executing proposals, and the timelock address to align with the executor used by other modules.

## 7. Testing Considerations

- **CommunityRegistry**:
  - Test community creation with unique names and edge-case parameters; verify module updates restricted to admins; ensure revenue split validation and prevention of relationship cycles.
  - Exercise activation/deactivation flows and role assignments.
- **RequestHub**:
  - Cover request creation, comment posting, status transitions, and moderation; test rate limiting, invalid community IDs, and ValuableAction linkage.
  - Validate moderation restrictions and event emissions.
- **DraftsManager**:
  - Verify draft creation, contributor management, version snapshots, review submissions, and workflow transitions under valid/invalid conditions.
  - Ensure escalation integrates correctly with mocked Governor and that proposal outcomes update status paths; negative testing for unauthorized admin operations until governance gating is added.
- **ParamController**:
  - Test getter/setter accuracy, range validation, emergency resets, and enforcement that only authorized callers can mutate state.
  - Validate revenue split math and eligibility checks across boundary conditions.
- **Integration Tests**:
  - End-to-end scenario: register community → create request → draft proposal → escalate via Governor → Timelock executes parameter change.
  - Negative tests for inconsistent states (e.g., drafts with nonexistent requests, parameter updates without governance authorization) to confirm reverts.
- **Fuzz / Property-Based Testing Ideas**:
  - Randomized sequences of community creation, module wiring, and parameter updates to ensure invariants (active communities always have matching module addresses).
  - Generate large numbers of requests/comments under rate limits to detect spam resilience and storage behavior.
  - Random parameter schedules and updates to confirm delayed execution respects bounds and that revenue splits always equal 10,000 basis points.
