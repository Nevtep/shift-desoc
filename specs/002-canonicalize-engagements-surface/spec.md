# Feature Specification: Canonicalize Engagements Surface

**Feature Branch**: `002-canonicalize-engagements-surface`  
**Created**: 2026-03-05  
**Status**: Draft  
**Input**: User description: "Canonicalize the work-verification feature surface from deprecated Claims terminology to canonical Engagements across the Shift monorepo's active user-facing and integration-facing surfaces."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Engagements Language In User Flows (Priority: P1)

As a community member using Shift Manager for work verification, I see and use
"Engagements" terminology consistently for submission, review, and verification
workflows so the feature model matches protocol behavior.

**Why this priority**: This is the highest-impact user-facing correction and
directly removes domain confusion in core work-verification journeys.

**Independent Test**: Can be fully tested by navigating all work-verification
routes and UI labels in Manager and confirming they consistently use
Engagements language while submission and review journeys remain functional.

**Acceptance Scenarios**:

1. **Given** a user opens the work-verification section, **When** they browse
  list/detail/submit/review screens, **Then** the feature is labeled
  "Engagements" and not "Claims" for work verification.
2. **Given** a user submits a work item and a juror reviews it, **When** they
  complete the existing flow, **Then** behavior remains unchanged except for
  canonical terminology.

---

### User Story 2 - Integration Surface Alignment (Priority: P2)

As an integrator or maintainer, I can rely on active app integration surfaces to
reference the canonical Engagements domain for work verification so ABIs,
deployment assumptions, and feature naming do not drift.

**Why this priority**: Terminology and contract-surface drift causes incorrect
integration assumptions and operational friction.

**Independent Test**: Can be tested by reviewing active manager contract-facing
assumptions and integration labels to confirm work-verification surfaces align
to Engagements while economic claim semantics remain separate.

**Acceptance Scenarios**:

1. **Given** active work-verification integration wiring, **When** contract and
  feature naming assumptions are inspected, **Then** they reference
  Engagements as the canonical work-verification domain.
2. **Given** revenue/economic claiming semantics, **When** related references
  are inspected, **Then** they remain distinct and are not reclassified as
  work-verification Engagements.

---

### User Story 3 - Status And Documentation Synchronization (Priority: P3)

As a protocol operator, I can see synchronized implementation-status and
architecture-status documentation reflecting the canonical Engagements language
so governance, planning, and future work stay aligned.

**Why this priority**: This reduces recurrence of cross-layer drift and makes
future status tracking actionable.

**Independent Test**: Can be tested by verifying project-management and system
reference artifacts consistently describe work verification as Engagements and
retain separate economic claim semantics.

**Acceptance Scenarios**:

1. **Given** updated status and reference docs, **When** maintainers review
  implementation status and strategic status, **Then** both describe the same
  canonical work-verification surface and terminology boundaries.

---

### Edge Cases

- A legacy user-facing string still says "Claim" for work verification in a
  non-primary route or empty state.
- A reference uses "claim" in a valid economic payout context and must remain
  unchanged.
- Existing links/bookmarks to prior work-verification route names may need
  compatibility handling to avoid user dead-ends.
- Mixed-context copy where both engagement verification and economic claiming
  appear in one surface must preserve clear semantic separation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Work-verification user-facing surfaces MUST use "Engagements" as
  the canonical feature term.
- **FR-002**: The system MUST stop presenting "Claims" as the canonical name
  for work verification.
- **FR-003**: Existing work submission, juror review, and resolution journeys
  MUST remain usable after terminology canonicalization.
- **FR-004**: Economic/revenue claiming semantics MUST remain distinct and MUST
  NOT be renamed as work-verification Engagements.
- **FR-005**: Active integration-facing assumptions in Manager MUST align with
  the canonical Engagements domain model for work verification.
- **FR-006**: Any user-facing navigation, labels, and feature names in scope
  MUST present consistent terminology for the Engagements domain.
- **FR-007**: In-scope documentation artifacts that track implementation and
  architecture status MUST reflect the corrected terminology and remain
  synchronized.
- **FR-008**: The correction MUST be implemented as a vertical slice across
  impacted monorepo layers without introducing new protocol mechanics.

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

### Compatibility And Migration Requirements *(mandatory when applicable)*

- **CM-001**: Existing user flows and links for work verification SHOULD remain
  reachable through compatibility handling where route or label canonicalization
  could otherwise break navigation expectations.
- **CM-002**: Any in-scope integration-facing renaming MUST preserve functional
  behavior and be accompanied by clear release notes for maintainers.
- **CM-003**: If any API/query/interface naming is changed in scope, expected
  consumer impact and transition guidance MUST be documented.

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
- **DT-004**: Terminology boundaries MUST be explicit in all in-scope artifacts:
  Engagements = work/contribution verification; claims = economic claiming or
  payout semantics.

### Assumptions

- The requested correction targets active user-facing and integration-facing
  surfaces, not historical archives or inactive legacy artifacts.
- No protocol contract mechanics are introduced or removed as part of this
  feature.
- Canonical naming updates may include route/label harmonization where needed,
  while preserving working behavior.
- If route identifiers require updates, compatibility handling is preferred over
  abrupt removals.

### Key Entities *(include if feature involves data)*

- **Work Verification Surface**: User-facing and integration-facing feature
  surface representing one-shot contribution verification, whose canonical name
  is Engagements.
- **Economic Claim Surface**: Distinct payout or revenue-claiming semantics that
  must remain separate from work-verification naming.
- **Terminology Mapping**: Controlled mapping from deprecated work-verification
  "Claims" usage to canonical "Engagements" usage, with explicit exclusions for
  economic claim semantics.
- **Status Artifacts**: Coordination documents tracking strategic and tactical
  implementation state (`STATUS_REVIEW.md`, `IMPLEMENTATION_STATUS.md`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of in-scope work-verification user-facing labels and
  navigation use "Engagements" terminology.
- **SC-002**: 0 in-scope user-facing surfaces present "Claims" as the canonical
  work-verification feature name after release.
- **SC-003**: 100% of pre-existing in-scope work-verification journeys remain
  executable end-to-end after canonicalization.
- **SC-004**: 0 semantic regressions where economic claim/payout contexts are
  incorrectly renamed to Engagements.
- **SC-005**: 0 unresolved terminology drift items remain across in-scope
  contracts/indexer/manager/status artifacts at merge.
- **SC-006**: Both `.github/project-management/IMPLEMENTATION_STATUS.md` and
  `.github/project-management/STATUS_REVIEW.md` reflect the canonicalized state
  and remain mutually consistent in the same release change set.
