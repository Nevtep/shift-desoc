# Feature Specification: Wizard Permission Parity And Guided Governance Coverage

**Feature Branch**: `010-wizard-permission-parity`  
**Created**: 2026-04-09  
**Status**: Draft  
**Input**: User description: "Wizard permission parity + allowlist refresh + guided template coverage (all layers)"

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

### User Story 1 - Verify Real Permission Wiring (Priority: P1)

As a governance operator, I need a verifiable permission matrix extracted from wizard deployment wiring so I can trust that only intended timelock-governed functions are exposed for proposal drafting.

**Why this priority**: All downstream allowlist and template behavior depends on accurate role mapping and end-state role ownership.

**Independent Test**: Execute the permission extraction process and confirm every mapped function shows target, signature, selector, assigned role, and final role holder status after handoff.

**Acceptance Scenarios**:

1. **Given** wizard deployment wiring definitions, **When** permission extraction runs, **Then** it produces a matrix row for every selector-role assignment with exact signature and selector.
2. **Given** handoff and revocation steps, **When** final role ownership is evaluated, **Then** the matrix/report confirms whether Timelock holds ADMIN_ROLE and whether bootstrap/deployer roles are revoked as expected.

---

### User Story 2 - Enforce Timelock Allowlist Integrity (Priority: P2)

As a protocol maintainer, I need the Draft Action Composer allowlist to be derived only from timelock-held ADMIN_ROLE mappings that are ABI-verified, so expert actions cannot drift from deployed authority.

**Why this priority**: Incorrect allowlist entries can expose unsafe actions or hide required governance operations.

**Independent Test**: Generate allowlist artifacts from the canonical permission source and verify they include all and only ABI-valid timelock-executable signatures.

**Acceptance Scenarios**:

1. **Given** the permission matrix and compiled ABIs, **When** allowlist generation runs, **Then** every included signature is confirmed present in the corresponding ABI.
2. **Given** a matrix signature missing from ABI, **When** validation runs, **Then** generation fails closed with a Signature Not Found report and no partial success artifact is treated as valid.

---

### User Story 3 - Align Expert Targets To Allowlist Reality (Priority: P3)

As a governance drafter, I need expert targets to reflect only current timelock-executable functions, with clear disabled reasons where execution is unavailable.

**Why this priority**: Expert mode is the direct raw-action surface and must strictly match real authority boundaries.

**Independent Test**: Review target registry and target availability state against allowlist outputs and verify enabled/disabled behavior with deterministic reasons.

**Acceptance Scenarios**:

1. **Given** a module address exists and has allowlisted functions, **When** expert mode loads targets, **Then** the target is enabled.
2. **Given** a module is missing or has zero allowlisted timelock functions, **When** expert mode loads targets, **Then** the target is disabled with a specific reason.

---

### User Story 4 - Guided Templates And Crucial Flow Coverage (Priority: P4)

As a governance drafter, I need guided templates for crucial transaction flows across all layers, enabled only when allowlisted and otherwise clearly disabled.

**Why this priority**: Guided mode must remain safe while still exposing complete, auditable governance pathways and explicit gaps.

**Independent Test**: Validate crucial flow catalog entries and guided template states against allowlist outputs, including deterministic calldata for enabled templates and disabledReason for unavailable flows.

**Acceptance Scenarios**:

1. **Given** a crucial flow signature is allowlisted, **When** a guided template is used with valid parameters, **Then** it emits deterministic calldata and plain-language effect guidance.
2. **Given** a crucial flow signature is not allowlisted, **When** guided templates are rendered, **Then** the template remains present but disabled with a clear reason.

---

### Edge Cases

- Selector-role mappings reference a contract target key that does not resolve to a deployed module address.
- A function exists in ABI but is assigned to a non-ADMIN role that Timelock does not hold.
- ADMIN_ROLE is assigned but handoff logic leaves deployer/bootstrap with lingering privileged roles.
- A crucial flow from governance docs has no timelock-executable function under current wiring.
- Guided template parameters are syntactically valid but exceed safe governance bounds.
- Function overload ambiguity appears in source definitions; exact signature matching must prevent wrong selector selection.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The feature MUST produce a structured permission matrix extracted from wizard deployment wiring that includes, per assignment: target contract name, target resolution key, exact function signature string, selector (bytes4), and assigned role.
- **FR-002**: The feature MUST produce explicit evidence of handoff semantics, including where ADMIN_ROLE is granted to Timelock and where deployer/bootstrap role revocations occur.
- **FR-003**: The feature MUST determine final ADMIN_ROLE holder state and mark any mismatch from expected Timelock ownership.
- **FR-004**: Every signature in the permission matrix MUST be validated against compiled ABI for its target contract before downstream processing.
- **FR-005**: If any signature is absent from ABI, processing MUST stop and emit a Signature Not Found report listing contract, target key, signature, and selector.
- **FR-006**: The timelock-executable surface MUST be defined only as matrix entries assigned to ADMIN_ROLE that is held by Timelock at end-state.
- **FR-007**: The feature MUST generate a machine-readable timelock surface artifact containing contractName, targetKey, signatures, and selectors.
- **FR-008**: The Draft Action Composer allowlist generation process MUST consume the canonical permission matrix source and include only ABI-verified timelock-executable signatures.
- **FR-009**: The allowlist generation process MUST fail closed when canonical source data is missing, malformed, or ABI validation fails.
- **FR-010**: Expert mode target visibility MUST require both module address availability and at least one allowlisted timelock function for that target.
- **FR-011**: Targets that do not meet expert visibility requirements MUST remain present but disabled with a specific reason: module missing or no allowlisted timelock functions.
- **FR-012**: Guided templates MUST be defined for crucial governance transaction flows per layer and MUST be enabled only when corresponding signatures are allowlisted.
- **FR-013**: Guided templates for non-allowlisted flows MUST remain disabled and include a clear reason that they are not timelock-executable under current deploy wiring.
- **FR-014**: Enabled guided templates MUST enforce safe parameter constraints, include plain-language effect explanation, and produce deterministic calldata for identical inputs.
- **FR-015**: The feature MUST deliver a human-readable permission matrix report and a short gap report describing desired layer flows that are not timelock-executable and the selector-role assignments needed to enable them.
- **FR-016**: No contract source code changes are permitted in this feature.

### Monorepo Impact Requirements *(mandatory)*

- **MR-001**: Feature spec MUST identify impact across contracts, indexer,
  Manager app, tests, and documentation.
- **MR-002**: The feature MUST not modify contract interfaces or emitted events;
  any required permission changes beyond current wiring MUST be documented as
  follow-up wiring updates only.
- **MR-003**: Spec MUST state how derived/indexed state maps back to canonical
  on-chain state and events without introducing shadow authority.
- **MR-004**: Spec MUST define role/authority implications for privileged flows
  and confirm Governor/Timelock governance path expectations.
- **MR-005**: Manager UI requirements MUST map to actual implemented contract
  capabilities and MUST NOT rely on aspirational protocol behavior.

### Feature Impact Map

- **Contracts**: No source changes. Compiled ABIs are used as the verification baseline.
- **Manager/Web app**: Allowlist artifacts, expert target gating, guided templates, and associated tests are updated.
- **Indexer**: No schema or mapping changes expected.
- **Tests**: Add/refresh allowlist pipeline, expert target coverage, guided template snapshot, and disabled-state tests.
- **Documentation**: Add permission matrix report and gap report; update status tracking note for shipped behavior consistency.

### Compatibility And Migration Requirements *(mandatory when applicable)*

- **CM-001**: Existing proposal payload compatibility MUST be preserved for unchanged signatures.
- **CM-002**: Regenerated allowlist artifacts MUST be versioned and auditable so consumers can validate profile changes between releases.
- **CM-003**: If any previously available expert action is removed due to corrected permission mapping, release notes MUST explain the governance authority rationale.

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

### Assumptions

- Wizard deployment wiring definitions are the canonical source for selector-role assignments in this release.
- Timelock-governed proposal authoring must reflect current wiring reality, not desired future authority.
- Critical governance flows are determined from existing layer and flow documentation and mapped to currently executable functions only.

### Key Entities *(include if feature involves data)*

- **Permission Matrix Entry**: Canonical mapping row of contract target, signature, selector, assigned role, and final role-holder context.
- **Timelock Surface Profile**: Grouped list of ABI-validated signatures/selectors per target that are executable by Timelock-held ADMIN_ROLE.
- **Allowlist Profile**: Draft Action Composer profile containing only permitted timelock-executable actions.
- **Expert Target State**: Computed target status including enabled/disabled state and explicit disable reason.
- **Guided Template Definition**: Safe governance action template with eligibility predicate, parameter constraints, effect explanation, deterministic action output, and disabled reason when ineligible.
- **Gap Report Item**: Crucial governance flow not currently timelock-executable, including missing selector-role assignment needed for parity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of wizard selector-role assignments are represented in the permission matrix with contract, target key, signature, selector, and role fields populated.
- **SC-002**: 100% of matrix signatures pass ABI existence validation; if any fail, generation halts and the failure report identifies each mismatch unambiguously.
- **SC-003**: Allowlist profile contains exactly the timelock-executable ADMIN_ROLE surface with zero extra non-authorized signatures.
- **SC-004**: Expert mode target states are fully explainable: every target is either enabled by address+allowlist evidence or disabled with one explicit reason.
- **SC-005**: Crucial governance templates are available across all layers with enabled/disabled state matching allowlist eligibility at 100% consistency.
- **SC-006**: Deterministic calldata validation shows no output variance for repeated identical template inputs.
- **SC-007**: Test suite updates for allowlist pipeline, expert target coverage, guided template behavior, and disabled-state behavior all pass in CI.
- **SC-008**: Documentation deliverables include permission matrix report, timelock surface artifact reference, and gap report with selector-role assignment recommendations for all non-executable crucial flows.
