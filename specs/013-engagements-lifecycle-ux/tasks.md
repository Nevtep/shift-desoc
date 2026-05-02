# Tasks: Engagements Rich Lifecycle UX

**Input**: Design documents from `/specs/013-engagements-lifecycle-ux/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/engagements-lifecycle.graphql`, `contracts/engagements-lifecycle.openapi.yaml`

**No-ABI Baseline**: Default delivery is strict no-ABI/no-event-change. Do not modify `contracts/**` source, `apps/web/abis/**`, or `apps/indexer/abis/**` unless a new hard blocker is proven and documented.

**Tests**: Cross-layer tests are required for `apps/web` and `apps/indexer`.

## Phase 1: Setup

**Purpose**: Lock scope, no-ABI guardrails, and execution commands.

- [ ] T001 Capture feature-specific implementation guardrails and success gates in `specs/013-engagements-lifecycle-ux/quickstart.md`
- [ ] T002 Add no-ABI/no-event-change compatibility guard test in `apps/indexer/test/unit/abi-event-compatibility.test.ts`
- [ ] T003 [P] Add feature-targeted web test command block in `specs/013-engagements-lifecycle-ux/quickstart.md`
- [ ] T004 [P] Add feature-targeted indexer replay/readiness command block in `specs/013-engagements-lifecycle-ux/quickstart.md`

---

## Phase 2: Foundational (Blocking)

**Purpose**: Shared infrastructure that must exist before user stories.

**Critical**: No user story work begins until this phase is complete.

- [ ] T005 Define engagement projection schema entities and indexes in `apps/indexer/ponder.schema.ts`
- [ ] T006 Implement/expand engagement schema exports for projection typing in `apps/indexer/schema/engagements.ts`
- [ ] T007 [P] Add engagement readiness query/DTO types in `apps/web/lib/graphql/queries.ts`
- [ ] T008 [P] Implement shared engagement community boundary guard hook in `apps/web/hooks/useEngagementBoundary.ts`
- [ ] T009 Implement deterministic submit transaction state model types and reducer in `apps/web/hooks/useEngagementSubmitState.ts`
- [ ] T010 [P] Add unit tests for submit transaction state machine transitions in `apps/web/tests/unit/hooks/use-engagement-submit-state.test.tsx`
- [ ] T011 [P] Add unit tests for engagement community boundary guard behavior in `apps/web/tests/unit/hooks/use-engagement-boundary.test.tsx`
- [ ] T012 Implement known revert/error normalization utility for engagement submit in `apps/web/lib/engagements/tx-error-mapping.ts`
- [ ] T013 [P] Add unit tests for revert/error normalization mapping in `apps/web/tests/unit/lib/engagements/tx-error-mapping.test.ts`

**Checkpoint**: Foundational complete; story work can proceed.

---

## Phase 3: User Story 1 - Submit Real Engagement On-Chain (Priority: P1) 🎯 MVP

**Goal**: Real one-transaction engagement submit after evidence upload, with canonical `engagementId` recovered from receipt logs.

**Independent Test**: In a selected community, user can select only active Valuable Actions, build/upload structured evidence, execute one `Engagements.submit(typeId, evidenceCID)` tx, recover `engagementId` from `EngagementSubmitted`, and route deterministically without fake created state.

### Tests for User Story 1 (write first)

- [ ] T014 [P] [US1] [app] Add active Valuable Action enforcement tests for submit form in `apps/web/tests/unit/components/engagement-submit-form.test.tsx`
- [ ] T015 [P] [US1] [app] Add IPFS upload gating tests (no tx before CID) in `apps/web/tests/unit/components/engagement-submit-form-upload-gating.test.tsx`
- [ ] T016 [P] [US1] [app] Add receipt decode and canonical `engagementId` recovery tests in `apps/web/tests/unit/components/engagement-submit-form-receipt-recovery.test.tsx`
- [ ] T017 [P] [US1] [app] Add no-fake-created-state tests on wallet reject/revert/decode failure in `apps/web/tests/unit/components/engagement-submit-form-no-fake-created.test.tsx`
- [ ] T018 [P] [US1] [app] Add deterministic post-submit routing tests for community-scoped detail route in `apps/web/tests/unit/components/engagement-submit-form-routing.test.tsx`
- [ ] T019 [P] [US1] [indexer] Add EngagementSubmitted projection creation test with community keying in `apps/indexer/test/integration/engagement-submitted-projection.test.ts`

### Implementation for User Story 1

- [ ] T020 [US1] [app] Refactor submit form to consume route community context (remove manual community entry dependency) in `apps/web/components/engagements/engagement-submit-form.tsx`
- [ ] T021 [US1] [app] Wire active Valuable Action catalog selection into submit flow in `apps/web/components/engagements/engagement-submit-form.tsx`
- [ ] T022 [US1] [app] Implement structured evidence payload builder from Valuable Action evidence spec assumptions in `apps/web/lib/valuable-actions/engagement-compat.ts`
- [ ] T023 [US1] [app] Implement evidence upload gate and CID handoff to submit path in `apps/web/components/engagements/engagement-submit-form.tsx`
- [ ] T024 [US1] [app] Execute exact submit write path `Engagements.submit(typeId, evidenceCID)` and integrate tx state machine in `apps/web/components/engagements/engagement-submit-form.tsx`
- [ ] T025 [US1] [app] Implement receipt-log decode of `EngagementSubmitted` and `engagementId` extraction in `apps/web/components/engagements/engagement-submit-form.tsx`
- [ ] T026 [US1] [app] Implement deterministic community-scoped success routing with identity-pending fallback in `apps/web/components/engagements/engagement-submit-form.tsx`
- [ ] T027 [US1] [app] Add/adjust community-scoped engagement create route container in `apps/web/app/community/[id]/engagements/page.tsx`
- [ ] T028 [US1] [indexer] Ensure `Engagements:EngagementSubmitted` handler persists canonical submit fields without shadow authority in `apps/indexer/src/index.ts`
- [ ] T029 [US1] [compat] Confirm no contract source/ABI/event changes were introduced and record result in `specs/013-engagements-lifecycle-ux/quickstart.md`

**Checkpoint**: US1 is fully functional and independently testable as MVP.

---

## Phase 4: User Story 2 - View Lifecycle Truthfully After Submit (Priority: P2)

**Goal**: Community-scoped list/detail surfaces show truthful lifecycle and readiness by separating chain-confirmed and projected states.

**Independent Test**: After a real submit, list/detail in selected community show the record with truthful pending lifecycle, explicit readiness under lag/unavailable conditions, and blocked cross-community detail access.

### Tests for User Story 2 (write first)

- [ ] T030 [P] [US2] [app] Add community boundary tests for list/detail surfaces in `apps/web/tests/unit/components/engagement-list-boundary.test.tsx`
- [ ] T031 [P] [US2] [app] Add truthful readiness behavior tests (`healthy|lagging|unavailable`) in `apps/web/tests/unit/components/engagement-readiness-banner.test.tsx`
- [ ] T032 [P] [US2] [app] Add post-submit truth model tests (chain-confirmed vs projection-delayed messaging) in `apps/web/tests/unit/components/engagement-detail-truth-model.test.tsx`
- [ ] T033 [P] [US2] [indexer] Add lifecycle projection tests for resolved/revoked transitions in `apps/indexer/test/integration/engagement-lifecycle-projection.test.ts`
- [ ] T034 [P] [US2] [indexer] Add readiness endpoint behavior test for engagement views in `apps/indexer/test/integration/engagement-readiness-endpoint.test.ts`

### Implementation for User Story 2

- [ ] T035 [US2] [indexer] Add or expand community-scoped engagement list/detail endpoints and readiness payloads in `apps/indexer/src/index.ts`
- [ ] T036 [US2] [indexer] Ensure `EngagementResolved` and `EngagementRevoked` handlers keep deterministic lifecycle projection in `apps/indexer/src/index.ts`
- [ ] T037 [US2] [app] Update engagement GraphQL queries/types for community-scoped list/detail and readiness fields in `apps/web/lib/graphql/queries.ts`
- [ ] T038 [US2] [app] Refactor engagement list component for strict community scoping and readiness display in `apps/web/components/engagements/engagement-list.tsx`
- [ ] T039 [US2] [app] Refactor engagement detail component for truthful lifecycle/readiness and boundary guard behavior in `apps/web/components/engagements/engagement-detail.tsx`
- [ ] T040 [US2] [app] Add/adjust community-scoped detail route in `apps/web/app/community/[id]/engagements/[engagementId]/page.tsx`
- [ ] T041 [US2] [app] Keep non-community engagement routes deterministic by redirecting/bridging into community-scoped routes in `apps/web/app/engagements/page.tsx`
- [ ] T042 [US2] [app] Keep non-community engagement detail route deterministic by redirecting/bridging into community-scoped detail in `apps/web/app/engagements/[engagementId]/page.tsx`

**Checkpoint**: US2 independently delivers truthful lifecycle visibility after submit.

---

## Phase 5: User Story 3 - Understand Multi-Step Submission States (Priority: P3)

**Goal**: Explicitly model and present submission steps and failure paths users can understand and recover from.

**Independent Test**: User can see each step (`payload preparation`, `wallet prompt`, `tx hash received`, `chain confirmation`, `identity resolved/identity pending`) and receives explicit state-specific guidance for failures.

### Tests for User Story 3 (write first)

- [ ] T043 [P] [US3] [app] Add submit-step rendering tests for all transaction states in `apps/web/tests/unit/components/engagement-submit-form-stepper.test.tsx`
- [ ] T044 [P] [US3] [app] Add failure-path messaging tests for wallet reject/wrong chain/revert in `apps/web/tests/unit/components/engagement-submit-form-failure-messaging.test.tsx`
- [ ] T045 [P] [US3] [app] Add identity-pending recovery state tests (confirmed tx without decoded id) in `apps/web/tests/unit/components/engagement-submit-form-identity-pending.test.tsx`
- [ ] T046 [P] [US3] [app] Add duplicate-submit guard tests while tx is pending in `apps/web/tests/unit/components/engagement-submit-form-duplicate-submit.test.tsx`

### Implementation for User Story 3

- [ ] T047 [US3] [app] Add explicit submit-step panel UI bound to submit state machine in `apps/web/components/engagements/engagement-submit-form.tsx`
- [ ] T048 [US3] [app] Integrate normalized failure mapping into user-facing messages and remediation actions in `apps/web/components/engagements/engagement-submit-form.tsx`
- [ ] T049 [US3] [app] Implement identity-pending retry controls and guardrails without optimistic creation in `apps/web/components/engagements/engagement-submit-form.tsx`
- [ ] T050 [US3] [app] Add anti-duplicate submit locking behavior and UI feedback in `apps/web/components/engagements/engagement-submit-form.tsx`
- [ ] T051 [US3] [app] Add readiness/truth explanatory messaging component for post-submit state transitions in `apps/web/components/engagements/engagement-submit-truth-banner.tsx`
- [ ] T052 [US3] [app] Integrate truth banner in community-scoped engagement create/detail pages in `apps/web/app/community/[id]/engagements/page.tsx`

**Checkpoint**: US3 independently delivers comprehensible, explicit multi-step transaction UX.

---

## Phase 6: Polish & Docs

**Purpose**: Final regression hardening, compatibility validation, and documentation/status sync.

- [ ] T053 [P] [app] Add cross-story regression suite for active VA enforcement, boundary guards, tx state transitions, IPFS gating, receipt decode recovery, and no-fake-created-state in `apps/web/tests/unit/components/engagements-regression-suite.test.tsx`
- [ ] T054 [P] [indexer] Add replay determinism + schema compatibility smoke tests for engagements readiness/list/detail surfaces in `apps/indexer/test/integration/engagements-schema-compatibility-smoke.test.ts`
- [ ] T055 Run full web unit gate and capture outputs in `specs/013-engagements-lifecycle-ux/quickstart.md`
- [ ] T056 Run full indexer unit/integration gates and capture outputs in `specs/013-engagements-lifecycle-ux/quickstart.md`
- [ ] T057 [docs] Update shipped behavior docs for Engagement lifecycle UX in `docs/EN/Architecture.md`
- [ ] T058 [docs] Update feature inventory and protocol behavior notes in `contracts/FEATURES.md`
- [ ] T059 [docs] Update system narrative for Engagement tx-capable slice in `neuromancer/SHIFT_SYSTEM.md`
- [ ] T060 [P] [docs] If status/risk/workflow expectations changed, synchronize `.github/project-management/IMPLEMENTATION_STATUS.md` and `.github/project-management/STATUS_REVIEW.md`
- [ ] T061 [compat] Re-verify no contract source/ABI/event changes and document compliance in `specs/013-engagements-lifecycle-ux/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): No dependencies.
- Foundational (Phase 2): Depends on Setup completion; blocks all story phases.
- User Story phases (Phases 3-5): Depend on Foundational completion.
- Polish & Docs (Phase 6): Depends on completion of desired user stories.

### User Story Dependencies

- US1 (P1): Starts after Foundational; no dependency on other stories.
- US2 (P2): Starts after Foundational and leverages US1 submit outputs for post-submit visibility checks.
- US3 (P3): Starts after Foundational; integrates with US1 submit state model and US2 truth/readiness surfaces.

### Strict Dependency Chain (single-threaded)

- T001 -> T005 -> T014 -> T020 -> T030 -> T035 -> T043 -> T047 -> T053

### Within Each User Story

- Tests must be implemented first and verified failing before implementation tasks.
- Implementation tasks run after test scaffolding in that story.
- Story checkpoint must pass before moving to next priority in single-thread mode.

---

## Parallel Opportunities

- Setup tasks marked `[P]` can run concurrently.
- Foundational tasks T007/T008/T010/T011/T013 can run concurrently after T005/T006.
- US1 tests T014-T019 can run in parallel.
- US2 tests T030-T034 can run in parallel.
- US3 tests T043-T046 can run in parallel.
- Polish tests T053 and T054 can run in parallel.

---

## Parallel Example: User Story 1

```bash
# Parallel test-first batch for US1
Task: T014 apps/web/tests/unit/components/engagement-submit-form.test.tsx
Task: T015 apps/web/tests/unit/components/engagement-submit-form-upload-gating.test.tsx
Task: T016 apps/web/tests/unit/components/engagement-submit-form-receipt-recovery.test.tsx
Task: T017 apps/web/tests/unit/components/engagement-submit-form-no-fake-created.test.tsx
Task: T018 apps/web/tests/unit/components/engagement-submit-form-routing.test.tsx
Task: T019 apps/indexer/test/integration/engagement-submitted-projection.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1) fully.
3. Validate US1 independently with real tx-capable flow criteria.
4. Demo/deploy MVP if stable.

### Incremental Delivery

1. Add US1: real submit + canonical identity recovery.
2. Add US2: truthful post-submit list/detail/readiness.
3. Add US3: explicit multi-step transaction state UX.
4. Finish polish/docs and full regression gates.

### Validation Gates (must pass)

- Real user can submit engagement with exactly one on-chain tx after evidence upload.
- `engagementId` is recovered from `EngagementSubmitted` receipt logs.
- No fake/optimistic engagement creation is shown before tx success + identity recovery.
- Create/list/detail remain exact community-scoped.
- Active Valuable Action enforcement is strict.
- Readiness/lifecycle states remain truthful under lag/unavailable projection.
- No contract source/ABI/event changes were required.
