# Tasks: Single-Community Architecture Refactor (Base Sepolia Staging)

**Input**: Design documents from `specs/004-single-community-architecture/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`

**Tests**: Required across contracts, deploy flow, Manager Wizard, and indexer/app compatibility where impacted.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Build cross-layer impact checklist from `specs/004-single-community-architecture/plan.md` and map FR/SI/SC coverage in `specs/004-single-community-architecture/tasks.md` (FR-001..FR-011, SI-001..SI-006, SC-001..SC-007) [Owner: PM/Architecture] [DoD: Coverage map complete and referenced by task IDs]
- [ ] T002 Define feature flags/guards for strict staging mode (no migration/backfill/mixed-mode) in `apps/web/lib/deploy/default-step-executor.ts` and `scripts/hardhat/community-deploy-lib.ts` (FR-007, SC-006) [Owner: Web+Scripts] [DoD: Runtime guards and test assertions block legacy paths]
- [ ] T003 [P] Establish validation command checklist in `specs/004-single-community-architecture/quickstart.md` for Foundry/Hardhat/ABI sync (SC-001, SC-007) [Owner: DevEx] [DoD: Commands validated and documented]

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T004 Implement authority model baseline (bootstrap vs post-handoff) in `scripts/hardhat/community-deploy-lib.ts` and `test/DeploymentRoleWiring.t.sol` (FR-005, SI-001, SI-002, SC-003, SC-005) [Owner: Scripts+Contracts] [DoD: Pre-handoff deployer actions pass; post-handoff direct restricted writes fail]
- [ ] T005 [P] Remove proposal-driven deploy wiring path from runtime orchestration in `apps/web/lib/deploy/default-step-executor.ts` and `apps/web/hooks/useDeployWizard.ts` (FR-004, FR-005, SC-004) [Owner: Web] [DoD: No proposal-wiring branch remains for deploy bootstrap]
- [ ] T006 [P] Add two-community isolation baseline tests in `test/Wiring.t.sol` and `test/DeploymentRoleWiring.t.sol` (FR-006, SI-003, SC-002) [Owner: Contracts] [DoD: Unauthorized cross-community privileged mutations fail]
- [ ] T007 Define ABI/event delta checklist for refactor wave in `specs/004-single-community-architecture/contracts/deploy-orchestration.openapi.yaml` and `specs/004-single-community-architecture/plan.md` (MR-002, SC-007) [Owner: Contracts+Indexer] [DoD: Contract/event change checkpoints documented and linked to tasks]
- [ ] T008 Lock migration/backfill exclusion in workflow docs `specs/004-single-community-architecture/spec.md` and `specs/004-single-community-architecture/quickstart.md` (CM-002, SP-001..SP-004, SC-006) [Owner: Architecture] [DoD: Explicit exclusion language present and validated]

**Checkpoint**: Foundational authority and policy baseline complete.

---

## Phase 3: User Story 1 - Refactor Deploy Stack Contracts (Priority: P1) 🎯 MVP

**Goal**: Convert each deploy stack contract to single-community internals and prove isolation/authorization invariants.

**Independent Test**: All matrix contracts refactored with passing tests and isolation checks.

### Contract-by-Contract Tasks (Main Objective)

Single-community DoD rule for US1 refactor tasks:
1. Internal state does not rely on multi-community keyed paths for runtime behavior.
2. Authorization is scoped to local deployment authority model.
3. Contract tests prove behavior in single-community mode and preserve required invariants.

- [X] T009 [US1] [contracts] Refactor `contracts/modules/CommunityRegistry.sol` to remove `AccessManaged` reliance and enforce explicit internal auth guards; update `test/CommunityRegistry.t.sol` with guard-path assertions and evidence notes in `specs/004-single-community-architecture/research.md` (FR-011, SI-006, SC-001, SC-002, SC-005) [Owner: Contracts] [DoD: Single-community DoD rule satisfied for CommunityRegistry + no `AccessManaged` dependency remains]
- [X] T010 [US1] [contracts] Refactor `contracts/modules/ParamController.sol` to per-community deployment assumptions and local authority wiring; update `test/ParamControllerVPT.t.sol` and `test/ParameterIntegration.t.sol` (FR-002, FR-003, SI-001, SC-001, SC-005) [Owner: Contracts] [DoD: Single-community DoD rule satisfied for ParamController + no shared deployment assumption remains]
- [X] T011 [US1] [contracts] Align `contracts/core/ShiftGovernor.sol` for per-community authority linkage and local timelock constraints; update `test/CountingMultiChoice.t.sol` and `test/Wiring.t.sol` (FR-002, SI-001, SC-001, SC-005) [Owner: Contracts] [DoD: Single-community DoD rule satisfied for ShiftGovernor + local timelock-only authority validated]
- [X] T012 [US1] [contracts] Validate per-community Timelock behavior in deploy wiring logic via `scripts/hardhat/community-deploy-lib.ts` and `test/DeploymentRoleWiring.t.sol` (FR-002, SI-001, SC-003, SC-005) [Owner: Scripts+Contracts] [DoD: Single-community DoD rule satisfied for timelock wiring + post-handoff final authority enforced]
- [X] T013 [US1] [contracts] Validate local governance token authority assumptions in `contracts/tokens/MembershipTokenERC20Votes.sol` and `test/MembershipToken.t.sol` (FR-002, FR-003, SC-001, SC-005) [Owner: Contracts] [DoD: Single-community DoD rule satisfied for MembershipToken authority paths]
- [X] T014 [P] [US1] [contracts] Refactor `contracts/modules/RequestHub.sol`; update `test/RequestHub.t.sol` and attach evidence reference in `specs/004-single-community-architecture/data-model.md` (FR-003, SI-003, SC-001, SC-002) [Owner: Contracts] [DoD: Single-community DoD rule satisfied for RequestHub]
- [X] T015 [P] [US1] [contracts] Refactor `contracts/modules/DraftsManager.sol`; update `test/DraftsManager.t.sol` (FR-003, SC-001, SC-002) [Owner: Contracts] [DoD: Single-community DoD rule satisfied for DraftsManager]
- [X] T016 [P] [US1] [contracts] Refactor `contracts/modules/ValuableActionRegistry.sol`; update `test/ValuableActionRegistry.t.sol` (FR-003, SC-001, SC-002, SC-005) [Owner: Contracts] [DoD: Single-community DoD rule satisfied for ValuableActionRegistry]
- [X] T017 [P] [US1] [contracts] Refactor `contracts/modules/Engagements.sol`; update `test/Engagements.t.sol` and `test/WORK_VERIFICATION_E2E_SUMMARY.md` references as needed (FR-003, SI-005, SC-001, SC-002, SC-005) [Owner: Contracts] [DoD: Single-community DoD rule satisfied for Engagements + verifier invariants preserved]
- [X] T018 [P] [US1] [contracts] Refactor `contracts/modules/CredentialManager.sol`; update `test/CredentialManager.t.sol` (FR-003, SC-001, SC-002) [Owner: Contracts] [DoD: Single-community DoD rule satisfied for CredentialManager]
- [X] T019 [P] [US1] [contracts] Refactor `contracts/modules/PositionManager.sol`; update `test/PositionManager.t.sol` (FR-003, SC-001, SC-002) [Owner: Contracts] [DoD: Single-community DoD rule satisfied for PositionManager]
- [X] T020 [P] [US1] [contracts] Refactor `contracts/modules/ValuableActionSBT.sol`; update `test/ValuableActionSBT.t.sol` (FR-003, SI-005, SC-001, SC-002, SC-005) [Owner: Contracts] [DoD: Single-community DoD rule satisfied for ValuableActionSBT + token security behavior preserved]
- [X] T021 [P] [US1] [contracts] Refactor `contracts/tokens/VerifierPowerToken1155.sol`; update `test/VerifierPowerToken1155.t.sol` (FR-003, SI-005, SC-001, SC-002, SC-005) [Owner: Contracts] [DoD: Single-community DoD rule satisfied for VerifierPowerToken1155]
- [X] T022 [P] [US1] [contracts] Refactor `contracts/modules/VerifierElection.sol`; update `test/VerifierElection.t.sol` (FR-003, SI-005, SC-001, SC-002, SC-005) [Owner: Contracts] [DoD: Single-community DoD rule satisfied for VerifierElection]
- [X] T023 [P] [US1] [contracts] Refactor `contracts/modules/VerifierManager.sol`; update `test/VerifierManager.t.sol` (FR-003, SI-005, SC-001, SC-002, SC-005) [Owner: Contracts] [DoD: Single-community DoD rule satisfied for VerifierManager]
- [X] T024 [P] [US1] [contracts] Refactor `contracts/tokens/CommunityToken.sol`; update `test/CommunityToken.t.sol` (FR-003, SC-001, SC-002, SC-005) [Owner: Contracts] [DoD: Single-community DoD rule satisfied for CommunityToken]
- [X] T025 [P] [US1] [contracts] Refactor `contracts/modules/CohortRegistry.sol`; update `test/CohortRegistry.t.sol` (FR-003, SC-001, SC-002) [Owner: Contracts] [DoD: Single-community DoD rule satisfied for CohortRegistry]
- [X] T026 [P] [US1] [contracts] Refactor `contracts/modules/RevenueRouter.sol`; update `test/RevenueRouterCohort.t.sol` and `test/MarketplaceRevenueRouter.t.sol` (FR-003, SI-004, SC-001, SC-002, SC-005) [Owner: Contracts] [DoD: Single-community DoD rule satisfied for RevenueRouter + treasury/revenue invariants preserved]
- [X] T027 [P] [US1] [contracts] Refactor `contracts/modules/TreasuryAdapter.sol`; update `test/TreasuryAdapter.t.sol` (FR-003, SI-004, SC-001, SC-002, SC-005) [Owner: Contracts] [DoD: Single-community DoD rule satisfied for TreasuryAdapter + guardrails preserved]
- [X] T028 [P] [US1] [contracts] Refactor `contracts/modules/InvestmentCohortManager.sol`; update `test/InvestmentCohortManager.t.sol` (FR-003, SC-001, SC-002) [Owner: Contracts] [DoD: Single-community DoD rule satisfied for InvestmentCohortManager]
- [X] T029 [P] [US1] [contracts] Refactor `contracts/modules/Marketplace.sol`; update `test/MarketplaceDisputes.t.sol` and `test/MarketplaceHousing.t.sol` (FR-003, SC-001, SC-002, SC-005) [Owner: Contracts] [DoD: Single-community DoD rule satisfied for Marketplace]
- [X] T030 [P] [US1] [contracts] Refactor `contracts/modules/CommerceDisputes.sol`; update `test/MarketplaceDisputes.t.sol` (FR-003, SC-001, SC-002, SC-005) [Owner: Contracts] [DoD: Single-community DoD rule satisfied for CommerceDisputes]
- [X] T031 [P] [US1] [contracts] Refactor `contracts/modules/HousingManager.sol`; update `test/MarketplaceHousing.t.sol` (FR-003, SC-001, SC-002) [Owner: Contracts] [DoD: Single-community DoD rule satisfied for HousingManager]
- [X] T032 [P] [US1] [contracts] Refactor `contracts/modules/ProjectFactory.sol`; add or update `test/ProjectFactory.t.sol` (FR-003, SC-001, SC-002) [Owner: Contracts] [DoD: Single-community DoD rule satisfied for ProjectFactory]
- [X] T033 [US1] [contracts] Validate full US1 contract wave by running and fixing `pnpm forge:test` + `pnpm forge:cov` + `pnpm cov:gate`; record evidence in `specs/004-single-community-architecture/quickstart.md` (SC-001, SC-002, SC-005) [Owner: Contracts] [DoD: Single-community DoD rule evidenced for all T009-T032 and coverage gate passes]

**Checkpoint**: Primary objective complete when T009-T033 are complete.

---

## Phase 4: User Story 2 - Deploy New Community Safely (Priority: P2)

**Goal**: Per-community bootstrap wiring in AccessManager + mandatory admin handoff to timelock.

**Independent Test**: Fresh deploy run reaches verified state, and post-handoff direct restricted writes fail.

- [ ] T034 [US2] [scripts] Deploy per-community `AccessManager` and `ParamController` in `scripts/hardhat/community-deploy-lib.ts` and `scripts/hardhat/deploy-shared-infra.ts` boundaries (FR-002, FR-007, SC-003, SC-006) [Owner: Scripts] [DoD: Community deploy outputs local AM/PC addresses, no shared PC assumption]
- [ ] T035 [US2] [scripts] Implement selector permission bootstrap in local AccessManager in `scripts/hardhat/community-deploy-lib.ts` and verify via `test/DeploymentRoleWiring.t.sol` (FR-005, SI-002, SC-003, SC-005) [Owner: Scripts+Contracts] [DoD: Bootstrap selectors configured and validated]
- [ ] T036 [US2] [scripts] Implement and verify admin handoff to community timelock in `scripts/hardhat/community-deploy-lib.ts`; add assertions in `test/DeploymentRoleWiring.t.sol` (FR-005, SI-001, SI-002, SC-003, SC-005) [Owner: Scripts+Contracts] [DoD: Handoff tx confirmed and deploy completion blocked on failure]
- [ ] T037 [US2] [scripts] Update deployment metadata outputs in `deployments/*.json` handling inside `scripts/hardhat/community-deploy-lib.ts` to avoid legacy dependency reads (FR-007, SC-006, SC-007) [Owner: Scripts] [DoD: Fresh deployments do not require prior staged data]
- [ ] T038 [US2] [contracts] Add post-handoff negative tests for deployer/manager restricted writes in `test/DeploymentRoleWiring.t.sol` and `test/Wiring.t.sol` (SI-001, SI-002, SC-005) [Owner: Contracts] [DoD: Direct restricted writes fail after handoff]

**Checkpoint**: Deploy bootstrap-handoff model complete and proven.

---

## Phase 5: User Story 3 - Operate Clear Wizard State Machine (Priority: P3)

**Goal**: Implement exact 5-state deploy wizard without proposal-driven branch.

**Independent Test**: Wizard always follows required sequence and supports deterministic retry/restart.

- [ ] T039 [US3] [app] Implement required state enum and transitions in `apps/web/hooks/useDeployWizard.ts` for `PRECHECKS`, `DEPLOY_STACK`, `CONFIGURE_ACCESS_PERMISSIONS`, `HANDOFF_ADMIN_TO_TIMELOCK`, `VERIFY_DEPLOYMENT` (FR-004, UX-001..UX-007, SC-004) [Owner: Web] [DoD: Only allowed transitions exist]
- [ ] T040 [US3] [app] Implement execution handling for `CONFIGURE_ACCESS_PERMISSIONS` and `HANDOFF_ADMIN_TO_TIMELOCK` in `apps/web/lib/deploy/default-step-executor.ts` (FR-004, FR-005, SC-003, SC-004) [Owner: Web] [DoD: State handlers execute and persist deterministic results]
- [ ] T041 [US3] [app] Update wizard UI states and control gating in `apps/web/components/home/deploy-wizard.tsx` (UX-003, UX-004, UX-005, SC-004) [Owner: Web] [DoD: UI reflects exact states and blocks completion before handoff]
- [ ] T042 [US3] [app] Remove residual proposal-driven deploy assumptions from `apps/web/lib/deploy/default-step-executor.ts` and `apps/web/components/home/deploy-wizard.tsx` (FR-005, SC-004, SC-007) [Owner: Web] [DoD: No proposal wiring path in deploy bootstrap flow]
- [ ] T043 [US3] [app] Add/refresh wizard tests in `apps/web/tests/unit/hooks/use-deploy-wizard-execution.test.tsx` and `apps/web/tests/unit/components/deploy-wizard.test.tsx` covering success/failure/restart (UX-006, UX-007, SC-004) [Owner: Web] [DoD: Required state flow fully covered]

**Checkpoint**: Manager wizard behavior matches spec contract.

---

## Phase 6: User Story 4 - Remove Legacy Coupling in Staging (Priority: P4)

**Goal**: Enforce clean-slate Base Sepolia operation with no migration/backfill/mixed-mode.

**Independent Test**: Fresh deploy works independently of previous staged deployments.

- [ ] T044 [US4] [scripts] Remove migration/backfill hooks and mixed-mode runtime branches from `scripts/hardhat/community-deploy-lib.ts` and related deploy entrypoints (FR-007, SP-001..SP-004, SC-006) [Owner: Scripts] [DoD: No migration/backfill execution path remains]
- [ ] T045 [US4] [app] Remove legacy resume assumptions tied to old staged deployments in `apps/web/hooks/useDeployWizard.ts` and `apps/web/lib/deploy/default-step-executor.ts` (FR-007, UX-007, SC-006) [Owner: Web] [DoD: New run requires no old staged state]
- [ ] T046 [US4] [tests] Add staging-policy assertions in `apps/web/tests/unit/hooks/use-deploy-wizard-execution.test.tsx` and `test/DeploymentRoleWiring.t.sol` (SP-001..SP-004, SC-006) [Owner: Web+Contracts] [DoD: Tests fail if migration/backfill path is required]

**Checkpoint**: Staging policy enforced end-to-end.

---

## Phase 7: Cross-Cutting Sync and Final Validation

- [ ] T047 [P] [indexer] Update indexer ABIs/projections for contract event/interface changes in `apps/indexer/abis/**`, `apps/indexer/src/**`, and `apps/indexer/schema/**` (MR-002, MR-003, SC-007) [Owner: Indexer] [DoD: Indexer compiles and deterministic replay checks pass]
- [ ] T048 [P] [app] Sync web ABIs and consumers via `scripts/copy-web-abis.js`, `scripts/copy-ponder-abis.js`, and affected consumers in `apps/web/**` (MR-002, SC-007) [Owner: Web+Indexer] [DoD: ABI consumers updated with no runtime mismatch]
- [ ] T049 [P] [docs] Update architecture and behavior docs in `docs/EN/Architecture.md`, `docs/EN/Layers.md`, `docs/EN/Flows.md`, `contracts/FEATURES.md`, and `neuromancer/SHIFT_SYSTEM.md` (DT-001, DT-002, SC-007) [Owner: Docs+Architecture] [DoD: Docs reflect bootstrap/handoff and single-community target state]
- [ ] T050 [docs] Sync project status docs `.github/project-management/IMPLEMENTATION_STATUS.md` and `.github/project-management/STATUS_REVIEW.md` (DT-003, SC-007) [Owner: PM] [DoD: Both files updated consistently in same change set]
- [ ] T051 [contracts] Run full validation suite and record outputs in `specs/004-single-community-architecture/quickstart.md`: `pnpm forge:test`, `pnpm forge:cov`, `pnpm cov:gate`, `pnpm hh:compile` (SC-001..SC-007) [Owner: Contracts+Scripts] [DoD: All required checks pass]
- [ ] T052 [indexer] Run indexer build/replay validation using current project commands and document in `specs/004-single-community-architecture/quickstart.md` (MR-002, MR-003, SC-007) [Owner: Indexer] [DoD: No unresolved projection drift]
- [ ] T053 [app] Run web unit test suites for deploy wizard and document in `specs/004-single-community-architecture/quickstart.md` (SC-004, SC-007) [Owner: Web] [DoD: Wizard tests pass with required state coverage]

---

## Dependencies & Execution Order

### Critical Path

1. T004 -> T009/T010/T011/T012/T013 -> T014..T032 -> T033
2. T033 -> T034 -> T035 -> T036 -> T038
3. T036 -> T039 -> T040 -> T041 -> T043
4. T044 -> T046
5. T047/T048/T049/T050 -> T051/T052/T053

### Story Dependencies

1. US1 (T009-T033) is the primary objective and must complete before feature sign-off.
2. US2 (T034-T038) depends on foundational authority model and is required before US3 completion.
3. US3 (T039-T043) depends on US2 handoff semantics.
4. US4 (T044-T046) can run after T004 and in parallel with late US2/US3 work.

### Parallelizable Tasks

1. T005, T006, T007 can run in parallel after T004.
2. Contract refactor tasks T014-T032 are parallelizable by module ownership after T009-T013.
3. T047, T048, T049, T050 are parallelizable after contract ABI/event deltas stabilize.

### Explicit Exclusions (Base Sepolia)

1. No migration tasks.
2. No backfill tasks.
3. No legacy compatibility adapters.
4. No mixed-mode runtime support.

## Implementation Strategy

1. Deliver MVP by completing US1 and passing T033.
2. Add deploy bootstrap/handoff (US2), then wizard states (US3).
3. Enforce staging clean-slate policy (US4).
4. Finish cross-layer sync and full validation (Phase 7).
