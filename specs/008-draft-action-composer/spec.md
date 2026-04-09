# Feature Specification: Draft Action Composer Timelock Surface

**Feature Branch**: `008-draft-action-composer`  
**Created**: 2026-04-08  
**Status**: Draft  
**Input**: User description: "Feature: Draft Action Composer - Guided SAFE Templates + Expert Timelock-Only Surface (All Layers)"

## Clarifications

### Session 2026-04-08

- Q: Which deterministic hash algorithm should define `actionsHash`? → A: Option A (`keccak256(encodePacked(address[] targets, uint256[] values, bytes[] calldatas))`) in strict queue order.
- Q: How should targets with zero allowlisted functions be presented? → A: Option B (show target disabled with a clear reason).
- Q: How should runtime allowlist sourcing work for expert mode? → A: Option A (runtime uses a committed versioned allowlist file; updates are script-generated and PR-reviewed).
- Q: How many allowlist profiles should v1 support? → A: Option A (single canonical allowlist profile for v1 based on Base Sepolia staging wiring).
- Q: How should guided mode choose between global and community-scoped overloads? → A: Superseded by 2026-04-09 policy: community-scoped contracts must not expose selector overloads.

### Session 2026-04-09

- Q: What is the selector policy for community-scoped contracts? → A: Community-scoped contracts MUST NOT expose overloaded function names; any detected overload is an invariant violation and must be documented and blocked from guided-template inclusion.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Build Safe Governed Actions Quickly (Priority: P1)

As a community proposer, I can use guided templates to compose governance-safe Timelock actions across protocol layers without writing raw ABI input.

**Why this priority**: Guided mode is the primary path for reducing governance footguns and ensuring proposals stay within authorized Timelock behavior.

**Independent Test**: From guided mode only, a user can add at least one action from each supported layer, review the queue, and produce a valid deterministic action bundle.

**Acceptance Scenarios**:

1. **Given** a community with required module addresses configured, **When** the proposer adds a guided template action, **Then** the composer adds a deterministic action entry with expected target, value, and calldata.
2. **Given** a template that depends on a missing module address, **When** the proposer views guided templates, **Then** that template is disabled with a clear reason and cannot be queued.
3. **Given** guided mode, **When** the proposer inspects available templates, **Then** non-governance actions (request moderation, draft contributor/version operations, draft escalation) are not offered.

---

### User Story 2 - Compose Expert Raw ABI Actions Safely (Priority: P1)

As an advanced proposer, I can author raw ABI calls in expert mode, but only for functions explicitly allowed for Timelock execution.

**Why this priority**: Expert flexibility is required for governance power users, but strict allowlist enforcement is mandatory for safety and policy compliance.

**Independent Test**: In expert mode, verify only allowlisted functions are selectable for each target and any non-allowlisted function is impossible to select.

**Acceptance Scenarios**:

1. **Given** expert mode and a selected target contract, **When** the action selector opens, **Then** only explicit allowlisted Timelock functions appear.
2. **Given** a function not in the allowlist, **When** a user attempts to author it, **Then** the composer blocks selection and does not encode calldata.
3. **Given** an allowlisted function with nested tuples and arrays, **When** raw parameters are entered, **Then** calldata encoding succeeds deterministically and action is queued.

---

### User Story 3 - Produce Deterministic Action Bundles (Priority: P1)

As a proposer, I can trust that the action queue always resolves to a deterministic bundle compatible with draft escalation and Timelock execution.

**Why this priority**: Bundle determinism underpins governance correctness, reviewability, and reproducible execution outcomes.

**Independent Test**: Build identical queues twice and confirm identical hash output; reorder actions and confirm hash changes.

**Acceptance Scenarios**:

1. **Given** the same actions in the same order, **When** bundle hash is computed, **Then** the hash values are identical.
2. **Given** the same actions in a different order, **When** bundle hash is computed, **Then** the hash value changes.
3. **Given** queued actions, **When** the user removes or reorders actions, **Then** queue preview and bundle hash update consistently.

---

### User Story 4 - Cover Governance Targets Across Layers (Priority: P2)

As a governance operator, I can access Timelock-allowed targets across coordination, verification, economic, and commerce layers from one canonical composer.

**Why this priority**: Consolidated cross-layer coverage prevents fragmented proposal authoring and reduces governance tooling drift.

**Independent Test**: Validate target and function availability matrix for all required contracts and confirm unavailable modules are clearly indicated.

**Acceptance Scenarios**:

1. **Given** a fully configured community, **When** the user selects targets in guided or expert mode, **Then** all required in-scope layer targets are represented.
2. **Given** a target with no allowlisted Timelock functions, **When** the user opens expert mode, **Then** the target is visible but disabled with explicit explanation.
3. **Given** a function that is governance-relevant but not currently Timelock-permitted, **When** users review templates, **Then** template is unavailable and clearly marked as not permitted until wiring/permissions are updated.

### Edge Cases

- Community module address is zero or absent for a target required by a template.
- Target contract exists but has zero currently allowlisted Timelock functions.
- Community-scoped contract exposes overloaded function names and must be flagged as an invariant violation for remediation outside this feature scope.
- Expert mode input includes invalid tuple or array shapes.
- Queue contains no actions and must still produce deterministic empty bundle semantics.
- Queue edits occur after calldata generation and must rehydrate preview/hash without stale data.
- Community wiring differs across deployments; allowlist remains canonical while module presence is community-specific.
- Governance-relevant function appears in ABI but is not ADMIN_ROLE-assigned to Timelock and must remain blocked.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Draft composer MUST support two modes: guided templates and expert raw ABI authoring, both producing the same governance action bundle structure (`targets[]`, `values[]`, `calldatas[]`, `actionsHash`).
- **FR-002**: Expert mode function availability MUST be controlled exclusively by an explicit per-contract Timelock allowlist; heuristic inclusion rules are forbidden.
- **FR-003**: The Timelock allowlist source of truth MUST be derived from canonical wizard permission wiring: function signatures assigned to AccessManager `ADMIN_ROLE` that is handed off to Timelock.
- **FR-004**: The runtime allowlist source MUST be a committed versioned in-repo file consumable by the composer as deterministic input data.
- **FR-004A**: Allowlist updates MUST be generated via script from canonical wiring inputs and then reviewed/committed through pull requests.
- **FR-004B**: v1 MUST ship with one canonical allowlist profile aligned to Base Sepolia staging wiring; multi-network profiles are out of scope for v1.
- **FR-005**: Expert mode MUST make it impossible to select or encode non-allowlisted functions.
- **FR-005A**: Targets with zero currently allowlisted functions MUST remain visible and MUST be disabled with a clear reason.
- **FR-006**: Action targets MUST include, at minimum, ValuableActionRegistry, VerifierElection, VerifierManager (only if allowlisted functions exist), VerifierPowerToken1155, RevenueRouter, TreasuryAdapter, Marketplace, ParamController, CohortRegistry, InvestmentCohortManager, PositionManager (only if allowlisted functions exist), CredentialManager (only if allowlisted functions exist), and CommunityRegistry (only if allowlisted functions exist).
- **FR-007**: Guided templates MUST be safe by construction via explicit per-template input schemas, required/type/range validation, and deterministic pre-encode error messages appropriate to governance usage.
- **FR-007A**: Templates MUST use exact ABI-verified signatures from the committed allowlist; if only one signature exists for a function name, there is no overload selection.
- **FR-008**: Guided templates MUST include v1 coverage for currently Timelock-allowed functions in these groups: ValuableActionRegistry governance config, VerifierPowerToken1155 community init/config, RevenueRouter treasury/token config, TreasuryAdapter allowlist/caps/destination config, Marketplace community toggles, conditional ParamController presets, and conditional VerifierElection governance operations.
- **FR-008A**: Guided templates MUST only reference exact ABI-verified signatures and MUST NOT include selector-choice logic when no overload exists in ABI/source.
- **FR-009**: Guided templates MUST only be available for functions that are currently Timelock-executable by allowlist or explicit contract-level Timelock guard.
- **FR-010**: If a guided function is governance-relevant but not currently Timelock-permitted, template availability MUST be disabled with clear "not available until permission wiring is updated" messaging.
- **FR-011**: Templates for non-governance actions MUST be excluded, including request status change, draft contributor/version operations, and draft escalation to proposal.
- **FR-012**: If a module address is missing for the selected community, dependent templates and expert target actions MUST remain visible but disabled with clear explanation.
- **FR-013**: Expert mode MUST support raw parameter entry for all ABI types used by allowlisted functions, including tuples and arrays.
- **FR-014**: The action queue MUST always be visible and show target, selected function signature, calldata preview, and queue controls for remove and reorder.
- **FR-015**: Bundle hashing MUST use `keccak256(encodePacked(address[] targets, uint256[] values, bytes[] calldatas))` in strict queue order, yielding identical output for identical ordered actions and different output when order changes.
- **FR-016**: Guided template encoding MUST be deterministic for identical template inputs.
- **FR-016A**: An empty action queue MUST produce deterministic canonical empty bundle semantics (`targets=[]`, `values=[]`, `calldatas=[]`) and a stable empty-queue hash.
- **FR-017**: The feature MUST include measurable tests for allowlist gating, guided template encoding snapshots, determinism, and module availability behavior.

### Monorepo Impact Requirements *(mandatory)*

- **MR-001**: Primary impact is in web draft composer UI, action registry definitions, and web unit tests.
- **MR-002**: No contract or indexer behavior changes are in scope; proposal execution mechanics remain unchanged.
- **MR-003**: Allowlist authority MUST remain anchored to canonical deploy wiring semantics (ADMIN_ROLE assignment + Timelock handoff), avoiding shadow permission authority in UI.
- **MR-004**: Expert and guided surfaces MUST reflect actual Timelock-executable capability only, not aspirational protocol behavior.
- **MR-005**: Documentation updates MUST describe composer behavior, explicit exclusions, and disabled-state semantics for non-permitted or missing-module actions.

### Compatibility And Migration Requirements *(mandatory when applicable)*

- **CM-001**: Feature is non-breaking to contract ABIs, contract roles, and proposal execution protocol.
- **CM-002**: Existing drafts created before this feature remain valid; no replay or backfill is required.
- **CM-003**: If canonical permission wiring changes in future deployments, script-regenerated allowlist version updates are required before exposing newly permitted functions in expert or guided mode.
- **CM-004**: Expansion to multiple network-specific allowlist profiles is a post-v1 enhancement and MUST NOT alter v1 deterministic behavior.

### Documentation And Terminology Requirements *(mandatory)*

- **DT-001**: Documentation MUST describe that guided mode is SAFE-only and expert mode is Timelock-allowlist-only.
- **DT-002**: Documentation MUST state explicit exclusions for RequestHub moderation actions, DraftsManager contributor/version operations, and escalation flow actions.
- **DT-003**: Documentation MUST identify wizard/canonical permission wiring as the allowlist source and explain disabled behavior when a function is not currently Timelock-executable.
- **DT-004**: Specification and related docs MUST use current Shift terminology (RequestHub, Drafts, Governor/Timelock, VPS, ValuableActionRegistry, VerifierElection, VerifierManager, RevenueRouter, TreasuryAdapter, Marketplace, CohortRegistry, PositionManager, CredentialManager).
- **DT-005**: If shipped scope changes implementation status, risks, priorities, architecture expectations, or workflow requirements, updates MUST synchronize both `.github/project-management/IMPLEMENTATION_STATUS.md` and `.github/project-management/STATUS_REVIEW.md` in the same change set.

### Key Entities *(include if feature involves data)*

- **TimelockAllowlistEntry**: A versioned mapping item in a committed allowlist file tying target contract identity to one exact function signature allowed for Timelock execution.
- **TargetAvailabilityState**: Per-community state indicating whether target module is configured and whether allowlisted functions are currently selectable.
- **GuidedTemplateDefinition**: A safe template descriptor containing template identity, target identity, exact function signature, input schema, validation constraints, and effect copy.
- **PreparedAction**: One queued governance action containing target address, value, encoded calldata, and human-readable preview metadata.
- **ActionBundle**: Deterministic ordered set of prepared actions represented as `targets[]`, `values[]`, `calldatas[]`, and `actionsHash`, where `actionsHash` is `keccak256(encodePacked(address[] targets, uint256[] values, bytes[] calldatas))` in queue order.

### Assumptions

- Canonical staging and deployment wiring remains the authoritative source for Timelock-executable ADMIN_ROLE function signatures.
- Timelock handoff is completed in the target environment before governance execution, so ADMIN_ROLE-assigned signatures are effectively Timelock-controlled.
- No protocol/contract rewiring is performed in this feature; unavailable permissions are represented as disabled UI capabilities.
- ABI signatures used by templates are verified against in-repo contract ABIs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of expert mode action options are allowlisted Timelock-executable signatures for the selected target.
- **SC-002**: 0 non-allowlisted functions can be selected or queued in expert mode.
- **SC-003**: Guided template snapshot tests pass for every v1 template with expected selector and encoded argument output.
- **SC-004**: Determinism tests show identical hash for identical ordered bundles and different hash for reordered bundles in 100% of test cases.
- **SC-005**: Availability tests confirm 100% of templates dependent on missing modules are disabled with explanatory messaging.
- **SC-006**: 0 excluded non-governance actions appear in guided templates or expert allowlist options.
- **SC-007**: Expert target visibility tests confirm 100% of targets lacking allowlisted functions are shown disabled with explanatory messaging, never hidden.
- **SC-008**: v1 configuration tests confirm exactly one canonical allowlist profile is loaded at runtime.
- **SC-009**: ABI reality checks confirm templates and allowlist entries use only existing exact signatures; no selector-choice logic is applied when a single signature exists.
- **SC-010**: Empty queue determinism tests confirm canonical empty bundle semantics and stable empty-queue hash across runs.
- **SC-011**: Existing drafts created before this feature remain renderable and valid without migration or replay.
- **SC-012**: Queue visibility tests confirm the action queue remains visible in both empty and non-empty states with consistent preview controls.
