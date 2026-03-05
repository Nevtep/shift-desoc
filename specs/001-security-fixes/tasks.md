# Tasks: Security Fixes (Shift)

**Input**: Design documents from `/specs/001-security-fixes/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: This feature explicitly requires unit, integration, and regression tests per finding.

**Organization**: Tasks are grouped by user story and ordered by severity buckets: Immediate → Before mainnet → Pre-production hardening → Operational controls.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (`[US1]`, `[US2]`, `[US3]`, `[US4]`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare tracking and validation scaffolding for security remediation.

- [x] T001 Create remediation tracking matrix in specs/001-security-fixes/contracts/security-fixes-contracts.md
- [x] T002 Create implementation runbook index in specs/001-security-fixes/quickstart.md
- [x] T003 [P] Add finding-to-test traceability table in specs/001-security-fixes/data-model.md
- [x] T004 [P] Add risk sign-off checklist in specs/001-security-fixes/plan.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared test/migration prerequisites required before user story implementation.

**⚠️ CRITICAL**: User story implementation begins only after this phase completes.

- [x] T005 Add governance migration action checklist in specs/001-security-fixes/contracts/security-fixes-contracts.md
- [x] T006 [P] Add ABI sync validation steps in specs/001-security-fixes/quickstart.md
- [x] T007 [P] Add staging replay validation checklist in specs/001-security-fixes/quickstart.md
- [x] T008 Create shared malicious token test fixture in test/mocks/MaliciousERC20.sol
- [x] T009 Create shared juror-selection failure fixture in test/mocks/MockFailingVerifierManager.sol

**Checkpoint**: Foundation ready; story work can proceed in severity order.

---

## Phase 3: User Story 1 - Protect Treasury and User Funds (Priority: P1) 🎯 MVP

**Goal**: Eliminate drain/trap risks and enforce correct settlement and payout behavior.

**Independent Test**: Revenue routing with active cohorts succeeds, emergency withdrawal preserves liabilities, request completion pays bounty atomically, and unsupported routing token settlements do not trap escrow.

### Tests for User Story 1

- [x] T010 [P] [US1] Add selector compatibility regression test in test/RevenueRouterCohort.t.sol
- [x] T011 [P] [US1] Add cohort interface compatibility test in test/CohortRegistry.t.sol
- [x] T012 [P] [US1] Add emergency withdrawal liability-floor tests in test/CommunityToken.t.sol
- [x] T013 [P] [US1] Add atomic bounty payout tests in test/RequestHub.t.sol
- [x] T014 [P] [US1] Add unsupported routing token settlement tests in test/MarketplaceRevenueRouter.t.sol
- [x] T015 [P] [US1] Add dispute resolution settlement fallback tests in test/MarketplaceDisputes.t.sol

### Implementation for User Story 1

#### Immediate
- [x] T016 [US1] Align cohort weight interface signature in contracts/modules/interfaces/ICohortRegistry.sol
- [x] T017 [US1] Add backward-compatible cohort weight getter path in contracts/modules/CohortRegistry.sol
- [x] T018 [US1] Update cohort weight call path for compatibility in contracts/modules/RevenueRouter.sol

#### Before mainnet
- [x] T019 [US1] Enforce emergency withdrawal liability floor invariant in contracts/tokens/CommunityToken.sol
- [x] T020 [US1] Implement atomic bounty token transfer on completion in contracts/modules/RequestHub.sol

#### Pre-production hardening
- [x] T021 [US1] Add router token support pre-check/fallback settlement logic in contracts/modules/Marketplace.sol
- [x] T022 [US1] Add deterministic non-trapping settlement helper path in contracts/modules/Marketplace.sol

### Integration for User Story 1

- [x] T023 [US1] Add end-to-end fund-flow regression scenario in test/MarketplaceRevenueRouter.t.sol
- [x] T024 [US1] Add request completion plus payout integration scenario in test/RequestHub.t.sol

**Checkpoint**: US1 is independently functional and testable.

---

## Phase 4: User Story 2 - Ensure Liveness and Correct Verification Outcomes (Priority: P1)

**Goal**: Guarantee engagement lifecycle termination and configured threshold correctness.

**Independent Test**: Submission fails when juror assignment fails, expired engagements can be resolved, and verification uses configured `jurorsMin`.

### Tests for User Story 2

- [x] T025 [P] [US2] Add expired engagement resolution tests in test/Engagements.t.sol
- [x] T026 [P] [US2] Add juror selection failure revert tests in test/Engagements.t.sol
- [x] T027 [P] [US2] Add configurable threshold (`jurorsMin`) tests in test/Engagements.t.sol
- [x] T028 [P] [US2] Add bounded active-count gas trend regression tests in test/Engagements.t.sol

### Implementation for User Story 2

#### Before mainnet
- [x] T029 [US2] Add explicit expired engagement terminal resolver in contracts/modules/Engagements.sol
- [x] T030 [US2] Remove silent try/catch fallback and revert on juror selection failure in contracts/modules/Engagements.sol
- [x] T031 [US2] Replace majority hardcode with action-configured `jurorsMin` in contracts/modules/Engagements.sol
- [x] T032 [US2] Fix per-day rate-limit reset logic in contracts/modules/RequestHub.sol

#### Pre-production hardening
- [x] T033 [US2] Introduce bounded active engagement counters in contracts/modules/Engagements.sol
- [x] T034 [US2] Update all engagement terminal transitions to maintain counters in contracts/modules/Engagements.sol

### Integration for User Story 2

- [x] T035 [US2] Add lifecycle integration test covering submit-vote-expire-resolve in test/Engagements.t.sol
- [x] T036 [US2] Add day-boundary rate-limit integration scenario in test/RequestHub.t.sol

**Checkpoint**: US2 is independently functional and testable.

---

## Phase 5: User Story 3 - Enforce Governance Authorization Boundaries (Priority: P1)

**Goal**: Remove moderator bypass for privileged valuable-action mutations.

**Independent Test**: Moderator direct mutation fails; timelock/governance path succeeds.

### Tests for User Story 3

- [x] T037 [P] [US3] Add unauthorized moderator mutation regression tests in test/ValuableActionRegistry.t.sol
- [x] T038 [P] [US3] Add governance-authorized mutation success tests in test/ValuableActionRegistry.t.sol

### Implementation for User Story 3

- [x] T039 [US3] Replace `onlyModerator` with governance-restricted authorization for update in contracts/modules/ValuableActionRegistry.sol
- [x] T040 [US3] Replace `onlyModerator` with governance-restricted authorization for deactivate in contracts/modules/ValuableActionRegistry.sol

### Integration for User Story 3

- [x] T041 [US3] Add authorization boundary integration checks with role/timelock assumptions in test/ValuableActionRegistry.t.sol

**Checkpoint**: US3 is independently functional and testable.

---

## Phase 6: User Story 4 - Harden Against Availability and Manipulation Risks (Priority: P2)

**Goal**: Reduce manipulation and gas-DoS surfaces while adding reentrancy protections.

**Independent Test**: Reentrancy attempts fail, long reservations are bounded, and juror selection shows improved anti-timing resilience.

### Tests for User Story 4

- [x] T042 [P] [US4] Add staking reentrancy attack tests using malicious token fixture in test/MarketplaceHousing.t.sol
- [x] T043 [P] [US4] Add max-stay and over-limit reservation tests in test/MarketplaceHousing.t.sol
- [x] T044 [P] [US4] Add juror entropy anti-timing regression tests in test/VerifierManager.t.sol

### Implementation for User Story 4

- [x] T045 [US4] Add reentrancy guard inheritance to housing module in contracts/modules/HousingManager.sol
- [x] T046 [US4] Apply reentrancy protection to stake/unstake flows in contracts/modules/HousingManager.sol
- [x] T047 [US4] Add bounded reservation window guard in contracts/modules/HousingManager.sol
- [x] T048 [US4] Improve juror selection entropy strategy in contracts/modules/VerifierManager.sol

### Integration for User Story 4

- [x] T049 [US4] Add housing reservation boundary integration scenario in test/MarketplaceHousing.t.sol
- [x] T050 [US4] Add verifier selection fairness regression scenario in test/VerifierManager.t.sol

**Checkpoint**: US4 is independently functional and testable.

---

## Phase 7: Operational Controls (Design-Awareness, no behavior changes)

**Purpose**: Implement D-1 and D-2 safeguards through monitoring, alerts, runbooks, and documentation.

- [x] T051 Define D-1 monitoring thresholds and ownership in docs/EN/Architecture.md
- [x] T052 [P] Define D-2 anomaly detection and ownership in docs/EN/Architecture.md
- [x] T053 Create D-1 runbook (mint + deposit atomic governance operation) in docs/EN/guides/security-runbook-d1.md
- [x] T054 Create D-2 runbook (position-claim anomaly response) in docs/EN/guides/security-runbook-d2.md
- [x] T055 [P] Add optional monitoring helper script for backing ratio checks in scripts/check-balance.ts
- [x] T056 [P] Add optional monitoring helper script for claim anomaly checks in scripts/check-claim-status.ts

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation parity, broad validation, and release readiness.

- [x] T057 Update implementation-accurate behavior statements in contracts/FEATURES.md
- [x] T058 [P] Update security architecture narrative in docs/EN/Architecture.md
- [x] T059 [P] Update user-facing security posture notes in docs/EN/Whitepaper.md
- [x] T060 Run targeted and full regression commands from specs/001-security-fixes/quickstart.md
- [x] T061 Sync ABIs after contract/interface changes via scripts/copy-ponder-abis.js and scripts/copy-web-abis.js
- [x] T062 Update rollout status notes in .github/project-management/STATUS_REVIEW.md

---

## Phase 9: Security Closeout & Signoff (Checklist-Driven)

**Purpose**: Produce explicit closeout evidence and resolve remaining ambiguity gates required by `checklists/security-closeout.md`.

- [x] T063 Create closeout evidence bundle document with finding-by-finding trace links in specs/001-security-fixes/contracts/security-closeout-evidence.md
- [x] T064 [P] Add M-1 quantitative methodology and threshold statement in specs/001-security-fixes/spec.md
- [x] T065 Add explicit M-1 closeout decision record (`FULLY_RESOLVED` or `RESIDUAL_RISK_ACCEPTED`) and approver in specs/001-security-fixes/contracts/security-closeout-evidence.md
- [x] T066 [P] Add deterministic settlement outcome matrix (routed vs fallback) in specs/001-security-fixes/spec.md
- [x] T067 [P] Add external dependency validation matrix and compensating controls in specs/001-security-fixes/spec.md
- [x] T068 Add partial-rollout recovery and rollback runbook checks in specs/001-security-fixes/quickstart.md
- [x] T069 Map and check off `specs/001-security-fixes/checklists/security-closeout.md` with evidence links
- [x] T070 Final signoff update in .github/project-management/STATUS_REVIEW.md with residual-risk ownership

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Starts immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 and blocks all story work.
- **Phase 3 (US1)**: Starts after Phase 2 and must begin first because it contains Immediate blocker (`C-1`).
- **Phase 4 (US2)** and **Phase 5 (US3)**: Start after Phase 2; run in parallel after US1 Immediate tasks T016–T018 complete.
- **Phase 6 (US4)**: Starts after Phase 2; scheduled after Before-mainnet items for security-first ordering.
- **Phase 7 (Operational controls)**: Starts after relevant code behaviors are finalized.
- **Phase 8 (Polish)**: Runs after implementation stabilization.
- **Phase 9 (Closeout)**: Final gate; required before security-audit completion declaration.

### User Story Dependencies

- **US1 (P1)**: No dependencies beyond Foundational; includes Immediate blocker and core fund safety.
- **US2 (P1)**: Depends on Foundational; independent from US3, partial overlap with US4 only through shared files.
- **US3 (P1)**: Depends on Foundational; independent validation path.
- **US4 (P2)**: Depends on Foundational; best executed after Before-mainnet fixes stabilize.

### Within Each User Story

- Tests first (expected to fail before implementation).
- Contract/interface updates before integration/regression tests.
- Story completes when primary + edge-case tests pass and DoD is met.

### Severity Bucket Execution

1. **Immediate**: T016–T018
2. **Before mainnet**: T019–T020, T029–T032, T039–T040
3. **Pre-production hardening**: T021–T022, T033–T034, T045–T048
4. **Operational controls**: T051–T056
5. **Closeout signoff**: T063–T070

---

## Parallel Execution Examples

### User Story 1

```bash
# Parallel test authoring:
T010, T011, T012, T013, T014, T015

# Parallel implementation after Immediate baseline:
T019 and T020
```

### User Story 2

```bash
# Parallel test tasks:
T025, T026, T027, T028

# Parallel integration checks after implementation:
T035 and T036
```

### User Story 3

```bash
# Parallel authorization tests:
T037 and T038
```

### User Story 4

```bash
# Parallel test authoring:
T042, T043, T044

# Parallel integration checks:
T049 and T050
```

---

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1 + Phase 2.
2. Complete US1 through Immediate and Before-mainnet scope.
3. Validate US1 independently (fund-flow invariants + payout + settlement).
4. Stage deploy/replay critical revenue and settlement flows.

### Incremental Security Delivery

1. Deliver US1 (fund safety + blocker fixes).
2. Deliver US2 and US3 (liveness + authorization invariants).
3. Deliver US4 hardening (anti-DoS, reentrancy, entropy).
4. Deliver Operational controls + doc parity and final regression.

### Team Parallelization Strategy

- Engineer A: US1 funds + settlement tracks.
- Engineer B: US2 engagements + RequestHub rate-limit.
- Engineer C: US3 authorization + US4 hardening tasks.
- Security/Ops: Phase 7 operational controls and documentation.

---

## Notes

- `[P]` tasks touch different files and can run concurrently.
- Every finding from CRITICAL/HIGH/MEDIUM is represented by at least one implementation task and one test task.
- Design-Awareness items (D-1, D-2) are handled in operational controls only (no behavior changes).
- Security closeout requires Phase 9 evidence completion before final signoff.
